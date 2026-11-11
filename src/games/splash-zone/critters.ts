/**
 * The water's creatures and the gag props: a dolphin to leap alongside the Submarine, seaweed that
 * hangs off the helmet and a little orange fish held in the rider's mouth.
 */
import {
  BoxGeometry,
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';

/** Something that is built once, shown or hidden, and disposed. */
export interface Prop {
  object: Group;
  /** Idle motion; `time` is seconds. */
  update(time: number): void;
  dispose(): void;
}

/** Builds meshes and remembers what to dispose. */
function builder() {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  return {
    std(color: number, roughness = 0.5): MeshStandardMaterial {
      const m = new MeshStandardMaterial({ color, roughness });
      materials.push(m);
      return m;
    },
    basic(color: number): MeshBasicMaterial {
      const m = new MeshBasicMaterial({ color });
      materials.push(m);
      return m;
    },
    add(
      g: BufferGeometry,
      m: Material,
      parent: Object3D,
      x = 0,
      y = 0,
      z = 0,
      sx = 1,
      sy = 1,
      sz = 1,
    ): Mesh {
      geometries.push(g);
      const mesh = new Mesh(g, m);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      parent.add(mesh);
      return mesh;
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}

// ---------- Seaweed ----------

/** Three green ribbons that hang off the top of the helmet (origin: the crown of the head). */
export function createSeaweed(): Prop {
  const b = builder();
  const object = new Group();
  const green = b.std(0x2f9d4a, 0.8);
  const dark = b.std(0x1f7a38, 0.8);
  const strands: Group[] = [];
  const spots: [number, number, number][] = [
    [-0.09, 0.02, 0],
    [0.02, 0.05, -0.08],
    [0.09, 0.0, 0.06],
  ];
  spots.forEach(([x, y, z], i) => {
    const strand = new Group();
    strand.position.set(x, y, z);
    // Each ribbon is a few flat segments that hang down and out over the head and shoulders.
    let hang = strand;
    for (let k = 0; k < 4; k++) {
      const segment = new Group();
      segment.position.y = k === 0 ? 0 : -0.1;
      hang.add(segment);
      b.add(new BoxGeometry(0.05, 0.11, 0.008), k % 2 ? dark : green, segment, 0, -0.05);
      segment.rotation.z = (i - 1) * 0.35;
      hang = segment;
    }
    object.add(strand);
    strands.push(strand);
  });
  return {
    object,
    update(time) {
      strands.forEach((strand, i) => {
        let node: Object3D | undefined = strand.children[0];
        let k = 0;
        while (node) {
          node.rotation.z = (i - 1) * 0.35 + Math.sin(time * 3 + i + k * 0.7) * 0.12;
          node = node.children.find((c) => c instanceof Group);
          k++;
        }
      });
    },
    dispose() {
      b.dispose();
      object.removeFromParent();
    },
  };
}

// ---------- Fish ----------

/** A small orange fish, nose to the left (-x): hold it by the middle. */
export function createFish(): Prop {
  const b = builder();
  const object = new Group();
  const orange = b.std(0xff8a1f, 0.5);
  const belly = b.std(0xffd9a0, 0.5);
  const dark = b.basic(0x1b1b24);
  const white = b.basic(0xffffff);
  const body = new Group();
  object.add(body);
  b.add(new SphereGeometry(0.075, 14, 10), orange, body, 0, 0, 0, 1.6, 0.8, 0.55);
  b.add(new SphereGeometry(0.06, 12, 8), belly, body, -0.01, -0.025, 0, 1.4, 0.5, 0.5);
  const tail = new Group();
  tail.position.set(0.11, 0, 0);
  body.add(tail);
  const fin = b.add(new ConeGeometry(0.06, 0.1, 4), orange, tail, 0.04, 0, 0);
  fin.rotation.z = Math.PI / 2;
  fin.scale.set(1, 1, 0.3);
  b.add(new ConeGeometry(0.03, 0.06, 4), orange, body, 0, 0.07, 0).scale.set(1, 1, 0.3);
  b.add(new SphereGeometry(0.02, 8, 6), white, body, -0.07, 0.02, 0.035);
  b.add(new SphereGeometry(0.01, 6, 4), dark, body, -0.08, 0.02, 0.046);
  b.add(new SphereGeometry(0.02, 8, 6), white, body, -0.07, 0.02, -0.035);
  b.add(new SphereGeometry(0.01, 6, 4), dark, body, -0.08, 0.02, -0.046);
  // Held crosswise in the mouth, so the nose points out of one cheek.
  object.rotation.y = Math.PI / 2;
  object.scale.setScalar(1.2);
  return {
    object,
    update(time) {
      tail.rotation.y = Math.sin(time * 14) * 0.5;
    },
    dispose() {
      b.dispose();
      object.removeFromParent();
    },
  };
}

// ---------- Cotton candy cloud ----------

export interface Cloud extends Prop {
  /** Sizes the cloud: 0 is nothing, 1 is full size. */
  pose(scale: number): void;
}

/** A cloud of candy floss, about 6 wide and 1.8 tall, its flat top at y = 0. */
export function createCloud(): Cloud {
  const b = builder();
  const object = new Group();
  const body = new Group();
  object.add(body);
  const pink = b.std(0xff9fd0, 0.9);
  const white = b.std(0xfff0f8, 0.9);
  const puffs: [number, number, number, number, boolean][] = [
    [0, -0.6, 0, 1.0, false],
    [-1.2, -0.75, 0.1, 0.8, true],
    [1.2, -0.75, -0.1, 0.8, true],
    [0.5, -0.4, 0.5, 0.7, true],
    [-0.5, -0.45, -0.5, 0.7, false],
  ];
  for (const [x, y, z, r, light] of puffs) {
    b.add(new SphereGeometry(r, 14, 10), light ? white : pink, body, x, y, z, 1, 0.75, 1);
  }
  object.visible = false;
  return {
    object,
    update() {},
    pose(scale) {
      body.scale.setScalar(1.5 * Math.max(scale, 0.001));
    },
    dispose() {
      b.dispose();
      object.removeFromParent();
    },
  };
}

// ---------- Dolphin ----------

export interface Dolphin extends Prop {
  /** Poses the leap: 0 is diving out of the water, 1 diving back in. */
  pose(phase: number): void;
}

/** A grey-blue dolphin 2.2 long with a smile, heading along -z (the way the ski goes). */
export function createDolphin(): Dolphin {
  const b = builder();
  const object = new Group();
  const body = new Group();
  object.add(body);
  const skin = b.std(0x6f93b3, 0.4);
  const belly = b.std(0xe6eef5, 0.5);
  const dark = b.basic(0x15202b);
  const white = b.basic(0xffffff);
  const mouth = b.basic(0x2a3340);
  // Body along z, nose at -z.
  b.add(new SphereGeometry(0.5, 20, 14), skin, body, 0, 0, 0.1, 0.9, 0.85, 1.7);
  b.add(new SphereGeometry(0.46, 18, 12), belly, body, 0, -0.14, -0.05, 0.85, 0.7, 1.5);
  // Beak.
  const beak = b.add(new SphereGeometry(0.17, 12, 10), skin, body, 0, -0.06, -0.92, 0.8, 0.7, 1.9);
  beak.rotation.x = 0.1;
  // The smile: a curve along the side of the beak.
  const smile = b.add(new TorusGeometry(0.16, 0.012, 6, 14, Math.PI * 0.7), mouth, body);
  smile.position.set(0.12, -0.09, -1.05);
  smile.rotation.set(0, Math.PI / 2 + 0.05, -Math.PI * 0.18);
  const smileL = b.add(new TorusGeometry(0.16, 0.012, 6, 14, Math.PI * 0.7), mouth, body);
  smileL.position.set(-0.12, -0.09, -1.05);
  smileL.rotation.set(0, Math.PI / 2 - 0.05, -Math.PI * 0.18);
  // Eyes.
  for (const side of [-1, 1]) {
    b.add(new SphereGeometry(0.06, 10, 8), white, body, side * 0.37, 0.12, -0.55);
    b.add(new SphereGeometry(0.03, 8, 6), dark, body, side * 0.41, 0.12, -0.57);
  }
  // Fins.
  const dorsal = b.add(new ConeGeometry(0.16, 0.42, 4), skin, body, 0, 0.5, 0.25);
  dorsal.rotation.x = -0.5;
  dorsal.scale.set(0.35, 1, 1);
  for (const side of [-1, 1]) {
    const flipper = b.add(new ConeGeometry(0.12, 0.5, 4), skin, body, side * 0.45, -0.22, -0.2);
    flipper.rotation.set(0.4, 0, side * 1.2);
    flipper.scale.set(1, 1, 0.3);
  }
  // The tail wags about its joint.
  const tail = new Group();
  tail.position.set(0, 0, 0.95);
  body.add(tail);
  b.add(new SphereGeometry(0.28, 12, 10), skin, tail, 0, 0, 0.3, 0.7, 0.7, 1.3);
  for (const side of [-1, 1]) {
    const fluke = b.add(
      new SphereGeometry(0.3, 10, 8),
      skin,
      tail,
      side * 0.26,
      0,
      0.78,
      1,
      0.18,
      0.55,
    );
    fluke.rotation.y = side * 0.5;
  }
  return {
    object,
    update() {},
    pose(phase) {
      // Nose up as it breaks the surface, level at the top, nose down as it dives back in.
      const k = Math.min(Math.max(phase, 0), 1);
      object.rotation.x = 0.95 * (1 - 2 * k);
      tail.rotation.x = Math.sin(k * Math.PI * 4) * 0.35;
    },
    dispose() {
      b.dispose();
      object.removeFromParent();
    },
  };
}
