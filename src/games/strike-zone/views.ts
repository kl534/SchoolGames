import { PerspectiveCamera, Vector3 } from 'three';
import {
  AIM_LIMIT,
  BOWLER_Z,
  DECK_BACK_Z,
  HEAD_Z,
  KICKBACK_X,
  PIN_H,
  PIN_IDS,
  ROW_GAP,
  pinSpot,
  type Vec,
} from './geometry';
import { BENCH_Z } from './friends';
import { BOWLER_HAND_X } from './bowler';

/**
 * How the HUD is arranged for a screen size. Mirrors the media queries in style.css:
 * - `stacked`: any screen held upright (taller than it is wide, or nearly square), phone or
 *   tablet; the scorecard and question stack up the top.
 * - `compact`: a short landscape phone; everything smaller, so the lane keeps most of the screen.
 * - `standard`: everything else.
 */
export type HudLayout = 'stacked' | 'compact' | 'standard';

export function hudLayout(width: number, height: number): HudLayout {
  const aspect = width / Math.max(height, 1);
  if (aspect <= 1.2) return 'stacked';
  if (height <= 380 && aspect >= 1.2) return 'compact';
  return 'standard';
}

export interface PlayBand {
  /** Screen rows (px from the top) the HUD above leaves clear, and the HUD below leaves clear. */
  top: number;
  bottom: number;
}

/** Pixels to slide the picture so the middle of the screen's view lands in the middle of a band. */
export function centreShift(height: number, band: PlayBand): number {
  return height / 2 - (band.top + band.bottom) / 2;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

const probe = new PerspectiveCamera();
const scratch = new Vector3();

/** Screen position (px, before any view offset) of a point seen from the camera. */
export function project(
  p: Vec,
  cam: Vec,
  look: Vec,
  fov: number,
  width: number,
  height: number,
): { x: number; y: number; behind: boolean } {
  probe.fov = fov;
  probe.aspect = width / Math.max(height, 1);
  probe.near = 0.3;
  probe.far = 600;
  probe.clearViewOffset();
  probe.updateProjectionMatrix();
  probe.position.set(cam.x, cam.y, cam.z);
  probe.lookAt(look.x, look.y, look.z);
  probe.updateMatrixWorld();
  const v = scratch.set(p.x, p.y, p.z).project(probe);
  return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height, behind: v.z > 1 };
}

/** The aim view is a long lens, so it may zoom in far. */
const MIN_FOV = 8;
const MAX_FOV = 85;
/** Share of the band kept clear at each end, and of the width at each side. */
const BAND_MARGIN = 0.06;
const SIDE_MARGIN = 0.1;

/**
 * Fits a view: the look point and the vertical FOV that put every key point inside the band (with
 * ~6% margins) and inside the screen's width (~10% margins). The camera looks towards the middle
 * of the points, turned and tilted so that middle is in the middle of the screen; the FOV is the
 * narrowest (8 to 85 degrees) that fits. `shift` is `centreShift(height, band)` for
 * `camera.setViewOffset`.
 */
export function fitView(
  cam: Vec,
  keys: Vec[],
  width: number,
  height: number,
  band: PlayBand,
): { look: Vec; fov: number; shift: number } {
  const mean = { x: 0, y: 0, z: 0 };
  for (const k of keys) {
    mean.x += k.x / keys.length;
    mean.y += k.y / keys.length;
    mean.z += k.z / keys.length;
  }
  let yaw = Math.atan2(mean.x - cam.x, mean.z - cam.z);
  const elevations = keys.map((k) => Math.atan2(k.y - cam.y, Math.hypot(k.x - cam.x, k.z - cam.z)));
  let pitch = (Math.min(...elevations) + Math.max(...elevations)) / 2;
  const lookFor = (pitchNow: number): Vec => ({
    x: cam.x + Math.sin(yaw) * Math.cos(pitchNow) * 10,
    y: cam.y + Math.sin(pitchNow) * 10,
    z: cam.z + Math.cos(yaw) * Math.cos(pitchNow) * 10,
  });
  const bandH = Math.max(band.bottom - band.top, 1);
  const marginY = bandH * BAND_MARGIN;
  const marginX = width * SIDE_MARGIN;

  let fov = MIN_FOV;
  let look = lookFor(pitch);
  for (; fov <= MAX_FOV; fov += 0.5) {
    // Tilt until the points' vertical middle sits in the middle of the screen.
    const focal = height / 2 / Math.tan((fov * Math.PI) / 360);
    for (let i = 0; i < 12; i++) {
      const at = keys.map((k) => project(k, cam, look, fov, width, height));
      const rows = at.map((a) => a.y);
      const cols = at.map((a) => a.x);
      const mid = (Math.min(...rows) + Math.max(...rows)) / 2;
      const across = (Math.min(...cols) + Math.max(...cols)) / 2;
      pitch -= Math.atan((mid - height / 2) / focal);
      // Raising the yaw turns the camera left: content right of the middle needs a smaller one.
      yaw -= Math.atan((across - width / 2) / focal);
      look = lookFor(pitch);
    }
    const shown = keys.map((k) => project(k, cam, look, fov, width, height));
    const top = Math.min(...shown.map((s) => s.y));
    const bottom = Math.max(...shown.map((s) => s.y));
    const left = Math.min(...shown.map((s) => s.x));
    const right = Math.max(...shown.map((s) => s.x));
    if (
      bottom - top <= bandH - 2 * marginY &&
      left >= marginX &&
      right <= width - marginX &&
      !shown.some((s) => s.behind)
    ) {
      break;
    }
  }
  return { look, fov: clamp(fov, MIN_FOV, MAX_FOV), shift: centreShift(height, band) };
}

// ---------- The four views ----------

/** A camera placed in the world, ready for `camera.position` / `lookAt` / `fov` / `setViewOffset`. */
export interface CamView {
  pos: Vec;
  look: Vec;
  fov: number;
  shift: number;
}

/** Behind the bowler and a little above. (default) */
export const AIM_CAM: Vec = { x: 0, y: 3.4, z: 12 };
/** Low and to the left, just in front of the head pin and just above the kickback. (default) */
export const PINS_CAM: Vec = { x: -0.9, y: 0.62, z: HEAD_Z + 1.5 };
/** On the floor in front of the bench, looking at the three friends. */
export const FRIENDS_CAM: Vec = { x: -2.6, y: 1.15, z: 1.7 };

/** What the aim view holds, whatever the aim: the back-row pins, the deck, the ball and the bowler. */
export function aimKeys(): Vec[] {
  const backRow = HEAD_Z - 3 * ROW_GAP;
  return [
    { x: -0.46, y: PIN_H, z: backRow },
    { x: 0.46, y: PIN_H, z: backRow },
    { x: -0.6, y: 0, z: HEAD_Z + 0.2 },
    { x: 0.6, y: 0, z: HEAD_Z + 0.2 },
    { x: -AIM_LIMIT, y: 0, z: BOWLER_Z },
    { x: AIM_LIMIT, y: 0, z: BOWLER_Z },
    { x: -AIM_LIMIT - BOWLER_HAND_X, y: 1.5, z: BOWLER_Z },
    { x: AIM_LIMIT - BOWLER_HAND_X, y: 1.5, z: BOWLER_Z },
  ];
}

/** What the pin cam holds: every pin, top and bottom, and the corners of the kickbacks. */
export function pinsKeys(): Vec[] {
  const keys: Vec[] = [];
  for (const id of PIN_IDS) {
    const spot = pinSpot(id);
    keys.push({ x: spot.x, y: PIN_H, z: spot.z }, { x: spot.x, y: 0, z: spot.z });
  }
  keys.push(
    { x: -KICKBACK_X, y: 0, z: DECK_BACK_Z },
    { x: KICKBACK_X, y: 0, z: DECK_BACK_Z },
    { x: -KICKBACK_X, y: 0.5, z: HEAD_Z + 0.2 },
    { x: KICKBACK_X, y: 0.5, z: HEAD_Z + 0.2 },
  );
  return keys;
}

/** What the friends' shot holds: the ends of the bench and the friends' heads standing. */
export function friendsKeys(): Vec[] {
  return [
    { x: -3.6, y: 0, z: BENCH_Z },
    { x: -1.6, y: 0, z: BENCH_Z },
    { x: -3.6, y: 1.5, z: BENCH_Z },
    { x: -1.6, y: 1.5, z: BENCH_Z },
  ];
}

/** The follow view: behind and above the ball, looking down the lane ahead of it. */
export function followView(ball: Vec, band: PlayBand, height: number): CamView {
  return {
    pos: { x: ball.x - 0.4 * ball.x, y: 0.85, z: ball.z + 2.6 },
    look: { x: 0.6 * ball.x, y: 0.15, z: ball.z - 6 },
    fov: 50,
    shift: centreShift(height, band),
  };
}
