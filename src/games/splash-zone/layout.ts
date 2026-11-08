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
export const LOOK_UP = 0.8;

/** The stunt camera's offset from what it follows: to the right, up and behind (u). */
export const SIDE = 8;
export const UP = 3;
export const BACK = 4.5;

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

/**
 * The stunt pose: from the focus (the ski, or the thrown rider) out to the right, up and back,
 * looking at the focus. `rise` lifts the camera and what it looks at with a high flight.
 */
export function stuntPose(
  focusX: number,
  focusY: number,
  focusZ: number,
  rise: number,
  out: CamPose = createPose(),
) {
  out.x = focusX + SIDE;
  out.y = focusY + UP + rise;
  out.z = focusZ + BACK;
  out.lookX = focusX;
  out.lookY = focusY + rise * 0.8;
  out.lookZ = focusZ;
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

// ---------- Rising with the action ----------

/** The camera starts rising once the highest point of the action is above this (u). */
export const RISE_FROM = 6;
/** The most the camera may rise (u). */
export const RISE_MAX = 6;

/**
 * How far to raise the stunt camera for an action that climbs above the usual view: (top -
 * RISE_FROM), never below 0 or above `max`.
 */
export function riseFor(top: number, max = RISE_MAX): number {
  if (!Number.isFinite(top) || !Number.isFinite(max)) return 0;
  return Math.max(0, Math.min(top - RISE_FROM, max));
}
