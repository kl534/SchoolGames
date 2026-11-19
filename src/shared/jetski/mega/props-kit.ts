/**
 * What the Mega course props are built from: the shape every element's props share and a helper for
 * solid striped profiles (the island, the ferry, the pier). Three.js only; no game logic.
 */
import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  Float32BufferAttribute,
  Vector3,
  type Group,
  type Material,
  type Mesh,
  type Object3D,
} from 'three';
import { Kit, lerp, ribbon, ribbonMaterial, smooth } from '../kit';

/** One cross-section of a `loft`: its centre, half width and half height. */
export interface LoftRing {
  at: readonly [number, number, number];
  rx: number;
  ry: number;
}

/**
 * A smooth closed tube through `rings` (a body, a neck, a tail, a snout), painted per vertex:
 * `paint(u, up)` gives the colour at `u` 0..1 along the tube and `up` -1 (underneath) to 1 (on
 * top). The cross-section is a superellipse: `square` 2 is an ellipse, higher is boxier. Use it
 * with a vertex-colour material (`ribbonMaterial`).
 */
export function loft(
  kit: Kit,
  parent: Object3D,
  material: Material,
  rings: readonly LoftRing[],
  paint: (u: number, up: number) => number,
  { steps = 36, sides = 20, square = 2 } = {},
): Mesh {
  const curve = new CatmullRomCurve3(
    rings.map((r) => new Vector3(...r.at)),
    false,
    'centripetal',
  );
  const n = rings.length - 1;
  const size = (u: number): [number, number] => {
    const f = u * n;
    const i = Math.min(Math.floor(f), n - 1);
    const k = smooth(f - i);
    return [lerp(rings[i].rx, rings[i + 1].rx, k), lerp(rings[i].ry, rings[i + 1].ry, k)];
  };
  const positions: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  const colour = new Color();
  const push = (p: Vector3, hex: number) => {
    positions.push(p.x, p.y, p.z);
    colour.setHex(hex);
    colors.push(colour.r, colour.g, colour.b);
  };
  const up = new Vector3(0, 1, 0);
  const side = new Vector3();
  const normal = new Vector3();
  const p = new Vector3();
  const e = 2 / square;
  const shape = (c: number) => Math.sign(c) * Math.abs(c) ** e;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const centre = curve.getPoint(u);
    const tangent = curve.getTangent(u);
    side.crossVectors(tangent, up);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    normal.crossVectors(side, tangent).normalize();
    const [rx, ry] = size(u);
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      const cy = shape(Math.sin(a));
      p.copy(centre)
        .addScaledVector(side, rx * shape(Math.cos(a)))
        .addScaledVector(normal, ry * cy);
      push(p, paint(u, cy));
    }
  }
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j;
      const b = i * sides + ((j + 1) % sides);
      index.push(a, a + sides, b, b, a + sides, b + sides);
    }
  }
  // Caps: a fan to the centre of each end ring.
  for (const [u, ring, flip] of [
    [0, 0, true],
    [1, steps, false],
  ] as const) {
    const c = positions.length / 3;
    push(curve.getPoint(u), paint(u, 0));
    for (let j = 0; j < sides; j++) {
      const a = ring * sides + j;
      const b = ring * sides + ((j + 1) % sides);
      if (flip) index.push(c, b, a);
      else index.push(c, a, b);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return kit.mesh(geometry, material, parent);
}

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
  const geometry = ribbon(surface, from, to, step, bottom, halfWidth, colorA, colorB, sCentre);
  geometry.rotateY(Math.PI / 2);
  return kit.mesh(geometry, ribbonMaterial(kit), parent);
}
