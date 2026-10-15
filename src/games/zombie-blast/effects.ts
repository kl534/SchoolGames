import { Group, Mesh, MeshBasicMaterial, SphereGeometry, Vector3, type Object3D } from 'three';

interface Particle {
  mesh: Mesh<SphereGeometry, MeshBasicMaterial>;
  velocity: Vector3;
  age: number;
  life: number;
  from: number;
  to: number;
  /** Opacity at the start; it fades to nothing by the end of its life. */
  alpha: number;
  gravity: number;
}

export interface Effects {
  object: Object3D;
  /** Cartoon BOOM: an orange and yellow flash with white puffs billowing out (`size` 1 is normal). */
  boom(at: Vector3, size?: number): void;
  /** A small grey puff and a wisp of smoke for a bomb that fizzles out. */
  fizzle(at: Vector3): void;
  /** A quick white poof, for something vanishing. */
  poof(at: Vector3): void;
  /** Removes everything still playing. */
  clear(): void;
  update(delta: number): void;
}

/** Throwaway puffs and flashes, all made of fading spheres. */
export function createEffects(): Effects {
  const group = new Group();
  const geometry = new SphereGeometry(1, 14, 10);
  const particles: Particle[] = [];

  const spawn = (
    at: Vector3,
    color: number,
    from: number,
    to: number,
    life: number,
    velocity: Vector3,
    alpha = 0.95,
    gravity = 0,
  ) => {
    const mesh = new Mesh(
      geometry,
      new MeshBasicMaterial({ color, transparent: true, opacity: alpha, depthWrite: false }),
    );
    mesh.position.copy(at);
    mesh.scale.setScalar(from);
    group.add(mesh);
    particles.push({ mesh, velocity, age: 0, life, from, to, alpha, gravity });
  };

  const ring = (
    at: Vector3,
    count: number,
    color: number,
    radius: number,
    speed: number,
    lift: number,
    life: number,
  ) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.6;
      const v = new Vector3(Math.cos(a) * speed, lift * (0.5 + Math.random()), Math.sin(a) * speed);
      spawn(at, color, radius * 0.4, radius * (0.9 + Math.random() * 0.5), life, v, 0.9);
    }
  };

  return {
    object: group,
    boom(at, size = 1) {
      const centre = at.clone();
      centre.y += 0.6 * size;
      spawn(centre, 0xffcf33, 0.4 * size, 3.2 * size, 0.45, new Vector3(), 0.95);
      spawn(centre, 0xff7a1a, 0.3 * size, 2.3 * size, 0.4, new Vector3(0, 0.3 * size, 0), 0.95);
      ring(centre, 9, 0xffffff, 0.75 * size, 3.2 * size, 1.8 * size, 0.9);
      ring(centre, 6, 0xfff1d0, 0.6 * size, 1.8 * size, 2.8 * size, 1.1);
    },
    fizzle(at) {
      const p = at.clone();
      p.y += 0.15;
      ring(p, 5, 0xb9bcc8, 0.22, 0.7, 0.8, 0.8);
      spawn(p, 0x8a8d99, 0.14, 0.4, 1.1, new Vector3(0, 1.1, 0), 0.8);
      spawn(p, 0xb9bcc8, 0.1, 0.34, 1.3, new Vector3(0.1, 1.5, 0.05), 0.7);
    },
    poof(at) {
      const p = at.clone();
      p.y += 0.4;
      ring(p, 7, 0xffffff, 0.4, 1.6, 0.8, 0.6);
    },
    clear() {
      for (const p of particles) {
        group.remove(p.mesh);
        p.mesh.material.dispose();
      }
      particles.length = 0;
    },
    update(delta) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age += delta;
        const k = Math.min(p.age / p.life, 1);
        p.velocity.y -= p.gravity * delta;
        p.mesh.position.addScaledVector(p.velocity, delta);
        // Burst out quickly, then ease off.
        p.velocity.multiplyScalar(Math.max(1 - delta * 3, 0));
        p.mesh.scale.setScalar(p.from + (p.to - p.from) * (1 - (1 - k) ** 2));
        p.mesh.material.opacity = p.alpha * (1 - k * k);
        if (k >= 1) {
          group.remove(p.mesh);
          p.mesh.material.dispose();
          particles.splice(i, 1);
        }
      }
    },
  };
}
