/** Pure game rules and motion helpers, kept free of three.js objects so they are easy to test. */
import { END_Z, SPAWN_Z } from './layout';

/** Brains (lives) the player starts each run with; they are never refilled. */
export const BRAINS = 3;

/** What the announcer says. The wave number is shown on screen, never spoken. */
export const GAME_OVER_SPEECH = 'The zombies got your brains!';
export const BOSS_SPEECH = 'Here comes the boss!';
export const BOSS_DOWN_SPEECH = 'Boss down!';
export const NEXT_WAVE_SPEECH = 'Next wave!';
export const NEW_HIGH_SCORE_SPEECH = 'New high score!';
export const GREAT_BLASTING_SPEECH = 'Great blasting!';

/** Regular zombies walking at once; a spawn that is due waits until there is room. */
export const MAX_ON_FIELD = 6;
/** Seconds between spawns in wave 1, how much shorter each wave makes it, and the floor. */
export const SPAWN_START = 5;
export const SPAWN_STEP = 0.5;
export const SPAWN_MIN = 1;
/** Right answers it takes to knock out the boss. */
export const BOSS_HITS = 3;
/** The boss walks at this share of the zombies' pace. */
export const BOSS_PACE = 0.5;
/** Share of the pace the other zombies keep while a wrong answer is being explained. */
export const REVEAL_PACE = 0.25;
/** How far, in world units, a hit staggers the boss back along its path. */
export const BOSS_KNOCKBACK = 1.5;
/** Points for knocking out the boss, on top of its hits. */
export const BOSS_BONUS = 500;
/** Points for a hit however slow, and the extra for answering instantly. */
export const BASE_POINTS = 100;
export const TIME_BONUS = 50;
/** The streak at which the score multiplier steps up to ×2 and ×3. */
export const STREAK_X2 = 5;
export const STREAK_X3 = 10;

/** One brain lost, never below zero. */
export function loseBrain(brains: number): number {
  return Math.max(0, brains - 1);
}

export function outOfBrains(brains: number): boolean {
  return brains <= 0;
}

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

/** Eases `current` towards `goal`; frame-rate independent for a given `rate` (1/seconds). */
export function easeToward(current: number, goal: number, rate: number, delta: number): number {
  return current + (goal - current) * (1 - Math.exp(-rate * delta));
}

/** Regular zombies in a wave (before its boss); waves are numbered from 1. */
export function zombiesInWave(wave: number): number {
  return 6 + 2 * (Math.max(wave, 1) - 1);
}

/** Seconds between spawns in a wave: 5, 4.5, 4, … down to 1 second from wave 9 on. */
export function spawnInterval(wave: number): number {
  return Math.max(SPAWN_MIN, SPAWN_START - SPAWN_STEP * (Math.max(wave, 1) - 1));
}

/**
 * World units per second a zombie walks when the current question gives `factSeconds` for the
 * whole path from the mist to the barricade. The boss is slower, and everyone slows right down
 * while a wrong answer is being explained.
 */
export function walkSpeed(factSeconds: number, boss = false, revealing = false): number {
  const path = END_Z - SPAWN_Z;
  const base = path / Math.max(factSeconds, 0.1);
  return base * (boss ? BOSS_PACE : 1) * (revealing ? REVEAL_PACE : 1);
}

/** Score multiplier for a streak of hits in a row (counting the hit being scored). */
export function multiplierFor(streak: number): number {
  if (streak >= STREAK_X3) return 3;
  if (streak >= STREAK_X2) return 2;
  return 1;
}

/** The streak after a right answer (one more) or a wrong answer or lost brain (back to zero). */
export function nextStreak(streak: number, hit: boolean): number {
  return hit ? streak + 1 : 0;
}

/**
 * Points for one right answer: 100, plus up to 50 for answering quickly (measured against the
 * question's time), times the multiplier for the streak including this hit.
 */
export function hitPoints(answerSeconds: number, factSeconds: number, streak: number): number {
  const quick = factSeconds > 0 ? clamp01(1 - answerSeconds / factSeconds) : 0;
  return Math.round((BASE_POINTS + TIME_BONUS * quick) * multiplierFor(streak));
}

/**
 * The index of the zombie nearest the barricade (the largest z) among those that can be
 * targeted, or -1 when there are none. `null` marks one that cannot: blasted, poofing or
 * already at the barricade.
 */
export function closestIndex(zs: readonly (number | null)[]): number {
  let best = -1;
  zs.forEach((z, i) => {
    if (z !== null && (best < 0 || z > (zs[best] as number))) best = i;
  });
  return best;
}

/**
 * The lane for a new zombie, so they do not stack up: `rearZByLane[i]` is the z of the zombie
 * most recently sent down lane i that is still walking, or null when the lane is clear. A clear
 * lane is best; otherwise the lane whose last zombie has walked furthest on (the largest z) has the
 * most room behind it. Ties are broken at random.
 */
export function pickLane(rearZByLane: readonly (number | null)[], random: () => number): number {
  const room = rearZByLane.map((z) => (z === null ? Infinity : z));
  const most = Math.max(...room);
  const best = room.flatMap((r, i) => (r === most ? [i] : []));
  return best[Math.min(Math.floor(random() * best.length), best.length - 1)];
}

export interface WaveSpawner {
  readonly wave: number;
  /** Regulars still to send this wave. */
  readonly left: number;
  /**
   * Advances the clock; returns how many regulars to spawn now (0 or 1). `walking` is how many
   * regulars are on the field: a zombie comes at once when there are none, otherwise every
   * interval, and never while the field is full.
   */
  update(delta: number, walking: number): number;
  /** All regulars sent and none still on the field: time for the boss. */
  readonly bossDue: boolean;
  /** The boss has been sent, so it is not due any more. */
  bossSent(): void;
  nextWave(): void;
}

/** Decides when the next zombie of a wave comes out of the mist. */
export function createWaveSpawner(): WaveSpawner {
  let wave = 1;
  let left = zombiesInWave(1);
  let sinceSpawn = 0;
  let onField = 0;
  let boss = false;
  return {
    get wave() {
      return wave;
    },
    get left() {
      return left;
    },
    get bossDue() {
      return left === 0 && onField === 0 && !boss;
    },
    update(delta, walking) {
      onField = walking;
      if (left <= 0) return 0;
      sinceSpawn += delta;
      if (walking >= MAX_ON_FIELD) return 0;
      if (walking > 0 && sinceSpawn < spawnInterval(wave)) return 0;
      left--;
      sinceSpawn = 0;
      onField = walking + 1;
      return 1;
    },
    bossSent() {
      boss = true;
    },
    nextWave() {
      wave++;
      left = zombiesInWave(wave);
      sinceSpawn = 0;
      boss = false;
    },
  };
}

/** The line on the results screen: how far the run got. */
export function outcomeText(wave: number, blasted: number): string {
  return `You reached wave ${wave} and blasted ${blasted} ${blasted === 1 ? 'zombie' : 'zombies'}!`;
}

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

/** How high the bomb arcs above the straight line between throw and target. */
export function arcHeightFor(distance: number): number {
  return 1.1 + Math.min(distance, 14) * 0.07;
}

/**
 * Where a lobbed bomb is `t` seconds into a flight of `duration` seconds: a parabola from
 * `from` to `to` that peaks `arc` above the straight line, so it starts and ends exactly there.
 */
export function bombPosition(
  from: Point3,
  to: Point3,
  t: number,
  duration: number,
  arc: number,
): Point3 {
  const s = duration > 0 ? clamp01(t / duration) : 1;
  return {
    x: from.x + (to.x - from.x) * s,
    y: from.y + (to.y - from.y) * s + 4 * arc * s * (1 - s),
    z: from.z + (to.z - from.z) * s,
  };
}

/** Gravity pulling smashed fence planks down, in world units per second squared. */
export const FENCE_GRAVITY = 9.8;

/** Indices of the plank centres `xs` within `reach` of `x`: the planks a zombie in that lane smashes. */
export function planksInReach(xs: readonly number[], x: number, reach: number): number[] {
  const hit: number[] = [];
  xs.forEach((plankX, i) => {
    if (Math.abs(plankX - x) <= reach) hit.push(i);
  });
  return hit;
}

/** Seconds a body launched from height `y` with upward speed `vy` takes to drop to `floor`. */
export function fallTime(y: number, vy: number, floor: number, gravity = FENCE_GRAVITY): number {
  const height = Math.max(y - floor, 0);
  return (vy + Math.sqrt(vy * vy + 2 * gravity * height)) / gravity;
}

/**
 * Where a smashed plank is `t` seconds after it left the fence: a ballistic arc from `from` with
 * `velocity`, which stops where it first reaches the `floor` instead of sinking into it.
 */
export function plankFlight(
  from: Point3,
  velocity: Point3,
  t: number,
  floor: number,
  gravity = FENCE_GRAVITY,
  out: Point3 = { x: 0, y: 0, z: 0 },
): Point3 {
  const s = Math.min(Math.max(t, 0), fallTime(from.y, velocity.y, floor, gravity));
  out.x = from.x + velocity.x * s;
  out.y = Math.max(floor, from.y + velocity.y * s - 0.5 * gravity * s * s);
  out.z = from.z + velocity.z * s;
  return out;
}

/** Eases to 1 with a little overshoot on the way, for fence pieces popping back into place. */
export function easeOutBack(t: number, overshoot = 1.70158): number {
  const u = clamp01(t) - 1;
  return 1 + (overshoot + 1) * u ** 3 + overshoot * u ** 2;
}

/** The same angle wrapped into -π..π, so blending back to zero never takes the long way round. */
export function wrapAngle(angle: number): number {
  const turn = Math.PI * 2;
  return angle - Math.round(angle / turn) * turn;
}
