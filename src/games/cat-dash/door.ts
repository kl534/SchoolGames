/**
 * The doorway the cat runs through between places: the house `door` (a wooden door in a wall)
 * and the town `gate` (a garden gate in a fence); the busy `shop-doors` and the adventure
 * `portal` arrive with their places. The doorway shows the colours of the place it leads to.
 */
import { CylinderGeometry, Group, SphereGeometry } from 'three';
import { Kit } from './kit';
import type { PlaceGroup, PlaceLook } from './places';

export interface Doorway {
  /** Its origin is on the floor at the middle of the opening. */
  object: Group;
  dispose(): void;
}

/** The door icon on the place strip for each group. */
export const DOOR_ICONS: Record<PlaceGroup, string> = {
  house: '🚪',
  town: '🏡',
  busy: '🏪',
  adventure: '🌀',
};

/** Where the doorway's wall stands: in front of the scenery, behind the cat. */
export const DOOR_Z = -0.9;

/** A garden gate: stone posts, a white picket fence and the gate swung open on the next place. */
function buildGate(kit: Kit, object: Group, next: PlaceLook) {
  const picket = kit.lit(0xfaf4e6, 0.7);
  const stone = kit.lit(0xb9b5ac, 0.9);
  // The place beyond, framed by the gateway.
  kit.box(3.0, 5.2, 0.3, kit.basic(next.sky[1]), object, 0, 2.6, DOOR_Z + 0.04);
  kit.box(3.0, 0.5, 0.34, kit.basic(next.floor), object, 0, 0.25, DOOR_Z + 0.08);
  // The fence on both sides.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const x = side * (1.9 + i * 0.5);
      kit.box(0.38, 3.2 - i * 0.05, 0.12, picket, object, x, 1.6, DOOR_Z + 0.1);
    }
    kit.box(3.2, 0.16, 0.16, picket, object, side * 3.5, 2.4, DOOR_Z + 0.04);
    kit.box(3.2, 0.16, 0.16, picket, object, side * 3.5, 0.8, DOOR_Z + 0.04);
  }
  // Stone posts with round caps, and an arch of leaves and flowers over the top.
  for (const side of [-1, 1]) {
    kit.box(0.7, 4.4, 0.7, stone, object, side * 1.75, 2.2, DOOR_Z + 0.12);
    kit.box(0.9, 0.2, 0.9, kit.lit(0x8f8b82, 0.9), object, side * 1.75, 4.5, DOOR_Z + 0.12);
    kit.mesh(new SphereGeometry(0.38, 12, 10), stone, object, side * 1.75, 4.9, DOOR_Z + 0.12);
  }
  const leaf = kit.lit(0x3e9a4a, 0.85);
  for (let i = 0; i < 9; i++) {
    const a = (i / 8) * Math.PI;
    const x = -Math.cos(a) * 1.75;
    const y = 4.6 + Math.sin(a) * 0.9;
    kit.mesh(new SphereGeometry(0.3, 10, 8), leaf, object, x, y, DOOR_Z + 0.2);
    if (i % 2 === 0) {
      kit.mesh(
        new SphereGeometry(0.17, 8, 6),
        kit.lit(i % 4 === 0 ? 0xff6f91 : 0xf2d34a, 0.6),
        object,
        x,
        y + 0.12,
        DOOR_Z + 0.46,
      );
    }
  }
  // The gate leaf, swung open to one side, with a round knob.
  const hinge = new Group();
  hinge.position.set(-1.35, 0, DOOR_Z + 0.35);
  hinge.rotation.y = -1.2;
  object.add(hinge);
  for (let i = 0; i < 5; i++)
    kit.box(0.4, 2.6 - (i === 2 ? -0.3 : 0), 0.1, picket, hinge, 0.25 + i * 0.5, 1.5, 0);
  kit.box(2.6, 0.14, 0.12, picket, hinge, 1.45, 2.3, 0);
  kit.box(2.6, 0.14, 0.12, picket, hinge, 1.45, 0.8, 0);
  kit.mesh(new CylinderGeometry(0.07, 0.07, 0.2, 8), kit.lit(0x555555, 0.4), hinge, 2.5, 1.6, 0.1);
}

export function createDoorway(group: PlaceGroup, next: PlaceLook): Doorway {
  const kit = new Kit();
  const object = new Group();
  if (group === 'town') {
    buildGate(kit, object, next);
    return {
      object,
      dispose() {
        kit.dispose();
        object.removeFromParent();
      },
    };
  }
  // Wall around the opening, in the next place's colour.
  kit.box(6, 9.5, 0.3, kit.lit(next.wall, 0.9), object, 0, 4.75, DOOR_Z);
  kit.box(6, 0.5, 0.36, kit.lit(next.trim, 0.6), object, 0, 0.25, DOOR_Z + 0.02);
  const white = kit.lit(0xffffff, 0.5);
  // Frame, then the bright room beyond.
  kit.box(3.3, 5.5, 0.34, white, object, 0, 2.75, DOOR_Z + 0.04);
  kit.box(2.9, 5.1, 0.36, kit.basic(next.sky[1]), object, 0, 2.55, DOOR_Z + 0.06);
  kit.box(2.9, 0.5, 0.38, kit.basic(next.floor), object, 0, 0.25, DOOR_Z + 0.08);
  kit.box(3.7, 0.3, 0.44, white, object, 0, 5.65, DOOR_Z + 0.08);
  // The door leaf, swung open to one side.
  const hinge = new Group();
  hinge.position.set(-1.45, 0, DOOR_Z + 0.2);
  hinge.rotation.y = -1.25;
  object.add(hinge);
  kit.box(2.9, 5.1, 0.14, kit.lit(0xa86f3f, 0.7), hinge, 1.45, 2.55, 0);
  kit.box(2.2, 2.0, 0.16, kit.lit(0x8e5a30, 0.7), hinge, 1.45, 3.6, 0.02);
  kit.box(2.2, 2.0, 0.16, kit.lit(0x8e5a30, 0.7), hinge, 1.45, 1.2, 0.02);
  kit.mesh(new SphereGeometry(0.14, 10, 8), kit.lit(0xf2c14a, 0.3), hinge, 2.6, 2.5, 0.12);
  return {
    object,
    dispose() {
      kit.dispose();
      object.removeFromParent();
    },
  };
}
