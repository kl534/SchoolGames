import {
  AdditiveBlending,
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  type Object3D,
} from 'three';
import { createActions, ready, type Actions } from './actions';
import type { FielderPose } from './choreo';
import {
  BALL_RADIUS,
  CONTACT,
  GLOVE,
  groundHeight,
  MOUND,
  MOUND_HEIGHT,
  POSITION_SPOTS,
  type Vec,
} from './flight';
import type { Position } from './rules';
import { createMover, type Mover } from './mover';
import { OUR_COLOURS, type Colours } from './teams';
import {
  clamp01,
  createAnimator,
  createPerson,
  easeInOut,
  neutralPose,
  easeOut,
  lerp,
  type Person,
  type Pose,
} from './person';

const NAVY = 0x1c2f6b;
/** Every player, ours or the rival's, wears the same pants; only shirt and cap tell teams apart. */
const TEAM_PANTS = 0xe6eaf2;

/** Seconds from the start of a swing to the bat meeting the ball. */
export const SWING_CONTACT = 0.3;

// ---------- The ball ----------

export interface Ball {
  /** Sits at the origin; its children move. */
  object: Group;
  /** Puts the ball (and its shadow on the ground) at a spot. */
  place(p: Vec, scale?: number): void;
  spin(delta: number, rate: number): void;
  setVisible(visible: boolean): void;
  /** A soft glow around the ball, so a long fly ball can be followed. */
  setGlow(on: boolean): void;
}

/** How much bigger than the ball its glow is drawn. */
const GLOW_SIZE = 2.2;

/** A soft yellow-white dot that fades to nothing at its edge; null where there is no canvas. */
function glowTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = Object.assign(document.createElement('canvas'), { width: 128, height: 128 });
  const g = canvas.getContext('2d');
  if (!g) return null;
  const fade = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  fade.addColorStop(0, 'rgba(255, 255, 235, 1)');
  fade.addColorStop(0.3, 'rgba(255, 238, 160, 0.7)');
  fade.addColorStop(0.65, 'rgba(255, 210, 90, 0.22)');
  fade.addColorStop(1, 'rgba(255, 200, 60, 0)');
  g.fillStyle = fade;
  g.fillRect(0, 0, 128, 128);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function createBall(): Ball {
  const object = new Group();
  const ball = new Group();
  const white = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 });
  const seam = new MeshStandardMaterial({ color: 0xd8262b, roughness: 0.6 });
  ball.add(new Mesh(new SphereGeometry(BALL_RADIUS, 20, 14), white));
  for (const side of [-1, 1]) {
    const arc = new Mesh(new TorusGeometry(BALL_RADIUS * 0.8, 0.012, 6, 20, Math.PI * 1.2), seam);
    arc.position.x = side * BALL_RADIUS * 0.58;
    arc.rotation.y = Math.PI / 2;
    arc.rotation.z = side * 0.4;
    ball.add(arc);
  }
  const shadow = new Mesh(
    new SphereGeometry(1, 14, 8),
    new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  shadow.scale.set(BALL_RADIUS * 1.3, 0.004, BALL_RADIUS * 1.3);
  object.add(ball, shadow);
  // The glow is a child of the ball, so it moves and grows with it.
  const map = glowTexture();
  const glow = map
    ? new Sprite(
        new SpriteMaterial({
          map,
          blending: AdditiveBlending,
          transparent: true,
          depthWrite: false,
          fog: false,
        }),
      )
    : null;
  if (glow) {
    glow.scale.setScalar(BALL_RADIUS * 2 * GLOW_SIZE);
    glow.visible = false;
    ball.add(glow);
  }
  return {
    object,
    place(p, scale = 1) {
      ball.position.set(p.x, p.y, p.z);
      ball.scale.setScalar(scale);
      const near = 1 / (1 + Math.max(p.y - BALL_RADIUS, 0) * 0.12);
      shadow.position.set(p.x, 0.02, p.z);
      shadow.scale.set(BALL_RADIUS * 1.4 * near * scale, 0.004, BALL_RADIUS * 1.4 * near * scale);
    },
    spin(delta, rate) {
      ball.rotation.x += delta * rate;
      ball.rotation.z += delta * rate * 0.4;
    },
    setVisible(visible) {
      object.visible = visible;
    },
    setGlow(on) {
      if (glow) glow.visible = on;
    },
  };
}

/** Something that falls and lies about, then goes away. */
export interface Prop {
  object: Object3D;
  /** Returns false once it should be removed. */
  update(delta: number): boolean;
}

// ---------- The bat ----------

function createBat(): Group {
  const bat = new Group();
  const wood = new MeshStandardMaterial({ color: 0xd9a35c, roughness: 0.55 });
  const barrel = new Mesh(new CylinderGeometry(0.058, 0.02, 0.86, 14), wood);
  barrel.position.y = 0.43;
  const knob = new Mesh(new SphereGeometry(0.03, 10, 8), wood);
  knob.position.y = -0.01;
  const tape = new Mesh(
    new CylinderGeometry(0.026, 0.024, 0.2, 10),
    new MeshStandardMaterial({ color: 0x222831, roughness: 0.9 }),
  );
  tape.position.y = 0.1;
  bat.add(barrel, knob, tape);
  return bat;
}

// ---------- Anyone in the field ----------

/** What the nine fielders share: they can run, act, face and go back to where they stand. */
export interface Actor {
  position: Position;
  mover: Mover;
  actions: Actions;
  /** Where he goes back to between plays. */
  home: Vec;
  setHome(spot: Vec): void;
  /** Runs to a spot; `face` keeps him looking at a point as he goes. */
  run(to: Vec, speed: number, face?: Vec, onArrive?: () => void): void;
  /** Starts an action (a catch, a throw, a dive) facing `toward`. */
  act(pose: FielderPose, opts?: { toward?: Vec; side?: -1 | 1 }): void;
  /** Turns to a spot. */
  faceTo(point: Vec): void;
  /** Jogs back to where he stands. */
  goHome(speed: number): void;
  /** True when standing at home. */
  atHome(): boolean;
  /** Puts on a team's colours. */
  setColours(colours: Colours): void;
}

// ---------- The pitcher ----------

const WIND_TIME = 0.7;
const THROW_RELEASE = 0.12;

export interface Pitcher extends Actor {
  root: Group;
  /** Rocks back and raises the front leg, then holds there. */
  windUp(): void;
  /** Throws; `onRelease` runs the moment the ball leaves the hand. */
  release(onRelease: () => void): void;
  /** Seconds the wind-up has been going. */
  readonly windTime: number;
  /** Back to standing ready. */
  reset(): void;
  /** Where the throwing hand is in the world. */
  handPosition(out: Vector3): Vector3;
  update(delta: number, elapsed: number): void;
}

export function createPitcher(): Pitcher {
  const person = createPerson({
    shirt: 0xf3f4f8,
    pants: TEAM_PANTS,
    hatColor: NAVY,
    hat: 'cap',
    glove: 'left',
    hair: 0x2b1a10,
    skin: 0xc68642,
  });
  const mover = createMover(person, { ground: groundHeight });
  mover.place(MOUND.x, MOUND.z);
  person.root.position.y = MOUND_HEIGHT;
  const actions = createActions(mover);
  let home: Vec = { ...MOUND };
  let mode: 'idle' | 'wind' | 'throw' | 'finish' = 'idle';
  let t = 0;
  let released = false;
  let onRelease: (() => void) | undefined;

  const idle = (pose: Pose, elapsed: number) => {
    const sway = Math.sin(elapsed * 1.8);
    pose.lean = 0.12;
    pose.headPitch = 0.1;
    pose.headYaw = Math.sin(elapsed * 0.7) * 0.08;
    for (const [arm, side] of [
      [pose.armL, 1],
      [pose.armR, -1],
    ] as const) {
      arm.raise = 0.8 + sway * 0.03;
      arm.bend = 1.35;
      arm.out = -0.25 * side * side;
    }
    pose.legL.out = pose.legR.out = 0.14;
    pose.legL.bend = pose.legR.bend = 0.15;
  };

  const windPose = (pose: Pose, w: number, elapsed: number) => {
    const k = easeInOut(w);
    const wobble = Math.sin(elapsed * 2.4) * 0.02 * k;
    pose.lean = lerp(0.12, -0.14, k) + wobble;
    pose.headPitch = lerp(0.1, 0.35, k);
    pose.armL.raise = lerp(0.8, 2.5, k);
    pose.armR.raise = lerp(0.8, 2.5, k);
    pose.armL.bend = pose.armR.bend = lerp(1.35, 0.55, k);
    pose.armL.out = pose.armR.out = lerp(-0.25, 0.1, k);
    // The front leg (his left) comes up; the other bends to hold him.
    pose.legL.raise = 1.45 * k;
    pose.legL.bend = 1.55 * k;
    pose.legL.out = 0.1;
    pose.legR.bend = 0.25 * k;
    pose.legR.out = 0.1;
    pose.lift = -0.04 * k;
  };

  const throwPose = (pose: Pose, s: number) => {
    // 0 to 0.12: the arm whips through to the release; then it follows through across the body.
    const a = easeInOut(clamp01(s / THROW_RELEASE));
    const b = easeOut(clamp01((s - THROW_RELEASE) / 0.32));
    pose.lean = lerp(-0.14, 0.7, easeOut(clamp01(s / 0.28)));
    pose.headPitch = lerp(0.35, -0.25, easeOut(clamp01(s / 0.3)));
    pose.armR.raise = lerp(lerp(2.5, 2.05, a), 0.35, b);
    pose.armR.bend = lerp(lerp(0.55, 0.12, a), 0.7, b);
    pose.armR.out = lerp(0.1, -0.3, b);
    pose.armL.raise = lerp(2.5, 0.9, easeOut(clamp01(s / 0.25)));
    pose.armL.bend = lerp(0.55, 1.5, easeOut(clamp01(s / 0.25)));
    pose.armL.out = lerp(0.1, 0.5, easeOut(clamp01(s / 0.25)));
    const stride = easeOut(clamp01(s / 0.2));
    pose.legL.raise = lerp(1.45, 0.55, stride);
    pose.legL.bend = lerp(1.55, 0.3, stride);
    pose.legR.raise = -0.35 * b;
    pose.legR.bend = lerp(0.25, 0.9, b);
    pose.legL.out = pose.legR.out = 0.1;
    pose.lift = lerp(-0.04, -0.06, stride);
  };

  mover.idle = (pose, elapsed) => {
    if (actions.build(pose, elapsed)) return;
    if (mode === 'idle') idle(pose, elapsed);
    else if (mode === 'wind') windPose(pose, t / WIND_TIME, elapsed);
    else if (mode === 'throw') throwPose(pose, t);
    else {
      throwPose(pose, 0.6);
      pose.lean += Math.sin(elapsed * 2) * 0.02;
    }
  };

  return {
    position: 'P',
    root: person.root,
    mover,
    actions,
    get home() {
      return home;
    },
    setHome(spot) {
      home = { ...spot };
    },
    run(to, speed, face, onArrive) {
      mover.runTo([to], speed, onArrive, face ? { face } : undefined);
    },
    act(pose, opts) {
      actions.start(pose, opts);
    },
    faceTo: (point) => mover.face(point),
    goHome(speed) {
      actions.stop();
      mover.runTo([home], speed, () => mover.face({ x: 0, y: 0, z: 0 }));
    },
    atHome() {
      const p = person.root.position;
      return Math.hypot(p.x - home.x, p.z - home.z) < 0.05 && !mover.moving;
    },
    windUp() {
      mode = 'wind';
      t = 0;
      released = false;
      mover.anim.transition(0.25);
    },
    release(callback) {
      if (mode === 'throw') return;
      onRelease = callback;
      released = false;
      mode = 'throw';
      t = 0;
      mover.anim.transition(0.05);
    },
    get windTime() {
      return mode === 'wind' ? t : 0;
    },
    reset() {
      mode = 'idle';
      t = 0;
      onRelease = undefined;
      actions.stop();
      mover.anim.transition(0.3);
    },
    setColours: (colours) => person.recolour(colours.shirt, colours.cap),
    handPosition: (out) => person.handWorld('R', out),
    update(delta, elapsed) {
      t += delta;
      if (mode === 'throw' && !released && t >= THROW_RELEASE) {
        released = true;
        const callback = onRelease;
        onRelease = undefined;
        callback?.();
      }
      if (mode === 'throw' && t > 0.6) {
        mode = 'finish';
        t = 0;
      }
      actions.update(delta);
      mover.update(delta, elapsed);
    },
  };
}

// ---------- The catcher ----------

export interface Catcher extends Actor {
  root: Group;
  /** The glove snaps shut on the ball. */
  pop(): void;
  /** Where the mitt is. */
  mittPosition(out: Vector3): Vector3;
  /** Takes the mask off and tosses it away; the falling mask is returned for the scene to keep. */
  tossMask(): Prop | null;
  /** Puts the mask back on. */
  restoreMask(): void;
  update(delta: number, elapsed: number): void;
}

/** Slides a person sideways and back so a hand ends up under a given spot (ignoring height). */
function alignHand(person: Person, side: 'L' | 'R', target: Vec): void {
  const here = person.handWorld(side, new Vector3());
  person.root.position.x += target.x - here.x;
  person.root.position.z += target.z - here.z;
  person.root.updateMatrixWorld(true);
}

export function createCatcher(): Catcher {
  const person = createPerson({
    shirt: NAVY,
    pants: TEAM_PANTS,
    hat: 'catcher',
    hatColor: 0x23262e,
    glove: 'left',
    gloveColor: 0x6b3a18,
    shoe: 0x23262e,
  });
  person.root.position.set(0, 0, 1.2);
  person.root.rotation.y = Math.PI;
  const mover = createMover(person);
  const actions = createActions(mover);
  let popT = 1;

  const crouch = (pose: Pose, elapsed: number) => {
    const bob = Math.sin(elapsed * 1.6) * 0.01;
    pose.lift = -0.19 + bob;
    pose.lean = 0.45;
    pose.headPitch = 0.45;
    pose.legL.raise = pose.legR.raise = 1.5;
    pose.legL.bend = pose.legR.bend = 1.8;
    pose.legL.out = pose.legR.out = 0.55;
    // The mitt is held out in front, low for a pitch; he snaps it back a little on the catch.
    const snap = popT < 0.25 ? Math.sin((popT / 0.25) * Math.PI) : 0;
    pose.armL.raise = 1.4 + snap * 0.18;
    pose.armL.bend = 0.5 - snap * 0.3;
    pose.armL.out = 0.1;
    pose.armR.raise = 0.75;
    pose.armR.bend = 0.9;
    pose.armR.out = 0.05;
  };
  mover.idle = (pose, elapsed) => {
    if (actions.build(pose, elapsed)) return;
    crouch(pose, elapsed);
  };
  // Settle the pose once so the mitt can be lined up with the ball's last stop.
  mover.anim.step(1, (pose) => crouch(pose, 0));
  person.root.updateMatrixWorld(true);
  alignHand(person, 'L', GLOVE);
  /** Where he crouches: the mitt meets the glove spot exactly. */
  const crouchSpot: Vec = { x: person.root.position.x, y: 0, z: person.root.position.z };
  let home: Vec = crouchSpot;
  let maskOff = false;
  const restoreMask = () => {
    if (!maskOff) return;
    maskOff = false;
    person.head.add(person.hat);
    person.hat.position.set(0, 0, 0);
    person.hat.rotation.set(0, 0, 0);
    person.hat.scale.set(1, 1, 1);
  };

  return {
    position: 'C',
    root: person.root,
    mover,
    actions,
    get home() {
      return home;
    },
    setHome(spot) {
      home = { ...spot };
    },
    run(to, speed, face, onArrive) {
      mover.runTo([to], speed, onArrive, face ? { face } : undefined);
    },
    act(pose, opts) {
      actions.start(pose, opts);
    },
    faceTo: (point) => mover.face(point),
    /** Back to the crouch behind the plate, the mitt meeting the glove spot again. */
    restoreMask,
    tossMask() {
      const parent = person.root.parent;
      if (maskOff || !parent) return null;
      maskOff = true;
      const mask = person.hat;
      parent.attach(mask);
      let vy = 3.2;
      const vx = 1.2;
      let age = 0;
      return {
        object: mask,
        update(delta) {
          age += delta;
          if (!maskOff) return false;
          vy -= 12 * delta;
          mask.position.y = Math.max(mask.position.y + vy * delta, 0.1);
          mask.position.x += vx * delta * (mask.position.y > 0.11 ? 1 : 0);
          mask.rotation.z += 4 * delta;
          return age < 3;
        },
      };
    },
    goHome(speed) {
      actions.stop();
      restoreMask();
      mover.runTo([crouchSpot], speed, () => {
        mover.place(crouchSpot.x, crouchSpot.z);
        mover.setYaw(Math.PI);
        person.root.updateMatrixWorld(true);
      });
    },
    atHome() {
      const p = person.root.position;
      return Math.hypot(p.x - crouchSpot.x, p.z - crouchSpot.z) < 0.05 && !mover.moving;
    },
    pop() {
      popT = 0;
    },
    setColours: (colours) => person.recolour(colours.shirt, colours.cap),
    mittPosition: (out) => person.handWorld('L', out),
    update(delta, elapsed) {
      popT += delta;
      actions.update(delta);
      mover.update(delta, elapsed);
    },
  };
}

// ---------- The umpire ----------

export interface Umpire {
  root: Group;
  /** Calls a strike: an arm up and a pump of the fist (a bigger one for strike three). */
  callStrike(big: boolean): void;
  /** Calls a runner safe: both arms swept out flat for 0.7 s. */
  callSafe(): void;
  reset(): void;
  update(delta: number, elapsed: number): void;
}

export function createUmpire(): Umpire {
  const person = createPerson({
    shirt: 0x23262e,
    pants: 0x6c7380,
    hat: 'cap',
    hatColor: 0x14161b,
    shoe: 0x14161b,
    hair: 0x3a2a1a,
  });
  person.root.position.set(1.3, 0, 3.4);
  person.root.rotation.y = Math.PI;
  const anim = createAnimator(person);
  let call = -1;
  let big = false;
  let safe = -1;

  const stand = (pose: Pose, elapsed: number) => {
    pose.lean = 0.35;
    pose.lift = -0.05;
    pose.headPitch = 0.2;
    pose.headYaw = Math.sin(elapsed * 0.6) * 0.05;
    pose.legL.bend = pose.legR.bend = 0.3;
    pose.legL.raise = pose.legR.raise = 0.25;
    pose.legL.out = pose.legR.out = 0.15;
    pose.armL.raise = pose.armR.raise = 0.5;
    pose.armL.bend = pose.armR.bend = 0.5;
  };

  return {
    root: person.root,
    callStrike(isBig) {
      call = 0;
      big = isBig;
      anim.transition(0.12);
    },
    callSafe() {
      safe = 0;
      call = -1;
      anim.transition(0.1);
    },
    reset() {
      call = -1;
      safe = -1;
      anim.transition(0.3);
    },
    update(delta, elapsed) {
      if (call >= 0) call += delta;
      if (safe >= 0) safe += delta;
      anim.step(delta, (pose) => {
        stand(pose, elapsed);
        if (safe >= 0) {
          // Both arms swept out flat.
          const out =
            easeOut(clamp01(safe / 0.15)) * (safe < 0.7 ? 1 : 1 - clamp01((safe - 0.7) / 0.2));
          pose.lean = lerp(0.35, 0.05, out);
          pose.headPitch = 0;
          pose.armL.raise = lerp(0.5, 0.15, out);
          pose.armR.raise = lerp(0.5, 0.15, out);
          pose.armL.out = lerp(0, 1.45, out);
          pose.armR.out = lerp(0, 1.45, out);
          pose.armL.bend = pose.armR.bend = lerp(0.5, 0.1, out);
          return;
        }
        if (call < 0) return;
        // The right arm (his right is -x in his own frame) goes up and pumps the fist.
        const up = easeOut(clamp01(call / 0.18));
        const pumps = big ? 3 : 1;
        const pump = Math.abs(Math.sin(clamp01((call - 0.2) / 0.6) * Math.PI * pumps));
        pose.lean = lerp(0.35, 0.05, up);
        pose.headPitch = 0;
        pose.armR.raise = lerp(0.5, 1.7, up) + (call > 0.2 ? pump * 0.35 : 0);
        pose.armR.bend = lerp(0.5, 1.7, up) - (call > 0.2 ? pump * 0.7 : 0);
        pose.armR.out = lerp(0, 0.5, up);
      });
    },
  };
}

// ---------- The batter ----------

export interface Batter {
  mover: Mover;
  person: Person;
  /** Starts the swing; the bat meets the ball `SWING_CONTACT` seconds later. */
  swing(): void;
  /** Drops the bat where he stands. Returns the falling bat for the scene to keep. */
  dropBat(): Prop | null;
  /** Stands dejected after a strike (or a strikeout), holding the bat low. */
  slump(): void;
  /** Back in the stance, ready for the next pitch. */
  ready(): void;
  /** Stands with a hop and arms in the air. */
  cheer(): void;
  /** Stands like a base runner, leaning to go. */
  runnerStance(): void;
  /** A lead off the base: crouched, watching the pitcher. */
  lead(): void;
  /** Slides feet first: lean back, legs up, low to the ground. */
  slide(): void;
  /** Runs on past the bag, slowing, and turns back. */
  overrun(): void;
  /** On the bag tagging up, leaning towards the next base. */
  tagUp(towards: Vec): void;
  /** Turns and runs back to the bag. */
  retreat(): void;
}

const PIVOT = { x: -0.15, y: 0.33, z: 0.27 };
const SWEET = 0.68;
const BAT_YAW = (130 * Math.PI) / 180;

export function createBatter(): Batter {
  const person = createPerson({
    shirt: OUR_COLOURS.shirt,
    pants: TEAM_PANTS,
    hat: 'helmet',
    hatColor: OUR_COLOURS.cap,
    hair: 0x3a2312,
  });
  const mover = createMover(person);
  const bat = createBat();
  const pivot = new Group();
  pivot.position.set(PIVOT.x, PIVOT.y, PIVOT.z);
  pivot.rotation.order = 'YXZ';
  pivot.add(bat);
  person.torso.add(pivot);

  type Mode = 'stance' | 'swing' | 'slump' | 'cheer' | 'runner' | 'lead' | 'slide' | 'tag' | 'back';
  let mode: Mode = 'stance';
  let t = 0;
  let batDropped = false;

  /** The bat's heading in the torso's frame, and how far it is tipped from upright. */
  const setBat = (heading: number, tilt: number, roll = 0) => {
    pivot.rotation.set(tilt, heading, roll);
  };

  const holdBat = (pose: Pose) => {
    pose.armR.raise = 1.15;
    pose.armR.bend = 1.0;
    pose.armR.out = -0.1;
    pose.armL.raise = 1.15;
    pose.armL.bend = 1.1;
    pose.armL.out = -0.75;
  };

  const stance = (pose: Pose, elapsed: number) => {
    const wiggle = Math.sin(elapsed * 3.1);
    pose.lift = -0.06;
    pose.lean = 0.12;
    pose.twist = -0.1;
    pose.legL.out = pose.legR.out = 0.28;
    pose.legL.raise = pose.legR.raise = 0.2;
    pose.legL.bend = pose.legR.bend = 0.4;
    holdBat(pose);
    // The head is turned to watch the pitcher over his shoulder.
    pose.headYaw = 0.95;
    setBat(-2.55 + wiggle * 0.05, 0.42 + wiggle * 0.03, 0.1);
  };

  /** The swing at `s` seconds in: load, swing through, follow through. */
  const swingPose = (pose: Pose, s: number) => {
    stance(pose, 0);
    const load = easeInOut(clamp01(s / 0.17));
    const through = easeInOut(clamp01((s - 0.17) / (SWING_CONTACT - 0.17)));
    const follow = easeOut(clamp01((s - SWING_CONTACT) / 0.32));
    pose.twist = lerp(-0.1, -0.4, load) + 0.9 * through + 0.6 * follow;
    pose.lean = lerp(0.12, 0.2, load) - 0.15 * follow;
    pose.headYaw = lerp(0.95, 0.5, through) - 0.4 * follow;
    pose.legL.raise = lerp(0.2, 0.55, load) - 0.35 * through;
    pose.armR.raise = 1.15 + 0.25 * through;
    pose.armR.bend = 1.0 - 0.45 * through + 0.3 * follow;
    pose.armL.raise = 1.15 + 0.2 * through;
    pose.armL.out = -0.75 + 0.35 * through;
    const heading = lerp(lerp(-2.55, -2.9, load), -1.2, through) + 2.1 * follow;
    const tilt = lerp(lerp(0.42, 0.75, load), 1.4, through) - 0.5 * follow;
    setBat(heading, tilt, lerp(0.1, 0, through));
  };

  const slumpPose = (pose: Pose, elapsed: number) => {
    const k = easeOut(clamp01(t / 0.5));
    pose.lift = -0.03 * k;
    pose.lean = 0.35 * k;
    pose.headPitch = -0.5 * k;
    pose.headYaw = 0;
    pose.armR.raise = 0.3;
    pose.armL.raise = 0.2;
    pose.armR.bend = 0.4;
    pose.armL.bend = 0.3;
    pose.twist = Math.sin(elapsed * 1.5) * 0.03;
    setBat(-0.5, 2.9, 0);
  };

  const cheerPose = (pose: Pose) => {
    const k = easeOut(clamp01(t / 0.25));
    pose.lift = Math.abs(Math.sin(t * 9)) * 0.14 * k;
    pose.armL.raise = pose.armR.raise = 2.7 * k;
    pose.armL.out = pose.armR.out = 0.35 * k;
    pose.armL.bend = pose.armR.bend = 0.2;
    pose.headPitch = 0.3 * k;
  };

  const runnerPose = (pose: Pose, elapsed: number) => {
    const sway = Math.sin(elapsed * 2.6);
    pose.lift = -0.06;
    pose.lean = 0.45;
    pose.headPitch = 0.3;
    pose.legL.out = pose.legR.out = 0.3;
    pose.legL.raise = pose.legR.raise = 0.3;
    pose.legL.bend = pose.legR.bend = 0.6;
    pose.armL.raise = pose.armR.raise = 0.6 + sway * 0.1;
    pose.armL.bend = pose.armR.bend = 1.0;
  };

  const slidePose = (pose: Pose) => {
    // Feet first, leaning back, legs up, low to the ground.
    const k = easeOut(clamp01(t / 0.12));
    pose.lift = -0.45 * k;
    pose.lean = -0.9 * k;
    pose.headPitch = 0.5 * k;
    pose.legL.raise = pose.legR.raise = 1.4 * k;
    pose.legL.bend = pose.legR.bend = 0.2;
    pose.armL.raise = pose.armR.raise = -0.4 * k;
    pose.armL.out = pose.armR.out = 0.5 * k;
  };

  const leadPose = (pose: Pose, elapsed: number) => {
    runnerPose(pose, elapsed);
    pose.lean = 0.35;
    pose.headYaw = 0.4;
    pose.legL.out = pose.legR.out = 0.45;
  };

  const tagPose = (pose: Pose, elapsed: number) => {
    runnerPose(pose, elapsed);
    pose.lean = 0.5;
    pose.legR.raise = -0.3;
    pose.legR.bend = 0.4;
    pose.headYaw = 0.5;
  };

  mover.override = (pose) => {
    if (mode !== 'slide') return false;
    slidePose(pose);
    return true;
  };

  mover.idle = (pose, elapsed) => {
    if (mode === 'slide') slidePose(pose);
    else if (mode === 'lead') leadPose(pose, elapsed);
    else if (mode === 'tag') tagPose(pose, elapsed);
    else if (mode === 'back') {
      runnerPose(pose, elapsed);
      pose.headYaw = 1.0;
    } else if (mode === 'swing') swingPose(pose, t);
    else if (mode === 'slump') slumpPose(pose, elapsed);
    else if (mode === 'cheer') cheerPose(pose);
    else if (mode === 'runner') runnerPose(pose, elapsed);
    else stance(pose, elapsed);
  };

  // Stand at the plate facing the pitcher side-on, then slide so the bat meets the ball exactly
  // where the ball arrives.
  const sweet = new Vector3();
  mover.setYaw(BAT_YAW);
  person.root.position.set(0, 0, 0);
  const calibrate = () => {
    const scratch = neutralPose();
    swingPose(scratch, SWING_CONTACT);
    person.apply(scratch);
    person.root.updateMatrixWorld(true);
    pivot.localToWorld(sweet.set(0, SWEET, 0));
    person.root.position.x += CONTACT.x - sweet.x;
    person.root.position.z += CONTACT.z - sweet.z;
    person.root.updateMatrixWorld(true);
    pivot.localToWorld(sweet.set(0, SWEET, 0));
  };
  calibrate();

  const setMode = (next: Mode, blend = 0.12) => {
    mode = next;
    t = 0;
    mover.anim.transition(blend);
  };

  // Keep the clock for swings and reactions.
  const baseUpdate = mover.update;
  mover.update = (delta, elapsed) => {
    t += delta;
    baseUpdate(delta, elapsed);
  };

  return {
    mover,
    person,
    swing: () => setMode('swing', 0.1),
    slump: () => setMode('slump', 0.25),
    ready: () => setMode('stance', 0.2),
    cheer: () => setMode('cheer', 0.15),
    runnerStance: () => setMode('runner', 0.2),
    lead: () => setMode('lead', 0.2),
    slide: () => setMode('slide', 0.1),
    overrun: () => setMode('runner', 0.2),
    tagUp(towards) {
      mover.face(towards);
      setMode('tag', 0.2);
    },
    retreat: () => setMode('back', 0.15),
    dropBat() {
      if (batDropped) return null;
      batDropped = true;
      const parent = person.root.parent;
      if (!parent) return null;
      parent.attach(bat);
      let vy = 1.2;
      const spin = new Vector3(3, 1, 5);
      let age = 0;
      let resting = false;
      return {
        object: bat,
        update(delta) {
          age += delta;
          if (!resting) {
            vy -= 14 * delta;
            bat.position.y += vy * delta;
            bat.rotation.x += spin.x * delta;
            bat.rotation.y += spin.y * delta;
            bat.rotation.z += spin.z * delta;
            if (bat.position.y <= 0.05) {
              bat.position.y = 0.05;
              resting = true;
              bat.rotation.set(Math.PI / 2, bat.rotation.y, 0.2);
            }
          }
          return age < 3;
        },
      };
    },
  };
}

// ---------- The fielders ----------

export type FielderId = '1B' | '2B' | 'SS' | '3B' | 'LF' | 'CF' | 'RF';

export const FIELDER_SPOTS: Record<FielderId, Vec> = {
  '1B': POSITION_SPOTS['1B'],
  '2B': POSITION_SPOTS['2B'],
  SS: POSITION_SPOTS.SS,
  '3B': POSITION_SPOTS['3B'],
  LF: POSITION_SPOTS.LF,
  CF: POSITION_SPOTS.CF,
  RF: POSITION_SPOTS.RF,
};

export type FielderMode = 'ready' | 'scoop' | 'watch';

export interface Fielder extends Actor {
  id: FielderId;
  /** Runs after a ball and fields it; `onArrive` runs when they get there. */
  chase(target: Vec, speed: number, mode: FielderMode, onArrive?: () => void): void;
  setMode(mode: FielderMode): void;
}

export function createFielder(id: FielderId, index: number): Fielder {
  const outfield = id === 'LF' || id === 'CF' || id === 'RF';
  const person = createPerson({
    shirt: 0xe3e7ee,
    pants: TEAM_PANTS,
    hat: 'cap',
    hatColor: outfield ? 0x2c6e49 : NAVY,
    glove: 'left',
    hair: index % 2 ? 0x2b1a10 : 0x6b4423,
    skin: index % 3 === 0 ? 0xc68642 : 0xf1b48a,
  });
  let home: Vec = { ...FIELDER_SPOTS[id] };
  const mover = createMover(person);
  mover.place(home.x, home.z);
  mover.setYaw(Math.atan2(-home.x, -home.z));
  // An outfielder's throw has a crow hop; an infielder's is quick.
  const actions = createActions(mover, { release: outfield ? 0.38 : 0.22 });

  mover.idle = (pose, elapsed) => {
    if (actions.build(pose, elapsed)) return;
    ready(pose, Math.sin(elapsed * 1.9 + index * 1.7));
  };

  const baseUpdate = mover.update;
  mover.update = (delta, elapsed) => {
    actions.update(delta);
    baseUpdate(delta, elapsed);
  };

  const setMode = (next: FielderMode) => {
    if (next === 'ready') actions.stop();
    else if (actions.pose !== next) actions.start(next);
  };

  return {
    id,
    position: id,
    mover,
    actions,
    get home() {
      return home;
    },
    setHome(spot) {
      home = { ...spot };
    },
    setMode,
    setColours: (colours) => person.recolour(colours.shirt, colours.cap),
    run(to, speed, face, onArrive) {
      actions.stop();
      mover.runTo([to], speed, onArrive, face ? { face } : undefined);
    },
    act(pose, opts) {
      actions.start(pose, opts);
    },
    faceTo: (point) => mover.face(point),
    chase(target, speed, next, onArrive) {
      setMode('ready');
      mover.runTo([target], speed, () => {
        setMode(next);
        onArrive?.();
      });
    },
    goHome(speed) {
      setMode('ready');
      mover.runTo([home], speed, () => mover.face({ x: 0, y: 0, z: 0 }));
    },
    atHome() {
      const p = person.root.position;
      return Math.hypot(p.x - home.x, p.z - home.z) < 0.05 && !mover.moving;
    },
  };
}
