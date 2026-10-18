import {
  Group,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  SphereGeometry,
  Vector3,
  type Object3D,
} from 'three';
import type { Vec3 } from './ik';

export type BurstKind = 'juice' | 'dust' | 'stars';

const POOL = 60;
const PER_BURST = 10;
const GRAVITY = 9;

interface Particle {
  mesh: Mesh<SphereGeometry | OctahedronGeometry, MeshBasicMaterial>;
  velocity: Vector3;
  spin: number;
  age: number;
  life: number;
  size: number;
  grow: number;
  gravity: number;
  active: boolean;
}

export interface Effects {
  object: Object3D;
  burst(kind: BurstKind, at: Vec3): void;
  update(delta: number): void;
  clear(): void;
}

/** A small pool of particles for the juice, dust and star bursts. */
export function createEffects(): Effects {
  const object = new Group();
  const dropGeometry = new SphereGeometry(1, 8, 6);
  const starGeometry = new OctahedronGeometry(1, 0);
  const particles: Particle[] = Array.from({ length: POOL }, () => {
    const mesh = new Mesh(dropGeometry, new MeshBasicMaterial({ transparent: true }));
    mesh.visible = false;
    object.add(mesh);
    return {
      mesh,
      velocity: new Vector3(),
      spin: 0,
      age: 0,
      life: 1,
      size: 0.05,
      grow: 0,
      gravity: GRAVITY,
      active: false,
    };
  });
  let next = 0;

  const spawn = (): Particle => {
    const p = particles[next];
    next = (next + 1) % POOL;
    return p;
  };

  return {
    object,
    burst(kind, at) {
      for (let i = 0; i < PER_BURST; i++) {
        const p = spawn();
        const angle = Math.random() * Math.PI * 2;
        const lift = Math.random();
        p.active = true;
        p.age = 0;
        p.spin = (Math.random() - 0.5) * 12;
        p.mesh.position.set(at.x, at.y, at.z);
        p.mesh.visible = true;
        if (kind === 'juice') {
          p.mesh.geometry = dropGeometry;
          p.mesh.material.color.set(0x9be15d);
          const speed = 1.2 + Math.random() * 1.8;
          p.velocity.set(
            Math.cos(angle) * speed,
            0.8 + lift * 2,
            Math.sin(angle) * speed * 0.6 + 0.8,
          );
          p.life = 0.7 + Math.random() * 0.3;
          p.size = 0.035 + Math.random() * 0.03;
          p.grow = 0;
          p.gravity = GRAVITY;
        } else if (kind === 'dust') {
          p.mesh.geometry = dropGeometry;
          p.mesh.material.color.set(0xb9b9b9);
          p.velocity.set(Math.cos(angle) * 0.9, 0.2 + lift * 0.8, Math.sin(angle) * 0.5 + 0.4);
          p.life = 0.8 + Math.random() * 0.3;
          p.size = 0.06;
          p.grow = 0.18;
          p.gravity = -0.3;
        } else {
          p.mesh.geometry = starGeometry;
          p.mesh.material.color.set(0xffe066);
          const speed = 1 + Math.random() * 1.5;
          p.velocity.set(
            Math.cos(angle) * speed,
            0.6 + lift * 1.8,
            Math.sin(angle) * speed * 0.5 + 0.9,
          );
          p.life = 0.8 + Math.random() * 0.3;
          p.size = 0.05 + Math.random() * 0.03;
          p.grow = 0;
          p.gravity = 4;
        }
        p.mesh.material.opacity = 1;
        p.mesh.scale.setScalar(p.size);
      }
    },
    update(delta) {
      for (const p of particles) {
        if (!p.active) continue;
        p.age += delta;
        if (p.age >= p.life) {
          p.active = false;
          p.mesh.visible = false;
          continue;
        }
        p.velocity.y -= p.gravity * delta;
        p.mesh.position.addScaledVector(p.velocity, delta);
        p.mesh.rotation.z += p.spin * delta;
        p.mesh.rotation.y += p.spin * delta * 0.5;
        const k = p.age / p.life;
        p.mesh.scale.setScalar(p.size + p.grow * k);
        p.mesh.material.opacity = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      }
    },
    clear() {
      for (const p of particles) {
        p.active = false;
        p.mesh.visible = false;
      }
    },
  };
}
