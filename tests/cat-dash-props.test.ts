import { describe, expect, it } from 'vitest';
import { CylinderGeometry, Mesh, SphereGeometry, type Material, type Object3D } from 'three';
import { fadeAlpha } from '../src/games/cat-dash/effects';
import { FISH_BOB, FISH_SPIN, createFishSet, fishBob, fishSpin } from '../src/games/cat-dash/fish';
import { OBSTACLE_IDS } from '../src/games/cat-dash/places';
import { PROP_BUILDERS, createPropPool } from '../src/games/cat-dash/props/pool';

const meshes = (root: Object3D): Mesh[] => {
  const out: Mesh[] = [];
  root.traverse((o) => {
    if ((o as Mesh).isMesh) out.push(o as Mesh);
  });
  return out;
};
const hulls = (root: Object3D) => meshes(root).filter((m) => m.userData.outlineHull);
const solid = (m: Mesh) => !(m.material as Material).transparent;

describe('prop outlines', () => {
  it('every obstacle has a builder and gets ink hulls that follow the tier', () => {
    expect(Object.keys(PROP_BUILDERS).sort()).toEqual([...OBSTACLE_IDS].sort());
    const pool = createPropPool(true);
    for (const id of OBSTACLE_IDS) {
      const prop = pool.get(id);
      const found = hulls(prop.object);
      expect(found.length, id).toBeGreaterThan(0);
      expect(
        found.every((h) => h.visible && !h.castShadow),
        id,
      ).toBe(true);
      prop.update(null, 0, 0.3);
    }
    pool.setOutlines(false);
    for (const id of OBSTACLE_IDS)
      expect(hulls(pool.get(id).object).every((h) => !h.visible)).toBe(true);
    pool.setOutlines(true);
    for (const id of OBSTACLE_IDS)
      expect(hulls(pool.get(id).object).every((h) => h.visible)).toBe(true);
    pool.dispose();
  });

  it('starts hidden at the low tier, also for props built later', () => {
    const pool = createPropPool(false);
    const prop = pool.get('couch');
    expect(hulls(prop.object).every((h) => !h.visible)).toBe(true);
    pool.dispose();
  });

  it('removes the hulls with the prop when it is pruned', () => {
    const pool = createPropPool(true);
    const prop = pool.get('couch');
    const count = hulls(prop.object).length;
    expect(count).toBeGreaterThan(0);
    pool.prune([]);
    expect(hulls(prop.object)).toHaveLength(0);
    expect(pool.get('couch')).not.toBe(prop);
    pool.dispose();
  });
});

describe('prop shapes', () => {
  it('spheres and cylinders are smooth', () => {
    const pool = createPropPool(false);
    for (const id of OBSTACLE_IDS) {
      for (const m of meshes(pool.get(id).object)) {
        if (!solid(m) || m.userData.outlineHull) continue;
        const g = m.geometry;
        if (g instanceof SphereGeometry) {
          expect(g.parameters.widthSegments, id).toBeGreaterThanOrEqual(16);
        }
        if (g instanceof CylinderGeometry) {
          const { radiusTop, radiusBottom, radialSegments } = g.parameters;
          // Cones (a point at one end) are spikes and beaks; the rest are round.
          if (radiusTop > 0 && radiusBottom > 0) {
            expect(radialSegments, id).toBeGreaterThanOrEqual(16);
          }
        }
      }
    }
    pool.dispose();
  });
});

describe('fish', () => {
  it('bobs a little and turns once a second', () => {
    for (let i = 0; i < 200; i++)
      expect(Math.abs(fishBob(i / 37))).toBeLessThanOrEqual(FISH_BOB + 1e-9);
    expect(fishBob(0.125)).toBeCloseTo(FISH_BOB, 6);
    expect(fishSpin(1 / FISH_SPIN)).toBeCloseTo(Math.PI * 2, 6);
  });

  it('makes outlined fish that follow the tier and clean up', () => {
    const set = createFishSet(true);
    const fish = set.make();
    expect(meshes(fish).length).toBeGreaterThan(8);
    expect(hulls(fish).length).toBeGreaterThan(0);
    expect(hulls(fish).every((h) => h.visible)).toBe(true);
    set.setOutlines(false);
    expect(hulls(fish).every((h) => !h.visible)).toBe(true);
    const later = set.make();
    expect(hulls(later).every((h) => !h.visible)).toBe(true);
    set.dispose();
    expect(hulls(fish)).toHaveLength(0);
  });
});

describe('particle fade', () => {
  it('fades in quickly and out linearly or softly', () => {
    expect(fadeAlpha(0, false)).toBe(0);
    expect(fadeAlpha(0.5, false)).toBe(1);
    expect(fadeAlpha(1, false)).toBe(0);
    expect(fadeAlpha(1, true)).toBe(0);
    expect(fadeAlpha(0.5, true)).toBeCloseTo(Math.pow(0.5, 1.5), 6);
    for (let u = 0.1; u < 1; u += 0.05) expect(fadeAlpha(u, true)).toBeLessThanOrEqual(1);
    // The soft fade starts leaving at once, so it is under the linear one midway.
    expect(fadeAlpha(0.6, true)).toBeLessThan(fadeAlpha(0.6, false));
  });
});
