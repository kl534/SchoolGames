/**
 * Dev-only hooks for checking the shootout by eye. They compile away in production builds.
 *
 * - `?first=us|them`: who shoots first (instead of the coin toss).
 * - `?shots=110-101`: our results, a dash, their results (`1` goal, `0` miss). The counts must
 *   fit the order (the side that shoots first has the same or one more shot) or they are ignored.
 * - `?band=flashy|solid|plain`: the style of every shot, whatever the answer speed.
 * - `?auto=right|wrong`: answer the first question 0.3 s after its reading ends, and skip the
 *   intro and the shooter banners.
 * - `?at=1.7`: freeze the first shot at that script time; the HUD stays.
 */
import type { Band } from '../../shared/hockey/band';
import { newShootout, nextShot, shootoutDecided, type Side, type State } from './rules';

const query = () => new URLSearchParams(location.search);

/** `?first=us|them` in a dev build. */
export function forcedFirst(): Side | null {
  if (!import.meta.env.DEV) return null;
  const first = query().get('first');
  return first === 'us' || first === 'them' ? first : null;
}

/** `?band=flashy|solid|plain` in a dev build. */
export function forcedBand(): Band | null {
  if (!import.meta.env.DEV) return null;
  const band = query().get('band');
  return band === 'flashy' || band === 'solid' || band === 'plain' ? band : null;
}

/** `?auto=right|wrong` in a dev build. */
export function autoAnswer(): 'right' | 'wrong' | null {
  if (!import.meta.env.DEV) return null;
  const auto = query().get('auto');
  return auto === 'right' || auto === 'wrong' ? auto : null;
}

/** `?at=1.7`: the script time to freeze the first shot at (dev build). */
export function freezeAt(): number | null {
  if (!import.meta.env.DEV) return null;
  const at = query().get('at');
  return at === null || Number.isNaN(Number(at)) ? null : Number(at);
}

/** True when `?shots=` asks for a shootout already under way (dev build). */
export function hasDevShots(): boolean {
  return import.meta.env.DEV && /^[01]*-[01]*$/.test(query().get('shots') ?? '');
}

/**
 * The shootout as the address asks for it: `first` shoots first, and `?shots=` plays the shots
 * already taken. Anything that does not fit gives a fresh shootout.
 */
export function devShootout(first: Side): State {
  const fresh = newShootout(first);
  if (!import.meta.env.DEV) return fresh;
  const match = /^([01]*)-([01]*)$/.exec(query().get('shots') ?? '');
  if (!match) return fresh;
  const results: Record<Side, string> = { us: match[1], them: match[2] };
  const other: Side = first === 'us' ? 'them' : 'us';
  const extra = results[first].length - results[other].length;
  if (extra !== 0 && extra !== 1) return fresh;
  const taken: Record<Side, number> = { us: 0, them: 0 };
  let state = fresh;
  while (taken.us < results.us.length || taken.them < results.them.length) {
    const ns = nextShot(state);
    if (taken[ns.side] >= results[ns.side].length) return fresh;
    const scored = results[ns.side][taken[ns.side]++] === '1';
    const shot = { side: ns.side, role: ns.role, scored };
    state = {
      ...state,
      shots: [...state.shots, shot],
      us: state.us + (scored && ns.side === 'us' ? 1 : 0),
      them: state.them + (scored && ns.side === 'them' ? 1 : 0),
    };
    if (shootoutDecided(state)) return fresh;
  }
  return state;
}
