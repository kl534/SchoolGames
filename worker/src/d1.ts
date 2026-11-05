import type {
  AccountRow,
  AttemptRow,
  D1Like,
  PlayerRow,
  ProgressRow,
  Repo,
  SessionRow,
  SyncWrites,
} from './repo';

interface PlayerDb {
  id: string;
  name: string;
  avatar: string;
  deleted: number;
  updated_at: number;
}

interface ProgressDb {
  player_id: string;
  data: string;
  updated_at: number;
}

const toPlayer = (r: PlayerDb): PlayerRow => ({
  id: r.id,
  name: r.name,
  avatar: r.avatar,
  deleted: r.deleted === 1,
  updatedAt: r.updated_at,
});

const toProgress = (r: ProgressDb): ProgressRow => ({
  playerId: r.player_id,
  data: r.data,
  updatedAt: r.updated_at,
});

const ACCOUNT_COLUMNS =
  'id, email, password_hash, password_salt, google_sub, email_verified, created_at';

async function accountWhere(
  db: D1Like,
  column: 'id' | 'email' | 'google_sub',
  value: string,
): Promise<AccountRow | null> {
  const r = await db
    .prepare(`SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE ${column} = ?`)
    .bind(value)
    .first<{
      id: string;
      email: string;
      password_hash: string | null;
      password_salt: string | null;
      google_sub: string | null;
      email_verified: number;
      created_at: number;
    }>();
  if (!r) return null;
  return {
    id: r.id,
    email: r.email,
    passwordHash: r.password_hash,
    passwordSalt: r.password_salt,
    googleSub: r.google_sub,
    emailVerified: r.email_verified === 1,
    createdAt: r.created_at,
  };
}

/** The `Repo` on a D1 database (or anything shaped like it). */
export function createD1Repo(db: D1Like): Repo {
  return {
    async accountByEmail(email) {
      return accountWhere(db, 'email', email);
    },
    async accountById(id) {
      return accountWhere(db, 'id', id);
    },
    async accountByGoogleSub(sub) {
      return accountWhere(db, 'google_sub', sub);
    },
    async createAccount(a) {
      const result = await db
        .prepare(
          'INSERT INTO accounts (id, email, password_hash, password_salt, google_sub, email_verified, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING',
        )
        .bind(
          a.id,
          a.email,
          a.passwordHash,
          a.passwordSalt,
          a.googleSub ?? null,
          a.emailVerified ? 1 : 0,
          a.createdAt,
        )
        .run();
      return (result.meta?.changes ?? 1) > 0;
    },
    async setPassword(accountId, hash, salt) {
      await db
        .prepare('UPDATE accounts SET password_hash = ?, password_salt = ? WHERE id = ?')
        .bind(hash, salt, accountId)
        .run();
    },
    async setEmailVerified(accountId) {
      await db.prepare('UPDATE accounts SET email_verified = 1 WHERE id = ?').bind(accountId).run();
    },
    async linkGoogle(accountId, sub, dropPassword) {
      await db
        .prepare(
          dropPassword
            ? 'UPDATE accounts SET google_sub = ?, email_verified = 1, password_hash = NULL, password_salt = NULL WHERE id = ?'
            : 'UPDATE accounts SET google_sub = ?, email_verified = 1 WHERE id = ?',
        )
        .bind(sub, accountId)
        .run();
    },
    async deleteAccount(accountId) {
      await db.prepare('DELETE FROM accounts WHERE id = ?').bind(accountId).run();
    },
    async deleteSessions(accountId, keepTokenHash = '') {
      await db
        .prepare('DELETE FROM sessions WHERE account_id = ? AND token_hash != ?')
        .bind(accountId, keepTokenHash)
        .run();
    },
    async createEmailToken(tokenHash, accountId, kind, expiresAt) {
      await db.batch([
        db
          .prepare('DELETE FROM email_tokens WHERE account_id = ? AND kind = ?')
          .bind(accountId, kind),
        db
          .prepare(
            'INSERT INTO email_tokens (token_hash, account_id, kind, expires_at) VALUES (?, ?, ?, ?)',
          )
          .bind(tokenHash, accountId, kind, expiresAt),
      ]);
    },
    async takeEmailToken(tokenHash, kind) {
      const r = await db
        .prepare(
          'SELECT account_id, expires_at FROM email_tokens WHERE token_hash = ? AND kind = ?',
        )
        .bind(tokenHash, kind)
        .first<{ account_id: string; expires_at: number }>();
      if (!r) return null;
      await db.prepare('DELETE FROM email_tokens WHERE token_hash = ?').bind(tokenHash).run();
      return { accountId: r.account_id, expiresAt: r.expires_at };
    },
    async createSession(tokenHash, accountId, expiresAt) {
      await db
        .prepare('INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)')
        .bind(tokenHash, accountId, expiresAt)
        .run();
    },
    async session(tokenHash) {
      const r = await db
        .prepare(
          'SELECT s.account_id, s.expires_at, a.email FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ?',
        )
        .bind(tokenHash)
        .first<{ account_id: string; expires_at: number; email: string }>();
      if (!r) return null;
      const row: SessionRow = { accountId: r.account_id, email: r.email, expiresAt: r.expires_at };
      return row;
    },
    async extendSession(tokenHash, expiresAt) {
      await db
        .prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?')
        .bind(expiresAt, tokenHash)
        .run();
    },
    async deleteSession(tokenHash) {
      await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    },
    async attempt(key) {
      const r = await db
        .prepare('SELECT count, window_start FROM attempts WHERE key = ?')
        .bind(key)
        .first<{ count: number; window_start: number }>();
      if (!r) return null;
      const row: AttemptRow = { count: r.count, windowStart: r.window_start };
      return row;
    },
    async setAttempt(key, row) {
      await db
        .prepare(
          'INSERT INTO attempts (key, count, window_start) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET count = excluded.count, window_start = excluded.window_start',
        )
        .bind(key, row.count, row.windowStart)
        .run();
    },
    async clearAttempt(key) {
      await db.prepare('DELETE FROM attempts WHERE key = ?').bind(key).run();
    },
    async lastUpdatedAt(accountId) {
      const r = await db
        .prepare(
          'SELECT MAX(m) AS last FROM (SELECT MAX(updated_at) AS m FROM players WHERE account_id = ? UNION ALL SELECT MAX(updated_at) AS m FROM progress WHERE account_id = ?)',
        )
        .bind(accountId, accountId)
        .first<{ last: number | null }>();
      return r?.last ?? 0;
    },
    async players(accountId, since = 0) {
      const { results } = await db
        .prepare(
          'SELECT id, name, avatar, deleted, updated_at FROM players WHERE account_id = ? AND updated_at >= ? ORDER BY updated_at, id',
        )
        .bind(accountId, since)
        .all<PlayerDb>();
      return results.map(toPlayer);
    },
    async progress(accountId, since = 0) {
      const { results } = await db
        .prepare(
          'SELECT player_id, data, updated_at FROM progress WHERE account_id = ? AND updated_at >= ? ORDER BY updated_at, player_id',
        )
        .bind(accountId, since)
        .all<ProgressDb>();
      return results.map(toProgress);
    },
    async applySync(accountId, writes: SyncWrites) {
      const statements = [];
      for (const p of writes.players) {
        statements.push(
          db
            .prepare(
              'INSERT INTO players (account_id, id, name, avatar, deleted, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(account_id, id) DO UPDATE SET deleted = excluded.deleted, updated_at = excluded.updated_at',
            )
            .bind(accountId, p.id, p.name, p.avatar, p.deleted ? 1 : 0, p.updatedAt),
        );
      }
      for (const id of writes.deleteProgress) {
        statements.push(
          db
            .prepare('DELETE FROM progress WHERE account_id = ? AND player_id = ?')
            .bind(accountId, id),
        );
      }
      for (const p of writes.progress) {
        statements.push(
          db
            .prepare(
              'INSERT INTO progress (account_id, player_id, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(account_id, player_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
            )
            .bind(accountId, p.playerId, p.data, p.updatedAt),
        );
      }
      if (statements.length > 0) await db.batch(statements);
    },
  };
}
