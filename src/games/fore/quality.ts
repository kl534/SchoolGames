/**
 * How good Fore! looks on this device: three tiers, the numbers each one uses, the rules that pick
 * a tier and step it down, and the two readings of the sky picture (where the sun is and the
 * horizon colour). Pure: no three.js scene objects, no DOM.
 */

export type Gfx = 'low' | 'medium' | 'high';

export interface GfxSettings {
  /** Cap passed to renderer.setPixelRatio. */
  pixelRatio: number;
  /** Samples on the composer target (0 = none). */
  msaa: number;
  /** The EffectComposer is used at all. */
  post: boolean;
  bloom: boolean;
  ao: boolean;
  dof: boolean;
  shadows: 'none' | 'single' | 'cascaded';
  /** Map size per cascade. */
  shadowSize: number;
  cascades: number;
  /** Yards. */
  shadowFar: number;
  water: 'mirror' | 'env';
  /** Leaf cards per broadleaf tree (pines use 0.6 x this). */
  treeLeafCards: number;
  /** Share of scenery trees and bushes kept (gameplay trees always are). */
  sceneryShare: number;
  /** Close grass blades around the ball. */
  blades: number;
  /** Tall fescue clumps per hole. */
  tufts: number;
  /** Spectators per green. */
  gallery: number;
}

export const GFX_SETTINGS: Record<Gfx, GfxSettings> = {
  low: {
    pixelRatio: 1,
    msaa: 0,
    post: false,
    bloom: false,
    ao: false,
    dof: false,
    shadows: 'none',
    shadowSize: 0,
    cascades: 0,
    shadowFar: 0,
    water: 'env',
    treeLeafCards: 140,
    sceneryShare: 0.5,
    blades: 0,
    tufts: 600,
    gallery: 0,
  },
  medium: {
    pixelRatio: 1.5,
    msaa: 4,
    post: true,
    bloom: true,
    ao: false,
    dof: false,
    shadows: 'single',
    shadowSize: 2048,
    cascades: 1,
    shadowFar: 60,
    water: 'env',
    treeLeafCards: 260,
    sceneryShare: 0.8,
    blades: 15000,
    tufts: 1500,
    gallery: 14,
  },
  high: {
    pixelRatio: 2,
    msaa: 4,
    post: true,
    bloom: true,
    ao: true,
    dof: true,
    shadows: 'cascaded',
    shadowSize: 2048,
    cascades: 3,
    shadowFar: 320,
    water: 'mirror',
    treeLeafCards: 420,
    sceneryShare: 1,
    blades: 40000,
    tufts: 3000,
    gallery: 24,
  },
};

export const gfxSettings = (g: Gfx): GfxSettings => GFX_SETTINGS[g];

export interface DeviceInfo {
  /** The unmasked WebGL renderer string ('' if unknown). */
  gpu: string;
  /** navigator.hardwareConcurrency (0 if unknown). */
  cores: number;
  /** The shorter side of the screen, CSS px. */
  minSide: number;
  mobile: boolean;
}

const WEAK_GPU =
  /swiftshader|llvmpipe|software|mali-[gt]\d{2}\b|adreno \(tm\) [3-5]\d\d|powervr|intel.*(hd|uhd) graphics \d{3}\b/i;

/** The tier a device starts on; the first matching rule wins. */
export function pickGfx(d: DeviceInfo): Gfx {
  if (WEAK_GPU.test(d.gpu)) return 'low';
  if (d.mobile && d.minSide < 500) return 'medium';
  if (d.cores > 0 && d.cores <= 4) return 'medium';
  return 'high';
}

/** A frame slower than this (ms, median of the first 120) drops a tier. */
export const SLOW_FRAME_MS = 28;

/** One tier down when the median frame is slow, else the same. Never goes below low. */
export function adaptGfx(medianFrameMs: number, current: Gfx): Gfx {
  if (medianFrameMs <= SLOW_FRAME_MS) return current;
  return current === 'high' ? 'medium' : 'low';
}

/**
 * Where the sun is in an equirectangular picture: the brightest texel. `data` is row-major with
 * row 0 at the top (elevation +90) and `stride` floats per texel (3 or 4, red first). Returns the
 * direction in three.js' equirect frame as radians: `phi` (atan2(z, x), the way the picture wraps)
 * and `elevation` above the horizon.
 */
export function brightestDirection(
  data: ArrayLike<number>,
  width: number,
  height: number,
  stride = 4,
): { phi: number; elevation: number } {
  let best = -1;
  let bx = 0;
  let by = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * stride;
      const v = data[o] + data[o + 1] + data[o + 2];
      if (v > best) {
        best = v;
        bx = x;
        by = y;
      }
    }
  }
  const u = (bx + 0.5) / width;
  const v = 1 - (by + 0.5) / height;
  return { phi: (u - 0.5) * 2 * Math.PI, elevation: (v - 0.5) * Math.PI };
}

/**
 * The average colour (linear rgb, 0..1+) of the picture's row at `elevationDeg` above the
 * horizon; same layout as `brightestDirection`.
 */
export function horizonRow(
  data: ArrayLike<number>,
  width: number,
  height: number,
  elevationDeg: number,
  stride = 4,
): [number, number, number] {
  const v = 0.5 + elevationDeg / 180;
  const y = Math.min(Math.max(Math.round((1 - v) * height - 0.5), 0), height - 1);
  let r = 0;
  let g = 0;
  let b = 0;
  for (let x = 0; x < width; x++) {
    const o = (y * width + x) * stride;
    r += data[o];
    g += data[o + 1];
    b += data[o + 2];
  }
  return [r / width, g / width, b / width];
}
