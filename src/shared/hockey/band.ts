/** How fast an answer was, as a style for the shot or play. Pure: no three.js and no DOM. */

export type Band = 'flashy' | 'solid' | 'plain';
export const FLASHY_UNDER_SECONDS = 0.6;
export const SOLID_UNDER_SECONDS = 1.2;

/** How fast the answer was: under 0.6 s is flashy, under 1.2 s solid, else plain. */
export function bandFor(seconds: number): Band {
  if (seconds < FLASHY_UNDER_SECONDS) return 'flashy';
  if (seconds < SOLID_UNDER_SECONDS) return 'solid';
  return 'plain';
}
