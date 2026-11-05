import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { handle } from '../worker/src/app';
import { createD1Repo } from '../worker/src/d1';
import type { D1Like, D1Statement } from '../worker/src/repo';
import { AVATARS, emptyProgress } from '../src/shared/progress';
import { testEnv } from './helpers/worker-app';

type Sqlite = typeof import('node:sqlite');
let sqlite: Sqlite | null = null;
try {
  sqlite = await import('node:sqlite');
} catch {
  sqlite = null;
}
const hasNodeSqlite = sqlite !== null;

/** Just enough of D1's API on top of node:sqlite. */
function d1On(db: InstanceType<Sqlite['DatabaseSync']>): D1Like {
  const statement = (sql: string, values: unknown[] = []): D1Statement => ({
    bind: (...v) => statement(sql, v),
    first: async <T>() => (db.prepare(sql).get(...(values as never[])) ?? null) as T | null,
    all: async <T>() => ({ results: db.prepare(sql).all(...(values as never[])) as T[] }),
    run: async () => {
      const info = db.prepare(sql).run(...(values as never[]));
      return { meta: { changes: Number(info.changes) } };
    },
  });
  return {
    prepare: (sql) => statement(sql),
    async batch(statements) {
      db.exec('BEGIN');
      try {
        const out = [];
        for (const s of statements) out.push(await s.run());
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

function freshDb() {
  const db = new sqlite!.DatabaseSync(':memory:');
  const files = readdirSync('worker/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of files) db.exec(readFileSync(`worker/migrations/${f}`, 'utf8'));
  return db;
}

describe.skipIf(!hasNodeSqlite)('createD1Repo on SQLite', () => {
  const setup = () => {
    const db = freshDb();
    const repo = createD1Repo(d1On(db));
    const env = testEnv();
    let now = 5_000_000;
    const call = async (method: string, path: string, body?: unknown, token?: string) => {
      const res = await handle(
        new Request(`https://sync.test${path}`, {
          method,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
        env,
        repo,
        () => now,
      );
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null };
    };
    return { db, repo, call, tick: (ms: number) => (now += ms) };
  };

  it('signs up, logs in, and rejects a wrong password and a duplicate', async () => {
    const { call } = setup();
    const up = await call('POST', '/auth/signup', { email: 'A@b.co', password: 'longenough' });
    expect(up.status).toBe(200);
    expect(
      (await call('POST', '/auth/signup', { email: 'a@b.co', password: 'longenough' })).status,
    ).toBe(409);
    expect(
      (await call('POST', '/auth/login', { email: 'a@b.co', password: 'wrongwrong' })).status,
    ).toBe(401);
    const login = await call('POST', '/auth/login', { email: 'a@b.co', password: 'longenough' });
    expect((await call('GET', '/me', undefined, login.body.token)).body).toEqual({
      email: 'a@b.co',
    });
    expect((await call('POST', '/auth/logout', undefined, login.body.token)).status).toBe(204);
    expect((await call('GET', '/me', undefined, login.body.token)).status).toBe(401);
  });

  it('counts failed logins in the attempts table', async () => {
    const { call, db } = setup();
    await call('POST', '/auth/signup', { email: 'a@b.co', password: 'longenough' });
    for (let i = 0; i < 3; i++) {
      await call('POST', '/auth/login', { email: 'a@b.co', password: 'wrongwrong' });
    }
    const row = db.prepare("SELECT count FROM attempts WHERE key = 'login:a@b.co'").get() as {
      count: number;
    };
    expect(row.count).toBe(3);
    await call('POST', '/auth/login', { email: 'a@b.co', password: 'longenough' });
    expect(
      db.prepare("SELECT count FROM attempts WHERE key = 'login:a@b.co'").get(),
    ).toBeUndefined();
  });

  it('pushes, pulls, merges and deletes through the real SQL', async () => {
    const { call, db } = setup();
    const { body } = await call('POST', '/auth/signup', {
      email: 'a@b.co',
      password: 'longenough',
    });
    const token = body.token as string;
    const players = [{ id: 'ana01', name: 'Ana', avatar: AVATARS[0] }];
    const first = await call(
      'POST',
      '/sync',
      {
        since: 0,
        players,
        progress: { ana01: { ...emptyProgress(), best: { t: { g: 2 } } } },
      },
      token,
    );
    expect(first.status).toBe(200);
    const second = await call(
      'POST',
      '/sync',
      {
        since: 0,
        players,
        progress: { ana01: { ...emptyProgress(), best: { t: { g: 1, h: 3 } } } },
      },
      token,
    );
    expect(second.body.progress.ana01.best).toEqual({ t: { g: 2, h: 3 } });
    expect(second.body.cursor).toBeGreaterThan(first.body.cursor);

    const since = await call(
      'POST',
      '/sync',
      { since: second.body.cursor + 1, players: [], progress: {} },
      token,
    );
    expect(since.body.players).toEqual([]);

    const del = await call(
      'POST',
      '/sync',
      {
        since: 0,
        players: [{ id: 'ana01', name: '', avatar: '', deleted: true }],
        progress: {},
      },
      token,
    );
    expect(del.body.players[0].deleted).toBe(true);
    expect(db.prepare('SELECT COUNT(*) AS n FROM progress').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT deleted FROM players').get()).toEqual({ deleted: 1 });
  });

  it('rolls the whole batch back when one write fails', async () => {
    const { repo, db } = setup();
    await repo.createAccount({
      id: 'acc1',
      email: 'a@b.co',
      passwordHash: 'h',
      passwordSalt: 's',
      createdAt: 1,
    });
    await expect(
      repo.applySync('acc1', {
        players: [{ id: 'ana01', name: 'Ana', avatar: AVATARS[0], deleted: false, updatedAt: 1 }],
        deleteProgress: [],
        // No such player: the foreign key fails and the player insert must be undone.
        progress: [{ playerId: 'ghost1', data: '{}', updatedAt: 1 }],
      }),
    ).rejects.toThrow();
    expect(db.prepare('SELECT COUNT(*) AS n FROM players').get()).toEqual({ n: 0 });
  });

  it('deleting an account cascades to its rows', async () => {
    const { call, db } = setup();
    const { body } = await call('POST', '/auth/signup', {
      email: 'a@b.co',
      password: 'longenough',
    });
    await call(
      'POST',
      '/sync',
      {
        since: 0,
        players: [{ id: 'ana01', name: 'Ana', avatar: AVATARS[0] }],
        progress: { ana01: emptyProgress() },
      },
      body.token,
    );
    db.exec('DELETE FROM accounts');
    for (const table of ['sessions', 'players', 'progress']) {
      expect(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()).toEqual({ n: 0 });
    }
  });

  it('runs the account tools through the real SQL', async () => {
    const { repo, db } = setup();
    const account = {
      id: 'acc1',
      email: 'a@b.co',
      passwordHash: 'h',
      passwordSalt: 's',
      createdAt: 1,
    };
    expect(await repo.createAccount(account)).toBe(true);
    expect(await repo.createAccount({ ...account, id: 'acc2' })).toBe(false);
    expect(await repo.accountById('acc1')).toMatchObject({
      googleSub: null,
      emailVerified: false,
    });

    // Tokens: single use, per kind, a newer one replaces the older.
    await repo.createEmailToken('t1', 'acc1', 'reset', 99);
    await repo.createEmailToken('t2', 'acc1', 'reset', 99);
    expect(await repo.takeEmailToken('t1', 'reset')).toBeNull();
    expect(await repo.takeEmailToken('t2', 'verify')).toBeNull();
    expect(await repo.takeEmailToken('t2', 'reset')).toEqual({ accountId: 'acc1', expiresAt: 99 });
    expect(await repo.takeEmailToken('t2', 'reset')).toBeNull();

    await repo.setPassword('acc1', 'h2', 's2');
    await repo.setEmailVerified('acc1');
    expect(await repo.accountByEmail('a@b.co')).toMatchObject({
      passwordHash: 'h2',
      passwordSalt: 's2',
      emailVerified: true,
    });

    await repo.linkGoogle('acc1', 'sub-1', true);
    expect(await repo.accountByGoogleSub('sub-1')).toMatchObject({
      id: 'acc1',
      passwordHash: null,
      passwordSalt: null,
    });
    expect(await repo.accountByGoogleSub('nope')).toBeNull();
    await expect(
      repo.createAccount({ ...account, id: 'acc3', email: 'c@d.co', googleSub: 'sub-1' }),
    ).rejects.toThrow();

    await repo.createSession('s1', 'acc1', 99);
    await repo.createSession('s2', 'acc1', 99);
    await repo.deleteSessions('acc1', 's1');
    expect((db.prepare('SELECT token_hash FROM sessions').all() as unknown[]).length).toBe(1);
    await repo.deleteSessions('acc1');
    expect(db.prepare('SELECT COUNT(*) AS n FROM sessions').get()).toEqual({ n: 0 });

    await repo.createEmailToken('t3', 'acc1', 'verify', 99);
    await repo.deleteAccount('acc1');
    expect(db.prepare('SELECT COUNT(*) AS n FROM email_tokens').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM accounts').get()).toEqual({ n: 0 });
  });
});
