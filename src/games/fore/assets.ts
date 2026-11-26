/**
 * The pictures Fore! loads from `public/fore/`: the HDR sky, the sky dome, grass, sand and water
 * ripples. Every group is optional: one that fails to load (offline, 404) is null and its user
 * falls back to the procedural version, with one `console.warn` in all.
 */
import {
  FloatType,
  LinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type DataTexture,
  type Texture,
} from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { brightestDirection, horizonRow } from './quality';

export interface SkyAssets {
  /** The 1k HDR (float RGBA), to become the scene's environment. */
  hdr: DataTexture;
  /** The 4096 x 2048 dome picture (sRGB, no mipmaps). */
  dome: Texture;
  /** Where the sun is in the HDR's own frame (radians). */
  sun: { phi: number; elevation: number };
  /** Linear rgb of the HDR's row 2 degrees above the horizon, for the fog. */
  horizon: [number, number, number];
}

export interface TurfAssets {
  color: Texture;
  normal: Texture;
  rough: Texture;
}

export interface ForeAssets {
  sky: SkyAssets | null;
  grass: TurfAssets | null;
  sand: TurfAssets | null;
  /** Ripple normals for the water (linear, repeating). */
  water: Texture | null;
}

/** The assets of a run with none (tests, or everything failed to load). */
export const NO_ASSETS: ForeAssets = { sky: null, grass: null, sand: null, water: null };

const base = () => `${import.meta.env.BASE_URL}fore/`;

function repeat(t: Texture, anisotropy: number, srgb: boolean): Texture {
  t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = anisotropy;
  if (srgb) t.colorSpace = SRGBColorSpace;
  return t;
}

/**
 * Loads everything in parallel. `onProgress` gets 0..1 as files arrive; `anisotropy` is the
 * renderer's cap (the game asks for min(8, max)).
 */
export async function loadForeAssets(
  anisotropy: number,
  onProgress?: (fraction: number) => void,
): Promise<ForeAssets> {
  const failed: string[] = [];
  let done = 0;
  const total = 9;
  const tick = () => onProgress?.(Math.min(++done / total, 1));
  const textures = new TextureLoader();
  const tex = async (file: string, srgb: boolean) => {
    try {
      return repeat(await textures.loadAsync(base() + file), anisotropy, srgb);
    } finally {
      tick();
    }
  };
  const group = async <T>(name: string, make: () => Promise<T>): Promise<T | null> => {
    try {
      return await make();
    } catch {
      failed.push(name);
      return null;
    }
  };

  const [sky, grass, sand, water] = await Promise.all([
    group('sky', async () => {
      const loader = new RGBELoader().setDataType(FloatType);
      const [hdr, dome] = await Promise.all([
        loader.loadAsync(`${base()}sky_env.hdr`).finally(tick),
        textures.loadAsync(`${base()}sky_bg.webp`).finally(tick),
      ]);
      dome.colorSpace = SRGBColorSpace;
      dome.generateMipmaps = false;
      dome.minFilter = LinearFilter;
      dome.wrapS = RepeatWrapping;
      const { data, width, height } = hdr.image as {
        data: Float32Array;
        width: number;
        height: number;
      };
      return {
        hdr,
        dome,
        sun: brightestDirection(data, width, height, 4),
        horizon: horizonRow(data, width, height, 2, 4),
      };
    }),
    group('grass', async () => ({
      color: await tex('turf/grass_color.webp', true),
      normal: await tex('turf/grass_normal.webp', false),
      rough: await tex('turf/grass_rough.webp', false),
    })),
    group('sand', async () => ({
      color: await tex('turf/sand_color.webp', true),
      normal: await tex('turf/sand_normal.webp', false),
      rough: await tex('turf/sand_rough.webp', false),
    })),
    group('water', () => tex('turf/waternormals.jpg', false)),
  ]);
  if (failed.length > 0) {
    console.warn(`Fore!: could not load ${failed.join(', ')}; using the plain look instead.`);
  }
  onProgress?.(1);
  return { sky, grass, sand, water };
}

/** Frees every texture's GPU copy. */
export function disposeForeAssets(a: ForeAssets): void {
  const all: (Texture | null | undefined)[] = [
    a.sky?.hdr,
    a.sky?.dome,
    a.grass?.color,
    a.grass?.normal,
    a.grass?.rough,
    a.sand?.color,
    a.sand?.normal,
    a.sand?.rough,
    a.water,
  ];
  all.forEach((t) => t?.dispose());
}
