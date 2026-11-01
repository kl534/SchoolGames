import './maps.css';
import type { Fact } from '../topics';
import { drawUsMap, stateIdByName, type MapMarks } from './draw';

export { drawUsMap, RINGED, stateIdByName, type MapMarks } from './draw';

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

/**
 * Shows the big map for a fact with `map`; returns false (and hides it) for any other fact. With
 * `marks` it is a miss: the right state green and `marks.wrong` (a state name, if any) red.
 */
export function showFactMap(fact: Fact, marks?: { wrong?: string }): boolean {
  if (!fact.map) {
    hideFactMap();
    return false;
  }
  const state = fact.map.state;
  const wrong = marks?.wrong ? stateIdByName(marks.wrong) : undefined;
  const shown: MapMarks = marks ? { right: state, wrong } : { lit: state };
  const box = ensureOverlay();
  box.replaceChildren(drawUsMap(shown, 'sg-factmap-svg'));
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
  thumb.append(drawUsMap({ lit: fact.map.state }, 'sg-mapthumb-svg'), name);
  return thumb;
}
