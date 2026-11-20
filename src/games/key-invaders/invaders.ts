/**
 * The voxel things of the field: the invaders, the UFO, the bunkers and the cannon, each one an
 * `InstancedMesh` of cubes. A frame swap rewrites the matrices; a chip or a bunker hit scales an
 * instance to 0.
 */
import {
  BoxGeometry,
  Color,
  InstancedMesh,
  LineLoop,
  BufferGeometry,
  LineBasicMaterial,
  Matrix4,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import type { Random } from '../../shared/random';
import {
  BUNKER_COLS,
  BUNKER_PIXEL,
  BUNKER_ROWS,
  CANNON_COLS,
  CANNON_ROWS,
  PIXEL,
  bunkerHasCube,
} from './layout';
import type { Kind } from './rules';

/** Two frames each; `#` is a cube. The frame swaps every march step. */
export const SPRITES: Record<Kind, string[][]> = {
  squid: [],
  crab: [],
  octopus: [],
  ufo: [],
};

const rows = (text: string): string[] => text.trim().split(/\s+/);

SPRITES.squid = [
  rows('...##... ..####.. .######. ##.##.## ######## ..#..#.. .#.##.#. #.#..#.#'),
  rows('...##... ..####.. .######. ##.##.## ######## .#.##.#. #......# .#....#.'),
];
SPRITES.crab = [
  rows(
    '..#.....#.. ...#...#... ..#######.. .##.###.##. ########### #.#######.# #.#.....#.# ...##.##...',
  ),
  rows(
    '..#.....#.. #..#...#..# #.#######.# ###.###.### ########### .#########. ..#.....#.. .#.......#.',
  ),
];
SPRITES.octopus = [
  rows(
    '....####.... .##########. ############ ###..##..### ############ ...##..##... ..##.##.##.. ##........##',
  ),
  rows(
    '....####.... .##########. ############ ###..##..### ############ ..###..###.. .##..##..##. ..##....##..',
  ),
];
SPRITES.ufo = [
  rows(
    '.....######..... ...##########... ..############.. .##.##.##.##.##. ################ ..###..##..###.. ...#........#...',
  ),
];

/** Neon colours of each kind, the cannon and the bunkers. */
export const COLORS: Record<Kind | 'cannon' | 'bunker', string> = {
  squid: '#ff4fd8',
  crab: '#38f9ff',
  octopus: '#7cff4f',
  ufo: '#ff3b3b',
  cannon: '#7cff4f',
  bunker: '#3ddc5a',
};

export const LOCK_COLOR = '#facc15';
/** Emissive intensity of a front invader (it has a chunk) and of the ones behind it. */
export const FRONT_GLOW = 1.0;
export const BACK_GLOW = 0.35;
/** The cubes show a little gap between them. */
const CUBE = 0.9;

const unitCube = new BoxGeometry(1, 1, 1);

const materials = new Map<string, MeshStandardMaterial>();

/** A shared glowing material: emissive is the colour itself. */
export function glowMaterial(color: string, intensity: number): MeshStandardMaterial {
  const key = `${color}/${intensity}`;
  let m = materials.get(key);
  if (!m) {
    m = new MeshStandardMaterial({
      color,
      emissive: new Color(color),
      emissiveIntensity: intensity,
      roughness: 0.6,
      metalness: 0,
    });
    materials.set(key, m);
  }
  return m;
}

interface Cell {
  col: number;
  row: number;
}

const cellsOf = (frame: string[]): Cell[] => {
  const out: Cell[] = [];
  frame.forEach((line, row) => {
    [...line].forEach((ch, col) => {
      if (ch === '#') out.push({ col, row });
    });
  });
  return out;
};

export interface Voxels {
  readonly mesh: InstancedMesh;
  /** Width and height in world units (the first frame's grid). */
  readonly width: number;
  readonly height: number;
  /** Cubes in the first frame. */
  readonly cubes: number;
  /** Positions the middle of its bottom edge. */
  place(x: number, bottomY: number): void;
  setFrame(frame: number): void;
  /** Hides this many cubes in all (the first `count` of a fixed random order). */
  chip(count: number): void;
  /** Hides the cube at a grid cell (does nothing where there is none). */
  hideCell(col: number, row: number): void;
  /** Is there a cube still at this cell? */
  hasCell(col: number, row: number): boolean;
  /** Brings every hidden cube back (and resets the frame). */
  restore(): void;
  setMaterial(m: MeshStandardMaterial): void;
}

/** Builds a voxel thing from its frames of rows of `#` and `.`. */
export function createVoxels(
  frames: string[][],
  pixel: number,
  material: MeshStandardMaterial,
  random: Random = Math.random,
): Voxels {
  const frameCells = frames.map(cellsOf);
  const count = Math.max(...frameCells.map((c) => c.length));
  const least = Math.min(...frameCells.map((c) => c.length));
  const mesh = new InstancedMesh(unitCube, material, count);
  mesh.frustumCulled = false;
  const gridRows = frames[0].length;
  const gridCols = frames[0][0].length;
  // Chipping order: cubes every frame has first, in a random order.
  const shuffle = (items: number[]) => {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  };
  const order = [
    ...shuffle(Array.from({ length: least }, (_, i) => i)),
    ...shuffle(Array.from({ length: count - least }, (_, i) => i + least)),
  ];
  const hidden = new Uint8Array(count);
  let frame = 0;
  const matrix = new Matrix4();
  const size = pixel * CUBE;

  const rewrite = () => {
    const cells = frameCells[frame];
    for (let i = 0; i < count; i++) {
      const cell = cells[i];
      if (!cell || hidden[i]) {
        matrix.makeScale(0, 0, 0);
      } else {
        matrix.makeScale(size, size, size);
        matrix.setPosition(
          (cell.col - (gridCols - 1) / 2) * pixel,
          (gridRows - 1 - cell.row + 0.5) * pixel,
          0,
        );
      }
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  rewrite();

  const indexAt = (col: number, row: number) =>
    frameCells[0].findIndex((c) => c.col === col && c.row === row);

  return {
    mesh,
    width: gridCols * pixel,
    height: gridRows * pixel,
    cubes: frameCells[0].length,
    place(x, bottomY) {
      mesh.position.set(x, bottomY, 0);
    },
    setFrame(next) {
      const wanted = next % frames.length;
      if (wanted === frame) return;
      frame = wanted;
      rewrite();
    },
    chip(n) {
      hidden.fill(0);
      for (let i = 0; i < Math.min(n, count); i++) hidden[order[i]] = 1;
      rewrite();
    },
    hideCell(col, row) {
      const i = indexAt(col, row);
      if (i < 0 || hidden[i]) return;
      hidden[i] = 1;
      rewrite();
    },
    hasCell(col, row) {
      const i = indexAt(col, row);
      return i >= 0 && !hidden[i];
    },
    restore() {
      hidden.fill(0);
      frame = 0;
      rewrite();
    },
    setMaterial(m) {
      mesh.material = m;
    },
  };
}

/** An invader (or the UFO) of `kind`, glowing like a front one until told otherwise. */
export function createInvader(kind: Kind, random: Random = Math.random): Voxels {
  return createVoxels(SPRITES[kind], PIXEL, glowMaterial(COLORS[kind], FRONT_GLOW), random);
}

/** The material for an invader that has a chunk (front) or not. */
export const invaderMaterial = (kind: Kind, front: boolean): MeshStandardMaterial =>
  glowMaterial(COLORS[kind], front ? FRONT_GLOW : BACK_GLOW);

/** A bunker: 14 × 10 cubes of 0.12 with cut corners and an arch. */
export function createBunker(): Voxels {
  const grid = Array.from({ length: BUNKER_ROWS }, (_, row) =>
    Array.from({ length: BUNKER_COLS }, (_, col) => (bunkerHasCube(col, row) ? '#' : '.')).join(''),
  );
  return createVoxels([grid], BUNKER_PIXEL, glowMaterial(COLORS.bunker, 0.5));
}

const CANNON_ROWS_TEXT = [
  '......#......',
  '.....###.....',
  '.###########.',
  '#############',
  '#############',
  '#############',
];

/** The laser cannon: 13 × 6 cubes of 0.1. */
export function createCannon(): Voxels {
  if (CANNON_ROWS_TEXT.length !== CANNON_ROWS || CANNON_ROWS_TEXT[0].length !== CANNON_COLS) {
    throw new Error('The cannon bitmap does not match its size');
  }
  return createVoxels([CANNON_ROWS_TEXT], PIXEL, glowMaterial(COLORS.cannon, 0.8));
}

export interface Outline {
  readonly line: LineLoop;
  /** Shows a square outline around a thing `width` by `height` whose bottom middle is at (x, bottomY). */
  place(x: number, bottomY: number, width: number, height: number): void;
  setVisible(visible: boolean): void;
}

/** The yellow square around the locked target. */
export function createOutline(): Outline {
  const geometry = new BufferGeometry().setFromPoints([
    new Vector3(-0.5, 0, 0),
    new Vector3(0.5, 0, 0),
    new Vector3(0.5, 1, 0),
    new Vector3(-0.5, 1, 0),
  ]);
  const line = new LineLoop(geometry, new LineBasicMaterial({ color: LOCK_COLOR }));
  line.frustumCulled = false;
  line.visible = false;
  return {
    line,
    place(x, bottomY, width, height) {
      const pad = 0.12;
      line.position.set(x, bottomY - pad, 0.2);
      line.scale.set(width + 2 * pad, height + 2 * pad, 1);
    },
    setVisible(visible) {
      line.visible = visible;
    },
  };
}
