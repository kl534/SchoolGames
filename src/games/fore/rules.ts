/** Golf scoring, the stored score and every line the announcer says. Pure: no DOM, no three.js. */
import { centreX, HOLES, surfaceAt, type Hole } from './course';
import type { Lie, Quality, Result } from './shot';

export const STROKE_CAP = 7;

export interface HoleState {
  strokes: number;
  penalties: number;
  lie: Lie;
  at: { x: number; z: number };
  holed: boolean;
}

export function startHole(hole: Hole): HoleState {
  return { strokes: 0, penalties: 0, lie: 'tee', at: { x: centreX(hole, 0), z: 0 }, holed: false };
}

export function afterShot(state: HoleState, hole: Hole, result: Result): HoleState {
  const next: HoleState = { ...state, strokes: state.strokes + 1 };
  if (result.kind === 'holed') {
    next.holed = true;
    next.at = { ...hole.pin };
    next.lie = 'green';
  } else if (result.kind === 'water') {
    next.penalties = state.penalties + 1;
    next.at = { ...result.drop };
    next.lie = surfaceAt(hole, result.drop.x, result.drop.z);
  } else {
    next.at = { ...result.at };
    next.lie = result.surface;
  }
  return next;
}

/** Strokes plus penalties, picked up at the cap. */
export function holeScore(state: HoleState): number {
  return Math.min(state.strokes + state.penalties, STROKE_CAP);
}

export function holeOver(state: HoleState): boolean {
  return state.holed || state.strokes + state.penalties >= STROKE_CAP;
}

export const vsPar = (strokes: number, par: number): number => strokes - par;

export function totalVsPar(scores: readonly number[], pars: readonly number[]): number {
  let total = 0;
  scores.forEach((s, i) => (total += s - pars[i]));
  return total;
}

/** The name of a hole's result: `score` is strokes plus penalties. */
export function nameFor(score: number, par: number, holed: boolean): string {
  if (!holed) return 'Pick up';
  if (score === 1) return 'Hole in one';
  const rel = score - par;
  if (rel <= -3) return 'Albatross';
  if (rel === -2) return 'Eagle';
  if (rel === -1) return 'Birdie';
  if (rel === 0) return 'Par';
  if (rel === 1) return 'Bogey';
  if (rel === 2) return 'Double bogey';
  if (rel === 3) return 'Triple bogey';
  return `+${rel}`;
}

/** Strokes against par as text: `E`, `+5`, `-2`. */
export function relText(rel: number): string {
  if (rel === 0) return 'E';
  return rel > 0 ? `+${rel}` : `-${-rel}`;
}

/** The high score store only keeps bigger-is-better numbers, so a round is kept as 100 - rel. */
export const storedFor = (rel: number): number => 100 - rel;
export const relFromStored = (stored: number): number => 100 - stored;

/** 'You shot 41, 5 over par.' */
export function roundOutcome(total: number, rel: number): string {
  if (rel === 0) return `You shot ${total}, level with par.`;
  return `You shot ${total}, ${Math.abs(rel)} ${rel > 0 ? 'over' : 'under'} par.`;
}

// ---------- Spoken lines ----------

export type CallKind =
  'fairway' | 'rough' | 'sand' | 'green' | 'water' | 'holed' | 'puttGood' | 'puttMiss' | 'duff';

const SHOT_CALLS: Record<CallKind, string> = {
  fairway: 'Fairway!',
  rough: 'In the rough.',
  sand: 'Bunker.',
  green: 'On the green!',
  water: 'Splash!',
  holed: 'In the hole!',
  puttGood: 'Nice putt.',
  puttMiss: 'Missed it.',
  duff: 'Duffed it.',
};

export const shotCall = (kind: CallKind): string => SHOT_CALLS[kind];

/** Which call a finished shot gets. */
export function callKindFor(result: Result, quality: Quality, putt: boolean): CallKind {
  if (result.kind === 'holed') return 'holed';
  if (quality === 'duff') return putt ? 'puttMiss' : 'duff';
  if (putt) return 'puttGood';
  if (result.kind === 'water') return 'water';
  return result.surface === 'tree' ? 'rough' : result.surface;
}

/** The small pill after a shot: where the ball is. */
export function pillFor(result: Result): string {
  if (result.kind === 'holed') return 'In the hole';
  if (result.kind === 'water') return 'Water +1';
  if (result.tree !== undefined) return 'Hit a tree';
  const names = {
    fairway: 'Fairway',
    rough: 'Rough',
    sand: 'Sand',
    green: 'Green',
    water: 'Water +1',
    tree: 'Rough',
  };
  return names[result.surface];
}

export type Reaction = 'idle' | 'cheer' | 'groan';

/**
 * What the caddie does after a shot. `name` is the `nameFor` of the hole when this shot ended it
 * (else null). A hole in the water or a duff groans; holing out, a birdie or better, or a full
 * shot onto the green cheers; a bogey or worse groans; anything else is nothing special.
 */
export function reactionFor(
  result: Result,
  name: string | null,
  how: { quality?: Quality; putt?: boolean } = {},
): Reaction {
  if (result.kind === 'water' || how.quality === 'duff') return 'groan';
  if (name) {
    if (name === 'Par') return result.kind === 'holed' ? 'cheer' : 'idle';
    const bad = ['Bogey', 'Double bogey', 'Triple bogey', 'Pick up'];
    if (bad.includes(name) || /^\+/.test(name)) return 'groan';
    return 'cheer';
  }
  if (result.kind === 'holed') return 'cheer';
  if (result.surface === 'green' && !how.putt) return 'cheer';
  return 'idle';
}

const HOLE_CALLS: Record<string, string> = {
  'Hole in one': 'Hole in one!',
  Albatross: 'Albatross!',
  Eagle: 'Eagle!',
  Birdie: 'Birdie!',
  Par: 'Par.',
  Bogey: 'Bogey.',
  'Double bogey': 'Double bogey.',
  'Triple bogey': 'Triple bogey.',
  'Pick up': 'Pick up.',
};

const OVER_PAR_CALL = 'Over par.';

/** The call for a `nameFor` name; four or more over is just "Over par." */
export const holeCall = (name: string): string => HOLE_CALLS[name] ?? OVER_PAR_CALL;

const WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** 'Hole one, par four.' for the hole at `index` (0 to 8). */
export function holeIntro(index: number): string {
  return `Hole ${WORDS[index]}, par ${WORDS[HOLES[index].par - 1]}.`;
}

export const LAST_HOLE_SPEECH = 'Last hole.';
export const ROUND_OVER_SPEECH = 'Round over.';
export const NEW_BEST_SPEECH = 'New best!';

/** Every line the announcer can say. */
export function allCallLines(): string[] {
  return [
    ...Object.values(SHOT_CALLS),
    ...Object.values(HOLE_CALLS),
    OVER_PAR_CALL,
    ...HOLES.map((_, i) => holeIntro(i)),
    LAST_HOLE_SPEECH,
    ROUND_OVER_SPEECH,
    NEW_BEST_SPEECH,
  ];
}
