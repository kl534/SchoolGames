import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  type Material,
} from 'three';
import { centreX, FAIRWAY_HALF, GREEN_R, ROUGH_HALF, type Ellipse, type Hole } from './course';

export const SKY = 0x8fd0ff;

export interface HoleScene {
  object: Group;
  /** Waves the flag; `t` in seconds. */
  update(t: number): void;
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

  // The flag: a pole, a waving cloth and a dark cup.
  const pole = own(
    new Mesh(new CylinderGeometry(0.08, 0.08, 5, 8), new MeshStandardMaterial({ color: 0xf4f4f4 })),
  );
  pole.position.set(h.pin.x, 2.5, h.pin.z);
  const cloth = own(
    new Mesh(
      new BoxGeometry(1.8, 1.1, 0.05),
      new MeshStandardMaterial({ color: 0xff3d3d, side: DoubleSide }),
    ),
  );
  cloth.position.set(h.pin.x + 0.9, 4.4, h.pin.z);
  cloth.geometry.translate(0, 0, 0);
  const cup = own(ellipse({ x: h.pin.x, z: h.pin.z, rx: 0.9, rz: 0.9 }, layer(0x1b1b1b, 5), 0.14));
  cup.name = 'cup';

  return {
    object,
    update(t) {
      cloth.rotation.y = Math.sin(t * 3) * 0.25;
      cloth.position.x = h.pin.x + 0.9 * Math.cos(cloth.rotation.y);
      cloth.position.z = h.pin.z + 0.9 * Math.sin(-cloth.rotation.y);
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      object.removeFromParent();
    },
  };
}
