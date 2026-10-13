import {
  AdditiveBlending,
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
  type Object3D,
} from 'three';
import { rockGeometry } from './rocks';

const CHUNKS = 90;
const GLOWS = 90;
const RINGS = 4;
const BOLTS = 6;
const MISSILES = 3;
/** How long a laser bolt's tail is behind its head, in seconds of travel. */
const BOLT_TAIL = 0.14;

interface Chunk {
  mesh: Mesh;
  velocity: Vector3;
  spin: Vector3;
  age: number;
  life: number;
  size: number;
}

interface Glow {
  mesh: Mesh<SphereGeometry, MeshBasicMaterial>;
  velocity: Vector3;
  age: number;
  life: number;
  from: number;
  to: number;
  alpha: number;
}

interface Ring {
  mesh: Mesh<RingGeometry, MeshBasicMaterial>;
  age: number;
  life: number;
  size: number;
}

interface Bolt {
  object: Group;
  /** Starts here and flies for `life` seconds, to `aim` (homing) or along `velocity`. */
  from: Vector3;
  aim: Vector3 | null;
  velocity: Vector3;
  age: number;
  life: number;
  active: boolean;
}

interface Missile {
  mesh: Mesh;
  from: Vector3;
  aim: Vector3;
  age: number;
  life: number;
  active: boolean;
  onImpact: (() => void) | null;
}

export interface Effects {
  object: Object3D;
  /**
   * Twin laser bolts from the two wing tips to `aim` (kept up to date by the caller). `onImpact`
   * runs when they arrive.
   */
  fireBolts(
    left: Vector3,
    right: Vector3,
    aim: Vector3,
    duration: number,
    onImpact: () => void,
  ): void;
  /** The bolts glancing off: two short bolts spinning away and a shower of sparks. */
  ricochet(at: Vector3): void;
  /** A chunk of rock thrown at `aim`; `onImpact` runs when it lands. */
  throwDebris(from: Vector3, aim: Vector3, duration: number, onImpact: () => void): void;
  /** A big fireball with a shock ring, rocks and sparks. `size` is about 1 for a small rock. */
  explosion(at: Vector3, size: number, drift?: Vector3): void;
  /** A rock shattering into pieces, which carry on with `drift`. */
  rockBurst(at: Vector3, size: number, drift?: Vector3): void;
  /** A knocked-off chunk and a puff of sparks where a laser hit. */
  knockOff(at: Vector3, size: number): void;
  /** A burst of sparkles for a crystal pickup. */
  sparkle(at: Vector3): void;
  /** Takes everything off the screen. */
  clear(): void;
  update(delta: number): void;
}

const hot = [0xffe9a8, 0xffc040, 0xff8a2a, 0xff5a2a];

/** Everything that flashes, flies apart or shoots: all pooled, so nothing is allocated mid-run. */
export function createEffects(): Effects {
  const group = new Group();
  const rand = (a: number, b: number) => a + Math.random() * (b - a);

  // ---------- Pools ----------
  const rockShape = rockGeometry({ radius: 1, detail: 0, roughness: 0.35, seed: 31 });
  const rockColors = [0xa8503a, 0x8a4a40, 0x6d5a8c, 0xc9703a].map(
    (color) =>
      new MeshLambertMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.25,
        flatShading: true,
      }),
  );
  const chunks: Chunk[] = Array.from({ length: CHUNKS }, (_, i) => {
    const mesh = new Mesh(rockShape, rockColors[i % rockColors.length]);
    mesh.visible = false;
    group.add(mesh);
    return { mesh, velocity: new Vector3(), spin: new Vector3(), age: 0, life: 1, size: 1 };
  });
  let nextChunk = 0;

  const glowShape = new SphereGeometry(1, 16, 12);
  const glows: Glow[] = Array.from({ length: GLOWS }, () => {
    const mesh = new Mesh(
      glowShape,
      new MeshBasicMaterial({
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    mesh.visible = false;
    group.add(mesh);
    return { mesh, velocity: new Vector3(), age: 0, life: 1, from: 1, to: 1, alpha: 1 };
  });
  let nextGlow = 0;

  const rings: Ring[] = Array.from({ length: RINGS }, () => {
    const mesh = new Mesh(
      new RingGeometry(0.85, 1, 40),
      new MeshBasicMaterial({
        color: 0xffd9a0,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    mesh.visible = false;
    group.add(mesh);
    return { mesh, age: 0, life: 1, size: 1 };
  });
  let nextRing = 0;

  const boltCore = new BoxGeometry(0.08, 0.08, 1);
  const boltGlow = new BoxGeometry(0.28, 0.28, 1);
  const bolts: Bolt[] = Array.from({ length: BOLTS }, () => {
    const object = new Group();
    object.add(
      new Mesh(boltCore, new MeshBasicMaterial({ color: 0xffffff, fog: false })),
      new Mesh(
        boltGlow,
        new MeshBasicMaterial({
          color: 0x4dffb0,
          transparent: true,
          opacity: 0.55,
          blending: AdditiveBlending,
          depthWrite: false,
          fog: false,
        }),
      ),
    );
    object.visible = false;
    group.add(object);
    return {
      object,
      from: new Vector3(),
      aim: null,
      velocity: new Vector3(),
      age: 0,
      life: 1,
      active: false,
    };
  });
  let nextBolt = 0;
  let volley: { bolts: Bolt[]; onImpact: () => void } | null = null;

  const missileMaterial = new MeshLambertMaterial({
    color: 0xff7a3a,
    emissive: 0xff5a1a,
    emissiveIntensity: 0.7,
    flatShading: true,
  });
  const missiles: Missile[] = Array.from({ length: MISSILES }, () => {
    const mesh = new Mesh(rockShape, missileMaterial);
    mesh.visible = false;
    group.add(mesh);
    return {
      mesh,
      from: new Vector3(),
      aim: new Vector3(),
      age: 0,
      life: 1,
      active: false,
      onImpact: null,
    };
  });
  let nextMissile = 0;

  // ---------- Spawning ----------
  const spawnChunk = (at: Vector3, size: number, speed: number, life: number, drift?: Vector3) => {
    const c = chunks[nextChunk];
    nextChunk = (nextChunk + 1) % chunks.length;
    c.mesh.position.copy(at);
    c.velocity
      .set(rand(-1, 1), rand(-1, 1), rand(-1, 1))
      .normalize()
      .multiplyScalar(speed * rand(0.4, 1));
    if (drift) c.velocity.add(drift);
    c.spin.set(rand(-6, 6), rand(-6, 6), rand(-6, 6));
    c.mesh.rotation.set(rand(0, 6), rand(0, 6), 0);
    c.size = size;
    c.mesh.scale.setScalar(size);
    c.age = 0;
    c.life = life;
    c.mesh.visible = true;
  };

  const spawnGlow = (
    at: Vector3,
    color: number,
    from: number,
    to: number,
    life: number,
    speed = 0,
    alpha = 0.9,
    drift?: Vector3,
  ) => {
    const g = glows[nextGlow];
    nextGlow = (nextGlow + 1) % glows.length;
    g.mesh.position.copy(at);
    g.mesh.material.color.setHex(color);
    g.velocity.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(speed);
    if (drift) g.velocity.add(drift);
    g.from = from;
    g.to = to;
    g.alpha = alpha;
    g.age = 0;
    g.life = life;
    g.mesh.scale.setScalar(from);
    g.mesh.material.opacity = alpha;
    g.mesh.visible = true;
  };

  const spawnRing = (at: Vector3, size: number, life: number, color: number) => {
    const r = rings[nextRing];
    nextRing = (nextRing + 1) % rings.length;
    r.mesh.position.copy(at);
    r.mesh.material.color.setHex(color);
    r.size = size;
    r.age = 0;
    r.life = life;
    r.mesh.scale.setScalar(0.2);
    r.mesh.visible = true;
  };

  const spawnBolt = (from: Vector3, aim: Vector3 | null, life: number, color: number) => {
    const b = bolts[nextBolt];
    nextBolt = (nextBolt + 1) % bolts.length;
    b.from.copy(from);
    b.aim = aim;
    b.velocity.set(0, 0, 0);
    b.age = 0;
    b.life = life;
    b.active = true;
    b.object.visible = true;
    ((b.object.children[1] as Mesh).material as MeshBasicMaterial).color.setHex(color);
    return b;
  };

  // Scratch vectors, so updating never allocates.
  const head = new Vector3();
  const tail = new Vector3();
  const mid = new Vector3();
  /** Knocked-off chunks fly on towards the camera. */
  const knockDrift = new Vector3(0, 1, 5);

  const placeBolt = (b: Bolt) => {
    const k = Math.min(b.age / b.life, 1);
    if (b.aim) {
      head.lerpVectors(b.from, b.aim, k);
      tail.lerpVectors(b.from, b.aim, Math.max(k - BOLT_TAIL / b.life, 0));
    } else {
      head.copy(b.from).addScaledVector(b.velocity, b.age);
      tail.copy(b.from).addScaledVector(b.velocity, Math.max(b.age - BOLT_TAIL, 0));
    }
    const length = Math.max(head.distanceTo(tail), 0.05);
    mid.addVectors(head, tail).multiplyScalar(0.5);
    b.object.position.copy(mid);
    b.object.scale.set(1, 1, length);
    b.object.lookAt(head);
  };

  const burst = (at: Vector3, count: number, color: number, speed: number, drift?: Vector3) => {
    for (let i = 0; i < count; i++) {
      spawnGlow(at, color, 0.14, 0.02, rand(0.3, 0.6), rand(speed * 0.4, speed), 1, drift);
    }
  };

  return {
    object: group,
    fireBolts(left, right, aim, duration, onImpact) {
      const a = spawnBolt(left, aim, duration, 0x4dffb0);
      const b = spawnBolt(right, aim, duration, 0x4dffb0);
      placeBolt(a);
      placeBolt(b);
      volley = { bolts: [a, b], onImpact };
    },
    ricochet(at) {
      burst(at, 14, 0xffe9a8, 7);
      spawnGlow(at, 0xfff2c0, 0.3, 1.2, 0.25, 0, 0.9);
      for (let i = 0; i < 2; i++) {
        const b = spawnBolt(at, null, 0.5, 0xff7a7a);
        b.velocity.set(i ? 9 : -9, rand(2, 8), rand(6, 12));
      }
    },
    throwDebris(from, aim, duration, onImpact) {
      const m = missiles[nextMissile];
      nextMissile = (nextMissile + 1) % missiles.length;
      m.from.copy(from);
      m.aim.copy(aim);
      m.age = 0;
      m.life = duration;
      m.active = true;
      m.onImpact = onImpact;
      m.mesh.scale.setScalar(0.9);
      m.mesh.position.copy(from);
      m.mesh.visible = true;
    },
    explosion(at, size, drift) {
      spawnGlow(at, 0xfff2c0, 0.4 * size, 2.6 * size, 0.22, 0, 0.9);
      spawnGlow(at, 0xffc040, 0.4 * size, 2.5 * size, 0.5, 0, 0.55);
      spawnGlow(at, 0xff6a1a, 0.3 * size, 2.1 * size, 0.75, 0, 0.4);
      spawnRing(at, 5 * size, 0.6, 0xffd9a0);
      const pieces = Math.min(Math.round(14 * size), 40);
      for (let i = 0; i < pieces; i++) {
        spawnChunk(
          at,
          rand(0.18, 0.5) * Math.sqrt(size),
          rand(5, 13) * Math.sqrt(size),
          rand(1, 1.7),
          drift,
        );
      }
      for (let i = 0; i < Math.min(Math.round(10 * size), 26); i++) {
        spawnGlow(
          at,
          hot[i % hot.length],
          0.2 * Math.sqrt(size),
          0.04,
          rand(0.4, 0.9),
          rand(8, 18),
          1,
          drift,
        );
      }
    },
    rockBurst(at, size, drift) {
      spawnGlow(at, 0xffd9a0, 0.2 * size, 1 * size, 0.3, 0, 0.6, drift);
      for (let i = 0; i < 9; i++) {
        spawnChunk(at, rand(0.12, 0.28) * size, rand(2.5, 6), rand(0.8, 1.3), drift);
      }
      burst(at, 6, 0xc8a07a, 4, drift);
    },
    knockOff(at, size) {
      spawnGlow(at, 0xffffff, 0.3 * size, 2.2 * size, 0.25, 0, 1);
      spawnRing(at, 2.4 * size, 0.4, 0xfff2c0);
      for (let i = 0; i < 7; i++) {
        spawnChunk(at, rand(0.25, 0.6) * size, rand(5, 11), rand(1, 1.6), knockDrift);
      }
      burst(at, 12, 0xffd06a, 9);
    },
    sparkle(at) {
      const colors = [0xffffff, 0x6ef3ff, 0xff9ae6, 0xffe066];
      for (let i = 0; i < 14; i++) {
        spawnGlow(at, colors[i % colors.length], 0.16, 0.02, rand(0.4, 0.8), rand(2, 6), 1);
      }
      spawnGlow(at, 0xffffff, 0.4, 1.4, 0.3, 0, 0.7);
    },
    clear() {
      chunks.forEach((c) => (c.mesh.visible = false));
      glows.forEach((g) => (g.mesh.visible = false));
      rings.forEach((r) => (r.mesh.visible = false));
      bolts.forEach((b) => {
        b.active = false;
        b.object.visible = false;
      });
      missiles.forEach((m) => {
        m.active = false;
        m.onImpact = null;
        m.mesh.visible = false;
      });
      volley = null;
    },
    update(delta) {
      for (const c of chunks) {
        if (!c.mesh.visible) continue;
        c.age += delta;
        const k = c.age / c.life;
        if (k >= 1) {
          c.mesh.visible = false;
          continue;
        }
        c.mesh.position.addScaledVector(c.velocity, delta);
        c.mesh.rotation.x += c.spin.x * delta;
        c.mesh.rotation.y += c.spin.y * delta;
        // Shrink away over the last part of their life.
        c.mesh.scale.setScalar(c.size * (k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4));
      }
      for (const g of glows) {
        if (!g.mesh.visible) continue;
        g.age += delta;
        const k = g.age / g.life;
        if (k >= 1) {
          g.mesh.visible = false;
          continue;
        }
        g.mesh.position.addScaledVector(g.velocity, delta);
        g.velocity.multiplyScalar(Math.max(1 - delta * 3, 0));
        g.mesh.scale.setScalar(g.from + (g.to - g.from) * (1 - (1 - k) ** 2));
        g.mesh.material.opacity = g.alpha * (1 - k * k);
      }
      for (const r of rings) {
        if (!r.mesh.visible) continue;
        r.age += delta;
        const k = r.age / r.life;
        if (k >= 1) {
          r.mesh.visible = false;
          continue;
        }
        r.mesh.scale.setScalar(0.2 + r.size * (1 - (1 - k) ** 2));
        r.mesh.material.opacity = 1 - k;
      }
      for (const b of bolts) {
        if (!b.active) continue;
        b.age += delta;
        if (b.age >= b.life + (b.aim ? 0 : BOLT_TAIL)) {
          b.active = false;
          b.object.visible = false;
          continue;
        }
        placeBolt(b);
      }
      if (volley && volley.bolts[0].age >= volley.bolts[0].life) {
        const { bolts: flying, onImpact } = volley;
        volley = null;
        flying.forEach((b) => {
          b.active = false;
          b.object.visible = false;
        });
        onImpact();
      }
      for (const m of missiles) {
        if (!m.active) continue;
        m.age += delta;
        const k = Math.min(m.age / m.life, 1);
        m.mesh.position.lerpVectors(m.from, m.aim, k);
        m.mesh.rotation.x += delta * 9;
        m.mesh.rotation.y += delta * 7;
        if (k >= 1) {
          m.active = false;
          m.mesh.visible = false;
          const done = m.onImpact;
          m.onImpact = null;
          done?.();
        }
      }
    },
  };
}
