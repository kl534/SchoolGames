import { HITS_TO_LOSE, type Side } from './rules';

export interface BarsSetup {
  playerName: string;
  rivalName: string;
  /** Under the rival's name in a lighter weight, e.g. "Rung 2 of 5". */
  rungText: string;
  /** Segments the rival's bar starts with (8 to 12). */
  rivalSegments: number;
  /** Segments to start with (a dev start can begin partly emptied). */
  ourLeft?: number;
  rivalLeft?: number;
}

export interface HealthBars {
  /** Fixed container of both bars, for the layout to keep clear. */
  root: HTMLElement;
  setup(setup: BarsSetup): void;
  /** Loses the segment nearest the centre: it flashes white, shrinks and the bar shakes. */
  lose(side: Side): void;
  /** Segments left on a bar. */
  left(side: Side): number;
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

interface Bar {
  box: HTMLElement;
  track: HTMLElement;
  name: HTMLElement;
  slots: HTMLElement[];
  left: number;
}

/** Fighting-game health bars: yours (green, 3 segments) and the rival's (orange-red, 8 to 12). */
export function createHealthBars(parent: HTMLElement = document.body): HealthBars {
  const root = el('div', 'eg-bars', parent);
  const makeBar = (side: Side): Bar => {
    const box = el('div', `eg-bar-box ${side}`, root);
    const track = el('div', 'eg-bar', box);
    const name = el('div', 'eg-bar-name', box);
    return { box, track, name, slots: [], left: 0 };
  };
  const bars: Record<Side, Bar> = { us: makeBar('us'), them: makeBar('them') };
  el('div', 'eg-vs-badge', root).textContent = 'VS';
  root.hidden = true;

  const fill = (side: Side, total: number, left: number) => {
    const bar = bars[side];
    bar.track.replaceChildren();
    bar.slots = Array.from({ length: total }, (_, i) => {
      const slot = el('div', 'eg-slot', bar.track);
      el('div', 'eg-fill', slot);
      // Segments are in screen order; the centre end is the right of your bar, the left of theirs.
      const lost = side === 'us' ? i >= left : i < total - left;
      if (lost) slot.classList.add('gone');
      return slot;
    });
    bar.left = left;
  };

  return {
    root,
    setup(s) {
      bars.us.name.textContent = s.playerName;
      bars.them.name.replaceChildren();
      bars.them.name.append(s.rivalName);
      el('span', 'eg-rung', bars.them.name).textContent = ` · ${s.rungText}`;
      fill('us', HITS_TO_LOSE, s.ourLeft ?? HITS_TO_LOSE);
      fill('them', s.rivalSegments, s.rivalLeft ?? s.rivalSegments);
    },
    lose(side) {
      const bar = bars[side];
      if (bar.left <= 0) return;
      // The slot nearest the centre that is still there.
      const total = bar.slots.length;
      const slot = bar.slots[side === 'us' ? bar.left - 1 : total - bar.left];
      bar.left--;
      slot.classList.add('flash');
      setTimeout(() => slot.classList.add('gone'), 90);
      bar.box.classList.remove('shake');
      void bar.box.offsetWidth;
      bar.box.classList.add('shake');
    },
    left: (side) => bars[side].left,
    setVisible(visible) {
      root.hidden = !visible;
    },
  };
}
