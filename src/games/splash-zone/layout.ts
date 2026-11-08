/**
 * Camera and screen fitting, free of three.js objects so it is easy to test. The chase camera sits
 * low behind the ski; for a trick it swings out to a three-quarter side view. The picture is slid
 * up or down (`bandShift`) so that its middle is the middle of the space the HUD leaves clear.
 */

/** CSS pixels: the space between the question panel at the top and the answers at the bottom. */
export interface PlayBand {
  top: number;
  bottom: number;
}

/**
 * The part of the screen the HUD leaves clear, in CSS pixels. Mirrors the HUD in style.css: on a
 * portrait phone the question and the wake strip sit below the menu buttons and the answers wrap
 * into two rows; in a short landscape phone everything is squeezed to the edges.
 */
export function playBand(width: number, height: number): PlayBand {
  if (height <= 460) return { top: 96, bottom: height - 84 };
  if (width <= 640) return { top: 284, bottom: height - 170 };
  return { top: 118, bottom: height - 100 };
}

/** How many CSS pixels to slide the picture down so its middle is the middle of the band. */
export function bandShift(width: number, height: number): number {
  const band = playBand(width, height);
  return height / 2 - (band.top + band.bottom) / 2;
}

/** Vertical field of view in degrees: wider on a tall narrow screen so the ramp still fits. */
export function fovFor(aspect: number): number {
  if (!Number.isFinite(aspect) || aspect >= 1) return 52;
  return Math.min(Math.max(52 + (1 - aspect) * 40, 52), 74);
}

// ---------- The chase camera ----------

/** The chase camera is this far above and behind the ski, and looks this far ahead of it (u). */
export const CAM_UP = 2.7;
export const CAM_BACK = 9;
export const LOOK_AHEAD = 12;
/** The point looked at is this high above the ski. */
export const LOOK_UP = 0.1;

/**
 * The stunt camera sits out to the right of the action, 70 degrees off the travel axis (a true
 * three-quarter side view) and nearly level with it: `CAM_EYE` above the middle of the trick's
 * height range, looking at that middle height so the horizon sits behind the ski and the height
 * of the air reads.
 */
export const CAM_AZIMUTH = (70 * Math.PI) / 180;
export const CAM_EYE = 1.75;
/** While the ski takes off the camera looks at the lip, lagging at most this far behind the ski (u). */
export const LOOK_LAG = 4;
/** The nearest and furthest the stunt camera goes (u). */
export const STUNT_MIN_DIST = 10;
export const STUNT_MAX_DIST = 46;
/** The ski and a free rider stay at least this far (a fraction of the width) from each side edge. */
export const SIDE_MARGIN = 0.08;
/** Room for the camera trailing the action while it eases after it (u). */
const EASE_ROOM = 4.5;

/** Seconds to swing out to the stunt view, and back after a clear. */
export const SWING_IN = 0.5;
export const SWING_OUT = 0.8;

export interface CamPose {
  x: number;
  y: number;
  z: number;
  lookX: number;
  lookY: number;
  lookZ: number;
}

export const createPose = (): CamPose => ({ x: 0, y: 0, z: 0, lookX: 0, lookY: 0, lookZ: 0 });

/** The chase pose for a ski at world (x, y, z), with the camera `x` side offset already applied by the caller. */
export function chasePose(camX: number, skiY: number, skiZ: number, out: CamPose = createPose()) {
  out.x = camX;
  out.y = skiY + CAM_UP;
  out.z = skiZ + CAM_BACK;
  out.lookX = camX;
  out.lookY = skiY + LOOK_UP;
  out.lookZ = skiZ - LOOK_AHEAD;
  return out;
}

/** The camera follows a ski's side position at half, so the ski can drift in the picture. */
export const followSide = (skiX: number): number => skiX * 0.5;

/** What a trick's camera has to fit: how high the action goes and how low (u above the water). */
export interface Framing {
  peak: number;
  low: number;
  /** The most the ski and a free rider are ever apart along the course (u), for the width. */
  span?: number;
}

/** The middle of a framing, which the stunt camera looks at. */
export const framingMid = (f: Framing): number => (f.peak + f.low) / 2;

/**
 * How far the stunt camera stands back so the action fits the band the HUD leaves clear, in
 * height (with 20 % to spare) and in width (the ski and a free rider, with the side margins and
 * some room for the camera trailing them): taller tricks (tier 3) stand further back, and so does
 * any trick on a narrow screen. `aspect` is the screen's width over its height.
 */
export function stuntDistance(
  f: Framing,
  fov: number,
  bandFraction: number,
  aspect = 2,
  min = STUNT_MIN_DIST,
): number {
  const tan = Math.tan((fov * Math.PI) / 360);
  const need = Math.max(f.peak - f.low, 1) * 1.2;
  const high = need / (2 * tan * Math.max(bandFraction, 0.1));
  // The course runs across the picture (sin of the angle off the view axis); both sides keep a margin.
  const across = (f.span ?? 0) + EASE_ROOM;
  const wide =
    across / (2 * tan * Math.max(aspect, 0.1) * (1 - 2 * SIDE_MARGIN) * Math.sin(CAM_AZIMUTH));
  return Math.min(Math.max(high, wide, min), STUNT_MAX_DIST);
}

/**
 * Where along the course the stunt camera looks: at the launcher's lip while the ski takes off,
 * then following `focusD`, lagging it by up to LOOK_LAG (less on a narrow screen).
 */
export function stuntLookD(
  focusD: number,
  lipD: number,
  dist: number,
  fov: number,
  aspect: number,
): number {
  const halfWidth = dist * Math.tan((fov * Math.PI) / 360) * aspect;
  const lag = Math.min(LOOK_LAG, halfWidth * 0.3);
  return focusD - Math.min(Math.max(focusD - lipD, 0), lag);
}

/** How much of the screen's height the HUD leaves clear. */
export function bandFraction(width: number, height: number): number {
  const band = playBand(width, height);
  return (band.bottom - band.top) / Math.max(height, 1);
}

/**
 * The stunt pose: `dist` out to the right (70 degrees off the travel axis) of the point (lookX,
 * lookZ), `CAM_EYE` above the middle height `mid`, looking at that point at height `mid`.
 */
export function stuntPose(
  lookX: number,
  lookZ: number,
  mid: number,
  dist: number,
  out: CamPose = createPose(),
) {
  out.x = lookX + dist * Math.sin(CAM_AZIMUTH);
  out.y = mid + CAM_EYE;
  out.z = lookZ + dist * Math.cos(CAM_AZIMUTH);
  out.lookX = lookX;
  out.lookY = mid;
  out.lookZ = lookZ;
  return out;
}

/** Ease for the swing between the two views. */
export const smooth = (u: number) => {
  const c = u < 0 ? 0 : u > 1 ? 1 : u;
  return c * c * (3 - 2 * c);
};

/** Blends the chase pose into the stunt pose by `w` (0 to 1): position and look target. */
export function blendCam(chase: CamPose, stunt: CamPose, w: number, out: CamPose = createPose()) {
  const k = smooth(w);
  out.x = chase.x + (stunt.x - chase.x) * k;
  out.y = chase.y + (stunt.y - chase.y) * k;
  out.z = chase.z + (stunt.z - chase.z) * k;
  out.lookX = chase.lookX + (stunt.lookX - chase.lookX) * k;
  out.lookY = chase.lookY + (stunt.lookY - chase.lookY) * k;
  out.lookZ = chase.lookZ + (stunt.lookZ - chase.lookZ) * k;
  return out;
}
