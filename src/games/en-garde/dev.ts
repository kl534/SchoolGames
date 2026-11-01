/**
 * Dev-only hooks for checking En Garde! by eye. Each takes the address query and returns null
 * outside a dev build, so they compile away in production.
 *
 * - `?rung=0..5`: the ladder place, instead of the saved one (results still save normally).
 * - `?rival=1..5`: face that rival.
 * - `?pokes=<landed>-<taken>`: the starting counts, ignored if they would already end the bout.
 * - `?poke=belly|head|nose|bottom`: every poke is that kind.
 * - `?vs=skip`: skip the VS card.
 * - `?auto=right|wrong`: answer the first question 0.3 s after its reading ends, skip the VS card
 *   and the preview, and start without waiting for "En garde!".
 * - `?at=<s>`: freeze the first poke or finisher at that time; the HUD stays.
 */
import { HITS_TO_LOSE, POKE_KINDS, RIVALS, type PokeKind } from './rules';

const query = (search: string) => new URLSearchParams(search);

/** A whole number in `min..max` from a query value, else null. */
function whole(value: string | null, min: number, max: number): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

/** `?rung=0..5` in a dev build. */
export function devRung(search: string = location.search): number | null {
  if (!import.meta.env.DEV) return null;
  return whole(query(search).get('rung'), 0, RIVALS.length);
}

/** `?rival=1..5` in a dev build: the index (0 to 4) of the rival to face. */
export function devRival(search: string = location.search): number | null {
  if (!import.meta.env.DEV) return null;
  const n = whole(query(search).get('rival'), 1, RIVALS.length);
  return n === null ? null : n - 1;
}

/**
 * The starting counts of `?pokes=<landed>-<taken>` for a rival who needs `pokesToWin`; null when
 * missing or bad, or when they would already end the bout.
 */
export function devPokes(
  pokesToWin: number,
  search: string = location.search,
): { landed: number; taken: number } | null {
  if (!import.meta.env.DEV) return null;
  const match = /^(\d{1,2})-(\d{1,2})$/.exec(query(search).get('pokes') ?? '');
  if (!match) return null;
  const landed = Number(match[1]);
  const taken = Number(match[2]);
  if (landed >= pokesToWin || taken >= HITS_TO_LOSE) return null;
  return { landed, taken };
}

/** `?poke=belly|head|nose|bottom` in a dev build. */
export function forcedPoke(search: string = location.search): PokeKind | null {
  if (!import.meta.env.DEV) return null;
  const poke = query(search).get('poke');
  return POKE_KINDS.find((kind) => kind === poke) ?? null;
}

/** True for `?vs=skip` or `?auto=` in a dev build. */
export function skipVs(search: string = location.search): true | null {
  if (!import.meta.env.DEV) return null;
  return query(search).get('vs') === 'skip' || autoAnswer(search) ? true : null;
}

/** `?auto=right|wrong` in a dev build. */
export function autoAnswer(search: string = location.search): 'right' | 'wrong' | null {
  if (!import.meta.env.DEV) return null;
  const auto = query(search).get('auto');
  return auto === 'right' || auto === 'wrong' ? auto : null;
}

/** `?at=<seconds>`: the time to freeze the first poke or finisher at (dev build). */
export function freezeAt(search: string = location.search): number | null {
  if (!import.meta.env.DEV) return null;
  const at = query(search).get('at');
  if (at === null || at === '' || Number.isNaN(Number(at)) || Number(at) < 0) return null;
  return Number(at);
}
