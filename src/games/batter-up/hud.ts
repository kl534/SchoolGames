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
  runs: number;
  best: number;
  outs: number;
  strikes: number;
  batter: number;
  batters: number;
  bases: readonly [boolean, boolean, boolean];
}

export type BannerKind = 'hit' | 'miss' | 'out' | 'info';

export interface Hud {
  /** Question, clock and answers. */
  hideQuestion(hidden: boolean): void;
  setQuestion(text: string): void;
  setOptions(options: string[]): void;
  setClock(fraction: number): void;
  /** Dims the answers while a result plays out (they stay tappable to skip ahead). */
  lock(): void;
  mark(chosen: number, correct: number, right: boolean): void;
  /** The answer that was picked on a correct hit; the rest fade. */
  markHit(chosen: number): void;
  renderBug(info: BugInfo): void;
  flashRuns(): void;
  showBanner(
    title: string,
    detail: string,
    kind: BannerKind,
    place?: 'centre' | 'top' | 'aside',
  ): void;
  hideBanner(): void;
  /** Floats a short message up from a spot on the screen. */
  pop(text: string, x: number, y: number, kind?: 'good' | 'bad' | 'plain'): void;
  readonly buttons: HTMLButtonElement[];
  readonly hear: HTMLButtonElement;
}

export function createHud(): Hud {
  const bug = el('div', 'bu-bug', document.body);
  const { bases } = createDiamond(bug);
  const bugText = el('div', 'bu-bug-text', bug);
  const rowRuns = el('div', 'bu-row', bugText);
  el('span', 'bu-label', rowRuns).textContent = 'Runs';
  const runsValue = el('b', 'bu-runs', rowRuns);
  const bestText = el('span', 'bu-best', rowRuns);
  const rowCount = el('div', 'bu-row', bugText);
  el('span', 'bu-label', rowCount).textContent = 'Outs';
  const outsValue = el('span', 'bu-dots bu-outs', rowCount);
  el('span', 'bu-label', rowCount).textContent = 'Strikes';
  const strikesValue = el('span', 'bu-dots bu-strikes', rowCount);
  const batterText = el('div', 'bu-row bu-batter', bugText);

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
  hudBox.hidden = true;
  answers.hidden = true;

  const replay = (node: HTMLElement) => {
    node.classList.remove('on');
    void node.offsetWidth;
    node.classList.add('on');
  };

  return {
    buttons,
    hear,
    hideQuestion(hidden) {
      hudBox.hidden = hidden;
      answers.hidden = hidden;
      buttons.forEach((b, i) => (b.hidden = options[i] === undefined));
    },
    setQuestion(text) {
      problemText.textContent = text;
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
      runsValue.textContent = String(info.runs);
      bestText.textContent = `Best ${info.best}`;
      setDots(outsValue, info.outs, 3);
      setDots(strikesValue, info.strikes, 3);
      batterText.textContent = `Batter ${Math.min(info.batter, info.batters)} of ${info.batters}`;
      bases.forEach((base, i) => base.classList.toggle('on', info.bases[i]));
      bug.setAttribute(
        'aria-label',
        `${info.runs} runs, ${info.outs} outs, ${info.strikes} strikes, batter ${info.batter} of ${info.batters}`,
      );
    },
    flashRuns() {
      replay(runsValue);
    },
    showBanner(title, detail, kind, place = 'centre') {
      bannerTitle.textContent = title;
      bannerDetail.textContent = detail;
      bannerDetail.hidden = !detail;
      banner.className = `bu-banner ${kind}`;
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
      const bottom = answers.hidden ? viewH - 20 : answers.getBoundingClientRect().top - 8;
      if (place === 'aside') {
        // Keep the plate clear: on a wide screen the call goes to one side, and on a tall one it
        // sits just under the question.
        if (viewW > 640 && viewW > viewH * 1.2) {
          banner.style.left = `${Math.round(viewW * 0.76)}px`;
          banner.style.top = `${Math.min(Math.max((top + bottom) / 2, top + half), bottom - half)}px`;
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
