import './maps.css';
import type { Fact } from '../topics';
import {
  countryIdByName,
  drawUsMap,
  drawWorldInset,
  drawWorldMap,
  ringRadius,
  stateIdByName,
  WHOLE_WORLD_VIEW,
  type MapMarks,
} from './draw';
import { CONTINENT_VIEWS, WORLD_INSETS, WORLD_SHAPES } from './world-data';

export {
  countryIdByName,
  drawUsMap,
  drawWorldInset,
  drawWorldMap,
  RINGED,
  stateIdByName,
  type MapMarks,
} from './draw';

let overlay: HTMLDivElement | null = null;

function ensureOverlay(): HTMLDivElement {
  if (!overlay || !overlay.isConnected) {
    overlay = document.createElement('div');
    overlay.className = 'sg-factmap';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);
  }
  return overlay;
}

/** The svg for a fact with `map`: the US map, or the continent of its country. */
function drawFactMap(fact: Fact, marks: MapMarks, className: string): SVGSVGElement | null {
  const map = fact.map;
  if (!map) return null;
  return map.kind === 'world'
    ? drawWorldMap(marks, map.continent, className)
    : drawUsMap(marks, className);
}

/** A country question opens on the whole world for this long, then zooms in. */
export const ZOOM_HOLD_MS = 700;
export const ZOOM_MS = 1000;
let zoomFrame = 0;

function stopZoom(): void {
  if (zoomFrame) cancelAnimationFrame(zoomFrame);
  zoomFrame = 0;
}

type View = readonly [number, number, number, number];
/**
 * The view `t` (0..1, eased) of the way from `a` to `b` (same aspect): the width shrinks at a steady
 * rate and the centre moves in step with it, so the zoom feels even.
 */
function zoomView(a: View, b: View, t: number): View {
  const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  const w = a[2] * (b[2] / a[2]) ** e;
  const f = a[2] === b[2] ? e : (a[2] - w) / (a[2] - b[2]);
  const h = (w * a[3]) / a[2];
  const cx = a[0] + a[2] / 2 + (b[0] + b[2] / 2 - a[0] - a[2] / 2) * f;
  const cy = a[1] + a[3] / 2 + (b[1] + b[3] / 2 - a[1] - a[3] / 2) * f;
  return [cx - w / 2, cy - h / 2, w, h];
}

const canZoom = (): boolean =>
  typeof requestAnimationFrame === 'function' &&
  !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export interface FactMapOptions {
  /** Dev (map lab): hold a country question's zoom at this point, 0 (whole world) to 1. */
  zoomAt?: number;
}

/**
 * Shows the big map for a fact with `map`; returns false (and hides it) for any other fact. With
 * `marks` it is a miss: the right state green and `marks.wrong` (a state name, if any) red. A
 * country also gets a small world map in a corner; a country question (no `marks`) first shows
 * the whole world for `ZOOM_HOLD_MS`, then zooms to the continent over `ZOOM_MS`.
 */
export function showFactMap(
  fact: Fact,
  marks?: { wrong?: string },
  options: FactMapOptions = {},
): boolean {
  stopZoom();
  if (!fact.map) {
    hideFactMap();
    return false;
  }
  const map = fact.map;
  const target = map.kind === 'world' ? map.country : map.state;
  const wrong = marks?.wrong
    ? map.kind === 'world'
      ? countryIdByName(marks.wrong)
      : stateIdByName(marks.wrong)
    : undefined;
  const shown: MapMarks = marks ? { right: target, wrong } : { lit: target };
  const box = ensureOverlay();
  if (map.kind === 'world') {
    const zoomAt = options.zoomAt ?? (!marks && canZoom() ? 0 : 1);
    const svg = drawWorldMap(shown, map.continent, 'sg-factmap-svg', zoomAt < 1);
    const inset = drawWorldInset(shown, map.continent, 'sg-factmap-inset');
    inset.classList.add(`is-${WORLD_INSETS[map.country]}`);
    box.replaceChildren(svg, inset);
    if (zoomAt < 1) {
      // A ring on the country while the world is in view, even a big one, to find it from afar.
      let ring = svg.querySelector<SVGCircleElement>('.sg-map-ring');
      const keepRing = !!ring;
      if (!ring) {
        ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ring.setAttribute('class', 'sg-map-ring is-lit');
        ring.setAttribute('cx', String(WORLD_SHAPES[target].cx));
        ring.setAttribute('cy', String(WORLD_SHAPES[target].cy));
        svg.appendChild(ring);
      }
      const from = WHOLE_WORLD_VIEW;
      const to = CONTINENT_VIEWS[map.continent];
      const setZoom = (t: number): void => {
        const view = zoomView(from, to, t);
        svg.setAttribute('viewBox', view.map((n) => Math.round(n * 10) / 10).join(' '));
        ring.setAttribute('r', String(ringRadius(view[2])));
        if (t >= 1) {
          inset.classList.add('is-shown');
          if (!keepRing) ring.classList.add('is-gone');
        }
      };
      if (options.zoomAt !== undefined) {
        setZoom(Math.max(0, options.zoomAt));
      } else {
        setZoom(0);
        const start = performance.now();
        const step = (now: number): void => {
          const t = Math.min(1, Math.max(0, (now - start - ZOOM_HOLD_MS) / ZOOM_MS));
          setZoom(t);
          zoomFrame = t < 1 ? requestAnimationFrame(step) : 0;
        };
        zoomFrame = requestAnimationFrame(step);
      }
    } else {
      inset.classList.add('is-shown');
    }
  } else {
    box.replaceChildren(drawFactMap(fact, shown, 'sg-factmap-svg')!);
  }
  // Reflow so a map shown right after a hide still fades in.
  void box.offsetWidth;
  box.classList.add('is-shown');
  return true;
}

/** Fades it out (0.25 s); safe to call any time. */
export function hideFactMap(): void {
  stopZoom();
  overlay?.classList.remove('is-shown');
}

/** A mini map plus the name, for preview chips and the results list. Null for a fact without `map`. */
export function factMapThumb(fact: Fact): HTMLElement | null {
  if (!fact.map) return null;
  const thumb = document.createElement('span');
  thumb.className = 'sg-mapthumb';
  const name = document.createElement('span');
  name.className = 'sg-mapthumb-name';
  name.textContent = fact.answer;
  const target = fact.map.kind === 'world' ? fact.map.country : fact.map.state;
  thumb.append(drawFactMap(fact, { lit: target }, 'sg-mapthumb-svg')!, name);
  return thumb;
}
