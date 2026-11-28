import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

const EPHEMERAL_SECRET = randomBytes(32).toString('hex');

function getSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET?.trim();
  return envSecret && envSecret.length >= 16 ? envSecret : EPHEMERAL_SECRET;
}

export function hashSecret(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(plain, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifySecret(plain: string, stored: string): boolean {
  if (!plain || !stored || !stored.startsWith('scrypt:')) {
    return false;
  }
  const parts = stored.split(':');
  if (parts.length !== 3) return false;
  const [, salt, hexHash] = parts;
  if (!salt || !hexHash) return false;
  try {
    const derived = scryptSync(plain, salt, 64);
    const expected = Buffer.from(hexHash, 'hex');
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function constantTimeEquals(a: string, b: string): boolean {
  const digestA = createHash('sha256').update(a).digest();
  const digestB = createHash('sha256').update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

export function generateUniqueId(prefix: string): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const rand = randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${y}${m}${d}-${rand}`;
}

export function generateUserId(): string {
  return `usr-${randomUUID()}`;
}

export interface SignedTokenPayload {
  sub: string;
  role: 'user' | 'admin';
  exp: number;
  jti: string;
}

export function signLocalToken(
  sub: string,
  role: 'user' | 'admin',
  ttlSeconds: number
): string {
  const payload: SignedTokenPayload = {
    sub,
    role,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    jti: randomBytes(16).toString('hex'),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `loc.${encoded}.${sig}`;
}

export function verifyLocalToken(
  token: string,
  expectedRole: 'user' | 'admin'
): SignedTokenPayload | null {
  if (!token || !token.startsWith('loc.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');

  if (!constantTimeEquals(sig, expectedSig)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SignedTokenPayload;
    if (parsed.role !== expectedRole) return null;
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    if (!parsed.sub) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function normalizeWhatsappNumber(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.startsWith('01') && digits.length === 11) {
    return `88${digits}`;
  }
  return digits;
}

interface RateBucket {
  timestamps: number[];
}

const rateBuckets = new Map<string, RateBucket>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key) || { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < windowMs);
  if (bucket.timestamps.length >= maxRequests) {
    rateBuckets.set(key, bucket);
    return false;
  }
  bucket.timestamps.push(now);
  rateBuckets.set(key, bucket);
  return true;
}
