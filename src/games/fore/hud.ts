import { fillAnswers, lockAnswers, markAnswers } from '../../shared/answers';
import { onPress } from '../../shared/input';
import { centreX, FAIRWAY_HALF, GREEN_R, surfaceAt, type Hole, type Surface } from './course';
import { isPutt, reachFor, TURN_MAX, type Lie, type Plan, type Result, type XZ } from './shot';
import { ringColour } from './guide';
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
  /** '7-iron · 112 yd', or 'Putter · 6 yd'. */
  club: string;
  /** What the ring is over. */
  surface: string;
  /** 'Pin 100 yd'. */
  pin: string;
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
  /** ▲ and ▼: the ring farther and shorter. */
  farther: HTMLButtonElement;
  shorter: HTMLButtonElement;
  renderCard(cells: readonly CardCell[]): void;
  /** The big scorecard in the middle of the screen, for the end of the round. */
  setCardBig(big: boolean, total?: string): void;
  showCard(visible: boolean): void;
  renderChips(chips: Chips, putt: boolean): void;
  /** The corner map: the ball and, when `ring` is given, the ring (white, red over water, amber over sand). */
  renderMap(hole: Hole, ball: XZ, ring: { at: XZ; r: number; over: Surface } | null): void;
  showMap(visible: boolean): void;
  /** A finger dragged on the corner or big map: the world spot under it. */
  onMapPlace(cb: (p: XZ) => void): void;
  /** A tap on the corner map. */
  onMapTap(cb: () => void): void;
  /** Opens (or redraws) the big map: `rest` is where a perfect shot should stop. */
  showBigMap(hole: Hole, ball: XZ, plan: Plan, rest: Result, lie: Lie): void;
  hideBigMap(): void;
  readonly bigMapOpen: boolean;
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

/** The part of the hole the big map shows, yards down the hole. */
export function bigMapSpan(hole: Hole, ballZ: number): { z0: number; z1: number } {
  return { z0: ballZ - 20, z1: Math.min(hole.length + 30, ballZ + 280) };
}

/** The matrix that draws world (x, z) on the big map: up the page, or (landscape) left to right. */
function bigMapMatrix(landscape: boolean, z0: number, z1: number): string {
  return landscape ? `matrix(0 1 1 0 ${-z0} ${MAP_HALF})` : `matrix(1 0 0 -1 ${MAP_HALF} ${z1})`;
}

/**
 * The world spot under a point (px, py) of the big map's picture, which fills `box` (px) and is
 * fitted inside it with its true proportions.
 */
export function bigMapWorld(
  landscape: boolean,
  span: { z0: number; z1: number },
  box: { w: number; h: number },
  px: number,
  py: number,
): XZ {
  const vw = landscape ? span.z1 - span.z0 : MAP_HALF * 2;
  const vh = landscape ? MAP_HALF * 2 : span.z1 - span.z0;
  const scale = Math.min(box.w / vw, box.h / vh);
  const ux = (px - (box.w - vw * scale) / 2) / scale;
  const uy = (py - (box.h - vh * scale) / 2) / scale;
  return landscape ? { x: uy - MAP_HALF, z: ux + span.z0 } : { x: ux - MAP_HALF, z: span.z1 - uy };
}

/** The corner map's world spot for a point (px, py) of its picture. */
export function cornerMapWorld(
  hole: Hole,
  box: { w: number; h: number },
  px: number,
  py: number,
): XZ {
  return {
    x: -MAP_HALF + (px / Math.max(box.w, 1)) * 2 * MAP_HALF,
    z: hole.length * (1 - py / Math.max(box.h, 1)),
  };
}

/** A finger on the corner map moving more than this (px) drags the ring; a lift within it taps. */
const MAP_DRAG_PX = 6;
const MAP_TAP_PX = 10;
const MAP_TAP_MS = 300;

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
  let ringShape: SVGEllipseElement | null = null;

  /** Draws the hole's ground and hazards into `g` (world units: x across, z down the hole). */
  const drawGround = (g: Element, h: Hole, x0: number, x1: number, z0: number, z1: number) => {
    svg('rect', { x: x0, y: z0, width: x1 - x0, height: z1 - z0, fill: '#4d8a3a' }, g);
    const left: string[] = [];
    const right: string[] = [];
    for (let z = Math.max(z0, 0); z <= Math.min(z1, h.length); z += 10) {
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
  };

  const buildMap = (h: Hole) => {
    mapHole = h;
    mapSvg.replaceChildren();
    mapSvg.setAttribute('viewBox', `${-MAP_HALF} 0 ${MAP_HALF * 2} ${h.length}`);
    // Up the page is down the hole: flip z.
    const g = svg('g', { transform: `translate(0 ${h.length}) scale(1 -1)` }, mapSvg);
    mapLayer = g;
    drawGround(g, h, -MAP_HALF, MAP_HALF, 0, h.length);
    aimLine = svg(
      'line',
      {
        stroke: '#fff',
        'stroke-width': 2,
        'stroke-dasharray': '6 5',
        'vector-effect': 'non-scaling-stroke',
      },
      g,
    );
    svg('ellipse', { cx: h.pin.x, cy: h.pin.z, rx: 3.5, ry: 3.5, fill: '#ff3d3d' }, g);
    ringShape = svg(
      'ellipse',
      {
        fill: 'rgba(255,255,255,0.25)',
        stroke: '#fff',
        'stroke-width': 1.5,
        'vector-effect': 'non-scaling-stroke',
      },
      g,
    );
    ballDot = svg('ellipse', { rx: 4, ry: 4, fill: '#fff', stroke: '#222', 'stroke-width': 1 }, g);
  };

  // ---------- The aim controls ----------
  const controls = el('div', 'fg-controls', body);
  const chips = el('div', 'fg-chips', controls);
  const leftGroup = el('div', 'fg-chipcol fg-chipleft', chips);
  const pinChip = el('div', 'fg-chip fg-pin', leftGroup);
  const clubGroup = el('div', 'fg-chipcol', chips);
  const clubChip = el('div', 'fg-chip fg-club', clubGroup);
  const lieChip = el('div', 'fg-chip fg-lie', clubGroup);
  const distGroup = el('div', 'fg-dist', chips);
  const farther = el('button', 'fg-nudge fg-farther', distGroup);
  farther.type = 'button';
  farther.textContent = '▲';
  farther.setAttribute('aria-label', 'Farther');
  const shorter = el('button', 'fg-nudge fg-shorter', distGroup);
  shorter.type = 'button';
  shorter.textContent = '▼';
  shorter.setAttribute('aria-label', 'Shorter');
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

  // ---------- The corner map's finger ----------
  let placeCb: ((p: XZ) => void) | null = null;
  let tapCb: (() => void) | null = null;
  let finger: { id: number; x: number; y: number; at: number; dragging: boolean } | null = null;
  const cornerPoint = (e: PointerEvent): XZ | null => {
    const box = mapSvg.getBoundingClientRect();
    if (!mapHole || !box.width) return null;
    return cornerMapWorld(
      mapHole,
      { w: box.width, h: box.height },
      e.clientX - box.left,
      e.clientY - box.top,
    );
  };
  map.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (finger || !e.isPrimary) return;
    finger = { id: e.pointerId, x: e.clientX, y: e.clientY, at: e.timeStamp, dragging: false };
    map.setPointerCapture?.(e.pointerId);
  });
  map.addEventListener('pointermove', (e) => {
    e.stopPropagation();
    if (!finger || finger.id !== e.pointerId) return;
    if (!finger.dragging && Math.hypot(e.clientX - finger.x, e.clientY - finger.y) > MAP_DRAG_PX) {
      finger.dragging = true;
    }
    const p = finger.dragging ? cornerPoint(e) : null;
    if (p) placeCb?.(p);
  });
  const mapUp = (e: PointerEvent) => {
    e.stopPropagation();
    if (!finger || finger.id !== e.pointerId) return;
    const tap =
      !finger.dragging &&
      Math.hypot(e.clientX - finger.x, e.clientY - finger.y) <= MAP_TAP_PX &&
      e.timeStamp - finger.at <= MAP_TAP_MS;
    finger = null;
    if (tap && e.type === 'pointerup') tapCb?.();
  };
  map.addEventListener('pointerup', mapUp);
  map.addEventListener('pointercancel', mapUp);

  // ---------- The big map ----------
  const big = el('div', 'fg-bigmap', body);
  big.hidden = true;
  const bigPanel = el('div', 'fg-bigmap-panel', big);
  const bigSvg = svg(
    'svg',
    { class: 'fg-bigmap-svg', preserveAspectRatio: 'xMidYMid meet' },
    bigPanel,
  );
  const bigDone = el('button', 'fg-bigmap-done', bigPanel);
  bigDone.type = 'button';
  bigDone.textContent = 'Done';
  let bigSpan = { z0: 0, z1: 100 };
  let bigLandscape = false;
  const closeBig = () => {
    big.hidden = true;
    controls.style.visibility = '';
  };
  const bigPoint = (e: PointerEvent): XZ => {
    const box = bigSvg.getBoundingClientRect();
    return bigMapWorld(
      bigLandscape,
      bigSpan,
      { w: box.width, h: box.height },
      e.clientX - box.left,
      e.clientY - box.top,
    );
  };
  let bigFinger: number | null = null;
  big.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (e.target === big) {
      closeBig();
      return;
    }
    if ((e.target as Element).closest('.fg-bigmap-done') || bigFinger !== null) return;
    bigFinger = e.pointerId;
    bigPanel.setPointerCapture?.(e.pointerId);
    placeCb?.(bigPoint(e));
  });
  big.addEventListener('pointermove', (e) => {
    e.stopPropagation();
    if (bigFinger === e.pointerId) placeCb?.(bigPoint(e));
  });
  const bigUp = (e: PointerEvent) => {
    e.stopPropagation();
    if (bigFinger === e.pointerId) bigFinger = null;
  };
  big.addEventListener('pointerup', bigUp);
  big.addEventListener('pointercancel', bigUp);
  const unpressDone = onPress(bigDone, closeBig);

  const renderBig = (h: Hole, ball: XZ, plan: Plan, rest: Result, lie: Lie) => {
    bigLandscape = landscape();
    bigSpan = bigMapSpan(h, ball.z);
    const { z0, z1 } = bigSpan;
    bigSvg.replaceChildren();
    bigSvg.setAttribute(
      'viewBox',
      bigLandscape ? `0 0 ${z1 - z0} ${MAP_HALF * 2}` : `0 0 ${MAP_HALF * 2} ${z1 - z0}`,
    );
    // Nothing is drawn outside the part of the hole the map shows.
    const clip = svg('clipPath', { id: 'fg-bigmap-clip', clipPathUnits: 'userSpaceOnUse' }, bigSvg);
    const g = svg(
      'g',
      { transform: bigMapMatrix(bigLandscape, z0, z1), 'clip-path': 'url(#fg-bigmap-clip)' },
      bigSvg,
    );
    svg('rect', { x: -MAP_HALF, y: z0, width: MAP_HALF * 2, height: z1 - z0 }, clip);
    drawGround(g, h, -MAP_HALF, MAP_HALF, z0, z1);
    for (const tr of h.trees) svg('circle', { cx: tr.x, cy: tr.z, r: tr.r, fill: '#1f5a2a' }, g);
    svg('circle', { cx: h.pin.x, cy: h.pin.z, r: 1.6, fill: '#ff3d3d' }, g);
    // How far this lie reaches, and the half turn either side of the pin.
    const reach = reachFor(lie);
    const base = Math.atan2(h.pin.x - ball.x, h.pin.z - ball.z);
    const arc: string[] = [];
    for (let i = 0; i <= 36; i++) {
      const a = base + ((i / 36) * 2 - 1) * ((TURN_MAX * Math.PI) / 180);
      arc.push(`${ball.x + reach * Math.sin(a)},${ball.z + reach * Math.cos(a)}`);
    }
    svg(
      'polyline',
      {
        points: arc.join(' '),
        fill: 'none',
        stroke: 'rgba(255,255,255,0.55)',
        'stroke-width': 0.8,
      },
      g,
    );
    const over = surfaceAt(h, plan.landing.x, plan.landing.z);
    const colour = `#${ringColour(over).toString(16).padStart(6, '0')}`;
    svg(
      'line',
      {
        x1: ball.x,
        y1: ball.z,
        x2: plan.landing.x,
        y2: plan.landing.z,
        stroke: '#fff',
        'stroke-width': 0.8,
        'stroke-dasharray': '2 2',
      },
      g,
    );
    svg(
      'circle',
      {
        cx: plan.landing.x,
        cy: plan.landing.z,
        r: plan.ringR,
        fill: 'rgba(255,255,255,0.25)',
        stroke: colour,
        'stroke-width': 1.2,
      },
      g,
    );
    const stop =
      rest.kind === 'rest' && rest.tree === undefined
        ? rest.at
        : rest.kind === 'water'
          ? rest.splash
          : null;
    if (
      stop &&
      !isPutt(plan) &&
      Math.hypot(stop.x - plan.landing.x, stop.z - plan.landing.z) >= 0.5
    ) {
      const bad = rest.kind === 'water' || (rest.kind === 'rest' && rest.surface === 'sand');
      const tint = bad ? '#ff4b4b' : '#fff';
      svg(
        'line',
        {
          x1: plan.landing.x,
          y1: plan.landing.z,
          x2: stop.x,
          y2: stop.z,
          stroke: tint,
          'stroke-width': 1,
          'stroke-dasharray': '1 2',
        },
        g,
      );
      svg(
        'circle',
        { cx: stop.x, cy: stop.z, r: 1.6, fill: 'none', stroke: tint, 'stroke-width': 0.9 },
        g,
      );
    }
    svg(
      'circle',
      { cx: ball.x, cy: ball.z, r: 2, fill: '#fff', stroke: '#222', 'stroke-width': 0.6 },
      g,
    );
  };

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
    farther,
    shorter,

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
      pinChip.textContent = next.pin;
      swing.textContent = putt ? 'Putt!' : 'Swing!';
      swing.setAttribute('aria-label', putt ? 'Putt' : 'Swing');
      lieChip.dataset.surface = next.surface;
    },
    renderMap(h, ball, ring) {
      if (mapHole !== h) buildMap(h);
      if (!mapLayer || !ballDot || !aimLine || !ringShape) return;
      const box = map.getBoundingClientRect();
      const sx = (box.width || 84) / (MAP_HALF * 2);
      const sy = (box.height || 150) / h.length;
      ballDot.setAttribute('cx', String(ball.x));
      ballDot.setAttribute('cy', String(ball.z));
      ballDot.setAttribute('rx', String(4));
      ballDot.setAttribute('ry', String((4 * sx) / sy));
      if (ring) {
        aimLine.setAttribute('x1', String(ball.x));
        aimLine.setAttribute('y1', String(ball.z));
        aimLine.setAttribute('x2', String(ring.at.x));
        aimLine.setAttribute('y2', String(ring.at.z));
        aimLine.style.display = '';
        // A circle at the ring's true size, though never smaller than a few pixels.
        const rx = Math.max(ring.r, 3 / sx);
        const colour = `#${ringColour(ring.over).toString(16).padStart(6, '0')}`;
        ringShape.setAttribute('cx', String(ring.at.x));
        ringShape.setAttribute('cy', String(ring.at.z));
        ringShape.setAttribute('rx', String(rx));
        ringShape.setAttribute('ry', String((rx * sx) / sy));
        ringShape.setAttribute('stroke', colour);
        ringShape.style.display = '';
      } else {
        aimLine.style.display = 'none';
        ringShape.style.display = 'none';
      }
    },
    showMap(visible) {
      map.hidden = !visible;
    },
    onMapPlace(cb) {
      placeCb = cb;
    },
    onMapTap(cb) {
      tapCb = cb;
    },
    showBigMap(h, ball, plan, rest, lie) {
      big.hidden = false;
      controls.style.visibility = 'hidden';
      renderBig(h, ball, plan, rest, lie);
    },
    hideBigMap: closeBig,
    get bigMapOpen() {
      return !big.hidden;
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
            aim: { top: cardBottom + 8, bottom: rectOf(controls).top - 8 },
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
      unpressDone();
      for (const node of [card, map, big, controls, q, answers, banner, pill]) node.remove();
    },
  };
}
