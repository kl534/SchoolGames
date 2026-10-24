import { fillAnswers, lockAnswers, markAnswers } from '../../shared/answers';
import { centreX, FAIRWAY_HALF, GREEN_R, type Hole, type Surface } from './course';
import type { PlayBand } from './views';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent: HTMLElement,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  parent.appendChild(node);
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
  parent: Element,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  parent.appendChild(node);
  return node;
}

export type BannerKind = 'miss' | 'info' | 'good';

/** One hole on the scorecard. */
export interface CardCell {
  par: number;
  /** Strokes so far on the current hole, the final score on a finished one, else null. */
  strokes: number | null;
  current: boolean;
}

export interface Bands {
  /** Free space on the aim view, between the HUD above and the controls. */
  aim: PlayBand;
  /** Free space while a question shows. */
  ask: PlayBand;
  /** Everything below the scorecard (the flight and the landing). */
  play: PlayBand;
}

export interface Chips {
  club: string;
  surface: string;
  /** 'Wind ▶▶', 'Slope ◀', 'Calm'. */
  wind: string;
  /** 'Pin 100 yd'. */
  pin: string;
}

/** The wind or slope chip text: arrows for how strong, pointing the way the ball is pushed. */
export function windChip(hole: Hole, putt: boolean): string {
  const strength = putt ? Math.abs(hole.slope) * 5 : Math.abs(hole.wind);
  const sign = putt ? hole.slope : hole.wind;
  const label = putt ? 'Slope' : 'Wind';
  const arrows = Math.min(Math.max(Math.round(strength), strength > 0 ? 1 : 0), 4);
  if (arrows === 0) return putt ? 'Flat' : 'Calm';
  return `${label} ${(sign > 0 ? '▶' : '◀').repeat(arrows)}`;
}

export const SURFACE_NAMES: Record<Surface, string> = {
  fairway: 'Fairway',
  rough: 'Rough',
  sand: 'Sand',
  green: 'Green',
  water: 'Water!',
  tree: 'Trees',
};

/** Room kept under a miss card for the finger and caption that point at the green answer. */
const TAP_ROOM = 104;
const TAP_ROOM_BIG = 116;

export interface Hud {
  buttons: HTMLButtonElement[];
  hear: HTMLButtonElement;
  /** What the finger and caption that point at the green answer keep off. */
  avoid: readonly HTMLElement[];
  swing: HTMLButtonElement;
  nudgeLeft: HTMLButtonElement;
  nudgeRight: HTMLButtonElement;
  renderCard(cells: readonly CardCell[]): void;
  /** The big scorecard in the middle of the screen, for the end of the round. */
  setCardBig(big: boolean, total?: string): void;
  showCard(visible: boolean): void;
  renderChips(chips: Chips, putt: boolean): void;
  renderMap(
    hole: Hole,
    ball: { x: number; z: number },
    landing: { x: number; z: number } | null,
  ): void;
  showMap(visible: boolean): void;
  showControls(visible: boolean): void;
  setQuestion(text: string): void;
  setOptions(options: string[]): void;
  showQuestion(visible: boolean, keepAnswers?: boolean): void;
  setClock(left: number | null, urgent: boolean): void;
  lock(): void;
  mark(chosen: number, correct: number, right: boolean): void;
  showBanner(title: string, detail: string, kind: BannerKind, where: 'aim' | 'ask'): void;
  hideBanner(): void;
  showPill(text: string): void;
  hidePill(): void;
  measureBands(): Bands;
  dispose(): void;
}

const MAP_HALF = 60;

export function createHud(): Hud {
  const body = document.body;
  const landscape = () => window.matchMedia?.('(min-aspect-ratio: 6/5)').matches ?? false;

  // ---------- The scorecard ----------
  const card = el('div', 'fg-card', body);
  card.setAttribute('role', 'img');
  const cells = Array.from({ length: 9 }, (_, i) => {
    const cell = el('div', 'fg-f', card);
    el('div', 'fg-fn', cell).textContent = String(i + 1);
    const par = el('div', 'fg-par', cell);
    const score = el('div', 'fg-s', cell);
    return { cell, par, score };
  });
  const total = el('div', 'fg-total', card);

  // ---------- The hole map ----------
  const map = el('div', 'fg-map', body);
  map.setAttribute('role', 'img');
  map.setAttribute('aria-label', 'Map of the hole');
  const mapSvg = svg('svg', { class: 'fg-map-svg', preserveAspectRatio: 'none' }, map);
  let mapHole: Hole | null = null;
  let mapLayer: SVGGElement | null = null;
  let ballDot: SVGEllipseElement | null = null;
  let aimLine: SVGLineElement | null = null;

  const buildMap = (h: Hole) => {
    mapHole = h;
    mapSvg.replaceChildren();
    mapSvg.setAttribute('viewBox', `${-MAP_HALF} 0 ${MAP_HALF * 2} ${h.length}`);
    // Up the page is down the hole: flip z.
    const g = svg('g', { transform: `translate(0 ${h.length}) scale(1 -1)` }, mapSvg);
    mapLayer = g;
    svg('rect', { x: -MAP_HALF, y: 0, width: MAP_HALF * 2, height: h.length, fill: '#4d8a3a' }, g);
    const left: string[] = [];
    const right: string[] = [];
    for (let z = 0; z <= h.length; z += 10) {
      left.push(`${centreX(h, z) - FAIRWAY_HALF},${z}`);
      right.unshift(`${centreX(h, z) + FAIRWAY_HALF},${z}`);
    }
    svg('polygon', { points: [...left, ...right].join(' '), fill: '#78c45a' }, g);
    svg('ellipse', { cx: h.pin.x, cy: h.pin.z, rx: GREEN_R, ry: GREEN_R, fill: '#a8e88a' }, g);
    for (const hz of h.hazards) {
      svg(
        'ellipse',
        {
          cx: hz.at.x,
          cy: hz.at.z,
          rx: hz.at.rx,
          ry: hz.at.rz,
          fill: hz.kind === 'sand' ? '#e8cf8f' : '#3f8fe0',
        },
        g,
      );
    }
    aimLine = svg('line', { stroke: '#fff', 'stroke-width': 3, 'stroke-dasharray': '6 5' }, g);
    svg('ellipse', { cx: h.pin.x, cy: h.pin.z, rx: 3.5, ry: 3.5, fill: '#ff3d3d' }, g);
    ballDot = svg('ellipse', { rx: 4, ry: 4, fill: '#fff', stroke: '#222', 'stroke-width': 1 }, g);
  };

  // ---------- The aim controls ----------
  const controls = el('div', 'fg-controls', body);
  const chips = el('div', 'fg-chips', controls);
  const leftGroup = el('div', 'fg-chipcol fg-chipleft', chips);
  const windChipEl = el('div', 'fg-chip fg-wind', leftGroup);
  const pinChip = el('div', 'fg-chip fg-pin', leftGroup);
  const clubGroup = el('div', 'fg-chipcol', chips);
  const clubChip = el('div', 'fg-chip fg-club', clubGroup);
  const lieChip = el('div', 'fg-chip fg-lie', clubGroup);
  const row = el('div', 'fg-row', controls);
  const nudgeLeft = el('button', 'fg-nudge fg-left', row);
  nudgeLeft.type = 'button';
  nudgeLeft.textContent = '◀';
  nudgeLeft.setAttribute('aria-label', 'Aim left');
  const swing = el('button', 'fg-swing', row);
  swing.type = 'button';
  swing.textContent = 'Swing!';
  const nudgeRight = el('button', 'fg-nudge fg-right', row);
  nudgeRight.type = 'button';
  nudgeRight.textContent = '▶';
  nudgeRight.setAttribute('aria-label', 'Aim right');

  // ---------- The question ----------
  const q = el('div', 'fg-q', body);
  q.setAttribute('aria-live', 'polite');
  const qText = el('span', 'fg-q-text', q);
  const hear = el('button', 'fg-hear', q);
  hear.type = 'button';
  hear.textContent = '🔊';
  hear.setAttribute('aria-label', 'Hear the question');
  const clock = el('div', 'fg-clock', q);
  clock.setAttribute('role', 'timer');
  clock.setAttribute('aria-label', 'Time left');
  const clockFill = el('i', '', clock);
  const answers = el('div', 'fg-answers', body);
  const buttons = Array.from({ length: 4 }, () => {
    const button = el('button', 'fg-answer', answers);
    button.type = 'button';
    return button;
  });
  q.hidden = true;
  answers.hidden = true;
  controls.hidden = true;
  map.hidden = true;

  // ---------- Messages ----------
  const banner = el('div', 'fg-banner', body);
  banner.setAttribute('role', 'status');
  const bannerTitle = el('div', 'fg-banner-title', banner);
  const bannerDetail = el('div', 'fg-banner-detail', banner);
  banner.hidden = true;
  const pill = el('div', 'fg-pill', body);
  pill.setAttribute('role', 'status');
  pill.hidden = true;

  let options: string[] = [];
  const rectOf = (node: HTMLElement) => node.getBoundingClientRect();

  const place = () => {
    const bottom = card.getBoundingClientRect().bottom;
    document.documentElement.style.setProperty('--fg-card-bottom', `${bottom}px`);
  };

  return {
    buttons,
    hear,
    avoid: [card, map, q, banner],
    swing,
    nudgeLeft,
    nudgeRight,

    renderCard(next) {
      next.forEach((c, i) => {
        const f = cells[i];
        f.par.textContent = `Par ${c.par}`;
        f.score.textContent = c.strokes === null ? '' : String(c.strokes);
        f.cell.classList.toggle('cur', c.current);
      });
      const played = next.filter((c) => c.strokes !== null && !c.current).length;
      card.setAttribute('aria-label', `Scorecard, ${played} holes played`);
      place();
    },
    setCardBig(big, text = '') {
      card.classList.toggle('big', big);
      total.textContent = text;
      place();
    },
    showCard(visible) {
      card.hidden = !visible;
    },

    renderChips(next, putt) {
      clubChip.textContent = next.club;
      lieChip.textContent = next.surface;
      windChipEl.textContent = next.wind;
      pinChip.textContent = next.pin;
      swing.textContent = putt ? 'Putt!' : 'Swing!';
      swing.setAttribute('aria-label', putt ? 'Putt' : 'Swing');
      lieChip.dataset.surface = next.surface;
    },
    renderMap(h, ball, landing) {
      if (mapHole !== h) buildMap(h);
      if (!mapLayer || !ballDot || !aimLine) return;
      const box = map.getBoundingClientRect();
      const sx = (box.width || 64) / (MAP_HALF * 2);
      const sy = (box.height || 112) / h.length;
      ballDot.setAttribute('cx', String(ball.x));
      ballDot.setAttribute('cy', String(ball.z));
      ballDot.setAttribute('rx', String(4));
      ballDot.setAttribute('ry', String((4 * sx) / sy));
      if (landing) {
        aimLine.setAttribute('x1', String(ball.x));
        aimLine.setAttribute('y1', String(ball.z));
        aimLine.setAttribute('x2', String(landing.x));
        aimLine.setAttribute('y2', String(landing.z));
        aimLine.style.display = '';
      } else {
        aimLine.style.display = 'none';
      }
    },
    showMap(visible) {
      map.hidden = !visible;
    },
    showControls(visible) {
      controls.hidden = !visible;
    },

    setQuestion(text) {
      qText.textContent = text;
    },
    setOptions(next) {
      options = next;
      fillAnswers(buttons, next, 'fg-answer');
    },
    showQuestion(visible, keepAnswers = false) {
      q.hidden = !visible;
      answers.hidden = !visible && !keepAnswers;
      buttons.forEach((b, i) => (b.hidden = options[i] === undefined));
      if (!visible) clock.classList.remove('on', 'urgent');
    },
    setClock(left, urgent) {
      clock.classList.toggle('on', left !== null);
      clock.classList.toggle('urgent', urgent);
      clockFill.style.width = left === null ? '100%' : `${Math.max(0, Math.min(1, left)) * 100}%`;
    },
    lock() {
      lockAnswers(buttons);
    },
    mark(chosen, correct, right) {
      markAnswers(buttons, chosen, correct, right);
    },

    showBanner(title, detail, kind, where) {
      bannerTitle.textContent = title;
      bannerDetail.textContent = detail;
      bannerDetail.hidden = !detail;
      banner.className = `fg-banner ${kind}`;
      banner.hidden = false;
      const viewH = window.innerHeight;
      const viewW = window.innerWidth;
      const wide = landscape();
      let anchor: number;
      let centre = viewW / 2;
      if (where === 'ask' && !answers.hidden) {
        anchor = wide ? viewH - 12 : rectOf(answers).top;
        if (wide) centre = (rectOf(answers).right + viewW) / 2;
      } else {
        const wasHidden = controls.hidden;
        controls.hidden = false;
        const box = rectOf(controls);
        controls.hidden = wasHidden;
        anchor = wide ? viewH - 12 : box.top;
        if (wide) centre = (box.left + 0) / 2;
      }
      const big = Math.min(viewW, viewH) >= 520;
      const room = kind === 'miss' && where === 'ask' ? (big ? TAP_ROOM_BIG : TAP_ROOM) : 0;
      banner.style.bottom = `${Math.max(viewH - anchor + 8 + room, 8)}px`;
      banner.style.left = `${centre}px`;
    },
    hideBanner() {
      banner.hidden = true;
    },
    showPill(text) {
      pill.textContent = text;
      pill.hidden = false;
      pill.classList.remove('on');
      void pill.offsetWidth;
      pill.classList.add('on');
      pill.style.top = `${card.getBoundingClientRect().bottom + 8 + 12}px`;
    },
    hidePill() {
      pill.hidden = true;
      pill.classList.remove('on');
    },

    measureBands() {
      place();
      const keep = { q: q.hidden, a: answers.hidden, c: controls.hidden, m: map.hidden };
      q.hidden = false;
      answers.hidden = false;
      controls.hidden = false;
      const cardBottom = card.getBoundingClientRect().bottom;
      const viewH = window.innerHeight;
      const viewW = window.innerWidth;
      const wide = landscape();
      const measured: Bands = wide
        ? {
            aim: {
              top: cardBottom + 8,
              bottom: viewH - 12,
              left: 0,
              right: rectOf(controls).left - 8,
            },
            ask: {
              top: cardBottom + 8,
              bottom: viewH - 12,
              left: rectOf(q).right + 8,
              right: viewW,
            },
            play: { top: cardBottom + 8, bottom: viewH - 12 },
          }
        : {
            aim: { top: cardBottom + 8, bottom: rectOf(row).top - 8 },
            ask: { top: rectOf(q).bottom + 8, bottom: rectOf(answers).top - 8 },
            play: { top: cardBottom + 8, bottom: viewH - 12 },
          };
      q.hidden = keep.q;
      answers.hidden = keep.a;
      controls.hidden = keep.c;
      map.hidden = keep.m;
      return measured;
    },
    dispose() {
      for (const node of [card, map, controls, q, answers, banner, pill]) node.remove();
    },
  };
}
