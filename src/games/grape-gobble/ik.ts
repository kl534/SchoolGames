export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

const MIN_REACH = 0.05;
const REACH_SLACK = 0.01;

/**
 * Elbow and hand for a two-bone arm. The hand goes to `target`, clamped to what the arm can reach
 * (distance between 0.05 and upper + fore - 0.01 from the shoulder). The elbow bends towards `pole`.
 */
export function solveArm(
  shoulder: Vec3,
  target: Vec3,
  upper: number,
  fore: number,
  pole: Vec3,
): { elbow: Vec3; hand: Vec3 } {
  let dx = target.x - shoulder.x;
  let dy = target.y - shoulder.y;
  let dz = target.z - shoulder.z;
  const length = Math.hypot(dx, dy, dz);
  if (length > 1e-9) {
    dx /= length;
    dy /= length;
    dz /= length;
  } else {
    dx = 0;
    dy = 0;
    dz = 1;
  }
  const d = Math.min(Math.max(length, MIN_REACH), upper + fore - REACH_SLACK);
  const hand = vec3(shoulder.x + dx * d, shoulder.y + dy * d, shoulder.z + dz * d);

  const along = (upper * upper - fore * fore + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(upper * upper - along * along, 0));

  // The pole with its component along the arm removed gives the direction the elbow bends.
  const dot = pole.x * dx + pole.y * dy + pole.z * dz;
  let px = pole.x - dx * dot;
  let py = pole.y - dy * dot;
  let pz = pole.z - dz * dot;
  let plen = Math.hypot(px, py, pz);
  if (plen < 1e-9) {
    // The pole points along the arm: bend downwards, or sideways if the arm points straight down.
    const fallback = Math.abs(dy) < 0.99 ? vec3(0, -1, 0) : vec3(1, 0, 0);
    const fdot = fallback.x * dx + fallback.y * dy + fallback.z * dz;
    px = fallback.x - dx * fdot;
    py = fallback.y - dy * fdot;
    pz = fallback.z - dz * fdot;
    plen = Math.hypot(px, py, pz);
  }
  px /= plen;
  py /= plen;
  pz /= plen;
  const elbow = vec3(
    shoulder.x + dx * along + px * h,
    shoulder.y + dy * along + py * h,
    shoulder.z + dz * along + pz * h,
  );
  return { elbow, hand };
}
