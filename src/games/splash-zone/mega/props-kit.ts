/**
 * What the Mega course props are built from: the shape every element's props share and a helper for
 * solid striped profiles (the island, the ferry, the pier). Three.js only; no game logic.
 */
import type { BufferGeometry, Group, Mesh } from 'three';
import { Kit, ribbon, ribbonMaterial } from '../kit';

/** One element's props, in element-local coordinates (origin at its entry line on the water). */
export interface MegaBuilt {
  group: Group;
  /** Poses the props for time `localT` of the element's clear or fail. */
  update(outcome: 'clear' | 'fail', localT: number): void;
  /** Idle motion: swaying palms, bobbing boats. */
  ambient(time: number): void;
  /** Puts every prop back as it was before the stunt. */
  reset(): void;
}

/**
 * A solid ribbon following the height profile `surface(d)` from `from` to `to` along the course,
 * `halfWidth` either side of side position `sCentre`, striped in two colours, hanging down to
 * `bottom`. The ribbon is built along x and turned so x runs forward (-z).
 */
export function profile(
  kit: Kit,
  parent: Group,
  surface: (d: number) => number,
  from: number,
  to: number,
  step: number,
  bottom: number | ((d: number) => number),
  halfWidth: number,
  colorA: number,
  colorB: number,
  sCentre = 0,
): Mesh {
  const geometry: BufferGeometry = ribbon(
    surface,
    from,
    to,
    step,
    bottom,
    halfWidth,
    colorA,
    colorB,
    sCentre,
  );
  geometry.rotateY(Math.PI / 2);
  return kit.mesh(geometry, ribbonMaterial(kit), parent);
}
