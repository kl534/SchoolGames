/**
 * Dev-only hooks for checking every state by eye. They compile away in production builds.
 *
 * - `?tricks=backflip,submarine` tricks come in this order and then repeat (names from TRICK_IDS);
 *   the launcher, the tier and the points follow each trick's tier.
 * - `?streak=6` start the run with this streak (0 to 20).
 * - `?skis=1` start with that many jet skis (1 to 3).
 * - `?lab=<trickId>:<clear|fail>` the trick lab: skips the preview and the questions and plays
 *   that one animation over and over, with its camera swing and the HUD hidden except the comic
 *   word. `?lab=respawn` loops the lifeguard boat. `&at=<seconds>` freezes it at that stunt time.
 */
import { SKIS, TRICK_IDS, type Outcome, type TrickId } from './rules';

export const MAX_DEV_STREAK = 20;

/** The trick lab plays one trick; the respawn lab loops the boat. */
export type Lab = { trick: TrickId; outcome: Outcome } | { respawn: true };

export interface DevOptions {
  tricks: TrickId[];
  streak: number | null;
  skis: number | null;
  lab: Lab | null;
  at: number | null;
}

const isTrick = (name: string): name is TrickId => (TRICK_IDS as readonly string[]).includes(name);

/** Reads the dev hooks from a query string; anything malformed is ignored. */
export function parseDev(search: string): DevOptions {
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
  }
  const at = num('at');
  return {
    tricks,
    streak: Number.isInteger(streak) && streak >= 0 && streak <= MAX_DEV_STREAK ? streak : null,
    skis: Number.isInteger(skis) && skis >= 1 && skis <= SKIS ? skis : null,
    lab,
    at: Number.isFinite(at) ? at : null,
  };
}

/** The dev hooks of this page, or null in a production build. */
export function devOptions(): DevOptions | null {
  return import.meta.env.DEV ? parseDev(location.search) : null;
}
