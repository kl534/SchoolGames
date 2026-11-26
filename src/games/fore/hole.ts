import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  Vector2,
  type Material,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Water } from 'three/addons/objects/Water.js';
import { seededRandom } from '../../shared/random';
import { TREE_HEIGHT } from './shot';
import { centreX, FAIRWAY_HALF, GREEN_R, type Ellipse, type Hole } from './course';
import {
  dish,
  cutOut,
  disposeGroundTextures,
  FALLBACK_LOOK,
  hazardCuts,
  litTree,
  profileRing,
  ribbon,
  roughGeometry,
  SAND_TILE,
  sandMaterial,
  scaleUV,
  strip,
  turfMaterial,
  turfTile,
  unlitMaterial,
  type Look,
  type TurfKind,
} from './ground';
import { cartPath, placeScenery, PATH_WIDTH } from './scenery';
import { buildHills, HORIZON } from './sky';
import { groundY, POND_DEPTH, SHORE } from './terrain';
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

/** Pulls a flat layer a little forward of the one below; polygon offset keeps it clear at range. */
function lift<T extends Material>(material: T, level: number): T {
  material.polygonOffset = true;
  material.polygonOffsetFactor = -level;
  material.polygonOffsetUnits = -level;
  return material;
}

/** A plain painted layer (path, markers, cup). */
function paint(color: number, level: number, roughness = 0.9): MeshStandardMaterial {
  return lift(new MeshStandardMaterial({ color, roughness, metalness: 0 }), level);
}

function flat(geometry: BufferGeometry, material: Material, y: number): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

/** A flat ellipse whose texture tiles every `tile` yards (0: leave the UVs as they are). */
function ellipse(e: Ellipse, material: Material, y: number, segments = 40, tile = 0): Mesh {
  const g = new CircleGeometry(1, segments);
  if (tile > 0) scaleUV(g, (2 * e.rx) / tile, (2 * e.rz) / tile);
  const mesh = flat(g, material, y);
  mesh.scale.set(e.rx, e.rz, 1);
  mesh.position.x = e.x;
  mesh.position.z = e.z;
  return mesh;
}

/** Offsets (yards outside the edge) of a pond bank and the height of the bank there. */
const bankY = (offset: number) => -POND_DEPTH * (1 - Math.min(Math.max(offset, 0) / SHORE, 1));
const BANK_OFFSETS = [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.8] as const;
/** The wet mud reaches this far up the bank. */
const MUD_WIDTH = 0.8;

/** The water in a pond: a reflecting `Water` (high) or a glossy physical plane with moving ripples. */
function pondWater(
  e: Ellipse,
  look: Look,
): { mesh: Mesh; update: (t: number) => void; materials: Material[] } {
  const mirror = look.settings.water === 'mirror' && look.assets.water;
  const geometry = new CircleGeometry(1, 56);
  if (mirror) {
    const water = new Water(geometry, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: look.assets.water!,
      sunDirection: look.sun.clone(),
      sunColor: 0xffffff,
      waterColor: 0x1f4f5a,
      distortionScale: 1.6,
      alpha: 1,
      fog: true,
    });
    water.material.uniforms['size'].value = 6;
    water.rotation.x = -Math.PI / 2;
    water.position.set(e.x, -POND_DEPTH, e.z);
    water.scale.set(e.rx, e.rz, 1);
    return {
      mesh: water,
      update: (t) => {
        water.material.uniforms['time'].value = t * 0.5;
      },
      materials: [water.material],
    };
  }
  const normals = look.assets.water;
  if (normals) scaleUV(geometry, (2 * e.rx) / 6, (2 * e.rz) / 6);
  const offA = new Vector2();
  const offB = new Vector2();
  const material = new MeshPhysicalMaterial({
    color: 0x1d4a55,
    roughness: 0.04,
    metalness: 0,
    normalMap: normals,
    clearcoat: 0.3,
  });
  material.normalScale.set(0.35, 0.35);
  if (normals) {
    material.customProgramCacheKey = () => 'fore-water';
    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uOffA = { value: offA };
      shader.uniforms.uOffB = { value: offB };
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform vec2 uOffA;\nuniform vec2 uOffB;\nvoid main() {')
        .replace(
          '#include <normal_fragment_maps>',
          `#ifdef USE_NORMALMAP_TANGENTSPACE
            vec3 mapN = (texture2D(normalMap, vNormalMapUv + uOffA).xyz + texture2D(normalMap, vNormalMapUv * 0.8 + uOffB).xyz) - 1.0;
            mapN.xy *= normalScale;
            normal = normalize(tbn * mapN);
          #endif`,
        );
    };
  }
  const mesh = flat(geometry, material, -POND_DEPTH);
  mesh.scale.set(e.rx, e.rz, 1);
  mesh.position.set(e.x, -POND_DEPTH, e.z);
  return {
    mesh,
    update: (t) => {
      // Two ripple layers drift opposite ways (0.012 and -0.009 tiles a second).
      offA.set(0.012 * t, 0.012 * t);
      offB.set(-0.009 * t, 0.009 * t);
    },
    materials: [material],
  };
}

/**
 * Builds one hole's ground, hazards, scenery, tee and flag. Dispose it before building the next.
 * `look` is what the device can draw (tier, loaded pictures, shadow map); the default is the
 * plain procedural look, which is what tests build.
 */
export function buildHole(h: Hole, look: Look = FALLBACK_LOOK): HoleScene {
  const object = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const rand = seededRandom(Math.round(h.length * 13 + h.bend * 101 + 3));
  const shadows = look.shadows;
  const own = <T extends Mesh | InstancedMesh>(mesh: T, ground = false): T => {
    geometries.push(mesh.geometry);
    materials.push(mesh.material as Material);
    mesh.receiveShadow = ground && shadows;
    object.add(mesh);
    return mesh;
  };
  const ownMaterial = <T extends Material>(m: T): T => {
    materials.push(m);
    return m;
  };
  /** A turf layer: the kind's grass lifted `level` over the one below. */
  const cuts = hazardCuts(h);
  const turf = (kind: TurfKind, level: number, open = true) =>
    lift(turfMaterial(look, kind, open ? cuts : []), level);

  // The rough: one grid under everything, out to the foot of the hills, rolling into mounds.
  own(new Mesh(roughGeometry(h, turfTile(look, 'rough')), turfMaterial(look, 'rough')), true);

  // The fairway: a ribbon along the bent centre line; where it ends the rough begins.
  const tile = turfTile(look, 'fairway');
  const fairway = own(
    new Mesh(
      look.assets.grass
        ? ribbon(h, -FAIRWAY_HALF, FAIRWAY_HALF, tile, tile)
        : ribbon(h, -FAIRWAY_HALF, FAIRWAY_HALF),
      turf('fairway', 1),
    ),
    true,
  );
  fairway.position.y = 0.04;

  // The green: crosshatch-mown, with a fringe and an apron of short grass round it.
  const around = (r: number) => ({ x: h.pin.x, z: h.pin.z, rx: r, rz: r });
  const fringeTile = turfTile(look, 'fringe');
  const apron = own(ellipse(around(GREEN_R + 5), turf('fringe', 1.3), 0.05, 56, fringeTile), true);
  apron.name = 'apron';
  const fringe = own(ellipse(around(GREEN_R + 2), turf('fringe', 1.5), 0.06, 56, fringeTile), true);
  fringe.name = 'fringe';
  const green = own(
    ellipse(around(GREEN_R), turf('green', 2), 0.08, 56, turfTile(look, 'green')),
    true,
  );
  green.name = 'green';

  // Hazards: sunken bunkers with a grass lip; ponds below their banks, with a ripple.
  const ripples: { mesh: Mesh; material: MeshBasicMaterial; at: Ellipse; phase: number }[] = [];
  const waters: { update: (t: number) => void }[] = [];
  const reeds: { x: number; z: number; tilt: number; size: number }[] = [];
  const mud = ownMaterial(new MeshStandardMaterial({ color: 0x4a3d2a, roughness: 0.4 }));
  for (const hz of h.hazards) {
    const e = hz.at;
    if (hz.kind === 'sand') {
      // The dish below grade, then a lip that rises a little and drops steeply into the sand.
      own(
        new Mesh(
          dish(e, (x, z) => groundY(h, x, z), SAND_TILE),
          sandMaterial(look),
        ),
        true,
      );
      const lip = [
        [-0.1, 0],
        [0.1, 0.07],
        [0.35, 0.07],
        [0.7, 0],
      ] as const;
      own(new Mesh(profileRing(e, lip, 2.5), turf('fringe', 2.6, false)), true);
    } else {
      // The bank slopes from grade into the water; the lowest 0.8 yd is wet mud.
      const slope = BANK_OFFSETS.map((o) => [o, bankY(o)] as const);
      const wet = [[-0.1, -POND_DEPTH - 0.02] as const, ...slope.filter(([o]) => o <= MUD_WIDTH)];
      own(new Mesh(profileRing(e, wet, 2.5), mud), true);
      const dry = slope.filter(([o]) => o >= MUD_WIDTH);
      own(new Mesh(profileRing(e, dry, 2.5), turf('rough', 1, false)), true);
      const water = pondWater(e, look);
      geometries.push(water.mesh.geometry);
      materials.push(...water.materials);
      water.mesh.receiveShadow = false;
      object.add(water.mesh);
      waters.push(water);
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
        const ring = own(flat(new RingGeometry(0.86, 0.9, 48), material, -POND_DEPTH + 0.01));
        ring.position.set(e.x, -POND_DEPTH + 0.01, e.z);
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
        new MeshStandardMaterial({ color: 0x5f8a3a, roughness: 0.9 }),
        reeds.length,
      ),
    );
    reeds.forEach((r, i) => {
      dummy.position.set(r.x, groundY(h, r.x, r.z), r.z);
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
      new Mesh(mergeGeometries(runs.map((run) => strip(run, PATH_WIDTH))), paint(0xc4c2ba, 0.8)),
      true,
    );
    path.position.y = 0.03;
  }

  // The tee: a mown rectangle, two tee blocks, a yardage plaque, a ball washer and a bench.
  const teeTile = turfTile(look, 'tee');
  const tee = own(
    flat(scaleUV(new PlaneGeometry(8, 10), 8 / teeTile, 10 / teeTile), turf('tee', 2), 0.08),
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
    mesh.castShadow = shadows;
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
      flat(new PlaneGeometry(FAIRWAY_HALF * 2, 0.7), cutOut(paint(color, 2.5, 0.8), cuts), 0.07),
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
      post.castShadow = shadows;
      post.position.set(c + side * (FAIRWAY_HALF + 0.6), 0.8, z);
    }
  }

  // Trees: the gameplay trees (oak and pine in turn, exactly as tall as the flight check says),
  // then the scenery trees (a share of them on the lower tiers). Bushes, rocks and flowers are
  // instanced too. Everything stands on the ground's height.
  const share = look.settings.sceneryShare;
  const keep = (i: number) => (i * 0.6180339887) % 1 < share;
  const placements: TreePlacement[] = h.trees.map((tr, i) => ({
    x: tr.x,
    y: groundY(h, tr.x, tr.z),
    z: tr.z,
    r: tr.r,
    height: TREE_HEIGHT,
    species: i % 2 === 0 ? 'oak' : 'pine',
    yaw: rand() * Math.PI * 2,
  }));
  scenery.trees.forEach((t, i) => {
    if (keep(i)) placements.push({ ...t, y: groundY(h, t.x, t.z) });
  });
  const treeLayer = buildTreeLayer(placements, look);
  object.add(treeLayer.object);

  const tint = new Color();
  const bushList = scenery.bushes.filter((_, i) => keep(i));
  if (bushList.length > 0) {
    const bushes = own(
      new InstancedMesh(
        new IcosahedronGeometry(1, 1),
        new MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.95 }),
        bushList.length,
      ),
    );
    bushes.castShadow = shadows;
    bushList.forEach((b, i) => {
      dummy.position.set(b.x, groundY(h, b.x, b.z) + b.r * 0.4, b.z);
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
        new MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.9 }),
        scenery.rocks.length,
      ),
    );
    rocks.castShadow = shadows;
    scenery.rocks.forEach((r, i) => {
      dummy.position.set(r.x, groundY(h, r.x, r.z) + r.r * 0.25, r.z);
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
        new MeshStandardMaterial({ color: 0xffffff, side: DoubleSide, roughness: 0.8 }),
        scenery.flowers.length,
      ),
    );
    scenery.flowers.forEach((f, i) => {
      dummy.position.set(f.x, groundY(h, f.x, f.z) + 0.13, f.z);
      dummy.rotation.set(0, i * 2.4, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      flowers.setMatrixAt(i, dummy.matrix);
      flowers.setColorAt(i, tint.setHex(f.color));
    });
    flowers.frustumCulled = false;
  }

  const hills = buildHills(h, look);
  object.add(hills.object);

  // The flag: a thin pole, a two-sided cloth that waves, and a true-size cup with a white rim.
  const pole = own(
    new Mesh(
      new CylinderGeometry(0.015, 0.015, POLE_H, 8),
      new MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.6 }),
    ),
  );
  pole.position.set(h.pin.x, POLE_H / 2, h.pin.z);
  pole.castShadow = shadows;
  const cloth = own(
    new Mesh(
      new PlaneGeometry(CLOTH_W, CLOTH_H),
      new MeshStandardMaterial({ color: 0xff3d3d, side: DoubleSide, roughness: 0.8 }),
    ),
  );
  cloth.geometry.translate(CLOTH_W / 2, 0, 0);
  cloth.position.set(h.pin.x, POLE_H - CLOTH_H / 2 - 0.02, h.pin.z);
  cloth.castShadow = shadows;
  const pin = { x: h.pin.x, z: h.pin.z };
  const cup = own(
    ellipse({ ...pin, rx: CUP_VISUAL_R, rz: CUP_VISUAL_R }, paint(0x1b1b1b, 5), 0.14),
  );
  cup.name = 'cup';
  const rim = own(flat(new RingGeometry(0.07, 0.09, 24), paint(0xffffff, 5.5), 0.145));
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

  litTree(look.csm, object);

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
      waters.forEach((w) => w.update(t));
    },
    setCupAid(on) {
      flash.visible = on;
    },
    dispose() {
      treeLayer.dispose();
      hills.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => {
        unlitMaterial(look.csm, m);
        m.dispose();
      });
      object.traverse(
        (o) => (o as InstancedMesh).isInstancedMesh && (o as InstancedMesh).dispose(),
      );
      disposeGroundTextures();
      object.clear();
      object.removeFromParent();
    },
  };
}
