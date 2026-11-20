/**
 * Where everything of Typo Troopers is: the field, the formation's grid, the bunkers, the cannon
 * and the camera. Pure (no DOM, no three.js): the numbers are tested.
 */

/** The field is x from -FIELD_HALF to FIELD_HALF. */
export const FIELD_HALF = 6.5;
/** Spacing of the formation's columns and rows. */
export const COL_PITCH = 1.8;
export const ROW_PITCH = 1.3;
/** One cube of an invader. */
export const PIXEL = 0.1;
/** The bottom row's bottom y at drop 0. */
export const START_BOTTOM = 8.2;
/** How far the formation drops at the edge. */
export const DROP = 0.5;
/** The top of the bunkers: an invader whose bottom gets here has landed. */
export const LAND_Y = 2.2;
/** Drops from the start to the bunker line: `(START_BOTTOM - LAND_Y) / DROP`. */
export const DROPS_TO_LAND = 12;
/** One sideways step, and the steps of one full pass of a full formation. */
export const STEP_X = 0.35;
export const STEPS_PER_PASS = 8;
/** Drops the march steps back up after a lost cannon (2 rows, about 2.6 units). */
export const RECOIL_DROPS = 5;
/** Half the width an invader takes in the extent of the formation. */
export const INVADER_HALF = 0.6;

export const BUNKER_X = [-4.5, -1.5, 1.5, 4.5];
export const BUNKER_COLS = 14;
export const BUNKER_ROWS = 10;
export const BUNKER_PIXEL = 0.12;
export const BUNKER_BOTTOM = 1.0;
/** Where the bunkers end at the top: the landing line. */
export const BUNKER_TOP = BUNKER_BOTTOM + BUNKER_ROWS * BUNKER_PIXEL;

export const CANNON_COLS = 13;
export const CANNON_ROWS = 6;
/** The cannon sits on the ground line. */
export const GROUND_Y = 0;

/** The UFO's lane: its bottom y; its label sits above it. */
export const UFO_BOTTOM = 12.2;

/** The box the camera must show: x ±6.7, y -0.3 to 13.8. */
export const FIELD_BOX = { left: -6.7, right: 6.7, bottom: -0.3, top: 13.8 };

/** The camera's tilt from the front, in degrees, and its field of view. */
export const TILT_DEG = 25;
export const FOV = 35;
/** The margin around the field box. */
export const BOX_MARGIN = 1.08;

/** An invader's x for column `col` (0 to 5) with the formation moved `offsetX`. */
export const invaderX = (col: number, offsetX: number): number => (col - 2.5) * COL_PITCH + offsetX;

/** An invader's bottom y for row `row` (0 is the bottom) after `drops` drops. */
export const invaderBottom = (row: number, drops: number): number =>
  START_BOTTOM + row * ROW_PITCH - drops * DROP;

/** The left and right of a set of x positions of invaders, each taking `INVADER_HALF` either side; null when none. */
export function extentOf(xs: readonly number[]): { left: number; right: number } | null {
  if (xs.length === 0) return null;
  return {
    left: Math.min(...xs) - INVADER_HALF,
    right: Math.max(...xs) + INVADER_HALF,
  };
}

/** Cubes hidden after `typed` of `length` keys: 60% of an invader's cubes are gone by the last key before the space bar's blast. */
export const chipCount = (cubes: number, typed: number, length: number): number =>
  Math.ceil((cubes * 0.6 * typed) / Math.max(length, 1));

/** Where a bunker's cube grid has a cube (row 0 is the top): a block with cut top corners and an arch at the bottom. */
export function bunkerHasCube(col: number, row: number): boolean {
  if (col < 0 || col >= BUNKER_COLS || row < 0 || row >= BUNKER_ROWS) return false;
  if (row === 0 && (col < 2 || col >= BUNKER_COLS - 2)) return false;
  if (row === 1 && (col < 1 || col >= BUNKER_COLS - 1)) return false;
  // The arch: the last two rows are open between the legs, the row above has rounded shoulders.
  if (row >= BUNKER_ROWS - 3 && col >= 4 && col < BUNKER_COLS - 4) {
    if (row === BUNKER_ROWS - 3) return col !== 4 && col !== BUNKER_COLS - 5;
    return false;
  }
  return true;
}

/**
 * The bunker (index) and cube (`col`, `row`, row 0 at the top) at world point (x, y), or null when
 * the point is in no bunker's box.
 */
export function bunkerCellAt(
  x: number,
  y: number,
): { bunker: number; col: number; row: number } | null {
  if (y < BUNKER_BOTTOM || y >= BUNKER_TOP) return null;
  const width = BUNKER_COLS * BUNKER_PIXEL;
  for (let bunker = 0; bunker < BUNKER_X.length; bunker++) {
    const left = BUNKER_X[bunker] - width / 2;
    if (x < left || x >= left + width) continue;
    return {
      bunker,
      col: Math.floor((x - left) / BUNKER_PIXEL),
      row: Math.floor((BUNKER_TOP - y) / BUNKER_PIXEL),
    };
  }
  return null;
}

/**
 * The smallest distance from the field's centre at which the box (grown by `BOX_MARGIN`) fits a
 * camera with vertical field of view `fovDeg` and the given `aspect`, tilted `tiltDeg` below the
 * front. The camera sits at `centre + (0, -d sin tilt, d cos tilt)` and looks at the centre.
 */
export function cameraDistance(
  box: { left: number; right: number; bottom: number; top: number },
  aspect: number,
  fovDeg = FOV,
  tiltDeg = TILT_DEG,
  margin = BOX_MARGIN,
): number {
  const tanV = Math.tan((fovDeg * Math.PI) / 360);
  const tanH = tanV * aspect;
  const tilt = (tiltDeg * Math.PI) / 180;
  const halfW = ((box.right - box.left) / 2) * margin;
  const halfH = ((box.top - box.bottom) / 2) * margin;
  // Forward (camera to centre) is (0, sin t, -cos t); up is (0, cos t, sin t).
  let d = 0;
  for (const px of [-halfW, halfW]) {
    for (const py of [-halfH, halfH]) {
      for (const pz of [-0.5, 0.5]) {
        const along = py * Math.sin(tilt) - pz * Math.cos(tilt);
        const up = py * Math.cos(tilt) + pz * Math.sin(tilt);
        d = Math.max(d, Math.abs(px) / tanH - along, Math.abs(up) / tanV - along);
      }
    }
  }
  return d;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Space the keyboard strip takes: its size and whether it sits in the bottom-right corner. */
export interface KeyboardBox {
  w: number;
  h: number;
  corner: boolean;
}

/** The corner layout is used on a wide, low screen. */
export const isCorner = (viewport: { w: number; h: number }): boolean =>
  viewport.w >= 1.5 * viewport.h;

/**
 * The rectangle (px) the 3D field is drawn in: under the top row of buttons and the HUD, and
 * clear of the keyboard strip (above it, or beside it in the corner layout). `safeTop` is the
 * top safe-area inset.
 */
export function fieldRect(
  viewport: { w: number; h: number },
  keyboard: KeyboardBox,
  safeTop = 0,
): Rect {
  const top = (viewport.w >= 700 ? 72 : 112) + safeTop;
  const side = viewport.w < 500 ? 16 : 12;
  const bottomGutter = 12;
  if (keyboard.corner) {
    const w = viewport.w - side - (keyboard.w + 24);
    return { x: side, y: top, w: Math.max(w, 1), h: Math.max(viewport.h - top - bottomGutter, 1) };
  }
  return {
    x: side,
    y: top,
    w: Math.max(viewport.w - 2 * side, 1),
    h: Math.max(viewport.h - top - (keyboard.h + 24), 1),
  };
}
