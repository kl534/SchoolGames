/**
 * The DOM of Recess Race: the panel under the buttons (heat, place, speed, score, best), the race
 * bar, the slot for the block of keys, the big centre texts, the YOU label, the comic word, the
 * pops and the podium card. Styles are `rr-*` in `index.html`.
 */
import { RIVAL_FACTORS, RACE_METRES } from './rules';

export interface RaceDot {
  metres: number;
}

export interface CardOptions {
  title: string;
  names: string[];
  heatLine: string;
  onRace: () => void;
}

export interface Hud {
  /** The column under the buttons: panel, race bar and the block's slot. */
  readonly top: HTMLElement;
  /** Put the block view's element in here. */
  readonly blockSlot: HTMLElement;
  setHeat(heat: number, goalWpm: number): void;
  setPlace(place: string): void;
  /** The player's live words a minute and how that compares with the goal (0 to 1 fills the bar). */
  setSpeed(wpm: number, share: number): void;
  setScore(score: number, best: number, multiplier: number): void;
  /** Moves the dots of the race bar: the player's, then each rival's (by `RIVAL_FACTORS` order). */
  setRace(player: number, rivals: readonly number[]): void;
  /** Big white text in the clear band; `fade` seconds fades it out (0 keeps it). */
  big(text: string, fade?: number): void;
  clearBig(): void;
  /** Places the "YOU ▼" label at a screen point (the player's head); null hides it. */
  you(at: { x: number; y: number } | null): void;
  /** The comic word over a head (a yellow SPLAT!); `hold` keeps it up. */
  splat(text: string, at: { x: number; y: number }, hold?: boolean): void;
  /** A small pop of text at a height (0 to 1) of the screen. */
  pop(text: string, y: number, kind: 'good' | 'plain'): void;
  showCard(options: CardOptions): void;
  hideCard(): void;
  /** Where the clear band is, in pixels from the top: under the block panel, above `bottom`. */
  clearTop(): number;
  show(shown: boolean): void;
  dispose(): void;
}

const fmt = (n: number): string => n.toLocaleString('en-US');

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createHud(rivalColours: (index: number) => string): Hud {
  const top = el('div', 'rr-top');
  top.hidden = true;

  const panel = el('div', 'rr-hud');
  const heat = el('span', 'rr-heat');
  const place = el('span', 'rr-place', '1st');
  const you = el('span', 'rr-you-speed');
  const youText = el('span', 'rr-you-text');
  const youBar = el('span', 'rr-you-bar');
  const youFill = el('span', 'rr-you-fill');
  youBar.appendChild(youFill);
  you.append(youText, youBar);
  const scoreBox = el('span', 'rr-scorebox');
  const score = el('span', 'rr-score');
  const badge = el('span', 'rr-badge');
  scoreBox.append(score, badge);
  const best = el('span', 'rr-best');
  panel.append(heat, place, you, scoreBox, best);

  const race = el('div', 'rr-race');
  const line = el('div', 'rr-line');
  const flag = el('span', 'rr-flag', '🏁');
  race.append(line, flag);
  const dots = RIVAL_FACTORS.map((_, i) => {
    const dot = el('span', 'rr-dot');
    dot.style.background = rivalColours(i);
    race.appendChild(dot);
    return dot;
  });
  const me = el('span', 'rr-dot rr-me', '★');
  race.appendChild(me);

  const blockSlot = el('div', 'rr-block');
  top.append(panel, race, blockSlot);
  document.body.appendChild(top);

  const bigText = el('div', 'rr-big');
  bigText.hidden = true;
  const youLabel = el('div', 'rr-you', 'YOU ▼');
  youLabel.hidden = true;
  const layer = el('div', 'rr-layer');
  document.body.append(bigText, youLabel, layer);
  let card: HTMLElement | null = null;

  const place01 = (node: HTMLElement, metres: number) => {
    const share = Math.min(Math.max(metres / RACE_METRES, 0), 1);
    node.style.left = `calc(${(share * 100).toFixed(2)}% - ${node === me ? 7 : 5}px)`;
  };
  const addTemp = (node: HTMLElement, seconds: number) => {
    layer.appendChild(node);
    setTimeout(() => node.remove(), seconds * 1000 + 100);
  };

  return {
    top,
    blockSlot,
    setHeat(n, goal) {
      heat.textContent = `Heat ${n} · ${goal} WPM goal`;
    },
    setPlace(text) {
      place.textContent = text;
    },
    setSpeed(wpm, share) {
      youText.textContent = `You: ${wpm} WPM`;
      youFill.style.width = `${Math.round(Math.min(Math.max(share, 0), 1) * 100)}%`;
    },
    setScore(n, bestScore, multiplier) {
      score.textContent = fmt(n);
      badge.hidden = multiplier <= 1;
      badge.textContent = `×${fmt(multiplier)}`;
      best.textContent = `Best ${fmt(Math.max(bestScore, n))}`;
    },
    setRace(player, rivals) {
      place01(me, player);
      dots.forEach((dot, i) => place01(dot, rivals[i] ?? 0));
    },
    big(text, fade = 0) {
      bigText.textContent = text;
      bigText.hidden = false;
      bigText.classList.remove('rr-fade');
      bigText.style.removeProperty('animation-duration');
      if (fade > 0) {
        void bigText.offsetWidth;
        bigText.style.animationDuration = `${fade}s`;
        bigText.classList.add('rr-fade');
      }
    },
    clearBig() {
      bigText.hidden = true;
      bigText.classList.remove('rr-fade');
    },
    you(at) {
      youLabel.hidden = at === null;
      if (at) {
        youLabel.style.left = `${at.x.toFixed(1)}px`;
        youLabel.style.top = `${at.y.toFixed(1)}px`;
      }
    },
    splat(text, at, hold = false) {
      const node = el('div', hold ? 'rr-splat hold' : 'rr-splat', text);
      node.style.left = `${at.x.toFixed(1)}px`;
      node.style.top = `${at.y.toFixed(1)}px`;
      if (hold) layer.appendChild(node);
      else addTemp(node, 0.8);
    },
    pop(text, y, kind) {
      const node = el('div', kind === 'good' ? 'rr-pop rr-good' : 'rr-pop', text);
      node.style.top = `${(y * window.innerHeight).toFixed(0)}px`;
      addTemp(node, 1.2);
    },
    showCard(o) {
      card?.remove();
      const node = el('div', 'rr-card');
      node.appendChild(el('h2', 'rr-card-title', o.title));
      const list = el('ol', 'rr-card-names');
      o.names.forEach((name, i) =>
        list.appendChild(el('li', '', `${['🥇', '🥈', '🥉'][i] ?? ''} ${name}`)),
      );
      node.appendChild(list);
      node.appendChild(el('p', 'rr-card-heat', o.heatLine));
      node.appendChild(el('p', 'rr-card-space', 'Press the space bar to race'));
      const button = el('button', 'rr-card-button', 'Race');
      button.type = 'button';
      button.addEventListener('click', o.onRace);
      node.appendChild(button);
      document.body.appendChild(node);
      card = node;
    },
    hideCard() {
      card?.remove();
      card = null;
    },
    clearTop() {
      return top.getBoundingClientRect().bottom;
    },
    show(shown) {
      top.hidden = !shown;
    },
    dispose() {
      top.remove();
      bigText.remove();
      youLabel.remove();
      layer.remove();
      card?.remove();
    },
  };
}
