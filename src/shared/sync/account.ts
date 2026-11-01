import { deviceStore, readJson, writeJson, type KeyValueStore } from '../storage';

const ACCOUNT_KEY = 'sg:sync:account';
const CURSOR_KEY = 'sg:sync:cursor';
const NOTICE_KEY = 'sg:sync:notice';

export interface StoredAccount {
  email: string;
  token: string;
}

/** The signed-in account on this device, or null. */
export function getAccount(store: KeyValueStore = deviceStore()): StoredAccount | null {
  const data = readJson<Partial<StoredAccount> | null>(store, ACCOUNT_KEY, null);
  return data && typeof data.email === 'string' && typeof data.token === 'string'
    ? { email: data.email, token: data.token }
    : null;
}

export function setAccount(account: StoredAccount, store: KeyValueStore = deviceStore()): void {
  writeJson(store, ACCOUNT_KEY, account);
}

export function clearAccount(store: KeyValueStore = deviceStore()): void {
  store.removeItem(ACCOUNT_KEY);
}

/** The highest server `updatedAt` pulled so far; 0 when never. */
export function getCursor(store: KeyValueStore = deviceStore()): number {
  const value = readJson<unknown>(store, CURSOR_KEY, 0);
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

export function setCursor(cursor: number, store: KeyValueStore = deviceStore()): void {
  if (cursor > 0) writeJson(store, CURSOR_KEY, cursor);
  else store.removeItem(CURSOR_KEY);
}

export type SyncNotice = 'signed-out';

export function getNotice(store: KeyValueStore = deviceStore()): SyncNotice | null {
  return store.getItem(NOTICE_KEY) === 'signed-out' ? 'signed-out' : null;
}

export function setNotice(notice: SyncNotice, store: KeyValueStore = deviceStore()): void {
  store.setItem(NOTICE_KEY, notice);
}

export function clearNotice(store: KeyValueStore = deviceStore()): void {
  store.removeItem(NOTICE_KEY);
}
