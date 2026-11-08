/**
 * The jet ski and the lifeguard's rescue boat, built from primitives. Both head along -z (the way
 * the ski goes) and have their origin at the middle of the hull at the waterline.
 */
import {
  CapsuleGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  MeshBasicMaterial,
  PlaneGeometry,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type Object3D,
} from 'three';
import { SEAT } from './anim';
import { Kit } from './kit';

/** The ski is this long, 1.0 wide and 0.9 tall. */
export const SKI_LEN = 2.6;
/** The lagoon's ski accent colour. */
export const LAGOON_ACCENT = 0xff4f8b;

export interface JetSki {
  /** Origin at the hull's middle at the waterline; pitch, roll and yaw it as a whole. */
  object: Group;
  /** The rider's hips go here. */
  seat: Group;
  /** Where the spray and wake come out at the back. */
  nozzle: Object3D;
  /** The handlebars, which turn a touch with the water's chop. */
  bars: Group;
  /** World position of the nozzle, refreshed by `update`. */
  nozzleWorld: Vector3;
  /** Refreshes `nozzleWorld` from the ski's current transform. */
  update(): void;
  dispose(): void;
}

/** The hull's outline from above, nose at +y (which becomes -z): a rounded, tapered boat shape. */
function hullShape(): Shape {
  const half = SKI_LEN / 2;
  const w = 0.5;
  const s = new Shape();
  s.moveTo(-w * 0.82, -half);
  s.lineTo(w * 0.82, -half);
  s.bezierCurveTo(w * 1.05, -half * 0.4, w * 1.05, half * 0.25, w * 0.55, half * 0.75);
  s.quadraticCurveTo(w * 0.2, half * 1.02, 0, half);
  s.quadraticCurveTo(-w * 0.2, half * 1.02, -w * 0.55, half * 0.75);
  s.bezierCurveTo(-w * 1.05, half * 0.25, -w * 1.05, -half * 0.4, -w * 0.82, -half);
  return s;
}

export function createJetSki(accent = LAGOON_ACCENT): JetSki {
  const kit = new Kit();
  const white = kit.lit(0xffffff, 0.35);
  const stripe = kit.lit(accent, 0.4);
  const dark = kit.lit(0x23232e, 0.7);
  const steel = kit.lit(0xc9ced9, 0.3);
  const glass = kit.glass(0x7fd4ff, 0.7);

  const object = new Group();

  // The hull: an extruded, bevelled outline, laid flat. Its top is the deck.
  const hullGeometry = new ExtrudeGeometry(hullShape(), {
    depth: 0.3,
    bevelEnabled: true,
    bevelThickness: 0.14,
    bevelSize: 0.1,
    bevelSegments: 3,
    curveSegments: 14,
  });
  hullGeometry.rotateX(-Math.PI / 2);
  const hull = kit.mesh(hullGeometry, white, object, 0, -0.12, 0);
  hull.name = 'hull';
  // The deck stripe along each side and a keel line.
  for (const side of [-1, 1]) {
    const bar = kit.box(0.07, 0.05, SKI_LEN * 0.82, stripe, object, side * 0.43, 0.3, 0.05);
    bar.rotation.z = side * -0.1;
  }
  kit.box(0.5, 0.045, SKI_LEN * 0.5, stripe, object, 0, 0.345, 0.45);

  // The seat, a long dark saddle toward the back.
  const saddle = kit.mesh(new CapsuleGeometry(0.2, 0.7, 6, 12), dark, object, 0, 0.45, 0.35);
  saddle.rotation.x = Math.PI / 2;
  saddle.scale.set(1.15, 1, 0.55);

  // The console and handlebars toward the front.
  kit.mesh(new SphereGeometry(0.3, 16, 12), white, object, 0, 0.42, -0.5).scale.set(1, 0.7, 1.2);
  kit.mesh(new SphereGeometry(0.2, 12, 8), glass, object, 0, 0.62, -0.62).scale.set(1.1, 0.55, 1);
  kit.box(0.14, 0.05, 0.3, stripe, object, 0, 0.58, -0.28);
  const bars = new Group();
  bars.position.set(0, 0.8, -0.38);
  object.add(bars);
  kit.mesh(new CylinderGeometry(0.025, 0.025, 0.78, 8), steel, bars).rotation.z = Math.PI / 2;
  for (const side of [-1, 1]) {
    kit.mesh(new CylinderGeometry(0.04, 0.04, 0.16, 8), dark, bars, side * 0.4, 0, 0).rotation.z =
      Math.PI / 2;
  }
  const column = kit.mesh(new CylinderGeometry(0.03, 0.04, 0.3, 8), steel, object, 0, 0.62, -0.38);
  column.rotation.x = 0.3;

  // The nozzle at the back, and a ring round it.
  const nozzle = new Group();
  nozzle.position.set(0, 0.12, SKI_LEN / 2 + 0.05);
  object.add(nozzle);
  kit.mesh(new CylinderGeometry(0.15, 0.2, 0.22, 14), dark, nozzle).rotation.x = Math.PI / 2;
  kit.mesh(new TorusGeometry(0.16, 0.025, 6, 16), steel, nozzle, 0, 0, 0.1);

  // The seat anchor: where the rider's hips go.
  const seat = new Group();
  seat.position.set(0, SEAT.up, SEAT.back);
  object.add(seat);

  const nozzleWorld = new Vector3();
  return {
    object,
    seat,
    nozzle,
    bars,
    nozzleWorld,
    update() {
      object.updateWorldMatrix(true, false);
      nozzle.getWorldPosition(nozzleWorld);
    },
    dispose() {
      kit.dispose();
      object.removeFromParent();
    },
  };
}

// ---------- The rescue boat ----------

/** The rescue boat is 4.5 long. */
export const BOAT_LEN = 4.5;

export interface RescueBoat {
  /** Origin at the middle of the boat at the waterline, heading -z. */
  object: Group;
  /** Where the tow rope is tied, at the stern, in the boat's own space. */
  tow: Object3D;
  /** Stretches the tow rope from the stern to a world point (the spare ski's bow). */
  aimRope(x: number, y: number, z: number): void;
  setOpacity(opacity: number): void;
  update(time: number): void;
  dispose(): void;
}

export function createRescueBoat(): RescueBoat {
  const kit = new Kit();
  const red = kit.lit(0xe8403a, 0.55);
  const darkRed = kit.lit(0xb52a26, 0.6);
  const grey = kit.lit(0x4a4f63, 0.6);
  const yellow = kit.lit(0xffd43b, 0.6);
  const skin = kit.lit(0xf1b48a, 0.75);
  const rope = kit.lit(0xf4f4f4, 0.8);
  const dark = kit.lit(0x23232e, 0.7);
  const object = new Group();

  // Two fat tubes along the sides, joined at the bow, and a floor between them.
  const half = BOAT_LEN / 2;
  for (const side of [-1, 1]) {
    const tube = kit.mesh(
      new CapsuleGeometry(0.34, BOAT_LEN - 1.1, 8, 16),
      red,
      object,
      side * 0.68,
      0.28,
      0,
    );
    tube.rotation.x = Math.PI / 2;
  }
  kit
    .mesh(new SphereGeometry(0.42, 16, 12), red, object, 0, 0.28, -half + 0.35)
    .scale.set(1.2, 0.85, 1.4);
  kit.box(1.5, 0.12, BOAT_LEN - 0.9, grey, object, 0, 0.1, 0.15);
  kit.box(1.4, 0.34, 0.5, darkRed, object, 0, 0.3, half - 0.6);
  // The RESCUE stripe on each side, painted on a canvas.
  const label = kit.paint(256, 64, (g) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#e8403a';
    g.font = '900 46px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('RESCUE', 128, 34);
  });
  const labelMaterial = new MeshBasicMaterial({ color: 0xffffff, map: label ?? undefined });
  kit.materials.push(labelMaterial);
  for (const side of [-1, 1]) {
    const plane = kit.mesh(
      new PlaneGeometry(1.7, 0.42),
      labelMaterial,
      object,
      side * 1.025,
      0.3,
      0.1,
    );
    plane.rotation.y = side * (Math.PI / 2);
  }

  // The outboard motor at the stern.
  kit.box(0.3, 0.55, 0.3, dark, object, 0, 0.45, half + 0.05);
  const tow = new Group();
  tow.position.set(0, 0.5, half + 0.2);
  object.add(tow);

  // The lifeguard at the tiller: a yellow shirt and a red cap.
  const guard = new Group();
  guard.position.set(0.0, 0.2, half - 0.55);
  object.add(guard);
  kit.mesh(new CapsuleGeometry(0.2, 0.35, 6, 12), yellow, guard, 0, 0.62, 0);
  kit.mesh(new SphereGeometry(0.19, 16, 12), skin, guard, 0, 1.2, 0);
  const cap = kit.mesh(
    new SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, 0, 1.4),
    red,
    guard,
    0,
    1.24,
    0,
  );
  cap.rotation.x = -0.15;
  kit.box(0.22, 0.03, 0.14, red, guard, 0, 1.23, -0.19);
  for (const side of [-1, 1]) {
    const arm = kit.mesh(
      new CapsuleGeometry(0.06, 0.4, 4, 8),
      yellow,
      guard,
      side * 0.24,
      0.78,
      0.02,
    );
    arm.rotation.set(-0.9, 0, side * -0.2);
  }
  for (const side of [-1, 1]) {
    kit.mesh(
      new CapsuleGeometry(0.07, 0.35, 4, 8),
      kit.lit(0x2d3a8c, 0.8),
      guard,
      side * 0.11,
      0.1,
      -0.15,
    ).rotation.x = Math.PI / 2 - 0.2;
  }

  // The tow rope: a thin white box stretched between two points.
  const ropeMesh = kit.mesh(new CylinderGeometry(0.025, 0.025, 1, 6), rope, object);
  ropeMesh.visible = false;
  const a = new Vector3();
  const b = new Vector3();
  const mid = new Vector3();

  return {
    object,
    tow,
    aimRope(x, y, z) {
      object.updateWorldMatrix(true, false);
      tow.getWorldPosition(a);
      b.set(x, y, z);
      const length = a.distanceTo(b);
      ropeMesh.visible = length > 0.05;
      // The rope is a child of the boat, so put its ends into the boat's space.
      object.worldToLocal(a);
      object.worldToLocal(b);
      mid.copy(a).add(b).multiplyScalar(0.5);
      ropeMesh.position.copy(mid);
      ropeMesh.scale.set(1, Math.max(a.distanceTo(b), 0.01), 1);
      ropeMesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize());
    },
    setOpacity(opacity) {
      const visible = opacity > 0.01;
      object.visible = visible;
      for (const m of kit.materials) {
        const material = m as { transparent: boolean; opacity: number };
        material.transparent = opacity < 0.999;
        material.opacity = opacity;
      }
    },
    update(time) {
      object.rotation.z = Math.sin(time * 2.2) * 0.03;
    },
    dispose() {
      kit.dispose();
      object.removeFromParent();
    },
  };
}
