/**
 * The toy robots and goofy monsters: what `createPerson` adds on a person's joints when its style has a
 * `body`. Each body is a few meshes on the torso and head, made to read from far away and to be cute
 * (big googly eyes, buck teeth, round hands), never scary. `tick` spins the wind-up key, wags tails and
 * wobbles the googly pupils. No DOM.
 */
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import type { Body } from './rules';

/** Colours the limbs and hands of a person with this body (the arms and legs stay the rig's). */
export interface BodyPalette {
  skin: number;
  pants: number;
  shoe: number;
  shirt: number;
  hand: number;
  /** How much bigger than a kid's the hands are drawn. */
  handScale: number;
}

const shade = (hex: number, k: number): number => {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * k));
  const b = Math.min(255, Math.round((hex & 255) * k));
  return (r << 16) | (g << 8) | b;
};

export function bodyPalette(body: Body, color: number): BodyPalette {
  const robot = (p: Omit<BodyPalette, 'handScale'>, handScale: number): BodyPalette => ({
    ...p,
    handScale,
  });
  switch (body) {
    case 'toy-robot':
      return robot(
        { skin: 0xcdd5df, pants: color, shoe: 0x374151, shirt: color, hand: color },
        1.5,
      );
    case 'box-robot':
      return robot(
        { skin: 0xbfc7d1, pants: 0x8c6a43, shoe: 0x374151, shirt: 0xb98650, hand: 0xe5e9f0 },
        1.25,
      );
    case 'giga-bot':
      return robot(
        { skin: 0x6f84a3, pants: 0x5b6f8c, shoe: 0x2f3b4f, shirt: color, hand: 0xe5e9f0 },
        1.4,
      );
    case 'robo-rex':
      return robot(
        {
          skin: shade(color, 0.85),
          pants: color,
          shoe: 0xf8961e,
          shirt: color,
          hand: shade(color, 0.85),
        },
        1.1,
      );
    default:
      return robot(
        { skin: color, pants: color, shoe: shade(color, 0.7), shirt: color, hand: color },
        1.3,
      );
  }
}

export interface Costume {
  /** Moves the wind-up key, tails and googly pupils; `hurry` spins the key faster. */
  tick(delta: number, hurry: boolean): void;
}

interface Wobble {
  pupil: Mesh;
  x: number;
  y: number;
  radius: number;
  phase: number;
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

type StdParams = ConstructorParameters<typeof MeshStandardMaterial>[0];

/** Adds the body's pieces to the torso and head joints. */
export function buildBody(body: Body, color: number, torso: Group, head: Group): Costume {
  const wobbles: Wobble[] = [];
  const spinners: { node: Object3D; speed: number }[] = [];
  const wags: { node: Object3D; amount: number; speed: number }[] = [];
  let clock = 0;

  const std = (c: number, extra: StdParams = {}) =>
    new MeshStandardMaterial({ color: c, roughness: 0.6, ...extra });
  const white = std(0xffffff, { roughness: 0.3 });
  const dark = std(0x1b1b24, { roughness: 0.4 });
  const mouthMat = new MeshBasicMaterial({ color: 0x4a1d1d });
  const put = (
    geometry: BufferGeometry,
    material: Material,
    parent: Object3D,
    x = 0,
    y = 0,
    z = 0,
  ): Mesh => {
    const m = new Mesh(geometry, material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const googly = (parent: Object3D, x: number, y: number, z: number, r0: number, phase: number) => {
    const r = r0 * 1.2;
    put(new SphereGeometry(r, 14, 12), white, parent, x, y, z);
    const py = y - r * 0.1;
    const pupil = put(new SphereGeometry(r * 0.52, 10, 8), dark, parent, x, py, z + r * 0.62);
    wobbles.push({ pupil, x, y: py, radius: r * 0.28, phase });
  };
  const smile = (parent: Object3D, x: number, y: number, z: number, r: number) => {
    const s = put(new TorusGeometry(r, r * 0.17, 6, 14, Math.PI), mouthMat, parent, x, y, z);
    s.rotation.z = Math.PI;
    return s;
  };
  /** A fuzzy ball: a chunky flat-shaded ball and a scatter of tufts around it. */
  const fuzzBall = (
    parent: Object3D,
    mat: MeshStandardMaterial,
    r: number,
    y: number,
    sy: number,
    tufts: number,
  ) => {
    const g = new Group();
    g.position.set(0, y, 0);
    g.scale.y = sy;
    parent.add(g);
    put(new IcosahedronGeometry(r, 1), mat, g);
    for (let i = 0; i < tufts; i++) {
      const yy = 1 - (i / (tufts - 1)) * 2;
      const rad = Math.sqrt(1 - yy * yy);
      const a = i * GOLDEN;
      const px = Math.cos(a) * rad;
      const pz = Math.sin(a) * rad;
      if (pz > 0.55 && yy < 0.5) continue; // keep the face and belly clear
      put(new SphereGeometry(r * 0.2, 8, 6), mat, g, px * r * 0.93, yy * r * 0.93, pz * r * 0.93);
    }
  };
  const fur = std(color, { roughness: 1, flatShading: true });
  const pale = std(0xfff3e0, { roughness: 0.9 });
  const horn = std(0xfff3d6, { roughness: 0.5 });
  const horns = (parent: Object3D, count: 1 | 2 | 3, y: number, r: number) => {
    const xs = count === 1 ? [0] : count === 2 ? [-0.1, 0.1] : [-0.12, 0, 0.12];
    for (const x of xs) {
      const h = put(new ConeGeometry(r, r * 2.4, 8), horn, parent, x, y, 0);
      h.rotation.z = -x * 2.2;
    }
  };
  const teeth = (parent: Object3D, y: number, z: number) => {
    for (const x of [-0.028, 0.028]) {
      put(new BoxGeometry(0.045, 0.06, 0.016), white, parent, x, y, z);
    }
  };
  const tail = (parent: Object3D, ball: number) => {
    const g = new Group();
    g.position.set(0, 0.06, -0.2);
    parent.add(g);
    const stalk = put(new CylinderGeometry(0.03, 0.05, 0.2, 8), fur, g, 0, 0.1, -0.04);
    stalk.rotation.x = -0.8;
    put(new SphereGeometry(ball, 10, 8), fur, g, 0, 0.2, -0.14);
    wags.push({ node: g, amount: 0.5, speed: 5 });
  };
  const belly = (parent: Object3D, r: number, z: number) => {
    put(new SphereGeometry(r, 12, 10), pale, parent, 0, 0.18, z).scale.set(1, 1.1, 0.5);
  };

  switch (body) {
    case 'toy-robot': {
      const metal = std(0xe5e9f0, { roughness: 0.35, metalness: 0.3 });
      const main = std(color, { roughness: 0.4, metalness: 0.2 });
      const gold = std(0xffc928, { roughness: 0.3, metalness: 0.6 });
      put(new BoxGeometry(0.3, 0.32, 0.2), main, torso, 0, 0.2, 0);
      put(new BoxGeometry(0.18, 0.12, 0.012), metal, torso, 0, 0.24, 0.103);
      for (const [x, c] of [
        [-0.045, 0xe63946],
        [0.045, 0x4ade80],
      ] as const) {
        put(new SphereGeometry(0.022, 8, 6), std(c), torso, x, 0.24, 0.112);
      }
      put(new CylinderGeometry(0.05, 0.05, 0.1, 10), metal, torso, 0, 0.4, 0);
      put(new BoxGeometry(0.36, 0.3, 0.3), metal, head, 0, 0, 0);
      googly(head, -0.085, 0.045, 0.15, 0.075, 0);
      googly(head, 0.085, 0.045, 0.15, 0.075, 2);
      put(new BoxGeometry(0.16, 0.034, 0.02), mouthMat, head, 0, -0.085, 0.152);
      smile(head, 0, -0.045, 0.153, 0.06);
      for (const x of [-0.19, 0.19]) {
        const bolt = put(new CylinderGeometry(0.035, 0.035, 0.05, 10), gold, head, x, 0, 0);
        bolt.rotation.z = Math.PI / 2;
      }
      put(new CylinderGeometry(0.012, 0.012, 0.12, 6), metal, head, 0, 0.21, 0);
      put(new SphereGeometry(0.034, 10, 8), std(0xe63946), head, 0, 0.29, 0);
      // The wind-up key on the back.
      const key = new Group();
      key.position.set(0, 0.22, -0.1);
      torso.add(key);
      const stem = put(new CylinderGeometry(0.015, 0.015, 0.08, 6), gold, key, 0, 0, -0.03);
      stem.rotation.x = Math.PI / 2;
      put(new BoxGeometry(0.2, 0.05, 0.016), gold, key, 0, 0, -0.07);
      for (const x of [-0.1, 0.1])
        put(new TorusGeometry(0.04, 0.012, 6, 14), gold, key, x, 0, -0.07);
      spinners.push({ node: key, speed: 1.2 });
      break;
    }
    case 'box-robot': {
      const card = std(0xb98650, { roughness: 0.9 });
      const tape = std(0xe8d7a7, { roughness: 0.8 });
      const metal = std(color, { roughness: 0.4, metalness: 0.2 });
      put(new BoxGeometry(0.36, 0.34, 0.26), card, torso, 0, 0.2, 0);
      put(new BoxGeometry(0.07, 0.35, 0.27), tape, torso, 0, 0.2, 0);
      const button = put(
        new CylinderGeometry(0.055, 0.055, 0.03, 14),
        std(0xe63946),
        torso,
        0.09,
        0.12,
        0.135,
      );
      button.rotation.x = Math.PI / 2;
      put(
        new SphereGeometry(0.03, 8, 6),
        std(0xff6b6b, { roughness: 0.2 }),
        torso,
        0.09,
        0.12,
        0.15,
      ).scale.z = 0.5;
      put(new CylinderGeometry(0.05, 0.05, 0.08, 10), metal, torso, 0, 0.4, 0);
      put(new BoxGeometry(0.28, 0.26, 0.26), metal, head, 0, -0.01, 0);
      googly(head, -0.065, 0.04, 0.13, 0.07, 0);
      googly(head, 0.075, 0.025, 0.13, 0.043, 3);
      put(new BoxGeometry(0.13, 0.03, 0.02), mouthMat, head, 0, -0.075, 0.132);
      for (const x of [-0.1, 0.1]) {
        put(
          new SphereGeometry(0.022, 8, 6),
          std(0x9aa3b0, { metalness: 0.5 }),
          head,
          x,
          0.13,
          0.12,
        );
      }
      break;
    }
    case 'giga-bot': {
      const main = std(color, { roughness: 0.35, metalness: 0.4 });
      const trim = std(0x5b6f8c, { roughness: 0.4, metalness: 0.5 });
      const glow = new MeshBasicMaterial({ color: 0xffd23f });
      put(new BoxGeometry(0.46, 0.36, 0.28), main, torso, 0, 0.2, 0);
      const core = put(new CylinderGeometry(0.075, 0.075, 0.02, 16), glow, torso, 0, 0.22, 0.145);
      core.rotation.x = Math.PI / 2;
      put(new BoxGeometry(0.46, 0.05, 0.285), trim, torso, 0, 0.03, 0);
      put(new CylinderGeometry(0.06, 0.06, 0.1, 10), trim, torso, 0, 0.42, 0);
      put(new BoxGeometry(0.36, 0.3, 0.3), main, head, 0, 0, 0);
      for (const x of [-0.085, 0.085]) {
        put(new SphereGeometry(0.068, 14, 12), glow, head, x, 0.04, 0.14).scale.z = 0.6;
        put(new SphereGeometry(0.026, 8, 6), dark, head, x, 0.035, 0.18);
      }
      smile(head, 0, -0.04, 0.152, 0.07);
      for (const x of [-0.19, 0.19]) put(new BoxGeometry(0.04, 0.12, 0.1), trim, head, x, 0, 0);
      put(new CylinderGeometry(0.012, 0.012, 0.1, 6), trim, head, 0, 0.2, 0);
      put(new SphereGeometry(0.03, 10, 8), glow, head, 0, 0.26, 0);
      // The exhaust pipes on the shoulders.
      for (const x of [-0.2, 0.2]) {
        put(new CylinderGeometry(0.04, 0.045, 0.2, 10), std(0x3b4558), torso, x, 0.5, -0.07);
        const rim = put(
          new TorusGeometry(0.04, 0.012, 6, 14),
          std(0xd9dee6, { metalness: 0.6 }),
          torso,
          x,
          0.6,
          -0.07,
        );
        rim.rotation.x = Math.PI / 2;
      }
      break;
    }
    case 'robo-rex': {
      const main = std(color, { roughness: 0.4, metalness: 0.15 });
      const light = std(shade(color, 1.35), { roughness: 0.4 });
      const plate = std(0xf8961e, { roughness: 0.45 });
      put(new BoxGeometry(0.3, 0.36, 0.3), main, torso, 0, 0.2, 0);
      put(new BoxGeometry(0.2, 0.26, 0.012), light, torso, 0, 0.2, 0.152);
      put(new CylinderGeometry(0.06, 0.06, 0.1, 10), main, torso, 0, 0.42, 0);
      for (let i = 0; i < 5; i++) {
        const p = put(
          new ConeGeometry(0.07 - i * 0.006, 0.15, 3),
          plate,
          torso,
          0,
          0.36 - i * 0.075,
          -0.17,
        );
        p.rotation.x = -1.0;
      }
      const tailG = new Group();
      tailG.position.set(0, 0.04, -0.14);
      torso.add(tailG);
      const t = put(new ConeGeometry(0.1, 0.42, 8), main, tailG, 0, 0, -0.18);
      t.rotation.x = -Math.PI / 2 - 0.35;
      put(new SphereGeometry(0.04, 8, 6), plate, tailG, 0, -0.07, -0.4);
      wags.push({ node: tailG, amount: 0.45, speed: 4 });
      put(new BoxGeometry(0.3, 0.26, 0.3), main, head, 0, 0.01, -0.01);
      put(new BoxGeometry(0.25, 0.15, 0.2), light, head, 0, -0.05, 0.2);
      for (const x of [-0.05, 0.05]) put(new SphereGeometry(0.014, 6, 6), dark, head, x, 0.0, 0.3);
      for (const x of [-0.09, 0.09]) googly(head, x, 0.12, 0.1, 0.055, x > 0 ? 1 : 0);
      put(new BoxGeometry(0.2, 0.026, 0.01), mouthMat, head, 0, -0.095, 0.301);
      for (const x of [-0.07, -0.023, 0.023, 0.07]) {
        const tooth = put(new ConeGeometry(0.015, 0.035, 4), white, head, x, -0.12, 0.303);
        tooth.rotation.x = Math.PI;
      }
      for (const x of [-0.115, 0.115])
        put(new SphereGeometry(0.015, 6, 6), mouthMat, head, x, -0.085, 0.3);
      for (const x of [-0.07, 0.07])
        put(new ConeGeometry(0.03, 0.07, 3), plate, head, x, 0.17, -0.06);
      break;
    }
    case 'monster': {
      const cyclops = ((color >> 4) & 1) === 0; // one big eye or two, from the colour
      fuzzBall(torso, fur, 0.22, 0.22, 0.95, 12);
      fuzzBall(head, fur, 0.22, 0, 1, 12);
      if (cyclops) {
        googly(head, 0, 0.045, 0.185, 0.09, 0);
        horns(head, 1, 0.22, 0.04);
      } else {
        googly(head, -0.075, 0.05, 0.18, 0.062, 0);
        googly(head, 0.075, 0.05, 0.18, 0.062, 2);
        horns(head, 2, 0.2, 0.038);
      }
      smile(head, 0, -0.06, 0.2, 0.055);
      teeth(head, -0.1, 0.205);
      tail(torso, 0.05);
      break;
    }
    case 'big-monster': {
      fuzzBall(torso, fur, 0.26, 0.22, 0.95, 16);
      belly(torso, 0.17, 0.12);
      fuzzBall(head, fur, 0.24, 0, 1, 12);
      googly(head, -0.08, 0.06, 0.2, 0.065, 0);
      googly(head, 0.08, 0.06, 0.2, 0.065, 2);
      horns(head, 3, 0.22, 0.032);
      smile(head, 0, -0.04, 0.22, 0.09);
      tail(torso, 0.06);
      break;
    }
    case 'fuzzball-king': {
      fuzzBall(torso, fur, 0.28, 0.22, 0.95, 18);
      belly(torso, 0.2, 0.13);
      fuzzBall(head, fur, 0.25, 0, 1, 14);
      googly(head, -0.085, 0.06, 0.21, 0.07, 0);
      googly(head, 0.085, 0.06, 0.21, 0.07, 2);
      smile(head, 0, -0.04, 0.235, 0.09);
      teeth(head, -0.115, 0.235);
      break;
    }
    case 'slime-duke': {
      const jelly = std(color, { roughness: 0.15, transparent: true, opacity: 0.88 });
      const gold = std(0xffc928, { roughness: 0.3, metalness: 0.7 });
      put(new SphereGeometry(0.26, 18, 14), jelly, torso, 0, 0.2, 0).scale.set(1.1, 0.92, 1);
      put(new SphereGeometry(0.22, 18, 14), jelly, head, 0, 0, 0);
      put(
        new SphereGeometry(0.04, 8, 6),
        std(0xffffff, { transparent: true, opacity: 0.7 }),
        head,
        -0.1,
        0.12,
        0.13,
      );
      googly(head, -0.075, 0.04, 0.185, 0.058, 0);
      googly(head, 0.075, 0.04, 0.185, 0.058, 2);
      put(new TorusGeometry(0.07, 0.01, 6, 20), gold, head, 0.075, 0.04, 0.2);
      smile(head, 0, -0.06, 0.2, 0.06);
      break;
    }
  }

  return {
    tick(delta, hurry) {
      clock += delta;
      for (const s of spinners) s.node.rotation.z -= delta * s.speed * (hurry ? 4 : 1) * Math.PI;
      for (const w of wags) w.node.rotation.y = Math.sin(clock * w.speed) * w.amount;
      for (const w of wobbles) {
        const a = clock * 3 + w.phase;
        w.pupil.position.x = w.x + Math.cos(a) * w.radius;
        w.pupil.position.y = w.y + Math.sin(a * 1.3) * w.radius * 0.6;
      }
    },
  };
}
