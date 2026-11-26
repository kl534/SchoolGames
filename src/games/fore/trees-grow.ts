/**
 * Seeded tree shapes: trunk and branch segments plus leaf cards, in the unit space `TREE_BOUNDS`
 * describes (yards, base at the origin). Pure: no three.js, no DOM, no `Math.random`.
 */
import { seededRandom, type Random } from '../../shared/random';
import type { Species } from './scenery';

export type V3 = readonly [number, number, number];

/** A trunk or branch: a tapered cylinder from `from` (radius `r0`) to `to` (radius `r1`). */
export interface Segment {
  from: V3;
  to: V3;
  r0: number;
  r1: number;
}
/** One leaf (or needle) card: a square of `size` yards at `at`, facing `normal`, turned by `spin`. */
export interface Card {
  at: V3;
  normal: V3;
  size: number;
  spin: number;
  /** Which of the four tiles of the leaf picture it shows. */
  tile: 0 | 1 | 2 | 3;
}
export interface TreeShape {
  segments: Segment[];
  cards: Card[];
}

/** The size of a species' tree at scale 1: its height and the widest reach of its crown. */
export const TREE_BOUNDS: Record<Species, { height: number; radius: number }> = {
  oak: { height: 12, radius: 4.6 },
  pine: { height: 12, radius: 3.8 },
  birch: { height: 12, radius: 1.9 },
};

/** The card count the tiers are tuned for; fewer cards are drawn bigger. */
const REFERENCE_CARDS = 520;
const SPECIES_SEED: Record<Species, number> = { oak: 100, pine: 200, birch: 300 };

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const range = (rand: Random, a: number, b: number) => a + (b - a) * rand();

/** A unit direction `tilt` radians off vertical, turned `azimuth` round it. */
const direction = (tilt: number, azimuth: number): V3 => [
  Math.sin(tilt) * Math.cos(azimuth),
  Math.cos(tilt),
  Math.sin(tilt) * Math.sin(azimuth),
];

/** The two axes of a card's plane at spin 0 (`right`, `up`), for the normal `n`. */
export function cardBasis(n: V3): { right: V3; up: V3 } {
  const ref: V3 = Math.abs(n[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
  const right = norm(cross(ref, n));
  return { right, up: cross(n, right) };
}

/** The card's right and up axes after its spin. */
export function cardAxes(card: Card): { right: V3; up: V3 } {
  const { right, up } = cardBasis(card.normal);
  const c = Math.cos(card.spin);
  const s = Math.sin(card.spin);
  return {
    right: add(scale(right, c), scale(up, s)),
    up: add(scale(up, c), scale(right, -s)),
  };
}

/** The spin that turns a card's right axis towards `want` (a direction in or near its plane). */
const spinToward = (n: V3, want: V3): number => {
  const { right, up } = cardBasis(n);
  return Math.atan2(dot(want, up), dot(want, right));
};

/** Card size for `n` cards: the fewer there are, the bigger each is (to keep the crown full). */
const cardSize = (base: number, n: number, max = 2.2) =>
  Math.min(base * Math.min(Math.max((REFERENCE_CARDS / Math.max(n, 1)) ** 0.35, 0.9), 2), max);

/** A limb and its two forks (each fork two shorter limbs), kept inside `limit`. */
function limb(
  rand: Random,
  from: V3,
  dir: V3,
  length: number,
  r: number,
  forks: number,
  out: { segments: Segment[]; tips: V3[] },
  limit: (p: V3) => V3,
): void {
  const to = limit(add(from, scale(dir, length)));
  const taper = forks > 0 ? 0.7 : 0.35;
  out.segments.push({ from, to, r0: r, r1: r * taper });
  if (forks === 0) {
    out.tips.push(to);
    return;
  }
  const real = norm([to[0] - from[0], to[1] - from[1], to[2] - from[2]]);
  const side = norm(cross(real, [rand() - 0.5, 1, rand() - 0.5]));
  for (const sign of [-1, 1]) {
    const bend = range(rand, 0.45, 0.75);
    const child = norm(
      add(add(scale(real, 1 - bend * 0.5), scale(side, sign * bend)), [0, 0.35, 0]),
    );
    limb(rand, to, child, length * range(rand, 0.55, 0.7), r * taper, forks - 1, out, limit);
  }
}

/** A point on a sphere's surface, uniform. */
function onSphere(rand: Random): V3 {
  const y = rand() * 2 - 1;
  const a = rand() * Math.PI * 2;
  const s = Math.sqrt(1 - y * y);
  return [s * Math.cos(a), y, s * Math.sin(a)];
}

interface Crown {
  centre: V3;
  /** Semi-axes of the ellipsoid the cards live in. */
  axes: V3;
  card: number;
  /** The biggest card size (yards). */
  max?: number;
}

/**
 * Cards on the crown: `tips` of them near the branch ends, the rest on the ellipsoid's shell. Their
 * normals point out from the crown centre (rounded, soft lighting) with a little scatter.
 */
function crownCards(rand: Random, crown: Crown, tips: readonly V3[], n: number, tipShare: number) {
  const cards: Card[] = [];
  const size = cardSize(crown.card, n, crown.max ?? 2.2);
  const ax = Math.max(crown.axes[0] - size * 0.62, 0.3);
  const ay = Math.max(crown.axes[1] - size * 0.62, 0.3);
  const az = Math.max(crown.axes[2] - size * 0.62, 0.3);
  const [cx, cy, cz] = crown.centre;
  for (let i = 0; i < n; i++) {
    let at: V3;
    if (tips.length > 0 && rand() < tipShare) {
      const tip = tips[Math.floor(rand() * tips.length)];
      const j = onSphere(rand);
      const p = add(tip, scale(j, 0.7 * rand()));
      // Pull a point outside the (shrunk) ellipsoid back onto it.
      const q = Math.hypot((p[0] - cx) / ax, (p[1] - cy) / ay, (p[2] - cz) / az);
      at = q > 1 ? [cx + (p[0] - cx) / q, cy + (p[1] - cy) / q, cz + (p[2] - cz) / q] : p;
    } else {
      const d = onSphere(rand);
      const f = 0.45 + 0.55 * Math.sqrt(rand());
      at = [cx + d[0] * ax * f, cy + d[1] * ay * f, cz + d[2] * az * f];
    }
    const out = norm([
      (at[0] - cx) / (ax * ax),
      ((at[1] - cy) / (ay * ay)) * 0.6,
      (at[2] - cz) / (az * az),
    ]);
    // The card's plane faces any which way (edge-on cards at the rim would thin the crown); the
    // light still takes the crown-outward direction (see `lightNormal` in trees.ts).
    const normal = norm(add(out, scale(onSphere(rand), 1.1)));
    cards.push({
      at,
      normal,
      size: size * range(rand, 0.85, 1.15),
      spin: rand() * Math.PI * 2,
      tile: Math.floor(rand() * 4) as 0 | 1 | 2 | 3,
    });
  }
  return cards;
}

function growOak(rand: Random, n: number): TreeShape {
  const { height: H, radius: R } = TREE_BOUNDS.oak;
  const segments: Segment[] = [];
  const topY = H * range(rand, 0.3, 0.33);
  const lean = range(rand, 0, Math.PI * 2);
  const bow = range(rand, 0.1, 0.35);
  const trunk: V3[] = [0, 1, 2, 3].map((i) => {
    const t = i / 3;
    return [Math.cos(lean) * bow * t * t, topY * t, Math.sin(lean) * bow * t * t] as V3;
  });
  const radii = [0.44, 0.38, 0.33, 0.28];
  for (let i = 0; i < 3; i++) {
    segments.push({ from: trunk[i], to: trunk[i + 1], r0: radii[i], r1: radii[i + 1] });
  }
  const out = { segments, tips: [] as V3[] };
  const limit = (p: V3): V3 => {
    const reach = Math.hypot(p[0], p[2]);
    const k = reach > R * 0.78 ? (R * 0.78) / reach : 1;
    return [p[0] * k, Math.min(p[1], H * 0.8), p[2] * k];
  };
  const limbs = 4 + Math.floor(rand() * 3);
  const turn = rand() * Math.PI * 2;
  for (let i = 0; i < limbs; i++) {
    const a = turn + (i / limbs) * Math.PI * 2 + range(rand, -0.35, 0.35);
    const tilt = range(rand, 35, 70) * (Math.PI / 180);
    const start = trunk[3];
    limb(rand, start, direction(tilt, a), range(rand, 2.6, 3.6), 0.24, 2, out, limit);
  }
  const crown: Crown = { centre: [0, H * 0.645, 0], axes: [R, H * 0.355, R], card: 1.7, max: 2.3 };
  return { segments, cards: crownCards(rand, crown, out.tips, n, 0.25) };
}

function growBirch(rand: Random, n: number): TreeShape {
  const { height: H, radius: R } = TREE_BOUNDS.birch;
  const segments: Segment[] = [];
  const lean = range(rand, 0, Math.PI * 2);
  const bow = range(rand, 0.15, 0.4);
  const top = H * 0.86;
  const trunk: V3[] = [0, 1, 2, 3, 4].map((i) => {
    const t = i / 4;
    return [Math.cos(lean) * bow * t * t, top * t, Math.sin(lean) * bow * t * t] as V3;
  });
  const radii = [0.17, 0.14, 0.11, 0.08, 0.05];
  for (let i = 0; i < 4; i++) {
    segments.push({ from: trunk[i], to: trunk[i + 1], r0: radii[i], r1: radii[i + 1] });
  }
  const out = { segments, tips: [] as V3[] };
  const limit = (p: V3): V3 => {
    const reach = Math.hypot(p[0], p[2]);
    const k = reach > R * 0.8 ? (R * 0.8) / reach : 1;
    return [p[0] * k, Math.min(p[1], H * 0.97), p[2] * k];
  };
  const limbs = 7 + Math.floor(rand() * 3);
  for (let i = 0; i < limbs; i++) {
    const t = 0.3 + 0.7 * (i / limbs);
    const base = trunk[Math.min(Math.floor(t * 4), 3)];
    const start: V3 = [base[0], H * (0.36 + 0.46 * (i / limbs)), base[2]];
    const tilt = range(rand, 20, 42) * (Math.PI / 180);
    limb(
      rand,
      start,
      direction(tilt, rand() * Math.PI * 2),
      range(rand, 1.2, 2),
      0.07,
      1,
      out,
      limit,
    );
  }
  const crown: Crown = { centre: [0, H * 0.7, 0], axes: [R, H * 0.3, R], card: 1.5, max: 2 };
  return { segments, cards: crownCards(rand, crown, out.tips, n, 0.6) };
}

function growPine(rand: Random, n: number): TreeShape {
  const { height: H, radius: R } = TREE_BOUNDS.pine;
  const segments: Segment[] = [];
  const wobble = range(rand, 0, Math.PI * 2);
  const trunk: V3[] = [0, 1, 2, 3, 4].map((i) => {
    const t = i / 4;
    return [Math.cos(wobble) * 0.08 * t, H * 0.98 * t, Math.sin(wobble) * 0.08 * t] as V3;
  });
  const radii = [0.32, 0.22, 0.14, 0.08, 0.025];
  for (let i = 0; i < 4; i++) {
    segments.push({ from: trunk[i], to: trunk[i + 1], r0: radii[i], r1: radii[i + 1] });
  }
  // Whorls of drooping branches, shorter towards the top.
  const whorls = 11 + Math.floor(rand() * 4);
  interface Branch {
    from: V3;
    to: V3;
    azimuth: number;
    length: number;
  }
  const branches: Branch[] = [];
  for (let w = 0; w < whorls; w++) {
    const t = w / (whorls - 1);
    const y = H * (0.07 + 0.88 * t);
    const count = Math.max(5, Math.round(7 - 2 * t));
    const turn = rand() * Math.PI * 2;
    for (let b = 0; b < count; b++) {
      const a = turn + (b / count) * Math.PI * 2 + range(rand, -0.2, 0.2);
      const length = Math.min((R - 0.5) * (1 - t) ** 0.85 * range(rand, 0.85, 1.12), R - 0.5);
      const L = Math.max(length, 0.35);
      const from: V3 = [0, y, 0];
      const to: V3 = [Math.cos(a) * L, y - L * 0.22, Math.sin(a) * L];
      segments.push({ from, to, r0: 0.06 * (1 - t) + 0.02, r1: 0.01 });
      branches.push({ from, to, azimuth: a, length: L });
    }
  }
  // Needle cards along the branches, in proportion to their length.
  const total = branches.reduce((s, b) => s + b.length, 0);
  const size = cardSize(2.1, n, 2.5);
  const cards: Card[] = [];
  let carry = 0;
  for (const br of branches) {
    carry += (br.length / total) * n;
    const here = Math.floor(carry);
    carry -= here;
    for (let k = 0; k < here; k++) {
      const f = here === 1 ? 0.62 : 0.3 + (0.6 * (k + rand() * 0.6)) / here;
      const at: V3 = [
        br.to[0] * f,
        Math.min(br.from[1] + (br.to[1] - br.from[1]) * f + 0.12, H - size * 0.62),
        br.to[2] * f,
      ];
      const radial: V3 = [Math.cos(br.azimuth), 0, Math.sin(br.azimuth)];
      const normal = norm(
        add(
          add(scale(radial, cards.length % 2 ? 0.9 : 0.4), [0, cards.length % 2 ? 0.5 : 0.9, 0]),
          scale(onSphere(rand), 0.12),
        ),
      );
      cards.push({
        at,
        normal,
        size: size * range(rand, 0.85, 1.15),
        // The picture's thin end points at the trunk.
        spin: spinToward(normal, scale(radial, -1)) + range(rand, -0.25, 0.25),
        tile: Math.floor(rand() * 4) as 0 | 1 | 2 | 3,
      });
    }
  }
  // Rounding left a few cards short: top up on random branches so the count is exact.
  while (cards.length < n) {
    const br = branches[Math.floor(rand() * branches.length)];
    const f = range(rand, 0.35, 0.9);
    const radial: V3 = [Math.cos(br.azimuth), 0, Math.sin(br.azimuth)];
    const normal = norm(
      add(
        add(scale(radial, cards.length % 2 ? 0.9 : 0.4), [0, cards.length % 2 ? 0.5 : 0.9, 0]),
        scale(onSphere(rand), 0.12),
      ),
    );
    cards.push({
      at: [
        br.to[0] * f,
        Math.min(br.from[1] + (br.to[1] - br.from[1]) * f + 0.12, H - size * 0.62),
        br.to[2] * f,
      ],
      normal,
      size: size * range(rand, 0.85, 1.15),
      spin: spinToward(normal, scale(radial, -1)) + range(rand, -0.25, 0.25),
      tile: Math.floor(rand() * 4) as 0 | 1 | 2 | 3,
    });
  }
  return { segments, cards: cards.slice(0, n) };
}

const GROW: Record<Species, (rand: Random, n: number) => TreeShape> = {
  oak: growOak,
  pine: growPine,
  birch: growBirch,
};

/**
 * One of three seeded shapes of a species, with exactly `cards` leaf cards. The same arguments
 * always give the same tree.
 */
export function growTree(species: Species, variant: 0 | 1 | 2, cards: number): TreeShape {
  const rand = seededRandom(SPECIES_SEED[species] + variant * 17 + 3);
  return GROW[species](rand, Math.max(Math.round(cards), 0));
}

/** What a bush is made of: the oak's crown at a quarter size and no trunk, sitting on the ground. */
export const BUSH_BOUNDS = { height: 1.9, radius: 1.15 };

export function growBush(cards: number): Card[] {
  const oak = growTree('oak', 0, cards).cards;
  const low = Math.min(...oak.map((c) => c.at[1] - c.size / 2), TREE_BOUNDS.oak.height);
  return oak.map((c) => ({
    ...c,
    at: [c.at[0] * 0.25, (c.at[1] - low) * 0.25, c.at[2] * 0.25] as V3,
    size: c.size * 0.4,
  }));
}
