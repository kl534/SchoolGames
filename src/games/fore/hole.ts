import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  type Material,
  type Texture,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seededRandom } from '../../shared/random';
import { TREE_HEIGHT } from './shot';
import { centreX, FAIRWAY_HALF, GREEN_R, type Ellipse, type Hole } from './course';
import {
  disposeGroundTextures,
  ellipseRing,
  groundTextures,
  ribbon,
  scaleUV,
  strip,
} from './ground';
import { cartPath, placeScenery, PATH_WIDTH } from './scenery';
import { buildHills, HORIZON } from './sky';
import { buildTreeLayer, type TreePlacement } from './trees';

/** The horizon colour: the fog, the background and the bottom of the sky dome. */
export const SKY = HORIZON;

/** The cup is drawn true size (4.25 in across), much smaller than the CUP_R that counts as holed. */
export const CUP_VISUAL_R = 0.06;
/** The flash ring that helps the eye find the cup, and how near the pin must be for it to show. */
const FLASH_R = 0.9;
export const CUP_AID_RANGE = 40;
const POLE_H = 2.4;
const CLOTH_W = 0.55;
const CLOTH_H = 0.36;
/** One tile of grass texture covers this many yards. */
const GRASS_TILE = 8;

/** Markers across the fairway: yards from the pin and their colour. */
const MARKERS: readonly [number, number][] = [
  [150, 0xffffff],
  [100, 0xffe45c],
];

export interface HoleScene {
  object: Group;
  /** Waves the flag, ripples the ponds and pulses the cup's flash ring; `t` in seconds. */
  update(t: number): void;
  /** Shows the flash ring around the cup (when the ball is on the green or the pin is near). */
  setCupAid(on: boolean): void;
  dispose(): void;
}

/** A lit flat layer a little above the one below; polygon offset keeps it clear at range. */
function layer(color: number, level: number, map?: Texture, vertexColors = false): Material {
  return new MeshLambertMaterial({
    color,
    map: map ?? null,
    vertexColors,
    polygonOffset: true,
    polygonOffsetFactor: -level,
    polygonOffsetUnits: -level,
  });
}

function flat(geometry: BufferGeometry, material: Material, y: number): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

function ellipse(e: Ellipse, material: Material, y: number, segments = 40): Mesh {
  const mesh = flat(new CircleGeometry(1, segments), material, y);
  mesh.scale.set(e.rx, e.rz, 1);
  mesh.position.x = e.x;
  mesh.position.z = e.z;
  return mesh;
}

/** Paints a circle's vertices: the centre one colour, the edge another. */
function gradientCircle(centre: number, edge: number): BufferGeometry {
  const g = new CircleGeometry(1, 40);
  const a = new Color(centre);
  const b = new Color(edge);
  const colours: number[] = [];
  for (let i = 0; i < g.getAttribute('position').count; i++) {
    const c = i === 0 ? a : b;
    colours.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new Float32BufferAttribute(colours, 3));
  return g;
}

/** Builds one hole's ground, hazards, scenery, tee and flag. Dispose it before building the next. */
export function buildHole(h: Hole): HoleScene {
  const object = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const rand = seededRandom(Math.round(h.length * 13 + h.bend * 101 + 3));
  const textures = groundTextures();
  const own = <T extends Mesh | InstancedMesh>(mesh: T, ground = false): T => {
    geometries.push(mesh.geometry);
    materials.push(mesh.material as Material);
    mesh.receiveShadow = ground;
    object.add(mesh);
    return mesh;
  };
  const ownMaterial = <T extends Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // The rough: one big plane under everything, out to the foot of the hills.
  const roughW = 1000;
  const roughL = h.length + 800;
  const rough = own(
    flat(
      scaleUV(new PlaneGeometry(roughW, roughL), roughW / GRASS_TILE, roughL / GRASS_TILE),
      layer(0x5f9a45, 0, textures.grass),
      0,
    ),
    true,
  );
  rough.position.z = h.length / 2 + 100;

  // The fairway: stripes 6 yd wide along the hole, with a lighter edge strip each side.
  const fairway = own(
    new Mesh(ribbon(h, -FAIRWAY_HALF, FAIRWAY_HALF), layer(0xffffff, 1, textures.fairway)),
    true,
  );
  fairway.position.y = 0.04;
  const edges = own(
    new Mesh(
      mergeGeometries([
        ribbon(h, -FAIRWAY_HALF, -FAIRWAY_HALF + 1.2),
        ribbon(h, FAIRWAY_HALF - 1.2, FAIRWAY_HALF),
      ]),
      layer(0x9ee07c, 1.2, textures.grass),
    ),
    true,
  );
  edges.position.y = 0.045;

  // The green: mown rings, a darker fringe and an apron of short fairway grass.
  const around = (r: number) => ({ x: h.pin.x, z: h.pin.z, rx: r, rz: r });
  const apron = own(
    ellipse(around(GREEN_R + 5), layer(0x78c45a, 1.3, textures.grass), 0.05, 56),
    true,
  );
  apron.name = 'apron';
  const fringe = own(
    ellipse(around(GREEN_R + 2), layer(0x86d068, 1.5, textures.grass), 0.06, 56),
    true,
  );
  fringe.name = 'fringe';
  const green = own(ellipse(around(GREEN_R), layer(0x9be07a, 2, textures.green), 0.08, 56), true);
  green.name = 'green';

  // Hazards: sand with a dark lip and a raised grassy rim; ponds with a shore and a ripple.
  const ripples: { mesh: Mesh; material: MeshBasicMaterial; at: Ellipse; phase: number }[] = [];
  const reeds: { x: number; z: number; tilt: number; size: number }[] = [];
  for (const hz of h.hazards) {
    const e = hz.at;
    if (hz.kind === 'sand') {
      // A grassy rim raised 0.15 yd, a darker lip, then the sand itself.
      own(
        new Mesh(ellipseRing(e, 0.8, 1.8, 0.15, 0.03), layer(0x74b04f, 2.6, textures.grass)),
        true,
      );
      own(new Mesh(ellipseRing(e, 0, 0.8, 0.1, 0.12), layer(0xb89a5a, 2.8, textures.sand)), true);
      own(ellipse(e, layer(0xe8cf8f, 3, textures.sand), 0.1), true);
    } else {
      own(new Mesh(ellipseRing(e, 0, 1.4, 0.11, 0.1), layer(0xd5eab8, 3.2)), true);
      const pond = own(
        new Mesh(gradientCircle(0x2f78c8, 0x5fb0f0), layer(0xffffff, 4, undefined, true)),
        true,
      );
      pond.rotation.x = -Math.PI / 2;
      pond.position.set(e.x, 0.12, e.z);
      pond.scale.set(e.rx, e.rz, 1);
      for (let k = 0; k < 2; k++) {
        const material = new MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.4,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -4.5,
          polygonOffsetUnits: -4.5,
        });
        const ring = own(flat(new RingGeometry(0.86, 0.9, 48), material, 0.125));
        ring.position.set(e.x, 0.125, e.z);
        ripples.push({ mesh: ring, material, at: e, phase: k * 0.5 });
      }
      const clumps = 6 + Math.floor(rand() * 5);
      for (let c = 0; c < clumps; c++) {
        const a = rand() * Math.PI * 2;
        for (let r = 0; r < 4; r++) {
          reeds.push({
            x: e.x + (e.rx + 0.5) * Math.cos(a) + (rand() - 0.5) * 0.7,
            z: e.z + (e.rz + 0.5) * Math.sin(a) + (rand() - 0.5) * 0.7,
            tilt: (rand() - 0.5) * 0.3,
            size: 0.8 + rand() * 0.7,
          });
        }
      }
    }
  }
  const dummy = new Object3D();
  if (reeds.length > 0) {
    const reedMesh = own(
      new InstancedMesh(
        new ConeGeometry(0.05, 1.1, 4).translate(0, 0.55, 0),
        new MeshLambertMaterial({ color: 0x5f8a3a }),
        reeds.length,
      ),
    );
    reeds.forEach((r, i) => {
      dummy.position.set(r.x, 0.1, r.z);
      dummy.rotation.set(r.tilt, 0, -r.tilt);
      dummy.scale.set(1, r.size, 1);
      dummy.updateMatrix();
      reedMesh.setMatrixAt(i, dummy.matrix);
    });
    reedMesh.frustumCulled = false;
  }

  // The cart path along the grove side, broken where it would meet a hazard or a tree.
  const scenery = placeScenery(h);
  const runs = cartPath(h, scenery.groveSide);
  if (runs.length > 0) {
    const path = own(
      new Mesh(mergeGeometries(runs.map((run) => strip(run, PATH_WIDTH))), layer(0xc4c2ba, 0.8)),
      true,
    );
    path.position.y = 0.03;
  }

  // The tee: a mown rectangle, two tee blocks, a yardage plaque, a ball washer and a bench.
  const tee = own(
    flat(scaleUV(new PlaneGeometry(8, 10), 1, 1.25), layer(0x8fdc72, 2, textures.grass), 0.08),
    true,
  );
  tee.position.set(0, 0.08, 0);
  const block = ownMaterial(new MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.8 }));
  const wood = ownMaterial(new MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.9 }));
  const white = ownMaterial(new MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.7 }));
  const green2 = ownMaterial(new MeshStandardMaterial({ color: 0x2f5f3a, roughness: 0.6 }));
  const prop = (g: BufferGeometry, m: Material, x: number, y: number, z: number, yaw = 0) => {
    geometries.push(g);
    const mesh = new Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw;
    mesh.castShadow = true;
    object.add(mesh);
  };
  for (const side of [-1, 1]) prop(new SphereGeometry(0.2, 10, 8), block, side * 3.4, 0.25, 0.4);
  prop(new CylinderGeometry(0.05, 0.05, 1.1, 6), wood, 5.8, 0.63, 3, -0.3);
  prop(new BoxGeometry(0.8, 0.45, 0.05), white, 5.8, 1.1, 3, -0.3);
  prop(new CylinderGeometry(0.13, 0.15, 1, 8), green2, -5.5, 0.58, 2.4);
  prop(new BoxGeometry(0.34, 0.12, 0.34), white, -5.5, 1.14, 2.4);
  prop(new BoxGeometry(1.6, 0.08, 0.5), wood, -6.6, 0.5, -2.4, 0.3);
  prop(new BoxGeometry(1.6, 0.45, 0.06), wood, -6.65, 0.8, -2.6, 0.3);
  for (const s of [-0.65, 0.65]) {
    prop(
      new BoxGeometry(0.08, 0.46, 0.4),
      wood,
      -6.6 + s * Math.cos(0.3),
      0.27,
      -2.4 - s * Math.sin(0.3),
      0.3,
    );
  }

  // Distance markers across the fairway: 150 yd (white) and 100 yd (yellow) from the pin, with a
  // post on each edge so they read from the tee.
  for (const [yd, color] of MARKERS) {
    const z = h.length - yd;
    if (z < 30) continue;
    const c = centreX(h, z);
    const stripe = own(
      flat(new PlaneGeometry(FAIRWAY_HALF * 2, 0.7), layer(color, 2.5), 0.07),
      true,
    );
    stripe.position.set(c, 0.07, z);
    for (const side of [-1, 1]) {
      const post = own(
        new Mesh(
          new CylinderGeometry(0.2, 0.2, 1.6, 8),
          new MeshStandardMaterial({ color, roughness: 0.7 }),
        ),
      );
      post.position.set(c + side * (FAIRWAY_HALF + 0.6), 0.8, z);
    }
  }

  // Trees: the gameplay trees (oak and pine in turn, exactly as tall as the flight check says),
  // then the scenery trees. Bushes, rocks and flowers are instanced too.
  const placements: TreePlacement[] = h.trees.map((tr, i) => ({
    x: tr.x,
    z: tr.z,
    r: tr.r,
    height: TREE_HEIGHT,
    species: i % 2 === 0 ? 'oak' : 'pine',
    yaw: rand() * Math.PI * 2,
  }));
  for (const t of scenery.trees) placements.push(t);
  const treeLayer = buildTreeLayer(placements);
  object.add(treeLayer.object);

  const tint = new Color();
  if (scenery.bushes.length > 0) {
    const bushes = own(
      new InstancedMesh(
        new IcosahedronGeometry(1, 1),
        new MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
        scenery.bushes.length,
      ),
    );
    scenery.bushes.forEach((b, i) => {
      dummy.position.set(b.x, b.r * 0.4, b.z);
      dummy.rotation.set(0, i, 0);
      dummy.scale.set(b.r, b.r * 0.75, b.r);
      dummy.updateMatrix();
      bushes.setMatrixAt(i, dummy.matrix);
      bushes.setColorAt(
        i,
        tint.setHex(0x3a7f3a).offsetHSL(0, 0, (((i * 37) % 17) / 17) * 0.1 - 0.05),
      );
    });
    bushes.frustumCulled = false;
  }
  if (scenery.rocks.length > 0) {
    const rocks = own(
      new InstancedMesh(
        new IcosahedronGeometry(1, 0),
        new MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
        scenery.rocks.length,
      ),
    );
    scenery.rocks.forEach((r, i) => {
      dummy.position.set(r.x, r.r * 0.25, r.z);
      dummy.rotation.set(0.2, r.yaw, 0.15);
      dummy.scale.set(r.r, r.r * 0.6, r.r * 0.85);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
      rocks.setColorAt(i, tint.setHex(0x8d8c86).offsetHSL(0, 0, (((i * 5) % 7) / 7) * 0.12 - 0.06));
    });
    rocks.frustumCulled = false;
  }
  if (scenery.flowers.length > 0) {
    const flowers = own(
      new InstancedMesh(
        new PlaneGeometry(0.34, 0.34).rotateX(-Math.PI / 2),
        new MeshLambertMaterial({ color: 0xffffff, side: DoubleSide }),
        scenery.flowers.length,
      ),
    );
    scenery.flowers.forEach((f, i) => {
      dummy.position.set(f.x, 0.13, f.z);
      dummy.rotation.set(0, i * 2.4, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      flowers.setMatrixAt(i, dummy.matrix);
      flowers.setColorAt(i, tint.setHex(f.color));
    });
    flowers.frustumCulled = false;
  }

  const hills = buildHills(h);
  object.add(hills.object);

  // The flag: a thin pole, a two-sided cloth that waves, and a true-size cup with a white rim.
  const pole = own(
    new Mesh(
      new CylinderGeometry(0.015, 0.015, POLE_H, 8),
      new MeshStandardMaterial({ color: 0xf4f4f4 }),
    ),
  );
  pole.position.set(h.pin.x, POLE_H / 2, h.pin.z);
  pole.castShadow = true;
  const cloth = own(
    new Mesh(
      new PlaneGeometry(CLOTH_W, CLOTH_H),
      new MeshStandardMaterial({ color: 0xff3d3d, side: DoubleSide }),
    ),
  );
  cloth.geometry.translate(CLOTH_W / 2, 0, 0);
  cloth.position.set(h.pin.x, POLE_H - CLOTH_H / 2 - 0.02, h.pin.z);
  cloth.castShadow = true;
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
      // Two rings grow 1 to 1.15 times the pond twice a second... once every two seconds each.
      for (const r of ripples) {
        const p = (t * 0.5 + r.phase) % 1;
        const s = 1 + 0.15 * p;
        r.mesh.scale.set(r.at.rx * s, r.at.rz * s, 1);
        r.material.opacity = 0.4 * (1 - p);
      }
    },
    setCupAid(on) {
      flash.visible = on;
    },
    dispose() {
      treeLayer.dispose();
      hills.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      object.traverse(
        (o) => (o as InstancedMesh).isInstancedMesh && (o as InstancedMesh).dispose(),
      );
      disposeGroundTextures();
      object.clear();
      object.removeFromParent();
    },
  };
}
