import { CylinderGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { PUCK_DRAW, PUCK_H, PUCK_R, type Vec } from './geometry';

export interface Puck {
  object: Group;
  place(p: Vec): void;
  setVisible(visible: boolean): void;
  /** Turns the puck as it slides, `speed` radians a second. */
  spin(delta: number, speed: number): void;
}

/** A black disc, drawn 1.6 times bigger than the real thing so it reads on a phone. */
export function createPuck(): Puck {
  const object = new Group();
  const disc = new Mesh(
    new CylinderGeometry(PUCK_R * PUCK_DRAW, PUCK_R * PUCK_DRAW, PUCK_H * 2 * PUCK_DRAW, 16),
    new MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.5 }),
  );
  object.add(disc);
  return {
    object,
    place(p) {
      object.position.set(p.x, p.y + PUCK_H * PUCK_DRAW * 0.5, p.z);
    },
    setVisible(visible) {
      object.visible = visible;
    },
    spin(delta, speed) {
      disc.rotation.y += delta * speed;
    },
  };
}
