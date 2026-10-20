import type { FactVisual } from '../topics';
import {
  addFrameCells,
  drawNumberLine,
  fitCell,
  frameLayout,
  gridSlot,
  hopArc,
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

type Add = Extract<FactVisual, { kind: 'add' }>;

export function buildAdd(visual: Add, way: Way, looks: Looks): Picture {
  if (way === 'add-join') return join(visual, looks);
  if (way === 'add-line') return line(visual, looks);
  if (way === 'add-make-ten') return makeTen(visual, looks);
  throw new Error(`${way} is not an addition way`);
}

const PAD = 12;

/** Two bunches side by side; the right ones move over, one at a time, into the left bunch. */
function join({ a, b }: Add, looks: Looks): Picture {
  const s = a + b;
  const rows = Math.ceil(s / 5);
  const cell = fitCell((c) => rows * c + 2 * PAD <= 360 && 10.6 * c <= STAGE_W - 2 * PAD);
  const height = stageHeight(rows * cell + 2 * PAD);
  const left = (STAGE_W - 10.6 * cell) / 2;
  const right = left + 5.6 * cell;
  const top = (height - rows * cell) / 2;
  const size = 0.8 * cell;

  const steps: Step[] = [{ count: a }, ...range(1, b).map((j) => ({ count: a + j }))];
  const builder = new PictureBuilder(steps);
  const leftIds = range(0, a - 1).map((i) => {
    const { x, y } = gridSlot(i, 5, cell, left, top);
    return builder.add({ type: 'critter', emoji: looks.critters[0], size }, x, y);
  });
  leftIds.forEach((id, i) =>
    builder.move(id, 1, {}, { bounce: true, delay: Math.min(i * 0.03, 0.4) }),
  );
  for (let j = 0; j < b; j++) {
    const from = gridSlot(j, 5, cell, right, top);
    const id = builder.add({ type: 'critter', emoji: looks.critters[1], size }, from.x, from.y);
    builder.move(id, 2 + j, gridSlot(a + j, 5, cell, left, top), { pop: true });
  }
  return builder.build('add-join', height);
}

/** A hopper on a number line: one big leap to a, then b hops of one. */
function line({ a, b }: Add, looks: Looks): Picture {
  const s = a + b;
  const steps: Step[] = [{ count: a }, ...range(1, b).map((j) => ({ count: a + j }))];
  const builder = new PictureBuilder(steps);
  const nl = drawNumberLine(builder, a, s);
  // Rings mark the ticks the hopper has landed on.
  const rings = range(a, s).map((v) =>
    builder.add({ type: 'ring', r: 8, color: '#ffd23f' }, nl.xOf(v), nl.y, { opacity: 0 }),
  );
  const start = nl.hopperAt(0);
  const hopper = builder.add(
    { type: 'critter', emoji: looks.hopper, size: HOPPER_SIZE },
    start.x,
    start.y,
  );
  for (let v = a; v <= s; v++) {
    const step = v - a + 1;
    const fromX = nl.xOf(v === a ? 0 : v - 1);
    const to = nl.hopperAt(v);
    builder.move(hopper, step, { x: to.x, y: to.y }, { arc: hopArc(fromX, to.x), pop: true });
    builder.move(rings[v - a], step, { opacity: 1 }, { pop: true });
  }
  return builder.build('add-line', LINE_HEIGHT);
}

/** Ten frames: fill up to the next ten first, then the rest. */
function makeTen({ a, b }: Add, looks: Looks): Picture {
  const s = a + b;
  const need = 10 - (a % 10);
  const ten = a + need;
  const frameCount = Math.ceil(s / 10);
  const frameRows = Math.ceil(frameCount / 2);
  const waitCols = Math.min(b, 10);
  const waitRows = Math.ceil(b / waitCols);
  const total = (c: number) =>
    frameRows * 2 * c + (frameRows - 1) * 0.4 * c + 0.6 * c + waitRows * c;
  const cell = fitCell((c) => total(c) + 2 * PAD <= 360 && 10.6 * c <= STAGE_W - 2 * PAD);
  const height = stageHeight(total(cell) + 2 * PAD);
  const frames = frameLayout(frameCount, cell, PAD, (height - total(cell)) / 2);
  const waitTop = (height - total(cell)) / 2 + frames.height + 0.6 * cell;
  const waitLeft = (STAGE_W - waitCols * cell) / 2;
  const size = 0.8 * cell;

  const steps: Step[] = [
    { count: a },
    { count: ten, caption: `${a} + ${need} = ${ten}` },
    { count: s, caption: `${ten} + ${b - need} = ${s}` },
  ];
  const builder = new PictureBuilder(steps);
  addFrameCells(builder, frames, frameCount, cell);
  for (let i = 0; i < a; i++) {
    const { x, y } = frames.slot(i);
    const id = builder.add({ type: 'critter', emoji: looks.critters[0], size }, x, y);
    builder.move(id, 1, {}, { bounce: true, delay: Math.min(i * 0.03, 0.4) });
  }
  for (let j = 0; j < b; j++) {
    const from = gridSlot(j, waitCols, cell, waitLeft, waitTop);
    const id = builder.add({ type: 'critter', emoji: looks.critters[1], size }, from.x, from.y);
    const to = frames.slot(a + j);
    builder.move(id, j < need ? 2 : 3, to, {
      arc: hopArc(from.x, to.x) / 2 + 10,
      pop: true,
      delay: Math.min((j < need ? j : j - need) * 0.04, 0.4),
    });
  }
  return builder.build('add-make-ten', height);
}
