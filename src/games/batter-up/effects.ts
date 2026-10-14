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
import type { Vec } from './flight';

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
  /** A star-shaped flash where the bat meets the ball. */
  crack(at: Vec): void;
  /** A puff of dust where the ball thuds into the glove. */
  pop(at: Vec): void;
  /** Dust kicked up by the ball landing, or a runner sliding. */
  dust(at: Vec, amount?: number): void;
  /** A soft glow round the ball for one frame, so a small ball is easy to find. */
  halo(at: Vec, size: number, life: number): void;
  /** A glowing wisp left behind by the ball. */
  trail(at: Vec, size?: number): void;
  /** A rocket climbs to `at` and bursts there; `delay` seconds from now. */
  firework(at: Vec, color: number, delay?: number): void;
  /** Fireworks pops queued or sounding: called when one bursts. */
  onBurst: (() => void) | null;
  update(delta: number): void;
  clear(): void;
}

const FIREWORK_COLOURS = [0xff5d73, 0xffd23f, 0x5df2c1, 0x6ab7ff, 0xc77dff, 0xffffff, 0xff9f1c];
export const fireworkColour = (i: number) => FIREWORK_COLOURS[i % FIREWORK_COLOURS.length];

export function createEffects(): Effects {
  const uniforms = { uScale: { value: 600 } };
  const glow = createPool(900, AdditiveBlending, uniforms);
  const puff = createPool(160, NormalBlending, uniforms);
  const object = new Group();
  object.add(puff.object, glow.object);
  let clock = 0;
  let queued: { at: number; fn: () => void }[] = [];
  const rockets: {
    at: Vec;
    from: number;
    to: number;
    x: number;
    z: number;
    color: number;
    t: number;
  }[] = [];

  const effects: Effects = {
    object,
    onBurst: null,
    setScale(pixelsPerUnit) {
      uniforms.uScale.value = pixelsPerUnit;
    },
    crack(at) {
      glow.emit({ at, life: 0.16, size: 2.4, sizeEnd: 3.2, color: 0xffffff, alpha: 0.9 });
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + Math.random() * 0.4;
        const speed = 4 + Math.random() * 5;
        glow.emit({
          at,
          vx: Math.cos(a) * speed * 0.6,
          vy: Math.sin(a) * speed,
          vz: -Math.abs(Math.cos(a)) * speed * 0.5,
          life: 0.35 + Math.random() * 0.15,
          size: 0.32,
          sizeEnd: 0.05,
          color: i % 2 ? 0xffe066 : 0xffffff,
          drag: 3,
        });
      }
    },
    pop(at) {
      glow.emit({ at, life: 0.12, size: 1.4, sizeEnd: 2, color: 0xffffff, alpha: 0.8 });
      effects.dust({ x: at.x, y: at.y - 0.1, z: at.z }, 6);
    },
    dust(at, amount = 6) {
      for (let i = 0; i < amount; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = 0.8 + Math.random() * 1.6;
        puff.emit({
          at,
          vx: Math.cos(a) * speed,
          vy: 0.5 + Math.random() * 1.1,
          vz: Math.sin(a) * speed,
          life: 0.5 + Math.random() * 0.3,
          size: 0.5,
          sizeEnd: 1.5,
          color: 0xd9bf98,
          alpha: 0.5,
          drag: 2.5,
        });
      }
    },
    halo(at, size, life) {
      glow.emit({ at, life, size, sizeEnd: size, color: 0xffffff, alpha: 0.4 });
    },
    trail(at, size = 0.5) {
      glow.emit({ at, life: 0.45, size, sizeEnd: size * 0.15, color: 0xfff1b0, alpha: 0.55 });
    },
    firework(at, color, delay = 0) {
      queued.push({
        at: clock + delay,
        fn: () => rockets.push({ at, from: at.y - 16, to: at.y, x: at.x, z: at.z, color, t: 0 }),
      });
    },
    update(delta) {
      clock += delta;
      const due = queued.filter((q) => q.at <= clock);
      if (due.length) {
        queued = queued.filter((q) => q.at > clock);
        due.forEach((q) => q.fn());
      }
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.t += delta;
        const k = Math.min(r.t / 0.6, 1);
        const y = r.from + (r.to - r.from) * (1 - (1 - k) ** 2);
        glow.emit({
          at: { x: r.x, y, z: r.z },
          vy: -3,
          life: 0.4,
          size: 1.1,
          sizeEnd: 0.2,
          color: 0xffd9a0,
          alpha: 0.8,
        });
        if (k >= 1) {
          rockets.splice(i, 1);
          burst({ x: r.x, y: r.to, z: r.z }, r.color);
          effects.onBurst?.();
        }
      }
      glow.update(delta);
      puff.update(delta);
    },
    clear() {
      queued = [];
      rockets.length = 0;
      glow.clear();
      puff.clear();
    },
  };

  const burst = (at: Vec, color: number) => {
    glow.emit({ at, life: 0.3, size: 14, sizeEnd: 22, color: 0xffffff, alpha: 0.7 });
    const count = 80;
    for (let i = 0; i < count; i++) {
      // Spread evenly over a sphere.
      const y = 1 - (2 * (i + 0.5)) / count;
      const radius = Math.sqrt(1 - y * y);
      const a = i * 2.399963;
      const speed = 12 + Math.random() * 6;
      glow.emit({
        at,
        vx: Math.cos(a) * radius * speed,
        vy: y * speed,
        vz: Math.sin(a) * radius * speed * 0.5,
        life: 1.5 + Math.random() * 0.6,
        size: 3.2,
        sizeEnd: 0.6,
        color: i % 5 === 0 ? 0xffffff : color,
        gravity: 3.2,
        drag: 1.4,
      });
    }
  };

  return effects;
}
