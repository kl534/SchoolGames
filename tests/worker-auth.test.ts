import { describe, expect, it } from 'vitest';
import {
  ATTEMPT_LIMIT,
  ATTEMPT_WINDOW_MS,
  MAX_PASSWORD,
  SESSION_DAYS,
  hashPassword,
  validEmail,
  verifyPassword,
} from '../worker/src/auth';
import { ORIGIN, createTestWorker } from './helpers/worker-app';

const signup = (
  w: ReturnType<typeof createTestWorker>,
  email = 'Mom@Example.com',
  pw = 'longenough',
) => w.call('POST', '/auth/signup', { email, password: pw });

describe('auth helpers', () => {
  it('hashes with a salt and verifies', async () => {
    const a = await hashPassword('secret-pass');
    const b = await hashPassword('secret-pass');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    expect(await verifyPassword('secret-pass', a.hash, a.salt)).toBe(true);
    expect(await verifyPassword('secret-pasx', a.hash, a.salt)).toBe(false);
  });

  it('validates emails', () => {
    for (const ok of ['a@b.co', ' A@B.CO ', 'x.y+z@mail.example.org'])
      expect(validEmail(ok)).toBe(true);
    for (const bad of ['', 'a', 'a@b', 'a@@b.co', '@b.co', 'a@.co', 'a@b.', 'a b@c.de']) {
      expect(validEmail(bad)).toBe(false);
    }
    expect(validEmail(`${'a'.repeat(250)}@b.co`)).toBe(false);
  });
});

describe('worker accounts', () => {
  it('signs up, returns a token, and /me accepts it', async () => {
    const w = createTestWorker();
    const res = await signup(w);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('mom@example.com');
    expect(typeof res.body.token).toBe('string');
    const me = await w.call('GET', '/me', undefined, { Authorization: `Bearer ${res.body.token}` });
    expect(me.body).toEqual({ email: 'mom@example.com' });
  });

  it('rejects a duplicate email in any case', async () => {
    const w = createTestWorker();
    await signup(w);
    const again = await signup(w, 'MOM@example.COM');
    expect(again.status).toBe(409);
    expect(again.body).toEqual({ error: 'exists' });
  });

  it('rejects short and long passwords and bad emails', async () => {
    const w = createTestWorker();
    expect((await signup(w, 'a@b.co', 'short')).body).toEqual({ error: 'invalid' });
    expect((await signup(w, 'a@b.co', 'x'.repeat(MAX_PASSWORD + 1))).status).toBe(400);
    expect((await signup(w, 'nope', 'longenough')).status).toBe(400);
    expect((await w.call('POST', '/auth/signup', { email: 1 })).status).toBe(400);
    expect((await signup(w, 'a@b.co', 'x'.repeat(MAX_PASSWORD))).status).toBe(200);
  });

  it('logs in case-insensitively and logs out', async () => {
    const w = createTestWorker();
    await signup(w);
    const login = await w.call('POST', '/auth/login', {
      email: ' mom@EXAMPLE.com',
      password: 'longenough',
    });
    expect(login.status).toBe(200);
    const auth = { Authorization: `Bearer ${login.body.token}` };
    expect((await w.call('POST', '/auth/logout', undefined, auth)).status).toBe(204);
    const after = await w.call('GET', '/me', undefined, auth);
    expect(after.status).toBe(401);
    expect(after.body).toEqual({ error: 'unauthorized' });
  });

  it('answers a wrong password and an unknown email the same way', async () => {
    const w = createTestWorker();
    await signup(w);
    const wrong = await w.call('POST', '/auth/login', {
      email: 'mom@example.com',
      password: 'nope-nope',
    });
    const unknown = await w.call('POST', '/auth/login', {
      email: 'who@example.com',
      password: 'nope-nope',
    });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.text).toBe(unknown.text);
    expect(wrong.body).toEqual({ error: 'bad_credentials' });
  });

  it('answers 429 on the 11th failed login, and a success resets the count', async () => {
    const w = createTestWorker();
    await signup(w);
    const bad = () =>
      w.call('POST', '/auth/login', { email: 'mom@example.com', password: 'wrong-pass' });
    for (let i = 0; i < ATTEMPT_LIMIT; i++) expect((await bad()).status).toBe(401);
    const blocked = await bad();
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: 'rate_limited' });
    // Even the right password waits out the window.
    const right = { email: 'mom@example.com', password: 'longenough' };
    expect((await w.call('POST', '/auth/login', right)).status).toBe(429);
    w.clock.now += ATTEMPT_WINDOW_MS;
    expect((await w.call('POST', '/auth/login', right)).status).toBe(200);

    // A success in the middle starts the count again.
    for (let i = 0; i < ATTEMPT_LIMIT - 1; i++) await bad();
    expect((await w.call('POST', '/auth/login', right)).status).toBe(200);
    for (let i = 0; i < ATTEMPT_LIMIT; i++) expect((await bad()).status).toBe(401);
  });

  it('expires sessions and pushes the expiry out on use', async () => {
    const w = createTestWorker();
    const { body } = await signup(w);
    const auth = { Authorization: `Bearer ${body.token}` };
    const day = 24 * 60 * 60 * 1000;
    w.clock.now += 60 * day;
    expect((await w.call('GET', '/me', undefined, auth)).status).toBe(200);
    w.clock.now += 60 * day;
    expect((await w.call('GET', '/me', undefined, auth)).status).toBe(200);
    w.clock.now += SESSION_DAYS * day + 1;
    expect((await w.call('GET', '/me', undefined, auth)).status).toBe(401);
  });

  it('refuses a missing or unknown token', async () => {
    const w = createTestWorker();
    expect((await w.call('GET', '/me')).status).toBe(401);
    expect((await w.call('GET', '/me', undefined, { Authorization: 'Bearer nope' })).status).toBe(
      401,
    );
    expect((await w.call('POST', '/sync', { since: 0, players: [], progress: {} })).status).toBe(
      401,
    );
  });

  it('never returns or stores the password in plain text', async () => {
    const w = createTestWorker();
    const res = await signup(w, 'a@b.co', 'my-plain-password');
    expect(res.text).not.toContain('my-plain-password');
    expect(res.text).not.toContain('hash');
    const row = [...w.memory.accounts.values()][0];
    expect(JSON.stringify(row)).not.toContain('my-plain-password');
    expect(row.passwordHash).toBeTruthy();
    expect(row.passwordSalt).toBeTruthy();
    // Only the token's hash is kept.
    expect([...w.memory.sessions.keys()]).not.toContain(res.body.token);
  });

  it('serves /config with everything off', async () => {
    const w = createTestWorker();
    const res = await w.call('GET', '/config');
    expect(res.body).toEqual({ emailEnabled: false, googleClientId: null });
  });
});

describe('worker CORS', () => {
  it('echoes an allowed origin and leaves others without headers', async () => {
    const w = createTestWorker();
    const ok = await w.call('GET', '/config', undefined, { Origin: ORIGIN });
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(ok.headers.get('Access-Control-Allow-Headers')).toBe('Authorization, Content-Type');
    const bad = await w.call('GET', '/config', undefined, { Origin: 'https://evil.example' });
    expect(bad.headers.get('Access-Control-Allow-Origin')).toBeNull();
    const none = await w.call('GET', '/config');
    expect(none.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('answers a preflight', async () => {
    const w = createTestWorker();
    const ok = await w.call('OPTIONS', '/sync', undefined, { Origin: 'http://localhost:5173' });
    expect(ok.status).toBe(204);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(ok.headers.get('Access-Control-Allow-Methods')).toBe('GET,POST,DELETE,OPTIONS');
    const bad = await w.call('OPTIONS', '/sync', undefined, { Origin: 'https://evil.example' });
    expect(bad.status).toBe(204);
    expect(bad.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('adds CORS headers to errors too', async () => {
    const w = createTestWorker();
    const res = await w.call('GET', '/me', undefined, { Origin: ORIGIN });
    expect(res.status).toBe(401);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
  });
});
