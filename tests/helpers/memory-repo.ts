import type {
  AccountRow,
  AttemptRow,
  EmailTokenKind,
  PlayerRow,
  ProgressRow,
  Repo,
  SessionRow,
} from '../../worker/src/repo';

/** An in-memory `Repo` for the Worker tests. `data` is exposed so tests can look inside. */
export function createMemoryRepo() {
  const accounts = new Map<string, AccountRow>();
  const sessions = new Map<string, { accountId: string; expiresAt: number }>();
  const emailTokens = new Map<
    string,
    { accountId: string; kind: EmailTokenKind; expiresAt: number }
  >();
  const attempts = new Map<string, AttemptRow>();
  const players = new Map<string, PlayerRow & { accountId: string }>();
  const progress = new Map<string, ProgressRow & { accountId: string }>();
  const rowKey = (accountId: string, id: string) => `${accountId}/${id}`;

  const repo: Repo = {
    async accountByEmail(email) {
      return [...accounts.values()].find((a) => a.email === email) ?? null;
    },
    async accountById(id) {
      return accounts.get(id) ?? null;
    },
    async accountByGoogleSub(sub) {
      return [...accounts.values()].find((a) => a.googleSub === sub) ?? null;
    },
    async createAccount(account) {
      if ([...accounts.values()].some((a) => a.email === account.email)) return false;
      accounts.set(account.id, {
        ...account,
        googleSub: account.googleSub ?? null,
        emailVerified: account.emailVerified ?? false,
      });
      return true;
    },
    async setPassword(accountId, hash, salt) {
      const a = accounts.get(accountId);
      if (a) Object.assign(a, { passwordHash: hash, passwordSalt: salt });
    },
    async setEmailVerified(accountId) {
      const a = accounts.get(accountId);
      if (a) a.emailVerified = true;
    },
    async linkGoogle(accountId, sub, dropPassword) {
      const a = accounts.get(accountId);
      if (!a) return;
      a.googleSub = sub;
      a.emailVerified = true;
      if (dropPassword) Object.assign(a, { passwordHash: null, passwordSalt: null });
    },
    async deleteAccount(accountId) {
      accounts.delete(accountId);
      for (const [k, s] of sessions) if (s.accountId === accountId) sessions.delete(k);
      for (const [k, t] of emailTokens) if (t.accountId === accountId) emailTokens.delete(k);
      for (const [k, p] of players) if (p.accountId === accountId) players.delete(k);
      for (const [k, p] of progress) if (p.accountId === accountId) progress.delete(k);
    },
    async deleteSessions(accountId, keepTokenHash = '') {
      for (const [k, s] of sessions) {
        if (s.accountId === accountId && k !== keepTokenHash) sessions.delete(k);
      }
    },
    async createEmailToken(tokenHash, accountId, kind, expiresAt) {
      for (const [k, t] of emailTokens) {
        if (t.accountId === accountId && t.kind === kind) emailTokens.delete(k);
      }
      emailTokens.set(tokenHash, { accountId, kind, expiresAt });
    },
    async takeEmailToken(tokenHash, kind) {
      const t = emailTokens.get(tokenHash);
      if (!t || t.kind !== kind) return null;
      emailTokens.delete(tokenHash);
      return { accountId: t.accountId, expiresAt: t.expiresAt };
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
  return { repo, accounts, sessions, emailTokens, attempts, players, progress };
}

export type MemoryRepo = ReturnType<typeof createMemoryRepo>;
