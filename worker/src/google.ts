/** Verifies a Google ID token (RS256) with WebCrypto against Google's published keys. */
import { fromBase64 } from './auth';

export const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
export const JWKS_CACHE_MS = 60 * 60_000;
/** An unknown key id refetches the keys, but not more often than this. */
const REFETCH_MIN_MS = 60_000;

export interface Jwk {
  kty: string;
  kid?: string;
  n?: string;
  e?: string;
  alg?: string;
}
export type FetchJwks = () => Promise<{ keys: Jwk[] }>;

export interface GoogleIdentity {
  sub: string;
  email: string;
}

export const fetchGoogleJwks: FetchJwks = async () => {
  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) throw new Error('jwks');
  return (await res.json()) as { keys: Jwk[] };
};

/** One cache per key source, so the real fetch caches across requests and tests stay apart. */
const caches = new WeakMap<FetchJwks, { at: number; keys: Jwk[] }>();

async function keyFor(fetchJwks: FetchJwks, kid: string, now: number): Promise<Jwk | null> {
  let cache = caches.get(fetchJwks);
  const find = () => cache?.keys.find((k) => k.kid === kid) ?? null;
  const stale = !cache || now - cache.at >= JWKS_CACHE_MS || now < cache.at;
  const unknown = !stale && !find() && now - (cache?.at ?? 0) >= REFETCH_MIN_MS;
  if (stale || unknown) {
    cache = { at: now, keys: (await fetchJwks()).keys };
    caches.set(fetchJwks, cache);
  }
  return find();
}

function bytesOf(part: string): Uint8Array {
  const padded = part.replace(/-/g, '+').replace(/_/g, '/');
  return fromBase64(padded + '='.repeat((4 - (padded.length % 4)) % 4));
}

function decodeJson(part: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytesOf(part)));
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The Google account behind a valid ID token for this client id, or null for any problem. */
export async function verifyGoogleToken(
  credential: string,
  clientId: string,
  fetchJwks: FetchJwks,
  nowMs: number,
): Promise<GoogleIdentity | null> {
  try {
    const parts = credential.split('.');
    if (parts.length !== 3) return null;
    const header = decodeJson(parts[0]);
    const claims = decodeJson(parts[1]);
    if (!header || !claims || header.alg !== 'RS256' || typeof header.kid !== 'string') return null;

    const jwk = await keyFor(fetchJwks, header.kid, nowMs);
    if (!jwk || jwk.kty !== 'RSA') return null;
    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      bytesOf(parts[2]) as BufferSource,
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!ok) return null;

    const issuerOk =
      claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com';
    const verified = claims.email_verified === true || claims.email_verified === 'true';
    if (
      !issuerOk ||
      claims.aud !== clientId ||
      typeof claims.exp !== 'number' ||
      claims.exp * 1000 <= nowMs ||
      !verified ||
      typeof claims.sub !== 'string' ||
      !claims.sub ||
      typeof claims.email !== 'string'
    ) {
      return null;
    }
    return { sub: claims.sub, email: claims.email };
  } catch {
    return null;
  }
}
