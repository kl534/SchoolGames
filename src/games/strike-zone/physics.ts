/**
 * The pins and the ball as rigid bodies (cannon-es). No three.js and no DOM.
 *
 * The masses and materials are the real ones and were run in a prototype: pins stand still on
 * their own, and a pin falls even when the ball is 16 cm off centre. They are NOT tuned for how
 * often strikes happen; change one only if the pins misbehave (jitter, sinking, flying off).
 */
import { Body, Box, ContactMaterial, Cylinder, Material, Sphere, Vec3, World } from 'cannon-es';
import type { ThrowPath } from './aim';
import {
  BALL_MASS,
  BALL_R,
  DECK_BACK_Z,
  GUTTER_DEPTH,
  HEAD_Z,
  KICKBACK_X,
  LANE_HALF,
  PIN_COM_Y,
  PIN_IDS,
  PIN_MASS,
  PIT_BACK_Z,
  RELEASE_Z,
  pinSpot,
  type PinId,
} from './geometry';

export interface BodyPose {
  x: number;
  y: number;
  z: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
}

export interface Physics {
  /** Stands these pins on their spots, still and asleep; the others leave the world. */
  rack(ids: readonly PinId[]): void;
  /** Starts a throw down this path (section 5.3). */
  launch(path: ThrowPath): void;
  /** Advances by `delta` seconds in FIXED_STEP steps, at most `maxSteps` of them. */
  step(delta: number, maxSteps?: number): void;
  /** Seconds simulated since `launch`. */
  readonly time: number;
  /** When the ball first came within 0.25 m of a standing pin (or crossed HEAD_Z + 0.25), else null. */
  readonly contactAt: number | null;
  /** True once the throw has played out (rules below). */
  settled(): boolean;
  /** The racked pins standing now: tilted under 25° from upright and still on the deck. */
  standing(): PinId[];
  ball(): BodyPose;
  pin(id: PinId): BodyPose | null;
}

export const FIXED_STEP = 1 / 200;
export const MAX_SUBSTEPS = 6;
/** Steps per frame while fast-forwarding after a tap. */
export const FAST_STEPS = 40;
export const SETTLE_MIN = 1.5;
export const SETTLE_MAX = 4.0;
/** With nothing moving this long after contact, a clean miss settles early. */
export const QUIET_SETTLE = 0.6;
export const DOWN_TILT_DEG = 25;

/** The ball is held on its line until it is this far in front of the head pin. */
const RAILS_END_Z = HEAD_Z + 0.6;
/** How close the ball must come to a pin to count as contact. */
const CONTACT_RANGE = 0.25;
/** A pin that is slower than this (m/s, rad/s) has stopped. */
const STILL_SPEED = 0.04;
const STILL_SPIN = 0.25;
/** A ball slower than this has stopped. */
const BALL_STOPPED = 0.2;

const pose = (body: Body): BodyPose => ({
  x: body.position.x,
  y: body.position.y,
  z: body.position.z,
  qx: body.quaternion.x,
  qy: body.quaternion.y,
  qz: body.quaternion.z,
  qw: body.quaternion.w,
});

export function createPhysics(): Physics {
  const world = new World({ gravity: new Vec3(0, -9.81, 0) });
  world.allowSleep = true;
  // cannon-es types `solver` as a plain Solver; the one in use is a GSSolver with iterations.
  (world.solver as unknown as { iterations: number }).iterations = 20;

  const laneMat = new Material('lane');
  const wallMat = new Material('wall');
  const pinMat = new Material('pin');
  const ballMat = new Material('ball');
  const contact = (a: Material, b: Material, friction: number, restitution: number) =>
    world.addContactMaterial(new ContactMaterial(a, b, { friction, restitution }));
  contact(ballMat, laneMat, 0.04, 0);
  contact(pinMat, laneMat, 0.3, 0.25);
  contact(pinMat, pinMat, 0.25, 0.5);
  contact(ballMat, pinMat, 0.12, 0.5);
  contact(pinMat, wallMat, 0.2, 0.45);
  contact(ballMat, wallMat, 0.2, 0.3);

  // ---------- The lane, the gutters and the pit ----------
  const staticBox = (
    material: Material,
    x0: number,
    x1: number,
    yTop: number,
    yBottom: number,
    z0: number,
    z1: number,
  ) => {
    const body = new Body({ mass: 0, material });
    body.addShape(new Box(new Vec3((x1 - x0) / 2, (yTop - yBottom) / 2, Math.abs(z1 - z0) / 2)));
    body.position.set((x0 + x1) / 2, (yTop + yBottom) / 2, (z0 + z1) / 2);
    world.addBody(body);
  };
  const SLAB = 0.3;
  // Lane and deck, then the gutter floors on both sides.
  staticBox(laneMat, -LANE_HALF, LANE_HALF, 0, -SLAB, 0.3, DECK_BACK_Z);
  staticBox(laneMat, LANE_HALF, KICKBACK_X, -GUTTER_DEPTH, -GUTTER_DEPTH - SLAB, 0.3, DECK_BACK_Z);
  staticBox(
    laneMat,
    -KICKBACK_X,
    -LANE_HALF,
    -GUTTER_DEPTH,
    -GUTTER_DEPTH - SLAB,
    0.3,
    DECK_BACK_Z,
  );
  // Kickbacks beside the deck.
  staticBox(wallMat, KICKBACK_X, KICKBACK_X + 0.04, 0.6, 0, HEAD_Z + 0.5, PIT_BACK_Z);
  staticBox(wallMat, -KICKBACK_X - 0.04, -KICKBACK_X, 0.6, 0, HEAD_Z + 0.5, PIT_BACK_Z);
  // Pit floor and back cushion.
  staticBox(wallMat, -1.0, 1.0, -0.25, -0.25 - SLAB, DECK_BACK_Z, PIT_BACK_Z);
  staticBox(wallMat, -1.0, 1.0, 0.7, -0.3, PIT_BACK_Z, PIT_BACK_Z - 0.1);

  // ---------- Pins ----------
  const makePin = (): Body => {
    const body = new Body({
      mass: PIN_MASS,
      linearDamping: 0.05,
      angularDamping: 0.1,
      material: pinMat,
    });
    body.allowSleep = true;
    body.sleepSpeedLimit = 0.05;
    body.sleepTimeLimit = 0.3;
    body.addShape(new Cylinder(0.0605, 0.035, 0.114, 12), new Vec3(0, 0.057 - PIN_COM_Y, 0));
    body.addShape(new Cylinder(0.023, 0.0605, 0.14, 12), new Vec3(0, 0.184 - PIN_COM_Y, 0));
    body.addShape(new Sphere(0.032), new Vec3(0, 0.33 - PIN_COM_Y, 0));
    return body;
  };
  const pins = new Map<PinId, Body>(PIN_IDS.map((id) => [id, makePin()]));
  const racked = new Set<PinId>();

  // ---------- The ball ----------
  const ball = new Body({
    mass: BALL_MASS,
    shape: new Sphere(BALL_R),
    linearDamping: 0.01,
    angularDamping: 0.01,
    material: ballMat,
  });
  ball.allowSleep = false;
  ball.position.set(0, BALL_R, 0);
  let launched = false;
  let path: ThrowPath | null = null;
  let time = 0;
  let contactAt: number | null = null;
  let leftover = 0;

  const launchVelocity = new Vec3();
  /** The ball's x on the aimed line at depth z. */
  const lineAt = (z: number) =>
    path ? path.startX + (path.dirX / path.dirZ) * (z - RELEASE_Z) : 0;

  // The rails: until the ball is near the pins it rides exactly on the aimed line.
  world.addEventListener('postStep', () => {
    if (!launched || !path || ball.position.z <= RAILS_END_Z) return;
    ball.position.x = lineAt(ball.position.z);
    ball.position.y = BALL_R;
    ball.velocity.copy(launchVelocity);
    ball.angularVelocity.set(launchVelocity.z / BALL_R, 0, -launchVelocity.x / BALL_R);
  });

  const upTilt = (body: Body): number => {
    const up = body.quaternion.vmult(new Vec3(0, 1, 0));
    return (Math.acos(Math.min(Math.max(up.y, -1), 1)) * 180) / Math.PI;
  };

  const checkContact = () => {
    if (contactAt !== null) return;
    const p = ball.position;
    let near = p.z <= HEAD_Z + CONTACT_RANGE;
    for (const id of racked) {
      if (near) break;
      near = p.distanceTo(pins.get(id)!.position) < CONTACT_RANGE;
    }
    if (near) contactAt = time;
  };

  const ballSpeed = () => ball.velocity.length();

  return {
    rack(ids) {
      launched = false;
      path = null;
      time = 0;
      contactAt = null;
      leftover = 0;
      if (ball.world) world.removeBody(ball);
      racked.clear();
      for (const id of PIN_IDS) {
        const body = pins.get(id)!;
        if (!ids.includes(id)) {
          if (body.world) world.removeBody(body);
          continue;
        }
        racked.add(id);
        const spot = pinSpot(id);
        body.position.set(spot.x, PIN_COM_Y, spot.z);
        body.previousPosition.copy(body.position);
        body.interpolatedPosition.copy(body.position);
        body.initPosition.copy(body.position);
        body.quaternion.set(0, 0, 0, 1);
        body.previousQuaternion.copy(body.quaternion);
        body.interpolatedQuaternion.copy(body.quaternion);
        body.initQuaternion.copy(body.quaternion);
        body.velocity.setZero();
        body.angularVelocity.setZero();
        body.force.setZero();
        body.torque.setZero();
        body.aabbNeedsUpdate = true;
        if (!body.world) world.addBody(body);
        body.sleep();
      }
    },

    launch(next) {
      path = next;
      time = 0;
      contactAt = null;
      leftover = 0;
      launched = true;
      launchVelocity.set(next.dirX * next.speed, 0, next.dirZ * next.speed);
      ball.position.set(next.startX, BALL_R, RELEASE_Z);
      ball.previousPosition.copy(ball.position);
      ball.quaternion.set(0, 0, 0, 1);
      ball.velocity.copy(launchVelocity);
      ball.angularVelocity.set(launchVelocity.z / BALL_R, 0, -launchVelocity.x / BALL_R);
      ball.force.setZero();
      ball.torque.setZero();
      ball.aabbNeedsUpdate = true;
      if (!ball.world) world.addBody(ball);
    },

    step(delta, maxSteps = MAX_SUBSTEPS) {
      leftover += delta;
      let steps = 0;
      while (leftover >= FIXED_STEP - 1e-9 && steps < maxSteps) {
        world.step(FIXED_STEP);
        leftover -= FIXED_STEP;
        steps++;
        if (launched) {
          time += FIXED_STEP;
          checkContact();
        }
      }
      // A slow device falls behind (slow motion) rather than catching up with a burst of steps.
      if (steps >= maxSteps) leftover = 0;
    },

    get time() {
      return time;
    },
    get contactAt() {
      return contactAt;
    },

    settled() {
      if (!launched || contactAt === null) return false;
      const since = time - contactAt;
      if (since >= SETTLE_MAX) return true;
      const passed = ball.position.z < DECK_BACK_Z || ballSpeed() < BALL_STOPPED;
      if (!passed) return false;
      const bodies = [...racked].map((id) => pins.get(id)!);
      if (
        since >= SETTLE_MIN &&
        bodies.every(
          (b) => b.velocity.length() < STILL_SPEED && b.angularVelocity.length() < STILL_SPIN,
        )
      ) {
        return true;
      }
      return since >= QUIET_SETTLE && bodies.every((b) => b.sleepState === Body.SLEEPING);
    },

    standing() {
      return [...racked]
        .filter((id) => {
          const p = pins.get(id)!;
          return (
            upTilt(p) < DOWN_TILT_DEG &&
            Math.abs(p.position.x) < LANE_HALF + 0.01 &&
            p.position.z > DECK_BACK_Z &&
            p.position.y > 0.05
          );
        })
        .sort((a, b) => a - b);
    },

    ball: () => pose(ball),
    pin: (id) => (racked.has(id) ? pose(pins.get(id)!) : null),
  };
}

/** A whole throw with nothing drawn; returns the pins left standing. For tests. */
export function simulateThrow(rack: readonly PinId[], path: ThrowPath): PinId[] {
  const physics = createPhysics();
  physics.rack(rack);
  physics.launch(path);
  // The ball takes about 2 s to arrive; the limit is a safety net.
  for (let i = 0; i < 12 / FIXED_STEP && !physics.settled(); i++) physics.step(FIXED_STEP, 1);
  return physics.standing();
}
