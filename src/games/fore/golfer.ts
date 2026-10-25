import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import {
  createAnimator,
  createPerson,
  kneeDrop,
  kneeRaise,
  plantedBend,
  RIG,
  type Person,
  type Pose,
} from './person';
import { BALL_R } from './ball';
import {
  SWING_TIMING,
  swingFrame,
  swingKind,
  type ImpactFix,
  type SwingFrame,
  type SwingKind,
} from './swing';

export type GolfMove = 'address' | 'swing' | 'follow' | 'cheer' | 'groan';

export interface ClubSpec {
  id: string;
  carry: number;
}

export interface Golfer {
  /** At his feet, unscaled: its yaw faces his chest along the ball line (see `stand`). */
  root: Group;
  person: Person;
  /** Picks the club in his hands (its model, length, stance and how the swing is fitted to it). */
  setClub(club: ClubSpec): void;
  /** Poses the golfer `t` seconds into a move. */
  play(move: GolfMove, t: number, delta: number): void;
  /**
   * Stands side-on to the ball as a right-hander: facing the ball line with the target on his
   * left, his feet line `reach` for the club from the ball. `dir` is the shot direction (radians
   * from +z towards +x).
   */
  stand(ball: { x: number; z: number }, dir: number, clubId: string): void;
  dispose(): void;
}

const RAD = Math.PI / 180;
/** The ankles stand this far behind the toe line the golfer is placed by, yards. */
const FEET_BACK = 0.12;

/** Distance from his feet line to the ball, yards, by club. */
export const REACH: Record<string, number> = {
  driver: 0.95,
  iron3: 0.9,
  iron5: 0.85,
  iron7: 0.8,
  wedge: 0.72,
  sand: 0.72,
  putter: 0.55,
};
const reachFor = (id: string) => REACH[id] ?? 0.8;

// ---------- The club ----------

interface HeadSpec {
  /** From the grip end to the head's centre, yards. */
  length: number;
  /** The face is this far in front of the head's centre. */
  faceOff: number;
  /** The sole is this far below it. */
  sole: number;
}

const HEADS: Record<string, HeadSpec & { build(): Group }> = {};

const dark = new MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.4, metalness: 0.3 });
const steel = new MeshStandardMaterial({ color: 0xbfc4cc, roughness: 0.3, metalness: 0.7 });
const black = new MeshStandardMaterial({ color: 0x16161a, roughness: 0.5 });
const rubber = new MeshStandardMaterial({ color: 0x232326, roughness: 0.9 });
const silver = new MeshStandardMaterial({ color: 0xd5d9df, roughness: 0.3, metalness: 0.6 });

function iron(length: number, loft: number): HeadSpec & { build(): Group } {
  return {
    length,
    faceOff: 0.01,
    sole: 0.03,
    build() {
      const g = new Group();
      const blade = new Mesh(new BoxGeometry(0.012, 0.06, 0.09), steel);
      blade.position.set(-0.004, 0, 0.012);
      blade.rotation.z = loft * RAD;
      g.add(blade);
      return g;
    },
  };
}

Object.assign(HEADS, {
  driver: {
    length: 1.25,
    faceOff: 0.025,
    sole: 0.04,
    build() {
      const g = new Group();
      const egg = new Mesh(new SphereGeometry(0.5, 16, 12), dark);
      egg.scale.set(0.1, 0.08, 0.12);
      egg.position.set(-0.025, 0, 0.02);
      g.add(egg);
      return g;
    },
  },
  iron3: iron(1.1, 22),
  iron5: iron(1.07, 28),
  iron7: iron(1.02, 36),
  wedge: iron(0.97, 52),
  sand: iron(0.97, 56),
  putter: {
    length: 0.95,
    faceOff: 0.01,
    sole: 0.015,
    build() {
      const g = new Group();
      const box = new Mesh(new BoxGeometry(0.04, 0.03, 0.1), black);
      box.position.set(-0.01, 0, 0.02);
      g.add(box);
      return g;
    },
  },
});

const headFor = (id: string) => HEADS[id] ?? HEADS.iron7;

/** The grip hand is this far below the top of the club. */
const BUTT = 0.05;

interface ClubModel {
  group: Group;
  /** The head, at its centre; the face looks along +x (toward the target at address), +y is up. */
  head: Group;
  spec: HeadSpec;
  /** From the lead hand to the head's centre, yards. */
  shaftLength: number;
  dispose(): void;
}

/**
 * A club with its origin at the lead hand and the shaft running down -y to the head. Named
 * `grip` (at the hand) and `clubHead` (the head's centre) for tests and dev hooks.
 */
export function createClub(id: string): ClubModel {
  const spec = headFor(id);
  const group = new Group();
  group.name = 'club';
  const length = spec.length - BUTT;
  const geometries: BufferGeometry[] = [];
  const own = <T extends BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const grip = new Group();
  grip.name = 'grip';
  group.add(grip);
  const handle = new Mesh(own(new CylinderGeometry(0.011, 0.009, 0.25, 8)), rubber);
  handle.position.y = BUTT - 0.125;
  group.add(handle);
  const shaft = new Mesh(own(new CylinderGeometry(0.005, 0.0065, length - 0.2, 6)), silver);
  shaft.position.y = -0.2 - (length - 0.2) / 2;
  group.add(shaft);
  const head = new Group();
  head.name = 'clubHead';
  head.position.y = -length;
  const hosel = new Mesh(own(new CylinderGeometry(0.007, 0.007, 0.07, 6)), steel);
  hosel.position.y = 0.035;
  head.add(hosel);
  const model = spec.build();
  head.add(model);
  group.add(head);
  return {
    group,
    head,
    spec: { length: spec.length, faceOff: spec.faceOff, sole: spec.sole },
    shaftLength: length,
    dispose() {
      geometries.forEach((g) => g.dispose());
      model.traverse((o) => {
        if (o instanceof Mesh) o.geometry.dispose();
      });
      group.removeFromParent();
    },
  };
}

// ---------- Geometry of the swing ----------

const EX = new Vector3(1, 0, 0);

/** Distance from the lead shoulder to the grip hand with the arm as straight as it goes. */
const LEAD_REACH = 0.98;
/** Where the lead arm hangs at address, degrees in the swing plane (hands a little ahead). */
const ARM0 = -9;
/** How far the wrists are cocked at address, radians (the angle between the arm and the shaft). */
const WRIST0 = 0.45;
/** The forward bend of the spine at address, radians, by club (longer clubs stand taller). */
const LEAN: Record<string, number> = {
  driver: 0.5,
  iron3: 0.52,
  iron5: 0.55,
  iron7: 0.58,
  wedge: 0.62,
  sand: 0.62,
  putter: 0.75,
};
/** The trail hand sits this far below the lead hand on the grip, yards. */
const HAND_GAP = 0.09;

const poleLead = new Vector3(0.25, -1, 0.15);
const poleTrail = new Vector3(-0.2, -1, -0.45);

interface Fit {
  /** Forward bend of the spine at address, radians. */
  lean: number;
  /** Tilt of the swing plane from horizontal, degrees. */
  tilt: number;
  /** Where the lead arm hangs at address, degrees in the swing plane. */
  arm0: number;
  /** Shaft angle in the plane at address, degrees. */
  shaft0: number;
  /** The extra arms and cock at impact that put the head on the ball. */
  fix: ImpactFix;
}

type Residual = (x: number[]) => number[];

/** Damped Gauss-Newton with a numeric Jacobian; plenty for these three and two unknowns. */
function solve(f: Residual, start: number[], steps = 25): number[] {
  const x = [...start];
  const n = x.length;
  let lambda = 1e-3;
  let r = f(x);
  let err = r.reduce((s, v) => s + v * v, 0);
  for (let it = 0; it < steps && err > 1e-10; it++) {
    const J: number[][] = r.map(() => new Array<number>(n).fill(0));
    for (let j = 0; j < n; j++) {
      const h = 1e-4 * Math.max(1, Math.abs(x[j]));
      const xp = [...x];
      xp[j] += h;
      const rp = f(xp);
      for (let i = 0; i < r.length; i++) J[i][j] = (rp[i] - r[i]) / h;
    }
    const A = Array.from({ length: n }, (_, a) =>
      Array.from({ length: n }, (_, b) => J.reduce((s, row) => s + row[a] * row[b], 0)),
    );
    const g = Array.from({ length: n }, (_, a) => J.reduce((s, row, i) => s + row[a] * r[i], 0));
    let improved = false;
    for (let tries = 0; tries < 8 && !improved; tries++) {
      const M = A.map((row, i) => [...row.map((v, j) => v + (i === j ? lambda : 0)), -g[i]]);
      for (let c = 0; c < n; c++) {
        let p = c;
        for (let i = c + 1; i < n; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i;
        [M[c], M[p]] = [M[p], M[c]];
        for (let i = c + 1; i < n; i++) {
          const k = M[i][c] / (M[c][c] || 1e-12);
          for (let j = c; j <= n; j++) M[i][j] -= k * M[c][j];
        }
      }
      const dx = new Array<number>(n).fill(0);
      for (let i = n - 1; i >= 0; i--) {
        let s = M[i][n];
        for (let j = i + 1; j < n; j++) s -= M[i][j] * dx[j];
        dx[i] = s / (M[i][i] || 1e-12);
      }
      const xn = x.map((v, i) => v + dx[i]);
      const rn = f(xn);
      const en = rn.reduce((s, v) => s + v * v, 0);
      if (Number.isFinite(en) && en < err) {
        x.splice(0, n, ...xn);
        r = rn;
        err = en;
        lambda = Math.max(lambda / 4, 1e-9);
        improved = true;
      } else lambda *= 8;
    }
    if (!improved) break;
  }
  return x;
}

/** The knees and weight, and the other body angles, of a frame; the arms are left to the solver. */
function bodyPose(frame: SwingFrame, lean0: number, p: Pose): void {
  p.hips = -frame.hips * RAD;
  p.twist = -(frame.shoulders - frame.hips) * RAD;
  p.slide = frame.slide;
  p.lean = lean0 * (1 - 0.85 * frame.up);
  p.headYaw = (frame.shoulders - frame.head) * RAD;
  p.headPitch = -0.3 * (1 - frame.up);
  const lead = frame.leadKnee;
  p.lift = -kneeDrop((lead + frame.trailKnee) / 2);
  const trail = frame.trailHeel > 0.02 ? Math.max(frame.trailKnee, plantedBend(p.lift, frame.trailHeel)) : frame.trailKnee;
  p.legL.out = p.legR.out = 0.16;
  p.legL.raise = kneeRaise(lead);
  p.legL.bend = lead;
  p.legR.raise = kneeRaise(trail);
  p.legR.bend = trail;
  p.footL = 0;
  p.footR = frame.trailHeel;
}

/** A pose that stands relaxed, as for a cheer or a groan. */
function relaxed(p: Pose): void {
  p.legL.out = p.legR.out = 0.06;
  p.legL.bend = p.legR.bend = 0.05;
  p.legL.raise = p.legR.raise = kneeRaise(0.05);
  p.lift = -kneeDrop(0.05);
}

export function createGolfer(): Golfer {
  const person = createPerson({
    shirt: 0xf26b3a,
    pants: 0x2b3a55,
    hat: 'cap',
    hatColor: 0xffffff,
    trousers: true,
    glove: 0xffffff,
    shoe: 0x23262d,
    height: 2,
  });
  const root = new Group();
  // The golfer's origin is his toe line; his ankles are a little behind it.
  person.root.position.z = -FEET_BACK;
  root.add(person.root);
  const animator = createAnimator(person);
  const scale = person.scale;
  const upper = RIG.upperArm * scale;
  const lower = (RIG.forearm + RIG.hand) * scale;
  const maxReach = upper + lower;

  let model = createClub('driver');
  root.add(model.group);
  let clubId = 'driver';
  let kind: SwingKind = 'full';
  const fits = new Map<string, Fit>();
  let fit: Fit = { lean: 0.55, tilt: 55, arm0: ARM0, shaft0: 8, fix: { arms: 0, cock: 0 } };

  // Scratch objects, so a frame allocates nothing.
  const sL = new Vector3();
  const sR = new Vector3();
  const centre = new Vector3();
  const tilt = new Vector3();
  const dirA = new Vector3();
  const dirS = new Vector3();
  const w = new Vector3();
  const grip = new Vector3();
  const hand2 = new Vector3();
  const elbowL = new Vector3();
  const elbowR = new Vector3();
  const reached = new Vector3();
  const axis = new Vector3();
  const perp = new Vector3();
  const u1 = new Vector3();
  const bx = new Vector3();
  const by = new Vector3();
  const bz = new Vector3();
  const m = new Matrix4();
  const qWorld = new Quaternion();
  const qRoot = new Quaternion();
  const qTorso = new Quaternion();
  const qa = new Quaternion();
  const qIkShoulderL = new Quaternion();
  const qIkShoulderR = new Quaternion();
  const qIkElbowL = new Quaternion();
  const qIkElbowR = new Quaternion();
  const qIkClub = new Quaternion();
  const qHoldClub = new Quaternion();
  const pHold = new Vector3();
  const dHold = new Vector3();

  const local = (v: Vector3) => root.worldToLocal(v);

  /** The swing plane's down-slope direction for a tilt in degrees. */
  const setTilt = (deg: number) => tilt.set(0, -Math.sin(deg * RAD), Math.cos(deg * RAD));
  /** A direction in the swing plane: 0 down the slope, positive turning back, away from the target. */
  const inPlane = (deg: number, out: Vector3) =>
    out.copy(tilt).multiplyScalar(Math.cos(deg * RAD)).addScaledVector(EX, -Math.sin(deg * RAD));

  /** Reads the shoulders (in the golfer's own frame) and the point between them. */
  const readShoulders = () => {
    root.updateMatrixWorld(true);
    local(person.shoulderL.getWorldPosition(sL));
    local(person.shoulderR.getWorldPosition(sR));
    centre.addVectors(sL, sR).multiplyScalar(0.5);
  };

  /**
   * Where the lead hand is when the arm points `arm` degrees round the plane (from the point between
   * the shoulders) with the lead arm held at `reach` of the shoulder, and the shaft `shaft` degrees.
   */
  const handPlace = (arm: number, reach: number) => {
    inPlane(arm, dirA);
    w.subVectors(centre, sL);
    const b = w.dot(dirA);
    const c = w.lengthSq() - reach * reach;
    const a = -b + Math.sqrt(Math.max(b * b - c, 0));
    grip.copy(centre).addScaledVector(dirA, a);
  };

  /**
   * The trail hand takes the spot on the grip, 6 to 13 cm below the lead hand, that it reaches best.
   * If neither arm can reach, the grip moves in towards the shoulders until both can. Needs `grip`,
   * `dirS` and the shoulders set; returns how far down the grip the trail hand goes.
   */
  const reachFix = (): number => {
    let best = HAND_GAP;
    for (let pass = 0; pass < 6; pass++) {
      let bestOver = Infinity;
      for (const d of [0.07, HAND_GAP, 0.12]) {
        hand2.copy(grip).addScaledVector(dirS, d);
        const over = hand2.distanceTo(sR) - maxReach * 0.995;
        if (over < bestOver) {
          bestOver = over;
          best = d;
        }
      }
      const over = Math.max(bestOver, grip.distanceTo(sL) - maxReach * 0.995);
      if (over <= 0) break;
      w.subVectors(centre, grip).normalize();
      grip.addScaledVector(w, over + 0.004);
    }
    return best;
  };

  const headAt = (shaft: number, out: Vector3) => {
    inPlane(shaft, dirS);
    reachFix();
    return out.copy(grip).addScaledVector(dirS, model.shaftLength);
  };

  // ----- Fitting the swing to a club (once per club) -----

  const fitFor = (id: string, swing: SwingKind): Fit => {
    const key = `${id}:${swing}`;
    const known = fits.get(key);
    if (known) return known;
    const head = headFor(id);
    const probe = createClub(id);
    const saved = model;
    model = probe;
    const pose = new Poser();
    const reach = reachFor(id);
    const target = new Vector3();
    const out = new Vector3();
    const at = (frame: SwingFrame, lean: number) => {
      pose.set(frame, lean);
      readShoulders();
    };
    // Address: the spine's bend, the tilt of the plane and the shaft angle that put the head just
    // behind the ball, on the ground, with the hands where the arm hangs. A pull towards the usual
    // bend for the club (the third row) picks the most natural of the ways that fit.
    const prefer = LEAN[id] ?? 0.58;
    const frame0 = swingFrame(swing, 0);
    const address = solve(
      ([lean, tiltDeg, shaft]) => {
        at(frame0, lean);
        setTilt(tiltDeg);
        handPlace(ARM0, maxReach * LEAD_REACH);
        headAt(shaft, out);
        target.set(-(BALL_R + 0.012 + head.faceOff), head.sole, reach);
        return [out.x - target.x, out.y - target.y, out.z - target.z, 0.15 * ((shaft - ARM0) * RAD - WRIST0)];
      },
      [prefer, 55, 8],
    );
    const lean = Math.min(Math.max(address[0], 0.1), 1.3);
    const tiltDeg = Math.min(Math.max(address[1], 20), 80);
    const shaft0 = address[2];
    const arm0 = ARM0;
    const cock0 = shaft0 - arm0;
    // Impact: arms and cock that bring the face to the ball, with the body as it is then.
    const frameI = swingFrame(swing, SWING_TIMING[swing].impact);
    const result = solve(
      ([dArms, dCock]) => {
        at(frameI, lean);
        setTilt(tiltDeg);
        const arm = arm0 + frameI.arms + dArms;
        handPlace(arm, maxReach * LEAD_REACH);
        headAt(arm + cock0 + frameI.cock + dCock, out);
        target.set(-(BALL_R + head.faceOff), head.sole, reach);
        return [out.x - target.x, out.y - target.y];
      },
      [0, 0],
    );
    probe.dispose();
    model = saved;
    const made: Fit = { lean, tilt: tiltDeg, arm0, shaft0, fix: { arms: result[0], cock: result[1] } };
    fits.set(key, made);
    return made;
  };

  /** Builds poses for the fitting without going through the animator. */
  class Poser {
    private readonly pose: Pose = {
      lift: 0,
      lean: 0,
      twist: 0,
      hips: 0,
      slide: 0,
      headPitch: 0,
      headYaw: 0,
      roll: 0,
      footL: 0,
      footR: 0,
      armL: { raise: 0, out: 0, bend: 0 },
      armR: { raise: 0, out: 0, bend: 0 },
      legL: { raise: 0, out: 0, bend: 0 },
      legR: { raise: 0, out: 0, bend: 0 },
    };
    set(frame: SwingFrame, lean: number): void {
      bodyPose(frame, lean, this.pose);
      person.apply(this.pose);
    }
  }

  // ----- Posing the arms and club each frame -----

  let ikWeight = 1;
  let ikGoal = 1;

  /** Solves one arm's two bones to the hand; leaves the elbow in `elbow` and the bone turns in q. */
  const solveArm = (
    shoulder: Vector3,
    hand: Vector3,
    pole: Vector3,
    elbow: Vector3,
    qShoulder: Quaternion,
    qElbow: Quaternion,
    handOut: Vector3,
  ) => {
    axis.subVectors(hand, shoulder);
    const dist = Math.min(Math.max(axis.length(), Math.abs(upper - lower) + 1e-3), maxReach - 1e-3);
    axis.normalize();
    const a = (upper * upper - lower * lower + dist * dist) / (2 * dist);
    const h = Math.sqrt(Math.max(upper * upper - a * a, 0));
    perp.copy(pole).addScaledVector(axis, -pole.dot(axis));
    if (perp.lengthSq() < 1e-8) perp.set(0, 0, 1).addScaledVector(axis, -axis.z);
    perp.normalize();
    elbow.copy(shoulder).addScaledVector(axis, a).addScaledVector(perp, h);
    handOut.copy(shoulder).addScaledVector(axis, dist);
    u1.subVectors(elbow, shoulder).normalize();
    // Joint frame: y runs down the upper arm, x is the elbow's hinge.
    by.copy(u1).negate();
    bx.crossVectors(axis, perp).normalize();
    bz.crossVectors(bx, by);
    const fore = axis.subVectors(handOut, elbow).normalize();
    let bend = Math.atan2(-fore.dot(bz), -fore.dot(by));
    if (bend > 0) {
      bx.negate();
      bz.negate();
      bend = Math.atan2(-fore.dot(bz), -fore.dot(by));
    }
    m.makeBasis(bx, by, bz);
    qWorld.setFromRotationMatrix(m);
    // Into the torso's frame (the shoulder hangs from the torso).
    person.torso.getWorldQuaternion(qTorso);
    root.getWorldQuaternion(qRoot);
    qa.copy(qRoot).invert().multiply(qTorso).invert();
    qShoulder.copy(qa).multiply(qWorld);
    qElbow.setFromAxisAngle(EX, bend);
  };

  /** Puts both hands on the grip for a frame; all in the golfer's frame. */
  const hands = (frame: SwingFrame) => {
    readShoulders();
    setTilt(fit.tilt);
    const arm = fit.arm0 + frame.arms;
    const shaft = arm + (fit.shaft0 - fit.arm0) + frame.cock;
    handPlace(arm, maxReach * (LEAD_REACH - 0.14 * frame.up));
    inPlane(shaft, dirS);
    const best = reachFix();
    hand2.copy(grip).addScaledVector(dirS, best);
    solveArm(sL, grip, poleLead, elbowL, qIkShoulderL, qIkElbowL, reached);
    solveArm(sR, hand2, poleTrail, elbowR, qIkShoulderR, qIkElbowR, reached);
    // The club: its y runs up the shaft, x is the face, which looks along the plane's perpendicular.
    by.copy(dirS).negate();
    inPlane(shaft - 90, bx);
    bz.crossVectors(bx, by);
    m.makeBasis(bx, by, bz);
    qIkClub.setFromRotationMatrix(m);
  };

  /** Where a club held in the right hand goes for a cheer (up) or a groan (down). */
  const hold = (up: boolean) => {
    local(person.handR.getWorldPosition(pHold));
    if (up) dHold.set(-0.35, 0.93, 0.1);
    else {
      const y = Math.min(Math.max((pHold.y - 0.06) / model.shaftLength, 0), 0.85);
      dHold.set(-1, 0, 0.25).normalize().multiplyScalar(Math.sqrt(1 - y * y));
      dHold.y = -y;
    }
    dHold.normalize();
    // The head hangs along dHold from the hand.
    by.copy(dHold).negate();
    bx.copy(EX).addScaledVector(by, -EX.dot(by)).normalize();
    bz.crossVectors(bx, by);
    m.makeBasis(bx, by, bz);
    qHoldClub.setFromRotationMatrix(m);
  };

  /** The club model's head tilt follows the plane so its sole lies flat at address. */
  const tiltHead = () => {
    model.head.rotation.x = (90 - fit.tilt) * RAD;
  };

  const attachClub = (spec: ClubSpec) => {
    if (spec.id !== clubId) {
      model.dispose();
      model = createClub(spec.id);
      root.add(model.group);
      clubId = spec.id;
    }
    kind = swingKind(spec);
    fit = fitFor(spec.id, kind);
    tiltHead();
  };

  attachClub({ id: 'driver', carry: 240 });

  let last: GolfMove | null = null;
  let clock = 0;

  const golfer: Golfer = {
    root,
    person,
    setClub: attachClub,
    play(move, t, delta) {
      if (move !== last) {
        animator.transition(last === null || move === 'address' ? 0.12 : 0.1);
        last = move;
      }
      clock += delta;
      const timing = SWING_TIMING[kind];
      let frame = swingFrame(kind, 0, fit.fix);
      ikGoal = 1;
      animator.step(delta, (p) => {
        switch (move) {
          case 'address':
            frame = swingFrame(kind, 0, fit.fix);
            // Waggle: the club head rocks a few centimetres either way.
            frame.cock += Math.sin(clock * 2 * Math.PI * 1.3) * 2 * (kind === 'putt' ? 0 : 1);
            bodyPose(frame, fit.lean, p);
            p.lift += Math.sin(clock * 1.8) * 0.004;
            break;
          case 'swing':
            frame = swingFrame(kind, Math.min(t, timing.seconds), fit.fix);
            bodyPose(frame, fit.lean, p);
            break;
          case 'follow':
            frame = swingFrame(kind, timing.seconds, fit.fix);
            bodyPose(frame, fit.lean, p);
            p.twist += Math.sin(clock * 2) * 0.02;
            p.lift += Math.sin(clock * 1.8) * 0.003;
            break;
          case 'cheer':
            ikGoal = 0;
            relaxed(p);
            p.armL.raise = p.armR.raise = 2.6 + Math.sin(t * 12) * 0.2;
            p.armL.out = p.armR.out = 0.35;
            p.lift += Math.abs(Math.sin(t * 9)) * 0.08;
            p.headPitch = 0.2;
            break;
          case 'groan':
            ikGoal = 0;
            relaxed(p);
            p.lean = 0.35;
            p.headPitch = -0.6;
            p.armL.raise = p.armR.raise = 0.15;
            p.armL.out = p.armR.out = 0.05;
            p.lift -= 0.03;
            p.roll = Math.sin(t * 3) * 0.04;
            break;
        }
      });
      const step = delta / 0.15;
      ikWeight = ikGoal > ikWeight ? Math.min(ikGoal, ikWeight + step) : Math.max(ikGoal, ikWeight - step);
      const wgt = ikWeight;
      if (ikGoal === 1 || wgt > 0) {
        hands(frame);
        const smooth = wgt * wgt * (3 - 2 * wgt);
        person.shoulderL.quaternion.slerp(qIkShoulderL, smooth);
        person.shoulderR.quaternion.slerp(qIkShoulderR, smooth);
        person.elbowL.quaternion.slerp(qIkElbowL, smooth);
        person.elbowR.quaternion.slerp(qIkElbowR, smooth);
        root.updateMatrixWorld(true);
        // The club: between the one in his hands and the one held in the right hand.
        hold(move === 'cheer');
        model.group.position.copy(grip);
        model.group.quaternion.copy(qIkClub);
        if (smooth < 1) {
          local(person.handR.getWorldPosition(pHold));
          model.group.position.lerpVectors(pHold, grip, smooth);
          model.group.quaternion.copy(qHoldClub).slerp(qIkClub, smooth);
        }
      } else {
        root.updateMatrixWorld(true);
        hold(move === 'cheer');
        model.group.position.copy(pHold);
        model.group.quaternion.copy(qHoldClub);
      }
    },
    stand(ball, dir, id) {
      const reach = reachFor(id);
      // His chest faces along (-cos dir, sin dir): the ball line is in front of him, the target on his left.
      const forward = { x: -Math.cos(dir), z: Math.sin(dir) };
      root.rotation.y = dir - Math.PI / 2;
      root.position.set(ball.x - forward.x * reach, 0, ball.z - forward.z * reach);
    },
    dispose() {
      model.dispose();
    },
  };
  golfer.play('address', 0, 1);
  return golfer;
}
