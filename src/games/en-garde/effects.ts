import {
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
  type Object3D,
} from 'three';

const CONFETTI_COLORS = [0xff4d6d, 0xffd23f, 0x4cc9f0, 0x7ae582, 0xb185ff];
const CONFETTI_BITS = 80;
/** Seconds the confetti falls. */
export const CONFETTI_SECONDS = 2.5;
const CREAM_BLOBS = 24;
const CREAM_COLORS = [0xfff3f6, 0xffb6c9, 0xffe3ec];
const CREAM_LIFE = 1.1;
const GRAVITY = 9;

interface Bit {
  mesh: Mesh;
  material: MeshBasicMaterial;
  velocity: Vector3;
  spin: Vector3;
  phase: number;
  age: number;
  life: number;
  active: boolean;
}

export interface Effects {
  object: Object3D;
  /** 80 bits of paper in 5 colours fall from above the cake for 2.5 s. */
  confetti(): void;
  /** 24 blobs of cream fly up from `at`. */
  cream(at: { x: number; y: number; z: number }): void;
  update(delta: number): void;
  clear(): void;
}

/** Confetti and cream, as two small pools of bits. */
export function createEffects(): Effects {
  const object = new Group();

  const paper = new PlaneGeometry(0.1, 0.06);
  const blob = new SphereGeometry(1, 8, 6);

  /** Bits with a material each, so each can fade on its own. */
  const makeBits = (
    count: number,
    geometry: PlaneGeometry | SphereGeometry,
    colors: number[],
  ): Bit[] =>
    Array.from({ length: count }, (_, i): Bit => {
      const material = new MeshBasicMaterial({
        color: colors[i % colors.length],
        side: DoubleSide,
        transparent: true,
      });
      const mesh = new Mesh(geometry, material);
      mesh.visible = false;
      object.add(mesh);
      return {
        mesh,
        material,
        velocity: new Vector3(),
        spin: new Vector3(),
        phase: 0,
        age: 0,
        life: 1,
        active: false,
      };
    });
  const confetti = makeBits(CONFETTI_BITS, paper, CONFETTI_COLORS);
  const cream = makeBits(CREAM_BLOBS, blob, CREAM_COLORS);

  return {
    object,
    confetti() {
      for (const bit of confetti) {
        bit.active = true;
        bit.age = 0;
        bit.life = CONFETTI_SECONDS * (0.85 + Math.random() * 0.15);
        bit.phase = Math.random() * Math.PI * 2;
        bit.mesh.visible = true;
        bit.mesh.position.set(
          (Math.random() - 0.5) * 5.5,
          2.6 + Math.random() * 1.6,
          -2.4 + Math.random() * 3.2,
        );
        bit.velocity.set((Math.random() - 0.5) * 0.8, -1.1 - Math.random() * 0.9, 0);
        bit.spin.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
        bit.mesh.scale.setScalar(0.8 + Math.random() * 0.8);
        bit.material.opacity = 1;
      }
    },
    cream(at) {
      for (const bit of cream) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.2 + Math.random() * 1.6;
        bit.active = true;
        bit.age = 0;
        bit.life = CREAM_LIFE * (0.7 + Math.random() * 0.3);
        bit.mesh.visible = true;
        bit.mesh.position.set(at.x, at.y, at.z);
        bit.velocity.set(
          Math.cos(angle) * speed,
          2 + Math.random() * 2.2,
          Math.sin(angle) * speed * 0.7 + 1.2,
        );
        bit.mesh.scale.setScalar(0.04 + Math.random() * 0.05);
        bit.material.opacity = 1;
      }
    },
    update(delta) {
      for (const bit of confetti) {
        if (!bit.active) continue;
        bit.age += delta;
        if (bit.age >= bit.life) {
          bit.active = false;
          bit.mesh.visible = false;
          continue;
        }
        bit.mesh.position.x += (bit.velocity.x + Math.sin(bit.age * 4 + bit.phase) * 0.5) * delta;
        bit.mesh.position.y += bit.velocity.y * delta;
        bit.mesh.rotation.x += bit.spin.x * delta;
        bit.mesh.rotation.y += bit.spin.y * delta;
        bit.mesh.rotation.z += bit.spin.z * delta;
        const k = bit.age / bit.life;
        bit.material.opacity = k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
      }
      for (const bit of cream) {
        if (!bit.active) continue;
        bit.age += delta;
        if (bit.age >= bit.life) {
          bit.active = false;
          bit.mesh.visible = false;
          continue;
        }
        bit.velocity.y -= GRAVITY * delta;
        bit.mesh.position.addScaledVector(bit.velocity, delta);
        const k = bit.age / bit.life;
        bit.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      }
    },
    clear() {
      for (const bit of [...confetti, ...cream]) {
        bit.active = false;
        bit.mesh.visible = false;
      }
    },
  };
}

export interface DizzyStars {
  object: Object3D;
  setVisible(on: boolean): void;
  update(elapsed: number): void;
}

/** Three small stars circling above a head. Put `object` on the head joint. */
export function createDizzyStars(): DizzyStars {
  const object = new Group();
  object.position.y = 0.3;
  object.visible = false;
  const geometry = new OctahedronGeometry(0.04, 0);
  const material = new MeshBasicMaterial({ color: 0xffe066 });
  const stars = Array.from({ length: 3 }, () => {
    const star = new Mesh(geometry, material);
    object.add(star);
    return star;
  });
  return {
    object,
    setVisible: (on) => (object.visible = on),
    update(elapsed) {
      stars.forEach((star, i) => {
        const a = elapsed * 5 + (i / 3) * Math.PI * 2;
        star.position.set(Math.cos(a) * 0.2, Math.sin(a * 2) * 0.01, Math.sin(a) * 0.2);
        star.rotation.y = a * 2;
      });
    },
  };
}

export interface Words {
  /**
   * Pops a comic word at a screen spot: grows 0 to 1.2 to 1 in 0.15 s, gone by 0.9 s. With `hold`
   * (a frozen dev shot) it stays.
   */
  pop(text: string, at: { x: number; y: number }, hold?: boolean): void;
  clear(): void;
}

/** The comic words (POKE!, BONK!) as little DOM elements over the scene. */
export function createWords(parent: HTMLElement = document.body): Words {
  const live = new Set<HTMLElement>();
  const remove = (node: HTMLElement) => {
    live.delete(node);
    node.remove();
  };
  return {
    pop(text, at, hold = false) {
      const node = document.createElement('div');
      node.className = hold ? 'eg-pow hold' : 'eg-pow';
      node.textContent = text;
      node.style.left = `${at.x}px`;
      node.style.top = `${at.y}px`;
      parent.appendChild(node);
      live.add(node);
      if (hold) return;
      node.addEventListener('animationend', (e) => {
        if (e.animationName === 'eg-pow') remove(node);
      });
      setTimeout(() => remove(node), 1200);
    },
    clear() {
      live.forEach((node) => node.remove());
      live.clear();
    },
  };
}
