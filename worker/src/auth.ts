/** Passwords, tokens and input checks. WebCrypto only, so it runs on Workers and in Node. */

/** The most PBKDF2 iterations the Workers runtime allows. */
export const PBKDF2_ITERATIONS = 100_000;
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 128;
export const SESSION_DAYS = 90;
export const MAX_PLAYERS = 20;
export const MAX_PROGRESS_BYTES = 400_000;
export const MAX_BODY_BYTES = 4_000_000;
/** Failed sign-ins per email, and per IP, in one window. */
export const ATTEMPT_LIMIT = 10;
export const IP_LIMIT = 30;
export const ATTEMPT_WINDOW_MS = 15 * 60_000;
export const MAX_EMAIL_LENGTH = 254;

const encoder = new TextEncoder();

export function toBase64(bytes: Uint8Array): string {
  let text = '';
  for (const b of bytes) text += String.fromCharCode(b);
  return btoa(text);
}

export function fromBase64(text: string): Uint8Array {
  const raw = atob(text);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function derive(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/** A fresh random salt and the PBKDF2-SHA-256 hash of the password, both base64. */
export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { hash: toBase64(await derive(password, salt)), salt: toBase64(salt) };
}

/** Checks a password against a stored hash and salt, comparing in constant time. */
export async function verifyPassword(
  password: string,
  hash: string,
  salt: string,
): Promise<boolean> {
  const actual = await derive(password, fromBase64(salt));
  const expected = fromBase64(hash);
  if (expected.length !== actual.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

/** A new session token: 32 random bytes, base64url. Only its hash is stored. */
export function newToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Trimmed and lowercased; the form emails are stored and compared in. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** One `@` with text either side, a dot in the domain, at most 254 characters. */
export function validEmail(email: string): boolean {
  const e = normalizeEmail(email);
  if (e.length === 0 || e.length > MAX_EMAIL_LENGTH) return false;
  const parts = e.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  const domain = parts[1];
  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.') && !/\s/.test(e);
}

export function validPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD && password.length <= MAX_PASSWORD;
}
