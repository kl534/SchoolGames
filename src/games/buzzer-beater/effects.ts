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
  /** A burst of sparkles at the net when a shot goes in. */
  sparkle(at: Vec): void;
  /** Dust kicked up by a landing or the ball bouncing. */
  dust(at: Vec, amount?: number): void;
  /** A flame behind a ball that is on fire (two puffs a call). */
  flame(at: Vec): void;
  update(delta: number): void;
  clear(): void;
}

export function createEffects(): Effects {
  const uniforms = { uScale: { value: 600 } };
  const glow = createPool(900, AdditiveBlending, uniforms);
  const puff = createPool(160, NormalBlending, uniforms);
  const object = new Group();
  object.add(puff.object, glow.object);

  const effects: Effects = {
    object,
    setScale(pixelsPerUnit) {
      uniforms.uScale.value = pixelsPerUnit;
    },
    sparkle(at) {
      glow.emit({ at, life: 0.18, size: 1.6, sizeEnd: 2.4, color: 0xffffff, alpha: 0.8 });
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2 + Math.random() * 0.4;
        const speed = 1.2 + Math.random() * 1.6;
        glow.emit({
          at,
          vx: Math.cos(a) * speed,
          vy: Math.random() * 1.6 - 0.4,
          vz: Math.sin(a) * speed,
          life: 0.45 + Math.random() * 0.25,
          size: 0.22,
          sizeEnd: 0.04,
          color: i % 2 ? 0xffe066 : 0xffffff,
          drag: 2.5,
        });
      }
    },
    dust(at, amount = 6) {
      for (let i = 0; i < amount; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 1.2;
        puff.emit({
          at,
          vx: Math.cos(a) * speed,
          vy: 0.4 + Math.random() * 0.8,
          vz: Math.sin(a) * speed,
          life: 0.45 + Math.random() * 0.25,
          size: 0.4,
          sizeEnd: 1.2,
          color: 0xd6d9dd,
          alpha: 0.45,
          drag: 2.5,
        });
      }
    },
    flame(at) {
      for (let i = 0; i < 2; i++) {
        glow.emit({
          at: {
            x: at.x + (Math.random() - 0.5) * 0.12,
            y: at.y + (Math.random() - 0.5) * 0.12,
            z: at.z + (Math.random() - 0.5) * 0.12,
          },
          vy: 0.6 + Math.random() * 0.6,
          life: 0.5,
          size: 0.55,
          sizeEnd: 0.08,
          color: i ? 0xffb703 : 0xfb5607,
          alpha: 0.7,
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
  return effects;
}
