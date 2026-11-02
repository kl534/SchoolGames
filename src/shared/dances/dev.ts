import { DANCES, pickDance, type DanceId } from './index';

/** `?dance=<id>` in a dev build: that dance instead of a random one. */
export function devDance(search: string = globalThis.location?.search ?? ''): DanceId | null {
  if (!import.meta.env.DEV) return null;
  const value = new URLSearchParams(search).get('dance');
  return DANCES.find((id) => id === value) ?? null;
}

/** The dance for this win: the dev one if asked, else a random one. Call once at the win. */
export function chooseDance(): DanceId {
  return devDance() ?? pickDance();
}
