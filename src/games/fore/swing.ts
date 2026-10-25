/**
 * The golf swing as numbers: how long each kind takes, and the body and arm angles over time.
 * Pure (no three.js). Angles are degrees; positive turns away from the target (the backswing).
 */

export type SwingKind = 'full' | 'half' | 'putt';

export const SWING_TIMING = {
  full: { seconds: 1.2, impact: 0.8 },
  half: { seconds: 1.0, impact: 0.65 },
  putt: { seconds: 1.0, impact: 0.6 },
} as const;

/** Putter: 'putt'. Sand wedge or wedge whose `carry` is 40 yd or less: 'half'. Otherwise 'full'. */
export function swingKind(club: { id: string; carry: number }): SwingKind {
  if (club.id === 'putter') return 'putt';
  if ((club.id === 'sand' || club.id === 'wedge') && club.carry <= 40) return 'half';
  return 'full';
}

export const timingFor = (club: { id: string; carry: number }) => SWING_TIMING[swingKind(club)];

/** Everything the golfer's body and arms are doing at one moment of a swing. */
export interface SwingFrame {
  /** Turn of the pelvis. */
  hips: number;
  /** Turn of the shoulders (the shoulders are `shoulders - hips` past the pelvis). */
  shoulders: number;
  /** Sideways shift of the pelvis towards the target, yards. */
  slide: number;
  /** Angle of the lead arm in the swing plane, from where it hangs at address. */
  arms: number;
  /** The wrist hinge between the lead arm and the shaft, from how it is at address. */
  cock: number;
  /** How far he has stood up from the address bend, 0 to 1. */
  up: number;
  /** Where the head faces, from the ball (positive away from the target). */
  head: number;
  /** Knee bends, radians. */
  leadKnee: number;
  trailKnee: number;
  /** Heel raise of the trail foot, radians (toes down). */
  trailHeel: number;
}

type Row = readonly number[];
const COLUMNS = [
  'hips',
  'shoulders',
  'slide',
  'arms',
  'cock',
  'up',
  'head',
  'leadKnee',
  'trailKnee',
  'trailHeel',
] as const;

// t, hips, shoulders, slide, arms, cock, up, head, leadKnee, trailKnee, trailHeel
// Arms and cock are changes from address, and the plane they swing in is fixed to the stance, so the
// arms travel further than a tour player's quoted numbers.
const FULL: readonly Row[] = [
  [0.0, 0, 0, 0, 0, 0, 0, 0, 0.25, 0.25, 0],
  [0.18, 12, 25, -0.03, 49, 33, 0, 3, 0.27, 0.25, 0],
  [0.5, 45, 90, -0.08, 128, 112, 0, 10, 0.45, 0.22, 0],
  [0.56, 42, 90, -0.06, 128, 114, 0, 10, 0.45, 0.22, 0],
  [0.7, 15, 35, 0.05, 56, 46, 0, 5, 0.3, 0.25, 0.05],
  [0.8, -35, -5, 0.1, -5, -12, 0, 0, 0.12, 0.3, 0.2],
  [0.95, -60, -50, 0.12, -46, -66, 0.3, -35, 0.08, 0.4, 0.5],
  [1.1, -80, -85, 0.13, -101, -125, 0.7, -75, 0.05, 0.5, 0.9],
  [1.2, -90, -95, 0.14, -141, -167, 0.95, -85, 0.05, 0.55, 1.0],
];

// A putt rocks the shoulders like a pendulum: no hips, no slide, the wrists stay put.
const PUTT: readonly Row[] = [
  [0.0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.2, 0],
  [0.34, 0, 12, 0, 16, 0, 0, 0, 0.2, 0.2, 0],
  [0.6, 0, -1, 0, -1, 0, 0, 0, 0.2, 0.2, 0],
  [0.85, 0, -10, 0, -14, 0, 0, 0, 0.2, 0.2, 0],
  [1.0, 0, -10, 0, -14, 0, 0.1, -5, 0.2, 0.2, 0],
];

/** Monotone cubic (no overshoot) through the rows, flat at the first and last key. */
function curve(rows: readonly Row[], column: number, t: number): number {
  const n = rows.length;
  if (t <= rows[0][0]) return rows[0][column];
  if (t >= rows[n - 1][0]) return rows[n - 1][column];
  let k = 0;
  while (t > rows[k + 1][0]) k++;
  const h = (i: number) => rows[i + 1][0] - rows[i][0];
  const d = (i: number) => (rows[i + 1][column] - rows[i][column]) / h(i);
  const m = (i: number): number => {
    if (i === 0 || i === n - 1) return 0;
    const a = d(i - 1);
    const b = d(i);
    if (a * b <= 0) return 0;
    const w1 = 2 * h(i) + h(i - 1);
    const w2 = h(i) + 2 * h(i - 1);
    return (w1 + w2) / (w1 / a + w2 / b);
  };
  const u = (t - rows[k][0]) / h(k);
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    (2 * u3 - 3 * u2 + 1) * rows[k][column] +
    (u3 - 2 * u2 + u) * h(k) * m(k) +
    (-2 * u3 + 3 * u2) * rows[k + 1][column] +
    (u3 - u2) * h(k) * m(k + 1)
  );
}

/** What the golfer adds to arms and cock at impact (found by putting the head on the ball). */
export interface ImpactFix {
  arms: number;
  cock: number;
}

const IMPACT_FULL_AT = SWING_TIMING.full.impact;

/** Moves `t` of a half swing onto the full swing's clock, so impact lines up. */
function fullTime(t: number): number {
  const half = SWING_TIMING.half;
  if (t <= half.impact) return (t / half.impact) * IMPACT_FULL_AT;
  return (
    IMPACT_FULL_AT +
    ((t - half.impact) / (half.seconds - half.impact)) * (SWING_TIMING.full.seconds - IMPACT_FULL_AT)
  );
}

/**
 * The swing `t` seconds in (clamped to its length). `fix` is added to the arms and cock around impact (the
 * golfer finds it from the club so that the head meets the ball).
 */
export function swingFrame(kind: SwingKind, t: number, fix?: ImpactFix): SwingFrame {
  const { seconds, impact } = SWING_TIMING[kind];
  const at = Math.min(Math.max(t, 0), seconds);
  const rows = kind === 'putt' ? PUTT : FULL;
  const clock = kind === 'half' ? fullTime(at) : at;
  const v = COLUMNS.map((_, i) => curve(rows, i + 1, clock));
  const frame = Object.fromEntries(COLUMNS.map((c, i) => [c, v[i]])) as unknown as SwingFrame;
  if (kind === 'half') {
    // Every angle is cut to 0.55 of the full swing's; the golfer's impact fit puts the head on the ball.
    const w = 0.55;
    frame.hips *= w;
    frame.shoulders *= w;
    frame.slide *= w;
    frame.arms *= w;
    frame.cock *= w;
    frame.head *= w;
    frame.up *= w;
    frame.leadKnee = 0.25 + (frame.leadKnee - 0.25) * w;
    frame.trailKnee = 0.25 + (frame.trailKnee - 0.25) * w;
    frame.trailHeel *= w;
  }
  if (fix) {
    const near = Math.exp(-(((at - impact) / 0.07) ** 2));
    frame.arms += fix.arms * near;
    frame.cock += fix.cock * near;
  }
  return frame;
}

/** The frame at impact, for the golfer's calibration. */
export const impactFrame = (kind: SwingKind): SwingFrame =>
  swingFrame(kind, SWING_TIMING[kind].impact);
