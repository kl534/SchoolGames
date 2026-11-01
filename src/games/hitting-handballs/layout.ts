/** The camera looks from `CAM_Y` at the point `(LOOK_X, LOOK_Y, 0)`, `distance` metres back. */
export const LOOK_X = -0.2;
export const CAM_Y = 1.6;
export const LOOK_Y = 1.1;
export const CAM_FOV = 38;

/**
 * What must always be on screen: the wall, then the court out to the far kid. The box is centred
 * on `LOOK_X`.
 */
export const SUBJECT = { minX: -3.4, maxX: 3.0, bottom: 0, top: 2.6 };
/** The subject box runs from just behind the rivals (back) to just in front of us (front). */
export const SUBJECT_Z = [-1.0, 0.9] as const;
/** Room left around the subject. */
const MARGIN = 1.0;

export interface PlayBand {
  /** Screen rows (px from the top) the scoreboard and question leave clear, and the answers leave clear. */
  top: number;
  bottom: number;
}

/**
 * The part of the screen between the scoreboard and question at the top and the answers along the
 * bottom, in CSS pixels. Mirrors the HUD in style.css: on a narrow phone the scoreboard sits below
 * the buttons row and the four answers wrap into two rows.
 */
export function playBand(width: number, height: number): PlayBand {
  return {
    top: width <= 640 ? 253 : height <= 450 ? 180 : 195,
    bottom: height - (width <= 560 ? 174 : height <= 450 ? 80 : 92),
  };
}

export interface CameraFit {
  distance: number;
  /** Pixels to slide the view down (pass `-shift` as the y of `setViewOffset`). */
  shift: number;
}

/**
 * Screen position (px, before any view offset) of a world point for the camera at
 * `(LOOK_X, CAM_Y, distance)` looking at `(LOOK_X, LOOK_Y, 0)`.
 */
export function project(
  x: number,
  y: number,
  z: number,
  distance: number,
  width: number,
  height: number,
  fov: number = CAM_FOV,
): { x: number; y: number } {
  const fy = LOOK_Y - CAM_Y;
  const fz = -distance;
  const flen = Math.hypot(fy, fz);
  const forwardY = fy / flen;
  const forwardZ = fz / flen;
  const upY = -forwardZ;
  const upZ = forwardY;
  const vx = x - LOOK_X;
  const vy = y - CAM_Y;
  const vz = z - distance;
  const depth = vy * forwardY + vz * forwardZ;
  const cy = vy * upY + vz * upZ;
  const tan = Math.tan((fov * Math.PI) / 360);
  const ndcX = vx / (depth * tan * (width / height));
  const ndcY = cy / (depth * tan);
  return { x: ((ndcX + 1) / 2) * width, y: ((1 - ndcY) / 2) * height };
}

/** The highest and lowest screen rows the subject box reaches at this distance (no view offset). */
function subjectRows(distance: number, width: number, height: number, fov: number) {
  let min = Infinity;
  let max = -Infinity;
  let maxAbsX = 0;
  for (const x of [SUBJECT.minX, SUBJECT.maxX]) {
    for (const y of [SUBJECT.bottom, SUBJECT.top]) {
      for (const z of SUBJECT_Z) {
        const p = project(x, y, z, distance, width, height, fov);
        min = Math.min(min, p.y);
        max = Math.max(max, p.y);
        maxAbsX = Math.max(maxAbsX, Math.abs(p.x - width / 2));
      }
    }
  }
  return { min, max, halfSpanX: maxAbsX };
}

/**
 * Camera distance so SUBJECT fits the band and the width , and the pixels to
 * slide the view down so the picture sits in the band.
 */
export function fitCamera(
  width: number,
  height: number,
  band: PlayBand,
  fov: number = CAM_FOV,
): CameraFit {
  const mid = (band.top + band.bottom) / 2;
  const shift = mid - height / 2;
  const fits = (distance: number) => {
    const rows = subjectRows(distance, width, height, fov);
    const above = height / 2 - rows.min;
    const below = rows.max - height / 2;
    return (
      rows.halfSpanX * MARGIN <= width / 2 &&
      above * MARGIN <= mid - band.top &&
      below * MARGIN <= band.bottom - mid
    );
  };
  let near = 1.5;
  let far = 200;
  for (let i = 0; i < 60; i++) {
    const half = (near + far) / 2;
    if (fits(half)) far = half;
    else near = half;
  }
  return { distance: far, shift };
}
