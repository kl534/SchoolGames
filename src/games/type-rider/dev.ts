/**
 * Dev-only hooks of Type Rider, for checking every state by eye: all of the ride's (`tricks streak
 * skis lab at world mega`, see `src/shared/jetski/dev.ts`) and these. With any hook in the URL
 * nothing is saved. They compile away in production builds.
 *
 * - `?level=<1-40>` play that level (it is open in memory, and the keys of the levels before it
 *   count as learned).
 * - `?start=1` skip the level picker and the lesson.
 * - `?lesson=1` show the level's lesson even if the player has seen it (also with `start=1`).
 * - `?block=<text>` every block is this text (`%20` for a space).
 * - `?typed=<n>` the first block starts with its first n keys done.
 * - `?wrong=1` the first block holds the red flash on its current key.
 * - `?spk=<seconds>` start with this many seconds per key (0.25 to 2.5).
 * - `?clock=<seconds>` every block's clock is this long.
 * - `?levelup=1` the first block passes the level.
 */
import { parseRideDev, type RideDev } from '../../shared/jetski/dev';
import { LEVEL_COUNT } from '../../shared/typing/course';
import { SPK_MAX, SPK_MIN } from '../../shared/typing/progress';

export interface TypingDev extends RideDev {
  level: number | null;
  start: boolean;
  lesson: boolean;
  block: string | null;
  typed: number;
  wrong: boolean;
  spk: number | null;
  clock: number | null;
  levelup: boolean;
  /** Any hook (the ride's or these) is in the URL: nothing is saved. */
  hooked: boolean;
}

const HOOKS = [
  'tricks',
  'streak',
  'skis',
  'lab',
  'at',
  'world',
  'mega',
  'level',
  'start',
  'lesson',
  'block',
  'typed',
  'wrong',
  'spk',
  'clock',
  'levelup',
];

/** Reads the dev hooks from a query string; anything malformed is ignored. */
export function parseDev(search: string): TypingDev {
  const q = new URLSearchParams(search);
  const num = (name: string): number => {
    const value = q.get(name);
    return value === null || value.trim() === '' ? Number.NaN : Number(value);
  };
  const level = num('level');
  const typed = num('typed');
  const spk = num('spk');
  const clock = num('clock');
  const block = q.get('block') ?? '';
  return {
    ...parseRideDev(search),
    level: Number.isInteger(level) && level >= 1 && level <= LEVEL_COUNT ? level : null,
    start: q.get('start') === '1',
    lesson: q.get('lesson') === '1',
    block: /^[\x20-\x7e]+$/.test(block) ? block : null,
    typed: Number.isInteger(typed) && typed > 0 ? typed : 0,
    wrong: q.get('wrong') === '1',
    spk: Number.isFinite(spk) && spk > 0 ? Math.min(Math.max(spk, SPK_MIN), SPK_MAX) : null,
    clock: Number.isFinite(clock) && clock > 0 ? clock : null,
    levelup: q.get('levelup') === '1',
    hooked: HOOKS.some((name) => q.has(name)),
  };
}

/** The dev hooks of this page, or null in a production build. */
export function devOptions(): TypingDev | null {
  return import.meta.env.DEV ? parseDev(location.search) : null;
}
