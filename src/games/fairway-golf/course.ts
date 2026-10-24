/** The nine holes and what is under a point of the course. Pure: no DOM, no three.js. */

export type Surface = 'fairway' | 'rough' | 'sand' | 'green' | 'water' | 'tree';

export interface Ellipse {
  x: number;
  z: number;
  rx: number;
  rz: number;
}

/**
 * World units are yards. The tee is at (0, 0); x is across (right positive) and z is down the
 * hole (positive towards the pin).
 */
export interface Hole {
  par: 3 | 4 | 5;
  /** Tee to pin along z, yards. */
  length: number;
  /** Fairway centre line: x(z) = bend * sin(PI * z / length). */
  bend: number;
  /** z = length, x = 0 (the bend is 0 at the pin). */
  pin: { x: number; z: number };
  /** Yards of sideways drift per 100 yd of carry; + is toward +x. */
  wind: number;
  /** Yards of sideways break per 10 yd of putt; + is toward +x. */
  slope: number;
  hazards: { kind: 'sand' | 'water'; at: Ellipse }[];
  /** Trees (M2); the M1 holes have none. */
  trees: { x: number; z: number; r: number }[];
}

/** Fairway half width, yards. */
export const FAIRWAY_HALF = 18;
/** Green radius around the pin, yards. */
export const GREEN_R = 16;
/** Beyond this |x - centre| is the rough boundary wall (a ball is clamped to it). */
export const ROUGH_HALF = 60;

const hole = (
  par: 3 | 4 | 5,
  length: number,
  bend: number,
  wind: number,
  slope: number,
  hazards: Hole['hazards'],
): Hole => ({ par, length, bend, pin: { x: 0, z: length }, wind, slope, hazards, trees: [] });

const sand = (x: number, z: number, rx: number, rz: number) => ({
  kind: 'sand' as const,
  at: { x, z, rx, rz },
});
const water = (x: number, z: number, rx: number, rz: number) => ({
  kind: 'water' as const,
  at: { x, z, rx, rz },
});

export const HOLES: readonly Hole[] = [
  hole(4, 340, 0, 0, 0, []),
  hole(3, 140, 0, 2, 0.3, [sand(-10, 128, 9, 7)]),
  hole(4, 360, 14, -2, 0, [sand(20, 230, 10, 14)]),
  hole(5, 470, -12, 3, -0.3, [water(12, 340, 16, 12)]),
  hole(4, 330, 0, 4, 0.4, [water(-14, 200, 10, 30)]),
  hole(3, 165, 0, -3, -0.4, [water(0, 140, 22, 10)]),
  hole(4, 380, -16, 0, 0.3, [sand(-24, 250, 8, 16), sand(8, 352, 9, 8)]),
  hole(5, 490, 10, -3, 0, [sand(14, 250, 10, 14), water(-6, 400, 14, 10)]),
  hole(4, 350, 0, 2, -0.3, [sand(0, 320, 12, 8)]),
];

/** The x of the fairway's centre line at distance z down the hole. */
export function centreX(h: Hole, z: number): number {
  const along = Math.min(Math.max(z, 0), h.length);
  return h.bend * Math.sin((Math.PI * along) / h.length);
}

export function inEllipse(e: Ellipse, x: number, z: number): boolean {
  return ((x - e.x) / e.rx) ** 2 + ((z - e.z) / e.rz) ** 2 <= 1;
}

/** What a ball lying at (x, z) is on. Water wins over sand, sand over the green. */
export function surfaceAt(h: Hole, x: number, z: number): Surface {
  if (h.hazards.some((hz) => hz.kind === 'water' && inEllipse(hz.at, x, z))) return 'water';
  if (h.hazards.some((hz) => hz.kind === 'sand' && inEllipse(hz.at, x, z))) return 'sand';
  if (Math.hypot(x - h.pin.x, z - h.pin.z) <= GREEN_R) return 'green';
  if (Math.abs(x - centreX(h, z)) <= FAIRWAY_HALF && z >= 0 && z <= h.length) return 'fairway';
  return 'rough';
}
