/**
 * What every fielder does on a ball in play, from the textbook: who fields it, who is the cutoff
 * or relay man, who covers each base and who backs up whom. Pure numbers, so it is easy to test.
 */
import type { BattedBall } from './batted';
import {
  BASE_SPOTS,
  fieldAngle,
  fieldPoint,
  MOUND,
  POSITION_SPOTS,
  WALL_HEIGHT,
  wallRadius,
  type Vec,
} from './flight';
import {
  isRightSide,
  zoneOf,
  type FieldZone,
  type HitKind,
  type Move,
  type OutKind,
  type Position,
} from './rules';

// ---------- Speeds and reaction (the choreography re-exports them) ----------

/** Fielders start moving this long after contact. */
export const REACTION = 0.15;
/** Fielder run speeds, in units per second. */
export const OF_SPEED = 9;
export const IF_SPEED = 10;
export const PC_SPEED = 8;

export const POSITIONS: readonly Position[] = ['P', 'C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF'];
export const INFIELDERS: readonly Position[] = ['1B', '2B', 'SS', '3B'];
export const OUTFIELDERS: readonly Position[] = ['LF', 'CF', 'RF'];

/** How fast a fielder runs. */
export function speedOf(position: Position): number {
  if (position === 'P' || position === 'C') return PC_SPEED;
  return OUTFIELDERS.includes(position) ? OF_SPEED : IF_SPEED;
}

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
const unit = (from: Vec, to: Vec): { x: number; z: number } => {
  const d = Math.max(dist(from, to), 1e-6);
  return { x: (to.x - from.x) / d, z: (to.z - from.z) / d };
};
const along = (from: Vec, dir: { x: number; z: number }, by: number): Vec => ({
  x: from.x + dir.x * by,
  y: 0,
  z: from.z + dir.z * by,
});

// ---------- Bases and cover spots ----------

/** The spot of base `b`: 1 to 3, and 4 is home. */
export function baseSpot(base: number): Vec {
  return BASE_SPOTS[base % 4];
}

const DIAMOND_CENTRE: Vec = { x: 0, y: 0, z: BASE_SPOTS[2].z / 2 };

/**
 * Where a fielder stands to cover a base: foot on the bag, just on the infield side of it so a
 * runner can come in. The catcher covers home from in front of his crouch.
 */
export function coverSpot(base: number): Vec {
  if (base % 4 === 0) return { x: 0, y: 0, z: 0.8 };
  const b = baseSpot(base);
  return along(b, unit(b, DIAMOND_CENTRE), 0.9);
}

/** Where a throw to a base is aimed: at the baseman's glove. */
export function throwSpot(base: number): Vec {
  const c = coverSpot(base);
  return { x: c.x, y: 1.0, z: c.z };
}

// ---------- Who fields the ball ----------

/** The first point on the ball's path that a fielder from `from` can get to, and when. */
export function intercept(
  ball: BattedBall,
  from: Vec,
  speed: number,
): { t: number; p: Vec; reached: boolean } {
  const out: Vec = { x: 0, y: 0, z: 0 };
  for (let t = ball.firstTouch.t; t <= ball.end + 1e-9; t += 0.02) {
    ball.position(t, out);
    // A ball above his head is not one to pick up.
    if (out.y > 1.6) continue;
    const arrives = REACTION + dist(from, out) / speed;
    if (arrives <= t) return { t, p: { x: out.x, y: 0, z: out.z }, reached: true };
  }
  const p = { x: ball.rest.x, y: 0, z: ball.rest.z };
  return { t: Math.max(ball.end, REACTION + dist(from, p) / speed), p, reached: false };
}

/** The fielder who plays a hit that stays in the park, and where and when he picks it up. */
export function pickFielder(
  kind: HitKind,
  ball: BattedBall,
  spots: Record<Position, Vec> = POSITION_SPOTS,
): { fielder: Position; p: Vec; t: number } {
  const take = (fielder: Position) => ({
    fielder,
    ...intercept(ball, spots[fielder], speedOf(fielder)),
  });
  if (kind === 'single-chopper') {
    // A chopper is fielded by the infielder it is hit at; over the mound, by the shortstop.
    const theta = ball.theta;
    const fielder: Position = theta < -0.43 ? '3B' : theta < 0.13 ? 'SS' : '2B';
    return take(fielder);
  }
  switch (ball.zone) {
    case 'LL':
    case 'LF':
      return take('LF');
    case 'CF':
      return take('CF');
    case 'RF':
    case 'RL':
      return take('RF');
    case 'LC': {
      const lf = take('LF');
      const cf = take('CF');
      return lf.t < cf.t ? lf : cf;
    }
    case 'RC': {
      const rf = take('RF');
      const cf = take('CF');
      return rf.t < cf.t ? rf : cf;
    }
  }
}

/** The outfielder nearest where a ball comes down, for a home run. */
export function wallFielder(zone: FieldZone, theta: number): Position {
  if (zone === 'LL' || zone === 'LF') return 'LF';
  if (zone === 'RF' || zone === 'RL') return 'RF';
  if (zone === 'CF') return theta < 0 ? 'CF' : 'CF';
  return theta < 0 ? 'LF' : 'RF';
}

// ---------- Assignments ----------

export type Assignment =
  | { role: 'field' }
  | { role: 'backupFielder'; at: Vec }
  | { role: 'cutoff'; at: Vec }
  | { role: 'relay'; at: Vec }
  | { role: 'trail'; at: Vec }
  | { role: 'cover'; base: number; at: Vec }
  | { role: 'backupBase'; base: number; at: Vec }
  | { role: 'callForIt'; at?: Vec }
  | { role: 'watch'; at?: Vec };

export interface DefenseInput {
  kind: HitKind | OutKind;
  theta: number;
  zone: FieldZone;
  /** Who fields the ball first, and where he picks it up. */
  fielder: Position;
  pickup: Vec;
  /** The base the throw is aimed at (4 is home); 0 for no throw. */
  target: number;
  /** Where everybody is going, from the rules. */
  moves: Move[];
  /** The ball is thrown through to the target; otherwise the cutoff man cuts it. */
  through?: boolean;
  /** For a chopper or a ground out: who covers first. */
  firstCover?: Position;
}

const isLeftSide = (position: Position) => position === '3B' || position === 'SS';

/** Foul ground behind first base, where the catcher and the right fielder back up a throw. */
export const BACKUP_FIRST_C: Vec = { x: 13.4, y: 0, z: -11.2 };
export const BACKUP_FIRST_RF: Vec = { x: 14, y: 0, z: -4 };
export const BACKUP_THIRD_LF: Vec = { x: -13.4, y: 0, z: -11.2 };

/** Who is the cutoff man for a single, and where he stands on the line to the target. */
function cutoffMan(input: DefenseInput): Position {
  const { target, theta, zone } = input;
  if (target === 4) return zone === 'LL' || zone === 'LF' || zone === 'LC' ? '3B' : '1B';
  if (target === 3) return 'SS';
  return theta < 0 ? 'SS' : '2B';
}

/**
 * Everybody's job on a ball in play, from the textbook. The first rule that fits a position
 * wins: field, then relay or cutoff, then base covers, then the pitcher and catcher, then the
 * outfield backups. Positions with nothing to do `watch`.
 */
export function assignDefense(input: DefenseInput): Record<Position, Assignment> {
  const result = {} as Record<Position, Assignment>;
  const set = (p: Position, a: Assignment) => {
    if (!result[p]) result[p] = a;
  };
  const { kind, target, fielder, pickup, theta } = input;
  const base = kind.split('-')[0];
  const isHomer = base === 'homer';
  const infield = INFIELDERS.includes(fielder) || fielder === 'P' || fielder === 'C';
  const through = input.through ?? true;

  set(fielder, { role: 'field' });

  if (isHomer) {
    // The outfielders on that side drift back to the wall and the rest watch.
    for (const p of OUTFIELDERS) {
      if (p !== fielder) set(p, { role: 'watch' });
    }
    for (const p of POSITIONS) set(p, { role: 'watch' });
    return result;
  }

  // The base each runner finishes on.
  const finals = input.moves.map((m) => m.to);
  const needed = new Set<number>(finals);
  if (target > 0) needed.add(target);
  const dir = target > 0 ? unit(pickup, baseSpot(target)) : { x: 0, z: -1 };

  // --- Relay and cutoff ---
  if (!infield && target > 0) {
    const longHit = base === 'double' || base === 'triple';
    if (longHit) {
      const relay: Position = theta < 0 ? 'SS' : '2B';
      const other: Position = relay === 'SS' ? '2B' : 'SS';
      const total = dist(pickup, baseSpot(target));
      const out = Math.min(0.45 * total, 14);
      const at = along(pickup, dir, out);
      set(relay, { role: 'relay', at });
      set(other, { role: 'trail', at: along(at, dir, 5) });
    } else {
      const man = cutoffMan(input);
      set(man, { role: 'cutoff', at: along(baseSpot(target), dir, -9) });
    }
  }

  // --- Base covers ---
  const free = (p: Position) => !result[p];
  const cover = (b: number, candidates: Position[]) => {
    const p = candidates.find(free);
    if (p) set(p, { role: 'cover', base: b, at: coverSpot(b) });
  };
  // 1st: the first baseman, unless he is busy (then the second baseman, else the pitcher).
  if (needed.has(1)) {
    cover(1, input.firstCover && free(input.firstCover) ? [input.firstCover] : ['1B', '2B', 'P']);
  }
  // 3rd: the third baseman, else the shortstop.
  if (needed.has(3)) cover(3, ['3B', 'SS']);
  // Home: the catcher.
  if (needed.has(4)) cover(4, ['C']);
  // 2nd: the middle infielder not used, else the first baseman. On a ball to the right side the
  // shortstop covers; on the left side the second baseman.
  if (needed.has(2)) {
    const order: Position[] =
      infield && isLeftSide(fielder)
        ? ['2B', 'SS', '1B']
        : theta < 0
          ? ['2B', 'SS', '1B']
          : ['SS', '2B', '1B'];
    cover(2, order);
  }

  // --- Pitcher and catcher ---
  if (!infield && target > 0) {
    if (through && (target === 3 || target === 4)) {
      const b = baseSpot(target);
      set('P', { role: 'backupBase', base: target, at: along(b, unit(pickup, b), 6) });
    } else if (target === 2) {
      set('P', { role: 'backupBase', base: 2, at: { x: MOUND.x, y: 0, z: MOUND.z + 1.6 } });
    }
  }
  if (infield) {
    // On a ball to the right side the pitcher breaks for the first-base line.
    if (!isLeftSide(fielder)) {
      set('P', { role: 'backupBase', base: 1, at: { x: 4, y: 0, z: -6.8 } });
    }
  }
  if (
    target !== 4 &&
    !finals.includes(4) &&
    !input.moves.some((m) => m.from === 2 || m.from === 3)
  ) {
    // Nobody can score: the catcher trails the batter to back up first.
    set('C', { role: 'backupBase', base: 1, at: BACKUP_FIRST_C });
  }
  set('C', { role: 'cover', base: 4, at: coverSpot(4) });

  // --- Outfield backups ---
  if (!infield) {
    const back = along(pickup, unit({ x: 0, y: 0, z: 0 }, pickup), 5);
    const adjacent: Position = fielder === 'CF' ? (theta < 0 ? 'LF' : 'RF') : 'CF';
    set(adjacent, { role: 'backupFielder', at: back });
    // The far corner outfielder backs up throws to the base on his side.
    if (target === 3 && isRightSide(zoneOf(fieldAngle(pickup)))) {
      set('LF', { role: 'backupBase', base: 3, at: BACKUP_THIRD_LF });
    }
    if ((target === 1 || target === 2) && !isRightSide(zoneOf(fieldAngle(pickup)))) {
      set('RF', {
        role: 'backupBase',
        base: target,
        at: target === 1 ? BACKUP_FIRST_RF : { x: 6, y: 0, z: -23 },
      });
    }
  } else {
    // First base is backed up from foul ground; the other outfielders back up the other throws.
    if (target === 1) set('RF', { role: 'backupBase', base: 1, at: BACKUP_FIRST_RF });
    if (target === 3) set('LF', { role: 'backupBase', base: 3, at: BACKUP_THIRD_LF });
    if (target === 2) set('CF', { role: 'backupBase', base: 2, at: { x: 0, y: 0, z: -24 } });
  }
  for (const p of POSITIONS) set(p, { role: 'watch' });
  return result;
}

/** How far from the wall the outfielders stand to watch a home run go, and how a scraper is leapt for. */
export function wallSpot(theta: number): Vec {
  return fieldPoint(theta, wallRadius(theta) - 1.4);
}

/** The height the glove reaches at the wall on a leap. */
export const LEAP_REACH = WALL_HEIGHT + 0.6;

// ---------- Where everybody stands before a pitch ----------

/** Double-play depth for the shortstop and second baseman, with a runner on first. */
const DP_SS: Vec = { x: -3.6, y: 0, z: -13.6 };
const DP_2B: Vec = { x: 3.2, y: 0, z: -14.2 };
/** The first baseman holds the runner: beside the bag on the fair side, facing the mound. */
const HOLD_1B: Vec = { x: 8.1, y: 0, z: -8.9 };

/** A spot pulled in towards home: `scale` of its distance, along the line to home. */
const pulledIn = (p: Vec, scale: number): Vec => ({ x: p.x * scale, y: 0, z: p.z * scale });

/**
 * Where every fielder starts the next pitch, for the runners on and the outs: double-play depth
 * with a runner on first (fewer than two out), the first baseman holding a lone runner on first,
 * and the infield in with a runner on third and first empty (fewer than two out).
 */
export function fieldingSpots(
  bases: readonly [boolean, boolean, boolean],
  outs: number,
): Record<Position, Vec> {
  const spots = {} as Record<Position, Vec>;
  for (const p of POSITIONS) spots[p] = { ...POSITION_SPOTS[p] };
  const [first, second, third] = bases;
  if (first && outs < 2) {
    spots.SS = { ...DP_SS };
    spots['2B'] = { ...DP_2B };
  }
  if (first && !second) spots['1B'] = { ...HOLD_1B };
  if (third && !first && outs < 2) {
    spots['2B'] = pulledIn(POSITION_SPOTS['2B'], 0.75);
    spots.SS = pulledIn(POSITION_SPOTS.SS, 0.75);
    spots['3B'] = pulledIn(POSITION_SPOTS['3B'], 0.75);
    spots['1B'] = pulledIn(POSITION_SPOTS['1B'], 0.9);
  }
  return spots;
}

/** Where a runner takes his lead before the pitch: a few steps off the bag towards the next. */
export function leadSpot(base: 1 | 2 | 3): Vec {
  const from = baseSpot(base);
  if (base === 3) {
    // Towards home, and a little into foul ground.
    const home = baseSpot(4);
    const d = unit(from, home);
    const away = unit(DIAMOND_CENTRE, from);
    return { x: from.x + d.x * 1.6 + away.x * 0.5, y: 0, z: from.z + d.z * 1.6 + away.z * 0.5 };
  }
  return along(from, unit(from, baseSpot(base + 1)), base === 1 ? 1.8 : 2.4);
}
