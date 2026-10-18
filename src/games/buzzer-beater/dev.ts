/**
 * Dev-only hooks for checking every kind of play by eye. They compile away in production builds.
 *
 * - `?play=<name>` forces the next plays of that kind whenever the answer allows it: `three`,
 *   `dunk`, `jumper`, `layup` and `and-one` (a dunk that is an and-one) on our right answers;
 *   `rebound` (our misses always get the rebound) on our wrong answers; `block`, `steal` and
 *   `forced-miss` on our right answers on defense; `them-two`, `them-three` and `them-and-one` on
 *   wrong answers on defense.
 * - `?start=half2` or `?start=ot` starts in that period, with the ball as the period starts.
 * - `?score=12-10` sets the starting points.
 * - `?fire=1` starts with the streak at 3.
 */
import { firstBall, newGame, ON_FIRE_AFTER, type GameState, type Shot, type Stop } from './rules';

export type ForcedPlay =
  | { kind: 'shot'; shot: Shot; andOne: boolean }
  | { kind: 'rebound' }
  | { kind: 'stop'; stop: Stop }
  | { kind: 'them'; shot: 'two' | 'three' | 'and-one' };

/** The play the address asks for, if this is a dev build and it names one. */
export function forcedPlay(): ForcedPlay | null {
  if (!import.meta.env.DEV) return null;
  const asked = new URLSearchParams(location.search).get('play');
  switch (asked) {
    case 'three':
    case 'dunk':
    case 'jumper':
    case 'layup':
      return { kind: 'shot', shot: asked, andOne: false };
    case 'and-one':
      return { kind: 'shot', shot: 'dunk', andOne: true };
    case 'rebound':
      return { kind: 'rebound' };
    case 'block':
    case 'steal':
    case 'forced-miss':
      return { kind: 'stop', stop: asked };
    case 'them-two':
      return { kind: 'them', shot: 'two' };
    case 'them-three':
      return { kind: 'them', shot: 'three' };
    case 'them-and-one':
      return { kind: 'them', shot: 'and-one' };
    default:
      return null;
  }
}

/** A new game, started the way the address asks for (in a dev build): period, score, fire. */
export function devGame(): GameState {
  const state = newGame();
  if (!import.meta.env.DEV) return state;
  const q = new URLSearchParams(location.search);
  const start = q.get('start');
  const period = start === 'half2' ? 2 : start === 'ot' ? 3 : 1;
  const score = /^(\d+)-(\d+)$/.exec(q.get('score') ?? '');
  return {
    ...state,
    period,
    ball: firstBall(period),
    us: score ? Number(score[1]) : 0,
    them: score ? Number(score[2]) : 0,
    streak: q.get('fire') === '1' ? ON_FIRE_AFTER : 0,
  };
}
