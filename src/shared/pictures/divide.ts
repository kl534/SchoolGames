import type { FactVisual } from '../topics';
import { TREATS } from './critters';
import {
  addLandingDot,
  bunchShape,
  clamp,
  drawTickLine,
  fitCell,
  flowGroups,
  groupBand,
  groupColor,
  hopArc,
  landing,
  pileLayout,
  HOPPER_SIZE,
  LINE_HEIGHT,
  PictureBuilder,
  range,
  stageHeight,
  STAGE_W,
  type Looks,
  type Picture,
  type Step,
} from './plan';
import type { Way } from './ways';

type Divide = Extract<FactVisual, { kind: 'divide' }>;

export function buildDivide(visual: Divide, way: Way, looks: Looks): Picture {
  if (way === 'div-groups') return groups(visual, looks);
  if (way === 'div-share') return share(visual, looks);
  if (way === 'div-line') return line(visual, looks);
  if (way === 'div-rows') return rows(visual, looks);
  throw new Error(`${way} is not a division way`);
}

const PAD = 12;
/** Space between a pile and what it is dealt into, in cells. */
const PILE_GAP = 0.6;
/** Seconds: a treat's flight to its plate (longer than MOVE, so each one reads as a throw). */
const SHARE_MOVE = 0.35;

/** The counts 1, 2 ... n: one step for each group made. */
const countUp = (n: number, move?: number): Step[] => range(1, n).map((k) => ({ count: k, move }));

/** A pile; the next b critters slide together into a ring, n times. */
function groups({ a, b }: Divide, looks: Looks): Picture {
  const n = a / b;
  const bunch = bunchShape(b);
  const pileRows = Math.ceil(a / 10);
  const flow = flowGroups(n, bunch, (c) => (pileRows + PILE_GAP) * c);
  const cell = flow.cell;
  const pile = pileLayout(a, cell);
  const content = pile.height + PILE_GAP * cell + flow.height;
  const height = stageHeight(content + 2 * PAD);
  const top = (height - content) / 2;
  const flowTop = top + pile.height + PILE_GAP * cell;
  const builder = new PictureBuilder(countUp(n));
  const rings = range(0, n - 1).map((k) => {
    const c = flow.centre(k);
    const ring = builder.add(
      { type: 'ring', r: bunch.radius * cell, color: groupColor(k) },
      c.x,
      flowTop + c.y,
      { opacity: 0, scale: 0.3 },
    );
    builder.move(ring, k + 1, { opacity: 1, scale: 1 }, { pop: true });
    return c;
  });
  const critters = range(0, a - 1).map((i) => {
    const from = pile.slot(i, top);
    return builder.add(
      { type: 'critter', emoji: looks.critters[0], size: 0.8 * cell },
      from.x,
      from.y,
    );
  });
  for (let k = 0; k < n; k++) {
    bunch.offsets.forEach((o, j) => {
      builder.move(
        critters[k * b + j],
        k + 1,
        { x: rings[k].x + o.x * cell, y: flowTop + rings[k].y + o.y * cell },
        { arc: 12, pop: true, delay: Math.min(j * 0.04, 0.4) },
      );
    });
  }
  return builder.build('div-groups', height);
}

/** Treats in a pile; each step deals one onto every plate. */
function share({ a, b }: Divide, looks: Looks): Picture {
  const n = a / b;
  const treat = looks.critters.find((c) => TREATS.includes(c)) ?? TREATS[0];
  const pileRows = Math.ceil(a / 10);
  const pitch = (STAGE_W - 2 * PAD) / b;
  const colsOf = (c: number) => clamp(Math.floor((0.92 * pitch) / c), 1, Math.min(n, 4));
  const contentOf = (c: number) =>
    pileRows * c + 0.4 * c + Math.ceil(n / colsOf(c)) * c + 0.2 * c + 0.4 * c;
  const cell = fitCell((c) => contentOf(c) + 2 * PAD <= 360 && 10.6 * c <= STAGE_W - 2 * PAD);
  const cols = colsOf(cell);
  const gridRows = Math.ceil(n / cols);
  const height = stageHeight(contentOf(cell) + 2 * PAD);
  const top = (height - contentOf(cell)) / 2;
  const pile = pileLayout(a, cell);
  const plateY = top + pile.height + 0.4 * cell + gridRows * cell + 0.2 * cell;
  const plateX = (i: number) => PAD + (i + 0.5) * pitch;
  const builder = new PictureBuilder(countUp(n, SHARE_MOVE));
  const rx = Math.min(0.48 * pitch, 0.5 * cols * cell + 0.3 * cell);
  for (let i = 0; i < b; i++) builder.add({ type: 'plate', rx, ry: 0.4 * cell }, plateX(i), plateY);
  const treats = range(0, a - 1).map((i) => {
    const from = pile.slot(i, top);
    return builder.add({ type: 'critter', emoji: treat, size: 0.8 * cell }, from.x, from.y);
  });
  for (let j = 0; j < n; j++) {
    const row = Math.floor(j / cols);
    const inRow = Math.min(cols, n - row * cols);
    for (let i = 0; i < b; i++) {
      const to = {
        x: plateX(i) + ((j % cols) - (inRow - 1) / 2) * cell,
        y: plateY - 0.2 * cell - (row + 0.5) * cell,
      };
      const from = pile.slot(j * b + i, top);
      builder.move(treats[j * b + i], j + 1, to, {
        arc: clamp(0.25 * Math.hypot(to.x - from.x, to.y - from.y), 12, 50),
        pop: true,
        delay: (0.5 * i) / b,
      });
    }
  }
  return builder.build('div-share', height);
}

/** A hopper starts at a and hops back by b, n times, counting the hops. */
function line({ a, b }: Divide, looks: Looks): Picture {
  const n = a / b;
  const builder = new PictureBuilder(countUp(n));
  const nl = drawTickLine(
    builder,
    range(0, n).map((k) => k * b),
  );
  const dots = range(1, n).map((k) => addLandingDot(builder, nl.xOf(a - k * b), nl.y));
  const start = nl.hopperAt(a);
  const hopper = builder.add(
    { type: 'critter', emoji: looks.hopper, size: HOPPER_SIZE },
    start.x,
    start.y,
  );
  for (let k = 1; k <= n; k++) {
    const fromX = nl.xOf(a - (k - 1) * b);
    const to = nl.hopperAt(a - k * b);
    const arc = hopArc(fromX, to.x);
    builder.move(hopper, k, { x: to.x, y: to.y }, { arc, pop: true });
    landing(builder, dots[k - 1], k, n);
    // The hop's number sits over its arc and shows once the hopper has passed.
    const label = builder.add(
      { type: 'text', text: String(k), size: 16, color: '#ffd23f' },
      (fromX + to.x) / 2,
      Math.max(12, start.y - arc - 12),
      { opacity: 0 },
    );
    builder.move(label, k, { opacity: 1 }, { pop: true, delay: 0.5 });
  }
  return builder.build('div-line', LINE_HEIGHT);
}

/** A pile on the left; the next b slide into each row on the right, which gets a band. */
function rows({ a, b }: Divide, looks: Looks): Picture {
  const n = a / b;
  const pileCols = Math.ceil(Math.sqrt(a));
  const pileRows = Math.ceil(a / pileCols);
  const lines = Math.max(pileRows, n);
  const cell = fitCell(
    (c) => (pileCols + 1.2 + b) * c <= STAGE_W - 2 * PAD && lines * c + 2 * PAD <= 360,
  );
  const height = stageHeight(lines * cell + 2 * PAD);
  const top = (height - lines * cell) / 2;
  const left = (STAGE_W - (pileCols + 1.2 + b) * cell) / 2;
  const rowsLeft = left + (pileCols + 1.2) * cell;
  const builder = new PictureBuilder(countUp(n));
  for (let k = 0; k < n; k++) {
    const band = builder.add(
      {
        type: 'rect',
        w: (b + 0.2) * cell,
        h: cell,
        fill: groupBand(k),
        radius: 0.3 * cell,
      },
      rowsLeft + (b * cell) / 2,
      top + (k + 0.5) * cell,
      { opacity: 0 },
    );
    builder.move(band, k + 1, { opacity: 1 }, { pop: true });
  }
  const critters = range(0, a - 1).map((i) =>
    builder.add(
      { type: 'critter', emoji: looks.critters[0], size: 0.8 * cell },
      left + ((i % pileCols) + 0.5) * cell,
      top + (Math.floor(i / pileCols) + 0.5) * cell,
    ),
  );
  for (let k = 0; k < n; k++) {
    for (let j = 0; j < b; j++) {
      builder.move(
        critters[k * b + j],
        k + 1,
        { x: rowsLeft + (j + 0.5) * cell, y: top + (k + 0.5) * cell },
        { arc: 10, pop: true, delay: Math.min(j * 0.03, 0.4) },
      );
    }
  }
  return builder.build('div-rows', height);
}
