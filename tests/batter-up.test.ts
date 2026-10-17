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
  CONTACT,
  dashPosition,
  FOUL_ANGLE,
  fieldAngle,
  fieldPoint,
  FIREWORKS_CENTRE,
  FIRST_BASE,
  GLOVE,
  groundBallPosition,
  groundHeight,
  MOUND,
  MOUND_HEIGHT,
  LAP,
  pitchPosition,
  POSITION_SPOTS,
  RELEASE,
  WALL_CENTRE,
  WALL_HEIGHT,
  WALL_POLE,
  wallRadius,
  type Vec,
} from '../src/games/batter-up/flight';
import {
  assignDefense,
  fieldingSpots,
  leadSpot,
  pickFielder,
} from '../src/games/batter-up/defense';
import {
  checkScript,
  planPlay,
  roundRoute,
  roundRouteInfo,
  type PlayInput,
} from '../src/games/batter-up/choreo';
import { isFair, planBatted, type BattedBall } from '../src/games/batter-up/batted';
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
  popPosition,
  swoopPosition,
  SWOOP_SECONDS,
  wideView,
  frameAction,
  FRAME_MAX_FOV,
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
  advanceOnHit,
  AIR_OUTS,
  applyFieldOut,
  applyOut,
  applyHit,
  applyStrike,
  BASES_FOR,
  batterNumber,
  cpuHitFor,
  cpuHitSpeech,
  CPU_HIT_WEIGHTS,
  dots,
  DOUBLE_PLAYS,
  DP_UNDER_SECONDS,
  GROUND_OUTS,
  hitOfKind,
  hitSubtitle,
  isRightSide,
  LINER_FIELDERS,
  outPopText,
  pickHitKind,
  pickOut,
  zoneOf,
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
  HIT_KINDS,
  HOMER_UNDER_SECONDS,
  hitLabel,
  hitKindSpeech,
  hitKindWord,
  hitWord,
  inningBanner,
  inningSpeech,
  leadSpeech,
  lineScore,
  MAX_OUTS,
  MAX_SPOKEN_RUNS,
  MERCY_RUNS,
  outSpeech,
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
  type HitKind,
  type FieldZone,
  type OutCall,
  type OutKind,
  type Position,
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
const ALL_HIT_KINDS: HitKind[] = Object.values(HIT_KINDS).flatMap((list) =>
  list.map((k) => k.kind),
);
const ALL_OUT_KINDS: OutKind[] = [
  'pop',
  'foul-pop',
  'fly',
  'liner',
  'diving',
  'ground',
  'double-play',
  'force-second',
];
/** The path of the first kind of a hit (or the `index`th), to the left (-1) or right (1). */
const battedHit = (hit: Hit, side: -1 | 1, roll: number, index = 0): BattedBall =>
  planBatted(HIT_KINDS[hit][index].kind, { side: side < 0 ? 0.25 : 0.75, a: roll, b: roll });
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
    expect(hitKindSpeech('homer-moonshot')).toBe('Way up, and gone! Home run!');
    expect(hitKindSpeech('double-gap')).toBe('Into the gap! Double!');
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
    for (const hit of Object.keys(BASES_FOR) as Hit[]) said.push(cpuHitSpeech(hit));
    for (const kind of ALL_HIT_KINDS) said.push(hitKindSpeech(kind));
    for (const kind of ALL_OUT_KINDS) {
      for (const sac of [false, true]) {
        said.push(outSpeech({ kind, fielder: 'SS', zone: 'LC' }, sac));
      }
    }
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
            for (const index of HIT_KINDS[hit].keys()) {
              const plan = battedHit(hit, side, roll, index);
              const ball = at(0, 0, 0);
              const cam = at(0, 0, 0);
              const look = at(0, 0, 0);
              const free = at(0, 0, 0);
              for (let t = 0; t <= plan.end + 0.5; t += 0.1) {
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
                if (t < plan.end) continue;
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
          for (const kindIndex of HIT_KINDS.homer.keys()) {
            const plan = battedHit('homer', side, roll, kindIndex);
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
            expect(ballRadiusPx(farthest, fov, h) * scale).toBeGreaterThanOrEqual(
              MIN_BALL_PX - 1e-9,
            );
          }
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
    const plan = battedHit('homer', 1, 0.5, 1);
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

// ---------- Kinds of play ----------

const ZONES: FieldZone[] = ['LL', 'LF', 'LC', 'CF', 'RC', 'RF', 'RL'];
const ALL_BASES: Bases[] = Array.from({ length: 8 }, (_, i) => [
  Boolean(i & 1),
  Boolean(i & 2),
  Boolean(i & 4),
]);
const bottomOf = (more: Partial<GameState> = {}) => midGame(1, 'bottom', [0], [0], more);

describe('kinds of hit', () => {
  it('weights the kinds of each hit so they add up to one', () => {
    for (const hit of Object.keys(HIT_KINDS) as Hit[]) {
      const total = HIT_KINDS[hit].reduce((n, k) => n + k.weight, 0);
      expect(total).toBeCloseTo(1, 9);
      for (const k of HIT_KINDS[hit]) expect(hitOfKind(k.kind)).toBe(hit);
    }
  });

  it('picks every kind of every hit across the range of the random number', () => {
    for (const hit of Object.keys(HIT_KINDS) as Hit[]) {
      const seen = new Set<HitKind>();
      for (let r = 0; r < 1; r += 0.005) seen.add(pickHitKind(hit, r));
      expect([...seen].sort()).toEqual(HIT_KINDS[hit].map((k) => k.kind).sort());
      expect(pickHitKind(hit, 0)).toBe(HIT_KINDS[hit][0].kind);
      expect(pickHitKind(hit, 0.9999999)).toBe(HIT_KINDS[hit].at(-1)!.kind);
    }
  });

  it('names a speech line, a banner word and a subtitle for every kind', () => {
    for (const kind of ALL_HIT_KINDS) {
      expect(hitKindSpeech(kind).length).toBeGreaterThan(5);
      expect(hitKindWord(kind).length).toBeGreaterThan(3);
      for (const zone of ZONES) expect(hitSubtitle(kind, zone, '3B').length).toBeGreaterThan(5);
    }
    expect(hitKindWord('single-bloop')).toBe('bloop single');
    expect(rivalHitTitle(TEAMS[0], hitKindWord('single-bloop'))).toBe('Mud Hens bloop single!');
    expect(hitSubtitle('homer-moonshot', 'CF')).toBe('A towering moonshot');
  });

  it('splits the field into zones by angle', () => {
    const z = (d: number) => zoneOf((d * Math.PI) / 180);
    expect([-45, -36.5, -30, -22.5, -15, -7.5, 0, 7.5, 15, 22.5, 30, 36.5, 45].map(z)).toEqual([
      'LL',
      'LL',
      'LF',
      'LF',
      'LC',
      'LC',
      'CF',
      'RC',
      'RC',
      'RF',
      'RF',
      'RL',
      'RL',
    ]);
    expect(ZONES.filter(isRightSide)).toEqual(['RC', 'RF', 'RL']);
  });
});

describe('realistic advancing on a hit', () => {
  const play = (kind: HitKind, zone: FieldZone, bases: Bases) => advanceOnHit(bases, kind, zone);
  const to = (result: ReturnType<typeof advanceOnHit>, from: number) =>
    result.moves.find((m) => m.from === from)?.to;

  it('gives the grounder and the liner an extra base from second, and from first on the right', () => {
    for (const kind of ['single-grounder', 'single-liner'] as const) {
      const left = play(kind, 'LF', [true, true, false]);
      expect(to(left, 1)).toBe(2);
      expect(to(left, 2)).toBe(4);
      expect(left.runs).toBe(1);
      const right = play(kind, 'RF', [true, false, false]);
      expect(to(right, 1)).toBe(3);
      expect(right.bases).toEqual([true, false, true]);
    }
  });

  it('moves runners only as far as forced on a chopper and a bloop', () => {
    for (const kind of ['single-chopper', 'single-bloop'] as const) {
      for (const zone of ZONES) {
        expect(play(kind, zone, [true, true, false]).moves).toEqual(
          advance([true, true, false], 1).moves,
        );
        expect(play(kind, zone, [true, false, true]).moves).toEqual(
          advance([true, false, true], 1).moves,
        );
      }
    }
  });

  it('sends a runner on first home on a double, but to third on a carom off the wall', () => {
    for (const kind of ['double-gap', 'double-line'] as const) {
      expect(to(play(kind, 'LC', [true, false, false]), 1)).toBe(4);
    }
    const wall = play('double-wall', 'CF', [true, false, false]);
    expect(to(wall, 1)).toBe(3);
    expect(to(play('double-wall', 'CF', [false, true, false]), 2)).toBe(4);
  });

  it('scores everybody on a triple and a home run', () => {
    for (const kind of ['triple-corner', 'triple-gap', 'homer-liner'] as const) {
      const r = play(kind, 'CF', [true, true, true]);
      expect(r.runs).toBe(kind.startsWith('homer') ? 4 : 3);
      expect(r.moves.filter((m) => m.from > 0).every((m) => m.to === 4)).toBe(true);
    }
    expect(play('triple-gap', 'CF', EMPTY_BASES).bases).toEqual([false, false, true]);
  });

  it('lists the lead runner first and the batter last', () => {
    const r = play('double-gap', 'RC', [true, true, true]);
    expect(r.moves.map((m) => m.from)).toEqual([3, 2, 1, 0]);
  });

  it('always takes the batter exactly as far as the hit, never past the runner ahead, and never short of the force', () => {
    for (const bases of ALL_BASES) {
      for (const kind of ALL_HIT_KINDS) {
        for (const zone of ZONES) {
          const result = advanceOnHit(bases, kind, zone);
          const count = BASES_FOR[hitOfKind(kind)];
          const forced = advance(bases, count);
          const batter = result.moves.find((m) => m.from === 0)!;
          expect(batter.to).toBe(Math.min(count, 4));
          expect(result.runs).toBeGreaterThanOrEqual(forced.runs);
          const finals: number[] = [];
          for (const m of result.moves) {
            const least = forced.moves.find((f) => f.from === m.from)!.to;
            expect(m.to).toBeGreaterThanOrEqual(least);
            expect(m.to).toBeGreaterThan(m.from);
            if (m.to < 4) finals.push(m.to);
          }
          // Nobody shares a base, and the bases say who is where.
          expect(new Set(finals).size).toBe(finals.length);
          expect(result.bases.filter(Boolean)).toHaveLength(finals.length);
          for (const f of finals) expect(result.bases[f - 1]).toBe(true);
          expect(result.runs).toBe(result.moves.filter((m) => m.to >= 4).length);
        }
      }
    }
  });

  it('uses the extra bases in applyHit when told the play, and the forced ones when not', () => {
    const s = midGame(1, 'top', [0], [], { bases: [false, true, false] });
    expect(applyHit(s, 'single').runs).toBe(0);
    expect(applyHit(s, 'single', { kind: 'single-liner', zone: 'LF' }).runs).toBe(1);
    expect(applyHit(s, 'single', { kind: 'single-bloop', zone: 'LF' }).runs).toBe(0);
  });

  it('stops the mercy rule and the walk-off counting runs that are run', () => {
    const s = midGame(1, 'top', [3], [], { bases: [true, true, false], runs: 3 });
    const r = applyHit(s, 'single', { kind: 'single-grounder', zone: 'RF' });
    expect(r.moves.filter((m) => m.to >= 4)).toHaveLength(1);
    expect(r.runs).toBe(1);
    const mercy = applyHit(
      midGame(1, 'top', [4], [], { bases: [true, true, true], runs: 4 }),
      'double',
      { kind: 'double-gap', zone: 'LC' },
    );
    expect(mercy.runs).toBe(1);
    expect(halfOver(mercy.state)).toBe('mercy');
    const walk = applyHit(
      midGame(6, 'bottom', [0, 0, 0, 0, 0, 2], [0, 0, 0, 0, 0, 0], { bases: [true, true, false] }),
      'single',
      { kind: 'single-liner', zone: 'RF' },
    );
    expect(walk.runs).toBe(1);
    expect(walk.state.over).toBe(false);
    const win = applyHit(
      midGame(6, 'bottom', [0, 0, 0, 0, 0, 1], [0, 0, 0, 0, 0, 0], { bases: [true, true, false] }),
      'double',
      { kind: 'double-gap', zone: 'RF' },
    );
    expect(win.state).toMatchObject({ over: true, winner: 'them', walkOff: true });
    expect(win.runs).toBe(2);
  });
});

describe('outs when we pitch', () => {
  const call = (kind: OutKind, zone: FieldZone = 'CF', fielder: Position = 'CF'): OutCall => ({
    kind,
    fielder,
    zone,
  });
  const bases = (...on: number[]): Bases => [on.includes(1), on.includes(2), on.includes(3)];

  it('weights every pick so they add up to one', () => {
    for (const list of [AIR_OUTS, LINER_FIELDERS, DOUBLE_PLAYS, GROUND_OUTS]) {
      expect(list.reduce((n, item) => n + item.weight, 0)).toBeCloseTo(1, 9);
    }
  });

  it('picks every kind of out across the random numbers', () => {
    const seen = new Set<OutKind>();
    const sequence = (values: number[]) => {
      let i = 0;
      return () => values[i++ % values.length];
    };
    for (let r = 0; r < 1; r += 0.01) {
      seen.add(pickOut('popout', 0.3, bottomOf(), sequence([r, 0.5, 0.5, 0.5])).kind);
      seen.add(pickOut('groundout', 0.9, bottomOf(), sequence([r, 0.5])).kind);
      seen.add(pickOut('groundout', 0.6, bottomOf({ bases: bases(1) }), sequence([r, 0.5])).kind);
      seen.add(
        pickOut('groundout', 0.9, bottomOf({ bases: bases(1), outs: 2 }), sequence([0.1, r])).kind,
      );
    }
    expect([...seen].sort()).toEqual([...ALL_OUT_KINDS].sort());
  });

  it('picks a fielder who makes sense for each kind', () => {
    for (let r = 0; r < 1; r += 0.013) {
      const rnd = () => (r += 0.37) % 1;
      const air = pickOut('popout', 0.2, bottomOf(), rnd);
      if (air.kind === 'pop') expect(['1B', '2B', 'SS', '3B']).toContain(air.fielder);
      if (air.kind === 'foul-pop') expect(air.fielder).toBe('C');
      if (air.kind === 'fly' || air.kind === 'diving')
        expect(['LF', 'CF', 'RF']).toContain(air.fielder);
      if (air.kind === 'liner') expect(['3B', 'SS', '2B', '1B', 'P']).toContain(air.fielder);
      const ground = pickOut('groundout', 0.9, bottomOf(), rnd);
      expect(ground.kind).toBe('ground');
      expect(ground.chain).toBeTruthy();
      const first = ground.chain![0];
      expect({ '1': 'P', '3': '1B', '4': '2B', '5': '3B', '6': 'SS' }[first]).toBe(ground.fielder);
    }
  });

  it('turns a double play only with a runner on first, fewer than two outs and a quick answer', () => {
    const quick = (state: GameState, seconds: number) => {
      const kinds = new Set<OutKind>();
      for (let r = 0; r < 1; r += 0.05)
        kinds.add(pickOut('groundout', seconds, state, () => r).kind);
      return kinds;
    };
    expect(quick(bottomOf({ bases: bases(1) }), 0.6).has('double-play')).toBe(true);
    expect(quick(bottomOf({ bases: bases(1, 2) }), 0.74).has('double-play')).toBe(true);
    expect(quick(bottomOf({ bases: bases(1) }), DP_UNDER_SECONDS).has('double-play')).toBe(false);
    expect(quick(bottomOf({ bases: bases(1) }), 0.9).has('double-play')).toBe(false);
    expect(quick(bottomOf({ bases: bases(2) }), 0.6).has('double-play')).toBe(false);
    expect(quick(bottomOf({ bases: bases(1), outs: 2 }), 0.6).has('double-play')).toBe(false);
    expect(quick(bottomOf({ bases: bases(1), outs: 2 }), 0.6).has('force-second')).toBe(true);
    expect(quick(bottomOf({ bases: bases(1), outs: 1 }), 0.9).has('force-second')).toBe(false);
  });

  it('holds the runners on a pop, a foul pop, a line out and a diving catch', () => {
    for (const kind of ['pop', 'foul-pop', 'liner', 'diving'] as const) {
      const r = applyOut(bottomOf({ bases: bases(1, 2, 3) }), call(kind));
      expect(r.state.outs).toBe(1);
      expect(r.state.bases).toEqual(bases(1, 2, 3));
      expect(r).toMatchObject({ runs: 0, retired: [0], sacFly: false, out: true, moves: [] });
    }
  });

  it('scores the runner from third on a fly ball with fewer than two outs', () => {
    for (const outs of [0, 1]) {
      const r = applyOut(bottomOf({ bases: bases(3), outs }), call('fly'));
      expect(r).toMatchObject({ runs: 1, sacFly: true });
      expect(r.state.bases).toEqual(EMPTY_BASES);
      expect(r.state.outs).toBe(outs + 1);
      expect(r.moves).toEqual([{ from: 3, to: 4 }]);
    }
    const third = applyOut(bottomOf({ bases: bases(3), outs: 2 }), call('fly'));
    expect(third).toMatchObject({ runs: 0, sacFly: false });
    expect(third.state.outs).toBe(3);
  });

  it('tags the runner from second to third on a deep fly, if third is free', () => {
    const deep = applyOut(bottomOf({ bases: bases(2) }), call('fly', 'RF'));
    expect(deep.state.bases).toEqual(bases(3));
    expect(deep.moves).toEqual([{ from: 2, to: 3 }]);
    const shallow = applyOut(bottomOf({ bases: bases(2) }), call('fly', 'LF'));
    expect(shallow.state.bases).toEqual(bases(2));
    const both = applyOut(bottomOf({ bases: bases(2, 3) }), call('fly', 'CF'));
    expect(both.state.bases).toEqual(bases(3));
    expect(both.runs).toBe(1);
    expect(applyOut(bottomOf({ bases: bases(1) }), call('fly', 'CF')).state.bases).toEqual(
      bases(1),
    );
  });

  it('moves runners up one base on a ground out, into free bases, lead first', () => {
    const r = applyOut(bottomOf({ bases: bases(1, 2, 3) }), call('ground', 'LC', 'SS'));
    expect(r.runs).toBe(1);
    expect(r.state.bases).toEqual(bases(2, 3));
    // First moved to second only because second emptied when its runner moved to third.
    expect(r.moves).toEqual([
      { from: 3, to: 4 },
      { from: 2, to: 3 },
      { from: 1, to: 2 },
    ]);
    expect(applyOut(bottomOf({ bases: bases(2) }), call('ground')).state.bases).toEqual(bases(3));
    expect(applyOut(bottomOf({ bases: bases(1) }), call('ground')).state.bases).toEqual(bases(2));
  });

  it('keeps the infield in: nobody moves from third on a grounder with first empty', () => {
    for (const set of [bases(3), bases(2, 3)]) {
      const r = applyOut(bottomOf({ bases: set }), call('ground'));
      expect(r.runs).toBe(set[1] ? 0 : 0);
      if (!set[0] && set[2]) {
        // Third is on, first is empty: infield in (a runner on second moves up only behind it).
        expect(r.state.bases[2]).toBe(true);
      }
    }
    const inIn = applyOut(bottomOf({ bases: bases(3) }), call('ground'));
    expect(inIn).toMatchObject({ runs: 0, moves: [] });
    expect(inIn.state.bases).toEqual(bases(3));
    // With first on as well, the runner from third scores.
    expect(applyOut(bottomOf({ bases: bases(1, 3) }), call('ground')).runs).toBe(1);
  });

  it('does not move anybody, or score, on a ground out that is the third out', () => {
    const r = applyOut(bottomOf({ bases: bases(1, 3), outs: 2 }), call('ground'));
    expect(r).toMatchObject({ runs: 0, moves: [] });
    expect(r.state.outs).toBe(3);
  });

  it('puts out the runner from first and the batter on a double play, in that order', () => {
    const r = applyOut(bottomOf({ bases: bases(1, 3) }), call('double-play', 'LC', 'SS'));
    expect(r.state.outs).toBe(2);
    expect(r.retired).toEqual([1, 0]);
    expect(r.runs).toBe(1);
    expect(r.state.bases).toEqual(EMPTY_BASES);
    const moved = applyOut(bottomOf({ bases: bases(1, 2) }), call('double-play'));
    expect(moved.state.bases).toEqual(bases(3));
  });

  it('scores no run on a double play that is the third out', () => {
    const r = applyOut(bottomOf({ bases: bases(1, 3), outs: 1 }), call('double-play'));
    expect(r.state.outs).toBe(3);
    expect(r).toMatchObject({ runs: 0, moves: [], retired: [1, 0] });
    expect(halfOver(r.state)).toBe('outs');
  });

  it('forces the runner at second and lets the batter take first', () => {
    const r = applyOut(bottomOf({ bases: bases(1), outs: 2 }), call('force-second', 'LC', 'SS'));
    expect(r.retired).toEqual([1]);
    expect(r.out).toBe(false);
    expect(r.state.outs).toBe(3);
    expect(r.runs).toBe(0);
    const early = applyOut(bottomOf({ bases: bases(1, 2, 3), outs: 0 }), call('force-second'));
    expect(early.state.outs).toBe(1);
    expect(early.runs).toBe(1);
    expect(early.state.bases).toEqual(bases(1, 3));
  });

  it('steps up the next batter and clears the strikes, whatever the out', () => {
    for (const kind of ALL_OUT_KINDS) {
      const r = applyOut(bottomOf({ strikes: 2 }), call(kind));
      expect(r.state.strikes).toBe(0);
      expect(r.state.rivalBatter).toBe(2);
    }
  });

  it('ends the game on a sacrifice fly that wins it in the bottom of the 6th', () => {
    const s = midGame(6, 'bottom', [0, 0, 0, 0, 0, 1], [0, 0, 0, 0, 0, 0], {
      bases: bases(3),
      outs: 1,
    });
    const r = applyOut(s, call('fly'));
    expect(r.state.over).toBe(false);
    const tied = totals(r.state);
    expect(tied).toEqual({ us: 1, them: 1 });
    const ahead = applyOut({ ...s, us: [0, 0, 0, 0, 0, 0] }, call('fly'));
    expect(ahead.state).toMatchObject({ over: true, winner: 'them', walkOff: true });
    expect(ahead.sacFly).toBe(true);
  });

  it('counts a sacrifice fly towards the mercy rule', () => {
    const s = midGame(1, 'bottom', [0], [4], { bases: bases(3), runs: 4 });
    const r = applyOut(s, call('fly'));
    expect(r.runs).toBe(1);
    expect(halfOver(r.state)).toBe('mercy');
  });

  it('says a line and a word for every out', () => {
    for (const kind of ALL_OUT_KINDS) {
      expect(outSpeech(call(kind), false).length).toBeGreaterThan(5);
      expect(outPopText(call(kind)).length).toBeGreaterThan(2);
    }
    expect(outSpeech(call('fly'), true)).toBe('Sacrifice fly! The run scores.');
    expect(outSpeech(call('fly'), false)).toBe('Fly ball! Caught for the out!');
    expect(outSpeech(call('double-play'), false)).toBe('Double play!');
    expect(outPopText(call('fly'), true)).toBe('Out! Run scores');
    expect(outPopText(call('diving'))).toBe('Diving catch!');
  });
});

describe('batted ball paths', () => {
  const rollSets = [0, 0.13, 0.5, 0.87, 1 - 1e-9].flatMap((side) =>
    [0, 0.5, 1 - 1e-9].flatMap((a) => [0, 0.5, 1 - 1e-9].map((b) => ({ side, a, b }))),
  );
  const KINDS = [...ALL_HIT_KINDS, ...ALL_OUT_KINDS];
  const spots: Record<string, Vec> = {
    pop: POSITION_SPOTS.SS,
    fly: POSITION_SPOTS.RF,
    liner: POSITION_SPOTS['3B'],
    diving: POSITION_SPOTS.LF,
    ground: POSITION_SPOTS['2B'],
    'double-play': POSITION_SPOTS.SS,
    'force-second': POSITION_SPOTS.P,
  };

  it('starts every path at the bat and ends at rest', () => {
    for (const kind of KINDS) {
      for (const rolls of rollSets) {
        const ball = planBatted(kind, rolls, spots[kind]);
        expect(ball.position(0, at(0, 0, 0))).toMatchObject(CONTACT);
        expect(ball.end).toBeGreaterThan(0);
        expect(ball.airTime).toBeGreaterThan(0);
        expect(ball.airTime).toBeLessThanOrEqual(ball.end + 1e-9);
        const end = ball.position(ball.end, at(0, 0, 0));
        expect(end.x).toBeCloseTo(ball.rest.x, 6);
        expect(end.z).toBeCloseTo(ball.rest.z, 6);
        const later = ball.position(ball.end + 5, at(0, 0, 0));
        expect(later).toEqual(ball.rest);
        // The path is continuous and never goes below the ground.
        const p = at(0, 0, 0);
        let last = { ...CONTACT };
        for (let t = 0; t <= ball.end; t += 0.02) {
          ball.position(t, p);
          expect(p.y).toBeGreaterThanOrEqual(BALL_RADIUS - 0.05);
          expect(Math.hypot(p.x - last.x, p.y - last.y, p.z - last.z)).toBeLessThan(2.5);
          last = { ...p };
        }
        expect(ball.zone).toBe(zoneOf(ball.theta));
      }
    }
  });

  it('clears the wall on a home run by the margin each kind promises', () => {
    const margins = { 'homer-liner': 0.4, 'homer-moonshot': 3, 'homer-scraper': 0.9 } as const;
    for (const kind of ['homer-liner', 'homer-moonshot', 'homer-scraper'] as const) {
      for (const rolls of rollSets) {
        const ball = planBatted(kind, rolls);
        expect(ball.overWall).toBe(true);
        expect(ball.firstTouch.what).toBe('stands');
        const rest = Math.hypot(ball.rest.x, ball.rest.z);
        expect(rest).toBeGreaterThan(wallRadius(ball.theta) + 1);
        const out = at(0, 0, 0);
        let height = Infinity;
        for (let t = 0; t <= ball.airTime; t += 0.002) {
          ball.position(t, out);
          if (Math.hypot(out.x, out.z) >= wallRadius(fieldAngle(out))) {
            height = out.y;
            break;
          }
        }
        expect(height).toBeGreaterThanOrEqual(WALL_HEIGHT + margins[kind] - 0.05);
        if (kind === 'homer-scraper') expect(height).toBeLessThan(WALL_HEIGHT + 1.3);
        // The wall is cleared in fair ground.
        expect(Math.abs(ball.theta)).toBeLessThan(FOUL_ANGLE);
      }
    }
  });

  it('keeps every ball that stays in the park in fair ground and inside the wall', () => {
    const inPlay = KINDS.filter((k) => !k.startsWith('homer') && k !== 'foul-pop');
    for (const kind of inPlay) {
      for (const rolls of rollSets) {
        const ball = planBatted(kind, rolls, spots[kind]);
        expect(ball.overWall).toBe(false);
        const out = at(0, 0, 0);
        for (let t = 0; t <= ball.end; t += 0.02) {
          ball.position(t, out);
          expect(isFair(out), `${kind} ${JSON.stringify(rolls)} ${t} ${JSON.stringify(out)}`).toBe(
            true,
          );
          expect(Math.hypot(out.x, out.z)).toBeLessThanOrEqual(wallRadius(fieldAngle(out)) + 1e-6);
        }
        expect(Math.hypot(ball.rest.x, ball.rest.z)).toBeLessThan(wallRadius(ball.theta));
      }
    }
  });

  it('hits the wall below its top on a double off the wall, and caroms back', () => {
    for (const rolls of rollSets) {
      const ball = planBatted('double-wall', rolls);
      expect(ball.firstTouch.what).toBe('wall');
      expect(ball.firstTouch.p.y).toBeGreaterThanOrEqual(1.4 - 1e-9);
      expect(ball.firstTouch.p.y).toBeLessThanOrEqual(2.2 + 1e-9);
      expect(ball.firstTouch.p.y).toBeLessThan(WALL_HEIGHT);
      const at0 = ball.firstTouch.p;
      expect(Math.hypot(at0.x, at0.z)).toBeCloseTo(wallRadius(ball.theta), 6);
      const back = wallRadius(ball.theta) - Math.hypot(ball.rest.x, ball.rest.z);
      expect(back).toBeGreaterThan(4);
      expect(back).toBeLessThan(9);
      // It meets the wall at its first touch time, below the top, and not before.
      const out = at(0, 0, 0);
      ball.position(ball.firstTouch.t - 0.001, out);
      expect(Math.hypot(out.x, out.z)).toBeLessThanOrEqual(wallRadius(fieldAngle(out)) + 1e-6);
      expect(out.y).toBeLessThan(WALL_HEIGHT);
    }
  });

  it('puts a foul pop in foul ground behind or beside the plate, and a pop on the infield', () => {
    for (const rolls of rollSets) {
      const foul = planBatted('foul-pop', rolls);
      expect(Math.abs(fieldAngle(foul.rest))).toBeGreaterThan(FOUL_ANGLE);
      expect(foul.rest.z).toBeGreaterThanOrEqual(1);
      expect(foul.rest.z).toBeLessThanOrEqual(3.5);
      expect(foul.rest.y).toBeCloseTo(1.6, 6);
      expect(foul.firstTouch.what).toBe('air-catch');
      const pop = planBatted('pop', rolls, POSITION_SPOTS['2B']);
      expect(
        Math.hypot(pop.rest.x - POSITION_SPOTS['2B'].x, pop.rest.z - POSITION_SPOTS['2B'].z),
      ).toBeLessThan(3);
      expect(pop.rest.y).toBeCloseTo(1.8, 6);
    }
  });

  it('catches a fly near the outfielder and a diving catch low and to his side', () => {
    for (const rolls of rollSets) {
      const fly = planBatted('fly', rolls, POSITION_SPOTS.CF);
      expect(
        Math.hypot(fly.rest.x - POSITION_SPOTS.CF.x, fly.rest.z - POSITION_SPOTS.CF.z),
      ).toBeLessThan(6.5);
      expect(Math.hypot(fly.rest.x, fly.rest.z)).toBeGreaterThanOrEqual(26 - 1e-6);
      expect(Math.hypot(fly.rest.x, fly.rest.z)).toBeLessThanOrEqual(33 + 1e-6);
      expect(fly.rest.y).toBeCloseTo(2, 6);
      const dive = planBatted('diving', rolls, POSITION_SPOTS.CF);
      expect(dive.rest.y).toBeCloseTo(0.3, 6);
      const r = Math.hypot(dive.rest.x, dive.rest.z);
      expect(r).toBeGreaterThanOrEqual(20 - 1e-6);
      expect(r).toBeLessThanOrEqual(24 + 1e-6);
    }
  });

  it('plays a ground ball to the fielder and a comebacker faster than the rest', () => {
    for (const rolls of rollSets) {
      const ground = planBatted('ground', rolls, POSITION_SPOTS.SS);
      expect(
        Math.hypot(ground.rest.x - POSITION_SPOTS.SS.x, ground.rest.z - POSITION_SPOTS.SS.z),
      ).toBeLessThan(3.1);
      expect(ground.end).toBeGreaterThanOrEqual(0.55);
      expect(ground.end).toBeLessThanOrEqual(0.8);
      const dp = planBatted('double-play', rolls, POSITION_SPOTS.SS);
      expect(dp.end).toBeLessThanOrEqual(0.65);
      expect(planBatted('ground', rolls, POSITION_SPOTS.P).end).toBeCloseTo(0.35, 6);
    }
  });

  it('puts the kinds of single where the design says', () => {
    for (const rolls of rollSets) {
      const liner = planBatted('single-liner', rolls);
      expect(Math.hypot(liner.firstTouch.p.x, liner.firstTouch.p.z)).toBeGreaterThan(17.9);
      expect(Math.hypot(liner.firstTouch.p.x, liner.firstTouch.p.z)).toBeLessThan(22.1);
      const bloop = planBatted('single-bloop', rolls);
      expect(bloop.firstTouch.t).toBeCloseTo(1.35, 6);
      const chopper = planBatted('single-chopper', rolls);
      expect(Math.hypot(chopper.firstTouch.p.x, chopper.firstTouch.p.z)).toBeLessThan(2);
      const hole = Math.abs(zoneOf(planBatted('single-grounder', rolls).theta) === 'CF' ? 0 : 30);
      expect([0, 30]).toContain(hole);
    }
    const left = planBatted('single-grounder', { side: 0.1, a: 0.5, b: 0.5 });
    const middle = planBatted('single-grounder', { side: 0.5, a: 0.5, b: 0.5 });
    const right = planBatted('single-grounder', { side: 0.9, a: 0.5, b: 0.5 });
    expect(left.rest.x).toBeLessThan(-5);
    expect(Math.abs(middle.rest.x)).toBeLessThan(2);
    expect(right.rest.x).toBeGreaterThan(5);
  });
});

describe('the play script', () => {
  const rolls = (n: number) => {
    let seed = n * 7919 + 13;
    const next = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    return { side: next(), a: next(), b: next() };
  };
  const inputFor = (
    kind: HitKind,
    r: ReturnType<typeof rolls>,
    mask: number,
    outs = 0,
  ): PlayInput => {
    const ball = planBatted(kind, r);
    const bases: Bases = [Boolean(mask & 1), Boolean(mask & 2), Boolean(mask & 4)];
    const adv = advanceOnHit(bases, kind, ball.zone);
    return {
      ball,
      moves: adv.moves,
      retired: [],
      bases,
      outs,
      call: kind,
      spots: POSITION_SPOTS,
      leads: [null, BASE_SPOTS[1], BASE_SPOTS[2], BASE_SPOTS[3]],
      runs: adv.runs,
    };
  };

  it('breaks no rule for any hit, base state, outs or seed', () => {
    for (const kind of ALL_HIT_KINDS) {
      for (let seed = 0; seed < 20; seed++) {
        const r = rolls(seed);
        for (let mask = 0; mask < 8; mask++) {
          for (const outs of [0, 1, 2]) {
            const input = inputFor(kind, r, mask, outs);
            const script = planPlay(input);
            expect(checkScript(script, input), `${kind} ${seed} ${mask}`).toEqual([]);
          }
        }
      }
    }
  });

  it('plans the same play twice for the same input', () => {
    const input = inputFor('double-gap', rolls(3), 3);
    expect(JSON.stringify(planPlay(input).legs)).toBe(JSON.stringify(planPlay(input).legs));
  });

  it('keeps a play within five seconds unless it is a home run', () => {
    for (const kind of ALL_HIT_KINDS.filter((k) => !k.startsWith('homer'))) {
      for (let mask = 0; mask < 8; mask++) {
        expect(planPlay(inputFor(kind, rolls(5), mask)).duration).toBeLessThanOrEqual(5);
      }
    }
  });

  it('notices a broken script', () => {
    const input = inputFor('single-liner', rolls(1), 1);
    const script = planPlay(input);
    script.legs[1] = { ...script.legs[1], start: script.legs[1].start + 1 };
    expect(checkScript(script, input).length).toBeGreaterThan(0);
  });

  const assign = (kind: HitKind, r: { side: number; a: number; b: number }, mask: number) => {
    const input = inputFor(kind, r, mask);
    const f = pickFielder(kind, input.ball);
    const target =
      Math.max(...input.moves.map((m) => m.to)) >= 4
        ? 4
        : Math.max(...input.moves.map((m) => m.to), 2);
    return {
      input,
      a: assignDefense({
        kind,
        theta: input.ball.theta,
        zone: input.ball.zone,
        fielder: f.fielder,
        pickup: f.p,
        target: kind === 'single-chopper' ? 1 : target,
        moves: input.moves,
      }),
      fielder: f.fielder,
    };
  };

  it('plays a single to right with a runner on first the textbook way', () => {
    const { a, fielder } = assign('single-liner', { side: 0.95, a: 1, b: 0.5 }, 1);
    expect(fielder).toBe('RF');
    expect(a.SS.role).toBe('cutoff');
    expect(a['3B']).toMatchObject({ role: 'cover', base: 3 });
    expect(a.P).toMatchObject({ role: 'backupBase', base: 3 });
    expect(a.LF).toMatchObject({ role: 'backupBase', base: 3 });
    expect(a.CF.role).toBe('backupFielder');
  });

  it('plays a double to left-centre with the shortstop relaying and second baseman trailing', () => {
    const { a } = assign('double-gap', { side: 0.1, a: 0.5, b: 0.5 }, 1);
    expect(a.SS.role).toBe('relay');
    expect(a['2B'].role).toBe('trail');
    expect(a['1B']).toMatchObject({ role: 'cover', base: 2 });
    expect(a.C).toMatchObject({ role: 'cover', base: 4 });
  });

  it('plays a chopper to third with first covered and the catcher and right fielder backing up', () => {
    const { a, fielder } = assign('single-chopper', { side: 0.1, a: 0.5, b: 0.5 }, 0);
    expect(fielder).toBe('3B');
    expect(a['1B']).toMatchObject({ role: 'cover', base: 1 });
    expect(a.C).toMatchObject({ role: 'backupBase', base: 1 });
    expect(a.RF).toMatchObject({ role: 'backupBase', base: 1 });
  });

  it('rounds the bases in curves close to the base path', () => {
    for (let from = 0; from < 4; from++) {
      for (let to = from + 1; to <= 4; to++) {
        const { points, baseAt } = roundRouteInfo(from, to);
        expect(roundRoute(from, to)).toEqual(points);
        for (const p of points) {
          let nearest = Infinity;
          for (let d = 0; d <= LAP; d += 0.1)
            nearest = Math.min(
              nearest,
              Math.hypot(
                p.x - basePathPoint(d, at(0, 0, 0)).x,
                p.z - basePathPoint(d, at(0, 0, 0)).z,
              ),
            );
          expect(nearest).toBeLessThan(1.5);
        }
        for (let b = from + 1; b <= to; b++) {
          const spot = BASE_SPOTS[b % 4];
          const p = points[baseAt[b]];
          expect(Math.hypot(p.x - spot.x, p.z - spot.z)).toBeLessThan(0.3);
        }
      }
    }
  });
});

describe('the mound and the camera frame', () => {
  it('raises the ground on the mound and slopes it to the flat', () => {
    expect(groundHeight(MOUND.x, MOUND.z)).toBe(MOUND_HEIGHT);
    expect(groundHeight(MOUND.x + 1, MOUND.z)).toBe(MOUND_HEIGHT);
    expect(groundHeight(MOUND.x + 2.4, MOUND.z)).toBe(0);
    expect(groundHeight(MOUND.x + 1.7, MOUND.z)).toBeCloseTo(MOUND_HEIGHT / 2, 6);
    expect(groundHeight(10, -3)).toBe(0);
  });

  const SCREENS: [number, number][] = [
    [390, 844],
    [844, 390],
    [1024, 768],
    [1366, 1024],
  ];
  const plays: Vec[][] = [
    [at(14, 1.3, -22), at(-4, 1.3, -14), at(-8.5, 0, -8.5)],
    [at(-20, 1, -30), at(-10, 1, -22), at(0, 0, 0)],
    [at(-8, 1.2, -9), at(0, 1.2, -17), at(8.5, 0, -8.5)],
  ];
  it.each(SCREENS)('keeps the points of a play inside the band at %ix%i', (w, h) => {
    const fit = fitView(w, h);
    const band = hitBand(w, h);
    const home = homeView(w / h);
    for (const points of plays) {
      const cam = at(0, 0, 0);
      const look = at(0, 0, 0);
      followGoal(points[0], cam, look, home);
      const shot = frameAction(points, cam, fit.fov, w, h, band);
      expect(shot.fov).toBeGreaterThanOrEqual(fit.fov);
      expect(shot.fov).toBeLessThanOrEqual(FRAME_MAX_FOV);
      const lift = (band.top + band.bottom) / 2 - h / 2;
      // On a narrow screen the first two (the ball and its receiver) win over the rest.
      for (const p of w < 800 ? points.slice(0, 2) : points) {
        const s = project(p, cam, shot.look, shot.fov, w, h);
        expect(s.y + lift).toBeGreaterThanOrEqual(band.top + 27);
        expect(s.y + lift).toBeLessThanOrEqual(band.bottom - 27);
        expect(s.x).toBeGreaterThanOrEqual(27);
        expect(s.x).toBeLessThanOrEqual(w - 27);
      }
    }
  });

  it('keeps the catcher mitt on the glove spot after he goes home', () => {
    const catcher = createCatcher();
    catcher.update(0.016, 0);
    catcher.run(at(3, 0, 4), 8);
    for (let i = 0; i < 60; i++) catcher.update(1 / 30, i / 30);
    catcher.goHome(8);
    for (let i = 0; i < 120; i++) catcher.update(1 / 30, 3 + i / 30);
    const mitt = catcher.mittPosition(new Vector3());
    expect(mitt.x).toBeCloseTo(GLOVE.x, 1);
    expect(mitt.z).toBeCloseTo(GLOVE.z, 1);
  });
});

describe('the play script for outs', () => {
  const AIR: [OutKind, Position[]][] = [
    ['pop', ['1B', '2B', 'SS', '3B']],
    ['foul-pop', ['C']],
    ['fly', ['LF', 'CF', 'RF']],
    ['liner', ['3B', 'SS', '2B', '1B', 'P']],
    ['diving', ['LF', 'CF', 'RF']],
  ];
  const GROUND: [OutKind, string, Position][] = [
    ['ground', '6-3', 'SS'],
    ['ground', '4-3', '2B'],
    ['ground', '5-3', '3B'],
    ['ground', '3U', '1B'],
    ['ground', '3-1', '1B'],
    ['ground', '1-3', 'P'],
    ['double-play', '6-4-3', 'SS'],
    ['double-play', '4-6-3', '2B'],
    ['double-play', '5-4-3', '3B'],
    ['double-play', '1-6-3', 'P'],
    ['force-second', '6-4', 'SS'],
    ['force-second', '4-6', '2B'],
    ['force-second', '5-4', '3B'],
  ];
  const calls: OutCall[] = [
    ...AIR.flatMap(([kind, fs]) =>
      fs.map((fielder) => ({ kind, fielder, zone: 'CF' as FieldZone })),
    ),
    ...GROUND.map(([kind, chain, fielder]) => ({ kind, fielder, chain, zone: 'CF' as FieldZone })),
  ];
  const planFor = (call: OutCall, seed: number, mask: number, outs: number) => {
    let n = seed * 7919 + 13;
    const next = () => (n = (n * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const ball = planBatted(
      call.kind,
      { side: next(), a: next(), b: next() },
      POSITION_SPOTS[call.fielder],
    );
    const real = { ...call, zone: ball.zone };
    const bases: Bases = [Boolean(mask & 1), Boolean(mask & 2), Boolean(mask & 4)];
    const state = midGame(1, 'bottom', [0], [0], { outs, bases });
    const result = applyOut(state, real);
    const input: PlayInput = {
      ball,
      moves: result.moves,
      retired: result.retired,
      bases,
      outs,
      call: real,
      spots: POSITION_SPOTS,
      leads: [null, BASE_SPOTS[1], BASE_SPOTS[2], BASE_SPOTS[3]],
      runs: result.runs,
    };
    return { input, script: planPlay(input), result };
  };

  it('breaks no rule for any out, fielder, base state, outs or seed', () => {
    for (const call of calls) {
      for (let seed = 0; seed < 12; seed++) {
        for (let mask = 0; mask < 8; mask++) {
          // A double play and a force need a runner on first.
          if ((call.kind === 'double-play' || call.kind === 'force-second') && !(mask & 1))
            continue;
          for (const outs of [0, 1, 2]) {
            const { input, script } = planFor(call, seed, mask, outs);
            expect(
              checkScript(script, input),
              `${call.kind} ${call.chain ?? call.fielder} ${seed} ${mask} ${outs}`,
            ).toEqual([]);
          }
        }
      }
    }
  });

  it('puts the runner at second out before the batter at first on a double play', () => {
    const call = calls.find((c) => c.chain === '6-4-3')!;
    const { script } = planFor(call, 1, 1, 0);
    const outs = script.events.filter((e) => e.type === 'out');
    expect(outs.map((e) => (e.type === 'out' ? e.who : -1))).toEqual([1, 0]);
    expect(outs[0].at).toBeLessThan(outs[1].at);
    expect(script.runners.find((r) => r.from === 1)!.finish).toBe('out');
  });

  it('scores the run on a sacrifice fly after the catch', () => {
    const call = calls.find((c) => c.kind === 'fly' && c.fielder === 'CF')!;
    const { script, result } = planFor(call, 2, 4, 0);
    expect(result.sacFly).toBe(true);
    const run = script.events.find((e) => e.type === 'run')!;
    const catches = script.events.filter((e) => e.type === 'catch');
    expect(run.at).toBeGreaterThanOrEqual(catches[0].at);
    expect(script.runners.find((r) => r.from === 3)!.holdAt!.until).toBeCloseTo(catches[0].at, 6);
  });

  it('has the pitcher cover first on a 3-1 and the catcher toss his mask on a foul pop', () => {
    const covering = planFor(
      calls.find((c) => c.chain === '3-1')!,
      1,
      0,
      0,
    ).script;
    const throwLeg = covering.legs.find((l) => l.kind === 'throw');
    expect(throwLeg && throwLeg.kind === 'throw' ? throwLeg.to_ : '').toBe('P');
    const foul = planFor(
      calls.find((c) => c.kind === 'foul-pop')!,
      1,
      0,
      0,
    ).script;
    expect(foul.fielders.C.some((a) => a.do === 'pose' && a.pose === 'mask-off')).toBe(true);
    const dive = planFor(
      calls.find((c) => c.kind === 'diving')!,
      1,
      0,
      0,
    ).script;
    expect(dive.fielders[dive.fielder].some((a) => a.do === 'pose' && a.pose === 'dive')).toBe(
      true,
    );
  });
});

describe('the swoop to the wide view', () => {
  it('rises and pulls back from the batting view', () => {
    for (const aspect of [0.46, 1, 1.7]) {
      const home = homeView(aspect);
      const wide = wideView(aspect);
      expect(wide.cam.y).toBeCloseTo(home.cam.y + 5, 6);
      expect(wide.cam.z).toBeCloseTo(home.cam.z + 3, 6);
      expect(wide.look).toEqual(home.look);
    }
  });

  it('starts at the mound view, ends at the wide view and flies higher in between', () => {
    const from = moundView(0.5).cam;
    const to = wideView(0.5).cam;
    for (const [s, want] of [
      [0, from],
      [1, to],
    ] as const) {
      const p = swoopPosition(from, to, s);
      expect(p.x).toBeCloseTo(want.x, 9);
      expect(p.y).toBeCloseTo(want.y, 9);
      expect(p.z).toBeCloseTo(want.z, 9);
    }
    const mid = swoopPosition(from, to, 0.5);
    expect(mid.y).toBeGreaterThan(Math.max(from.y, to.y) + 3);
    for (let s = 0.1; s < 1; s += 0.1) {
      expect(swoopPosition(from, to, s).y).toBeGreaterThan(Math.min(from.y, to.y));
    }
    expect(SWOOP_SECONDS).toBeCloseTo(0.7, 6);
  });
});

describe('positioning for the situation', () => {
  const on = (...bases: number[]): Bases => [
    bases.includes(1),
    bases.includes(2),
    bases.includes(3),
  ];
  const normal = POSITION_SPOTS;

  it('stands in the normal spots with nobody on', () => {
    expect(fieldingSpots(on(), 0)).toEqual(normal);
    expect(fieldingSpots(on(2), 1)).toEqual(normal);
  });

  it('plays double-play depth with a runner on first and fewer than two out', () => {
    const spots = fieldingSpots(on(1, 2), 1);
    expect(spots.SS).toEqual({ x: -3.6, y: 0, z: -13.6 });
    expect(spots['2B']).toEqual({ x: 3.2, y: 0, z: -14.2 });
    expect(fieldingSpots(on(1, 2), 2).SS).toEqual(normal.SS);
  });

  it('has the first baseman hold a runner on first when second is empty', () => {
    expect(fieldingSpots(on(1), 2)['1B']).toEqual({ x: 8.1, y: 0, z: -8.9 });
    expect(fieldingSpots(on(1, 2), 0)['1B']).toEqual(normal['1B']);
  });

  it('brings the infield in with a runner on third, first empty and fewer than two out', () => {
    const spots = fieldingSpots(on(3), 0);
    for (const p of ['2B', 'SS', '3B'] as const) {
      expect(spots[p].x).toBeCloseTo(normal[p].x * 0.75, 6);
      expect(spots[p].z).toBeCloseTo(normal[p].z * 0.75, 6);
    }
    expect(spots['1B'].z).toBeCloseTo(normal['1B'].z * 0.9, 6);
    expect(fieldingSpots(on(3), 2)).toEqual(normal);
    expect(fieldingSpots(on(1, 3), 0)['3B']).toEqual(normal['3B']);
  });

  it('keeps every fielder in fair ground and inside the wall for every base state', () => {
    for (let mask = 0; mask < 8; mask++) {
      for (const outs of [0, 1, 2]) {
        const spots = fieldingSpots(on(...[1, 2, 3].filter((b) => mask & (1 << (b - 1)))), outs);
        for (const p of Object.keys(spots) as Position[]) {
          const spot = spots[p];
          if (p === 'C') continue;
          expect(Math.abs(fieldAngle(spot))).toBeLessThanOrEqual(FOUL_ANGLE + 1e-9);
          expect(Math.hypot(spot.x, spot.z)).toBeLessThan(wallRadius(fieldAngle(spot)));
        }
      }
    }
  });

  it('takes leads a few steps off each base, towards the next', () => {
    for (const base of [1, 2, 3] as const) {
      const lead = leadSpot(base);
      const bag = BASE_SPOTS[base];
      expect(Math.hypot(lead.x - bag.x, lead.z - bag.z)).toBeLessThanOrEqual(3);
      expect(Math.hypot(lead.x - bag.x, lead.z - bag.z)).toBeGreaterThan(1);
    }
    const first = leadSpot(1);
    expect(Math.hypot(first.x - BASE_SPOTS[2].x, first.z - BASE_SPOTS[2].z)).toBeLessThan(
      BASE_SIDE - 1,
    );
    // Off third towards home and a little into foul ground, on the left.
    const third = leadSpot(3);
    expect(third.z).toBeGreaterThan(BASE_SPOTS[3].z);
    expect(third.x).toBeLessThan(BASE_SPOTS[3].x + 1.7);
  });
});

describe('pop-ups over the picture', () => {
  const band = { top: 150, bottom: 700 };
  it('keeps a pop-up where its spot is when that is in the band', () => {
    expect(popPosition({ x: 200, y: 400 }, false, 400, band)).toEqual({ x: 200, y: 400 });
  });
  it('moves one whose spot is off screen, behind the camera or under the HUD to the middle of the band', () => {
    for (const shown of [
      { x: -50, y: 400 },
      { x: 200, y: 20 },
      { x: 200, y: 760 },
      { x: 390, y: 400 },
    ]) {
      expect(popPosition(shown, false, 400, band)).toEqual({ x: 200, y: 425 });
    }
    expect(popPosition({ x: 200, y: 400 }, true, 400, band)).toEqual({ x: 200, y: 425 });
  });
  it('stays left of a card beside the field', () => {
    const p = popPosition({ x: 600, y: 400 }, false, 844, {
      top: 100,
      bottom: 330,
      right: 500,
    });
    expect(p.x).toBeLessThanOrEqual(470);
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
