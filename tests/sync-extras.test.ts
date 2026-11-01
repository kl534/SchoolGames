import { describe, expect, it } from 'vitest';
import { AVATARS, createProgressStore, recordAnswer } from '../src/shared/progress';
import { memoryStore } from '../src/shared/storage';
import { ApiError, createSyncApi } from '../src/shared/sync/api';
import { getAccount, getCursor } from '../src/shared/sync/account';
import {
  changePassword,
  confirmEmail,
  deleteAccount,
  fetchAccountInfo,
  fetchConfig,
  requestReset,
  resendVerification,
  resetPassword,
  signIn,
  signInWithGoogle,
  signUp,
  syncNow,
} from '../src/shared/sync/engine';
import {
  PASSWORD_MISMATCH_TEXT,
  confirmsEmail,
  errorText,
  linkAction,
  newPasswordProblem,
  passwordErrorText,
} from '../src/shared/sync/messages';
import type { Jwk } from '../worker/src/google';
import { createTestWorker, mailEnv, type TestWorker } from './helpers/worker-app';

function device(worker: TestWorker) {
  const store = memoryStore();
  const progress = createProgressStore(store);
  const api = createSyncApi('https://sync.test', (url, init) => worker.fetchFn(url, init));
  const play = (id: string, fact: string, at: number) => {
    const p = progress.load(id);
    recordAnswer(p, 't', fact, true, at);
    progress.save(id, p);
  };
  return { store, progress, api, opts: { store, progress, api }, play };
}

const EMAIL = 'mom@example.com';
const PW = 'longenough';
const lastToken = (w: TestWorker, param: string) =>
  new RegExp(`\\?${param}=(\\S+)`).exec(w.mails[w.mails.length - 1]?.text ?? '')?.[1] ?? '';

describe('messages', () => {
  it('words the API errors, and unknown codes as a network problem', () => {
    expect(errorText('bad_credentials')).toBe('The email or password is wrong.');
    expect(errorText('network')).toMatch(/Can't reach/);
    expect(errorText('whatever')).toMatch(/Can't reach/);
    expect(passwordErrorText('bad_credentials')).toBe('The current password is wrong.');
    expect(passwordErrorText('invalid')).toMatch(/at least 8/);
    expect(passwordErrorText('rate_limited')).toBe(errorText('rate_limited'));
  });

  it('checks a new password and its repeat', () => {
    expect(newPasswordProblem('short', 'short')).toMatch(/at least 8/);
    expect(newPasswordProblem('x'.repeat(129), 'x'.repeat(129))).toMatch(/at most 128/);
    expect(newPasswordProblem('longenough', 'longenougX')).toBe(PASSWORD_MISMATCH_TEXT);
    expect(newPasswordProblem('longenough', 'longenough')).toBeNull();
  });

  it('gates deleting on the typed email', () => {
    expect(confirmsEmail(' Mom@Example.com ', 'mom@example.com')).toBe(true);
    expect(confirmsEmail('mom@example.co', 'mom@example.com')).toBe(false);
    expect(confirmsEmail('', '')).toBe(false);
  });

  it('reads the mailed links', () => {
    expect(linkAction('?verify=abc-_1')).toEqual({ kind: 'verify', token: 'abc-_1' });
    expect(linkAction('?reset=xyz&players')).toEqual({ kind: 'reset', token: 'xyz' });
    expect(linkAction('?verify=')).toBeNull();
    expect(linkAction('?players')).toBeNull();
    expect(linkAction('')).toBeNull();
  });
});

describe('engine: mail and password', () => {
  it('reads the config and the account state', async () => {
    const w = createTestWorker({ env: mailEnv() });
    const a = device(w);
    expect(await fetchConfig(a.opts)).toEqual({ emailEnabled: true, googleClientId: null });
    expect(await fetchAccountInfo(a.opts)).toBeNull();
    await signUp(EMAIL, PW, a.opts);
    expect(await fetchAccountInfo(a.opts)).toEqual({
      email: EMAIL,
      emailVerified: false,
      hasPassword: true,
    });
    expect(await fetchConfig({ ...a.opts, api: null })).toBeNull();
  });

  it('resends the link, then confirms with the token from the mail', async () => {
    const w = createTestWorker({ env: mailEnv() });
    const a = device(w);
    await signUp(EMAIL, PW, a.opts);
    await resendVerification(a.opts);
    expect(w.mails).toHaveLength(2);
    await confirmEmail(lastToken(w, 'verify'), a.opts);
    expect((await fetchAccountInfo(a.opts))?.emailVerified).toBe(true);
    await expect(confirmEmail('stale', a.opts)).rejects.toMatchObject({ code: 'invalid' });
    // Signed out: nothing to resend for.
    await expect(resendVerification({ ...a.opts, store: memoryStore() })).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it('forgot then reset lets a new password sign in, and old devices find out', async () => {
    const w = createTestWorker({ env: mailEnv() });
    const a = device(w);
    const ana = a.progress.addPlayer('Ana', AVATARS[0]);
    await signUp(EMAIL, PW, a.opts);
    const b = device(w);
    await requestReset(EMAIL, b.opts);
    await resetPassword(lastToken(w, 'reset'), 'brand-new-pw', b.opts);
    await expect(signIn(EMAIL, PW, b.opts)).rejects.toMatchObject({ code: 'bad_credentials' });
    await signIn(EMAIL, 'brand-new-pw', b.opts);
    expect(b.progress.listPlayers().map((p) => p.id)).toEqual([ana.id]);
    // Device A was signed out by the reset; its next sync keeps the players.
    await syncNow(a.opts);
    expect(getAccount(a.store)).toBeNull();
    expect(a.progress.listPlayers()).toHaveLength(1);
  });

  it('changes the password and keeps this device signed in', async () => {
    const w = createTestWorker();
    const a = device(w);
    const b = device(w);
    await signUp(EMAIL, PW, a.opts);
    await signIn(EMAIL, PW, b.opts);
    await expect(changePassword('wrong-pass', 'new-password-1', a.opts)).rejects.toMatchObject({
      code: 'bad_credentials',
    });
    await expect(changePassword(PW, 'short', a.opts)).rejects.toMatchObject({ code: 'invalid' });
    await changePassword(PW, 'new-password-1', a.opts);
    expect(await syncNow(a.opts)).toBe(false);
    expect(getAccount(a.store)).not.toBeNull();
    await syncNow(b.opts);
    expect(getAccount(b.store)).toBeNull();
    await signIn(EMAIL, 'new-password-1', b.opts);
    expect(getAccount(b.store)?.email).toBe(EMAIL);
  });
});

describe('engine: delete account', () => {
  it('removes the cloud copy, keeps the players here as local-only, and frees the email', async () => {
    const w = createTestWorker();
    const a = device(w);
    const ana = a.progress.addPlayer('Ana', AVATARS[0]);
    a.play(ana.id, 'f1', 1000);
    await signUp(EMAIL, PW, a.opts);
    const b = device(w);
    await signIn(EMAIL, PW, b.opts);

    await expect(deleteAccount('other@example.com', a.opts)).rejects.toMatchObject({
      code: 'invalid',
    });
    expect(getAccount(a.store)).not.toBeNull();
    expect(a.progress.listPlayers()[0].account).toBe(true);

    await deleteAccount(' MOM@example.com', a.opts);
    expect(getAccount(a.store)).toBeNull();
    expect(getCursor(a.store)).toBe(0);
    expect(a.progress.listPlayers()).toHaveLength(1);
    expect(a.progress.listPlayers()[0].account).toBeUndefined();
    expect(a.progress.load(ana.id).facts.t.f1.correct).toBe(1);
    expect(a.progress.pending()).toEqual({ dirty: [], removed: [] });
    expect(w.memory.accounts.size).toBe(0);
    expect(w.memory.players.size).toBe(0);
    expect(w.memory.progress.size).toBe(0);

    // Device B learns it was signed out and keeps its players.
    await syncNow(b.opts);
    expect(getAccount(b.store)).toBeNull();
    expect(b.progress.listPlayers()).toHaveLength(1);

    // Signing up again with the same email starts a fresh account that takes the players.
    await signUp(EMAIL, PW, a.opts);
    expect(w.memory.players.size).toBe(1);
  });

  it('changes nothing here when the service cannot be reached', async () => {
    const w = createTestWorker();
    const a = device(w);
    a.progress.addPlayer('Ana', AVATARS[0]);
    await signUp(EMAIL, PW, a.opts);
    const down = createSyncApi('https://sync.test', async () => {
      throw new TypeError('offline');
    });
    await expect(deleteAccount(EMAIL, { ...a.opts, api: down })).rejects.toMatchObject({
      code: 'network',
    });
    expect(getAccount(a.store)).not.toBeNull();
    expect(a.progress.listPlayers()[0].account).toBe(true);
  });
});

// ---------- Google through the engine ----------

const b64url = (data: Uint8Array | string) => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let text = '';
  for (const b of bytes) text += String.fromCharCode(b);
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

describe('engine: Google sign-in', () => {
  it('joins every local player to the account the Google token names', async () => {
    const CLIENT = 'client-1.apps.googleusercontent.com';
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
    const jwk = {
      ...((await crypto.subtle.exportKey('jwk', pair.publicKey)) as Jwk),
      kid: 'k1',
    } as Jwk;
    const w = createTestWorker({
      env: { ...mailEnv(), GOOGLE_CLIENT_ID: CLIENT },
      fetchJwks: async () => ({ keys: [jwk] }),
    });
    const head = b64url(JSON.stringify({ alg: 'RS256', kid: 'k1' }));
    const body = b64url(
      JSON.stringify({
        iss: 'accounts.google.com',
        aud: CLIENT,
        sub: 'g-1',
        email: EMAIL,
        email_verified: true,
        exp: Math.floor(w.clock.now / 1000) + 600,
      }),
    );
    const signature = new Uint8Array(
      await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        pair.privateKey,
        new TextEncoder().encode(`${head}.${body}`),
      ),
    );
    const credential = `${head}.${body}.${b64url(signature)}`;

    const a = device(w);
    const ana = a.progress.addPlayer('Ana', AVATARS[0]);
    a.play(ana.id, 'f1', 1000);
    expect(await fetchConfig(a.opts)).toEqual({ emailEnabled: true, googleClientId: CLIENT });
    await signInWithGoogle(credential, a.opts);
    expect(getAccount(a.store)?.email).toBe(EMAIL);
    expect(a.progress.listPlayers()[0].account).toBe(true);
    expect(w.memory.progress.size).toBe(1);
    expect(await fetchAccountInfo(a.opts)).toMatchObject({
      emailVerified: true,
      hasPassword: false,
    });

    const b = device(w);
    await signInWithGoogle(credential, b.opts);
    expect(b.progress.load(ana.id).facts.t.f1.correct).toBe(1);

    await expect(signInWithGoogle('junk', device(w).opts)).rejects.toMatchObject({
      code: 'bad_credentials',
    });
  });
});
