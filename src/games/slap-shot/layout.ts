import { clamp, type Vec } from './geometry';

/**
 * How the HUD is arranged for a screen size. Mirrors the media queries in style.css:
 * - `stacked`: a screen held upright; the scorebug and the question stack up the top.
 * - `compact`: a short landscape phone; everything smaller so the rink keeps the middle.
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
}

/**
 * The part of the screen between the question at the top and the answers along the bottom, in
 * CSS pixels. `layout()` in main.ts measures the real thing; this is the same thing worked out,
 * for tests and for before there is anything to measure.
 */
export function playBand(width: number, height: number): PlayBand {
  const layout = hudLayout(width, height);
  if (layout === 'stacked') {
    return { top: width > 640 ? 262 : 250, bottom: height - (width <= 560 ? 158 : 92) };
  }
  if (layout === 'compact') return { top: 76, bottom: height - 72 };
  return { top: height >= 700 ? 115 : 104, bottom: height - (height <= 460 ? 84 : 92) };
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

/** Room kept between a pop-up and the edges of the band or screen, in CSS px. */
const POP_MARGIN = 30;

/** Where a pop-up goes on screen: inside the band, or in the middle of it if the point is not. */
export function popPosition(
  shown: { x: number; y: number },
  behind: boolean,
  width: number,
  band: PlayBand,
): { x: number; y: number } {
  const left = POP_MARGIN;
  const right = width - POP_MARGIN;
  const top = band.top + POP_MARGIN;
  const bottom = Math.max(band.bottom - POP_MARGIN, top);
  const inView =
    !behind && shown.x >= left && shown.x <= right && shown.y >= top && shown.y <= bottom;
  if (!inView) return { x: (left + right) / 2, y: (top + bottom) / 2 };
  return { x: shown.x, y: shown.y };
}

// ---------- The camera ----------

export const CAMERA_HEIGHT = 7.5;
export const CAMERA_BACK = 11;
export const CAMERA_MIN_X = -38;
export const CAMERA_MAX_X = 12;
export const CAMERA_EASE = 3;
const MIN_FOV = 45;
const MAX_FOV = 85;

/** Where the camera wants to be and look for a point of focus (the puck or its carrier). */
export function cameraTarget(focus: Vec): { pos: Vec; look: Vec } {
  return {
    pos: {
      x: clamp(focus.x - CAMERA_BACK, CAMERA_MIN_X, CAMERA_MAX_X),
      y: CAMERA_HEIGHT,
      z: focus.z * 0.4,
    },
    look: { x: focus.x + 5, y: 0, z: focus.z * 0.5 },
  };
}

/** Vertical field of view (degrees) that keeps the rink's width in view, 45 to 85 degrees. */
export function fovFor(aspect: number): number {
  const fov =
    (2 * Math.atan(Math.tan((36 * Math.PI) / 180) / Math.max(aspect, 0.1)) * 180) / Math.PI;
  return clamp(fov, MIN_FOV, MAX_FOV);
}
