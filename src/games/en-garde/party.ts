import {
  BoxGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  PlaneGeometry,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
  BufferGeometry,
  Float32BufferAttribute,
  type Object3D,
} from 'three';
import { CAKE_TOP } from './moves';
import { createAnimator, createPerson, easeOut, type Animator, type Person } from './person';
import type { Effects } from './effects';

/** The cake table, as the fighters' target. */
export const TABLE = { x: 0, y: 0, z: CAKE_TOP.z };
const TABLE_HEIGHT = 0.75;
const CAKE_HEIGHT = 0.55;
/** Seconds the cake takes to squash. */
const SQUASH_SECONDS = 0.12;
const KID_SCALE = 0.6;
const KID_SPOTS = [-3.2, -2.6, 2.6, 3.2];
const KID_COLORS = [0xff6b6b, 0x7ae582, 0xffd23f, 0xb185ff];
const BALLOON_COLORS = [0xff4d6d, 0xffd23f, 0x4cc9f0, 0x7ae582, 0xb185ff, 0xff9f1c];
const BUNTING_COLORS = [0xff4d6d, 0xffd23f, 0x4cc9f0, 0x7ae582];

const flat = (color: number, extra: ConstructorParameters<typeof MeshStandardMaterial>[0] = {}) =>
  new MeshStandardMaterial({ color, roughness: 0.8, ...extra });

export interface Party {
  object: Object3D;
  /** Sways the kids and bobs the balloons. */
  update(delta: number, elapsed: number): void;
  cake: {
    /** The cake is squashed and cream flies. */
    splat(): void;
    /** A whole cake again. */
    reset(): void;
  };
  kids: {
    /** The watching kids hop with arms up for `seconds`. */
    cheer(seconds?: number): void;
    /** They slump for `seconds`. */
    slump(seconds?: number): void;
  };
}

function stripedLawn(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 1;
  const g = canvas.getContext('2d');
  if (g) {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#7bd16a' : '#6cc25c';
      g.fillRect(i, 0, 1, 1);
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(3, 1);
  texture.magFilter = NearestFilter;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** A backyard birthday party: lawn, fence, bunting, balloons, a cake table and four watching kids. */
export function buildParty(effects: Pick<Effects, 'cream'>): Party {
  const object = new Group();

  // Light.
  object.add(new HemisphereLight(0xffffff, 0x88aa77, 1.5));
  const sun = new DirectionalLight(0xffffff, 1.8);
  sun.position.set(2, 5, 4);
  object.add(sun);

  // Lawn, hedge and fence.
  const lawn = new Mesh(
    new PlaneGeometry(40, 24),
    new MeshStandardMaterial({ map: stripedLawn(), roughness: 1 }),
  );
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(0, 0, 4);
  object.add(lawn);
  const hedge = new Mesh(new BoxGeometry(40, 1.6, 0.8), flat(0x3f9d4f));
  hedge.position.set(0, 0.8, -4.1);
  object.add(hedge);

  const pickets = new InstancedMesh(new BoxGeometry(0.13, 1.0, 0.04), flat(0xffffff), 90);
  const m = new Matrix4();
  for (let i = 0; i < 90; i++) {
    m.makeTranslation(-9 + i * 0.2, 0.5, -3.2);
    pickets.setMatrixAt(i, m);
  }
  object.add(pickets);
  for (const y of [0.3, 0.75]) {
    const rail = new Mesh(new BoxGeometry(18, 0.07, 0.05), flat(0xf1f1f1));
    rail.position.set(0, y, -3.16);
    object.add(rail);
  }

  // Two poles and a string of bunting.
  const poleTop = 2.55;
  const poleX = 3.4;
  for (const side of [-1, 1]) {
    const pole = new Mesh(new CylinderGeometry(0.04, 0.05, poleTop, 8), flat(0xb98b5a));
    pole.position.set(side * poleX, poleTop / 2, -2.8);
    object.add(pole);
  }
  const string = new CatmullRomCurve3([
    new Vector3(-poleX, poleTop, -2.8),
    new Vector3(-poleX / 2, poleTop - 0.32, -2.8),
    new Vector3(0, poleTop - 0.4, -2.8),
    new Vector3(poleX / 2, poleTop - 0.32, -2.8),
    new Vector3(poleX, poleTop, -2.8),
  ]);
  object.add(new Mesh(new TubeGeometry(string, 24, 0.012, 4), flat(0x3a3a3a)));
  const flag = new BufferGeometry();
  flag.setAttribute(
    'position',
    new Float32BufferAttribute([-0.11, 0, 0, 0.11, 0, 0, 0, -0.26, 0], 3),
  );
  flag.computeVertexNormals();
  const flags = 17;
  for (let i = 0; i < flags; i++) {
    const p = string.getPoint((i + 0.5) / flags);
    const tri = new Mesh(
      flag,
      new MeshBasicMaterial({ color: BUNTING_COLORS[i % BUNTING_COLORS.length], side: 2 }),
    );
    tri.position.copy(p);
    object.add(tri);
  }

  // Balloons tied to the fence, bobbing.
  const balloons: { group: Group; phase: number }[] = [];
  BALLOON_COLORS.forEach((color, i) => {
    const group = new Group();
    const x = -3.9 + i * 1.56;
    const height = 0.75 + (i % 3) * 0.22;
    const ball = new Mesh(new SphereGeometry(0.2, 14, 12), flat(color, { roughness: 0.25 }));
    ball.scale.y = 1.2;
    ball.position.y = height;
    const thread = new Mesh(new CylinderGeometry(0.004, 0.004, height - 0.2, 4), flat(0xdddddd));
    thread.position.y = (height - 0.2) / 2;
    group.add(ball, thread);
    group.position.set(x, 1.0, -3.0);
    object.add(group);
    balloons.push({ group, phase: i * 1.3 });
  });

  // The cake table, with a three-tier cake and gifts.
  const table = new Group();
  table.position.set(TABLE.x, 0, TABLE.z);
  const cloth = new Mesh(new BoxGeometry(1.7, TABLE_HEIGHT, 0.9), flat(0xffffff));
  cloth.position.y = TABLE_HEIGHT / 2;
  const hem = new Mesh(new BoxGeometry(1.74, 0.06, 0.94), flat(0xffe0ea));
  hem.position.y = 0.08;
  table.add(cloth, hem);
  object.add(table);

  const cakeGroup = new Group();
  cakeGroup.position.set(TABLE.x, TABLE_HEIGHT, TABLE.z);
  const tiers: [number, number, number, number][] = [
    // radius, height, y, colour
    [0.5, 0.2, 0.1, 0xff9ec4],
    [0.38, 0.17, 0.285, 0xffffff],
    [0.26, 0.18, 0.46, 0xff9ec4],
  ];
  for (const [r, h, y, color] of tiers) {
    const tier = new Mesh(new CylinderGeometry(r, r, h, 28), flat(color, { roughness: 0.5 }));
    tier.position.y = y;
    cakeGroup.add(tier);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const dollop = new Mesh(new SphereGeometry(0.032, 8, 6), flat(0xfff3f6));
      dollop.position.set(Math.cos(a) * r, y + h / 2, Math.sin(a) * r);
      cakeGroup.add(dollop);
    }
  }
  const flames: Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const candle = new Mesh(
      new CylinderGeometry(0.013, 0.013, 0.12, 6),
      flat([0xffd23f, 0x4cc9f0, 0xff4d6d][i % 3]),
    );
    candle.position.set(Math.cos(a) * 0.15, CAKE_HEIGHT + 0.06, Math.sin(a) * 0.15);
    const flame = new Mesh(
      new ConeGeometry(0.018, 0.05, 6),
      new MeshBasicMaterial({ color: 0xffa62b }),
    );
    flame.position.set(candle.position.x, CAKE_HEIGHT + 0.145, candle.position.z);
    flames.push(flame);
    cakeGroup.add(candle, flame);
  }
  object.add(cakeGroup);

  for (const [x, color, ribbon] of [
    [-1.25, 0x4cc9f0, 0xffd23f],
    [1.3, 0xb185ff, 0xff4d6d],
  ] as const) {
    const gift = new Group();
    const size = 0.36;
    gift.add(new Mesh(new BoxGeometry(size, size, size), flat(color)));
    const a = new Mesh(new BoxGeometry(size + 0.01, size + 0.01, 0.06), flat(ribbon));
    const b = new Mesh(new BoxGeometry(0.06, size + 0.01, size + 0.01), flat(ribbon));
    gift.add(a, b);
    gift.position.set(x, size / 2, TABLE.z + 0.15);
    gift.rotation.y = x * 0.2;
    object.add(gift);
  }

  // The watching kids.
  const kids: { person: Person; animator: Animator; phase: number; x: number }[] = KID_SPOTS.map(
    (x, i) => {
      const person = createPerson({ shirt: KID_COLORS[i], pants: 0x3a4a6a, hat: 'party' });
      person.setHat('party', KID_COLORS[(i + 2) % KID_COLORS.length]);
      person.setScale(KID_SCALE);
      person.root.position.set(x, 0, -2.6);
      person.root.rotation.y = -Math.sign(x) * 0.25;
      object.add(person.root);
      return { person, animator: createAnimator(person), phase: i * 1.7, x };
    },
  );
  let kidMode: 'sway' | 'cheer' | 'slump' = 'sway';
  let kidUntil = 0;
  let kidStart = 0;
  let lastElapsed = 0;

  // The cake squash.
  let squash = 0;
  let squashing = false;

  return {
    object,
    cake: {
      splat() {
        squashing = true;
        squash = 0;
        effects.cream(CAKE_TOP);
      },
      reset() {
        squashing = false;
        squash = 0;
        cakeGroup.scale.set(1, 1, 1);
        for (const flame of flames) flame.visible = true;
      },
    },
    kids: {
      cheer(seconds = 1) {
        kidMode = 'cheer';
        kidStart = lastElapsed;
        kidUntil = lastElapsed + seconds;
        for (const kid of kids) kid.animator.transition(0.12);
      },
      slump(seconds = 1) {
        kidMode = 'slump';
        kidStart = lastElapsed;
        kidUntil = lastElapsed + seconds;
        for (const kid of kids) kid.animator.transition(0.2);
      },
    },
    update(delta, elapsed) {
      lastElapsed = elapsed;
      if (kidMode !== 'sway' && elapsed >= kidUntil) {
        kidMode = 'sway';
        for (const kid of kids) kid.animator.transition(0.3);
      }
      for (const kid of kids) {
        kid.animator.step(delta, (pose) => {
          const t = elapsed + kid.phase;
          if (kidMode === 'cheer') {
            const k = elapsed - kidStart;
            pose.lift = Math.abs(Math.sin(k * 11)) * 0.14;
            pose.armL.raise = pose.armR.raise = 2.8;
            pose.armL.out = pose.armR.out = 0.3;
            pose.headPitch = 0.2;
          } else if (kidMode === 'slump') {
            pose.lean = 0.3;
            pose.headPitch = -0.45;
            pose.armL.bend = pose.armR.bend = 0.2;
            pose.armL.raise = pose.armR.raise = 0.1;
          } else {
            pose.roll = Math.sin(t * 1.6) * 0.05;
            pose.armL.out = pose.armR.out = 0.1 + Math.sin(t * 1.6) * 0.05;
            pose.lift = Math.max(0, Math.sin(t * 3.1)) * 0.015;
          }
        });
      }
      for (const b of balloons) {
        b.group.position.y = 1.0 + Math.sin(elapsed * 1.3 + b.phase) * 0.04;
        b.group.rotation.z = Math.sin(elapsed * 1 + b.phase) * 0.05;
      }
      flames.forEach((flame, i) => {
        flame.scale.y = 0.85 + Math.sin(elapsed * 14 + i * 2) * 0.2;
      });
      if (squashing && squash < 1) {
        squash = Math.min(1, squash + delta / SQUASH_SECONDS);
        const k = easeOut(squash);
        cakeGroup.scale.set(1 + 0.2 * k, 1 - 0.45 * k, 1 + 0.2 * k);
      }
    },
  };
}
