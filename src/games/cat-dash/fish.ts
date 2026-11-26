/**
 * The fish treats on the straights: a lathe-turned body, a top fin, a two-part tail fan and white
 * eyes with black pupils, all sharing one set of geometries and materials.
 */
import {
  ConeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector2,
  type BufferGeometry,
  type Material,
} from 'three';
import { addOutline, OUTLINE_PROP_PX, type Outline } from './outline';

/** Body outline as (radius, along the length), tail end first; the head points to +x. */
export const FISH_PROFILE: readonly [number, number][] = [
  [0.0, -0.4],
  [0.07, -0.34],
  [0.15, -0.2],
  [0.22, -0.02],
  [0.25, 0.14],
  [0.2, 0.3],
  [0.1, 0.42],
  [0.0, 0.46],
];
export const FISH_BOB = 0.06;
export const FISH_BOB_HZ = 2;
/** Turns about y per second while the fish waits. */
export const FISH_SPIN = 1;

export interface FishSet {
  /** A new fish (a group at the origin), with its ink outline. */
  make(): Group;
  /** Shows or hides every fish's outline (the quality tier). */
  setOutlines(on: boolean): void;
  dispose(): void;
}

/** Height offset of a waiting fish at time `t` (s): a gentle 2 Hz bob. */
export const fishBob = (t: number) => Math.sin(t * Math.PI * 2 * FISH_BOB_HZ) * FISH_BOB;
/** Turn about y of a waiting fish at time `t` (s): one turn a second. */
export const fishSpin = (t: number) => t * Math.PI * 2 * FISH_SPIN;

export function createFishSet(outlines: boolean): FishSet {
  const geometries: BufferGeometry[] = [];
  const own = <T extends BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const body = own(
    new LatheGeometry(
      FISH_PROFILE.map(([r, y]) => new Vector2(r, y)),
      16,
    ),
  );
  body.rotateZ(-Math.PI / 2);
  const fin = own(new ConeGeometry(0.1, 0.24, 12));
  const tailFan = own(new ConeGeometry(0.2, 0.34, 12));
  const eye = own(new SphereGeometry(0.055, 14, 10));
  const pupil = own(new SphereGeometry(0.03, 12, 8));

  const orange = new MeshStandardMaterial({ color: 0xff9f1c, roughness: 0.3 });
  const blue = new MeshStandardMaterial({ color: 0x3f8fd8, roughness: 0.3 });
  const white = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const black = new MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
  const materials: Material[] = [orange, blue, white, black];

  const inks: Outline[] = [];
  let inkOn = outlines;

  return {
    make() {
      const g = new Group();
      const trunk = new Mesh(body, orange);
      trunk.scale.set(1, 0.85, 0.6);
      g.add(trunk);
      const top = new Mesh(fin, blue);
      top.position.set(-0.02, 0.24, 0);
      top.rotation.z = 0.35;
      top.scale.z = 0.2;
      g.add(top);
      for (const a of [0.4, -0.4]) {
        const lobe = new Mesh(tailFan, blue);
        lobe.position.set(-0.46, a * 0.2, 0);
        lobe.rotation.z = Math.PI / 2 + a;
        lobe.scale.z = 0.2;
        g.add(lobe);
      }
      for (const z of [0.115, -0.115]) {
        const e = new Mesh(eye, white);
        e.position.set(0.24, 0.07, z);
        const p = new Mesh(pupil, black);
        p.position.set(0.265, 0.07, z * 1.3);
        g.add(e, p);
      }
      const ink = addOutline(g, OUTLINE_PROP_PX);
      ink.setVisible(inkOn);
      inks.push(ink);
      return g;
    },
    setOutlines(on) {
      inkOn = on;
      for (const ink of inks) ink.setVisible(on);
    },
    dispose() {
      for (const ink of inks) ink.dispose();
      inks.length = 0;
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
