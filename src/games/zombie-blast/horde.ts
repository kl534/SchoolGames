import { Vector3, type Object3D } from 'three';
import type { Effects } from './effects';
import { END_Z, LANES, laneX, spreadAt, SPAWN_Z } from './layout';
import { BOSS_PACE, closestIndex, MAX_ON_FIELD, pickLane } from './rules';
import { BRUTE_LOOK, createZombie, ZOMBIE_LOOKS, type Zombie } from './zombie';

/** Slots for bodies still lying on the grass or leaning over the barricade while others walk. */
const SPARE_SLOTS = 3;
/** Seconds a knocked-out zombie lies there before it poofs away (the boss lies a little longer). */
const BLAST_LINGER = 1.2;
const BOSS_BLAST_LINGER = 1.8;
/** Seconds a zombie leans over the barricade after smashing it, before it poofs away. */
const REACH_LINGER = 0.6;
/** Seconds a hit boss takes to stagger back. */
const KNOCK_TIME = 0.4;
/** Sideways wobble of a zombie within its lane, as a share of the lane width. */
const JITTER = 0.15;

export type SlotState = 'idle' | 'walking' | 'laughing' | 'blasted' | 'reached';

export interface Slot {
  readonly zombie: Zombie;
  readonly boss: boolean;
  lane: number;
  jitter: number;
  /** Depth along the walk: `SPAWN_Z` at the mist, `END_Z` at the barricade. */
  z: number;
  state: SlotState;
  /** Seconds in the current state. */
  timer: number;
  /** Counts up with each spawn, so the newest zombie in a lane can be found. */
  seq: number;
  knock: { from: number; to: number; t: number } | null;
}

export interface Horde {
  readonly slots: readonly Slot[];
  readonly boss: Slot;
  /** Regular zombies on the field that are still in play (walking, or laughing in place). */
  readonly walkingCount: number;
  /** Lane width at the barricade; set whenever the screen shape changes. */
  setLane(lane: number): void;
  /** Sends a regular zombie out of the mist, in the lane with the most room. */
  spawn(): Slot | null;
  /** Sends the boss out of the mist in the middle of the field. */
  spawnBoss(): Slot;
  /**
   * Moves everyone along; `speed` is the shared pace in world units per second. At 0 the walking
   * zombies stand still, mid-stride, instead of marching on the spot.
   */
  update(delta: number, speed: number): void;
  /** The walking zombie nearest the barricade, boss included. */
  closest(): Slot | null;
  /** Knocked out by a bomb: lies down, no longer targetable, poofs away shortly. */
  blast(slot: Slot): void;
  /** Stands still doubled up laughing (after a dud); `unlaugh` sets them all walking again. */
  laugh(slot: Slot): void;
  unlaugh(): void;
  /** Pushes a walking zombie back towards the mist. */
  knockBack(slot: Slot, distance: number): void;
  /** Called when a walking zombie gets to the barricade. */
  onReach(callback: (slot: Slot) => void): void;
  /** When set, zombies at the barricade stay there leaning over it instead of poofing away. */
  setLingering(lingering: boolean): void;
  /** Poofs away every knocked-out body at once. */
  clearBlasted(): void;
  /** Hides everyone. */
  clear(): void;
}

/**
 * The zombies on the field: a pool made up front (nothing is created mid-run), their walk along
 * the lanes, and what happens when one is blasted or reaches the barricade.
 */
export function createHorde(
  scene: Object3D,
  effects: Effects,
  random: () => number = Math.random,
): Horde {
  const make = (zombie: Zombie, boss: boolean): Slot => ({
    zombie,
    boss,
    lane: 0,
    jitter: 0,
    z: SPAWN_Z,
    state: 'idle',
    timer: 0,
    seq: 0,
    knock: null,
  });
  const regulars = Array.from({ length: MAX_ON_FIELD + SPARE_SLOTS }, (_, i) =>
    make(createZombie(ZOMBIE_LOOKS[i % ZOMBIE_LOOKS.length]), false),
  );
  const boss = make(createZombie(BRUTE_LOOK, { brute: true }), true);
  const slots = [...regulars, boss];
  for (const slot of slots) {
    slot.zombie.object.visible = false;
    scene.add(slot.zombie.object);
  }

  let laneWidth = 1;
  let spawned = 0;
  let lingering = false;
  let reach: (slot: Slot) => void = () => undefined;
  /** Reused for the spots handed to the effects. */
  const vec = new Vector3();

  const recycle = (slot: Slot, withPoof: boolean) => {
    if (withPoof) {
      const at = slot.zombie.object.position;
      effects.poof(vec.set(at.x, 0, at.z + (slot.boss ? 0.8 : 0.45)));
      if (slot.boss) {
        effects.poof(vec.set(at.x - 0.7, 1, at.z + 0.8));
        effects.poof(vec.set(at.x + 0.7, 1.6, at.z + 0.8));
      }
    }
    slot.state = 'idle';
    slot.zombie.object.visible = false;
  };

  const place = (slot: Slot) => {
    const x = slot.boss
      ? 0
      : laneX(slot.lane, slot.z, laneWidth) + slot.jitter * laneWidth * spreadAt(slot.z);
    slot.zombie.object.position.set(x, 0, slot.z);
  };

  const acquire = (): Slot | null => {
    const free = regulars.find((s) => s.state === 'idle');
    if (free) return free;
    // Out of spare bodies: the oldest one lying about goes now.
    const old = regulars
      .filter((s) => s.state === 'blasted' || (s.state === 'reached' && !lingering))
      .sort((a, b) => a.seq - b.seq)[0];
    if (!old) return null;
    recycle(old, true);
    return old;
  };

  const start = (slot: Slot) => {
    slot.state = 'walking';
    slot.timer = 0;
    slot.z = SPAWN_Z;
    slot.knock = null;
    slot.seq = ++spawned;
    slot.zombie.object.visible = true;
    slot.zombie.setMode('walk');
    place(slot);
  };

  return {
    slots,
    boss,
    get walkingCount() {
      return regulars.filter((s) => s.state === 'walking' || s.state === 'laughing').length;
    },
    setLane(lane) {
      laneWidth = lane;
    },
    spawn() {
      const slot = acquire();
      if (!slot) return null;
      const rear = Array.from({ length: LANES }, (_, lane) => {
        const mine = regulars
          .filter((s) => (s.state === 'walking' || s.state === 'laughing') && s.lane === lane)
          .sort((a, b) => b.seq - a.seq)[0];
        return mine ? mine.z : null;
      });
      slot.lane = pickLane(rear, random);
      slot.jitter = (random() * 2 - 1) * JITTER;
      slot.zombie.reset({ ...ZOMBIE_LOOKS[spawned % ZOMBIE_LOOKS.length], seed: random() * 6.3 });
      start(slot);
      return slot;
    },
    spawnBoss() {
      boss.zombie.reset();
      start(boss);
      return boss;
    },
    update(delta, speed) {
      for (const slot of slots) {
        if (slot.state === 'idle') continue;
        slot.timer += delta;
        if (slot.state === 'walking') {
          if (slot.knock) {
            const k = slot.knock;
            k.t += delta;
            const u = Math.min(k.t / KNOCK_TIME, 1);
            slot.z = k.from + (k.to - k.from) * (1 - (1 - u) ** 3);
            if (u >= 1) slot.knock = null;
          } else {
            slot.z += speed * (slot.boss ? BOSS_PACE : 1) * delta;
          }
          if (slot.z >= END_Z) {
            slot.z = END_Z;
            slot.state = 'reached';
            slot.timer = 0;
            slot.zombie.setMode('lean');
            reach(slot);
          }
        } else if (slot.state === 'blasted') {
          if (slot.timer >= (slot.boss ? BOSS_BLAST_LINGER : BLAST_LINGER)) recycle(slot, true);
        } else if (slot.state === 'reached') {
          if (!lingering && slot.timer >= REACH_LINGER) recycle(slot, true);
        }
        if ((slot.state as SlotState) !== 'idle') {
          place(slot);
          // At speed 0 the walkers hold their pose instead of marching on the spot.
          slot.zombie.update(delta, speed <= 0 && slot.state === 'walking');
        }
      }
    },
    closest() {
      const i = closestIndex(slots.map((s) => (s.state === 'walking' ? s.z : null)));
      return i < 0 ? null : slots[i];
    },
    blast(slot) {
      slot.state = 'blasted';
      slot.timer = 0;
      slot.knock = null;
      slot.zombie.setMode('blast');
    },
    laugh(slot) {
      if (slot.state !== 'walking') return;
      slot.state = 'laughing';
      slot.timer = 0;
      slot.zombie.setMode('laugh');
    },
    unlaugh() {
      for (const slot of slots) {
        if (slot.state !== 'laughing') continue;
        slot.state = 'walking';
        slot.zombie.setMode('walk');
      }
    },
    knockBack(slot, distance) {
      if (slot.state !== 'walking') return;
      slot.knock = { from: slot.z, to: Math.max(slot.z - distance, SPAWN_Z), t: 0 };
    },
    onReach(callback) {
      reach = callback;
    },
    setLingering(value) {
      lingering = value;
    },
    clearBlasted() {
      for (const slot of slots) if (slot.state === 'blasted') recycle(slot, true);
    },
    clear() {
      for (const slot of slots) recycle(slot, false);
    },
  };
}
