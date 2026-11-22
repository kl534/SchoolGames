/**
 * The doorway the cat runs through between places. M1 has the house `door` (a wooden door in a
 * wall); the town `gate`, the busy `shop-doors` and the adventure `portal` arrive with their
 * places. The doorway shows the colours of the place it leads to.
 */
import { Group, SphereGeometry } from 'three';
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

export function createDoorway(_group: PlaceGroup, next: PlaceLook): Doorway {
  const kit = new Kit();
  const object = new Group();
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
