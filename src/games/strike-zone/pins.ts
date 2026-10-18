import {
  CylinderGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Vector2,
  type BufferGeometry,
} from 'three';
import { PIN_COM_Y, PIN_IDS, type PinId } from './geometry';
import type { Physics } from './physics';

/** (radius, height) of the pin's outline. */
const PROFILE: [number, number][] = [
  [0, 0],
  [0.026, 0],
  [0.04, 0.03],
  [0.056, 0.08],
  [0.0605, 0.114],
  [0.055, 0.17],
  [0.04, 0.22],
  [0.026, 0.255],
  [0.0228, 0.27],
  [0.028, 0.3],
  [0.032, 0.33],
  [0.03, 0.355],
  [0.02, 0.372],
  [0, 0.381],
];

/** Seconds a fresh rack takes to drop in, and how high it starts. */
export const DROP_SECONDS = 0.45;
export const DROP_HEIGHT = 0.5;

let shared: {
  body: BufferGeometry;
  band: BufferGeometry;
  white: MeshStandardMaterial;
  red: MeshStandardMaterial;
} | null = null;

function parts() {
  shared ??= {
    body: new LatheGeometry(
      PROFILE.map(([r, h]) => new Vector2(r, h)),
      24,
    ),
    band: new CylinderGeometry(0.0255, 0.0255, 0.012, 24, 1, true),
    white: new MeshStandardMaterial({ color: 0xf7f5ef, roughness: 0.35 }),
    red: new MeshStandardMaterial({ color: 0xd62828, roughness: 0.5, side: DoubleSide }),
  };
  return shared;
}

/**
 * One pin standing on the deck. The outer group's origin is the pin's centre of mass, so it can be
 * placed with a physics body's pose; the mesh sits PIN_COM_Y below it.
 */
export function createPinMesh(): Group {
  const { body, band, white, red } = parts();
  const outer = new Group();
  const inner = new Group();
  inner.position.y = -PIN_COM_Y;
  inner.add(new Mesh(body, white));
  for (const y of [0.262, 0.282]) {
    const ring = new Mesh(band, red);
    ring.position.y = y;
    inner.add(ring);
  }
  outer.add(inner);
  return outer;
}

export interface Pins {
  object: Group;
  /**
   * Stands these pins upright on their spots and hides the rest. With `dropIn`, the meshes start
   * 0.5 m up and ease down over 0.45 s (drawing only: the bodies are already in place).
   */
  rack(ids: readonly PinId[], dropIn: boolean): void;
  /** Copies the bodies' poses onto the meshes. `delta` moves a drop-in along. */
  sync(physics: Physics, delta: number): void;
}

export function createPins(): Pins {
  const object = new Group();
  const meshes = new Map<PinId, Group>();
  for (const id of PIN_IDS) {
    const mesh = createPinMesh();
    mesh.visible = false;
    object.add(mesh);
    meshes.set(id, mesh);
  }
  let dropT = DROP_SECONDS;
  return {
    object,
    rack(ids, dropIn) {
      dropT = dropIn ? 0 : DROP_SECONDS;
      for (const id of PIN_IDS) meshes.get(id)!.visible = ids.includes(id);
    },
    sync(physics, delta) {
      dropT = Math.min(dropT + delta, DROP_SECONDS);
      const k = dropT / DROP_SECONDS;
      const lift = DROP_HEIGHT * (1 - k) * (1 - k);
      for (const id of PIN_IDS) {
        const mesh = meshes.get(id)!;
        const pose = physics.pin(id);
        mesh.visible = pose !== null;
        if (!pose) continue;
        mesh.position.set(pose.x, pose.y + lift, pose.z);
        mesh.quaternion.set(pose.qx, pose.qy, pose.qz, pose.qw);
      }
    },
  };
}
