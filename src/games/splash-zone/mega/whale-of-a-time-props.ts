/**
 * The props of Whale of a Time: a palm-tree sandbar island, a big blue whale lying across the
 * course with its tail waiting to flick, and a second whale under a tall jet of spout. Bright
 * painted primitives; everything is built once and only moved.
 */
import {
  BufferGeometry,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  MeshStandardMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  type Mesh,
} from 'three';
import { clamp01, lerp, prog } from '../anim';
import type { Kit } from '../kit';
import { ENTRY_SPEED } from '../rules';
import { profile, type MegaBuilt } from './props-kit';
import {
  FIZZLE,
  PALM_HEIGHT,
  SANDBAR,
  SPOUT,
  TANGLE,
  T_FLICK,
  WHALE,
  sandbarY,
  spoutRise,
  spoutY,
  whaleBackAt,
  whaleY,
} from './whale-of-a-time';

const SAND = [0xffe2a0, 0xf3cf86] as const;

/** A palm tree: a leaning trunk and a crown of seven fronds that sways as a group. */
function makePalm(kit: Kit, parent: Group, d: number, s: number, y: number, seed: number) {
  const trunk = kit.lit(0x9a6a3a, 0.8);
  const leaf = [kit.lit(0x2f9d4a, 0.7), kit.lit(0x3fbf5f, 0.7), kit.lit(0x2a8a43, 0.7)];
  const nut = kit.lit(0x6b4423, 0.7);
  const root = new Group();
  root.position.set(s, y, -d);
  root.rotation.y = seed * 2.1;
  parent.add(root);
  const stem = new Group();
  stem.rotation.z = -0.1;
  root.add(stem);
  kit.mesh(new CylinderGeometry(0.14, 0.26, PALM_HEIGHT, 8), trunk, stem, 0, PALM_HEIGHT / 2, 0);
  const crown = new Group();
  crown.position.set(0, PALM_HEIGHT, 0);
  stem.add(crown);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const frond = kit.mesh(
      new ConeGeometry(0.42, 2.6, 5),
      leaf[i % 3],
      crown,
      Math.cos(a) * 1.05,
      -0.15,
      Math.sin(a) * 1.05,
    );
    frond.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15);
    frond.scale.set(1, 1, 0.3);
  }
  kit.mesh(new SphereGeometry(0.16, 8, 6), nut, crown, 0.15, -0.1, 0.1);
  kit.mesh(new SphereGeometry(0.16, 8, 6), nut, crown, -0.1, -0.1, -0.12);
  return { root, crown };
}

function buildSandbar(kit: Kit): MegaBuilt {
  const group = new Group();
  profile(
    kit,
    group,
    sandbarY,
    SANDBAR.foot - 0.5,
    SANDBAR.end + 0.5,
    1.0,
    -1.2,
    SANDBAR.halfWidth,
    SAND[0],
    SAND[1],
  );
  const palms = SANDBAR.palms.map(([d, s], i) => makePalm(kit, group, d, s, SANDBAR.top, i));
  const hit = 2;
  const swayAt = (time: number) => {
    palms.forEach((p, i) => {
      p.crown.rotation.z = 0.05 * Math.sin(time * 1.4 + i * 1.7);
      p.crown.rotation.x = 0.04 * Math.sin(time * 1.1 + i);
    });
  };
  return {
    group,
    update(outcome, t) {
      swayAt(t);
      if (outcome !== 'fail' || t < TANGLE.hitAt) return;
      // The palm that is hit shakes hard, then settles.
      const k = Math.exp(-(t - TANGLE.hitAt) * 1.6);
      const p = palms[hit];
      p.crown.rotation.z = 0.35 * k * Math.sin((t - TANGLE.hitAt) * 22);
      p.crown.rotation.x = 0.2 * k * Math.sin((t - TANGLE.hitAt) * 17);
    },
    ambient: swayAt,
    reset: () => swayAt(0),
  };
}

/** A smooth surface over (d, s) painted by height: the whale's back. */
function surfaceMesh(
  kit: Kit,
  parent: Group,
  height: (d: number, s: number) => number,
  d0: number,
  d1: number,
  s0: number,
  s1: number,
  nd: number,
  ns: number,
  colorAt: (y: number, s: number) => number,
): Mesh {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= nd; i++) {
    for (let j = 0; j <= ns; j++) {
      const d = lerp(d0, d1, i / nd);
      const s = lerp(s0, s1, j / ns);
      const y = height(d, s);
      positions.push(s, y - 0.12, -d);
      const c = colorAt(y, s);
      colors.push((c >> 16) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255);
    }
  }
  for (let i = 0; i < nd; i++) {
    for (let j = 0; j < ns; j++) {
      const a = i * (ns + 1) + j;
      const b = a + 1;
      const c = a + ns + 1;
      const e = c + 1;
      indices.push(a, b, c, b, e, c);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.45,
    side: DoubleSide,
  });
  kit.materials.push(material);
  return kit.mesh(geometry, material, parent);
}

/** The tail's angle (radians up from lying out on the water) by time into the element. */
export function tailAngle(outcome: 'clear' | 'fail', t: number): number {
  if (outcome === 'clear') return 0.1 + 0.08 * Math.sin(t * 2.4);
  const flick = T_FLICK;
  if (t < flick - 0.45) return 0.1 + 0.06 * Math.sin(t * 2.4);
  if (t < flick - 0.1) return lerp(0.1, -0.18, prog(t, flick - 0.45, flick - 0.1));
  if (t < flick + 0.18) return lerp(-0.18, 1.35, prog(t, flick - 0.1, flick + 0.18, 'o'));
  return lerp(1.35, 0.1, prog(t, flick + 0.18, flick + 0.9, 'io'));
}

function buildWhale(kit: Kit): MegaBuilt {
  const group = new Group();
  const body = new Group();
  group.add(body);
  surfaceMesh(
    kit,
    body,
    (d, s) => (whaleY(d) / WHALE.top) * whaleBackAt(s),
    WHALE.d - WHALE.half,
    WHALE.d + WHALE.half,
    -11,
    11,
    16,
    24,
    (y) => (y < 0.18 ? 0x8fb0cc : y < 0.7 ? 0x35577f : 0x233f63),
  );
  // The tail: a thick stalk and a wide fluke, hinged under the back at s = 3.5.
  const skin = kit.lit(0x4f719c, 0.45);
  const tail = new Group();
  tail.position.set(3.5, 0.5, -WHALE.d);
  group.add(tail);
  const stalk = kit.mesh(new CylinderGeometry(0.34, 0.9, 6.0, 12), skin, tail, 3.0, 0, 0);
  stalk.rotation.z = -Math.PI / 2;
  for (const side of [-1, 1]) {
    const lobe = kit.mesh(new SphereGeometry(1, 14, 8), skin, tail, 6.4, 0.05, side * 1.5);
    lobe.scale.set(0.9, 0.12, 1.9);
    lobe.rotation.y = side * -0.5;
  }
  // The blowhole and an eye on the near flank give the back a face of sorts.
  const dark = kit.lit(0x1d2a3c, 0.5);
  kit.mesh(
    new SphereGeometry(0.22, 8, 6),
    dark,
    body,
    -1.2,
    whaleBackAt(-1.2) - 0.05,
    -(WHALE.d + 1.0),
  );
  const eye = kit.mesh(
    new SphereGeometry(0.28, 10, 8),
    kit.lit(0xffffff, 0.4),
    body,
    -8.2,
    0.5,
    -(WHALE.d + 2.9),
  );
  kit.mesh(new SphereGeometry(0.15, 8, 6), dark, eye, -0.15, 0, -0.12);
  const poseTail = (angle: number) => {
    tail.rotation.z = angle;
  };
  const squash = (t: number) => {
    // The back dips as the ski lands on it.
    const k = Math.max(0, 1 - Math.abs(t - (WHALE.d / ENTRY_SPEED + 0.06)) / 0.25);
    body.scale.y = 1 - 0.12 * k;
  };
  return {
    group,
    update(outcome, t) {
      poseTail(tailAngle(outcome, t));
      squash(t);
    },
    ambient(time) {
      poseTail(tailAngle('clear', time));
    },
    reset() {
      poseTail(0.1);
      body.scale.y = 1;
    },
  };
}

/** The spout's current height, as a fraction of full, by time into the element. */
export function spoutLevel(outcome: 'clear' | 'fail', t: number): number {
  const rise = spoutRise(t);
  if (outcome === 'clear') return rise;
  const gone = clamp01((t - FIZZLE.at) / (FIZZLE.gone - FIZZLE.at));
  return rise * (1 - gone * gone);
}

function buildSpout(kit: Kit): MegaBuilt {
  const group = new Group();
  let tailWave: (time: number) => void = () => {};
  // The second whale, mostly under the water: a big dark back with a blowhole, and its tail
  // standing up out of the water further along, waving.
  const skin = kit.lit(0x4f719c, 0.45);
  const back = kit.mesh(new SphereGeometry(1, 20, 12), skin, group, 0.4, -0.35, -SPOUT.whaleD);
  back.scale.set(7.5, 1.5, 3.4);
  kit.mesh(
    new CylinderGeometry(0.4, 0.55, 0.3, 12),
    kit.lit(0x16233a, 0.5),
    group,
    0,
    0.55,
    -(SPOUT.foot + 0.3),
  );
  const tail = new Group();
  tail.position.set(7.5, -0.4, -(SPOUT.whaleD + 1));
  group.add(tail);
  const stalk = kit.mesh(new CylinderGeometry(0.28, 0.5, 3.2, 10), skin, tail, 0, 1.6, 0);
  stalk.rotation.z = -0.18;
  for (const side of [-1, 1]) {
    const lobe = kit.mesh(new SphereGeometry(1, 14, 8), skin, tail, -0.35, 3.3, side * 1.3);
    lobe.scale.set(0.2, 0.9, 1.7);
    lobe.rotation.x = side * -0.5;
  }
  tailWave = (time) => {
    tail.rotation.z = 0.12 * Math.sin(time * 1.6);
  };
  // The jet: a fat curved pipe of white water from the foot up to the crown, with foam at its base.
  const jet = new Group();
  group.add(jet);
  const water = kit.lit(0xe6f8ff, 0.55);
  const points: Vector3[] = [];
  for (let i = 0; i <= 12; i++) {
    const d = lerp(SPOUT.foot, SPOUT.crownD, i / 12);
    points.push(new Vector3(0, spoutY(d) - 1.0, -d));
  }
  kit.mesh(new TubeGeometry(new CatmullRomCurve3(points), 28, 1.05, 12), water, jet);
  const base = kit.mesh(
    new SphereGeometry(2.3, 14, 8),
    kit.lit(0xf4fcff, 0.9),
    group,
    0,
    0.05,
    -SPOUT.foot,
  );
  base.scale.y = 0.28;
  // The plume at the top: a cluster of foamy balls.
  const foam = kit.lit(0xf4fcff, 0.9);
  const plume = new Group();
  plume.position.set(0, SPOUT.crownY, -SPOUT.crownD);
  group.add(plume);
  const balls: Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    balls.push(
      kit.mesh(
        new SphereGeometry(0.85, 12, 8),
        foam,
        plume,
        Math.cos(a) * 1.2,
        0.15 + (i % 2) * 0.5,
        Math.sin(a) * 1.2,
      ),
    );
  }
  balls.push(kit.mesh(new SphereGeometry(1.3, 12, 8), foam, plume, 0, 0.7, 0));
  const pose = (level: number, time: number) => {
    // The jet grows up from the foot; the plume rides on its crown and bobs.
    jet.scale.y = Math.max(level, 0.001);
    jet.visible = level > 0.01;
    plume.visible = level > 0.01;
    plume.scale.setScalar(Math.max(level, 0.001));
    plume.position.y = SPOUT.crownY * level;
    balls.forEach((b, i) => b.scale.setScalar(1 + 0.08 * Math.sin(time * 6 + i)));
    tailWave(time);
  };
  return {
    group,
    update(outcome, t) {
      pose(spoutLevel(outcome, t), t);
    },
    ambient(time) {
      tailWave(time);
      if (jet.visible) pose(jet.scale.y, time);
    },
    reset() {
      pose(0, 0);
    },
  };
}

export function buildWhaleProps(kit: Kit): [MegaBuilt, MegaBuilt, MegaBuilt] {
  return [buildSandbar(kit), buildWhale(kit), buildSpout(kit)];
}
