/**
 * Dev-only hooks of Key Invaders, for checking every state by eye. With any hook in the URL nothing
 * is saved. They compile away in production builds.
 *
 * - `?level=<1-40>` play that level (it is open in memory, and the keys of the levels before it
 *   count as learned).
 * - `?start=1` skip the level picker and the lesson. `?lesson=1` show the level's lesson even if the
 *   player has seen it (also with `start=1`).
 * - `?chunk=<text>` every invader's chunk is this text (`%20` for a space); the `␣` is added.
 * - `?lock=<1-6>` the front invader of that column starts locked; `?typed=<n>` with it: n keys done.
 * - `?wrong=1` holds the red flash on the locked label.
 * - `?spk=<seconds>` start with this many seconds per key (0.25 to 2.5).
 * - `?wave=<n>` start at wave n (and its pace). `?lives=<1-3>` start with that many cannons.
 * - `?drop=<0-11>` wave 1 starts n drops down. `?left=<1-18>` the wave starts with only n invaders,
 *   bottom rows first, left to right.
 * - `?ufo=1` the UFO is up from the start (in the middle of the lane while frozen).
 * - `?freeze=1` the march, bombs, UFO and particles hold still; keys still work.
 * - `?levelup=1` the first kill passes the level.
 */
import { LEVEL_COUNT } from '../../shared/typing/course';
import { SPK_MAX, SPK_MIN } from '../../shared/typing/progress';
import { CANNONS, COLUMNS, ROWS } from './rules';
import { DROPS_TO_LAND } from './layout';

export interface InvadersDev {
  level: number | null;
  start: boolean;
  lesson: boolean;
  chunk: string | null;
  lock: number | null;
  typed: number;
  wrong: boolean;
  spk: number | null;
  wave: number | null;
  lives: number | null;
  drop: number | null;
  left: number | null;
  ufo: boolean;
  freeze: boolean;
  levelup: boolean;
  /** Any hook is in the URL: nothing is saved. */
  hooked: boolean;
}

const HOOKS = [
  'level',
  'start',
  'lesson',
  'chunk',
  'lock',
  'typed',
  'wrong',
  'spk',
  'wave',
  'lives',
  'drop',
  'left',
  'ufo',
  'freeze',
  'levelup',
];

/** Reads the dev hooks from a query string; anything malformed is ignored. */
export function parseDev(search: string): InvadersDev {
  const q = new URLSearchParams(search);
  const num = (name: string): number => {
    const value = q.get(name);
    return value === null || value.trim() === '' ? Number.NaN : Number(value);
  };
  const intIn = (name: string, low: number, high: number): number | null => {
    const n = num(name);
    return Number.isInteger(n) && n >= low && n <= high ? n : null;
  };
  const typed = num('typed');
  const spk = num('spk');
  const chunk = q.get('chunk') ?? '';
  return {
    level: intIn('level', 1, LEVEL_COUNT),
    start: q.get('start') === '1',
    lesson: q.get('lesson') === '1',
    chunk: /^[\x20-\x7e]+$/.test(chunk) && chunk.trim().length > 0 ? chunk : null,
    lock: intIn('lock', 1, COLUMNS),
    typed: Number.isInteger(typed) && typed > 0 ? typed : 0,
    wrong: q.get('wrong') === '1',
    spk: Number.isFinite(spk) && spk > 0 ? Math.min(Math.max(spk, SPK_MIN), SPK_MAX) : null,
    wave: intIn('wave', 1, 999),
    lives: intIn('lives', 1, CANNONS),
    drop: intIn('drop', 0, DROPS_TO_LAND - 1),
    left: intIn('left', 1, COLUMNS * ROWS),
    ufo: q.get('ufo') === '1',
    freeze: q.get('freeze') === '1',
    levelup: q.get('levelup') === '1',
    hooked: HOOKS.some((name) => q.has(name)),
  };
}

/** The dev hooks of this page, or null in a production build. */
export function devOptions(): InvadersDev | null {
  return import.meta.env.DEV ? parseDev(location.search) : null;
}
