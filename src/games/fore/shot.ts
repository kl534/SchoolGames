/** Clubs, the planned shot, how well it was struck and where the ball ends. Pure. */
import { centreX, ROUGH_HALF, surfaceAt, type Hole, type Surface } from './course';

export type XZ = { x: number; z: number };

export interface Club {
  id: string;
  name: string;
  carry: number;
  apex: number;
}

export const CLUBS: readonly Club[] = [
  { id: 'driver', name: 'Driver', carry: 240, apex: 0.22 },
  { id: 'iron3', name: '3-iron', carry: 190, apex: 0.25 },
  { id: 'iron5', name: '5-iron', carry: 160, apex: 0.28 },
  { id: 'iron7', name: '7-iron', carry: 130, apex: 0.32 },
  { id: 'wedge', name: 'Wedge', carry: 95, apex: 0.4 },
  { id: 'sand', name: 'Sand wedge', carry: 50, apex: 0.45 },
  { id: 'putter', name: 'Putter', carry: 0, apex: 0 },
];

const byId = (id: string): Club => CLUBS.find((c) => c.id === id)!;
export const PUTTER = byId('putter');

/** Where the ball sits. */
export type Lie = 'tee' | Surface;

/** A ball in the rough flies this share of the club's carry. */
export const LIE_FACTOR = 0.8;
/** At this distance or less (off the green) the sand wedge is the club. */
export const CHIP_MAX = 30;
export const MIN_SHOT = 10; // yd, any club but the putter
export const MIN_PUTT = 0.5; // yd
export const PUTT_REACH = 40; // yd
export const TURN_MAX = 90; // degrees either side of the line to the pin
export const DIST_STEP = 5; // ▲ ▼, yd (PUTT_DIST_STEP = 1 on the green)
export const PUTT_DIST_STEP = 1;
export const AIM_STEP = 1; // ◀ ▶, degrees

const RAD = Math.PI / 180;

/** Longest landing distance from a lie: green PUTT_REACH, sand 50 (sand wedge), rough 0.8 x 240, else 240. */
export function reachFor(lie: Lie): number {
  if (lie === 'green') return PUTT_REACH;
  if (lie === 'sand') return byId('sand').carry;
  const driver = CLUBS[0].carry;
  return lie === 'rough' ? driver * LIE_FACTOR : driver;
}

/**
 * The club for a landing distance. Green: the putter. At most CHIP_MAX or in sand: the sand wedge.
 * Else the shortest of sand wedge, wedge, 7-iron, 5-iron, 3-iron and driver whose carry (times
 * LIE_FACTOR in the rough) reaches. The returned club's `carry` is the distance: it is swung softer.
 */
export function clubFor(lie: Lie, distance: number): Club {
  if (lie === 'green') return { ...PUTTER, carry: distance };
  if (distance <= CHIP_MAX || lie === 'sand') return { ...byId('sand'), carry: distance };
  const factor = lie === 'rough' ? LIE_FACTOR : 1;
  const club =
    [...CLUBS]
      .filter((c) => c.id !== 'putter')
      .reverse()
      .find((c) => c.carry * factor >= distance) ?? CLUBS[0];
  return { ...club, carry: distance };
}

export interface Plan {
  /** `club.carry === carry`. */
  club: Club;
  from: XZ;
  /** Yards from `from` to `landing`. */
  carry: number;
  /** Flight direction, radians from +z towards +x. */
  dir: number;
  /** The ring centre (a putt: where it stops). */
  landing: XZ;
  /** `ringRadius(carry, putt)`. */
  ringR: number;
}

export const ringRadius = (carry: number, putt: boolean): number =>
  putt ? Math.max(1, carry * 0.1) : Math.max(3, carry * 0.05);

/**
 * Holds a wanted ring spot inside the limits: the distance clamped to [MIN_SHOT or MIN_PUTT,
 * reachFor(lie)] and the bearing to within +-TURN_MAX of the bearing to the pin (rotated round
 * `from`). A spot on the ball itself goes straight at the pin at the minimum.
 */
export function clampTarget(h: Hole, from: XZ, lie: Lie, want: XZ): XZ {
  const base = Math.atan2(h.pin.x - from.x, h.pin.z - from.z);
  const lo = lie === 'green' ? MIN_PUTT : MIN_SHOT;
  const dx = want.x - from.x;
  const dz = want.z - from.z;
  const raw = Math.hypot(dx, dz);
  const dist = Math.min(Math.max(raw, lo), reachFor(lie));
  let bearing = base;
  if (raw > 1e-9) {
    let turn = Math.atan2(dx, dz) - base;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    const max = TURN_MAX * RAD;
    bearing = base + Math.min(Math.max(turn, -max), max);
  }
  return { x: from.x + dist * Math.sin(bearing), z: from.z + dist * Math.cos(bearing) };
}

/** Clamps the wanted spot, then fills in the club, direction and ring. */
export function planShot(h: Hole, from: XZ, lie: Lie, want: XZ): Plan {
  const landing = clampTarget(h, from, lie, want);
  const carry = Math.hypot(landing.x - from.x, landing.z - from.z);
  const club = clubFor(lie, carry);
  return {
    club,
    from: { ...from },
    carry,
    dir: Math.atan2(landing.x - from.x, landing.z - from.z),
    landing,
    ringR: ringRadius(carry, club.id === 'putter'),
  };
}

export const isPutt = (plan: Plan): boolean => plan.club.id === 'putter';

// ---------- How well it was struck ----------

export type Quality = 'perfect' | 'close' | 'miss';

export interface Outcome {
  quality: Quality;
  /** Where it touches down; a putt: where it stops. */
  land: XZ;
}

/** A right answer within this share of the clock lands dead centre. */
export const DEAD_CENTRE_SHARE = 0.25;
/** A miss lands this share of the distance away (15 to 30 %). */
export const MISS_MIN = 0.15;
export const MISS_MAX = 0.3;
/** A putt ends this close to the pin or less is holed (a generous "gimme"). */
export const CUP_R = 1.2;
/** A miss is never closer than this, yards. */
export const MISS_FLOOR = CUP_R + 1;

/**
 * `angle` is a random 0..2pi (0 = straight on, pi/2 = to the right on screen) and `u` a random 0..1,
 * both passed in so tests are exact. A right answer lands inside the ring (dead centre when quick,
 * towards the edge as the clock runs out); a wrong one or a time-out lands 15 to 30 % of the
 * distance away (and always outside the ring).
 */
export function resolveShot(
  plan: Plan,
  right: boolean,
  used: number,
  clock: number,
  angle: number,
  u: number,
): Outcome {
  const { landing, carry, dir, ringR } = plan;
  let quality: Quality = 'perfect';
  let off = 0;
  if (!right) {
    quality = 'miss';
    const share = MISS_MIN + u * (MISS_MAX - MISS_MIN);
    off = Math.max(MISS_FLOOR, ringR * 1.1, carry * share);
  } else if (used > DEAD_CENTRE_SHARE * clock) {
    quality = 'close';
    const slow = (used - DEAD_CENTRE_SHARE * clock) / ((1 - DEAD_CENTRE_SHARE) * clock);
    off = ringR * Math.min(1, slow) * 0.95;
  }
  if (off === 0) return { quality, land: { ...landing } };
  // Screen-right is -x when dir = 0.
  const ahead = { x: Math.sin(dir), z: Math.cos(dir) };
  const side = { x: -Math.cos(dir), z: Math.sin(dir) };
  const a = Math.cos(angle) * off;
  const b = Math.sin(angle) * off;
  return {
    quality,
    land: { x: landing.x + ahead.x * a + side.x * b, z: landing.z + ahead.z * a + side.z * b },
  };
}

// ---------- The roll and the finish ----------

/** The share of its flight that a club's ball runs on after it lands: low irons run, wedges stop. */
export const ROLL_SHARE: Record<string, number> = {
  driver: 0.1,
  iron3: 0.08,
  iron5: 0.065,
  iron7: 0.05,
  wedge: 0.03,
  sand: 0.01,
  putter: 0,
};
/** What the ground does to the run: fast fairway, grabbing rough, dead sand. */
export const SURFACE_ROLL: Record<Surface, number> = {
  fairway: 1,
  green: 0.8,
  rough: 0.3,
  sand: 0,
  water: 0,
  tree: 0,
};

/**
 * Walks the roll from `land` along `dir` in 0.5 yd steps; stops early at the first point that is
 * sand (rests there) or water (enters there). Returns the rest point (before clampEnd).
 */
export function rollFrom(h: Hole, plan: Plan, land: XZ): XZ {
  if (isPutt(plan)) return { ...land };
  const roll =
    plan.carry * (ROLL_SHARE[plan.club.id] ?? 0) * SURFACE_ROLL[surfaceAt(h, land.x, land.z)];
  const sx = Math.sin(plan.dir);
  const sz = Math.cos(plan.dir);
  let at = { ...land };
  for (let s = 0; s < roll;) {
    s = Math.min(s + 0.5, roll);
    at = { x: land.x + sx * s, z: land.z + sz * s };
    const surface = surfaceAt(h, at.x, at.z);
    if (surface === 'sand' || surface === 'water') break;
  }
  return at;
}

export type Result =
  | { kind: 'holed'; land: XZ }
  | { kind: 'rest'; land: XZ; at: XZ; surface: Surface; tree?: number }
  | { kind: 'water'; land: XZ; splash: XZ; drop: XZ };

/** Keeps a ball inside the rough wall and not far behind the tee. */
export function clampEnd(h: Hole, p: XZ): XZ {
  const c = centreX(h, p.z);
  return {
    x: Math.min(Math.max(p.x, c - ROUGH_HALF), c + ROUGH_HALF),
    z: Math.max(p.z, -10),
  };
}

/** A tree is this tall, yards: a ball flying lower than this through its circle is stopped. */
export const TREE_HEIGHT = 12;

/**
 * Where the ball is `t` (0 to 1) along its flight: a straight run from the tee to the ring with a
 * parabola for height (`h`, above the ground), bending late towards where it touches down so the
 * ball starts on line. A putt rolls straight to where it stops.
 */
export function pathAt(
  plan: Plan,
  outcome: Outcome,
  t: number,
): { x: number; h: number; z: number } {
  const { from, landing } = plan;
  const u = Math.min(Math.max(t, 0), 1);
  if (isPutt(plan)) {
    return {
      x: from.x + (outcome.land.x - from.x) * u,
      h: 0,
      z: from.z + (outcome.land.z - from.z) * u,
    };
  }
  const bend = { x: outcome.land.x - landing.x, z: outcome.land.z - landing.z };
  return {
    x: from.x + (landing.x - from.x) * u + bend.x * u * u,
    h: 4 * plan.club.apex * plan.carry * u * (1 - u),
    z: from.z + (landing.z - from.z) * u + bend.z * u * u,
  };
}

/**
 * Walks the flight in 1 yd steps and returns the first point where the ball is inside a tree's
 * circle lower than TREE_HEIGHT, or null. A putt never hits a tree, and a tree the ball already
 * stands in (after a previous hit) is ignored.
 */
export function treeHit(h: Hole, plan: Plan, outcome: Outcome): { t: number; at: XZ } | null {
  if (isPutt(plan) || h.trees.length === 0) return null;
  const trees = h.trees.filter((tr) => Math.hypot(plan.from.x - tr.x, plan.from.z - tr.z) > tr.r);
  const dist = Math.hypot(outcome.land.x - plan.from.x, outcome.land.z - plan.from.z);
  const steps = Math.max(Math.ceil(dist), 1);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const p = pathAt(plan, outcome, t);
    if (p.h >= TREE_HEIGHT) continue;
    if (trees.some((tr) => Math.hypot(p.x - tr.x, p.z - tr.z) <= tr.r)) {
      return { t, at: { x: p.x, z: p.z } };
    }
  }
  return null;
}

/** The drop after water: step back towards where the shot was played from until the ground is dry. */
function dropFor(h: Hole, from: XZ, splash: XZ): XZ {
  const dx = from.x - splash.x;
  const dz = from.z - splash.z;
  const len = Math.hypot(dx, dz);
  let drop = { ...from };
  if (len > 0) {
    for (let i = 1; i <= 200; i++) {
      const step = Math.min(i * 2, len);
      const p = { x: splash.x + (dx / len) * step, z: splash.z + (dz / len) * step };
      if (surfaceAt(h, p.x, p.z) !== 'water') {
        drop = p;
        break;
      }
      if (step >= len) break;
    }
  }
  return drop;
}

/**
 * Where the ball ends: clamp the touchdown, stop in a tree on the way, enter water where it lands,
 * else roll on (a putt rests where it lands), then holed / water / rest by where the roll ends.
 */
export function finishShot(h: Hole, plan: Plan, outcome: Outcome): Result {
  const land = clampEnd(h, outcome.land);
  const hit = treeHit(h, plan, { ...outcome, land });
  if (hit) return { kind: 'rest', land: hit.at, at: hit.at, surface: 'rough', tree: hit.t };
  if (surfaceAt(h, land.x, land.z) === 'water') {
    return { kind: 'water', land, splash: land, drop: dropFor(h, plan.from, land) };
  }
  const rest = isPutt(plan) ? land : clampEnd(h, rollFrom(h, plan, land));
  if (Math.hypot(rest.x - h.pin.x, rest.z - h.pin.z) <= CUP_R) return { kind: 'holed', land };
  const surface = surfaceAt(h, rest.x, rest.z);
  if (surface === 'water')
    return { kind: 'water', land, splash: rest, drop: dropFor(h, plan.from, rest) };
  return { kind: 'rest', land, at: rest, surface };
}

/** Where a perfect shot with this plan ends (for the guide's tail, the suggestion and tests). */
export const predictRest = (h: Hole, plan: Plan): Result =>
  finishShot(h, plan, { quality: 'perfect', land: plan.landing });

// ---------- The smart suggestion ----------

const SUGGEST_BACK = 40;
const BAD = 10_000;

/** What a result is worth for the suggestion: lower is better. */
function scoreOf(h: Hole, r: Result): number {
  if (r.kind === 'holed') return -1;
  const at = r.kind === 'water' ? r.splash : r.at;
  const d = Math.hypot(at.x - h.pin.x, at.z - h.pin.z);
  const good =
    r.kind === 'rest' && r.tree === undefined && (r.surface === 'fairway' || r.surface === 'green');
  return good ? d : BAD + d;
}

/**
 * Where the ring starts each shot. On the green the pin. Else every spot on the line to the pin
 * within 40 yd short of it, and every spot on the fairway's centre line in the club's far half,
 * is tried with a perfect shot; the best finish wins (a hole, then fairway or green close to the
 * pin, then anything else), ties going to the shorter shot.
 */
export function suggestTarget(h: Hole, from: XZ, lie: Lie): XZ {
  if (lie === 'green') return clampTarget(h, from, lie, h.pin);
  const reach = reachFor(lie);
  const d = Math.hypot(h.pin.x - from.x, h.pin.z - from.z);
  const base = Math.atan2(h.pin.x - from.x, h.pin.z - from.z);
  const candidates: XZ[] = [h.pin];
  for (let s = Math.max(MIN_SHOT, d - SUGGEST_BACK); s <= Math.min(d, reach); s += 1) {
    candidates.push({ x: from.x + s * Math.sin(base), z: from.z + s * Math.cos(base) });
  }
  for (let z = 0; z <= h.length; z += 5) {
    const p = { x: centreX(h, z), z };
    const away = Math.hypot(p.x - from.x, p.z - from.z);
    if (away >= 0.5 * reach && away <= reach) candidates.push(p);
  }
  let best = clampTarget(h, from, lie, h.pin);
  let bestScore = Infinity;
  let bestDist = Infinity;
  for (const c of candidates) {
    const plan = planShot(h, from, lie, c);
    const score = scoreOf(h, predictRest(h, plan));
    if (score < bestScore || (score === bestScore && plan.carry < bestDist)) {
      best = plan.landing;
      bestScore = score;
      bestDist = plan.carry;
    }
  }
  return best;
}
