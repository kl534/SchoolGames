/** The stunt bike: a chunky cartoon motorbike made of primitives, facing +x. */
import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import { REAR, SEAT, WHEEL_R } from './stunts';

export interface Bike {
  /** Origin at the frame origin (axle height); rotate z for pitch, x for roll. */
  object: Group;
  /** The rider's hips go here. */
  seat: Group;
  /** For a flash when it hits something. */
  headlight: Object3D;
  /** Turns both wheels by `distance` along the ground. */
  spin(distance: number): void;
  /** Scales the body along its length (1 = normal). */
  setSquash(s: number): void;
  /** Lights the headlight up (1) or lets it go dull (0). */
  setGlow(amount: number): void;
  /** World position of the tailpipe (for puffs and nitro flames); updated by `update`. */
  exhaust: Vector3;
  /** Refreshes `exhaust` from the bike's current transform. */
  update(): void;
  dispose(): void;
}

const RED = 0xe8403a;
const YELLOW = 0xffd43b;

export function createBike(): Bike {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const geo = <T extends BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const std = (color: number, roughness = 0.5, metalness = 0) => {
    const m = new MeshStandardMaterial({ color, roughness, metalness });
    materials.push(m);
    return m;
  };
  const add = (g: BufferGeometry, m: Material, parent: Object3D, x = 0, y = 0, z = 0): Mesh => {
    const mesh = new Mesh(geo(g), m);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  const red = std(RED, 0.35, 0.1);
  const yellow = std(YELLOW, 0.35, 0.1);
  const black = std(0x23232e, 0.7);
  const steel = std(0xc9ced9, 0.3, 0.6);
  const white = std(0xffffff, 0.6);
  const lightMaterial = new MeshStandardMaterial({
    color: 0xfff6c4,
    emissive: 0xffe9a0,
    emissiveIntensity: 1,
  });
  materials.push(lightMaterial);

  const object = new Group();
  // Everything that squashes lives in `shape`, so the seat and the exhaust stay put.
  const shape = new Group();
  object.add(shape);

  const wheels: Group[] = [];
  const makeWheel = (x: number) => {
    const wheel = new Group();
    wheel.position.set(x, 0, 0);
    // The tyre is a torus in the xy plane, so its axle runs along z.
    add(new TorusGeometry(WHEEL_R - 0.09, 0.09, 12, 28), black, wheel);
    add(new CylinderGeometry(WHEEL_R - 0.14, WHEEL_R - 0.14, 0.1, 20), steel, wheel).rotation.x =
      Math.PI / 2;
    for (let i = 0; i < 6; i++) {
      const spoke = add(new BoxGeometry(WHEEL_R * 1.7, 0.035, 0.12), white, wheel);
      spoke.rotation.z = (i * Math.PI) / 6;
    }
    // A red marker so the turning shows.
    add(new BoxGeometry(0.11, 0.11, 0.14), red, wheel, WHEEL_R * 0.55, 0, 0);
    add(new CylinderGeometry(0.07, 0.07, 0.36, 10), steel, wheel).rotation.x = Math.PI / 2;
    shape.add(wheel);
    wheels.push(wheel);
    return wheel;
  };
  makeWheel(-REAR);
  makeWheel(REAR);

  // Frame, engine and tank.
  add(new BoxGeometry(1.5, 0.22, 0.3), red, shape, -0.05, 0.28, 0);
  add(new BoxGeometry(0.6, 0.5, 0.42), std(0x4a4f63, 0.5, 0.4), shape, 0.05, 0.12, 0);
  add(new CapsuleGeometry(0.26, 0.55, 6, 14), yellow, shape, 0.25, 0.64, 0).rotation.z =
    Math.PI / 2;
  // Tail and fender.
  const tail = add(new CapsuleGeometry(0.17, 0.55, 6, 12), red, shape, -0.78, 0.55, 0);
  tail.rotation.z = Math.PI / 2 - 0.18;
  add(new BoxGeometry(0.9, 0.18, 0.4), black, shape, SEAT.x, SEAT.y - 0.12, 0);
  // Number plate.
  add(new BoxGeometry(0.28, 0.24, 0.04), white, shape, -0.98, 0.5, 0.2).rotation.z = -0.18;
  add(new BoxGeometry(0.1, 0.14, 0.05), red, shape, -0.98, 0.5, 0.2).rotation.z = -0.18;
  // Front fender and fork.
  add(new BoxGeometry(0.62, 0.07, 0.3), yellow, shape, REAR + 0.05, 0.5, 0);
  for (const z of [-0.14, 0.14]) {
    const fork = add(new CylinderGeometry(0.035, 0.035, 1.0, 8), steel, shape, 0.66, 0.46, z);
    fork.rotation.z = -0.38;
  }
  // Handlebars and grips.
  const bars = add(new CylinderGeometry(0.03, 0.03, 0.74, 8), black, shape, 0.5, 0.96, 0);
  bars.rotation.x = Math.PI / 2;
  for (const z of [-0.37, 0.37])
    add(new CylinderGeometry(0.05, 0.05, 0.14, 8), red, shape, 0.5, 0.96, z).rotation.x =
      Math.PI / 2;
  // Headlight.
  const headlight = add(new SphereGeometry(0.15, 14, 10), lightMaterial, shape, 0.74, 0.8, 0);
  add(new CylinderGeometry(0.16, 0.16, 0.08, 14), steel, shape, 0.66, 0.8, 0).rotation.z =
    Math.PI / 2;
  // Tailpipe.
  const pipe = add(new CylinderGeometry(0.06, 0.07, 0.8, 10), steel, shape, -0.75, 0.2, -0.22);
  pipe.rotation.z = Math.PI / 2 + 0.06;

  const seat = new Group();
  seat.position.set(SEAT.x, SEAT.y, 0);
  object.add(seat);

  const exhaust = new Vector3();
  const local = new Vector3(-1.2, 0.2, -0.22);

  return {
    object,
    seat,
    headlight,
    exhaust,
    spin(distance) {
      for (const wheel of wheels) wheel.rotation.z -= distance / WHEEL_R;
    },
    setSquash(s) {
      shape.scale.x = s;
    },
    setGlow(amount) {
      lightMaterial.emissiveIntensity = 0.15 + 1.1 * amount;
      lightMaterial.emissive.setHex(amount > 0.5 ? 0xffe9a0 : 0x6b6a50);
    },
    update() {
      object.updateMatrixWorld(true);
      exhaust.copy(local).applyMatrix4(object.matrixWorld);
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      object.removeFromParent();
    },
  };
}

/** A flat dark disc under the bike, so it sits on the road. */
export function createShadowMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
}
