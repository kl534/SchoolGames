/**
 * Dev-only hooks of Recess Race, for checking every state by eye. With any hook in the URL
 * nothing is saved. They compile away in production builds.
 *
 * - `?level=<1-40>` play that level (open in memory; the keys of the levels before it count as learned).
 * - `?start=1` skip the level picker and the lesson. `?lesson=1` show the level's lesson even if seen.
 * - `?spk=<seconds>` start with this many seconds per key (0.25 to 2.5).
 * - `?heat=<n>` start at heat n (its pace).
 * - `?block=<text>` every block is this text (`%20` for a space). `?typed=<n>` the first block starts
 *   n keys in. `?wrong=1` the first block holds the red flash on its current key.
 * - `?count=1|2|3` hold the countdown on "On your marks" / "Get set" / "GO!".
 * - `?at=<0-100>` the player starts that many metres on and each rival at `at × factor` (to 99).
 *   `?wpm=<n>` the player's rate starts at n/12 keys a second.
 * - `?freeze=1` the race starts at once (no countdown) and nobody moves; keys still work.
 * - `?stumble=1` / `?faceplant=1` the player holds that state.
 * - `?podium=<1-3>` skip the race: the heat ends at once with the player at that place. With
 *   `?win=dance` (place 1) the dance holds for ever; `?dance=<id>` is shared. `?card=1` shows the card at once.
 * - `?out=<4-10>` skip the race: the heat ends at once with that place (the out ending).
 * - `?keys=<text>` at GO these keys (at most 12) are typed in order, 0.15 s apart.
 * - `?levelup=1` the first block passes the level.
 */
import { LEVEL_COUNT } from '../../shared/typing/course';
import { SPK_MAX, SPK_MIN } from '../../shared/typing/progress';

export interface RecessDev {
  level: number | null;
  start: boolean;
  lesson: boolean;
  spk: number | null;
  heat: number | null;
  block: string | null;
  typed: number;
  wrong: boolean;
  count: 1 | 2 | 3 | null;
  at: number | null;
  wpm: number | null;
  freeze: boolean;
  stumble: boolean;
  faceplant: boolean;
  podium: 1 | 2 | 3 | null;
  win: boolean;
  card: boolean;
  out: number | null;
  keys: string | null;
  levelup: boolean;
  /** Any hook is in the URL: nothing is saved. */
  hooked: boolean;
}

const HOOKS = [
  'level',
  'start',
  'lesson',
  'spk',
  'heat',
  'block',
  'typed',
  'wrong',
  'count',
  'at',
  'wpm',
  'freeze',
  'stumble',
  'faceplant',
  'podium',
  'win',
  'card',
  'out',
  'keys',
  'levelup',
  'dance',
];

const MAX_HEAT = 99;
const MAX_DEV_KEYS = 12;

/** Reads the dev hooks from a query string; anything malformed is ignored. */
export function parseDev(search: string): RecessDev {
  const q = new URLSearchParams(search);
  const num = (name: string): number => {
    const value = q.get(name);
    return value === null || value.trim() === '' ? Number.NaN : Number(value);
  };
  const int = (name: string, low: number, high: number): number | null => {
    const n = num(name);
    return Number.isInteger(n) && n >= low && n <= high ? n : null;
  };
  const text = (name: string, max: number): string | null => {
    const value = q.get(name) ?? '';
    return /^[\x20-\x7e]+$/.test(value) ? value.slice(0, max) : null;
  };
  const spk = num('spk');
  const at = num('at');
  const wpm = num('wpm');
  const typed = num('typed');
  return {
    level: int('level', 1, LEVEL_COUNT),
    start: q.get('start') === '1',
    lesson: q.get('lesson') === '1',
    spk: Number.isFinite(spk) && spk > 0 ? Math.min(Math.max(spk, SPK_MIN), SPK_MAX) : null,
    heat: int('heat', 1, MAX_HEAT),
    block: text('block', 200),
    typed: Number.isInteger(typed) && typed > 0 ? typed : 0,
    wrong: q.get('wrong') === '1',
    count: int('count', 1, 3) as 1 | 2 | 3 | null,
    at: Number.isFinite(at) && at >= 0 ? Math.min(at, 100) : null,
    wpm: Number.isFinite(wpm) && wpm > 0 ? Math.min(wpm, 200) : null,
    freeze: q.get('freeze') === '1',
    stumble: q.get('stumble') === '1',
    faceplant: q.get('faceplant') === '1',
    podium: int('podium', 1, 3) as 1 | 2 | 3 | null,
    win: q.get('win') === 'dance',
    card: q.get('card') === '1',
    out: int('out', 4, 10),
    keys: text('keys', MAX_DEV_KEYS),
    levelup: q.get('levelup') === '1',
    hooked: HOOKS.some((name) => q.has(name)),
  };
}

/** The dev hooks of this page, or null in a production build. */
export function devOptions(): RecessDev | null {
  return import.meta.env.DEV ? parseDev(location.search) : null;
}
