/** A round is exactly this long, from "Eat!" to the buzzer. */
export const ROUND_SECONDS = 60;
/** The clock turns red and ticks when this many seconds or fewer are left. */
export const URGENT_SECONDS = 10;
/** A new question ignores taps for this long, so a double tap can't answer two questions. */
export const TAP_GUARD = 0.25;
/** Grapes in the bowl's bunch, and the count at which a fresh bunch replaces it. */
export const BUNCH_SIZE = 14;
export const REFILL_BELOW = 3;
/** Most eaten-grape skins drawn on the plate (the counter keeps counting). */
export const PLATE_MAX = 40;
/** Show a "N grapes!" pop every this many grapes. */
export const MILESTONE_EVERY = 10;

/** Seconds left on the round clock for `elapsed` seconds played; never below 0. */
export function secondsLeft(elapsed: number, total: number = ROUND_SECONDS): number {
  return Math.max(total - elapsed, 0);
}

/** The clock face: whole seconds, rounded up, "60" ... "1", "0". */
export function clockText(left: number): string {
  return String(Math.ceil(Math.max(left, 0)));
}

export function isUrgent(left: number): boolean {
  return left <= URGENT_SECONDS && left > 0;
}

/** The bunch after a grape is taken: one fewer, or a fresh BUNCH_SIZE when it would drop below REFILL_BELOW. */
export function bunchAfterTake(left: number): number {
  const next = left - 1;
  return next < REFILL_BELOW ? BUNCH_SIZE : next;
}

/** Plate skin `i` (0-based): offset from the plate centre in plate units (plate radius 1) and a layer height. */
export function plateSpot(i: number): { x: number; z: number; layer: number } {
  const angle = i * 2.399963;
  const radius = 0.11 * Math.sqrt(i + 1);
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, layer: Math.floor(i / 14) };
}

/** "You ate 1 grape!" / "You ate 23 grapes!" - shown on the results screen, never spoken. */
export function ateLine(grapes: number): string {
  return `You ate ${grapes} ${grapes === 1 ? 'grape' : 'grapes'}!`;
}

/** "10 grapes!" at every MILESTONE_EVERY-th grape, otherwise null. */
export function milestoneLine(grapes: number): string | null {
  return grapes > 0 && grapes % MILESTONE_EVERY === 0 ? `${grapes} grapes!` : null;
}

export type Gag =
  | 'forehead'
  | 'under-table'
  | 'dog'
  | 'face-splat'
  | 'air-chomp'
  | 'cheek'
  | 'hair'
  | 'juice';

export const GAGS: readonly Gag[] = [
  'forehead',
  'under-table',
  'dog',
  'face-splat',
  'air-chomp',
  'cheek',
  'hair',
  'juice',
];

/** Seconds each gag lasts: the answers stay locked this long. */
export const GAG_SECONDS: Record<Gag, number> = {
  forehead: 3.0,
  'under-table': 3.4,
  dog: 3.2,
  'face-splat': 3.0,
  'air-chomp': 2.8,
  cheek: 3.0,
  hair: 3.2,
  juice: 3.0,
};

/** A random gag, never `last` (when there is more than one gag). `random` is in [0, 1). */
export function pickGag(last: Gag | null, random: number): Gag {
  const pool = GAGS.length > 1 ? GAGS.filter((g) => g !== last) : GAGS;
  const index = Math.min(Math.max(Math.floor(random * pool.length), 0), pool.length - 1);
  return pool[index];
}
