import { describe, expect, it } from 'vitest';
import { HOLES, surfaceAt, centreX, type Hole } from '../src/games/fore/course';
import {
  bladeSpots,
  BLADE_RANGE,
  TUFT_MAX_OFF,
  TUFT_MIN_OFF,
  tuftSpots,
} from '../src/games/fore/grass';
import { clubhouseSite, CLUBHOUSE_CLEAR, type Species } from '../src/games/fore/scenery';
import { barkGeometry, buildTreeLayer, leafGeometry, treeBounds } from '../src/games/fore/trees';
import { BUSH_BOUNDS, cardAxes, growBush, growTree } from '../src/games/fore/trees-grow';
import { seededRandom } from '../src/shared/random';
import { runs } from './helpers/full';

const SPECIES: Species[] = ['oak', 'pine', 'birch'];
const VARIANTS = [0, 1, 2] as const;

describe('growTree', () => {
  it('is deterministic and differs between variants and species', () => {
    for (const sp of SPECIES) {
      expect(growTree(sp, 1, 200)).toEqual(growTree(sp, 1, 200));
      expect(growTree(sp, 0, 200)).not.toEqual(growTree(sp, 1, 200));
    }
    expect(growTree('oak', 0, 100).segments).not.toEqual(growTree('birch', 0, 100).segments);
  });

  it('makes exactly the number of cards asked for', () => {
    for (const sp of SPECIES) {
      for (const v of VARIANTS) {
        for (const n of [0, 1, 37, 140, 252, 420]) {
          expect(growTree(sp, v, n).cards.length, `${sp} ${v} ${n}`).toBe(n);
        }
      }
    }
  });

  it('keeps every card and segment inside the species bounds', () => {
    for (const sp of SPECIES) {
      const { height, radius } = treeBounds(sp);
      for (const v of VARIANTS) {
        const tree = growTree(sp, v, 420);
        for (const c of tree.cards) {
          expect(Math.hypot(c.at[0], c.at[2]), `${sp} card reach`).toBeLessThanOrEqual(radius);
          expect(c.at[1]).toBeGreaterThanOrEqual(0);
          expect(c.at[1] + c.size / 2).toBeLessThanOrEqual(height + 1e-6);
          expect(c.size).toBeGreaterThan(0);
          expect(Math.hypot(...c.normal)).toBeCloseTo(1, 5);
          const { right, up } = cardAxes(c);
          expect(Math.hypot(...right)).toBeCloseTo(1, 5);
          expect(right[0] * up[0] + right[1] * up[1] + right[2] * up[2]).toBeCloseTo(0, 5);
        }
        expect(tree.segments.length).toBeGreaterThan(3);
        for (const s of tree.segments) {
          for (const p of [s.from, s.to]) {
            expect(Math.hypot(p[0], p[2]), `${sp} segment reach`).toBeLessThanOrEqual(radius);
            expect(p[1]).toBeGreaterThanOrEqual(0);
            expect(p[1]).toBeLessThanOrEqual(height);
          }
          expect(s.r0).toBeGreaterThan(0);
          expect(s.r1).toBeGreaterThan(0);
          expect(s.r1).toBeLessThanOrEqual(s.r0 + 1e-9);
        }
      }
    }
  });

  it('gives the species their own look: oak trunk to 30%, straight pine, narrow birch', () => {
    const oak = growTree('oak', 0, 420);
    const trunkTop = Math.max(...oak.segments.slice(0, 3).map((s) => s.to[1]));
    expect(trunkTop / treeBounds('oak').height).toBeGreaterThan(0.28);
    expect(trunkTop / treeBounds('oak').height).toBeLessThan(0.36);
    const pine = growTree('pine', 0, 252);
    const top = pine.segments.slice(0, 4).at(-1)!.to;
    expect(Math.hypot(top[0], top[2])).toBeLessThan(0.2);
    expect(top[1]).toBeGreaterThan(treeBounds('pine').height * 0.9);
    const reach = (sp: Species) =>
      Math.max(...growTree(sp, 0, 420).cards.map((c) => Math.hypot(c.at[0], c.at[2])));
    expect(reach('birch')).toBeLessThan(reach('oak') * 0.6);
  });

  it('builds bark and leaf geometry with the right counts', () => {
    const tree = growTree('oak', 2, 100);
    const leaves = leafGeometry(tree.cards, () => 1);
    expect(leaves.getAttribute('position').count).toBe(400);
    expect(leaves.index!.count).toBe(600);
    const uv = leaves.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) {
      expect(uv.getX(i)).toBeGreaterThanOrEqual(0);
      expect(uv.getX(i)).toBeLessThanOrEqual(1);
    }
    expect(barkGeometry(tree.segments).getAttribute('position').count).toBeGreaterThan(100);
  });

  it('grows a bush from the oak crown: cards only, low, on the ground', () => {
    const cards = growBush(40);
    expect(cards.length).toBe(40);
    for (const c of cards) {
      expect(c.at[1]).toBeGreaterThanOrEqual(-0.2);
      expect(c.at[1]).toBeLessThanOrEqual(BUSH_BOUNDS.height + 0.1);
      expect(Math.hypot(c.at[0], c.at[2])).toBeLessThanOrEqual(BUSH_BOUNDS.radius);
    }
  });
});

describe('tree layer', () => {
  it('draws one bark and one leaf mesh per variant in use, bushes as one more', () => {
    const rand = seededRandom(4);
    const list = Array.from({ length: 60 }, (_, i) => ({
      x: rand() * 100,
      z: rand() * 100,
      r: 4,
      height: 12,
      yaw: 0,
      species: (['oak', 'pine', 'birch', 'bush'] as const)[i % 4],
    }));
    const layer = buildTreeLayer(list);
    // At most 3 variants x 2 parts for each of the 3 species, plus the bushes, plus blob shadows.
    expect(layer.object.children.length).toBeLessThanOrEqual(3 * 2 * 3 + 1 + 1);
    expect(layer.object.children.length).toBeGreaterThanOrEqual(2 * 3 + 1);
    layer.update(1.5);
    layer.dispose();
    expect(layer.object.children.length).toBe(layer.object.children.length);
  });
});

const centreOff = (h: Hole, x: number, z: number) => Math.abs(x - centreX(h, z));

describe('grass', () => {
  it('puts blades only where the ground is rough, near the ball', () => {
    const n = runs(30, 6);
    const rand = seededRandom(8);
    let total = 0;
    for (let k = 0; k < n; k++) {
      const h = HOLES[k % HOLES.length];
      const at = { x: (rand() - 0.5) * 100, z: rand() * h.length };
      const spots = bladeSpots(h, at, 3000, k + 1);
      total += spots.length;
      for (const s of spots) {
        expect(surfaceAt(h, s.x, s.z)).toBe('rough');
        expect(Math.hypot(s.x - at.x, s.z - at.z)).toBeLessThanOrEqual(BLADE_RANGE + 1e-6);
        expect(s.height).toBeGreaterThanOrEqual(0.05);
        expect(s.height).toBeLessThanOrEqual(0.11);
      }
      expect(bladeSpots(h, at, 3000, k + 1)).toEqual(spots);
    }
    expect(total).toBeGreaterThan(0);
  });

  it('puts the tufts 66 to 140 yd off the line, and none by a clubhouse', () => {
    for (const h of HOLES) {
      const spots = tuftSpots(h, 600);
      expect(spots.length).toBeGreaterThan(300);
      const house = clubhouseSite(h);
      for (const s of spots) {
        const off = centreOff(h, s.x, s.z);
        expect(off).toBeGreaterThanOrEqual(TUFT_MIN_OFF - 1e-6);
        expect(off).toBeLessThanOrEqual(TUFT_MAX_OFF + 1e-6);
        expect(s.height).toBeGreaterThanOrEqual(0.3);
        expect(s.height).toBeLessThanOrEqual(0.6);
        if (house) {
          expect(Math.hypot(s.x - house.x, s.z - house.z)).toBeGreaterThanOrEqual(CLUBHOUSE_CLEAR);
        }
      }
    }
  });
});
