/**
 * The cheering crowd: about 60 flat kid cut-outs (a coloured body and a head, one instanced mesh
 * each) in two rows along both fences, bobbing faster while a runner is near or crosses the line.
 */
import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import { FINISH_Z } from './layout';
import { FENCE_X } from './track';

export const CROWD_SIZE = 60;
/** How high a cheer bob goes (m) at the most. */
export const BOB = 0.3;
const COLOURS = [0xef4444, 0xf59e0b, 0x22c55e, 0x3b82f6, 0xa855f7, 0xec4899, 0xfacc15, 0x14b8a6];
const SKINS = [0xf1b48a, 0xe0a070, 0xc68642, 0x8d5524, 0xffd9b8];

export interface Crowd {
  object: Group;
  /** Moves the bobbing on; `near` are the z of runners now, `cheer` makes everyone bob faster. */
  update(delta: number, near: readonly number[], cheer: boolean): void;
  dispose(): void;
}

interface Spot {
  x: number;
  z: number;
  phase: number;
  /** 0 or 1: how much this one is already cheering. */
  energy: number;
}

export function createCrowd(random: () => number = Math.random): Crowd {
  const object = new Group();
  const bodyGeometry = new BoxGeometry(0.4, 0.7, 0.14);
  const headGeometry = new SphereGeometry(0.17, 10, 8);
  const bodyMaterial = new MeshStandardMaterial({ roughness: 0.8 });
  const headMaterial = new MeshStandardMaterial({ roughness: 0.8 });
  const bodies = new InstancedMesh(bodyGeometry, bodyMaterial, CROWD_SIZE);
  const heads = new InstancedMesh(headGeometry, headMaterial, CROWD_SIZE);
  const colour = new Color();

  const spots: Spot[] = [];
  for (let i = 0; i < CROWD_SIZE; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2) % 2;
    // More of them near the finish line, spread along the whole track.
    const along = random();
    const z = along < 0.4 ? FINISH_Z + 6 - random() * 24 : 4 - random() * 100;
    spots.push({
      x: side * (FENCE_X + 0.7 + row * 0.9),
      z,
      phase: random() * Math.PI * 2,
      energy: 0,
    });
    bodies.setColorAt(i, colour.setHex(COLOURS[Math.floor(random() * COLOURS.length)]));
    heads.setColorAt(i, colour.setHex(SKINS[Math.floor(random() * SKINS.length)]));
  }
  object.add(bodies, heads);

  const matrix = new Matrix4();
  let clock = 0;
  const place = (i: number, bob: number) => {
    const s = spots[i];
    matrix.makeTranslation(s.x, 0.55 + bob, s.z);
    bodies.setMatrixAt(i, matrix);
    matrix.makeTranslation(s.x, 1.08 + bob, s.z);
    heads.setMatrixAt(i, matrix);
  };
  spots.forEach((_, i) => place(i, 0));

  return {
    object,
    update(delta, near, cheer) {
      clock += delta;
      spots.forEach((s, i) => {
        const close = cheer || near.some((z) => Math.abs(z - s.z) < 6);
        s.energy += ((close ? 1 : 0) - s.energy) * Math.min(1, delta * 4);
        const speed = 3 + 6 * s.energy;
        const bob = Math.max(0, Math.sin(clock * speed + s.phase)) * BOB * (0.35 + 0.65 * s.energy);
        place(i, bob);
      });
      bodies.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      bodyGeometry.dispose();
      headGeometry.dispose();
      bodyMaterial.dispose();
      headMaterial.dispose();
      bodies.dispose();
      heads.dispose();
    },
  };
}
