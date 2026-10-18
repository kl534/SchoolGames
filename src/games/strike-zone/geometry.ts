/**
 * The lane's numbers. Pure: no three.js, no cannon-es and no DOM.
 *
 * Units are metres; y is up. The foul line is at `z = 0`, the lane runs towards -z, and the bowler
 * stands at +z. Seen from behind the bowler, +x is to the right. Pin 1 is the head pin, 2 and 3
 * are behind it (2 on the left), then 4 5 6, then 7 8 9 10 (7 far left, 10 far right).
 */

export interface Vec {
  x: number;
  y: number;
  z: number;
}

export const LANE_WIDTH = 1.0541; // 41.5 in
export const LANE_HALF = LANE_WIDTH / 2; // 0.52705
export const BOARDS = 39;
export const BOARD_W = LANE_WIDTH / BOARDS; // 0.02703
export const FOUL_Z = 0;
/** The head pin's centre: 60 ft from the foul line. */
export const HEAD_Z = -18.288;
/** Pins in a row are 12 in apart; rows are 12·sin 60° apart. */
export const PIN_GAP = 0.3048;
export const ROW_GAP = 0.26397;
/** Back edge of the pin deck, then the pit, then the back cushion. */
export const DECK_BACK_Z = HEAD_Z - 3 * ROW_GAP - 0.07; // ≈ -19.150
export const PIT_BACK_Z = DECK_BACK_Z - 1.0;
export const GUTTER_W = 0.235;
export const GUTTER_DEPTH = 0.048;
/** Centre line of each gutter channel (±). */
export const GUTTER_X = LANE_HALF + GUTTER_W / 2; // 0.6445
/** Inner face of the side kickback walls at the pin deck (±). */
export const KICKBACK_X = LANE_HALF + GUTTER_W; // 0.76205

export const BALL_R = 0.108; // 8.5 in ball
export const BALL_MASS = 6.4;
export const BALL_SPEED = 9;
export const PIN_H = 0.381;
export const PIN_MASS = 1.5;
/** A pin's centre of mass above its base; the physics body's origin is here. */
export const PIN_COM_Y = 0.15;

/** Where the ball is let go (just past the foul line), the lane arrows, and the lane dots. */
export const RELEASE_Z = -0.3;
export const ARROW_Z = -4.572; // 15 ft
export const DOTS_Z = -2.134; // 7 ft
/** The bowler stands here while aiming; the 3-step approach ends at SLIDE_Z. */
export const BOWLER_Z = 2.0;
export const SLIDE_Z = 0.35;

/** Furthest the ball's centre may be from the middle of the lane on a right answer. */
export const AIM_LIMIT = LANE_HALF - BALL_R - 0.004; // ≈ 0.415

export type PinId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export const PIN_IDS: readonly PinId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
/** Row (0 = head pin … 3 = back row) and column (in half-gaps: -3 … 3) of each pin. */
export const PIN_GRID: Record<PinId, { row: number; col: number }> = {
  1: { row: 0, col: 0 },
  2: { row: 1, col: -1 },
  3: { row: 1, col: 1 },
  4: { row: 2, col: -2 },
  5: { row: 2, col: 0 },
  6: { row: 2, col: 2 },
  7: { row: 3, col: -3 },
  8: { row: 3, col: -1 },
  9: { row: 3, col: 1 },
  10: { row: 3, col: 3 },
};

/** The centre of a pin's spot on the deck: x = col · PIN_GAP / 2, z = HEAD_Z - row · ROW_GAP. */
export function pinSpot(id: PinId): { x: number; z: number } {
  const { row, col } = PIN_GRID[id];
  return { x: (col * PIN_GAP) / 2, z: HEAD_Z - row * ROW_GAP };
}
