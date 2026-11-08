/**
 * Particle effects for the tricks: spray, splashes, a big splash column, bubbles, drips, circling
 * stars, confetti, fireworks, coin sparkles and the ski's wake. One pooled `Points` object (a
 * single draw call) with a fixed number of particles; when it is full the oldest is recycled.
 * Positions are world coordinates.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  ShaderMaterial,
  type Object3D,
} from 'three';

/** Most particles alive at once. */
export const MAX_PARTICLES = 600;

export type EffectKind =
  'spray' | 'splash' | 'bigSplash' | 'bubbles' | 'drips' | 'stars' | 'confetti';

const SHAPE_CIRCLE = 0;
const SHAPE_STAR = 1;
const SHAPE_SQUARE = 2;

const vertexShader = /* glsl */ `
  attribute float size;
  attribute vec4 tint;
  attribute float shape;
  attribute float spin;
  uniform float scale;
  varying vec4 vTint;
  varying float vShape;
  varying float vSpin;
  void main() {
    vTint = tint;
    vShape = shape;
    vSpin = spin;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = max(size * scale / -mv.z, 0.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec4 vTint;
  varying float vShape;
  varying float vSpin;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float c = cos(vSpin);
    float s = sin(vSpin);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    float a;
    if (vShape < 0.5) {
      a = 1.0 - smoothstep(0.32, 0.5, length(p));
    } else if (vShape < 1.5) {
      // A five-pointed star.
      float ang = atan(p.y, p.x);
      float r = length(p);
      float k = 0.24 + 0.26 * pow(abs(cos(2.5 * ang + 1.2566)), 1.5);
      a = 1.0 - smoothstep(k - 0.04, k, r);
    } else {
      a = 1.0 - step(0.4, max(abs(p.x), abs(p.y)));
    }
    if (a * vTint.a < 0.02) discard;
    gl_FragColor = vec4(vTint.rgb, vTint.a * a);
  }
`;

interface Spec {
  count: number;
  life: [number, number];
  size: [number, number];
  grow: number;
  speed: [number, number];
  /** Direction spread: 0 = straight up, 1 = any way. */
  spread: number;
  gravity: number;
  drag: number;
  colors: number[];
  alpha: number;
  shape: number;
}

const SPECS: Record<EffectKind, Spec> = {
  spray: {
    count: 14,
    life: [0.5, 0.9],
    size: [0.22, 0.38],
    grow: 0.3,
    speed: [2, 5.5],
    spread: 0.55,
    gravity: 9,
    drag: 0.5,
    colors: [0xffffff, 0xdff6ff, 0xbfeaff],
    alpha: 0.9,
    shape: SHAPE_CIRCLE,
  },
  splash: {
    count: 26,
    life: [0.7, 1.1],
    size: [0.2, 0.36],
    grow: 0.3,
    speed: [3, 8],
    spread: 0.45,
    gravity: 14,
    drag: 0.2,
    colors: [0xffffff, 0xbfeaff, 0x7fd4ff, 0x4fb0ee],
    alpha: 0.92,
    shape: SHAPE_CIRCLE,
  },
  bigSplash: {
    count: 70,
    life: [0.9, 1.5],
    size: [0.3, 0.6],
    grow: 0.25,
    speed: [6, 13],
    spread: 0.13,
    gravity: 14,
    drag: 0.12,
    colors: [0xffffff, 0xe3f7ff, 0xbfeaff, 0x7fd4ff],
    alpha: 0.95,
    shape: SHAPE_CIRCLE,
  },
  bubbles: {
    count: 5,
    life: [0.8, 1.4],
    size: [0.16, 0.34],
    grow: 0.2,
    speed: [0.2, 0.9],
    spread: 1,
    gravity: -2.2,
    drag: 1.2,
    colors: [0xe6fbff, 0xbfeaff],
    alpha: 0.7,
    shape: SHAPE_CIRCLE,
  },
  drips: {
    count: 7,
    life: [0.6, 1.0],
    size: [0.12, 0.2],
    grow: 0,
    speed: [0.5, 2.2],
    spread: 0.8,
    gravity: 10,
    drag: 0.3,
    colors: [0x9ee2ff, 0xd2f2ff],
    alpha: 0.95,
    shape: SHAPE_CIRCLE,
  },
  stars: {
    count: 4,
    life: [1.6, 1.8],
    size: [0.4, 0.4],
    grow: 0,
    speed: [0, 0],
    spread: 0,
    gravity: 0,
    drag: 0,
    colors: [0xffe066],
    alpha: 1,
    shape: SHAPE_STAR,
  },
  confetti: {
    count: 28,
    life: [1.3, 2.1],
    size: [0.16, 0.26],
    grow: 0,
    speed: [3, 8],
    spread: 0.8,
    gravity: 5,
    drag: 1.4,
    colors: [0xff5a5a, 0xffd43b, 0x4dd0e1, 0x7be07b, 0xff8fd0, 0xffffff],
    alpha: 1,
    shape: SHAPE_SQUARE,
  },
};

const SPARKLE: Spec = {
  count: 7,
  life: [0.35, 0.7],
  size: [0.14, 0.24],
  grow: 0.2,
  speed: [1, 3.5],
  spread: 1,
  gravity: 2.5,
  drag: 1.5,
  colors: [0xfff6a8, 0xffffff, 0xffd43b],
  alpha: 1,
  shape: SHAPE_STAR,
};

const FIREWORK_COLORS = [0xff5a5a, 0xffd43b, 0x4dd0e1, 0x7be07b, 0xff8fd0, 0xffffff, 0xb28dff];

export interface Effects {
  object: Object3D;
  /** Fires an effect at world position (x, y, z); `color` overrides the usual colours. */
  fire(kind: EffectKind, x: number, y: number, z: number, color?: number): void;
  /** A burst of fireworks centred on (x, y, z). */
  fireworks(x: number, y: number, z: number): void;
  /** A little shower of sparkles where a coin was picked up. */
  sparkle(x: number, y: number, z: number): void;
  /** A puff of white spray from the nozzle, thrown back (+z) at `speed`. */
  wake(x: number, y: number, z: number, speed: number): void;
  /** Pixels per world unit at depth 1, so the points scale with the picture. */
  setScale(pixelsPerUnitAtUnitDepth: number): void;
  update(delta: number): void;
  /** Number of live particles. */
  readonly live: number;
  clear(): void;
  dispose(): void;
}

export function createEffects(): Effects {
  const n = MAX_PARTICLES;
  const position = new Float32Array(n * 3);
  const tint = new Float32Array(n * 4);
  const size = new Float32Array(n);
  const shape = new Float32Array(n);
  const spin = new Float32Array(n);
  // Simulation state.
  const vx = new Float32Array(n);
  const vy = new Float32Array(n);
  const vz = new Float32Array(n);
  const life = new Float32Array(n);
  const maxLife = new Float32Array(n);
  const size0 = new Float32Array(n);
  const grow = new Float32Array(n);
  const gravity = new Float32Array(n);
  const drag = new Float32Array(n);
  const alpha0 = new Float32Array(n);
  const spinRate = new Float32Array(n);
  const rgb = new Float32Array(n * 3);
  // Orbiting stars: centre and phase.
  const orbitX = new Float32Array(n);
  const orbitY = new Float32Array(n);
  const orbitZ = new Float32Array(n);
  const orbitPhase = new Float32Array(n);
  const orbiting = new Uint8Array(n);

  let next = 0;
  let alive = 0;
  const colour = new Color();

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('tint', new BufferAttribute(tint, 4));
  geometry.setAttribute('size', new BufferAttribute(size, 1));
  geometry.setAttribute('shape', new BufferAttribute(shape, 1));
  geometry.setAttribute('spin', new BufferAttribute(spin, 1));
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    uniforms: { scale: { value: 600 } },
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 10;

  const random = (a: number, b: number) => a + Math.random() * (b - a);

  const spawn = (
    x: number,
    y: number,
    z: number,
    dx: number,
    dy: number,
    dz: number,
    spec: Spec,
    hex: number,
    sizeValue: number,
    lifeValue: number,
  ): number => {
    const i = next;
    next = (next + 1) % n;
    if (life[i] <= 0) alive++;
    position[i * 3] = x;
    position[i * 3 + 1] = y;
    position[i * 3 + 2] = z;
    vx[i] = dx;
    vy[i] = dy;
    vz[i] = dz;
    life[i] = maxLife[i] = lifeValue;
    size0[i] = sizeValue;
    grow[i] = spec.grow;
    gravity[i] = spec.gravity;
    drag[i] = spec.drag;
    alpha0[i] = spec.alpha;
    shape[i] = spec.shape;
    spin[i] = Math.random() * 6.28;
    spinRate[i] = spec.shape === SHAPE_CIRCLE ? 0 : random(-8, 8);
    orbiting[i] = 0;
    colour.setHex(hex);
    rgb[i * 3] = colour.r;
    rgb[i * 3 + 1] = colour.g;
    rgb[i * 3 + 2] = colour.b;
    return i;
  };

  const burst = (
    spec: Spec,
    x: number,
    y: number,
    z: number,
    color?: number,
    scaleCount = 1,
    jitter = 0.25,
  ) => {
    const count = Math.max(1, Math.round(spec.count * scaleCount));
    for (let k = 0; k < count; k++) {
      // 0 is straight up; the spread widens the cone, up to every direction.
      const polar = Math.random() * Math.PI * spec.spread;
      const azimuth = Math.random() * Math.PI * 2;
      const speed = random(spec.speed[0], spec.speed[1]);
      const hex = color ?? spec.colors[Math.floor(Math.random() * spec.colors.length)];
      spawn(
        x + random(-jitter, jitter),
        y + random(-0.1, 0.2),
        z + random(-jitter, jitter),
        Math.sin(polar) * Math.cos(azimuth) * speed,
        Math.cos(polar) * speed,
        Math.sin(polar) * Math.sin(azimuth) * speed,
        spec,
        hex,
        random(spec.size[0], spec.size[1]),
        random(spec.life[0], spec.life[1]),
      );
    }
  };

  return {
    object: points,
    get live() {
      return alive;
    },
    fire(kind, x, y, z, color) {
      if (kind === 'stars') {
        const spec = SPECS.stars;
        for (let k = 0; k < spec.count; k++) {
          const i = spawn(x, y, z, 0, 0, 0, spec, spec.colors[0], spec.size[0], spec.life[0]);
          orbiting[i] = 1;
          orbitX[i] = x;
          orbitY[i] = y;
          orbitZ[i] = z;
          orbitPhase[i] = (k / spec.count) * Math.PI * 2;
        }
        return;
      }
      burst(SPECS[kind], x, y, z, color, 1, kind === 'bigSplash' ? 0.5 : 0.25);
    },
    fireworks(x, y, z) {
      for (let shell = 0; shell < 3; shell++) {
        const cx = x + random(-3.5, 3.5);
        const cy = y + 3 + random(0, 3);
        const hex = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
        const spec: Spec = {
          count: 28,
          life: [1.0, 1.6],
          size: [0.24, 0.38],
          grow: -0.1,
          speed: [3, 7],
          spread: 1,
          gravity: 4,
          drag: 1.3,
          colors: [hex],
          alpha: 1,
          shape: SHAPE_STAR,
        };
        burst(spec, cx, cy, z + random(-2, 2), undefined, 1, 0.1);
      }
    },
    sparkle(x, y, z) {
      burst(SPARKLE, x, y, z, 0xffe066, 1.4);
    },
    wake(x, y, z, speed) {
      const spec = SPECS.spray;
      spawn(
        x + random(-0.15, 0.15),
        y,
        z,
        random(-0.8, 0.8),
        random(0.8, 2.2),
        speed * 0.35 + random(0, 1.2),
        spec,
        0xffffff,
        random(0.18, 0.3),
        random(0.35, 0.6),
      );
    },
    setScale(value) {
      material.uniforms.scale.value = value;
    },
    update(delta) {
      if (alive === 0) return;
      for (let i = 0; i < n; i++) {
        if (life[i] <= 0) continue;
        life[i] -= delta;
        if (life[i] <= 0) {
          alive--;
          tint[i * 4 + 3] = 0;
          size[i] = 0;
          continue;
        }
        const u = 1 - life[i] / maxLife[i];
        if (orbiting[i]) {
          const a = orbitPhase[i] + u * maxLife[i] * 5;
          position[i * 3] = orbitX[i] + Math.cos(a) * 0.75;
          position[i * 3 + 1] = orbitY[i] + Math.sin(a * 2) * 0.12;
          position[i * 3 + 2] = orbitZ[i] + Math.sin(a) * 0.75;
        } else {
          const damp = Math.exp(-drag[i] * delta);
          vx[i] *= damp;
          vy[i] = vy[i] * damp - gravity[i] * delta;
          vz[i] *= damp;
          position[i * 3] += vx[i] * delta;
          position[i * 3 + 1] += vy[i] * delta;
          position[i * 3 + 2] += vz[i] * delta;
        }
        spin[i] += spinRate[i] * delta;
        size[i] = Math.max(size0[i] * (1 + grow[i] * u), 0);
        tint[i * 4] = rgb[i * 3];
        tint[i * 4 + 1] = rgb[i * 3 + 1];
        tint[i * 4 + 2] = rgb[i * 3 + 2];
        // Fade in a touch, out for the last stretch.
        tint[i * 4 + 3] = alpha0[i] * Math.min(1, u * 12) * Math.min(1, (1 - u) * 3);
      }
      (geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
      (geometry.getAttribute('tint') as BufferAttribute).needsUpdate = true;
      (geometry.getAttribute('size') as BufferAttribute).needsUpdate = true;
      (geometry.getAttribute('spin') as BufferAttribute).needsUpdate = true;
      (geometry.getAttribute('shape') as BufferAttribute).needsUpdate = true;
    },
    clear() {
      life.fill(0);
      tint.fill(0);
      size.fill(0);
      alive = 0;
      (geometry.getAttribute('tint') as BufferAttribute).needsUpdate = true;
      (geometry.getAttribute('size') as BufferAttribute).needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      points.removeFromParent();
    },
  };
}
