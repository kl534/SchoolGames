/**
 * The place the cat is in: a wall or sky, a floor in the place's pattern, decor, one far layer
 * that slides at 0.4 times the speed, the lights and the blob shadow. All procedural.
 */
import {
  AmbientLight,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  SRGBColorSpace,
  type Scene,
  type Texture,
} from 'three';
import { Kit } from './kit';
import type { Place } from './places';
import { HOUSE_SCENERY, WALL_Z } from './props/house-scenery';
import { TOWN_SCENERY, buildOutdoorFar } from './props/town-scenery';

/** The scenery repeats every this many units. */
export const TILE_W = 24;
const TILES = 4;
/** The floor is a slab: top at y = 0, front face towards the camera. */
const FLOOR_Z_FRONT = 1.4;
const FLOOR_Z_BACK = -3;
const FLOOR_DEPTH = 14;
const WALL_H = 34;

export interface World {
  /** Swaps the scenery for another place's. */
  setPlace(place: Place): void;
  /** Moves the scenery so it covers the view around `camX`. */
  update(camX: number): void;
  /** The blob shadow under the cat. */
  setShadow(x: number, visible: boolean, scale: number): void;
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

/** Builds one tile of a place's scenery (24 units wide, x from 0 to 24). */
export function buildScenery(place: Place, kit: Kit): Group {
  const tile = new Group();
  const look = place.look;
  const mid = (x: number, y: number, z: number) => ({ x, y, z });
  void mid;
  if (look.indoor) {
    // Wall, with faint stripes so the motion shows, and the trim along its foot.
    kit.box(
      TILE_W,
      WALL_H,
      0.3,
      kit.lit(look.wall, 0.95),
      tile,
      TILE_W / 2,
      WALL_H / 2 - 1,
      WALL_Z - 0.15,
    );
    const stripe = kit.lit(look.wall ^ 0x0c0c0c, 0.95);
    for (let i = 0; i < TILE_W; i += 2) {
      kit.box(0.5, WALL_H, 0.04, stripe, tile, i + 1, WALL_H / 2 - 1, WALL_Z + 0.02);
    }
    kit.box(TILE_W, 0.55, 0.2, kit.lit(look.trim, 0.6), tile, TILE_W / 2, 0.28, WALL_Z + 0.1);
  }
  // The floor slab and its pattern on the front face and the top.
  const floor = kit.lit(look.floor, 0.85);
  const depth = FLOOR_Z_FRONT - FLOOR_Z_BACK;
  kit.box(
    TILE_W,
    FLOOR_DEPTH,
    depth,
    floor,
    tile,
    TILE_W / 2,
    -FLOOR_DEPTH / 2,
    (FLOOR_Z_FRONT + FLOOR_Z_BACK) / 2,
  );
  const line = kit.lit(new Color(look.floor).multiplyScalar(0.72).getHex(), 0.9);
  const light = kit.lit(new Color(look.floor).multiplyScalar(1.12).getHex(), 0.9);
  switch (look.floorPattern) {
    case 'tiles': {
      for (let i = 0; i < TILE_W; i += 1.5) {
        for (let j = 0; j < 3; j++) {
          if ((i / 1.5 + j) % 2 === 0) {
            kit.box(1.5, 1.5, 0.02, line, tile, i + 0.75, -0.75 - j * 1.5, FLOOR_Z_FRONT + 0.01);
          }
        }
        kit.box(1.5, 0.02, 3.2, (i / 1.5) % 2 === 0 ? line : light, tile, i + 0.75, 0.011, -0.5);
      }
      break;
    }
    case 'planks': {
      for (let i = 0; i < TILE_W; i += 2)
        kit.box(0.06, 6, 0.02, line, tile, i, -3, FLOOR_Z_FRONT + 0.01);
      kit.box(TILE_W, 0.06, 0.02, line, tile, TILE_W / 2, -1.2, FLOOR_Z_FRONT + 0.01);
      for (let z = -2.5; z < 1.4; z += 0.7)
        kit.box(TILE_W, 0.012, 0.05, line, tile, TILE_W / 2, 0.011, z);
      break;
    }
    case 'carpet': {
      kit.box(TILE_W, 0.3, 0.02, light, tile, TILE_W / 2, -0.15, FLOOR_Z_FRONT + 0.01);
      for (let i = 0.5; i < TILE_W; i += 1)
        kit.box(0.08, 0.28, 0.03, line, tile, i, -0.15, FLOOR_Z_FRONT + 0.012);
      break;
    }
    case 'grass': {
      // Lighter blades along the edge and the top, and a darker soil band.
      kit.box(TILE_W, 0.35, 0.03, light, tile, TILE_W / 2, -0.175, FLOOR_Z_FRONT + 0.01);
      for (let i = 0; i < TILE_W; i += 1.2) {
        kit.box(0.6, 0.012, 3.3, i % 2.4 === 0 ? light : line, tile, i + 0.6, 0.011, -0.5);
      }
      break;
    }
    case 'pavement': {
      for (let i = 0; i < TILE_W; i += 3)
        kit.box(0.05, 6, 0.02, line, tile, i, -3, FLOOR_Z_FRONT + 0.01);
      kit.box(TILE_W, 0.05, 0.02, line, tile, TILE_W / 2, -0.8, FLOOR_Z_FRONT + 0.01);
      for (let i = 0; i < TILE_W; i += 3) kit.box(0.04, 0.012, 3.3, line, tile, i, 0.011, -0.5);
      break;
    }
    case 'roof': {
      for (let j = 0; j < 6; j++)
        kit.box(TILE_W, 0.05, 0.02, line, tile, TILE_W / 2, -0.35 - j * 0.6, FLOOR_Z_FRONT + 0.01);
      for (let z = -2.6; z < 1.4; z += 0.6)
        kit.box(TILE_W, 0.012, 0.05, line, tile, TILE_W / 2, 0.011, z);
      for (let i = 0; i < TILE_W; i += 1.2) kit.box(0.04, 0.012, 3.3, line, tile, i, 0.011, -0.5);
      break;
    }
    default:
      break;
  }
  const decor =
    HOUSE_SCENERY[place.id as keyof typeof HOUSE_SCENERY] ??
    TOWN_SCENERY[place.id as keyof typeof TOWN_SCENERY];
  decor?.(kit, tile, look);
  return tile;
}

export function createWorld(scene: Scene): World {
  const root = new Group();
  scene.add(root);
  const lights = new Group();
  const hemi = new HemisphereLight(0xffffff, 0x998877, 1.5);
  const ambient = new AmbientLight(0xffffff, 0.5);
  const sun = new DirectionalLight(0xffffff, 1.8);
  sun.position.set(-8, 18, 14);
  lights.add(hemi, ambient, sun);
  scene.add(lights);

  let kit: Kit | null = null;
  let tiles: Group[] = [];
  let far: Group | null = null;
  let background: Texture | null = null;

  const shadowGeometry = new SphereGeometry(1, 16, 8);
  const shadowMaterial = new MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const shadow = new Mesh(shadowGeometry, shadowMaterial);
  shadow.scale.set(0.9, 0.02, 0.45);
  shadow.position.z = 0.1;
  shadow.visible = false;
  scene.add(shadow);

  const clear = () => {
    for (const t of tiles) t.removeFromParent();
    far?.removeFromParent();
    kit?.dispose();
    background?.dispose();
    tiles = [];
    far = null;
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
      hemi.color.setHex(look.light);
      sun.color.setHex(look.light);
      tiles = Array.from({ length: TILES }, () => {
        const tile = buildScenery(place, next);
        root.add(tile);
        return tile;
      });
      // The far layer: pendant lights indoors; a sun and clouds (or a dusk sky) outdoors.
      far = new Group();
      if (!look.indoor) {
        buildOutdoorFar(place.id, next, far, 5, 8);
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
    update(camX) {
      const base = Math.floor((camX - TILE_W) / TILE_W) * TILE_W;
      tiles.forEach((t, i) => t.position.set(base + i * TILE_W, 0, 0));
      if (far) far.position.x = camX * 0.6 + 8 * Math.floor((camX * 0.4) / 8);
    },
    setShadow(x, visible, scale) {
      shadow.visible = visible;
      shadow.position.x = x;
      shadow.scale.set(0.9 * scale, 0.02, 0.45 * scale);
    },
    dispose() {
      clear();
      root.removeFromParent();
      lights.removeFromParent();
      shadow.removeFromParent();
      shadowGeometry.dispose();
      shadowMaterial.dispose();
    },
  };
}
