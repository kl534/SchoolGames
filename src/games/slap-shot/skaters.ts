import { BoxGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import type { Vec } from './geometry';
import { createAnimator, createPerson, type Person, type Pose } from './person';
import {
  HIT_FALL_SECONDS,
  SLAP_CONTACT,
  WRIST_CONTACT,
  spinYaw,
  type GoalieMove,
  type Move,
  type SkaterMove,
} from './plays';
import type { Team } from './teams';

export type Role = 'C' | 'W' | 'D';

/** The big number on the back of each role. */
export const ROLE_NUMBER: Record<Role | 'G', number> = { C: 19, W: 9, D: 4, G: 30 };

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);
const smooth = (x: number) => {
  const k = clamp(x, 0, 1);
  return k * k * (3 - 2 * k);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Strides a second at full speed, and the speed (m/s) that counts as full. */
const STRIDES_PER_SECOND = 1.6;
const FULL_SPEED = 9;

export interface Skater {
  root: Group;
  person: Person;
  /** Puts the player at a spot on the ice looking at a point; the turn is eased. */
  place(pos: Vec, face: Vec, delta: number): void;
  /** Poses the player for `move`, `t` seconds into it. */
  update(move: Move, t: number, delta: number, holding: boolean): void;
  /** Stops the turn easing, as after a cut to a new formation. */
  snap(): void;
  readonly size: number;
}

/** Both legs bent and apart as in a crouch of `c` model units (positive is lower). */
function crouch(p: Pose, c: number, spread = 0.12, lean = 0.2) {
  const theta = Math.acos(clamp(1 - c / 0.52, 0, 1));
  p.lift = -c;
  p.lean = lean;
  for (const leg of [p.legL, p.legR]) {
    leg.raise = theta;
    leg.bend = theta * 2;
  }
  p.legL.out = spread;
  p.legR.out = spread;
}

/** Holding the stick low with both hands in front. */
function stickLow(p: Pose) {
  p.armR.raise = 0.55;
  p.armR.bend = 0.9;
  p.armR.out = -0.08;
  p.armL.raise = 0.85;
  p.armL.bend = 0.7;
  p.armL.out = 0.25;
}

/** The pose for a skater who is skating: crouched and leaning, legs pushing out and back. */
function skating(p: Pose, phase: number, amount: number) {
  crouch(p, 0.09, 0.1, 0.22 + 0.2 * amount);
  stickLow(p);
  const s = Math.sin(phase);
  const push = (v: number) => Math.max(0, v) * amount;
  p.legL.raise -= 0.5 * push(s);
  p.legL.out += 0.4 * push(s);
  p.legR.raise -= 0.5 * push(-s);
  p.legR.out += 0.4 * push(-s);
  p.lift += Math.abs(Math.cos(phase)) * 0.02 * amount;
}

function skaterPose(move: SkaterMove, t: number, p: Pose, phase: number, amount: number) {
  skating(p, phase, amount);
  switch (move) {
    case 'glide':
    case 'stride':
      break;
    case 'carry':
      // Stickhandling: the stick swings ±0.15 m sideways at 1.5 Hz.
      p.twist = Math.sin(t * Math.PI * 2 * 1.5) * 0.25;
      break;
    case 'pass': {
      const k = smooth(t / 0.3);
      p.twist = lerp(-0.45, 0.5, k) * (t < 0.7 ? 1 : 0);
      p.armR.raise = lerp(0.4, 0.9, k);
      break;
    }
    case 'slap': {
      const wind = smooth(t / (SLAP_CONTACT - 0.05));
      const swing = smooth((t - (SLAP_CONTACT - 0.05)) / 0.1);
      const follow = smooth((t - 0.6) / 0.25);
      const w = wind * (1 - swing);
      p.armR.raise = lerp(0.55, 2.3, w) + swing * (1 - follow) * 0.3;
      p.armL.raise = lerp(0.85, 2.0, w) + swing * (1 - follow) * 0.2;
      p.armR.bend = lerp(0.9, 0.3, w);
      p.twist = lerp(-0.7 * wind, 0.7, swing) * (1 - follow);
      p.lean = 0.35 + 0.35 * swing * (1 - follow);
      break;
    }
    case 'wrist': {
      const k = smooth(t / WRIST_CONTACT);
      const follow = smooth((t - 0.6) / 0.25);
      p.twist = lerp(-0.6, 0.6, k) * (1 - follow);
      p.lean = 0.45;
      p.armR.raise = lerp(0.4, 1.0, k) * (1 - follow) + 0.55 * follow;
      break;
    }
    case 'deke': {
      const e = clamp(t / 0.6, 0, 1);
      if (e < 1) {
        p.roll = Math.sin(e * Math.PI * 3) * 0.45;
        p.twist = Math.sin(e * Math.PI * 3 + 1) * 0.5;
      }
      break;
    }
    case 'spin':
      p.lean = 0.2;
      p.armR.raise = 1.1;
      p.armL.raise = 1.1;
      p.armR.out = 0.6;
      p.armL.out = 0.6;
      break;
    case 'check': {
      const k = smooth(t / 0.25);
      const back = smooth((t - 0.5) / 0.3);
      p.lean = lerp(0.3, 0.85, k) * (1 - back) + 0.3 * back;
      p.armR.raise = lerp(0.55, 1.2, k) * (1 - back) + 0.55 * back;
      p.armR.out = lerp(-0.08, 1.0, k) * (1 - back);
      p.lift -= 0.04 * k;
      break;
    }
    case 'hit-fall': {
      // Down in 0.2 s, flat on the ice, then back up between 0.65 s and 0.9 s.
      const down = smooth(t / 0.2) * (1 - smooth((t - 0.65) / (HIT_FALL_SECONDS - 0.65)));
      p.roll = 1.31 * down;
      p.lift = lerp(p.lift, -0.05, down);
      p.armL.raise = lerp(p.armL.raise, 1.8, down);
      p.armL.out = lerp(p.armL.out, 1.0, down);
      p.armR.raise = lerp(p.armR.raise, 1.4, down);
      p.armR.out = lerp(p.armR.out, 1.2, down);
      p.headPitch = -0.4 * down;
      break;
    }
    case 'poke': {
      const k = smooth(t / 0.2);
      const back = smooth((t - 0.4) / 0.3);
      p.lean = lerp(0.35, 0.6, k) * (1 - back) + 0.35 * back;
      p.armR.raise = lerp(0.55, 1.5, k) * (1 - back) + 0.55 * back;
      p.armR.bend = lerp(0.9, 0.1, k) * (1 - back) + 0.9 * back;
      break;
    }
    case 'block': {
      const down = smooth(t / 0.2) * (1 - smooth((t - 0.7) / 0.2));
      crouch(p, lerp(0.09, 0.34, down), lerp(0.1, 0.5, down), 0.25);
      p.armR.out = lerp(-0.08, 0.9, down);
      p.armL.out = lerp(0.25, 0.9, down);
      p.armR.raise = lerp(0.55, 0.4, down);
      p.armL.raise = lerp(0.85, 0.4, down);
      break;
    }
    case 'faceoff': {
      crouch(p, 0.2, 0.2, 0.5);
      stickLow(p);
      const swipe = smooth(t / 0.15) * (1 - smooth((t - 0.3) / 0.3));
      p.twist = -0.3 + 0.0 * swipe;
      p.armR.raise = lerp(0.5, 0.8, swipe);
      break;
    }
    case 'celebrate': {
      const hop = Math.abs(Math.sin(t * 6)) * 0.07;
      p.lift = hop;
      p.lean = 0;
      const pump = Math.max(0, Math.sin(t * 6 - 0.4));
      p.armR.raise = lerp(2.4, 3.0, pump);
      p.armR.bend = 0.2;
      p.armR.out = 0.15;
      p.armL.raise = lerp(2.0, 2.8, 1 - pump);
      p.armL.bend = 0.3;
      p.armL.out = 0.3;
      p.legL.raise = p.legR.raise = 0.1;
      p.legL.bend = p.legR.bend = 0.2;
      break;
    }
    case 'slump':
      p.lean = 0.35;
      p.headPitch = -0.55;
      p.armR.raise = 0.1;
      p.armL.raise = 0.1;
      p.armR.bend = 0.2;
      p.armL.bend = 0.2;
      break;
  }
}

function goaliePose(move: GoalieMove, t: number, p: Pose) {
  // The stance: low, pads wide, blocker and glove out at the sides.
  crouch(p, 0.16, 0.28, 0.28);
  p.armR.raise = 0.35;
  p.armR.out = 0.55;
  p.armR.bend = 0.9;
  p.armL.raise = 0.35;
  p.armL.out = 0.6;
  p.armL.bend = 0.9;
  switch (move) {
    case 'ready':
      p.lift += Math.sin(t * 3) * 0.01;
      break;
    case 'glove-save': {
      const k = smooth(t / 0.25);
      p.armL.raise = lerp(0.35, 1.7, k);
      p.armL.out = lerp(0.6, 0.9, k);
      p.armL.bend = lerp(0.9, 0.2, k);
      p.lean = 0.35;
      break;
    }
    case 'pad-save': {
      const k = smooth(t / 0.2);
      p.legR.out = lerp(0.28, 1.0, k);
      p.legR.raise = lerp(p.legR.raise, 0.2, k);
      p.legR.bend = lerp(p.legR.bend, 0.2, k);
      p.roll = -0.2 * k;
      break;
    }
    case 'beaten': {
      // Too late: the dive starts after a beat.
      const k = smooth((t - 0.2) / 0.3);
      p.roll = 1.15 * k;
      p.lift = lerp(p.lift, -0.12, k);
      p.armL.raise = lerp(0.35, 2.4, k);
      p.armR.raise = lerp(0.35, 1.6, k);
      break;
    }
    case 'cover': {
      const k = smooth(t / 0.2);
      crouch(p, lerp(0.16, 0.3, k), 0.35, 0.5);
      p.armL.raise = 1.2;
      p.armR.raise = 1.2;
      p.armL.bend = 1.6;
      p.armR.bend = 1.6;
      p.armL.out = 0.1;
      p.armR.out = 0.1;
      break;
    }
  }
}

const padMaterial = new MeshStandardMaterial({ color: 0xf1f3f6, roughness: 0.6 });
const strapMaterial = new MeshStandardMaterial({ color: 0x20242b, roughness: 0.7 });

function box(w: number, h: number, d: number, material: MeshStandardMaterial, parent: Group) {
  const m = new Mesh(new BoxGeometry(w, h, d), material);
  parent.add(m);
  return m;
}

/** Bulky pads, a chest protector, a blocker and a glove, and a white mask. */
function dressGoalie(person: Person, team: Team) {
  const trim = new MeshStandardMaterial({ color: team.trim, roughness: 0.6 });
  for (const knee of [person.kneeL, person.kneeR]) {
    box(0.22, 0.4, 0.14, padMaterial, knee).position.set(0, -0.13, 0.04);
  }
  for (const hip of [person.hipL, person.hipR]) {
    box(0.2, 0.2, 0.13, padMaterial, hip).position.set(0, -0.12, 0.03);
  }
  box(0.42, 0.34, 0.26, padMaterial, person.torso).position.set(0, 0.2, 0.0);
  box(0.43, 0.05, 0.27, trim, person.torso).position.set(0, 0.28, 0.0);
  // The blocker (right) and the glove (left).
  box(0.14, 0.2, 0.06, strapMaterial, person.handR).position.set(0, -0.06, 0.05);
  box(0.2, 0.2, 0.1, padMaterial, person.handL).position.set(0, -0.06, 0.05);
  // The mask.
  const mask = new Mesh(new SphereGeometry(0.235, 18, 14), padMaterial);
  mask.scale.set(1, 1.05, 1);
  person.hat.add(mask);
  if (person.stick) person.stick.scale.set(1.4, 1, 1.5);
}

function build(team: Team, number: number, goalie: boolean): Skater {
  const person = createPerson({
    shirt: team.jersey,
    pants: team.trim,
    hatColor: goalie ? 0xf1f3f6 : team.trim,
    number,
  });
  if (goalie) {
    dressGoalie(person, team);
    person.root.scale.multiplyScalar(1.1);
  }
  const animator = createAnimator(person);
  const size = person.root.scale.x;
  let last: Move | null = null;
  let phase = Math.random() * 6;
  let speed = 0;
  let yaw = 0;
  let aimed = false;
  let spin = 0;
  const prev = { x: 0, z: 0, set: false };
  let clock = Math.random() * 20;

  const skater: Skater = {
    root: person.root,
    person,
    size,
    snap() {
      aimed = false;
      prev.set = false;
      speed = 0;
    },
    place(pos, face, delta) {
      person.root.position.set(pos.x, 0, pos.z);
      if (prev.set && delta > 0) {
        const v = Math.hypot(pos.x - prev.x, pos.z - prev.z) / delta;
        speed += (Math.min(v, 30) - speed) * (1 - Math.exp(-12 * delta));
      }
      prev.x = pos.x;
      prev.z = pos.z;
      prev.set = true;
      const dx = face.x - pos.x;
      const dz = face.z - pos.z;
      if (Math.hypot(dx, dz) > 1e-6) {
        const target = Math.atan2(dx, dz);
        if (!aimed) {
          yaw = target;
          aimed = true;
        } else {
          let d = target - yaw;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          yaw += d * (1 - Math.exp(-14 * delta));
        }
      }
      person.root.rotation.y = yaw + spin;
    },
    update(move, t, delta, holding) {
      clock += delta;
      if (move !== last) {
        animator.transition(0.12);
        last = move;
      }
      const amount = clamp(speed / 3, 0, 1);
      phase += Math.PI * 2 * STRIDES_PER_SECOND * clamp(speed / FULL_SPEED, 0, 1) * delta;
      const asked: Move = move === 'glide' && holding ? 'carry' : move;
      spin = spinYaw(asked, Math.max(t, 0));
      person.root.rotation.y = yaw + spin;
      animator.step(delta, (pose) => {
        if (
          asked === 'ready' ||
          asked === 'glove-save' ||
          asked === 'pad-save' ||
          asked === 'beaten' ||
          asked === 'cover'
        ) {
          goaliePose(asked, Math.max(t, 0), pose);
        } else {
          skaterPose(asked, Math.max(t, 0), pose, phase, amount);
        }
      });
      // Waiting on the ice, a skater sways side to side (drawing only).
      const idle = 1 - amount;
      person.body.position.x = (Math.sin(clock * 0.9) * 0.3 * idle) / size;
    },
  };
  return skater;
}

export function createSkater(team: Team, role: Role): Skater {
  return build(team, ROLE_NUMBER[role], false);
}

export function createGoalie(team: Team): Skater {
  return build(team, ROLE_NUMBER.G, true);
}
