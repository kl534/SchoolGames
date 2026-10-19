/**
 * The DOM on top of the picture: the question panel and road strip, the bikes left, the score,
 * the four answers, the banner, the comic word, the pops and the screen effects. Plain elements
 * styled in style.css (prefix `cc-`); the game loop in main.ts drives them.
 */
import type { MegaId, ObstacleKind } from './rules';
import { BIKES, MEGA_PIECES, multiplierFor } from './rules';

/** What the road strip's goal icon can show: an obstacle, a Mega course or a checkpoint gate. */
export type GoalKey = ObstacleKind | MegaId | 'gate';

export const GOAL_ICONS: Record<GoalKey, string> = {
  loop: '🌀',
  ramp: '🦈',
  ring: '🔥',
  crates: '📦',
  bridge: '🌉',
  seesaw: '⚖️',
  coaster: '🎢',
  halfpipe: '🛹',
  penguins: '🐧',
  wrecker: '🔨',
  gate: '🏁',
  'triple-loop': '🌀',
  'sky-circus': '🎪',
  'volcano-rush': '🌋',
};

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

const SVG = 'http://www.w3.org/2000/svg';

/** A little motorbike badge, drawn rather than typed so it looks the same everywhere. */
export function bikeIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 40 26');
  svg.setAttribute('aria-hidden', 'true');
  const add = (tag: string, attrs: Record<string, string>) => {
    const node = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    svg.appendChild(node);
  };
  add('circle', {
    cx: '8',
    cy: '18',
    r: '6',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '3',
  });
  add('circle', {
    cx: '32',
    cy: '18',
    r: '6',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '3',
  });
  add('path', {
    d: 'M8 18 15 8h9l8 10M24 8l-3-5h-5',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '3',
    'stroke-linejoin': 'round',
    'stroke-linecap': 'round',
  });
  add('path', { d: 'M13 9h10l-1 4h-10Z', fill: '#ffd43b' });
  return svg;
}

export interface Hud {
  /** Everything at the top centre: question, road strip, mega pips. */
  top: HTMLElement;
  problemText: HTMLElement;
  hear: HTMLButtonElement;
  answers: HTMLElement;
  buttons: HTMLButtonElement[];
  /** The big message under the question ("Wipeout!" and the like). */
  banner: HTMLElement;
  /** The player's avatar and the bikes left, under the Menu button. */
  setBikes(bikes: number, justLost?: boolean): void;
  setScore(score: number, streak: number, best: number, pulse?: boolean): void;
  /** Progress along the road strip: 0 at the start, 1 on arrival. */
  setRoad(progress: number, state: { urgent: boolean; waiting: boolean }): void;
  setGoal(key: GoalKey): void;
  /**
   * Mega Stunt pips: hidden when `total` is 0, else the first `done` are lit. With `missed` the
   * pip after them shows red, so the player sees which question stopped the chain.
   */
  setMega(total: number, done: number, missed?: boolean): void;
  showBanner(title: string, detail: string, kind: 'hit' | 'miss' | 'warn' | 'out'): void;
  hideBanner(): void;
  readonly bannerShown: boolean;
  showCount(text: string | null): void;
  /** A big comic word at a screen spot. */
  showWord(text: string, at: { x: number; y: number }, good: boolean): void;
  hideWord(): void;
  /** Floats a short message up from a spot on the screen. */
  pop(text: string, at: { x: number; y: number }, kind: 'good' | 'bad' | 'plain'): void;
  speedLines(on: boolean): void;
  flashCrash(): void;
  setTopVisible(visible: boolean, optionCount: number): void;
  lockAnswers(): void;
  /** Sets the four answer buttons to these texts and clears their states. */
  setAnswers(options: readonly string[]): void;
  dispose(): void;
}

export function createHud(avatar: string): Hud {
  const root = document.body;
  const created: HTMLElement[] = [];
  const make = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className: string,
    parent: HTMLElement,
  ) => {
    const node = el(tag, className, parent);
    if (parent === root) created.push(node);
    return node;
  };

  const top = make('div', 'cc-hud', root);
  const problem = make('div', 'cc-problem', top);
  problem.setAttribute('aria-live', 'polite');
  const problemText = make('span', 'cc-problem-text', problem);
  const hear = make('button', 'cc-hear', problem);
  hear.type = 'button';
  hear.textContent = '🔊';
  hear.setAttribute('aria-label', 'Hear the question');

  const roadBox = make('div', 'cc-road', top);
  const roadBar = make('div', 'cc-road-bar', roadBox);
  const roadFill = make('div', 'cc-road-fill', roadBar);
  const roadBike = make('div', 'cc-road-bike', roadBox);
  roadBike.appendChild(bikeIcon());
  const roadGoal = make('div', 'cc-road-goal', roadBox);
  roadGoal.textContent = GOAL_ICONS.loop;

  const mega = make('div', 'cc-mega', top);
  mega.setAttribute('role', 'img');
  const pips = Array.from({ length: MEGA_PIECES }, () => make('span', 'cc-mega-pip', mega));
  mega.hidden = true;

  const bikesBar = make('div', 'cc-bikes', root);
  const score = make('div', 'cc-score', root);
  const scoreRow = make('div', 'cc-score-row', score);
  const scoreValue = make('span', 'cc-score-value', scoreRow);
  const multBadge = make('span', 'cc-mult', scoreRow);
  const bestText = make('div', 'cc-best', score);

  const answers = make('div', 'cc-answers', root);
  const buttons = Array.from({ length: 4 }, () => {
    const button = make('button', 'cc-answer', answers);
    button.type = 'button';
    return button;
  });

  const banner = make('div', 'cc-banner', root);
  banner.setAttribute('role', 'status');
  const bannerTitle = make('div', 'cc-banner-title', banner);
  const bannerDetail = make('div', 'cc-banner-detail', banner);
  banner.hidden = true;
  const count = make('div', 'cc-count', root);
  count.setAttribute('aria-live', 'assertive');
  count.hidden = true;
  const word = make('div', 'cc-word', root);
  word.hidden = true;
  const speed = make('div', 'cc-speed', root);
  const flash = make('div', 'cc-flash', root);

  const restart = (node: HTMLElement) => {
    node.classList.remove('on');
    void node.offsetWidth;
    node.classList.add('on');
  };

  let goalKind: GoalKey = 'loop';
  const GOAL_W = 26;
  const BIKE_W = 34;
  let bikeCount = BIKES;

  const layoutBanner = () => {
    const rect = top.getBoundingClientRect();
    // With the question hidden the banner sits where the question would be.
    const spare = window.innerHeight <= 460 ? 8 : window.innerWidth <= 640 ? 144 : 12;
    banner.style.top = `${top.hidden ? spare : rect.bottom + 8}px`;
  };

  const api: Hud = {
    top,
    problemText,
    hear,
    answers,
    buttons,
    banner,
    get bannerShown() {
      return !banner.hidden;
    },
    setBikes(bikes, justLost = false) {
      bikeCount = bikes;
      const avatarNode = document.createElement('span');
      avatarNode.className = 'cc-avatar';
      avatarNode.textContent = avatar;
      const icons = Array.from({ length: BIKES }, (_, i) => {
        const icon = document.createElement('span');
        icon.className = `cc-bike${i >= bikes ? ' lost' : ''}`;
        icon.appendChild(bikeIcon());
        return icon;
      });
      bikesBar.replaceChildren(avatarNode, ...icons);
      bikesBar.setAttribute('role', 'img');
      bikesBar.setAttribute('aria-label', `${bikes} of ${BIKES} bikes left`);
      if (!justLost) return;
      // The bike that was just lost pops off the bar and floats away.
      const rect = icons[bikes].getBoundingClientRect();
      const fly = make('span', 'cc-bike-fly', root);
      fly.appendChild(bikeIcon());
      fly.style.left = `${rect.left}px`;
      fly.style.top = `${rect.top}px`;
      fly.addEventListener('animationend', () => fly.remove());
      setTimeout(() => fly.remove(), 1200);
    },
    setScore(value, streak, best, pulse = false) {
      scoreValue.textContent = value.toLocaleString();
      const multiplier = multiplierFor(streak);
      multBadge.hidden = multiplier === 1;
      multBadge.textContent = `×${multiplier}`;
      bestText.textContent = `Best ${best.toLocaleString()}`;
      if (pulse) restart(scoreValue);
    },
    setRoad(progress, state) {
      const p = Math.min(Math.max(progress, 0), 1);
      roadFill.style.transform = `scaleX(${p})`;
      const width = roadBox.clientWidth;
      const usable = Math.max(width - GOAL_W - BIKE_W * 0.5, 1);
      roadBike.style.transform = `translateX(${(p * usable).toFixed(1)}px)`;
      roadBox.classList.toggle('urgent', state.urgent);
      roadBox.classList.toggle('waiting', state.waiting);
    },
    setGoal(key) {
      goalKind = key;
      roadGoal.textContent = GOAL_ICONS[goalKind];
    },
    setMega(total, done, missed = false) {
      mega.hidden = total === 0;
      pips.forEach((pip, i) => {
        pip.hidden = i >= total;
        pip.classList.toggle('lit', i < done);
        pip.classList.toggle('miss', missed && i === done);
      });
      mega.setAttribute(
        'aria-label',
        `Mega Stunt: ${done} of ${total} right${missed ? ', then a miss' : ''}`,
      );
      void bikeCount;
    },
    showBanner(title, detail, kind) {
      bannerTitle.textContent = title;
      bannerDetail.textContent = detail;
      bannerDetail.hidden = !detail;
      banner.className = `cc-banner ${kind}`;
      banner.hidden = false;
      layoutBanner();
    },
    hideBanner() {
      banner.hidden = true;
    },
    showCount(text) {
      if (text === null) {
        count.hidden = true;
        return;
      }
      count.textContent = text;
      count.hidden = false;
      restart(count);
    },
    showWord(text, at, good) {
      word.textContent = text;
      word.className = `cc-word ${good ? 'good' : 'bad'}`;
      word.style.top = `${at.y}px`;
      word.style.setProperty('--tilt', `${(Math.random() * 10 - 5).toFixed(1)}deg`);
      word.hidden = false;
      // A long word shrinks to fit the screen (the CSS size is clamp(34px, 9vmin, 76px)).
      const base = Math.min(
        Math.max(Math.min(window.innerWidth, window.innerHeight) * 0.09, 34),
        76,
      );
      word.style.fontSize = `${Math.min(base, (window.innerWidth - 24) / (text.length * 0.66)).toFixed(1)}px`;
      // Keep the whole word on screen, whatever its length.
      const half = word.offsetWidth / 2 + 8;
      word.style.left = `${Math.min(Math.max(at.x, half), Math.max(window.innerWidth - half, half))}px`;
      restart(word);
    },
    hideWord() {
      word.hidden = true;
    },
    pop(text, at, kind) {
      const node = make('div', `cc-pop ${kind}`, root);
      node.textContent = text;
      node.style.left = `${at.x}px`;
      node.style.top = `${at.y}px`;
      node.addEventListener('animationend', () => node.remove());
      setTimeout(() => node.remove(), 1600);
    },
    speedLines(on) {
      speed.classList.toggle('on', on);
    },
    flashCrash() {
      restart(flash);
    },
    setTopVisible(visible, optionCount) {
      top.hidden = !visible;
      answers.hidden = !visible;
      buttons.forEach((b, i) => (b.hidden = i >= optionCount));
      if (!visible) banner.hidden = true;
      else if (!banner.hidden) layoutBanner();
    },
    lockAnswers() {
      buttons.forEach((b) => b.setAttribute('aria-disabled', 'true'));
    },
    setAnswers(options) {
      buttons.forEach((button, i) => {
        const text = options[i];
        button.textContent = text ?? '';
        button.setAttribute('aria-label', `Answer ${text ?? ''}`);
        button.removeAttribute('aria-disabled');
        button.className = 'cc-answer';
      });
    },
    dispose() {
      created.forEach((node) => node.remove());
    },
  };
  api.setBikes(BIKES);
  return api;
}
