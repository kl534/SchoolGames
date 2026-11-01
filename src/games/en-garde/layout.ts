/** The camera looks from `CAM_Y` at the point `(0, LOOK_Y, 0)`, `distance` metres back. */
export const CAM_Y = 1.3;
export const LOOK_Y = 1.1;
export const CAM_FOV = 38;

/** What must always be on screen: both fighters and the cake behind them (z from `SUBJECT_Z`). */
export const SUBJECT = { halfW: 2.0, bottom: 0, top: 2.4 };
/** The subject box runs from the cake (back) to just in front of the fighters (front). */
export const SUBJECT_Z = [-1.9, 0.5] as const;
/** Room left around the subject. */
const MARGIN = 1.04;

export interface PlayBand {
  /** Screen rows (px from the top) the question and badges leave clear, and the answers leave clear. */
  top: number;
  bottom: number;
}

/**
 * The part of the screen between the health bars and question at the top and the answers along
 * the bottom, in CSS pixels. Mirrors the HUD in style.css: on a narrow phone the bars sit below
 * the buttons row and the four answers wrap into two rows.
 */
export function playBand(width: number, height: number): PlayBand {
  return {
    top: width <= 640 ? 192 : 138,
    bottom: height - (width <= 560 ? 170 : height <= 450 ? 80 : 96),
  };
}

export interface CameraFit {
  distance: number;
  /** Pixels to slide the view down (pass `-shift` as the y of `setViewOffset`). */
  shift: number;
}

/**
 * Screen row (px, before any view offset) of a world point for the camera at `(0, CAM_Y, distance)`
 * looking at `(0, LOOK_Y, 0)`, and its screen column.
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
  // Forward points from the camera to the look-at point; right is +x; up completes the frame.
  const fy = LOOK_Y - CAM_Y;
  const fz = -distance;
  const flen = Math.hypot(fy, fz);
  const forwardY = fy / flen;
  const forwardZ = fz / flen;
  // up = right x forward, with right = (1, 0, 0).
  const upY = -forwardZ;
  const upZ = forwardY;
  const vx = x;
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
  for (const x of [-SUBJECT.halfW, SUBJECT.halfW]) {
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
 * Camera distance so SUBJECT fits the band and the width (with 4% margin), and the pixels to
 * slide the view down so the picture sits in the band. The view's own centre (the point the camera
 * looks at) is what lands in the middle of the band, so a band that is centred on the screen needs
 * no shift.
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
