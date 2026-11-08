/**
 * The DOM on top of the picture: the question panel and wake strip, the jet skis left, the score
 * and tier meter, the four answers, the banner, the comic word, the pops and the screen effects.
 * Plain elements styled in style.css (prefix `sz-`); the game loop in main.ts drives them.
 */
import { fillAnswers, lockAnswers } from '../../shared/answers';
import { MEGA_PIECES, SKIS, type LauncherKind, type MegaId } from './rules';

/** What the wake strip's goal icon can show: a launcher, a checkpoint gate or a Mega course. */
export type Goal = LauncherKind | 'gate' | MegaId;

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

/** The least gap from the screen's side edges for comic words and pops (px), and how much they overshoot when they pop. */
const EDGE = 12;
const POP_SCALE = 1.2;

function svgIcon(viewBox: string): {
  svg: SVGSVGElement;
  add(tag: string, attrs: Record<string, string>): void;
} {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('aria-hidden', 'true');
  return {
    svg,
    add(tag, attrs) {
      const node = document.createElementNS(SVG, tag);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
      svg.appendChild(node);
    },
  };
}

/** A little jet ski badge, drawn rather than typed so it looks the same everywhere. */
export function skiIcon(): SVGSVGElement {
  const { svg, add } = svgIcon('0 0 40 26');
  // The hull, a bow that sweeps up and a flat stern.
  add('path', {
    d: 'M2 17c4 0 5-2 10-2h14l8-6c1 3 1 6-1 9-3 4-8 5-15 5H8c-4 0-6-2-6-6Z',
    fill: 'currentColor',
  });
  // The seat and the handlebar post.
  add('path', { d: 'M11 13h10l-2-4h-6Z', fill: '#23232e' });
  add('path', {
    d: 'M27 9l-3-5h-3',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2.6',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
  // A little spray at the back.
  add('path', { d: 'M1 21c2 1 4 1 6 0', fill: 'none', stroke: '#bfeaff', 'stroke-width': '2' });
  return svg;
}

/** One wave of the tier meter. */
export function waveIcon(): SVGSVGElement {
  const { svg, add } = svgIcon('0 0 28 28');
  add('path', {
    d: 'M2 20c3 0 4-3 4-7 0-5 5-9 11-8-5 2-6 6-4 9 1 2 4 3 7 1 0 5-4 9-10 9H2Z',
    fill: 'currentColor',
  });
  add('path', { d: 'M17 5c3-1 6 1 7 4', fill: 'none', stroke: '#fff', 'stroke-width': '1.6' });
  return svg;
}

/** The launcher icons on the wake strip: a wave emoji, and a kicker and a mega ramp drawn small. */
export function launcherIcon(kind: Goal): Node {
  if (kind === 'wave') return document.createTextNode('🌊');
  if (kind === 'whale-of-a-time') return document.createTextNode('🐳');
  if (kind === 'harbour-havoc') return document.createTextNode('🌉');
  const { svg, add } = svgIcon('0 0 26 26');
  if (kind === 'gate') {
    // Two striped buoys and the banner arch between them.
    add('rect', { x: '4', y: '8', width: '4', height: '15', rx: '2', fill: '#ff5a5a' });
    add('rect', { x: '4', y: '13', width: '4', height: '4', fill: '#fff' });
    add('rect', { x: '18', y: '8', width: '4', height: '15', rx: '2', fill: '#ff5a5a' });
    add('rect', { x: '18', y: '13', width: '4', height: '4', fill: '#fff' });
    add('path', { d: 'M5 9Q13 1 21 9', fill: 'none', stroke: '#ffd43b', 'stroke-width': '3' });
  } else if (kind === 'kicker') {
    add('path', { d: 'M2 21 22 21 22 11Z', fill: '#ff5a5a' });
    add('path', { d: 'M9 21 22 21 22 11 19 11Z', fill: '#fff' });
    add('rect', { x: '2', y: '21', width: '22', height: '3', rx: '1.5', fill: '#ffd43b' });
  } else {
    add('path', { d: 'M2 21 22 21 22 3Z', fill: '#ffd43b' });
    add('path', { d: 'M10 21 15 21 22 3 19 3Z', fill: '#2b2b35' });
    add('rect', { x: '1', y: '21', width: '24', height: '4', rx: '1.5', fill: '#3a4152' });
    add('path', { d: 'M22 3v-3l4 1.5Z', fill: '#e8403a' });
  }
  return svg;
}

export interface Hud {
  /** Everything at the top centre: question, wake strip, mega pips. */
  top: HTMLElement;
  problemText: HTMLElement;
  hear: HTMLButtonElement;
  answers: HTMLElement;
  buttons: HTMLButtonElement[];
  /** The big message under the question ("Wipeout!" and the like). */
  banner: HTMLElement;
  /** The player's avatar and the jet skis left, under the Menu button. */
  setSkis(skis: number, justLost?: boolean): void;
  setScore(score: number, best: number, pulse?: boolean): void;
  /** The tier meter: 0 to 3 waves filled; `pulse` makes the newly filled one pop. */
  setTier(tier: 0 | 1 | 2 | 3, pulse?: boolean): void;
  /** How many waves of the tier meter are filled now. */
  readonly tierShown: number;
  /** Progress along the wake strip: 0 at the start, 1 on arrival. */
  setWake(progress: number, state: { urgent: boolean; waiting: boolean }): void;
  /** The launcher icon at the end of the wake strip. */
  setLauncher(kind: Goal): void;
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

  const top = make('div', 'sz-hud', root);
  const problem = make('div', 'sz-problem', top);
  problem.setAttribute('aria-live', 'polite');
  const problemText = make('span', 'sz-problem-text', problem);
  const hear = make('button', 'sz-hear', problem);
  hear.type = 'button';
  hear.textContent = '🔊';
  hear.setAttribute('aria-label', 'Hear the question');

  const wakeBox = make('div', 'sz-wake', top);
  const wakeBar = make('div', 'sz-wake-bar', wakeBox);
  const wakeFill = make('div', 'sz-wake-fill', wakeBar);
  const wakeSki = make('div', 'sz-wake-ski', wakeBox);
  wakeSki.appendChild(skiIcon());
  const wakeGoal = make('div', 'sz-wake-goal', wakeBox);
  wakeGoal.appendChild(launcherIcon('wave'));

  const mega = make('div', 'sz-mega', top);
  mega.setAttribute('role', 'img');
  const pips = Array.from({ length: MEGA_PIECES }, () => make('span', 'sz-mega-pip', mega));
  mega.hidden = true;

  const skisBar = make('div', 'sz-skis', root);
  const score = make('div', 'sz-score', root);
  const scoreValue = make('div', 'sz-score-value', score);
  const bestText = make('div', 'sz-best', score);
  const meter = make('div', 'sz-tier', score);
  meter.setAttribute('role', 'img');
  const waves = Array.from({ length: 3 }, () => {
    const wave = make('span', 'sz-tier-wave', meter);
    wave.appendChild(waveIcon());
    return wave;
  });

  const answers = make('div', 'sz-answers', root);
  const buttons = Array.from({ length: 4 }, () => {
    const button = make('button', 'sz-answer', answers);
    button.type = 'button';
    return button;
  });

  const banner = make('div', 'sz-banner', root);
  banner.setAttribute('role', 'status');
  const bannerTitle = make('div', 'sz-banner-title', banner);
  const bannerDetail = make('div', 'sz-banner-detail', banner);
  banner.hidden = true;
  const count = make('div', 'sz-count', root);
  count.setAttribute('aria-live', 'assertive');
  count.hidden = true;
  const word = make('div', 'sz-word', root);
  word.hidden = true;
  const speed = make('div', 'sz-speed', root);
  const flash = make('div', 'sz-flash', root);

  const restart = (node: HTMLElement) => {
    node.classList.remove('on');
    void node.offsetWidth;
    node.classList.add('on');
  };

  const GOAL_W = 26;
  const SKI_W = 34;
  let filled = 0;

  const layoutBanner = () => {
    const rect = top.getBoundingClientRect();
    // With the question hidden the banner sits where the question would be.
    const spare = window.innerHeight <= 460 ? 8 : window.innerWidth <= 640 ? 178 : 12;
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
    get tierShown() {
      return filled;
    },
    setSkis(skis, justLost = false) {
      const avatarNode = document.createElement('span');
      avatarNode.className = 'sz-avatar';
      avatarNode.textContent = avatar;
      const icons = Array.from({ length: SKIS }, (_, i) => {
        const icon = document.createElement('span');
        icon.className = `sz-ski${i >= skis ? ' lost' : ''}`;
        icon.appendChild(skiIcon());
        return icon;
      });
      skisBar.replaceChildren(avatarNode, ...icons);
      skisBar.setAttribute('role', 'img');
      skisBar.setAttribute('aria-label', `${skis} of ${SKIS} jet skis left`);
      if (!justLost) return;
      // The jet ski that was just lost pops off the bar and floats away.
      const rect = icons[skis].getBoundingClientRect();
      const fly = make('span', 'sz-ski-fly', root);
      fly.appendChild(skiIcon());
      fly.style.left = `${rect.left}px`;
      fly.style.top = `${rect.top}px`;
      fly.addEventListener('animationend', () => fly.remove());
      setTimeout(() => fly.remove(), 1200);
    },
    setScore(value, best, pulse = false) {
      scoreValue.textContent = value.toLocaleString();
      bestText.textContent = `Best ${best.toLocaleString()}`;
      if (pulse) restart(scoreValue);
    },
    setTier(tier, pulse = false) {
      waves.forEach((wave, i) => wave.classList.toggle('lit', i < tier));
      meter.setAttribute('aria-label', `Trick level ${tier} of 3`);
      if (pulse && tier > filled && tier > 0) restart(waves[tier - 1]);
      filled = tier;
    },
    setWake(progress, state) {
      const p = Math.min(Math.max(progress, 0), 1);
      wakeFill.style.transform = `scaleX(${p})`;
      const width = wakeBox.clientWidth;
      const usable = Math.max(width - GOAL_W - SKI_W * 0.5, 1);
      wakeSki.style.transform = `translateX(${(p * usable).toFixed(1)}px)`;
      wakeBox.classList.toggle('urgent', state.urgent);
      wakeBox.classList.toggle('waiting', state.waiting);
    },
    setLauncher(kind) {
      wakeGoal.replaceChildren(launcherIcon(kind));
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
    },
    showBanner(title, detail, kind) {
      bannerTitle.textContent = title;
      bannerDetail.textContent = detail;
      bannerDetail.hidden = !detail;
      banner.className = `sz-banner ${kind}`;
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
      word.className = `sz-word ${good ? 'good' : 'bad'}`;
      word.style.top = `${at.y}px`;
      word.style.setProperty('--tilt', `${(Math.random() * 10 - 5).toFixed(1)}deg`);
      word.hidden = false;
      // A long word shrinks to fit the screen (the CSS size is clamp(34px, 9vmin, 76px)).
      const base = Math.min(
        Math.max(Math.min(window.innerWidth, window.innerHeight) * 0.09, 34),
        76,
      );
      word.style.fontSize = `${Math.min(base, (window.innerWidth - 2 * EDGE - 16) / (text.length * 0.72)).toFixed(1)}px`;
      // Keep the whole word on screen (12 px from each edge, even while it pops up 18 % bigger).
      const half = (word.offsetWidth / 2) * POP_SCALE + EDGE;
      const room = window.innerWidth / 2;
      word.style.left = `${Math.min(Math.max(at.x, Math.min(half, room)), Math.max(window.innerWidth - half, room))}px`;
      restart(word);
    },
    hideWord() {
      word.hidden = true;
    },
    pop(text, at, kind) {
      const node = make('div', `sz-pop ${kind}`, root);
      node.textContent = text;
      // Clamp it so the whole message stays on screen, 12 px from each edge.
      const half = (node.offsetWidth / 2) * POP_SCALE + EDGE;
      const room = window.innerWidth / 2;
      node.style.left = `${Math.min(Math.max(at.x, Math.min(half, room)), Math.max(window.innerWidth - half, room))}px`;
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
      lockAnswers(buttons);
    },
    setAnswers(options) {
      fillAnswers(buttons, options, 'sz-answer');
    },
    dispose() {
      created.forEach((node) => node.remove());
    },
  };
  api.setSkis(SKIS);
  api.setTier(0);
  return api;
}
