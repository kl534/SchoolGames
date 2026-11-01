import {
  CanvasTexture,
  Group,
  MathUtils,
  NearestFilter,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three';
import { createDizzyStars } from './effects';
import { FINISH_AIM, STANCE_X, type FighterFrame, restFrame } from './moves';
import {
  createPerson,
  HIP_Y,
  neutralPose,
  resetPose,
  PERSON_SCALE,
  type HatStyle,
  type LimbPose,
  type Person,
  type Pose,
} from './person';
import type { RivalId, Side } from './rules';
import { createSword, type Sword } from './sword';

export interface FighterLook {
  shirt: number;
  pants: number;
  /** Red and white stripes on the shirt (the shirt colour is then ignored). */
  stripes?: boolean;
  hat: HatStyle;
  hatColor: number;
  cape?: boolean;
  eyepatch?: boolean;
  boxArmour?: boolean;
  scale: number;
  swordColor: number;
  /** Blade length in metres (default 0.9). */
  swordLength?: number;
  /** How bouncy the idle is next to the usual (1). */
  bounce?: number;
}

export const US_LOOK: FighterLook = {
  shirt: 0x2f6bff,
  pants: 0x1d3f99,
  hat: 'party',
  hatColor: 0x2f6bff,
  scale: 1,
  swordColor: 0x2ab0ff,
};

/** Rivals by id, per the table in the design: pup, knight, pirate, ninja, champion. */
export const RIVAL_LOOKS: Record<RivalId, FighterLook> = {
  pip: {
    shirt: 0xffd23f,
    pants: 0x8a5a33,
    hat: 'puppy',
    hatColor: 0x7a4b2a,
    scale: 0.85,
    swordColor: 0xff7eb6,
    bounce: 2,
  },
  sprinkles: {
    shirt: 0xe9eef5,
    pants: 0x3b5ba8,
    hat: 'colander',
    hatColor: 0xcfd6de,
    boxArmour: true,
    scale: 0.95,
    swordColor: 0xe63946,
  },
  cupcake: {
    shirt: 0xffffff,
    pants: 0x2b2b35,
    stripes: true,
    hat: 'pirate',
    hatColor: 0x17171c,
    eyepatch: true,
    scale: 1,
    swordColor: 0x9b4dca,
  },
  noodle: {
    shirt: 0x20202a,
    pants: 0x20202a,
    hat: 'headband',
    hatColor: 0xe02b2b,
    scale: 1,
    swordColor: 0x2ecc71,
    bounce: 1.5,
  },
  champion: {
    shirt: 0xffffff,
    pants: 0x6b1f9c,
    hat: 'crown',
    hatColor: 0xe02b2b,
    cape: true,
    scale: 1.15,
    swordColor: 0xffc928,
    swordLength: 1.26,
  },
};

export type FighterMode = 'idle' | 'dance' | 'victory' | 'kick';

export interface Fighter {
  object: Group;
  person: Person;
  sword: Sword;
  side: Side;
  /** World x of the stance spot. */
  readonly stanceX: number;
  /** +1 when facing +x (us), -1 when facing -x (the rival). */
  readonly facing: 1 | -1;
  /** Dresses the fighter (the rival of a rung, or us). */
  setLook(look: FighterLook): void;
  /** The crown on our head; `drop` lets it fall onto the head over 0.6 s. */
  setCrowned(crowned: boolean, drop?: boolean): void;
  /** What the fighter does between moves. */
  setMode(mode: FighterMode): void;
  /**
   * Puts a keyframe on the fighter. `aim` is how high the sword arm lunges (rad above straight
   * ahead). `pos` is the world position of the hip while flying (it replaces the stance).
   */
  setFrame(frame: FighterFrame, aim?: number, pos?: { x: number; y: number; z: number }): void;
  /** The sword touches the other fighter. */
  hit(): void;
  /** Height of the hip of this fighter now (metres). */
  hipHeight(): number;
  /** World position of a point on the body, `height` as a fraction of a standing fighter. */
  bodyPoint(height: number): { x: number; y: number; z: number };
  update(delta: number, elapsed: number): void;
}

/** A texture of red and white bars for the pirate's shirt. */
function stripeTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  const g = canvas.getContext('2d');
  if (g) {
    g.fillStyle = '#d7263d';
    g.fillRect(0, 0, 2, 1);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 1, 2, 1);
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(1, 4);
  texture.magFilter = NearestFilter;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

const limb = (p: LimbPose, raise: number, out: number, bend: number) => {
  p.raise = raise;
  p.out = out;
  p.bend = bend;
};

/** Rest guard of the sword arm: forearm angled up and forward, sword pointing at the rival. */
const GUARD_RAISE = 0.7;
const GUARD_BEND = 1.6;
const LUNGE_BEND = 0.15;

export function createFighter(side: Side, look: FighterLook = US_LOOK): Fighter {
  const facing = side === 'us' ? 1 : -1;
  const stanceX = facing * -STANCE_X;
  const person = createPerson({ shirt: look.shirt, pants: look.pants, hat: look.hat });
  const swordHand: 'R' | 'L' = side === 'us' ? 'R' : 'L';
  const sword = createSword(look.swordColor, look.swordLength);
  (swordHand === 'R' ? person.handR : person.handL).add(sword.object);

  // object (at the hip, rolls) > yaw (faces) > person (feet below the hip).
  const object = new Group();
  const yaw = new Group();
  object.add(yaw);
  yaw.add(person.root);
  const dizzy = createDizzyStars();
  person.head.add(dizzy.object);
  const stripes = stripeTexture();

  let current: FighterLook = look;
  let hipHeight = HIP_Y * PERSON_SCALE * look.scale;
  let frame = restFrame();
  let aim = 0;
  let pos: { x: number; y: number; z: number } | undefined;
  let mode: FighterMode = 'idle';
  let modeStart = 0;
  let now = 0;
  let crowned = false;
  /** Seconds the crown has been falling, or -1 when it is not. */
  let drop = -1;
  const pose: Pose = neutralPose();

  const setLook = (next: FighterLook) => {
    current = next;
    hipHeight = HIP_Y * PERSON_SCALE * next.scale;
    person.root.position.y = -hipHeight;
    person.materials.shirt.color.setHex(next.stripes ? 0xffffff : next.shirt);
    person.materials.shirt.map = next.stripes ? stripes : null;
    person.materials.shirt.needsUpdate = true;
    person.materials.pants.color.setHex(next.pants);
    if (!crowned) person.setHat(next.hat, next.hatColor);
    person.setCape(next.cape ?? false);
    person.setEyepatch(next.eyepatch ?? false);
    person.setBoxArmour(next.boxArmour ?? false);
    person.setScale(next.scale);
    sword.setColor(next.swordColor);
    sword.setLength(next.swordLength ?? 0.9);
  };
  setLook(look);

  const place = () => {
    if (pos) object.position.set(pos.x, pos.y, pos.z);
    else object.position.set(stanceX + facing * frame.dx, hipHeight + frame.y, 0);
  };

  /** The sword arm and the other arm for the guard, mixed towards the lunge by `lunge`. */
  const arms = (): { sword: LimbPose; other: LimbPose } => {
    const swordArm = swordHand === 'R' ? pose.armR : pose.armL;
    const otherArm = swordHand === 'R' ? pose.armL : pose.armR;
    return { sword: swordArm, other: otherArm };
  };

  const build = (elapsed: number) => {
    resetPose(pose);
    const t = elapsed;
    const a = arms();
    const bounce = current.bounce ?? 1;
    const wave = Math.sin(t * 2.2);
    const bob = (Math.sin(t * 3.4) * 0.5 + 0.5) * 0.025 * bounce;
    pose.lift = bob;
    // Legs: a gentle stance, one foot forward.
    limb(pose.legL, 0.22, 0.05, 0.25);
    limb(pose.legR, -0.18, 0.05, 0.15);
    // Guard.
    limb(a.sword, GUARD_RAISE + wave * 0.05, 0, GUARD_BEND);
    limb(a.other, 0.1, 0.55, 0.9);
    pose.lean = 0.08;

    if (mode === 'dance') {
      const k = t - modeStart;
      pose.twist = Math.sin(k * 9) * 0.5;
      pose.roll = Math.sin(k * 9) * 0.1;
      pose.lift = Math.abs(Math.sin(k * 4.5)) * 0.07;
      limb(a.sword, 1.5 + Math.sin(k * 7) * 0.7, 0.3, 0.4);
      limb(a.other, 1.0 + Math.sin(k * 7 + 2) * 0.5, 0.6, 0.6);
      limb(pose.legL, Math.sin(k * 9) * 0.5, 0.1, 0.35);
      limb(pose.legR, -Math.sin(k * 9) * 0.5, 0.1, 0.35);
    } else if (mode === 'victory') {
      const k = t - modeStart;
      pose.lift = Math.abs(Math.sin(k * 5)) * 0.14;
      pose.lean = -0.1;
      pose.headPitch = 0.2;
      limb(a.sword, 2.0, 0.25, 0.3);
      limb(a.other, 2.9, 0.4, 0.2);
      limb(pose.legL, 0.15, 0.2, 0.2);
      limb(pose.legR, -0.15, 0.2, 0.2);
    } else if (mode === 'kick') {
      const k = t - modeStart;
      const kick = Math.sin(k * Math.PI * 2 * 3);
      limb(pose.legL, 0.2 + kick * 0.6, 0.1, 0.3);
      limb(pose.legR, 0.2 - kick * 0.6, 0.1, 0.3);
      limb(a.sword, 0.4, 0.9, 0.4);
      limb(a.other, 0.4, 0.9, 0.4);
      pose.lift = 0;
      pose.lean = 0;
    } else if (frame.spin > 0 && pos) {
      // Flying: tucked, arms out.
      limb(pose.legL, 1.2, 0.15, 1.4);
      limb(pose.legR, 1.0, 0.15, 1.3);
      limb(a.sword, 1.2, 0.9, 0.3);
      limb(a.other, 1.2, 0.9, 0.3);
      pose.lift = 0;
    }

    // The lunge: the sword arm shoots out at the aimed height, the body leans in.
    const L = frame.lunge;
    if (L > 0) {
      const total = Math.PI / 2 + aim;
      a.sword.raise = MathUtils.lerp(a.sword.raise, total - LUNGE_BEND, L);
      a.sword.bend = MathUtils.lerp(a.sword.bend, LUNGE_BEND, L);
      a.sword.out = MathUtils.lerp(a.sword.out, 0, L);
      limb(
        a.other,
        MathUtils.lerp(a.other.raise, -0.5, L),
        0.6,
        MathUtils.lerp(a.other.bend, 0.3, L),
      );
      pose.lean += 0.3 * L;
      pose.twist += 0.35 * L * (swordHand === 'R' ? 1 : -1);
      pose.legL.raise = MathUtils.lerp(pose.legL.raise, 0.95, L);
      pose.legL.bend = MathUtils.lerp(pose.legL.bend, 0.45, L);
      pose.legR.raise = MathUtils.lerp(pose.legR.raise, -0.6, L);
      pose.legR.bend = MathUtils.lerp(pose.legR.bend, 0.05, L);
    }

    // Being hit: doubled over with hands on the belly, or leaning back.
    if (frame.fold > 0) {
      const f = Math.min(frame.fold, 1);
      pose.lean += f * 1.1;
      pose.headPitch -= f * 0.4;
      limb(
        a.sword,
        MathUtils.lerp(a.sword.raise, 0.7, f),
        0.1,
        MathUtils.lerp(a.sword.bend, 1.3, f),
      );
      limb(
        a.other,
        MathUtils.lerp(a.other.raise, 0.7, f),
        0.1,
        MathUtils.lerp(a.other.bend, 1.3, f),
      );
      pose.legL.bend += f * 0.5;
      pose.legR.bend += f * 0.5;
    } else if (frame.fold < 0) {
      pose.lean += frame.fold * 0.8;
      pose.headPitch -= frame.fold * 1.2;
      limb(a.other, 0.1 - frame.fold, 0.7, 0.9);
    }
    if (frame.handsBehind) {
      limb(pose.armL, -0.35, 0.12, 0.2);
      limb(pose.armR, -0.35, 0.12, 0.2);
    }
  };

  return {
    object,
    person,
    sword,
    side,
    stanceX,
    facing,
    setLook,
    setCrowned(on, dropIt = false) {
      crowned = on;
      person.setHat(on ? 'crown' : current.hat, on ? 0xe02b2b : current.hatColor);
      drop = on && dropIt ? 0 : -1;
      if (drop < 0) person.hatSlot.position.y = 0;
    },
    setMode(next) {
      if (mode === next) return;
      mode = next;
      modeStart = now;
    },
    setFrame(next, nextAim = FINISH_AIM, nextPos) {
      frame = next;
      aim = nextAim;
      pos = nextPos;
      place();
    },
    hit: () => sword.hit(),
    hipHeight: () => hipHeight,
    bodyPoint(height) {
      return {
        x: object.position.x,
        y: object.position.y - hipHeight + height * 1.45 * current.scale,
        z: object.position.z,
      };
    },
    update(delta, elapsed) {
      now = elapsed;
      build(elapsed);
      person.apply(pose);
      const swordArm = swordHand === 'R' ? pose.armR : pose.armL;
      sword.update(delta, swordArm.raise + swordArm.bend);
      place();
      // Facing, and the dodge that turns the back to the rival.
      yaw.rotation.y = facing * (Math.PI / 2) - facing * frame.turn;
      object.rotation.z = -frame.spin * facing;
      const sq = Math.max(frame.squash, 0.2);
      const s = PERSON_SCALE * current.scale;
      person.root.scale.set(s / Math.sqrt(sq), s * sq, s / Math.sqrt(sq));
      person.shadow.visible = !pos && frame.y < 0.12 && frame.spin === 0;
      person.setCrossEyes(frame.crossEyes);
      dizzy.setVisible(frame.dizzy);
      dizzy.update(elapsed);
      if (drop >= 0) {
        drop += delta;
        const k = Math.min(drop / 0.6, 1);
        // Falls with a small bounce at the end.
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
