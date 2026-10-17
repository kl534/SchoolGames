/**
 * Plans each play as a script: where the two players are over time, where the ball is, and what
 * happens when. The rules decide the outcome; this only animates it. Pure: no three.js, no DOM.
 */
import {
  BALL_RADIUS,
  FT_DEFENDER,
  FT_SPOT,
  GUARD_R,
  OFFENSE_R,
  RIM,
  RIM_GROUND,
  RIM_RADIUS,
  add,
  clamp,
  dirXZ,
  lerpVec,
  rightOf,
  scale,
  spotPos,
  vec,
  type Vec,
} from './geometry';
import type { Shot } from './rules';

export type Who = 'us' | 'them';
export type Move =
  | 'stand'
  | 'dribble'
  | 'run-dribble'
  | 'run'
  | 'guard'
  | 'jump-shot'
  | 'set-shot'
  | 'layup'
  | 'dunk'
  | 'hang'
  | 'contest'
  | 'block'
  | 'reach'
  | 'stumble'
  | 'rebound'
  | 'celebrate'
  | 'slump';

export const JUMP = { shot: 0.45, layup: 0.6, dunk: 0.75, contest: 0.35, block: 0.6, rebound: 0.4 };

/** One actor waypoint: the actor glides in a straight line from the previous key's `pos` and
 *  arrives at time `t`; from `t` on it plays `move` (move time restarts at `t`), facing `face`
 *  (a point on the ground to look at). While gliding it plays the previous key's move. */
export interface ActorKey {
  t: number;
  pos: Vec;
  face: Vec;
  move: Move;
}

export type BallSeg =
  /** In a player's hand (drawn from the hand), dribbling or held. */
  | { kind: 'held'; who: Who; t0: number; t1: number; dribble: boolean }
  /** Free flight on a parabola from `a` to `b`; `apex` is the peak's height above max(a.y, b.y). */
  | { kind: 'arc'; t0: number; t1: number; a: Vec; b: Vec; apex: number }
  /** A straight line (through the net, a swat, a pop loose on a steal). */
  | { kind: 'line'; t0: number; t1: number; a: Vec; b: Vec }
  /** Rolling round the rim (a free throw that rims out): `turns` laps of the rim. */
  | { kind: 'rim-roll'; t0: number; t1: number; turns: number };

export type PlayEventType =
  | 'release'
  | 'board'
  | 'rim'
  | 'net'
  | 'score'
  | 'block'
  | 'steal'
  | 'rebound'
  | 'contact'
  | 'land'
  | 'bounce';

export interface PlayEvent {
  t: number;
  type: PlayEventType;
  who?: Who;
}

export interface PlayScript {
  duration: number;
  actors: Record<Who, ActorKey[]>;
  ball: BallSeg[]; // in time order, covering 0...duration with no gaps
  events: PlayEvent[]; // in time order
  /** Slow motion, in play time; the renderer plays this window at SLOW_MO_SCALE. */
  slowMo?: { t0: number; t1: number };
}

export type PlayInput =
  | { kind: 'make'; shooter: Who; shot: Shot; andOne: boolean }
  | { kind: 'miss'; shooter: Who; rebound: Who }
  | { kind: 'violation' }
  | { kind: 'free-throw'; shooter: Who; made: boolean }
  | { kind: 'block' }
  | { kind: 'steal' };

export const SLOW_MO_SCALE = 1 / 3;
/** The longest a script may run, in seconds. */
export const MAX_PLAY_SECONDS = 3.2;
/** A player's arm-up reach standing, in metres. */
export const REACH = 2.45;
/** Height of a held ball at the chest. */
const CHEST = 1.15;
/** How high the dribbling hand lets the ball go. */
const DRIBBLE_TOP = 0.95;
/** Bounces a second while dribbling. */
const BOUNCES_PER_SECOND = 2;

const other = (who: Who): Who => (who === 'us' ? 'them' : 'us');
const smooth = (x: number) => {
  const k = clamp(x, 0, 1);
  return k * k * (3 - 2 * k);
};

/** The dribble's ball height over time (BALL_RADIUS on the floor up to the hand at 0.95 m). */
export function dribbleHeight(t: number): number {
  const phase = (((t * BOUNCES_PER_SECOND) % 1) + 1) % 1;
  return BALL_RADIUS + (DRIBBLE_TOP - BALL_RADIUS) * Math.sin(Math.PI * phase);
}

/** Up quickly to `h` at `tPeak`, then back down to the ground by `tEnd`. */
function pulse(t: number, t0: number, tPeak: number, tEnd: number, h: number): number {
  if (t <= t0 || t >= tEnd) return 0;
  if (t < tPeak) return h * Math.sin((Math.PI / 2) * ((t - t0) / (tPeak - t0)));
  return h * Math.cos((Math.PI / 2) * ((t - tPeak) / (tEnd - tPeak)));
}

/** How far a move lifts the body off the ground, `t` seconds into it. */
export function jumpLift(move: Move, t: number): number {
  switch (move) {
    case 'jump-shot':
      return pulse(t, 0.15, 0.35, 0.75, JUMP.shot);
    case 'set-shot':
      return pulse(t, 0.1, 0.3, 0.6, 0.1);
    case 'layup':
      return pulse(t, 0, 0.3, 0.7, JUMP.layup);
    case 'dunk':
      return t <= 0 ? 0 : JUMP.dunk * Math.sin((Math.PI / 2) * Math.min(t / 0.4, 1));
    case 'hang':
      if (t < 0.35) return JUMP.dunk;
      return t < 0.65 ? JUMP.dunk * Math.cos((Math.PI / 2) * ((t - 0.35) / 0.3)) : 0;
    case 'contest':
      return pulse(t, 0, 0.2, 0.45, JUMP.contest);
    case 'block':
      return pulse(t, 0, 0.25, 0.6, JUMP.block);
    case 'rebound':
      return pulse(t, 0, 0.2, 0.5, JUMP.rebound);
    default:
      return 0;
  }
}

/**
 * Where the ball hand is: the ground position, the height of the hand and how far it is held in
 * front of the body. The planner releases the ball from here, and the players' poses are made to
 * match, so the ball meets the hand.
 */
export function handEstimate(move: Move, t: number, pos: Vec, face: Vec, out: Vec): Vec {
  const fwd = dirXZ(pos, face);
  const right = rightOf(fwd);
  let ahead = 0.2;
  let side = 0;
  let y = CHEST;
  switch (move) {
    case 'dribble':
    case 'run-dribble':
      ahead = 0.35;
      side = 0.2;
      y = dribbleHeight(t);
      break;
    case 'jump-shot':
      y = lerpNum(CHEST, REACH, smooth((t - 0.1) / 0.3)) + jumpLift(move, t);
      ahead = 0.15;
      break;
    case 'set-shot':
      y = lerpNum(CHEST, 2.1, smooth(t / 0.35)) + jumpLift(move, t);
      ahead = 0.2;
      break;
    case 'layup':
      y = lerpNum(CHEST, REACH, smooth(t / 0.2)) + jumpLift(move, t);
      ahead = 0.4;
      break;
    case 'dunk':
    case 'hang':
      y = 3.3;
      ahead = 0.8;
      break;
    case 'rebound':
      // Arms up for the ball, then the ball is pulled down to the chest.
      y = lerpNum(REACH + jumpLift(move, t), CHEST, smooth((t - 0.25) / 0.3));
      ahead = 0.1;
      break;
    case 'reach':
      y = 0.9;
      ahead = 0.55;
      break;
    default:
      break;
  }
  out.x = pos.x + fwd.x * ahead + right.x * side;
  out.y = y;
  out.z = pos.z + fwd.z * ahead + right.z * side;
  return out;
}

const lerpNum = (a: number, b: number, t: number) => a + (b - a) * t;

/** Where an actor is (ground position) and what it plays at time `t`. */
export function actorAt(
  keys: ActorKey[],
  t: number,
): { pos: Vec; face: Vec; move: Move; moveT: number } {
  const first = keys[0];
  if (t <= first.t) {
    return { pos: { ...first.pos }, face: first.face, move: first.move, moveT: t - first.t };
  }
  for (let i = 1; i < keys.length; i++) {
    const prev = keys[i - 1];
    const next = keys[i];
    if (t < next.t) {
      const k = (t - prev.t) / Math.max(next.t - prev.t, 1e-9);
      return {
        pos: lerpVec(prev.pos, next.pos, k),
        face: prev.face,
        move: prev.move,
        moveT: t - prev.t,
      };
    }
  }
  const last = keys[keys.length - 1];
  return { pos: { ...last.pos }, face: last.face, move: last.move, moveT: t - last.t };
}

/** The hand the script's ball would be drawn from if the model's hand were exactly as estimated. */
export function scriptHand(script: PlayScript, who: Who, t: number, out: Vec): Vec {
  const a = actorAt(script.actors[who], t);
  return handEstimate(a.move, a.moveT, a.pos, a.face, out);
}

// ---------- The ball ----------

/** Height on a parabola from `a` to `b` whose peak is `apex` above the higher end, at `s` in 0..1. */
function arcHeight(ay: number, by: number, apex: number, s: number): number {
  const m = by - ay;
  const top = Math.max(ay, by) + Math.max(apex, 0);
  const d = top - ay;
  const k = 2 * d - m + 2 * Math.sqrt(Math.max(d * (d - m), 0));
  return ay + (m + k) * s - k * s * s;
}

/** The end of a segment, when it has a definite one. */
function segEnd(seg: BallSeg | undefined): Vec | null {
  if (!seg) return null;
  if (seg.kind === 'arc' || seg.kind === 'line') return seg.b;
  return null;
}

/** Where the ball is at play time `t`; `hand(who)` gives the live hand position for 'held'. */
export function ballAt(script: PlayScript, t: number, hand: (who: Who) => Vec, out: Vec): Vec {
  const segs = script.ball;
  const tt = clamp(t, 0, script.duration);
  let i = segs.findIndex((s) => tt < s.t1);
  if (i < 0) i = segs.length - 1;
  const seg = segs[i];
  const s = clamp((tt - seg.t0) / Math.max(seg.t1 - seg.t0, 1e-9), 0, 1);
  switch (seg.kind) {
    case 'held': {
      const h = hand(seg.who);
      out.x = h.x;
      out.y = seg.dribble ? dribbleHeight(tt - seg.t0) : h.y;
      out.z = h.z;
      break;
    }
    case 'line':
      out.x = lerpNum(seg.a.x, seg.b.x, s);
      out.y = lerpNum(seg.a.y, seg.b.y, s);
      out.z = lerpNum(seg.a.z, seg.b.z, s);
      break;
    case 'arc':
      out.x = lerpNum(seg.a.x, seg.b.x, s);
      out.y = arcHeight(seg.a.y, seg.b.y, seg.apex, s);
      out.z = lerpNum(seg.a.z, seg.b.z, s);
      break;
    case 'rim-roll': {
      const from = segEnd(segs[i - 1]) ?? { x: RIM.x, y: RIM.y, z: RIM.z + RIM_RADIUS };
      const start = Math.atan2(from.z - RIM.z, from.x - RIM.x);
      const angle = start + Math.PI * 2 * seg.turns * s;
      out.x = RIM.x + Math.cos(angle) * RIM_RADIUS;
      out.y = RIM.y + 0.03;
      out.z = RIM.z + Math.sin(angle) * RIM_RADIUS;
      break;
    }
  }
  return out;
}

// ---------- Building scripts ----------

class Builder {
  ball: BallSeg[] = [];
  events: PlayEvent[] = [];
  actors: Record<Who, ActorKey[]> = { us: [], them: [] };
  slowMo: { t0: number; t1: number } | undefined;
  /** Time and place the ball segments have got to. */
  t = 0;
  at: Vec = vec();

  key(who: Who, t: number, pos: Vec, face: Vec, move: Move) {
    this.actors[who].push({ t, pos, face, move });
  }

  event(t: number, type: PlayEventType, who?: Who) {
    this.events.push(who ? { t, type, who } : { t, type });
  }

  held(who: Who, t1: number, dribble = false) {
    if (t1 <= this.t) return;
    this.ball.push({ kind: 'held', who, t0: this.t, t1, dribble });
    this.t = t1;
  }

  /** Where the ball leaves the hand. */
  from(a: Vec) {
    this.at = a;
  }

  arc(t1: number, b: Vec, apex: number) {
    this.ball.push({ kind: 'arc', t0: this.t, t1, a: this.at, b, apex });
    this.t = t1;
    this.at = b;
  }

  line(t1: number, b: Vec) {
    this.ball.push({ kind: 'line', t0: this.t, t1, a: this.at, b });
    this.t = t1;
    this.at = b;
  }

  roll(t1: number, turns: number) {
    this.ball.push({ kind: 'rim-roll', t0: this.t, t1, turns });
    this.t = t1;
  }

  /** From the net's mouth down through it, then falls and bounces once on the floor. */
  dropAfterNet(u: Vec) {
    const tNet = this.t;
    this.line(tNet + 0.25, { x: RIM.x, y: 2.4, z: RIM.z });
    const floor = (k: number): Vec => ({
      x: RIM_GROUND.x + u.x * k,
      y: BALL_RADIUS,
      z: RIM_GROUND.z + u.z * k,
    });
    this.arc(tNet + 0.75, floor(0.4), 0);
    this.event(tNet + 0.75, 'bounce');
    this.arc(tNet + 1.3, floor(0.9), 0.6);
  }

  build(): PlayScript {
    const events = [...this.events].sort((a, b) => a.t - b.t);
    const script: PlayScript = {
      duration: this.t,
      actors: this.actors,
      ball: this.ball,
      events,
    };
    if (this.slowMo) script.slowMo = this.slowMo;
    return script;
  }
}

const rimTop = (): Vec => ({ x: RIM.x, y: RIM.y + 0.1, z: RIM.z });

function hand(move: Move, t: number, pos: Vec, face: Vec): Vec {
  return handEstimate(move, t, pos, face, vec());
}

/** Everything a play needs to know about where the two players start. */
interface Spots {
  /** Where the ball handler / shooter starts, and the defender. */
  s: Vec;
  g: Vec;
  /** Unit vector from the rim out to the shooter, and to its right. */
  u: Vec;
  p: Vec;
}

function spots(angle: number): Spots {
  const s = spotPos(angle, OFFENSE_R);
  const g = spotPos(angle, GUARD_R);
  const u = dirXZ(RIM_GROUND, s);
  return { s, g, u, p: rightOf(u) };
}

const at = (base: Vec, dir: Vec, k: number): Vec => add(base, scale(dir, k));

// ---------- The plays ----------

function planMake(
  b: Builder,
  sh: Who,
  shot: Shot,
  andOne: boolean,
  { s, g, u, p }: Spots,
  random: () => number,
) {
  const df = other(sh);
  const rim = RIM_GROUND;
  if (shot === 'three') {
    b.key(sh, 0, s, rim, 'jump-shot');
    b.key(sh, 1.7, s, rim, 'celebrate');
    b.key(df, 0, g, s, 'guard');
    b.key(df, 0.3, g, s, 'contest');
    b.key(df, 1.2, g, s, 'stand');
    b.held(sh, 0.45);
    b.from(hand('jump-shot', 0.45, s, rim));
    b.event(0.45, 'release', sh);
    b.arc(1.5, rimTop(), 1.6);
    b.event(1.5, 'net');
    b.event(1.55, 'score', sh);
    b.dropAfterNet(u);
  } else if (shot === 'jumper') {
    const s2 = at(s, u, -1.8);
    b.key(sh, 0, s, rim, 'run-dribble');
    b.key(sh, 0.45, s2, rim, 'jump-shot');
    b.key(sh, 1.9, s2, rim, 'celebrate');
    const g2 = at(g, u, -1);
    b.key(df, 0, g, s, 'run');
    b.key(df, 0.55, g2, s2, 'contest');
    b.key(df, 1.3, g2, s2, 'stand');
    b.held(sh, 0.45, true);
    b.held(sh, 0.9);
    b.from(hand('jump-shot', 0.45, s2, rim));
    b.event(0.9, 'release', sh);
    b.arc(1.75, rimTop(), 1.2);
    b.event(1.75, 'net');
    b.event(1.8, 'score', sh);
    b.dropAfterNet(u);
  } else if (shot === 'layup') {
    const side = random() < 0.5 ? -1 : 1;
    const l = add(at(RIM_GROUND, u, 1.0), scale(p, 0.7 * side));
    b.key(sh, 0, s, rim, 'run-dribble');
    b.key(sh, 0.9, l, rim, 'layup');
    b.key(sh, 1.9, l, rim, 'celebrate');
    const g2 = lerpVec(g, l, 0.55);
    b.key(df, 0, g, l, 'run');
    b.key(df, 0.8, g2, l, 'reach');
    b.key(df, 1.5, g2, l, 'stand');
    if (andOne) b.event(0.9, 'contact', sh);
    b.held(sh, 0.9, true);
    b.held(sh, 1.15);
    b.from(hand('layup', 0.25, l, rim));
    b.event(1.15, 'release', sh);
    const boardX = clamp(l.x * 0.3, -0.25, 0.25);
    b.line(1.4, { x: boardX, y: 3.35, z: 1.23 });
    b.event(1.4, 'board');
    b.line(1.65, rimTop());
    b.event(1.65, 'net');
    b.event(1.7, 'score', sh);
    b.dropAfterNet(u);
  } else {
    // dunk
    const d = at(RIM_GROUND, u, 0.9);
    b.key(sh, 0, s, rim, 'run-dribble');
    b.key(sh, 0.8, d, rim, 'dunk');
    b.key(sh, 1.25, d, rim, 'hang');
    b.key(sh, 2.1, d, rim, 'celebrate');
    const g2 = at(g, u, 0.6);
    b.key(df, 0, g, d, 'guard');
    b.key(df, 0.7, g, d, 'stumble');
    b.key(df, 1.2, g2, d, 'stand');
    if (andOne) b.event(0.8, 'contact', sh);
    b.held(sh, 0.8, true);
    b.held(sh, 1.15);
    b.from({ x: RIM.x, y: 3.3, z: RIM.z });
    b.event(1.15, 'release', sh);
    b.line(1.35, { x: RIM.x, y: 2.2, z: RIM.z });
    b.event(1.25, 'net');
    b.event(1.25, 'score', sh);
    b.event(1.9, 'land', sh);
    // Falls to the floor and bounces once.
    const floor = (k: number): Vec => ({
      x: RIM_GROUND.x + u.x * k,
      y: BALL_RADIUS,
      z: RIM_GROUND.z + u.z * k,
    });
    b.arc(1.85, floor(0.4), 0);
    b.event(1.85, 'bounce');
    b.arc(2.45, floor(0.9), 0.6);
    b.slowMo = { t0: 1.05, t1: 1.35 };
  }
}

function planMiss(b: Builder, sh: Who, rb: Who, { s, g, u, p }: Spots, random: () => number) {
  const df = other(sh);
  const rim = RIM_GROUND;
  const side = random() < 0.5 ? -1 : 1;
  const r = add(at(RIM_GROUND, u, 2.0), scale(p, 1.2 * side));
  const r2 = add(at(RIM_GROUND, u, 2.6), scale(p, -0.5 * side));
  b.key(sh, 0, s, rim, 'jump-shot');
  b.key(sh, 0.8, s, rim, 'run');
  b.key(df, 0, g, s, 'guard');
  b.key(df, 0.3, g, s, 'contest');
  b.key(df, 0.8, g, s, 'run');
  const catcher = rb;
  const loser = other(rb);
  b.key(catcher, 1.9, r, rim, 'rebound');
  b.key(catcher, 2.5, r, rim, 'stand');
  b.key(loser, 2.2, r2, r, 'contest');
  b.key(loser, 2.8, r2, r, 'stand');

  b.held(sh, 0.45);
  b.from(hand('jump-shot', 0.45, s, rim));
  b.event(0.45, 'release', sh);
  const front: Vec = { x: RIM.x + u.x * RIM_RADIUS, y: 3.08, z: RIM.z + u.z * RIM_RADIUS };
  b.arc(1.5, front, 1.4);
  b.event(1.5, 'rim');
  b.arc(2.05, hand('rebound', 0.15, r, rim), 0.8);
  b.event(2.1, 'rebound', rb);
  b.held(rb, 2.8);
}

function planViolation(b: Builder, { s, g }: Spots) {
  b.key('us', 0, s, RIM_GROUND, 'dribble');
  b.key('us', 0.2, s, RIM_GROUND, 'stand');
  b.key('us', 0.4, s, RIM_GROUND, 'slump');
  b.key('them', 0, g, s, 'guard');
  b.key('them', 0.6, g, s, 'stand');
  b.held('us', 0.2, true);
  b.held('us', 1.4);
}

function planFreeThrow(b: Builder, sh: Who, made: boolean) {
  const df = other(sh);
  const rim = RIM_GROUND;
  const u = dirXZ(RIM_GROUND, FT_SPOT);
  b.key(df, 0, FT_DEFENDER, rim, 'stand');
  b.held(sh, 0.45);
  b.from(hand('set-shot', 0.45, FT_SPOT, rim));
  b.event(0.45, 'release', sh);
  if (made) {
    b.key(sh, 0, FT_SPOT, rim, 'set-shot');
    b.key(sh, 1.7, FT_SPOT, rim, 'stand');
    b.arc(1.35, rimTop(), 1.3);
    b.event(1.35, 'net');
    b.event(1.4, 'score', sh);
    b.dropAfterNet(u);
    return;
  }
  b.key(sh, 0, FT_SPOT, rim, 'set-shot');
  b.key(sh, 1.9, FT_SPOT, rim, 'slump');
  b.key(df, 1.9, FT_DEFENDER, rim, 'rebound');
  b.key(df, 2.5, FT_DEFENDER, rim, 'stand');
  const back: Vec = { x: RIM.x - u.x * RIM_RADIUS, y: 3.08, z: RIM.z - u.z * RIM_RADIUS };
  b.arc(1.35, back, 1.3);
  b.event(1.35, 'rim');
  b.roll(1.85, 1);
  b.arc(2.3, hand('rebound', 0.4, FT_DEFENDER, rim), 0.4);
  b.event(2.3, 'rebound', df);
  b.held(df, 2.7);
}

function planBlock(b: Builder, { s, g, u }: Spots) {
  const rim = RIM_GROUND;
  b.key('them', 0, s, rim, 'jump-shot');
  b.key('them', 1.2, s, rim, 'slump');
  const g1 = at(g, u, 0.7);
  b.key('us', 0, g, s, 'run');
  b.key('us', 0.2, g1, s, 'block');
  b.key('us', 1.4, g1, s, 'stand');
  b.held('them', 0.4);
  const release = hand('jump-shot', 0.4, s, rim);
  b.from(release);
  b.event(0.4, 'release', 'them');
  const toRim = dirXZ(release, RIM);
  b.line(0.45, add(release, scale(toRim, 0.3)));
  b.event(0.45, 'block', 'us');
  const sign = s.x > 0.01 ? -1 : 1;
  b.arc(1.05, { x: s.x + 3.5 * sign, y: BALL_RADIUS, z: s.z + 1.5 }, 0.8);
  b.event(1.05, 'bounce');
  b.arc(1.65, { x: s.x + 4.4 * sign, y: BALL_RADIUS, z: s.z + 2.2 }, 0.35);
  b.slowMo = { t0: 0.35, t1: 0.55 };
}

function planSteal(b: Builder, { s, g, u }: Spots) {
  const rim = RIM_GROUND;
  const s2 = at(s, u, -1.0);
  b.key('them', 0, s, rim, 'run-dribble');
  b.key('them', 0.4, s2, rim, 'stumble');
  const g2 = at(g, u, 1.5);
  b.key('us', 0, g, s, 'guard');
  b.key('us', 0.35, g, s2, 'reach');
  b.key('us', 0.75, g, at(g, u, 8), 'run-dribble');
  b.key('us', 1.5, g2, g2, 'stand');
  b.held('them', 0.5, true);
  const bounce = hand('run-dribble', 0.5, s2, RIM_GROUND);
  b.from({ x: bounce.x, y: BALL_RADIUS, z: bounce.z });
  b.event(0.5, 'steal', 'us');
  const q = hand('run-dribble', 0, g, s2);
  b.line(0.75, { x: q.x, y: BALL_RADIUS, z: q.z });
  b.held('us', 1.5, true);
}

/** Plans a play for a spot angle. `random` is only used for sides (which way a rebound goes). */
export function planPlay(input: PlayInput, spotAngle: number, random: () => number): PlayScript {
  const b = new Builder();
  const sp = spots(spotAngle);
  switch (input.kind) {
    case 'make':
      planMake(b, input.shooter, input.shot, input.andOne, sp, random);
      break;
    case 'miss':
      planMiss(b, input.shooter, input.rebound, sp, random);
      break;
    case 'violation':
      planViolation(b, sp);
      break;
    case 'free-throw':
      planFreeThrow(b, input.shooter, input.made);
      break;
    case 'block':
      planBlock(b, sp);
      break;
    case 'steal':
      planSteal(b, sp);
      break;
  }
  return b.build();
}
