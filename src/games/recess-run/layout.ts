/**
 * The track's geometry and the camera, pure: lane positions, how far back the camera stands for a
 * screen's shape, and where the podium and the people on it stand.
 */

/** Width of a lane (m); lane i (1 to 10) is centred at x = (i - 5.5) × LANE_W. */
export const LANE_W = 1.1;
export const LANES = 10;
export const laneX = (lane: number): number => (lane - 5.5) * LANE_W;

/** The start line is at z = 0 and the track runs towards -z. */
export const START_Z = 0;
export const FINISH_Z = -100;
/** Where a runner is in z after `metres` metres. */
export const zOf = (metres: number): number => START_Z - metres;

export const FOV = 50;
/** Half the width (m) to fit at the player's depth: all 10 lanes in landscape, lanes 2 to 9 in portrait. */
export const HALF_FIT = 6.4;
export const HALF_FIT_PORTRAIT = 3.6;
export const BACK_MIN = 6;
export const BACK_MAX = 16;
export const LOOK_AHEAD = 12;
/** The camera's smoothing of the player's z (s). */
export const CAMERA_SMOOTH = 0.15;

export interface CameraSpot {
  back: number;
  height: number;
  ahead: number;
}

/** How far behind the player the camera stands, how high, and how far ahead it looks. */
export function cameraFor(aspect: number): CameraSpot {
  const fit = aspect >= 1 ? HALF_FIT : HALF_FIT_PORTRAIT;
  const halfTan = Math.tan((FOV * Math.PI) / 360) * aspect;
  const back = Math.min(Math.max(fit / halfTan, BACK_MIN), BACK_MAX);
  return { back, height: back * 0.55, ahead: LOOK_AHEAD };
}

/** The podium stands this far past the finish line, in the middle of the track. */
export const PODIUM_Z = FINISH_Z - 12;
export const PODIUM_HEIGHTS = [1.0, 0.7, 0.45];
export const PODIUM_BLOCK_W = 1.4;

/** Where the winners stand: x, height of the block under them and z, for places 1 to 3 (2 on the left as seen). */
export function podiumSpot(place: number): { x: number; y: number; z: number } {
  const i = Math.min(Math.max(place, 1), 3) - 1;
  const x = i === 0 ? 0 : i === 1 ? -PODIUM_BLOCK_W : PODIUM_BLOCK_W;
  return { x, y: PODIUM_HEIGHTS[i], z: PODIUM_Z };
}

/** Where the others (places 4 and lower, 0-based `index`) stand in a loose row behind the podium. */
export function backRowSpot(index: number, count: number): { x: number; z: number } {
  const per = Math.ceil(count / 2) || 1;
  const row = Math.floor(index / per);
  const col = index % per;
  const x = (col - (per - 1) / 2) * 1.5 + (row ? 0.7 : 0);
  return { x, z: PODIUM_Z - 1.8 - row * 1.4 };
}

/** The podium camera: in front of the podium, looking at the winners. */
export const PODIUM_CAMERA = { y: 2.6, back: 8.5, lookY: 1.2 };
