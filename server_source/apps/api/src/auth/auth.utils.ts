import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { AUTH_COOKIE_NAME } from './auth.constants';
import { SessionTokenPayload } from './auth.types';

const SCRYPT_PREFIX = 'scrypt';

function encodeBase64Url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    throw new Error('JWT_SECRET is required');
  }

  return secret;
}

export function getSessionTtlSeconds(): number {
  const hours = Number(process.env.JWT_EXPIRES_IN_HOURS || 12);

  if (!Number.isFinite(hours) || hours <= 0) {
    return 12 * 60 * 60;
  }

  return Math.round(hours * 60 * 60);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64).toString('hex');

  return `${SCRYPT_PREFIX}$${salt}$${derivedKey}`;
}

export function verifyPassword(
  password: string,
  storedPasswordHash: string,
): boolean {
  const [scheme, salt, expectedHex] = storedPasswordHash.split('$');

  if (scheme !== SCRYPT_PREFIX || !salt || !expectedHex) {
    return false;
  }

  const derivedKey = scryptSync(password, salt, 64);
  const expectedKey = Buffer.from(expectedHex, 'hex');

  if (expectedKey.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(expectedKey, derivedKey);
}

export function signSessionToken(payload: {
  sub: string;
  email: string;
  roles: string[];
}) {
  const ttlSeconds = getSessionTtlSeconds();
  const issuedAt = Math.floor(Date.now() / 1000);
  const tokenPayload: SessionTokenPayload = {
    sub: payload.sub,
    email: payload.email,
    roles: payload.roles,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
  };

  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = encodeBase64Url(JSON.stringify(tokenPayload));
  const unsignedToken = `${header}.${body}`;
  const signature = createHmac('sha256', getJwtSecret())
    .update(unsignedToken)
    .digest('base64url');

  return {
    token: `${unsignedToken}.${signature}`,
    expiresAt: new Date(tokenPayload.exp * 1000).toISOString(),
    ttlSeconds,
  };
}

export function verifySessionToken(token: string): SessionTokenPayload {
  const [header, body, signature] = token.split('.');

  if (!header || !body || !signature) {
    throw new Error('Malformed token');
  }

  const unsignedToken = `${header}.${body}`;
  const expectedSignature = createHmac('sha256', getJwtSecret())
    .update(unsignedToken)
    .digest('base64url');

  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== receivedBuffer.length) {
    throw new Error('Invalid signature');
  }

  if (!timingSafeEqual(expectedBuffer, receivedBuffer)) {
    throw new Error('Invalid signature');
  }

  const payload = JSON.parse(decodeBase64Url(body)) as SessionTokenPayload;

  if (!payload.sub || !payload.email || !Array.isArray(payload.roles)) {
    throw new Error('Invalid payload');
  }

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
}

export function extractTokenFromHeaders(headers: {
  authorization?: string;
  cookie?: string;
}): string | null {
  const authorization = headers.authorization?.trim();

  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  const cookieHeader = headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const match = cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${AUTH_COOKIE_NAME}=`));

  if (!match) {
    return null;
  }

  return decodeURIComponent(match.slice(`${AUTH_COOKIE_NAME}=`.length));
}

export function createSessionCookie(token: string, ttlSeconds: number): string {
  const secure = process.env.AUTH_COOKIE_SECURE === 'true' ? '; Secure' : '';

  return [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${ttlSeconds}`,
  ].join('; ') + secure;
}

export function clearSessionCookie(): string {
  const secure = process.env.AUTH_COOKIE_SECURE === 'true' ? '; Secure' : '';

  return [
    `${AUTH_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ].join('; ') + secure;
}
