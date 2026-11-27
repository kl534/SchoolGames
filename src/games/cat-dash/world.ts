/**
 * The place the cat is in: a wall or sky, a floor in the place's pattern, decor, one far layer
 * that slides at 0.4 times the speed and the blob shadow under the cat (the lights are `render.ts`). All procedural.
 */
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  PlaneGeometry,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  type BufferGeometry,
  type Scene,
  type Texture,
} from 'three';
import { mergeStatic } from './merge';
import { Kit } from './kit';
import type { Fit } from './layout';
import { lightFor } from './lighting';
import type { Place, PlaceLook } from './places';
import {
  BACKDROP_H,
  BACKDROP_W,
  FLOOR_SIZE,
  FLOOR_UNITS,
  WALL_SIZE,
  WALL_UNITS,
  paintBackdrop,
  paintFade,
  paintFloor,
  paintWall,
} from './textures';
import { HOUSE_SCENERY, WALL_Z } from './props/house-scenery';
import { TOWN_SCENERY, buildOutdoorFar } from './props/town-scenery';
import { BUSY_SCENERY } from './props/busy-scenery';
import { ADVENTURE_SCENERY } from './props/adventure-scenery';
import { EXTRA_SCENERY } from './props/extra-scenery';
import { TOYS_PIRATES_SCENERY } from './props/toys-pirates-scenery';
import { ZOO_SCENERY } from './props/zoo-scenery';

/** The scenery repeats every this many units. */
export const TILE_W = 24;
const TILES = 4;
/** The floor is a slab: top at y = 0, front face towards the camera. */
const FLOOR_Z_FRONT = 1.4;
const FLOOR_Z_BACK = -3;
const FLOOR_DEPTH = 14;
/** The wall and floor are one long piece (all the tiles wide), so no seam shows between tiles. */
const GROUND_W = TILE_W * TILES;
const WALL_H = 34;
/** The dark wood panel of a `wainscot` wall is this tall. */
const DADO_H = 2.4;

export interface World {
  /** Swaps the scenery for another place's. */
  setPlace(place: Place): void;
  /** Moves the scenery and the backdrops so they cover the view around `camX`. */
  update(camX: number, fit: Fit): void;
  /** The blob shadow under the cat. */
  setShadow(x: number, visible: boolean, scale: number): void;
  /** How dark the blob shadow is (darker when there is no real shadow). */
  setBlobOpacity(opacity: number): void;
  /**
   * Scenery shadows: everything receives them; decor also casts them when `decor` is true. Kept
   * for the places that are built later.
   */
  setShadows(decor: boolean): void;
  dispose(): void;
}

function gradient(top: number, bottom: number): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  if (!g) return null;
  const fill = g.createLinearGradient(0, 0, 0, 128);
  fill.addColorStop(0, `#${top.toString(16).padStart(6, '0')}`);
  fill.addColorStop(1, `#${bottom.toString(16).padStart(6, '0')}`);
  g.fillStyle = fill;
  g.fillRect(0, 0, 4, 128);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** A radial fade from dark to clear: the blob shadow (null where there is no canvas). */
function blobTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  if (!g) return null;
  const fill = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  fill.addColorStop(0, 'rgba(0,0,0,0.55)');
  fill.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fill;
  g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(canvas);
}

const hash = (n: number) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/** Scales a geometry's UVs by `su` and `sv`, then moves them by `ou` and `ov` (repeating textures). */
function scaleUv(g: BufferGeometry, su: number, sv: number, ov = 0, ou = 0): void {
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su + ou, uv.getY(i) * sv + ov);
  uv.needsUpdate = true;
}

/** A painted, repeating texture (null where there is no canvas). */
function repeating(kit: Kit, size: number, draw: (g: CanvasRenderingContext2D) => void) {
  const texture = kit.paint(size, size, draw);
  if (texture) {
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.anisotropy = 4;
  }
  return texture;
}

/** A fade used as an alpha map (no colour management on it). */
function fade(kit: Kit, opaqueAtBottom: boolean): CanvasTexture | null {
  const texture = kit.paint(4, 64, (g) => paintFade(g, 64, opaqueAtBottom));
  if (texture) texture.colorSpace = NoColorSpace;
  return texture;
}

const darker = (hex: number, k: number) => new Color(hex).multiplyScalar(k).getHex();

/** A band of baked ambient occlusion: black fading to clear, `alpha` at its darkest. */
function shade(
  kit: Kit,
  tile: Group,
  w: number,
  h: number,
  alpha: number,
  opaqueAtBottom: boolean,
): Mesh {
  const material = new MeshBasicMaterial({
    color: 0x000000,
    alphaMap: fade(kit, opaqueAtBottom),
    transparent: true,
    opacity: alpha,
    depthWrite: false,
  });
  kit.materials.push(material);
  return kit.mesh(new PlaneGeometry(w, h), material, tile);
}

/** The back wall of an indoor place: a patterned wall, its trim and the dado of `wainscot`. */
function buildWall(look: PlaceLook, kit: Kit, tile: Group) {
  const pattern = look.wallPattern ?? 'stripes';
  const map = repeating(kit, WALL_SIZE, (g) => paintWall(g, pattern));
  const wall = new BoxGeometry(GROUND_W, WALL_H, 0.3);
  // One texture per 3 units; the pattern starts at the floor line (the wall starts 1 below it).
  scaleUv(wall, GROUND_W / WALL_UNITS, WALL_H / WALL_UNITS, -1 / WALL_UNITS, 0);
  const material = new MeshStandardMaterial({ color: look.wall, roughness: 0.95, map });
  kit.materials.push(material);
  kit.mesh(wall, material, tile, GROUND_W / 2, WALL_H / 2 - 1, WALL_Z - 0.15);
  if (pattern === 'wainscot') {
    // A darker wood panel up to a chair rail.
    const panel = kit.wood(darker(look.trim, 0.92));
    kit.box(GROUND_W, DADO_H, 0.12, panel, tile, GROUND_W / 2, DADO_H / 2, WALL_Z + 0.06);
    const inset = kit.wood(darker(look.trim, 0.8));
    for (let i = 1.5; i < GROUND_W; i += 3) {
      kit.box(1.9, DADO_H - 0.9, 0.05, inset, tile, i, 1.15, WALL_Z + 0.13);
    }
    kit.box(
      GROUND_W,
      0.2,
      0.26,
      kit.wood(look.trim),
      tile,
      GROUND_W / 2,
      DADO_H + 0.05,
      WALL_Z + 0.1,
    );
  }
  kit.box(GROUND_W, 0.55, 0.2, kit.lit(look.trim, 0.6), tile, GROUND_W / 2, 0.28, WALL_Z + 0.1);
  // Baked occlusion: the wall's foot darkens.
  const ao = shade(kit, tile, GROUND_W, 1.6, 0.35, true);
  ao.position.set(GROUND_W / 2, 0.8, WALL_Z + 0.02);
}

/** The floor: a hidden slab, a patterned top and front, a lip and the occlusion strip. */
function buildFloor(look: PlaceLook, kit: Kit, tile: Group) {
  const depth = FLOOR_Z_FRONT - FLOOR_Z_BACK;
  kit.mesh(
    new BoxGeometry(GROUND_W, FLOOR_DEPTH, depth),
    kit.lit(look.floor, 0.85),
    tile,
    GROUND_W / 2,
    -FLOOR_DEPTH / 2,
    (FLOOR_Z_FRONT + FLOOR_Z_BACK) / 2,
  );
  const map = repeating(kit, FLOOR_SIZE, (g) => paintFloor(g, look.floorPattern));
  const surface = (colour: number) => {
    const m = new MeshStandardMaterial({ color: colour, roughness: 0.85, map });
    kit.materials.push(m);
    return m;
  };
  // Top: faces up; its v runs back along -z.
  const top = new PlaneGeometry(GROUND_W, depth);
  top.rotateX(-Math.PI / 2);
  scaleUv(top, GROUND_W / FLOOR_UNITS, depth / FLOOR_UNITS, 0, 0);
  kit.mesh(top, surface(look.floor), tile, GROUND_W / 2, 0.01, (FLOOR_Z_FRONT + FLOOR_Z_BACK) / 2);
  // Front: faces the camera, a touch darker.
  const front = new PlaneGeometry(GROUND_W, FLOOR_DEPTH);
  scaleUv(front, GROUND_W / FLOOR_UNITS, FLOOR_DEPTH / FLOOR_UNITS, 0, 0);
  kit.mesh(
    front,
    surface(darker(look.floor, 0.8)),
    tile,
    GROUND_W / 2,
    -FLOOR_DEPTH / 2,
    FLOOR_Z_FRONT + 0.01,
  );
  // The lip along the top front edge: its top is level with the floor so it never hides the cat.
  // It is a little longer than the tile, so the rounded ends of neighbours overlap.
  kit.box(
    GROUND_W,
    0.3,
    0.36,
    kit.lit(darker(look.floor, 1.1), 0.7),
    tile,
    GROUND_W / 2,
    -0.12,
    FLOOR_Z_FRONT - 0.05,
  );
  // Baked occlusion on the floor against the wall (or the floor's back edge outdoors).
  const ao = shade(kit, tile, GROUND_W, 1.2, 0.25, false);
  ao.rotation.x = -Math.PI / 2;
  const edge = look.indoor ? WALL_Z : FLOOR_Z_BACK;
  ao.position.set(GROUND_W / 2, 0.02, edge + 0.6);
  // The pattern's own extras.
  switch (look.floorPattern) {
    case 'snow': {
      // Soft lumps along the front edge.
      const snow = kit.lit(darker(look.floor, 1.1), 0.9);
      for (let i = 0; i < GROUND_W; i += 1.8) {
        kit
          .mesh(new SphereGeometry(0.5, 12, 8), snow, tile, i + 0.9, -0.02, FLOOR_Z_FRONT - 0.1)
          .scale.set(1.6, 0.35, 0.9);
      }
      break;
    }
    case 'metal': {
      // A hazard stripe along the edge.
      const hazard = kit.lit(0xf2c230, 0.6);
      const black = kit.lit(0x222222, 0.6);
      for (let i = 0; i < GROUND_W; i += 0.8) {
        kit.box(
          0.4,
          0.2,
          0.02,
          (i / 0.8) % 2 === 0 ? hazard : black,
          tile,
          i + 0.2,
          -0.12,
          FLOOR_Z_FRONT + 0.03,
        );
      }
      break;
    }
    default:
      break;
  }
}

/** Little things along the front lip of grass, sand and snow floors (at most 0.35 tall). */
function buildDressing(look: PlaceLook, kit: Kit, tile: Group, seed: number) {
  const z = FLOOR_Z_FRONT - 0.15;
  const kind = look.floorPattern;
  if (kind !== 'grass' && kind !== 'sand' && kind !== 'snow') return;
  const blades = kit.foliage(darker(look.floor, 1.25));
  const petals = [0xff6f91, 0xf2c230, 0xffffff, 0xb583e8];
  const stone = kit.stone(0xb9a98f);
  const shell = kit.lit(0xf6e3d8, 0.5);
  const lump = kit.lit(0xffffff, 0.9);
  const twig = kit.wood(0x6a4a2a);
  let n = 0;
  for (let x = 0.6 + hash(seed) * 1.2; x < TILE_W - 0.4; x += 1.2 + hash(seed + n) * 1.0) {
    n++;
    const r = hash(seed * 3 + n);
    const dz = (hash(seed + n * 7) - 0.5) * 0.3;
    if (kind === 'grass') {
      if (r < 0.6) {
        for (let b = -1; b <= 1; b++) {
          const blade = kit.mesh(
            new ConeGeometry(0.03, 0.22, 5),
            blades,
            tile,
            x + b * 0.05,
            0.15,
            z + dz,
          );
          blade.rotation.z = -b * 0.5;
        }
      } else {
        kit.mesh(new CylinderGeometry(0.012, 0.012, 0.24, 5), blades, tile, x, 0.12, z + dz);
        const c = petals[Math.floor(hash(n + seed) * petals.length)];
        kit.mesh(new SphereGeometry(0.075, 8, 6), kit.lit(c, 0.6), tile, x, 0.27, z + dz);
      }
    } else if (kind === 'sand') {
      if (r < 0.6) {
        const m = kit.mesh(new SphereGeometry(0.1, 8, 6), stone, tile, x, 0.04, z + dz);
        m.scale.set(1.3, 0.6, 1);
      } else {
        const m = kit.mesh(new ConeGeometry(0.1, 0.1, 8), shell, tile, x, 0.06, z + dz);
        m.scale.set(1, 1, 0.7);
        m.rotation.x = Math.PI;
      }
    } else if (r < 0.7) {
      const m = kit.mesh(new SphereGeometry(0.14, 10, 8), lump, tile, x, 0.04, z + dz);
      m.scale.set(1.5, 0.55, 1);
    } else {
      const m = kit.box(0.34, 0.025, 0.025, twig, tile, x, 0.05, z + dz);
      m.rotation.z = (hash(n) - 0.5) * 0.6;
    }
  }
}

/** The wall and floor of a place as one long piece (`GROUND_W` wide, from x = 0). */
export function buildGround(place: Place, kit: Kit): Group {
  const ground = new Group();
  if (place.look.indoor) buildWall(place.look, kit, ground);
  buildFloor(place.look, kit, ground);
  return ground;
}

/** Builds one tile of a place's decor (24 units wide, x from 0 to 24). */
export function buildScenery(place: Place, kit: Kit): Group {
  const tile = new Group();
  const look = place.look;
  const decor =
    HOUSE_SCENERY[place.id as keyof typeof HOUSE_SCENERY] ??
    TOWN_SCENERY[place.id as keyof typeof TOWN_SCENERY] ??
    BUSY_SCENERY[place.id as keyof typeof BUSY_SCENERY] ??
    ADVENTURE_SCENERY[place.id as keyof typeof ADVENTURE_SCENERY] ??
    EXTRA_SCENERY[place.id as keyof typeof EXTRA_SCENERY] ??
    TOYS_PIRATES_SCENERY[place.id as keyof typeof TOYS_PIRATES_SCENERY] ??
    ZOO_SCENERY[place.id as keyof typeof ZOO_SCENERY];
  decor?.(kit, tile, look);
  buildDressing(look, kit, tile, place.id.length * 31 + place.id.charCodeAt(0));
  return tile;
}

/** What the two backdrop strips look like. */
const BACKDROP_LAYERS = [
  { z: -60, factor: 0.1, height: 18, fogMix: 0.55 },
  { z: -30, factor: 0.3, height: 11, fogMix: 0.25 },
] as const;

interface BackdropLayer {
  mesh: Mesh;
  texture: CanvasTexture;
  spec: (typeof BACKDROP_LAYERS)[number];
}

/** The two silhouette strips of an outdoor place, painted in the haze's colour. */
function buildBackdrop(place: Place, kit: Kit, parent: Group): BackdropLayer[] {
  const strips = place.look.backdrop;
  if (!strips) return [];
  const fog = new Color(lightFor(place).fog);
  const layers: BackdropLayer[] = [];
  BACKDROP_LAYERS.forEach((spec, i) => {
    const strip = strips[i];
    const colour = new Color(strip.color).lerp(fog, spec.fogMix).getHex();
    const texture = kit.paint(BACKDROP_W, BACKDROP_H, (g) => paintBackdrop(g, strip.kind, colour));
    if (!texture) return;
    texture.wrapS = RepeatWrapping;
    const material = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    kit.materials.push(material);
    const mesh = kit.mesh(new PlaneGeometry(1, 1), material, parent);
    mesh.renderOrder = -2 + i;
    mesh.frustumCulled = false;
    layers.push({ mesh, texture, spec });
  });
  return layers;
}

export function createWorld(scene: Scene): World {
  const root = new Group();
  scene.add(root);
  let kit: Kit | null = null;
  let tiles: Group[] = [];
  let ground: Group | null = null;
  let far: Group | null = null;
  let backdrop: Group | null = null;
  let layers: BackdropLayer[] = [];
  let background: Texture | null = null;

  let decorShadows = true;
  const applyShadows = () => {
    // The wall and floor only receive shadows; the decor casts them too (when the tier allows).
    ground?.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh) mesh.receiveShadow = true;
    });
    for (const tile of tiles) {
      tile.traverse((o) => {
        const mesh = o as Mesh;
        if (!mesh.isMesh) return;
        mesh.receiveShadow = true;
        const m = mesh.material as { transparent?: boolean };
        const solid = !m.transparent && !(mesh.material instanceof MeshBasicMaterial);
        mesh.castShadow = decorShadows && solid;
      });
    }
  };

  // The blob shadow: a soft dark oval on the floor under the cat.
  const shadowGeometry = new PlaneGeometry(2, 1);
  shadowGeometry.rotateX(-Math.PI / 2);
  const shadowTexture = blobTexture();
  const shadowMaterial = new MeshBasicMaterial({
    color: shadowTexture ? 0xffffff : 0x000000,
    map: shadowTexture,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const shadow = new Mesh(shadowGeometry, shadowMaterial);
  shadow.scale.set(0.9, 1, 0.9);
  shadow.position.set(0, 0.012, 0.1);
  shadow.visible = false;
  scene.add(shadow);

  const clear = () => {
    for (const t of tiles) t.removeFromParent();
    ground?.removeFromParent();
    far?.removeFromParent();
    backdrop?.removeFromParent();
    kit?.dispose();
    background?.dispose();
    tiles = [];
    ground = null;
    far = null;
    backdrop = null;
    layers = [];
    kit = null;
    background = null;
  };

  return {
    setPlace(place) {
      clear();
      const next = new Kit();
      kit = next;
      const look = place.look;
      background = gradient(look.sky[0], look.sky[1]);
      scene.background = background ?? new Color(look.sky[1]);
      ground = buildGround(place, next);
      next.geometries.push(...mergeStatic(ground));
      root.add(ground);
      tiles = Array.from({ length: TILES }, () => {
        const tile = buildScenery(place, next);
        // The decor never moves within its tile: one draw call per material.
        next.geometries.push(...mergeStatic(tile));
        root.add(tile);
        return tile;
      });
      applyShadows();
      if (!look.indoor) {
        backdrop = new Group();
        layers = buildBackdrop(place, next, backdrop);
        root.add(backdrop);
      }
      // The far layer: pendant lights indoors; a sun and clouds (or a dusk sky) outdoors.
      far = new Group();
      if (!look.indoor) {
        buildOutdoorFar(place.id, next, far, 5, 8);
        root.add(far);
        return;
      }
      if (place.id === 'space-station') {
        // Glowing light strips along the ceiling instead of pendant lamps.
        const strip = next.basic(0xdff4ff);
        for (let j = -3; j <= 5; j++) {
          next.box(3, 0.25, 0.4, strip, far, j * 8, 16, WALL_Z + 1.2);
        }
        root.add(far);
        return;
      }
      const cord = next.lit(0x444444, 0.6);
      const bulb = next.basic(0xfff3c2);
      for (let j = -3; j <= 5; j++) {
        next.box(0.04, 9, 0.04, cord, far, j * 8, 17, WALL_Z + 1.2);
        next.mesh(new SphereGeometry(0.5, 12, 10), bulb, far, j * 8, 12.3, WALL_Z + 1.2);
      }
      root.add(far);
    },
    update(camX, fit) {
      for (const layer of layers) {
        const { z, factor, height } = layer.spec;
        const depth = fit.distance - z;
        // One texture is 4 times as wide as it is tall; it scrolls with the camera at `factor`.
        const strip = height * (BACKDROP_W / BACKDROP_H);
        const width = (fit.viewW * depth * 1.2) / fit.distance;
        // The bottom edge sits just under where the floor's back edge shows on the screen.
        const bottom = fit.camY - (fit.camY * depth) / (fit.distance + 3) - 1.5;
        layer.mesh.scale.set(width, height, 1);
        layer.mesh.position.set(camX, bottom + height / 2, z);
        layer.texture.repeat.x = width / strip;
        layer.texture.offset.x = (camX * factor - width / 2) / strip;
      }
      const base = Math.floor((camX - TILE_W) / TILE_W) * TILE_W;
      tiles.forEach((t, i) => t.position.set(base + i * TILE_W, 0, 0));
      ground?.position.set(base, 0, 0);
      if (far) far.position.x = camX * 0.6 + 8 * Math.floor((camX * 0.4) / 8);
    },
    setShadow(x, visible, scale) {
      shadow.visible = visible;
      shadow.position.x = x;
      shadow.scale.set(0.9 * scale, 1, 0.9 * scale);
    },
    setBlobOpacity(opacity) {
      shadowMaterial.opacity = opacity;
    },
    setShadows(decor) {
      decorShadows = decor;
      applyShadows();
    },
    dispose() {
      clear();
      root.removeFromParent();
      shadow.removeFromParent();
      shadowGeometry.dispose();
      shadowTexture?.dispose();
      shadowMaterial.dispose();
    },
  };
}
