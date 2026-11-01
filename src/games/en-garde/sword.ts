import {
  CapsuleGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';

/** Spring of the blade's joints (they pull back to straight) and its damping. */
const SPRING_K = 60;
const SPRING_DAMPING = 8;
/** How much the blade lags behind a swinging arm, as radians per radian-per-second. */
const LAG = 0.04;
/** The most the blade bends from lag alone. */
const MAX_LAG = 0.5;
/** A bend of about 30 degrees back at the touch, split between the two joints. */
const HIT_KICK = -5;

export interface Sword {
  /** Hang this on a hand: the blade carries on from the forearm. */
  object: Group;
  /**
   * Advances the wobble by `delta` s. `swing` is the arm's total angle (shoulder plus elbow, rad):
   * the blade lags behind when it changes.
   */
  update(delta: number, swing: number): void;
  /** The touch: the blade bends back and wobbles. */
  hit(): void;
  setColor(color: number): void;
  /** Shorter or longer blade (metres of blade in the unscaled person). */
  setLength(length: number): void;
}

interface Joint {
  group: Group;
  angle: number;
  speed: number;
}

/**
 * A twisted balloon sword: a grip, a guard of two loops and a blade of four glossy bulges with
 * pinched knots and a tied nub at the tip. The blade is two joints on damped springs, so it
 * wobbles after every move. Its blade runs along -y of the hand.
 */
export function createSword(color: number, length = 0.9): Sword {
  const material = new MeshStandardMaterial({ color, roughness: 0.25 });
  const knotMaterial = new MeshStandardMaterial({
    color: new Color(color).multiplyScalar(0.7),
    roughness: 0.35,
  });
  const object = new Group();
  // The blade is built along +y; turning it over puts it along the hand's -y.
  const sword = new Group();
  sword.rotation.x = Math.PI;
  object.add(sword);

  const mesh = (
    geometry: SphereGeometry | CapsuleGeometry | TorusGeometry,
    m: MeshStandardMaterial,
    parent: Group,
  ) => {
    const node = new Mesh(geometry, m);
    parent.add(node);
    return node;
  };

  const grip = mesh(new CapsuleGeometry(0.024, 0.07, 4, 10), material, sword);
  grip.position.y = 0.0;
  for (const side of [-1, 1]) {
    const loop = mesh(new TorusGeometry(0.045, 0.014, 8, 16), material, sword);
    loop.position.set(0, 0.075, side * 0.06);
    loop.rotation.y = Math.PI / 2;
    loop.scale.set(1, 1.25, 1);
  }

  const first: Joint = { group: new Group(), angle: 0, speed: 0 };
  const second: Joint = { group: new Group(), angle: 0, speed: 0 };
  sword.add(first.group);
  first.group.position.y = 0.11;
  first.group.add(second.group);

  let bulges: Mesh[] = [];
  let knots: Mesh[] = [];
  let nub: Mesh | undefined;
  let currentLength = length;

  /** Four bulges of a pitch each; the knots sit between them. */
  const build = (blade: number) => {
    for (const node of [...bulges, ...knots, ...(nub ? [nub] : [])]) {
      node.parent?.remove(node);
      node.geometry.dispose();
    }
    bulges = [];
    knots = [];
    currentLength = blade;
    const pitch = blade / 4;
    const radius = 0.042 * Math.sqrt(blade / 0.9);
    second.group.position.y = pitch * 2;
    for (let i = 0; i < 4; i++) {
      const parent = i < 2 ? first.group : second.group;
      const y = (i % 2) * pitch + pitch / 2;
      const bulge = mesh(
        new CapsuleGeometry(radius, Math.max(pitch - radius * 2 - 0.01, 0.02), 6, 14),
        material,
        parent,
      );
      bulge.position.y = y;
      bulges.push(bulge);
      if (i > 0) {
        const knot = mesh(new SphereGeometry(radius * 0.5, 8, 6), knotMaterial, parent);
        knot.position.y = (i % 2) * pitch;
        knots.push(knot);
      }
    }
    nub = mesh(new SphereGeometry(radius * 0.5, 8, 6), knotMaterial, second.group);
    nub.position.y = pitch * 2 + 0.01;
  };
  build(length);

  let lastSwing: number | undefined;

  const spring = (joint: Joint, target: number, delta: number) => {
    // Small steps keep the spring stable when a frame is long.
    const steps = Math.max(1, Math.ceil(delta / 0.008));
    const dt = delta / steps;
    for (let i = 0; i < steps; i++) {
      const accel = SPRING_K * (target - joint.angle) - SPRING_DAMPING * joint.speed;
      joint.speed += accel * dt;
      joint.angle += joint.speed * dt;
    }
    joint.group.rotation.x = joint.angle;
  };

  return {
    object,
    update(delta, swing) {
      if (delta <= 0) return;
      const rate = lastSwing === undefined ? 0 : (swing - lastSwing) / delta;
      lastSwing = swing;
      // The blade lags behind the arm: a swing up bends it back down, and the tip a bit more.
      const lag = Math.max(-MAX_LAG, Math.min(MAX_LAG, rate * LAG));
      spring(first, lag * 0.5, delta);
      spring(second, lag * 0.5, delta);
    },
    hit() {
      first.speed += HIT_KICK * 0.5;
      second.speed += HIT_KICK * 0.5;
    },
    setColor(c) {
      material.color.setHex(c);
      knotMaterial.color.setHex(c).multiplyScalar(0.7);
    },
    setLength(blade) {
      if (blade !== currentLength) build(blade);
    },
  };
}
