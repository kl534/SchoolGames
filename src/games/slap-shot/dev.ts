/**
 * Dev-only hooks for checking every kind of play by eye. They compile away in production builds.
 *
 * - `?play=<PlayKind>`: when the answer allows that play, use it (it overrides the speed band and
 *   the random numbers).
 * - `?puck=faceoff-neutral|us-our-end|us-neutral|us-their-end|them-their-end|them-neutral|them-our-end`:
 *   the starting puck.
 * - `?start=p2|p3|ot|so`, `?score=2-1`, `?clock=40` (seconds left in the period).
 * - `?auto=right|wrong`: answer the first question 0.3 s after its reading ends (0.3 answer
 *   seconds), so a play runs without taps.
 * - `?at=1.1`: freeze that first play at that script time (everything stops; the HUD stays).
 * - `?variant=a|b`: which build-up every play uses.
 */
import type { Variant } from './plays';
import {
  OT_SECONDS,
  OVERTIME_PERIOD,
  PERIOD_SECONDS,
  SHOOTOUT_PERIOD,
  newGame,
  type GameState,
  type PlayKind,
  type Puck,
} from './rules';

const PUCKS: Record<string, Puck> = {
  'faceoff-neutral': { kind: 'faceoff', zone: 'neutral' },
  'us-our-end': { kind: 'held', side: 'us', zone: 'our-end' },
  'us-neutral': { kind: 'held', side: 'us', zone: 'neutral' },
  'us-their-end': { kind: 'held', side: 'us', zone: 'their-end' },
  'them-their-end': { kind: 'held', side: 'them', zone: 'their-end' },
  'them-neutral': { kind: 'held', side: 'them', zone: 'neutral' },
  'them-our-end': { kind: 'held', side: 'them', zone: 'our-end' },
};

const query = () => new URLSearchParams(location.search);

/** The play the address asks for, if this is a dev build. */
export function forcedPlay(): PlayKind | null {
  if (!import.meta.env.DEV) return null;
  return (query().get('play') as PlayKind | null) ?? null;
}

/** `?auto=right|wrong` in a dev build. */
export function autoAnswer(): 'right' | 'wrong' | null {
  if (!import.meta.env.DEV) return null;
  const auto = query().get('auto');
  return auto === 'right' || auto === 'wrong' ? auto : null;
}

/** `?at=1.1`: the script time to freeze the first play at (dev build). */
export function freezeAt(): number | null {
  if (!import.meta.env.DEV) return null;
  const at = query().get('at');
  return at === null || Number.isNaN(Number(at)) ? null : Number(at);
}

/** `?variant=a|b` in a dev build: which build-up every play uses. */
export function forcedVariant(): Variant | null {
  if (!import.meta.env.DEV) return null;
  const variant = query().get('variant');
  return variant === 'a' || variant === 'b' ? variant : null;
}

/** A new game, started the way the address asks for (in a dev build). */
export function devGame(): GameState {
  const state = newGame();
  if (!import.meta.env.DEV) return state;
  const q = query();
  const start = q.get('start');
  const period =
    start === 'p2'
      ? 2
      : start === 'p3'
        ? 3
        : start === 'ot'
          ? OVERTIME_PERIOD
          : start === 'so'
            ? SHOOTOUT_PERIOD
            : 1;
  const score = /^(\d+)-(\d+)$/.exec(q.get('score') ?? '');
  const clockAsked = Number(q.get('clock'));
  const puck = PUCKS[q.get('puck') ?? ''] ?? state.puck;
  return {
    ...state,
    period,
    clock:
      q.get('clock') !== null && !Number.isNaN(clockAsked)
        ? clockAsked
        : period === OVERTIME_PERIOD
          ? OT_SECONDS
          : period === SHOOTOUT_PERIOD
            ? 0
            : PERIOD_SECONDS,
    puck,
    us: score ? Number(score[1]) : 0,
    them: score ? Number(score[2]) : 0,
    shootout: period === SHOOTOUT_PERIOD ? { round: 1, us: 0, them: 0, shooter: 'us' } : null,
  };
}
