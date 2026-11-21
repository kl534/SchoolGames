/**
 * Dev-only hooks of Type Brawl, for checking every state by eye. With any hook in the URL nothing
 * is saved. They compile away in production builds.
 *
 * - `?level=<1-40>` play that level (open in memory; the keys of the levels before it count as learned).
 * - `?start=1` skip the level picker and the lesson. `?lesson=1` show the level's lesson even if seen.
 * - `?spk=<seconds>` start with this many seconds per key (0.9 to 2.5).
 * - `?chunk=<text>` every block is this text (`%20` for a space); the closing space is added.
 * - `?thugs=<1-3>` the size of the first scrap. `?kind=thug|bruiser` the kind of every thug; `kind=boss`
 *   makes the first fight the stage's boss scrap (`thugs=1` is the boss alone).
 * - `?stage=<1-6>` start at that stage, `?loop=<n>` after that many loops of the six. `?scrap=<1-4>` is the
 *   fight in the stage (4 is the boss).
 * - `?item=cola|pizza|star` an item of that type is on the street at the first fight and every drop is that type.
 * - `?win=dance` the first fight is skipped: the stage clears at once and the dance holds for ever
 *   (with `?at=<s>` it holds at that time; `?dance=<id>` is the shared hook).
 * - `?lock=<1-4>` the thug in that slot starts locked; `?typed=<n>` with it: n keys done.
 *   `?wrong=1` holds the red flash on the locked label and a ghost chunk on the health bar.
 * - `?hp=<1-100>` start with that health. `?ramp=<0-20>` start rampSteps.
 * - `?ring=<0-1>` the attacker's ring starts this full.
 * - `?freeze=1` the walk, thugs, rings and particles hold; keys still work.
 * - `?move=<id>` the hero always uses this move. `?at=<seconds>` the first move holds at that time.
 * - `?levelup=1` the first scrap clear passes the level.
 * - `?keys=<text>` (at most 12 characters, `%20` for a space) once the fight starts, these keys are
 *   typed in order.
 */
import { LEVEL_COUNT } from '../../shared/typing/course';
import { SPK_MAX, SPK_MIN } from '../../shared/typing/progress';
import {
  MAX_THUGS,
  MOVES_BY_CLASS,
  STAGES,
  STAGE_SCRAPS,
  type ItemType,
  type Kind,
  type MoveId,
} from './rules';

export interface BrawlDev {
  level: number | null;
  start: boolean;
  lesson: boolean;
  spk: number | null;
  chunk: string | null;
  thugs: number | null;
  kind: Kind | null;
  /** Start stage 1-6, after `loop` loops of the six; and the fight in it (1 to STAGE_SCRAPS + 1). */
  stage: number | null;
  loop: number | null;
  item: ItemType | null;
  win: boolean;
  lock: number | null;
  typed: number;
  wrong: boolean;
  hp: number | null;
  scrap: number | null;
  ramp: number | null;
  ring: number | null;
  freeze: boolean;
  move: MoveId | null;
  at: number | null;
  levelup: boolean;
  keys: string | null;
  /** Any hook is in the URL: nothing is saved. */
  hooked: boolean;
}

const HOOKS = [
  'level',
  'start',
  'lesson',
  'spk',
  'chunk',
  'thugs',
  'kind',
  'lock',
  'typed',
  'wrong',
  'hp',
  'scrap',
  'stage',
  'loop',
  'item',
  'win',
  'ramp',
  'ring',
  'freeze',
  'move',
  'at',
  'levelup',
  'keys',
];

const ALL_MOVES: string[] = Object.values(MOVES_BY_CLASS).flat();

/** Reads the dev hooks from a query string; anything malformed is ignored. */
export function parseDev(search: string): BrawlDev {
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
  const ring = num('ring');
  const at = num('at');
  const chunk = q.get('chunk') ?? '';
  const keys = q.get('keys') ?? '';
  const kind = q.get('kind');
  const move = q.get('move') ?? '';
  const item = q.get('item');
  return {
    level: intIn('level', 1, LEVEL_COUNT),
    start: q.get('start') === '1',
    lesson: q.get('lesson') === '1',
    spk: Number.isFinite(spk) && spk > 0 ? Math.min(Math.max(spk, SPK_MIN), SPK_MAX) : null,
    chunk: /^[\x20-\x7e]+$/.test(chunk) && chunk.trim().length > 0 ? chunk : null,
    thugs: intIn('thugs', 1, MAX_THUGS),
    kind: kind === 'thug' || kind === 'bruiser' || kind === 'boss' ? kind : null,
    stage: intIn('stage', 1, STAGES.length),
    loop: intIn('loop', 0, 20),
    item: item === 'cola' || item === 'pizza' || item === 'star' ? item : null,
    win: q.get('win') === 'dance',
    lock: intIn('lock', 1, 4),
    typed: Number.isInteger(typed) && typed > 0 ? typed : 0,
    wrong: q.get('wrong') === '1',
    hp: intIn('hp', 1, 100),
    scrap: intIn('scrap', 1, STAGE_SCRAPS + 1),
    ramp: intIn('ramp', 0, 20),
    ring: Number.isFinite(ring) && ring >= 0 && ring <= 1 ? ring : null,
    freeze: q.get('freeze') === '1',
    move: ALL_MOVES.includes(move) ? (move as MoveId) : null,
    at: Number.isFinite(at) && at >= 0 && at <= 10 ? at : null,
    levelup: q.get('levelup') === '1',
    keys: /^[\x20-\x7e]{1,12}$/.test(keys) ? keys : null,
    hooked: HOOKS.some((name) => q.has(name)),
  };
}

/** The dev hooks of this page, or null in a production build. */
export function devOptions(): BrawlDev | null {
  return import.meta.env.DEV ? parseDev(location.search) : null;
}
