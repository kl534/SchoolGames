import { callInPanel, questionTopBelowBug, type Rect } from './layout';
import type { Side } from './rules';

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

/** Fills a row with `total` round dots, the first `filled` of them lit. */
function setDots(row: HTMLElement, filled: number, total: number): void {
  row.replaceChildren(
    ...Array.from({ length: total }, (_, i) => {
      const dot = document.createElement('span');
      dot.className = i < filled ? 'bb-dot on' : 'bb-dot';
      return dot;
    }),
  );
  row.setAttribute('role', 'img');
  row.setAttribute('aria-label', `${filled} of ${total}`);
}

export interface BugInfo {
  /** Short names of the two sides, and the rival's emoji. */
  usAbbr: string;
  themAbbr: string;
  themEmoji: string;
  us: number;
  them: number;
  /** "1st", "2nd", "OT"... */
  period: string;
  /** Rounds left in the period, out of `rounds`. */
  roundsLeft: number;
  rounds: number;
  best: number;
  /** Who has the ball: their name is bold. */
  ball: Side;
  fire: boolean;
}

export type BannerKind = 'miss' | 'info' | 'good';

export interface Hud {
  /** Question and answers. */
  hideQuestion(hidden: boolean): void;
  setQuestion(text: string): void;
  /**
   * Moves the question just below the scorebug if, as laid out now, it would sit on top of it
   * (a long prompt on a middling screen, say), and back to its usual place if not. Returns
   * whether it changed place, so the view can be fitted again.
   */
  settleQuestion(): boolean;
  setOptions(options: string[]): void;
  /** Dims the answers while a result plays out (they stay tappable to skip ahead). */
  lock(): void;
  mark(chosen: number, correct: number, right: boolean): void;
  /** The answer that was picked on a right answer; the rest fade. */
  markHit(chosen: number): void;
  renderBug(info: BugInfo): void;
  /**
   * The screen rows (px from the top) the question's panel ends at, and the answers begin at, as
   * the CSS lays them out right now. Works while they are hidden.
   */
  measureBand(): { top: number; bottom: number };
  /** The scorebug's rectangle on screen, in px. */
  bugRect(): Rect;
  /** The question panel's rectangle on screen, in px (empty while hidden). */
  questionRect(): Rect | null;
  /** The card beside the court, when one is up (on a wide screen); otherwise null. */
  bannerRect(): Rect | null;
  /** Bottom edge of the scorebug, in px from the top of the screen. */
  bugBottom(): number;
  /** Makes a side's points jump, as they are scored. */
  flashPoints(side: Side): void;
  showBanner(
    title: string,
    detail: string,
    kind: BannerKind,
    place?: 'centre' | 'top' | 'aside',
    /** Where a card beside the court goes, as a share of the screen's width (default 0.77). */
    asideAt?: number,
  ): void;
  hideBanner(): void;
  /** True while a call is shown inside the question panel (on a tall screen) and not as a card. */
  callInPanel(): boolean;
  /** Floats a short message up from a spot on the screen. */
  pop(text: string, x: number, y: number, kind?: 'good' | 'bad' | 'plain'): void;
  /** The shot clock above the backboard. */
  shotClock: {
    /** Shows the clock with `text` (a number of seconds); `urgent` pulses it. */
    show(text: string, urgent: boolean): void;
    hide(): void;
    /**
     * Puts the clock's bottom centre at the screen point, kept inside the band, inside the
     * screen and clear of the `avoid` rectangles.
     */
    place(x: number, y: number, band: { top: number; bottom: number }, avoid: Rect[]): void;
  };
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
  const bug = el('div', 'bb-bug', document.body);
  const bugText = el('div', 'bb-bug-text', bug);
  const rowPoints = el('div', 'bb-row', bugText);
  const usName = el('span', 'bb-team', rowPoints);
  const usPoints = el('b', 'bb-pts', rowPoints);
  const themName = el('span', 'bb-team', rowPoints);
  const themPoints = el('b', 'bb-pts', rowPoints);
  const rowPeriod = el('div', 'bb-row', bugText);
  const periodText = el('span', 'bb-period', rowPeriod);
  const roundDots = el('span', 'bb-dots', rowPeriod);
  const rowBest = el('div', 'bb-row bb-best', bugText);
  const bestText = el('span', '', rowBest);
  const fireBadge = el('span', 'bb-fire', rowBest);
  fireBadge.textContent = '🔥 ON FIRE';
  fireBadge.hidden = true;

  const hudBox = el('div', 'bb-hud', document.body);
  const problem = el('div', 'bb-problem', hudBox);
  problem.setAttribute('aria-live', 'polite');
  const problemText = el('span', 'bb-problem-text', problem);
  const hear = el('button', 'bb-hear', problem);
  hear.type = 'button';
  hear.textContent = '🔊';
  hear.setAttribute('aria-label', 'Hear the question');

  const clock = el('div', 'bb-shotclock', document.body);
  clock.setAttribute('role', 'timer');
  clock.setAttribute('aria-label', 'Shot clock');
  clock.hidden = true;

  const answers = el('div', 'bb-answers', document.body);
  const buttons = Array.from({ length: 4 }, () => {
    const button = el('button', 'bb-answer', answers);
    button.type = 'button';
    return button;
  });

  const banner = el('div', 'bb-banner', document.body);
  banner.setAttribute('role', 'status');
  const bannerTitle = el('div', 'bb-banner-title', banner);
  const bannerDetail = el('div', 'bb-banner-detail', banner);
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

  /** Shows a call in the question panel: the call, and the fact under it. */
  const callInQuestion = (title: string, detail: string) => {
    banner.hidden = true;
    inPanel = true;
    hudBox.classList.add('calling');
    problemText.replaceChildren();
    el('span', 'bb-call-title', problemText).textContent = title;
    el('span', 'bb-call-statement', problemText).textContent = detail;
    hear.setAttribute('aria-label', 'Hear the answer');
  };

  /**
   * The highest a card beside the court may start: just below the top bar when it is clear of the
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

  const rectOf = (node: HTMLElement): Rect => {
    const r = node.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
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
        button.className = 'bb-answer';
        button.hidden = text === undefined;
      });
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
      themName.textContent = `${info.themEmoji} ${info.themAbbr}`;
      usPoints.textContent = String(info.us);
      themPoints.textContent = String(info.them);
      // The side with the ball is bold.
      usName.classList.toggle('ball', info.ball === 'us');
      themName.classList.toggle('ball', info.ball === 'them');
      periodText.textContent = info.period;
      setDots(roundDots, info.roundsLeft, info.rounds);
      bestText.textContent = `Best ${info.best}`;
      fireBadge.hidden = !info.fire;
      bug.setAttribute(
        'aria-label',
        `${info.usAbbr} ${info.us}, ${info.themAbbr} ${info.them}, ${info.period}, ` +
          `${info.roundsLeft} rounds left${info.ball === 'us' ? ', your ball' : ', their ball'}`,
      );
    },
    settleQuestion() {
      const wasBelow = hudBox.classList.contains('below-bug');
      hudBox.classList.remove('below-bug');
      hudBox.style.removeProperty('--bb-below-bug');
      const wasHidden = hudBox.hidden;
      hudBox.hidden = false;
      const top = questionTopBelowBug(hudBox.getBoundingClientRect(), bug.getBoundingClientRect());
      hudBox.hidden = wasHidden;
      if (top !== null) {
        hudBox.style.setProperty('--bb-below-bug', `${top}px`);
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
      return rectOf(bug);
    },
    questionRect() {
      return hudBox.hidden ? null : rectOf(hudBox);
    },
    bannerRect() {
      if (banner.hidden || !banner.classList.contains('aside')) return null;
      return rectOf(banner);
    },
    bugBottom() {
      return bug.getBoundingClientRect().bottom;
    },
    flashPoints(side) {
      replay(side === 'us' ? usPoints : themPoints);
    },
    showBanner(title, detail, kind, place = 'centre', asideAt = 0.77) {
      const inQuestion = callInPanel(window.innerWidth, window.innerHeight);
      if (place === 'aside' && inQuestion && !hudBox.hidden) {
        // On a tall screen any card would sit on the court, so the call goes in the question.
        callInQuestion(title, detail);
        return;
      }
      restoreQuestion();
      bannerTitle.textContent = title;
      bannerDetail.textContent = detail;
      bannerDetail.hidden = !detail;
      // A card beside the court is kept narrow, so a long call wraps instead of running off.
      const card = place === 'aside' && !inQuestion;
      banner.className = `bb-banner ${kind}${card ? ' aside' : ''}`;
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
        if (!inQuestion) {
          // Keep the whole card on the screen, whatever its width.
          const wide = banner.offsetWidth / 2 + 12;
          let x = Math.min(Math.max(viewW * asideAt, wide), viewW - wide);
          // A miss card stays up until the tap, so it must not sit on the scorebug.
          const bugBox = bug.getBoundingClientRect();
          if (kind === 'miss' && x - wide < bugBox.right && top < bugBox.bottom) {
            x = Math.min(bugBox.right + wide, viewW - wide);
          }
          banner.style.left = `${Math.round(x)}px`;
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
      const node = el('div', `bb-pop ${kind}`, document.body);
      node.textContent = text;
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      node.addEventListener('animationend', () => node.remove());
      setTimeout(() => node.remove(), 1600);
    },
    shotClock: {
      show(text, urgent) {
        clock.hidden = false;
        if (clock.textContent !== text) clock.textContent = text;
        clock.classList.toggle('urgent', urgent);
      },
      hide() {
        clock.hidden = true;
        clock.classList.remove('urgent');
      },
      place(x, y, band, avoid) {
        if (clock.hidden) return;
        const w = clock.offsetWidth || 64;
        const h = clock.offsetHeight || 44;
        const viewW = window.innerWidth;
        let left = Math.min(Math.max(x - w / 2, 8), viewW - w - 8);
        const top = Math.min(Math.max(y - h, band.top), Math.max(band.bottom - h, band.top));
        for (const r of avoid) {
          if (left < r.right && left + w > r.left && top < r.bottom && top + h > r.top) {
            // Slide to whichever side of the obstacle is nearer.
            const right = r.right + 8;
            const leftSide = r.left - w - 8;
            left = Math.abs(right - left) < Math.abs(leftSide - left) ? right : leftSide;
          }
        }
        left = Math.min(Math.max(left, 8), viewW - w - 8);
        clock.style.left = `${left}px`;
        clock.style.top = `${top}px`;
      },
    },
  };
}
