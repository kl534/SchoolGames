/**
 * The built things of a hole: the clubhouse and two golf carts on holes 1 and 9, the yardage sign
 * on every tee and the sprinkler heads down the fairway. Boxes and cylinders merged by material, so
 * the whole set is a handful of draw calls.
 */
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  ShapeGeometry,
  SRGBColorSpace,
  Shape,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { centreX, HOLES, type Hole } from './course';
import { FALLBACK_LOOK, type Look } from './ground';
import { clubhouseSite } from './scenery';
import { groundY } from './terrain';

export interface Props {
  object: Group;
  dispose(): void;
}

/** Yards from the pin where the sprinkler heads sit (those with z >= 0). */
export const SPRINKLER_YARDS: readonly number[] = [200, 150, 100];
export const CLUBHOUSE = { long: 30, wide: 14, storey: 3.2, porch: 6 } as const;
/** Where the yardage sign stands: 4 yd left of the tee box (the box is 8 yd wide). */
export const SIGN_AT = { x: 8, z: 2.5 } as const;

const WALL = 0xefe9df;
const ROOF = 0x4a4d52;
const CANOPY = 0x2f5a3a;

const box = (w: number, h: number, d: number, x: number, y: number, z: number) =>
  new BoxGeometry(w, h, d).translate(x, y, z);

const merge = (list: BufferGeometry[]): BufferGeometry => {
  const merged = mergeGeometries(list, false);
  list.forEach((g) => g.dispose());
  return merged;
};

/** The clubhouse in its own frame: long side along z, porch on the +x face, floor at y = 0. */
function clubhouseParts(): { geometry: BufferGeometry; material: Material }[] {
  const { long, wide, storey, porch } = CLUBHOUSE;
  const half = wide / 2;
  const floor = 0.5;
  const wallH = storey * 2;
  const walls: BufferGeometry[] = [box(wide, wallH, long, 0, floor + wallH / 2, 0)];
  const plinth = box(wide + 0.5, 3, long + 0.5, 0, -1, 0);
  // Roof: pitched at 30 degrees over the short span, with a 0.6 yd overhang.
  const overhang = 0.6;
  const span = half + overhang;
  const slope = span / Math.cos(Math.PI / 6);
  const ridge = floor + wallH + half * Math.tan(Math.PI / 6);
  const roof: BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    roof.push(
      new PlaneGeometry(slope, long + overhang * 2)
        .rotateX(-Math.PI / 2)
        .rotateZ(-side * (Math.PI / 6))
        .translate(side * (slope / 2) * Math.cos(Math.PI / 6), ridge - (slope / 2) * 0.5, 0),
    );
  }
  // The two gable ends close the roof in wall colour.
  const gableTop = floor + wallH + half * Math.tan(Math.PI / 6);
  const gable = new Shape()
    .moveTo(-half, 0)
    .lineTo(half, 0)
    .lineTo(0, gableTop - (floor + wallH));
  for (const end of [-1, 1]) {
    walls.push(
      new ShapeGeometry(gable)
        .rotateY(end < 0 ? Math.PI : 0)
        .translate(0, floor + wallH, (end * long) / 2),
    );
  }
  // Windows: six per storey on each long side; the door sits between the middle two below.
  const glass: BufferGeometry[] = [];
  const frames: BufferGeometry[] = [];
  for (const face of [-1, 1]) {
    for (let storeyNo = 0; storeyNo < 2; storeyNo++) {
      const y = floor + storey * (storeyNo + 0.55);
      for (let i = 0; i < 6; i++) {
        const z = -12.5 + i * 5;
        glass.push(box(0.14, 1.7, 1.5, face * (half + 0.03), y, z));
        // A white frame round the glass and a sill under it.
        frames.push(box(0.1, 2.0, 1.85, face * (half + 0.01), y, z));
        frames.push(box(0.42, 0.1, 2.05, face * (half + 0.14), y - 1.02, z));
      }
    }
  }
  // The porch: deck, a flat roof and four posts, with the door behind.
  const trim: BufferGeometry[] = [
    box(3, 0.3, porch, half + 1.5, floor + 0.15, 0),
    box(3.4, 0.25, porch + 0.5, half + 1.6, floor + 3.5, 0),
  ];
  for (const z of [-2.7, -0.9, 0.9, 2.7])
    trim.push(box(0.22, 3.2, 0.22, half + 2.8, floor + 1.9, z));
  // The chimney: brick, through the roof on the long side behind the porch, with a cap.
  const chimneyX = -3;
  const chimneyBase = ridge - Math.abs(chimneyX) * Math.tan(Math.PI / 6) - 1;
  const chimney = [
    box(1.3, 4.6, 1.3, chimneyX, chimneyBase + 2.3, 8),
    box(1.7, 0.2, 1.7, chimneyX, chimneyBase + 4.7, 8),
  ];
  const door = box(0.14, 2.2, 1.6, half + 0.04, floor + 1.1, 0);
  const white = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  return [
    { geometry: merge(walls), material: new MeshStandardMaterial({ color: WALL, roughness: 0.9 }) },
    { geometry: plinth, material: new MeshStandardMaterial({ color: 0x6b6862, roughness: 0.95 }) },
    { geometry: merge(frames), material: white },
    {
      geometry: merge(chimney),
      material: new MeshStandardMaterial({ color: 0x8a5645, roughness: 0.95 }),
    },
    {
      geometry: merge(roof),
      material: new MeshStandardMaterial({ color: ROOF, roughness: 0.8, side: DoubleSide }),
    },
    {
      geometry: merge(glass),
      material: new MeshPhysicalMaterial({
        color: 0x1b2530,
        roughness: 0.05,
        metalness: 0,
        envMapIntensity: 1.3,
      }),
    },
    { geometry: merge(trim), material: white },
    { geometry: door, material: new MeshStandardMaterial({ color: 0x4a3322, roughness: 0.7 }) },
  ];
}

/** One golf cart (2.6 x 1.3 x 2 yd) in its own frame, nose along +x, on y = 0. */
function cartParts(): {
  white: BufferGeometry[];
  canopy: BufferGeometry[];
  tyres: BufferGeometry[];
} {
  const white: BufferGeometry[] = [
    box(2.6, 0.45, 1.2, 0, 0.55, 0),
    box(0.8, 0.35, 1.15, 0.9, 0.95, 0),
    box(0.7, 0.55, 1.05, -0.55, 0.95, 0),
    box(0.15, 0.7, 1.1, -0.95, 1.2, 0),
  ];
  for (const x of [-1.1, 1.0]) {
    for (const z of [-0.6, 0.6]) white.push(box(0.07, 1.0, 0.07, x, 1.45, z));
  }
  const canopy = [box(2.7, 0.08, 1.4, 0, 1.95, 0)];
  const tyres: BufferGeometry[] = [];
  for (const x of [-0.9, 0.9]) {
    for (const z of [-0.62, 0.62]) {
      tyres.push(
        new CylinderGeometry(0.3, 0.3, 0.22, 12).rotateX(Math.PI / 2).translate(x, 0.3, z),
      );
    }
  }
  return { white, canopy, tyres };
}

/** The yardage sign's face: "Hole N", then "Par P · L yd". Null with no canvas (Node). */
function signTexture(h: Hole): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 180;
  const c = canvas.getContext('2d');
  if (!c) return null;
  c.fillStyle = '#f6f3ea';
  c.fillRect(0, 0, 256, 180);
  c.strokeStyle = '#1f4d2e';
  c.lineWidth = 8;
  c.strokeRect(6, 6, 244, 168);
  c.fillStyle = '#1f4d2e';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = 'bold 64px sans-serif';
  c.fillText(`Hole ${HOLES.indexOf(h) + 1}`, 128, 62);
  c.font = 'bold 36px sans-serif';
  c.fillText(`Par ${h.par} · ${h.length} yd`, 128, 128);
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Builds the props of one hole. Dispose it with the hole. */
export function buildProps(h: Hole, look: Look = FALLBACK_LOOK): Props {
  const object = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const textures: CanvasTexture[] = [];
  const shadows = look.shadows;
  const add = (parent: Object3D, g: BufferGeometry, m: Material) => {
    geometries.push(g);
    if (!materials.includes(m)) materials.push(m);
    const mesh = new Mesh(g, m);
    mesh.castShadow = mesh.receiveShadow = shadows;
    parent.add(mesh);
    return mesh;
  };

  const site = clubhouseSite(h);
  if (site) {
    const house = new Group();
    house.name = 'clubhouse';
    house.position.set(site.x, groundY(h, site.x, site.z), site.z);
    house.rotation.y = site.yaw;
    for (const part of clubhouseParts()) add(house, part.geometry, part.material);
    // Two carts parked on a paved pad beside the porch.
    const pad = new Group();
    pad.name = 'carts';
    const { white, canopy, tyres } = cartParts();
    const placed = (list: BufferGeometry[], at: [number, number, number][]) =>
      merge(
        at.flatMap(([x, z, yaw]) => list.map((g) => g.clone().rotateY(yaw).translate(x, 0, z))),
      );
    const spots: [number, number, number][] = [
      [CLUBHOUSE.wide / 2 + 6, -9, 0.3],
      [CLUBHOUSE.wide / 2 + 6, -5.5, -0.15],
    ];
    add(pad, placed(white, spots), new MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }));
    add(pad, placed(canopy, spots), new MeshStandardMaterial({ color: CANOPY, roughness: 0.6 }));
    add(pad, placed(tyres, spots), new MeshStandardMaterial({ color: 0x151515, roughness: 0.9 }));
    for (const g of [...white, ...canopy, ...tyres]) g.dispose();
    add(
      pad,
      box(7, 1.2, 9, CLUBHOUSE.wide / 2 + 6, -0.57, -7.2),
      new MeshStandardMaterial({ color: 0xc4c2ba, roughness: 0.9 }),
    );
    // The pad follows the ground under it (its top is flush), not the building's floor.
    const cx = CLUBHOUSE.wide / 2 + 6;
    const cz = -7.2;
    const wx = site.x + cx * Math.cos(site.yaw) + cz * Math.sin(site.yaw);
    const wz = site.z - cx * Math.sin(site.yaw) + cz * Math.cos(site.yaw);
    pad.position.y = groundY(h, wx, wz) - house.position.y;
    house.add(pad);
    object.add(house);
  }

  // The yardage sign on its post, turned a little towards the player behind the tee.
  const sign = new Group();
  sign.name = 'sign';
  sign.position.set(SIGN_AT.x, groundY(h, SIGN_AT.x, SIGN_AT.z), SIGN_AT.z);
  sign.rotation.y = -2.7;
  const post = new MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.6 });
  add(sign, new CylinderGeometry(0.05, 0.05, 1.4, 8).translate(0, 0.7, 0), post);
  const boardMaterial = new MeshStandardMaterial({ color: 0xf6f3ea, roughness: 0.6 });
  add(sign, box(1, 0.7, 0.05, 0, 1.35, 0), boardMaterial);
  const face = signTexture(h);
  if (face) {
    textures.push(face);
    const faceMaterial = new MeshStandardMaterial({ map: face, roughness: 0.6 });
    add(sign, new PlaneGeometry(0.96, 0.67).translate(0, 1.35, 0.03), faceMaterial);
  }
  object.add(sign);

  // Sprinkler heads on the fairway's centre line.
  const heads = SPRINKLER_YARDS.map((yd) => h.length - yd).filter((z) => z >= 0);
  if (heads.length > 0) {
    const geometry = new CylinderGeometry(0.1, 0.1, 0.03, 12);
    const material = new MeshStandardMaterial({ color: 0x26402a, roughness: 0.6 });
    geometries.push(geometry);
    materials.push(material);
    const mesh = new InstancedMesh(geometry, material, heads.length);
    const dummy = new Object3D();
    heads.forEach((z, i) => {
      dummy.position.set(centreX(h, z), 0.065, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.frustumCulled = false;
    mesh.receiveShadow = shadows;
    object.add(mesh);
  }

  return {
    object,
    dispose() {
      object.traverse(
        (o) => (o as InstancedMesh).isInstancedMesh && (o as InstancedMesh).dispose(),
      );
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      object.clear();
      object.removeFromParent();
    },
  };
}
