import { PerspectiveCamera, Vector3 } from 'three';
import {
  BOARD,
  FT_SPOT,
  GUARD_R,
  OFFENSE_R,
  RIM,
  RIM_GROUND,
  clamp,
  dirXZ,
  rightOf,
  spotPos,
  type Vec,
} from './geometry';

/**
 * How the HUD is arranged for a screen size. Mirrors the media queries in style.css:
 * - `stacked`: any screen held upright (taller than it is wide, or nearly square), phone or
 *   tablet; the scorebug and question stack up the top. On a narrow phone the four answers also
 *   wrap into two rows.
 * - `compact`: a short landscape phone; a smaller scorebug, question and answers, so that the
 *   court keeps most of the screen.
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
  /** Screen rows (px from the top) the question and score leave clear, and the answers leave clear. */
  top: number;
  bottom: number;
  /** Screen columns the action may use, when something takes the rest. */
  left?: number;
  right?: number;
}

/**
 * The part of the screen between the question at the top and the answers along the bottom, in
 * CSS pixels, from the HUD's layout. `layout()` in main.ts measures the real thing; this is the
 * same thing worked out, for tests and for before there is anything to measure.
 */
export function playBand(width: number, height: number): PlayBand {
  const layout = hudLayout(width, height);
  if (layout === 'stacked') {
    return { top: width > 640 ? 262 : 248, bottom: height - (width <= 560 ? 158 : 92) };
  }
  if (layout === 'compact') return { top: 76, bottom: height - 72 };
  return { top: height >= 700 ? 115 : 104, bottom: height - (height <= 460 ? 84 : 92) };
}

/**
 * Whether a call goes in the question panel rather than on a card beside the court. A wide,
 * roomy screen has space at the side; on a tall, narrow or short one any card would sit on the
 * players.
 */
export function callInPanel(width: number, height: number): boolean {
  return width <= 640 || width <= height * 1.2 || hudLayout(width, height) === 'compact';
}

/** Where the scorebug ends when it can't be measured (it sits under the Menu button). */
const BUG_BOTTOM: Record<HudLayout, number> = { stacked: 143, standard: 143, compact: 120 };
/** Space kept between the scorebug and a view of the court. */
const BAND_GAP = 8;
/** Space left at the bottom while a play runs, where the answers were. */
const BAND_FOOT = 12;

/**
 * The part of the screen that stays clear while a play runs. The question and the answers are
 * hidden then, so only the scorebug is in the way.
 */
export function playingBand(
  width: number,
  height: number,
  bugBottom: number = BUG_BOTTOM[hudLayout(width, height)],
): PlayBand {
  return { top: bugBottom + BAND_GAP, bottom: height - BAND_FOOT };
}

/** Pixels to slide the picture so the middle of the screen's view lands in the middle of a band. */
export function centreShift(height: number, band: PlayBand): number {
  return height / 2 - (band.top + band.bottom) / 2;
}

/** A rectangle on screen, in CSS px. */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Whether two screen rectangles overlap (touching edges do not count). */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/** Space kept between the scorebug and a question moved down below it. */
export const QUESTION_GAP = 8;
/** How far the question may nudge into the scorebug's edge before it counts as a collision. */
export const QUESTION_SLACK = 12;

/**
 * Where the question panel's top edge should be (px from the top) so that it does not sit on the
 * scorebug: `null` when the two do not overlap, otherwise just below the scorebug.
 */
export function questionTopBelowBug(question: Rect, bug: Rect): number | null {
  const core: Rect = {
    left: bug.left + QUESTION_SLACK,
    top: bug.top + QUESTION_SLACK,
    right: bug.right - QUESTION_SLACK,
    bottom: bug.bottom - QUESTION_SLACK,
  };
  return rectsOverlap(question, core) ? bug.bottom + QUESTION_GAP : null;
}

/** Room kept between a pop-up and the edges of the band or screen, in CSS px. */
const POP_MARGIN = 30;

/**
 * Where a pop-up goes on screen for a point in the world that projects to `shown` (CSS px;
 * `behind` when the point is behind the camera). It stays inside the band, so it is clear of the
 * scorebug and the answers; if the point is not in view, it goes in the middle of the band.
 */
export function popPosition(
  shown: { x: number; y: number },
  behind: boolean,
  width: number,
  band: PlayBand,
): { x: number; y: number } {
  const left = (band.left ?? 0) + POP_MARGIN;
  const right = Math.min(band.right ?? width, width) - POP_MARGIN;
  const top = band.top + POP_MARGIN;
  const bottom = Math.max(band.bottom - POP_MARGIN, top);
  const inView =
    !behind && shown.x >= left && shown.x <= right && shown.y >= top && shown.y <= bottom;
  if (!inView) return { x: (left + right) / 2, y: (top + bottom) / 2 };
  return { x: shown.x, y: shown.y };
}

// ---------- The two views ----------

/** Shooter's head height, for the key points. */
const HEAD_Y = 2.1;

/**
 * Behind and above the shooter at `shooter`, looking toward the hoop.
 * u = horizontal unit vector RIM_GROUND -> shooter; p = u turned 90 degrees to the right.
 */
export function offenseCam(shooter: Vec): Vec {
  const u = dirXZ(RIM_GROUND, shooter);
  const p = rightOf(u);
  return {
    x: shooter.x + 5.5 * u.x + 0.6 * p.x,
    y: shooter.y + 3.4,
    z: shooter.z + 5.5 * u.z + 0.6 * p.z,
  };
}

/** What the offense view must hold: the backboard top, the shot clock, the shooter. */
export function offenseKeys(shooter: Vec): Vec[] {
  return [
    { x: -BOARD.x, y: BOARD.yTop, z: BOARD.z },
    { x: BOARD.x, y: BOARD.yTop, z: BOARD.z },
    { x: 0, y: 4.5, z: BOARD.z },
    { x: shooter.x, y: 0, z: shooter.z },
    { x: shooter.x, y: HEAD_Y, z: shooter.z },
  ];
}

/** High behind the baseline, on the ball's side, so the backboard never hides the players. */
export function defenseCam(angleDeg: number): Vec {
  const side = angleDeg < 0 ? -1 : 1;
  return { x: 2.6 * side, y: 5.4, z: -3.2 };
}

/** What the defense view must hold: the rim, the rival, our defender and the floor under the rim. */
export function defenseKeys(angleDeg: number): Vec[] {
  const s = spotPos(angleDeg, OFFENSE_R);
  const g = spotPos(angleDeg, GUARD_R);
  return [
    { ...RIM },
    { x: s.x, y: 0, z: s.z },
    { x: s.x, y: HEAD_Y, z: s.z },
    { x: g.x, y: 0, z: g.z },
    { x: 0, y: 0, z: 2.5 },
  ];
}

/** The view for a free throw by us. */
export const ftCam = (): Vec => offenseCam(FT_SPOT);

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

const MIN_FOV = 30;
const MAX_FOV = 85;
/** Share of the band kept clear at each end, and of the width at each side. */
const BAND_MARGIN = 0.06;
const SIDE_MARGIN = 0.04;

/**
 * Fits a view: the look point and the vertical FOV that put every key point inside the play band
 * (with ~6% margins) and inside the screen's width (~4% margins). The camera looks towards the
 * mean of the points, turned and tilted so the points' middle is in the middle of the screen; the
 * FOV is the narrowest (30 to 85 degrees) that fits. `shift` is `centreShift(height, band)` for
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

/** True if the segment from `cam` to `point` passes through the backboard rectangle. */
export function boardBlocks(cam: Vec, point: Vec): boolean {
  const dz = point.z - cam.z;
  if (Math.abs(dz) < 1e-9) return false;
  const t = (BOARD.z - cam.z) / dz;
  if (t <= 0 || t >= 1) return false;
  const x = cam.x + (point.x - cam.x) * t;
  const y = cam.y + (point.y - cam.y) * t;
  return Math.abs(x) <= BOARD.x && y >= BOARD.yBottom && y <= BOARD.yTop;
}
