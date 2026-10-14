import { PerspectiveCamera, Vector3 } from 'three';
import type { Vec } from './flight';

export interface HomeView {
  cam: Vec;
  look: Vec;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * The batting view: behind and above home plate, looking out at the pitcher. On a wide screen
 * there is little height to spare, so the camera comes down a little: people then take up more of
 * the picture and the ground less.
 */
export function homeView(aspect: number): HomeView {
  const wide = clamp((aspect - 0.9) / 0.9, 0, 1);
  return {
    cam: { x: 0.4, y: lerp(4.7, 3.5, wide), z: lerp(11.8, 11, wide) },
    look: { x: 0, y: lerp(1.3, 1.5, wide), z: -8 },
  };
}

/** What the view must hold: the pitcher's cap down to the umpire's feet. */
const TOP_POINT = { x: 0, y: 3.0, z: -8.2 };
const BOTTOM_POINT = { x: 1.3, y: 0, z: 3.6 };
/** On a wide screen the answers sit low and hide the umpire's legs, so his waist will do. */
const BOTTOM_POINT_WIDE = { x: 1.3, y: 0.9, z: 3.4 };
/** Distance from the camera to the mound, where the sideways room is measured. */
const MOUND_DISTANCE = 20;

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

export interface PlayBand {
  /** Screen rows (px from the top) the question and score leave clear, and the answers leave clear. */
  top: number;
  bottom: number;
}

/**
 * The part of the screen between the question at the top and the answers along the bottom, in
 * CSS pixels. Mirrors the HUD in style.css: on a narrow phone the scoreboard and question stack
 * up the top and the four answers wrap into two rows.
 */
export function playBand(width: number, height: number): PlayBand {
  return { top: width <= 640 ? 236 : 100, bottom: height - (width <= 560 ? 160 : 84) };
}

export interface ViewFit {
  /** Vertical field of view in degrees. */
  fov: number;
  /** Pixels to slide the picture up (negative to slide down) so the action sits in the band. */
  shift: number;
}

const probe = new PerspectiveCamera();

/** Screen row of a point for the resting view at a given fov and aspect. */
function rowAt(fov: number, aspect: number, height: number, p: Vec): number {
  const { cam, look } = homeView(aspect);
  probe.fov = fov;
  probe.aspect = aspect;
  probe.near = 0.3;
  probe.far = 500;
  probe.updateProjectionMatrix();
  probe.position.set(cam.x, cam.y, cam.z);
  probe.lookAt(look.x, look.y, look.z);
  probe.updateMatrixWorld();
  const v = new Vector3(p.x, p.y, p.z).project(probe);
  return ((1 - v.y) / 2) * height;
}

/**
 * Field of view and vertical shift for a screen: wide enough that the pitcher and the plate fit
 * between the question and the answers, and that there is room either side of the mound (the
 * infielders too, on a wide screen).
 */
export function fitView(width: number, height: number): ViewFit {
  const w = Math.max(width, 1);
  const h = Math.max(height, 1);
  const aspect = w / h;
  const band = playBand(w, h);
  const room = Math.max(band.bottom - band.top, 60) * 0.94;
  const bottomPoint = aspect > 1.2 ? BOTTOM_POINT_WIDE : BOTTOM_POINT;
  // Narrowest field of view that fits the pitcher-to-plate span in the band.
  let fov = 30;
  while (fov < 88) {
    const span = rowAt(fov, aspect, h, bottomPoint) - rowAt(fov, aspect, h, TOP_POINT);
    if (span <= room) break;
    fov += 1;
  }
  // And wide enough to show some field either side of the mound.
  const need = aspect < 0.9 ? 4.2 : aspect < 1.4 ? 7 : 9;
  const tanV = need / (MOUND_DISTANCE * aspect);
  fov = clamp(Math.max(fov, (2 * Math.atan(tanV) * 180) / Math.PI), 30, 88);
  const mid = (rowAt(fov, aspect, h, bottomPoint) + rowAt(fov, aspect, h, TOP_POINT)) / 2;
  return { fov, shift: mid - (band.top + band.bottom) / 2 };
}

/**
 * Where the camera wants to be, and what it looks at, to follow a ball at `ball`. The camera
 * stays back near home (tilting and panning rather than chasing), and holds the usual view until
 * the ball has left the infield, so the swing and the first flight are seen from behind the plate.
 */
export function followGoal(ball: Vec, cam: Vec, look: Vec, home: HomeView): void {
  const lead = clamp(Math.abs(ball.z) / 12, 0, 1);
  const height = clamp(ball.y, 0, 15);
  cam.x = home.cam.x + ball.x * 0.1 * lead;
  cam.y = home.cam.y + 2.2 * lead + height * 0.14;
  cam.z = home.cam.z + ball.z * 0.08 * lead;
  look.x = home.look.x + (ball.x * 0.9 - home.look.x) * lead;
  look.y = home.look.y + (clamp(ball.y * 0.8, 1.2, 32) - home.look.y) * lead;
  look.z = home.look.z + (ball.z - home.look.z) * lead;
}
