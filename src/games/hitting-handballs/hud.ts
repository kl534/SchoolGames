import type { Side } from './rules';

export interface ScoreboardSetup {
  /** Left side, e.g. `YOU & SAM`. */
  ourName: string;
  pairName: string;
  /** Under the pair's name, e.g. "Rung 2 of 5". */
  rungText: string;
  /** Pips under our score: one per good hit that wins the point, less the winner itself. */
  streakToWin: number;
  us: number;
  them: number;
  server: Side;
}

export interface Scoreboard {
  /** Fixed container, for the layout to keep clear. */
  root: HTMLElement;
  setup(setup: ScoreboardSetup): void;
  /** Shows the score; a side whose number went up flashes. */
  setScore(us: number, them: number): void;
  /** The yellow dot next to the server's score. */
  setServer(side: Side): void;
  /** Fills this many streak pips (returns this rally). */
  setPips(filled: number): void;
  setVisible(visible: boolean): void;
}

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

/** The chalkboard scoreboard at the top: our side on the left, theirs on the right. */
export function createScoreboard(parent: HTMLElement = document.body): Scoreboard {
  const root = el('div', 'hb-score', parent);
  root.setAttribute('role', 'status');
  const sides: Record<
    Side,
    { box: HTMLElement; name: HTMLElement; number: HTMLElement; dot: HTMLElement; sub: HTMLElement }
  > = {} as never;
  for (const side of ['us', 'them'] as const) {
    const box = el('div', `hb-score-side ${side}`, root);
    const name = el('div', 'hb-score-name', box);
    const row = el('div', 'hb-score-row', box);
    const dot = el('span', 'hb-serve-dot', row);
    dot.title = 'Serving';
    const number = el('span', 'hb-score-number', row);
    const sub = el('div', 'hb-score-sub', box);
    sides[side] = { box, name, number, dot, sub };
  }
  root.hidden = true;
  let pips: HTMLElement[] = [];
  let shown = { us: 0, them: 0 };

  const flash = (side: Side) => {
    const number = sides[side].number;
    number.classList.remove('flash');
    void number.offsetWidth;
    number.classList.add('flash');
  };

  return {
    root,
    setup(s) {
      sides.us.name.textContent = s.ourName;
      sides.them.name.textContent = s.pairName;
      sides.them.sub.textContent = s.rungText;
      sides.us.sub.replaceChildren();
      pips = Array.from({ length: s.streakToWin }, () => el('span', 'hb-pip', sides.us.sub));
      shown = { us: s.us, them: s.them };
      sides.us.number.textContent = String(s.us);
      sides.them.number.textContent = String(s.them);
      this.setServer(s.server);
    },
    setScore(us, them) {
      if (us > shown.us) flash('us');
      if (them > shown.them) flash('them');
      shown = { us, them };
      sides.us.number.textContent = String(us);
      sides.them.number.textContent = String(them);
    },
    setServer(side) {
      sides.us.dot.hidden = side !== 'us';
      sides.them.dot.hidden = side !== 'them';
    },
    setPips(filled) {
      pips.forEach((pip, i) => pip.classList.toggle('on', i < filled));
    },
    setVisible(visible) {
      root.hidden = !visible;
    },
  };
}
