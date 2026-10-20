import type { FactVisual } from '../topics';
import {
  addFrameCells,
  addLandingDot,
  drawNumberLine,
  fitCell,
  frameLayout,
  gridSlot,
  hopArc,
  landing,
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

type Subtract = Extract<FactVisual, { kind: 'subtract' }>;

export function buildSubtract(visual: Subtract, way: Way, looks: Looks): Picture {
  if (way === 'sub-take-away') return takeAway(visual, looks);
  if (way === 'sub-line') return line(visual, looks);
  if (way === 'sub-cross-out') return crossOut(visual, looks);
  if (way === 'sub-gap') return gap(visual, looks);
  throw new Error(`${way} is not a subtraction way`);
}

const PAD = 12;

/** The counts a, a - 1 ... a - b: the first step says a, each later step takes one away. */
const countDown = (a: number, b: number): Step[] => range(0, b).map((k) => ({ count: a - k }));

/** A bunch; the last one left waves and runs off, one at a time. */
function takeAway({ a, b }: Subtract, looks: Looks): Picture {
  const cols = Math.min(5, a);
  const rows = Math.ceil(a / 5);
  const cell = fitCell((c) => rows * c + 0.7 * c + 2 * PAD <= 360);
  const top = 0.7 * cell + PAD;
  const height = stageHeight(rows * cell + top + PAD);
  const left = (STAGE_W - cols * cell) / 2;
  const size = 0.8 * cell;
  const builder = new PictureBuilder(countDown(a, b));
  const ids = range(0, a - 1).map((i) => {
    const { x, y } = gridSlot(i, 5, cell, left, top);
    return builder.add({ type: 'critter', emoji: looks.critters[0], size }, x, y);
  });
  ids.forEach((id, i) => builder.move(id, 1, {}, { bounce: true, delay: Math.min(i * 0.03, 0.4) }));
  const exit = STAGE_W - size / 2 - 2;
  for (let k = 1; k <= b; k++) {
    const index = a - k;
    const { x, y } = gridSlot(index, 5, cell, left, top);
    builder.move(ids[index], k + 1, { x: exit, opacity: 0 }, { arc: 8 });
    // The hand waves from just above and behind the runner, and leaves with it.
    const wave = builder.add(
      { type: 'text', text: '👋', size: 0.6 * cell },
      x + 0.55 * cell,
      y - 0.5 * cell,
      { opacity: 0 },
    );
    builder.move(
      wave,
      k + 1,
      { x: exit + 0.55 * cell, opacity: 0 },
      { from: { opacity: 1 }, arc: 8 },
    );
  }
  return builder.build('sub-take-away', height);
}

/** A hopper starts at a and hops back b times. */
function line({ a, b }: Subtract, looks: Looks): Picture {
  const d = a - b;
  const builder = new PictureBuilder(countDown(a, b));
  const nl = drawNumberLine(builder, d, a);
  const dots = range(0, b).map((k) => addLandingDot(builder, nl.xOf(a - k), nl.y));
  const start = nl.hopperAt(a);
  const hopper = builder.add(
    { type: 'critter', emoji: looks.hopper, size: HOPPER_SIZE },
    start.x,
    start.y,
  );
  builder.move(hopper, 1, {}, { bounce: true });
  const last = b + 1;
  landing(builder, dots[0], 1, last);
  for (let k = 1; k <= b; k++) {
    const to = nl.hopperAt(a - k);
    builder.move(
      hopper,
      k + 1,
      { x: to.x, y: to.y },
      { arc: hopArc(nl.xOf(a - k + 1), to.x), pop: true },
    );
    landing(builder, dots[k], k + 1, last);
  }
  return builder.build('sub-line', LINE_HEIGHT);
}

/** a in ten frames; from the last, a red cross stamps on and the critter fades. */
function crossOut({ a, b }: Subtract, looks: Looks): Picture {
  const frameCount = Math.ceil(a / 10);
  const frameRows = Math.ceil(frameCount / 2);
  const total = (c: number) => frameRows * 2 * c + (frameRows - 1) * 0.4 * c;
  const cell = fitCell((c) => total(c) + 2 * PAD <= 360 && 10.6 * c <= STAGE_W - 2 * PAD);
  const height = stageHeight(total(cell) + 2 * PAD);
  const frames = frameLayout(frameCount, cell, PAD, (height - total(cell)) / 2);
  const size = 0.8 * cell;
  const builder = new PictureBuilder(countDown(a, b));
  addFrameCells(builder, frames, frameCount, cell);
  const ids = range(0, a - 1).map((i) => {
    const { x, y } = frames.slot(i);
    return builder.add({ type: 'critter', emoji: looks.critters[0], size }, x, y);
  });
  ids.forEach((id, i) => builder.move(id, 1, {}, { bounce: true, delay: Math.min(i * 0.03, 0.4) }));
  for (let k = 1; k <= b; k++) {
    const index = a - k;
    const { x, y } = frames.slot(index);
    builder.move(ids[index], k + 1, { opacity: 0.4 });
    const cross = builder.add({ type: 'cross', size: 0.9 * cell }, x, y, {
      opacity: 0,
      scale: 1.8,
    });
    builder.move(cross, k + 1, { opacity: 1, scale: 1 }, { pop: true });
  }
  return builder.build('sub-cross-out', height);
}

/** b above a: match them up, then count the extras (how many more a has). */
function gap({ a, b }: Subtract, looks: Looks): Picture {
  const d = a - b;
  const cell = Math.min(42, Math.floor((STAGE_W - 2 * PAD) / a));
  const size = 0.8 * cell;
  const left = (STAGE_W - a * cell) / 2;
  const topY = PAD + 0.5 * cell;
  const bottomY = topY + 1.9 * cell;
  const height = stageHeight(bottomY + 0.5 * cell + PAD);
  const steps: Step[] = [{ count: null }, ...range(1, d).map((k) => ({ count: k }))];
  const builder = new PictureBuilder(steps);
  const x = (i: number) => left + (i + 0.5) * cell;
  const links: number[] = [];
  for (let i = 0; i < b; i++) {
    builder.add({ type: 'critter', emoji: looks.critters[0], size }, x(i), topY);
  }
  for (let i = 0; i < b; i++) {
    links.push(
      builder.add(
        {
          type: 'line',
          dx: 0,
          dy: bottomY - topY - 0.9 * cell,
          width: 2,
          dashed: true,
          color: 'rgba(255,255,255,0.7)',
        },
        x(i),
        topY + 0.45 * cell,
        { opacity: 0 },
      ),
    );
  }
  for (let i = 0; i < a; i++) {
    const id = builder.add({ type: 'critter', emoji: looks.critters[1], size }, x(i), bottomY);
    if (i < b) builder.move(id, 1, { opacity: 0.5 });
    else {
      const k = i - b + 1;
      builder.move(id, k + 1, {}, { bounce: true });
      const ring = builder.add({ type: 'ring', r: 0.5 * cell, color: '#ffd23f' }, x(i), bottomY, {
        opacity: 0,
      });
      builder.move(ring, k + 1, { opacity: 1 }, { pop: true });
    }
  }
  links.forEach((id) => builder.move(id, 1, { opacity: 1 }));
  return builder.build('sub-gap', height);
}
