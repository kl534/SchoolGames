/**
 * The DOM on top of the picture: the question panel and place strip, the lives, the score, the
 * four answers, the banner, the comic word, the pops, the bonk flash and the iris wipe. Plain
 * elements styled in style.css (prefix `cd-`); the game loop in main.ts drives them.
 */
import { fillAnswers, lockAnswers } from '../../shared/answers';
import { DOOR_ICONS } from './door';
import { CAT_LOOKS, catFaceSvg, type CatId } from './looks';
import type { DoorKind } from './places';
import { LIVES, VISIT_LENGTH, multiplierFor } from './rules';

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

export type DotState = 'clear' | 'fail' | null;

export interface Hud {
  /** Everything at the top centre: question and place strip. */
  top: HTMLElement;
  problemText: HTMLElement;
  hear: HTMLButtonElement;
  answers: HTMLElement;
  buttons: HTMLButtonElement[];
  /** The big message under the question ("Oops!", the place name). */
  banner: HTMLElement;
  /** Which cat the lives show. */
  setCat(cat: CatId): void;
  /** The cat faces: `lives` of them are bright, the rest grey with X eyes; the lost one wobbles. */
  setLives(lives: number, justLost?: boolean): void;
  setScore(score: number, streak: number, best: number, pulse?: boolean): void;
  /** The thin clock under the dots: 0 when it starts, 1 when the cat arrives. */
  setClock(progress: number, state: { urgent: boolean; waiting: boolean }): void;
  /** The place name, the dots of the visit and the next door's icon. */
  setPlace(name: string, next: DoorKind): void;
  setDots(dots: readonly DotState[], current: number): void;
  showBanner(title: string, detail: string, kind: 'hit' | 'miss' | 'place' | 'out'): void;
  hideBanner(): void;
  readonly bannerShown: boolean;
  showCount(text: string | null): void;
  /** A big comic word at a screen spot. */
  showWord(text: string, at: { x: number; y: number }, good: boolean): void;
  hideWord(): void;
  /** Floats a short message up from a spot on the screen. */
  pop(text: string, at: { x: number; y: number }, kind: 'good' | 'bad' | 'plain'): void;
  flashBonk(): void;
  /** The iris wipe: the picture shows through a circle of `radius` px at (x, y); null removes it. */
  setIris(radius: number | null, at?: { x: number; y: number }): void;
  setTopVisible(visible: boolean, optionCount: number): void;
  lockAnswers(): void;
  /** Sets the four answer buttons to these texts and clears their states. */
  setAnswers(options: readonly string[]): void;
  dispose(): void;
}

export function createHud(cat: CatId): Hud {
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

  const top = make('div', 'cd-hud', root);
  const problem = make('div', 'cd-problem', top);
  problem.setAttribute('aria-live', 'polite');
  const problemText = make('span', 'cd-problem-text', problem);
  const hear = make('button', 'cd-hear', problem);
  hear.type = 'button';
  hear.textContent = '🔊';
  hear.setAttribute('aria-label', 'Hear the question');

  const placeBox = make('div', 'cd-place', top);
  const placeRow = make('div', 'cd-place-row', placeBox);
  const placeName = make('span', 'cd-place-name', placeRow);
  const dotsBox = make('span', 'cd-dots', placeRow);
  const dots = Array.from({ length: VISIT_LENGTH }, () => make('span', 'cd-dot', dotsBox));
  const doorIcon = make('span', 'cd-door', placeRow);
  doorIcon.setAttribute('aria-hidden', 'true');
  const clock = make('div', 'cd-clock', placeBox);
  const clockFill = make('div', 'cd-clock-fill', clock);

  const livesBar = make('div', 'cd-lives', root);
  const faces = make('span', 'cd-faces', livesBar);
  faces.style.display = 'contents';
  const score = make('div', 'cd-score', livesBar);
  const scoreRow = make('div', 'cd-score-row', score);
  const scoreValue = make('span', 'cd-score-value', scoreRow);
  const multBadge = make('span', 'cd-mult', scoreRow);
  const bestText = make('div', 'cd-best', score);

  const answers = make('div', 'cd-answers', root);
  const buttons = Array.from({ length: 4 }, () => {
    const button = make('button', 'cd-answer', answers);
    button.type = 'button';
    return button;
  });

  const banner = make('div', 'cd-banner', root);
  banner.setAttribute('role', 'status');
  const bannerTitle = make('div', 'cd-banner-title', banner);
  const bannerDetail = make('div', 'cd-banner-detail', banner);
  banner.hidden = true;
  const count = make('div', 'cd-count', root);
  count.setAttribute('aria-live', 'assertive');
  count.hidden = true;
  const word = make('div', 'cd-word', root);
  word.hidden = true;
  const flash = make('div', 'cd-bonk', root);
  const iris = make('div', 'cd-iris', root);
  iris.hidden = true;

  const restart = (node: HTMLElement) => {
    node.classList.remove('on');
    void node.offsetWidth;
    node.classList.add('on');
  };

  let catId = cat;

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
    setCat(next) {
      catId = next;
    },
    setLives(lives, justLost = false) {
      const icons = Array.from({ length: LIVES }, (_, i) => {
        const icon = document.createElement('span');
        const lost = i >= lives;
        icon.className = `cd-life${lost ? ' lost' : ''}`;
        icon.innerHTML = catFaceSvg(CAT_LOOKS[catId], lost);
        // Only the life that has just gone wobbles.
        if (lost && !(justLost && i === lives)) icon.classList.remove('lost');
        if (lost) icon.dataset.lost = '1';
        return icon;
      });
      faces.replaceChildren(...icons);
      livesBar.setAttribute('role', 'img');
      livesBar.setAttribute('aria-label', `${lives} of ${LIVES} lives left`);
    },
    setScore(value, streak, best, pulse = false) {
      scoreValue.textContent = value.toLocaleString();
      const multiplier = multiplierFor(streak);
      multBadge.hidden = multiplier === 1;
      multBadge.textContent = `×${multiplier}`;
      bestText.textContent = `Best ${best.toLocaleString()}`;
      if (pulse) restart(scoreValue);
    },
    setClock(progress, state) {
      const p = Math.min(Math.max(progress, 0), 1);
      clockFill.style.transform = `scaleX(${p})`;
      placeBox.classList.toggle('urgent', state.urgent);
      placeBox.classList.toggle('waiting', state.waiting);
    },
    setPlace(name, next) {
      placeName.textContent = name;
      doorIcon.textContent = DOOR_ICONS[next];
    },
    setDots(states, current) {
      dots.forEach((dot, i) => {
        const state = states[i] ?? null;
        dot.className = `cd-dot${state ? ` ${state}` : ''}${i === current && !state ? ' now' : ''}`;
      });
    },
    showBanner(title, detail, kind) {
      bannerTitle.textContent = title;
      bannerDetail.textContent = detail;
      bannerDetail.hidden = !detail;
      banner.className = `cd-banner ${kind}`;
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
      word.className = `cd-word ${good ? 'good' : 'bad'}`;
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
      const node = make('div', `cd-pop ${kind}`, root);
      node.textContent = text;
      node.style.left = `${at.x}px`;
      node.style.top = `${at.y}px`;
      node.addEventListener('animationend', () => node.remove());
      setTimeout(() => node.remove(), 1600);
    },
    flashBonk() {
      restart(flash);
    },
    setIris(radius, at) {
      if (radius === null) {
        iris.hidden = true;
        return;
      }
      iris.hidden = false;
      const x = at?.x ?? window.innerWidth / 2;
      const y = at?.y ?? window.innerHeight / 2;
      const r = Math.max(radius, 0);
      iris.style.background = `radial-gradient(circle at ${x.toFixed(1)}px ${y.toFixed(1)}px, transparent ${r.toFixed(1)}px, #1b1226 ${(r + 1).toFixed(1)}px)`;
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
      fillAnswers(buttons, options, 'cd-answer');
    },
    dispose() {
      created.forEach((node) => node.remove());
    },
  };
  api.setLives(LIVES);
  return api;
}
