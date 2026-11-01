import { createProgressStore, type ProgressStore } from '../progress';
import { deviceStore, type KeyValueStore } from '../storage';
import { ApiError, createSyncApi, type SyncApi } from './api';
import {
  clearAccount,
  clearNotice,
  getAccount,
  getCursor,
  setAccount,
  setCursor,
  setNotice,
} from './account';
import { syncUrl } from './config';
import { mergeProgress } from './merge';
import type { SyncRequest, WirePlayer } from './protocol';

/** Wait this long after the last save before pushing. */
export const SYNC_DEBOUNCE_MS = 5000;
/** A `keepalive` request may carry at most about 64 KB, so use it only below this. */
export const KEEPALIVE_MAX_BYTES = 60_000;

/** The stores and API the engine works on; tests pass fakes, the app passes nothing. */
export interface SyncOptions {
  store?: KeyValueStore;
  progress?: ProgressStore;
  /** Null when this build has no sync URL; the engine then does nothing. */
  api?: SyncApi | null;
}

interface Resolved {
  store: KeyValueStore;
  progress: ProgressStore;
  api: SyncApi | null;
}

let defaultApi: SyncApi | null | undefined;

function resolve(options: SyncOptions): Resolved {
  const store = options.store ?? deviceStore();
  if (options.api === undefined && defaultApi === undefined) {
    const url = syncUrl();
    defaultApi = url ? createSyncApi(url) : null;
  }
  return {
    store,
    progress: options.progress ?? createProgressStore(store),
    api: options.api === undefined ? (defaultApi ?? null) : options.api,
  };
}

/** JSON with sorted keys, so two equal objects compare equal whatever order they were built in. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

/** One request at a time per device store. */
const inFlight = new WeakMap<KeyValueStore, Promise<boolean>>();

/** What to send for the waiting changes, and the `savedAt` each progress had when it was read. */
function buildRequest(r: Resolved, since: number) {
  const { dirty, removed } = r.progress.pending();
  const local = r.progress.listPlayers();
  const players: WirePlayer[] = [];
  const progress: SyncRequest['progress'] = {};
  const savedAt = new Map<string, number | undefined>();
  const sentDirty: string[] = [];
  for (const id of dirty) {
    const player = local.find((p) => p.id === id);
    if (!player) continue;
    const data = r.progress.load(id);
    players.push({ id, name: player.name, avatar: player.avatar });
    progress[id] = data;
    savedAt.set(id, data.savedAt);
    sentDirty.push(id);
  }
  for (const id of removed) players.push({ id, name: '', avatar: '', deleted: true });
  const request: SyncRequest = { since, players, progress };
  return { request, sentDirty, sentRemoved: removed, savedAt, empty: players.length === 0 };
}

/** The dirty ids whose progress was not saved again since it was read for a request. */
function stillSent(r: Resolved, ids: string[], savedAt: Map<string, number | undefined>) {
  return ids.filter((id) => r.progress.load(id).savedAt === savedAt.get(id));
}

async function runSync(r: Resolved): Promise<boolean> {
  const account = getAccount(r.store);
  if (!account || !r.api) return false;
  const sent = buildRequest(r, getCursor(r.store));
  let response;
  try {
    response = await r.api.sync(account.token, sent.request);
  } catch (e) {
    if (e instanceof ApiError && e.code === 'unauthorized') {
      // Keep the players and their `account` flags: signing in to the same account reuses the ids.
      clearAccount(r.store);
      setNotice('signed-out', r.store);
      return true;
    }
    return false;
  }

  let changed = false;
  const local = () => r.progress.listPlayers();

  const fresh = response.players.filter((p) => !p.deleted && !local().some((l) => l.id === p.id));
  if (fresh.length > 0) {
    r.progress.upsertAccountPlayers(
      fresh.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar })),
    );
    changed = true;
  }
  const gone: string[] = [];
  for (const p of response.players) {
    if (p.deleted && local().some((l) => l.id === p.id)) {
      r.progress.removePlayer(p.id);
      gone.push(p.id);
      changed = true;
    }
  }

  for (const [id, remote] of Object.entries(response.progress)) {
    if (!local().some((l) => l.id === id)) continue;
    const mine = r.progress.load(id);
    const merged = mergeProgress(mine, remote);
    if (canonical(merged) !== canonical(mine)) {
      r.progress.saveSynced(id, merged);
      changed = true;
    }
  }

  r.progress.clearPending(
    [...stillSent(r, sent.sentDirty, sent.savedAt), ...gone],
    [...sent.sentRemoved, ...gone],
  );
  setCursor(Math.max(response.cursor, getCursor(r.store)), r.store);
  return changed;
}

/**
 * Pulls and pushes (menu). Resolves true when something local changed (new or removed players,
 * newer progress, or a sign-out); never throws. A second call while one runs awaits the first.
 */
export function syncNow(options: SyncOptions = {}): Promise<boolean> {
  const r = resolve(options);
  const running = inFlight.get(r.store);
  if (running) return running;
  const promise = runSync(r)
    .catch(() => false)
    .finally(() => inFlight.delete(r.store));
  inFlight.set(r.store, promise);
  return promise;
}

/**
 * Pushes the waiting changes and ignores the answer (game pages): it neither moves the cursor nor
 * writes progress, so a game's in-memory progress is never overwritten. Returns true on success.
 */
export async function pushDirty(
  options: SyncOptions & { keepalive?: boolean } = {},
): Promise<boolean> {
  const r = resolve(options);
  const account = getAccount(r.store);
  if (!account || !r.api) return false;
  // A cursor beyond anything on the server makes the answer empty.
  const sent = buildRequest(r, Number.MAX_SAFE_INTEGER);
  if (sent.empty) return true;
  const small = JSON.stringify(sent.request).length < KEEPALIVE_MAX_BYTES;
  try {
    await r.api.sync(account.token, sent.request, { keepalive: options.keepalive && small });
  } catch {
    return false;
  }
  r.progress.clearPending(stillSent(r, sent.sentDirty, sent.savedAt), sent.sentRemoved);
  return true;
}

let timer: ReturnType<typeof setTimeout> | undefined;
let listening = false;

/** Pushes `SYNC_DEBOUNCE_MS` after the last call. Does nothing when not signed in. */
export function scheduleSync(options: SyncOptions = {}): void {
  const r = resolve(options);
  if (!getAccount(r.store)) return;
  if (!listening && typeof document !== 'undefined' && typeof window !== 'undefined') {
    listening = true;
    const flush = () => void pushDirty({ ...options, keepalive: true });
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }
  clearTimeout(timer);
  timer = setTimeout(() => void pushDirty(options), SYNC_DEBOUNCE_MS);
}

async function joinAccount(
  r: Resolved,
  auth: { token: string; email: string },
  options: SyncOptions,
): Promise<void> {
  setAccount({ email: auth.email, token: auth.token }, r.store);
  clearNotice(r.store);
  r.progress.markAccount('all');
  setCursor(0, r.store);
  // A failed first sync does not undo the sign-in: it retries on the next load.
  await syncNow(options);
}

/** Signs in and joins every local player to the account. Throws `ApiError` on a bad sign-in. */
export async function signIn(
  email: string,
  password: string,
  options: SyncOptions = {},
): Promise<void> {
  const r = resolve(options);
  if (!r.api) throw new ApiError('network');
  await joinAccount(r, await r.api.signIn(email, password), options);
}

/** Creates the account and joins every local player to it. Throws `ApiError` on failure. */
export async function signUp(
  email: string,
  password: string,
  options: SyncOptions = {},
): Promise<void> {
  const r = resolve(options);
  if (!r.api) throw new ApiError('network');
  await joinAccount(r, await r.api.signUp(email, password), options);
}

/** Signs out here: keep the players as local-only, or remove them. The logout call is best-effort. */
export async function signOut(
  { removeLocal }: { removeLocal: boolean },
  options: SyncOptions = {},
): Promise<void> {
  const r = resolve(options);
  const account = getAccount(r.store);
  if (account && r.api) {
    try {
      await r.api.signOut(account.token);
    } catch {
      // Best effort: the token expires on its own.
    }
  }
  r.progress.releaseAccount(removeLocal);
  clearAccount(r.store);
  setCursor(0, r.store);
  clearNotice(r.store);
}
