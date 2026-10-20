import type { FactVisual } from '../topics';
import {
  addLandingDot,
  bunchShape,
  clamp,
  drawTickLine,
  fitCell,
  flowGroups,
  groupColor,
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

type Multiply = Extract<FactVisual, { kind: 'multiply' }>;

export function buildMultiply(visual: Multiply, way: Way, looks: Looks): Picture {
  if (way === 'mul-groups') return groups(visual, looks);
  if (way === 'mul-line') return line(visual, looks);
  if (way === 'mul-array') return array(visual, looks);
  if (way === 'mul-add-up') return addUp(visual, looks);
  if (way === 'mul-split') return split(visual);
  throw new Error(`${way} is not a multiplication way`);
}

const PAD = 12;

/** a groups of b: the counts b, 2b ... ab, one step for each group. */
const groupSteps = (a: number, b: number): Step[] => range(1, a).map((k) => ({ count: k * b }));

/** a rings pop in, each with b critters of its own kind. */
function groups({ a, b }: Multiply, looks: Looks): Picture {
  const bunch = bunchShape(b);
  const flow = flowGroups(a, bunch);
  const cell = flow.cell;
  const height = stageHeight(flow.height + 2 * PAD);
  const top = (height - flow.height) / 2;
  const builder = new PictureBuilder(groupSteps(a, b));
  for (let k = 0; k < a; k++) {
    const c = flow.centre(k);
    const ring = builder.add(
      { type: 'ring', r: bunch.radius * cell, color: groupColor(k) },
      c.x,
      top + c.y,
      { opacity: 0, scale: 0.3 },
    );
    builder.move(ring, k + 1, { opacity: 1, scale: 1 }, { pop: true });
    bunch.offsets.forEach((o, j) => {
      const id = builder.add(
        { type: 'critter', emoji: looks.critters[k], size: 0.8 * cell },
        c.x + o.x * cell,
        top + c.y + o.y * cell,
        { opacity: 0, scale: 0.3 },
      );
      builder.move(
        id,
        k + 1,
        { opacity: 1, scale: 1 },
        { pop: true, delay: Math.min(j * 0.04, 0.4) },
      );
    });
  }
  return builder.build('mul-groups', height);
}

/** A hopper on a number line makes a hops of b. */
function line({ a, b }: Multiply, looks: Looks): Picture {
  const builder = new PictureBuilder(groupSteps(a, b));
  const nl = drawTickLine(
    builder,
    range(0, a).map((k) => k * b),
  );
  const dots = range(1, a).map((k) => addLandingDot(builder, nl.xOf(k * b), nl.y));
  const start = nl.hopperAt(0);
  const hopper = builder.add(
    { type: 'critter', emoji: looks.hopper, size: HOPPER_SIZE },
    start.x,
    start.y,
  );
  for (let k = 1; k <= a; k++) {
    const to = nl.hopperAt(k * b);
    builder.move(
      hopper,
      k,
      { x: to.x, y: to.y },
      { arc: hopArc(nl.xOf((k - 1) * b), to.x), pop: true },
    );
    landing(builder, dots[k - 1], k, a);
  }
  return builder.build('mul-line', LINE_HEIGHT);
}

/** An empty grid of a rows by b columns; the rows slide in from the left, one kind each. */
function array({ a, b }: Multiply, looks: Looks): Picture {
  const cell = fitCell((c) => a * c + 2 * PAD <= 360 && b * c + 2 * PAD <= STAGE_W);
  const height = stageHeight(a * cell + 2 * PAD);
  const left = (STAGE_W - b * cell) / 2;
  const top = (height - a * cell) / 2;
  const size = 0.8 * cell;
  const slide = Math.min(60, left);
  const builder = new PictureBuilder(groupSteps(a, b));
  for (let r = 0; r < a; r++) {
    for (let col = 0; col < b; col++) {
      builder.add(
        {
          type: 'rect',
          w: cell * 0.94,
          h: cell * 0.94,
          fill: 'rgba(255,255,255,0.05)',
          stroke: 'rgba(255,255,255,0.4)',
          radius: cell * 0.18,
        },
        left + (col + 0.5) * cell,
        top + (r + 0.5) * cell,
      );
    }
  }
  for (let r = 0; r < a; r++) {
    for (let col = 0; col < b; col++) {
      const x = left + (col + 0.5) * cell;
      const id = builder.add(
        { type: 'critter', emoji: looks.critters[r], size },
        x - slide,
        top + (r + 0.5) * cell,
        { opacity: 0 },
      );
      builder.move(id, r + 1, { x, opacity: 1 }, { pop: true, delay: Math.min(col * 0.03, 0.4) });
    }
  }
  return builder.build('mul-array', height);
}

const ROW_SUM = 30;
const ROW_TOTAL = 40;
const SUM_GAP = 8;
/** Height of the sum line, the gap and the running total under it, plus the gap above. */
const SUM_H = ROW_SUM + SUM_GAP + ROW_TOTAL + 10;

/**
 * Bunches pop in one by one, each adding its `b` to the sum line under them; a running total
 * sits under the line and ends as the answer. Past 60 critters the terms are coloured bubbles.
 */
function addUp({ a, b }: Multiply, looks: Looks): Picture {
  const p = a * b;
  const bubbles = p > 60;
  const bunch = bunchShape(b);
  const flow = bubbles ? null : flowGroups(a, bunch, () => 0, 360 - 2 * PAD - SUM_H);
  const cell = flow?.cell ?? 0;
  const content = (flow?.height ?? 0) + SUM_H;
  const height = stageHeight(content + 2 * PAD);
  const top = (height - content) / 2;
  const builder = new PictureBuilder(groupSteps(a, b));

  if (flow) {
    for (let k = 0; k < a; k++) {
      const c = flow.centre(k);
      bunch.offsets.forEach((o, j) => {
        const id = builder.add(
          { type: 'critter', emoji: looks.critters[k], size: 0.8 * cell },
          c.x + o.x * cell,
          top + c.y + o.y * cell,
          { opacity: 0, scale: 0.3 },
        );
        builder.move(
          id,
          k + 1,
          { opacity: 1, scale: 1 },
          { pop: true, delay: Math.min(j * 0.04, 0.4) },
        );
      });
    }
  }

  // The sum line: b + b + b ..., a term for each step.
  const lineY = top + (flow?.height ?? 0) + 10 + ROW_SUM / 2;
  const digits = String(b).length;
  const unit = bubbles ? 0 : digits * 0.62 + 1.1;
  const radius = bubbles ? clamp((STAGE_W - 2 * PAD - (a - 1) * 16) / (2 * a), 12, 22) : 0;
  const size = bubbles ? radius * 1.15 : clamp((STAGE_W - 2 * PAD) / (a * unit), 12, 26);
  const termW = bubbles ? 2 * radius : digits * 0.62 * size;
  const plusW = bubbles ? 16 : 1.1 * size;
  const lineW = a * termW + (a - 1) * plusW;
  const left = (STAGE_W - lineW) / 2;
  for (let k = 0; k < a; k++) {
    const x = left + k * (termW + plusW) + termW / 2;
    if (k > 0) {
      const plus = builder.add(
        { type: 'text', text: '+', size: bubbles ? 18 : size },
        x - termW / 2 - plusW / 2,
        lineY,
        { opacity: 0 },
      );
      builder.move(plus, k + 1, { opacity: 1 }, { pop: true });
    }
    const parts: number[] = [];
    if (bubbles) {
      parts.push(
        builder.add({ type: 'dot', r: radius, color: groupColor(k) }, x, lineY, {
          opacity: 0,
          scale: 0.3,
        }),
      );
      parts.push(
        builder.add({ type: 'text', text: String(b), size, color: '#0f1220' }, x, lineY, {
          opacity: 0,
          scale: 0.3,
        }),
      );
    } else {
      parts.push(
        builder.add({ type: 'text', text: String(b), size }, x, lineY, {
          opacity: 0,
          scale: 0.3,
        }),
      );
    }
    for (const id of parts) builder.move(id, k + 1, { opacity: 1, scale: 1 }, { pop: true });
  }

  // The running total under the line: "= (k b)", the last one green.
  const totalY = lineY + ROW_SUM / 2 + SUM_GAP + ROW_TOTAL / 2;
  const equals = builder.add({ type: 'text', text: '=', size: 26 }, STAGE_W / 2 - 34, totalY, {
    opacity: 0,
  });
  builder.move(equals, 1, { opacity: 1 });
  for (let k = 1; k <= a; k++) {
    const last = k === a;
    const dot = builder.add(
      { type: 'dot', r: 19, color: last ? '#5cf2b0' : '#ff7a59' },
      STAGE_W / 2 + 6,
      totalY,
      { opacity: 0, scale: 0.3 },
    );
    const text = builder.add(
      { type: 'text', text: String(k * b), size: 17, color: last ? '#0f1220' : '#fff' },
      STAGE_W / 2 + 6,
      totalY,
      { opacity: 0, scale: 0.3 },
    );
    for (const id of [dot, text]) {
      builder.move(id, k, { opacity: 1, scale: 1 }, { pop: true });
      if (!last) builder.move(id, k + 1, { opacity: 0 });
    }
  }
  return builder.build('mul-add-up', height);
}

/** Two blocks of square cells: a rows by b columns cut at ten, filled and added. */
function split({ a, b }: Multiply): Picture {
  const rowsCut = a > 10;
  const first = rowsCut ? { rows: 10, cols: b } : { rows: a, cols: 10 };
  const second = rowsCut ? { rows: a - 10, cols: b } : { rows: a, cols: b - 10 };
  const gap = 0.6;
  const totalRows = rowsCut ? a + gap : a;
  const totalCols = rowsCut ? b : b + gap;
  const cell = fitCell((c) => totalRows * c + 2 * PAD <= 360 && totalCols * c + 2 * PAD <= STAGE_W);
  const height = stageHeight(totalRows * cell + 2 * PAD);
  const left = (STAGE_W - totalCols * cell) / 2;
  const top = (height - totalRows * cell) / 2;
  const n1 = first.rows * first.cols;
  const n2 = second.rows * second.cols;
  const p = a * b;
  const steps: Step[] = [
    { count: n1, caption: rowsCut ? `10 × ${b} = ${n1}` : `${a} × 10 = ${n1}` },
    {
      count: n2,
      caption: rowsCut ? `${a - 10} × ${b} = ${n2}` : `${a} × ${b - 10} = ${n2}`,
    },
    { count: p, caption: `${n1} + ${n2} = ${p}` },
  ];
  const builder = new PictureBuilder(steps);
  const blocks = [
    { block: first, color: '#5cc8ff', x: left, y: top },
    {
      block: second,
      color: '#ff7a59',
      x: rowsCut ? left : left + (10 + gap) * cell,
      y: rowsCut ? top + (10 + gap) * cell : top,
    },
  ];
  blocks.forEach(({ block, color, x, y }, index) => {
    const count = block.rows * block.cols;
    for (let i = 0; i < count; i++) {
      const id = builder.add(
        {
          type: 'rect',
          w: cell * 0.94,
          h: cell * 0.94,
          fill: color,
          stroke: 'rgba(255,255,255,0.4)',
          radius: cell * 0.18,
        },
        x + ((i % block.cols) + 0.5) * cell,
        y + (Math.floor(i / block.cols) + 0.5) * cell,
        { opacity: 0.15 },
      );
      builder.move(id, index + 1, { opacity: 1 }, { delay: (i / count) * 0.45 });
      builder.move(id, 3, {}, { bounce: true });
    }
  });
  return builder.build('mul-split', height);
}
