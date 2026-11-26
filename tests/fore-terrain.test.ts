import { describe, expect, it } from 'vitest';
import { centreX, HOLES, surfaceAt, type Ellipse } from '../src/games/fore/course';
import {
  BUNKER_DEPTH,
  ellipseQ,
  FLAT_HALF,
  groundY,
  MOUND_MAX,
  outsideBy,
  POND_DEPTH,
  SHORE,
} from '../src/games/fore/terrain';
import { seededRandom } from '../src/shared/random';
import { runs } from './helpers/full';

const near = (e: Ellipse, x: number, z: number, margin: number) => outsideBy(e, x, z) < margin;

describe('groundY', () => {
  it('is flat wherever the ball can lie outside the hazards', () => {
    const rand = seededRandom(41);
    HOLES.forEach((h) => {
      for (let i = 0; i < runs(2000, 200); i++) {
        const z = -60 + rand() * (h.length + 120);
        const x = centreX(h, z) + (rand() * 2 - 1) * FLAT_HALF;
        if (h.hazards.some((hz) => near(hz.at, x, z, SHORE + 0.01))) continue;
        expect(groundY(h, x, z), `${x.toFixed(1)}, ${z.toFixed(1)}`).toBe(0);
        expect(surfaceAt(h, x, z)).not.toBe('water');
      }
    });
  });

  it('dips in bunkers and ponds and rises in 0..MOUND_MAX elsewhere', () => {
    const rand = seededRandom(42);
    HOLES.forEach((h) => {
      for (let i = 0; i < runs(2000, 200); i++) {
        const z = -150 + rand() * (h.length + 300);
        const x = centreX(h, z) + (rand() * 2 - 1) * 200;
        const y = groundY(h, x, z);
        const sand = h.hazards.find((hz) => hz.kind === 'sand' && ellipseQ(hz.at, x, z) < 1);
        const pond = h.hazards.find((hz) => hz.kind === 'water' && near(hz.at, x, z, SHORE));
        if (sand) {
          expect(y).toBeLessThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(-BUNKER_DEPTH);
        } else if (pond) {
          expect(y).toBeLessThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(-POND_DEPTH);
        } else {
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(MOUND_MAX);
        }
      }
    });
  });

  it('is deepest in the middle of a bunker and rises to the rim', () => {
    for (const h of HOLES) {
      for (const hz of h.hazards) {
        if (hz.kind !== 'sand') continue;
        expect(groundY(h, hz.at.x, hz.at.z)).toBeCloseTo(-BUNKER_DEPTH, 6);
        expect(groundY(h, hz.at.x + hz.at.rx, hz.at.z)).toBeCloseTo(0, 6);
      }
    }
  });

  it('holds the pond below its banks and rises to grade over the shore', () => {
    for (const h of HOLES) {
      for (const hz of h.hazards) {
        if (hz.kind !== 'water') continue;
        const { x, z, rx } = hz.at;
        expect(groundY(h, x, z)).toBeCloseTo(-POND_DEPTH, 6);
        expect(groundY(h, x + rx, z)).toBeCloseTo(-POND_DEPTH, 6);
        expect(groundY(h, x + rx + SHORE, z)).toBeCloseTo(0, 6);
      }
    }
  });

  it('is continuous: a yard step changes the height by under 0.2', () => {
    const rand = seededRandom(43);
    HOLES.forEach((h) => {
      for (let i = 0; i < runs(2000, 200); i++) {
        const z = -150 + rand() * (h.length + 300);
        const x = centreX(h, z) + (rand() * 2 - 1) * 250;
        const a = rand() * Math.PI * 2;
        const dy = groundY(h, x + Math.cos(a), z + Math.sin(a)) - groundY(h, x, z);
        expect(Math.abs(dy)).toBeLessThan(0.2);
      }
    });
  });

  it('is deterministic and different on each hole', () => {
    const p = [centreX(HOLES[2], 100) + 90, 100] as const;
    expect(groundY(HOLES[2], p[0], p[1])).toBe(groundY(HOLES[2], p[0], p[1]));
    expect(groundY(HOLES[2], p[0], p[1])).not.toBe(groundY(HOLES[3], p[0], p[1]));
  });
});
