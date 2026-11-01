import { CONTINENT_TITLES, COUNTRIES, type Continent } from '../topics/countries';
import { CONTINENT_VIEWS, WORLD_SHAPES } from './world-data';
import { US_MAP_HEIGHT, US_MAP_WIDTH, US_STATE_SHAPES } from './us-states-data';

/** Small states that get a pulsing ring when marked, so they can be found on the map. */
export const RINGED: readonly string[] = [
  'connecticut',
  'delaware',
  'hawaii',
  'maryland',
  'massachusetts',
  'new-hampshire',
  'new-jersey',
  'rhode-island',
  'vermont',
];

export interface MapMarks {
  /** The state asked. */
  lit?: string;
  /** The right state, after a miss. */
  right?: string;
  /** The wrong state that was picked. */
  wrong?: string;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

const STATE_BY_NAME: ReadonlyMap<string, string> = new Map(
  Object.entries(US_STATE_SHAPES).map(([id, shape]) => [shape.name, id]),
);

/** State id for a shown name ('New York' → 'new-york'), or undefined. */
export function stateIdByName(name: string): string | undefined {
  return STATE_BY_NAME.get(name);
}

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  className: string,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  node.setAttribute('class', className);
  return node;
}

/** A US map svg (viewBox 0 0 975 610) with every state, coloured by `marks`, rings on marked RINGED states. */
export function drawUsMap(marks: MapMarks, className: string): SVGSVGElement {
  const svg = svgEl('svg', className);
  svg.setAttribute('viewBox', `0 0 ${US_MAP_WIDTH} ${US_MAP_HEIGHT}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Map of the United States');
  const marked: [string, string][] = [];
  for (const [id, key] of [
    [marks.lit, 'is-lit'],
    [marks.right, 'is-right'],
    [marks.wrong, 'is-wrong'],
  ] as const) {
    if (id && US_STATE_SHAPES[id]) marked.push([id, key]);
  }
  const markOf = new Map(marked);
  const path = (id: string): SVGPathElement => {
    const mark = markOf.get(id);
    const node = svgEl('path', mark ? `sg-map-state ${mark}` : 'sg-map-state');
    node.setAttribute('d', US_STATE_SHAPES[id].d);
    node.setAttribute('data-state', id);
    return node;
  };
  for (const id of Object.keys(US_STATE_SHAPES)) {
    if (!markOf.has(id)) svg.appendChild(path(id));
  }
  // Marked states last, so their outline is on top.
  for (const [id] of marked) svg.appendChild(path(id));
  for (const [id, mark] of marked) {
    if (!RINGED.includes(id)) continue;
    const ring = svgEl('circle', `sg-map-ring ${mark}`);
    ring.setAttribute('cx', String(US_STATE_SHAPES[id].cx));
    ring.setAttribute('cy', String(US_STATE_SHAPES[id].cy));
    ring.setAttribute('r', '22');
    svg.appendChild(ring);
  }
  return svg;
}

const kebab = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const COUNTRY_BY_NAME: ReadonlyMap<string, string> = new Map(
  COUNTRIES.map((country) => [country.name, kebab(country.name)]),
);

/** Country id for a shown name ('United Kingdom' → 'united-kingdom'), or undefined. */
export function countryIdByName(name: string): string | undefined {
  return COUNTRY_BY_NAME.get(name);
}

/**
 * A world map svg zoomed to one continent (`CONTINENT_VIEWS`): every country whose box overlaps the
 * view, coloured by `marks`, with a ring (in view units) on marked small countries.
 */
export function drawWorldMap(
  marks: MapMarks,
  continent: Continent,
  className: string,
): SVGSVGElement {
  const view = CONTINENT_VIEWS[continent];
  const [vx, vy, vw, vh] = view;
  const svg = svgEl('svg', className);
  svg.setAttribute('viewBox', view.join(' '));
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Map of ${CONTINENT_TITLES[continent]}`);
  const marked: [string, string][] = [];
  for (const [id, key] of [
    [marks.lit, 'is-lit'],
    [marks.right, 'is-right'],
    [marks.wrong, 'is-wrong'],
  ] as const) {
    if (id && WORLD_SHAPES[id]) marked.push([id, key]);
  }
  const markOf = new Map(marked);
  const path = (id: string): SVGPathElement => {
    const mark = markOf.get(id);
    const node = svgEl('path', mark ? `sg-map-state ${mark}` : 'sg-map-state');
    node.setAttribute('d', WORLD_SHAPES[id].d);
    node.setAttribute('data-country', id);
    return node;
  };
  for (const [id, shape] of Object.entries(WORLD_SHAPES)) {
    const [x0, y0, x1, y1] = shape.box;
    const inView = x1 >= vx && x0 <= vx + vw && y1 >= vy && y0 <= vy + vh;
    if (inView && !markOf.has(id)) svg.appendChild(path(id));
  }
  // Marked countries last, so their outline is on top.
  for (const [id] of marked) svg.appendChild(path(id));
  for (const [id, mark] of marked) {
    if (!WORLD_SHAPES[id].small) continue;
    const ring = svgEl('circle', `sg-map-ring ${mark}`);
    ring.setAttribute('cx', String(WORLD_SHAPES[id].cx));
    ring.setAttribute('cy', String(WORLD_SHAPES[id].cy));
    ring.setAttribute('r', String(Math.round(0.03 * vw * 10) / 10));
    svg.appendChild(ring);
  }
  return svg;
}
