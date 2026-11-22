/**
 * The doorway the cat runs through between places: the house `door` (a wooden door in a wall),
 * the town `gate` (a garden gate in a fence), the busy `shop-doors` (sliding glass doors under a
 * striped awning with a sign) and the adventure `portal` (a glowing swirl ring). The doorway
 * shows the colours of the place it leads to.
 */
import { CylinderGeometry, Group, SphereGeometry, TorusGeometry } from 'three';
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

/** Sliding glass shop doors: steel frame, panes slid apart, an awning and a sign. */
function buildShopDoors(kit: Kit, object: Group, next: PlaceLook) {
  const steel = kit.lit(0xb9c1c9, 0.35);
  kit.box(6, 9.5, 0.3, kit.lit(next.wall, 0.9), object, 0, 4.75, DOOR_Z);
  kit.box(6, 0.5, 0.36, kit.lit(next.trim, 0.6), object, 0, 0.25, DOOR_Z + 0.02);
  // The shop beyond the doors.
  kit.box(3.4, 5.2, 0.34, kit.basic(next.sky[1]), object, 0, 2.7, DOOR_Z + 0.06);
  kit.box(3.4, 0.5, 0.38, kit.basic(next.floor), object, 0, 0.25, DOOR_Z + 0.08);
  // Frame.
  kit.box(0.2, 5.5, 0.4, steel, object, -1.8, 2.75, DOOR_Z + 0.1);
  kit.box(0.2, 5.5, 0.4, steel, object, 1.8, 2.75, DOOR_Z + 0.1);
  kit.box(3.8, 0.3, 0.44, steel, object, 0, 5.55, DOOR_Z + 0.1);
  // The two glass panes, slid apart to the sides.
  const glass = kit.glass(0x9ad8ff, 0.4);
  for (const s of [-1, 1]) {
    kit.box(0.9, 5.0, 0.08, glass, object, s * 1.25, 2.6, DOOR_Z + 0.25);
    kit.box(0.08, 5.0, 0.12, steel, object, s * 0.8, 2.6, DOOR_Z + 0.25);
    kit.box(0.4, 0.9, 0.02, kit.basic(0xffffff, 0.7), object, s * 1.25, 2.2, DOOR_Z + 0.31);
  }
  // A striped awning and a sign with a bright bar.
  for (let i = 0; i < 6; i++) {
    const a = kit.box(
      1.0,
      0.18,
      1.1,
      kit.lit(i % 2 ? 0xffffff : 0xe0504a, 0.7),
      object,
      -2.5 + i,
      6.4,
      DOOR_Z + 0.65,
    );
    a.rotation.x = -0.35;
  }
  kit.box(3.4, 0.9, 0.2, kit.lit(0x2f3a5a, 0.5), object, 0, 7.5, DOOR_Z + 0.15);
  kit.box(2.4, 0.4, 0.04, kit.basic(0xfff1a8), object, 0, 7.5, DOOR_Z + 0.27);
  // A doormat.
  kit.box(3, 0.05, 1.2, kit.lit(0x3a3a40, 0.9), object, 0, 0.03, DOOR_Z + 0.9);
}

/** A glowing swirl ring on two stone feet; the place beyond swirls inside it. */
function buildPortal(kit: Kit, object: Group, next: PlaceLook) {
  const y = 2.7;
  const glow = kit.basic(0xb36bff);
  kit.mesh(new TorusGeometry(2.2, 0.22, 12, 40), glow, object, 0, y, DOOR_Z + 0.1);
  kit.mesh(
    new TorusGeometry(2.55, 0.06, 8, 40),
    kit.basic(0x5ce1ff, 0.7),
    object,
    0,
    y,
    DOOR_Z + 0.1,
  );
  kit.mesh(
    new TorusGeometry(1.9, 0.05, 8, 40),
    kit.basic(0xffffff, 0.7),
    object,
    0,
    y,
    DOOR_Z + 0.12,
  );
  // The place beyond: its sky and floor colours in a disc, with swirling arcs over it.
  kit.mesh(
    new CylinderGeometry(2.1, 2.1, 0.06, 32),
    kit.basic(next.sky[0]),
    object,
    0,
    y,
    DOOR_Z + 0.05,
  ).rotation.x = Math.PI / 2;
  kit.mesh(
    new CylinderGeometry(1.6, 1.6, 0.06, 32),
    kit.basic(next.sky[1]),
    object,
    0,
    y,
    DOOR_Z + 0.07,
  ).rotation.x = Math.PI / 2;
  kit.mesh(
    new CylinderGeometry(1.0, 1.0, 0.06, 32),
    kit.basic(next.floor),
    object,
    0,
    y - 0.1,
    DOOR_Z + 0.09,
  ).rotation.x = Math.PI / 2;
  const swirl = [0xff6fd8, 0x5ce1ff, 0xffffff];
  swirl.forEach((c, i) => {
    const r = 0.5 + i * 0.5;
    const m = kit.mesh(
      new TorusGeometry(r, 0.06, 6, 24, Math.PI * 1.3),
      kit.basic(c, 0.85),
      object,
      0,
      y,
      DOOR_Z + 0.14 + i * 0.01,
    );
    m.rotation.z = i * 2.1;
  });
  // Sparkles around the ring and the stone feet.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.2;
    kit.mesh(
      new SphereGeometry(0.09, 6, 5),
      kit.basic(i % 2 ? 0xffffff : 0xffd6ff),
      object,
      Math.cos(a) * 2.9,
      y + Math.sin(a) * 2.9,
      DOOR_Z + 0.2,
    );
  }
  const stone = kit.lit(0x8f8b9a, 0.9);
  for (const s of [-1, 1]) {
    kit.box(1.0, 0.7, 1.0, stone, object, s * 1.4, 0.35, DOOR_Z + 0.2);
    kit.box(0.7, 0.3, 0.7, kit.lit(0x6f6b7a, 0.9), object, s * 1.4, 0.85, DOOR_Z + 0.2);
  }
}

export function createDoorway(group: PlaceGroup, next: PlaceLook): Doorway {
  const kit = new Kit();
  const object = new Group();
  if (group === 'town' || group === 'busy' || group === 'adventure') {
    if (group === 'town') buildGate(kit, object, next);
    else if (group === 'busy') buildShopDoors(kit, object, next);
    else buildPortal(kit, object, next);
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
