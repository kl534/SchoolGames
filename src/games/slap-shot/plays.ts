/**
 * Formations and plays as scripts: where the eight players are over time, where the puck is and
 * what happens when. The rules decide the outcome; this only animates it. Pure: no three.js and
 * no DOM.
 */
import {
  END_DOT_X,
  END_DOT_Z,
  GOAL_LINE_X,
  PUCK_H,
  ZONE_X,
  clamp,
  goalLineX,
  lerpVec,
  vec,
  type Vec,
} from './geometry';
import {
  isOurGoal,
  isTheirGoal,
  type PlayKind,
  type Puck,
  type Side,
  type StopPlay,
  type Zone,
} from './rules';

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

export const MAX_STEP_SECONDS = 1.8;
export const MAX_SAVE_SECONDS = 2.0;
export const MAX_GOAL_SECONDS = 3.2;
/** How long their rush into our end takes, when their puck starts in another zone. */
export const RUSH_SECONDS = 0.6;

/** The longest a play of this kind may run. */
export function maxSeconds(kind: PlayKind): number {
  if (isOurGoal(kind) || isTheirGoal(kind) || kind === 'so-saved' || kind === 'so-stopped') {
    return MAX_GOAL_SECONDS;
  }
  return kind === 'save' ? MAX_SAVE_SECONDS : MAX_STEP_SECONDS;
}

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

const ground = (x: number, z: number): Vec => vec(x, 0, z);
const SKATER_X = 24;
const SKATER_Z = 11;
const clampSkater = (x: number, z: number): Vec =>
  ground(clamp(x, -SKATER_X, SKATER_X), clamp(z, -SKATER_Z, SKATER_Z));

/** The faceoff dot for a zone: the centre dot, or an end-zone dot. */
export function dotOf(zone: Zone): Vec {
  if (zone === 'neutral') return ground(0, 0);
  return ground(zone === 'our-end' ? -END_DOT_X : END_DOT_X, END_DOT_Z);
}

/** The goalies stand on their creases, following the puck's side a little. */
function goalieSpots(puckZ: number): Pick<Record<ActorId, Spot>, 'uG' | 'tG'> {
  const z = 0.3 * puckZ;
  const uPos = ground(-(GOAL_LINE_X - 1), z);
  const tPos = ground(GOAL_LINE_X - 1, z);
  return {
    uG: { pos: uPos, face: ground(uPos.x + 5, z) },
    tG: { pos: tPos, face: ground(tPos.x - 5, z) },
  };
}

/** Where everybody stands for a puck. */
export function formation(puck: Puck): Formation {
  if (puck.kind === 'faceoff') {
    const dot = dotOf(puck.zone);
    const fx = dot.x;
    const fz = dot.z;
    const at = (x: number, z: number, lookX: number): Spot => ({
      pos: clampSkater(x, z),
      face: ground(lookX, fz),
    });
    return {
      carrier: null,
      puck: vec(fx, PUCK_H, fz),
      spots: {
        uC: at(fx - 0.7, fz, fx),
        tC: at(fx + 0.7, fz, fx),
        uW: at(fx - 1.2, fz + 5, fx + 3),
        tW: at(fx + 1.2, fz - 5, fx - 3),
        uD: at(fx - 5, fz - 3, fx + 3),
        tD: at(fx + 5, fz + 3, fx - 3),
        ...goalieSpots(fz),
      },
    };
  }
  const attacker = puck.side;
  const dir = attacker === 'us' ? 1 : -1;
  const X = ZONE_X[puck.zone];
  const a = attacker === 'us' ? 'u' : 't';
  const d = attacker === 'us' ? 't' : 'u';
  const carrierPos = clampSkater(X, 0);
  const lookAhead = (p: Vec): Vec => ground(p.x + 6 * dir, p.z);
  const attack = (p: Vec): Spot => ({ pos: p, face: lookAhead(p) });
  const defend = (p: Vec): Spot => ({ pos: p, face: carrierPos });
  return {
    carrier: `${a}C` as ActorId,
    puck: vec(carrierPos.x + 0.9 * dir, PUCK_H, carrierPos.z),
    spots: {
      [`${a}C`]: attack(carrierPos),
      [`${a}W`]: attack(clampSkater(X + 3 * dir, 7)),
      [`${a}D`]: attack(clampSkater(X - 6 * dir, -4)),
      [`${d}C`]: defend(clampSkater(X + 3 * dir, -1.5)),
      [`${d}W`]: defend(clampSkater(X + 5 * dir, 5)),
      [`${d}D`]: defend(clampSkater(X + 9 * dir, -2)),
      ...goalieSpots(carrierPos.z),
    } as Record<ActorId, Spot>,
  };
}

/** The shootout: the shooter alone at the centre dot, everybody else by the benches. */
export function shootoutFormation(shooter: Side): Formation {
  const dir = shooter === 'us' ? 1 : -1;
  const at = (x: number, z: number, look: number): Spot => ({
    pos: ground(x, z),
    face: ground(x + look, z),
  });
  const spots: Record<ActorId, Spot> = {
    uC: at(-4, 12, 3),
    uW: at(-2, 12, 3),
    uD: at(0, 12, 3),
    tC: at(2, -12, -3),
    tW: at(4, -12, -3),
    tD: at(6, -12, -3),
    ...goalieSpots(0),
  };
  const shooterId: ActorId = shooter === 'us' ? 'uC' : 'tC';
  spots[shooterId] = at(0, 0, 6 * dir);
  return { spots, carrier: shooterId, puck: vec(0.9 * dir, PUCK_H, 0) };
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

const lerpNum = (a: number, b: number, t: number) => a + (b - a) * t;

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

const other = (side: Side): Side => (side === 'us' ? 'them' : 'us');

interface Crew {
  C: ActorId;
  W: ActorId;
  D: ActorId;
  G: ActorId;
}
const CREW: Record<Side, Crew> = {
  us: { C: 'uC', W: 'uW', D: 'uD', G: 'uG' },
  them: { C: 'tC', W: 'tW', D: 'tD', G: 'tG' },
};

type Waypoint = [t: number, x: number, z: number, move?: Move];

class Builder {
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
function celebration(scorer: Side): Record<ActorId, Spot & { move: Move }> {
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
function scoreAt(b: Builder, scorer: Side, t: number, into: Vec): void {
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
function netPoint(scorer: Side, z: number, y: number): Vec {
  return vec(goalLineX(scorer) + Math.sign(goalLineX(scorer)) * 0.4, y, z);
}

export function planPlay(
  kind: PlayKind,
  before: Puck,
  after: Puck,
  random: () => number,
): PlayScript {
  const sgn = random() < 0.5 ? -1 : 1;
  const S = formation(before);
  const E = formation(after);
  const mk = (duration: number, end: Record<ActorId, Spot & { move?: Move }> = E.spots) =>
    new Builder(duration, S, end);

  switch (kind) {
    case 'faceoff-win':
    case 'faceoff-loss':
      return faceoffPlay(kind === 'faceoff-win' ? 'us' : 'them', S, E);
    case 'stretch-pass': {
      const b = mk(1.5);
      b.path('uW', [0.95, -4.5, 6]);
      b.act('uC', 0.35, 'pass');
      b.sendTo('uW', 0.4, 0.95, 'air', 0.25);
      b.finishPuck(E.carrier);
      return b.build();
    }
    case 'tape-to-tape': {
      const b = mk(1.5);
      b.act('uC', 0.15, 'pass');
      b.sendTo('uW', 0.2, 0.6);
      b.finishPuck(E.carrier);
      return b.build();
    }
    case 'skate-out': {
      const b = mk(1.5);
      b.path('uC', [0.5, -13, -7], [1.0, -5, -9]);
      b.finishPuck(E.carrier);
      return b.build();
    }
    case 'spin-o-rama': {
      const b = mk(1.5);
      b.path('uC', [0.45, 5, -0.5, 'spin'], [1.05, 12, 1.5]);
      b.path('tD', [0.5, 6.8, -1.0], [1.0, 8.5, -3]);
      b.finishPuck(E.carrier);
      return b.build();
    }
    case 'toe-drag': {
      const b = mk(1.5);
      b.path('uC', [0.5, 5.5, -0.2, 'deke'], [1.1, 12, 0.8]);
      b.path('tD', [0.65, 7.5, -1.2, 'check'], [1.1, 8.5, -3.2]);
      b.finishPuck(E.carrier);
      return b.build();
    }
    case 'give-and-go':
      return giveAndGo('us', S, E);
    case 'dump-and-chase': {
      const b = mk(1.5);
      b.act('uC', 0.35, 'pass');
      b.send('slide', 0.5, 1.15, vec(23, PUCK_H, 10));
      b.path('uW', [1.15, 22.5, 9.5]);
      b.path('tD', [1.2, 18, 6]);
      b.event(1.15, 'steal', 'uW');
      b.held('uW', 1.16);
      b.finishPuck(E.carrier);
      return b.build();
    }
    case 'one-timer': {
      const b = mk(2.8, celebration('us'));
      b.path('uC', [1.0, 19, -3]);
      b.path('uW', [0.5, 20.5, 5.5], [1.0, 21, 4]);
      b.path('tG', [1.4, 25.6, -0.9]);
      b.act('uC', 0.1, 'pass');
      b.sendTo('uW', 0.15, 0.5);
      b.act('uW', 0.9, 'pass');
      b.sendTo('uC', 1.0, 1.45);
      b.act('uC', 1.15, 'slap');
      b.shoot(1.15 + SLAP_CONTACT, netPoint('us', sgn * 0.7, 1.05), 1.82);
      b.act('tG', 1.5, 'beaten');
      scoreAt(b, 'us', 1.82, netPoint('us', sgn * 0.7, 1.05));
      return b.build();
    }
    case 'wrist-shot': {
      const b = mk(2.8, celebration('us'));
      b.path('uC', [0.8, 19, -1]);
      b.path('tG', [1.2, 25.6, -0.4]);
      b.act('uC', 1.0, 'wrist');
      b.shoot(1.0 + WRIST_CONTACT, netPoint('us', sgn * 0.6, 1.05), 1.55);
      b.act('tG', 1.4, 'beaten');
      scoreAt(b, 'us', 1.55, netPoint('us', sgn * 0.6, 1.05));
      return b.build();
    }
    case 'rebound-goal': {
      const b = mk(2.8, celebration('us'));
      b.path('uD', [0.5, 14, -6]);
      b.path('uW', [1.4, 23.2, sgn * 3.6]);
      b.act('uC', 0.05, 'pass');
      b.sendTo('uD', 0.1, 0.5);
      b.act('uD', 0.5, 'slap');
      b.shoot(0.5 + SLAP_CONTACT, vec(25.7, 0.15, 0.25), 1.35);
      b.act('tG', 1.15, 'pad-save');
      b.event(1.35, 'save', 'tG');
      b.send('slide', 1.35, 1.7, vec(23.2, PUCK_H, sgn * 2.4));
      b.still(1.8);
      b.act('uW', 1.6, 'wrist');
      b.shoot(1.6 + WRIST_CONTACT, netPoint('us', sgn * 0.3, 0.12), 2.05);
      b.act('tG', 1.9, 'beaten');
      scoreAt(b, 'us', 2.05, netPoint('us', sgn * 0.3, 0.12));
      return b.build();
    }
    case 'picked-off': {
      const b = mk(1.5);
      b.act('uC', 0.15, 'pass');
      const lane = lerpVecXZ(b.pos('uC', 0.2), b.pos('uW', 0.75), 0.5);
      b.path('tW', [0.75, lane.x, lane.z]);
      b.sendTo('tW', 0.2, 0.75);
      b.event(0.75, 'steal', 'tW');
      b.finishPuck(E.carrier);
      return b.build();
    }
    case 'save': {
      const b = mk(2.0);
      b.act('uC', 0.15, 'wrist');
      b.shoot(0.15 + WRIST_CONTACT, vec(25.4, 0.9, 0.35), 0.8);
      b.act('tG', 0.5, 'glove-save');
      b.event(0.8, 'save', 'tG');
      b.held('tG', 1.5);
      b.act('tG', 0.95, 'cover');
      b.send('slide', 1.5, 1.9, vec(E.puck.x, PUCK_H, E.puck.z));
      b.still(2.0);
      return b.build();
    }
    case 'steal-score':
    case 'breakaway-against':
    case 'counter-rush':
      return goalAgainstFromOurPuck(kind, S, E, sgn);
    case 'body-check':
    case 'poke-check':
    case 'intercept':
    case 'shot-block':
    case 'goalie-save':
    case 'they-score-wrister':
    case 'they-score-deke':
      return theirPuckPlay(kind, before, E, sgn);
    case 'so-goal':
    case 'so-saved':
    case 'so-stopped':
    case 'so-goal-against':
      return shootoutPlay(kind, sgn);
  }
}

function faceoffPlay(winner: Side, S: Formation, E: Formation): PlayScript {
  const b = new Builder(1.2, S, E.spots);
  const w = CREW[winner];
  b.act('uC', 0.3, 'faceoff');
  b.act('tC', 0.3, 'faceoff');
  const dot = vec(S.puck.x, PUCK_H, S.puck.z);
  b.segs.push({ kind: 'air', t0: 0, t1: 0.15, a: vec(dot.x, 1.1, dot.z), b: dot, apex: 0 });
  b.event(0.15, 'drop');
  // The cursor starts after the drop.
  b.skipTo(0.15);
  b.still(0.35, dot);
  b.sendTo(w.D, 0.35, 0.8);
  b.finishPuck(E.carrier);
  return b.build();
}

function giveAndGo(side: Side, S: Formation, E: Formation): PlayScript {
  const b = new Builder(1.5, S, E.spots);
  const c = CREW[side];
  const c0 = S.spots[c.C].pos;
  const c1 = E.spots[c.C].pos;
  const mid = lerpVec(c0, c1, 0.6);
  b.path(c.C, [0.9, mid.x, clamp(mid.z - 2.5 * (side === 'us' ? 1 : -1), -9, 9)]);
  b.act(c.C, 0.2, 'pass');
  b.sendTo(c.W, 0.25, 0.55);
  b.finishPuck(E.carrier);
  return b.build();
}

function goalAgainstFromOurPuck(
  kind: 'steal-score' | 'breakaway-against' | 'counter-rush',
  S: Formation,
  _E: Formation,
  sgn: number,
): PlayScript {
  const end = celebration('them');
  const target = netPoint('them', sgn * 0.6, 1.05);
  if (kind === 'steal-score') {
    const b = new Builder(2.8, S, end);
    b.path('uC', [0.5, -16.5, 0.3]);
    b.path('tC', [0.5, -15.5, -0.6, 'poke'], [1.5, -22.5, 0.8]);
    b.event(0.5, 'steal', 'tC');
    b.sendTo('tC', 0.5, 0.7);
    b.path('uG', [1.5, -25.6, 0.3]);
    b.act('tC', 1.55, 'wrist');
    b.shoot(1.55 + WRIST_CONTACT, target, 2.05);
    b.act('uG', 1.95, 'beaten');
    scoreAt(b, 'them', 2.05, target);
    return b.build();
  }
  if (kind === 'breakaway-against') {
    const b = new Builder(2.8, S, end);
    const lost = b.pos('uC', 0.35);
    b.path('tC', [0.35, lost.x + 0.9, lost.z - 0.4, 'poke'], [1.85, -22.5, 0.5]);
    b.event(0.35, 'steal', 'tC');
    b.sendTo('tC', 0.35, 0.55);
    b.act('tC', 1.85, 'wrist');
    b.shoot(1.85 + WRIST_CONTACT, target, 2.35);
    b.act('uG', 2.2, 'beaten');
    scoreAt(b, 'them', 2.35, target);
    return b.build();
  }
  const b = new Builder(3.2, S, end);
  b.path('tC', [0.8, 10, -2], [1.5, -8, -1], [2.4, -20.5, 0.5]);
  b.act('uC', 0.1, 'wrist');
  b.shoot(0.1 + WRIST_CONTACT, vec(25.4, 0.9, 0.3), 0.75);
  b.act('tG', 0.45, 'glove-save');
  b.event(0.75, 'save', 'tG');
  b.held('tG', 1.0);
  b.act('tG', 0.8, 'cover');
  b.act('tG', 1.0, 'pass');
  b.send('air', 1.0, 1.5, b.blade('tC', 1.5), 0.5);
  b.event(1.0, 'pass', 'tG');
  b.held('tC', 1.5 + 1e-6);
  b.act('tC', 2.4, 'wrist');
  b.shoot(2.4 + WRIST_CONTACT, target, 2.85);
  b.act('uG', 2.7, 'beaten');
  scoreAt(b, 'them', 2.85, target);
  return b.build();
}

/** Their puck in any zone: they rush into our end if need be, then we stop them or they score. */
function theirPuckPlay(
  kind: StopPlay | 'they-score-wrister' | 'they-score-deke',
  before: Puck,
  E: Formation,
  sgn: number,
): PlayScript {
  const S = formation(before);
  const zone = before.kind === 'held' ? before.zone : 'our-end';
  const rush = zone === 'our-end' ? 0 : RUSH_SECONDS;
  const R = formation({ kind: 'held', side: 'them', zone: 'our-end' });
  const goal = kind === 'they-score-wrister' || kind === 'they-score-deke';
  const duration = goal ? 2.8 : 1.2 + rush;
  const b = new Builder(duration, S, goal ? celebration('them') : E.spots);
  const T = (t: number) => rush + t;
  if (rush > 0) {
    for (const id of ACTORS) {
      const p = R.spots[id].pos;
      b.path(id, [rush, p.x, p.z]);
      b.look(id, rush, R.spots[id].face);
    }
  }
  const X = ZONE_X['our-end'];
  if (kind === 'body-check' || kind === 'poke-check') {
    const hit = kind === 'body-check';
    const tt = T(hit ? 0.22 : 0.3);
    const tc = b.pos('tC', tt);
    const reach = hit ? 0.9 : 1.3;
    b.path('uC', [tt, tc.x - reach, tc.z + 0.3]);
    b.act('uC', tt, hit ? 'check' : 'poke');
    if (hit) {
      b.act('tC', tt, 'hit-fall');
      b.event(tt, 'check', 'uC');
    } else {
      b.event(tt, 'steal', 'uC');
    }
    b.sendTo('uC', tt, T(hit ? 0.75 : 0.72));
    b.finishPuck(E.carrier);
    return b.build();
  }
  if (kind === 'intercept') {
    b.act('tC', T(0.05), 'pass');
    const lane = lerpVecXZ(b.pos('tC', T(0.1)), b.pos('tW', T(0.5)), 0.5);
    b.path('uC', [T(0.5), lane.x, lane.z]);
    b.sendTo('uC', T(0.1), T(0.5));
    b.event(T(0.5), 'steal', 'uC');
    b.finishPuck(E.carrier);
    return b.build();
  }
  if (kind === 'shot-block') {
    b.act('tC', T(0.05), 'pass');
    b.sendTo('tD', T(0.1), T(0.4));
    b.path('uD', [T(0.65), X - 4.5, -1.4, 'block']);
    b.act('tD', T(0.25), 'slap');
    b.shoot(T(0.25) + SLAP_CONTACT, vec(X - 4.5, 0.5, -1.4), T(0.85), 0);
    b.event(T(0.85), 'check', 'uD');
    b.send('slide', T(0.85), T(0.95), vec(X - 4.6, PUCK_H, -1.0));
    b.finishPuck(E.carrier);
    return b.build();
  }
  if (kind === 'goalie-save') {
    b.act('tC', T(0.1), 'wrist');
    b.shoot(T(0.1) + WRIST_CONTACT, vec(-25.4, 0.9, 0.3), T(0.7));
    b.act('uG', T(0.4), 'glove-save');
    b.event(T(0.7), 'save', 'uG');
    b.held('uG', T(0.85));
    b.sendTo('uD', T(0.85), T(1.05));
    b.finishPuck(E.carrier);
    return b.build();
  }
  // Their goals.
  const target = netPoint('them', sgn * 0.6, 1.05);
  if (kind === 'they-score-wrister') {
    b.path('tC', [T(0.9), -20.5, 2.5]);
    b.act('tC', T(0.85), 'wrist');
    b.path('uG', [T(0.9), -25.6, 0.6]);
    b.shoot(T(0.85) + WRIST_CONTACT, target, T(1.45));
    b.act('uG', T(1.3), 'beaten');
    scoreAt(b, 'them', T(1.45), target);
    return b.build();
  }
  const low = netPoint('them', 0.2, 0.15);
  b.path('tC', [T(0.7), -22.5, 3, 'deke'], [T(1.3), -25.5, -0.5]);
  b.path('uG', [T(0.7), -25.6, 1.0], [T(1.3), -25.6, -0.2]);
  b.act('tC', T(1.35), 'wrist');
  b.shoot(T(1.35) + WRIST_CONTACT, low, T(1.8));
  b.act('uG', T(1.5), 'beaten');
  scoreAt(b, 'them', T(1.8), low);
  return b.build();
}

function lerpVecXZ(a: Vec, b: Vec, t: number): Vec {
  return ground(lerpNum(a.x, b.x, t), lerpNum(a.z, b.z, t));
}

/** One shootout shot: the shooter alone from the centre, a deke, a shot. */
function shootoutPlay(
  kind: 'so-goal' | 'so-saved' | 'so-stopped' | 'so-goal-against',
  sgn: number,
): PlayScript {
  const shooter: Side = kind === 'so-goal' || kind === 'so-saved' ? 'us' : 'them';
  const scores = kind === 'so-goal' || kind === 'so-goal-against';
  const S = shootoutFormation(shooter);
  const dir = shooter === 'us' ? 1 : -1;
  const s = CREW[shooter];
  const g = CREW[other(shooter)];
  const end = scores ? celebration(shooter) : { ...S.spots };
  const b = new Builder(2.8, S, end);
  b.path(s.C, [1.2, 16 * dir, 0], [1.7, 21.5 * dir, 0.4 * sgn]);
  b.act(s.C, 1.2, 'deke');
  b.act(s.C, 1.7, 'wrist');
  b.path(g.G, [1.2, 25.6 * dir, 0], [1.6, 25.6 * dir, -0.9 * sgn]);
  const shotAt = 1.7 + WRIST_CONTACT;
  if (scores) {
    const target = netPoint(shooter, 0.5 * sgn, 0.35);
    b.shoot(shotAt, target, 2.15);
    b.act(g.G, 1.9, 'beaten');
    scoreAt(b, shooter, 2.15, target);
  } else {
    b.shoot(shotAt, vec(25.4 * dir, 0.5, -0.5 * sgn), 2.15);
    b.act(g.G, 1.9, 'glove-save');
    b.event(2.15, 'save', g.G);
    b.held(g.G, 2.8);
    b.act(g.G, 2.3, 'cover');
    for (const id of [s.C]) b.act(id, 2.3, 'slump');
  }
  return b.build();
}
