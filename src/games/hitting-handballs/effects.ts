import { Group, Mesh, MeshBasicMaterial, OctahedronGeometry, type Object3D } from 'three';

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

export interface Shake {
  /** Starts a shake of `amplitude` metres lasting `seconds`. */
  start(seconds: number, amplitude: number): void;
  /** Advances by `delta` and gives the camera offset for now. */
  update(delta: number): { x: number; y: number };
  clear(): void;
}

/** A short camera shake that dies away. */
export function createShake(): Shake {
  let left = 0;
  let total = 1;
  let amplitude = 0;
  let age = 0;
  return {
    start(seconds, amp) {
      left = total = seconds;
      amplitude = amp;
      age = 0;
    },
    update(delta) {
      if (left <= 0) return { x: 0, y: 0 };
      left = Math.max(0, left - delta);
      age += delta;
      const fade = left / total;
      return {
        x: Math.sin(age * 95) * amplitude * fade,
        y: Math.cos(age * 83) * amplitude * fade,
      };
    },
    clear() {
      left = 0;
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

/** The comic words (SMASH!, BONK!) as little DOM elements over the scene. */
export function createWords(parent: HTMLElement = document.body): Words {
  const live = new Set<HTMLElement>();
  const remove = (node: HTMLElement) => {
    live.delete(node);
    node.remove();
  };
  return {
    pop(text, at, hold = false) {
      const node = document.createElement('div');
      node.className = hold ? 'hb-pow hold' : 'hb-pow';
      node.textContent = text;
      node.style.left = `${at.x}px`;
      node.style.top = `${at.y}px`;
      parent.appendChild(node);
      live.add(node);
      if (hold) return;
      node.addEventListener('animationend', (e) => {
        if (e.animationName === 'hb-pow') remove(node);
      });
      setTimeout(() => remove(node), 1200);
    },
    clear() {
      live.forEach((node) => node.remove());
      live.clear();
    },
  };
}
