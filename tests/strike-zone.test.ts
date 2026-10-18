import { describe, expect, it } from 'vitest';
import {
  aimThrough,
  arrowTipX,
  clampAim,
  DEFAULT_AIM,
  driftFor,
  driftSide,
  gutterSide,
  lineX,
  MAX_DRIFT,
  moveBowler,
  swingArrow,
  thrownAim,
  throwPath,
  type Aim,
} from '../src/games/strike-zone/aim';
import {
  AIM_LIMIT,
  ARROW_Z,
  BALL_SPEED,
  BOARD_W,
  DECK_BACK_Z,
  HEAD_Z,
  LANE_HALF,
  pinSpot,
  PIN_IDS,
  RELEASE_Z,
  ROW_GAP,
  type PinId,
} from '../src/games/strike-zone/geometry';
import {
  allCallLines,
  bigTitle,
  callFor,
  callSpeech,
  countMarks,
  frameMarks,
  frameRolls,
  GAME_OVER_SPEECH,
  isSplit,
  isValidRolls,
  LAST_FRAME_SPEECH,
  NEW_HIGH_SCORE_SPEECH,
  outcomeText,
  PIN_COUNT_SPEECH,
  pillText,
  position,
  runningTotals,
  strikeStreak,
  totalScore,
  type Call,
} from '../src/games/strike-zone/rules';
import { VOICE_LINES } from '../src/games/strike-zone/voice';
import { seededRandom } from '../src/shared/random';

const total = (rolls: number[]) => totalScore(rolls);

describe('geometry', () => {
  it('lays the pins out in a triangle', () => {
    expect(pinSpot(1)).toEqual({ x: 0, z: -18.288 });
    expect(pinSpot(7).x).toBeCloseTo(-0.4572);
    expect(pinSpot(10).x).toBeCloseTo(0.4572);
    expect(pinSpot(7).z).toBeCloseTo(-18.288 - 3 * ROW_GAP);
    expect(DECK_BACK_Z).toBeCloseTo(-19.15, 2);
    expect(AIM_LIMIT).toBeCloseTo(0.415, 3);
  });
});

describe('scoring', () => {
  it('scores a perfect game as 300', () => {
    const rolls = Array<number>(12).fill(10);
    expect(total(rolls)).toBe(300);
    expect(frameMarks(rolls)[9]).toEqual(['X', 'X', 'X']);
    expect(frameMarks(rolls)[0]).toEqual(['X', '']);
    expect(runningTotals(rolls)).toEqual([30, 60, 90, 120, 150, 180, 210, 240, 270, 300]);
  });

  it('scores known games', () => {
    expect(total(Array<number>(20).fill(0))).toBe(0);
    expect(total(Array<number>(21).fill(5))).toBe(150);
    expect(total(Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 9 : 0)))).toBe(90);
    expect(total([10, 7, 3, 9, 0, 10, 0, 8, 8, 2, 0, 6, 10, 10, 10, 8, 1])).toBe(167);
  });

  it('gives the classic example its frame totals', () => {
    const rolls = [10, 7, 3, 9, 0, 10, 0, 8, 8, 2, 0, 6, 10, 10, 10, 8, 1];
    expect(runningTotals(rolls)).toEqual([20, 39, 48, 66, 74, 84, 90, 120, 148, 167]);
  });

  it('adds the 10th frame bonus balls to the 9th', () => {
    // Nine strikes, then a 10th of 7, 3, 10: the 9th strike gets 10 + 7 + 3.
    const rolls = [...Array<number>(9).fill(10), 7, 3, 10];
    const totals = runningTotals(rolls);
    expect(totals[8] - totals[7]).toBe(20);
    expect(totals[9]).toBe(totals[8] + 20);
    expect(frameMarks(rolls)[9]).toEqual(['7', '/', 'X']);
  });

  it('leaves totals null until the bonus rolls exist', () => {
    expect(runningTotals([10])).toEqual(Array(10).fill(null));
    expect(runningTotals([10, 10])).toEqual(Array(10).fill(null));
    expect(runningTotals([10, 10, 4])[0]).toBe(24);
    expect(runningTotals([10, 10, 4])[1]).toBeNull();
    expect(runningTotals([7, 3])[0]).toBeNull();
    expect(runningTotals([7, 3, 5])[0]).toBe(15);
    expect(runningTotals([7, 3, 5])[1]).toBeNull();
    expect(runningTotals([3, 4])[0]).toBe(7);
    expect(totalScore([])).toBe(0);
    expect(totalScore([10, 10])).toBe(0);
    expect(totalScore([3, 4, 10, 2, 5])).toBe(7 + 17 + 7);
  });

  it('shows the marks in the boxes', () => {
    const marks = frameMarks([10, 7, 3, 9, 0]);
    expect(marks.slice(0, 4)).toEqual([
      ['X', ''],
      ['7', '/'],
      ['9', '-'],
      ['', ''],
    ]);
    expect(marks).toHaveLength(10);
    expect(marks[9]).toEqual(['', '', '']);
    expect(frameMarks([0, 10])[0]).toEqual(['-', '/']);
    // 10th frame: a spare after a gutter, then a fresh rack strike.
    expect(frameMarks([...Array<number>(18).fill(0), 0, 10, 10])[9]).toEqual(['-', '/', 'X']);
    expect(frameMarks([...Array<number>(18).fill(0), 10, 3, 7])[9]).toEqual(['X', '3', '/']);
  });

  it('groups rolls by frame', () => {
    expect(frameRolls([10, 7, 3, 4])).toEqual([[10], [7, 3], [4]]);
    expect(frameRolls([...Array<number>(18).fill(0), 10, 10, 10])[9]).toEqual([10, 10, 10]);
  });

  it('counts strikes and spares', () => {
    expect(countMarks([10, 7, 3, 4, 5])).toEqual({ strikes: 1, spares: 1 });
    expect(countMarks([0, 10])).toEqual({ strikes: 0, spares: 1 });
    expect(countMarks(Array<number>(12).fill(10))).toEqual({ strikes: 12, spares: 0 });
    expect(strikeStreak([])).toBe(0);
    expect(strikeStreak([10, 10, 3])).toBe(0);
    expect(strikeStreak([3, 4, 10, 10])).toBe(2);
    expect(strikeStreak([0, 10])).toBe(0);
    expect(strikeStreak([3, 4, 10, 10, 3])).toBe(0);
    expect(strikeStreak(Array<number>(12).fill(10))).toBe(12);
  });
});

describe('position', () => {
  const upTo9 = Array<number>(18).fill(0);

  it('starts on a full rack', () => {
    expect(position([])).toEqual({ frame: 1, ball: 1, standing: 10, fullRack: true, over: false });
  });

  it('frames 1-9: a strike goes to the next frame', () => {
    expect(position([10])).toEqual({
      frame: 2,
      ball: 1,
      standing: 10,
      fullRack: true,
      over: false,
    });
  });

  it('frames 1-9: an open first ball keeps the pins left', () => {
    expect(position([6])).toEqual({ frame: 1, ball: 2, standing: 4, fullRack: false, over: false });
    expect(position([0])).toEqual({
      frame: 1,
      ball: 2,
      standing: 10,
      fullRack: false,
      over: false,
    });
  });

  it('frames 1-9: after ball 2 the next frame starts on a full rack', () => {
    expect(position([6, 4])).toEqual({
      frame: 2,
      ball: 1,
      standing: 10,
      fullRack: true,
      over: false,
    });
    expect(position([6, 3])).toEqual({
      frame: 2,
      ball: 1,
      standing: 10,
      fullRack: true,
      over: false,
    });
  });

  it('10th: ball 1', () => {
    expect(position(upTo9)).toEqual({
      frame: 10,
      ball: 1,
      standing: 10,
      fullRack: true,
      over: false,
    });
  });

  it('10th: a strike on ball 1 racks again for ball 2', () => {
    expect(position([...upTo9, 10])).toEqual({
      frame: 10,
      ball: 2,
      standing: 10,
      fullRack: true,
      over: false,
    });
  });

  it('10th: an open ball 1 leaves the pins for ball 2', () => {
    expect(position([...upTo9, 7])).toEqual({
      frame: 10,
      ball: 2,
      standing: 3,
      fullRack: false,
      over: false,
    });
  });

  it('10th: after a strike, a strike on ball 2 racks for ball 3', () => {
    expect(position([...upTo9, 10, 10])).toEqual({
      frame: 10,
      ball: 3,
      standing: 10,
      fullRack: true,
      over: false,
    });
  });

  it('10th: after a strike, an open ball 2 leaves the pins for ball 3', () => {
    expect(position([...upTo9, 10, 6])).toEqual({
      frame: 10,
      ball: 3,
      standing: 4,
      fullRack: false,
      over: false,
    });
  });

  it('10th: a spare earns a full rack for ball 3', () => {
    expect(position([...upTo9, 7, 3])).toEqual({
      frame: 10,
      ball: 3,
      standing: 10,
      fullRack: true,
      over: false,
    });
  });

  it('10th: an open frame ends the game', () => {
    expect(position([...upTo9, 7, 2]).over).toBe(true);
    expect(position([...upTo9, 0, 0]).over).toBe(true);
  });

  it('10th: ball 3 ends the game', () => {
    expect(position([...upTo9, 10, 10, 10]).over).toBe(true);
    expect(position([...upTo9, 7, 3, 4]).over).toBe(true);
    expect(position([...upTo9, 10, 6, 4]).over).toBe(true);
  });

  it('rejects rolls that cannot happen', () => {
    expect(isValidRolls([])).toBe(true);
    expect(isValidRolls([11])).toBe(false);
    expect(isValidRolls([-1])).toBe(false);
    expect(isValidRolls([1.5])).toBe(false);
    expect(isValidRolls([7, 4])).toBe(false);
    expect(isValidRolls([7, 3])).toBe(true);
    expect(isValidRolls([...upTo9, 7, 2, 0])).toBe(false);
    expect(isValidRolls([...upTo9, 10, 10, 10, 10])).toBe(false);
    expect(isValidRolls([...upTo9, 10, 6, 5])).toBe(false);
    expect(() => position([7, 4])).toThrow();
  });
});

describe('random games', () => {
  it('always play out to a legal score', () => {
    const random = seededRandom(2026);
    for (let game = 0; game < 1000; game++) {
      const rolls: number[] = [];
      let where = position(rolls);
      while (!where.over) {
        rolls.push(Math.floor(random() * (where.standing + 1)));
        where = position(rolls);
      }
      expect(rolls.length).toBeGreaterThanOrEqual(11);
      expect(rolls.length).toBeLessThanOrEqual(21);
      const score = totalScore(rolls);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(300);
      const totals = runningTotals(rolls);
      expect(totals.every((t) => t !== null)).toBe(true);
      for (let f = 1; f < 10; f++) expect(totals[f]!).toBeGreaterThanOrEqual(totals[f - 1]!);
      expect(totals[9]).toBe(score);
      for (const box of frameMarks(rolls).flat()) expect(box).toMatch(/^(X|-|\/|[1-9])?$/);
    }
  });
});

describe('isSplit', () => {
  const yes = [
    [7, 10],
    [4, 6],
    [7, 9],
    [8, 10],
    [3, 10],
    [2, 7],
    [5, 7],
    [5, 10],
    [4, 5],
    [5, 6],
    [2, 10],
    [3, 7],
    [4, 9],
    [6, 8],
    [4, 7, 10],
    [6, 7, 10],
    [4, 5, 6],
  ] as PinId[][];
  const no = [
    [7, 8],
    [9, 10],
    [2, 8],
    [3, 9],
    [2, 4, 7],
    [5, 8, 9],
    [2, 4, 5, 8],
    [7],
    [10],
    [],
    [1, 7, 10],
    [1, 2],
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  ] as PinId[][];

  it.each(yes)('%j is a split', (...pins) => {
    expect(isSplit(pins as PinId[])).toBe(true);
  });
  it.each(no)('%j is not a split', (...pins) => {
    expect(isSplit(pins as PinId[])).toBe(false);
  });
  it('does not depend on the order', () => {
    expect(isSplit([10, 7])).toBe(true);
    expect(isSplit([8, 7])).toBe(false);
  });
});

describe('calls', () => {
  const full: number[] = [];
  const all = [...PIN_IDS];
  const leave = (...gone: PinId[]) => all.filter((p) => !gone.includes(p));

  it('calls a strike with its streak', () => {
    expect(callFor(full, 10, [], false, false)).toEqual({ kind: 'strike', streak: 1 });
    expect(callFor([10], 10, [], false, false)).toEqual({ kind: 'strike', streak: 2 });
    expect(callFor([10, 10], 10, [], false, false)).toEqual({ kind: 'strike', streak: 3 });
    expect(callFor(Array<number>(11).fill(10), 10, [], false, false)).toEqual({
      kind: 'strike',
      streak: 12,
    });
    expect(callFor([3, 4, 10], 10, [], false, false)).toEqual({ kind: 'strike', streak: 2 });
  });

  it('calls a spare, and a picked up split', () => {
    expect(callFor([7], 3, [], false, false)).toEqual({ kind: 'spare', fromSplit: false });
    expect(callFor([7], 3, [], false, true)).toEqual({ kind: 'spare', fromSplit: true });
    // A zero then ten is a spare, not a strike.
    expect(callFor([0], 10, [], false, false)).toEqual({ kind: 'spare', fromSplit: false });
  });

  it('calls a split only on a fresh rack', () => {
    expect(callFor(full, 8, [7, 10], false, false)).toEqual({ kind: 'split', pins: 8 });
    // The second ball of a frame that leaves a split is just a count.
    expect(callFor([3], 2, [7, 10], false, true)).toEqual({ kind: 'count', pins: 2 });
  });

  it('calls counts and misses', () => {
    expect(callFor(full, 7, [8, 9, 10], false, false)).toEqual({ kind: 'count', pins: 7 });
    expect(callFor([7], 0, [8, 9, 10], false, false)).toEqual({ kind: 'missed' });
    expect(callFor([7], 1, [9, 10], false, false)).toEqual({ kind: 'count', pins: 1 });
    expect(callFor(full, 0, all, false, false)).toEqual({ kind: 'missed' });
  });

  it('lets a gutter ball win over everything', () => {
    expect(callFor(full, 10, [], true, false)).toEqual({ kind: 'gutter' });
    expect(callFor([7], 3, [], true, true)).toEqual({ kind: 'gutter' });
    expect(callFor(full, 0, leave(), true, false)).toEqual({ kind: 'gutter' });
  });

  it('speaks each kind', () => {
    expect(callSpeech({ kind: 'strike', streak: 1 })).toEqual(['Strike!']);
    expect(callSpeech({ kind: 'strike', streak: 2 })).toEqual(['Double!']);
    expect(callSpeech({ kind: 'strike', streak: 3 })).toEqual(['Turkey!']);
    expect(callSpeech({ kind: 'strike', streak: 4 })).toEqual(['Four strikes in a row!']);
    expect(callSpeech({ kind: 'strike', streak: 11 })).toEqual(['Eleven strikes in a row!']);
    expect(callSpeech({ kind: 'strike', streak: 12 })).toEqual(['A perfect game!']);
    expect(callSpeech({ kind: 'spare', fromSplit: false })).toEqual(['Spare!']);
    expect(callSpeech({ kind: 'spare', fromSplit: true })).toEqual(['You picked up the split!']);
    expect(callSpeech({ kind: 'split', pins: 8 })).toEqual(['Eight pins!', 'Split!']);
    expect(callSpeech({ kind: 'count', pins: 1 })).toEqual(['One pin.']);
    expect(callSpeech({ kind: 'count', pins: 9 })).toEqual(['Nine pins!']);
    expect(callSpeech({ kind: 'missed' })).toEqual(['No pins that time.']);
    expect(callSpeech({ kind: 'gutter' })).toEqual(['Gutter ball.']);
  });

  it('lists every line the announcer can say, once', () => {
    const lines = allCallLines();
    expect(new Set(lines).size).toBe(lines.length);
    const calls: Call[] = [{ kind: 'missed' }, { kind: 'gutter' }];
    for (let streak = 1; streak <= 12; streak++) calls.push({ kind: 'strike', streak });
    for (let pins = 1; pins <= 9; pins++) {
      calls.push({ kind: 'count', pins }, { kind: 'split', pins });
    }
    calls.push({ kind: 'spare', fromSplit: false }, { kind: 'spare', fromSplit: true });
    for (const call of calls) for (const line of callSpeech(call)) expect(lines).toContain(line);
    for (const line of Object.values(PIN_COUNT_SPEECH)) expect(lines).toContain(line);
  });

  it('puts a big moment on the alley screen and the rest in a pill', () => {
    expect(bigTitle({ kind: 'strike', streak: 1 })).toBe('STRIKE!');
    expect(bigTitle({ kind: 'strike', streak: 2 })).toBe('DOUBLE!');
    expect(bigTitle({ kind: 'strike', streak: 3 })).toBe('TURKEY!');
    expect(bigTitle({ kind: 'strike', streak: 4 })).toBe('4 IN A ROW!');
    expect(bigTitle({ kind: 'strike', streak: 11 })).toBe('11 IN A ROW!');
    expect(bigTitle({ kind: 'strike', streak: 12 })).toBe('PERFECT GAME!');
    expect(bigTitle({ kind: 'spare', fromSplit: false })).toBe('SPARE!');
    expect(bigTitle({ kind: 'spare', fromSplit: true })).toBe('SPLIT PICKED UP!');
    expect(bigTitle({ kind: 'split', pins: 8 })).toBe('SPLIT!');
    expect(bigTitle({ kind: 'count', pins: 7 })).toBeNull();
    expect(bigTitle({ kind: 'gutter' })).toBeNull();
    expect(pillText({ kind: 'count', pins: 7 })).toBe('7 PINS');
    expect(pillText({ kind: 'count', pins: 1 })).toBe('1 PIN');
    expect(pillText({ kind: 'split', pins: 8 })).toBe('8 PINS');
    expect(pillText({ kind: 'missed' })).toBe('NO PINS');
    expect(pillText({ kind: 'gutter' })).toBe('GUTTER BALL');
    expect(pillText({ kind: 'strike', streak: 1 })).toBeNull();
  });
});

describe('outcomeText', () => {
  const zeros = (n: number) => Array<number>(n).fill(0);
  it('has four shapes, singular and plural', () => {
    expect(outcomeText(zeros(20))).toBe('No strikes or spares this time.');
    expect(outcomeText([10, ...zeros(18)])).toBe('1 strike!');
    expect(outcomeText([10, 10, 10, 10, ...zeros(12)])).toBe('4 strikes!');
    expect(outcomeText([5, 5, ...zeros(18)])).toBe('1 spare!');
    expect(outcomeText([5, 5, 6, 4, ...zeros(16)])).toBe('2 spares!');
    expect(outcomeText([10, 5, 5, ...zeros(16)])).toBe('1 strike and 1 spare!');
    expect(outcomeText([10, 10, 10, 5, 5, 6, 4, 7, 3, 8, 2, 0, 0])).toBe('3 strikes and 4 spares!');
  });
});

describe('driftFor', () => {
  it('is zero below one second', () => {
    expect(driftFor(0, 10)).toBe(0);
    expect(driftFor(0.99, 5)).toBe(0);
  });
  it('is the maximum at the end of the clock and beyond', () => {
    for (const clock of [5, 10, 15]) {
      expect(driftFor(clock, clock)).toBeCloseTo(MAX_DRIFT);
      expect(driftFor(clock + 3, clock)).toBe(MAX_DRIFT);
      expect(driftFor((1 + clock) / 2, clock)).toBeCloseTo(MAX_DRIFT / 2);
    }
  });
  it('never falls and never passes the maximum', () => {
    for (const clock of [5, 10, 15]) {
      let last = 0;
      for (let s = 0; s <= clock + 2; s += 0.1) {
        const drift = driftFor(s, clock);
        expect(drift).toBeGreaterThanOrEqual(last);
        expect(drift).toBeLessThanOrEqual(MAX_DRIFT);
        last = drift;
      }
    }
  });
  it('copes with a clock of one second or less', () => {
    expect(driftFor(0.5, 1)).toBe(0);
    expect(driftFor(1, 1)).toBe(MAX_DRIFT);
    expect(driftFor(2, 0.5)).toBe(MAX_DRIFT);
  });
  it('picks a side from the random number', () => {
    expect(driftSide(0)).toBe(-1);
    expect(driftSide(0.49)).toBe(-1);
    expect(driftSide(0.5)).toBe(1);
    expect(driftSide(0.99)).toBe(1);
  });
});

describe('aim', () => {
  const random = seededRandom(7);
  const randomAim = (): Aim => ({
    startX: (random() * 2 - 1) * 0.7,
    headX: (random() * 2 - 1) * 1.2,
  });

  it('starts into the pocket', () => {
    expect(DEFAULT_AIM).toEqual({ startX: 0.135, headX: 0.07 });
    expect(lineX(DEFAULT_AIM, RELEASE_Z)).toBeCloseTo(0.135);
    expect(lineX(DEFAULT_AIM, HEAD_Z)).toBeCloseTo(0.07);
    expect(arrowTipX(DEFAULT_AIM)).toBeCloseTo(lineX(DEFAULT_AIM, ARROW_Z));
  });

  it('clampAim keeps the whole line on the lane', () => {
    for (let i = 0; i < 1000; i++) {
      const aim = clampAim(randomAim());
      expect(Math.abs(lineX(aim, RELEASE_Z))).toBeLessThanOrEqual(AIM_LIMIT + 1e-9);
      expect(Math.abs(lineX(aim, DECK_BACK_Z))).toBeLessThanOrEqual(AIM_LIMIT + 1e-9);
      expect(Math.abs(lineX(aim, HEAD_Z))).toBeLessThan(LANE_HALF);
    }
  });

  it('clampAim leaves a good aim alone and moves headX the least', () => {
    expect(clampAim(DEFAULT_AIM)).toEqual(DEFAULT_AIM);
    const wide = clampAim({ startX: 0.3, headX: 0.7 });
    expect(wide.startX).toBe(0.3);
    expect(lineX(wide, DECK_BACK_Z)).toBeCloseTo(AIM_LIMIT);
  });

  it('moveBowler keeps the slope unless it clamps', () => {
    for (let i = 0; i < 1000; i++) {
      const aim = clampAim(randomAim());
      const dx = (random() * 2 - 1) * 0.1;
      const moved = moveBowler(aim, dx);
      const raw = { startX: aim.startX + dx, headX: aim.headX + dx };
      const clamped = clampAim(raw);
      expect(moved).toEqual(clamped);
      if (clamped.startX === raw.startX && clamped.headX === raw.headX) {
        expect(moved.headX - moved.startX).toBeCloseTo(aim.headX - aim.startX);
      }
    }
  });

  it('swingArrow keeps startX', () => {
    for (let i = 0; i < 1000; i++) {
      const aim = clampAim(randomAim());
      const swung = swingArrow(aim, (random() * 2 - 1) * 0.2);
      expect(swung.startX).toBe(aim.startX);
      expect(Math.abs(lineX(swung, DECK_BACK_Z))).toBeLessThanOrEqual(AIM_LIMIT + 1e-9);
    }
  });

  it('moves one board with a nudge', () => {
    const next = moveBowler(DEFAULT_AIM, BOARD_W);
    expect(next.startX - DEFAULT_AIM.startX).toBeCloseTo(BOARD_W);
    expect(swingArrow(DEFAULT_AIM, -BOARD_W).headX - DEFAULT_AIM.headX).toBeCloseTo(-BOARD_W);
  });

  it('thrownAim stays within MAX_DRIFT of the aim at the head pin', () => {
    for (let i = 0; i < 1000; i++) {
      const aim = clampAim(randomAim());
      const drift = random() * MAX_DRIFT;
      const side = driftSide(random());
      const thrown = thrownAim(aim, drift, side);
      expect(Math.abs(thrown.headX - aim.headX)).toBeLessThanOrEqual(MAX_DRIFT + 1e-9);
      expect(Math.abs(lineX(thrown, DECK_BACK_Z))).toBeLessThanOrEqual(AIM_LIMIT + 1e-9);
    }
  });

  it('throwPath is a unit direction towards the pins', () => {
    for (let i = 0; i < 1000; i++) {
      const path = throwPath(clampAim(randomAim()));
      expect(Math.hypot(path.dirX, path.dirZ)).toBeCloseTo(1);
      expect(path.dirZ).toBeLessThan(0);
      expect(path.speed).toBe(BALL_SPEED);
    }
    const aim = DEFAULT_AIM;
    const path = throwPath(aim);
    const t = (HEAD_Z - RELEASE_Z) / path.dirZ;
    expect(path.startX + path.dirX * t).toBeCloseTo(aim.headX);
  });

  it('aimThrough passes through the pin unless it was clamped', () => {
    for (let i = 0; i < 1000; i++) {
      const startX = (random() * 2 - 1) * 0.5;
      const pin = PIN_IDS[Math.floor(random() * 10)];
      const aim = aimThrough(startX, pin);
      const spot = pinSpot(pin);
      const clampedStart = Math.min(Math.max(startX, -AIM_LIMIT), AIM_LIMIT);
      const wanted = {
        startX: clampedStart,
        headX:
          clampedStart + ((spot.x - clampedStart) * (HEAD_Z - RELEASE_Z)) / (spot.z - RELEASE_Z),
      };
      const clamped = clampAim(wanted);
      if (clamped.headX === wanted.headX) {
        expect(lineX(aim, spot.z)).toBeCloseTo(spot.x, 6);
      } else {
        expect(aim).toEqual(clamped);
      }
    }
    // From the middle, the line goes straight through the 8 pin; the 7 is past the edge, so it is clamped.
    expect(lineX(aimThrough(0, 8), pinSpot(8).z)).toBeCloseTo(pinSpot(8).x, 6);
    expect(Math.abs(lineX(aimThrough(0, 7), pinSpot(7).z))).toBeLessThanOrEqual(AIM_LIMIT + 1e-9);
  });

  it('picks the gutter on the side of the bowler', () => {
    expect(gutterSide({ startX: 0.2, headX: 0 }, 0)).toBe(1);
    expect(gutterSide({ startX: -0.2, headX: 0 }, 0.99)).toBe(-1);
    expect(gutterSide({ startX: 0, headX: 0 }, 0.2)).toBe(-1);
    expect(gutterSide({ startX: 0.005, headX: 0 }, 0.7)).toBe(1);
  });
});

describe('voice lines', () => {
  it('lists the 29 lines the game says', () => {
    expect(VOICE_LINES).toContain(LAST_FRAME_SPEECH);
    expect(VOICE_LINES).toContain(GAME_OVER_SPEECH);
    expect(VOICE_LINES).toContain(NEW_HIGH_SCORE_SPEECH);
    expect(VOICE_LINES).toHaveLength(29);
    expect(new Set(VOICE_LINES).size).toBe(29);
  });
});
