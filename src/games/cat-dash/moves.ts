/**
 * The 96 cat moves (24 obstacles, each with two clears and two fails) as authored animations in
 * obstacle-local coordinates. Pure data and maths: `moveFrame(id, outcome, variant, t, out)` says
 * where the cat is and how it looks. The moves of each place group live in `moves/<group>.ts`.
 */
import type { ObstacleId } from './places';
import type { Outcome, Variant } from './rules';
import { HOUSE_MOVES } from './moves/house';
import { TOWN_MOVES } from './moves/town';
import { BUSY_MOVES } from './moves/busy';
import { ADVENTURE_MOVES } from './moves/adventure';
import { EXTRA_MOVES } from './moves/extra';
import { TOYS_PIRATES_MOVES } from './moves/toys-pirates';
import {
  EASE,
  arc,
  clamp01,
  lerp,
  type CatFace,
  type CatFrame,
  type Coat,
  type Ease,
  type Hat,
  type Move,
  type MoveEvent,
  type MoveSpec,
  type ObstacleMoves,
  type CatPose,
} from './moves/toolkit';

export * from './moves/toolkit';

const ALL: Record<ObstacleId, ObstacleMoves> = {
  ...HOUSE_MOVES,
  ...TOWN_MOVES,
  ...BUSY_MOVES,
  ...ADVENTURE_MOVES,
  ...EXTRA_MOVES,
  ...TOYS_PIRATES_MOVES,
};

export const MOVE_SPECS: Record<ObstacleId, MoveSpec> = Object.fromEntries(
  Object.entries(ALL).map(([id, m]) => [id, m.spec]),
) as Record<ObstacleId, MoveSpec>;

/** The comic word of each clear (not spoken). */
export const MOVE_WORDS: Record<ObstacleId, [string, string]> = Object.fromEntries(
  Object.entries(ALL).map(([id, m]) => [id, [m.words[0], m.words[1]]]),
) as Record<ObstacleId, [string, string]>;

interface Built {
  duration: number;
  segs: BuiltSeg[];
  events: MoveEvent[];
}
interface BuiltSeg {
  t0: number;
  d: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  z0: number;
  z1: number;
  rot0: number;
  spin: number;
  sx0: number;
  sy0: number;
  sx1: number;
  sy1: number;
  peak?: number;
  ease: Ease;
  pose: CatPose;
  face: CatFace;
  coat: Coat;
  hat: Hat;
  visible: boolean;
}

function build(move: Move, outcome: Outcome): Built {
  let t = 0;
  let x = 0;
  let y = 0;
  let z = 0;
  let rot = 0;
  let sx = 1;
  let sy = 1;
  let face: CatFace = 'happy';
  let coat: Coat = 'none';
  let hat: Hat = 'none';
  let visible = true;
  const segs: BuiltSeg[] = [];
  for (const [d, x1, y1, pose, o = {}] of move.segs) {
    face = o.face ?? face;
    coat = o.coat ?? coat;
    hat = o.hat ?? hat;
    visible = o.visible ?? visible;
    const seg: BuiltSeg = {
      t0: t,
      d,
      x0: x,
      y0: y,
      x1,
      y1,
      z0: z,
      z1: o.z ?? z,
      rot0: rot,
      spin: o.spin ?? 0,
      sx0: sx,
      sy0: sy,
      sx1: o.sx ?? 1,
      sy1: o.sy ?? 1,
      peak: o.peak,
      ease: o.ease ?? 'l',
      pose,
      face,
      coat,
      hat,
      visible,
    };
    segs.push(seg);
    t += d;
    x = x1;
    y = y1;
    z = seg.z1;
    rot += seg.spin;
    sx = seg.sx1;
    sy = seg.sy1;
  }
  const events: MoveEvent[] = move.events.map(([at, type, ex, ey, color]) => ({
    at,
    type,
    x: ex,
    y: ey,
    ...(color === undefined ? {} : { color }),
  }));
  // A clear always ends with the landing meow.
  if (outcome === 'clear') events.push({ at: Math.max(t - 0.45, 0), type: 'sfx:meow', x, y });
  events.sort((a, b) => a.at - b.at);
  return { duration: t, segs, events };
}

const cache = new Map<string, Built>();
function builtFor(id: ObstacleId, outcome: Outcome, variant: Variant): Built {
  const key = `${id}:${outcome}:${variant}`;
  let b = cache.get(key);
  if (!b) {
    const moves = ALL[id];
    const move = (outcome === 'clear' ? moves.clear : moves.fail)[variant];
    b = build(move, outcome);
    cache.set(key, b);
  }
  return b;
}

export function moveDuration(id: ObstacleId, outcome: Outcome, variant: Variant): number {
  return builtFor(id, outcome, variant).duration;
}

export function moveEvents(id: ObstacleId, outcome: Outcome, variant: Variant): MoveEvent[] {
  return builtFor(id, outcome, variant).events;
}

export function createFrame(): CatFrame {
  return {
    x: 0,
    y: 0,
    rot: 0,
    z: 0,
    sx: 1,
    sy: 1,
    pose: 'run',
    face: 'happy',
    coat: 'none',
    hat: 'none',
    visible: true,
  };
}

/** Fills `out` with the cat at time `t` of a move (clamped to the move's length). */
export function moveFrame(
  id: ObstacleId,
  outcome: Outcome,
  variant: Variant,
  t: number,
  out: CatFrame,
): CatFrame {
  const b = builtFor(id, outcome, variant);
  const time = Math.min(Math.max(t, 0), b.duration);
  let seg = b.segs[b.segs.length - 1];
  for (const s of b.segs) {
    if (time < s.t0 + s.d) {
      seg = s;
      break;
    }
  }
  const u = clamp01((time - seg.t0) / seg.d);
  const e = EASE[seg.ease](u);
  out.x = lerp(seg.x0, seg.x1, e);
  out.y =
    seg.peak !== undefined ? arc(seg.y0, seg.y1, seg.peak, u) : lerp(seg.y0, seg.y1, EASE.io(u));
  out.z = lerp(seg.z0, seg.z1, EASE.io(u));
  out.rot = seg.rot0 + seg.spin * EASE.io(u);
  out.sx = lerp(seg.sx0, seg.sx1, EASE.io(u));
  out.sy = lerp(seg.sy0, seg.sy1, EASE.io(u));
  out.pose = seg.pose;
  out.face = seg.face;
  out.coat = seg.coat;
  out.hat = seg.hat;
  out.visible = seg.visible;
  return out;
}
