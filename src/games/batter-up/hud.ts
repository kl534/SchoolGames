import { callInPanel, questionTopBelowBug } from './layout';
import type { Half, Side } from './rules';

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

/** Fills a row with `total` round dots, the first `filled` of them lit. */
function setDots(row: HTMLElement, filled: number, total: number): void {
  row.replaceChildren(
    ...Array.from({ length: total }, (_, i) => {
      const dot = document.createElement('span');
      dot.className = i < filled ? 'bu-dot on' : 'bu-dot';
      return dot;
    }),
  );
  row.setAttribute('role', 'img');
  row.setAttribute('aria-label', `${filled} of ${total}`);
}

/** The little diamond: three bases that light up when somebody is on them. */
function createDiamond(parent: HTMLElement) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 60 60');
  svg.setAttribute('class', 'bu-diamond');
  svg.setAttribute('role', 'img');
  const lines = document.createElementNS(SVG, 'path');
  lines.setAttribute('d', 'M30 50 50 30 30 10 10 30Z');
  lines.setAttribute('fill', 'rgba(61, 154, 75, 0.55)');
  lines.setAttribute('stroke', 'rgba(255,255,255,0.7)');
  lines.setAttribute('stroke-width', '2');
  svg.appendChild(lines);
  // First, second and third base, then home.
  const spots: [number, number][] = [
    [50, 30],
    [30, 10],
    [10, 30],
  ];
  const bases = spots.map(([x, y]) => {
    const base = document.createElementNS(SVG, 'rect');
    base.setAttribute('x', String(x - 6));
    base.setAttribute('y', String(y - 6));
    base.setAttribute('width', '12');
    base.setAttribute('height', '12');
    base.setAttribute('class', 'bu-base');
    base.setAttribute('transform', `rotate(45 ${x} ${y})`);
    svg.appendChild(base);
    return base;
  });
  const home = document.createElementNS(SVG, 'path');
  home.setAttribute('d', 'M24 50h12v-4l-6-5-6 5Z');
  home.setAttribute('fill', '#fff');
  svg.appendChild(home);
  parent.appendChild(svg);
  return { svg, bases };
}

export interface BugInfo {
  /** Short names and runs of the two teams. */
  usAbbr: string;
  themAbbr: string;
  usRuns: number;
  themRuns: number;
  inning: number;
  half: Half;
  best: number;
  outs: number;
  strikes: number;
  bases: readonly [boolean, boolean, boolean];
}

export type BannerKind = 'hit' | 'miss' | 'out' | 'info' | 'good';

export interface Hud {
  /** Question, clock and answers. */
  hideQuestion(hidden: boolean): void;
  setQuestion(text: string): void;
  /**
   * Moves the question just below the scorebug if, as laid out now, it would sit on top of it
   * (a long prompt on a middling screen, say), and back to its usual place if not. Returns
   * whether it changed place, so the view can be fitted again.
   */
  settleQuestion(): boolean;
  setOptions(options: string[]): void;
  setClock(fraction: number): void;
  /** Dims the answers while a result plays out (they stay tappable to skip ahead). */
  lock(): void;
  mark(chosen: number, correct: number, right: boolean): void;
  /** The answer that was picked on a correct hit; the rest fade. */
  markHit(chosen: number): void;
  renderBug(info: BugInfo): void;
  /**
   * The screen rows (px from the top) the question's panel and clock end at, and the answers
   * begin at, as the CSS lays them out right now. Works while they are hidden.
   */
  measureBand(): { top: number; bottom: number };
  /** The scorebug's rectangle on screen, in px. */
  bugRect(): { left: number; top: number; right: number; bottom: number };
  /** The card beside the plate, when one is up (on a wide screen); otherwise null. */
  bannerRect(): { left: number; top: number; right: number; bottom: number } | null;
  /** Bottom edge of the scorebug, in px from the top of the screen. */
  bugBottom(): number;
  /** Makes a team's runs jump, as they are scored. */
  flashRuns(side: Side): void;
  showBanner(
    title: string,
    detail: string,
    kind: BannerKind,
    place?: 'centre' | 'top' | 'aside',
  ): void;
  hideBanner(): void;
  /** True while a call is shown inside the question panel (on a tall screen) and not as a card. */
  callInPanel(): boolean;
  /** Floats a short message up from a spot on the screen. */
  pop(text: string, x: number, y: number, kind?: 'good' | 'bad' | 'plain'): void;
  readonly buttons: HTMLButtonElement[];
  readonly hear: HTMLButtonElement;
  /** What the finger and caption that point at the green answer keep off: scorebug, question, card. */
  readonly avoid: readonly HTMLElement[];
}

/** Room kept under a miss card for the finger and caption that point at the green answer. */
const TAP_ROOM = 104;
/** The back, sound and pause buttons end this far down the screen. */
const TOP_BAR = 72;

export function createHud(): Hud {
  const bug = el('div', 'bu-bug', document.body);
  const { bases } = createDiamond(bug);
  const bugText = el('div', 'bu-bug-text', bug);
  const rowRuns = el('div', 'bu-row', bugText);
  const usName = el('span', 'bu-team', rowRuns);
  const usRuns = el('b', 'bu-runs', rowRuns);
  const themName = el('span', 'bu-team', rowRuns);
  const themRuns = el('b', 'bu-runs', rowRuns);
  const inningText = el('span', 'bu-inning', rowRuns);
  const rowCount = el('div', 'bu-row', bugText);
  el('span', 'bu-label', rowCount).textContent = 'Outs';
  const outsValue = el('span', 'bu-dots bu-outs', rowCount);
  el('span', 'bu-label', rowCount).textContent = 'Strikes';
  const strikesValue = el('span', 'bu-dots bu-strikes', rowCount);
  const bestText = el('div', 'bu-row bu-best', bugText);

  const hudBox = el('div', 'bu-hud', document.body);
  const problem = el('div', 'bu-problem', hudBox);
  problem.setAttribute('aria-live', 'polite');
  const problemText = el('span', 'bu-problem-text', problem);
  const hear = el('button', 'bu-hear', problem);
  hear.type = 'button';
  hear.textContent = '🔊';
  hear.setAttribute('aria-label', 'Hear the question');
  const clockBar = el('div', 'bu-clock', hudBox);
  const clockFill = el('div', 'bu-clock-fill', clockBar);

  const answers = el('div', 'bu-answers', document.body);
  const buttons = Array.from({ length: 4 }, () => {
    const button = el('button', 'bu-answer', answers);
    button.type = 'button';
    return button;
  });

  const banner = el('div', 'bu-banner', document.body);
  banner.setAttribute('role', 'status');
  const bannerTitle = el('div', 'bu-banner-title', banner);
  const bannerDetail = el('div', 'bu-banner-detail', banner);
  banner.hidden = true;

  let options: string[] = [];
  let questionText = '';
  let inPanel = false;
  hudBox.hidden = true;
  answers.hidden = true;

  /** Puts the question back in the panel after it has shown a call. */
  const restoreQuestion = () => {
    if (!inPanel) return;
    inPanel = false;
    hudBox.classList.remove('calling');
    problemText.textContent = questionText;
    hear.setAttribute('aria-label', 'Hear the question');
  };

  /** Shows an umpire's call in the question panel: the call, and the fact under it. */
  const callInQuestion = (title: string, detail: string) => {
    banner.hidden = true;
    inPanel = true;
    hudBox.classList.add('calling');
    problemText.replaceChildren();
    el('span', 'bu-call-title', problemText).textContent = title;
    el('span', 'bu-call-statement', problemText).textContent = detail;
    hear.setAttribute('aria-label', 'Hear the answer');
  };

  /**
   * The highest a card beside the plate may start: just below the top bar when it is clear of the
   * scorebug and the question sideways, else `under` (below the question).
   */
  const cardTop = (card: DOMRect, under: number) => {
    const clearOf = (node: HTMLElement) => {
      const r = node.getBoundingClientRect();
      return card.left >= r.right || card.right <= r.left;
    };
    return !hudBox.hidden && clearOf(bug) && clearOf(hudBox) ? Math.min(under, TOP_BAR) : under;
  };

  const replay = (node: HTMLElement) => {
    node.classList.remove('on');
    void node.offsetWidth;
    node.classList.add('on');
  };

  return {
    buttons,
    hear,
    avoid: [bug, hudBox, banner],
    hideQuestion(hidden) {
      hudBox.hidden = hidden;
      answers.hidden = hidden;
      buttons.forEach((b, i) => (b.hidden = options[i] === undefined));
    },
    setQuestion(text) {
      questionText = text;
      inPanel = false;
      hudBox.classList.remove('calling');
      problemText.textContent = text;
      hear.setAttribute('aria-label', 'Hear the question');
    },
    setOptions(next) {
      options = next;
      buttons.forEach((button, i) => {
        const text = next[i];
        button.textContent = text ?? '';
        button.setAttribute('aria-label', `Answer ${text ?? ''}`);
        button.removeAttribute('aria-disabled');
        button.className = 'bu-answer';
        button.hidden = text === undefined;
      });
    },
    setClock(fraction) {
      const f = Math.min(Math.max(fraction, 0), 1);
      clockFill.style.transform = `scaleX(${f})`;
      clockBar.classList.toggle('urgent', f < 0.4);
    },
    lock() {
      buttons.forEach((b) => b.setAttribute('aria-disabled', 'true'));
    },
    mark(chosen, correct, right) {
      buttons[correct]?.classList.add('right');
      if (chosen >= 0 && !right) buttons[chosen].classList.add('wrong');
      if (chosen >= 0 && right) buttons[chosen].classList.add('chosen');
    },
    markHit(chosen) {
      buttons.forEach((b, i) => b.classList.add(i === chosen ? 'right' : 'gone'));
    },
    renderBug(info) {
      usName.textContent = info.usAbbr;
      themName.textContent = info.themAbbr;
      usRuns.textContent = String(info.usRuns);
      themRuns.textContent = String(info.themRuns);
      // The team at bat is lit.
      usName.classList.toggle('bat', info.half === 'top');
      themName.classList.toggle('bat', info.half === 'bottom');
      inningText.textContent = `${info.half === 'top' ? '▲' : '▼'}${info.inning}`;
      bestText.textContent = `Best ${info.best}`;
      setDots(outsValue, info.outs, 3);
      setDots(strikesValue, info.strikes, 3);
      bases.forEach((base, i) => base.classList.toggle('on', info.bases[i]));
      bug.setAttribute(
        'aria-label',
        `${info.usAbbr} ${info.usRuns}, ${info.themAbbr} ${info.themRuns}, ` +
          `${info.half === 'top' ? 'top' : 'bottom'} of inning ${info.inning}, ` +
          `${info.outs} outs, ${info.strikes} strikes`,
      );
    },
    settleQuestion() {
      const wasBelow = hudBox.classList.contains('below-bug');
      hudBox.classList.remove('below-bug');
      hudBox.style.removeProperty('--bu-below-bug');
      const wasHidden = hudBox.hidden;
      hudBox.hidden = false;
      const top = questionTopBelowBug(hudBox.getBoundingClientRect(), bug.getBoundingClientRect());
      hudBox.hidden = wasHidden;
      if (top !== null) {
        hudBox.style.setProperty('--bu-below-bug', `${top}px`);
        hudBox.classList.add('below-bug');
      }
      return (top !== null) !== wasBelow;
    },
    measureBand() {
      this.settleQuestion();
      const hidden = [hudBox.hidden, answers.hidden, ...buttons.map((b) => b.hidden)];
      hudBox.hidden = false;
      answers.hidden = false;
      buttons.forEach((b) => (b.hidden = false));
      const band = {
        top: hudBox.getBoundingClientRect().bottom,
        bottom: answers.getBoundingClientRect().top,
      };
      [hudBox.hidden, answers.hidden] = [hidden[0], hidden[1]];
      buttons.forEach((b, i) => (b.hidden = hidden[i + 2]));
      return band;
    },
    bugRect() {
      const r = bug.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    },
    bannerRect() {
      if (banner.hidden || !banner.classList.contains('aside')) return null;
      const r = banner.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    },
    bugBottom() {
      return bug.getBoundingClientRect().bottom;
    },
    flashRuns(side) {
      replay(side === 'us' ? usRuns : themRuns);
    },
    showBanner(title, detail, kind, place = 'centre') {
      const inQuestion = callInPanel(window.innerWidth, window.innerHeight);
      if (place === 'aside' && inQuestion && !hudBox.hidden) {
        // On a tall screen any card would sit on the field, so the call goes in the question.
        callInQuestion(title, detail);
        return;
      }
      restoreQuestion();
      bannerTitle.textContent = title;
      bannerDetail.textContent = detail;
      bannerDetail.hidden = !detail;
      // A card beside the plate is kept narrow, so a long call wraps instead of running off.
      const card = place === 'aside' && !inQuestion;
      banner.className = `bu-banner ${kind}${card ? ' aside' : ''}`;
      banner.hidden = false;
      banner.style.left = '50%';
      const viewW = window.innerWidth;
      const viewH = window.innerHeight;
      const half = banner.offsetHeight / 2;
      if (place === 'top') {
        const top = bug.getBoundingClientRect().bottom + 12;
        banner.style.top = `${Math.max(top + half, viewH * 0.26)}px`;
        return;
      }
      const top = hudBox.hidden ? 130 : hudBox.getBoundingClientRect().bottom + 8;
      const room = kind === 'miss' && place === 'aside' ? TAP_ROOM : 0;
      const bottom = (answers.hidden ? viewH - 20 : answers.getBoundingClientRect().top - 8) - room;
      if (place === 'aside') {
        // Keep the plate clear: on a wide screen the call goes to one side. (On a tall one it
        // goes in the question panel, above; this is only for when there is no panel.)
        if (!inQuestion) {
          banner.style.left = `${Math.round(viewW * 0.77)}px`;
          // A miss card needs room under it for the finger. Beside the question rather than under
          // it, the card may start higher up, just below the top bar.
          const first = kind === 'miss' ? cardTop(banner.getBoundingClientRect(), top) : top;
          banner.style.top = `${Math.min(Math.max((first + bottom) / 2, first + half), Math.max(bottom - half, first + half))}px`;
        } else {
          banner.style.top = `${top + half}px`;
        }
        return;
      }
      const centre = (top + bottom) / 2;
      banner.style.top = `${Math.min(Math.max(centre, top + half), Math.max(bottom - half, top + half))}px`;
    },
    hideBanner() {
      banner.hidden = true;
      restoreQuestion();
    },
    callInPanel() {
      return inPanel;
    },
    pop(text, x, y, kind = 'plain') {
      const node = el('div', `bu-pop ${kind}`, document.body);
      node.textContent = text;
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      node.addEventListener('animationend', () => node.remove());
      setTimeout(() => node.remove(), 1600);
    },
  };
}
