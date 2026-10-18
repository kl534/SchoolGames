/**
 * Dev-only hooks for checking every state by eye. They compile away in production builds.
 *
 * - `?kinds=loop,ramp` the obstacles come in this order and then repeat (names from OBSTACLE_KINDS).
 * - `?mega=1` the first obstacle is a Mega Stunt.
 * - `?bikes=1` start with that many bikes (1 to 3).
 * - `?lab=<kind>:<clear|crash>:<0|1>` the stunt lab: skips the preview and the questions and plays
 *   that one stunt over and over on a looping road with the HUD hidden except the comic word.
 *   `&at=<seconds>` freezes the stunt at that time (props and effects included) for screenshots.
 *   `&nitro=1` shows a nitro run-up before the stunt.
 */
import { BIKES, OBSTACLE_KINDS, type ObstacleKind, type Outcome, type Variant } from './rules';

export interface LabStunt {
  kind: ObstacleKind;
  outcome: Outcome;
  variant: Variant;
}

export interface DevOptions {
  kinds: ObstacleKind[];
  mega: boolean;
  bikes: number | null;
  lab: LabStunt | null;
  at: number | null;
  nitro: boolean;
}

const isKind = (name: string): name is ObstacleKind =>
  (OBSTACLE_KINDS as readonly string[]).includes(name);

/** Reads the dev hooks from a query string; anything malformed is ignored. */
export function parseDev(search: string): DevOptions {
  const q = new URLSearchParams(search);
  const kinds = (q.get('kinds') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(isKind);
  const bikes = Number(q.get('bikes'));
  let lab: LabStunt | null = null;
  const [kind, outcome, variant] = (q.get('lab') ?? '').split(':');
  if (
    isKind(kind ?? '') &&
    (outcome === 'clear' || outcome === 'crash') &&
    (variant === '0' || variant === '1')
  ) {
    lab = { kind: kind as ObstacleKind, outcome, variant: Number(variant) as Variant };
  }
  const at = q.has('at') ? Number(q.get('at')) : Number.NaN;
  return {
    kinds,
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
