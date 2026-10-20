import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  NormalBlending,
  Points,
  ShaderMaterial,
  type Blending,
  type Object3D,
} from 'three';
import type { Vec } from './geometry';

const VERTEX = /* glsl */ `
uniform float uScale;
attribute float aSize;
attribute vec4 aColor;
varying vec4 vColor;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAGMENT = /* glsl */ `
varying vec4 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.0, d);
  gl_FragColor = vec4(vColor.rgb, vColor.a * a * a);
}
`;

interface Emit {
  at: Vec;
  vx?: number;
  vy?: number;
  vz?: number;
  life: number;
  size: number;
  /** Size at the end of life. */
  sizeEnd?: number;
  color: number;
  alpha?: number;
  gravity?: number;
  drag?: number;
}

interface Pool {
  object: Points;
  emit(e: Emit): void;
  update(delta: number): void;
  clear(): void;
}

const tint = new Color();

/** A fixed-size pool of round, soft points, each with its own motion, size and fade. */
function createPool(capacity: number, blending: Blending, uniforms: { uScale: { value: number } }) {
  const position = new Float32Array(capacity * 3);
  const colour = new Float32Array(capacity * 4);
  const size = new Float32Array(capacity);
  const velocity = new Float32Array(capacity * 3);
  const age = new Float32Array(capacity).fill(1e9);
  const life = new Float32Array(capacity).fill(1);
  const size0 = new Float32Array(capacity);
  const size1 = new Float32Array(capacity);
  const alpha0 = new Float32Array(capacity);
  const gravity = new Float32Array(capacity);
  const drag = new Float32Array(capacity);
  const geometry = new BufferGeometry();
  const positionAttr = new BufferAttribute(position, 3);
  const colourAttr = new BufferAttribute(colour, 4);
  const sizeAttr = new BufferAttribute(size, 1);
  positionAttr.setUsage(35048);
  colourAttr.setUsage(35048);
  sizeAttr.setUsage(35048);
  geometry.setAttribute('position', positionAttr);
  geometry.setAttribute('aColor', colourAttr);
  geometry.setAttribute('aSize', sizeAttr);
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending,
  });
  const object = new Points(geometry, material);
  object.frustumCulled = false;
  let next = 0;

  const pool: Pool = {
    object,
    emit(e) {
      const i = next;
      next = (next + 1) % capacity;
      position[i * 3] = e.at.x;
      position[i * 3 + 1] = e.at.y;
      position[i * 3 + 2] = e.at.z;
      velocity[i * 3] = e.vx ?? 0;
      velocity[i * 3 + 1] = e.vy ?? 0;
      velocity[i * 3 + 2] = e.vz ?? 0;
      tint.setHex(e.color);
      colour[i * 4] = tint.r;
      colour[i * 4 + 1] = tint.g;
      colour[i * 4 + 2] = tint.b;
      alpha0[i] = e.alpha ?? 1;
      size0[i] = e.size;
      size1[i] = e.sizeEnd ?? e.size;
      size[i] = e.size;
      life[i] = Math.max(e.life, 0.01);
      age[i] = 0;
      gravity[i] = e.gravity ?? 0;
      drag[i] = e.drag ?? 0;
    },
    update(delta) {
      for (let i = 0; i < capacity; i++) {
        if (age[i] >= life[i]) {
          if (size[i] !== 0) {
            size[i] = 0;
            colour[i * 4 + 3] = 0;
          }
          continue;
        }
        age[i] += delta;
        const k = Math.min(age[i] / life[i], 1);
        const slow = Math.exp(-drag[i] * delta);
        velocity[i * 3] *= slow;
        velocity[i * 3 + 1] = velocity[i * 3 + 1] * slow - gravity[i] * delta;
        velocity[i * 3 + 2] *= slow;
        position[i * 3] += velocity[i * 3] * delta;
        position[i * 3 + 1] += velocity[i * 3 + 1] * delta;
        position[i * 3 + 2] += velocity[i * 3 + 2] * delta;
        size[i] = size0[i] + (size1[i] - size0[i]) * k;
        colour[i * 4 + 3] = alpha0[i] * (1 - k) ** 1.5;
      }
      positionAttr.needsUpdate = true;
      colourAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
    },
    clear() {
      age.fill(1e9);
      size.fill(0);
      colour.fill(0);
    },
  };
  return pool;
}

export interface Effects {
  object: Object3D;
  /** Pixels a one-unit point covers at one unit from the camera (tied to the screen and fov). */
  setScale(pixelsPerUnit: number): void;
  /** White ice spray where a skater stops or checks. */
  spray(at: Vec, amount?: number): void;
  /** A burst of sparkles at the net when a goal goes in. */
  sparkle(at: Vec): void;
  update(delta: number): void;
  clear(): void;
}

export function createEffects(): Effects {
  const uniforms = { uScale: { value: 600 } };
  const glow = createPool(500, AdditiveBlending, uniforms);
  const puff = createPool(400, NormalBlending, uniforms);
  const object = new Group();
  object.add(puff.object, glow.object);
  return {
    object,
    setScale(pixelsPerUnit) {
      uniforms.uScale.value = pixelsPerUnit;
    },
    spray(at, amount = 14) {
      for (let i = 0; i < amount; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 2.4;
        puff.emit({
          at: { x: at.x, y: 0.1, z: at.z },
          vx: Math.cos(a) * speed,
          vy: 0.6 + Math.random() * 1.4,
          vz: Math.sin(a) * speed,
          life: 0.5 + Math.random() * 0.3,
          size: 0.28,
          sizeEnd: 0.7,
          color: 0xffffff,
          alpha: 0.7,
          gravity: 4,
          drag: 1.5,
        });
      }
    },
    sparkle(at) {
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2 + Math.random() * 0.4;
        const speed = 1.2 + Math.random() * 1.6;
        glow.emit({
          at,
          vx: Math.cos(a) * speed,
          vy: Math.random() * 1.6 - 0.2,
          vz: Math.sin(a) * speed,
          life: 0.5 + Math.random() * 0.3,
          size: 0.22,
          sizeEnd: 0.04,
          color: i % 2 ? 0xffe066 : 0xffffff,
          drag: 2.5,
        });
      }
    },
    update(delta) {
      glow.update(delta);
      puff.update(delta);
    },
    clear() {
      glow.clear();
      puff.clear();
    },
  };
}
