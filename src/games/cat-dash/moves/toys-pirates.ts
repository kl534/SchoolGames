/**
 * The 6 obstacles of the toy store (toy-train, blocks, ball-pit) and the pirate ship (cannon,
 * rigging, chest), 24 moves. Numbers are obstacle-local: x = 0 is the entry line, the floor is
 * y = 0. Each cat path was drawn to fit the prop in `props/toys-pirates.ts`; the shared motions
 * (the train, the tower, the balls, the cannon, the sail, the rope, the lid) are exported for it.
 * The ball pit is flat too: the cat sinks in by moving behind the front balls, not below the floor.
 */
import type { ObstacleId } from '../places';
import type { Outcome, Variant } from '../rules';
import {
  EASE,
  TAU,
  clamp01,
  failEnd,
  runIn,
  type Move,
  type ObstacleMoves,
  type Seg,
} from './toolkit';

type ToysPiratesId = Extract<
  ObstacleId,
  'toy-train' | 'blocks' | 'ball-pit' | 'cannon' | 'rigging' | 'chest'
>;

const smooth = (u: number) => EASE.io(clamp01(u));
const mk = (segs: Seg[], events: Move['events']): Move => ({ segs, events });

// ---------- Shared motions (the props use these too) ----------

/** x of the centre of the caboose (the car at the back of the train). */
export const TRAIN_X = 5.2;
export function trainX(outcome: Outcome | null, variant: Variant, t: number): number {
  if (outcome === 'clear' && variant === 0) return TRAIN_X + 1.0 * smooth((t - 0.7) / 0.8);
  if (outcome === 'fail' && variant === 0) return TRAIN_X - 8.4 * smooth((t - 0.3) / 1.0);
  if (outcome === 'fail') return TRAIN_X + 1.6 * smooth((t - 0.7) / 1.0);
  if (outcome === 'clear') return TRAIN_X;
  return TRAIN_X + 0.05 * Math.sin(t * 9);
}

/** The block staircase: column `i` is `(i + 1) * STEP` tall and stands at `TOWER_X + i * STAIR`. */
export const TOWER = { x: 3.8, stair: 0.65, step: 0.55, columns: 6 };
/** How far the tower has fallen over towards the cat (0 to 1, fail 0). */
export const towerTopple = (outcome: Outcome | null, variant: Variant, t: number) =>
  outcome === 'fail' && variant === 0 ? smooth((t - 0.75) / 0.5) : 0;
/** How far the top block has fallen (0 to 1, fail 1). */
export const topBlockFall = (outcome: Outcome | null, variant: Variant, t: number) =>
  outcome === 'fail' && variant === 1 ? smooth((t - 1.59) / 0.35) : 0;

/** Height of ball `i` above where it rests, in the ball pit. */
export function ballBounce(
  outcome: Outcome | null,
  variant: Variant,
  t: number,
  i: number,
): number {
  const ph = i * 1.9;
  if (outcome === null) return 0.04 * Math.max(0, Math.sin(t * 2 + ph)) ** 2;
  if (outcome === 'fail' && variant === 1) {
    // Popcorn: every ball hops, starting as the cat lands.
    const k = (t - 0.5 - (i % 5) * 0.04) * 2.2 + (i % 7) * 0.31;
    if (t < 0.5 || t > 1.9) return 0;
    return 0.9 * Math.abs(Math.sin(k * Math.PI));
  }
  if (outcome === 'fail') {
    // The balls near the cat part and slosh as it sinks and comes out.
    return t > 0.5 && t < 1.8 ? 0.12 * Math.abs(Math.sin(t * 6 + ph)) : 0;
  }
  return 0;
}
/** How squashed the big bouncy ball is (0 to 1, clear 0): the cat lands at 0.75 s. */
export const bigBallSquash = (outcome: Outcome | null, variant: Variant, t: number) =>
  outcome === 'clear' && variant === 0
    ? Math.max(0, Math.sin(clamp01((t - 0.7) / 0.35) * Math.PI))
    : 0;

/** The second the cannon fires in each move (null: it does not fire). */
export function cannonFireAt(outcome: Outcome, variant: Variant): number | null {
  if (outcome === 'clear') return variant === 0 ? 0.8 : null;
  return variant === 0 ? 1.15 : 1.05;
}
/** How far the cannon has kicked back along its barrel (units, 0 at rest). */
export function cannonRecoil(outcome: Outcome | null, variant: Variant, t: number): number {
  if (outcome === null) return 0;
  const at = cannonFireAt(outcome, variant);
  if (at === null || t < at) return 0;
  return 0.55 * Math.exp(-(t - at) * 5) * clamp01((t - at) / 0.04);
}

/** The sail hangs down-right from the yard; its flap (radians, positive lifts the far end). */
export function sailFlap(outcome: Outcome | null, variant: Variant, t: number): number {
  if (outcome === 'fail' && variant === 1) {
    return 0.9 * smooth((t - 1.2) / 0.2) * (0.6 + 0.4 * Math.cos(Math.max(0, t - 1.4) * 9));
  }
  return 0.04 * Math.sin(t * 1.8);
}
/** The hanging rope: top, length and its swing angle (forward is positive, like the vine). */
export const ROPE = { x: 6.2, top: 5.0, length: 2.6 };
export function ropeSwing(outcome: Outcome | null, variant: Variant, t: number): number {
  if (outcome === 'clear' && variant === 1) return -0.1 + 0.6 * smooth((t - 0.5) / 0.7);
  return 0.12 * Math.sin(t * 2.2);
}

/** The chest's lid angle (radians, 0 shut, about 1.8 wide open). */
export function lidAngle(outcome: Outcome | null, variant: Variant, t: number): number {
  if (outcome === null) return 0.9 + 0.9 * Math.sin(t * 1.4);
  if (outcome === 'clear' && variant === 0) return 0.8 * (1 - smooth(t / 0.3));
  if (outcome === 'clear') return 0.8 + 1.0 * smooth((t - 0.2) / 0.3);
  if (variant === 0) return 1.8 * (1 - smooth((t - 0.95) / 0.12));
  return 1.8 * (1 - smooth((t - 1.9) / 0.3) * 0.6);
}
/** Progress (0 to 1) of the gold coins thrown out of the chest, or -1 when there are none. */
export function coinSpray(outcome: Outcome | null, variant: Variant, t: number): number {
  const [start, life] =
    outcome === 'clear' && variant === 1
      ? [0.5, 1.0]
      : outcome === 'fail' && variant === 1
        ? [1.35, 0.8]
        : [0, 0];
  if (life === 0 || t < start || t > start + life) return -1;
  return (t - start) / life;
}

const clearEvents = (wordX: number, landX: number): Move['events'] => [
  [0.35, 'sfx:whoosh', 2.6, 0.4],
  [0.8, 'word', wordX, 3.6],
  [1.2, 'sparkle', wordX, 3.0],
  [1.4, 'dust', landX, 0.1],
];
const failEvents = (x: number, y: number, extra: Move['events'] = []): Move['events'] => [
  [0.6, 'sfx:squeak', x, y],
  [0.85, 'bonk', x, y],
  [1.0, 'stars', x, y + 0.6],
  [1.8, 'sfx:boing', x + 1, 1],
  ...extra,
];

/** The stairs of the block tower: one hop up each column. */
const stairs = (d: number): Seg[] =>
  Array.from({ length: TOWER.columns }, (_, i): Seg => {
    const h = (i + 1) * TOWER.step;
    return [d, TOWER.x + i * TOWER.stair, h, 'leap', { peak: h + 0.7 }];
  });
const TOP_X = TOWER.x + (TOWER.columns - 1) * TOWER.stair;
const TOP_Y = TOWER.columns * TOWER.step;

export const TOYS_PIRATES_MOVES: Record<ToysPiratesId, ObstacleMoves> = {
  // ---------- Toy store ----------
  'toy-train': {
    spec: { length: 12, height: 2.4, floorY: 0 },
    words: ['CHOO CHOO!', 'LEAP!'],
    clear: [
      // Hop on the caboose, ride the roofs while it rolls, hop off the front.
      mk(
        [
          runIn(),
          [0.15, 3.4, 0, 'crouch'],
          [0.4, 5.25, 0.95, 'leap', { peak: 2.2 }],
          [0.5, 8.64, 0.95, 'balance'],
          [0.4, 11.6, 0, 'leap', { peak: 2.2, spin: -TAU }],
          [0.3, 12, 0, 'run'],
        ],
        [
          [0.35, 'sfx:whoosh', 2.6, 0.4],
          [0.8, 'sfx:horn', 5.2, 1.4],
          [1.0, 'word', 7, 3.2],
          [1.2, 'sparkle', 8.6, 1.6],
          [1.75, 'dust', 11.6, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.15, 3.0, 0, 'crouch'],
          [0.9, 11.2, 0, 'leap', { peak: 3.4, spin: -TAU }],
          [0.4, 12, 0, 'run'],
        ],
        clearEvents(7, 11.2),
      ),
    ],
    fail: [
      // The train backs over the cat: squashed flat, then it pops back up.
      mk(
        [
          runIn(),
          [0.3, 3.6, 0, 'run', { face: 'wide' }],
          [0.2, 3.6, 0, 'splat', { sx: 1.5, sy: 0.25, face: 'wide' }],
          [0.5, 3.6, 0, 'splat', { sx: 1.5, sy: 0.25, face: 'dizzy' }],
          [0.3, 3.6, 0, 'dizzy', { face: 'dizzy' }],
          [0.6, 8.0, 0, 'leap', { peak: 1.4 }],
          ...failEnd(12),
        ],
        [
          [0.4, 'sfx:horn', 6, 1.4],
          [0.6, 'sfx:squeak', 3.6, 0.8],
          [0.9, 'bonk', 3.6, 0.8],
          [1.05, 'stars', 3.6, 1.2],
          [1.25, 'dust', 3.6, 0.1],
          [2.0, 'sfx:boing', 8, 1],
        ],
      ),
      // Hops on, rides round, dizzy, tumbles off the front.
      mk(
        [
          runIn(),
          [0.1, 3.4, 0, 'crouch'],
          [0.35, 5.25, 0.95, 'leap', { peak: 2.2 }],
          [0.5, 8.2, 0.95, 'flail', { spin: TAU, face: 'dizzy' }],
          [0.4, 9.4, 0.95, 'dizzy', { face: 'dizzy' }],
          [0.4, 11.4, 0, 'leap', { peak: 1.8, spin: TAU, face: 'wide' }],
          ...failEnd(12),
        ],
        failEvents(9.4, 1.4, [
          [0.75, 'sfx:horn', 6, 1.4],
          [1.0, 'sfx:thud', 6, 1.2],
        ]),
      ),
    ],
  },
  blocks: {
    spec: { length: 13, height: 3.4, floorY: 0 },
    words: ['HOP HOP!', 'SLIDE!'],
    clear: [
      mk(
        [
          runIn(),
          [0.1, 3.2, 0, 'crouch'],
          ...stairs(0.14),
          [0.45, 11.4, 0, 'leap', { peak: TOP_Y + 0.6, spin: -TAU }],
          [0.3, 13, 0, 'run'],
        ],
        [
          [0.35, 'sfx:whoosh', 2.6, 0.4],
          [0.75, 'word', TOP_X, TOP_Y + 1.6],
          [1.0, 'sparkle', TOP_X, TOP_Y + 0.4],
          [1.75, 'dust', 11.4, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.3, 5.0, 0, 'run'],
          [0.2, 6.6, 0, 'crouch'],
          [0.5, 10.6, 0, 'slide', { sy: 0.6 }],
          [0.3, 12.0, 0, 'leap', { peak: 0.6 }],
          [0.15, 13, 0, 'run'],
        ],
        clearEvents(9, 12),
      ),
    ],
    fail: [
      // The tower topples on the cat; buried, it pops out with a block on its head.
      mk(
        [
          runIn(),
          [0.2, 3.4, 0, 'run', { face: 'wide' }],
          [0.25, 4.4, 0, 'leap', { peak: 1.2 }],
          [0.3, 4.4, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'wide' }],
          [0.4, 4.4, 0, 'splat', { visible: false, hat: 'block' }],
          [0.45, 8.6, 0, 'leap', { peak: 2.2, visible: true, face: 'dizzy' }],
          [0.25, 9.2, 0, 'dizzy', { face: 'dizzy' }],
          ...failEnd(13, 0.45),
        ],
        [
          [0.5, 'sfx:squeak', 4.4, 1],
          [0.8, 'sfx:crash', 5.5, 1.5],
          [0.95, 'dust', 4.4, 0.3],
          [1.2, 'bonk', 4.6, 0.8],
          [1.35, 'stars', 4.6, 1.2],
          [1.8, 'sfx:boing', 9, 1],
        ],
      ),
      // Wobbles on top and falls with the top block.
      mk(
        [
          runIn(),
          [0.1, 3.2, 0, 'crouch'],
          ...stairs(0.14),
          [0.2, TOP_X, TOP_Y, 'balance', { spin: 0.4, face: 'wide' }],
          [0.2, TOP_X, TOP_Y, 'balance', { spin: -0.4 }],
          [0.35, 9.6, 0, 'flail', { spin: TAU, face: 'dizzy' }],
          [0.15, 9.6, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          ...failEnd(13),
        ],
        [
          [0.5, 'sfx:squeak', 5, 1],
          [1.6, 'sfx:crash', 9.5, 0.6],
          [1.9, 'bonk', 9.6, 0.8],
          [2.0, 'stars', 9.6, 1.4],
          [2.45, 'sfx:boing', 11, 1],
        ],
      ),
    ],
  },
  'ball-pit': {
    spec: { length: 11, height: 2.6, floorY: 0 },
    words: ['BOING!', 'ZOOM!'],
    clear: [
      mk(
        [
          runIn(),
          [0.15, 3.0, 0, 'crouch'],
          [0.35, 5.4, 1.5, 'leap', { peak: 2.4 }],
          [0.7, 9.8, 0, 'leap', { peak: 3.6, spin: -TAU }],
          [0.35, 11, 0, 'run'],
        ],
        [
          [0.35, 'sfx:whoosh', 2.6, 0.4],
          [0.75, 'sfx:boing', 5.4, 1.5],
          [0.9, 'word', 7, 3.6],
          [1.2, 'sparkle', 7, 3.0],
          [1.45, 'dust', 9.8, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.15, 3.2, 0, 'crouch'],
          [0.3, 4.4, 1.4, 'leap', { peak: 2.0 }],
          [0.22, 5.4, 1.4, 'leap', { peak: 1.9 }],
          [0.22, 6.4, 1.4, 'leap', { peak: 1.9 }],
          [0.22, 7.4, 1.4, 'leap', { peak: 1.9 }],
          [0.22, 8.4, 1.4, 'leap', { peak: 1.9 }],
          [0.3, 9.8, 0, 'leap', { peak: 1.9 }],
          [0.2, 11, 0, 'run'],
        ],
        [
          [0.35, 'sfx:whoosh', 2.6, 0.4],
          [0.75, 'sfx:boing', 5.4, 1.4],
          [0.9, 'word', 6.4, 3.4],
          [1.3, 'sparkle', 6.4, 2.6],
          [1.75, 'sfx:boing', 8.4, 1.4],
          [1.9, 'dust', 9.8, 0.1],
        ],
      ),
    ],
    fail: [
      // Sinks in until only the ears show, then pops out.
      mk(
        [
          runIn(),
          [0.3, 6.0, 1.4, 'leap', { peak: 2.2 }],
          [0.5, 6.0, 0.4, 'splat', { z: -0.5, sx: 1.1, sy: 0.9, face: 'wide' }],
          [0.6, 6.0, 0.4, 'dizzy', { z: -0.5, face: 'dizzy' }],
          [0.45, 9.0, 0, 'leap', { peak: 2.4, z: 0 }],
          ...failEnd(11, 0.3),
        ],
        [
          [0.5, 'sfx:squeak', 6, 1.6],
          [0.7, 'sfx:splat', 6, 1.2],
          [0.85, 'bonk', 6, 1.2],
          [1.0, 'stars', 6, 1.6],
          [1.65, 'poof', 6, 1.2, 0xff6f91],
          [1.9, 'sfx:boing', 9, 1],
        ],
      ),
      // The balls bounce it around like popcorn.
      mk(
        [
          runIn(),
          [0.3, 5.2, 1.4, 'leap', { peak: 2.0 }],
          [0.35, 6.4, 1.2, 'flail', { peak: 3.2, spin: TAU, face: 'wide' }],
          [0.35, 7.2, 1.2, 'flail', { peak: 3.4, spin: -TAU }],
          [0.35, 8.0, 1.4, 'flail', { peak: 3.0, spin: TAU, face: 'dizzy' }],
          [0.4, 9.4, 0, 'leap', { peak: 1.8 }],
          ...failEnd(11, 0.3),
        ],
        failEvents(6.4, 1.2, [
          [0.5, 'sfx:boing', 5.6, 1.4],
          [1.0, 'sfx:boing', 7.2, 1.4],
          [1.3, 'poof', 7.2, 2, 0x5aa9f0],
        ]),
      ),
    ],
  },

  // ---------- Pirate ship ----------
  cannon: {
    spec: { length: 12, height: 3.4, floorY: 0 },
    words: ['BOOM!', 'FLIP!'],
    clear: [
      // Leap the cannon just as it fires.
      mk(
        [
          runIn(),
          [0.15, 3.0, 0, 'crouch'],
          [0.85, 9.4, 0, 'leap', { peak: 4.0, spin: -TAU }],
          [0.45, 12, 0, 'run'],
        ],
        [
          [0.35, 'sfx:whoosh', 2.6, 0.4],
          [0.8, 'sfx:boom', 7, 2.5],
          [0.8, 'poof', 7.1, 2.5, 0xe6e6e6],
          [0.95, 'word', 6.5, 4.4],
          [1.2, 'sparkle', 6.5, 3.4],
          [1.25, 'dust', 9.4, 0.1],
        ],
      ),
      // Run up the barrel and flip off the end.
      mk(
        [
          runIn(),
          [0.15, 3.2, 0, 'crouch'],
          [0.3, 5.0, 1.2, 'leap', { peak: 2.0 }],
          [0.35, 6.9, 2.6, 'run', { spin: 0.45 }],
          [0.6, 9.6, 0, 'leap', { peak: 4.4, spin: -TAU - 0.45 }],
          [0.35, 12, 0, 'run'],
        ],
        [
          [0.35, 'sfx:whoosh', 2.6, 0.4],
          [1.0, 'word', 7.2, 4.0],
          [1.1, 'sparkle', 7.2, 3.2],
          [1.45, 'dust', 9.6, 0.1],
        ],
      ),
    ],
    fail: [
      // Peeks into the barrel: boom, a puff of smoke and a sooty coat.
      mk(
        [
          runIn(),
          [0.3, 5.0, 1.2, 'leap', { peak: 2.0 }],
          [0.35, 6.8, 2.6, 'run', { spin: 0.45 }],
          [0.25, 7.0, 2.6, 'climb', { face: 'wide' }],
          [0.3, 7.4, 2.9, 'splat', { sx: 1.2, sy: 0.7, coat: 'soot', face: 'dizzy', spin: -0.45 }],
          [0.3, 8.0, 0, 'flail', { peak: 3.2 }],
          [0.2, 8.0, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          [0.2, 8.0, 0, 'dizzy', { face: 'dizzy' }],
          ...failEnd(12),
        ],
        [
          [0.5, 'sfx:squeak', 5, 1.4],
          [1.15, 'sfx:boom', 7, 2.5],
          [1.15, 'poof', 7.1, 2.6, 0x2a2a2a],
          [1.2, 'bonk', 7.2, 2.8],
          [1.3, 'stars', 7.2, 3.4],
          [2.2, 'sfx:boing', 9, 1],
        ],
      ),
      // Shot out of the barrel into a coil of rope.
      mk(
        [
          runIn(),
          [0.3, 5.0, 1.2, 'leap', { peak: 2.0 }],
          [0.3, 6.4, 2.4, 'run', { spin: 0.45 }],
          [0.2, 6.9, 2.5, 'curl', { visible: false }],
          [0.65, 10.2, 0.2, 'flail', { peak: 4.4, spin: -TAU - 0.45, visible: true, face: 'wide' }],
          [0.3, 10.2, 0.2, 'dizzy', { face: 'dizzy' }],
          ...failEnd(12),
        ],
        [
          [0.5, 'sfx:squeak', 5, 1.4],
          [1.05, 'sfx:boom', 7, 2.5],
          [1.05, 'poof', 7.1, 2.5, 0x2a2a2a],
          [1.1, 'sfx:whoosh', 8, 3],
          [1.7, 'bonk', 10.2, 0.8],
          [1.8, 'stars', 10.2, 1.4],
          [2.3, 'sfx:boing', 11, 1],
        ],
      ),
    ],
  },
  rigging: {
    spec: { length: 12, height: 5.0, floorY: 0 },
    words: ['CLIMB!', 'SWING!'],
    clear: [
      // Climb the net, slide down the sail.
      mk(
        [
          runIn(),
          [0.1, 3.0, 0, 'crouch'],
          [0.3, 4.2, 0.8, 'leap', { peak: 1.8 }],
          [0.55, 6.3, 4.2, 'climb'],
          [0.45, 9.6, 1.3, 'slide', { spin: -0.7 }],
          [0.3, 11.0, 0, 'leap', { peak: 2.0, spin: 0.7 }],
          [0.15, 12, 0, 'run'],
        ],
        [
          [0.35, 'sfx:whoosh', 2.6, 0.4],
          [0.9, 'word', 6.3, 4.8],
          [1.0, 'sparkle', 6.3, 4.4],
          [1.4, 'sfx:whoosh', 8, 3],
          [1.95, 'dust', 11, 0.1],
        ],
      ),
      // Swing across on the hanging rope.
      mk(
        [
          runIn(),
          [0.1, 2.8, 0, 'crouch'],
          [0.5, 6.0, 2.4, 'leap', { peak: 3.2 }],
          [0.35, 6.2, 2.2, 'climb'],
          [0.5, 9.6, 0, 'leap', { peak: 3.6 }],
          [0.35, 12, 0, 'run'],
        ],
        clearEvents(6.2, 9.6),
      ),
    ],
    fail: [
      // Tangled in the net, dangles, drops.
      mk(
        [
          runIn(),
          [0.3, 4.4, 1.4, 'leap', { peak: 2.0 }],
          [0.4, 5.0, 2.6, 'climb', { face: 'wide' }],
          [0.4, 5.2, 2.3, 'hang', { face: 'wide' }],
          [0.3, 5.4, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          [0.2, 5.4, 0, 'dizzy', { face: 'dizzy' }],
          [0.45, 9.0, 0, 'leap', { peak: 1.4 }],
          ...failEnd(12, 0.3, 0.25),
        ],
        [
          [0.5, 'sfx:squeak', 4.6, 1.8],
          [1.0, 'sfx:squeak', 5.2, 2.3],
          [1.45, 'sfx:thud', 5.4, 0.2],
          [1.55, 'bonk', 5.4, 0.8],
          [1.7, 'stars', 5.4, 1.4],
          [2.1, 'sfx:boing', 8, 1],
        ],
      ),
      // The sail flaps and sweeps it off.
      mk(
        [
          runIn(),
          [0.3, 4.4, 1.4, 'leap', { peak: 2.0 }],
          [0.4, 6.3, 4.2, 'climb'],
          [0.35, 7.6, 3.6, 'slide', { spin: -0.7, face: 'wide' }],
          [0.55, 10.2, 0, 'flail', { peak: 5.0, spin: TAU + 0.7, face: 'wide' }],
          [0.2, 10.2, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          [0.2, 10.2, 0, 'dizzy', { face: 'dizzy' }],
          ...failEnd(12, 0.3, 0.25),
        ],
        [
          [0.5, 'sfx:squeak', 5, 1.8],
          [1.3, 'sfx:whoosh', 8, 4],
          [1.95, 'bonk', 10.2, 0.8],
          [2.05, 'stars', 10.2, 1.4],
          [2.4, 'sfx:boing', 11, 1],
        ],
      ),
    ],
  },
  chest: {
    spec: { length: 12, height: 2.6, floorY: 0 },
    words: ['HOP!', 'SPARKLE!'],
    clear: [
      // Hop on the lid and over.
      mk(
        [
          runIn(),
          [0.15, 3.6, 0, 'crouch'],
          [0.3, 6.0, 1.4, 'leap', { peak: 2.4 }],
          [0.2, 6.8, 1.3, 'run'],
          [0.5, 9.0, 0, 'leap', { peak: 2.8, spin: -TAU }],
          [0.35, 12, 0, 'run'],
        ],
        [
          [0.2, 'sfx:crash', 6, 1],
          [0.35, 'sfx:whoosh', 2.6, 0.4],
          [0.8, 'word', 6.4, 3.4],
          [1.0, 'sparkle', 6.4, 2.4],
          [1.35, 'dust', 9, 0.1],
        ],
      ),
      // Leap through a spray of gold coins.
      mk(
        [
          runIn(),
          [0.15, 3.4, 0, 'crouch'],
          [0.95, 9.6, 0, 'leap', { peak: 3.4, spin: -TAU }],
          [0.45, 12, 0, 'run'],
        ],
        [
          [0.35, 'sfx:whoosh', 2.6, 0.4],
          [0.55, 'sfx:chime', 6, 1.4],
          [0.6, 'sparkle', 6, 1.6, 0xf2c230],
          [0.75, 'sparkle', 6, 2.6, 0xffe27a],
          [0.9, 'word', 6.2, 4.0],
          [1.0, 'sparkle', 6.4, 3.0, 0xf2c230],
          [1.3, 'dust', 9.6, 0.1],
        ],
      ),
    ],
    fail: [
      // The lid snaps shut on its tail and it rockets up.
      mk(
        [
          runIn(),
          [0.15, 3.6, 0, 'crouch'],
          [0.35, 6.4, 0.95, 'leap', { peak: 2.2 }],
          [0.3, 6.5, 0.95, 'balance', { face: 'wide' }],
          [0.3, 6.6, 0.95, 'splat', { sx: 1.2, sy: 0.8, face: 'wide' }],
          [0.6, 9.4, 0, 'flail', { peak: 3.5, spin: TAU, face: 'wide' }],
          [0.2, 9.4, 0, 'dizzy', { face: 'dizzy' }],
          ...failEnd(12),
        ],
        [
          [0.5, 'sfx:squeak', 5, 1.6],
          [1.0, 'sfx:crash', 6.8, 1.2],
          [1.05, 'bonk', 6.6, 1.2],
          [1.15, 'stars', 6.6, 1.8],
          [1.4, 'sfx:whoosh', 8, 3],
          [2.3, 'sfx:boing', 10, 1],
        ],
      ),
      // Falls in and pops out wearing a crown.
      mk(
        [
          runIn(),
          [0.15, 3.6, 0, 'crouch'],
          [0.35, 6.0, 0.9, 'leap', { peak: 2.4 }],
          [0.3, 6.0, 0.3, 'curl', { visible: false, z: -0.2 }],
          [0.35, 6.0, 0.3, 'curl', { visible: false, z: -0.2, hat: 'crown' }],
          [0.5, 8.4, 0, 'leap', { peak: 3.4, visible: true, z: 0, face: 'wide' }],
          ...failEnd(12),
        ],
        [
          [0.5, 'sfx:squeak', 5, 1.6],
          [0.9, 'sfx:thud', 6, 0.5],
          [0.95, 'bonk', 6, 0.8],
          [1.35, 'sfx:chime', 6, 1.4],
          [1.4, 'sparkle', 6.2, 1.4, 0xf2c230],
          [1.55, 'stars', 8.4, 3.4],
          [2.2, 'sfx:boing', 10, 1],
        ],
      ),
    ],
  },
};
