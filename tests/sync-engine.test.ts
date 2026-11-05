import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AVATARS,
  createProgressStore,
  recordAnswer,
  recordBest,
  type PlayerProgress,
} from '../src/shared/progress';
import { memoryStore } from '../src/shared/storage';
import { ApiError, createSyncApi } from '../src/shared/sync/api';
import { getAccount, getCursor, getNotice } from '../src/shared/sync/account';
import {
  SYNC_DEBOUNCE_MS,
  pushDirty,
  scheduleSync,
  signIn,
  signOut,
  signUp,
  syncNow,
} from '../src/shared/sync/engine';
import { createTestWorker, type TestWorker } from './helpers/worker-app';

/** One browser: its own storage, talking to the shared fake server. */
function device(worker: TestWorker) {
  const store = memoryStore();
  const progress = createProgressStore(store);
  const net = { down: false, calls: 0 };
  const api = createSyncApi('https://sync.test', async (url, init) => {
    net.calls++;
    if (net.down) throw new TypeError('offline');
    return worker.fetchFn(url, init);
  });
  const opts = { store, progress, api };
  const play = (id: string, topic: string, fact: string, correct: boolean, at: number) => {
    const p = progress.load(id);
    recordAnswer(p, topic, fact, correct, at);
    progress.save(id, p);
  };
  return { store, progress, api, net, opts, play };
}

const EMAIL = 'mom@example.com';
const PW = 'longenough';

afterEach(() => vi.useRealTimers());

describe('sync engine with two devices', () => {
  it('device A signs up with two players, device B signs in and gets both with progress', async () => {
    const w = createTestWorker();
    const a = device(w);
    const ana = a.progress.addPlayer('Ana', AVATARS[1]);
    const ben = a.progress.addPlayer('Ben', AVATARS[2]);
    a.play(ana.id, 't', 'f1', true, 1000);
    a.play(ben.id, 't', 'f2', false, 2000);
    await signUp(EMAIL, PW, a.opts);
    expect(getAccount(a.store)?.email).toBe(EMAIL);
    expect(a.progress.pending()).toEqual({ dirty: [], removed: [] });
    expect(getCursor(a.store)).toBeGreaterThan(0);

    const b = device(w);
    await signIn(EMAIL, PW, b.opts);
    expect(b.progress.listPlayers().map((p) => p.name)).toEqual(['Ana', 'Ben']);
    expect(b.progress.listPlayers().every((p) => p.account)).toBe(true);
    expect(b.progress.load(ana.id).facts.t.f1.correct).toBe(1);
    expect(b.progress.load(ben.id).facts.t.f2.wrong).toBe(1);
    expect(b.progress.pending()).toEqual({ dirty: [], removed: [] });
  });

  it('merges local players into the account when signing in, and keeps the ones already there', async () => {
    const w = createTestWorker();
    const a = device(w);
    const ana = a.progress.addPlayer('Ana', AVATARS[0]);
    await signUp(EMAIL, PW, a.opts);

    const b = device(w);
    const zed = b.progress.addPlayer('Zed', AVATARS[3]);
    await signIn(EMAIL, PW, b.opts);
    expect(
      b.progress
        .listPlayers()
        .map((p) => p.name)
        .sort(),
    ).toEqual(['Ana', 'Zed']);
    await syncNow(a.opts);
    expect(
      a.progress
        .listPlayers()
        .map((p) => p.id)
        .sort(),
    ).toEqual([ana.id, zed.id].sort());
  });

  it('both devices play the same fact and converge on the newer answer', async () => {
    const w = createTestWorker();
    const a = device(w);
    const ana = a.progress.addPlayer('Ana', AVATARS[0]);
    await signUp(EMAIL, PW, a.opts);
    const b = device(w);
    await signIn(EMAIL, PW, b.opts);

    a.play(ana.id, 't', 'f', true, 1000);
    b.play(ana.id, 't', 'f', false, 2000);
    const bp = b.progress.load(ana.id);
    recordBest(bp, 't', 'g', 2);
    b.progress.save(ana.id, bp);
    await syncNow(a.opts);
    await syncNow(b.opts);
    await syncNow(a.opts);
    const sa = a.progress.load(ana.id);
    const sb = b.progress.load(ana.id);
    expect(sa.facts.t.f).toEqual(sb.facts.t.f);
    expect(sa.facts.t.f.wrong).toBe(1);
    expect(sa.best.t.g).toBe(2);
    expect(a.progress.pending().dirty).toEqual([]);
  });

  it('a removal on A disappears from B', async () => {
    const w = createTestWorker();
    const a = device(w);
    const ana = a.progress.addPlayer('Ana', AVATARS[0]);
    const ben = a.progress.addPlayer('Ben', AVATARS[1]);
    await signUp(EMAIL, PW, a.opts);
    const b = device(w);
    await signIn(EMAIL, PW, b.opts);
    b.progress.setCurrentPlayer(ana.id);

    a.progress.removePlayer(ana.id);
    expect(a.progress.pending().removed).toEqual([ana.id]);
    await syncNow(a.opts);
    expect(a.progress.pending().removed).toEqual([]);
    expect(await syncNow(b.opts)).toBe(true);
    expect(b.progress.listPlayers().map((p) => p.id)).toEqual([ben.id]);
    expect(b.progress.currentPlayer()).toBeNull();
    expect(b.progress.pending()).toEqual({ dirty: [], removed: [] });
    // Nothing changed the second time.
    expect(await syncNow(b.opts)).toBe(false);
  });

  it('a new player on A reaches B', async () => {
    const w = createTestWorker();
    const a = device(w);
    await signUp(EMAIL, PW, a.opts);
    const b = device(w);
    await signIn(EMAIL, PW, b.opts);
    const cy = a.progress.addPlayer('Cy', AVATARS[4]);
    expect(cy.account).toBe(true);
    await syncNow(a.opts);
    expect(await syncNow(b.opts)).toBe(true);
    expect(b.progress.listPlayers()[0]).toMatchObject({ name: 'Cy', account: true });
  });

  it('sign-out can keep the players, or remove them', async () => {
    const w = createTestWorker();
    const a = device(w);
    const ana = a.progress.addPlayer('Ana', AVATARS[0]);
    await signUp(EMAIL, PW, a.opts);
    a.progress.setCurrentPlayer(ana.id);
    await signOut({ removeLocal: false }, a.opts);
    expect(getAccount(a.store)).toBeNull();
    expect(a.progress.listPlayers()).toEqual([{ id: ana.id, name: 'Ana', avatar: AVATARS[0] }]);
    expect(a.progress.pending()).toEqual({ dirty: [], removed: [] });
    expect(w.memory.sessions.size).toBe(0);

    await signIn(EMAIL, PW, a.opts);
    expect(a.progress.listPlayers()).toHaveLength(1);
    await signOut({ removeLocal: true }, a.opts);
    expect(a.progress.listPlayers()).toEqual([]);
    expect(a.progress.currentPlayer()).toBeNull();
    // The cloud still has Ana.
    const b = device(w);
    await signIn(EMAIL, PW, b.opts);
    expect(b.progress.listPlayers().map((p) => p.name)).toEqual(['Ana']);
  });

  it('unauthorized signs out but keeps the players and sets the notice', async () => {
    const w = createTestWorker();
    const a = device(w);
    const ana = a.progress.addPlayer('Ana', AVATARS[0]);
    await signUp(EMAIL, PW, a.opts);
    w.memory.sessions.clear();
    a.play(ana.id, 't', 'f', true, 5);
    expect(await syncNow(a.opts)).toBe(true);
    expect(getAccount(a.store)).toBeNull();
    expect(getNotice(a.store)).toBe('signed-out');
    expect(a.progress.listPlayers()).toHaveLength(1);
    expect(a.progress.listPlayers()[0].account).toBe(true);
    // Signing in again reuses the same ids instead of duplicating the player.
    await signIn(EMAIL, PW, a.opts);
    expect(getNotice(a.store)).toBeNull();
    expect(a.progress.listPlayers()).toHaveLength(1);
    expect(w.memory.players.size).toBe(1);
  });

  it('a network failure leaves everything dirty and never throws', async () => {
    const w = createTestWorker();
    const a = device(w);
    const ana = a.progress.addPlayer('Ana', AVATARS[0]);
    await signUp(EMAIL, PW, a.opts);
    a.net.down = true;
    a.play(ana.id, 't', 'f', true, 5);
    expect(await syncNow(a.opts)).toBe(false);
    expect(a.progress.pending().dirty).toEqual([ana.id]);
    expect(await pushDirty(a.opts)).toBe(false);
    expect(a.progress.pending().dirty).toEqual([ana.id]);
    expect(getAccount(a.store)).not.toBeNull();
    a.net.down = false;
    await syncNow(a.opts);
    expect(a.progress.pending().dirty).toEqual([]);
  });

  it('a failed first sync does not undo the sign-in', async () => {
    const w = createTestWorker();
    const a = device(w);
    a.progress.addPlayer('Ana', AVATARS[0]);
    const flaky = createSyncApi('https://sync.test', async (url, init) => {
      if (url.endsWith('/sync')) throw new TypeError('offline');
      return w.fetchFn(url, init);
    });
    await signUp(EMAIL, PW, { ...a.opts, api: flaky });
    expect(getAccount(a.store)?.email).toBe(EMAIL);
    expect(a.progress.pending().dirty).toHaveLength(1);
    await syncNow(a.opts);
    expect(a.progress.pending().dirty).toEqual([]);
  });

  it('a save during an in-flight sync stays dirty', async () => {
    const w = createTestWorker();
    const a = device(w);
    const ana = a.progress.addPlayer('Ana', AVATARS[0]);
    await signUp(EMAIL, PW, a.opts);
    a.play(ana.id, 't', 'f', true, 100);
    let saved = false;
    const racing = createSyncApi('https://sync.test', async (url, init) => {
      const res = await w.fetchFn(url, init);
      if (url.endsWith('/sync') && !saved) {
        saved = true;
        await new Promise((r) => setTimeout(r, 5));
        a.play(ana.id, 't', 'f', true, 200);
      }
      return res;
    });
    await syncNow({ ...a.opts, api: racing });
    expect(a.progress.pending().dirty).toEqual([ana.id]);
    // The newer local answer survived the merge.
    expect(a.progress.load(ana.id).facts.t.f.correct).toBe(2);
    await syncNow(a.opts);
    expect(a.progress.pending().dirty).toEqual([]);
    const b = device(w);
    await signIn(EMAIL, PW, b.opts);
    expect(b.progress.load(ana.id).facts.t.f.correct).toBe(2);
  });

  it('pushDirty sends progress but writes nothing locally', async () => {
    const w = createTestWorker();
    const a = device(w);
    const ana = a.progress.addPlayer('Ana', AVATARS[0]);
    await signUp(EMAIL, PW, a.opts);
    const b = device(w);
    await signIn(EMAIL, PW, b.opts);
    b.play(ana.id, 't', 'other', true, 9000);
    await syncNow(b.opts);

    a.play(ana.id, 't', 'f', true, 100);
    const before = a.store.getItem(`sg:progress:${ana.id}`);
    const cursor = getCursor(a.store);
    expect(await pushDirty(a.opts)).toBe(true);
    expect(a.store.getItem(`sg:progress:${ana.id}`)).toBe(before);
    expect(getCursor(a.store)).toBe(cursor);
    expect(a.progress.pending().dirty).toEqual([]);
    // The server has both devices' facts now; A has only its own until the menu syncs.
    expect(Object.keys(a.progress.load(ana.id).facts.t)).toEqual(['f']);
    await syncNow(a.opts);
    expect(Object.keys(a.progress.load(ana.id).facts.t).sort()).toEqual(['f', 'other']);
  });

  it('does nothing when signed out', async () => {
    const w = createTestWorker();
    const a = device(w);
    a.progress.addPlayer('Ana', AVATARS[0]);
    expect(await syncNow(a.opts)).toBe(false);
    expect(await pushDirty(a.opts)).toBe(false);
    scheduleSync(a.opts);
    expect(a.net.calls).toBe(0);
  });

  it('a second syncNow while one runs awaits the first', async () => {
    const w = createTestWorker();
    const a = device(w);
    a.progress.addPlayer('Ana', AVATARS[0]);
    await signUp(EMAIL, PW, a.opts);
    const before = a.net.calls;
    const one = syncNow(a.opts);
    const two = syncNow(a.opts);
    expect(two).toBe(one);
    await one;
    expect(a.net.calls - before).toBe(1);
  });

  it('reports bad sign-ins as ApiError', async () => {
    const w = createTestWorker();
    const a = device(w);
    await signUp(EMAIL, PW, a.opts);
    const b = device(w);
    await expect(signIn(EMAIL, 'wrong-wrong', b.opts)).rejects.toMatchObject({
      code: 'bad_credentials',
    });
    await expect(signUp(EMAIL, PW, b.opts)).rejects.toBeInstanceOf(ApiError);
    b.net.down = true;
    await expect(signIn(EMAIL, PW, b.opts)).rejects.toMatchObject({ code: 'network' });
    expect(getAccount(b.store)).toBeNull();
  });

  it('scheduleSync pushes after the debounce', async () => {
    const w = createTestWorker();
    const a = device(w);
    const ana = a.progress.addPlayer('Ana', AVATARS[0]);
    await signUp(EMAIL, PW, a.opts);
    vi.useFakeTimers();
    a.play(ana.id, 't', 'f', true, 100);
    scheduleSync(a.opts);
    scheduleSync(a.opts);
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS - 1);
    expect(a.progress.pending().dirty).toEqual([ana.id]);
    await vi.advanceTimersByTimeAsync(1);
    vi.useRealTimers();
    await vi.waitFor(() => expect(a.progress.pending().dirty).toEqual([]));
  });

  it('keeps unsynced progress shape intact through a round trip', async () => {
    const w = createTestWorker();
    const a = device(w);
    const ana = a.progress.addPlayer('Ana', AVATARS[0]);
    const p: PlayerProgress = a.progress.load(ana.id);
    p.ladders = { t: { g: 3 } };
    p.homePath = 'social-studies';
    p.pathLevelsOpen = { 'social-studies': 4 };
    a.progress.save(ana.id, p);
    await signUp(EMAIL, PW, a.opts);
    const b = device(w);
    await signIn(EMAIL, PW, b.opts);
    const got = b.progress.load(ana.id);
    expect(got.ladders).toEqual({ t: { g: 3 } });
    expect(got.homePath).toBe('social-studies');
    expect(got.pathLevelsOpen).toEqual({ 'social-studies': 4 });
  });
});
