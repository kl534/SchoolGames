import {
  AdditiveBlending,
  AmbientLight,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Points,
  PointsMaterial,
  RingGeometry,
  SphereGeometry,
  SRGBColorSpace,
  type Scene,
  type Vector3,
} from 'three';
import { PAST_Z, SPAWN_Z } from './layout';
import { rockGeometry } from './rocks';

/** The fog colour: far things fade into the deep violet of the nebula. */
export const FOG_COLOR = 0x180f3d;

const STAR_COUNT = 520;
const STAR_DEPTH = 280;
const STREAK_COUNT = 130;
const SCENERY_COUNT = 26;

function canvasTexture(width: number, height: number, draw: (g: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  if (g) draw(g);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Small deterministic random numbers so the sky is the same every time. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** The sky: near-black violet with glowing pink, teal and blue nebula clouds and fine stars. */
function skyTexture() {
  const W = 2048;
  const H = 1024;
  return canvasTexture(W, H, (g) => {
    const random = seeded(7);
    const base = g.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, '#05041a');
    base.addColorStop(0.5, '#0e0833');
    base.addColorStop(1, '#05041a');
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    const cloud = (u: number, v: number, r: number, color: string, alpha: number) => {
      // Draw twice so a cloud on the seam wraps round.
      for (const shift of [0, -W, W]) {
        const x = u * W + shift;
        if (x < -r || x > W + r) continue;
        const gradient = g.createRadialGradient(x, v * H, 0, x, v * H, r);
        gradient.addColorStop(0, `rgba(${color},${alpha})`);
        gradient.addColorStop(0.5, `rgba(${color},${alpha * 0.35})`);
        gradient.addColorStop(1, `rgba(${color},0)`);
        g.fillStyle = gradient;
        g.fillRect(x - r, v * H - r, r * 2, r * 2);
      }
    };
    const colors = ['255,70,160', '70,110,255', '50,210,200', '170,90,255'];
    // The sky ahead of the ship is a small part of the picture, so it gets the most clouds.
    for (let i = 0; i < 70; i++) {
      cloud(
        0.58 + random() * 0.34,
        0.2 + random() * 0.6,
        50 + random() * 110,
        colors[i % 4],
        0.06 + random() * 0.14,
      );
    }
    for (let i = 0; i < 40; i++) {
      cloud(
        random(),
        0.15 + random() * 0.7,
        60 + random() * 140,
        colors[i % 4],
        0.05 + random() * 0.1,
      );
    }
    for (let i = 0; i < 1800; i++) {
      const size = random() < 0.08 ? 3 : random() < 0.4 ? 2 : 1;
      g.fillStyle = `rgba(255,255,255,${0.3 + random() * 0.7})`;
      g.fillRect(random() * W, random() * H, size, size);
    }
  });
}

function planetTexture() {
  return canvasTexture(256, 128, (g) => {
    const random = seeded(21);
    const colors = ['#ffcf8a', '#f2a65a', '#ffe3b8', '#e0794d', '#ffd6a0', '#c9604a'];
    let y = 0;
    while (y < 128) {
      const h = 6 + random() * 16;
      g.fillStyle = colors[Math.floor(random() * colors.length)];
      g.fillRect(0, y, 256, h);
      y += h;
    }
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 30; i++) g.fillRect(random() * 256, random() * 128, 30 + random() * 50, 2);
  });
}

function dotTexture() {
  return canvasTexture(32, 32, (g) => {
    const gradient = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gradient;
    g.fillRect(0, 0, 32, 32);
  });
}

export interface Backdrop {
  /**
   * `speed` is how fast the world streams past, in units per second; `camera` is where the
   * camera is, because the sky and the planet follow it.
   */
  update(delta: number, speed: number, camera: Vector3): void;
}

/**
 * Everything that makes the ship feel fast: lights, a nebula sky, a distant planet, stars with
 * speed streaks, and tumbling rocks drifting past outside the flight box.
 */
export function buildBackdrop(scene: Scene): Backdrop {
  scene.background = null;
  scene.fog = new Fog(FOG_COLOR, 70, 235);

  scene.add(new HemisphereLight(0xb7c4ff, 0x4a2a6a, 1.5));
  scene.add(new AmbientLight(0x6a5aa0, 0.8));
  const sun = new DirectionalLight(0xfff0d8, 2.4);
  sun.position.set(-4, 6, 8);
  scene.add(sun);
  const rim = new DirectionalLight(0x6aa8ff, 1.2);
  rim.position.set(3, 2, -8);
  scene.add(rim);

  // ---------- Sky and planet (both stay put relative to the camera) ----------
  const far = new Group();
  scene.add(far);
  const sky = new Mesh(
    new SphereGeometry(500, 32, 16),
    new MeshBasicMaterial({ map: skyTexture(), side: BackSide, fog: false, depthWrite: false }),
  );
  sky.renderOrder = -10;
  far.add(sky);

  const planet = new Group();
  planet.position.set(-150, 70, -380);
  far.add(planet);
  planet.add(
    new Mesh(
      new SphereGeometry(70, 32, 20),
      new MeshLambertMaterial({ map: planetTexture(), fog: false }),
    ),
  );
  const ring = new Mesh(
    new RingGeometry(95, 140, 64),
    new MeshBasicMaterial({
      color: 0xffd9a8,
      transparent: true,
      opacity: 0.45,
      side: DoubleSide,
      fog: false,
      depthWrite: false,
    }),
  );
  ring.rotation.set(-1.25, 0.1, 0.35);
  planet.add(ring);
  const moon = new Mesh(
    new SphereGeometry(16, 16, 12),
    new MeshLambertMaterial({ color: 0xb9b2d6, fog: false }),
  );
  moon.position.set(120, -30, -300);
  far.add(moon);

  // ---------- Stars ----------
  const random = Math.random;
  const dot = dotTexture();
  const starPositions = new Float32Array(STAR_COUNT * 3);
  const starColors = new Float32Array(STAR_COUNT * 3);
  const palette = [
    [1, 1, 1],
    [0.7, 0.85, 1],
    [1, 0.85, 0.7],
    [1, 0.7, 0.9],
  ];
  for (let i = 0; i < STAR_COUNT; i++) {
    starPositions[i * 3] = (random() - 0.5) * 150;
    starPositions[i * 3 + 1] = (random() - 0.5) * 95;
    starPositions[i * 3 + 2] = PAST_Z - random() * STAR_DEPTH;
    const c = palette[i % palette.length];
    starColors.set(c, i * 3);
  }
  const starGeometry = new BufferGeometry();
  starGeometry.setAttribute('position', new BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('color', new BufferAttribute(starColors, 3));
  const stars = new Points(
    starGeometry,
    new PointsMaterial({
      size: 0.55,
      map: dot,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
    }),
  );
  stars.frustumCulled = false;
  scene.add(stars);

  // ---------- Speed streaks ----------
  const streakPositions = new Float32Array(STREAK_COUNT * 6);
  const streakColors = new Float32Array(STREAK_COUNT * 6);
  const streakSeeds = new Float32Array(STREAK_COUNT * 3); // x, y, z of the head
  const placeStreak = (i: number, z: number) => {
    const angle = random() * Math.PI * 2;
    const r = 3.5 + random() * 24;
    streakSeeds[i * 3] = Math.cos(angle) * r * 1.4;
    streakSeeds[i * 3 + 1] = Math.sin(angle) * r * 0.8;
    streakSeeds[i * 3 + 2] = z;
  };
  for (let i = 0; i < STREAK_COUNT; i++) {
    placeStreak(i, PAST_Z - random() * 150);
    const tint = i % 3 === 0 ? [0.6, 0.8, 1] : [0.85, 0.9, 1];
    // Bright at the head, fading to nothing at the tail.
    streakColors.set([...tint.map((c) => c * 0.8), 0, 0, 0], i * 6);
  }
  const streakGeometry = new BufferGeometry();
  streakGeometry.setAttribute('position', new BufferAttribute(streakPositions, 3));
  streakGeometry.setAttribute('color', new BufferAttribute(streakColors, 3));
  const streaks = new LineSegments(
    streakGeometry,
    new LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  streaks.frustumCulled = false;
  scene.add(streaks);

  // ---------- Scenery rocks ----------
  const geometries = [1, 2, 3, 4].map((seed) =>
    rockGeometry({
      radius: 1,
      detail: 1,
      roughness: 0.32,
      seed,
      stretch: [1, 0.8 + seed * 0.07, 1.1],
    }),
  );
  const materials = [0x6d5a8c, 0x8a6a5a, 0x5a7aa0].map(
    (color) =>
      new MeshLambertMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.12,
        flatShading: true,
      }),
  );
  const rocks = Array.from({ length: SCENERY_COUNT }, (_, i) => {
    const mesh = new Mesh(geometries[i % geometries.length], materials[i % materials.length]);
    scene.add(mesh);
    return { mesh, spinX: 0, spinY: 0 };
  });
  const placeRock = (rock: (typeof rocks)[number], z: number) => {
    const angle = random() * Math.PI * 2;
    const r = 10 + random() * 40;
    const size = 0.8 + random() * random() * 4.5;
    rock.mesh.position.set(Math.cos(angle) * r * 1.4, Math.sin(angle) * r * 0.8, z);
    rock.mesh.scale.setScalar(size);
    rock.spinX = (random() - 0.5) * 1.2;
    rock.spinY = (random() - 0.5) * 1.2;
  };
  rocks.forEach((rock, i) => {
    placeRock(rock, PAST_Z - (i / SCENERY_COUNT) * (PAST_Z - SPAWN_Z));
    rock.mesh.rotation.set(random() * 6, random() * 6, 0);
  });

  return {
    update(delta, speed, camera) {
      far.position.copy(camera);

      // Stars drift past slowly; the streaks are the fast ones.
      const starMove = speed * 0.85 * delta;
      for (let i = 0; i < STAR_COUNT; i++) {
        const j = i * 3 + 2;
        starPositions[j] += starMove;
        if (starPositions[j] > PAST_Z) starPositions[j] -= STAR_DEPTH;
      }
      starGeometry.attributes.position.needsUpdate = true;

      const length = 0.5 + speed * 0.075;
      for (let i = 0; i < STREAK_COUNT; i++) {
        let z = streakSeeds[i * 3 + 2] + speed * delta;
        if (z > PAST_Z) {
          z = SPAWN_Z * 0.8 - random() * 20;
          placeStreak(i, z);
        }
        streakSeeds[i * 3 + 2] = z;
        const x = streakSeeds[i * 3];
        const y = streakSeeds[i * 3 + 1];
        streakPositions[i * 6] = x;
        streakPositions[i * 6 + 1] = y;
        streakPositions[i * 6 + 2] = z;
        streakPositions[i * 6 + 3] = x;
        streakPositions[i * 6 + 4] = y;
        streakPositions[i * 6 + 5] = z - length;
      }
      streakGeometry.attributes.position.needsUpdate = true;

      for (const rock of rocks) {
        rock.mesh.position.z += speed * delta;
        rock.mesh.rotation.x += rock.spinX * delta;
        rock.mesh.rotation.y += rock.spinY * delta;
        if (rock.mesh.position.z > PAST_Z + 4) placeRock(rock, SPAWN_Z - random() * 30);
      }
    },
  };
}
