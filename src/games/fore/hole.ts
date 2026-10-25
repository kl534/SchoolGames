import {
  BufferGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RingGeometry,
  type Material,
} from 'three';
import { TREE_HEIGHT } from './shot';
import { centreX, FAIRWAY_HALF, GREEN_R, ROUGH_HALF, type Ellipse, type Hole } from './course';

export const SKY = 0x8fd0ff;

/** The cup is drawn true size (4.25 in across), much smaller than the CUP_R that counts as holed. */
export const CUP_VISUAL_R = 0.06;
/** The flash ring that helps the eye find the cup, and how near the pin must be for it to show. */
const FLASH_R = 0.9;
export const CUP_AID_RANGE = 40;
const POLE_H = 2.4;
const CLOTH_W = 0.55;
const CLOTH_H = 0.36;

/** Markers across the fairway: yards from the pin and their colour. */
const MARKERS: readonly [number, number][] = [
  [150, 0xffffff],
  [100, 0xffe45c],
];

export interface HoleScene {
  object: Group;
  /** Waves the flag and pulses the cup's flash ring; `t` in seconds. */
  update(t: number): void;
  /** Shows the flash ring around the cup (when the ball is on the green or the pin is near). */
  setCupAid(on: boolean): void;
  dispose(): void;
}

/** A flat coloured layer a little above the one below; polygon offset keeps it clear at range. */
function layer(color: number, level: number, opacity = 1): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    polygonOffset: true,
    polygonOffsetFactor: -level,
    polygonOffsetUnits: -level,
    side: DoubleSide,
  });
}

function flat(geometry: BufferGeometry, material: Material, y: number): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

function ellipse(e: Ellipse, material: Material, y: number): Mesh {
  const mesh = flat(new CircleGeometry(1, 40), material, y);
  mesh.scale.set(e.rx, e.rz, 1);
  mesh.position.x = e.x;
  mesh.position.z = e.z;
  return mesh;
}

/** The fairway as a ribbon along the bent centre line, a sample every 10 yd. */
function fairwayRibbon(h: Hole): BufferGeometry {
  const zs: number[] = [];
  for (let z = 0; z < h.length; z += 10) zs.push(z);
  zs.push(h.length);
  const positions: number[] = [];
  const index: number[] = [];
  zs.forEach((z, i) => {
    const c = centreX(h, z);
    positions.push(c - FAIRWAY_HALF, 0, z, c + FAIRWAY_HALF, 0, z);
    if (i > 0) {
      const a = (i - 1) * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  return geometry;
}

/** Builds one hole's ground, hazards, tee and flag. Dispose it before building the next. */
export function buildHole(h: Hole): HoleScene {
  const object = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const own = <T extends Mesh>(mesh: T): T => {
    geometries.push(mesh.geometry);
    materials.push(mesh.material as Material);
    object.add(mesh);
    return mesh;
  };

  // The rough: one big plane under everything.
  const span = ROUGH_HALF * 2 + 60;
  const rough = own(flat(new PlaneGeometry(span * 2, h.length + 700), layer(0x5f9a45, 0), 0));
  rough.position.z = h.length / 2 + 150;

  const fairway = own(new Mesh(fairwayRibbon(h), layer(0x78c45a, 1)));
  fairway.position.y = 0.04;

  // The green, then hazards on top of it.
  const green = own(
    ellipse({ x: h.pin.x, z: h.pin.z, rx: GREEN_R, rz: GREEN_R }, layer(0x9be07a, 2), 0.08),
  );
  green.name = 'green';
  const fringe = own(
    ellipse(
      { x: h.pin.x, z: h.pin.z, rx: GREEN_R + 2, rz: GREEN_R + 2 },
      layer(0x86d068, 1.5),
      0.06,
    ),
  );
  fringe.name = 'fringe';
  for (const hz of h.hazards) {
    if (hz.kind === 'sand') own(ellipse(hz.at, layer(0xe8cf8f, 3), 0.1));
    else own(ellipse(hz.at, layer(0x3f8fe0, 4, 0.9), 0.12));
  }

  // The tee box.
  const tee = own(flat(new PlaneGeometry(7, 7), layer(0x9be07a, 2), 0.08));
  tee.position.set(0, 0.08, -1);
  for (const side of [-1, 1]) {
    const marker = own(
      new Mesh(
        new CylinderGeometry(0.25, 0.25, 0.7, 8),
        new MeshStandardMaterial({ color: side < 0 ? 0xffffff : 0xfff2a8 }),
      ),
    );
    marker.position.set(side * 3.4, 0.35, -2.6);
  }

  // Distance markers across the fairway: 150 yd (white) and 100 yd (yellow) from the pin, with a
  // post on each edge so they read from the tee.
  for (const [yd, color] of MARKERS) {
    const z = h.length - yd;
    if (z < 30) continue;
    const c = centreX(h, z);
    const stripe = own(flat(new PlaneGeometry(FAIRWAY_HALF * 2, 0.7), layer(color, 2.5), 0.07));
    stripe.position.set(c, 0.07, z);
    for (const side of [-1, 1]) {
      const post = own(
        new Mesh(new CylinderGeometry(0.2, 0.2, 1.6, 8), new MeshStandardMaterial({ color })),
      );
      post.position.set(c + side * (FAIRWAY_HALF + 0.6), 0.8, z);
    }
  }

  // Trees: a trunk under a cone, as tall as the flight check says (TREE_HEIGHT).
  for (const tr of h.trees) {
    const trunk = own(
      new Mesh(
        new CylinderGeometry(tr.r * 0.16, tr.r * 0.22, 2.6, 8),
        new MeshStandardMaterial({ color: 0x6b4a2b }),
      ),
    );
    trunk.position.set(tr.x, 1.3, tr.z);
    const leaves = own(
      new Mesh(
        new ConeGeometry(tr.r, TREE_HEIGHT - 2.4, 12),
        new MeshStandardMaterial({ color: 0x2f7d3a, roughness: 0.9 }),
      ),
    );
    leaves.position.set(tr.x, 2.4 + (TREE_HEIGHT - 2.4) / 2, tr.z);
  }

  // The flag: a thin pole, a two-sided cloth that waves, and a true-size cup with a white rim.
  const pole = own(
    new Mesh(
      new CylinderGeometry(0.015, 0.015, POLE_H, 8),
      new MeshStandardMaterial({ color: 0xf4f4f4 }),
    ),
  );
  pole.position.set(h.pin.x, POLE_H / 2, h.pin.z);
  const cloth = own(
    new Mesh(
      new PlaneGeometry(CLOTH_W, CLOTH_H),
      new MeshStandardMaterial({ color: 0xff3d3d, side: DoubleSide }),
    ),
  );
  cloth.geometry.translate(CLOTH_W / 2, 0, 0);
  cloth.position.set(h.pin.x, POLE_H - CLOTH_H / 2 - 0.02, h.pin.z);
  const pin = { x: h.pin.x, z: h.pin.z };
  const cup = own(
    ellipse({ ...pin, rx: CUP_VISUAL_R, rz: CUP_VISUAL_R }, layer(0x1b1b1b, 5), 0.14),
  );
  cup.name = 'cup';
  const rim = own(flat(new RingGeometry(0.07, 0.09, 24), layer(0xffffff, 5.5), 0.145));
  rim.position.set(pin.x, 0.145, pin.z);
  rim.name = 'rim';
  const flashMaterial = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.55,
    side: DoubleSide,
    depthTest: false,
    depthWrite: false,
  });
  const flash = own(flat(new RingGeometry(FLASH_R - 0.1, FLASH_R, 40), flashMaterial, 0.16));
  flash.position.set(pin.x, 0.16, pin.z);
  flash.renderOrder = 7;
  flash.name = 'flash';
  flash.visible = false;

  return {
    object,
    update(t) {
      // The cloth swings about the pole.
      cloth.rotation.y = Math.sin(t * 3) * 0.3 + Math.sin(t * 7.3) * 0.08;
      flashMaterial.opacity = 0.55 + 0.25 * Math.sin(t * 2 * Math.PI * 1.2);
    },
    setCupAid(on) {
      flash.visible = on;
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      object.removeFromParent();
    },
  };
}
