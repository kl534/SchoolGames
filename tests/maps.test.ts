// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  countryIdByName,
  drawUsMap,
  drawWorldInset,
  drawWorldMap,
  stateIdByName,
  WHOLE_WORLD_VIEW,
} from '../src/shared/maps/draw';
import { factMapThumb, hideFactMap, showFactMap } from '../src/shared/maps';
import {
  US_STATE_NEIGHBORS,
  US_STATE_SHAPES,
  US_MAP_HEIGHT,
  US_MAP_WIDTH,
} from '../src/shared/maps/us-states-data';
import {
  CONTINENT_VIEWS,
  WORLD_HEIGHT,
  WORLD_INSETS,
  WORLD_NEIGHBORS,
  WORLD_SHAPES,
  WORLD_WIDTH,
} from '../src/shared/maps/world-data';
import { COUNTRIES, type Continent } from '../src/shared/topics/countries';
import { countryLocations } from '../src/shared/topics/world';
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

describe('world map', () => {
  const keys = COUNTRIES.map((c) => kebab(c.name));
  const view = (c: Continent) => CONTINENT_VIEWS[c];

  it('has 60 unique countries, each with a shape, none named like a state', () => {
    expect(COUNTRIES.length).toBe(60);
    expect(new Set(COUNTRIES.map((c) => c.name)).size).toBe(60);
    expect(new Set(COUNTRIES.map((c) => c.iso)).size).toBe(60);
    const states = new Set(STATE_CAPITALS.map((row) => row.state));
    for (const c of COUNTRIES) {
      expect(states.has(c.name)).toBe(false);
      expect(WORLD_SHAPES[kebab(c.name)].d.startsWith('M')).toBe(true);
    }
  });

  it('has symmetric borders between the 60', () => {
    expect(Object.keys(WORLD_NEIGHBORS).sort()).toEqual([...keys].sort());
    for (const [id, list] of Object.entries(WORLD_NEIGHBORS)) {
      expect(list).not.toContain(id);
      expect(list).toEqual([...list].sort());
      for (const other of list) expect(WORLD_NEIGHBORS[other]).toContain(id);
    }
    expect(WORLD_NEIGHBORS.france).toEqual(
      expect.arrayContaining(['germany', 'italy', 'spain', 'switzerland']),
    );
    expect(WORLD_NEIGHBORS.chile).toEqual(expect.arrayContaining(['argentina', 'bolivia', 'peru']));
    for (const island of ['iceland', 'japan', 'australia', 'madagascar']) {
      expect(WORLD_NEIGHBORS[island]).toEqual([]);
    }
  });

  it('has continent views with the card aspect that hold every listed country', () => {
    for (const [continent, [, , w, h]] of Object.entries(CONTINENT_VIEWS)) {
      expect(Math.abs(w / h / (975 / 610) - 1)).toBeLessThan(0.01);
      expect(continent).toBeTruthy();
    }
    for (const c of COUNTRIES) {
      const [vx, vy, vw, vh] = view(c.continent);
      const { cx, cy } = WORLD_SHAPES[kebab(c.name)];
      expect(cx).toBeGreaterThanOrEqual(vx);
      expect(cx).toBeLessThanOrEqual(vx + vw);
      expect(cy).toBeGreaterThanOrEqual(vy);
      expect(cy).toBeLessThanOrEqual(vy + vh);
    }
  });

  it('rings small countries only', () => {
    for (const id of ['jamaica', 'fiji', 'switzerland']) expect(WORLD_SHAPES[id].small).toBe(true);
    for (const id of ['brazil', 'russia']) expect(WORLD_SHAPES[id].small).toBe(false);
  });

  it('draws Europe with Italy lit and no Brazil', () => {
    const svg = drawWorldMap({ lit: 'italy' }, 'europe', 'x');
    expect(svg.getAttribute('viewBox')).toBe(CONTINENT_VIEWS.europe.join(' '));
    expect(svg.querySelector('[data-country="italy"]')!.getAttribute('class')).toContain('is-lit');
    expect(svg.querySelector('[data-country="brazil"]')).toBeNull();
    expect(svg.getAttribute('aria-label')).toBe('Map of Europe');
  });

  it('marks right and wrong with one ring, for Jamaica', () => {
    const svg = drawWorldMap({ right: 'jamaica', wrong: 'cuba' }, 'north-america', 'x');
    expect(svg.querySelector('[data-country="jamaica"]')!.getAttribute('class')).toContain(
      'is-right',
    );
    expect(svg.querySelector('[data-country="cuba"]')!.getAttribute('class')).toContain('is-wrong');
    expect(svg.querySelectorAll('.sg-map-ring').length).toBe(1);
  });

  it('finds a country id by shown name', () => {
    expect(countryIdByName('United Kingdom')).toBe('united-kingdom');
    expect(countryIdByName('Atlantis')).toBeUndefined();
  });

  it('shows the big map and the thumbnail for a country fact', () => {
    const chile = countryLocations.facts.find((f) => f.id === 'world-chile')!;
    expect(showFactMap(chile, { wrong: 'Peru' })).toBe(true);
    const overlay = document.querySelector('.sg-factmap')!;
    expect(overlay.querySelector('[data-country="chile"]')!.getAttribute('class')).toContain(
      'is-right',
    );
    expect(overlay.querySelector('[data-country="peru"]')!.getAttribute('class')).toContain(
      'is-wrong',
    );
    const thumb = factMapThumb(chile)!;
    expect(thumb.querySelector('svg')).not.toBeNull();
    expect(thumb.querySelector('.sg-mapthumb-name')!.textContent).toBe('Chile');
  });

  it('puts the small world map in a corner clear of each country', () => {
    expect(Object.keys(WORLD_INSETS).sort()).toEqual([...keys].sort());
    for (const c of COUNTRIES) {
      const id = kebab(c.name);
      const corner = WORLD_INSETS[id];
      const [vx, vy, vw, vh] = view(c.continent);
      const { cx, cy } = WORLD_SHAPES[id];
      // The corner covers 30 % of the width and about a quarter of the height.
      const inX = corner.endsWith('left') ? cx < vx + 0.3 * vw : cx > vx + 0.7 * vw;
      const inY = corner.startsWith('top') ? cy < vy + 0.25 * vh : cy > vy + 0.75 * vh;
      expect(inX && inY, `${id} under ${corner}`).toBe(false);
    }
  });

  it('draws the small world map with the continent outlined and a dot per mark', () => {
    const svg = drawWorldInset({ right: 'chile', wrong: 'peru' }, 'south-america', 'x');
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`);
    expect(svg.querySelectorAll('.sg-map-inset-land').length).toBe(
      Object.keys(WORLD_SHAPES).length,
    );
    expect(svg.querySelector('.sg-map-inset-frame')).not.toBeNull();
    expect(svg.querySelector('.sg-map-inset-dot.is-right')!.getAttribute('data-country')).toBe(
      'chile',
    );
    expect(svg.querySelector('.sg-map-inset-dot.is-wrong')!.getAttribute('data-country')).toBe(
      'peru',
    );
  });

  describe('a country question zooms in from the whole world', () => {
    const italy = countryLocations.facts.find((f) => f.id === 'world-italy')!;
    const overlay = () => document.querySelector('.sg-factmap')!;
    const big = () => overlay().querySelector('.sg-factmap-svg')!;
    const inset = () => overlay().querySelector('.sg-factmap-inset')!;

    it('starts on the whole world, with every country, a ring on Italy and no corner map', () => {
      showFactMap(italy, undefined, { zoomAt: 0 });
      expect(big().getAttribute('viewBox')).toBe(WHOLE_WORLD_VIEW.join(' '));
      expect(big().querySelector('[data-country="brazil"]')).not.toBeNull();
      const ring = big().querySelector('.sg-map-ring')!;
      expect(ring.getAttribute('cx')).toBe(String(WORLD_SHAPES.italy.cx));
      expect(ring.getAttribute('r')).toBe('30');
      expect(inset().classList.contains('is-shown')).toBe(false);
      expect(inset().classList.contains(`is-${WORLD_INSETS.italy}`)).toBe(true);
    });

    it('ends on the continent with the corner map shown', () => {
      showFactMap(italy, undefined, { zoomAt: 1 });
      expect(big().getAttribute('viewBox')).toBe(CONTINENT_VIEWS.europe.join(' '));
      expect(inset().classList.contains('is-shown')).toBe(true);
      // Italy is not small: no ring once zoomed in.
      expect(big().querySelector('.sg-map-ring')).toBeNull();
    });

    it('plays the zoom by itself, and a miss shows the continent at once', async () => {
      showFactMap(italy);
      expect(big().getAttribute('viewBox')).toBe(WHOLE_WORLD_VIEW.join(' '));
      // The corner map comes in when the zoom ends.
      await vi.waitFor(() => expect(inset().classList.contains('is-shown')).toBe(true), {
        timeout: 5000,
        interval: 100,
      });
      expect(big().getAttribute('viewBox')).toBe(CONTINENT_VIEWS.europe.join(' '));
      expect(big().querySelector('.sg-map-ring')!.classList.contains('is-gone')).toBe(true);
      expect(big().getAttribute('viewBox')).toBe(CONTINENT_VIEWS.europe.join(' '));
      showFactMap(italy, { wrong: 'France' });
      expect(big().getAttribute('viewBox')).toBe(CONTINENT_VIEWS.europe.join(' '));
      expect(inset().classList.contains('is-shown')).toBe(true);
      expect(inset().querySelector('.is-wrong')!.getAttribute('data-country')).toBe('france');
    });
  });
});
