/**
 * The script of a play: where every fielder runs and what he does, where the ball is each moment,
 * and how the runners round the bases, planned from the result the rules decided. The planner only
 * animates that result and never decides it. Pure numbers, so it is easy to test.
 */
import type { BattedBall } from './batted';
import {
  assignDefense,
  baseSpot,
  pickFielder,
  POSITIONS,
  REACTION,
  speedOf,
  throwSpot,
  wallFielder,
  wallSpot,
  OUTFIELDERS,
  type Assignment,
} from './defense';
import {
  BASE_SIDE,
  BASE_SPOTS,
  LAP,
  fieldAngle,
  MOUND_HEIGHT,
  RUN_SPEED,
  wallRadius,
  type Vec,
} from './flight';
import {
  hitOfKind,
  type Bases,
  type HitKind,
  type Move,
  type OutCall,
  type Position,
} from './rules';

export { REACTION, OF_SPEED, IF_SPEED, PC_SPEED } from './defense';
export { RUN_SPEED } from './flight';

// ---------- Timing constants ----------

/** The batter drops the bat and leaves the box. */
export const BATTER_START = 0.25;
/** Runners leave at contact on ground balls. */
export const RUNNER_START = 0.05;
/** Overhand throws, in units per second. */
export const THROW_SPEED_OF = 24;
export const THROW_SPEED_IF = 28;
/** An underhand flip, for throws of 6 units or less. */
export const FLIP_SPEED = 11;
/** A soft lob back to the pitcher. */
export const LOB_SPEED = 14;
/** Arc height of a throw `d` units long. */
export const throwLift = (d: number) => Math.min(0.3 + 0.03 * d, 2.2);
/** Seconds from catch to release: an outfielder's crow hop, an infielder's, a flip. */
export const RELEASE_OF = 0.38;
export const RELEASE_IF = 0.22;
export const RELEASE_FLIP = 0.12;
/** A relay man catches, turns and throws. */
export const RELAY_TRANSFER = 0.18;
/** On a close play the ball arrives this long after the runner. */
export const SAFE_MARGIN = 0.2;
/** A runner slides if the ball arrives within this of him; otherwise he goes in standing. */
export const SLIDE_IF_WITHIN = 0.6;
/** On an out the ball beats the runner by at least this. */
export const OUT_MARGIN = 0.2;
/** The longest a play that stays in the park runs. */
export const PLAY_MAX = 5.0;

// ---------- The script ----------

export type FielderPose =
  | 'ready'
  | 'scoop'
  | 'backhand'
  | 'barehand'
  | 'throw'
  | 'flip'
  | 'lob'
  | 'receive'
  | 'stretch'
  | 'pivot'
  | 'settle'
  | 'basket'
  | 'dive'
  | 'dive-miss'
  | 'leap'
  | 'call-for-it'
  | 'point-up'
  | 'cover'
  | 'tag'
  | 'watch'
  | 'let-go'
  | 'mask-off';

export type FielderAction =
  | { at: number; do: 'run'; to: Vec; speed: number; face?: Vec }
  | { at: number; do: 'pose'; pose: FielderPose; toward?: Vec; side?: -1 | 1 }
  | { at: number; do: 'face'; point: Vec };

export type BallLeg =
  | { kind: 'batted'; start: number; end: number; ball: BattedBall }
  | { kind: 'held'; start: number; end: number; by: Position; hand: 'L' | 'R' }
  | {
      kind: 'throw';
      start: number;
      end: number;
      from: Vec;
      to: Vec;
      lift: number;
      by: Position;
      to_: Position;
      style: 'overhand' | 'flip' | 'lob';
    }
  | { kind: 'roll'; start: number; end: number; from: Vec; to: Vec };

export interface RunnerScript {
  /** 0 the batter, 1 to 3 the base he started on. */
  from: number;
  /** Where he runs after leaving (and after any hold), and when he leaves. */
  route: Vec[];
  leaveAt: number;
  /** Halfway on a bloop, or on the bag tagging up: he waits there until `until`. */
  holdAt?: { p: Vec; until: number };
  speed: number;
  /** When he first reaches the base he finishes on. */
  arriveAt: number;
  /** Every base he reaches, and when (4 is home). */
  touches: { base: number; at: number }[];
  /** When he has finished moving. */
  doneAt: number;
  finish: 'stand' | 'slide' | 'overrun' | 'turn-and-back' | 'score' | 'out' | 'retreat';
  /** He slides in (a scoring runner slides into home, then cheers). */
  slides?: boolean;
}

export type PlayEvent =
  | { at: number; type: 'catch'; by: Position }
  | { at: number; type: 'out'; who: number }
  | { at: number; type: 'run'; who: number }
  | { at: number; type: 'safe'; base: number }
  | { at: number; type: 'wall' | 'land' | 'dust'; p: Vec };

export interface PlayScript {
  /** Contiguous in time. */
  legs: BallLeg[];
  /** Every position has at least one action. */
  fielders: Record<Position, FielderAction[]>;
  runners: RunnerScript[];
  events: PlayEvent[];
  /** What the camera frames from a time on, besides the ball. */
  frames: { from: number; points: Vec[] }[];
  duration: number;
  /** Who fields the ball first. */
  fielder: Position;
}

export interface PlayInput {
  ball: BattedBall;
  /** The rules' result: who moves where, who is out. */
  moves: Move[];
  retired: number[];
  /** Before the play. */
  bases: Bases;
  outs: number;
  call: HitKind | OutCall;
  /** Where each fielder really stands now. */
  spots: Record<Position, Vec>;
  /** Where each runner stands now: 0 is the batter at the plate, 1 to 3 the bases. */
  leads: (Vec | null)[];
  /** The runs that count (the mercy rule or a walk-off can cut them short). */
  runs?: number;
}

// ---------- Small geometry ----------

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
const dist3 = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const at = (x: number, z: number, y = 0): Vec => ({ x, y, z });
const toward = (from: Vec, to: Vec, by: number): Vec => {
  const d = Math.max(dist(from, to), 1e-6);
  return at(from.x + ((to.x - from.x) / d) * by, from.z + ((to.z - from.z) / d) * by);
};
const DIAMOND_CENTRE = at(0, BASE_SPOTS[2].z / 2);

// ---------- Rounding the bases ----------

/** How far out the runner bows before a base, and how far in front of and past it he turns. */
const BEND = 1.2;
const LEAD_IN = 2;
const LEAD_OUT = 2;

/**
 * The points a runner passes after leaving base `fromBase` (0 is home plate) to reach `toBase`
 * (4 is home): a curve at each base he passes (he bows out towards foul ground before the bag,
 * cuts across its inside corner, then heads for the next), and the base itself where he stops.
 * `baseAt` says which point is each base.
 */
export function roundRouteInfo(
  fromBase: number,
  toBase: number,
): { points: Vec[]; baseAt: Record<number, number> } {
  const points: Vec[] = [];
  const baseAt: Record<number, number> = {};
  for (let b = fromBase + 1; b <= toBase; b++) {
    const spot = baseSpot(b);
    if (b < toBase) {
      const prev = baseSpot(b - 1);
      const next = baseSpot(b + 1);
      const dIn = Math.max(dist(prev, spot), 1e-6);
      const dOut = Math.max(dist(spot, next), 1e-6);
      const inX = (spot.x - prev.x) / dIn;
      const inZ = (spot.z - prev.z) / dIn;
      const outX = (next.x - spot.x) / dOut;
      const outZ = (next.z - spot.z) / dOut;
      const awayD = Math.max(dist(spot, DIAMOND_CENTRE), 1e-6);
      const awayX = (spot.x - DIAMOND_CENTRE.x) / awayD;
      const awayZ = (spot.z - DIAMOND_CENTRE.z) / awayD;
      points.push(at(spot.x - inX * LEAD_IN + awayX * BEND, spot.z - inZ * LEAD_IN + awayZ * BEND));
      baseAt[b] = points.length;
      points.push(at(spot.x - awayX * 0.2, spot.z - awayZ * 0.2));
      points.push(at(spot.x + outX * LEAD_OUT, spot.z + outZ * LEAD_OUT));
    } else {
      baseAt[b] = points.length;
      points.push(at(spot.x, spot.z));
    }
  }
  return { points, baseAt };
}

/** The points a runner passes going from one base to another, curving round each base. */
export function roundRoute(fromBase: number, toBase: number): Vec[] {
  return roundRouteInfo(fromBase, toBase).points;
}

// ---------- Where a fielder is, from his actions ----------

interface Segment {
  t0: number;
  from: Vec;
  to: Vec;
  t1: number;
}

/** A fielder's positions over time, replaying his `run` actions from where he starts. */
export function fielderTrack(actions: FielderAction[], start: Vec): (t: number) => Vec {
  const segments: Segment[] = [];
  const positionAt = (t: number): Vec => {
    let pos = start;
    for (const s of segments) {
      if (t < s.t0) break;
      if (t >= s.t1) pos = s.to;
      else {
        const k = (t - s.t0) / Math.max(s.t1 - s.t0, 1e-6);
        return at(s.from.x + (s.to.x - s.from.x) * k, s.from.z + (s.to.z - s.from.z) * k);
      }
    }
    return pos;
  };
  for (const a of [...actions].sort((x, y) => x.at - y.at)) {
    if (a.do !== 'run') continue;
    const from = positionAt(a.at);
    segments.push({ t0: a.at, from, to: a.to, t1: a.at + dist(from, a.to) / a.speed });
  }
  return positionAt;
}

// ---------- The planner ----------

const emptyFielders = (): Record<Position, FielderAction[]> =>
  Object.fromEntries(POSITIONS.map((p) => [p, [] as FielderAction[]])) as Record<
    Position,
    FielderAction[]
  >;

const isOutfielder = (p: Position) => OUTFIELDERS.includes(p);

/** The time the ball takes to fly `d` units in a style, and the delay from catch to release. */
function throwTiming(
  by: Position,
  d: number,
): {
  style: 'overhand' | 'flip' | 'lob';
  speed: number;
  release: number;
} {
  if (!isOutfielder(by) && d <= 6) {
    return { style: 'flip', speed: FLIP_SPEED, release: RELEASE_FLIP };
  }
  return isOutfielder(by)
    ? { style: 'overhand', speed: THROW_SPEED_OF, release: RELEASE_OF }
    : { style: 'overhand', speed: THROW_SPEED_IF, release: RELEASE_IF };
}

interface RunnerBuild {
  move: Move;
  start: Vec;
  leaveAt: number;
  speed: number;
  hold?: { p: Vec; until: number };
  tail: 'none' | 'turn' | 'overrun';
}

/** Plays the runner's route out in time: when he touches each base and when he stops. */
function runRunner(r: RunnerBuild): RunnerScript {
  const { move } = r;
  const info = roundRouteInfo(move.from, move.to);
  const route = [...info.points];
  let t = r.leaveAt;
  let pos = r.start;
  const touches: { base: number; at: number }[] = [];
  if (r.hold) {
    t = Math.max(t + dist(pos, r.hold.p) / r.speed, r.hold.until);
    pos = r.hold.p;
  }
  const baseIndex = Object.fromEntries(Object.entries(info.baseAt).map(([b, i]) => [i, Number(b)]));
  route.forEach((p, i) => {
    t += dist(pos, p) / r.speed;
    pos = p;
    if (baseIndex[i] !== undefined) touches.push({ base: baseIndex[i], at: t });
  });
  const arriveAt = t;
  const end = baseSpot(move.to);
  if (move.to < 4 && r.tail !== 'none') {
    // A turn past the bag towards the next base (or straight on, after first), and back.
    const prev = baseSpot(move.to - 1);
    const next = baseSpot(move.to + 1);
    const beyond =
      r.tail === 'overrun'
        ? toward(end, at(2 * end.x - prev.x, 2 * end.z - prev.z), 2)
        : toward(end, next, 2);
    route.push(beyond, at(end.x, end.z));
    t += (dist(end, beyond) * 2) / r.speed;
  }
  const score = move.to >= 4;
  return {
    from: move.from,
    route,
    leaveAt: r.leaveAt,
    holdAt: r.hold,
    speed: r.speed,
    arriveAt,
    touches,
    doneAt: t,
    finish: score
      ? 'score'
      : r.tail === 'overrun'
        ? 'overrun'
        : r.tail === 'turn'
          ? 'turn-and-back'
          : 'stand',
  };
}

const touchAt = (r: RunnerScript, base: number): number | undefined =>
  r.touches.find((x) => x.base === base)?.at;

/** Plans the play. Deterministic: all randomness comes in through the ball and the rules' picks. */
export function planPlay(input: PlayInput): PlayScript {
  const kind = input.call as HitKind;
  if (typeof input.call === 'string') {
    return planHit(input, kind);
  }
  throw new Error('Outs are planned by planOut');
}

/** The rules' moves for a scoring cap: the first `runs` scorers by arrival count. */
function planHit(input: PlayInput, kind: HitKind): PlayScript {
  const { ball, moves, spots } = input;
  const hit = hitOfKind(kind);
  const homer = hit === 'homer';
  const fielders = emptyFielders();
  const events: PlayEvent[] = [];
  const legs: BallLeg[] = [];
  const frames: { from: number; points: Vec[] }[] = [{ from: 0, points: [] }];

  // Where each fielder will be, and from when, as he is given jobs.
  const agent: Record<string, { pos: Vec; t: number }> = {};
  for (const p of POSITIONS) agent[p] = { pos: spots[p], t: 0 };
  const run = (p: Position, to: Vec, startAt = REACTION, face?: Vec): number => {
    const a = agent[p];
    const from = a.pos;
    const begin = Math.max(startAt, a.t);
    const d = dist(from, to);
    if (d < 0.05) return Math.max(begin, a.t);
    const speed = speedOf(p);
    const arrive = begin + d / speed;
    fielders[p].push({ at: begin, do: 'run', to: at(to.x, to.z), speed, face });
    a.pos = at(to.x, to.z);
    a.t = arrive;
    return arrive;
  };
  const pose = (p: Position, time: number, which: FielderPose, towardPoint?: Vec, side?: -1 | 1) =>
    fielders[p].push({ at: time, do: 'pose', pose: which, toward: towardPoint, side });
  const face = (p: Position, time: number, point: Vec) =>
    fielders[p].push({ at: time, do: 'face', point });

  // ---------- Runners ----------
  const scorers = moves.filter((m) => m.to >= 4);
  const cap = input.runs ?? scorers.length;

  const buildRunners = (
    batterTiming: { start: number; speed: number },
    tails: Map<number, 'none' | 'turn' | 'overrun'>,
  ): RunnerScript[] =>
    moves.map((move) => {
      const batter = move.from === 0;
      const start = input.leads[move.from] ?? baseSpot(move.from);
      let hold: { p: Vec; until: number } | undefined;
      if (!batter && kind === 'single-bloop') {
        const first = baseSpot(move.from + 1);
        hold = {
          p: at((start.x + first.x) / 2, (start.z + first.z) / 2),
          until: ball.firstTouch.t + 0.1,
        };
      }
      return runRunner({
        move,
        start,
        leaveAt: batter ? batterTiming.start : RUNNER_START,
        speed: batter ? batterTiming.speed : RUN_SPEED,
        hold,
        tail: move.to >= 4 ? 'none' : (tails.get(move.from) ?? 'turn'),
      });
    });

  // ---------- Home runs: nobody throws ----------
  if (homer) {
    const runners = buildRunners({ start: BATTER_START, speed: RUN_SPEED }, new Map());
    const fieldMan = wallFielder(ball.zone, ball.theta);
    const wall = wallSpot(ball.theta);
    const crossing = (() => {
      const p = at(0, 0, 0);
      for (let t = 0; t <= ball.airTime; t += 0.01) {
        ball.position(t, p);
        if (Math.hypot(p.x, p.z) >= wallRadius(fieldAngle(p))) return t;
      }
      return ball.airTime;
    })();
    for (const p of POSITIONS) {
      if (p === fieldMan) {
        const arrive = run(p, wall);
        face(p, arrive, ball.firstTouch.p);
        if (kind === 'homer-scraper') {
          pose(p, Math.max(arrive, crossing - 0.3), 'leap', ball.firstTouch.p);
        } else {
          pose(p, arrive, 'watch', ball.firstTouch.p);
        }
      } else if (OUTFIELDERS.includes(p) && p !== fieldMan) {
        // The outfielder next to him drifts back too.
        const out = toward(spots[p], at(spots[p].x * 2, spots[p].z * 2 - 6), 3);
        const arrive = run(p, out);
        pose(p, arrive, 'watch', ball.firstTouch.p);
      } else {
        face(p, REACTION, ball.firstTouch.p);
        pose(p, REACTION, 'watch', ball.firstTouch.p);
      }
    }
    legs.push({ kind: 'batted', start: 0, end: ball.end, ball });
    let credited = 0;
    for (const r of [...runners].sort((a, b) => a.arriveAt - b.arriveAt)) {
      if (credited < cap) {
        credited++;
        events.push({ at: r.arriveAt, type: 'run', who: r.from });
      }
    }
    const done = Math.max(...runners.map((r) => r.doneAt));
    return {
      legs,
      fielders,
      runners,
      events: events.sort((a, b) => a.at - b.at),
      frames,
      duration: Math.max(ball.end + 0.9, done + 0.6, 4.2),
      fielder: fieldMan,
    };
  }

  // ---------- Who fields it, and when ----------
  const chopper = kind === 'single-chopper';
  const pick = pickFielder(kind, ball, spots);
  const F = pick.fielder;
  const tp = Math.max(pick.t, run(F, pick.p));
  const pickup = at(pick.p.x, pick.p.z);

  // ---------- Where the throw goes ----------
  const leadDest = Math.max(...moves.map((m) => m.to));
  const target = chopper ? 1 : leadDest >= 4 ? 4 : Math.max(leadDest, 2);
  const through0 = true;
  const base = (opts: { through: boolean }) =>
    assignDefense({
      kind,
      theta: ball.theta,
      zone: ball.zone,
      fielder: F,
      pickup,
      target,
      moves,
      through: opts.through,
    });
  const assigned = base({ through: through0 });
  const throughMatters = assigned.P.role !== base({ through: false }).P.role;
  const holder = (role: Assignment['role'], b?: number): Position | undefined =>
    POSITIONS.find((p) => {
      const a = assigned[p];
      return a.role === role && (b === undefined || (a.role === 'cover' && a.base === b));
    });
  const relayMan = holder('relay');
  const cutoffMan = holder('cutoff');
  const baseman = holder('cover', target);
  const spotOf = (p: Position, a: Assignment): Vec => ('at' in a && a.at ? a.at : spots[p]);

  // The cover men, relay and the rest are on their way at the first moment; when each is ready.
  const ready: Record<string, number> = {};
  for (const p of POSITIONS) {
    if (p === F) {
      ready[p] = agent[p].t;
      continue;
    }
    const a = assigned[p];
    if (a.role === 'watch' || a.role === 'callForIt') {
      ready[p] = 0;
      continue;
    }
    // Whether the pitcher backs up depends on whether the throw goes through; he goes later.
    if (p === 'P' && a.role === 'backupBase' && throughMatters) {
      ready[p] = 0;
      continue;
    }
    ready[p] = run(p, spotOf(p, a));
  }
  const spotFor = (p: Position): Vec => agent[p].pos;

  // ---------- The throws ----------
  const origin = at(pickup.x, pickup.z, 1.3);

  interface Hop {
    from: Vec;
    to: Vec;
    by: Position;
    to_: Position;
    style: 'overhand' | 'flip' | 'lob';
    start: number;
    end: number;
  }

  /** The throws, from the fielder's release times and the receivers' being ready. */
  const chain = (opts: {
    through: boolean;
    delayF: number;
    delayR: number;
    relaySkipLob?: boolean;
  }): { hops: Hop[]; arriveTarget: number | null; holder: Position; holdFrom: number } => {
    const hops: Hop[] = [];
    const t = tp;
    const throwFrom = (
      by: Position,
      from: Vec,
      to_: Position,
      to: Vec,
      release: number,
      speedOverride?: 'lob',
    ) => {
      const d = dist(from, to);
      const timing = throwTiming(by, d);
      const style = speedOverride ?? timing.style;
      const speed = speedOverride === 'lob' ? LOB_SPEED : timing.speed;
      const dur = dist3(from, to) / speed;
      // The receiver must be there: wait if he is not.
      const start = Math.max(release, (ready[to_] ?? 0) - dur);
      const hop: Hop = { from, to, by, to_, style, start, end: start + dur };
      hops.push(hop);
      return hop;
    };
    if (chopper) {
      const firstMan = baseman ?? '1B';
      const d = dist(pickup, throwSpot(1));
      const timing = throwTiming(F, d);
      const hop = throwFrom(F, origin, firstMan, throwSpot(1), t + timing.release + opts.delayF);
      return { hops, arriveTarget: hop.end, holder: firstMan, holdFrom: hop.end };
    }
    const first = relayMan ?? cutoffMan;
    const timing0 = throwTiming(F, 30);
    if (opts.through && !relayMan && baseman) {
      // A throw through the cutoff man, straight to the base.
      const hop = throwFrom(
        F,
        origin,
        baseman,
        throwSpot(target),
        t + timing0.release + opts.delayF,
      );
      return { hops, arriveTarget: hop.end, holder: baseman, holdFrom: hop.end };
    }
    if (!first) {
      // Nobody to cut it (should not happen): straight to the pitcher.
      const hop = throwFrom(
        F,
        origin,
        'P',
        at(spotFor('P').x, spotFor('P').z, 1.0 + MOUND_HEIGHT),
        t + timing0.release,
      );
      return { hops: [hop], arriveTarget: null, holder: 'P', holdFrom: hop.end };
    }
    const firstSpot = at(spotFor(first).x, spotFor(first).z, 1.3);
    const hop1 = throwFrom(F, origin, first, firstSpot, t + timing0.release + opts.delayF);
    const caught = hop1.end;
    if (opts.through && relayMan && baseman) {
      const rel = caught + RELAY_TRANSFER + opts.delayR;
      const hop2 = throwFrom(first, firstSpot, baseman, throwSpot(target), rel);
      return { hops, arriveTarget: hop2.end, holder: baseman, holdFrom: hop2.end };
    }
    // Cut: the cutoff man holds the ball, looks the runners back, and lobs it to the pitcher.
    const hold = caught + 0.3;
    const pitcherSpot = at(spotFor('P').x, spotFor('P').z, MOUND_HEIGHT + 1.0);
    const lobDistance = dist(firstSpot, pitcherSpot);
    const lob = lobDistance > 12 ? undefined : ('lob' as const);
    const hop2 = throwFrom(
      first,
      firstSpot,
      'P',
      pitcherSpot,
      hold + (lob ? RELEASE_FLIP : RELEASE_IF),
      lob,
    );
    if (hop2.end > PLAY_MAX - 0.4) {
      hops.pop();
      return { hops, arriveTarget: null, holder: first, holdFrom: caught };
    }
    return { hops, arriveTarget: null, holder: 'P', holdFrom: hop2.end };
  };

  // ---------- Making the runners safe ----------
  let delayF = 0;
  let delayR = 0;
  let through = target > 0;
  const sliders: RunnerScript[] = [];
  // The runner or runners heading for the base the ball goes to.
  const arrivals = (runners: RunnerScript[]) =>
    runners.map((r) => touchAt(r, target)).filter((x): x is number => x !== undefined);
  const headingForTarget = moves.some((m) => m.to >= target && m.to === target) || chopper;

  let batterTiming = { start: BATTER_START, speed: RUN_SPEED };
  let tails = new Map<number, 'none' | 'turn' | 'overrun'>();
  let runners = buildRunners(batterTiming, tails);
  let plan = chain({ through, delayF, delayR });

  if (chopper) {
    // A close play at first: the batter's start and speed and the fielder's release are set so
    // the ball arrives `SAFE_MARGIN` after him.
    const lenToFirst = roundRouteInfo(0, 1).points.reduce(
      (n, p, i, all) => n + dist(i ? all[i - 1] : (input.leads[0] ?? baseSpot(0)), p),
      0,
    );
    const natural = chain({ through: true, delayF: 0, delayR: 0 }).arriveTarget ?? tp + 1;
    const wantedBatter = natural - SAFE_MARGIN;
    let speed = RUN_SPEED;
    let start = Math.min(Math.max(wantedBatter - lenToFirst / speed, 0.15), 0.45);
    if (wantedBatter - start > lenToFirst / 10) {
      // Slower, not later: a batter who dawdles looks wrong.
      speed = Math.max(lenToFirst / (wantedBatter - start), 10);
    }
    start = Math.min(Math.max(wantedBatter - lenToFirst / speed, 0.15), 0.45);
    batterTiming = { start, speed };
    tails = new Map([[0, 'overrun']]);
    runners = buildRunners(batterTiming, tails);
    const batterAt = touchAt(
      runners.find((r) => r.from === 0)!,
      1,
    )!;
    // Release the ball so it arrives a close second.
    const base0 = chain({ through: true, delayF: 0, delayR: 0 }).arriveTarget ?? tp;
    delayF = Math.max(batterAt + SAFE_MARGIN - base0, -0.1);
    plan = chain({ through: true, delayF, delayR });
    // Never beaten: hold the ball longer if it would be.
    for (let i = 0; i < 6 && (plan.arriveTarget ?? 0) < batterAt + SAFE_MARGIN - 1e-6; i++) {
      delayF += batterAt + SAFE_MARGIN - (plan.arriveTarget ?? 0);
      plan = chain({ through: true, delayF, delayR });
    }
  } else if (!headingForTarget) {
    through = false;
    plan = chain({ through, delayF, delayR });
  } else {
    const lastRunner = () => Math.max(...arrivals(runners));
    let m = (plan.arriveTarget ?? Infinity) - lastRunner();
    if (m < SAFE_MARGIN) {
      const need = SAFE_MARGIN - m;
      delayF = Math.min(need, 0.5);
      plan = chain({ through, delayF, delayR });
      m = (plan.arriveTarget ?? Infinity) - lastRunner();
      if (m < SAFE_MARGIN - 1e-6 && relayMan) {
        delayR = Math.min(SAFE_MARGIN - m, 0.5);
        plan = chain({ through, delayF, delayR });
        m = (plan.arriveTarget ?? Infinity) - lastRunner();
      }
      if (m < SAFE_MARGIN - 1e-6) through = false;
    }
    if (through && m > SLIDE_IF_WITHIN) through = false;
    if (!through) {
      delayF = 0;
      delayR = 0;
      plan = chain({ through: false, delayF, delayR });
    } else {
      // The runner who arrives last slides.
      const last = [...runners]
        .filter((r) => touchAt(r, target) !== undefined)
        .sort((a, b) => (touchAt(b, target) ?? 0) - (touchAt(a, target) ?? 0))[0];
      if (last) {
        last.slides = true;
        if (last.finish !== 'score') last.finish = 'slide';
        sliders.push(last);
      }
    }
  }

  // ---------- Fielders' actions ----------
  const assignedNow = base({ through });
  if (throughMatters && assignedNow.P.role === 'backupBase') {
    ready.P = run('P', spotOf('P', assignedNow.P));
  }

  // The fielder's pickup, and his throw.
  const tPose = Math.max(agent[F].t, tp - 0.15);
  pose(F, tPose, chopper ? 'barehand' : 'scoop', ball.rest);
  events.push({ at: tp, type: 'catch', by: F });
  if (ball.firstTouch.what === 'wall') {
    events.push({ at: ball.firstTouch.t, type: 'wall', p: ball.firstTouch.p });
  } else if (ball.firstTouch.what === 'ground' && ball.firstTouch.t < tp) {
    events.push({ at: ball.firstTouch.t, type: 'land', p: ball.firstTouch.p });
  }

  legs.push({ kind: 'batted', start: 0, end: tp, ball });
  let cursor = tp;
  let holdBy: Position = F;
  let holdFrom = tp;
  const throwPoseFor = (hop: Hop) => {
    const timing = hop.style === 'flip' ? 'flip' : hop.style === 'lob' ? 'lob' : 'throw';
    const lead =
      hop.style === 'flip'
        ? RELEASE_FLIP
        : hop.style === 'lob'
          ? RELEASE_FLIP
          : isOutfielder(hop.by)
            ? RELEASE_OF
            : RELEASE_IF;
    face(hop.by, Math.max(hop.start - lead - 0.1, 0), hop.to);
    pose(hop.by, Math.max(hop.start - lead, 0), timing, hop.to);
  };
  for (const hop of plan.hops) {
    if (hop.start - 0.12 > cursor) {
      legs.push({ kind: 'held', start: cursor, end: hop.start - 0.12, by: holdBy, hand: 'L' });
      cursor = hop.start - 0.12;
    }
    if (hop.start > cursor) {
      legs.push({ kind: 'held', start: cursor, end: hop.start, by: holdBy, hand: 'R' });
    }
    throwPoseFor(hop);
    legs.push({
      kind: 'throw',
      start: hop.start,
      end: hop.end,
      from: hop.from,
      to: hop.to,
      lift: throwLift(dist(hop.from, hop.to)),
      by: hop.by,
      to_: hop.to_,
      style: hop.style,
    });
    cursor = hop.end;
    holdBy = hop.to_;
    holdFrom = hop.end;
    events.push({ at: hop.end, type: 'catch', by: hop.to_ });
    // The receiver gets his glove up.
    pose(
      hop.to_,
      Math.max(hop.end - 0.3, 0),
      hop.to_ === '1B' && chopper ? 'stretch' : 'receive',
      hop.from,
    );
    face(hop.to_, Math.max(hop.end - 0.35, 0), hop.from);
  }
  // A cutoff man lets a throw through: no catch.
  if (plan.hops.length === 1 && through && !relayMan && cutoffMan) {
    const hop = plan.hops[0];
    pose(cutoffMan, Math.max(hop.start + 0.1, 0), 'let-go', hop.to);
    face(cutoffMan, Math.max(hop.start, 0), hop.to);
  }

  // ---------- Runners' finishes and events ----------
  let credited = 0;
  for (const r of [...runners].sort((x, y) => x.arriveAt - y.arriveAt)) {
    if (r.finish === 'score' && credited < cap) {
      credited++;
      events.push({ at: r.arriveAt, type: 'run', who: r.from });
    }
  }
  for (const r of sliders) {
    events.push({ at: r.arriveAt, type: 'safe', base: moves.find((m) => m.from === r.from)!.to });
  }
  if (chopper) {
    const batterRunner = runners.find((r) => r.from === 0)!;
    events.push({ at: batterRunner.arriveAt, type: 'safe', base: 1 });
  }
  // Fielders with nothing else to do turn to the ball.
  for (const p of POSITIONS) {
    if (!fielders[p].length) face(p, REACTION, pickup);
    // Those who have run somewhere face the play when they get there.
    const last = fielders[p].filter((a) => a.do === 'run').at(-1);
    if (last && last.do === 'run' && p !== F) {
      const arrive =
        last.at + dist(fielderTrack(fielders[p], spots[p])(last.at), last.to) / last.speed;
      const done = fielders[p].some((a) => a.do === 'pose' && a.at >= arrive - 1e-6);
      if (!done) {
        const role = assignedNow[p].role;
        pose(p, arrive, role === 'cover' ? 'cover' : 'watch', pickup);
      }
    }
  }
  const lastRunner = Math.max(...runners.map((r) => r.doneAt));
  const ballEnd = Math.max(holdFrom, cursor);
  frames.push({
    from: Math.max(tp - 0.2, 0),
    points: [pickup, plan.hops[0] ? plan.hops[0].to : baseSpot(target), baseSpot(target)],
  });
  if (plan.hops.length > 1) {
    frames.push({
      from: plan.hops[0].end,
      points: [plan.hops[1].from, plan.hops[1].to, baseSpot(target)],
    });
  }
  const duration = Math.min(PLAY_MAX, Math.max(ballEnd + 0.4, lastRunner + 0.4));
  return {
    legs,
    fielders,
    runners,
    events: events.sort((a, b) => a.at - b.at),
    frames,
    duration,
    fielder: F,
  };
}

// ---------- Checking a script ----------

/** Every rule of the design's section 6.4 that the script breaks; empty when it is good. */
export function checkScript(script: PlayScript, input: PlayInput): string[] {
  const bad: string[] = [];
  const { legs, runners } = script;
  const tracks = {} as Record<Position, (t: number) => Vec>;
  for (const p of POSITIONS) tracks[p] = fielderTrack(script.fielders[p] ?? [], input.spots[p]);

  // 1. The legs are contiguous, and the first starts at 0.
  if (!legs.length || Math.abs(legs[0].start) > 1e-6) bad.push('the first leg does not start at 0');
  legs.forEach((leg, i) => {
    if (leg.end < leg.start - 1e-9) bad.push(`leg ${i} ends before it starts`);
    if (i && Math.abs(leg.start - legs[i - 1].end) > 1e-6) bad.push(`leg ${i} is not contiguous`);
  });

  // 2. Every throw's receiver is at its spot when the throw arrives.
  for (const leg of legs) {
    if (leg.kind !== 'throw') continue;
    const there = tracks[leg.to_](leg.end);
    if (dist(there, leg.to) > 0.5) {
      bad.push(`${leg.to_} is ${dist(there, leg.to).toFixed(2)} from where ${leg.by} throws`);
    }
  }

  // 3. Every runner ends on the base the rules say; the retired are out.
  for (const m of input.moves) {
    const r = runners.find((x) => x.from === m.from);
    if (!r) {
      bad.push(`no runner from ${m.from}`);
      continue;
    }
    const base = baseSpot(m.to);
    if (!r.route.some((p) => dist(p, base) < 0.5)) bad.push(`runner from ${m.from} misses ${m.to}`);
    if (m.to >= 4 && r.finish !== 'score') bad.push(`runner from ${m.from} does not score`);
    if (m.to < 4 && r.finish === 'score') bad.push(`runner from ${m.from} scores but should not`);
    const last = r.route[r.route.length - 1];
    if (dist(last, base) > 0.5 && r.finish !== 'overrun')
      bad.push(`runner from ${m.from} ends off the base`);
  }
  if (
    runners.length !==
    input.moves.length + input.retired.filter((x) => !input.moves.some((m) => m.from === x)).length
  ) {
    bad.push('the runners are not the moves and the retired');
  }
  for (const who of input.retired) {
    const r = runners.find((x) => x.from === who);
    if (!r || r.finish !== 'out') bad.push(`${who} is retired but does not finish out`);
  }

  // 4. On hits, runners reach each base the ball is thrown to before the ball does.
  for (const leg of legs) {
    if (leg.kind !== 'throw') continue;
    for (let b = 1; b <= 4; b++) {
      if (dist(leg.to, throwSpot(b)) > 0.6) continue;
      if (typeof input.call !== 'string') continue;
      for (const r of runners) {
        const t = touchAt(r, b);
        if (t !== undefined && t > leg.end + 1e-6)
          bad.push(`runner from ${r.from} reaches ${b} after the throw`);
      }
    }
  }

  // 5. Runners never pass each other, and no two finish on the same base.
  const finals = input.moves.filter((m) => m.to < 4).map((m) => m.to);
  if (new Set(finals).size !== finals.length) bad.push('two runners finish on the same base');
  const progress = (r: RunnerScript, t: number): number =>
    Math.min(rawProgress(r, t), r.finish === 'score' ? LAP : Infinity);
  const rawProgress = (r: RunnerScript, t: number): number => {
    let travelled = r.from * BASE_SIDE;
    let pos = input.leads[r.from] ?? baseSpot(r.from);
    let clock = r.leaveAt;
    const pts = r.holdAt ? [r.holdAt.p, ...r.route] : r.route;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const d = dist(pos, p);
      const dur = d / r.speed;
      if (r.holdAt && i === 1) clock = Math.max(clock, r.holdAt.until);
      if (t <= clock) return travelled;
      if (t < clock + dur) return travelled + (d * (t - clock)) / dur;
      clock += dur;
      travelled += d;
      pos = p;
    }
    return travelled;
  };
  for (const a of runners) {
    for (const b of runners) {
      if (a.from <= b.from || a.finish === 'out' || b.finish === 'out') continue;
      for (let t = 0; t <= script.duration; t += 0.05) {
        if (progress(a, t) < progress(b, t) - 0.05) {
          bad.push(`runner from ${b.from} passes runner from ${a.from} at ${t.toFixed(2)}`);
          t = Infinity;
        }
      }
    }
  }

  // 6. Every base a runner finishes on is covered by the time he gets there.
  for (const r of runners) {
    const move = input.moves.find((m) => m.from === r.from);
    if (!move || r.finish === 'out') continue;
    const spot = baseSpot(move.to);
    const t = r.arriveAt;
    const covered = POSITIONS.some((p) => {
      const pos = tracks[p](t);
      return dist(pos, spot) < 2.4 && (p !== 'C' || move.to === 4 || dist(pos, spot) < 2.4);
    });
    if (!covered) bad.push(`base ${move.to} is not covered when the runner from ${r.from} arrives`);
  }

  // 7. All nine positions have at least one action.
  for (const p of POSITIONS) if (!script.fielders[p]?.length) bad.push(`${p} has nothing to do`);

  // 8. The play is no longer than the longest allowed, home runs excepted.
  const homer = typeof input.call === 'string' && hitOfKind(input.call) === 'homer';
  if (!homer && script.duration > PLAY_MAX + 1e-9)
    bad.push(`it runs ${script.duration.toFixed(2)} s`);

  // 9. Run events are as many as the runs, in time order; out events as many as retired.
  const scoring = input.moves.filter((m) => m.to >= 4).length;
  const runEvents = script.events.filter((e) => e.type === 'run');
  if (runEvents.length !== Math.min(input.runs ?? scoring, scoring))
    bad.push('wrong number of run events');
  const outEvents = script.events.filter((e) => e.type === 'out');
  if (outEvents.length !== input.retired.length) bad.push('wrong number of out events');
  script.events.forEach((e, i) => {
    if (i && e.at < script.events[i - 1].at - 1e-9) bad.push('events are out of order');
  });

  return bad;
}
