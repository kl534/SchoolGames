/**
 * Small helpers the busy and adventure props share: the `prop()` wrapper, shapes, a tidy
 * pseudo-random number and a pole between two points.
 */
import { CylinderGeometry, Group, SphereGeometry, type Material, type Mesh } from 'three';
import { Kit, type Prop } from '../kit';
import type { Outcome, Variant } from '../rules';

export type Pose = (outcome: Outcome | null, variant: Variant, t: number) => void;

/** Wraps a builder: it fills `root` with meshes and returns the function that poses them. */
export function makeProp(setup: (kit: Kit, root: Group) => Pose): Prop {
  const kit = new Kit();
  const object = new Group();
  const pose = setup(kit, object);
  return {
    object,
    update: pose,
    reset: () => pose(null, 0, 0),
    dispose: () => {
      kit.dispose();
      object.removeFromParent();
    },
  };
}

export const sphere = (
  kit: Kit,
  r: number,
  mat: Material,
  parent: Group,
  x = 0,
  y = 0,
  z = 0,
): Mesh => kit.mesh(new SphereGeometry(r, 16, 12), mat, parent, x, y, z);

export const cyl = (
  kit: Kit,
  rt: number,
  rb: number,
  h: number,
  mat: Material,
  parent: Group,
  x = 0,
  y = 0,
  z = 0,
): Mesh => kit.mesh(new CylinderGeometry(rt, rb, h, 16), mat, parent, x, y, z);

/** A tidy pseudo-random number from an index. */
export const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** A pole from one point to another in the xy plane. */
export function beam(
  kit: Kit,
  mat: Material,
  parent: Group,
  from: [number, number],
  to: [number, number],
  w: number,
  z = 0,
): Mesh {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const m = kit.box(len, w, w, mat, parent, (from[0] + to[0]) / 2, (from[1] + to[1]) / 2, z);
  m.rotation.z = Math.atan2(to[1] - from[1], to[0] - from[0]);
  return m;
}
