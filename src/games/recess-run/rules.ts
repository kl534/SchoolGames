/**
 * The pure rules of Recess Race: the heat's pace, the rivals' speeds, how the player's typing
 * becomes running speed, mistakes (stumble and face-plant), places, points, the speed levels'
 * streak and the results line. No DOM, no three.js.
 */
import { levelOf, multiplier } from '../../shared/typing/course';
import { SPEED_ACCURACY, wpm } from '../../shared/typing/progress';

export const RACE_METRES = 100;
/** Seconds a runner at exactly the heat's pace takes for 100 m. */
export const HEAT_SECONDS = 45;
/** Metres a second at the heat's pace. */
export const RACE_SPEED = RACE_METRES / HEAT_SECONDS;
export const START_WPM = 5;
export const heatWpm = (heat: number): number => START_WPM + (heat - 1);

/** The rivals' pace next to the heat's (slowest to fastest). To go on you must beat 7 of them. */
export const RIVAL_FACTORS = [0.76, 0.82, 0.88, 0.94, 1.0, 1.06, 1.12, 1.18, 1.24];
/** Where the rivals' names come from: girls' names for the girl figures, boys' for the boys. */
export const RIVAL_GIRL_NAMES = [
  'Mia',
  'Zara',
  'Ava',
  'Lily',
  'Ella',
  'Ruby',
  'Maya',
  'Nina',
  'Chloe',
  'Priya',
  'Hana',
  'Isla',
  'Tara',
  'Aisha',
  'Carmen',
  'Esme',
  'Gia',
  'Sofia',
  'Emma',
  'Grace',
  'Zoe',
  'Lucy',
  'Rosa',
  'Amara',
  'Yuki',
  'Daisy',
  'Freya',
  'Leila',
  'Jada',
  'Nora',
  'Willow',
  'Piper',
  'Stella',
  'Tess',
  'Anya',
  'Mei',
  'Cora',
  'Bella',
  'Dana',
  'Elsa',
];
export const RIVAL_BOY_NAMES = [
  'Leo',
  'Ben',
  'Max',
  'Omar',
  'Finn',
  'Jack',
  'Theo',
  'Eli',
  'Diego',
  'Owen',
  'Luca',
  'Noah',
  'Cole',
  'Andre',
  'Bao',
  'Dev',
  'Felix',
  'Hank',
  'Liam',
  'Mateo',
  'Jonah',
  'Ravi',
  'Hugo',
  'Ezra',
  'Milo',
  'Arlo',
  'Jasper',
  'Kofi',
  'Tomas',
  'Wes',
  'Zane',
  'Ian',
  'Nico',
  'Oscar',
  'Pablo',
  'Yusuf',
  'Rafa',
  'Bruno',
  'Dean',
  'Gus',
];
export const RIVAL_NAME_POOL = [...RIVAL_GIRL_NAMES, ...RIVAL_BOY_NAMES];

export interface RivalId {
  name: string;
  girl: boolean;
}

/** `count` different rivals; each is a girl or a boy by `random` and has a name of that kind. */
export function pickRivals(random: () => number, count = RIVAL_FACTORS.length): RivalId[] {
  const shuffled = (list: readonly string[]): string[] => {
    const pool = [...list];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
  };
  const girls = shuffled(RIVAL_GIRL_NAMES);
  const boys = shuffled(RIVAL_BOY_NAMES);
  return Array.from({ length: count }, () => {
    const girl = random() < 0.5;
    return { name: (girl ? girls : boys).pop() as string, girl };
  });
}

/** `count` different names from the pool, chosen by `random`. */
export const pickRivalNames = (random: () => number, count = RIVAL_FACTORS.length): string[] =>
  pickRivals(random, count).map((r) => r.name);
/** Each rival's speed wobbles ±SURGE with a sine of its own period and phase, so places swap. */
export const SURGE = 0.08;
export const SURGE_PERIOD: [number, number] = [6, 10]; // s, random per rival per heat
/** A rival's reaction at GO, random in this range (s). */
export const REACTION: [number, number] = [0.15, 0.45];

/** A rival's metres a second `t` seconds after its reaction (the caller holds it still before). */
export function rivalSpeed(factor: number, t: number, period: number, phase: number): number {
  return RACE_SPEED * factor * (1 + SURGE * Math.sin((2 * Math.PI * t) / period + phase));
}

/** The lane (1 to 10) of each rival, shuffled by `random`; the player is always in lane 5. */
export const PLAYER_LANE = 5;
export function shuffleLanes(random: () => number): number[] {
  const lanes = [1, 2, 3, 4, 6, 7, 8, 9, 10];
  for (let i = lanes.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
  }
  return lanes;
}

// ---------- The player's speed ----------

/** How much each new gap between right keys moves the rate. */
export const RATE_SMOOTH = 0.35;
export const MIN_GAP = 0.08; // s, a gap shorter than this counts as this

/**
 * The rate (keys a second) after a right key `gap` s after the last right key (or after GO for
 * the first). The very first key sets the rate outright, so a slow typist is not held back by
 * the smoothing from nothing.
 */
export function nextRate(rate: number, gap: number): number {
  const now = 1 / Math.max(gap, MIN_GAP);
  return rate <= 0 ? now : rate + (now - rate) * RATE_SMOOTH;
}

/** The rate shown and used now: drops when no right key comes for longer than the usual gap. */
export function liveRate(rate: number, sinceLast: number): number {
  return rate > 0 && sinceLast > 1 / rate ? Math.min(rate, 1 / sinceLast) : rate;
}

export const MAX_SPEED_FACTOR = 2.5;

/** Metres a second the runner aims for at `kps` keys a second in heat `heat`. */
export function targetSpeed(kps: number, heat: number): number {
  return RACE_SPEED * Math.min(MAX_SPEED_FACTOR, (Math.max(kps, 0) * 12) / heatWpm(heat));
}

/** Seconds to close most of the gap to the target speed (speed += (target - speed) * min(1, dt / ACCEL_SECONDS)). */
export const ACCEL_SECONDS = 0.5;

/** One step of easing the speed towards its target. */
export function easeSpeed(speed: number, target: number, dt: number): number {
  return speed + (target - speed) * Math.min(1, dt / ACCEL_SECONDS);
}

/** Words a minute shown for a rate in keys a second. */
export const wpmOf = (rate: number): number => Math.round(rate * 12);

// ---------- The words a minute on the HUD ----------

/** The HUD's words a minute count the right keys of the last this many seconds. */
export const WPM_WINDOW = 10;
/** Until this many seconds have passed since the first right key, it is counted over this span. */
export const WPM_MIN_SPAN = 3;
/** Seconds the shown number takes to close most of the gap to the sustained one. */
export const WPM_EASE_SECONDS = 0.6;

/**
 * Sustained words a minute: the right keys typed in the last `WPM_WINDOW` s (of `rightTimes`, race
 * seconds) over that span, or over the time since the first right key `firstAt` while that is
 * shorter (never under `WPM_MIN_SPAN`). Pauses and face-plants count as time, so it falls when
 * the player stops. 0 before the first right key.
 */
export function sustainedWpm(
  rightTimes: readonly number[],
  firstAt: number | null,
  now: number,
): number {
  if (firstAt === null) return 0;
  const from = now - WPM_WINDOW;
  const keys = rightTimes.filter((at) => at > from && at <= now).length;
  const span = Math.max(WPM_MIN_SPAN, Math.min(WPM_WINDOW, now - firstAt));
  return wpm(keys, span);
}

/** One step of easing the shown words a minute towards the sustained one. */
export function easeWpm(shown: number, target: number, dt: number): number {
  return shown + (target - shown) * Math.min(1, dt / WPM_EASE_SECONDS);
}

// ---------- Mistakes ----------

export type Stride =
  | { kind: 'run' }
  | { kind: 'stumble'; t: number } // t counts up
  | { kind: 'down'; t: number };
export const STUMBLE_SECONDS = 0.5;
/** Speed is multiplied by this while stumbling. */
export const STUMBLE_SPEED = 0.3;
/** Each wrong key also multiplies the rate by this. */
export const MISS_RATE = 0.85;
export const FACEPLANT_MISSES = 5;
export const FACEPLANT_SECONDS = 2.0; // the last GETUP_SECONDS of it is the get-up
export const GETUP_SECONDS = 0.4;
/** After getting up, the rate is multiplied by this. */
export const GETUP_RATE = 0.5;

/** `missesInRow` counts this miss: 5 or more is a face-plant, else a stumble that restarts. */
export function onMiss(_stride: Stride, missesInRow: number): Stride {
  return missesInRow >= FACEPLANT_MISSES ? { kind: 'down', t: 0 } : { kind: 'stumble', t: 0 };
}

/** Stumbles and face-plants end back to running. */
export function stepStride(stride: Stride, dt: number): Stride {
  if (stride.kind === 'run') return stride;
  const t = stride.t + dt;
  const length = stride.kind === 'stumble' ? STUMBLE_SECONDS : FACEPLANT_SECONDS;
  return t >= length ? { kind: 'run' } : { kind: stride.kind, t };
}

export function strideSpeedFactor(stride: Stride): number {
  return stride.kind === 'run' ? 1 : stride.kind === 'stumble' ? STUMBLE_SPEED : 0;
}

// ---------- Places ----------

export interface RunnerMark {
  metres: number;
  /** Race seconds at which the runner crossed the line, or null. */
  finishedAt: number | null;
}

/** 1 + the runners ahead: finished earlier, or (both running) further on. Ties go to the player. */
export function placeOf(player: RunnerMark, rivals: readonly RunnerMark[]): number {
  let ahead = 0;
  for (const r of rivals) {
    if (r.finishedAt !== null) {
      if (player.finishedAt === null || r.finishedAt < player.finishedAt) ahead++;
    } else if (player.finishedAt === null && r.metres > player.metres) ahead++;
  }
  return 1 + ahead;
}

/** Seconds after the 3rd rival finishes, while the player hasn't, before the heat ends anyway. */
export const OUT_GRACE = 3;

/** The heat ends when the player finishes, or 3 rivals are home and the grace has passed. */
export function heatOver(player: RunnerMark, rivals: readonly RunnerMark[], now: number): boolean {
  if (player.finishedAt !== null) return true;
  const times = rivals
    .map((r) => r.finishedAt)
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);
  return times.length >= 3 && now >= times[2] + OUT_GRACE;
}

export const goesOn = (place: number): boolean => place <= 3;

export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const last = n % 10;
  const suffix = teen ? 'th' : last === 1 ? 'st' : last === 2 ? 'nd' : last === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

export const MEDALS = ['🥇', '🥈', '🥉'];

// ---------- Points and blocks ----------

export const KEY_POINTS = 1;
export const PLACE_POINTS = [300, 200, 100];
export const keyPoints = (level: number): number => KEY_POINTS * multiplier(level);
export const placePoints = (place: number, heat: number, level: number): number =>
  (PLACE_POINTS[place - 1] ?? 0) * heat * multiplier(level);

export const BLOCK_KEYS_RACE = 8;

// ---------- Speed levels and blocks ----------

/** A block with no mistakes is Perfect. */
export const blockOutcome = (mistakes: number): 'perfect' | 'mistakes' =>
  mistakes === 0 ? 'perfect' : 'mistakes';

/** One finished block: how many keys, how many were wrong first time, and the seconds from first key to last. */
export interface BlockResult {
  keys: number;
  mistakes: number;
  seconds: number;
}

/** The share of keys right first time, 1 for an empty block. */
export function accuracy(result: Pick<BlockResult, 'keys' | 'mistakes'>): number {
  return result.keys > 0 ? (result.keys - result.mistakes) / result.keys : 1;
}

/** A speed level's block counts when it reaches the goal words a minute with at least 90% right. */
export function speedBlockPasses(level: number, result: BlockResult): boolean {
  const goal = levelOf(level).wpm;
  if (goal === undefined || result.seconds <= 0) return false;
  return wpm(result.keys, result.seconds) >= goal && accuracy(result) >= SPEED_ACCURACY;
}

/** The streak of passing blocks in a row on a speed level after one more block. */
export function speedStreak(streak: number, level: number, result: BlockResult | null): number {
  return result && speedBlockPasses(level, result) ? streak + 1 : 0;
}

// ---------- The run's stats ----------

export interface RunStats {
  /** Keys typed (right first time or not, once per position) and how many were right first time. */
  keys: number;
  right: number;
  /** The heat reached (the last one played). */
  heats: number;
  /** Heats finished 1st, 2nd and 3rd. */
  medals: [number, number, number];
  /** The highest speed held across a whole finished block, in words a minute. */
  bestWpm: number;
}

export const emptyStats = (): RunStats => ({
  keys: 0,
  right: 0,
  heats: 0,
  medals: [0, 0, 0],
  bestWpm: 0,
});

/** 'You came 5th in heat 4 · 2 🥇 1 🥈 · Top speed 14 words a minute · 92% right · Level 6 opened!' */
export function resultsText(stats: RunStats, lastPlace: number, opened: readonly number[]): string {
  const parts: string[] = [];
  if (lastPlace > 0 && stats.heats > 0) {
    parts.push(`You came ${ordinal(lastPlace)} in heat ${stats.heats}`);
  }
  const medals = stats.medals
    .map((n, i) => (n > 0 ? `${n} ${MEDALS[i]}` : ''))
    .filter(Boolean)
    .join(' ');
  if (medals) parts.push(medals);
  const speed = Math.round(stats.bestWpm);
  if (speed > 0) parts.push(`Top speed ${speed} words a minute`);
  if (stats.keys > 0) parts.push(`${Math.round((100 * stats.right) / stats.keys)}% right`);
  if (opened.length === 1) parts.push(`Level ${opened[0]} opened!`);
  else if (opened.length > 1) {
    parts.push(`Levels ${opened[0]} to ${opened[opened.length - 1]} opened!`);
  }
  return parts.join(' · ');
}
