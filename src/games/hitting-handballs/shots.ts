/**
 * The flight of the ball as pure physics: a shot is a chain of projectile segments under one
 * gravity, hand to a bounce on the court to the wall (and maybe another bounce) to the receiver. Plain `{x, y, z}` objects, no three.js. x runs along the court away from the wall, y is
 * up and z points toward the camera.
 */
export interface Vec {
  x: number;
  y: number;
  z: number;
}
export interface Segment {
  from: Vec;
  to: Vec;
  duration: number;
  /** Extra height at the middle of the segment, in metres (gravity's: g·duration²/8). */
  arc: number;
}
export interface Shot {
  segments: Segment[];
  duration: number;
}

/** The face of the wall. */
export const WALL_X = -3.0;
export const BALL_R = 0.09;
/** Hand height of a scale-1 kid; multiply by scale. */
export const CONTACT_Y = 1.0;
/** How far along its last segment a ball coming to us stops and waits for the answer. */
export const HOLD_U = 0.6;
/** Seconds of bouncing the ball once before a serve is hit. */
export const SERVE_WINDUP = 0.35;
/** Gravity, in m/s². Every flight is a real projectile under it. */
export const GRAVITY = 9.8;
/** Share of the up-and-down speed a bounce on the court gives back. */
export const FLOOR_BOUNCE = 0.72;
/** Share of the along-the-court speed kept through a bounce (the rest is lost to grip). */
export const FLOOR_KEEP = 0.9;
/** Share of the speed into the wall it sends back out. */
export const WALL_BOUNCE = 0.8;
/** The range of speeds (m/s, along the court) a hand sends the ball off at. */
export const SHOT_SPEEDS = { normal: [5.5, 9], smash: [10, 14] } as const;
/** Higher than this, a hand-hit ball looks wild; shots that go there are avoided. A smash kicks
 *  up higher off the wall. */
const PEAK_Y = { normal: 2.2, smash: 3.2 };
/** How high a smash comes past the kid who can't get it. */
const SMASH_PASS_Y = 0.45;
/** The softest and hardest any shot is hit, when a spot can't be reached in its kind's range. */
const SLOWEST = 3.5;
const FASTEST = 18;
/** Where a missed ball goes: past everyone and off the right side. */
export const PAST = { x: 4.8 };
/** The side lines of the court: a missed ball never lands outside them. */
export const LANE = { min: -1.5, max: 1.3 };
/** Seconds a missed ball rolls on after the shot ends. */
export const ROLL_OFF = 0.6;
/** Lowest and highest wall hit of an ordinary shot. */
export const WALL_Y_RANGE = [0.5, 1.2] as const;
/** Wall height of a winner. */
export const WINNER_WALL_Y = 0.3;

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const EPS = 1e-9;

/** A projectile from `from` to `to` in `duration`: the arc that gravity gives it. */
function segment(from: Vec, to: Vec, duration: number): Segment {
  return { from, to, duration, arc: (GRAVITY * duration * duration) / 8 };
}

function shotOf(segments: Segment[]): Shot {
  return { segments, duration: segments.reduce((sum, s) => sum + s.duration, 0) };
}

interface Ball {
  p: Vec;
  v: Vec;
}

type Hit = 'floor' | 'wall' | 'stop';

/**
 * Flies the ball until the next thing it meets: the court, the wall, or (when `stopX` is given
 * and it is heading right) the line x = `stopX`. Returns what it met, when, and the ball there.
 */
function flyToNext(b: Ball, stopX: number | null): { hit: Hit; t: number; ball: Ball } {
  const { p, v } = b;
  // The court: p.y + v.y t - g t²/2 = BALL_R, the later root.
  const dy = p.y - BALL_R;
  const tFloor = (v.y + Math.sqrt(Math.max(v.y * v.y + 2 * GRAVITY * dy, 0))) / GRAVITY;
  let hit: Hit = 'floor';
  let t = Math.max(tFloor, 0);
  const wallFace = WALL_X + BALL_R;
  if (v.x < -EPS) {
    const tWall = (wallFace - p.x) / v.x;
    if (tWall >= 0 && tWall < t) {
      hit = 'wall';
      t = tWall;
    }
  }
  if (stopX !== null && v.x > EPS) {
    const tStop = (stopX - p.x) / v.x;
    if (tStop >= 0 && tStop <= t) {
      hit = 'stop';
      t = tStop;
    }
  }
  const at: Vec = { x: p.x + v.x * t, y: p.y + v.y * t - (GRAVITY * t * t) / 2, z: p.z + v.z * t };
  const vel: Vec = { x: v.x, y: v.y - GRAVITY * t, z: v.z };
  if (hit === 'floor') {
    at.y = BALL_R;
    vel.y = -vel.y * FLOOR_BOUNCE;
    vel.x *= FLOOR_KEEP;
    vel.z *= FLOOR_KEEP;
  } else if (hit === 'wall') {
    at.x = wallFace;
    vel.x = -vel.x * WALL_BOUNCE;
  }
  return { hit, t, ball: { p: at, v: vel } };
}

interface Flown {
  segments: Segment[];
  hits: Hit[];
  end: Ball;
  /** Height at the wall, or null if it never got there. */
  wallY: number | null;
}

/**
 * Flies a ball from `start` until it reaches x = `stopX` after the wall (or `maxHits` things are
 * met), as a list of true projectile segments.
 */
function fly(start: Ball, stopX: number, maxHits = 8): Flown {
  const segments: Segment[] = [];
  const hits: Hit[] = [];
  let ball = start;
  let wallY: number | null = null;
  for (let i = 0; i < maxHits; i++) {
    const next = flyToNext(ball, wallY === null ? null : stopX);
    segments.push(segment(ball.p, next.ball.p, next.t));
    hits.push(next.hit);
    ball = next.ball;
    if (next.hit === 'wall') wallY = ball.p.y;
    if (next.hit === 'stop') break;
  }
  return { segments, hits, end: ball, wallY };
}

/** The launch velocity with speed `h` along the court and up-speed `vy`, heading at angle `a`. */
function launch(from: Vec, h: number, a: number, vy: number): Ball {
  return { p: { ...from }, v: { x: -h * Math.cos(a), y: vy, z: h * Math.sin(a) } };
}

/** Fits the heading so the ball, after the wall, comes back past `to` at to.z. */
function aimHeading(from: Vec, to: Vec, h: number, vy: number): number {
  // Start from the mirror image of `to` in the wall (exact with no losses), then correct.
  const face = WALL_X + BALL_R;
  const mx = 2 * face - to.x;
  let a = Math.atan2(to.z - from.z, from.x - mx);
  for (let i = 0; i < 6; i++) {
    const f = fly(launch(from, h, a, vy), to.x);
    if (f.hits[f.hits.length - 1] !== 'stop') return a;
    const err = f.end.p.z - to.z;
    if (Math.abs(err) < 1e-4) break;
    // How far z moves per radian, from the flight's length along the court.
    const along = Math.hypot(from.x - mx, to.z - from.z);
    a -= err / Math.max(along, 0.5);
  }
  return a;
}

interface Candidate {
  flown: Flown;
  score: number;
}

/**
 * One try: speed `h`, up-speed `vy`. It counts only if the ball bounces on the court exactly once
 * before the wall, at most once after it, and comes back past the receiver.
 */
function tryShot(from: Vec, to: Vec, h: number, vy: number): Flown | null {
  const a = aimHeading(from, to, h, vy);
  const f = fly(launch(from, h, a, vy), to.x);
  const wallAt = f.hits.indexOf('wall');
  if (wallAt !== 1 || f.hits[0] !== 'floor') return null;
  if (f.hits[f.hits.length - 1] !== 'stop') return null;
  if (f.hits.length - wallAt - 2 > 1) return null;
  return f;
}

/**
 * A shot from the hand at `from`: down to a bounce on the court, up to the wall near height
 * `wallY`, back out (bouncing once if it needs to) to the receiver's hand at `to`. Every part is
 * a real projectile under one gravity, with the court and the wall taking some speed off. The
 * launch speed is fitted so the ball meets the hand; a smash is hit much harder. With `miss` it
 * flies on past the receiver, bouncing, until it is off the right side at `PAST.x`.
 */
export function planShot(
  kind: 'normal' | 'smash',
  from: Vec,
  to: Vec,
  wallY: number,
  miss: boolean,
): Shot {
  const [lo, hi] = SHOT_SPEEDS[kind];
  // A smash that gets past skids by low, at the knees; anything else comes by at the hand.
  const passY = miss && kind === 'smash' ? SMASH_PASS_Y : to.y;
  let best: Candidate | null = null;
  let good = false;
  const consider = (f: Flown | null, h: number) => {
    if (!f) return;
    const yErr = Math.abs(f.end.p.y - passY);
    const wallErr = Math.abs((f.wallY ?? 0) - wallY);
    // Meeting the hand matters most, then no wild bounce up high, then the wall height, then the
    // middle of the speed range. A ball that will be missed only has to come past near the hand.
    const high = Math.max(peak(f.segments) - PEAK_Y[kind], 0);
    const score = yErr * (miss ? 4 : 20) + high * 5 + wallErr + Math.abs(h - (lo + hi) / 2) * 0.02;
    if (!best || score < best.score) best = { flown: f, score };
    if (high === 0 && yErr <= (miss ? 0.3 : 0.01)) good = true;
  };
  const search = (from0: number, to0: number) => {
    for (let i = 0; i <= 6; i++) {
      const h = lerp(from0, to0, i / 6);
      // Scan the up-speed for where the ball comes past at hand height, then close in on it.
      let prev: { vy: number; err: number } | null = null;
      for (let vy = -16; vy <= 3 + EPS; vy += 0.4) {
        const f = tryShot(from, to, h, vy);
        consider(f, h);
        const err = f ? f.end.p.y - passY : null;
        if (err !== null && prev && Math.sign(err) !== Math.sign(prev.err)) {
          let a = prev.vy;
          let b = vy;
          let ea = prev.err;
          for (let k = 0; k < 30; k++) {
            const m = (a + b) / 2;
            const fm = tryShot(from, to, h, m);
            if (!fm) break;
            const em = fm.end.p.y - passY;
            consider(fm, h);
            if (Math.sign(em) === Math.sign(ea)) {
              a = m;
              ea = em;
            } else {
              b = m;
            }
          }
        }
        prev = err === null ? null : { vy, err };
      }
    }
  };
  search(lo, hi);
  // Some spots (right by the wall) can't be reached at this pace: hit it softer or harder.
  if (!good) search(SLOWEST, lo);
  if (!good) search(hi, FASTEST);
  const found = (best as Candidate | null)?.flown ?? fallback(from, to);
  const segments = found.segments.map((s) => ({ ...s }));
  if (miss) {
    // On past the receiver, wherever it came by.
    return shotOf([...segments, ...runOff(found.end)]);
  }
  // The last segment ends exactly in the hand (any fitting error is a hair).
  segments[segments.length - 1].to = { ...to };
  return shotOf(segments);
}

/** The highest point of a chain of projectile segments. */
function peak(segments: Segment[]): number {
  let top = 0;
  for (const s of segments) {
    // y(u) = lerp + 4·arc·u(1-u); its top is where the slope is zero, if inside the segment.
    const m = s.to.y - s.from.y;
    const u = s.arc > EPS ? Math.min(Math.max(0.5 + m / (8 * s.arc), 0), 1) : 1;
    top = Math.max(top, lerp(s.from.y, s.to.y, u) + 4 * s.arc * u * (1 - u), s.from.y);
  }
  return top;
}

/** Below this up-speed off the court (m/s) a running ball stops hopping and rolls. */
const ROLL_BELOW = 1.5;
/** The slowest a missed ball rolls off the side, m/s. */
const ROLL_SPEED = 3;

/**
 * A ball running on from `start` off the right side: it bounces, each hop lower, until it hops
 * hardly at all, then rolls along the court until it is past `PAST.x`.
 */
function runOff(start: Ball): Segment[] {
  const segments: Segment[] = [];
  let ball = start;
  for (let i = 0; i < 12 && ball.p.x < PAST.x; i++) {
    if (ball.p.y <= BALL_R + EPS && ball.v.y < ROLL_BELOW) break;
    const next = flyToNext(ball, null);
    // Keep it inside the side lines: a ball that would cross one runs straight on instead.
    const z = Math.min(Math.max(next.ball.p.z, LANE.min), LANE.max);
    if (z !== next.ball.p.z) next.ball = { p: { ...next.ball.p, z }, v: { ...next.ball.v, z: 0 } };
    segments.push(segment(ball.p, next.ball.p, next.t));
    ball = next.ball;
  }
  if (ball.p.x < PAST.x) {
    const speed = Math.max(ball.v.x, ROLL_SPEED);
    const end: Vec = { x: PAST.x, y: BALL_R, z: ball.p.z };
    segments.push({ from: ball.p, to: end, duration: (PAST.x - ball.p.x) / speed, arc: 0 });
  }
  return segments;
}

/** Never needed for a ball on the court, but a shot must always exist: bounce, wall, hand. */
function fallback(from: Vec, to: Vec): Flown {
  const wall: Vec = { x: WALL_X + BALL_R, y: 1, z: (from.z + to.z) / 2 };
  const bounce: Vec = { x: lerp(from.x, wall.x, 0.55), y: BALL_R, z: lerp(from.z, wall.z, 0.55) };
  const speed = 7;
  const time = (a: Vec, b: Vec) => Math.max(Math.hypot(b.x - a.x, b.z - a.z) / speed, 0.15);
  const t3 = time(wall, to);
  return {
    segments: [
      segment(from, bounce, time(from, bounce)),
      segment(bounce, wall, time(bounce, wall)),
      segment(wall, to, t3),
    ],
    hits: ['floor', 'wall', 'stop'],
    end: { p: { ...to }, v: { x: speed, y: (to.y - wall.y) / t3 - (GRAVITY * t3) / 2, z: 0 } },
    wallY: wall.y,
  };
}

/** The ball's velocity `t` seconds into a shot, from the segment there. */
export function velocityAt(shot: Shot, t: number): Vec {
  let left = Math.min(Math.max(t, 0), shot.duration);
  for (const s of shot.segments) {
    if (left <= s.duration || s === shot.segments[shot.segments.length - 1]) {
      const d = Math.max(s.duration, EPS);
      const tt = Math.min(left, s.duration);
      return {
        x: (s.to.x - s.from.x) / d,
        // The slope of lerp + 4·arc·u(1-u) (a rolling segment has no arc).
        y: (s.to.y - s.from.y) / d + ((4 * s.arc) / d) * (1 - (2 * tt) / d),
        z: (s.to.z - s.from.z) / d,
      };
    }
    left -= s.duration;
  }
  return { x: 0, y: 0, z: 0 };
}

/** A ball let go at `from` moving at `v` that runs on past a kid who missed it, off the right side. */
export function pastShot(from: Vec, v: Vec): Shot {
  const run = { x: Math.max(v.x, 2.5), y: v.y, z: v.z * 0.5 };
  return shotOf(runOff({ p: { ...from }, v: run }));
}

/**
 * A ball that hits a head at `head`, pops back off it and drops to bounce at `floorX`, then
 * bounces twice more, each lower, where it lands.
 */
export function bonkShot(from: Vec, head: Vec, floorX: number): Shot {
  const toHead = segment(from, head, 0.2);
  // Pops up off the head: up-speed `pop`, then falls to the court.
  const pop = 2.2;
  const dy = head.y - BALL_R;
  const fall = (pop + Math.sqrt(pop * pop + 2 * GRAVITY * dy)) / GRAVITY;
  const land: Vec = { x: floorX, y: BALL_R, z: head.z + 0.1 };
  const segments = [toHead, segment(head, land, fall)];
  // Each bounce gives back FLOOR_BOUNCE of the up-speed; the ball creeps on a little.
  let up = (GRAVITY * fall - pop) * FLOOR_BOUNCE;
  const creep = ((floorX - head.x) / fall) * FLOOR_KEEP;
  let at = land;
  for (let i = 0; i < 2; i++) {
    const t = (2 * up) / GRAVITY;
    const next: Vec = { x: at.x + creep * t, y: BALL_R, z: at.z };
    segments.push(segment(at, next, t));
    at = next;
    up *= FLOOR_BOUNCE;
  }
  return shotOf(segments);
}

/**
 * The serve's bounce, `t` seconds into a windup of `lead`: thrown down from the hand at `from`,
 * off the court at the middle of the windup, back up to the hand at the end, under gravity.
 */
export function serveBounce(from: Vec, t: number, lead: number): Vec {
  const half = lead / 2;
  const tau = Math.abs(t - half);
  // The speed off the court that brings the ball back up to the hand in half the windup.
  const up = (from.y - BALL_R) / half + (GRAVITY * half) / 2;
  return { x: from.x, y: BALL_R + up * tau - (GRAVITY * tau * tau) / 2, z: from.z };
}

/** Where the ball is `t` seconds into a shot (clamped to its length). */
export function ballAt(shot: Shot, t: number): Vec {
  let left = Math.min(Math.max(t, 0), shot.duration);
  for (const s of shot.segments) {
    if (left <= s.duration) {
      const u = s.duration > 0 ? left / s.duration : 1;
      if (u >= 1 - 1e-12) return { ...s.to };
      return {
        x: lerp(s.from.x, s.to.x, u),
        y: lerp(s.from.y, s.to.y, u) + s.arc * 4 * u * (1 - u),
        z: lerp(s.from.z, s.to.z, u),
      };
    }
    left -= s.duration;
  }
  return { ...shot.segments[shot.segments.length - 1].to };
}

/** Seconds into the shot when its last segment is `HOLD_U` of the way along. */
export function holdTime(shot: Shot): number {
  const last = shot.segments[shot.segments.length - 1];
  return shot.duration - last.duration + HOLD_U * last.duration;
}

/** When the ball meets the court and the wall along a shot, for the sounds. */
export function contacts(shot: Shot): { t: number; what: 'floor' | 'wall' }[] {
  const out: { t: number; what: 'floor' | 'wall' }[] = [];
  let t = 0;
  for (const s of shot.segments.slice(0, -1)) {
    t += s.duration;
    if (Math.abs(s.to.x - (WALL_X + BALL_R)) < 1e-6) out.push({ t, what: 'wall' });
    else if (Math.abs(s.to.y - BALL_R) < 1e-6) out.push({ t, what: 'floor' });
  }
  return out;
}

/** The first time the ball is at or past `x` on its way right after the wall, or null. */
export function timeAtX(shot: Shot, x: number): number | null {
  const start = contacts(shot).find((c) => c.what === 'wall')?.t ?? 0;
  for (let t = start; t <= shot.duration + 1e-9; t += 0.01) {
    if (ballAt(shot, t).x >= x) return t;
  }
  return null;
}

/** Where a kid with home spot `homeX` stands to hit: within a metre of home, on the court. */
export function contactSpot(homeX: number, random: number): number {
  return Math.min(Math.max(homeX + (random * 2 - 1), -2.2), 2.8);
}
