import type { FactVisual } from '../topics';
import { buildAdd } from './add';
import { buildSubtract } from './subtract';
import type { Way } from './ways';

export const STAGE_W = 480;
/** MAX_TABLE * MAX_TABLE; every count is 1..MAX_COUNT. */
export const MAX_COUNT = 256;
/** Seconds a step's move takes by default. */
export const MOVE = 0.45;
export const countSpeech = (n: number): string => `${n}.`;

export type Sprite =
  | { type: 'critter'; emoji: string; size: number }
  | { type: 'text'; text: string; size: number; color?: string }
  | { type: 'line'; dx: number; dy: number; width: number; color?: string; dashed?: boolean }
  | { type: 'ring'; r: number; color: string }
  | { type: 'rect'; w: number; h: number; fill: string; stroke?: string; radius?: number }
  | { type: 'plate'; rx: number; ry: number }
  | { type: 'cross'; size: number };

export interface Pose {
  x: number;
  y: number;
  scale: number;
  opacity: number;
  rotate: number;
}

export interface Step {
  /** Said with `countSpeech` when the step's move lands; null = a silent step. */
  count: number | null;
  /** Replaces the equation line while this step is the latest, e.g. '8 + 2 = 10'. */
  caption?: string;
  /** Seconds the move takes (default MOVE). */
  move?: number;
}

export interface Picture {
  way: Way;
  width: number;
  height: number;
  sprites: Sprite[];
  steps: Step[];
  /**
   * Poses of every sprite (same order) with `done` steps finished and `p` (0-1) of the next.
   * at(steps.length, 0) is the end. `calm` leaves out the arcs, pops and bounces.
   */
  at(done: number, p: number, calm?: boolean): Pose[];
}

export interface Looks {
  critters: string[];
  hopper: string;
}

export function buildPicture(visual: FactVisual, way: Way, looks: Looks): Picture {
  if (visual.kind === 'add') return buildAdd(visual, way, looks);
  if (visual.kind === 'subtract') return buildSubtract(visual, way, looks);
  throw new Error(`No picture for ${way} yet`);
}

// ---------- Layout helpers shared by the builders ----------

export const CELL_MAX = 42;
export const CELL_MIN = 18;
export const HOPPER_SIZE = 34;
export const clamp = (value: number, low: number, high: number): number =>
  Math.min(Math.max(value, low), high);
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** The biggest cell (CELL_MAX down to CELL_MIN) for which `fits` holds. */
export function fitCell(fits: (cell: number) => boolean): number {
  for (let cell = CELL_MAX; cell > CELL_MIN; cell--) if (fits(cell)) return cell;
  return CELL_MIN;
}

/** The stage height for content `contentHeight` tall (120 to 360). */
export const stageHeight = (contentHeight: number): number =>
  Math.round(clamp(contentHeight, 120, 360));

/** The centre of slot `index` in a grid of `cols` columns whose top left is (ox, oy). */
export function gridSlot(
  index: number,
  cols: number,
  cell: number,
  ox: number,
  oy: number,
): { x: number; y: number } {
  return { x: ox + ((index % cols) + 0.5) * cell, y: oy + (Math.floor(index / cols) + 0.5) * cell };
}

const REST: Pose = { x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 };

interface Move {
  to: Partial<Pose>;
  from?: Partial<Pose>;
  /** Height of the hop's arc, in units. */
  arc: number;
  /** Squash and stretch as it lands. */
  pop: boolean;
  /** Squash and stretch in place. */
  bounce: boolean;
  /** Fraction of the move to wait before starting (0 to 0.5). */
  delay: number;
}

export interface MoveOptions {
  /** Poses the sprite jumps to when the step starts (for example to show a hand waving). */
  from?: Partial<Pose>;
  arc?: number;
  pop?: boolean;
  bounce?: boolean;
  delay?: number;
}

/** Collects sprites and what each does in each step, then turns that into a `Picture`. */
export class PictureBuilder {
  readonly sprites: Sprite[] = [];
  private readonly start: Pose[] = [];
  /** moves[step - 1] holds what each sprite (by index) does in that step. */
  private readonly moves: Map<number, Move>[];

  constructor(private readonly steps: Step[]) {
    this.moves = steps.map(() => new Map());
  }

  /** Adds a sprite at (x, y), its centre, and returns its index. */
  add(sprite: Sprite, x: number, y: number, pose: Partial<Pose> = {}): number {
    this.sprites.push(sprite);
    this.start.push({ ...REST, x, y, ...pose });
    return this.sprites.length - 1;
  }

  /** What sprite `id` does in step `step` (1-based): its pose from then on. */
  move(id: number, step: number, to: Partial<Pose>, options: MoveOptions = {}): void {
    this.moves[step - 1].set(id, {
      to,
      from: options.from,
      arc: options.arc ?? 0,
      pop: options.pop ?? false,
      bounce: options.bounce ?? false,
      delay: clamp(options.delay ?? 0, 0, 0.5),
    });
  }

  build(way: Way, height: number): Picture {
    const count = this.steps.length;
    // ends[k][i] is sprite i's pose with k steps done.
    const ends: Pose[][] = [this.start];
    for (let k = 1; k <= count; k++) {
      ends.push(ends[k - 1].map((pose, i) => ({ ...pose, ...this.moves[k - 1].get(i)?.to })));
    }
    const sprites = this.sprites;
    return {
      way,
      width: STAGE_W,
      height,
      sprites,
      steps: this.steps,
      at: (done, p, calm = false) => {
        if (done >= count) return ends[count].map((pose) => ({ ...pose }));
        const t = clamp(p, 0, 1);
        return ends[done].map((rest, i) => {
          const move = this.moves[done].get(i);
          if (!move) return { ...rest };
          const from = { ...rest, ...move.from };
          const to = ends[done + 1][i];
          const local = move.delay > 0 ? clamp((t - move.delay) / (1 - move.delay), 0, 1) : t;
          const e = easeInOutCubic(local);
          let scale = from.scale + (to.scale - from.scale) * e;
          let y = from.y + (to.y - from.y) * e;
          if (!calm) {
            y -= move.arc * Math.sin(Math.PI * local);
            if (move.pop) scale *= 1 + 0.25 * Math.sin(Math.PI * clamp((local - 0.6) / 0.4, 0, 1));
            if (move.bounce) scale *= 1 + 0.2 * Math.sin(Math.PI * local);
          }
          return {
            x: from.x + (to.x - from.x) * e,
            y,
            scale,
            opacity: from.opacity + (to.opacity - from.opacity) * e,
            rotate: from.rotate + (to.rotate - from.rotate) * e,
          };
        });
      },
    };
  }
}

// ---------- Ten frames ----------

export interface Frames {
  /** Centre of cell `index` (0 = the first cell of the first frame, then row by row). */
  slot(index: number): { x: number; y: number };
  /** Height of the block of frames. */
  height: number;
}

/** Layout of `count` ten frames (5 x 2 cells), two frames side by side per row of frames. */
export function frameLayout(count: number, cell: number, ox0: number, oy: number): Frames {
  const gapX = cell * 0.5;
  const gapY = cell * 0.4;
  const perRow = Math.min(2, count);
  const rowWidth = perRow * 5 * cell + (perRow - 1) * gapX;
  const left = ox0 + (STAGE_W - 2 * ox0 - rowWidth) / 2;
  const rows = Math.ceil(count / 2);
  return {
    height: rows * 2 * cell + (rows - 1) * gapY,
    slot(index) {
      const frame = Math.floor(index / 10);
      const inFrame = index % 10;
      const fx = left + (frame % 2) * (5 * cell + gapX);
      const fy = oy + Math.floor(frame / 2) * (2 * cell + gapY);
      return gridSlot(inFrame, 5, cell, fx, fy);
    },
  };
}

/** Adds a thin rounded rectangle for each cell of `frames` ten frames. */
export function addFrameCells(
  builder: PictureBuilder,
  frames: Frames,
  frameCount: number,
  cell: number,
): void {
  for (let i = 0; i < frameCount * 10; i++) {
    const { x, y } = frames.slot(i);
    builder.add(
      {
        type: 'rect',
        w: cell * 0.94,
        h: cell * 0.94,
        fill: 'rgba(255,255,255,0.05)',
        stroke: 'rgba(255,255,255,0.4)',
        radius: cell * 0.18,
      },
      x,
      y,
    );
  }
}

// ---------- Number lines ----------

export const LINE_HEIGHT = 180;

export interface NumberLine {
  y: number;
  /** x of the tick for value `v`. */
  xOf(v: number): number;
  /** Where a hopper (centre) sits on tick `v`. */
  hopperAt(v: number): { x: number; y: number };
}

/**
 * Draws a number line at 60% of the stage with ticks from `lo` to `hi`. A line that does not
 * start at 0 gets a `0` at x = 30, a small zigzag break, then the ticks.
 */
export function drawNumberLine(builder: PictureBuilder, lo: number, hi: number): NumberLine {
  const y = LINE_HEIGHT * 0.6;
  const broken = lo >= 4 && hi > 12;
  const first = broken ? lo : 0;
  const x0 = broken ? 80 : 30;
  const gap = (450 - x0) / (hi - first);
  const xOf = (v: number) => (v === 0 && broken ? 30 : x0 + (v - first) * gap);
  const color = 'rgba(255,255,255,0.75)';
  const baseline = (from: number, to: number) =>
    builder.add({ type: 'line', dx: to - from, dy: 0, width: 3, color }, from, y);
  if (broken) {
    baseline(22, 46);
    // The zigzag break.
    builder.add({ type: 'line', dx: 6, dy: -8, width: 3, color }, 46, y);
    builder.add({ type: 'line', dx: 8, dy: 16, width: 3, color }, 52, y - 8);
    builder.add({ type: 'line', dx: 6, dy: -8, width: 3, color }, 60, y + 8);
    baseline(66, 458);
  } else {
    baseline(22, 458);
  }
  const values = broken ? [0, ...range(lo, hi)] : range(0, hi);
  const alternate = gap < 34;
  values.forEach((v, i) => {
    const x = xOf(v);
    builder.add({ type: 'line', dx: 0, dy: 10, width: 3, color }, x, y);
    const drop = alternate && i % 2 === 1 ? 22 : 0;
    builder.add({ type: 'text', text: String(v), size: 18, color: '#fff' }, x, y + 26 + drop);
  });
  return {
    y,
    xOf,
    hopperAt: (v) => ({ x: xOf(v), y: y - HOPPER_SIZE / 2 - 3 }),
  };
}

export const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** A hop's arc: 0.6 of its length, at most 70 units high. */
export const hopArc = (fromX: number, toX: number): number =>
  Math.min(0.6 * Math.abs(toX - fromX), 70);
