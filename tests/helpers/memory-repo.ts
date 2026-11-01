import type {
  AccountRow,
  AttemptRow,
  PlayerRow,
  ProgressRow,
  Repo,
  SessionRow,
} from '../../worker/src/repo';

/** An in-memory `Repo` for the Worker tests. `data` is exposed so tests can look inside. */
export function createMemoryRepo() {
  const accounts = new Map<string, AccountRow>();
  const sessions = new Map<string, { accountId: string; expiresAt: number }>();
  const attempts = new Map<string, AttemptRow>();
  const players = new Map<string, PlayerRow & { accountId: string }>();
  const progress = new Map<string, ProgressRow & { accountId: string }>();
  const rowKey = (accountId: string, id: string) => `${accountId}/${id}`;

  const repo: Repo = {
    async accountByEmail(email) {
      return [...accounts.values()].find((a) => a.email === email) ?? null;
    },
    async createAccount(account) {
      if ([...accounts.values()].some((a) => a.email === account.email)) return false;
      accounts.set(account.id, account);
      return true;
    },
    async createSession(tokenHash, accountId, expiresAt) {
      sessions.set(tokenHash, { accountId, expiresAt });
    },
    async session(tokenHash) {
      const s = sessions.get(tokenHash);
      const account = s && accounts.get(s.accountId);
      if (!s || !account) return null;
      const row: SessionRow = {
        accountId: s.accountId,
        email: account.email,
        expiresAt: s.expiresAt,
      };
      return row;
    },
    async extendSession(tokenHash, expiresAt) {
      const s = sessions.get(tokenHash);
      if (s) s.expiresAt = expiresAt;
    },
    async deleteSession(tokenHash) {
      sessions.delete(tokenHash);
    },
    async attempt(key) {
      return attempts.get(key) ?? null;
    },
    async setAttempt(key, row) {
      attempts.set(key, row);
    },
    async clearAttempt(key) {
      attempts.delete(key);
    },
    async lastUpdatedAt(accountId) {
      let last = 0;
      for (const p of players.values())
        if (p.accountId === accountId) last = Math.max(last, p.updatedAt);
      for (const p of progress.values())
        if (p.accountId === accountId) last = Math.max(last, p.updatedAt);
      return last;
    },
    async players(accountId, since = 0) {
      return [...players.values()]
        .filter((p) => p.accountId === accountId && p.updatedAt >= since)
        .map((p) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          deleted: p.deleted,
          updatedAt: p.updatedAt,
        }));
    },
    async progress(accountId, since = 0) {
      return [...progress.values()]
        .filter((p) => p.accountId === accountId && p.updatedAt >= since)
        .map((p) => ({ playerId: p.playerId, data: p.data, updatedAt: p.updatedAt }));
    },
    async applySync(accountId, writes) {
      for (const p of writes.players) {
        const key = rowKey(accountId, p.id);
        const old = players.get(key);
        players.set(
          key,
          old ? { ...old, deleted: p.deleted, updatedAt: p.updatedAt } : { ...p, accountId },
        );
      }
      for (const id of writes.deleteProgress) progress.delete(rowKey(accountId, id));
      for (const p of writes.progress)
        progress.set(rowKey(accountId, p.playerId), { ...p, accountId });
    },
  };
  return { repo, accounts, sessions, attempts, players, progress };
}

export type MemoryRepo = ReturnType<typeof createMemoryRepo>;
