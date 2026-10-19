/**
 * Dev-only hooks for checking every state by eye. They compile away in production builds.
 *
 * - `?kinds=loop,ramp` the obstacles come in this order and then repeat (names from OBSTACLE_KINDS).
 * - `?megas=triple-loop,...` the Mega courses come in this order and then repeat (names from MEGA_IDS).
 * - `?mega=1` the first obstacle is a Mega Stunt.
 * - `?bikes=1` start with that many bikes (1 to 3).
 * - `?lab=<kind>:<clear|crash>:<0|1>` the stunt lab: skips the preview and the questions and plays
 *   that one stunt over and over on a looping road with the HUD hidden except the comic word.
 *   `?lab=<megaId>:<0-3>` does the same for a Mega course, as if that many questions were right.
 *   `&at=<seconds>` freezes the stunt at that time (props and effects included) for screenshots.
 *   `&nitro=1` shows a nitro run-up before the stunt.
 */
import {
  BIKES,
  MEGA_IDS,
  OBSTACLE_KINDS,
  type MegaId,
  type ObstacleKind,
  type Outcome,
  type Passed,
  type Variant,
} from './rules';

export interface LabStunt {
  kind: ObstacleKind;
  outcome: Outcome;
  variant: Variant;
}

/** The lab for a Mega course: the stunt that follows `passed` right answers. */
export interface LabMega {
  mega: MegaId;
  passed: Passed;
}

export interface DevOptions {
  kinds: ObstacleKind[];
  megas: MegaId[];
  mega: boolean;
  bikes: number | null;
  lab: LabStunt | LabMega | null;
  at: number | null;
  nitro: boolean;
}

const isKind = (name: string): name is ObstacleKind =>
  (OBSTACLE_KINDS as readonly string[]).includes(name);

const isMegaId = (name: string): name is MegaId => (MEGA_IDS as readonly string[]).includes(name);

/** Reads the dev hooks from a query string; anything malformed is ignored. */
export function parseDev(search: string): DevOptions {
  const q = new URLSearchParams(search);
  const kinds = (q.get('kinds') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(isKind);
  const megas = (q.get('megas') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(isMegaId);
  const bikes = Number(q.get('bikes'));
  let lab: LabStunt | LabMega | null = null;
  const [kind, outcome, variant] = (q.get('lab') ?? '').split(':');
  if (
    isKind(kind ?? '') &&
    (outcome === 'clear' || outcome === 'crash') &&
    (variant === '0' || variant === '1')
  ) {
    lab = { kind: kind as ObstacleKind, outcome, variant: Number(variant) as Variant };
  } else if (
    isMegaId(kind ?? '') &&
    (outcome === '0' || outcome === '1' || outcome === '2' || outcome === '3') &&
    variant === undefined
  ) {
    lab = { mega: kind as MegaId, passed: Number(outcome) as Passed };
  }
  const at = q.has('at') ? Number(q.get('at')) : Number.NaN;
  return {
    kinds,
    megas,
    mega: q.get('mega') === '1',
    bikes: Number.isInteger(bikes) && bikes >= 1 && bikes <= BIKES ? bikes : null,
    lab,
    at: Number.isFinite(at) ? at : null,
    nitro: q.get('nitro') === '1',
  };
}

/** The dev hooks of this page, or null in a production build. */
export function devOptions(): DevOptions | null {
  return import.meta.env.DEV ? parseDev(location.search) : null;
}
