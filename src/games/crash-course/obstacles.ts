/**
 * The ten obstacles, built from bright painted primitives. Each one's group has its origin at
 * the entry line on the road. `update(outcome, variant, t)` poses the props for any moment of any
 * stunt (the same timeline the bike follows), `ambient(time)` keeps the idle bits moving, and
 * `reset()` puts everything back for the next ride.
 */
import {
  BoxGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type Material,
  type Object3D,
} from 'three';
import { Kit, lerp, ribbon, ribbonMaterial, smooth, type Placed } from './kit';
import type { ObstacleKind, Outcome, Variant } from './rules';
import {
  BRIDGE_FROM,
  BRIDGE_PLANKS,
  BRIDGE_TO,
  CANYON_FLOOR,
  CRATE_COUNT,
  coasterSurface,
  crateAt,
  createFrame,
  fly,
  halfpipeSurface,
  HP_CXL,
  HP_CXR,
  HP_DECK_L0,
  HP_DECK_L1,
  HP_DECK_R1,
  HP_KICK_LEN,
  HP_LIP,
  HP_WH,
  LOOP_CX,
  LOOP_CY,
  LOOP_R,
  penguinAt,
  penguinLane,
  PENGUIN_COUNT,
  PENGUIN_HOME,
  PG_HOOP_X,
  PG_ICE_FROM,
  PG_ICE_TO,
  PG_LANE_Z,
  plankAt,
  POOL_FLOOR,
  POOL_FROM,
  POOL_TO,
  rampSurface,
  RING_R,
  RING_X,
  RING_Y,
  ringKicker,
  SEESAW_FROM,
  SEESAW_PIVOT_X,
  SEESAW_PIVOT_Y,
  SEESAW_TILT,
  SEESAW_TO,
  seesawAngle,
  SPECS,
  stuntBeats,
  stuntFrame,
  TAU,
  WATER_Y,
  WR_L,
  WR_PX,
  WR_R,
  WR_TOP,
  WR_Z,
  wreckerAngle,
  type Frame,
  type Piece,
  type StuntSpec,
} from './stunts';

export interface Obstacle extends Placed {
  spec: StuntSpec;
  /** Poses the props for time `t` of the stunt. */
  update(outcome: Outcome, variant: Variant, t: number): void;
  dispose(): void;
}

interface Built {
  group: Group;
  update(outcome: Outcome, variant: Variant, t: number): void;
  ambient(time: number): void;
  reset(): void;
}

const WOOD = 0xc98a4a;
const RED = 0xe8403a;
const WHITE = 0xf6f6f6;
const GOLD = 0xffcf33;
const BLUE = 0x1e66d6;

/** Scratch frame for props that follow the bike or the rider. */
const scratch: Frame = createFrame();
const piece: Piece = { x: 0, y: 0, rot: 0, scale: 1, visible: true };

// ---------- Loop-the-loop ----------

function buildLoop(kit: Kit): Built {
  const group = new Group();
  const blue = kit.lit(BLUE, 0.4);
  const yellow = kit.lit(0xffd43b, 0.5);
  const steel = kit.lit(0x8791a8, 0.5);
  const ring = kit.mesh(
    new TorusGeometry(LOOP_R + 0.2, 0.2, 10, 80),
    blue,
    group,
    LOOP_CX,
    LOOP_CY,
    -0.5,
  );
  ring.scale.z = 3.2;
  // Yellow chevron plates on the track surface.
  for (let i = 0; i < 28; i++) {
    const phi = (i / 28) * TAU;
    const plate = kit.box(0.34, 0.05, 1.0, yellow, group);
    const r = LOOP_R - 0.01;
    plate.position.set(LOOP_CX + Math.sin(phi) * r, LOOP_CY - Math.cos(phi) * r, -0.5);
    plate.rotation.z = phi;
  }
  // Legs holding the ring up, behind it.
  for (const side of [-1, 1]) {
    const leg = kit.box(0.28, 4.2, 0.28, steel, group, LOOP_CX + side * 3.9, 2.0, -1.4);
    leg.rotation.z = side * 0.38;
    kit.box(0.2, 0.2, 2.4, steel, group, LOOP_CX + side * 3.1, 3.2, -1.1);
  }
  kit.box(7.8, 0.22, 0.22, steel, group, LOOP_CX, 6.3, -1.4);
  // The haystack for "Cannonball".
  const hay = new Group();
  hay.position.set(12.2, 0, 0);
  const strawLight = kit.lit(0xe9c45a, 1);
  const strawDark = kit.lit(0xc79a35, 1);
  const mound = kit.mesh(new SphereGeometry(1, 16, 12), strawLight, hay, 0, 0.35, 0);
  mound.scale.set(1.6, 1.25, 1.3);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU;
    const straw = kit.box(0.05, 0.7, 0.05, i % 2 ? strawDark : strawLight, hay);
    straw.position.set(
      Math.cos(a) * (0.5 + (0.8 * ((i * 7) % 5)) / 5),
      1.5 + ((i * 3) % 4) * 0.08,
      ((i * 5) % 7) / 7 - 0.5,
    );
    straw.rotation.z = Math.cos(a) * 0.6;
  }
  group.add(hay);
  hay.visible = false;
  const beats = stuntBeats('loop', 'crash', 1);

  return {
    group,
    update(outcome, variant, t) {
      hay.visible = outcome === 'crash' && variant === 1;
      if (hay.visible) {
        const grow = smooth((t - beats.hay) / 0.35);
        hay.scale.set(grow, 0.001 + grow, grow);
        // A squash when the rider lands in it.
        const dent = Math.max(0, 1 - Math.abs(t - beats.land - 0.06) / 0.2);
        hay.scale.y *= 1 - 0.14 * dent;
      }
    },
    ambient() {},
    reset() {
      hay.visible = false;
    },
  };
}

// ---------- Ramp over the shark pool ----------

function buildRamp(kit: Kit): Built {
  const group = new Group();
  const rib = ribbonMaterial(kit);
  const kickerMesh = kit.mesh(ribbon(rampSurface, 0, 4, 0.5, 0, 1.5, RED, WHITE), rib, group);
  const landing = kit.mesh(ribbon(rampSurface, 13, 17, 0.5, 0, 1.5, WHITE, RED), rib, group);
  void kickerMesh;
  void landing;
  // The pool.
  const width = POOL_TO - POOL_FROM;
  const midX = (POOL_FROM + POOL_TO) / 2;
  kit.box(width, 14, 0.2, kit.lit(0x5c6b86, 1), group, midX, -7, -3.0);
  kit.box(width, 0.4, 4.2, kit.lit(0xe6cf9a, 1), group, midX, POOL_FLOOR - 0.2, -0.9);
  const water = kit.box(
    width,
    WATER_Y - POOL_FLOOR,
    4.2,
    kit.glass(0x3fb4f0, 0.5),
    group,
    midX,
    (WATER_Y + POOL_FLOOR) / 2,
    -0.9,
  );
  void water;
  const surface = kit.mesh(
    new PlaneGeometry(width, 4.2),
    kit.glass(0x9fe0ff, 0.55),
    group,
    midX,
    WATER_Y + 0.01,
    -0.9,
  );
  surface.rotation.x = -Math.PI / 2;
  // The shark.
  const shark = new Group();
  const grey = kit.lit(0x7c8da3, 0.5);
  const belly = kit.lit(0xe9eef5, 0.5);
  const finShape = new Shape();
  finShape.moveTo(-0.5, 0);
  finShape.quadraticCurveTo(-0.1, 0.5, 0.2, 1.25);
  finShape.quadraticCurveTo(0.35, 0.5, 0.65, 0);
  finShape.lineTo(-0.5, 0);
  const fin = kit.mesh(
    new ExtrudeGeometry(finShape, { depth: 0.14, bevelEnabled: false }),
    grey,
    shark,
    0,
    0,
    -0.07,
  );
  void fin;
  const body = kit.mesh(new SphereGeometry(1, 16, 12), grey, shark, 0, -0.55, 0);
  body.scale.set(1.8, 0.7, 0.8);
  const bellyMesh = kit.mesh(new SphereGeometry(1, 14, 10), belly, shark, 0.25, -0.75, 0.15);
  bellyMesh.scale.set(1.5, 0.45, 0.7);
  const jaw = new Group();
  jaw.position.set(1.4, -0.65, 0);
  shark.add(jaw);
  kit.box(0.9, 0.12, 0.7, belly, jaw, 0.3, -0.06, 0);
  const teeth = kit.lit(0xffffff, 0.3);
  for (let i = 0; i < 4; i++)
    kit.mesh(new ConeGeometry(0.06, 0.14, 4), teeth, jaw, 0.1 + i * 0.2, 0.05, 0.2);
  const eye = kit.mesh(
    new SphereGeometry(0.1, 8, 6),
    kit.lit(0x111111, 0.3),
    shark,
    1.15,
    -0.3,
    0.55,
  );
  void eye;
  const hat = kit.mesh(
    new SphereGeometry(0.4, 14, 8, 0, TAU, 0, Math.PI / 2),
    kit.lit(RED, 0.3),
    shark,
    1.0,
    0.0,
    0,
  );
  hat.visible = false;
  shark.position.set(8.5, WATER_Y, 0);
  group.add(shark);
  // A swim ring with a duck head for the rider.
  const duck = new Group();
  const yellow = kit.lit(0xffd43b, 0.4);
  kit.mesh(new TorusGeometry(0.55, 0.24, 10, 24), yellow, duck).rotation.x = Math.PI / 2;
  const duckHead = kit.mesh(new SphereGeometry(0.27, 12, 10), yellow, duck, 0.75, 0.3, 0);
  void duckHead;
  kit.box(0.28, 0.08, 0.2, kit.lit(0xff9f1c, 0.5), duck, 1.0, 0.27, 0);
  kit.mesh(new SphereGeometry(0.04, 6, 4), kit.lit(0x111111, 0.3), duck, 0.9, 0.4, 0.2);
  duck.visible = false;
  group.add(duck);
  const sunk = stuntBeats('ramp', 'crash', 0);
  /** The shark circles on the clock of the page; a stunt starts it from where it was. */
  let sharkTime = 0;
  let clock = 0;
  let stuntActive = false;

  const snap = (outcome: Outcome, variant: Variant) => stuntBeats('ramp', outcome, variant).snap;

  const place = (x: number, lift: number, tilt: number, open: number, flip: boolean) => {
    shark.position.set(x, WATER_Y + lift, 0);
    shark.scale.x = flip ? -1 : 1;
    shark.rotation.z = tilt * (flip ? -1 : 1);
    jaw.rotation.z = -open;
  };

  return {
    group,
    update(outcome, variant, t) {
      stuntActive = true;
      hat.visible = false;
      duck.visible = false;
      const circle = (time: number) => 8.5 + 3.3 * Math.sin(1.3 * time);
      const dir = (time: number) => Math.cos(1.3 * time) >= 0;
      if (outcome === 'clear') {
        const at = snap(outcome, variant);
        const u = (t - at) / 0.8;
        if (u > 0 && u < 1) {
          // The fin leaps up after the bike, snaps, and misses.
          place(
            8.9 + 0.4 * u,
            2.7 * Math.sin(Math.PI * u),
            0.5 * (u - 0.4),
            Math.sin(Math.PI * Math.min(u * 1.7, 1)) * 0.5 + (u > 0.55 && u < 0.7 ? -0.2 : 0),
            false,
          );
        } else {
          const time = sharkTime + t;
          place(t < at ? circle(time) : 9 + 3 * Math.sin(1.3 * (time - 0.8)), 0, 0, 0, !dir(time));
        }
        return;
      }
      if (variant === 1) {
        place(circle(sharkTime + t), 0, 0, 0, !dir(sharkTime + t));
        return;
      }
      // Splash: the shark surfaces wearing the helmet, and the rider bobs up on a swim ring.
      const showDuck = t >= sunk.duck;
      if (showDuck) {
        scratch.rider.mode = 'seated';
        stuntFrame('ramp', 'crash', 0, t, scratch);
        duck.visible = true;
        const pop = smooth((t - sunk.duck) / 0.25);
        duck.scale.setScalar(pop);
        duck.position.set(scratch.rider.x, WATER_Y + 0.12, 0);
      }
      const u = (t - sunk.shark) / 0.9;
      if (u > 0 && u < 1) {
        hat.visible = true;
        place(
          scratch.rider.x + 2.2,
          2.0 * Math.sin(Math.PI * u),
          0.3,
          0.4 * Math.sin(Math.PI * u),
          true,
        );
      } else {
        hat.visible = t >= sunk.shark;
        place(
          t < sunk.shark ? circle(sharkTime + t) : scratch.rider.x + 2.4,
          0,
          0,
          0,
          t >= sunk.shark || !dir(sharkTime + t),
        );
      }
    },
    ambient(time) {
      clock = time;
      if (stuntActive) return;
      const x = 8.5 + 3.3 * Math.sin(1.3 * time);
      place(x, 0, 0, 0, Math.cos(1.3 * time) < 0);
      hat.visible = false;
      duck.visible = false;
    },
    reset() {
      stuntActive = false;
      sharkTime = clock;
      hat.visible = false;
      duck.visible = false;
    },
  };
}

// ---------- Ring of fire ----------

/** The water trough waits behind the road, out of the bike's way. */
const TUB_Z = -1.6;

function buildRing(kit: Kit): Built {
  const group = new Group();
  const rib = ribbonMaterial(kit);
  kit.mesh(ribbon(ringKicker, 0, 3, 0.5, 0, 1.5, RED, WHITE), rib, group);
  // The stand: a candy-striped post.
  const stand = new Group();
  stand.position.set(RING_X, 0, 0);
  group.add(stand);
  const stripeRed = kit.lit(RED, 0.5);
  const stripeWhite = kit.lit(WHITE, 0.5);
  const postH = RING_Y - RING_R + 0.15;
  for (let i = 0; i < 6; i++) {
    const h = postH / 6;
    kit.mesh(
      new CylinderGeometry(0.14, 0.14, h, 10),
      i % 2 ? stripeWhite : stripeRed,
      stand,
      0,
      h * (i + 0.5),
      0,
    );
  }
  kit.mesh(new CylinderGeometry(0.55, 0.65, 0.18, 16), kit.lit(0x394057, 0.7), stand, 0, 0.09, 0);

  // The ring and its fire.
  const ringRoot = new Group();
  ringRoot.position.set(RING_X, RING_Y, 0);
  group.add(ringRoot);
  const ringYaw = new Group();
  ringYaw.rotation.y = 0.5;
  ringRoot.add(ringYaw);
  kit.mesh(new TorusGeometry(RING_R - 0.26, 0.26, 12, 40), kit.lit(GOLD, 0.25), ringYaw);
  const flames: Mesh[] = [];
  const outer = kit.basic(0xff7a1a, 0.9);
  const inner = kit.basic(0xffd84a, 0.95);
  const FLAMES = 22;
  for (let i = 0; i < FLAMES; i++) {
    const a = (i / FLAMES) * TAU;
    const big = i % 2 === 0;
    const flame = kit.mesh(
      new ConeGeometry(big ? 0.28 : 0.2, big ? 1.0 : 0.7, 6),
      big ? outer : inner,
      ringYaw,
    );
    const r = RING_R - 0.05;
    flame.position.set(-Math.sin(a) * r, Math.cos(a) * r, 0);
    flame.rotation.z = a;
    flame.userData.base = flame.scale.clone();
    flames.push(flame);
  }
  // A water trough with a rubber duck, beyond the bike's path.
  const tub = new Group();
  tub.position.set(13, 0, TUB_Z);
  group.add(tub);
  const board = kit.lit(0x9a6a3a, 0.8);
  kit.box(1.9, 1.0, 0.14, board, tub, 0, 0.5, 0.8);
  kit.box(1.9, 1.0, 0.14, board, tub, 0, 0.5, -0.8);
  kit.box(0.14, 1.0, 1.6, board, tub, 0.95, 0.5, 0);
  kit.box(0.14, 1.0, 1.6, board, tub, -0.95, 0.5, 0);
  kit.box(1.8, 0.1, 1.6, board, tub, 0, 0.05, 0);
  const tubWater = kit.mesh(new PlaneGeometry(1.8, 1.6), kit.glass(0x5cc2f5, 0.85), tub, 0, 0.8, 0);
  tubWater.rotation.x = -Math.PI / 2;
  const duck = new Group();
  const yellow = kit.lit(0xffd43b, 0.4);
  kit.mesh(new SphereGeometry(0.28, 12, 10), yellow, duck).scale.set(1.2, 0.8, 0.9);
  kit.mesh(new SphereGeometry(0.17, 10, 8), yellow, duck, 0.28, 0.25, 0);
  kit.box(0.14, 0.05, 0.1, kit.lit(0xff9f1c, 0.5), duck, 0.46, 0.22, 0);
  duck.position.set(-0.45, 0.85, 0.25);
  tub.add(duck);

  const bonk = stuntBeats('ring', 'crash', 0);
  const toast = stuntBeats('ring', 'crash', 1);
  let flare = 1;
  let fire = 1;
  let idleTime = 0;

  const resetRing = () => {
    stand.rotation.z = 0;
    ringRoot.position.set(RING_X, RING_Y, 0);
    ringRoot.rotation.set(0, 0, 0);
    ringRoot.scale.setScalar(1);
    ringRoot.position.z = 0;
    flare = 1;
    fire = 1;
    duck.position.set(-0.45, 0.85, 0.25);
    tub.position.z = TUB_Z;
  };

  return {
    group,
    update(outcome, variant, t) {
      resetRing();
      if (outcome === 'clear') {
        const pass = stuntBeats('ring', outcome, variant).pass;
        const bump = Math.exp(-(((t - pass) / 0.25) ** 2));
        flare = variant === 0 ? 1 + 0.35 * bump : 1 + 0.65 * bump;
        fire = 1 + (variant === 0 ? 0.8 : 1.6) * bump;
        ringRoot.scale.setScalar(flare);
        return;
      }
      if (variant === 0) {
        // Bonk: the stand topples and the burning ring rolls off behind the action.
        const dt = t - bonk.hit;
        if (dt > 0) {
          stand.rotation.z = -1.45 * smooth(dt / 0.55);
          const roll = Math.max(0, dt - 0.15);
          const x = RING_X + 3 * dt + 7 * roll * roll * 0.5 + 5 * roll;
          const y = Math.max(RING_R, RING_Y - 0.5 * 18 * dt * dt);
          ringRoot.position.set(x, y, -1.7 * smooth(dt / 0.4));
          ringRoot.rotation.z = -(x - RING_X) / RING_R;
          ringRoot.rotation.y = 0;
          ringYaw.rotation.y = 0.5;
          fire = 1.3;
        }
        // The duck pops up when the rider splashes in.
        // The trough is wheeled into the runner's path just before he jumps in.
        tub.position.z = lerp(TUB_Z, 0, smooth((t - bonk.jump + 0.55) / 0.4));
        const jump = (t - bonk.tub) / 0.5;
        if (jump > 0 && jump < 1) duck.position.y = 0.85 + 1.4 * Math.sin(Math.PI * jump);
        return;
      }
      // Toast: the stand falls over, and the ring drops round the rider's middle like a swim ring.
      const dt = t - toast.hit;
      if (dt > 0) {
        const tip = -1.3 * smooth(dt / 0.45);
        stand.rotation.z = tip;
        const topX = RING_X - RING_Y * Math.sin(tip);
        const topY = RING_Y * Math.cos(tip);
        stuntFrame('ring', 'crash', 1, t, scratch);
        const a = smooth((t - toast.ring) / 0.55);
        ringRoot.position.set(
          lerp(topX, scratch.rider.x, a),
          lerp(topY, scratch.rider.y + 0.15, a),
          0,
        );
        ringRoot.rotation.set(a * 1.15, 0, tip * (1 - a));
        ringRoot.scale.setScalar(lerp(1, 0.46, a));
        fire = 1 - a;
      }
    },
    ambient(time) {
      idleTime = time;
      for (let i = 0; i < flames.length; i++) {
        const flame = flames[i];
        const base = flame.userData.base as Vector3;
        const flick =
          0.75 +
          0.35 * Math.sin(idleTime * 11 + i * 1.7) +
          0.15 * Math.sin(idleTime * 23 + i * 3.1);
        const s = Math.max(fire, 0.001);
        flame.scale.set(base.x * (0.6 + 0.4 * s), base.y * flick * s, base.z * (0.6 + 0.4 * s));
        flame.visible = fire > 0.02;
      }
    },
    reset() {
      resetRing();
    },
  };
}

// ---------- Wall of crates ----------

function buildCrates(kit: Kit): Built {
  const group = new Group();
  const wood = kit.lit(WOOD, 0.8);
  const woodDark = kit.lit(0x8a5a2a, 0.9);
  const crateTexture = (label: string, base: string, ink: string, face?: 'smile') =>
    kit.paint(128, 128, (g) => {
      g.fillStyle = base;
      g.fillRect(0, 0, 128, 128);
      g.strokeStyle = '#6b4220';
      g.lineWidth = 10;
      g.strokeRect(5, 5, 118, 118);
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(8, 8);
      g.lineTo(120, 120);
      g.moveTo(120, 8);
      g.lineTo(8, 120);
      g.stroke();
      g.fillStyle = ink;
      g.font = '800 19px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if (face === 'smile') {
        g.fillStyle = '#ffd43b';
        g.beginPath();
        g.arc(64, 64, 38, 0, TAU);
        g.fill();
        g.fillStyle = '#222';
        g.beginPath();
        g.arc(50, 54, 5, 0, TAU);
        g.arc(78, 54, 5, 0, TAU);
        g.fill();
        g.lineWidth = 5;
        g.beginPath();
        g.arc(64, 68, 20, 0.15 * Math.PI, 0.85 * Math.PI);
        g.stroke();
      } else {
        g.fillStyle = ink;
        g.fillRect(14, 46, 100, 36);
        g.fillStyle = base;
        g.fillText(label, 64, 65);
      }
    });
  const faceTextures = [
    crateTexture('FRAGILE', '#d9954f', '#b3261e'),
    crateTexture('TNT', '#d9402f', '#222222'),
    crateTexture('', '#d9954f', '#222', 'smile'),
    crateTexture('THIS WAY', '#d9954f', '#2457b3'),
  ];
  const materials: Material[][] = faceTextures.map((tex, i) => {
    const front = new MeshStandardMaterial({
      color: tex ? 0xffffff : i === 1 ? 0xd9402f : WOOD,
      map: tex ?? undefined,
      roughness: 0.8,
    });
    kit.materials.push(front);
    return [wood, wood, woodDark, woodDark, front, front];
  });
  const crates: Mesh[] = [];
  const kinds = [0, 0, 3, 1, 2, 0, 3, 0, 2];
  for (let i = 0; i < CRATE_COUNT; i++) {
    const geometry = new BoxGeometry(1, 1, 1.4);
    const crate = new Mesh(geometry, materials[kinds[i] % materials.length]);
    kit.geometries.push(geometry);
    group.add(crate);
    crates.push(crate);
  }
  const apply = (outcome: Outcome, variant: Variant, t: number) => {
    for (let i = 0; i < CRATE_COUNT; i++) {
      crateAt(outcome, variant, i, t, piece);
      const c = crates[i];
      c.visible = piece.visible;
      c.position.set(piece.x, piece.y, 0);
      c.rotation.z = piece.rot;
      c.scale.setScalar(i === 8 ? 0.55 : 1);
      // Clear of the road whatever the spin.
      c.position.y = Math.max(c.position.y, 0.42);
    }
  };
  return {
    group,
    update: apply,
    ambient() {},
    reset() {
      apply('clear', 0, 0);
    },
  };
}

// ---------- Wobbly plank bridge ----------

function buildBridge(kit: Kit): Built {
  const group = new Group();
  const width = BRIDGE_TO - BRIDGE_FROM;
  const midX = (BRIDGE_FROM + BRIDGE_TO) / 2;
  // The canyon: dark back wall in bands, a rocky floor, a stream and a tiny waterfall.
  const rock = [0x6f5a4a, 0x7d6652, 0x5d4a3e];
  for (let i = 0; i < 6; i++) {
    kit.box(
      width,
      14 / 6,
      0.2,
      kit.lit(rock[i % 3], 1),
      group,
      midX,
      -0.5 - (14 / 6) * (i + 0.5) + 0.5,
      -3.0,
    );
  }
  kit.box(width, 0.5, 4.2, kit.lit(0x6a5a50, 1), group, midX, CANYON_FLOOR - 0.25, -0.9);
  const stream = kit.mesh(
    new PlaneGeometry(width, 2.2),
    kit.glass(0x4cb8f0, 0.85),
    group,
    midX,
    CANYON_FLOOR + 0.12,
    -1.0,
  );
  stream.rotation.x = -Math.PI / 2;
  const fall = kit.box(
    0.5,
    3.6,
    0.3,
    kit.glass(0xe6f6ff, 0.8),
    group,
    BRIDGE_TO - 0.8,
    CANYON_FLOOR + 2.0,
    -2.8,
  );
  kit.box(1.4, 0.4, 0.8, kit.lit(0x6a5a50, 1), group, BRIDGE_TO - 0.8, CANYON_FLOOR + 3.8, -2.7);
  kit.box(1.4, 3, 1.2, kit.lit(0x5d4a3e, 1), group, BRIDGE_FROM + 0.4, CANYON_FLOOR + 1.5, -2.4);

  // Planks with rope rails.
  const plankMat = kit.lit(0xb07a40, 0.85);
  const plankDark = kit.lit(0x8a5a2e, 0.9);
  const ropeMat = kit.lit(0xd9c08a, 0.9);
  const postMat = kit.lit(0x7a5230, 0.9);
  const planks: Mesh[] = [];
  const posts: Mesh[][] = [[], []];
  const ropes: Mesh[][] = [[], []];
  for (let i = 0; i < BRIDGE_PLANKS; i++) {
    planks.push(kit.box(0.94, 0.16, 2.2, i % 2 ? plankMat : plankDark, group));
    group.add(planks[i]);
    for (const s of [0, 1]) {
      posts[s].push(kit.box(0.09, 1.0, 0.09, postMat, group));
      if (i > 0) ropes[s].push(kit.box(1, 0.05, 0.05, ropeMat, group));
    }
  }
  const SIDE_Z = [1.05, -1.05];
  const placePlanks = (outcome: Outcome, variant: Variant, t: number) => {
    const tops: Vector3[][] = [[], []];
    for (let i = 0; i < BRIDGE_PLANKS; i++) {
      plankAt(outcome, variant, i, t, piece);
      const p = planks[i];
      p.position.set(piece.x, piece.y - 0.08, 0);
      p.rotation.z = piece.rot;
      for (const s of [0, 1]) {
        const post = posts[s][i];
        post.position.set(piece.x, piece.y + 0.5, SIDE_Z[s]);
        post.rotation.z = piece.rot;
        tops[s].push(new Vector3(piece.x, piece.y + 1.0, SIDE_Z[s]));
      }
    }
    for (const s of [0, 1]) {
      for (let i = 1; i < BRIDGE_PLANKS; i++) {
        const a = tops[s][i - 1];
        const b = tops[s][i];
        const rope = ropes[s][i - 1];
        const length = a.distanceTo(b);
        rope.visible = length < 1.9;
        rope.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, a.z);
        rope.scale.x = length;
        rope.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
      }
    }
  };
  placePlanks('clear', 0, 0);
  let flow = 0;

  return {
    group,
    update: placePlanks,
    ambient(time) {
      flow = time;
      fall.scale.x = 0.8 + 0.25 * Math.sin(flow * 14);
    },
    reset() {
      placePlanks('clear', 0, 0);
    },
  };
}

// ---------- See-saw ----------

function buildSeesaw(kit: Kit): Built {
  const group = new Group();
  const red = kit.lit(RED, 0.45);
  const wood = kit.lit(0xe2a24c, 0.7);
  const white = kit.lit(WHITE, 0.6);
  // The pivot: a red triangle, 1.2 tall.
  const tri = new Shape();
  tri.moveTo(-1.1, 0);
  tri.lineTo(1.1, 0);
  tri.lineTo(0, SEESAW_PIVOT_Y - 0.05);
  tri.lineTo(-1.1, 0);
  const pivot = kit.mesh(
    new ExtrudeGeometry(tri, { depth: 1.6, bevelEnabled: false }),
    red,
    group,
    SEESAW_PIVOT_X,
    0,
    -0.8,
  );
  void pivot;
  // The plank, hinged at the top of the pivot.
  const plank = new Group();
  plank.position.set(SEESAW_PIVOT_X, SEESAW_PIVOT_Y, 0);
  group.add(plank);
  const length = SEESAW_TO - SEESAW_FROM;
  kit.box(length, 0.3, 2.0, wood, plank, 0, -0.15, 0);
  for (let i = 0; i < 5; i++) kit.box(0.5, 0.02, 2.0, white, plank, -4 + i * 2, 0.0, 0);
  for (const end of [-1, 1]) {
    kit.box(0.2, 0.28, 2.0, red, plank, end * (length / 2 - 0.1), 0.14, 0);
  }
  kit.mesh(
    new CylinderGeometry(0.2, 0.2, 2.3, 10),
    kit.lit(0x394057, 0.5),
    plank,
    0,
    -0.12,
    0,
  ).rotation.x = Math.PI / 2;
  const pose = (angle: number) => {
    plank.rotation.z = angle;
  };
  pose(SEESAW_TILT);
  return {
    group,
    update(outcome, variant, t) {
      pose(seesawAngle(outcome, variant, t));
    },
    ambient() {},
    reset() {
      pose(SEESAW_TILT);
    },
  };
}

// ---------- Rollercoaster ----------

function buildCoaster(kit: Kit): Built {
  const group = new Group();
  const rib = ribbonMaterial(kit);
  const bottom = (x: number) => coasterSurface(x) - 0.3;
  kit.mesh(ribbon(coasterSurface, 0, 24, 0.25, bottom, 0.85, 0x2f6fd6, 0x2a62c0), rib, group);
  for (const z of [-0.6, 0.6]) {
    kit.mesh(
      ribbon(
        (x) => coasterSurface(x) + 0.09,
        0,
        24,
        0.25,
        (x) => coasterSurface(x) + 0.02,
        0.07,
        0xffd43b,
        0xffd43b,
        z,
      ),
      rib,
      group,
    );
  }
  // Steel trestles holding the track up.
  const trestles = new Group();
  group.add(trestles);
  const steel = kit.lit(0x8c97ab, 0.45);
  for (let x = 1; x <= 23; x += 2) {
    const h = bottom(x);
    if (h < 0.4) continue;
    for (const z of [-0.65, 0.65]) kit.box(0.14, h, 0.14, steel, trestles, x, h / 2, z);
    kit.box(0.1, 0.1, 1.4, steel, trestles, x, h * 0.55, 0);
    if (x < 23) {
      const h2 = bottom(x + 2);
      if (h2 >= 0.4) {
        const hm = Math.min(h, h2) * 0.5;
        for (const z of [-0.65, 0.65]) {
          const brace = kit.box(2.7, 0.08, 0.08, steel, trestles, x + 1, hm + 0.3, z);
          brace.rotation.z = Math.atan2(hm * 0.6, 2) * (x % 4 === 1 ? 1 : -1);
        }
      }
    }
  }
  // The corkscrew over the middle hill.
  const points: Vector3[] = [];
  for (let i = 0; i <= 60; i++) {
    const u = i / 60;
    const x = 9.9 + u * 4.2;
    const a = u * TAU * 1.0;
    points.push(
      new Vector3(x, coasterSurface(x) + 0.55 + 1.2 * Math.sin(a), 1.25 * Math.cos(a) - 0.1),
    );
  }
  kit.mesh(
    new TubeGeometry(new CatmullRomCurve3(points), 72, 0.09, 6, false),
    kit.lit(0xff7a1a, 0.4),
    group,
  );

  // Cotton candy stand (it blows up in "Derail").
  const stand = new Group();
  stand.position.set(20.4, 0, 0.9);
  group.add(stand);
  const pink = kit.lit(0xff9fcf, 0.9);
  kit.box(2.0, 1.1, 1.2, kit.lit(0xfff1f7, 0.7), stand, 0, 0.55, 0);
  for (let i = 0; i < 4; i++)
    kit.box(0.5, 1.12, 1.22, kit.lit(0xff6fb0, 0.7), stand, -0.75 + i * 0.5, 0.56, 0);
  kit.box(2.4, 0.12, 1.6, kit.lit(0xe8403a, 0.6), stand, 0, 2.0, 0.1);
  for (const x of [-1.1, 1.1]) kit.box(0.1, 0.9, 0.1, steel, stand, x, 1.55, 0.7);
  const fluffs: Mesh[] = [];
  for (let i = 0; i < 9; i++) {
    const fluff = kit.mesh(
      new SphereGeometry(0.34, 10, 8),
      pink,
      stand,
      -0.8 + (i % 5) * 0.4,
      1.35 + Math.floor(i / 5) * 0.35,
      0.1,
    );
    fluff.userData.home = fluff.position.clone();
    fluffs.push(fluff);
  }
  stand.visible = false;
  const beard = new Group();
  for (let i = 0; i < 5; i++) {
    kit.mesh(
      new SphereGeometry(0.17 + (i % 2) * 0.04, 8, 6),
      pink,
      beard,
      -0.2 + i * 0.1,
      -0.2 - (i % 3) * 0.06,
      0.2 - (i % 2) * 0.05,
    );
  }
  beard.visible = false;
  group.add(beard);

  // Giant inflatable duck (it catches the rider in "Roll out").
  const duck = new Group();
  duck.position.set(15.6, 0, -1.4);
  group.add(duck);
  const yellow = kit.lit(0xffd43b, 0.35);
  kit.mesh(new SphereGeometry(1, 20, 14), yellow, duck, 0, 1.5, 0).scale.set(1.55, 1.0, 1.1);
  kit.mesh(new SphereGeometry(0.65, 16, 12), yellow, duck, 1.35, 2.7, 0);
  kit.box(0.6, 0.15, 0.5, kit.lit(0xff9f1c, 0.4), duck, 1.95, 2.6, 0);
  kit.mesh(new SphereGeometry(0.09, 8, 6), kit.lit(0x111111, 0.3), duck, 1.65, 2.9, 0.5);
  kit
    .mesh(new SphereGeometry(0.6, 12, 10), kit.lit(0xffe066, 0.35), duck, -0.3, 1.7, 0.9)
    .scale.set(1.3, 0.8, 0.4);
  duck.visible = false;
  const roll = stuntBeats('coaster', 'crash', 1);
  const derail = stuntBeats('coaster', 'crash', 0);

  return {
    group,
    update(outcome, variant, t) {
      stand.visible = outcome === 'crash' && variant === 0;
      duck.visible = outcome === 'crash' && variant === 1;
      beard.visible = false;
      trestles.position.x = 0.05 * Math.sin(t * 40) * (t > 0.2 ? 1 : 0);
      if (stand.visible) {
        stand.scale.setScalar(smooth((t - 0.2) / 0.4));
        const boom = t - derail.stand;
        for (const fluff of fluffs) {
          const home = fluff.userData.home as Vector3;
          const k = fluffs.indexOf(fluff);
          if (boom <= 0) {
            fluff.position.copy(home);
            fluff.scale.setScalar(1);
            continue;
          }
          const dir = ((k % 3) - 1) * 2.4 + (k % 2 ? 0.8 : -0.8);
          const p = fly(
            home.x,
            home.y,
            dir,
            3 + (k % 4),
            0,
            0,
            0.3,
            boom,
            { x: 0, y: 0, rot: 0, scale: 1, visible: true },
            12,
          );
          fluff.position.set(p.x, p.y, home.z);
          fluff.scale.setScalar(Math.max(0, 1 - boom * 0.45));
        }
        if (boom > 0.2) {
          stuntFrame('coaster', outcome, variant, t, scratch);
          beard.visible = true;
          beard.position.set(scratch.rider.x + 0.32, scratch.rider.y + 0.5, 0.1);
          beard.scale.setScalar(smooth((boom - 0.2) / 0.3));
        }
      }
      if (duck.visible) {
        const pop = smooth((t - 0.5) / 0.5);
        let squash = 1;
        for (const c of [roll.c1, roll.c2, roll.c3])
          squash -= 0.16 * Math.exp(-(((t - c - 0.05) / 0.1) ** 2));
        duck.scale.set(
          Math.max(pop, 0.001) * (2 - squash),
          Math.max(pop, 0.001) * squash,
          Math.max(pop, 0.001),
        );
      }
    },
    ambient() {},
    reset() {
      stand.visible = false;
      duck.visible = false;
      beard.visible = false;
      trestles.position.x = 0;
      for (const fluff of fluffs) {
        fluff.position.copy(fluff.userData.home as Vector3);
        fluff.scale.setScalar(1);
      }
    },
  };
}

// ---------- Skate half-pipe ----------

function buildHalfpipe(kit: Kit): Built {
  const group = new Group();
  const rib = ribbonMaterial(kit);
  // The orange kicker, then the grey concrete bowl with a deck at each end.
  kit.mesh(ribbon(halfpipeSurface, 0, HP_KICK_LEN, 0.3, 0, 1.5, 0xff9d2e, 0xf08a1c), rib, group);
  kit.mesh(
    ribbon(halfpipeSurface, HP_DECK_L0, HP_DECK_R1, 0.2, 0, 1.5, 0xb7bfd0, 0xa7afc2),
    rib,
    group,
  );
  // Red coping along each lip.
  const red = kit.lit(RED, 0.45);
  for (const x of [HP_DECK_L1, HP_LIP]) {
    kit.box(0.28, 0.16, 3.1, red, group, x, HP_WH + 0.05, 0);
  }
  // Blue rails behind the decks.
  const blue = kit.lit(BLUE, 0.5);
  for (const [x0, x1] of [
    [HP_DECK_L0 + 0.1, HP_DECK_L1 - 0.2],
    [HP_LIP + 0.1, HP_DECK_R1],
  ]) {
    kit.box(x1 - x0, 0.08, 0.08, blue, group, (x0 + x1) / 2, HP_WH + 0.9, -1.4);
    kit.box(0.08, 0.9, 0.08, blue, group, x0, HP_WH + 0.45, -1.4);
    kit.box(0.08, 0.9, 0.08, blue, group, x1, HP_WH + 0.45, -1.4);
  }
  // A lamp on the left deck.
  const steel = kit.lit(0x8791a8, 0.5);
  kit.box(0.14, 4.6, 0.14, steel, group, HP_DECK_L0 + 0.35, 2.3 + HP_WH * 0.5, -1.4);
  const lamp = kit.mesh(
    new SphereGeometry(0.34, 14, 10),
    kit.basic(0xfff1a8),
    group,
    HP_DECK_L0 + 0.35,
    4.7 + HP_WH * 0.5,
    -1.3,
  );
  // The banner between two poles above the bowl.
  const bannerTex = kit.paint(512, 96, (g) => {
    g.fillStyle = '#1e66d6';
    g.fillRect(0, 0, 512, 96);
    g.fillStyle = '#ffd43b';
    g.fillRect(0, 0, 512, 10);
    g.fillRect(0, 86, 512, 10);
    g.fillStyle = '#ffffff';
    g.font = '900 60px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('SKATE PARK', 256, 50);
  });
  const bannerMaterial = kit.basic(0xffffff);
  if (bannerTex) bannerMaterial.map = bannerTex;
  else bannerMaterial.color.set(BLUE);
  const midBowl = (HP_CXL + HP_CXR) / 2;
  const banner = kit.mesh(new PlaneGeometry(6.2, 1.1), bannerMaterial, group, midBowl, 5.0, -1.5);
  for (const x of [midBowl - 3.2, midBowl + 3.2]) {
    kit.box(0.14, 5.6, 0.14, steel, group, x, 2.8, -1.5);
  }
  return {
    group,
    update() {},
    ambient(time) {
      banner.rotation.z = 0.02 * Math.sin(time * 1.4);
      lamp.scale.setScalar(1 + 0.05 * Math.sin(time * 5));
    },
    reset() {
      banner.rotation.z = 0;
    },
  };
}

// ---------- Penguin pond ----------

function buildPenguin(kit: Kit, scarfColor: number): Group {
  const g = new Group();
  const black = kit.lit(0x1d2433, 0.6);
  const white = kit.lit(0xf7f9ff, 0.5);
  const orange = kit.lit(0xff9a1f, 0.5);
  const scarf = kit.lit(scarfColor, 0.7);
  const body = kit.mesh(new SphereGeometry(0.5, 16, 12), black, g, 0, 0.6, 0);
  body.scale.set(0.8, 1.1, 0.7);
  const belly = kit.mesh(new SphereGeometry(0.42, 14, 10), white, g, 0, 0.55, 0.2);
  belly.scale.set(0.75, 1.05, 0.5);
  kit.mesh(new SphereGeometry(0.3, 14, 10), black, g, 0, 1.25, 0);
  const beak = kit.mesh(new ConeGeometry(0.1, 0.26, 10), orange, g, 0, 1.2, 0.32);
  beak.rotation.x = Math.PI / 2;
  for (const side of [-1, 1]) {
    kit.mesh(new SphereGeometry(0.085, 10, 8), white, g, side * 0.12, 1.33, 0.24);
    kit.mesh(new SphereGeometry(0.045, 8, 6), black, g, side * 0.12, 1.33, 0.31);
    kit.box(0.3, 0.08, 0.4, orange, g, side * 0.18, 0.04, 0.12);
    kit.box(0.1, 0.5, 0.22, black, g, side * 0.44, 0.65, 0).rotation.z = side * 0.4;
  }
  const wrap = kit.mesh(new TorusGeometry(0.27, 0.07, 8, 16), scarf, g, 0, 1.0, 0);
  wrap.rotation.x = Math.PI / 2;
  g.scale.setScalar(1.1);
  return g;
}

function buildPenguins(kit: Kit): Built {
  const group = new Group();
  // The ice: a pale slab over the road with a scatter of sparkles.
  const iceLength = PG_ICE_TO - PG_ICE_FROM;
  const mid = (PG_ICE_FROM + PG_ICE_TO) / 2;
  kit.box(iceLength, 0.05, 4.3, kit.lit(0xa9dcf7, 0.15), group, mid, 0.02, -0.9);
  const sparkle = kit.basic(0xffffff);
  for (let i = 0; i < 26; i++) {
    const x = PG_ICE_FROM + 0.4 + ((i * 0.53) % (iceLength - 0.8));
    const z = -2.4 + ((i * 7) % 11) * 0.36;
    kit.box(0.1, 0.02, 0.1, sparkle, group, x, 0.06, z).rotation.y = i;
  }
  // The hoop between the first two penguins, and a snowbank at the end for the splat.
  kit.mesh(
    new TorusGeometry(1.25, 0.11, 10, 40),
    kit.lit(RED, 0.4),
    group,
    PG_HOOP_X,
    1.6,
    PG_LANE_Z,
  );
  kit.box(0.14, 0.5, 0.14, kit.lit(WHITE, 0.6), group, PG_HOOP_X, 0.25, PG_LANE_Z);
  const snow = kit.lit(0xf4fbff, 0.9);
  const bank = kit.mesh(new SphereGeometry(1, 18, 12), snow, group, 15.6, 0, -1.3);
  bank.scale.set(1.7, 0.95, 1.1);
  // The heap that lands on top of whoever slid into the bank.
  const heap = new Group();
  for (const [x, y, r] of [
    [0, 0.5, 0.9],
    [-0.8, 0.3, 0.6],
    [0.8, 0.3, 0.65],
    [0.1, 1.0, 0.55],
  ]) {
    kit.mesh(new SphereGeometry(r, 14, 10), snow, heap, x, y, 0);
  }
  group.add(heap);
  const penguins: Group[] = [];
  const scarves = [RED, BLUE, 0x2fbf71, GOLD, 0xff8fd0, 0xb28dff, 0xff6b3a];
  for (let i = 0; i < PENGUIN_COUNT; i++) {
    const p = buildPenguin(kit, scarves[i % scarves.length]);
    group.add(p);
    penguins.push(p);
  }
  const beats = stuntBeats('penguins', 'crash', 1);
  let playing = false;
  const apply = (outcome: Outcome, variant: Variant, t: number) => {
    playing = true;
    for (let i = 0; i < PENGUIN_COUNT; i++) {
      penguinAt(outcome, variant, i, t, piece);
      const p = penguins[i];
      p.visible = piece.visible;
      p.position.set(piece.x, piece.y, penguinLane(outcome, variant, i, t));
      p.rotation.z = piece.rot;
    }
    if (outcome === 'crash' && variant === 1) {
      const drop = Math.min(1, Math.max(0, (t - beats.snow) / 0.35));
      heap.visible = t >= beats.snow - 0.5;
      heap.position.set(14.6, (1 - drop * drop) * 4.5, -0.3);
      const land = Math.max(0, 1 - Math.abs(t - beats.snow - 0.38) / 0.2);
      heap.scale.set(1 + 0.15 * land, 1 - 0.2 * land, 1);
    } else {
      heap.visible = false;
    }
  };
  const idle = () => {
    for (let i = 0; i < PENGUIN_COUNT; i++) {
      const p = penguins[i];
      p.visible = true;
      p.position.set(PENGUIN_HOME[i], 0, PG_LANE_Z);
      p.rotation.z = 0;
    }
    heap.visible = false;
  };
  idle();
  return {
    group,
    update: apply,
    ambient(time) {
      if (playing) return;
      for (let i = 0; i < PENGUIN_COUNT; i++) {
        penguins[i].rotation.z = 0.06 * Math.sin(time * 2.2 + i * 1.3);
      }
    },
    reset() {
      playing = false;
      idle();
    },
  };
}

// ---------- Wrecking balls ----------

function buildWrecker(kit: Kit): Built {
  const group = new Group();
  const steel = kit.lit(0x8791a8, 0.5);
  const yellow = kit.lit(0xffcf33, 0.5);
  const dark = kit.lit(0x2b3140, 0.45);
  // The gantry: two legs and a beam with a warning stripe.
  for (const x of [WR_PX[0] - 2.4, WR_PX[2] + 2.4]) {
    kit.box(0.45, WR_TOP + 0.4, 0.45, yellow, group, x, (WR_TOP + 0.4) / 2, WR_Z - 0.5);
    kit.box(1.1, 0.2, 1.1, steel, group, x, 0.1, WR_Z - 0.5);
  }
  const beamLength = WR_PX[2] - WR_PX[0] + 4.8;
  const beamMid = (WR_PX[0] + WR_PX[2]) / 2;
  kit.box(beamLength, 0.5, 0.55, yellow, group, beamMid, WR_TOP + 0.25, WR_Z);
  for (let i = 0; i < 18; i++) {
    const x = beamMid - beamLength / 2 + 0.5 + i * 0.75;
    kit.box(0.28, 0.52, 0.57, dark, group, x, WR_TOP + 0.25, WR_Z).rotation.z = 0.5;
  }
  // The balls on their chains, hung from the beam.
  const swings: Group[] = [];
  const ballColors = [0x394057, 0x4a5370, 0x394057];
  for (let i = 0; i < 3; i++) {
    const pivot = new Group();
    pivot.position.set(WR_PX[i], WR_TOP, WR_Z);
    group.add(pivot);
    const chainLength = WR_L - WR_R + 0.1;
    const chain = new CylinderGeometry(0.07, 0.07, chainLength, 8);
    kit.mesh(chain, steel, pivot, 0, -chainLength / 2, 0);
    for (let k = 1; k < 6; k++) {
      kit.box(0.28, 0.12, 0.2, steel, pivot, 0, -(chainLength * k) / 6, 0);
    }
    kit.mesh(new SphereGeometry(WR_R, 22, 16), kit.lit(ballColors[i], 0.35), pivot, 0, -WR_L, 0);
    kit.mesh(new TorusGeometry(WR_R * 0.98, 0.09, 8, 28), yellow, pivot, 0, -WR_L, 0);
    swings.push(pivot);
  }
  // The foam that catches a bashed bike.
  const foam = new Group();
  const colors = [0xff8fd0, 0x7be07b, 0x4dd0e1, 0xffd43b, 0xffffff];
  for (let i = 0; i < 12; i++) {
    const column = (i * 5) % 7;
    const high = Math.floor(i / 6) * 0.55 * (1 - Math.abs(column - 3) / 4);
    const material = kit.lit(colors[i % colors.length], 0.9);
    const block = kit.box(
      0.9,
      0.7,
      1.2,
      material,
      foam,
      column * 0.45 - 1.3,
      0.35 + high,
      (i % 3) * 0.3 - 0.6,
    );
    block.rotation.set(0.1 * i, 0.4 * i, 0.15 * (i % 4));
  }
  foam.position.set(10.3, 0, -0.2);
  group.add(foam);
  const beats = stuntBeats('wrecker', 'crash', 0);
  let playing = false;
  const apply = (outcome: Outcome, variant: Variant, t: number) => {
    playing = true;
    for (let i = 0; i < 3; i++) swings[i].rotation.z = wreckerAngle(outcome, variant, i, t);
    if (outcome === 'crash' && variant === 0) {
      const grow = smooth((t - beats.land) / 0.25);
      foam.visible = grow > 0;
      foam.scale.set(grow, 0.001 + grow, grow);
    } else {
      foam.visible = false;
    }
  };
  foam.visible = false;
  return {
    group,
    update: apply,
    ambient(time) {
      if (playing) return;
      for (let i = 0; i < 3; i++) swings[i].rotation.z = 0.35 * Math.sin(time * 1.7 + i * 1.4);
    },
    reset() {
      playing = false;
      foam.visible = false;
      for (let i = 0; i < 3; i++) swings[i].rotation.z = 0;
    },
  };
}

const BUILDERS: Record<ObstacleKind, (kit: Kit) => Built> = {
  loop: buildLoop,
  ramp: buildRamp,
  ring: buildRing,
  crates: buildCrates,
  bridge: buildBridge,
  seesaw: buildSeesaw,
  coaster: buildCoaster,
  halfpipe: buildHalfpipe,
  penguins: buildPenguins,
  wrecker: buildWrecker,
};

const CUTS: Record<ObstacleKind, readonly [number, number] | null> = {
  loop: null,
  ramp: [POOL_FROM, POOL_TO],
  ring: null,
  crates: null,
  bridge: [BRIDGE_FROM, BRIDGE_TO],
  seesaw: null,
  coaster: null,
  halfpipe: null,
  penguins: null,
  wrecker: null,
};

export function createObstacle(kind: ObstacleKind): Obstacle {
  const kit = new Kit();
  const built = BUILDERS[kind](kit);
  built.reset();
  built.ambient(0);
  void CircleGeometry;
  void LOOP_R;
  return {
    object: built.group,
    spec: SPECS[kind],
    length: SPECS[kind].length,
    cuts: CUTS[kind] ? [CUTS[kind]] : [],
    update: built.update,
    ambient: built.ambient,
    reset: built.reset,
    dispose() {
      built.group.removeFromParent();
      kit.dispose();
    },
  };
}

/** Keeps one built instance per kind, made when first needed, so a long ride never allocates. */
export function createObstaclePool(): {
  get(kind: ObstacleKind): Obstacle;
  dispose(): void;
} {
  const made = new Map<ObstacleKind, Obstacle>();
  return {
    get(kind) {
      let obstacle = made.get(kind);
      if (!obstacle) {
        obstacle = createObstacle(kind);
        made.set(kind, obstacle);
      }
      return obstacle;
    },
    dispose() {
      made.forEach((o) => o.dispose());
      made.clear();
    },
  };
}

export type { Object3D };
