import { WAY_KIND, type Way } from './ways';

/** `?picture=<way>|off` in a dev build: force that way for every miss, or turn the pictures off. */
export function devPicture(): Way | 'off' | null {
  if (!import.meta.env.DEV) return null;
  const value = new URLSearchParams(globalThis.location?.search ?? '').get('picture');
  if (value === 'off') return 'off';
  return value !== null && Object.hasOwn(WAY_KIND, value) ? (value as Way) : null;
}
