/**
 * Dev-only hooks for checking every state by eye. They compile away in production builds.
 *
 * - `?rolls=10,7,3,9,0` starts mid-game with those rolls, if they are a valid game so far. When
 *   the next ball is not on a fresh rack, only the first `standing` pins (by number) are racked.
 * - `?leave=7,10` starts at frame 1, ball 2, with only those pins standing (the first roll is
 *   10 - count). For checking spares and splits.
 * - `?drift=max` makes every right answer drift MAX_DRIFT (the side is still random); `?drift=0`
 *   makes none drift.
 * - `?friends=1` plays the friends' reaction shot after every ball.
 */
import { MAX_DRIFT } from './aim';
import { PIN_IDS, type PinId } from './geometry';
import { isSplit, isValidRolls, position } from './rules';

export interface DevStart {
  rolls: number[];
  /** The pins standing for the next ball. */
  rack: PinId[];
  /** Whether the ball before left a split (for a "split picked up" call). */
  splitBefore: boolean;
}

const params = () => new URLSearchParams(location.search);

const numbers = (text: string | null): number[] =>
  (text ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
    .map(Number);

/** The game to start with: the address's rolls or leave, or a fresh game. */
export function devStart(): DevStart {
  const fresh: DevStart = { rolls: [], rack: [...PIN_IDS], splitBefore: false };
  if (!import.meta.env.DEV) return fresh;
  const q = params();
  const leave = numbers(q.get('leave')).filter((n): n is PinId => PIN_IDS.includes(n as PinId));
  if (q.has('leave') && leave.length > 0) {
    const standing = [...new Set(leave)].sort((a, b) => a - b);
    return { rolls: [10 - standing.length], rack: standing, splitBefore: isSplit(standing) };
  }
  if (q.has('rolls')) {
    const rolls = numbers(q.get('rolls'));
    if (rolls.length > 0 && isValidRolls(rolls)) {
      const where = position(rolls);
      return {
        rolls,
        rack: where.over ? [] : PIN_IDS.slice(0, where.standing),
        splitBefore: false,
      };
    }
  }
  return fresh;
}

/** The drift every right answer gets, if the address forces one. */
export function devDrift(): number | null {
  if (!import.meta.env.DEV) return null;
  const drift = params().get('drift');
  if (drift === 'max') return MAX_DRIFT;
  if (drift === '0') return 0;
  return null;
}

/** Whether the friends' shot plays after every ball. */
export function devFriends(): boolean {
  return import.meta.env.DEV && params().get('friends') === '1';
}
