import { Vector3 } from 'three';

/** Answer lanes, left to right. */
export const LANES = 4;

/** The wooden barricade runs along this z; the kid stands behind it. */
export const BARRICADE_Z = 0;
/** Zombies that reach the barricade stop here, leaning over it. */
export const END_Z = -0.6;
/** Where they sway in place while the question is read. */
export const START_Z = -4.5;
/** Where they come out of the mist. */
export const SPAWN_Z = -19;

export const CAMERA = new Vector3(0, 3.1, 5.6);
export const TARGET = new Vector3(0, 0.7, -3);
/** Height of the middle of a zombie, for working out how far away it is. */
const BODY_Y = 1;
/** Half the width of a zombie with its shoulders, in world units. */
const HALF_BODY = 0.6;
const EDGE_MARGIN = 0.1;
const LANE_MIN = 0.8;
const LANE_MAX = 1.8;
/** Least world height (each way from the view axis) to show at the barricade. */
const HALF_HEIGHT_MIN = 2.75;

const FORWARD = TARGET.clone().sub(CAMERA).normalize();

/** Distance along the view direction from the camera to a point at `z`, `BODY_Y` above the grass. */
export function depthAt(z: number): number {
  return (BODY_Y - CAMERA.y) * FORWARD.y + (z - CAMERA.z) * FORWARD.z + (0 - CAMERA.x) * FORWARD.x;
}

export interface ViewFit {
  /** Vertical field of view in degrees. */
  fov: number;
  /** World distance between neighbouring lanes at the barricade. */
  lane: number;
}

/**
 * Camera field of view and lane spacing for a screen shape. Wide screens spread the lanes out;
 * narrow ones zoom out until four lanes fit across.
 */
export function fitView(aspect: number): ViewFit {
  const safeAspect = Math.max(aspect, 0.2);
  const d0 = depthAt(BARRICADE_Z);
  let tanHalf = HALF_HEIGHT_MIN / d0;
  let lane = (tanHalf * safeAspect * d0 - HALF_BODY - EDGE_MARGIN) / 1.5;
  if (lane < LANE_MIN) {
    lane = LANE_MIN;
    tanHalf = (1.5 * LANE_MIN + HALF_BODY + EDGE_MARGIN) / (safeAspect * d0);
  }
  return { fov: (2 * Math.atan(tanHalf) * 180) / Math.PI, lane: Math.min(lane, LANE_MAX) };
}

/**
 * Sideways position of a lane at depth `z`. The lanes fan out with distance so they stay the same
 * distance apart on screen: that leaves room for four answer signs even on a phone.
 */
export function laneX(index: number, z: number, lane: number): number {
  const spread = Math.max(depthAt(z) / depthAt(BARRICADE_Z), 1);
  return (index - (LANES - 1) / 2) * lane * spread;
}

export interface SignInput {
  /** Where the sign would like to be: the middle of its box, in px. */
  x: number;
  y: number;
  /** Box width in px. */
  w: number;
}

export interface SignArea {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Keeps answer signs on screen and apart. Each sign sits at its wish unless that overlaps one
 * placed before it (nearest zombie first), in which case it moves to the closest free spot above
 * or below. Returns box centres in the same order as `items`.
 */
export function layoutSigns(
  items: readonly SignInput[],
  height: number,
  gap: number,
  area: SignArea,
): { x: number; y: number }[] {
  const placed: { x: number; y: number; w: number }[] = [];
  const out = items.map((item) => ({ x: item.x, y: item.y }));
  const order = items.map((_, i) => i).sort((a, b) => items[b].y - items[a].y);
  const minY = area.top + height / 2;
  const maxY = Math.max(area.bottom - height / 2, minY);
  for (const i of order) {
    const { w } = items[i];
    const half = w / 2;
    const x = Math.min(
      Math.max(items[i].x, area.left + half),
      Math.max(area.right - half, area.left + half),
    );
    const wish = Math.min(Math.max(items[i].y, minY), maxY);
    const clear = (y: number) =>
      y >= minY - 1e-9 &&
      y <= maxY + 1e-9 &&
      !placed.some(
        (p) => Math.abs(p.x - x) < (p.w + w) / 2 + gap && Math.abs(p.y - y) < height + gap - 1e-9,
      );
    // The only places a sign can end up are its wish or just clear of a sign already down.
    const candidates = [
      wish,
      ...placed.flatMap((p) => [p.y - height - gap, p.y + height + gap]),
    ].sort((a, b) => Math.abs(a - wish) - Math.abs(b - wish) || a - b);
    const y = candidates.find(clear) ?? wish;
    placed.push({ x, y, w });
    out[i] = { x, y };
  }
  return out;
}
