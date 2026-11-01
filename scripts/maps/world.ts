/**
 * Builds `src/shared/maps/world-data.ts` from world-atlas (Natural Earth projection, 1000 x 520).
 * Run with `npm run maps`. Nothing from these packages is imported at runtime.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { geoContains, geoNaturalEarth1, geoPath } from 'd3-geo';
import type { GeoPermissibleObjects } from 'd3-geo';
import { feature, neighbors } from 'topojson-client';
import { presimplify, quantile, simplify } from 'topojson-simplify';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { COUNTRIES, CONTINENT_TITLES, type Continent } from '../../src/shared/topics/countries';

/** Fraction of the points kept by `simplify` (the most detail that keeps the file under 160 KB). */
const KEEP_QUANTILE = 0.07;
const WIDTH = 1000;
const HEIGHT = 520;
/** The card's aspect (US map 975 x 610). */
const CARD_ASPECT = 975 / 610;
/** Largest polygon's bigger side under this many units gets the ring. */
const SMALL_SIZE = 12;
const ANTARCTICA = '010';
/** The corner world map's share of the card's width (must match `.sg-factmap-inset` in maps.css). */
const INSET_WIDTH = 0.3;
const OUT = 'src/shared/maps/world-data.ts';

const kebab = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const round = (n: number): number => Math.round(n * 10) / 10;

interface CountryProps {
  name: string;
}
type Box = [number, number, number, number];
type Geo = { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown[] };

const atlas = JSON.parse(
  readFileSync('node_modules/world-atlas/countries-50m.json', 'utf8'),
) as Topology<{ countries: GeometryCollection<CountryProps> }>;
const countries = atlas.objects.countries;
countries.geometries = countries.geometries.filter((g) => g.id !== ANTARCTICA);

const pre = presimplify(atlas);
const simple = simplify(pre, quantile(pre, KEEP_QUANTILE));
const geometries = simple.objects.countries.geometries;
const collection = feature(simple, simple.objects.countries);

const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], { type: 'Sphere' });
const path = geoPath(projection).digits(1);
const boxOf = (shape: GeoPermissibleObjects): Box => {
  const [[x0, y0], [x1, y1]] = path.bounds(shape);
  return [round(x0), round(y0), round(x1), round(y1)];
};

/** Which feature index belongs to each of the 60 (by iso id, then by atlas name). */
const NAME_FALLBACK: Record<string, string> = { 'United States': 'United States of America' };
const indexOf = new Map<string, number>();
for (const country of COUNTRIES) {
  let i = geometries.findIndex((g) => g.id === country.iso);
  if (i < 0) {
    const alt = NAME_FALLBACK[country.name] ?? country.name;
    i = collection.features.findIndex(
      (f) => (f.properties as unknown as CountryProps).name === alt && !f.id,
    );
  }
  if (i < 0) throw new Error(`No feature for ${country.name} (${country.iso})`);
  indexOf.set(country.name, i);
}
const idOfIndex = new Map<number, string>();
for (const [name, i] of indexOf) idOfIndex.set(i, kebab(name));

interface Shape {
  d: string;
  box: Box;
  cx: number;
  cy: number;
  small: boolean;
  /** Box of the largest polygon, for the continent views (not written). */
  main: Box;
}
const shapes: Record<string, Shape> = {};
collection.features.forEach((f, i) => {
  const id = idOfIndex.get(i) ?? `n${f.id ?? i}`;
  const geometry = f.geometry as unknown as Geo;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  // The largest piece of the drawn path, so a polygon cut at the antimeridian (Russia, Fiji) gives
  // the box of its biggest piece and not the whole map.
  let best: Box | undefined;
  let bestArea = -1;
  for (const coordinates of polygons) {
    const drawn = path({ type: 'Polygon', coordinates } as GeoPermissibleObjects) ?? '';
    for (const piece of drawn.split('M').filter(Boolean)) {
      const nums = (piece.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
      const xs = nums.filter((_, k) => k % 2 === 0);
      const ys = nums.filter((_, k) => k % 2 === 1);
      if (!xs.length) continue;
      const box: Box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      const area = (box[2] - box[0]) * (box[3] - box[1]);
      if (area > bestArea) {
        bestArea = area;
        best = box;
      }
    }
  }
  const d = path(f as GeoPermissibleObjects);
  if (!d || !best) return;
  shapes[id] = {
    d,
    box: boxOf(f as GeoPermissibleObjects),
    cx: round((best[0] + best[2]) / 2),
    cy: round((best[1] + best[3]) / 2),
    small: Math.max(best[2] - best[0], best[3] - best[1]) < SMALL_SIZE,
    main: best,
  };
});

const listed = new Set(COUNTRIES.map((c) => kebab(c.name)));
for (const id of listed) if (!shapes[id]) throw new Error(`No shape for ${id}`);

const near = neighbors(geometries);
const adjacency: Record<string, string[]> = {};
geometries.forEach((_, i) => {
  const id = idOfIndex.get(i);
  if (!id) return;
  adjacency[id] = near[i]
    .map((j) => idOfIndex.get(j))
    .filter((other): other is string => !!other)
    .sort();
});

const views = {} as Record<Continent, Box>;
for (const continent of Object.keys(CONTINENT_TITLES) as Continent[]) {
  const boxes = COUNTRIES.filter((c) => c.continent === continent).map(
    (c) => shapes[kebab(c.name)].main,
  );
  const x0 = Math.min(...boxes.map((b) => b[0]));
  const y0 = Math.min(...boxes.map((b) => b[1]));
  const x1 = Math.max(...boxes.map((b) => b[2]));
  const y1 = Math.max(...boxes.map((b) => b[3]));
  const pad = 0.08 * Math.max(x1 - x0, y1 - y0);
  let w = x1 - x0 + 2 * pad;
  let h = y1 - y0 + 2 * pad;
  if (w / h < CARD_ASPECT) w = h * CARD_ASPECT;
  else h = w / CARD_ASPECT;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  views[continent] = [round(cx - w / 2), round(cy - h / 2), round(w), round(h)];
}

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
const CORNERS: Corner[] = ['bottom-left', 'bottom-right', 'top-left', 'top-right'];
/**
 * The corner for the small world map, per listed country: never over that country, and otherwise
 * the one covering the least land, where land of a listed country of the continent counts ten times
 * (it may be a wrong answer).
 */
const insets: Record<string, Corner> = {};
const featureBoxes = collection.features.map((f) => boxOf(f as GeoPermissibleObjects));
for (const continent of Object.keys(CONTINENT_TITLES) as Continent[]) {
  const [vx, vy, vw, vh] = views[continent];
  const iw = (INSET_WIDTH + 0.03) * vw;
  const ih = (INSET_WIDTH * (HEIGHT / WIDTH) * CARD_ASPECT + 0.03) * vh;
  const listedHere = COUNTRIES.filter((c) => c.continent === continent);
  const own = new Set(listedHere.map((c) => indexOf.get(c.name)!));
  /** Per corner: land score, and which listed countries it covers. */
  const covers = CORNERS.map((corner) => {
    const x0 = corner.endsWith('left') ? vx : vx + vw - iw;
    const y0 = corner.startsWith('top') ? vy : vy + vh - ih;
    let score = 0;
    const hits = new Set<number>();
    for (let i = 0; i <= 16; i++) {
      for (let j = 0; j <= 8; j++) {
        const x = x0 + (iw * i) / 16;
        const y = y0 + (ih * j) / 8;
        const lonLat = projection.invert!([x, y]);
        if (!lonLat) continue;
        const hit = collection.features.findIndex((f, k) => {
          const [bx0, by0, bx1, by1] = featureBoxes[k];
          return x >= bx0 && x <= bx1 && y >= by0 && y <= by1 && geoContains(f, lonLat);
        });
        if (hit < 0) continue;
        score += own.has(hit) ? 10 : 1;
        hits.add(hit);
      }
    }
    // Also a country whose ring centre is under the corner (an island the grid misses).
    for (const c of listedHere) {
      const { cx, cy } = shapes[kebab(c.name)];
      if (cx >= x0 && cx <= x0 + iw && cy >= y0 && cy <= y0 + ih) hits.add(indexOf.get(c.name)!);
    }
    return { corner, score, hits };
  });
  for (const c of listedHere) {
    const free = covers.filter((k) => !k.hits.has(indexOf.get(c.name)!));
    if (!free.length) throw new Error(`Every corner covers ${c.name}`);
    insets[kebab(c.name)] = free.reduce((a, b) => (b.score < a.score ? b : a)).corner;
  }
}

const sorted = <T>(record: Record<string, T>): Record<string, T> =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : 1)));
const out = Object.fromEntries(
  Object.entries(shapes).map(([id, s]) => [
    id,
    { d: s.d, box: s.box, cx: s.cx, cy: s.cy, small: s.small },
  ]),
);

const text = `// Generated by \`npm run maps\` from world-atlas (ISC). Do not edit.
import type { Continent } from '../topics/countries';

export const WORLD_WIDTH = ${WIDTH};
export const WORLD_HEIGHT = ${HEIGHT};
export interface WorldShape {
  d: string;
  /** Bounding box of the whole shape: [x0, y0, x1, y1]. */
  box: [number, number, number, number];
  /** Centre of the bounding box of its largest polygon (for the ring). */
  cx: number;
  cy: number;
  /** Largest polygon's bigger side under ${SMALL_SIZE} units: gets the ring when marked. */
  small: boolean;
}
/** The 60 by \`kebab(name)\` ('united-kingdom'), then every other country by \`n<id>\`. */
export const WORLD_SHAPES: Record<string, WorldShape> = ${JSON.stringify(sorted(out))};
/** For the 60 only: which of the 60 share a border with it, ids sorted. */
export const WORLD_NEIGHBORS: Record<string, string[]> = ${JSON.stringify(sorted(adjacency))};
/** viewBox [x, y, w, h] per continent. */
export const CONTINENT_VIEWS: Record<Continent, [number, number, number, number]> = ${JSON.stringify(views)};
/** For the 60 only: the corner of the card for the small world map (not over the country). */
export const WORLD_INSETS: Record<
  string,
  'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
> = ${JSON.stringify(sorted(insets))};
`;
writeFileSync(OUT, text);
execFileSync('npx', ['prettier', '--write', OUT], { stdio: 'inherit' });
console.log(`${OUT}: ${(readFileSync(OUT).length / 1024).toFixed(1)} KB`);
