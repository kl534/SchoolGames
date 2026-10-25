/** The sky dome, drifting clouds, birds, and the hills behind each hole. */
import {
  BackSide,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  type Material,
} from 'three';
import { seededRandom } from '../../shared/random';
import type { Hole } from './course';
import { buildTreeLayer, type TreePlacement } from './trees';

export const HORIZON = 0xcfe9ff;
const ZENITH = 0x3f95e8;
const DOME_R = 600;
const CLUSTERS = 10;
const CLOUD_SPEED = 0.8;
const CLOUD_RANGE = 400;
const BIRDS = 4;

export interface Sky {
  object: Group;
  /** `t` seconds of game time; clouds are placed around the middle of a hole `centreZ` down. */
  update(t: number, camera: { x: number; y: number; z: number }, centreZ: number): void;
  dispose(): void;
}

export function createSky(): Sky {
  const object = new Group();
  const rand = seededRandom(5);
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  // The dome: horizon colour at and below the horizon up to the zenith colour.
  const dome = new SphereGeometry(DOME_R, 24, 14);
  const pos = dome.getAttribute('position');
  const horizon = new Color(HORIZON);
  const zenith = new Color(ZENITH);
  const mix = new Color();
  const colours: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const k = Math.max(pos.getY(i) / DOME_R, 0) ** 0.6;
    mix.copy(horizon).lerp(zenith, k);
    colours.push(mix.r, mix.g, mix.b);
  }
  dome.setAttribute('color', new Float32BufferAttribute(colours, 3));
  const domeMaterial = new MeshBasicMaterial({
    vertexColors: true,
    side: BackSide,
    fog: false,
    depthWrite: false,
    depthTest: false,
  });
  const domeMesh = new Mesh(dome, domeMaterial);
  domeMesh.renderOrder = -10;
  domeMesh.frustumCulled = false;
  object.add(domeMesh);
  geometries.push(dome);
  materials.push(domeMaterial);

  // Clouds: clusters of flattened white spheres, drifting along +x and wrapping.
  interface Puff {
    cluster: number;
    dx: number;
    dy: number;
    dz: number;
    sx: number;
    sy: number;
    sz: number;
  }
  const clusters = Array.from({ length: CLUSTERS }, () => ({
    x: (rand() * 2 - 1) * CLOUD_RANGE,
    y: 120 + rand() * 60,
    z: (rand() * 2 - 1) * CLOUD_RANGE,
  }));
  const puffs: Puff[] = [];
  clusters.forEach((_, cluster) => {
    const n = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      puffs.push({
        cluster,
        dx: (rand() * 2 - 1) * 14,
        dy: (rand() * 2 - 1) * 2,
        dz: (rand() * 2 - 1) * 8,
        sx: 8 + rand() * 6,
        sy: 3 + rand() * 2,
        sz: 6 + rand() * 3,
      });
    }
  });
  const cloudGeometry = new SphereGeometry(1, 8, 6);
  const cloudMaterial = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const clouds = new InstancedMesh(cloudGeometry, cloudMaterial, puffs.length);
  clouds.frustumCulled = false;
  object.add(clouds);
  geometries.push(cloudGeometry);
  materials.push(cloudMaterial);

  // Birds: a V of two thin triangles that flaps, crossing the sky every 25 to 40 seconds.
  const wing = new BufferGeometry();
  wing.setAttribute(
    'position',
    new Float32BufferAttribute([0, 0, 0, 1.8, 0, 0.2, 0.3, 0, -0.6], 3),
  );
  wing.computeVertexNormals();
  const birdMaterial = new MeshBasicMaterial({ color: 0x2a2f3a, side: DoubleSide });
  geometries.push(wing);
  materials.push(birdMaterial);
  const birds = Array.from({ length: BIRDS }, (_, i) => {
    const group = new Group();
    const right = new Mesh(wing, birdMaterial);
    const left = new Mesh(wing, birdMaterial);
    left.scale.x = -1;
    group.add(left, right);
    group.scale.setScalar(4);
    group.visible = false;
    object.add(group);
    return {
      group,
      left,
      right,
      period: 25 + rand() * 15,
      offset: i * 9 + rand() * 6,
      y: 90 + rand() * 50,
      z: (rand() * 2 - 1) * 250,
    };
  });

  const dummy = new Object3D();
  return {
    object,
    update(t, camera, centreZ) {
      object.position.set(0, 0, 0);
      domeMesh.position.set(camera.x, camera.y, camera.z);
      puffs.forEach((p, i) => {
        const c = clusters[p.cluster];
        const span = CLOUD_RANGE * 2;
        const x = ((((c.x + CLOUD_RANGE + t * CLOUD_SPEED) % span) + span) % span) - CLOUD_RANGE;
        dummy.position.set(x + p.dx, c.y + p.dy, centreZ + c.z + p.dz);
        dummy.scale.set(p.sx, p.sy, p.sz);
        dummy.updateMatrix();
        clouds.setMatrixAt(i, dummy.matrix);
      });
      clouds.instanceMatrix.needsUpdate = true;
      for (const b of birds) {
        const u = (t + b.offset) % b.period;
        const flight = 18;
        b.group.visible = u < flight;
        if (!b.group.visible) continue;
        b.group.position.set(-320 + (u / flight) * 640, b.y, centreZ + b.z);
        const flap = Math.sin(t * 9 + b.offset) * 0.5;
        b.right.rotation.z = flap;
        b.left.rotation.z = -flap;
        b.group.rotation.y = -Math.PI / 2 + 0.4;
      }
    },
    dispose() {
      clouds.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      object.removeFromParent();
    },
  };
}

// ---------- Hills ----------

interface Ridge {
  /** Centre of the ridge on the ground. */
  x: number;
  z: number;
  /** Length along the ridge and depth across it, yards. */
  len: number;
  depth: number;
  /** The ridge runs along z (the sides) or along x (beyond the green). */
  alongZ: boolean;
  peak: number;
  seed: number;
}

/** Height of a ridge at (u along, v across), both 0..1: a rolling crest with a smooth foot. */
function ridgeHeight(r: Ridge, u: number, v: number): number {
  const wave =
    0.55 +
    0.3 * Math.sin(u * 17 + r.seed) +
    0.25 * Math.sin(u * 41 + v * 5 + r.seed * 2.3) +
    0.1 * Math.sin(u * 83 + v * 11 - r.seed);
  const foot = Math.sin(Math.PI * v) ** 1.1 * Math.sin(Math.PI * u) ** 0.4;
  return Math.max(0, r.peak * wave * foot);
}

const NEAR = new Color(0x4d8a45);
const HAZE = new Color(0x8fb5a0);

export interface Hills {
  object: Group;
  dispose(): void;
}

/** Three low-poly ridges 250 to 420 yd away: both sides and beyond the green, with pines on top. */
export function buildHills(h: Hole): Hills {
  const object = new Group();
  const rand = seededRandom(Math.round(h.length * 17 + h.bend * 311 + 7));
  const mid = h.length / 2 + 100;
  const ridges: Ridge[] = [
    {
      x: -330,
      z: mid,
      len: h.length + 700,
      depth: 170,
      alongZ: true,
      peak: 20 + rand() * 40,
      seed: 1,
    },
    {
      x: 330,
      z: mid,
      len: h.length + 700,
      depth: 170,
      alongZ: true,
      peak: 20 + rand() * 40,
      seed: 2,
    },
    {
      x: 0,
      z: h.length + 330,
      len: 1000,
      depth: 160,
      alongZ: false,
      peak: 20 + rand() * 40,
      seed: 3,
    },
  ];
  const geometries: BufferGeometry[] = [];
  const material = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const pines: TreePlacement[] = [];
  for (const r of ridges) {
    const g = new PlaneGeometry(r.len, r.depth, 24, 6);
    const pos = g.getAttribute('position');
    const colours: number[] = [];
    const tint = new Color();
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) / r.len + 0.5;
      const v = pos.getY(i) / r.depth + 0.5;
      const y = ridgeHeight(r, u, v);
      // Across the ridge is local y; on the ground it is -x for the sides' ridges, -z for the far one.
      const across = (v - 0.5) * r.depth;
      const dist = Math.abs(r.alongZ ? r.x - across : r.z - h.length - across);
      tint.copy(NEAR).lerp(HAZE, Math.min(Math.max((dist - 250) / 170, 0), 1));
      colours.push(tint.r, tint.g, tint.b);
      pos.setZ(i, y);
    }
    g.setAttribute('color', new Float32BufferAttribute(colours, 3));
    g.rotateX(-Math.PI / 2);
    if (r.alongZ) g.rotateY(Math.PI / 2);
    g.translate(r.x, 0, r.z);
    geometries.push(g);
    object.add(new Mesh(g, material));
    // Pines along the crest nearest the course.
    if (r.alongZ) {
      for (let along = 0.02; along < 0.98; along += 0.016) {
        const u = along + (rand() - 0.5) * 0.01;
        const v = r.x < 0 ? 0.28 + rand() * 0.12 : 0.72 - rand() * 0.12;
        const y = ridgeHeight(r, u, v);
        if (y < 5) continue;
        pines.push({
          // The z-run was turned a quarter: local x (u) maps to -z, local y (v) to -x.
          x: r.x - (v - 0.5) * r.depth,
          z: r.z - (u - 0.5) * r.len,
          y,
          species: 'pine',
          r: 5 + rand() * 3,
          height: 24 + rand() * 10,
          yaw: rand() * 6.28,
          blob: false,
        });
      }
    }
  }
  const layer = buildTreeLayer(pines);
  object.add(layer.object);
  return {
    object,
    dispose() {
      layer.dispose();
      geometries.forEach((g) => g.dispose());
      material.dispose();
      object.removeFromParent();
    },
  };
}
