import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_PLAYERS } from '../worker/src/auth';
import { AVATARS, emptyProgress, type PlayerProgress } from '../src/shared/progress';
import type { SyncRequest, SyncResponse } from '../src/shared/sync/protocol';
import { createTestWorker, type TestWorker } from './helpers/worker-app';

const prog = (extra: Partial<PlayerProgress> = {}): PlayerProgress => ({
  ...emptyProgress(),
  ...extra,
});
const stat = (correct: number, lastSeen: number) => ({
  correct,
  wrong: 0,
  streak: correct,
  lastSeen,
});

let w: TestWorker;
beforeEach(() => {
  w = createTestWorker();
});

async function account(email = 'mom@example.com') {
  const res = await w.call('POST', '/auth/signup', { email, password: 'longenough' });
  return { Authorization: `Bearer ${res.body.token}` };
}

const send = (auth: Record<string, string>, req: Partial<SyncRequest>) =>
  w.call('POST', '/sync', { since: 0, players: [], progress: {}, ...req }, auth);
const sync = async (auth: Record<string, string>, req: Partial<SyncRequest>) => {
  const res = await send(auth, req);
  expect(res.status).toBe(200);
  return res.body as SyncResponse;
};

describe('POST /sync', () => {
  it('stores a first push and gives it back on a pull from another device', async () => {
    const auth = await account();
    const first = await sync(auth, {
      players: [{ id: 'ana01', name: ' Ana ', avatar: AVATARS[1] }],
      progress: { ana01: prog({ best: { t: { g: 2 } }, facts: { t: { f: stat(2, 10) } } }) },
    });
    expect(first.players).toEqual([{ id: 'ana01', name: 'Ana', avatar: AVATARS[1] }]);
    expect(first.cursor).toBeGreaterThan(0);

    const pulled = await sync(auth, { since: 0 });
    expect(pulled.players).toHaveLength(1);
    expect(pulled.progress.ana01.best).toEqual({ t: { g: 2 } });
    expect(pulled.cursor).toBe(first.cursor);
  });

  it('merges two devices pushes', async () => {
    const auth = await account();
    const players = [{ id: 'ana01', name: 'Ana', avatar: AVATARS[0] }];
    await sync(auth, {
      players,
      progress: { ana01: prog({ facts: { t: { a: stat(1, 10) } }, best: { t: { g: 3 } } }) },
    });
    const merged = await sync(auth, {
      players,
      progress: {
        ana01: prog({ facts: { t: { b: stat(1, 20), a: stat(5, 30) } }, best: { t: { g: 1 } } }),
      },
    });
    const p = merged.progress.ana01;
    expect(p.facts.t.a.correct).toBe(5);
    expect(p.facts.t.b.correct).toBe(1);
    expect(p.best.t.g).toBe(3);
  });

  it('filters by since and moves the cursor forward on every write', async () => {
    const auth = await account();
    const a = await sync(auth, {
      players: [{ id: 'ana01', name: 'Ana', avatar: AVATARS[0] }],
      progress: { ana01: prog() },
    });
    const b = await sync(auth, {
      players: [{ id: 'ben01', name: 'Ben', avatar: AVATARS[0] }],
      progress: { ben01: prog() },
    });
    expect(b.cursor).toBeGreaterThan(a.cursor);
    const since = await sync(auth, { since: b.cursor });
    expect(since.players.map((p) => p.id)).toEqual(['ben01']);
    expect(Object.keys(since.progress)).toEqual(['ben01']);
    const none = await sync(auth, { since: b.cursor + 1 });
    expect(none.players).toEqual([]);
    expect(none.cursor).toBe(b.cursor);
  });

  it('keeps updated_at strictly increasing even when the clock does not move', async () => {
    const auth = await account();
    const a = await sync(auth, { players: [{ id: 'ana01', name: 'Ana', avatar: AVATARS[0] }] });
    const b = await sync(auth, { players: [{ id: 'ben01', name: 'Ben', avatar: AVATARS[0] }] });
    expect(b.cursor).toBe(a.cursor + 1);
  });

  it('never renames an existing player', async () => {
    const auth = await account();
    await sync(auth, { players: [{ id: 'ana01', name: 'Ana', avatar: AVATARS[0] }] });
    const res = await sync(auth, { players: [{ id: 'ana01', name: 'Other', avatar: AVATARS[2] }] });
    expect(res.players[0]).toMatchObject({ name: 'Ana', avatar: AVATARS[0] });
  });

  it('keeps a deleted player deleted and ignores its later progress', async () => {
    const auth = await account();
    await sync(auth, {
      players: [{ id: 'ana01', name: 'Ana', avatar: AVATARS[0] }],
      progress: { ana01: prog({ best: { t: { g: 1 } } }) },
    });
    const del = await sync(auth, {
      players: [{ id: 'ana01', name: '', avatar: '', deleted: true }],
    });
    expect(del.players).toEqual([{ id: 'ana01', name: 'Ana', avatar: AVATARS[0], deleted: true }]);
    expect(del.progress.ana01).toBeUndefined();

    const later = await sync(auth, {
      players: [{ id: 'ana01', name: 'Ana', avatar: AVATARS[0] }],
      progress: { ana01: prog({ best: { t: { g: 3 } } }) },
    });
    expect(later.players[0].deleted).toBe(true);
    expect(later.progress.ana01).toBeUndefined();
    const all = await sync(auth, { since: 0 });
    expect(all.progress).toEqual({});
  });

  it('deleted players do not count against the player limit', async () => {
    const auth = await account();
    const many = (n: number, offset = 0) =>
      Array.from({ length: n }, (_, i) => ({
        id: `kid${String(i + offset).padStart(3, '0')}`,
        name: `K${i}`,
        avatar: AVATARS[0],
      }));
    await sync(auth, { players: many(MAX_PLAYERS) });
    const over = await send(auth, { players: many(1, 99) });
    expect(over.status).toBe(400);
    expect(over.body).toEqual({ error: 'limit' });
    await sync(auth, { players: [{ id: 'kid000', name: '', avatar: '', deleted: true }] });
    expect((await send(auth, { players: many(1, 99) })).status).toBe(200);
  });

  it('keeps accounts apart', async () => {
    const a = await account('a@example.com');
    const b = await account('b@example.com');
    await sync(a, {
      players: [{ id: 'ana01', name: 'Ana', avatar: AVATARS[0] }],
      progress: { ana01: prog({ best: { t: { g: 3 } } }) },
    });
    const seen = await sync(b, { since: 0 });
    expect(seen.players).toEqual([]);
    expect(seen.progress).toEqual({});
    expect(seen.cursor).toBe(0);
    // B reusing the id gets its own row; A's progress is not touched.
    await sync(b, {
      players: [{ id: 'ana01', name: 'Bee', avatar: AVATARS[0] }],
      progress: { ana01: prog({ best: { t: { g: 1 } } }) },
    });
    const again = await sync(a, { since: 0 });
    expect(again.players[0].name).toBe('Ana');
    expect(again.progress.ana01.best.t.g).toBe(3);
  });

  it('ignores progress for a player that does not exist', async () => {
    const auth = await account();
    const res = await sync(auth, { progress: { ghost1: prog() } });
    expect(res.progress).toEqual({});
  });

  it('rejects oversize progress with 413 and changes nothing', async () => {
    const auth = await account();
    const big = prog({ facts: { t: {} } });
    for (let i = 0; i < 6000; i++) big.facts.t[`fact-number-${i}`] = stat(1, i);
    const res = await send(auth, {
      players: [{ id: 'ana01', name: 'Ana', avatar: AVATARS[0] }],
      progress: { ana01: big },
    });
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'too_large' });
    expect((await sync(auth, { since: 0 })).players).toEqual([]);
  });

  it('rejects an oversize body with 413', async () => {
    const auth = await account();
    const res = await w.call(
      'POST',
      '/sync',
      { since: 0, players: [], progress: {}, pad: 'x'.repeat(4_100_000) },
      auth,
    );
    expect(res.status).toBe(413);
  });

  it('rejects bad ids, names, avatars and shapes with 400', async () => {
    const auth = await account();
    const bad: Partial<SyncRequest>[] = [
      { players: [{ id: 'AB', name: 'Ana', avatar: AVATARS[0] }] },
      { players: [{ id: 'has space', name: 'Ana', avatar: AVATARS[0] }] },
      { players: [{ id: 'ana01', name: '', avatar: AVATARS[0] }] },
      { players: [{ id: 'ana01', name: 'x'.repeat(21), avatar: AVATARS[0] }] },
      { players: [{ id: 'ana01', name: 'Ana', avatar: 'nope' }] },
      { progress: { ana01: { facts: 'x' } as unknown as PlayerProgress } },
      { progress: { 'BAD ID': prog() } },
      { since: -1 },
      { since: 'a' as unknown as number },
      { players: 'x' as unknown as SyncRequest['players'] },
    ];
    for (const req of bad) expect((await send(auth, req)).status).toBe(400);
    expect((await w.call('POST', '/sync', 'nope', auth)).status).toBe(400);
  });

  it('is atomic: one bad player fails the whole request', async () => {
    const auth = await account();
    const res = await send(auth, {
      players: [
        { id: 'ana01', name: 'Ana', avatar: AVATARS[0] },
        { id: 'ben01', name: 'Ben', avatar: 'nope' },
      ],
      progress: { ana01: prog({ best: { t: { g: 1 } } }) },
    });
    expect(res.status).toBe(400);
    expect(w.memory.players.size).toBe(0);
    expect(w.memory.progress.size).toBe(0);
  });

  it('is safe to retry: the same push twice gives the same result', async () => {
    const auth = await account();
    const req = {
      players: [{ id: 'ana01', name: 'Ana', avatar: AVATARS[0] }],
      progress: { ana01: prog({ facts: { t: { f: stat(2, 10) } }, savedAt: 5 }) },
    };
    const one = await sync(auth, req);
    const two = await sync(auth, { ...req, since: one.cursor });
    expect(two.progress.ana01).toEqual(one.progress.ana01);
  });
});
