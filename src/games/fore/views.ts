import { PerspectiveCamera, Vector3 } from 'three';
import { centreX, type Hole } from './course';
import { ringRadius } from './guide';
import type { Plan } from './shot';

export interface Vec {
  x: number;
  y: number;
  z: number;
}

/**
 * How the HUD is arranged for a screen size; mirrors the media queries in style.css.
 * `stacked` is any screen held upright (aspect <= 6/5), `landscape` is everything else.
 */
export type HudLayout = 'stacked' | 'landscape';

export function hudLayout(width: number, height: number): HudLayout {
  return width / Math.max(height, 1) <= 1.2 ? 'stacked' : 'landscape';
}

/** The part of the screen the HUD leaves clear (px from the top and the left). */
export interface PlayBand {
  top: number;
  bottom: number;
  left?: number;
  right?: number;
}

/** Pixels to slide the picture so the middle of the screen's view lands in the middle of a band. */
export function centreShift(height: number, band: PlayBand): number {
  return height / 2 - (band.top + band.bottom) / 2;
}

export function centreShiftX(width: number, band: PlayBand): number {
  return width / 2 - ((band.left ?? 0) + (band.right ?? width)) / 2;
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
  probe.far = 1200;
  probe.clearViewOffset();
  probe.updateProjectionMatrix();
  probe.position.set(cam.x, cam.y, cam.z);
  probe.lookAt(look.x, look.y, look.z);
  probe.updateMatrixWorld();
  const v = scratch.set(p.x, p.y, p.z).project(probe);
  return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height, behind: v.z > 1 };
}

const MIN_FOV = 6;
const MAX_FOV = 70;
const BAND_MARGIN = 0.06;
const SIDE_MARGIN = 0.1;

export interface CamView {
  pos: Vec;
  look: Vec;
  fov: number;
  /** View offset in px that slides the picture into the free band. */
  shift: number;
  shiftX: number;
}

/**
 * Fits a view: the look point and the narrowest vertical FOV (6 to 70 degrees) that put every key
 * point inside the band (with margins) and the band's width. The camera turns and tilts so the
 * middle of the points is in the middle of the screen; the view offset then slides that into the
 * free band.
 */
export function fitView(
  cam: Vec,
  keys: Vec[],
  width: number,
  height: number,
  band: PlayBand,
): CamView {
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
  const bandW = Math.max((band.right ?? width) - (band.left ?? 0), 1);
  const marginY = bandH * BAND_MARGIN;
  const marginX = bandW * SIDE_MARGIN;

  let fov = MIN_FOV;
  let look = lookFor(pitch);
  for (; fov <= MAX_FOV; fov += 1) {
    const focal = height / 2 / Math.tan((fov * Math.PI) / 360);
    for (let i = 0; i < 8; i++) {
      const at = keys.map((k) => project(k, cam, look, fov, width, height));
      const rows = at.map((a) => a.y);
      const cols = at.map((a) => a.x);
      const mid = (Math.min(...rows) + Math.max(...rows)) / 2;
      const across = (Math.min(...cols) + Math.max(...cols)) / 2;
      pitch -= Math.atan((mid - height / 2) / focal);
      yaw -= Math.atan((across - width / 2) / focal);
      look = lookFor(pitch);
    }
    const shown = keys.map((k) => project(k, cam, look, fov, width, height));
    const tall = Math.max(...shown.map((s) => s.y)) - Math.min(...shown.map((s) => s.y));
    const wide = Math.max(...shown.map((s) => s.x)) - Math.min(...shown.map((s) => s.x));
    if (
      tall <= bandH - 2 * marginY &&
      wide <= bandW - 2 * marginX &&
      !shown.some((s) => s.behind)
    ) {
      break;
    }
  }
  return {
    pos: cam,
    look,
    fov: clamp(fov, MIN_FOV, MAX_FOV),
    shift: centreShift(height, band),
    shiftX: centreShiftX(width, band),
  };
}

// ---------- The views ----------

/** Yards behind the ball the aim camera stands, and how high. */
export const AIM_BEHIND = 9;
export const AIM_UP = 3.5;
/** The pin is part of the aim view when it is this near the ball. */
export const PIN_IN_VIEW = 120;

const forward = (dir: number) => ({ x: Math.sin(dir), z: Math.cos(dir) });

/** Behind the ball, looking at the ring (and the pin when it is close). */
export function aimView(
  plan: Plan,
  hole: Hole,
  golfer: Vec,
  width: number,
  height: number,
  band: PlayBand,
): CamView {
  const f = forward(plan.dir);
  const cam = { x: plan.from.x - f.x * AIM_BEHIND, y: AIM_UP, z: plan.from.z - f.z * AIM_BEHIND };
  const r = ringRadius(plan.carry);
  const side = { x: Math.cos(plan.dir), z: -Math.sin(plan.dir) };
  const keys: Vec[] = [
    { x: plan.landing.x - side.x * r, y: 0, z: plan.landing.z - side.z * r },
    { x: plan.landing.x + side.x * r, y: 0, z: plan.landing.z + side.z * r },
    { x: plan.landing.x, y: 1, z: plan.landing.z },
    // The ball itself, so it is never cut off below the screen.
    { x: plan.from.x, y: 0, z: plan.from.z },
    // The golfer, head to toe on an upright screen; a short landscape band shows from the knees.
    { x: golfer.x, y: 2.1, z: golfer.z },
    { x: golfer.x, y: width / Math.max(height, 1) > 1.2 ? 0.9 : 0.1, z: golfer.z },
  ];
  const toPin = Math.hypot(hole.pin.x - plan.from.x, hole.pin.z - plan.from.z);
  if (toPin <= PIN_IN_VIEW) {
    keys.push({ x: hole.pin.x, y: 0, z: hole.pin.z }, { x: hole.pin.x, y: 2.4, z: hole.pin.z });
  }
  return fitView(cam, keys, width, height, band);
}

/** The camera chases the ball from behind and above. */
export function followView(
  ball: Vec,
  dir: number,
  putt: boolean,
  width: number,
  height: number,
  band: PlayBand,
): CamView {
  const f = forward(dir);
  const behind = putt ? 5 : 12;
  const up = putt ? 2.5 : 5;
  return {
    pos: { x: ball.x - f.x * behind, y: up + ball.y * 0.5, z: ball.z - f.z * behind },
    look: { x: ball.x + f.x * 20, y: 0.5 + ball.y * 0.4, z: ball.z + f.z * 20 },
    fov: 50,
    shift: centreShift(height, band),
    shiftX: centreShiftX(width, band),
  };
}

/** Hovers behind and above the spot where the ball finished. */
export function landView(
  rest: Vec,
  dir: number,
  width: number,
  height: number,
  band: PlayBand,
): CamView {
  const f = forward(dir);
  return {
    pos: { x: rest.x - f.x * 14, y: 8, z: rest.z - f.z * 14 },
    look: { x: rest.x, y: 0, z: rest.z },
    fov: 42,
    shift: centreShift(height, band),
    shiftX: centreShiftX(width, band),
  };
}

/**
 * The hole from above, for the intro: a sweep from the tee towards the pin. `progress` runs 0
 * (looking down the first part of the hole from behind the tee) to 1 (hovering over the green).
 */
export function introView(
  hole: Hole,
  width: number,
  height: number,
  band: PlayBand,
  progress = 0,
): CamView {
  const u = clamp(progress, 0, 1);
  const e = u * u * (3 - 2 * u);
  const lookFrom = Math.min(hole.length * 0.3, 70);
  const lookTo = hole.length - 10;
  const lookZ = lookFrom + (lookTo - lookFrom) * e;
  const camTo = Math.max(-45, hole.length - 95);
  const camZ = -45 + (camTo + 45) * e;
  return {
    pos: { x: centreX(hole, Math.max(camZ, 0)), y: 55 - 10 * e, z: camZ },
    look: { x: centreX(hole, lookZ), y: 0, z: lookZ },
    fov: 55,
    shift: centreShift(height, band),
    shiftX: centreShiftX(width, band),
  };
}
