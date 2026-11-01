/** The sync service URL this build was made with, or null when sync is not set up. */
export function syncUrl(): string | null {
  const raw = import.meta.env.VITE_SYNC_URL;
  const url = typeof raw === 'string' ? raw.trim().replace(/\/+$/, '') : '';
  return url === '' ? null : url;
}

/** The dev-only `?sync=<state>` value (see the menu's dev hooks); null outside dev. */
export function devSyncState(search: string = globalThis.location?.search ?? ''): string | null {
  if (!import.meta.env.DEV) return null;
  return new URLSearchParams(search).get('sync');
}

/** True when the sync UI should exist: a sync URL, or (in dev) a `?sync=<state>` preview. */
export function syncEnabled(search?: string): boolean {
  return syncUrl() !== null || devSyncState(search) !== null;
}
