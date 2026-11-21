import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three';
import type { MoveClass, Species } from './rules';

const BITS = 24;
const BIT_LIFE = 0.55;
const GRAVITY = 9;
const SHAKE_SECONDS = 0.25;

/** Colours of the bolts a robot throws when hit, by class of move. */
export const ROBOT_BIT_COLORS: Record<MoveClass, number[]> = {
  light: [0xc9ced6, 0xffe066],
  medium: [0x9aa3b0, 0xf9c74f, 0xf8961e],
  heavy: [0x6b7280, 0xf8961e, 0xffe066],
  finisher: [0xc9ced6, 0xffc928, 0xf8961e, 0xffffff],
};
/** The confetti of a robot's pop. */
export const CONFETTI = [0xf28482, 0x4cc9f0, 0xf9c74f, 0x90be6b, 0xb185ff];
/** Bits a hit throws, by class of move. */
export const HIT_BITS: Record<MoveClass, number> = { light: 6, medium: 6, heavy: 8, finisher: 12 };
/** Bits in a pop. */
export const POP_BITS = 14;

type Shape = 'cube' | 'spring' | 'star' | 'puff' | 'confetti';

interface Bit {
  mesh: Mesh;
  material: MeshBasicMaterial;
  velocity: Vector3;
  spin: Vector3;
  age: number;
  life: number;
  size: number;
  active: boolean;
}

type Point = { x: number; y: number; z: number };

export interface Effects {
  object: Object3D;
  /** The camera's shake offset (world units): add it to the camera position. */
  readonly offset: { x: number; y: number };
  /** A handful of bits flying out of `at`: bolts off a robot, fuzz puffs off a monster in its `color`. */
  hit(at: Point, cls: MoveClass, species: Species, color: number): void;
  /** The finisher's end: the enemy pops apart (14 bits: bolts, springs and confetti, or stars and puffs). */
  pop(at: Point, species: Species, color: number): void;
  /** 0.12 world units for a finisher, 0.06 for a hit on the hero, for 0.25 s. */
  shake(kind: 'finisher' | 'hit'): void;
  /** `hold` keeps the particles and the shake where they are (dev freeze). */
  update(delta: number, hold?: boolean): void;
  clear(): void;
  dispose(): void;
}

/** Pooled bits (24) and the camera shake. */
export function createEffects(): Effects {
  const object = new Group();
  const shapes: Record<Shape, BufferGeometry> = {
    cube: new BoxGeometry(0.1, 0.1, 0.1),
    spring: new TorusGeometry(0.06, 0.016, 6, 12),
    star: new OctahedronGeometry(0.11),
    puff: new SphereGeometry(0.075, 10, 8),
    confetti: new BoxGeometry(0.12, 0.07, 0.012),
  };
  const bits: Bit[] = [];
  for (let i = 0; i < BITS; i++) {
    const material = new MeshBasicMaterial({ color: 0xffffff, transparent: true });
    const mesh = new Mesh(shapes.cube, material);
    mesh.visible = false;
    object.add(mesh);
    bits.push({
      mesh,
      material,
      velocity: new Vector3(),
      spin: new Vector3(),
      age: 0,
      life: BIT_LIFE,
      size: 1,
      active: false,
    });
  }
  const offset = { x: 0, y: 0 };
  let shakeAmount = 0;
  let shakeLeft = 0;
  let next = 0;

  const launch = (
    shape: Shape,
    at: Point,
    color: number,
    size: number,
    life: number,
    boost = 1,
  ) => {
    const bit = bits[next];
    next = (next + 1) % BITS;
    bit.active = true;
    bit.age = 0;
    bit.life = life;
    bit.mesh.geometry = shapes[shape];
    bit.mesh.visible = true;
    bit.mesh.position.set(at.x, at.y, at.z + 0.2);
    const a = Math.random() * Math.PI * 2;
    const speed = (2 + Math.random() * 3) * boost;
    bit.velocity.set(
      Math.cos(a) * speed,
      (1.5 + Math.random() * 2.5) * boost,
      Math.sin(a) * speed * 0.5,
    );
    bit.spin.set(Math.random() * 12, Math.random() * 12, Math.random() * 12);
    if (shape === 'spring') bit.spin.multiplyScalar(2);
    bit.size = size;
    bit.material.color.setHex(color);
    bit.material.opacity = 1;
    bit.mesh.scale.setScalar(size);
  };

  return {
    object,
    offset,
    hit(at, cls, species, color) {
      const colors = species === 'robot' ? ROBOT_BIT_COLORS[cls] : [color, 0xffffff];
      for (let n = 0; n < HIT_BITS[cls]; n++) {
        // A robot's bits are cubes; 2 in 6 are small, fast springs. A monster's are puffs.
        const spring = species === 'robot' && n % 3 === 2;
        const shape: Shape = species === 'monster' ? 'puff' : spring ? 'spring' : 'cube';
        launch(shape, at, colors[n % colors.length], spring ? 2.2 : 1, BIT_LIFE);
      }
    },
    pop(at, species, color) {
      for (let n = 0; n < POP_BITS; n++) {
        if (species === 'robot') {
          if (n < 4) launch('cube', at, 0x9aa3b0, 1.8, 0.8, 1.1);
          else if (n < 7) launch('cube', at, 0xffc928, 1.8, 0.8, 1.1);
          else if (n < 10) launch('spring', at, n % 2 ? 0xc9ced6 : 0xffc928, 2.2, 0.9, 1.1);
          else launch('confetti', at, CONFETTI[n % CONFETTI.length], 2.0, 0.9, 1.1);
        } else if (n < 8) {
          launch('star', at, n % 2 ? 0xffe066 : 0xffffff, 1.8, 0.8, 1.1);
        } else launch('puff', at, n % 2 ? color : 0xffffff, 1.9, 0.8, 1.1);
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
        if (bit.age >= bit.life) {
          bit.active = false;
          bit.mesh.visible = false;
          continue;
        }
        bit.velocity.y -= GRAVITY * delta;
        bit.mesh.position.addScaledVector(bit.velocity, delta);
        bit.mesh.rotation.x += bit.spin.x * delta;
        bit.mesh.rotation.y += bit.spin.y * delta;
        const k = 1 - bit.age / bit.life;
        bit.material.opacity = Math.min(1, k * 2);
        bit.mesh.scale.setScalar(bit.size * (0.4 + 0.6 * k));
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
      for (const geometry of Object.values(shapes)) geometry.dispose();
      for (const bit of bits) bit.material.dispose();
    },
  };
}

export interface BonkStars {
  object: Object3D;
  /** The stars circle for `seconds` (Infinity: until `hide`). */
  show(seconds: number): void;
  hide(): void;
  update(delta: number): void;
}

/** Four small yellow stars circling above a head (put `object` on the head joint). */
export function createBonkStars(): BonkStars {
  const object = new Group();
  object.position.y = 0.36;
  object.visible = false;
  const geometry = new OctahedronGeometry(0.09, 0);
  const material = new MeshBasicMaterial({ color: 0xffe066 });
  const stars = Array.from({ length: 4 }, () => {
    const star = new Mesh(geometry, material);
    object.add(star);
    return star;
  });
  let left = 0;
  let clock = 0;
  return {
    object,
    show(seconds) {
      left = seconds;
      object.visible = seconds > 0;
    },
    hide() {
      left = 0;
      object.visible = false;
    },
    update(delta) {
      if (left <= 0) return;
      left -= delta;
      clock += delta;
      if (left <= 0) object.visible = false;
      stars.forEach((star, i) => {
        const a = clock * 6 + (i / 4) * Math.PI * 2;
        star.position.set(Math.cos(a) * 0.3, Math.sin(a * 2) * 0.02, Math.sin(a) * 0.3);
        star.rotation.y = a * 2;
      });
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
