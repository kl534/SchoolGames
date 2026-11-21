import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  Vector3,
  type Object3D,
} from 'three';
import type { MoveClass } from './rules';

const BITS = 24;
const BIT_LIFE = 0.55;
const GRAVITY = 9;
const SHAKE_SECONDS = 0.25;

/** Colours of the bits a hit throws, by class of move. */
export const BIT_COLORS: Record<MoveClass, number[]> = {
  light: [0xffe066, 0xfff3b0],
  medium: [0xff9f43, 0xffd08a],
  heavy: [0xff5a5a, 0xffa3a3],
  finisher: [0xffffff, 0xffc928, 0xff5a5a],
};

interface Bit {
  mesh: Mesh;
  material: MeshBasicMaterial;
  velocity: Vector3;
  spin: Vector3;
  age: number;
  active: boolean;
}

export interface Effects {
  object: Object3D;
  /** The camera's shake offset (world units): add it to the camera position. */
  readonly offset: { x: number; y: number };
  /** A handful of star and cube bits flying out of `at`. */
  burst(at: { x: number; y: number; z: number }, cls: MoveClass): void;
  /** 0.12 world units for a finisher, 0.06 for a hit on the hero, for 0.25 s. */
  shake(kind: 'finisher' | 'hit'): void;
  /** `hold` keeps the particles and the shake where they are (dev freeze). */
  update(delta: number, hold?: boolean): void;
  clear(): void;
  dispose(): void;
}

/** Pooled bits (24 stars and cubes) and the camera shake. */
export function createEffects(): Effects {
  const object = new Group();
  const star = new OctahedronGeometry(0.1);
  const cube = new BoxGeometry(0.1, 0.1, 0.1);
  const bits: Bit[] = [];
  for (let i = 0; i < BITS; i++) {
    const material = new MeshBasicMaterial({ color: 0xffffff, transparent: true });
    const mesh = new Mesh(i % 2 ? star : cube, material);
    mesh.visible = false;
    object.add(mesh);
    bits.push({
      mesh,
      material,
      velocity: new Vector3(),
      spin: new Vector3(),
      age: 0,
      active: false,
    });
  }
  const offset = { x: 0, y: 0 };
  let shakeAmount = 0;
  let shakeLeft = 0;
  let next = 0;

  return {
    object,
    offset,
    burst(at, cls) {
      const colors = BIT_COLORS[cls];
      const count = cls === 'finisher' ? 12 : cls === 'heavy' ? 8 : 6;
      for (let n = 0; n < count; n++) {
        const bit = bits[next];
        next = (next + 1) % BITS;
        bit.active = true;
        bit.age = 0;
        bit.mesh.visible = true;
        bit.mesh.position.set(at.x, at.y, at.z + 0.2);
        const a = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 3;
        bit.velocity.set(Math.cos(a) * speed, 1.5 + Math.random() * 2.5, Math.sin(a) * speed * 0.5);
        bit.spin.set(Math.random() * 12, Math.random() * 12, Math.random() * 12);
        bit.material.color.setHex(colors[n % colors.length]);
        bit.material.opacity = 1;
        bit.mesh.scale.setScalar(1);
      }
    },
    shake(kind) {
      shakeAmount = kind === 'finisher' ? 0.12 : 0.06;
      shakeLeft = SHAKE_SECONDS;
    },
    update(delta, hold = false) {
      if (hold) return;
      for (const bit of bits) {
        if (!bit.active) continue;
        bit.age += delta;
        if (bit.age >= BIT_LIFE) {
          bit.active = false;
          bit.mesh.visible = false;
          continue;
        }
        bit.velocity.y -= GRAVITY * delta;
        bit.mesh.position.addScaledVector(bit.velocity, delta);
        bit.mesh.rotation.x += bit.spin.x * delta;
        bit.mesh.rotation.y += bit.spin.y * delta;
        const k = 1 - bit.age / BIT_LIFE;
        bit.material.opacity = Math.min(1, k * 2);
        bit.mesh.scale.setScalar(0.4 + 0.6 * k);
      }
      if (shakeLeft > 0) {
        shakeLeft = Math.max(0, shakeLeft - delta);
        const k = shakeLeft / SHAKE_SECONDS;
        offset.x = (Math.random() * 2 - 1) * shakeAmount * k;
        offset.y = (Math.random() * 2 - 1) * shakeAmount * k;
      } else {
        offset.x = 0;
        offset.y = 0;
      }
    },
    clear() {
      for (const bit of bits) {
        bit.active = false;
        bit.mesh.visible = false;
      }
      shakeLeft = 0;
      offset.x = 0;
      offset.y = 0;
    },
    dispose() {
      star.dispose();
      cube.dispose();
      for (const bit of bits) bit.material.dispose();
    },
  };
}

export interface Words {
  /** A comic word (POW!) popping at a screen position; `hold` keeps it up (a frozen dev shot). */
  pop(text: string, at: { x: number; y: number }, hold?: boolean): void;
  clear(): void;
}

/** The comic words as little DOM elements over the scene (styles `br-pow` in `index.html`). */
export function createWords(parent: HTMLElement = document.body): Words {
  const live = new Set<HTMLElement>();
  const remove = (node: HTMLElement) => {
    live.delete(node);
    node.remove();
  };
  return {
    pop(text, at, hold = false) {
      const node = document.createElement('div');
      node.className = hold ? 'br-pow hold' : 'br-pow';
      node.textContent = text;
      node.style.left = `${at.x}px`;
      node.style.top = `${at.y}px`;
      parent.appendChild(node);
      live.add(node);
      if (hold) return;
      node.addEventListener('animationend', (e) => {
        if (e.animationName === 'br-pow') remove(node);
      });
      setTimeout(() => remove(node), 1200);
    },
    clear() {
      live.forEach((node) => node.remove());
      live.clear();
    },
  };
}
