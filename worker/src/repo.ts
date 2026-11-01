/** What the Worker needs from its database. `d1.ts` implements it on D1; tests use memory. */

export interface AccountRow {
  id: string;
  email: string;
  passwordHash: string | null;
  passwordSalt: string | null;
  createdAt: number;
  googleSub: string | null;
  emailVerified: boolean;
}

/** What `createAccount` takes: Google sign-ins also set `googleSub` and `emailVerified`. */
export type NewAccount = Omit<AccountRow, 'googleSub' | 'emailVerified'> &
  Partial<Pick<AccountRow, 'googleSub' | 'emailVerified'>>;

export type EmailTokenKind = 'verify' | 'reset';

export interface SessionRow {
  accountId: string;
  email: string;
  expiresAt: number;
}

export interface AttemptRow {
  count: number;
  windowStart: number;
}

export interface PlayerRow {
  id: string;
  name: string;
  avatar: string;
  deleted: boolean;
  updatedAt: number;
}

export interface ProgressRow {
  playerId: string;
  /** The progress JSON. */
  data: string;
  updatedAt: number;
}

/** Everything one sync writes; applied all or nothing. */
export interface SyncWrites {
  /** Inserted, or replaced when the id exists. */
  players: PlayerRow[];
  /** Ids whose progress row is deleted (players that were removed). */
  deleteProgress: string[];
  progress: ProgressRow[];
}

export interface Repo {
  accountByEmail(email: string): Promise<AccountRow | null>;
  accountById(id: string): Promise<AccountRow | null>;
  accountByGoogleSub(sub: string): Promise<AccountRow | null>;
  /** False when the email is already taken. */
  createAccount(account: NewAccount): Promise<boolean>;
  setPassword(accountId: string, hash: string, salt: string): Promise<void>;
  setEmailVerified(accountId: string): Promise<void>;
  /** Links a Google id, marks the email verified and, when `dropPassword`, clears the password. */
  linkGoogle(accountId: string, sub: string, dropPassword: boolean): Promise<void>;
  /** Deletes the account and, by cascade, its sessions, tokens, players and progress. */
  deleteAccount(accountId: string): Promise<void>;
  /** Deletes every session of the account except `keepTokenHash`. */
  deleteSessions(accountId: string, keepTokenHash?: string): Promise<void>;
  /** Replaces any older token of this kind for the account. */
  createEmailToken(
    tokenHash: string,
    accountId: string,
    kind: EmailTokenKind,
    expiresAt: number,
  ): Promise<void>;
  /** Returns the token's account and deletes it (single use); null when unknown or another kind. */
  takeEmailToken(
    tokenHash: string,
    kind: EmailTokenKind,
  ): Promise<{ accountId: string; expiresAt: number } | null>;
  createSession(tokenHash: string, accountId: string, expiresAt: number): Promise<void>;
  session(tokenHash: string): Promise<SessionRow | null>;
  extendSession(tokenHash: string, expiresAt: number): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;
  attempt(key: string): Promise<AttemptRow | null>;
  setAttempt(key: string, row: AttemptRow): Promise<void>;
  clearAttempt(key: string): Promise<void>;
  /** The highest `updated_at` over the account's players and progress; 0 when none. */
  lastUpdatedAt(accountId: string): Promise<number>;
  players(accountId: string, since?: number): Promise<PlayerRow[]>;
  progress(accountId: string, since?: number): Promise<ProgressRow[]>;
  applySync(accountId: string, writes: SyncWrites): Promise<void>;
}

/** The small part of the D1 API used here (own types, so no Cloudflare typings are needed). */
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta?: { changes?: number } }>;
}

export interface D1Like {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown[]>;
}
