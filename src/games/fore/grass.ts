/**
 * Blades and tufts. The close blades are bent triangles scattered on the rough round the ball and
 * rebuilt for each shot from a seed; the tufts are clumps of tall fescue in the far rough. Both
 * sway in the vertex shader. The placements are pure (`bladeSpots`, `tuftSpots`).
 */
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  type Material,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seededRandom } from '../../shared/random';
import { centreX, GREEN_R, inEllipse, surfaceAt, type Hole } from './course';
import { clubhouseSite, CLUBHOUSE_CLEAR, PATH_OFF } from './scenery';
import { groundY } from './terrain';

/** Blades grow within this many yards of the ball. */
export const BLADE_RANGE = 22;
/** Tufts stand between these distances off the centre line. */
export const TUFT_MIN_OFF = 66;
export const TUFT_MAX_OFF = 140;
const BLADE_HEIGHT: readonly [number, number] = [0.05, 0.11];
const TUFT_HEIGHT: readonly [number, number] = [0.3, 0.6];

export interface Spot {
  x: number;
  z: number;
  yaw: number;
  /** Height in yards. */
  height: number;
  /** 0..1 along the two colours. */
  mix: number;
}

/** True when a hazard (a little inflated) or the tee box or the cart path is at (x, z). */
const busy = (h: Hole, x: number, z: number, room: number) =>
  h.hazards.some((hz) => inEllipse({ ...hz.at, rx: hz.at.rx + room, rz: hz.at.rz + room }, x, z));

/**
 * Up to `count` blade spots on the rough within `BLADE_RANGE` of `at`: not on a hazard, the tee box,
 * the cart path or the mown apron round the green. Fewer come back where there is little rough.
 */
export function bladeSpots(
  h: Hole,
  at: { x: number; z: number },
  count: number,
  seed: number,
): Spot[] {
  const rand = seededRandom(seed);
  const spots: Spot[] = [];
  for (let tries = 0; spots.length < count && tries < count * 4; tries++) {
    const a = rand() * Math.PI * 2;
    const d = BLADE_RANGE * Math.sqrt(rand());
    const x = at.x + Math.cos(a) * d;
    const z = at.z + Math.sin(a) * d;
    const yaw = rand() * Math.PI * 2;
    const height = BLADE_HEIGHT[0] + (BLADE_HEIGHT[1] - BLADE_HEIGHT[0]) * rand();
    const mix = rand();
    if (surfaceAt(h, x, z) !== 'rough') continue;
    if (busy(h, x, z, 2)) continue;
    if (Math.abs(x) < 5 && z > -6 && z < 6) continue;
    if (Math.hypot(x - h.pin.x, z - h.pin.z) < GREEN_R + 6) continue;
    if (z >= -3 && z <= h.length + 3) {
      const off = Math.abs(x - centreX(h, z));
      if (Math.abs(off - PATH_OFF) < 1.4) continue;
    }
    spots.push({ x, z, yaw, height, mix });
  }
  return spots;
}

/** `count` tuft spots, `TUFT_MIN_OFF` to `TUFT_MAX_OFF` off the centre line, clear of hazards. */
export function tuftSpots(h: Hole, count: number, seed = 1): Spot[] {
  const rand = seededRandom(seed + Math.round(h.length * 7 + h.bend * 13));
  const house = clubhouseSite(h);
  const spots: Spot[] = [];
  for (let tries = 0; spots.length < count && tries < count * 3; tries++) {
    const z = -40 + rand() * (h.length + 130);
    const off = TUFT_MIN_OFF + (TUFT_MAX_OFF - TUFT_MIN_OFF) * rand();
    const x = centreX(h, z) + (rand() < 0.5 ? -1 : 1) * off;
    const yaw = rand() * Math.PI * 2;
    const height = TUFT_HEIGHT[0] + (TUFT_HEIGHT[1] - TUFT_HEIGHT[0]) * rand();
    const mix = rand();
    if (busy(h, x, z, 3)) continue;
    if (house && Math.hypot(x - house.x, z - house.z) < CLUBHOUSE_CLEAR) continue;
    spots.push({ x, z, yaw, height, mix });
  }
  return spots;
}

/**
 * Makes `material` move its vertices with `glsl` (which may use `uTime` and `swayPhase`, a number
 * from the instance's place in the world). The hook runs after any hook the material already has.
 */
export function swayMaterial<T extends Material>(
  material: T,
  time: { value: number },
  glsl: string,
  key: string,
): T {
  const own = material.onBeforeCompile;
  const baseKey = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${baseKey()}-${key}`;
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
    own.call(material, shader, renderer);
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'uniform float uTime;\nvoid main() {')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 swayBase = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        #else
          vec3 swayBase = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        #endif
        float swayPhase = swayBase.x * 0.7 + swayBase.z * 0.9;
        ${glsl}`,
      );
  };
  return material;
}

/** A blade as a triangle `unit` tall: its tip leans over, its foot is darker. */
function bladeGeometry(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute(
    'position',
    new Float32BufferAttribute([-0.07, 0, 0, 0.07, 0, 0, 0.3, 1, 0.05], 3),
  );
  g.setAttribute('normal', new Float32BufferAttribute([0, 0.3, 1, 0, 0.3, 1, 0, 0.3, 1], 3));
  g.setAttribute(
    'color',
    new Float32BufferAttribute([0.55, 0.55, 0.55, 0.55, 0.55, 0.55, 1, 1, 1], 3),
  );
  return g;
}

/** A clump of 12 blades fanning out from the middle, 1 yard tall at scale 1. */
function tuftGeometry(): BufferGeometry {
  const rand = seededRandom(5);
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rand() * 0.4;
    const lean = 0.1 + rand() * 0.45;
    const h = 0.7 + rand() * 0.3;
    const w = 0.05 + rand() * 0.03;
    const g = new BufferGeometry();
    g.setAttribute(
      'position',
      new Float32BufferAttribute([-w, 0, 0, w, 0, 0, lean * 0.35, h, lean * 0.12], 3),
    );
    g.setAttribute('normal', new Float32BufferAttribute([0, 0.4, 1, 0, 0.4, 1, 0, 0.4, 1], 3));
    g.setAttribute('color', new Float32BufferAttribute([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 1, 1], 3));
    g.rotateY(a);
    // Lean the blade outwards, more towards its tip.
    const pos = g.getAttribute('position');
    for (let k = 0; k < pos.count; k++) {
      const y = pos.getY(k);
      const out = lean * y;
      pos.setXYZ(k, pos.getX(k) + Math.cos(a) * out, y, pos.getZ(k) + Math.sin(a) * out);
    }
    parts.push(g);
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  return merged;
}

const lerpColour = (out: Color, a: Color, b: Color, k: number) => out.copy(a).lerp(b, k);

export interface Tufts {
  mesh: InstancedMesh | null;
  update(t: number): void;
  dispose(): void;
}

/** The tall fescue clumps of one hole (`count` of them), standing on the ground height. */
export function buildTufts(h: Hole, count: number): Tufts {
  const spots = tuftSpots(h, count);
  if (spots.length === 0) return { mesh: null, update() {}, dispose() {} };
  const time = { value: 0 };
  const geometry = tuftGeometry();
  const material = swayMaterial(
    new MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      side: DoubleSide,
      roughness: 0.9,
    }),
    time,
    'transformed.x += sin(uTime * 2.2 + swayPhase) * 0.09 * position.y;\n transformed.z += cos(uTime * 1.7 + swayPhase * 1.3) * 0.06 * position.y;',
    'tuft',
  );
  const mesh = new InstancedMesh(geometry, material, spots.length);
  const dummy = new Object3D();
  const a = new Color(0xb8b06a);
  const b = new Color(0x8f9a52);
  const colour = new Color();
  spots.forEach((s, i) => {
    dummy.position.set(s.x, groundY(h, s.x, s.z), s.z);
    dummy.rotation.set(0, s.yaw, 0);
    dummy.scale.setScalar(s.height);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, lerpColour(colour, a, b, s.mix));
  });
  mesh.frustumCulled = false;
  return {
    mesh,
    update: (t) => (time.value = t),
    dispose() {
      mesh.removeFromParent();
      mesh.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}

export interface Blades {
  object: Group;
  /** Regrows the blades round `at` (call once per shot). */
  rebuild(h: Hole, at: { x: number; z: number }, seed: number): void;
  update(t: number): void;
  dispose(): void;
}

/** The close blades round the ball: one instanced mesh of `count` (0: none at all). */
export function createBlades(count: number): Blades {
  const object = new Group();
  if (count <= 0) {
    return { object, rebuild() {}, update() {}, dispose: () => object.removeFromParent() };
  }
  const time = { value: 0 };
  const geometry = bladeGeometry();
  const material = swayMaterial(
    new MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      side: DoubleSide,
      roughness: 0.85,
    }),
    time,
    'transformed.x += sin(uTime * 2.6 + swayPhase * 3.0) * 0.18 * position.y;',
    'blade',
  );
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  mesh.count = 0;
  object.add(mesh);
  const dummy = new Object3D();
  const a = new Color(0x5d7f3c);
  const b = new Color(0x7c9a4a);
  const colour = new Color();
  return {
    object,
    rebuild(h, at, seed) {
      const spots = bladeSpots(h, at, count, seed);
      spots.forEach((s, i) => {
        dummy.position.set(s.x, groundY(h, s.x, s.z), s.z);
        dummy.rotation.set(0, s.yaw, 0);
        dummy.scale.set(s.height, s.height, s.height);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, lerpColour(colour, a, b, s.mix));
      });
      mesh.count = spots.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    update: (t) => (time.value = t),
    dispose() {
      object.removeFromParent();
      mesh.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}
