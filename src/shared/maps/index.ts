import './maps.css';
import type { Fact } from '../topics';
import { countryIdByName, drawUsMap, drawWorldMap, stateIdByName, type MapMarks } from './draw';

export {
  countryIdByName,
  drawUsMap,
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

/**
 * Shows the big map for a fact with `map`; returns false (and hides it) for any other fact. With
 * `marks` it is a miss: the right state green and `marks.wrong` (a state name, if any) red.
 */
export function showFactMap(fact: Fact, marks?: { wrong?: string }): boolean {
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
  box.replaceChildren(drawFactMap(fact, shown, 'sg-factmap-svg')!);
  // Reflow so a map shown right after a hide still fades in.
  void box.offsetWidth;
  box.classList.add('is-shown');
  return true;
}

/** Fades it out (0.25 s); safe to call any time. */
export function hideFactMap(): void {
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
