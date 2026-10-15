import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  createBall,
  createBatter,
  createCatcher,
  createFielder,
  createPitcher,
  createUmpire,
  FIELDER_SPOTS,
  SWING_CONTACT,
  type FielderId,
} from '../src/games/batter-up/characters';
import { createEffects } from '../src/games/batter-up/effects';
import {
  BOARD_DOT_RADIUS,
  BOARD_DOT_SPACING,
  BOARD_DOT_STROKE,
  BOARD_RIGHT_EDGE,
  boardDotCentres,
  buildField,
} from '../src/games/batter-up/field';
import {
  BALL_RADIUS,
  BASE_SIDE,
  arcPosition,
  BASE_SPOTS,
  basePathPoint,
  BOARD,
  BURST_RADIUS,
  CHASERS,
  CONTACT,
  dashPosition,
  FOUL_ANGLE,
  fieldAngle,
  fieldPoint,
  FIREWORKS_CENTRE,
  FIRST_BASE,
  GLOVE,
  GROUND_BALL_TIME,
  groundBallPosition,
  INFIELD_PLAYS,
  INFIELD_SPEED,
  LAP,
  pickChasers,
  pitchPosition,
  planHit,
  POP_FLY_TIME,
  RELEASE,
  WALL_CENTRE,
  WALL_HEIGHT,
  WALL_POLE,
  wallRadius,
  type Vec,
} from '../src/games/batter-up/flight';
import {
  ballRadiusPx,
  ballScale,
  boardIsClear,
  callInPanel,
  centreShift,
  fireworksAim,
  fireworksFit,
  fireworksPoints,
  fitMoundView,
  fitView,
  followGoal,
  hitBand,
  homeView,
  hudLayout,
  hudRects,
  keepBoardClear,
  MAX_BALL_WORLD_RADIUS,
  MIN_BALL_PX,
  moundView,
  playBand,
  project,
  QUESTION_GAP,
  QUESTION_SLACK,
  questionTopBelowBug,
  rectsOverlap,
} from '../src/games/batter-up/layout';
import { createMover } from '../src/games/batter-up/mover';
import { createPerson, mixPose, neutralPose } from '../src/games/batter-up/person';
import {
  advance,
  applyFieldOut,
  applyHit,
  applyStrike,
  BASES_FOR,
  batterNumber,
  cpuHitFor,
  cpuHitSpeech,
  CPU_HIT_WEIGHTS,
  dots,
  easeToward,
  EMPTY_BASES,
  EXTRA_INNINGS,
  finalSpeech,
  GROUND_OUT_SPEECH,
  GROUND_OUT_UNDER_SECONDS,
  halfEndSpeech,
  halfEndTitle,
  halfOver,
  DOUBLE_UNDER_SECONDS,
  hitFor,
  HOMER_UNDER_SECONDS,
  hitLabel,
  hitSpeech,
  hitWord,
  inningBanner,
  inningSpeech,
  leadSpeech,
  lineScore,
  MAX_OUTS,
  MAX_SPOKEN_RUNS,
  MERCY_RUNS,
  newGame,
  nextHalf,
  ordinal,
  pitchOutcomeFor,
  pitchStrikeCall,
  PLAY_BALL,
  POP_OUT_UNDER_SECONDS,
  POP_OUT_SPEECH,
  runsText,
  STRIKES_OUT,
  strikeCall,
  totals,
  TRIPLE_UNDER_SECONDS,
  YOU_WIN,
  type Bases,
  type GameState,
  type Hit,
} from '../src/games/batter-up/rules';
import {
  coloursOf,
  darken,
  loseSpeech,
  matchupSpeech,
  OUR_COLOURS,
  ourAbbr,
  outcomeText,
  pickRival,
  rivalHitTitle,
  scoreLine,
  TEAMS,
  teamName,
  walkOffSpeech,
} from '../src/games/batter-up/teams';
import { VOICE_LINES } from '../src/games/batter-up/voice';
import { normalizeSpeech } from '../src/shared/voice';

const at = (x: number, y: number, z: number): Vec => ({ x, y, z });
const MOUND_Z = -8.2;

describe('hit tiers', () => {
  it('gives a home run for an answer under 0.4 seconds', () => {
    expect(hitFor(0)).toBe('homer');
    expect(hitFor(0.2)).toBe('homer');
    expect(hitFor(0.399)).toBe('homer');
  });

  it('steps down to a triple, a double and a single at 0.4, 0.6 and 1 second', () => {
    expect(hitFor(0.4)).toBe('triple');
    expect(hitFor(0.599)).toBe('triple');
    expect(hitFor(0.6)).toBe('double');
    expect(hitFor(0.999)).toBe('double');
    expect(hitFor(1)).toBe('single');
    expect(hitFor(12)).toBe('single');
  });

  it('keeps the tiers in absolute seconds', () => {
    expect(HOMER_UNDER_SECONDS).toBe(0.4);
    expect(TRIPLE_UNDER_SECONDS).toBe(0.6);
    expect(DOUBLE_UNDER_SECONDS).toBe(1);
  });

  it('is worth one to four bases, with names and speech', () => {
    expect(BASES_FOR).toEqual({ single: 1, double: 2, triple: 3, homer: 4 });
    expect(hitLabel('homer')).toBe('HOME RUN!');
    expect(hitLabel('double')).toBe('DOUBLE!');
    expect(hitLabel('single')).toBe('SINGLE!');
    expect(hitLabel('triple')).toBe('TRIPLE!');
    expect(hitSpeech('homer')).toBe('Home run!');
    expect(hitSpeech('double')).toBe('Double!');
  });

  it('says how many runs scored', () => {
    expect(runsText(0)).toBe('');
    expect(runsText(1)).toBe('+1 run!');
    expect(runsText(4)).toBe('+4 runs!');
  });
});

describe('running the bases', () => {
  const loaded: Bases = [true, true, true];

  it('scores four on a home run with the bases loaded, and clears them', () => {
    const result = advance(loaded, 4);
    expect(result.runs).toBe(4);
    expect(result.bases).toEqual(EMPTY_BASES);
    expect(result.moves).toHaveLength(4);
    expect(result.moves.every((m) => m.to === 4)).toBe(true);
  });

  it('scores the batter alone on a home run with nobody on', () => {
    const result = advance(EMPTY_BASES, 4);
    expect(result.runs).toBe(1);
    expect(result.moves).toEqual([{ from: 0, to: 4 }]);
  });

  it('puts the batter on first for a single with nobody on', () => {
    const result = advance(EMPTY_BASES, 1);
    expect(result.runs).toBe(0);
    expect(result.bases).toEqual([true, false, false]);
  });

  it('scores one on a double with runners on first and second, leaving second and third', () => {
    const result = advance([true, true, false], 2);
    expect(result.runs).toBe(1);
    expect(result.bases).toEqual([false, true, true]);
    expect(result.moves).toEqual([
      { from: 2, to: 4 },
      { from: 1, to: 3 },
      { from: 0, to: 2 },
    ]);
  });

  it('moves every runner up as many bases as the hit is worth', () => {
    expect(advance([true, false, true], 1)).toMatchObject({
      runs: 1,
      bases: [true, true, false],
    });
    expect(advance([true, false, false], 3)).toMatchObject({
      runs: 1,
      bases: [false, false, true],
    });
    expect(advance([false, true, false], 3)).toMatchObject({
      runs: 1,
      bases: [false, false, true],
    });
    expect(advance(loaded, 1)).toMatchObject({ runs: 1, bases: [true, true, true] });
    expect(advance(loaded, 2)).toMatchObject({ runs: 2, bases: [false, true, true] });
    expect(advance(loaded, 3)).toMatchObject({ runs: 3, bases: [false, false, true] });
  });

  it('lists the lead runner first and the batter last', () => {
    const froms = advance(loaded, 1).moves.map((m) => m.from);
    expect(froms).toEqual([3, 2, 1, 0]);
  });
});

/** A game part-way through: `us` and `them` are the runs in each half-inning started so far. */
const midGame = (
  inning: number,
  half: 'top' | 'bottom',
  us: number[],
  them: number[],
  more: Partial<GameState> = {},
): GameState => ({
  ...newGame(),
  inning,
  half,
  runs: (half === 'top' ? us : them).at(-1) ?? 0,
  us,
  them,
  ...more,
});

describe('the count and the half-inning', () => {
  const strikeOut = (state: GameState) => {
    let s = state;
    for (let i = 0; i < STRIKES_OUT; i++) s = applyStrike(s).state;
    return s;
  };

  it('starts in the top of the 1st with the first batter, no outs, no strikes and nobody on', () => {
    expect(newGame()).toEqual({
      inning: 1,
      half: 'top',
      batter: 1,
      rivalBatter: 1,
      strikes: 0,
      outs: 0,
      runs: 0,
      bases: EMPTY_BASES,
      us: [0],
      them: [],
      over: false,
      winner: null,
      walkOff: false,
    });
  });

  it('adds a strike and keeps the same batter until the third', () => {
    const one = applyStrike(newGame());
    expect(one.state).toMatchObject({ strikes: 1, outs: 0, batter: 1 });
    expect(one.out).toBe(false);
    const two = applyStrike(one.state);
    expect(two.state).toMatchObject({ strikes: 2, outs: 0, batter: 1 });
    expect(two.out).toBe(false);
  });

  it('makes the third strike an out and brings up the next batter with no strikes', () => {
    let s = newGame();
    s = applyStrike(s).state;
    s = applyStrike(s).state;
    const third = applyStrike(s);
    expect(third.out).toBe(true);
    expect(third.state).toMatchObject({ strikes: 0, outs: 1, batter: 2, over: false });
  });

  it('keeps a line-up for each side', () => {
    const top = applyHit(newGame(), 'single').state;
    expect(top).toMatchObject({ batter: 2, rivalBatter: 1 });
    const bottom = strikeOut(midGame(1, 'bottom', [0], [0]));
    expect(bottom).toMatchObject({ batter: 1, rivalBatter: 2 });
    expect(batterNumber(top)).toBe(2);
    expect(batterNumber(bottom)).toBe(2);
  });

  it('ends the half-inning at three outs, even with batters left', () => {
    let s = newGame();
    s = strikeOut(s);
    s = strikeOut(s);
    expect(halfOver(s)).toBeNull();
    s = strikeOut(s);
    expect(s).toMatchObject({ outs: MAX_OUTS, batter: 4 });
    expect(halfOver(s)).toBe('outs');
    // That ends the half-inning, not the game.
    expect(s.over).toBe(false);
  });

  it('puts the batter on base for a hit and clears the strikes for the next batter', () => {
    let s = newGame();
    s = applyStrike(s).state;
    s = applyStrike(s).state;
    const hit = applyHit(s, 'single');
    expect(hit.out).toBe(false);
    expect(hit.state).toMatchObject({
      strikes: 0,
      batter: 2,
      outs: 0,
      bases: [true, false, false],
    });
  });

  it('adds runs to the score as they cross the plate', () => {
    const s: GameState = { ...newGame(), bases: [true, true, true] };
    const result = applyHit(s, 'homer');
    expect(result.runs).toBe(4);
    expect(result.state.runs).toBe(4);
    expect(result.state.us).toEqual([4]);
    expect(totals(result.state)).toEqual({ us: 4, them: 0 });
  });

  it('scores for the rival in the bottom half', () => {
    const s = midGame(2, 'bottom', [1, 2], [0, 0], { bases: [false, true, false] });
    const result = applyHit(s, 'double');
    expect(result.runs).toBe(1);
    expect(result.state).toMatchObject({ runs: 1, rivalBatter: 2, batter: 1 });
    expect(result.state.them).toEqual([0, 1]);
    expect(result.state.us).toEqual([1, 2]);
  });

  it('puts a batter out in the field and holds the runners', () => {
    const s: GameState = { ...newGame(), strikes: 2, bases: [true, false, true] };
    const result = applyFieldOut(s);
    expect(result).toMatchObject({ out: true, runs: 0, moves: [] });
    expect(result.state).toMatchObject({ outs: 1, strikes: 0, batter: 2 });
    expect(result.state.bases).toEqual([true, false, true]);
  });

  it('does not end early while there are outs to give and batters to come', () => {
    let s = newGame();
    s = strikeOut(s);
    s = applyHit(s, 'double').state;
    s = strikeOut(s);
    expect(s).toMatchObject({ outs: 2, batter: 4, over: false });
    expect(halfOver(s)).toBeNull();
    expect(s.bases).toEqual([false, true, false]);
  });

  it('never changes the state it is given', () => {
    const before = newGame();
    const copy = structuredClone(before);
    applyStrike(before);
    applyHit(before, 'homer');
    applyFieldOut(before);
    nextHalf(before);
    expect(before).toEqual(copy);
  });
});

describe('the mercy rule', () => {
  it('ends the half-inning at five runs', () => {
    expect(halfOver({ ...newGame(), runs: 4 })).toBeNull();
    expect(halfOver({ ...newGame(), runs: MERCY_RUNS })).toBe('mercy');
    expect(MERCY_RUNS).toBe(5);
  });

  it('stops counting at five: a grand slam with three already in scores two', () => {
    const s = midGame(2, 'top', [0, 3], [0], { bases: [true, true, true] });
    const result = applyHit(s, 'homer');
    expect(result.runs).toBe(2);
    expect(result.state.runs).toBe(5);
    expect(result.state.us).toEqual([0, 5]);
    // Everybody still runs home.
    expect(result.moves.filter((m) => m.to === 4)).toHaveLength(4);
    expect(halfOver(result.state)).toBe('mercy');
  });

  it('is the same for the rival', () => {
    const s = midGame(3, 'bottom', [0, 0, 0], [0, 0, 4], { runs: 4, bases: [true, false, false] });
    const result = applyHit(s, 'homer');
    expect(result.runs).toBe(1);
    expect(result.state.them).toEqual([0, 0, 5]);
    expect(halfOver(result.state)).toBe('mercy');
  });

  it('counts nothing more once the cap is reached', () => {
    const s = midGame(1, 'top', [5], [], { runs: 5, bases: [true, true, true] });
    expect(applyHit(s, 'single').runs).toBe(0);
  });

  it('never lets a half-inning pass five runs, however it is played', () => {
    let s = newGame();
    for (let i = 0; i < 40 && halfOver(s) === null; i++) s = applyHit(s, 'single').state;
    expect(s.runs).toBe(5);
    expect(s.us).toEqual([5]);
  });
});

describe('the innings', () => {
  const finishHalf = (s: GameState) => ({ ...s, outs: MAX_OUTS });

  it('goes from the top to the bottom, then to the top of the next inning', () => {
    const top = applyHit(newGame(), 'single').state;
    const bottom = nextHalf(finishHalf(top));
    expect(bottom).toMatchObject({
      inning: 1,
      half: 'bottom',
      outs: 0,
      strikes: 0,
      runs: 0,
      over: false,
    });
    expect(bottom.bases).toEqual(EMPTY_BASES);
    expect(bottom.them).toEqual([0]);
    const next = nextHalf(finishHalf(bottom));
    expect(next).toMatchObject({ inning: 2, half: 'top', outs: 0, runs: 0, over: false });
    expect(next.us).toEqual([0, 0]);
    expect(next.them).toEqual([0]);
  });

  it('clears the bases and the count at every change of sides', () => {
    const s = midGame(2, 'top', [0, 1], [0], { outs: 3, strikes: 2, bases: [true, true, false] });
    expect(nextHalf(s)).toMatchObject({ bases: EMPTY_BASES, strikes: 0, outs: 0, runs: 0 });
  });

  it('plays the bottom of the 6th when the rival is behind or tied', () => {
    const behind = nextHalf(midGame(6, 'top', [0, 0, 0, 0, 0, 2], [0, 0, 0, 0, 0], { outs: 3 }));
    expect(behind).toMatchObject({ half: 'bottom', over: false });
    const tied = nextHalf(midGame(6, 'top', [0, 0, 0, 0, 0, 2], [2, 0, 0, 0, 0], { outs: 3 }));
    expect(tied).toMatchObject({ half: 'bottom', over: false });
  });

  it('skips the bottom of the 6th when the rival already leads', () => {
    const s = midGame(6, 'top', [0, 0, 0, 0, 0, 1], [3, 0, 0, 0, 0], { outs: 3 });
    const result = nextHalf(s);
    expect(result).toMatchObject({ over: true, winner: 'them', walkOff: false, half: 'top' });
    // The line score crosses out the bottom half.
    expect(lineScore(result).them).toEqual(['3', '0', '0', '0', '0', 'X']);
  });

  it('does not skip an earlier bottom half, whatever the score', () => {
    const s = midGame(3, 'top', [0, 0, 0], [5, 5], { outs: 3 });
    expect(nextHalf(s)).toMatchObject({ half: 'bottom', over: false });
  });

  it('ends the game after the bottom of the 6th with the leader winning', () => {
    const won = nextHalf(midGame(6, 'bottom', [1, 0, 0, 0, 0, 2], [1, 0, 0, 0, 0, 1], { outs: 3 }));
    expect(won).toMatchObject({ over: true, winner: 'us', walkOff: false });
  });

  it('goes to extra innings when it is tied after the 6th', () => {
    const tied = midGame(6, 'bottom', [1, 0, 0, 0, 0, 1], [0, 0, 2, 0, 0, 0], { outs: 3 });
    const seventh = nextHalf(tied);
    expect(seventh).toMatchObject({ inning: 7, half: 'top', over: false, winner: null });
    expect(seventh.us).toEqual([1, 0, 0, 0, 0, 1, 0]);
  });

  it('never ends the game on a tie, however long it goes', () => {
    let s = newGame();
    for (let i = 0; i < 40; i++) {
      s = nextHalf({ ...s, outs: MAX_OUTS });
      expect(s.over).toBe(false);
    }
    expect(s.inning).toBe(21);
  });

  it('ends an extra inning when one side leads at the end of it', () => {
    const top = midGame(7, 'top', [0, 0, 0, 0, 0, 0, 2], [0, 0, 0, 0, 0, 0], { outs: 3 });
    const bottom = nextHalf(top);
    expect(bottom).toMatchObject({ half: 'bottom', over: false });
    const end = nextHalf({ ...bottom, outs: MAX_OUTS });
    expect(end).toMatchObject({ over: true, winner: 'us' });
    // And a rival ahead after the top of an extra inning means no bottom is played.
    const behind = midGame(8, 'top', [0, 0, 0, 0, 0, 0, 1, 0], [0, 0, 0, 0, 0, 0, 1], { outs: 3 });
    expect(nextHalf(behind)).toMatchObject({ over: false, half: 'bottom' });
    const ahead = midGame(8, 'top', [0, 0, 0, 0, 0, 0, 1, 0], [0, 0, 0, 0, 0, 0, 2], { outs: 3 });
    expect(nextHalf(ahead)).toMatchObject({ over: true, winner: 'them' });
  });
});

describe('a walk-off', () => {
  it('ends the game on the rival run that takes the lead in the bottom of the 6th', () => {
    const s = midGame(6, 'bottom', [0, 0, 0, 0, 0, 2], [0, 0, 0, 0, 0, 0], {
      bases: [true, true, false],
    });
    const result = applyHit(s, 'homer');
    expect(result.state).toMatchObject({ over: true, winner: 'them', walkOff: true });
    expect(result.runs).toBe(3);
    expect(totals(result.state)).toEqual({ us: 2, them: 3 });
  });

  it('counts only the runs up to the winning run', () => {
    const s = midGame(6, 'bottom', [0, 0, 0, 0, 0, 2], [0, 0, 0, 0, 0, 0], {
      bases: [true, true, true],
    });
    const result = applyHit(s, 'homer');
    expect(result.runs).toBe(3);
    expect(totals(result.state)).toEqual({ us: 2, them: 3 });
    expect(result.state.walkOff).toBe(true);
    expect(lineScore(result.state).themTotal).toBe(3);
  });

  it('ties are not enough: the game goes on while the rival has only drawn level', () => {
    const s = midGame(6, 'bottom', [0, 0, 0, 0, 0, 2], [0, 0, 0, 0, 0, 0], {
      bases: [false, true, false],
    });
    const result = applyHit(s, 'double');
    expect(result.runs).toBe(1);
    expect(result.state.over).toBe(false);
    const tieing = applyHit(midGame(6, 'bottom', [0, 0, 0, 0, 0, 1], [0, 0, 0, 0, 0, 0]), 'homer');
    expect(tieing.state).toMatchObject({ over: false, walkOff: false });
    expect(totals(tieing.state)).toEqual({ us: 1, them: 1 });
  });

  it('also ends an extra inning', () => {
    const s = midGame(8, 'bottom', [0, 0, 0, 0, 0, 0, 1, 0], [0, 0, 0, 0, 0, 0, 1, 0], {
      bases: [false, false, true],
    });
    const result = applyHit(s, 'single');
    expect(result.state).toMatchObject({ over: true, winner: 'them', walkOff: true });
    expect(result.runs).toBe(1);
  });

  it('is not a walk-off before the last inning', () => {
    const s = midGame(5, 'bottom', [0, 0, 0, 0, 2], [0, 0, 0, 0, 0], { bases: [true, true, true] });
    const result = applyHit(s, 'homer');
    expect(result.state.over).toBe(false);
    expect(result.runs).toBe(4);
  });

  it('applies the mercy cap when it is lower than the winning run', () => {
    const s = midGame(6, 'bottom', [8, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 3], {
      bases: [true, true, true],
    });
    const result = applyHit(s, 'homer');
    expect(result.runs).toBe(2);
    expect(result.state.over).toBe(false);
    expect(halfOver(result.state)).toBe('mercy');
  });
});

describe('the line score', () => {
  it('shows a cell for each half-inning played, and blanks for the rest', () => {
    const s = midGame(2, 'bottom', [1, 3], [0, 2]);
    const line = lineScore(s);
    expect(line.innings).toEqual([1, 2, 3, 4, 5, 6]);
    expect(line.us).toEqual(['1', '3', '', '', '', '']);
    expect(line.them).toEqual(['0', '2', '', '', '', '']);
    expect(line).toMatchObject({ usTotal: 4, themTotal: 2 });
  });

  it('shows the runs on the board as they arrive, not as they were scored', () => {
    const s = midGame(2, 'top', [1, 4], [0]);
    expect(lineScore(s, 2).us).toEqual(['1', '2', '', '', '', '']);
    expect(lineScore(s, 2).usTotal).toBe(3);
    expect(lineScore(s, 2).themTotal).toBe(0);
    const bottom = midGame(2, 'bottom', [1, 4], [0, 3]);
    expect(lineScore(bottom, 1).them).toEqual(['0', '1', '', '', '', '']);
    expect(lineScore(bottom, 1).us).toEqual(['1', '4', '', '', '', '']);
  });

  it('crosses out a bottom half that was not needed, and only then', () => {
    const over = nextHalf(midGame(6, 'top', [0, 0, 0, 0, 0, 1], [3, 0, 0, 0, 0], { outs: 3 }));
    expect(lineScore(over).them[5]).toBe('X');
    const early = midGame(3, 'top', [0, 0, 0], [0, 0]);
    expect(lineScore(early).them[2]).toBe('');
  });

  it('shows the last six innings once the game is in extra innings', () => {
    const us = [0, 0, 0, 0, 0, 0, 1, 0];
    const them = [0, 0, 0, 0, 0, 0, 1];
    const line = lineScore(midGame(8, 'top', us, them, { runs: 0 }));
    expect(line.innings).toEqual([3, 4, 5, 6, 7, 8]);
    expect(line.us).toEqual(['0', '0', '0', '0', '1', '0']);
    expect(line.them).toEqual(['0', '0', '0', '0', '1', '']);
    // The totals still count the whole game.
    expect(line).toMatchObject({ usTotal: 1, themTotal: 1 });
  });
});

describe('pitching', () => {
  it('makes a right answer a pop fly when it comes in under half a second', () => {
    expect(pitchOutcomeFor(0)).toBe('popout');
    expect(pitchOutcomeFor(0.499)).toBe('popout');
  });

  it('makes it a ground out up to a second, and a strike after that', () => {
    expect(pitchOutcomeFor(0.5)).toBe('groundout');
    expect(pitchOutcomeFor(0.999)).toBe('groundout');
    expect(pitchOutcomeFor(1)).toBe('strike');
    expect(pitchOutcomeFor(12)).toBe('strike');
    expect(POP_OUT_UNDER_SECONDS).toBe(0.5);
    expect(GROUND_OUT_UNDER_SECONDS).toBe(1);
  });

  it('gives the rival a single 65%, a double 25%, a triple 8% and a home run 2%', () => {
    expect(CPU_HIT_WEIGHTS).toEqual({ single: 0.65, double: 0.25, triple: 0.08, homer: 0.02 });
    expect(Object.values(CPU_HIT_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(cpuHitFor(0)).toBe('single');
    expect(cpuHitFor(0.6499)).toBe('single');
    expect(cpuHitFor(0.65)).toBe('double');
    expect(cpuHitFor(0.8999)).toBe('double');
    expect(cpuHitFor(0.9)).toBe('triple');
    expect(cpuHitFor(0.9799)).toBe('triple');
    expect(cpuHitFor(0.98)).toBe('homer');
    expect(cpuHitFor(0.9999)).toBe('homer');
    // Out-of-range input is kept in range.
    expect(cpuHitFor(-1)).toBe('single');
    expect(cpuHitFor(7)).toBe('homer');
  });

  it('makes the hits in about the right proportions over a sweep of the range', () => {
    const counts: Record<Hit, number> = { single: 0, double: 0, triple: 0, homer: 0 };
    for (let i = 0; i < 1000; i++) counts[cpuHitFor((i + 0.5) / 1000)]++;
    expect(counts).toEqual({ single: 650, double: 250, triple: 80, homer: 20 });
  });

  it('calls the strikes on the rival and rings up the third', () => {
    expect(pitchStrikeCall(1)).toEqual({ title: 'Strike 1!', spoken: 'Strike one!', out: false });
    expect(pitchStrikeCall(2).spoken).toBe('Strike two!');
    expect(pitchStrikeCall(3)).toEqual({
      title: 'Strike 3! Strikeout!',
      spoken: 'Strike three! Strikeout!',
      out: true,
    });
  });
});

describe('the announcer', () => {
  it('counts the innings', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '23rd',
      '101st',
    ]);
  });

  it('starts each half-inning', () => {
    expect(inningSpeech(3, 'top')).toBe("Top of the 3rd. You're up to bat!");
    expect(inningSpeech(3, 'bottom')).toBe('Bottom of the 3rd. Time to pitch!');
    expect(inningSpeech(12, 'bottom')).toBe('Bottom of the 12th. Time to pitch!');
    expect(inningSpeech(13, 'top')).toBe("Extra innings. You're up to bat!");
    expect(inningSpeech(30, 'bottom')).toBe('Extra innings. Time to pitch!');
    expect(inningBanner(4, 'top')).toEqual({
      title: 'Top of the 4th',
      detail: "You're up to bat!",
    });
    expect(inningBanner(7, 'bottom').title).toBe('Bottom of the 7th');
  });

  it('ends a half-inning with the outs or the mercy rule, and says who leads', () => {
    expect(halfEndSpeech('outs')).toBe('Three outs!');
    expect(halfEndSpeech('mercy')).toBe("Mercy rule! That's five runs.");
    expect(halfEndTitle('mercy')).toBe('Mercy rule!');
    expect(leadSpeech(3)).toBe('You lead by 3!');
    expect(leadSpeech(-1)).toBe('They lead by 1!');
    expect(leadSpeech(0)).toBe('All tied up!');
    expect(leadSpeech(31)).toBe('You lead by more than 30!');
    expect(leadSpeech(-99)).toBe('They lead by more than 30!');
  });

  it('describes a rival hit', () => {
    expect(cpuHitSpeech('single')).toBe('They hit a single!');
    expect(cpuHitSpeech('homer')).toBe('They hit a home run!');
    expect(hitWord('triple')).toBe('triple');
    expect(rivalHitTitle(TEAMS[0], hitWord('homer'))).toBe('Mud Hens home run!');
  });

  it('calls the final score, up to the most there is a clip for', () => {
    expect(finalSpeech(1)).toBe('You scored 1 run!');
    expect(finalSpeech(30)).toBe('You scored 30 runs!');
    expect(finalSpeech(31)).toBe('You scored more than 30 runs!');
    expect(MAX_SPOKEN_RUNS).toBe(30);
  });

  it('has a recorded clip for every line it can say', () => {
    const lines = new Set(VOICE_LINES.map(normalizeSpeech));
    const said: string[] = [PLAY_BALL, EXTRA_INNINGS, YOU_WIN, POP_OUT_SPEECH, GROUND_OUT_SPEECH];
    for (const hit of Object.keys(BASES_FOR) as Hit[]) said.push(hitSpeech(hit), cpuHitSpeech(hit));
    for (let n = 0; n <= 4; n++) {
      for (const called of [true, false]) said.push(strikeCall(n, called).spoken);
      said.push(pitchStrikeCall(n).spoken);
    }
    for (let inning = 1; inning <= 40; inning++) {
      said.push(inningSpeech(inning, 'top'), inningSpeech(inning, 'bottom'));
    }
    for (const reason of ['outs', 'mercy'] as const) said.push(halfEndSpeech(reason));
    for (let lead = -200; lead <= 200; lead++) said.push(leadSpeech(lead));
    for (let runs = 0; runs <= 200; runs++) said.push(finalSpeech(runs));
    for (const team of TEAMS) said.push(matchupSpeech(team), loseSpeech(team), walkOffSpeech(team));
    const missing = said.filter((line) => !lines.has(normalizeSpeech(line)));
    expect([...new Set(missing)]).toEqual([]);
  });
});

describe('the rival', () => {
  it('has about eighteen real minor league teams, with distinct names and short names', () => {
    expect(TEAMS.length).toBeGreaterThanOrEqual(16);
    expect(new Set(TEAMS.map((t) => t.id)).size).toBe(TEAMS.length);
    expect(new Set(TEAMS.map((t) => t.abbr)).size).toBe(TEAMS.length);
    expect(new Set(TEAMS.map(teamName)).size).toBe(TEAMS.length);
    expect(TEAMS.map((t) => t.nickname)).toContain('Mud Hens');
  });

  it('has every field filled in properly', () => {
    for (const team of TEAMS) {
      expect(team.id).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(team.abbr).toMatch(/^[A-Z]{3}$/);
      expect(['AAA', 'AA', 'A']).toContain(team.level);
      expect(team.city.length).toBeGreaterThan(1);
      expect(team.nickname.length).toBeGreaterThan(1);
      expect(Number.isInteger(team.jersey)).toBe(true);
      expect(team.jersey).toBeGreaterThanOrEqual(0);
      expect(team.jersey).toBeLessThanOrEqual(0xffffff);
    }
    // All three levels are there.
    expect(new Set(TEAMS.map((t) => t.level))).toEqual(new Set(['AAA', 'AA', 'A']));
  });

  it('is picked at random, covering the whole list', () => {
    expect(pickRival(0)).toBe(TEAMS[0]);
    expect(pickRival(0.9999)).toBe(TEAMS[TEAMS.length - 1]);
    expect(pickRival(1)).toBe(TEAMS[TEAMS.length - 1]);
    expect(pickRival(-1)).toBe(TEAMS[0]);
    const seen = new Set(TEAMS.map((_, i) => pickRival((i + 0.5) / TEAMS.length)));
    expect(seen.size).toBe(TEAMS.length);
  });

  it('names our team from the player, falling back to YOU', () => {
    const rival = TEAMS[0];
    expect(ourAbbr('Kevin', rival)).toBe('KEV');
    expect(ourAbbr('ava', rival)).toBe('AVA');
    expect(ourAbbr("D'Arcy", rival)).toBe('DAR');
    expect(ourAbbr(undefined, rival)).toBe('YOU');
    expect(ourAbbr('', rival)).toBe('YOU');
    expect(ourAbbr('7', rival)).toBe('YOU');
    expect(ourAbbr('Al', rival)).toBe('AL');
    // Never the same as the rival's.
    expect(ourAbbr('Tolly', rival)).toBe('YOU');
  });

  it('puts the rival in a team colour and a darker cap', () => {
    expect(darken(0xffffff, 0.5)).toBe(0x808080);
    expect(darken(0xe5702a, 1)).toBe(0xe5702a);
    expect(darken(0x123456, 0)).toBe(0);
    const colours = coloursOf(TEAMS[0]);
    expect(colours.shirt).toBe(TEAMS[0].jersey);
    expect(colours.cap).not.toBe(colours.shirt);
    expect(OUR_COLOURS.shirt).not.toBe(OUR_COLOURS.cap);
  });

  it('speaks lines that name only the nickname or the city and nickname', () => {
    const [mudHens] = TEAMS;
    expect(matchupSpeech(mudHens)).toBe('Today you play the Toledo Mud Hens!');
    expect(loseSpeech(mudHens)).toBe('The Mud Hens win!');
    expect(walkOffSpeech(mudHens)).toBe('Walk-off! The Mud Hens win!');
    expect(scoreLine(mudHens, 4, 2)).toBe('You 4 – Mud Hens 2');
    expect(outcomeText(mudHens, 9, 6)).toBe('You beat the Toledo Mud Hens 9–6!');
    expect(outcomeText(mudHens, 3, 4)).toBe('The Toledo Mud Hens beat you 4–3.');
  });
});

describe('the umpire', () => {
  it('calls strikes one and two, swinging or looking', () => {
    expect(strikeCall(1, false)).toEqual({ title: 'Strike 1!', spoken: 'Strike one!', out: false });
    expect(strikeCall(2, true)).toEqual({
      title: 'Called strike 2!',
      spoken: 'Called strike two!',
      out: false,
    });
  });

  it('rings up the batter on the third', () => {
    expect(strikeCall(3, false)).toMatchObject({ out: true, spoken: 'Strike three! You are out!' });
    expect(strikeCall(3, true).title).toContain('looking');
  });

  it('shows outs and strikes as dots', () => {
    expect(dots(0, 3)).toBe('○○○');
    expect(dots(2, 3)).toBe('●●○');
    expect(dots(5, 3)).toBe('●●●');
  });

  it('eases towards a goal the same at any frame rate', () => {
    let a = 0;
    for (let i = 0; i < 60; i++) a = easeToward(a, 10, 4, 1 / 60);
    let b = 0;
    for (let i = 0; i < 30; i++) b = easeToward(b, 10, 4, 1 / 30);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe('pitches and hits in flight', () => {
  const hits: Hit[] = ['single', 'double', 'triple', 'homer'];

  it('floats the pitch from the hand to the plate in an arc', () => {
    const start = at(0.2, 2, -7);
    const out = at(0, 0, 0);
    expect(pitchPosition(0, out, start)).toEqual(start);
    expect(pitchPosition(1, out, start)).toEqual(CONTACT);
    const mid = pitchPosition(0.5, out, start);
    // Above the straight line between the two.
    expect(mid.y).toBeGreaterThan((start.y + CONTACT.y) / 2 + 0.5);
    expect(mid.z).toBeCloseTo((start.z + CONTACT.z) / 2, 6);
  });

  it('starts the pitch at the release point by default and moves steadily towards the plate', () => {
    const out = at(0, 0, 0);
    expect(pitchPosition(0, out)).toEqual(RELEASE);
    let last = -Infinity;
    for (let u = 0; u <= 1; u += 0.1) {
      const z = pitchPosition(u, out).z;
      expect(z).toBeGreaterThan(last);
      last = z;
    }
  });

  it('zips from where it is to where it is going', () => {
    const out = at(0, 0, 0);
    expect(dashPosition(at(0, 2, -4), CONTACT, 0, out)).toEqual(at(0, 2, -4));
    expect(dashPosition(at(0, 2, -4), CONTACT, 1, out)).toEqual(CONTACT);
    expect(dashPosition(at(0, 2, -4), CONTACT, 2, out)).toEqual(CONTACT);
  });

  it('measures the wall from the poles to centre field', () => {
    expect(wallRadius(FOUL_ANGLE)).toBeCloseTo(WALL_POLE, 6);
    expect(wallRadius(-FOUL_ANGLE)).toBeCloseTo(WALL_POLE, 6);
    expect(wallRadius(0)).toBeCloseTo(WALL_CENTRE, 6);
    expect(wallRadius(0.3)).toBeLessThan(WALL_CENTRE);
    expect(wallRadius(0.3)).toBeGreaterThan(WALL_POLE);
  });

  it('converts between field angles and points', () => {
    const p = fieldPoint(0.4, 20);
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(20, 6);
    expect(fieldAngle(p)).toBeCloseTo(0.4, 6);
    expect(fieldPoint(0, 10).z).toBeCloseTo(-10, 6);
    expect(fieldPoint(0.5, 10).x).toBeGreaterThan(0);
  });

  it.each(hits)('starts a %s at the bat and lands where it says', (hit) => {
    for (const side of [-1, 1] as const) {
      const plan = planHit(hit, side, 0.5, 0.5);
      const out = at(0, 0, 0);
      expect(plan.position(0, out)).toMatchObject(CONTACT);
      const down = plan.position(plan.airTime, out);
      expect(down.x).toBeCloseTo(plan.landing.x, 6);
      expect(down.z).toBeCloseTo(plan.landing.z, 6);
      expect(Math.sign(plan.landing.x)).toBe(side);
      expect(plan.duration).toBeGreaterThanOrEqual(plan.airTime);
    }
  });

  it('hits a single into shallow outfield, past the infield and short of the wall', () => {
    for (const roll of [0, 0.5, 1]) {
      const plan = planHit('single', 1, roll, roll);
      const reach = Math.hypot(plan.landing.x, plan.landing.z);
      expect(reach).toBeGreaterThan(19);
      expect(reach).toBeLessThan(24);
      expect(plan.overWall).toBe(false);
      expect(plan.lift).toBeLessThan(4);
    }
  });

  it('puts a double in the gap between the fielders and rolls it towards the wall', () => {
    for (const side of [-1, 1] as const) {
      const plan = planHit('double', side, 0.5, 0.5);
      const angle = Math.abs(fieldAngle(plan.landing));
      expect(angle).toBeGreaterThan((14 * Math.PI) / 180);
      expect(angle).toBeLessThan((25 * Math.PI) / 180);
      const stop = Math.hypot(plan.stop.x, plan.stop.z);
      expect(stop).toBeGreaterThan(Math.hypot(plan.landing.x, plan.landing.z));
      expect(stop).toBeLessThan(wallRadius(fieldAngle(plan.stop)));
    }
  });

  it('drives a triple deep down the line and rolls it into the corner', () => {
    for (const side of [-1, 1] as const) {
      const plan = planHit('triple', side, 0.5, 0.5);
      expect(Math.abs(fieldAngle(plan.landing))).toBeGreaterThan((34 * Math.PI) / 180);
      expect(Math.abs(fieldAngle(plan.landing))).toBeLessThan(FOUL_ANGLE);
      expect(Math.abs(fieldAngle(plan.stop))).toBeGreaterThan((41 * Math.PI) / 180);
      expect(Math.hypot(plan.stop.x, plan.stop.z)).toBeLessThan(wallRadius(fieldAngle(plan.stop)));
    }
  });

  it('sends a home run high over the wall', () => {
    for (const side of [-1, 1] as const) {
      for (const roll of [0, 0.5, 1]) {
        const plan = planHit('homer', side, roll, roll);
        expect(plan.overWall).toBe(true);
        const angle = fieldAngle(plan.landing);
        expect(Math.hypot(plan.landing.x, plan.landing.z)).toBeGreaterThan(wallRadius(angle) + 4);
        // Find the moment the ball is over the wall and check it is well above it.
        const out = at(0, 0, 0);
        let clearance = Infinity;
        for (let t = 0; t <= plan.airTime; t += 0.01) {
          plan.position(t, out);
          if (Math.hypot(out.x, out.z) >= wallRadius(fieldAngle(out))) {
            clearance = out.y;
            break;
          }
        }
        expect(clearance).toBeGreaterThan(WALL_HEIGHT + 3);
      }
    }
  });

  it('flies further and higher the better the hit', () => {
    const lifts = hits.map((h) => planHit(h, 1, 0.5, 0.5).lift);
    expect(lifts).toEqual([...lifts].sort((a, b) => a - b));
    const reach = Object.fromEntries(
      hits.map((h) => {
        const p = planHit(h, 1, 0.5, 0.5).landing;
        return [h, Math.hypot(p.x, p.z)];
      }),
    );
    expect(reach.single).toBeLessThan(reach.double);
    expect(reach.homer).toBeGreaterThan(reach.triple + 10);
  });

  it('keeps a rolling ball on the ground, slowing down to a stop', () => {
    const plan = planHit('double', 1, 0.5, 0.5);
    const out = at(0, 0, 0);
    plan.position(plan.airTime + 0.5, out);
    expect(out.y).toBeGreaterThanOrEqual(BALL_RADIUS - 1e-9);
    expect(out.y).toBeLessThan(1);
    const end = plan.position(plan.duration, at(0, 0, 0));
    expect(end.x).toBeCloseTo(plan.stop.x, 6);
    expect(end.z).toBeCloseTo(plan.stop.z, 6);
    const later = plan.position(plan.duration + 3, at(0, 0, 0));
    expect(later.x).toBeCloseTo(plan.stop.x, 6);
  });

  it('sends the nearest outfielders after the ball', () => {
    const outfield = (['LF', 'CF', 'RF'] as FielderId[]).map((id) => ({
      id,
      ...FIELDER_SPOTS[id],
    }));
    expect(pickChasers(outfield, at(-10, 0, -25), 1).map((f) => f.id)).toEqual(['LF']);
    expect(pickChasers(outfield, at(12, 0, -30), 2).map((f) => f.id)).toEqual(['RF', 'CF']);
    expect(pickChasers(outfield, at(0, 0, -30), 0)).toEqual([]);
    expect(CHASERS).toEqual({ single: 1, double: 2, triple: 2, homer: 1 });
  });

  it('lays out the bases a base-side apart, with the mound between home and second', () => {
    expect(BASE_SPOTS).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      const a = BASE_SPOTS[i];
      const b = BASE_SPOTS[(i + 1) % 4];
      expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeCloseTo(BASE_SIDE, 6);
    }
    expect(BASE_SPOTS[1].x).toBeGreaterThan(0);
    expect(BASE_SPOTS[3].x).toBeLessThan(0);
  });

  it('follows the base paths round and back to home', () => {
    const out = at(0, 0, 0);
    for (let i = 0; i <= 4; i++) {
      const p = basePathPoint(i * BASE_SIDE, out);
      const spot = BASE_SPOTS[i % 4];
      expect(p.x).toBeCloseTo(spot.x, 6);
      expect(p.z).toBeCloseTo(spot.z, 6);
    }
    expect(LAP).toBe(4 * BASE_SIDE);
    const half = basePathPoint(BASE_SIDE / 2, out);
    expect(half.x).toBeCloseTo(BASE_SPOTS[1].x / 2, 6);
    expect(basePathPoint(999, out).z).toBeCloseTo(0, 6);
  });
});

describe('the camera', () => {
  const SCREENS: [number, number][] = [
    [360, 640],
    [390, 844],
    [412, 915],
    [844, 390],
    [768, 1024],
    [1024, 768],
    [1280, 800],
    [1366, 768],
  ];

  /** Screen row of a world point as the batting view shows it. */
  const rowOf = (w: number, h: number, p: Vec) => {
    const fit = fitView(w, h);
    const camera = new PerspectiveCamera(fit.fov, w / h, 0.3, 600);
    camera.setViewOffset(w, h, 0, fit.shift, w, h);
    const home = homeView(w / h);
    camera.position.set(home.cam.x, home.cam.y, home.cam.z);
    camera.lookAt(home.look.x, home.look.y, home.look.z);
    camera.updateMatrixWorld();
    const v = new Vector3(p.x, p.y, p.z).project(camera);
    return { row: ((1 - v.y) / 2) * h, col: ((v.x + 1) / 2) * w };
  };

  it.each(SCREENS)(
    'keeps the pitcher and the plate clear of the question and answers at %ix%i',
    (w, h) => {
      const band = playBand(w, h);
      const pitcher = rowOf(w, h, at(0, 3, -8.2));
      const plate = rowOf(w, h, at(0, 0, 0));
      expect(pitcher.row).toBeGreaterThanOrEqual(band.top - 2);
      expect(plate.row).toBeLessThanOrEqual(band.bottom + 2);
      expect(pitcher.col).toBeGreaterThan(0);
      expect(pitcher.col).toBeLessThan(w);
    },
  );

  it.each(SCREENS)('picks a sensible field of view at %ix%i', (w, h) => {
    const fit = fitView(w, h);
    expect(fit.fov).toBeGreaterThanOrEqual(30);
    expect(fit.fov).toBeLessThanOrEqual(88);
    expect(Number.isFinite(fit.shift)).toBe(true);
  });

  const BOARD_SCREENS: [number, number][] = [
    [360, 640],
    [360, 740],
    [390, 844],
    [412, 915],
    [768, 1024],
    [1024, 768],
    [1366, 1024],
    [844, 390],
    [667, 375],
    [640, 360],
    [568, 320],
  ];

  it.each(BOARD_SCREENS)(
    'keeps the whole scoreboard face off the top of the batting view at %ix%i',
    (w, h) => {
      const bottom = rowOf(w, h, at(BOARD.x, BOARD.y - BOARD.height / 2, BOARD.z)).row;
      const top = rowOf(w, h, at(BOARD.x, BOARD.y + BOARD.height / 2, BOARD.z)).row;
      // The bottom edge is above row 0, so no part of the face peeks out behind the buttons.
      expect(bottom).toBeLessThan(-4);
      expect(top).toBeLessThan(bottom);
    },
  );

  const SHORT: [number, number][] = [
    [568, 320],
    [640, 360],
    [667, 375],
    [844, 390],
  ];

  it('stacks the HUD on any screen held upright, phone or tablet', () => {
    expect(hudLayout(390, 844)).toBe('stacked');
    expect(hudLayout(360, 640)).toBe('stacked');
    expect(hudLayout(600, 900)).toBe('stacked');
    // A phone on its side is as narrow, but it is wide: it must not get the upright layout.
    for (const [w, h] of [
      [568, 320],
      [640, 360],
      [667, 375],
    ]) {
      expect(hudLayout(w, h)).toBe('compact');
    }
    expect(hudLayout(844, 390)).toBe('standard');
    // A tablet held upright is wider than a phone but still tall: the question goes under the
    // scorebug rather than at the top centre where it would sit on it.
    expect(hudLayout(768, 1024)).toBe('stacked');
    expect(hudLayout(1024, 1366)).toBe('stacked');
    expect(hudLayout(1024, 768)).toBe('standard');
    expect(hudLayout(1366, 1024)).toBe('standard');
  });

  it.each([
    [768, 1024],
    [1024, 1366],
  ])(
    'leaves a portrait tablet plenty of field between the question and answers at %ix%i',
    (w, h) => {
      const band = playBand(w, h);
      expect(band.bottom - band.top).toBeGreaterThanOrEqual(300);
      const fit = fitView(w, h);
      expect(fit.fov).toBeLessThanOrEqual(88);
      expect(rowOf(w, h, at(0, 3, -8.2)).row).toBeGreaterThanOrEqual(band.top - 2);
      expect(rowOf(w, h, at(0, 0, 0)).row).toBeLessThanOrEqual(band.bottom + 2);
    },
  );

  it('moves a question that lands on the scorebug to just below it, and only then', () => {
    const bug = { left: 12, top: 70, right: 309, bottom: 143 };
    const clash = { left: 150, top: 12, right: 700, bottom: 110 };
    const clear = { left: 330, top: 12, right: 700, bottom: 110 };
    expect(rectsOverlap(clash, bug)).toBe(true);
    expect(rectsOverlap(clear, bug)).toBe(false);
    // Edges that only touch do not count.
    expect(rectsOverlap({ left: 309, top: 70, right: 500, bottom: 143 }, bug)).toBe(false);
    expect(questionTopBelowBug(clear, bug)).toBeNull();
    // Just touching the scorebug's edge (as on an 844x390 phone) is left where it is.
    const edge = { left: bug.right - QUESTION_SLACK + 1, top: 12, right: 540, bottom: 107 };
    expect(rectsOverlap(edge, bug)).toBe(true);
    expect(questionTopBelowBug(edge, bug)).toBeNull();
    expect(questionTopBelowBug(clash, bug)).toBe(143 + QUESTION_GAP);
    expect(QUESTION_GAP).toBe(8);
  });

  it.each(SHORT)('leaves a short landscape phone at least 150px of field at %ix%i', (w, h) => {
    const band = playBand(w, h);
    expect(band.bottom - band.top).toBeGreaterThanOrEqual(150);
    const fit = fitView(w, h);
    expect(fit.fov).toBeLessThanOrEqual(88);
    // The pitcher's cap down to the umpire's waist fits inside the band.
    const pitcher = rowOf(w, h, at(0, 3, -8.2));
    const umpire = rowOf(w, h, at(1.3, 0.9, 3.4));
    expect(pitcher.row).toBeGreaterThanOrEqual(band.top - 2);
    expect(umpire.row).toBeLessThanOrEqual(band.bottom + 2);
    expect(umpire.row - pitcher.row).toBeLessThanOrEqual(band.bottom - band.top);
  });

  it('takes a measured band over the worked-out one', () => {
    const measured = { top: 120, bottom: 300 };
    const fit = fitView(568, 320, measured);
    // The field of view and shift are worked out for the band given.
    expect(fit).not.toEqual(fitView(568, 320));
    expect(Number.isFinite(fit.shift)).toBe(true);
  });

  it('has room for the pitcher and the batter side by side on the narrowest phone', () => {
    const batter = rowOf(360, 640, at(-1.5, 1, 0));
    const ump = rowOf(360, 640, at(1.3, 1, 3.4));
    expect(batter.col).toBeGreaterThan(0);
    expect(ump.col).toBeLessThan(360);
  });

  it('holds the batting view until the ball has left the plate, then follows it', () => {
    const home = homeView(0.5);
    const cam = at(0, 0, 0);
    const look = at(0, 0, 0);
    followGoal(at(0, 1, 0), cam, look, home);
    expect(cam).toMatchObject({ x: home.cam.x, z: home.cam.z });
    expect(look.z).toBeCloseTo(home.look.z, 6);
    followGoal(at(-10, 8, -30), cam, look, home);
    expect(look.x).toBeLessThan(-5);
    expect(look.z).toBeCloseTo(-30, 6);
    expect(cam.y).toBeGreaterThan(home.cam.y);
  });

  it('stays near home so it never ends up inside the stands', () => {
    for (const aspect of [0.46, 1, 2.2]) {
      const cam = at(0, 0, 0);
      followGoal(at(40, 20, -60), cam, at(0, 0, 0), homeView(aspect));
      expect(Math.abs(cam.x)).toBeLessThan(6);
      expect(cam.z).toBeGreaterThan(0);
    }
  });

  it('comes down a little on a wide screen so people fill more of the picture', () => {
    expect(homeView(2.2).cam.y).toBeLessThan(homeView(0.46).cam.y);
    expect(homeView(0.3)).toEqual(homeView(0.5));
    expect(homeView(5)).toEqual(homeView(2.5));
  });
});

describe('the view from the mound', () => {
  const SCREENS: [number, number][] = [
    [360, 640],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1366, 768],
    [844, 390],
    [568, 320],
  ];

  /** Screen position of a world point as the pitching view shows it. */
  const seen = (w: number, h: number, p: Vec) => {
    const band = playBand(w, h);
    const fit = fitMoundView(w, h, band);
    const camera = new PerspectiveCamera(fit.fov, w / h, 0.3, 600);
    camera.setViewOffset(w, h, 0, fit.shift, w, h);
    const view = moundView(w / h);
    camera.position.set(view.cam.x, view.cam.y, view.cam.z);
    camera.lookAt(view.look.x, view.look.y, view.look.z);
    camera.updateMatrixWorld();
    const v = new Vector3(p.x, p.y, p.z).project(camera);
    return { row: ((1 - v.y) / 2) * h, col: ((v.x + 1) / 2) * w };
  };

  it('sits behind the pitcher, high enough to see over him, looking in at the plate', () => {
    for (const aspect of [0.46, 1, 1.6, 2.4]) {
      const { cam, look } = moundView(aspect);
      expect(cam.z).toBeLessThan(MOUND_Z);
      expect(cam.y).toBeGreaterThan(3);
      expect(look.z).toBeGreaterThan(0);
      expect(Math.abs(cam.x)).toBeLessThan(2);
    }
  });

  it('comes down a little on a wide screen, and holds still beyond the usual shapes', () => {
    expect(moundView(2.2).cam.y).toBeLessThan(moundView(0.46).cam.y);
    expect(moundView(0.3)).toEqual(moundView(0.5));
    expect(moundView(5)).toEqual(moundView(2.5));
  });

  it.each(SCREENS)('picks a sensible field of view at %ix%i', (w, h) => {
    const fit = fitMoundView(w, h);
    expect(fit.fov).toBeGreaterThanOrEqual(24);
    expect(fit.fov).toBeLessThanOrEqual(88);
    expect(Number.isFinite(fit.shift)).toBe(true);
  });

  it.each(SCREENS)(
    'keeps the pitcher, the plate and the umpire between the question and the answers at %ix%i',
    (w, h) => {
      const band = playBand(w, h);
      const umpire = seen(w, h, at(1.3, 2.6, 3.4));
      const feet = seen(w, h, at(0, 0.45, MOUND_Z));
      const plate = seen(w, h, at(0, 0, 0));
      expect(umpire.row).toBeGreaterThanOrEqual(band.top - 2);
      expect(feet.row).toBeLessThanOrEqual(band.bottom + 2);
      expect(plate.row).toBeGreaterThan(umpire.row);
      expect(plate.row).toBeLessThan(feet.row);
      for (const spot of [umpire, feet, plate]) {
        expect(spot.col).toBeGreaterThan(0);
        expect(spot.col).toBeLessThan(w);
      }
    },
  );

  it.each(SCREENS)('has the batter, catcher and umpire all on screen at %ix%i', (w, h) => {
    for (const p of [at(0, 1.5, 0), at(0, 1.2, 1.2), at(1.3, 1.5, 3.4)]) {
      const spot = seen(w, h, p);
      expect(spot.col).toBeGreaterThan(0);
      expect(spot.col).toBeLessThan(w);
    }
  });
});

describe('plays in the field', () => {
  it('arcs a ball over the straight line, and lands it where it was going', () => {
    const out = at(0, 0, 0);
    const from = at(0, 1, 0);
    const to = at(-2, 1.5, -5);
    expect(arcPosition(from, to, 0, 6, out)).toEqual(from);
    expect(arcPosition(from, to, 1, 6, out)).toEqual(to);
    arcPosition(from, to, 0.5, 6, out);
    expect(out.x).toBeCloseTo(-1, 6);
    expect(out.z).toBeCloseTo(-2.5, 6);
    expect(out.y).toBeCloseTo(1.25 + 6, 6);
    // No lift is a straight line.
    expect(arcPosition(from, to, 0.5, 0, out).y).toBeCloseTo(1.25, 6);
  });

  it('rolls a ground ball in hops that die away to the ground', () => {
    const out = at(0, 0, 0);
    const from = at(0, 1, 0);
    const to = at(-2, BALL_RADIUS, -4);
    expect(groundBallPosition(from, to, 0, out).y).toBeCloseTo(BALL_RADIUS, 6);
    expect(groundBallPosition(from, to, 1, out).y).toBeCloseTo(BALL_RADIUS, 6);
    expect(groundBallPosition(from, to, 1, out).z).toBeCloseTo(-4, 6);
    let top = 0;
    for (let i = 0; i <= 20; i++) {
      const y = groundBallPosition(from, to, i / 20, out).y;
      expect(y).toBeGreaterThanOrEqual(BALL_RADIUS - 1e-9);
      top = Math.max(top, y);
    }
    expect(top).toBeGreaterThan(BALL_RADIUS + 0.2);
  });

  it('keeps the infield plays in the strip in front of the mound that the camera sees', () => {
    const { cam } = moundView(0.46);
    for (const id of ['SS', '2B', '3B'] as const) {
      for (const spot of [INFIELD_PLAYS[id].pop, INFIELD_PLAYS[id].ground]) {
        expect(spot.z).toBeGreaterThan(cam.z + 5);
        expect(spot.z).toBeLessThan(0);
        expect(Math.abs(spot.x)).toBeLessThan(3);
      }
    }
  });

  it('has the infielder there in time to field the grounder or catch the pop fly', () => {
    for (const id of ['SS', '2B', '3B'] as const) {
      const home = FIELDER_SPOTS[id];
      const trip = (spot: Vec) => Math.hypot(spot.x - home.x, spot.z - home.z) / INFIELD_SPEED;
      expect(trip(INFIELD_PLAYS[id].ground)).toBeLessThanOrEqual(GROUND_BALL_TIME);
      expect(trip(INFIELD_PLAYS[id].pop)).toBeLessThanOrEqual(POP_FLY_TIME);
    }
  });

  it('throws to first base, which is on the first base side', () => {
    expect(FIRST_BASE).toEqual(BASE_SPOTS[1]);
    expect(FIRST_BASE.x).toBeGreaterThan(0);
  });

  it('dresses the fielders, the pitcher and the catcher in a team colour', () => {
    const colours = { shirt: 0x336699, cap: 0x112233 };
    const fielder = createFielder('SS', 0);
    const pitcher = createPitcher();
    const catcher = createCatcher();
    expect(() => {
      fielder.setColours(colours);
      pitcher.setColours(colours);
      catcher.setColours(colours);
    }).not.toThrow();
  });
});

describe('the view of a hit', () => {
  const SCREENS: [number, number][] = [
    [390, 844],
    [844, 390],
    [568, 320],
    [768, 1024],
    [1366, 1024],
  ];

  it('keeps everything below the scorebug and leaves the foot of the screen to the field', () => {
    expect(hitBand(390, 844, 150)).toEqual({ top: 158, bottom: 832 });
    const guess = hitBand(390, 844);
    expect(guess.top).toBeGreaterThan(100);
    expect(guess.bottom).toBeGreaterThan(guess.top);
    expect(centreShift(800, { top: 100, bottom: 700 })).toBe(0);
    expect(centreShift(800, { top: 200, bottom: 700 })).toBe(-50);
  });

  it.each(SCREENS)(
    'closes a home run on the whole scoreboard and the fireworks at %ix%i',
    (w, h) => {
      const fit = fitView(w, h);
      const band = hitBand(w, h);
      const shot = fireworksFit(w, h, fit.fov, band);
      expect(shot.fov).toBeGreaterThanOrEqual(fit.fov);
      // A little wider than the batting view, never a lurch to a fisheye.
      expect(shot.fov).toBeLessThanOrEqual(fit.fov + 12);
      const cam = at(0, 0, 0);
      const look = at(0, 0, 0);
      followGoal(fireworksAim(), cam, look, homeView(w / h));
      // The scoreboard's four corners and the furthest the sparks reach either way.
      const spots = [
        ...[-1, 1].flatMap((sx) =>
          [-1, 1].map((sy) =>
            at(BOARD.x + (sx * BOARD.width) / 2, BOARD.y + (sy * BOARD.height) / 2, BOARD.z),
          ),
        ),
        ...[-1, 1].flatMap((sx) =>
          [-1, 1].map((sy) =>
            at(
              FIREWORKS_CENTRE.x + sx * BURST_RADIUS,
              FIREWORKS_CENTRE.y + sy * BURST_RADIUS,
              FIREWORKS_CENTRE.z,
            ),
          ),
        ),
      ];
      expect(fireworksPoints()).toEqual(spots.slice(0, 4).concat(spots.slice(4)));
      for (const p of spots) {
        const screen = project(p, cam, look, shot.fov, w, h);
        const row = screen.y - shot.shift;
        expect(row).toBeGreaterThanOrEqual(band.top);
        expect(row).toBeLessThanOrEqual(band.bottom);
        expect(screen.x).toBeGreaterThanOrEqual(0);
        expect(screen.x).toBeLessThanOrEqual(w);
      }
    },
  );

  const HITS = ['single', 'double', 'triple'] as const;
  it.each(SCREENS)(
    'ends a single, double or triple with the scoreboard clear of the scorebug at %ix%i',
    (w, h) => {
      const fit = fitView(w, h);
      const band = hitBand(w, h);
      const home = homeView(w / h);
      const lift = (band.top + band.bottom) / 2 - h / 2;
      /** Screen row of the ball, with the aim as given. */
      const ballRow = (ball: Vec, cam: Vec, look: Vec) =>
        project(ball, cam, look, fit.fov, w, h).y + lift;
      for (const hit of HITS) {
        for (const side of [-1, 1] as const) {
          for (const roll of [0, 0.5, 1]) {
            const plan = planHit(hit, side, roll, roll);
            const ball = at(0, 0, 0);
            const cam = at(0, 0, 0);
            const look = at(0, 0, 0);
            const free = at(0, 0, 0);
            for (let t = 0; t <= plan.duration + 0.5; t += 0.1) {
              plan.position(t, ball);
              followGoal(ball, cam, look, home);
              Object.assign(free, look);
              keepBoardClear(ball, cam, look, fit.fov, w, h, band);
              // Tilting for the scoreboard never loses a ball that was in view.
              const before = ballRow(ball, cam, free);
              if (before >= band.top && before <= band.bottom) {
                expect(ballRow(ball, cam, look)).toBeGreaterThanOrEqual(band.top);
                expect(ballRow(ball, cam, look)).toBeLessThanOrEqual(band.bottom);
              }
              if (t < plan.duration) continue;
              // Once the ball has come to rest the scoreboard is clear of the HUD: wholly in the
              // band below the scorebug, or at least not under the scorebug or the buttons.
              expect(boardIsClear(cam, look, fit.fov, w, h, band)).toBe(true);
              // And the ball is in the band.
              expect(ballRow(ball, cam, look)).toBeGreaterThan(band.top);
              expect(ballRow(ball, cam, look)).toBeLessThan(band.bottom);
            }
          }
        }
      }
    },
  );

  it('knows where the HUD sits on the picture', () => {
    const [menu, buttons, bug] = hudRects(844, 390);
    expect(menu.left).toBeLessThan(12);
    expect(buttons.right).toBeGreaterThan(844 - 12);
    expect(bug.bottom).toBeGreaterThan(110);
    const measured = hudRects(844, 390, { left: 12, top: 70, right: 300, bottom: 160 })[2];
    expect(measured.bottom).toBe(164);
  });

  it('leaves the aim alone once the scoreboard is clear', () => {
    const fit = fitView(844, 390);
    const band = hitBand(844, 390);
    const cam = at(0.4, 3.5, 11);
    const look = at(0, 0.5, -30);
    const ball = at(0, 0.2, -30);
    keepBoardClear(ball, cam, look, fit.fov, 844, 390, band);
    const settled = { ...look };
    keepBoardClear(ball, cam, look, fit.fov, 844, 390, band);
    expect(look).toEqual(settled);
  });
});

describe('seeing the ball', () => {
  it("works out the ball's radius on screen from its distance and the field of view", () => {
    // At 90 degrees, tan(45) is 1: radius * (height / 2) / distance.
    expect(ballRadiusPx(10, 90, 800)).toBeCloseTo((BALL_RADIUS * 400) / 10, 6);
    expect(ballRadiusPx(20, 90, 800)).toBeCloseTo(ballRadiusPx(10, 90, 800) / 2, 6);
    expect(ballRadiusPx(10, 45, 800)).toBeGreaterThan(ballRadiusPx(10, 90, 800));
    expect(ballRadiusPx(10, 90, 1600)).toBeCloseTo(ballRadiusPx(10, 90, 800) * 2, 6);
    expect(Number.isFinite(ballRadiusPx(0, 60, 800))).toBe(true);
  });

  it('leaves a ball that is already big enough alone, and never balloons one near the camera', () => {
    expect(ballScale(2, 50, 844)).toBe(1);
    expect(ballScale(0.01, 50, 844)).toBe(1);
  });

  it('scales a far ball up until it is the least size, and no further than the world-size cap', () => {
    const most = MAX_BALL_WORLD_RADIUS / BALL_RADIUS;
    let last = 1;
    for (const distance of [5, 10, 20, 30, 40, 60, 80, 120, 400]) {
      const scale = ballScale(distance, 50, 844);
      expect(scale).toBeGreaterThanOrEqual(last);
      // However the ball is scaled, its radius in the world stays within the cap.
      expect(BALL_RADIUS * scale).toBeLessThanOrEqual(MAX_BALL_WORLD_RADIUS + 1e-9);
      const px = ballRadiusPx(distance, 50, 844) * scale;
      expect(px >= MIN_BALL_PX - 1e-9 || scale === most).toBe(true);
      last = scale;
    }
    expect(BALL_RADIUS * ballScale(400, 50, 844)).toBeCloseTo(MAX_BALL_WORLD_RADIUS, 9);
    // The cap is about a ball's size in the world, so it holds on any screen and fov.
    for (const [fov, h] of [
      [30, 320],
      [88, 390],
      [50, 2000],
    ]) {
      expect(BALL_RADIUS * ballScale(900, fov, h)).toBeLessThanOrEqual(
        MAX_BALL_WORLD_RADIUS + 1e-9,
      );
    }
  });

  it('never enlarges a ball that is near the camera', () => {
    for (const [fov, h] of [
      [35, 320],
      [50, 844],
      [88, 390],
    ]) {
      // Within a few units the ball is already well over the least size on screen.
      for (const distance of [0.01, 1, 3]) {
        expect(ballRadiusPx(distance, fov, h)).toBeGreaterThan(MIN_BALL_PX);
        expect(ballScale(distance, fov, h)).toBe(1);
      }
    }
  });

  it.each([
    [568, 320],
    [390, 844],
    [844, 390],
  ])('keeps the farthest point of a deep home run at least 7px across at %ix%i', (w, h) => {
    const fit = fitView(w, h);
    // The batting view's fov, and the (wider) one the closing shot of the fireworks eases to.
    const fovs = [fit.fov, fireworksFit(w, h, fit.fov, hitBand(w, h)).fov];
    for (const fov of fovs) {
      for (const roll of [0, 0.5, 1]) {
        for (const side of [-1, 1] as const) {
          const plan = planHit('homer', side, roll, roll);
          const cam = at(0, 0, 0);
          const look = at(0, 0, 0);
          const far = at(0, 0, 0);
          let farthest = 0;
          for (let t = 0; t <= plan.airTime; t += 0.05) {
            const ball = plan.position(t, at(0, 0, 0));
            followGoal(ball, cam, look, homeView(w / h));
            const d = Math.hypot(ball.x - cam.x, ball.y - cam.y, ball.z - cam.z);
            // Every point of the flight is at least 7px across, and within the world cap.
            const scale = ballScale(d, fov, h);
            expect(ballRadiusPx(d, fov, h) * scale).toBeGreaterThanOrEqual(MIN_BALL_PX - 1e-9);
            expect(BALL_RADIUS * scale).toBeLessThanOrEqual(MAX_BALL_WORLD_RADIUS + 1e-9);
            if (d > farthest) {
              farthest = d;
              Object.assign(far, ball);
            }
          }
          expect(farthest).toBeGreaterThan(40);
          const scale = ballScale(farthest, fov, h);
          expect(ballRadiusPx(farthest, fov, h) * scale).toBeGreaterThanOrEqual(MIN_BALL_PX - 1e-9);
        }
      }
    }
  });

  it.each([
    [390, 844],
    [844, 390],
    [768, 1024],
  ])('keeps a ball at the top of a home run clearly visible at %ix%i', (w, h) => {
    const fit = fitView(w, h);
    const plan = planHit('homer', 1, 0.5, 0.5);
    const cam = at(0, 0, 0);
    const look = at(0, 0, 0);
    const top = at(0, 0, 0);
    plan.position(plan.airTime / 2, top);
    followGoal(top, cam, look, homeView(w / h));
    const distance = Math.hypot(top.x - cam.x, top.y - cam.y, top.z - cam.z);
    const px = ballRadiusPx(distance, fit.fov, h) * ballScale(distance, fit.fov, h);
    expect(px).toBeGreaterThanOrEqual(MIN_BALL_PX - 1e-9);
  });

  it('turns the glow on and off without needing a canvas', () => {
    const ball = createBall();
    expect(() => {
      ball.setGlow(true);
      ball.setGlow(false);
    }).not.toThrow();
  });
});

describe("the umpire's call on screen", () => {
  it('goes in the question panel on tall, narrow and short screens, and beside the plate on wide ones', () => {
    for (const [w, h] of [
      [360, 740],
      [390, 844],
      [768, 1024],
      [568, 320],
      [640, 360],
      [667, 375],
    ]) {
      expect(callInPanel(w, h)).toBe(true);
    }
    for (const [w, h] of [
      [844, 390],
      [1024, 768],
      [1366, 1024],
    ]) {
      expect(callInPanel(w, h)).toBe(false);
    }
  });
});

describe('the people', () => {
  it('builds a person that can be posed without error, and blends two poses', () => {
    const person = createPerson({ shirt: 0xff0000, pants: 0x0000ff, hat: 'cap' });
    const a = neutralPose();
    const b = neutralPose();
    b.armR.raise = 2;
    b.lean = 1;
    const mid = mixPose(a, b, 0.5, neutralPose());
    expect(mid.armR.raise).toBe(1);
    expect(mid.lean).toBe(0.5);
    person.apply(mid);
    expect(person.root.children.length).toBeGreaterThan(0);
    const hand = person.handWorld('R', new Vector3());
    expect(Number.isFinite(hand.y)).toBe(true);
  });

  it('puts the batter at the plate with the bat meeting the ball where it arrives', () => {
    const batter = createBatter();
    const pos = batter.person.root.position;
    // Beside the plate on the third-base side, not on top of it.
    expect(pos.x).toBeLessThan(-0.5);
    expect(pos.x).toBeGreaterThan(-2.6);
    expect(Math.abs(pos.z)).toBeLessThan(1.5);
    expect(SWING_CONTACT).toBeCloseTo(0.3, 6);
  });

  it('swings through to the follow-through, and can drop the bat', () => {
    const scene = new Scene();
    const batter = createBatter();
    scene.add(batter.person.root);
    batter.swing();
    for (let i = 0; i < 60; i++) batter.mover.update(1 / 60, i / 60);
    const prop = batter.dropBat();
    expect(prop).not.toBeNull();
    expect(batter.dropBat()).toBeNull();
    let alive = true;
    for (let i = 0; i < 400 && alive; i++) alive = prop!.update(1 / 60);
    expect(alive).toBe(false);
    expect(prop!.object.position.y).toBeLessThan(0.2);
  });

  it('gives each batter their own colours', () => {
    const batter = createBatter();
    const before = batter.person.materials.shirt.color.getHex();
    batter.setLook(1);
    expect(batter.person.materials.shirt.color.getHex()).not.toBe(before);
    batter.setLook(1 + 9);
    expect(batter.person.materials.shirt.color.getHex()).not.toBe(before);
  });

  it('holds the catcher behind the plate with the mitt under the ball', () => {
    const catcher = createCatcher();
    catcher.update(0.016, 0);
    const mitt = catcher.mittPosition(new Vector3());
    expect(mitt.x).toBeCloseTo(GLOVE.x, 1);
    expect(mitt.z).toBeCloseTo(GLOVE.z, 1);
    expect(mitt.y).toBeGreaterThan(0.4);
    expect(mitt.y).toBeLessThan(1.6);
    catcher.pop();
    catcher.update(0.05, 0.1);
  });

  it('lets the pitcher release the ball once, a moment into the throw', () => {
    const pitcher = createPitcher();
    pitcher.windUp();
    for (let i = 0; i < 60; i++) pitcher.update(1 / 60, i / 60);
    expect(pitcher.windTime).toBeGreaterThan(0.9);
    let released = 0;
    pitcher.release(() => released++);
    pitcher.update(0.05, 1);
    expect(released).toBe(0);
    pitcher.update(0.1, 1.05);
    expect(released).toBe(1);
    for (let i = 0; i < 60; i++) pitcher.update(1 / 60, 1.2 + i / 60);
    expect(released).toBe(1);
    expect(pitcher.handPosition(new Vector3()).y).toBeGreaterThan(0.3);
    pitcher.reset();
    expect(pitcher.windTime).toBe(0);
  });

  it('lets the umpire call a strike and go back to standing', () => {
    const umpire = createUmpire();
    umpire.callStrike(true);
    for (let i = 0; i < 90; i++) umpire.update(1 / 60, i / 60);
    umpire.reset();
    umpire.update(0.1, 2);
    expect(umpire.root.position.z).toBeGreaterThan(2);
  });

  it('puts all seven fielders in their places, facing home', () => {
    const ids = Object.keys(FIELDER_SPOTS) as FielderId[];
    expect(ids.sort()).toEqual(['1B', '2B', '3B', 'CF', 'LF', 'RF', 'SS']);
    for (const [i, id] of ids.entries()) {
      const fielder = createFielder(id, i);
      const pos = fielder.mover.person.root.position;
      expect(pos.x).toBeCloseTo(FIELDER_SPOTS[id].x, 6);
      expect(pos.z).toBeCloseTo(FIELDER_SPOTS[id].z, 6);
      expect(fielder.atHome()).toBe(true);
    }
    // First base is on the right, third on the left; the outfielders are further out.
    expect(FIELDER_SPOTS['1B'].x).toBeGreaterThan(0);
    expect(FIELDER_SPOTS['3B'].x).toBeLessThan(0);
    expect(FIELDER_SPOTS.LF.x).toBeLessThan(0);
    expect(FIELDER_SPOTS.RF.x).toBeGreaterThan(0);
    expect(FIELDER_SPOTS.CF.z).toBeLessThan(FIELDER_SPOTS.SS.z - 5);
  });

  it('sends a fielder after the ball and back again', () => {
    const fielder = createFielder('LF', 0);
    let arrived = 0;
    fielder.chase(at(-3, 0, -40), 9, 'scoop', () => arrived++);
    for (let i = 0; i < 60; i++) fielder.mover.update(1 / 60, i / 60);
    expect(arrived).toBe(0);
    expect(fielder.mover.moving).toBe(true);
    for (let i = 0; i < 240; i++) fielder.mover.update(1 / 60, 1 + i / 60);
    expect(arrived).toBe(1);
    expect(fielder.mover.person.root.position.x).toBeCloseTo(-3, 6);
    fielder.goHome(7);
    for (let i = 0; i < 600; i++) fielder.mover.update(1 / 60, 5 + i / 60);
    expect(fielder.atHome()).toBe(true);
  });

  it('runs a person along a path at a steady speed and stops at the end', () => {
    const person = createPerson({ shirt: 1, pants: 2 });
    const mover = createMover(person);
    let arrived = false;
    mover.runTo([at(0, 0, -10), at(10, 0, -10)], 10, () => (arrived = true));
    for (let i = 0; i < 15; i++) mover.update(0.1, i * 0.1);
    // 1.5 seconds at 10 units/s is 15 of the 20 units.
    expect(arrived).toBe(false);
    expect(person.root.position.x).toBeCloseTo(5, 6);
    for (let i = 0; i < 10; i++) mover.update(0.1, 1.5 + i * 0.1);
    expect(arrived).toBe(true);
    expect(person.root.position.x).toBeCloseTo(10, 6);
    expect(person.root.position.z).toBeCloseTo(-10, 6);
    expect(mover.moving).toBe(false);
  });

  it('can be told to stop short', () => {
    const mover = createMover(createPerson({ shirt: 1, pants: 2 }));
    let arrived = false;
    mover.runTo([at(0, 0, -50)], 10, () => (arrived = true));
    mover.update(0.5, 0);
    mover.halt();
    mover.update(0.5, 0.5);
    expect(arrived).toBe(false);
    expect(mover.person.root.position.z).toBeCloseTo(-5, 6);
  });

  it('keeps the ball and its shadow together, drawing it bigger when asked', () => {
    const ball = createBall();
    ball.place(at(1, 2, 3), 2);
    const [mesh, shadow] = ball.object.children;
    expect(mesh.position.x).toBe(1);
    expect(mesh.scale.x).toBe(2);
    expect(shadow.position.y).toBeLessThan(0.1);
    ball.setVisible(false);
    expect(ball.object.visible).toBe(false);
  });
});

describe('the ballpark', () => {
  it('builds the field, and redraws the scoreboard without a canvas', () => {
    const scene = new Scene();
    const field = buildField(scene);
    expect(scene.children.length).toBeGreaterThan(30);
    expect(() =>
      field.setBoard({
        usAbbr: 'KEV',
        themAbbr: 'TOL',
        line: lineScore(midGame(3, 'bottom', [1, 0, 2], [0, 4, 1])),
        inning: 3,
        half: 'bottom',
        outs: 2,
      }),
    ).not.toThrow();
    // Fireworks go off beyond the outfield wall and well above it.
    expect(field.fireworksCentre.z).toBeLessThan(-wallRadius(0));
    expect(field.fireworksCentre.y).toBeGreaterThan(15);
  });

  it('draws the outs dots inside the scoreboard border, lined up with the numbers', () => {
    const centres = boardDotCentres();
    expect(centres).toHaveLength(3);
    const half = BOARD_DOT_RADIUS + BOARD_DOT_STROKE / 2;
    // The last dot's outer edge sits on the numbers' right edge, inside the 504px border.
    expect(centres[2] + half).toBeCloseTo(BOARD_RIGHT_EDGE, 6);
    expect(centres[2] + half).toBeLessThan(504 - 3);
    expect(centres[2]).toBeGreaterThan(455);
    expect(centres[2]).toBeLessThan(461);
    // The same spacing as before, and the dots do not touch each other.
    expect(centres[1] - centres[0]).toBe(BOARD_DOT_SPACING);
    expect(centres[2] - centres[1]).toBe(BOARD_DOT_SPACING);
    expect(BOARD_DOT_SPACING).toBeGreaterThan(2 * half);
    // Clear of the OUTS label (at x 40, four 40px capitals wide, at most 0.8em each).
    expect(centres[0] - half).toBeGreaterThan(40 + 4 * 40 * 0.8);
  });

  it('bursts fireworks after the rocket has climbed, and clears them', () => {
    const effects = createEffects();
    let bursts = 0;
    effects.onBurst = () => bursts++;
    effects.firework(at(0, 30, -50), 0xff0000, 0.2);
    effects.update(0.1);
    expect(bursts).toBe(0);
    for (let i = 0; i < 100; i++) effects.update(0.016);
    expect(bursts).toBe(1);
    effects.crack(CONTACT);
    effects.pop(GLOVE);
    effects.dust(at(0, 0, -20));
    effects.trail(at(0, 2, -5), 0.5);
    effects.halo(at(0, 2, -5), 0.8, 0.05);
    effects.setScale(500);
    effects.update(0.016);
    effects.clear();
    effects.update(0.016);
  });
});

describe('manifest', () => {
  it('is a points game called Batter Up', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const manifest = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../src/games/batter-up/game.json'), 'utf8'),
    );
    expect(manifest.id).toBe('batter-up');
    expect(manifest.title).toBe('Batter Up');
    expect(manifest.scoring).toBe('score');
    expect(manifest.tags).toEqual(['sports', '3d']);
  });
});
