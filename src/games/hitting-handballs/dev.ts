/**
 * Dev-only hooks for checking Hitting Handballs by eye. Each takes the address query and returns
 * null outside a dev build, so they compile away in production.
 *
 * - `?rung=0..5`: the ladder place, instead of the saved one (results still save normally).
 * - `?pair=1..5`: face that pair.
 * - `?score=<us>-<them>`: the starting score, ignored if the match would already be over.
 * - `?serve=us|them`: who serves first.
 * - `?streak=<n>`: the starting rally streak (below the pair's `streakToWin`).
 * - `?run=<n>`: points in a row we have already won (for the "You're cooking!" call).
 * - `?vs=skip`: skip the VS card.
 * - `?auto=smash|return|winner|wrong`: answer the first question 0.3 s after its reading ends,
 *   skip the VS card, the preview and "Play ball!". `smash` judges at 0.3 s, `return` judges at
 *   99 s and `winner` sets the streak to `streakToWin - 1` and judges at 99 s.
 * - `?whiff=spin|bonk`: every whiff is that kind.
 * - `?at=<s>`: freeze the scene `s` seconds after that first answer; the HUD stays.
 */
import { matchWinner, PAIRS, type Side } from './rules';

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
  return whole(query(search).get('rung'), 0, PAIRS.length);
}

/** `?pair=1..5` in a dev build: the index (0 to 4) of the pair to face. */
export function devPair(search: string = location.search): number | null {
  if (!import.meta.env.DEV) return null;
  const n = whole(query(search).get('pair'), 1, PAIRS.length);
  return n === null ? null : n - 1;
}

/** `?score=<us>-<them>` in a dev build; null when bad or when the match would already be over. */
export function devScore(search: string = location.search): { us: number; them: number } | null {
  if (!import.meta.env.DEV) return null;
  const match = /^(\d{1,2})-(\d{1,2})$/.exec(query(search).get('score') ?? '');
  if (!match) return null;
  const us = Number(match[1]);
  const them = Number(match[2]);
  if (matchWinner(us, them)) return null;
  return { us, them };
}

/** `?serve=us|them` in a dev build. */
export function devServe(search: string = location.search): Side | null {
  if (!import.meta.env.DEV) return null;
  const serve = query(search).get('serve');
  return serve === 'us' || serve === 'them' ? serve : null;
}

/** `?streak=<n>` in a dev build, for a pair who needs `streakToWin`; null unless below it. */
export function devStreak(streakToWin: number, search: string = location.search): number | null {
  if (!import.meta.env.DEV) return null;
  return whole(query(search).get('streak'), 0, streakToWin - 1);
}

/** `?run=<n>` in a dev build: points in a row we have already won (0 to 20). */
export function devRun(search: string = location.search): number | null {
  if (!import.meta.env.DEV) return null;
  return whole(query(search).get('run'), 0, 20);
}

/** True for `?vs=skip` or `?auto=` in a dev build. */
export function skipVs(search: string = location.search): true | null {
  if (!import.meta.env.DEV) return null;
  return query(search).get('vs') === 'skip' || autoAnswer(search) ? true : null;
}

export type Auto = 'smash' | 'return' | 'winner' | 'wrong';

/** `?auto=smash|return|winner|wrong` in a dev build. */
export function autoAnswer(search: string = location.search): Auto | null {
  if (!import.meta.env.DEV) return null;
  const auto = query(search).get('auto');
  return auto === 'smash' || auto === 'return' || auto === 'winner' || auto === 'wrong'
    ? auto
    : null;
}

/** `?whiff=spin|bonk` in a dev build. */
export function forcedWhiff(search: string = location.search): 'spin' | 'bonk' | null {
  if (!import.meta.env.DEV) return null;
  const whiff = query(search).get('whiff');
  return whiff === 'spin' || whiff === 'bonk' ? whiff : null;
}

/** `?at=<seconds>`: the time after the first answer to freeze the scene at (dev build). */
export function freezeAt(search: string = location.search): number | null {
  if (!import.meta.env.DEV) return null;
  const at = query(search).get('at');
  if (at === null || at === '' || Number.isNaN(Number(at)) || Number(at) < 0) return null;
  return Number(at);
}
