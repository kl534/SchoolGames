import { AVATARS, MAX_NAME_LENGTH, normalizeProgress } from '../../src/shared/progress';
import type { PlayerProgress } from '../../src/shared/progress';
import { mergeProgress } from '../../src/shared/sync/merge';
import type {
  AccountInfo,
  ApiErrorCode,
  AuthResponse,
  ServerConfig,
  SyncRequest,
  SyncResponse,
  WirePlayer,
} from '../../src/shared/sync/protocol';
import {
  ATTEMPT_LIMIT,
  ATTEMPT_WINDOW_MS,
  IP_LIMIT,
  MAX_BODY_BYTES,
  MAX_PLAYERS,
  MAX_PROGRESS_BYTES,
  SESSION_DAYS,
  hashPassword,
  newToken,
  normalizeEmail,
  sha256Hex,
  validEmail,
  validPassword,
  verifyPassword,
} from './auth';
import { fetchGoogleJwks, verifyGoogleToken, type FetchJwks } from './google';
import {
  RESET_SUBJECT,
  VERIFY_SUBJECT,
  emailEnabled,
  resetBody,
  sendMail,
  verifyBody,
  type MailEnv,
  type Mailer,
} from './mail';
import type { D1Like, EmailTokenKind, PlayerRow, ProgressRow, Repo } from './repo';

export interface Env extends MailEnv {
  DB: D1Like;
  /** The Google OAuth client id; Google sign-in is off without it. */
  GOOGLE_CLIENT_ID?: string;
  /** Comma-separated origins that may call the API from a browser. */
  ALLOWED_ORIGINS: string;
  SITE_URL: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60_000;
const VERIFY_DAYS = 3;
const RESET_HOURS = 1;
/** Resend mails per account per hour, and forgot-password mails per email per hour. */
export const RESEND_LIMIT = 3;
export const FORGOT_LIMIT = 3;
const PLAYER_ID = /^[a-z0-9]{4,40}$/;

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
  ) {
    super(code);
  }
}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin');
  const allowed = env.ALLOWED_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function reply(body: unknown, status: number, cors: Record<string, string>): Response {
  if (status === 204) return new Response(null, { status, headers: cors });
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function readJson(req: Request): Promise<unknown> {
  const declared = Number(req.headers.get('Content-Length'));
  if (declared > MAX_BODY_BYTES) throw new HttpError(413, 'too_large');
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) throw new HttpError(413, 'too_large');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'invalid');
  }
}

/** Things the Worker reaches outside itself for; tests pass fakes. */
export interface Deps {
  mailer?: Mailer;
  fetchJwks?: FetchJwks;
}

interface Ctx {
  req: Request;
  env: Env;
  repo: Repo;
  now: () => number;
  mailer: Mailer;
  fetchJwks: FetchJwks;
}

/** Builds the handler for every request. `now` and `deps` are injected so tests can fake them. */
export async function handle(
  req: Request,
  env: Env,
  repo: Repo,
  now: () => number = Date.now,
  deps: Deps = {},
): Promise<Response> {
  const cors = corsHeaders(req, env);
  if (req.method === 'OPTIONS') return reply(null, 204, cors);
  try {
    const ctx: Ctx = {
      req,
      env,
      repo,
      now,
      mailer: deps.mailer ?? ((to, subject, text) => sendMail(env, to, subject, text)),
      fetchJwks: deps.fetchJwks ?? fetchGoogleJwks,
    };
    return await route(ctx, cors);
  } catch (e) {
    if (e instanceof HttpError) return reply({ error: e.code }, e.status, cors);
    // Never log bodies, emails or tokens: say nothing about the cause.
    return reply({ error: 'invalid' }, 500, cors);
  }
}

async function route(ctx: Ctx, cors: Record<string, string>): Promise<Response> {
  const { req, env, repo, now } = ctx;
  const path = new URL(req.url).pathname;
  const key = `${req.method} ${path}`;

  if (key === 'GET /config') {
    const config: ServerConfig = {
      emailEnabled: emailEnabled(env),
      googleClientId: env.GOOGLE_CLIENT_ID || null,
    };
    return reply(config, 200, cors);
  }
  if (key === 'POST /auth/signup') return reply(await signUp(ctx), 200, cors);
  if (key === 'POST /auth/login') return reply(await logIn(ctx), 200, cors);
  if (key === 'POST /auth/google') return reply(await googleSignIn(ctx), 200, cors);
  if (key === 'POST /auth/verify') {
    await verifyEmail(ctx);
    return reply(null, 204, cors);
  }
  if (key === 'POST /auth/forgot') {
    await forgotPassword(ctx);
    return reply(null, 204, cors);
  }
  if (key === 'POST /auth/reset') {
    await resetPassword(ctx);
    return reply(null, 204, cors);
  }

  const authed = [
    'POST /auth/logout',
    'GET /me',
    'POST /sync',
    'GET /account',
    'POST /auth/resend',
    'POST /auth/password',
    'DELETE /account',
  ];
  if (!authed.includes(key)) return reply({ error: 'invalid' }, 404, cors);

  const token = /^Bearer (.+)$/.exec(req.headers.get('Authorization') ?? '')?.[1];
  const tokenHash = token ? await sha256Hex(token) : '';
  const session = tokenHash ? await repo.session(tokenHash) : null;
  if (!session || session.expiresAt <= now()) {
    if (session) await repo.deleteSession(tokenHash);
    throw new HttpError(401, 'unauthorized');
  }
  await repo.extendSession(tokenHash, now() + SESSION_DAYS * DAY_MS);

  if (key === 'POST /auth/logout') {
    await repo.deleteSession(tokenHash);
    return reply(null, 204, cors);
  }
  if (key === 'GET /me') return reply({ email: session.email }, 200, cors);
  if (key === 'GET /account') return reply(await accountInfo(repo, session.accountId), 200, cors);
  if (key === 'POST /auth/resend') {
    await resendVerification(ctx, session.accountId);
    return reply(null, 204, cors);
  }
  if (key === 'POST /auth/password') {
    await changePassword(ctx, session.accountId, tokenHash);
    return reply(null, 204, cors);
  }
  if (key === 'DELETE /account') {
    await deleteAccount(ctx, session.accountId, session.email);
    return reply(null, 204, cors);
  }
  return reply(await sync(req, repo, now, session.accountId), 200, cors);
}

// ---------- Accounts ----------

async function credentials(req: Request): Promise<{ email: string; password: string }> {
  const body = await readJson(req);
  if (!isObject(body) || typeof body.email !== 'string' || typeof body.password !== 'string') {
    throw new HttpError(400, 'invalid');
  }
  return { email: body.email, password: body.password };
}

async function startSession(repo: Repo, now: () => number, accountId: string, email: string) {
  const token = newToken();
  await repo.createSession(await sha256Hex(token), accountId, now() + SESSION_DAYS * DAY_MS);
  const auth: AuthResponse = { token, email };
  return auth;
}

async function signUp(ctx: Ctx): Promise<AuthResponse> {
  const { req, env, repo, now } = ctx;
  const { email, password } = await credentials(req);
  if (!validEmail(email) || !validPassword(password)) throw new HttpError(400, 'invalid');
  const normal = normalizeEmail(email);
  if (await repo.accountByEmail(normal)) throw new HttpError(409, 'exists');
  const { hash, salt } = await hashPassword(password);
  const id = crypto.randomUUID();
  const created = await repo.createAccount({
    id,
    email: normal,
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: now(),
  });
  if (!created) throw new HttpError(409, 'exists');
  if (emailEnabled(env)) await mailVerification(ctx, id, normal);
  return startSession(repo, now, id, normal);
}

/** True when this key has used up its failed tries in the current window. */
async function limited(repo: Repo, key: string, limit: number, now: number): Promise<boolean> {
  const row = await repo.attempt(key);
  return row !== null && now - row.windowStart < ATTEMPT_WINDOW_MS && row.count >= limit;
}

async function countFailure(repo: Repo, key: string, now: number): Promise<void> {
  const row = await repo.attempt(key);
  if (!row || now - row.windowStart >= ATTEMPT_WINDOW_MS) {
    await repo.setAttempt(key, { count: 1, windowStart: now });
  } else {
    await repo.setAttempt(key, { count: row.count + 1, windowStart: row.windowStart });
  }
}

async function logIn({ req, repo, now }: Ctx): Promise<AuthResponse> {
  const { email, password } = await credentials(req);
  const normal = normalizeEmail(email);
  const emailKey = `login:${normal}`;
  const ipKey = `ip:${req.headers.get('CF-Connecting-IP') ?? 'unknown'}`;
  const t = now();
  if (
    (await limited(repo, emailKey, ATTEMPT_LIMIT, t)) ||
    (await limited(repo, ipKey, IP_LIMIT, t))
  ) {
    throw new HttpError(429, 'rate_limited');
  }

  const account = await repo.accountByEmail(normal);
  let ok = false;
  if (account?.passwordHash && account.passwordSalt) {
    ok = await verifyPassword(password, account.passwordHash, account.passwordSalt);
  } else {
    // Same work for an unknown email, so the answer takes as long either way.
    await hashPassword(password);
  }
  if (!account || !ok) {
    await countFailure(repo, emailKey, t);
    await countFailure(repo, ipKey, t);
    throw new HttpError(401, 'bad_credentials');
  }
  await repo.clearAttempt(emailKey);
  return startSession(repo, now, account.id, account.email);
}

// ---------- Mail, Google, password and account tools ----------

async function body(req: Request): Promise<Json> {
  const data = await readJson(req);
  if (!isObject(data)) throw new HttpError(400, 'invalid');
  return data;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Counts one use of a limited action; false when the key has used up its `limit` in the window. */
async function allow(
  repo: Repo,
  key: string,
  limit: number,
  windowMs: number,
  t: number,
): Promise<boolean> {
  const row = await repo.attempt(key);
  if (!row || t - row.windowStart >= windowMs) {
    await repo.setAttempt(key, { count: 1, windowStart: t });
    return true;
  }
  if (row.count >= limit) return false;
  await repo.setAttempt(key, { count: row.count + 1, windowStart: row.windowStart });
  return true;
}

/** Makes a single-use token for the account (replacing an older one) and returns it. */
async function issueToken(
  repo: Repo,
  accountId: string,
  kind: EmailTokenKind,
  expiresAt: number,
): Promise<string> {
  const token = newToken();
  await repo.createEmailToken(await sha256Hex(token), accountId, kind, expiresAt);
  return token;
}

const linkTo = (env: Env, param: string, token: string) =>
  `${env.SITE_URL}?${param}=${encodeURIComponent(token)}`;

/** Mails fail quietly: a mail outage must not break sign-up, and an error could leak an address. */
async function safeMail(mailer: Mailer, to: string, subject: string, text: string) {
  try {
    await mailer(to, subject, text);
  } catch {
    // Nothing to say.
  }
}

async function mailVerification(ctx: Ctx, accountId: string, email: string): Promise<void> {
  const { env, repo, now, mailer } = ctx;
  const token = await issueToken(repo, accountId, 'verify', now() + VERIFY_DAYS * DAY_MS);
  await safeMail(mailer, email, VERIFY_SUBJECT, verifyBody(linkTo(env, 'verify', token)));
}

async function verifyEmail({ req, repo, now }: Ctx): Promise<void> {
  const token = str((await body(req)).token);
  const found = token ? await repo.takeEmailToken(await sha256Hex(token), 'verify') : null;
  if (!found || found.expiresAt <= now()) throw new HttpError(400, 'invalid');
  await repo.setEmailVerified(found.accountId);
}

async function resendVerification(ctx: Ctx, accountId: string): Promise<void> {
  const { env, repo, now } = ctx;
  if (!emailEnabled(env)) throw new HttpError(400, 'invalid');
  const account = await repo.accountById(accountId);
  if (!account || account.emailVerified) return;
  if (!(await allow(repo, `resend:${accountId}`, RESEND_LIMIT, HOUR_MS, now()))) {
    throw new HttpError(429, 'rate_limited');
  }
  await mailVerification(ctx, accountId, account.email);
}

async function forgotPassword({ req, env, repo, now, mailer }: Ctx): Promise<void> {
  const email = normalizeEmail(str((await body(req)).email));
  // The answer is the same whether or not the account exists, so this reveals nothing.
  if (!emailEnabled(env) || !validEmail(email)) return;
  const account = await repo.accountByEmail(email);
  if (!account?.passwordHash) return;
  if (!(await allow(repo, `forgot:${email}`, FORGOT_LIMIT, HOUR_MS, now()))) return;
  const token = await issueToken(repo, account.id, 'reset', now() + RESET_HOURS * HOUR_MS);
  await safeMail(mailer, email, RESET_SUBJECT, resetBody(linkTo(env, 'reset', token)));
}

async function resetPassword({ req, repo, now }: Ctx): Promise<void> {
  const data = await body(req);
  const token = str(data.token);
  const password = str(data.password);
  if (!validPassword(password)) throw new HttpError(400, 'invalid');
  const found = token ? await repo.takeEmailToken(await sha256Hex(token), 'reset') : null;
  if (!found || found.expiresAt <= now()) throw new HttpError(400, 'invalid');
  const { hash, salt } = await hashPassword(password);
  await repo.setPassword(found.accountId, hash, salt);
  // They own the mailbox, and every device signed in with the old password is signed out.
  await repo.setEmailVerified(found.accountId);
  await repo.deleteSessions(found.accountId);
}

async function accountInfo(repo: Repo, accountId: string): Promise<AccountInfo> {
  const account = await repo.accountById(accountId);
  if (!account) throw new HttpError(401, 'unauthorized');
  return {
    email: account.email,
    emailVerified: account.emailVerified,
    hasPassword: account.passwordHash !== null,
  };
}

async function changePassword(ctx: Ctx, accountId: string, tokenHash: string): Promise<void> {
  const { req, repo, now } = ctx;
  const data = await body(req);
  const current = str(data.current);
  const next = str(data.next);
  const key = `password:${accountId}`;
  const t = now();
  if (await limited(repo, key, ATTEMPT_LIMIT, t)) throw new HttpError(429, 'rate_limited');
  if (!validPassword(next)) throw new HttpError(400, 'invalid');
  const account = await repo.accountById(accountId);
  if (!account) throw new HttpError(401, 'unauthorized');
  // A Google-only account has no password to confirm.
  if (account.passwordHash && account.passwordSalt) {
    if (!(await verifyPassword(current, account.passwordHash, account.passwordSalt))) {
      await countFailure(repo, key, t);
      throw new HttpError(401, 'bad_credentials');
    }
  }
  await repo.clearAttempt(key);
  const { hash, salt } = await hashPassword(next);
  await repo.setPassword(accountId, hash, salt);
  await repo.deleteSessions(accountId, tokenHash);
}

async function deleteAccount(ctx: Ctx, accountId: string, email: string): Promise<void> {
  const confirm = normalizeEmail(str((await body(ctx.req)).confirmEmail));
  if (confirm !== email) throw new HttpError(400, 'invalid');
  await ctx.repo.deleteAccount(accountId);
}

async function googleSignIn({ req, env, repo, now, fetchJwks }: Ctx): Promise<AuthResponse> {
  const credential = str((await body(req)).credential);
  if (!env.GOOGLE_CLIENT_ID || !credential) throw new HttpError(400, 'invalid');
  const identity = await verifyGoogleToken(credential, env.GOOGLE_CLIENT_ID, fetchJwks, now());
  if (!identity) throw new HttpError(401, 'bad_credentials');
  const email = normalizeEmail(identity.email);

  const known = await repo.accountByGoogleSub(identity.sub);
  if (known) return startSession(repo, now, known.id, known.email);

  const sameEmail = await repo.accountByEmail(email);
  if (sameEmail) {
    if (sameEmail.googleSub) throw new HttpError(401, 'bad_credentials');
    // Google vouches for this mailbox. A password account nobody confirmed may belong to a
    // squatter, so its password stops working and its sessions end.
    const squatter = !sameEmail.emailVerified;
    await repo.linkGoogle(sameEmail.id, identity.sub, squatter);
    if (squatter) await repo.deleteSessions(sameEmail.id);
    return startSession(repo, now, sameEmail.id, sameEmail.email);
  }

  const id = crypto.randomUUID();
  const created = await repo.createAccount({
    id,
    email,
    passwordHash: null,
    passwordSalt: null,
    googleSub: identity.sub,
    emailVerified: true,
    createdAt: now(),
  });
  if (!created) throw new HttpError(409, 'exists');
  return startSession(repo, now, id, email);
}

// ---------- Sync ----------

function validStat(v: unknown): boolean {
  return (
    isObject(v) &&
    isNumber(v.correct) &&
    isNumber(v.wrong) &&
    isNumber(v.streak) &&
    isNumber(v.lastSeen)
  );
}

function validNested(v: unknown, leaf: (x: unknown) => boolean): boolean {
  if (v === undefined) return true;
  if (!isObject(v)) return false;
  return Object.values(v).every((inner) => isObject(inner) && Object.values(inner).every(leaf));
}

/** Checks the shape of a pushed progress object, so merging it cannot throw. */
function validProgress(v: unknown): v is Partial<PlayerProgress> {
  if (!isObject(v)) return false;
  return (
    validNested(v.facts, validStat) &&
    validNested(v.best, isNumber) &&
    validNested(v.highScores, isNumber) &&
    validNested(v.ladders, isNumber) &&
    (v.pathLevelsOpen === undefined ||
      (isObject(v.pathLevelsOpen) && Object.values(v.pathLevelsOpen).every(isNumber))) &&
    (v.levelsOpen === undefined || isNumber(v.levelsOpen)) &&
    (v.levelsVersion === undefined || isNumber(v.levelsVersion)) &&
    (v.savedAt === undefined || isNumber(v.savedAt)) &&
    (v.homePath === undefined || typeof v.homePath === 'string')
  );
}

function parseSyncRequest(body: unknown): SyncRequest {
  if (
    !isObject(body) ||
    !isNumber(body.since) ||
    body.since < 0 ||
    !Array.isArray(body.players) ||
    !isObject(body.progress)
  ) {
    throw new HttpError(400, 'invalid');
  }
  const players: WirePlayer[] = [];
  for (const p of body.players) {
    if (!isObject(p) || typeof p.id !== 'string' || !PLAYER_ID.test(p.id)) {
      throw new HttpError(400, 'invalid');
    }
    if (p.deleted === true) {
      players.push({ id: p.id, name: '', avatar: '', deleted: true });
      continue;
    }
    const name = typeof p.name === 'string' ? p.name.trim() : '';
    if (!name || name.length > MAX_NAME_LENGTH) throw new HttpError(400, 'invalid');
    if (typeof p.avatar !== 'string' || !AVATARS.includes(p.avatar)) {
      throw new HttpError(400, 'invalid');
    }
    players.push({ id: p.id, name, avatar: p.avatar });
  }
  const progress: Record<string, PlayerProgress> = {};
  for (const [id, data] of Object.entries(body.progress)) {
    if (!PLAYER_ID.test(id) || !validProgress(data)) throw new HttpError(400, 'invalid');
    if (JSON.stringify(data).length > MAX_PROGRESS_BYTES) throw new HttpError(413, 'too_large');
    progress[id] = normalizeProgress(data);
  }
  return { since: body.since, players, progress };
}

const wirePlayer = (p: PlayerRow): WirePlayer => ({
  id: p.id,
  name: p.name,
  avatar: p.avatar,
  ...(p.deleted ? { deleted: true as const } : {}),
});

async function sync(
  req: Request,
  repo: Repo,
  now: () => number,
  accountId: string,
): Promise<SyncResponse> {
  const request = parseSyncRequest(await readJson(req));
  const stamp = Math.max(now(), (await repo.lastUpdatedAt(accountId)) + 1);

  // Players: add new ones, never rename, and a removed player never comes back.
  const state = new Map<string, PlayerRow>();
  for (const p of await repo.players(accountId)) state.set(p.id, p);
  const playerWrites: PlayerRow[] = [];
  const deleteProgress: string[] = [];
  for (const incoming of request.players) {
    const have = state.get(incoming.id);
    if (incoming.deleted) {
      if (have?.deleted) continue;
      const row: PlayerRow = {
        id: incoming.id,
        name: have?.name ?? 'Removed',
        avatar: have?.avatar ?? AVATARS[0],
        deleted: true,
        updatedAt: stamp,
      };
      state.set(row.id, row);
      playerWrites.push(row);
      deleteProgress.push(row.id);
    } else if (!have) {
      const row: PlayerRow = {
        id: incoming.id,
        name: incoming.name,
        avatar: incoming.avatar,
        deleted: false,
        updatedAt: stamp,
      };
      state.set(row.id, row);
      playerWrites.push(row);
    }
  }
  if ([...state.values()].filter((p) => !p.deleted).length > MAX_PLAYERS) {
    throw new HttpError(400, 'limit');
  }

  // Progress: merge into what is stored, for live players only.
  const stored = new Map<string, ProgressRow>();
  for (const row of await repo.progress(accountId)) stored.set(row.playerId, row);
  const progressWrites: ProgressRow[] = [];
  for (const [id, incoming] of Object.entries(request.progress)) {
    if (!state.get(id) || state.get(id)?.deleted) continue;
    const old = stored.get(id);
    const merged = old
      ? mergeProgress(normalizeProgress(JSON.parse(old.data) as Partial<PlayerProgress>), incoming)
      : incoming;
    const data = JSON.stringify(merged);
    if (data.length > MAX_PROGRESS_BYTES) throw new HttpError(413, 'too_large');
    progressWrites.push({ playerId: id, data, updatedAt: stamp });
  }

  await repo.applySync(accountId, {
    players: playerWrites,
    deleteProgress,
    progress: progressWrites,
  });

  const players = (await repo.players(accountId, request.since)).map(wirePlayer);
  const progress: Record<string, PlayerProgress> = {};
  for (const row of await repo.progress(accountId, request.since)) {
    progress[row.playerId] = normalizeProgress(JSON.parse(row.data) as Partial<PlayerProgress>);
  }
  return { cursor: await repo.lastUpdatedAt(accountId), players, progress };
}
