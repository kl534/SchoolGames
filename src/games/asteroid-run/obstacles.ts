import {
  AdditiveBlending,
  Group,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  SphereGeometry,
} from 'three';
import { PAST_Z, SPAWN_Z } from './layout';

const CRYSTAL_POOL = 3;
/** Between these depths, things that have passed the ship shrink to nothing. */
const FADE_START = 0.5;
const FADE_END = 4;

/** How close the ship and a crystal have to get, edge to edge, to touch. */
export const SHIP_RADIUS = 0.55;
export const CRYSTAL_RADIUS = 0.75;

export interface Crystal {
  object: Group;
  active: boolean;
  phase: number;
}

export interface Obstacles {
  crystals: Crystal[];
  /** A crystal appears far ahead at (x, y). Returns it, or null when all are in use. */
  spawnCrystal(x: number, y: number): Crystal | null;
  /** Takes a crystal out of play. */
  retire(item: Crystal): void;
  /** Takes every crystal out of play. */
  clear(): void;
  /** Streams the crystals towards the camera, `speed` units per second. */
  update(delta: number, speed: number, elapsed: number): void;
}

/**
 * Crystals that have flown past the ship shrink away before they reach the camera, instead of
 * swelling up to fill the screen.
 */
function passingScale(z: number): number {
  return Math.min(Math.max((FADE_END - z) / (FADE_END - FADE_START), 0.001), 1);
}

/** Glowing crystals to collect, pooled so nothing is allocated. */
export function createObstacles(): Obstacles {
  const crystalCore = new OctahedronGeometry(0.42);
  const crystalShell = new OctahedronGeometry(0.6);
  const crystalGlow = new SphereGeometry(1, 20, 14);
  const crystals: Crystal[] = Array.from({ length: CRYSTAL_POOL }, (_, i) => {
    const hue = i % 2 ? 0xff7ad9 : 0x6ef3ff;
    const object = new Group();
    const core = new Mesh(crystalCore, new MeshBasicMaterial({ color: hue, fog: false }));
    core.scale.set(1, 1.5, 1);
    const shell = new Mesh(
      crystalShell,
      new MeshBasicMaterial({
        color: hue,
        transparent: true,
        opacity: 0.35,
        blending: AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    shell.scale.set(1, 1.5, 1);
    const glow = new Mesh(
      crystalGlow,
      new MeshBasicMaterial({
        color: hue,
        transparent: true,
        opacity: 0.14,
        blending: AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    glow.scale.setScalar(0.85);
    object.add(core, shell, glow);
    object.visible = false;
    return { object, active: false, phase: 0 };
  });

  const retire = (item: Crystal) => {
    item.active = false;
    item.object.visible = false;
  };

  return {
    crystals,
    spawnCrystal(x, y) {
      const crystal = crystals.find((c) => !c.active);
      if (!crystal) return null;
      crystal.active = true;
      crystal.phase = Math.random() * 6;
      crystal.object.position.set(x, y, SPAWN_Z);
      crystal.object.visible = true;
      return crystal;
    },
    retire,
    clear() {
      crystals.forEach(retire);
    },
    update(delta, speed, elapsed) {
      for (const crystal of crystals) {
        if (!crystal.active) continue;
        const o = crystal.object;
        o.position.z += speed * delta;
        o.rotation.y = elapsed * 2.6 + crystal.phase;
        o.scale.setScalar(
          (1 + Math.sin(elapsed * 5 + crystal.phase) * 0.08) * passingScale(o.position.z),
        );
        if (o.position.z > PAST_Z) retire(crystal);
      }
    },
  };
}
