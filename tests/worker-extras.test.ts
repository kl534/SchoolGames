import { describe, expect, it } from 'vitest';
import { FORGOT_LIMIT, RESEND_LIMIT, handle, type Env } from '../worker/src/app';
import { ATTEMPT_LIMIT } from '../worker/src/auth';
import { JWKS_CACHE_MS, verifyGoogleToken, type FetchJwks, type Jwk } from '../worker/src/google';
import { RESET_SUBJECT, VERIFY_SUBJECT, emailEnabled, sendMail } from '../worker/src/mail';
import { AVATARS, emptyProgress } from '../src/shared/progress';
import { createTestWorker, mailEnv, ORIGIN, testEnv, type TestWorker } from './helpers/worker-app';

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function signup(w: TestWorker, email = 'mom@example.com', password = 'longenough') {
  const res = await w.call('POST', '/auth/signup', { email, password });
  return { ...res, token: res.body?.token as string };
}
const login = (w: TestWorker, password: string, email = 'mom@example.com') =>
  w.call('POST', '/auth/login', { email, password });
/** The token in the last mailed link. */
const lastToken = (w: TestWorker, param: 'verify' | 'reset') => {
  const text = w.mails[w.mails.length - 1]?.text ?? '';
  return new RegExp(`\\?${param}=([^\\s]+)`).exec(text)?.[1] ?? '';
};
const firstAccount = (w: TestWorker) => [...w.memory.accounts.values()][0];

describe('config and mail switch', () => {
  it('is off without both secrets and on with them', async () => {
    expect(emailEnabled(testEnv())).toBe(false);
    expect(emailEnabled({ ...testEnv(), RESEND_API_KEY: 'k' })).toBe(false);
    expect(emailEnabled(mailEnv())).toBe(true);
    expect((await createTestWorker().call('GET', '/config')).body).toEqual({
      emailEnabled: false,
      googleClientId: null,
    });
    const on = createTestWorker({ env: { ...mailEnv(), GOOGLE_CLIENT_ID: 'cid.apps' } });
    expect((await on.call('GET', '/config')).body).toEqual({
      emailEnabled: true,
      googleClientId: 'cid.apps',
    });
  });

  it('posts to Resend with the key and sender', async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const fake = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    await sendMail(mailEnv(), 'a@b.co', 'Hi', 'Body', fake);
    expect(seen!.url).toBe('https://api.resend.com/emails');
    expect((seen!.init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    expect(JSON.parse(seen!.init.body as string)).toEqual({
      from: 'School Games <hello@example.com>',
      to: ['a@b.co'],
      subject: 'Hi',
      text: 'Body',
    });
    const refuse = (async () => new Response('no', { status: 500 })) as unknown as typeof fetch;
    await expect(sendMail(mailEnv(), 'a@b.co', 'Hi', 'Body', refuse)).rejects.toThrow();
  });
});

describe('email verification', () => {
  it('sends no mail when mail is off', async () => {
    const w = createTestWorker();
    const { token } = await signup(w);
    expect(w.mails).toEqual([]);
    expect((await w.call('POST', '/auth/resend', undefined, bearer(token))).status).toBe(400);
  });

  it('mails a link at sign-up and a single-use token confirms the email', async () => {
    const w = createTestWorker({ env: mailEnv() });
    const { token } = await signup(w);
    expect(w.mails).toHaveLength(1);
    expect(w.mails[0].to).toBe('mom@example.com');
    expect(w.mails[0].subject).toBe(VERIFY_SUBJECT);
    expect(w.mails[0].text).toContain(`${ORIGIN}/schoolgames/?verify=`);
    expect((await w.call('GET', '/account', undefined, bearer(token))).body).toEqual({
      email: 'mom@example.com',
      emailVerified: false,
      hasPassword: true,
    });

    const link = lastToken(w, 'verify');
    expect((await w.call('POST', '/auth/verify', { token: link })).status).toBe(204);
    expect((await w.call('GET', '/account', undefined, bearer(token))).body.emailVerified).toBe(
      true,
    );
    const again = await w.call('POST', '/auth/verify', { token: link });
    expect(again.status).toBe(400);
    expect(again.body).toEqual({ error: 'invalid' });
  });

  it('rejects an unknown, empty or expired token (valid for 3 days)', async () => {
    const w = createTestWorker({ env: mailEnv() });
    await signup(w);
    expect((await w.call('POST', '/auth/verify', { token: 'nope' })).status).toBe(400);
    expect((await w.call('POST', '/auth/verify', {})).status).toBe(400);
    w.clock.now += 3 * DAY + 1;
    const late = await w.call('POST', '/auth/verify', { token: lastToken(w, 'verify') });
    expect(late.status).toBe(400);
  });

  it('does not accept a reset token as a verify token', async () => {
    const w = createTestWorker({ env: mailEnv() });
    await signup(w);
    await w.call('POST', '/auth/forgot', { email: 'mom@example.com' });
    const res = await w.call('POST', '/auth/verify', { token: lastToken(w, 'reset') });
    expect(res.status).toBe(400);
  });

  it('lets an unverified account sync', async () => {
    const w = createTestWorker({ env: mailEnv() });
    const { token } = await signup(w);
    const res = await w.call(
      'POST',
      '/sync',
      {
        since: 0,
        players: [{ id: 'ana01', name: 'Ana', avatar: AVATARS[0] }],
        progress: { ana01: emptyProgress() },
      },
      bearer(token),
    );
    expect(res.status).toBe(200);
  });

  it('resends at most 3 times an hour, and not once verified', async () => {
    const w = createTestWorker({ env: mailEnv() });
    const { token } = await signup(w);
    const resend = () => w.call('POST', '/auth/resend', undefined, bearer(token));
    for (let i = 0; i < RESEND_LIMIT; i++) expect((await resend()).status).toBe(204);
    expect(w.mails).toHaveLength(1 + RESEND_LIMIT);
    const blocked = await resend();
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: 'rate_limited' });
    expect(w.mails).toHaveLength(1 + RESEND_LIMIT);
    w.clock.now += HOUR;
    expect((await resend()).status).toBe(204);

    expect((await w.call('POST', '/auth/verify', { token: lastToken(w, 'verify') })).status).toBe(
      204,
    );
    const before = w.mails.length;
    expect((await resend()).status).toBe(204);
    expect(w.mails).toHaveLength(before);
  });

  it('needs a session to resend', async () => {
    const w = createTestWorker({ env: mailEnv() });
    expect((await w.call('POST', '/auth/resend')).status).toBe(401);
  });

  it('still signs up when the mail service fails', async () => {
    const w = createTestWorker({ env: mailEnv() });
    const failing = async () => {
      throw new Error('down');
    };
    const res = await handle(
      new Request('https://sync.test/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email: 'x@example.com', password: 'longenough' }),
      }),
      w.env,
      w.memory.repo,
      () => 1,
      { mailer: failing },
    );
    expect(res.status).toBe(200);
  });
});

describe('forgot and reset', () => {
  it('answers 204 for any email and mails only a real password account', async () => {
    const w = createTestWorker({ env: mailEnv() });
    await signup(w);
    w.mails.length = 0;
    const known = await w.call('POST', '/auth/forgot', { email: ' MOM@example.com ' });
    const unknown = await w.call('POST', '/auth/forgot', { email: 'who@example.com' });
    const garbage = await w.call('POST', '/auth/forgot', { email: 'nope' });
    const empty = await w.call('POST', '/auth/forgot', {});
    for (const r of [known, unknown, garbage, empty]) {
      expect(r.status).toBe(204);
      expect(r.text).toBe('');
    }
    expect(w.mails).toHaveLength(1);
    expect(w.mails[0].to).toBe('mom@example.com');
    expect(w.mails[0].subject).toBe(RESET_SUBJECT);
    expect(w.mails[0].text).toContain(`${ORIGIN}/schoolgames/?reset=`);
  });

  it('stays silent and 204 when mail is off', async () => {
    const w = createTestWorker();
    await signup(w);
    expect((await w.call('POST', '/auth/forgot', { email: 'mom@example.com' })).status).toBe(204);
    expect(w.mails).toEqual([]);
  });

  it('sets the password, signs every device out, and works once', async () => {
    const w = createTestWorker({ env: mailEnv() });
    const first = await signup(w);
    const second = await login(w, 'longenough');
    await w.call('POST', '/auth/forgot', { email: 'mom@example.com' });
    const token = lastToken(w, 'reset');
    const done = await w.call('POST', '/auth/reset', { token, password: 'brand-new-pw' });
    expect(done.status).toBe(204);

    for (const t of [first.token, second.body.token]) {
      expect((await w.call('GET', '/me', undefined, bearer(t))).status).toBe(401);
    }
    expect((await login(w, 'longenough')).status).toBe(401);
    const fresh = await login(w, 'brand-new-pw');
    expect(fresh.status).toBe(200);
    // The mailbox is proven.
    const info = await w.call('GET', '/account', undefined, bearer(fresh.body.token));
    expect(info.body.emailVerified).toBe(true);

    const replay = await w.call('POST', '/auth/reset', { token, password: 'another-one-1' });
    expect(replay.status).toBe(400);
    expect((await login(w, 'another-one-1')).status).toBe(401);
  });

  it('rejects a weak password, an unknown token and an expired token (1 hour)', async () => {
    const w = createTestWorker({ env: mailEnv() });
    await signup(w);
    await w.call('POST', '/auth/forgot', { email: 'mom@example.com' });
    const token = lastToken(w, 'reset');
    expect((await w.call('POST', '/auth/reset', { token, password: 'short' })).status).toBe(400);
    const unknown = await w.call('POST', '/auth/reset', { token: 'x', password: 'brand-new-pw' });
    expect(unknown.status).toBe(400);
    w.clock.now += HOUR + 1;
    const late = await w.call('POST', '/auth/reset', { token, password: 'brand-new-pw' });
    expect(late.status).toBe(400);
  });

  it('a newer reset link replaces the older one, and mails are limited per hour', async () => {
    const w = createTestWorker({ env: mailEnv() });
    await signup(w);
    w.mails.length = 0;
    await w.call('POST', '/auth/forgot', { email: 'mom@example.com' });
    const older = lastToken(w, 'reset');
    await w.call('POST', '/auth/forgot', { email: 'mom@example.com' });
    const res = await w.call('POST', '/auth/reset', { token: older, password: 'brand-new-pw' });
    expect(res.status).toBe(400);
    for (let i = 0; i < FORGOT_LIMIT + 2; i++) {
      expect((await w.call('POST', '/auth/forgot', { email: 'mom@example.com' })).status).toBe(204);
    }
    expect(w.mails).toHaveLength(FORGOT_LIMIT);
  });
});

describe('change password', () => {
  it('needs the current password, ends other sessions and keeps this one', async () => {
    const w = createTestWorker();
    const a = await signup(w);
    const b = (await login(w, 'longenough')).body.token as string;
    const change = (current: string, next: string) =>
      w.call('POST', '/auth/password', { current, next }, bearer(a.token));

    const wrong = await change('not-the-one', 'new-password-1');
    expect(wrong.status).toBe(401);
    expect(wrong.body).toEqual({ error: 'bad_credentials' });
    expect((await change('longenough', 'short')).status).toBe(400);
    expect((await w.call('GET', '/me', undefined, bearer(b))).status).toBe(200);

    expect((await change('longenough', 'new-password-1')).status).toBe(204);
    expect((await w.call('GET', '/me', undefined, bearer(a.token))).status).toBe(200);
    expect((await w.call('GET', '/me', undefined, bearer(b))).status).toBe(401);
    expect((await login(w, 'longenough')).status).toBe(401);
    expect((await login(w, 'new-password-1')).status).toBe(200);
  });

  it('is rate limited like login', async () => {
    const w = createTestWorker();
    const { token } = await signup(w);
    const bad = () =>
      w.call(
        'POST',
        '/auth/password',
        { current: 'wrong-pass', next: 'new-password-1' },
        bearer(token),
      );
    for (let i = 0; i < ATTEMPT_LIMIT; i++) expect((await bad()).status).toBe(401);
    expect((await bad()).status).toBe(429);
    const right = { current: 'longenough', next: 'new-password-1' };
    expect((await w.call('POST', '/auth/password', right, bearer(token))).status).toBe(429);
  });

  it('needs a session', async () => {
    const w = createTestWorker();
    expect((await w.call('POST', '/auth/password', { current: 'a', next: 'b' })).status).toBe(401);
  });
});

describe('delete account', () => {
  const play = (w: TestWorker, token: string, id: string, avatar: string) =>
    w.call(
      'POST',
      '/sync',
      {
        since: 0,
        players: [{ id, name: 'Kid', avatar }],
        progress: { [id]: emptyProgress() },
      },
      bearer(token),
    );

  it('refuses without the right email', async () => {
    const w = createTestWorker();
    const { token } = await signup(w);
    for (const body of [{}, { confirmEmail: 'other@example.com' }, { confirmEmail: 5 }]) {
      expect((await w.call('DELETE', '/account', body, bearer(token))).status).toBe(400);
    }
    expect((await w.call('GET', '/me', undefined, bearer(token))).status).toBe(200);
  });

  it('deletes the account with its sessions, players, progress and tokens', async () => {
    const w = createTestWorker({ env: mailEnv() });
    const mine = await signup(w);
    const other = await signup(w, 'dad@example.com');
    await play(w, mine.token, 'ana01', AVATARS[0]);
    await play(w, other.token, 'bob01', AVATARS[1]);
    const second = (await login(w, 'longenough')).body.token as string;

    const gone = await w.call(
      'DELETE',
      '/account',
      { confirmEmail: ' Mom@Example.com ' },
      bearer(mine.token),
    );
    expect(gone.status).toBe(204);
    const { memory } = w;
    expect([...memory.accounts.values()].map((a) => a.email)).toEqual(['dad@example.com']);
    expect([...memory.players.values()].map((p) => p.id)).toEqual(['bob01']);
    expect([...memory.progress.values()].map((p) => p.playerId)).toEqual(['bob01']);
    expect(memory.sessions.size).toBe(1);
    expect(memory.emailTokens.size).toBe(1);
    for (const t of [mine.token, second]) {
      expect((await w.call('GET', '/me', undefined, bearer(t))).status).toBe(401);
    }
    expect((await login(w, 'longenough')).status).toBe(401);
    // The email is free again.
    expect((await signup(w)).status).toBe(200);
  });
});

// ---------- Google ----------

const b64url = (data: Uint8Array | string) => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let text = '';
  for (const b of bytes) text += String.fromCharCode(b);
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function makeKey(kid = 'key-1') {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const jwk = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as Jwk;
  return { privateKey: pair.privateKey, jwk: { ...jwk, kid, alg: 'RS256' } as Jwk };
}

const CLIENT = 'client-123.apps.googleusercontent.com';
const NOW = 1_000_000;
const EXP = Math.floor(NOW / 1000);

async function idToken(
  key: Awaited<ReturnType<typeof makeKey>>,
  claims: Record<string, unknown> = {},
  header: Record<string, unknown> = {},
) {
  const head = b64url(JSON.stringify({ alg: 'RS256', kid: key.jwk.kid, typ: 'JWT', ...header }));
  const payload = b64url(
    JSON.stringify({
      iss: 'https://accounts.google.com',
      aud: CLIENT,
      sub: 'g-111',
      email: 'Mom@Example.com',
      email_verified: true,
      exp: EXP + 3600,
      ...claims,
    }),
  );
  const data = new TextEncoder().encode(`${head}.${payload}`);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key.privateKey, data));
  return `${head}.${payload}.${b64url(sig)}`;
}

function jwks(...keys: Jwk[]): FetchJwks & { calls: number } {
  const fn = (async () => {
    fn.calls++;
    return { keys };
  }) as FetchJwks & { calls: number };
  fn.calls = 0;
  return fn;
}

describe('Google ID token check', () => {
  it('accepts a valid token and returns the sub and email', async () => {
    const key = await makeKey();
    const id = await verifyGoogleToken(await idToken(key), CLIENT, jwks(key.jwk), NOW);
    expect(id).toEqual({ sub: 'g-111', email: 'Mom@Example.com' });
    const bare = await idToken(key, { iss: 'accounts.google.com', email_verified: 'true' });
    expect(await verifyGoogleToken(bare, CLIENT, jwks(key.jwk), NOW)).not.toBeNull();
  });

  it('rejects every kind of bad token', async () => {
    const key = await makeKey();
    const other = await makeKey('key-1');
    const keys = jwks(key.jwk);
    const bad = (token: string) => verifyGoogleToken(token, CLIENT, keys, NOW);
    expect(await bad(await idToken(key, { aud: 'someone-else' }))).toBeNull();
    expect(await bad(await idToken(key, { exp: EXP - 1 }))).toBeNull();
    expect(await bad(await idToken(key, { exp: EXP }))).toBeNull();
    expect(await bad(await idToken(key, { email_verified: false }))).toBeNull();
    expect(await bad(await idToken(key, { iss: 'https://evil.example' }))).toBeNull();
    expect(await bad(await idToken(key, { sub: '' }))).toBeNull();
    expect(await bad(await idToken(other))).toBeNull(); // signed by another key, same kid
    expect(await bad(await idToken(key, {}, { kid: 'unknown' }))).toBeNull();
    expect(await bad(await idToken(key, {}, { alg: 'none' }))).toBeNull();
    expect(await bad('not.a.jwt')).toBeNull();
    expect(await bad('')).toBeNull();

    // A good header and signature with swapped claims.
    const good = await idToken(key);
    const [head, , sig] = good.split('.');
    const claims = {
      iss: 'accounts.google.com',
      aud: CLIENT,
      sub: 'g-evil',
      email: 'a@b.co',
      email_verified: true,
      exp: 9e9,
    };
    expect(await bad(`${head}.${b64url(JSON.stringify(claims))}.${sig}`)).toBeNull();

    const offline: FetchJwks = async () => {
      throw new Error('offline');
    };
    expect(await verifyGoogleToken(good, CLIENT, offline, NOW)).toBeNull();
  });

  it('caches the keys for an hour and refetches after', async () => {
    const key = await makeKey();
    const keys = jwks(key.jwk);
    const token = await idToken(key, { exp: 9e9 });
    await verifyGoogleToken(token, CLIENT, keys, NOW);
    await verifyGoogleToken(token, CLIENT, keys, NOW + 1000);
    expect(keys.calls).toBe(1);
    await verifyGoogleToken(token, CLIENT, keys, NOW + JWKS_CACHE_MS);
    expect(keys.calls).toBe(2);
  });
});

describe('POST /auth/google', () => {
  const setup = async (env: Env = { ...testEnv(), GOOGLE_CLIENT_ID: CLIENT }) => {
    const key = await makeKey();
    const w = createTestWorker({ env, fetchJwks: jwks(key.jwk) });
    w.clock.now = NOW;
    const google = async (claims: Record<string, unknown> = {}) =>
      w.call('POST', '/auth/google', { credential: await idToken(key, claims) });
    return { w, key, google };
  };

  it('creates a verified password-less account, and signs in again by sub', async () => {
    const { w, google } = await setup();
    const first = await google();
    expect(first.status).toBe(200);
    expect(first.body.email).toBe('mom@example.com');
    const t = first.body.token as string;
    expect((await w.call('GET', '/account', undefined, bearer(t))).body).toEqual({
      email: 'mom@example.com',
      emailVerified: true,
      hasPassword: false,
    });
    // The same sub is the same account, even with a changed email.
    const again = await google({ email: 'new@example.com' });
    expect(again.body.email).toBe('mom@example.com');
    expect(w.memory.accounts.size).toBe(1);
    expect((await login(w, 'anything-at-all')).status).toBe(401);
  });

  it('fails when Google sign-in is not configured or the token is bad', async () => {
    const off = await setup(testEnv());
    expect((await off.google()).status).toBe(400);
    const { google, w } = await setup();
    for (const claims of [{ aud: 'x' }, { exp: 1 }, { email_verified: false }]) {
      const res = await google(claims);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'bad_credentials' });
    }
    expect((await w.call('POST', '/auth/google', {})).status).toBe(400);
    expect(w.memory.accounts.size).toBe(0);
  });

  it('links a verified password account and keeps its password and sessions', async () => {
    const { w, google } = await setup();
    const mine = await signup(w);
    firstAccount(w).emailVerified = true;
    expect((await google()).status).toBe(200);
    expect(w.memory.accounts.size).toBe(1);
    expect(firstAccount(w).googleSub).toBe('g-111');
    expect(firstAccount(w).passwordHash).not.toBeNull();
    expect((await login(w, 'longenough')).status).toBe(200);
    expect((await w.call('GET', '/me', undefined, bearer(mine.token))).status).toBe(200);
  });

  it('linking an unverified password account clears its password and sessions', async () => {
    const { w, google } = await setup();
    const squatter = await signup(w); // never confirmed
    expect((await google()).status).toBe(200);
    const account = firstAccount(w);
    expect(account.googleSub).toBe('g-111');
    expect(account.emailVerified).toBe(true);
    expect(account.passwordHash).toBeNull();
    expect(account.passwordSalt).toBeNull();
    expect((await login(w, 'longenough')).status).toBe(401);
    expect((await w.call('GET', '/me', undefined, bearer(squatter.token))).status).toBe(401);
  });

  it('does not take over an account already linked to another Google id', async () => {
    const { w, google } = await setup();
    await google();
    expect((await google({ sub: 'g-other' })).status).toBe(401);
    expect(w.memory.accounts.size).toBe(1);
  });

  it('lets a Google-only account set a password without a current one', async () => {
    const { w, google } = await setup();
    const t = (await google()).body.token as string;
    const set = await w.call('POST', '/auth/password', { next: 'fresh-password' }, bearer(t));
    expect(set.status).toBe(204);
    expect((await login(w, 'fresh-password')).status).toBe(200);
  });
});
