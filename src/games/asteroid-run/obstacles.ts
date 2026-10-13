import {
  AdditiveBlending,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  OctahedronGeometry,
  SphereGeometry,
} from 'three';
import { PAST_Z, SPAWN_Z } from './layout';
import { rockGeometry } from './rocks';

const HAZARD_POOL = 9;
const CRYSTAL_POOL = 3;
/** Between these depths, things that have passed the ship shrink to nothing. */
const FADE_START = 0.5;
const FADE_END = 4;

/** How close a hazard or crystal has to get, edge to edge, to touch the ship. */
export const SHIP_RADIUS = 0.55;
export const CRYSTAL_RADIUS = 0.75;

export interface Hazard {
  object: Group;
  active: boolean;
  radius: number;
  spinX: number;
  spinY: number;
}

export interface Crystal {
  object: Group;
  active: boolean;
  phase: number;
}

export interface Obstacles {
  hazards: Hazard[];
  crystals: Crystal[];
  /** A small rock appears far ahead at (x, y). Returns it, or null when all are in use. */
  spawnHazard(x: number, y: number): Hazard | null;
  spawnCrystal(x: number, y: number): Crystal | null;
  /** Takes a hazard or crystal out of play. */
  retire(item: Hazard | Crystal): void;
  /** Takes everything out of play. */
  clear(): void;
  /** Streams everything towards the camera, `speed` units per second. */
  update(delta: number, speed: number, elapsed: number): void;
}

/**
 * Things that have flown past the ship shrink away before they reach the camera, instead of
 * swelling up to fill the screen.
 */
function passingScale(z: number): number {
  return Math.min(Math.max((FADE_END - z) / (FADE_END - FADE_START), 0.001), 1);
}

/** Small hazard rocks to dodge and glowing crystals to collect, pooled so nothing is allocated. */
export function createObstacles(): Obstacles {
  const rockShapes = [21, 22, 23].map((seed) =>
    rockGeometry({ radius: 1, detail: 1, roughness: 0.3, seed, stretch: [1, 0.85, 1.1] }),
  );
  const rockMaterial = new MeshLambertMaterial({
    color: 0xb98a62,
    emissive: 0x4a2410,
    flatShading: true,
  });
  const warning = new MeshBasicMaterial({
    color: 0xff5a3c,
    transparent: true,
    opacity: 0.16,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const halo = new SphereGeometry(1.35, 12, 8);

  const hazards: Hazard[] = Array.from({ length: HAZARD_POOL }, (_, i) => {
    const object = new Group();
    object.add(new Mesh(rockShapes[i % rockShapes.length], rockMaterial));
    object.add(new Mesh(halo, warning));
    object.visible = false;
    return { object, active: false, radius: 0.6, spinX: 0, spinY: 0 };
  });

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

  const retire = (item: Hazard | Crystal) => {
    item.active = false;
    item.object.visible = false;
  };

  return {
    hazards,
    crystals,
    spawnHazard(x, y) {
      const hazard = hazards.find((h) => !h.active);
      if (!hazard) return null;
      hazard.active = true;
      hazard.radius = 0.5 + Math.random() * 0.3;
      hazard.object.scale.setScalar(hazard.radius);
      hazard.object.position.set(x, y, SPAWN_Z);
      hazard.object.rotation.set(Math.random() * 6, Math.random() * 6, 0);
      hazard.spinX = (Math.random() - 0.5) * 3;
      hazard.spinY = (Math.random() - 0.5) * 3;
      hazard.object.visible = true;
      return hazard;
    },
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
      hazards.forEach(retire);
      crystals.forEach(retire);
    },
    update(delta, speed, elapsed) {
      for (const hazard of hazards) {
        if (!hazard.active) continue;
        const o = hazard.object;
        o.position.z += speed * delta;
        o.rotation.x += hazard.spinX * delta;
        o.rotation.y += hazard.spinY * delta;
        o.scale.setScalar(hazard.radius * passingScale(o.position.z));
        if (o.position.z > PAST_Z) retire(hazard);
      }
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
