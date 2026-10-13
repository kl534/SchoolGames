import { PerspectiveCamera, Vector3 } from 'three';

/** The ship stays here; the world streams towards it along +z. */
export const SHIP_Z = 0;
/** The chase camera sits this far behind and above the ship's resting spot. */
export const CAM_BACK = 7.2;
export const CAM_UP = 2.3;
/** The camera follows this fraction of the ship's sideways and vertical offset. */
export const CAM_FOLLOW = 0.5;
/** The camera looks at a point this far ahead, following the ship by `LOOK_FOLLOW`. */
export const LOOK_Z = -18;
export const LOOK_FOLLOW = 0.7;
export const LOOK_LIFT = 0.5;

/** Hazards, crystals and scenery appear this far ahead, inside the fog. */
export const SPAWN_Z = -140;
/** Things that have flown past the camera are recycled beyond this z. */
export const PAST_Z = 12;
/** A target asteroid appears here and flies in to its lock distance. */
export const TARGET_SPAWN_Z = -125;
export const LOCK_Z = -28;
export const BOSS_LOCK_Z = -46;

/** Half the ship's wing span, for fitting it on screen. */
export const SHIP_HALF_SPAN = 1.1;
/** Fraction of the screen a finger must travel to carry the ship across the whole flight box. */
export const DRAG_SPAN = 0.7;

export interface FlightFit {
  /** Vertical field of view in degrees (before the speed boost). */
  fov: number;
  /** Half the flight box's width and height, in world units. */
  halfW: number;
  halfH: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

/** Distance from the camera to the ship at rest. */
const SHIP_DISTANCE = Math.hypot(CAM_BACK, CAM_UP);
const BASE_FOV = 62;

/**
 * Flight box and field of view for a screen shape. Wide screens get a wider box; narrow ones are
 * taller and zoom out until the ship fits across even at the edge of the box.
 */
export function fitView(aspect: number): FlightFit {
  const safeAspect = clamp(aspect, 0.2, 4);
  const wide = clamp((safeAspect - 0.45) / (1.78 - 0.45), 0, 1);
  const halfH = 2.7 - 0.6 * wide;
  const halfW = clamp(halfH * safeAspect * 1.25, 1.5, 5.4);
  // Room for the wings plus how far the ship can drift from the centre of the view.
  const needHalfW = SHIP_HALF_SPAN + (1 - CAM_FOLLOW) * halfW + 0.7;
  const tanHalf = Math.max(
    Math.tan((BASE_FOV * Math.PI) / 360),
    needHalfW / (safeAspect * SHIP_DISTANCE),
  );
  return { fov: Math.min((2 * Math.atan(tanHalf) * 180) / Math.PI, 88), halfW, halfH };
}

/** Keeps a ship position inside the flight box. */
export function clampToBox<T extends { x: number; y: number }>(point: T, fit: FlightFit): T {
  point.x = clamp(point.x, -fit.halfW, fit.halfW);
  point.y = clamp(point.y, -fit.halfH, fit.halfH);
  return point;
}

/** World units a finger moves the ship per pixel dragged, sideways and up. */
export function dragScale(viewW: number, viewH: number, fit: FlightFit): { x: number; y: number } {
  return {
    x: (2 * fit.halfW) / (DRAG_SPAN * Math.max(viewW, 1)),
    y: (2 * fit.halfH) / (DRAG_SPAN * Math.max(viewH, 1)),
  };
}

/** Where the chase camera wants to be for a ship at (x, y). */
export function cameraGoal(x: number, y: number, back: number, out: Vector3): Vector3 {
  return out.set(x * CAM_FOLLOW, y * CAM_FOLLOW + CAM_UP, SHIP_Z + back);
}

/** The point the camera looks at: well ahead of the ship, drifting a little with it. */
export function lookGoal(x: number, y: number, out: Vector3): Vector3 {
  return out.set(x * LOOK_FOLLOW, y * LOOK_FOLLOW + LOOK_LIFT, LOOK_Z);
}

export interface PlayBand {
  /** Screen rows (px from the top) the question and score leave clear, and the answers leave clear. */
  top: number;
  bottom: number;
}

/**
 * The part of the screen between the question at the top and the answers along the bottom, in
 * CSS pixels. Mirrors the HUD in style.css: on a narrow phone the question sits below the
 * shields and score, and the four answers wrap into two rows.
 */
export function playBand(width: number, height: number): PlayBand {
  return { top: width <= 640 ? 240 : 112, bottom: height - (width <= 560 ? 160 : 88) };
}

/** Least gap kept between the lowest the ship can fly and the answers. */
const SHIP_CLEARANCE = 34;
/** Least gap kept between the target asteroid's lock-on and the question. */
const TARGET_CLEARANCE = 30;

const probe = new PerspectiveCamera();
const probePoint = new Vector3();
const probeGoal = new Vector3();

/** Screen row of a point, for a camera resting at the chase pose for a ship at (x, y). */
function rowAt(width: number, height: number, fit: FlightFit, x: number, y: number, z: number) {
  probe.fov = fit.fov;
  probe.aspect = width / Math.max(height, 1);
  probe.near = 0.3;
  probe.far = 900;
  probe.updateProjectionMatrix();
  probe.position.copy(cameraGoal(x, y, CAM_BACK, probeGoal));
  probe.lookAt(lookGoal(x, y, probeGoal));
  probe.updateMatrixWorld();
  const p = probePoint.set(x, y, z).project(probe);
  return ((1 - p.y) / 2) * height;
}

/**
 * How many pixels to slide the picture up so the ship stays clear of the answers even at the
 * bottom of the flight box, without pushing the asteroid up into the question. Zero when
 * there is room already.
 */
export function viewShift(width: number, height: number, fit: FlightFit): number {
  const band = playBand(width, height);
  const lowest = rowAt(width, height, fit, 0, -fit.halfH, SHIP_Z);
  const need = lowest + SHIP_CLEARANCE - band.bottom;
  if (need <= 0) return 0;
  const lock = rowAt(width, height, fit, 0, 0, LOCK_Z);
  return Math.max(0, Math.min(need, lock - band.top - TARGET_CLEARANCE));
}
