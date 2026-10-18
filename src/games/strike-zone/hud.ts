import { lineX, type Aim } from './aim';
import { BALL_R, DECK_BACK_Z, HEAD_Z, PIN_IDS, pinSpot, type PinId } from './geometry';
import { frameMarks, position, runningTotals, totalScore, type Rolls } from './rules';
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

/** The cartoon on the alley screen. */
export type ScreenKind = 'strike' | 'double' | 'turkey' | 'perfect' | 'spare' | 'split';

export interface CardInfo {
  rolls: Rolls;
  /** The player's high score for this topic; hidden when 0. */
  best: number;
}

export interface PinsInfo {
  standing: readonly PinId[];
  /** The aim to draw as a band over the pins, or null for none. */
  aim: Aim | null;
  frame: number;
  ball: number;
}

export interface Bands {
  /** Between the scorecard and the controls (the aim view). */
  aim: PlayBand;
  /** Between the question and the answers. */
  ask: PlayBand;
  /** Everything below the scorecard (the throw, the pin cam, the friends). */
  play: PlayBand;
}

export interface Hud {
  buttons: HTMLButtonElement[];
  hear: HTMLButtonElement;
  bowl: HTMLButtonElement;
  nudges: {
    moveLeft: HTMLButtonElement;
    moveRight: HTMLButtonElement;
    aimLeft: HTMLButtonElement;
    aimRight: HTMLButtonElement;
  };
  // The scorecard and the pin diagram.
  renderCard(info: CardInfo): void;
  /** The big scorecard in the middle of the screen, for the end of the game. */
  setCardBig(big: boolean): void;
  /** Hides the scorecard (behind the results screen) or shows it again. */
  showCard(visible: boolean): void;
  renderPins(info: PinsInfo): void;
  /** The pin diagram (and the best score under the card); hidden while a question shows. */
  showSide(visible: boolean): void;
  // The aim controls.
  showControls(visible: boolean): void;
  showHints(move: boolean, swing: boolean): void;
  placeHints(moveX: number, moveY: number, swingX: number, swingY: number): void;
  // The question.
  setQuestion(text: string): void;
  setOptions(options: string[]): void;
  showQuestion(visible: boolean): void;
  /** The clock bar: the share of time left (0 … 1), or null to hide it. */
  setClock(left: number | null, urgent: boolean): void;
  lock(): void;
  mark(chosen: number, correct: number, right: boolean): void;
  // Messages.
  showBanner(title: string, detail: string, kind: BannerKind, where: 'aim' | 'ask'): void;
  hideBanner(): void;
  showPill(text: string): void;
  hidePill(): void;
  showScreen(title: string, kind: ScreenKind): void;
  hideScreen(): void;
  confetti(): void;
  // Measuring.
  measureBands(): Bands;
  cardBottom(): number;
  dispose(): void;
}

const SVG_TOP = DECK_BACK_Z - 0.02;
const SVG_BOTTOM = HEAD_Z + 0.25;
const SVG_HALF = 0.62;
const PIN_DOT_R = 0.075;

export function createHud(): Hud {
  const body = document.body;

  // ---------- The scorecard ----------
  const card = el('div', 'sz-card', body);
  card.setAttribute('role', 'img');
  const frames = Array.from({ length: 10 }, (_, i) => {
    const frame = el('div', 'sz-f', card);
    el('div', 'sz-fn', frame).textContent = String(i + 1);
    const marks = el('div', 'sz-m', frame);
    const boxes = Array.from({ length: i === 9 ? 3 : 2 }, () => el('span', 'sz-b', marks));
    const total = el('div', 'sz-t', frame);
    return { frame, boxes, total, signature: '' };
  });
  const bestCell = el('div', 'sz-best', card);
  el('div', 'sz-fn', bestCell).textContent = 'BEST';
  const bestValue = el('div', 'sz-t', bestCell);

  // ---------- The best pill and the pin diagram ----------
  const side = el('div', 'sz-side', body);
  const bestPill = el('div', 'sz-bestpill', side);
  const diagram = el('div', 'sz-pins', side);
  const pinsSvg = svg(
    'svg',
    {
      viewBox: `${-SVG_HALF} 0 ${SVG_HALF * 2} ${SVG_BOTTOM - SVG_TOP}`,
      class: 'sz-pins-svg',
      role: 'img',
      preserveAspectRatio: 'xMidYMid meet',
    },
    diagram,
  );
  svg(
    'rect',
    {
      x: -SVG_HALF,
      y: 0,
      width: SVG_HALF * 2,
      height: SVG_BOTTOM - SVG_TOP,
      rx: 0.06,
      fill: '#c99a5e',
    },
    pinsSvg,
  );
  const pinDots = new Map<PinId, SVGGElement>();
  for (const id of PIN_IDS) {
    const spot = pinSpot(id);
    const g = svg('g', { transform: `translate(${spot.x} ${spot.z - SVG_TOP})` }, pinsSvg);
    svg('circle', { r: PIN_DOT_R, class: 'sz-pin-ring' }, g);
    svg('circle', { r: 0.028, class: 'sz-pin-dot' }, g);
    pinDots.set(id, g);
  }
  const band = svg('polygon', { class: 'sz-band', points: '' }, pinsSvg);
  const bandLine = svg('line', { class: 'sz-band-line' }, pinsSvg);
  const caption = el('div', 'sz-pins-caption', diagram);

  // ---------- The aim controls ----------
  const controls = el('div', 'sz-controls', body);
  const nudgeGroup = (name: 'move' | 'aim', label: string) => {
    const group = el('div', `sz-nudge sz-${name}`, controls);
    const leftButton = el('button', 'sz-nudge-btn', group);
    leftButton.type = 'button';
    leftButton.textContent = '◀';
    leftButton.setAttribute('aria-label', `${label} left`);
    el('span', 'sz-nudge-label', group).textContent = label;
    const rightButton = el('button', 'sz-nudge-btn', group);
    rightButton.type = 'button';
    rightButton.textContent = '▶';
    rightButton.setAttribute('aria-label', `${label} right`);
    return { leftButton, rightButton };
  };
  const moveNudge = nudgeGroup('move', 'Move');
  const bowl = el('button', 'sz-bowl', controls);
  bowl.type = 'button';
  bowl.textContent = 'Bowl!';
  bowl.setAttribute('aria-label', 'Bowl');
  const aimNudge = nudgeGroup('aim', 'Aim');
  const hintMove = el('div', 'sz-hint', body);
  hintMove.textContent = '↔ Drag to move';
  const hintSwing = el('div', 'sz-hint', body);
  hintSwing.textContent = '↔ Drag to aim';
  hintMove.hidden = true;
  hintSwing.hidden = true;

  // ---------- The question ----------
  const q = el('div', 'sz-q', body);
  q.setAttribute('aria-live', 'polite');
  const qText = el('span', 'sz-q-text', q);
  const hear = el('button', 'sz-hear', q);
  hear.type = 'button';
  hear.textContent = '🔊';
  hear.setAttribute('aria-label', 'Hear the question');
  const clock = el('div', 'sz-clock', q);
  clock.setAttribute('role', 'timer');
  clock.setAttribute('aria-label', 'Time left');
  const clockFill = el('i', '', clock);
  const answers = el('div', 'sz-answers', body);
  const buttons = Array.from({ length: 4 }, () => {
    const button = el('button', 'sz-answer', answers);
    button.type = 'button';
    return button;
  });
  q.hidden = true;
  answers.hidden = true;

  // ---------- Messages ----------
  const banner = el('div', 'sz-banner', body);
  banner.setAttribute('role', 'status');
  const bannerTitle = el('div', 'sz-banner-title', banner);
  const bannerDetail = el('div', 'sz-banner-detail', banner);
  banner.hidden = true;
  const pill = el('div', 'sz-pill', body);
  pill.setAttribute('role', 'status');
  pill.hidden = true;
  const screen = el('div', 'sz-screen', body);
  screen.setAttribute('role', 'status');
  const screenArt = el('div', 'sz-screen-art', screen);
  const screenTitle = el('div', 'sz-screen-title', screen);
  screen.hidden = true;
  const confettiBox = el('div', 'sz-confetti', body);
  let confettiTimer = 0;

  let options: string[] = [];
  let controlsShown = false;

  const rectOf = (node: HTMLElement) => node.getBoundingClientRect();

  /** Lays out the things that follow the scorecard's bottom edge. */
  const place = () => {
    const bottom = card.getBoundingClientRect().bottom;
    const root = document.documentElement.style;
    root.setProperty('--sz-card-bottom', `${bottom}px`);
  };

  return {
    buttons,
    hear,
    bowl,
    nudges: {
      moveLeft: moveNudge.leftButton,
      moveRight: moveNudge.rightButton,
      aimLeft: aimNudge.leftButton,
      aimRight: aimNudge.rightButton,
    },

    renderCard(info) {
      const marks = frameMarks(info.rolls);
      const totals = runningTotals(info.rolls);
      const where = position(info.rolls);
      frames.forEach((f, i) => {
        f.boxes.forEach((box, b) => (box.textContent = marks[i][b]));
        f.total.textContent = totals[i] === null ? '' : String(totals[i]);
        f.frame.classList.toggle('cur', !where.over && where.frame === i + 1);
        const signature = marks[i].join('|');
        if (f.signature !== signature && signature.replace(/\|/g, '') !== '') {
          f.frame.classList.remove('flash');
          void f.frame.offsetWidth;
          f.frame.classList.add('flash');
        }
        f.signature = signature;
      });
      bestValue.textContent = String(info.best);
      bestPill.textContent = `Best ${info.best}`;
      bestCell.hidden = info.best <= 0;
      bestPill.hidden = info.best <= 0;
      card.classList.toggle('with-best', info.best > 0);
      card.setAttribute('aria-label', `Score ${totalScore(info.rolls)}`);
      place();
    },
    setCardBig(big) {
      card.classList.toggle('big', big);
      place();
    },

    showCard(visible) {
      card.hidden = !visible;
    },

    renderPins(info) {
      for (const id of PIN_IDS) pinDots.get(id)!.classList.toggle('up', info.standing.includes(id));
      if (info.aim) {
        const x0 = lineX(info.aim, SVG_TOP);
        const x1 = lineX(info.aim, SVG_BOTTOM);
        const h = SVG_BOTTOM - SVG_TOP;
        band.setAttribute(
          'points',
          `${x0 - BALL_R},0 ${x0 + BALL_R},0 ${x1 + BALL_R},${h} ${x1 - BALL_R},${h}`,
        );
        bandLine.setAttribute('x1', String(x0));
        bandLine.setAttribute('y1', '0');
        bandLine.setAttribute('x2', String(x1));
        bandLine.setAttribute('y2', String(h));
        band.style.display = '';
        bandLine.style.display = '';
      } else {
        band.style.display = 'none';
        bandLine.style.display = 'none';
      }
      caption.textContent = `FRAME ${info.frame} · BALL ${info.ball}`;
      pinsSvg.setAttribute(
        'aria-label',
        info.standing.length
          ? `Pins standing: ${[...info.standing].sort((a, b) => a - b).join(', ')}`
          : 'No pins standing',
      );
    },
    showSide(visible) {
      side.hidden = !visible;
    },

    showControls(visible) {
      controlsShown = visible;
      controls.hidden = !visible;
      if (!visible) {
        hintMove.hidden = true;
        hintSwing.hidden = true;
      }
    },
    showHints(move, swing) {
      hintMove.hidden = !move || !controlsShown;
      hintSwing.hidden = !swing || !controlsShown;
    },
    placeHints(moveX, moveY, swingX, swingY) {
      hintMove.style.left = `${moveX}px`;
      hintMove.style.top = `${moveY}px`;
      hintSwing.style.left = `${swingX}px`;
      hintSwing.style.top = `${swingY}px`;
    },

    setQuestion(text) {
      qText.textContent = text;
    },
    setOptions(next) {
      options = next;
      buttons.forEach((button, i) => {
        const text = next[i];
        button.textContent = text ?? '';
        button.setAttribute('aria-label', `Answer ${text ?? ''}`);
        button.removeAttribute('aria-disabled');
        button.className = 'sz-answer';
        button.hidden = text === undefined;
      });
    },
    showQuestion(visible) {
      q.hidden = !visible;
      answers.hidden = !visible;
      buttons.forEach((b, i) => (b.hidden = options[i] === undefined));
      if (!visible) clock.classList.remove('on', 'urgent');
    },
    setClock(left, urgent) {
      clock.classList.toggle('on', left !== null);
      clock.classList.toggle('urgent', urgent);
      clockFill.style.width = left === null ? '100%' : `${Math.max(0, Math.min(1, left)) * 100}%`;
    },
    lock() {
      buttons.forEach((b) => b.setAttribute('aria-disabled', 'true'));
    },
    mark(chosen, correct, right) {
      buttons[correct]?.classList.add('right');
      if (chosen >= 0 && !right) buttons[chosen].classList.add('wrong');
      if (chosen >= 0 && right) buttons[chosen].classList.add('chosen');
    },

    showBanner(title, detail, kind, where) {
      bannerTitle.textContent = title;
      bannerDetail.textContent = detail;
      bannerDetail.hidden = !detail;
      banner.className = `sz-banner ${kind}`;
      banner.hidden = false;
      const viewH = window.innerHeight;
      // Above the nudge row on the aim view, above the answers during a question.
      let anchor: number;
      if (where === 'ask' && !answers.hidden) {
        anchor = rectOf(answers).top;
      } else {
        const wasHidden = controls.hidden;
        controls.hidden = false;
        anchor = rectOf(controls).top;
        controls.hidden = wasHidden;
      }
      banner.style.bottom = `${Math.max(viewH - anchor + 8, 8)}px`;
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
      const top = card.getBoundingClientRect().bottom + 8 + 12;
      pill.style.top = `${top}px`;
    },
    hidePill() {
      pill.hidden = true;
      pill.classList.remove('on');
    },
    showScreen(title, kind) {
      screenTitle.textContent = title;
      screenArt.replaceChildren();
      screenArt.className = `sz-screen-art ${kind}`;
      const add = (className: string, text: string) => {
        const node = el('span', className, screenArt);
        node.textContent = text;
        return node;
      };
      switch (kind) {
        case 'strike':
          add('sz-art-pins', '🎳');
          add('sz-art-burst', '💥');
          break;
        case 'double':
          add('sz-art-burst b1', '💥');
          add('sz-art-burst b2', '💥');
          break;
        case 'turkey':
          add('sz-art-turkey', '🦃');
          break;
        case 'perfect':
          add('sz-art-party left', '🎉');
          add('sz-art-trophy', '🏆');
          add('sz-art-party right', '🎉');
          break;
        case 'spare': {
          add('sz-art-pins', '🎳');
          const slash = svg('svg', { viewBox: '0 0 60 80', class: 'sz-art-slash' }, screenArt);
          svg('path', { d: 'M48 6 L12 74', pathLength: 1, class: 'sz-art-slash-path' }, slash);
          break;
        }
        case 'split':
          add('sz-art-pins apart left', '🎳');
          add('sz-art-pins apart right', '🎳');
          break;
      }
      screen.hidden = false;
      screen.classList.remove('on');
      void screen.offsetWidth;
      screen.classList.add('on');
      const bottom = card.getBoundingClientRect().bottom;
      const mid = (bottom + 8 + window.innerHeight - 12) / 2;
      screen.style.top = `${mid}px`;
    },
    hideScreen() {
      screen.hidden = true;
      screen.classList.remove('on');
    },
    confetti() {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      confettiBox.replaceChildren();
      const colours = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'];
      for (let i = 0; i < 40; i++) {
        const piece = el('i', 'sz-piece', confettiBox);
        piece.style.left = `${Math.random() * 100}%`;
        piece.style.background = colours[i % colours.length];
        piece.style.animationDelay = `${Math.random() * 0.5}s`;
        piece.style.setProperty('--sz-drift', `${(Math.random() - 0.5) * 120}px`);
        piece.style.setProperty('--sz-spin', `${(Math.random() - 0.5) * 900}deg`);
      }
      window.clearTimeout(confettiTimer);
      confettiTimer = window.setTimeout(() => confettiBox.replaceChildren(), 2400);
    },

    measureBands() {
      place();
      // Measure with everything shown, then put it back.
      const keep = { q: q.hidden, a: answers.hidden, c: controls.hidden, s: side.hidden };
      q.hidden = false;
      answers.hidden = false;
      controls.hidden = false;
      const cardBottom = card.getBoundingClientRect().bottom;
      const viewH = window.innerHeight;
      const measured: Bands = {
        aim: { top: cardBottom + 8, bottom: rectOf(controls).top - 8 },
        ask: { top: rectOf(q).bottom + 8, bottom: rectOf(answers).top - 8 },
        play: { top: cardBottom + 8, bottom: viewH - 12 },
      };
      q.hidden = keep.q;
      answers.hidden = keep.a;
      controls.hidden = keep.c;
      side.hidden = keep.s;
      return measured;
    },
    cardBottom: () => card.getBoundingClientRect().bottom,

    dispose() {
      for (const node of [
        card,
        side,
        controls,
        hintMove,
        hintSwing,
        q,
        answers,
        banner,
        pill,
        screen,
        confettiBox,
      ]) {
        node.remove();
      }
      window.clearTimeout(confettiTimer);
    },
  };
}
