/** Screen fitting for the side view, free of three.js so it is easy to test. */

/** CSS pixels: the space between the question panel at the top and the answers at the bottom. */
export interface PlayBand {
  top: number;
  bottom: number;
}

/** Vertical field of view in degrees; a narrow view reads as flat, side-on. */
export const FOV = 28;
/** The tallest stunt, loop top plus the bike (u). */
export const OBSTACLE_MAX_H = 7.2;
/** Road face shown below the ground line (u). */
export const GROUND_MARGIN = 1.0;
/** Least width the screen shows (u), which is the limit on a portrait phone. */
export const MIN_VIEW_W = 12;
/** The bike sits this fraction of the width from the left. */
export const BIKE_COL = 0.28;

/**
 * The part of the screen the HUD leaves clear, in CSS pixels. Mirrors the HUD in style.css: on a
 * portrait phone the question and the road strip sit below the menu buttons and the answers wrap
 * into two rows; in a short landscape phone everything is squeezed to the edges.
 */
export function playBand(width: number, height: number): PlayBand {
  if (height <= 460) return { top: 96, bottom: height - 84 };
  if (width <= 640) return { top: 250, bottom: height - 170 };
  return { top: 118, bottom: height - 100 };
}

export interface Fit {
  /** Pixels per world unit at the bike's depth. */
  ppu: number;
  /** Width and height of the screen in world units at the bike's depth. */
  viewW: number;
  viewH: number;
  /** Screen row (px from the top) of the road surface. */
  groundRow: number;
  /** Camera distance from the z = 0 plane, and the camera's height above the road. */
  distance: number;
  camY: number;
  /** How much road the screen shows in front of the bike: viewW * (1 - BIKE_COL). */
  ahead: number;
}

/**
 * ppu = min(bandHeight / (OBSTACLE_MAX_H + GROUND_MARGIN), width / MIN_VIEW_W). The stunt area
 * (OBSTACLE_MAX_H + GROUND_MARGIN tall) is centred in the band, so the road sits at
 * `groundRow`. The camera looks horizontally from `camY` above the road, which puts the road at
 * that row of the screen.
 */
export function fitView(width: number, height: number): Fit {
  const w = Math.max(width, 1);
  const h = Math.max(height, 1);
  const band = playBand(w, h);
  const bandHeight = Math.max(band.bottom - band.top, 1);
  const ppu = Math.min(bandHeight / (OBSTACLE_MAX_H + GROUND_MARGIN), w / MIN_VIEW_W);
  const viewW = w / ppu;
  const viewH = h / ppu;
  const used = (OBSTACLE_MAX_H + GROUND_MARGIN) * ppu;
  const slack = bandHeight - used;
  const groundRow = band.top + slack / 2 + OBSTACLE_MAX_H * ppu;
  const distance = viewH / 2 / Math.tan((FOV * Math.PI) / 360);
  // The road is (groundRow - h / 2) / ppu below the middle of the screen, where the camera looks.
  const camY = (groundRow - h / 2) / ppu;
  return { ppu, viewW, viewH, groundRow, distance, camY, ahead: viewW * (1 - BIKE_COL) };
}
