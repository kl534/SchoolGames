import {
  AdditiveBlending,
  BoxGeometry,
  ConeGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  TorusGeometry,
} from 'three';
import { crackGeometry, rockGeometry } from './rocks';

/** Radius of a target asteroid, and of a boss. */
export const NORMAL_RADIUS = 3;
export const BOSS_RADIUS = 6.5;

export interface Asteroid {
  /** Move this about; the lock-on reticle comes with it. */
  object: Group;
  radius: number;
  /** Faces a fresh way, with fresh cracks and a closed reticle. */
  reset(): void;
  /** How far the lock-on has closed in, 0 (just spotted) to 1 (locked). */
  setLock(k: number): void;
  /** The reticle turns red while time is short. */
  setUrgent(urgent: boolean): void;
  /** 0 (fresh) to 1 (nearly broken): the cracks glow brighter. */
  setDamage(fraction: number): void;
  update(delta: number, elapsed: number): void;
}

function reticle(radius: number, color: number) {
  const group = new Group();
  const material = new MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  group.add(new Mesh(new TorusGeometry(radius, radius * 0.025, 6, 48), material));
  // Four tick marks pointing in at the rock.
  const tick = new BoxGeometry(radius * 0.06, radius * 0.22, radius * 0.06);
  for (let i = 0; i < 4; i++) {
    const m = new Mesh(tick, material);
    const a = (i / 4) * Math.PI * 2;
    m.position.set(Math.cos(a) * radius * 0.88, Math.sin(a) * radius * 0.88, 0);
    m.rotation.z = a + Math.PI / 2;
    group.add(m);
  }
  return { group, material };
}

/**
 * A big, lumpy, reddish asteroid with glowing cracks and a lock-on reticle round it. The boss is
 * the same thing much bigger, purple, with an angry face that always looks at the player.
 */
export function createAsteroid(boss: boolean): Asteroid {
  const radius = boss ? BOSS_RADIUS : NORMAL_RADIUS;
  const geometry = rockGeometry({
    radius,
    detail: boss ? 3 : 2,
    roughness: boss ? 0.2 : 0.24,
    seed: boss ? 11 : 4,
    stretch: boss ? [1.08, 0.95, 1] : [1.05, 0.92, 1],
  });
  const rockMaterial = new MeshLambertMaterial({
    color: boss ? 0x7a3a78 : 0xa8503a,
    emissive: boss ? 0x2a0a30 : 0x3a1208,
    flatShading: true,
  });
  const crackMaterial = new MeshBasicMaterial({ color: boss ? 0xff5fb0 : 0xffa23a, fog: false });

  const object = new Group();
  const spin = new Group();
  object.add(spin);
  spin.add(new Mesh(geometry, rockMaterial));
  spin.add(
    new Mesh(
      crackGeometry(geometry, boss ? 3 : 8, boss ? 0.2 : 0.17, radius * 0.012),
      crackMaterial,
    ),
  );

  if (boss) {
    // An angry face on the side that looks at the player.
    const eyeMaterial = new MeshBasicMaterial({ color: 0xffe14a, fog: false });
    const eye = new BoxGeometry(radius * 0.34, radius * 0.1, radius * 0.1);
    for (const side of [-1, 1]) {
      const m = new Mesh(eye, eyeMaterial);
      m.position.set(side * radius * 0.36, radius * 0.18, radius * 0.92);
      m.rotation.z = side * -0.4;
      object.add(m);
    }
    const toothMaterial = new MeshBasicMaterial({ color: 0xfff4d6, fog: false });
    const tooth = new ConeGeometry(radius * 0.07, radius * 0.2, 4);
    for (let i = -2; i <= 2; i++) {
      const m = new Mesh(tooth, toothMaterial);
      m.position.set(
        i * radius * 0.14,
        -radius * 0.28 + (i % 2 ? 0 : radius * 0.04),
        radius * 0.95,
      );
      m.rotation.x = Math.PI;
      object.add(m);
    }
  }

  const ring = reticle(radius * 1.45, 0x59ffb5);
  object.add(ring.group);

  let lock = 0;
  let urgent = false;
  let damage = 0;
  let tumble = 0;
  const spinRate = { x: 0.4, y: 0.6 };

  return {
    object,
    radius,
    reset() {
      lock = 0;
      urgent = false;
      damage = 0;
      tumble = Math.random() * 6;
      spin.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      spinRate.x = (Math.random() - 0.5) * 0.9;
      spinRate.y = 0.3 + Math.random() * 0.5;
      object.scale.setScalar(1);
      object.visible = true;
    },
    setLock(k) {
      lock = MathUtils.clamp(k, 0, 1);
    },
    setUrgent(value) {
      urgent = value;
    },
    setDamage(fraction) {
      damage = MathUtils.clamp(fraction, 0, 1);
    },
    update(delta, elapsed) {
      if (boss) {
        // The boss sways rather than tumbles, so its face stays turned to the player.
        spin.rotation.set(Math.sin(elapsed * 0.9) * 0.1, Math.sin(elapsed * 0.6) * 0.18, 0);
      } else {
        spin.rotation.x += spinRate.x * delta;
        spin.rotation.y += spinRate.y * delta;
      }
      // The reticle starts wide and closes in; it pulses and spins once locked.
      const pulse = 1 + Math.sin(elapsed * (urgent ? 14 : 5) + tumble) * 0.04;
      ring.group.scale.setScalar((1 + (1 - lock) * 1.2) * pulse);
      ring.group.rotation.z = elapsed * 0.8;
      ring.material.color.setHex(urgent ? 0xff4d4d : 0x59ffb5);
      ring.material.opacity = 0.35 + lock * 0.55;
      // Cracks glow brighter as the rock is battered.
      const glow = 0.75 + damage * 0.25 + Math.sin(elapsed * 6 + tumble) * 0.08;
      crackMaterial.color.setHex(boss ? 0xff5fb0 : 0xffa23a).multiplyScalar(glow + damage * 0.6);
    },
  };
}
