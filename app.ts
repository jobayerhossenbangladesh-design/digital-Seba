import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import { checkRateLimit } from './security.ts';
import {
  adminAdjustBalance,
  adminApproveRecharge,
  adminDeleteService,
  adminDeleteUser,
  adminRejectRecharge,
  adminResetCatalogAndSettings,
  adminToggleService,
  adminUpdateOrderNote,
  adminUpdateOrderStatus,
  adminUpdateSettings,
  adminUpsertService,
  bootstrapApp,
  claimAdminPin,
  getAdminState,
  getPersistenceMode,
  getUserState,
  loginUser,
  logoutSession,
  placeServiceOrder,
  registerUser,
  submitRechargeRequest,
  verifyAdminPin,
} from './store.ts';
import type {
  AppSettings,
  OrderAttachment,
  OrderFieldEntry,
  OrderStatus,
  RechargeMethod,
  ServiceItem,
} from '../src/types/index.ts';

const USER_SESSION_COOKIE = 'ds_user_session';
const ADMIN_SESSION_COOKIE = 'ds_admin_session';
const USER_SESSION_TTL_SEC = 60 * 60 * 24 * 7; // 7 days
const ADMIN_SESSION_TTL_SEC = 60 * 60 * 12; // 12 hours

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie || '';
  if (!header) return {};
  const result: Record<string, string> = {};
  for (const part of header.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

function isHttpsRequest(req: Request): boolean {
  const xfProto = req.headers['x-forwarded-proto'];
  if (typeof xfProto === 'string') {
    return xfProto.split(',')[0].trim().toLowerCase() === 'https';
  }
  return Boolean(req.secure);
}

function setSessionCookie(
  req: Request,
  res: Response,
  name: string,
  token: string,
  maxAgeSeconds: number
): void {
  const https = isHttpsRequest(req);
  const parts = [
    `${name}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAgeSeconds}`,
    https ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (https) {
    parts.push('Secure');
  }
  res.append('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(req: Request, res: Response, name: string): void {
  const https = isHttpsRequest(req);
  const parts = [
    `${name}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    https ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (https) {
    parts.push('Secure');
  }
  res.append('Set-Cookie', parts.join('; '));
}

function getBearerToken(req: Request): string {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  return '';
}

function getUserToken(req: Request): string {
  return getBearerToken(req) || parseCookies(req)[USER_SESSION_COOKIE] || '';
}

function getAdminToken(req: Request): string {
  return getBearerToken(req) || parseCookies(req)[ADMIN_SESSION_COOKIE] || '';
}

function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function createApiApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10mb' }));

  app.get(
    '/api/health',
    asyncHandler(async (_req: Request, res: Response) => {
      const persistenceMode = await getPersistenceMode();
      res.json({ ok: true, persistenceMode });
    })
  );

  app.get(
    '/api/bootstrap',
    asyncHandler(async (req: Request, res: Response) => {
      const forceProbe = req.query.probe === '1';
      const cookies = parseCookies(req);
      const userToken = getBearerToken(req) || cookies[USER_SESSION_COOKIE] || '';
      const adminToken = cookies[ADMIN_SESSION_COOKIE] || '';
      const data = await bootstrapApp({
        userToken: userToken || undefined,
        adminToken: adminToken || undefined,
        forceProbe,
      });
      res.json(data);
    })
  );

  app.post(
    '/api/auth/register',
    asyncHandler(async (req: Request, res: Response) => {
      const ip = getClientIp(req);
      if (!checkRateLimit(`reg:${ip}`, 15, 60_000)) {
        res.status(429).json({ ok: false, code: 'RATE_LIMITED' });
        return;
      }

      const { name, whatsapp, password, agreedToPolicy } = (req.body || {}) as {
        name?: string;
        whatsapp?: string;
        password?: string;
        agreedToPolicy?: boolean;
      };

      if (!agreedToPolicy) {
        res.status(400).json({ ok: false, code: 'POLICY_REQUIRED' });
        return;
      }
      if (!name?.trim() || !whatsapp?.trim() || !password) {
        res.status(400).json({ ok: false, code: 'INVALID_INPUT' });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ ok: false, code: 'WEAK_PASSWORD' });
        return;
      }

      const result = await registerUser(name, whatsapp, password);
      if (!result.ok) {
        res.status(result.code === 'MOBILE_EXISTS' ? 409 : 400).json(result);
        return;
      }
      if (result.token) {
        setSessionCookie(
          req,
          res,
          USER_SESSION_COOKIE,
          result.token,
          USER_SESSION_TTL_SEC
        );
      }
      res.json(result);
    })
  );

  app.post(
    '/api/auth/login',
    asyncHandler(async (req: Request, res: Response) => {
      const ip = getClientIp(req);
      if (!checkRateLimit(`login:${ip}`, 20, 60_000)) {
        res.status(429).json({ ok: false, code: 'RATE_LIMITED' });
        return;
      }

      const { whatsapp, password } = (req.body || {}) as {
        whatsapp?: string;
        password?: string;
      };
      if (!whatsapp?.trim() || !password) {
        res.status(400).json({ ok: false, code: 'INVALID_CREDENTIALS' });
        return;
      }

      const result = await loginUser(whatsapp, password);
      if (!result.ok) {
        res.status(401).json(result);
        return;
      }
      if (result.token) {
        setSessionCookie(
          req,
          res,
          USER_SESSION_COOKIE,
          result.token,
          USER_SESSION_TTL_SEC
        );
      }
      res.json(result);
    })
  );

  app.post(
    '/api/auth/logout',
    asyncHandler(async (req: Request, res: Response) => {
      const bearer = getBearerToken(req);
      const cookieTok = parseCookies(req)[USER_SESSION_COOKIE] || '';
      if (bearer) await logoutSession(bearer);
      if (cookieTok && cookieTok !== bearer) await logoutSession(cookieTok);
      clearSessionCookie(req, res, USER_SESSION_COOKIE);
      res.json({ ok: true });
    })
  );

  app.get(
    '/api/me',
    asyncHandler(async (req: Request, res: Response) => {
      const token = getUserToken(req);
      if (!token) {
        res.status(401).json({ ok: false, code: 'UNAUTHORIZED' });
        return;
      }
      const state = await getUserState(token);
      if (!state) {
        clearSessionCookie(req, res, USER_SESSION_COOKIE);
        res.status(401).json({ ok: false, code: 'UNAUTHORIZED' });
        return;
      }
      res.json({ ok: true, ...state });
    })
  );

  app.post(
    '/api/recharges',
    asyncHandler(async (req: Request, res: Response) => {
      const token = getUserToken(req);
      if (!token) {
        res.status(401).json({ ok: false, code: 'UNAUTHORIZED' });
        return;
      }
      const body = (req.body || {}) as {
        method?: RechargeMethod;
        amount?: number;
        senderNumber?: string;
        trxId?: string;
      };
      const result = await submitRechargeRequest(token, {
        method: body.method || 'bKash',
        amount: Number(body.amount),
        senderNumber: body.senderNumber || '',
        trxId: body.trxId || '',
      });
      if (!result.ok) {
        const status =
          result.code === 'UNAUTHORIZED'
            ? 401
            : result.code === 'DUPLICATE_TRX'
            ? 409
            : 400;
        res.status(status).json(result);
        return;
      }
      res.json(result);
    })
  );

  app.post(
    '/api/orders',
    asyncHandler(async (req: Request, res: Response) => {
      const token = getUserToken(req);
      if (!token) {
        res.status(401).json({ ok: false, code: 'UNAUTHORIZED' });
        return;
      }
      const body = (req.body || {}) as {
        serviceId?: string;
        selectedOptionLabel?: string;
        entries?: OrderFieldEntry[];
        attachments?: OrderAttachment[];
      };
      if (!body.serviceId) {
        res.status(400).json({ ok: false, code: 'SERVICE_NOT_FOUND' });
        return;
      }
      const result = await placeServiceOrder(token, {
        serviceId: body.serviceId,
        selectedOptionLabel: body.selectedOptionLabel,
        entries: Array.isArray(body.entries) ? body.entries : [],
        attachments: Array.isArray(body.attachments) ? body.attachments : [],
      });
      if (!result.ok) {
        const status = result.code === 'UNAUTHORIZED' ? 401 : 400;
        res.status(status).json(result);
        return;
      }
      res.json(result);
    })
  );

  app.get(
    '/api/admin/status',
    asyncHandler(async (_req: Request, res: Response) => {
      const boot = await bootstrapApp();
      res.json({
        adminClaimRequired: boot.adminClaimRequired,
        persistenceMode: boot.persistenceMode,
      });
    })
  );

  app.post(
    '/api/admin/claim',
    asyncHandler(async (req: Request, res: Response) => {
      const ip = getClientIp(req);
      if (!checkRateLimit(`admin-claim:${ip}`, 10, 60_000)) {
        res.status(429).json({ ok: false, code: 'RATE_LIMITED' });
        return;
      }
      const { pin } = (req.body || {}) as { pin?: string };
      const result = await claimAdminPin(pin || '');
      if (!result.ok) {
        res.status(result.code === 'ALREADY_CLAIMED' ? 409 : 400).json(result);
        return;
      }
      if (result.token) {
        setSessionCookie(
          req,
          res,
          ADMIN_SESSION_COOKIE,
          result.token,
          ADMIN_SESSION_TTL_SEC
        );
      }
      res.json(result);
    })
  );

  app.post(
    '/api/admin/unlock',
    asyncHandler(async (req: Request, res: Response) => {
      const ip = getClientIp(req);
      if (!checkRateLimit(`admin-unlock:${ip}`, 10, 60_000)) {
        res.status(429).json({ ok: false, code: 'RATE_LIMITED' });
        return;
      }
      const { pin } = (req.body || {}) as { pin?: string };
      const result = await verifyAdminPin(pin || '');
      if (!result.ok) {
        res.status(401).json(result);
        return;
      }
      if (result.token) {
        setSessionCookie(
          req,
          res,
          ADMIN_SESSION_COOKIE,
          result.token,
          ADMIN_SESSION_TTL_SEC
        );
      }
      res.json(result);
    })
  );

  app.post(
    '/api/admin/logout',
    asyncHandler(async (req: Request, res: Response) => {
      const bearer = getBearerToken(req);
      const cookieTok = parseCookies(req)[ADMIN_SESSION_COOKIE] || '';
      if (bearer) await logoutSession(bearer);
      if (cookieTok && cookieTok !== bearer) await logoutSession(cookieTok);
      clearSessionCookie(req, res, ADMIN_SESSION_COOKIE);
      res.json({ ok: true });
    })
  );

  app.get(
    '/api/admin/state',
    asyncHandler(async (req: Request, res: Response) => {
      const token = getAdminToken(req);
      if (!token) {
        res.status(401).json({ ok: false, code: 'UNAUTHORIZED' });
        return;
      }
      const state = await getAdminState(token);
      if (!state) {
        clearSessionCookie(req, res, ADMIN_SESSION_COOKIE);
        res.status(401).json({ ok: false, code: 'UNAUTHORIZED' });
        return;
      }
      res.json({ ok: true, ...state });
    })
  );

  app.post(
    '/api/admin/recharges/:id/approve',
    asyncHandler(async (req: Request, res: Response) => {
      const token = getAdminToken(req);
      const id = String(req.params.id || '');
      const result = await adminApproveRecharge(token, id);
      if (!result.ok) {
        res.status(result.code === 'UNAUTHORIZED' ? 401 : 400).json(result);
        return;
      }
      res.json(result);
    })
  );

  app.post(
    '/api/admin/recharges/:id/reject',
    asyncHandler(async (req: Request, res: Response) => {
      const token = getAdminToken(req);
      const id = String(req.params.id || '');
      const { reason } = (req.body || {}) as { reason?: string };
      const result = await adminRejectRecharge(token, id, reason);
      if (!result.ok) {
        res.status(result.code === 'UNAUTHORIZED' ? 401 : 400).json(result);
        return;
      }
      res.json(result);
    })
  );

  app.patch(
    '/api/admin/orders/:id/status',
    asyncHandler(async (req: Request, res: Response) => {
      const token = getAdminToken(req);
      const id = String(req.params.id || '');
      const { status, adminNote } = (req.body || {}) as {
        status?: OrderStatus;
        adminNote?: string;
      };
      if (
        !status ||
        (status !== 'Pending' &&
          status !== 'Processing' &&
          status !== 'Completed' &&
          status !== 'Cancelled')
      ) {
        res.status(400).json({ ok: false, code: 'INVALID_STATUS' });
        return;
      }
      const result = await adminUpdateOrderStatus(
        token,
        id,
        status,
        adminNote
      );
      if (!result.ok) {
        res.status(result.code === 'UNAUTHORIZED' ? 401 : 400).json(result);
        return;
      }
      res.json(result);
    })
  );

  app.patch(
    '/api/admin/orders/:id/note',
    asyncHandler(async (req: Request, res: Response) => {
      const token = getAdminToken(req);
      const id = String(req.params.id || '');
      const { adminNote } = (req.body || {}) as { adminNote?: string };
      const result = await adminUpdateOrderNote(token, id, adminNote || '');
      if (!result.ok) {
        res.status(result.code === 'UNAUTHORIZED' ? 401 : 400).json(result);
        return;
      }
      res.json(result);
    })
  );

  app.post(
    '/api/admin/services',
    asyncHandler(async (req: Request, res: Response) => {
      const token = getAdminToken(req);
      const payload = (req.body || {}) as Omit<ServiceItem, 'id' | 'orderNumber'>;
      const result = await adminUpsertService(token, payload);
      if (!result.ok) {
        res.status(result.code === 'UNAUTHORIZED' ? 401 : 400).json(result);
        return;
      }
      res.json(result);
    })
  );

  app.put(
    '/api/admin/services/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const token = getAdminToken(req);
      const id = String(req.params.id || '');
      const payload = { ...((req.body || {}) as ServiceItem), id };
      const result = await adminUpsertService(token, payload);
      if (!result.ok) {
        res.status(result.code === 'UNAUTHORIZED' ? 401 : 400).json(result);
        return;
      }
      res.json(result);
    })
  );

  app.delete(
    '/api/admin/services/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const token = getAdminToken(req);
      const id = String(req.params.id || '');
      const result = await adminDeleteService(token, id);
      if (!result.ok) {
        res.status(result.code === 'UNAUTHORIZED' ? 401 : 400).json(result);
        return;
      }
      res.json(result);
    })
  );

  app.post(
    '/api/admin/services/:id/toggle',
    asyncHandler(async (req: Request, res: Response) => {
      const token = getAdminToken(req);
      const id = String(req.params.id || '');
      const result = await adminToggleService(token, id);
      if (!result.ok) {
        res.status(result.code === 'UNAUTHORIZED' ? 401 : 400).json(result);
        return;
      }
      res.json(result);
    })
  );

  app.post(
    '/api/admin/users/:id/balance',
    asyncHandler(async (req: Request, res: Response) => {
      const token = getAdminToken(req);
      const id = String(req.params.id || '');
      const { delta, note } = (req.body || {}) as {
        delta?: number;
        note?: string;
      };
      const result = await adminAdjustBalance(
        token,
        id,
        Number(delta),
        note || ''
      );
      if (!result.ok) {
        res.status(result.code === 'UNAUTHORIZED' ? 401 : 400).json(result);
        return;
      }
      res.json(result);
    })
  );

  app.delete(
    '/api/admin/users/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const token = getAdminToken(req);
      const id = String(req.params.id || '');
      const result = await adminDeleteUser(token, id);
      if (!result.ok) {
        res.status(result.code === 'UNAUTHORIZED' ? 401 : 400).json(result);
        return;
      }
      res.json(result);
    })
  );

  app.put(
    '/api/admin/settings',
    asyncHandler(async (req: Request, res: Response) => {
      const token = getAdminToken(req);
      const settings = (req.body || {}) as AppSettings;
      if (!settings?.rechargeNumber?.trim() || !settings?.adminWhatsapp?.trim()) {
        res.status(400).json({ ok: false, code: 'INVALID_INPUT' });
        return;
      }
      const result = await adminUpdateSettings(token, settings);
      if (!result.ok) {
        res.status(result.code === 'UNAUTHORIZED' ? 401 : 400).json(result);
        return;
      }
      res.json(result);
    })
  );

  app.post(
    '/api/admin/reset',
    asyncHandler(async (req: Request, res: Response) => {
      const token = getAdminToken(req);
      const result = await adminResetCatalogAndSettings(token);
      if (!result.ok) {
        res.status(result.code === 'UNAUTHORIZED' ? 401 : 400).json(result);
        return;
      }
      res.json(result);
    })
  );

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Digital Sheba API Error]', err);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, code: 'SERVER_ERROR' });
    }
  });

  return app;
}
