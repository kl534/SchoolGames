/**
 * Dev-only hooks of the jet-ski ride, for checking every state by eye. A game's own `dev.ts`
 * reads them with `devOptions()`; they compile away in production builds.
 *
 * - `?tricks=backflip,submarine` tricks come in this order and then repeat (names from TRICK_IDS);
 *   the launcher, the tier and the points follow each trick's tier.
 * - `?streak=6` start the run with this streak (0 to 20).
 * - `?skis=1` start with that many jet skis (1 to 3).
 * - `?lab=<trickId>:<clear|fail>` the trick lab: skips the preview and the questions and plays
 *   that one animation over and over, with its camera swing and the HUD hidden except the comic
 *   word. `?lab=respawn` loops the lifeguard boat. `&at=<seconds>` freezes it at that stunt time.
 * - `?lab=<megaId>:<0-3>` the same lab for a Mega course, with that many questions right (it
 *   clears that many elements and wipes out on the next); `&at=` freezes it likewise.
 * - `?world=<id>` start the run in that world (`lagoon`, `dino`, `harbour`, `iceberg`, `volcano`, `reef`, `candy`).
 * - `?cycles=<n>` start as if the rider had already been through all the worlds n times (a later
 *   lap, so a higher top speed).
 * - `?mega=1` the first turn is this world's Mega Stunt.
 */
import {
  MEGA_IDS,
  SKIS,
  TRICK_IDS,
  WORLD_ORDER,
  type MegaId,
  type Outcome,
  type Passed,
  type TrickId,
  type WorldId,
} from './rules';

export const MAX_DEV_STREAK = 20;
export const MAX_DEV_CYCLES = 20;

/** The trick lab plays one trick; the respawn lab loops the boat; the Mega lab plays a course. */
export type Lab =
  { trick: TrickId; outcome: Outcome } | { respawn: true } | { mega: MegaId; passed: Passed };

export interface RideDev {
  tricks: TrickId[];
  streak: number | null;
  skis: number | null;
  lab: Lab | null;
  at: number | null;
  world: WorldId | null;
  mega: boolean;
  cycles: number;
}

const isTrick = (name: string): name is TrickId => (TRICK_IDS as readonly string[]).includes(name);
const isMega = (name: string): name is MegaId => (MEGA_IDS as readonly string[]).includes(name);
const isWorld = (name: string): name is WorldId =>
  (WORLD_ORDER as readonly string[]).includes(name);

/** Reads the dev hooks from a query string; anything malformed is ignored. */
export function parseRideDev(search: string): RideDev {
  const q = new URLSearchParams(search);
  const tricks = (q.get('tricks') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(isTrick);
  const num = (name: string) => {
    const value = q.get(name);
    return value === null || value.trim() === '' ? Number.NaN : Number(value);
  };
  const streak = num('streak');
  const skis = num('skis');
  let lab: Lab | null = null;
  const raw = q.get('lab') ?? '';
  const [trick, outcome, extra] = raw.split(':');
  if (raw === 'respawn') lab = { respawn: true };
  else if (
    isTrick(trick ?? '') &&
    (outcome === 'clear' || outcome === 'fail') &&
    extra === undefined
  ) {
    lab = { trick: trick as TrickId, outcome };
  } else if (isMega(trick ?? '') && /^[0-3]$/.test(outcome ?? '') && extra === undefined) {
    lab = { mega: trick as MegaId, passed: Number(outcome) as Passed };
  }
  const at = num('at');
  const cycles = num('cycles');
  return {
    tricks,
    streak: Number.isInteger(streak) && streak >= 0 && streak <= MAX_DEV_STREAK ? streak : null,
    skis: Number.isInteger(skis) && skis >= 1 && skis <= SKIS ? skis : null,
    lab,
    at: Number.isFinite(at) ? at : null,
    world: isWorld(q.get('world') ?? '') ? (q.get('world') as WorldId) : null,
    mega: q.get('mega') === '1',
    cycles: Number.isInteger(cycles) && cycles >= 0 && cycles <= MAX_DEV_CYCLES ? cycles : 0,
  };
}
