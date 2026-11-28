import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AppSettings,
  Order,
  OrderAttachment,
  OrderFieldEntry,
  OrderStatus,
  PersistenceMode,
  RechargeMethod,
  RechargeRequest,
  ServiceItem,
  User,
  WalletTransaction,
} from '../src/types/index.ts';
import { DEFAULT_PUBLIC_SETTINGS } from '../src/data/seedData.ts';
import { INITIAL_SERVICES } from '../src/data/services.ts';
import {
  constantTimeEquals,
  generateUniqueId,
  generateUserId,
  hashSecret,
  normalizeWhatsappNumber,
  signLocalToken,
  verifyLocalToken,
  verifySecret,
} from './security.ts';

interface StoredLocalUser extends User {
  passwordHash: string;
}

interface LocalStoreData {
  users: StoredLocalUser[];
  services: ServiceItem[];
  orders: Order[];
  recharges: RechargeRequest[];
  transactions: WalletTransaction[];
  settings: AppSettings;
  adminPinHash: string;
  revokedTokens: string[];
}

export interface BootstrapResponse {
  services: ServiceItem[];
  settings: AppSettings;
  adminClaimRequired: boolean;
  persistenceMode: PersistenceMode;
  userState?: UserStateResponse | null;
  isAdminUnlocked?: boolean;
  adminState?: AdminStateResponse | null;
}

export interface AuthResponse {
  ok: boolean;
  code?: string;
  token?: string;
  user?: User;
}

export interface UserStateResponse {
  user: User;
  orders: Order[];
  recharges: RechargeRequest[];
  transactions: WalletTransaction[];
}

export interface AdminStateResponse {
  users: User[];
  orders: Order[];
  recharges: RechargeRequest[];
  transactions: WalletTransaction[];
  services: ServiceItem[];
  settings: AppSettings;
  persistenceMode: PersistenceMode;
}

const LOCAL_FILE_PATH = process.env.VERCEL
  ? '/tmp/ds-store.json'
  : path.resolve(process.cwd(), '.data/store.json');

let supabaseClient: SupabaseClient | null = null;
let supabaseInitUrl = '';
let supabaseInitKey = '';
let cachedMode: PersistenceMode | null = null;
let lastSupabaseProbeAt = 0;

function getSupabaseCredentials(): { url: string; key: string } {
  const url = (process.env.SUPABASE_URL || '').trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  ).trim();
  return { url, key };
}

function getSupabase(): SupabaseClient | null {
  const { url, key } = getSupabaseCredentials();
  if (!url || !key) return null;
  if (!supabaseClient || supabaseInitUrl !== url || supabaseInitKey !== key) {
    supabaseClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    supabaseInitUrl = url;
    supabaseInitKey = key;
  }
  return supabaseClient;
}

function hasEnvAdminPin(): boolean {
  const p = (process.env.ADMIN_PIN || '').trim();
  return p.length >= 4;
}

function verifyEnvAdminPin(pin: string): boolean {
  const envPin = (process.env.ADMIN_PIN || '').trim();
  if (envPin.length < 4) return false;
  return constantTimeEquals(pin.trim(), envPin);
}

// Async write-mutex queue for local fallback file persistence
let localQueue: Promise<unknown> = Promise.resolve();

function withLocalLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = localQueue.then(fn, fn);
  localQueue = next.catch(() => undefined);
  return next;
}

function createInitialLocalData(): LocalStoreData {
  return {
    users: [],
    services: INITIAL_SERVICES,
    orders: [],
    recharges: [],
    transactions: [],
    settings: { ...DEFAULT_PUBLIC_SETTINGS },
    adminPinHash: '',
    revokedTokens: [],
  };
}

async function readLocalData(): Promise<LocalStoreData> {
  try {
    const raw = await fs.readFile(LOCAL_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<LocalStoreData>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      services:
        Array.isArray(parsed.services) && parsed.services.length > 0
          ? parsed.services
          : INITIAL_SERVICES,
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      recharges: Array.isArray(parsed.recharges) ? parsed.recharges : [],
      transactions: Array.isArray(parsed.transactions)
        ? parsed.transactions
        : [],
      settings: {
        ...DEFAULT_PUBLIC_SETTINGS,
        ...(parsed.settings || {}),
      },
      adminPinHash: typeof parsed.adminPinHash === 'string' ? parsed.adminPinHash : '',
      revokedTokens: Array.isArray(parsed.revokedTokens)
        ? parsed.revokedTokens.slice(-200)
        : [],
    };
  } catch {
    const fresh = createInitialLocalData();
    await writeLocalData(fresh);
    return fresh;
  }
}

async function writeLocalData(data: LocalStoreData): Promise<void> {
  await fs.mkdir(path.dirname(LOCAL_FILE_PATH), { recursive: true });
  await fs.writeFile(LOCAL_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function sanitizeUser(u: StoredLocalUser): User {
  return {
    id: u.id,
    name: u.name,
    mobile: u.mobile,
    balance: u.balance,
    agreedToPolicy: u.agreedToPolicy,
    createdAt: u.createdAt,
  };
}

function sanitizeSettings(s: AppSettings): AppSettings {
  const { adminPin: _omit, ...rest } = s;
  return rest;
}

function computeAuthoritativePrice(
  services: ServiceItem[],
  serviceId: string,
  selectedOptionLabel?: string
): { service: ServiceItem; price: number } | null {
  const service = services.find((s) => s.id === serviceId && s.active);
  if (!service) return null;
  let price = service.basePrice;
  if (service.isDynamic && service.options && service.options.length > 0) {
    const matched = service.options.find(
      (opt) => opt.label === selectedOptionLabel
    );
    price = matched ? matched.price : service.options[0].price;
  }
  return { service, price };
}

async function probeSupabaseBootstrap(
  forceProbe = false
): Promise<BootstrapResponse | null> {
  const sb = getSupabase();
  if (!sb) {
    cachedMode = 'local-fallback';
    return null;
  }

  const now = Date.now();
  if (
    !forceProbe &&
    cachedMode === 'local-fallback' &&
    now - lastSupabaseProbeAt < 15_000
  ) {
    return null;
  }
  lastSupabaseProbeAt = now;

  try {
    const { data, error } = await sb.rpc('ds_bootstrap', {
      p_default_services: INITIAL_SERVICES,
      p_default_settings: DEFAULT_PUBLIC_SETTINGS,
    });

    if (error || !data) {
      if (cachedMode !== 'local-fallback' || forceProbe) {
        console.warn(
          '[Digital Sheba] Supabase schema not initialized yet; using server-side fallback storage until supabase/schema.sql is applied.',
          error?.code || error?.message || ''
        );
      }
      cachedMode = 'local-fallback';
      return null;
    }

    cachedMode = 'supabase';
    const payload = data as {
      services: ServiceItem[];
      settings: AppSettings;
      adminClaimRequired: boolean;
    };

    return {
      services: payload.services || INITIAL_SERVICES,
      settings: sanitizeSettings({
        ...DEFAULT_PUBLIC_SETTINGS,
        ...(payload.settings || {}),
      }),
      adminClaimRequired: hasEnvAdminPin()
        ? false
        : Boolean(payload.adminClaimRequired),
      persistenceMode: 'supabase',
    };
  } catch (err) {
    cachedMode = 'local-fallback';
    console.warn('[Digital Sheba] Supabase probe error; using local fallback.', err);
    return null;
  }
}

export async function getPersistenceMode(forceProbe = false): Promise<PersistenceMode> {
  if (!forceProbe && cachedMode === 'supabase') return 'supabase';
  const probed = await probeSupabaseBootstrap(forceProbe);
  return probed ? 'supabase' : 'local-fallback';
}

export async function bootstrapApp(options?: {
  userToken?: string;
  adminToken?: string;
  forceProbe?: boolean;
}): Promise<BootstrapResponse> {
  const sbResult = await probeSupabaseBootstrap(Boolean(options?.forceProbe));
  const base: BootstrapResponse = sbResult
    ? sbResult
    : await withLocalLock(async () => {
        const data = await readLocalData();
        return {
          services: data.services,
          settings: sanitizeSettings(data.settings),
          adminClaimRequired: hasEnvAdminPin() ? false : !data.adminPinHash,
          persistenceMode: 'local-fallback',
        };
      });

  const [userState, adminState] = await Promise.all([
    options?.userToken ? getUserState(options.userToken) : Promise.resolve(null),
    options?.adminToken ? getAdminState(options.adminToken) : Promise.resolve(null),
  ]);

  return {
    ...base,
    userState,
    isAdminUnlocked: Boolean(adminState),
    adminState,
  };
}

export async function registerUser(
  name: string,
  whatsapp: string,
  password: string
): Promise<AuthResponse> {
  const cleanName = name.trim();
  const normalized = normalizeWhatsappNumber(whatsapp);
  if (!cleanName || normalized.length < 11 || password.length < 6) {
    return { ok: false, code: 'INVALID_INPUT' };
  }

  const mode = await getPersistenceMode();
  if (mode === 'supabase') {
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('ds_register_user', {
      p_name: cleanName,
      p_mobile: normalized,
      p_password: password,
    });
    if (error || !data) {
      return { ok: false, code: 'SERVER_ERROR' };
    }
    return data as AuthResponse;
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    const exists = data.users.some(
      (u) => normalizeWhatsappNumber(u.mobile) === normalized
    );
    if (exists) {
      return { ok: false, code: 'MOBILE_EXISTS' };
    }
    const created: StoredLocalUser = {
      id: generateUserId(),
      name: cleanName,
      mobile: normalized,
      passwordHash: hashSecret(password),
      balance: 0,
      agreedToPolicy: true,
      createdAt: new Date().toISOString(),
    };
    data.users.unshift(created);
    await writeLocalData(data);
    const token = signLocalToken(created.id, 'user', 60 * 60 * 24 * 7);
    return { ok: true, token, user: sanitizeUser(created) };
  });
}

export async function loginUser(
  whatsapp: string,
  password: string
): Promise<AuthResponse> {
  const rawDigits = whatsapp.replace(/\D/g, '');
  const normalized = normalizeWhatsappNumber(whatsapp);

  const mode = await getPersistenceMode();
  if (mode === 'supabase') {
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('ds_login_user', {
      p_mobile: whatsapp,
      p_password: password,
    });
    if (error || !data) {
      return { ok: false, code: 'SERVER_ERROR' };
    }
    return data as AuthResponse;
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    const user = data.users.find((u) => {
      const uNorm = normalizeWhatsappNumber(u.mobile);
      const uDigits = u.mobile.replace(/\D/g, '');
      return uNorm === normalized || uDigits === rawDigits;
    });
    if (!user || !verifySecret(password, user.passwordHash)) {
      return { ok: false, code: 'INVALID_CREDENTIALS' };
    }
    const token = signLocalToken(user.id, 'user', 60 * 60 * 24 * 7);
    return { ok: true, token, user: sanitizeUser(user) };
  });
}

export async function logoutSession(token: string): Promise<void> {
  if (!token) return;
  if (!token.startsWith('loc.')) {
    const sb = getSupabase();
    if (sb) {
      await sb.rpc('ds_logout_session', { p_token: token });
    }
    return;
  }
  await withLocalLock(async () => {
    const data = await readLocalData();
    if (!data.revokedTokens.includes(token)) {
      data.revokedTokens.push(token);
      if (data.revokedTokens.length > 200) {
        data.revokedTokens = data.revokedTokens.slice(-200);
      }
      await writeLocalData(data);
    }
  });
}

async function verifyLocalSession(
  token: string,
  role: 'user' | 'admin',
  data: LocalStoreData
): Promise<string | null> {
  const payload = verifyLocalToken(token, role);
  if (!payload) return null;
  if (data.revokedTokens.includes(token)) return null;
  return payload.sub;
}

export async function getUserState(
  token: string
): Promise<UserStateResponse | null> {
  if (!token) return null;
  if (!token.startsWith('loc.')) {
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb.rpc('ds_get_user_state', {
      p_token: token,
    });
    if (error || !data) return null;
    return data as UserStateResponse;
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    const userId = await verifyLocalSession(token, 'user', data);
    if (!userId) return null;
    const user = data.users.find((u) => u.id === userId);
    if (!user) return null;
    return {
      user: sanitizeUser(user),
      orders: data.orders.filter((o) => o.userId === userId),
      recharges: data.recharges.filter((r) => r.userId === userId),
      transactions: data.transactions.filter((t) => t.userId === userId),
    };
  });
}

export async function submitRechargeRequest(
  token: string,
  payload: {
    method: RechargeMethod;
    amount: number;
    senderNumber: string;
    trxId: string;
  }
): Promise<{ ok: boolean; code?: string; id?: string }> {
  if (!token) return { ok: false, code: 'UNAUTHORIZED' };
  const amount = Math.round(Number(payload.amount));
  const senderNumber = (payload.senderNumber || '').trim();
  const cleanTrx = (payload.trxId || '').trim().toUpperCase();

  if (!Number.isFinite(amount) || amount < 10) {
    return { ok: false, code: 'MIN_AMOUNT' };
  }
  if (senderNumber.length < 6 || cleanTrx.length < 4) {
    return { ok: false, code: 'INVALID_INPUT' };
  }
  if (payload.method !== 'bKash' && payload.method !== 'Nagad') {
    return { ok: false, code: 'INVALID_INPUT' };
  }

  if (!token.startsWith('loc.')) {
    const sb = getSupabase();
    if (!sb) return { ok: false, code: 'UNAUTHORIZED' };
    const { data, error } = await sb.rpc('ds_submit_recharge', {
      p_token: token,
      p_method: payload.method,
      p_amount: amount,
      p_sender_number: senderNumber,
      p_trx_id: cleanTrx,
    });
    if (error) {
      if (error.message?.includes('UNAUTHORIZED')) {
        return { ok: false, code: 'UNAUTHORIZED' };
      }
      return { ok: false, code: 'SERVER_ERROR' };
    }
    return data as { ok: boolean; code?: string; id?: string };
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    const userId = await verifyLocalSession(token, 'user', data);
    if (!userId) return { ok: false, code: 'UNAUTHORIZED' };
    const user = data.users.find((u) => u.id === userId);
    if (!user) return { ok: false, code: 'UNAUTHORIZED' };

    const duplicate = data.recharges.some(
      (r) => r.trxId.trim().toUpperCase() === cleanTrx
    );
    if (duplicate) {
      return { ok: false, code: 'DUPLICATE_TRX' };
    }

    let reqId = generateUniqueId('RCH');
    while (data.recharges.some((r) => r.id === reqId)) {
      reqId = generateUniqueId('RCH');
    }

    const req: RechargeRequest = {
      id: reqId,
      userId: user.id,
      userName: user.name,
      userMobile: user.mobile,
      method: payload.method,
      amount,
      senderNumber,
      trxId: cleanTrx,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    };
    data.recharges.unshift(req);
    await writeLocalData(data);
    return { ok: true, id: reqId };
  });
}

export async function placeServiceOrder(
  token: string,
  payload: {
    serviceId: string;
    selectedOptionLabel?: string;
    entries: OrderFieldEntry[];
    attachments: OrderAttachment[];
  }
): Promise<{
  ok: boolean;
  code?: string;
  orderId?: string;
  totalPrice?: number;
  needed?: number;
  available?: number;
}> {
  if (!token) return { ok: false, code: 'UNAUTHORIZED' };

  if (!token.startsWith('loc.')) {
    const sb = getSupabase();
    if (!sb) return { ok: false, code: 'UNAUTHORIZED' };
    const { data, error } = await sb.rpc('ds_place_order', {
      p_token: token,
      p_service_id: payload.serviceId,
      p_selected_option_label: payload.selectedOptionLabel || null,
      p_entries: payload.entries || [],
      p_attachments: payload.attachments || [],
    });
    if (error) {
      if (error.message?.includes('UNAUTHORIZED')) {
        return { ok: false, code: 'UNAUTHORIZED' };
      }
      return { ok: false, code: 'SERVER_ERROR' };
    }
    return data as {
      ok: boolean;
      code?: string;
      orderId?: string;
      totalPrice?: number;
      needed?: number;
      available?: number;
    };
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    const userId = await verifyLocalSession(token, 'user', data);
    if (!userId) return { ok: false, code: 'UNAUTHORIZED' };
    const user = data.users.find((u) => u.id === userId);
    if (!user) return { ok: false, code: 'UNAUTHORIZED' };

    const computed = computeAuthoritativePrice(
      data.services,
      payload.serviceId,
      payload.selectedOptionLabel
    );
    if (!computed) {
      return { ok: false, code: 'SERVICE_NOT_FOUND' };
    }

    const { service, price } = computed;
    if (user.balance < price) {
      return {
        ok: false,
        code: 'INSUFFICIENT_BALANCE',
        needed: price,
        available: user.balance,
      };
    }

    let orderId = generateUniqueId('ORD');
    while (data.orders.some((o) => o.id === orderId)) {
      orderId = generateUniqueId('ORD');
    }
    let txnId = generateUniqueId('TXN');
    while (data.transactions.some((t) => t.id === txnId)) {
      txnId = generateUniqueId('TXN');
    }

    const now = new Date().toISOString();
    user.balance -= price;

    const newOrder: Order = {
      id: orderId,
      userId: user.id,
      userName: user.name,
      userMobile: user.mobile,
      serviceId: service.id,
      serviceTitle: service.title,
      selectedOptionLabel: payload.selectedOptionLabel,
      totalPrice: price,
      entries: Array.isArray(payload.entries) ? payload.entries : [],
      attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
      status: 'Pending',
      adminNote: '',
      createdAt: now,
      updatedAt: now,
    };

    const newTxn: WalletTransaction = {
      id: txnId,
      userId: user.id,
      userName: user.name,
      type: 'debit',
      amount: price,
      description: `অর্ডার পেমেন্ট: ${service.title} (${orderId})`,
      createdAt: now,
    };

    data.orders.unshift(newOrder);
    data.transactions.unshift(newTxn);
    await writeLocalData(data);

    return { ok: true, orderId, totalPrice: price };
  });
}

export async function claimAdminPin(
  pin: string
): Promise<{ ok: boolean; code?: string; token?: string }> {
  const cleanPin = pin.trim();
  if (cleanPin.length < 4) {
    return { ok: false, code: 'PIN_TOO_SHORT' };
  }
  if (hasEnvAdminPin()) {
    return { ok: false, code: 'ALREADY_CLAIMED' };
  }

  const mode = await getPersistenceMode();
  if (mode === 'supabase') {
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('ds_admin_claim_pin', {
      p_pin: cleanPin,
    });
    if (error || !data) return { ok: false, code: 'SERVER_ERROR' };
    return data as { ok: boolean; code?: string; token?: string };
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    if (data.adminPinHash) {
      return { ok: false, code: 'ALREADY_CLAIMED' };
    }
    data.adminPinHash = hashSecret(cleanPin);
    await writeLocalData(data);
    const token = signLocalToken('admin', 'admin', 60 * 60 * 12);
    return { ok: true, token };
  });
}

export async function verifyAdminPin(
  pin: string
): Promise<{ ok: boolean; code?: string; token?: string }> {
  const cleanPin = pin.trim();
  const envOverrideValid = verifyEnvAdminPin(cleanPin);
  if (hasEnvAdminPin() && !envOverrideValid) {
    return { ok: false, code: 'INVALID_PIN' };
  }

  const mode = await getPersistenceMode();
  if (mode === 'supabase') {
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('ds_admin_verify_pin', {
      p_pin: cleanPin,
      p_env_override_valid: envOverrideValid,
    });
    if (error || !data) return { ok: false, code: 'SERVER_ERROR' };
    return data as { ok: boolean; code?: string; token?: string };
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    if (!envOverrideValid) {
      if (!data.adminPinHash) {
        return { ok: false, code: 'CLAIM_REQUIRED' };
      }
      if (!verifySecret(cleanPin, data.adminPinHash)) {
        return { ok: false, code: 'INVALID_PIN' };
      }
    }
    const token = signLocalToken('admin', 'admin', 60 * 60 * 12);
    return { ok: true, token };
  });
}

export async function getAdminState(
  adminToken: string
): Promise<AdminStateResponse | null> {
  if (!adminToken) return null;
  if (!adminToken.startsWith('loc.')) {
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb.rpc('ds_admin_get_state', {
      p_admin_token: adminToken,
    });
    if (error || !data) return null;
    const parsed = data as AdminStateResponse;
    return {
      ...parsed,
      settings: sanitizeSettings({
        ...DEFAULT_PUBLIC_SETTINGS,
        ...(parsed.settings || {}),
      }),
      persistenceMode: 'supabase',
    };
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    const sub = await verifyLocalSession(adminToken, 'admin', data);
    if (!sub) return null;
    return {
      users: data.users.map(sanitizeUser),
      orders: data.orders,
      recharges: data.recharges,
      transactions: data.transactions,
      services: data.services,
      settings: sanitizeSettings(data.settings),
      persistenceMode: 'local-fallback',
    };
  });
}

export async function adminApproveRecharge(
  adminToken: string,
  rechargeId: string
): Promise<{ ok: boolean; code?: string; userName?: string; amount?: number }> {
  if (!adminToken) return { ok: false, code: 'UNAUTHORIZED' };
  if (!adminToken.startsWith('loc.')) {
    const sb = getSupabase();
    if (!sb) return { ok: false, code: 'UNAUTHORIZED' };
    const { data, error } = await sb.rpc('ds_admin_approve_recharge', {
      p_admin_token: adminToken,
      p_recharge_id: rechargeId,
    });
    if (error) {
      return error.message?.includes('UNAUTHORIZED')
        ? { ok: false, code: 'UNAUTHORIZED' }
        : { ok: false, code: 'SERVER_ERROR' };
    }
    return data as {
      ok: boolean;
      code?: string;
      userName?: string;
      amount?: number;
    };
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    if (!(await verifyLocalSession(adminToken, 'admin', data))) {
      return { ok: false, code: 'UNAUTHORIZED' };
    }
    const req = data.recharges.find((r) => r.id === rechargeId);
    if (!req) return { ok: false, code: 'NOT_FOUND' };
    if (req.status !== 'Pending') return { ok: false, code: 'ALREADY_PROCESSED' };

    const user = data.users.find((u) => u.id === req.userId);
    if (!user) return { ok: false, code: 'NOT_FOUND' };

    const now = new Date().toISOString();
    let txnId = generateUniqueId('TXN');
    while (data.transactions.some((t) => t.id === txnId)) {
      txnId = generateUniqueId('TXN');
    }

    user.balance += req.amount;
    req.status = 'Approved';
    req.adminNote = 'পেমেন্ট যাচাই সম্পন্ন ও ওয়ালেটে যুক্ত হয়েছে।';
    req.processedAt = now;

    data.transactions.unshift({
      id: txnId,
      userId: req.userId,
      userName: req.userName,
      type: 'credit',
      amount: req.amount,
      description: `${req.method === 'bKash' ? 'বিকাশ' : 'নগদ'} রিচার্জ অনুমোদিত (TrxID: ${req.trxId})`,
      createdAt: now,
    });

    await writeLocalData(data);
    return { ok: true, userName: req.userName, amount: req.amount };
  });
}

export async function adminRejectRecharge(
  adminToken: string,
  rechargeId: string,
  reason?: string
): Promise<{ ok: boolean; code?: string }> {
  if (!adminToken) return { ok: false, code: 'UNAUTHORIZED' };
  if (!adminToken.startsWith('loc.')) {
    const sb = getSupabase();
    if (!sb) return { ok: false, code: 'UNAUTHORIZED' };
    const { data, error } = await sb.rpc('ds_admin_reject_recharge', {
      p_admin_token: adminToken,
      p_recharge_id: rechargeId,
      p_reason: reason || null,
    });
    if (error) {
      return error.message?.includes('UNAUTHORIZED')
        ? { ok: false, code: 'UNAUTHORIZED' }
        : { ok: false, code: 'SERVER_ERROR' };
    }
    return data as { ok: boolean; code?: string };
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    if (!(await verifyLocalSession(adminToken, 'admin', data))) {
      return { ok: false, code: 'UNAUTHORIZED' };
    }
    const req = data.recharges.find((r) => r.id === rechargeId);
    if (!req) return { ok: false, code: 'NOT_FOUND' };
    if (req.status !== 'Pending') return { ok: false, code: 'ALREADY_PROCESSED' };

    req.status = 'Rejected';
    req.adminNote =
      reason?.trim() || 'ট্রানজেকশন আইডি মেলেনি বা পেমেন্ট পাওয়া যায়নি।';
    req.processedAt = new Date().toISOString();
    await writeLocalData(data);
    return { ok: true };
  });
}

export async function adminUpdateOrderStatus(
  adminToken: string,
  orderId: string,
  status: OrderStatus,
  adminNote?: string
): Promise<{ ok: boolean; code?: string; refunded?: boolean; amount?: number }> {
  if (!adminToken) return { ok: false, code: 'UNAUTHORIZED' };
  if (
    status !== 'Pending' &&
    status !== 'Processing' &&
    status !== 'Completed' &&
    status !== 'Cancelled'
  ) {
    return { ok: false, code: 'INVALID_STATUS' };
  }
  if (!adminToken.startsWith('loc.')) {
    const sb = getSupabase();
    if (!sb) return { ok: false, code: 'UNAUTHORIZED' };
    const { data, error } = await sb.rpc('ds_admin_update_order_status', {
      p_admin_token: adminToken,
      p_order_id: orderId,
      p_status: status,
      p_admin_note: adminNote ?? null,
    });
    if (error) {
      return error.message?.includes('UNAUTHORIZED')
        ? { ok: false, code: 'UNAUTHORIZED' }
        : { ok: false, code: 'SERVER_ERROR' };
    }
    return data as {
      ok: boolean;
      code?: string;
      refunded?: boolean;
      amount?: number;
    };
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    if (!(await verifyLocalSession(adminToken, 'admin', data))) {
      return { ok: false, code: 'UNAUTHORIZED' };
    }
    const order = data.orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, code: 'NOT_FOUND' };

    if (order.status === 'Cancelled' && status !== 'Cancelled') {
      return { ok: false, code: 'ALREADY_CANCELLED' };
    }

    const now = new Date().toISOString();
    const shouldRefund = status === 'Cancelled' && order.status !== 'Cancelled';
    if (shouldRefund) {
      const user = data.users.find((u) => u.id === order.userId);
      if (user) {
        user.balance += order.totalPrice;
      }
      let txnId = generateUniqueId('TXN');
      while (data.transactions.some((t) => t.id === txnId)) {
        txnId = generateUniqueId('TXN');
      }
      data.transactions.unshift({
        id: txnId,
        userId: order.userId,
        userName: order.userName,
        type: 'refund',
        amount: order.totalPrice,
        description: `অর্ডার বাতিল রিফান্ড: ${order.serviceTitle} (${order.id})`,
        createdAt: now,
      });
    }

    order.status = status;
    if (adminNote !== undefined) order.adminNote = adminNote;
    order.updatedAt = now;
    await writeLocalData(data);
    return { ok: true, refunded: shouldRefund, amount: order.totalPrice };
  });
}

export async function adminUpdateOrderNote(
  adminToken: string,
  orderId: string,
  adminNote: string
): Promise<{ ok: boolean; code?: string }> {
  if (!adminToken) return { ok: false, code: 'UNAUTHORIZED' };
  if (!adminToken.startsWith('loc.')) {
    const sb = getSupabase();
    if (!sb) return { ok: false, code: 'UNAUTHORIZED' };
    const { data, error } = await sb.rpc('ds_admin_update_order_note', {
      p_admin_token: adminToken,
      p_order_id: orderId,
      p_admin_note: adminNote,
    });
    if (error) {
      return error.message?.includes('UNAUTHORIZED')
        ? { ok: false, code: 'UNAUTHORIZED' }
        : { ok: false, code: 'SERVER_ERROR' };
    }
    return data as { ok: boolean; code?: string };
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    if (!(await verifyLocalSession(adminToken, 'admin', data))) {
      return { ok: false, code: 'UNAUTHORIZED' };
    }
    const order = data.orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, code: 'NOT_FOUND' };
    order.adminNote = adminNote;
    order.updatedAt = new Date().toISOString();
    await writeLocalData(data);
    return { ok: true };
  });
}

export async function adminUpsertService(
  adminToken: string,
  service: Partial<ServiceItem>
): Promise<{ ok: boolean; code?: string; id?: string }> {
  if (!adminToken) return { ok: false, code: 'UNAUTHORIZED' };
  if (!adminToken.startsWith('loc.')) {
    const sb = getSupabase();
    if (!sb) return { ok: false, code: 'UNAUTHORIZED' };
    const { data, error } = await sb.rpc('ds_admin_upsert_service', {
      p_admin_token: adminToken,
      p_service: service,
    });
    if (error) {
      return error.message?.includes('UNAUTHORIZED')
        ? { ok: false, code: 'UNAUTHORIZED' }
        : { ok: false, code: 'SERVER_ERROR' };
    }
    return data as { ok: boolean; code?: string; id?: string };
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    if (!(await verifyLocalSession(adminToken, 'admin', data))) {
      return { ok: false, code: 'UNAUTHORIZED' };
    }
    if (service.id) {
      const idx = data.services.findIndex((s) => s.id === service.id);
      if (idx >= 0) {
        data.services[idx] = { ...data.services[idx], ...service } as ServiceItem;
        await writeLocalData(data);
        return { ok: true, id: service.id };
      }
    }
    const maxOrder = data.services.reduce(
      (max, s) => Math.max(max, s.orderNumber),
      0
    );
    const id = generateUniqueId('srv-custom');
    const created: ServiceItem = {
      ...(service as Omit<ServiceItem, 'id' | 'orderNumber'>),
      id,
      orderNumber: maxOrder + 1,
    };
    data.services.push(created);
    await writeLocalData(data);
    return { ok: true, id };
  });
}

export async function adminDeleteService(
  adminToken: string,
  serviceId: string
): Promise<{ ok: boolean; code?: string }> {
  if (!adminToken) return { ok: false, code: 'UNAUTHORIZED' };
  if (!adminToken.startsWith('loc.')) {
    const sb = getSupabase();
    if (!sb) return { ok: false, code: 'UNAUTHORIZED' };
    const { data, error } = await sb.rpc('ds_admin_delete_service', {
      p_admin_token: adminToken,
      p_service_id: serviceId,
    });
    if (error) {
      return error.message?.includes('UNAUTHORIZED')
        ? { ok: false, code: 'UNAUTHORIZED' }
        : { ok: false, code: 'SERVER_ERROR' };
    }
    return data as { ok: boolean; code?: string };
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    if (!(await verifyLocalSession(adminToken, 'admin', data))) {
      return { ok: false, code: 'UNAUTHORIZED' };
    }
    data.services = data.services.filter((s) => s.id !== serviceId);
    await writeLocalData(data);
    return { ok: true };
  });
}

export async function adminToggleService(
  adminToken: string,
  serviceId: string
): Promise<{ ok: boolean; code?: string }> {
  if (!adminToken) return { ok: false, code: 'UNAUTHORIZED' };
  if (!adminToken.startsWith('loc.')) {
    const sb = getSupabase();
    if (!sb) return { ok: false, code: 'UNAUTHORIZED' };
    const { data, error } = await sb.rpc('ds_admin_toggle_service', {
      p_admin_token: adminToken,
      p_service_id: serviceId,
    });
    if (error) {
      return error.message?.includes('UNAUTHORIZED')
        ? { ok: false, code: 'UNAUTHORIZED' }
        : { ok: false, code: 'SERVER_ERROR' };
    }
    return data as { ok: boolean; code?: string };
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    if (!(await verifyLocalSession(adminToken, 'admin', data))) {
      return { ok: false, code: 'UNAUTHORIZED' };
    }
    data.services = data.services.map((s) =>
      s.id === serviceId ? { ...s, active: !s.active } : s
    );
    await writeLocalData(data);
    return { ok: true };
  });
}

export async function adminAdjustBalance(
  adminToken: string,
  userId: string,
  delta: number,
  note: string
): Promise<{ ok: boolean; code?: string; userName?: string; balance?: number }> {
  if (!adminToken) return { ok: false, code: 'UNAUTHORIZED' };
  const cleanDelta = Math.round(Number(delta));
  if (!Number.isFinite(cleanDelta) || cleanDelta === 0) {
    return { ok: false, code: 'INVALID_DELTA' };
  }

  if (!adminToken.startsWith('loc.')) {
    const sb = getSupabase();
    if (!sb) return { ok: false, code: 'UNAUTHORIZED' };
    const { data, error } = await sb.rpc('ds_admin_adjust_balance', {
      p_admin_token: adminToken,
      p_user_id: userId,
      p_delta: cleanDelta,
      p_note: note || '',
    });
    if (error) {
      return error.message?.includes('UNAUTHORIZED')
        ? { ok: false, code: 'UNAUTHORIZED' }
        : { ok: false, code: 'SERVER_ERROR' };
    }
    return data as {
      ok: boolean;
      code?: string;
      userName?: string;
      balance?: number;
    };
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    if (!(await verifyLocalSession(adminToken, 'admin', data))) {
      return { ok: false, code: 'UNAUTHORIZED' };
    }
    const user = data.users.find((u) => u.id === userId);
    if (!user) return { ok: false, code: 'NOT_FOUND' };
    const next = user.balance + cleanDelta;
    if (next < 0) return { ok: false, code: 'NEGATIVE_BALANCE' };

    user.balance = next;
    let txnId = generateUniqueId('TXN');
    while (data.transactions.some((t) => t.id === txnId)) {
      txnId = generateUniqueId('TXN');
    }
    data.transactions.unshift({
      id: txnId,
      userId: user.id,
      userName: user.name,
      type: 'admin_adjust',
      amount: Math.abs(cleanDelta),
      description:
        note.trim() ||
        (cleanDelta > 0
          ? `অ্যাডমিন কর্তৃক ব্যালেন্স যুক্ত (+${cleanDelta}৳)`
          : `অ্যাডমিন কর্তৃক ব্যালেন্স কর্তন (-${Math.abs(cleanDelta)}৳)`),
      createdAt: new Date().toISOString(),
    });
    await writeLocalData(data);
    return { ok: true, userName: user.name, balance: next };
  });
}

export async function adminDeleteUser(
  adminToken: string,
  userId: string
): Promise<{ ok: boolean; code?: string; userName?: string }> {
  if (!adminToken) return { ok: false, code: 'UNAUTHORIZED' };
  if (!adminToken.startsWith('loc.')) {
    const sb = getSupabase();
    if (!sb) return { ok: false, code: 'UNAUTHORIZED' };
    const { data, error } = await sb.rpc('ds_admin_delete_user', {
      p_admin_token: adminToken,
      p_user_id: userId,
    });
    if (error) {
      return error.message?.includes('UNAUTHORIZED')
        ? { ok: false, code: 'UNAUTHORIZED' }
        : { ok: false, code: 'SERVER_ERROR' };
    }
    return data as { ok: boolean; code?: string; userName?: string };
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    if (!(await verifyLocalSession(adminToken, 'admin', data))) {
      return { ok: false, code: 'UNAUTHORIZED' };
    }
    const target = data.users.find((u) => u.id === userId);
    if (!target) return { ok: false, code: 'NOT_FOUND' };
    data.users = data.users.filter((u) => u.id !== userId);
    await writeLocalData(data);
    return { ok: true, userName: target.name };
  });
}

export async function adminUpdateSettings(
  adminToken: string,
  settings: AppSettings
): Promise<{ ok: boolean; code?: string }> {
  if (!adminToken) return { ok: false, code: 'UNAUTHORIZED' };
  const newPin = (settings.adminPin || '').trim();
  if (newPin && newPin.length < 4) {
    return { ok: false, code: 'PIN_TOO_SHORT' };
  }
  const cleanSettings = sanitizeSettings(settings);

  if (!adminToken.startsWith('loc.')) {
    const sb = getSupabase();
    if (!sb) return { ok: false, code: 'UNAUTHORIZED' };
    const { data, error } = await sb.rpc('ds_admin_update_settings', {
      p_admin_token: adminToken,
      p_settings: cleanSettings,
      p_new_pin: newPin || null,
    });
    if (error) {
      return error.message?.includes('UNAUTHORIZED')
        ? { ok: false, code: 'UNAUTHORIZED' }
        : { ok: false, code: 'SERVER_ERROR' };
    }
    return data as { ok: boolean; code?: string };
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    if (!(await verifyLocalSession(adminToken, 'admin', data))) {
      return { ok: false, code: 'UNAUTHORIZED' };
    }
    data.settings = {
      ...data.settings,
      ...cleanSettings,
    };
    if (newPin) {
      data.adminPinHash = hashSecret(newPin);
    }
    await writeLocalData(data);
    return { ok: true };
  });
}

export async function adminResetCatalogAndSettings(
  adminToken: string
): Promise<{ ok: boolean; code?: string }> {
  if (!adminToken) return { ok: false, code: 'UNAUTHORIZED' };
  if (!adminToken.startsWith('loc.')) {
    const sb = getSupabase();
    if (!sb) return { ok: false, code: 'UNAUTHORIZED' };
    const authCheck = await getAdminState(adminToken);
    if (!authCheck) return { ok: false, code: 'UNAUTHORIZED' };
    for (const srv of INITIAL_SERVICES) {
      await sb.rpc('ds_admin_upsert_service', {
        p_admin_token: adminToken,
        p_service: srv,
      });
    }
    await sb.rpc('ds_admin_update_settings', {
      p_admin_token: adminToken,
      p_settings: DEFAULT_PUBLIC_SETTINGS,
      p_new_pin: null,
    });
    return { ok: true };
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    if (!(await verifyLocalSession(adminToken, 'admin', data))) {
      return { ok: false, code: 'UNAUTHORIZED' };
    }
    data.services = INITIAL_SERVICES;
    data.settings = { ...DEFAULT_PUBLIC_SETTINGS };
    await writeLocalData(data);
    return { ok: true };
  });
}
