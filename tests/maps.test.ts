// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { drawUsMap, stateIdByName } from '../src/shared/maps/draw';
import { factMapThumb, hideFactMap, showFactMap } from '../src/shared/maps';
import {
  US_STATE_NEIGHBORS,
  US_STATE_SHAPES,
  US_MAP_HEIGHT,
  US_MAP_WIDTH,
} from '../src/shared/maps/us-states-data';
import { kebab, STATE_CAPITALS, stateCapitals } from '../src/shared/topics/capitals';
import { stateLocations } from '../src/shared/topics/locations';

const ohio = stateLocations.facts.find((f) => f.id === 'map-ohio')!;
const ids = Object.keys(US_STATE_SHAPES);

afterEach(() => {
  document.body.replaceChildren();
});

describe('US map data', () => {
  it('has the 50 states of the capitals topic with a path and a centre', () => {
    expect(ids).toEqual(STATE_CAPITALS.map((row) => kebab(row.state)).sort());
    for (const [id, shape] of Object.entries(US_STATE_SHAPES)) {
      expect(shape.name).toBe(STATE_CAPITALS.find((row) => kebab(row.state) === id)!.state);
      expect(shape.d.startsWith('M')).toBe(true);
      expect(shape.cx).toBeGreaterThanOrEqual(0);
      expect(shape.cx).toBeLessThanOrEqual(US_MAP_WIDTH);
      expect(shape.cy).toBeGreaterThanOrEqual(0);
      expect(shape.cy).toBeLessThanOrEqual(US_MAP_HEIGHT);
    }
  });

  it('has symmetric borders between valid states', () => {
    expect(Object.keys(US_STATE_NEIGHBORS).sort()).toEqual(ids);
    for (const [id, list] of Object.entries(US_STATE_NEIGHBORS)) {
      expect(list).not.toContain(id);
      expect(list).toEqual([...list].sort());
      for (const other of list) {
        expect(ids).toContain(other);
        expect(US_STATE_NEIGHBORS[other]).toContain(id);
      }
    }
  });

  it('knows the borders of Ohio, the islands and Four Corners', () => {
    for (const state of ['indiana', 'kentucky', 'michigan', 'pennsylvania', 'west-virginia']) {
      expect(US_STATE_NEIGHBORS.ohio).toContain(state);
    }
    expect(US_STATE_NEIGHBORS.alaska).toEqual([]);
    expect(US_STATE_NEIGHBORS.hawaii).toEqual([]);
    expect(US_STATE_NEIGHBORS.utah).not.toContain('new-mexico');
  });

  it('finds a state id by shown name', () => {
    expect(stateIdByName('New York')).toBe('new-york');
    expect(stateIdByName('Atlantis')).toBeUndefined();
  });
});

describe('drawUsMap', () => {
  it('draws 50 states with only the lit one marked, and no ring for a big state', () => {
    const svg = drawUsMap({ lit: 'ohio' }, 'x');
    expect(svg.querySelectorAll('path.sg-map-state').length).toBe(50);
    expect([...svg.querySelectorAll('.is-lit')].map((n) => n.getAttribute('data-state'))).toEqual([
      'ohio',
    ]);
    expect(svg.querySelector('.sg-map-ring')).toBeNull();
    expect(svg.getAttribute('viewBox')).toBe('0 0 975 610');
  });

  it('marks right and wrong, with a ring on each small state', () => {
    const svg = drawUsMap({ right: 'rhode-island', wrong: 'connecticut' }, 'x');
    expect(svg.querySelector('[data-state="rhode-island"]')!.getAttribute('class')).toContain(
      'is-right',
    );
    expect(svg.querySelector('[data-state="connecticut"]')!.getAttribute('class')).toContain(
      'is-wrong',
    );
    expect(svg.querySelectorAll('.sg-map-ring').length).toBe(2);
  });
});

describe('the big map', () => {
  const overlay = () => document.querySelector('.sg-factmap')!;

  it('is not shown for a capitals fact', () => {
    expect(showFactMap(stateCapitals.facts[0])).toBe(false);
    expect(overlay()?.classList.contains('is-shown') ?? false).toBe(false);
  });

  it('lights the state, shows the miss, and hides', () => {
    expect(showFactMap(ohio)).toBe(true);
    expect(overlay().classList.contains('is-shown')).toBe(true);
    expect(overlay().querySelector('.is-lit')!.getAttribute('data-state')).toBe('ohio');
    showFactMap(ohio, { wrong: 'Iowa' });
    expect(overlay().querySelector('[data-state="iowa"]')!.getAttribute('class')).toContain(
      'is-wrong',
    );
    expect(overlay().querySelector('[data-state="ohio"]')!.getAttribute('class')).toContain(
      'is-right',
    );
    hideFactMap();
    expect(overlay().classList.contains('is-shown')).toBe(false);
  });

  it('hides when the next fact has no map', () => {
    showFactMap(ohio);
    expect(showFactMap(stateCapitals.facts[0])).toBe(false);
    expect(overlay().classList.contains('is-shown')).toBe(false);
  });
});

describe('factMapThumb', () => {
  it('is null for a fact without a map, and a mini map with the name for one with', () => {
    expect(factMapThumb(stateCapitals.facts[0])).toBeNull();
    const thumb = factMapThumb(ohio)!;
    expect(thumb.querySelector('svg')).not.toBeNull();
    expect(thumb.querySelector('.sg-mapthumb-name')!.textContent).toBe('Ohio');
  });
});
