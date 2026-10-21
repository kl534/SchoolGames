/**
 * The shared hockey code: the rink, people, puck, effects, teams, HUD and layout that Slap Shot and
 * Shootout Showdown both build on. This file is the script format: where the eight players and the
 * puck are over time, what happens when (types, helpers to read a script, and the `Builder` that
 * writes one). Pure: no three.js and no DOM.
 */
import {
  GOAL_LINE_X,
  PUCK_H,
  clamp,
  goalLineX,
  lerpVec,
  vec,
  type Side,
  type Vec,
} from './geometry';

export type ActorId = 'uC' | 'uW' | 'uD' | 'uG' | 'tC' | 'tW' | 'tD' | 'tG';
export const ACTORS: readonly ActorId[] = ['uC', 'uW', 'uD', 'uG', 'tC', 'tW', 'tD', 'tG'];
export const SKATERS: readonly ActorId[] = ['uC', 'uW', 'uD', 'tC', 'tW', 'tD'];
export const isGoalie = (id: ActorId) => id === 'uG' || id === 'tG';
export const sideOf = (id: ActorId): Side => (id[0] === 'u' ? 'us' : 'them');

export type SkaterMove =
  | 'glide'
  | 'stride'
  | 'carry'
  | 'pass'
  | 'slap'
  | 'wrist'
  | 'deke'
  | 'spin'
  | 'check'
  | 'hit-fall'
  | 'poke'
  | 'block'
  | 'faceoff'
  | 'celebrate'
  | 'slump';
export type GoalieMove = 'ready' | 'glove-save' | 'pad-save' | 'beaten' | 'cover';
export type Move = SkaterMove | GoalieMove;

/** Seconds into a move when the stick meets the puck. */
export const SLAP_CONTACT = 0.4;
export const WRIST_CONTACT = 0.3;
export const SPIN_SECONDS = 0.6;
export const HIT_FALL_SECONDS = 0.9;

export interface Spot {
  pos: Vec;
  /** A point on the ground to look at. */
  face: Vec;
}

export interface Formation {
  spots: Record<ActorId, Spot>;
  carrier: ActorId | null;
  /** Where the puck is (on the carrier's blade, or on the faceoff dot). */
  puck: Vec;
}

export const ground = (x: number, z: number): Vec => vec(x, 0, z);

/** The goalies stand on their creases, following the puck's side a little. */
export function goalieSpots(puckZ: number): Pick<Record<ActorId, Spot>, 'uG' | 'tG'> {
  const z = 0.3 * puckZ;
  const uPos = ground(-(GOAL_LINE_X - 1), z);
  const tPos = ground(GOAL_LINE_X - 1, z);
  return {
    uG: { pos: uPos, face: ground(uPos.x + 5, z) },
    tG: { pos: tPos, face: ground(tPos.x - 5, z) },
  };
}

// ---------- Scripts ----------

/**
 * One actor waypoint: the actor glides in a straight line from the previous key's `pos` and
 * arrives at time `t`; from `t` on it plays `move` (move time restarts at `t`), facing `face`.
 * While gliding it plays the previous key's move.
 */
export interface ActorKey {
  t: number;
  pos: Vec;
  face: Vec;
  move: Move;
}

export type PuckSeg =
  /** On the blade of a player (the goalie's chest when covering). */
  | { kind: 'held'; who: ActorId; t0: number; t1: number }
  | { kind: 'slide'; t0: number; t1: number; a: Vec; b: Vec }
  | { kind: 'air'; t0: number; t1: number; a: Vec; b: Vec; apex: number }
  | { kind: 'still'; t0: number; t1: number; at: Vec };

export type PlayEventType = 'pass' | 'shot' | 'check' | 'save' | 'goal' | 'post' | 'drop' | 'steal';

export interface PlayEvent {
  t: number;
  type: PlayEventType;
  who?: ActorId;
}

export interface PlayScript {
  duration: number;
  actors: Record<ActorId, ActorKey[]>;
  puck: PuckSeg[];
  events: PlayEvent[];
  /** The side that scores at the `goal` event. */
  goal: Side | null;
}

export const lerpNum = (a: number, b: number, t: number) => a + (b - a) * t;

/** Where an actor is and what it plays at time `t`. */
export function actorAt(
  keys: readonly ActorKey[],
  t: number,
): { pos: Vec; face: Vec; move: Move; moveT: number } {
  const first = keys[0];
  if (t <= first.t) {
    return { pos: { ...first.pos }, face: first.face, move: first.move, moveT: Math.max(0, t) };
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

const smooth = (x: number) => {
  const k = clamp(x, 0, 1);
  return k * k * (3 - 2 * k);
};

/** The extra turn of a spinning skater, in radians (a full circle over `SPIN_SECONDS`). */
export function spinYaw(move: Move, t: number): number {
  return move === 'spin' ? Math.PI * 2 * smooth(t / SPIN_SECONDS) : 0;
}

/** How far ahead of the skater the blade is, and how far a goalie holds the puck. */
export const BLADE_AHEAD = 0.9;
export const GOALIE_AHEAD = 0.55;

/**
 * Where the puck is while a player has it: on the blade, ahead of the feet. A skater who is
 * `carry`ing moves it ±0.15 m sideways at 1.5 Hz. Drawing and the planner share this, so the
 * puck meets the stick.
 */
export function bladePos(
  pos: Vec,
  face: Vec,
  move: Move,
  t: number,
  ahead = BLADE_AHEAD,
  out: Vec = vec(),
): Vec {
  let fx = face.x - pos.x;
  let fz = face.z - pos.z;
  const len = Math.hypot(fx, fz) || 1;
  fx /= len;
  fz /= len;
  const yaw = spinYaw(move, t);
  if (yaw !== 0) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    [fx, fz] = [fx * c - fz * s, fx * s + fz * c];
  }
  const side = move === 'carry' ? Math.sin(t * Math.PI * 2 * 1.5) * 0.15 : 0;
  out.x = pos.x + fx * ahead - fz * side;
  out.y = PUCK_H;
  out.z = pos.z + fz * ahead + fx * side;
  return out;
}

/** The blade position of an actor in a script at time `t`. */
export function bladeOf(script: PlayScript, id: ActorId, t: number, out: Vec = vec()): Vec {
  const a = actorAt(script.actors[id], t);
  return bladePos(a.pos, a.face, a.move, a.moveT, isGoalie(id) ? GOALIE_AHEAD : BLADE_AHEAD, out);
}

/** Where the puck is at time `t` of a script. */
export function puckAt(script: PlayScript, t: number, out: Vec = vec()): Vec {
  const segs = script.puck;
  const tt = clamp(t, 0, script.duration);
  let seg = segs.find((s) => tt < s.t1);
  seg ??= segs[segs.length - 1];
  const s = clamp((tt - seg.t0) / Math.max(seg.t1 - seg.t0, 1e-9), 0, 1);
  switch (seg.kind) {
    case 'held':
      return bladeOf(script, seg.who, tt, out);
    case 'still':
      out.x = seg.at.x;
      out.y = seg.at.y;
      out.z = seg.at.z;
      return out;
    case 'slide':
    case 'air': {
      out.x = lerpNum(seg.a.x, seg.b.x, s);
      out.z = lerpNum(seg.a.z, seg.b.z, s);
      out.y = lerpNum(seg.a.y, seg.b.y, s) + (seg.kind === 'air' ? seg.apex * 4 * s * (1 - s) : 0);
      return out;
    }
  }
}

/** The segment of the puck at time `t`. */
export function puckSegAt(script: PlayScript, t: number): PuckSeg {
  const tt = clamp(t, 0, script.duration);
  return script.puck.find((s) => tt < s.t1) ?? script.puck[script.puck.length - 1];
}

// ---------- Building scripts ----------

export const other = (side: Side): Side => (side === 'us' ? 'them' : 'us');

interface Crew {
  C: ActorId;
  W: ActorId;
  D: ActorId;
  G: ActorId;
}
export const CREW: Record<Side, Crew> = {
  us: { C: 'uC', W: 'uW', D: 'uD', G: 'uG' },
  them: { C: 'tC', W: 'tW', D: 'tD', G: 'tG' },
};

type Waypoint = [t: number, x: number, z: number, move?: Move];

export class Builder {
  readonly keys = {} as Record<ActorId, ActorKey[]>;
  private readonly fixed = new Set<ActorKey>();
  readonly segs: PuckSeg[] = [];
  readonly events: PlayEvent[] = [];
  goal: Side | null = null;
  private cur = 0;

  private readonly startPuck: Vec;
  private readonly startCarrier: ActorId | null;

  constructor(
    readonly duration: number,
    from: Formation,
    end: Record<ActorId, Spot & { move?: Move }>,
  ) {
    const start = from.spots;
    this.startPuck = from.puck;
    this.startCarrier = from.carrier;
    for (const id of ACTORS) {
      const first: ActorKey = {
        t: 0,
        pos: { ...start[id].pos },
        face: start[id].face,
        move: isGoalie(id) ? 'ready' : 'glide',
      };
      const last: ActorKey = {
        t: duration,
        pos: { ...end[id].pos },
        face: end[id].face,
        move: end[id].move ?? (isGoalie(id) ? 'ready' : 'glide'),
      };
      this.fixed.add(first);
      this.fixed.add(last);
      this.keys[id] = [first, last];
    }
  }

  /** Waypoints in the player's path: arrive at (x, z) at time t, then play `move`. */
  path(id: ActorId, ...points: Waypoint[]): void {
    for (const [t, x, z, move] of points) {
      this.insert(id, t, ground(x, z), move ?? (isGoalie(id) ? 'ready' : 'glide'));
    }
  }

  /** Starts a move on the path as it is (the shape of the path does not change). */
  act(id: ActorId, t: number, move: Move): void {
    const a = actorAt(this.keys[id], t);
    this.insert(id, t, a.pos, move);
  }

  private insert(id: ActorId, t: number, pos: Vec, move: Move): void {
    const list = this.keys[id];
    const same = list.find((k) => Math.abs(k.t - t) < 1e-6);
    if (same) {
      same.pos = pos;
      same.move = move;
    } else {
      const before = actorAt(list, t);
      const key: ActorKey = { t, pos, face: before.face, move };
      list.push(key);
      list.sort((p, q) => p.t - q.t);
    }
    this.reface(id);
  }

  /** Every key that does not have a fixed facing looks where the player goes next. */
  private reface(id: ActorId): void {
    const list = this.keys[id];
    for (let i = 1; i < list.length - 1; i++) {
      const k = list[i];
      if (this.fixed.has(k)) continue;
      const next = list[i + 1];
      const dx = next.pos.x - k.pos.x;
      const dz = next.pos.z - k.pos.z;
      const len = Math.hypot(dx, dz);
      k.face =
        len > 0.3 ? ground(k.pos.x + (dx / len) * 4, k.pos.z + (dz / len) * 4) : list[i - 1].face;
    }
  }

  /** Looks at a point from a key on (fixes the facing). */
  look(id: ActorId, t: number, at: Vec): void {
    const k = this.keys[id].find((key) => Math.abs(key.t - t) < 1e-6);
    if (!k) return;
    k.face = at;
    this.fixed.add(k);
  }

  at(id: ActorId, t: number) {
    return actorAt(this.keys[id], t);
  }

  pos(id: ActorId, t: number): Vec {
    return this.at(id, t).pos;
  }

  blade(id: ActorId, t: number): Vec {
    const a = this.at(id, t);
    return bladePos(a.pos, a.face, a.move, a.moveT, isGoalie(id) ? GOALIE_AHEAD : BLADE_AHEAD);
  }

  event(t: number, type: PlayEventType, who?: ActorId): void {
    this.events.push(who ? { t, type, who } : { t, type });
  }

  // ----- The puck -----

  get holder(): ActorId | null {
    const last = this.segs[this.segs.length - 1];
    if (!last) return this.startCarrier;
    return last.kind === 'held' ? last.who : null;
  }

  /** Moves the puck's clock on (for a puck that was dropped from the referee's hand). */
  skipTo(t: number): void {
    this.cur = t;
  }

  /** Where the puck is at the cursor. */
  private point(): Vec {
    const last = this.segs[this.segs.length - 1];
    if (!last) return this.startCarrier ? this.blade(this.startCarrier, 0) : { ...this.startPuck };
    if (last.kind === 'held') return this.blade(last.who, last.t1);
    return last.kind === 'still' ? { ...last.at } : { ...last.b };
  }

  held(id: ActorId, t1: number): void {
    if (t1 <= this.cur + 1e-9) return;
    this.segs.push({ kind: 'held', who: id, t0: this.cur, t1 });
    this.cur = t1;
  }

  still(t1: number, at?: Vec): void {
    if (t1 <= this.cur + 1e-9) return;
    this.segs.push({ kind: 'still', t0: this.cur, t1, at: at ?? this.point() });
    this.cur = t1;
  }

  /** Keeps the puck where it is until `t0` (with whoever has it). */
  private waitUntil(t0: number): void {
    const h = this.holder;
    if (h) this.held(h, t0);
    else this.still(t0);
  }

  /** Sends the puck from where it is at `t0` to `to`, arriving at `t1`. */
  send(kind: 'slide' | 'air', t0: number, t1: number, to: Vec, apex = 0): void {
    this.waitUntil(t0);
    const a = this.point();
    this.segs.push(
      kind === 'air'
        ? { kind, t0: this.cur, t1, a, b: to, apex }
        : { kind, t0: this.cur, t1, a, b: to },
    );
    this.cur = t1;
  }

  /** A pass or loose puck that ends on a player's blade at `t1`, who then has it. */
  sendTo(id: ActorId, t0: number, t1: number, kind: 'slide' | 'air' = 'slide', apex = 0): void {
    const from = this.holder;
    this.send(kind, t0, t1, this.blade(id, t1), apex);
    if (from) this.event(t0, 'pass', from);
    this.held(id, t1 + 1e-6);
  }

  /** A shot from the holder's stick at `contact` to a point, arriving at `arrive`. */
  shoot(contact: number, to: Vec, arrive: number, apex = 0): void {
    const who = this.holder;
    this.send('air', contact, arrive, to, apex);
    this.event(contact, 'shot', who ?? undefined);
  }

  /** The puck ends up with `id` by `tArrive`: a pass from the holder (or a slide if loose). */
  give(id: ActorId, tArrive: number): void {
    if (this.holder === id) return;
    const from = this.holder;
    const t0 = Math.max(this.cur, Math.min(tArrive - 0.3, tArrive - 0.1));
    if (from) this.act(from, t0, 'pass');
    this.sendTo(id, t0, tArrive);
  }

  /** The puck stays with whoever has it until the end. */
  finishPuck(carrier: ActorId | null, still?: Vec): void {
    if (carrier) this.give(carrier, Math.max(this.duration - 0.02, this.cur + 0.1));
    const h = this.holder;
    if (h) this.held(h, this.duration);
    else this.still(this.duration, still);
    // Close any rounding gap.
    const last = this.segs[this.segs.length - 1];
    last.t1 = this.duration;
  }

  build(): PlayScript {
    // A skater who has the puck all through a stretch is stickhandling.
    for (const id of SKATERS) {
      const list = this.keys[id];
      list.forEach((k, i) => {
        if (k.move !== 'glide') return;
        const end = i + 1 < list.length ? list[i + 1].t : this.duration;
        const mid = (k.t + end) / 2;
        const seg = this.segs.find((s) => mid >= s.t0 && mid < s.t1);
        if (seg && seg.kind === 'held' && seg.who === id) k.move = 'carry';
      });
    }
    this.events.sort((a, b) => a.t - b.t);
    return {
      duration: this.duration,
      actors: this.keys,
      puck: this.segs,
      events: this.events,
      goal: this.goal,
    };
  }
}

/** Where everybody ends up after a goal: the scorers celebrate, the others hang their heads. */
export function celebration(scorer: Side): Record<ActorId, Spot & { move: Move }> {
  const gx = goalLineX(scorer);
  const d = Math.sign(gx);
  const mine = CREW[scorer];
  const theirs = CREW[other(scorer)];
  const at = (x: number, z: number, move: Move, lookX = gx - 6 * d, lookZ = 0) => ({
    pos: ground(x, z),
    face: ground(lookX, lookZ),
    move,
  });
  const home = goalieSpots(0);
  return {
    [mine.C]: at(gx - 5 * d, -2, 'celebrate'),
    [mine.W]: at(gx - 8 * d, 3, 'celebrate'),
    [mine.D]: at(gx - 12 * d, -1, 'celebrate'),
    [theirs.C]: at(gx - 9 * d, 4.5, 'slump', gx, 0),
    [theirs.W]: at(gx - 11 * d, -4, 'slump', gx, 0),
    [theirs.D]: at(gx - 14 * d, 1, 'slump', gx, 0),
    [mine.G]: { ...home[mine.G as 'uG' | 'tG'], move: 'ready' as Move },
    [theirs.G]: { ...home[theirs.G as 'uG' | 'tG'], move: 'beaten' as Move },
  } as Record<ActorId, Spot & { move: Move }>;
}

const LOW = 0.03;

/** Puts the goal event and the celebration moves in a built script. */
export function scoreAt(b: Builder, scorer: Side, t: number, into: Vec): void {
  b.goal = scorer;
  b.event(t, 'goal');
  const side = CREW[scorer];
  const theirs = CREW[other(scorer)];
  for (const id of [side.C, side.W, side.D]) b.act(id, t + 0.1, 'celebrate');
  for (const id of [theirs.C, theirs.W, theirs.D]) b.act(id, t + 0.1, 'slump');
  // The puck drops to the ice inside the net and stays.
  const rest = vec(into.x + Math.sign(into.x) * 0.2, LOW, into.z * 0.8);
  b.send('air', t, t + 0.25, rest, 0);
  b.still(b.duration, rest);
}

/** A point inside the net a side scores in: a corner, high or low. */
export function netPoint(scorer: Side, z: number, y: number): Vec {
  return vec(goalLineX(scorer) + Math.sign(goalLineX(scorer)) * 0.4, y, z);
}

export function lerpVecXZ(a: Vec, b: Vec, t: number): Vec {
  return ground(lerpNum(a.x, b.x, t), lerpNum(a.z, b.z, t));
}
