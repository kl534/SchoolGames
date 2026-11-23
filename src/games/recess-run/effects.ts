/** The little effects of a heat: the stars circling a head after a face-plant and the finish tape. */
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
} from 'three';

export interface Stars {
  object: Group;
  /** Circles for `seconds` (a very long time holds them for a frozen shot). */
  show(seconds: number): void;
  hide(): void;
  update(delta: number): void;
}

/** A ring of 5 yellow stars over a head (put `object` on the person's head joint). */
export function createStars(): Stars {
  const object = new Group();
  object.position.y = 0.36;
  object.visible = false;
  const geometry = new OctahedronGeometry(0.09, 0);
  const material = new MeshBasicMaterial({ color: 0xffe066 });
  const stars = Array.from({ length: 5 }, () => {
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
        const a = clock * 6 + (i / stars.length) * Math.PI * 2;
        star.position.set(Math.cos(a) * 0.3, Math.sin(a * 2) * 0.03, Math.sin(a) * 0.3);
        star.rotation.y = a * 2;
      });
    },
  };
}

export interface Tape {
  object: Group;
  /** The first finisher breaks it: the two halves fall. */
  snap(): void;
  /** Whole again, for the next heat. */
  reset(): void;
  readonly broken: boolean;
  update(delta: number): void;
}

/** A red tape across the track from `-halfWidth` to `+halfWidth`, at height `y`, in two halves. */
export function createTape(halfWidth: number, y: number): Tape {
  const object = new Group();
  const material = new MeshStandardMaterial({ color: 0xe11d2e, roughness: 0.5 });
  const geometry = new BoxGeometry(halfWidth, 0.07, 0.015);
  const halves = [-1, 1].map((side) => {
    const pivot = new Group();
    pivot.position.set(side * halfWidth, y, 0);
    const bar = new Mesh(geometry, material);
    bar.position.x = -side * (halfWidth / 2);
    pivot.add(bar);
    object.add(pivot);
    return { pivot, side, fall: 0 };
  });
  let broken = false;
  return {
    object,
    get broken() {
      return broken;
    },
    snap() {
      broken = true;
    },
    reset() {
      broken = false;
      for (const h of halves) {
        h.fall = 0;
        h.pivot.rotation.z = 0;
        h.pivot.position.y = y;
      }
    },
    update(delta) {
      if (!broken) return;
      for (const h of halves) {
        h.fall = Math.min(1, h.fall + delta / 0.6);
        // Each half swings down about its post and drops to the ground.
        h.pivot.rotation.z = h.side * 1.4 * h.fall;
        h.pivot.position.y = y - (y - 0.05) * h.fall * h.fall;
      }
    },
  };
}
