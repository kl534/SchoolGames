/**
 * Ten-pin scoring, splits and the announcer's calls. Pure: no three.js, no cannon-es and no DOM.
 * Every random choice elsewhere takes its number as an argument; nothing here is random.
 */
import { PIN_GRID, type PinId } from './geometry';

export const FRAMES = 10;
export const PINS = 10;
export type Rolls = readonly number[];

export interface Position {
  /** 1 … 10. */
  frame: number;
  /** 1, 2, or 3 (only in the 10th). */
  ball: number;
  /** Pins standing for this ball. */
  standing: number;
  /** True when this ball is on a fresh rack of 10 (rack all pins). */
  fullRack: boolean;
  over: boolean;
}

/** The state a roll leaves behind: where the next ball is, and whether the game is over. */
interface Cursor {
  frame: number;
  ball: number;
  standing: number;
  fullRack: boolean;
  over: boolean;
  /** Pins knocked down by the ball before this one in the same frame (10th: the last two). */
  firstRoll: number | null;
}

const START: Cursor = {
  frame: 1,
  ball: 1,
  standing: PINS,
  fullRack: true,
  over: false,
  firstRoll: null,
};

/** What one roll did, for the scoring: a strike (10 on a fresh rack), a spare, or neither. */
type Mark = 'strike' | 'spare' | 'open';

/** The cursor after `roll`, or null when the roll is not possible at `cursor`. */
function advance(cursor: Cursor, roll: number): { next: Cursor; mark: Mark } | null {
  if (cursor.over || !Number.isInteger(roll) || roll < 0 || roll > cursor.standing) return null;
  const left = cursor.standing - roll;
  const mark: Mark =
    roll === cursor.standing && roll > 0 ? (cursor.fullRack ? 'strike' : 'spare') : 'open';
  const fresh = (frame: number, ball: number): Cursor => ({
    frame,
    ball,
    standing: PINS,
    fullRack: true,
    over: false,
    firstRoll: null,
  });
  if (cursor.frame < FRAMES) {
    if (cursor.ball === 1 && mark !== 'strike') {
      return {
        mark,
        next: {
          frame: cursor.frame,
          ball: 2,
          standing: left,
          fullRack: false,
          over: false,
          firstRoll: roll,
        },
      };
    }
    return { mark, next: fresh(cursor.frame + 1, 1) };
  }
  // The 10th frame: a strike or a spare earns a fresh rack and one more ball.
  const first = cursor.ball === 1 ? roll : cursor.firstRoll;
  const struckFirst = first === PINS;
  const over = cursor.ball === 3 || (cursor.ball === 2 && !struckFirst && mark !== 'spare');
  if (over) {
    return {
      mark,
      next: {
        frame: FRAMES,
        ball: cursor.ball,
        standing: 0,
        fullRack: false,
        over: true,
        firstRoll: first,
      },
    };
  }
  const reset = mark === 'strike' || mark === 'spare';
  return {
    mark,
    next: {
      frame: FRAMES,
      ball: cursor.ball + 1,
      standing: reset ? PINS : left,
      fullRack: reset,
      over: false,
      firstRoll: first,
    },
  };
}

/** Plays the rolls out; null when they are not a valid game so far. */
function walk(rolls: Rolls): { cursor: Cursor; marks: Mark[]; cursors: Cursor[] } | null {
  let cursor = START;
  const marks: Mark[] = [];
  const cursors: Cursor[] = [];
  for (const roll of rolls) {
    const step = advance(cursor, roll);
    if (!step) return null;
    cursors.push(cursor);
    marks.push(step.mark);
    cursor = step.next;
  }
  return { cursor, marks, cursors };
}

/** Where the game stands after these rolls. Throws if `rolls` is not a valid game so far. */
export function position(rolls: Rolls): Position {
  const played = walk(rolls);
  if (!played) throw new Error(`Not a valid game: ${rolls.join(',')}`);
  const { frame, ball, standing, fullRack, over } = played.cursor;
  return { frame, ball, standing, fullRack, over };
}

/** Whether `rolls` is a valid game so far: every roll 0 … standing, no rolls after the end. */
export function isValidRolls(rolls: Rolls): boolean {
  return walk(rolls) !== null;
}

/** The rolls grouped by frame (the 10th may have up to 3). */
export function frameRolls(rolls: Rolls): number[][] {
  const played = walk(rolls);
  if (!played) throw new Error(`Not a valid game: ${rolls.join(',')}`);
  const frames: number[][] = [];
  played.cursors.forEach((before, i) => {
    (frames[before.frame - 1] ??= []).push(rolls[i]);
  });
  return frames;
}

const digit = (n: number) => (n === 0 ? '-' : String(n));

/**
 * The marks in each frame's boxes. Frames 1–9 have 2 boxes, the 10th has 3. A strike is 'X',
 * a spare '/', a zero '-', other rolls their digit, and unbowled boxes ''. A strike in frames
 * 1–9 is ['X', ''] (default). In the 10th each fresh-rack 10 is 'X'.
 * Example: [10, 7, 3, 9, 0] → [['X',''], ['7','/'], ['9','-'], ['',''], …].
 */
export function frameMarks(rolls: Rolls): string[][] {
  const played = walk(rolls);
  if (!played) throw new Error(`Not a valid game: ${rolls.join(',')}`);
  const boxes: string[][] = Array.from({ length: FRAMES }, (_, f) =>
    Array.from({ length: f === FRAMES - 1 ? 3 : 2 }, () => ''),
  );
  const used = new Array<number>(FRAMES).fill(0);
  played.cursors.forEach((before, i) => {
    const f = before.frame - 1;
    const mark = played.marks[i];
    const text = mark === 'strike' ? 'X' : mark === 'spare' ? '/' : digit(rolls[i]);
    // A strike before the 10th takes the first box and leaves the second empty.
    boxes[f][used[f]++] = text;
  });
  return boxes;
}

/** Running total after each frame, or null where it isn't known yet (bonus balls to come). */
export function runningTotals(rolls: Rolls): (number | null)[] {
  const played = walk(rolls);
  if (!played) throw new Error(`Not a valid game: ${rolls.join(',')}`);
  const totals: (number | null)[] = new Array<number | null>(FRAMES).fill(null);
  let at = 0;
  let sum = 0;
  for (let f = 0; f < FRAMES; f++) {
    const here = rolls[at];
    if (here === undefined) break;
    let score: number | null = null;
    let used = 0;
    if (f === FRAMES - 1) {
      // The 10th: all its balls, once the game is over.
      if (played.cursor.over) {
        score = rolls.slice(at).reduce((a, b) => a + b, 0);
      }
    } else if (here === PINS) {
      if (rolls[at + 2] !== undefined) score = PINS + rolls[at + 1] + rolls[at + 2];
      used = 1;
    } else if (rolls[at + 1] !== undefined) {
      used = 2;
      if (here + rolls[at + 1] === PINS) {
        if (rolls[at + 2] !== undefined) score = PINS + rolls[at + 2];
      } else {
        score = here + rolls[at + 1];
      }
    }
    if (score === null) break;
    sum += score;
    totals[f] = sum;
    at += used;
  }
  return totals;
}

/** The total of the frames known so far; the final score once `position(rolls).over`. */
export function totalScore(rolls: Rolls): number {
  const totals = runningTotals(rolls);
  for (let f = FRAMES - 1; f >= 0; f--) {
    const total = totals[f];
    if (total !== null) return total;
  }
  return 0;
}

/** Strikes (10s on a fresh rack) and spares in the game, for the results line. */
export function countMarks(rolls: Rolls): { strikes: number; spares: number } {
  const played = walk(rolls);
  if (!played) throw new Error(`Not a valid game: ${rolls.join(',')}`);
  return {
    strikes: played.marks.filter((m) => m === 'strike').length,
    spares: played.marks.filter((m) => m === 'spare').length,
  };
}

/** Strikes in a row ending with the last roll (0 if the last roll wasn't a strike). */
export function strikeStreak(rolls: Rolls): number {
  const played = walk(rolls);
  if (!played) throw new Error(`Not a valid game: ${rolls.join(',')}`);
  let streak = 0;
  for (let i = played.marks.length - 1; i >= 0 && played.marks[i] === 'strike'; i--) streak++;
  return streak;
}

// ---------- Splits ----------

/**
 * A split (USBC): the head pin is down, at least two pins stand, and they don't all connect.
 * Two standing pins connect when |Δcol| ≤ 1 (diagonal neighbours, or the same column such as
 * 2–8), or when both are in the back row with |Δcol| = 2 (7–8, 8–9, 9–10).
 */
export function isSplit(standing: readonly PinId[]): boolean {
  if (standing.length < 2 || standing.includes(1)) return false;
  const connected = (a: PinId, b: PinId) => {
    const dc = Math.abs(PIN_GRID[a].col - PIN_GRID[b].col);
    return dc <= 1 || (dc === 2 && PIN_GRID[a].row === 3 && PIN_GRID[b].row === 3);
  };
  const reached = new Set<PinId>([standing[0]]);
  const queue: PinId[] = [standing[0]];
  while (queue.length) {
    const from = queue.pop()!;
    for (const pin of standing) {
      if (!reached.has(pin) && connected(from, pin)) {
        reached.add(pin);
        queue.push(pin);
      }
    }
  }
  return reached.size < standing.length;
}

// ---------- Calls and spoken lines ----------

export type Call =
  | { kind: 'strike'; streak: number } // strikeStreak after this ball, 1 … 12
  | { kind: 'spare'; fromSplit: boolean } // fromSplit: the ball before left a split
  | { kind: 'split'; pins: number } // a first ball on a fresh rack that leaves a split
  | { kind: 'count'; pins: number } // 1 … 9 pins, nothing special
  | { kind: 'missed' } // a right answer that hit no pins (only possible on a spare ball)
  | { kind: 'gutter' }; // a wrong answer or timeout

/**
 * The call for a ball. `before` is the rolls before it, `pins` what it knocked down, `standingAfter`
 * the pins left, `gutter` whether it was a wrong answer or timeout, and `splitBefore` whether the
 * ball before (same rack) left a split.
 *   gutter                                    → gutter
 *   fresh rack and pins = 10                  → strike (streak = strikeStreak([...before, 10]))
 *   not a fresh rack and pins = standing      → spare (fromSplit = splitBefore)
 *   fresh rack and isSplit(standingAfter)     → split
 *   pins = 0                                  → missed
 *   otherwise                                 → count
 */
export function callFor(
  before: Rolls,
  pins: number,
  standingAfter: readonly PinId[],
  gutter: boolean,
  splitBefore: boolean,
): Call {
  if (gutter) return { kind: 'gutter' };
  const where = position(before);
  if (where.fullRack && pins === PINS) {
    return { kind: 'strike', streak: strikeStreak([...before, PINS]) };
  }
  if (!where.fullRack && pins === where.standing) return { kind: 'spare', fromSplit: splitBefore };
  if (where.fullRack && isSplit(standingAfter)) return { kind: 'split', pins };
  if (pins === 0) return { kind: 'missed' };
  return { kind: 'count', pins };
}

export const PIN_COUNT_SPEECH: Record<number, string> = {
  1: 'One pin.',
  2: 'Two pins.',
  3: 'Three pins.',
  4: 'Four pins.',
  5: 'Five pins.',
  6: 'Six pins.',
  7: 'Seven pins!',
  8: 'Eight pins!',
  9: 'Nine pins!',
};
export const LAST_FRAME_SPEECH = 'Last frame!';
export const GAME_OVER_SPEECH = 'Game over!';
export const NEW_HIGH_SCORE_SPEECH = 'New high score!';

const WORDS: Record<number, string> = {
  4: 'Four',
  5: 'Five',
  6: 'Six',
  7: 'Seven',
  8: 'Eight',
  9: 'Nine',
  10: 'Ten',
  11: 'Eleven',
};

/** The most strikes there can be in a game. */
const MAX_STREAK = 12;

/** What the announcer says for a call, in order. */
export function callSpeech(call: Call): string[] {
  switch (call.kind) {
    case 'strike': {
      const streak = Math.min(Math.max(call.streak, 1), MAX_STREAK);
      if (streak === 1) return ['Strike!'];
      if (streak === 2) return ['Double!'];
      if (streak === 3) return ['Turkey!'];
      if (streak === MAX_STREAK) return ['A perfect game!'];
      return [`${WORDS[streak]} strikes in a row!`];
    }
    case 'spare':
      return [call.fromSplit ? 'You picked up the split!' : 'Spare!'];
    case 'split':
      return [PIN_COUNT_SPEECH[call.pins], 'Split!'];
    case 'count':
      return [PIN_COUNT_SPEECH[call.pins]];
    case 'missed':
      return ['No pins that time.'];
    case 'gutter':
      return ['Gutter ball.'];
  }
}

/** Every line callSpeech can return, for voice.ts. */
export function allCallLines(): string[] {
  const calls: Call[] = [];
  for (let streak = 1; streak <= MAX_STREAK; streak++) calls.push({ kind: 'strike', streak });
  calls.push({ kind: 'spare', fromSplit: false }, { kind: 'spare', fromSplit: true });
  for (let pins = 1; pins <= 9; pins++) {
    calls.push({ kind: 'split', pins }, { kind: 'count', pins });
  }
  calls.push({ kind: 'missed' }, { kind: 'gutter' });
  return [...new Set(calls.flatMap(callSpeech))];
}

// ---------- On-screen words (free-form, not spoken) ----------

/** The alley-screen title for a big moment, or null for a call shown as a small pill. */
export function bigTitle(call: Call): string | null {
  switch (call.kind) {
    case 'strike': {
      if (call.streak <= 1) return 'STRIKE!';
      if (call.streak === 2) return 'DOUBLE!';
      if (call.streak === 3) return 'TURKEY!';
      if (call.streak >= MAX_STREAK) return 'PERFECT GAME!';
      return `${call.streak} IN A ROW!`;
    }
    case 'spare':
      return call.fromSplit ? 'SPLIT PICKED UP!' : 'SPARE!';
    case 'split':
      return 'SPLIT!';
    default:
      return null;
  }
}

const pinsText = (pins: number) => (pins === 1 ? '1 PIN' : `${pins} PINS`);

/** The small pill: count `${pins} PINS` ('1 PIN'), missed 'NO PINS', gutter 'GUTTER BALL', split `${pins} PINS`. */
export function pillText(call: Call): string | null {
  switch (call.kind) {
    case 'count':
    case 'split':
      return pinsText(call.pins);
    case 'missed':
      return 'NO PINS';
    case 'gutter':
      return 'GUTTER BALL';
    default:
      return null;
  }
}

/** Results line: "3 strikes and 4 spares!", "1 strike!", "2 spares!", or "No strikes or spares this time." */
export function outcomeText(rolls: Rolls): string {
  const { strikes, spares } = countMarks(rolls);
  const s = strikes === 1 ? '1 strike' : `${strikes} strikes`;
  const p = spares === 1 ? '1 spare' : `${spares} spares`;
  if (strikes && spares) return `${s} and ${p}!`;
  if (strikes) return `${s}!`;
  if (spares) return `${p}!`;
  return 'No strikes or spares this time.';
}
