/** The court's numbers and a little vector maths. Pure: no three.js and no DOM. */

export interface Vec {
  x: number;
  y: number;
  z: number;
}

/**
 * Units are metres, y is up. The baseline is at z = 0 and the court runs towards +z. x runs from
 * left to right as seen from half court looking at the hoop.
 */
export const RIM: Vec = { x: 0, y: 3.05, z: 1.575 }; // rim centre
export const RIM_GROUND: Vec = { x: 0, y: 0, z: 1.575 };
export const RIM_RADIUS = 0.23;
export const BOARD = { x: 0.9, yBottom: 2.9, yTop: 3.95, z: 1.2 }; // half-width, plane z
/** Drawn a little big (real 0.12) so it reads on a phone. */
export const BALL_RADIUS = 0.16;
export const THREE_RADIUS = 6.75; // around RIM_GROUND; straight corners at x = +-6.6
export const FT_SPOT: Vec = { x: 0, y: 0, z: 6.0 };
/** Where the other player stands for a free throw. */
export const FT_DEFENDER: Vec = { x: -2.6, y: 0, z: 3.2 };

/** The fence the ball may never leave. */
export const FENCE = { x: 9.5, zMin: -4.6, zMax: 17.5 };

/** Degrees from straight out (+z) round RIM_GROUND. */
export const SPOT_ANGLES = [-30, 0, 30];
/** The player with the ball (outside the arc, so a 3 makes sense). */
export const OFFENSE_R = 7.6;
/** The defender, on the same line, facing the ball. */
export const GUARD_R = 6.0;

/** RIM_GROUND + r * (sin a, 0, cos a). */
export function spotPos(angleDeg: number, radius: number): Vec {
  const a = (angleDeg * Math.PI) / 180;
  return {
    x: RIM_GROUND.x + radius * Math.sin(a),
    y: 0,
    z: RIM_GROUND.z + radius * Math.cos(a),
  };
}

export const vec = (x = 0, y = 0, z = 0): Vec => ({ x, y, z });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const lerpVec = (a: Vec, b: Vec, t: number): Vec => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});
export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const distXZ = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);

/** The horizontal unit vector from `from` to `to` (or +z if they coincide). */
export function dirXZ(from: Vec, to: Vec): Vec {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const d = Math.hypot(dx, dz);
  return d < 1e-9 ? { x: 0, y: 0, z: 1 } : { x: dx / d, y: 0, z: dz / d };
}

/** `u` turned 90 degrees to the right, as seen looking along -u (towards the hoop). */
export const rightOf = (u: Vec): Vec => ({ x: u.z, y: 0, z: -u.x });

export const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);
