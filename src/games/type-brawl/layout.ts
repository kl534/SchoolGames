/**
 * Where things are in Type Brawl (pure): the side-on camera, the slots the thugs stand in and
 * where the labels may go. Units are world units; the hero is at z = 0 and the camera looks along -z.
 */

/** Camera distance from the action, height, and the height it looks at. */
export const CAMERA_D = 14;
export const CAMERA_Y = 1.6;
export const LOOK_Y = 1.1;

const clamp = (n: number, low: number, high: number): number => Math.min(Math.max(n, low), high);

/** World units visible left and right of the hero at z = 0 for a viewport of this width / height. */
export const halfWidthFor = (aspect: number): number => clamp(3.4 + (aspect - 0.46) * 3, 3.4, 5.6);

/**
 * The height the camera looks at: 1.1 on a tall phone, rising to 2.1 on a wide screen so the people
 * stand lower and the labels above their heads have room under the HUD.
 */
export const lookYFor = (aspect: number): number =>
  clamp(LOOK_Y + (aspect - 0.46) * 0.6, LOOK_Y, 2.1);

/** The vertical field of view (degrees) that shows `halfWidthFor(aspect)` each side at distance D. */
export const fovFor = (aspect: number): number =>
  (2 * Math.atan(halfWidthFor(aspect) / (aspect * CAMERA_D)) * 180) / Math.PI;

export interface Slot {
  /** Offset from the hero along x. */
  x: number;
  /** Depth: near slots stand a little in front of the hero, far slots behind. */
  z: number;
  side: 1 | -1;
}

/** Near right, near left, far right, far left. */
export const SLOTS: readonly Slot[] = [
  { x: 1.3, z: 0.3, side: 1 },
  { x: -1.3, z: 0.3, side: -1 },
  { x: 2.6, z: -0.3, side: 1 },
  { x: -2.6, z: -0.3, side: -1 },
];

/** The slot a new thug on `side` takes: a free one on its side, else a free one on the other; null when all are taken. */
export function pickSlot(side: 1 | -1, taken: ReadonlySet<number>): number | null {
  const order = [0, 1, 2, 3].sort((a, b) => {
    const sa = SLOTS[a].side === side ? 0 : 1;
    const sb = SLOTS[b].side === side ? 0 : 1;
    return sa - sb || a - b;
  });
  for (const i of order) if (!taken.has(i)) return i;
  return null;
}

/** Hero and camera speed while walking, and how fast the thugs walk in (u/s). */
export const WALK_SPEED = 1.6;
export const ENTER_SPEED = 2.2;
export const WALK_SECONDS = 3.0;
export const FIRST_WALK_SECONDS = 1.5;
/** The hero steps up to a thug farther than this. */
export const REACH = 0.9;

/** Where a thug appears: past the visible edge on its side. */
export const spawnOffset = (halfWidth: number, side: 1 | -1): number => side * (halfWidth + 1.5);

/** Screens at least this wide put the HUD at the very top: the shared buttons are in the corners beside it. */
export const WIDE = 760;

/** Top of the HUD panel (px): under the shared buttons on a narrow screen, beside them on a wide one. */
export const hudTop = (safeTop: number, viewportW: number): number =>
  viewportW >= WIDE ? Math.max(12, safeTop + 8) : Math.max(64, safeTop + 52);
/** Height of the HUD panel (px): the health row and the score row. */
export const HUD_HEIGHT = 72;

/** The highest a label may sit (px from the top of the viewport): under the HUD panel. */
export const labelMinY = (safeTop: number, viewportW: number): number =>
  hudTop(safeTop, viewportW) + HUD_HEIGHT + 4;

/** A label's top clamped under the HUD and above the bottom of the viewport. */
export function clampLabelY(
  y: number,
  height: number,
  viewportW: number,
  viewportH: number,
  safeTop: number,
): number {
  const min = labelMinY(safeTop, viewportW);
  return clamp(y, min, Math.max(min, viewportH - height - 4));
}
