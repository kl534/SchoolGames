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
  type Mesh,
  type Texture,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
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
  /** Null for the grass: its roughness is just the material's. */
  rough: Texture | null;
}

export interface TreeAssets {
  /** Bark for trunks, branches and the tee furniture's wood. */
  barkColor: Texture;
  barkNormal: Texture;
  /** Four tiles each of leaf clusters (oak, birch) and needle branches (pine), with alpha. */
  oak: Texture;
  pine: Texture;
}

export interface PeopleAssets {
  /** The Quaternius bodies (slimmed and dressed in code) and every hairstyle. */
  golfer: GLTF;
  caddie: GLTF;
  hair: GLTF;
  /** The cloth weave normal (linear, repeating). */
  weave: Texture;
}

export interface ForeAssets {
  sky: SkyAssets | null;
  grass: TurfAssets | null;
  sand: TurfAssets | null;
  /** Ripple normals for the water (linear, repeating). */
  water: Texture | null;
  trees: TreeAssets | null;
  people: PeopleAssets | null;
}

/** The assets of a run with none (tests, or everything failed to load). */
export const NO_ASSETS: ForeAssets = {
  sky: null,
  grass: null,
  sand: null,
  water: null,
  trees: null,
  people: null,
};

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
  const total = 16;
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

  const [sky, grass, sand, water, trees, people] = await Promise.all([
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
      rough: null,
    })),
    group('sand', async () => ({
      color: await tex('turf/sand_color.webp', true),
      normal: await tex('turf/sand_normal.webp', false),
      rough: await tex('turf/sand_rough.webp', false),
    })),
    group('water', () => tex('turf/waternormals.jpg', false)),
    group('trees', async () => {
      const [barkColor, barkNormal, oak, pine] = await Promise.all([
        tex('trees/bark_color.webp', true),
        tex('trees/bark_normal.webp', false),
        tex('trees/leaves_oak.webp', true),
        tex('trees/leaves_pine.webp', true),
      ]);
      return { barkColor, barkNormal, oak, pine };
    }),
    group('people', async () => {
      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      const model = (file: string) => loader.loadAsync(`${base()}people/${file}`).finally(tick);
      const [golfer, caddie, hair, weave] = await Promise.all([
        model('golfer.glb'),
        model('caddie.glb'),
        model('hair.glb'),
        tex('people/fabric_normal.webp', false),
      ]);
      return { golfer, caddie, hair, weave };
    }),
  ]);
  if (failed.length > 0) {
    console.warn(`Fore!: could not load ${failed.join(', ')}; using the plain look instead.`);
  }
  onProgress?.(1);
  return { sky, grass, sand, water, trees, people };
}

/** Frees every texture's GPU copy. */
export function disposeForeAssets(a: ForeAssets): void {
  const all: (Texture | null | undefined)[] = [
    a.sky?.hdr,
    a.sky?.dome,
    a.grass?.color,
    a.grass?.normal,
    a.sand?.color,
    a.sand?.normal,
    a.sand?.rough,
    a.water,
    a.trees?.barkColor,
    a.trees?.barkNormal,
    a.trees?.oak,
    a.trees?.pine,
  ];
  all.forEach((t) => t?.dispose());
  if (a.people) {
    a.people.weave.dispose();
    for (const gltf of [a.people.golfer, a.people.caddie, a.people.hair]) {
      gltf.scene.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => {
          for (const v of Object.values(x))
            if ((v as Texture | null)?.isTexture) (v as Texture).dispose();
          x.dispose();
        });
      });
    }
  }
}
