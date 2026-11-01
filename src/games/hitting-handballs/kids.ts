import { Group, type Mesh } from 'three';
import { createDizzyStars } from './effects';
import {
  cheer,
  dance,
  readyFrame,
  runFrame,
  slump,
  type KidFrame,
  type Limb,
  type Move,
} from './moves';
import { createPerson, neutralPose, type Person, type PersonStyle, type Pose } from './person';
import type { PairId } from './rules';
import { CONTACT_Y, type Vec } from './shots';

/** Our kids: you, then Sam. Both in blue shirts. */
export const US_LOOKS: readonly [PersonStyle, PersonStyle] = [
  { shirt: 0x2f7de1, pants: 0x1d2f6b, hat: 'none', hair: 0x5a3416 },
  { shirt: 0x2f7de1, pants: 0xc2b280, hat: 'headband', hatColor: 0xffd23f, hair: 0xe0a64a },
];

/** The look of each pair, kid 0 (front) then kid 1. */
export const PAIR_LOOKS: Record<PairId, readonly [PersonStyle, PersonStyle]> = {
  kinder: [
    { shirt: 0xffd23f, pants: 0x2f6bd0, hat: 'none', scale: 0.8, hair: 0xd8a24a },
    { shirt: 0xffd23f, pants: 0x2f6bd0, hat: 'none', scale: 0.8, hair: 0xd8a24a },
  ],
  hopscotch: [
    { shirt: 0xff7eb6, pants: 0x7b4fb8, hat: 'party', hatColor: 0xff7eb6, hair: 0x3a2412 },
    { shirt: 0xff7eb6, pants: 0x7b4fb8, hat: 'none', hair: 0x8a4a1e },
  ],
  lunch: [
    { shirt: 0x5cb85c, pants: 0x3d4a3d, hat: 'colander', scale: 1.1, hair: 0x2a1a10 },
    { shirt: 0x5cb85c, pants: 0x3d4a3d, hat: 'colander', scale: 1.1, hair: 0x6a3a1a },
  ],
  sneaker: [
    { shirt: 0xe63946, pants: 0xf4f4f4, hat: 'headband', hatColor: 0xffffff, shoe: 0xffffff },
    { shirt: 0xe63946, pants: 0xf4f4f4, hat: 'headband', hatColor: 0xffffff, shoe: 0xffffff },
  ],
  legends: [
    { shirt: 0x222222, pants: 0x333333, hat: 'none', cape: true, sunglasses: true, scale: 1.15 },
    { shirt: 0x222222, pants: 0x333333, hat: 'none', cape: true, sunglasses: true, scale: 1.15 },
  ],
};

/** Where each kid stands between hits (x, z). */
export const HOME = {
  us: [
    { x: -0.4, z: 0.6 },
    { x: 2.2, z: 0.6 },
  ],
  them: [
    { x: -1.4, z: -0.8 },
    { x: 1.2, z: -0.8 },
  ],
} as const;

/** Fastest a kid walks to the ball, metres a second. */
export const WALK_SPEED = 3;
/** How far in front of a kid (toward the wall) the ball is hit, for a scale-1 kid. */
const FRONT = 0.5;

export type KidMode = 'ready' | 'cheer' | 'dance' | 'slump';

export interface Kid {
  object: Group;
  person: Person;
  readonly home: { x: number; z: number };
  readonly x: number;
  /** Size next to a plain kid (1). */
  readonly scale: number;
  /** Frees the geometry and materials when the kid is replaced. */
  dispose(): void;
  /** The crown on the head; `drop` lets it fall onto the head over 0.6 s. */
  setCrowned(crowned: boolean, drop?: boolean): void;
  setMode(mode: KidMode): void;
  /** Starts walking to `x` (at most `WALK_SPEED`). */
  walkTo(x: number): void;
  /** Stands at `x` straight away. */
  placeAt(x: number): void;
  /** Plays a move from its start, replacing any in progress. */
  play(move: Move, total: number, onEnd?: () => void): void;
  /** Where the ball is hit when this kid stands at `spotX`. */
  contactPoint(spotX: number): Vec;
  /** World position of a point on the body, `height` as a fraction of a standing kid. */
  bodyPoint(height: number): Vec;
  update(delta: number, elapsed: number): void;
}

const MODES: Record<Exclude<KidMode, 'ready'>, Move> = { cheer, dance, slump };

function mergeLimb(into: Limb, from: Limb | undefined): void {
  if (from) {
    into.raise = from.raise;
    into.out = from.out;
    into.bend = from.bend;
  }
}

function mergeFrame(into: KidFrame, from: Partial<KidFrame>): void {
  into.lift = from.lift ?? into.lift;
  into.lean = from.lean ?? into.lean;
  into.twist = from.twist ?? into.twist;
  into.roll = from.roll ?? into.roll;
  into.headPitch = from.headPitch ?? into.headPitch;
  into.yaw = from.yaw ?? into.yaw;
  into.dizzy = from.dizzy ?? into.dizzy;
  mergeLimb(into.hit, from.hit);
  mergeLimb(into.off, from.off);
  mergeLimb(into.legA, from.legA);
  mergeLimb(into.legB, from.legB);
}

/** One kid on the court: faces the wall, walks to the ball, plays moves. */
export function createKid(home: { x: number; z: number }, style: PersonStyle): Kid {
  const person = createPerson(style);
  const object = new Group();
  object.add(person.root);
  object.position.set(home.x, 0, home.z);
  const dizzy = createDizzyStars();
  person.head.add(dizzy.object);

  const scale = style.scale ?? 1;
  let x = home.x;
  let goal = home.x;
  let faceYaw = -Math.PI / 2;
  let phase = 0;
  let mode: KidMode = 'ready';
  let modeStart = 0;
  let now = 0;
  let action: { move: Move; total: number; t: number; onEnd?: () => void } | null = null;
  const current = style;
  let drop = -1;
  const frame = readyFrame();
  const pose: Pose = neutralPose();

  const place = () => object.position.set(x, 0, home.z);

  return {
    object,
    person,
    home,
    get x() {
      return x;
    },
    get scale() {
      return scale;
    },
    dispose() {
      object.removeFromParent();
      object.traverse((o) => {
        const mesh = o as Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose();
      });
    },
    setCrowned(on, dropIt = false) {
      person.setHat(on ? 'crown' : (current.hat ?? 'none'), on ? 0xe02b2b : current.hatColor);
      drop = on && dropIt ? 0 : -1;
      if (drop < 0) person.hatSlot.position.y = 0;
    },
    setMode(next) {
      if (mode === next) return;
      mode = next;
      modeStart = now;
    },
    walkTo(target) {
      goal = target;
    },
    placeAt(at) {
      x = goal = at;
      place();
    },
    play(move, total, onEnd) {
      action = { move, total, t: 0, onEnd };
    },
    contactPoint(spotX) {
      return { x: spotX - FRONT * scale, y: CONTACT_Y * scale, z: home.z };
    },
    bodyPoint(height) {
      return { x, y: height * 1.45 * scale, z: home.z };
    },
    update(delta, elapsed) {
      now = elapsed;
      // Walk toward the goal, turning to face the way we go, and back to the wall on arrival.
      const gap = goal - x;
      const step = Math.min(Math.abs(gap), WALK_SPEED * delta);
      const moving = Math.abs(gap) > 0.02 && delta > 0;
      if (delta > 0 && step > 0) {
        x += Math.sign(gap) * step;
        phase += step * 6;
        place();
      }
      const wantYaw = moving ? Math.sign(gap) * (Math.PI / 2) : -Math.PI / 2;
      faceYaw += (wantYaw - faceYaw) * Math.min(1, delta * 14);

      Object.assign(frame, readyFrame());
      const bob = (Math.sin(elapsed * 3.4 + home.x) * 0.5 + 0.5) * 0.02;
      frame.lift = bob;
      if (moving) mergeFrame(frame, runFrame(phase, Math.min(1, step / (WALK_SPEED * delta || 1))));
      if (mode !== 'ready') mergeFrame(frame, MODES[mode](now - modeStart));
      if (action) {
        action.t += delta;
        mergeFrame(frame, action.move(Math.min(action.t, action.total)));
        if (action.t >= action.total) {
          const done = action.onEnd;
          action = null;
          done?.();
        }
      }

      pose.lift = frame.lift;
      pose.lean = frame.lean;
      pose.twist = frame.twist;
      pose.roll = frame.roll;
      pose.headPitch = frame.headPitch;
      pose.headYaw = 0;
      const copy = (to: Pose['armL'], from: Limb) => {
        to.raise = from.raise;
        to.out = from.out;
        to.bend = from.bend;
      };
      copy(pose.armL, frame.hit);
      copy(pose.armR, frame.off);
      copy(pose.legL, frame.legA);
      copy(pose.legR, frame.legB);
      person.apply(pose);
      object.rotation.y = faceYaw + frame.yaw;
      dizzy.setVisible(frame.dizzy);
      dizzy.update(elapsed);
      person.shadow.visible = frame.lift < 0.12;

      if (drop >= 0) {
        drop += delta;
        const k = Math.min(drop / 0.6, 1);
        const fall = k < 0.8 ? 1 - (k / 0.8) ** 2 : Math.sin(((k - 0.8) / 0.2) * Math.PI) * 0.05;
        person.hatSlot.position.y = fall * 1.2;
        if (k >= 1) {
          drop = -1;
          person.hatSlot.position.y = 0;
        }
      }
    },
  };
}
