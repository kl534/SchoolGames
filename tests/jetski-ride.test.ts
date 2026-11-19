// @vitest-environment jsdom
import { Scene, PerspectiveCamera } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseRideDev } from '../src/shared/jetski/dev';

type Frame = (delta: number, elapsed: number) => void;
let frame: Frame | null = null;

// The ride needs a WebGL renderer only to draw: a stand-in with a canvas and the frame callback
// lets the tests step it by hand.
vi.mock('../src/shared/scene', () => ({
  createScene: () => ({
    scene: new Scene(),
    camera: new PerspectiveCamera(52, 1, 0.3, 420),
    renderer: { domElement: document.createElement('canvas'), getPixelRatio: () => 1 },
    onUpdate: (callback: Frame) => {
      frame = callback;
      return () => {};
    },
    start: () => {},
    stop: () => {},
    dispose: () => {},
  }),
}));

const speaks: { text: string; done?: () => void }[] = [];
vi.mock('../src/shared/audio', () => ({
  sfx: new Proxy({}, { get: () => () => {} }),
  speak: (text: string, done?: () => void) => void speaks.push({ text, done }),
  stopSpeaking: () => {},
  unlockAudio: () => {},
  isMuted: () => false,
  setMuted: () => {},
  onMuteChange: () => () => {},
}));

import { createRide, type Ride, type RideDriver, type RideTurn } from '../src/shared/jetski/ride';
import { OUT_OF_SKIS_SPEECH, hitPoints } from '../src/shared/jetski/rules';

interface Spy {
  driver: RideDriver;
  calls: string[];
  turns: RideTurn[];
  finished: { score: number; again: () => void }[];
  resumes: (() => void)[];
  /** What `ending()` and `afterMiss()` answer. */
  ending: { detail: string; wait: boolean; say?: string };
  missWait: boolean;
}

let ride: Ride;
let elapsed = 0;
let spy: Spy;
let container: HTMLElement;

/** Runs `seconds` of game time at 30 frames a second. */
function run(seconds: number): void {
  for (let t = 0; t < seconds - 1e-9; t += 1 / 30) {
    elapsed += 1 / 30;
    frame?.(1 / 30, elapsed);
  }
}

/** Runs until `until()` holds (at most `limit` seconds); returns whether it did. */
function runUntil(until: () => boolean, limit = 60): boolean {
  for (let t = 0; t < limit; t += 1 / 30) {
    if (until()) return true;
    run(1 / 30);
  }
  return until();
}

function makeSpy(): Spy {
  const s: Spy = {
    calls: [],
    turns: [],
    finished: [],
    resumes: [],
    ending: { detail: 'the fact', wait: true },
    missWait: false,
    driver: undefined as unknown as RideDriver,
  };
  s.driver = {
    intro: (go) => {
      s.calls.push('intro');
      s.resumes.push(go);
    },
    beginTurn: (turn) => {
      s.calls.push('beginTurn');
      s.turns.push(turn);
    },
    timeUp: () => void s.calls.push('timeUp'),
    afterMiss: ({ timedOut }) => {
      s.calls.push(`afterMiss:${timedOut}`);
      return { detail: 'missed it', wait: s.missWait };
    },
    ending: () => {
      s.calls.push('ending');
      return s.ending;
    },
    finish: (score, again) => {
      s.calls.push('finish');
      s.finished.push({ score, again });
    },
    cancel: () => void s.calls.push('cancel'),
    dispose: () => {},
  };
  return s;
}

function start(search = '', answers = false): void {
  elapsed = 0;
  frame = null;
  speaks.length = 0;
  spy = makeSpy();
  container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { value: 844 });
  Object.defineProperty(container, 'clientHeight', { value: 390 });
  document.body.appendChild(container);
  ride = createRide(container, {
    avatar: '🦊',
    driver: spy.driver,
    dev: parseRideDev(search),
    highScore: () => 0,
    answers,
  });
}

/** Past the intro and the countdown to the first turn. */
function toFirstTurn(): void {
  spy.resumes[0]();
  expect(runUntil(() => spy.turns.length > 0, 10)).toBe(true);
}

beforeEach(() => {
  document.body.innerHTML = '';
  // jsdom has no 2D canvas; the textures that need one are skipped when there is none.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  window.dispatchEvent(new Event('pagehide'));
});

describe('the ride and its driver', () => {
  it('asks the driver for the intro, then a turn after the countdown', () => {
    start();
    expect(spy.calls).toContain('intro');
    expect(spy.turns).toHaveLength(0);
    toFirstTurn();
    expect(spy.turns[0]).toEqual({ target: 'launcher', tier: 1, piece: 0 });
    expect(ride.phase).toBe('riding');
  });

  it('has no answer grid or sound button when answers is false', () => {
    start('', false);
    expect(ride.hud.buttons).toHaveLength(0);
    expect(ride.hud.hear).toBeNull();
    expect(ride.hud.answers).toBeNull();
    expect(document.querySelector('.sz-answers')).toBeNull();
    expect(document.querySelector('.sz-hear')).toBeNull();
  });

  it('has the answer grid and sound button when answers is true', () => {
    start('', true);
    expect(ride.hud.buttons).toHaveLength(4);
    expect(ride.hud.hear).not.toBeNull();
  });

  it('startClock starts the approach and a right answer rides to the launcher and lands', () => {
    start();
    toFirstTurn();
    ride.startClock(6);
    expect(ride.clockTotal).toBe(6);
    run(1);
    expect(ride.clockLeft).toBeLessThan(6);
    ride.answer(true);
    expect(ride.phase).toBe('turbo');
    expect(runUntil(() => ride.phase === 'stunt')).toBe(true);
    expect(runUntil(() => spy.turns.length === 2)).toBe(true);
    expect(ride.streak).toBe(1);
    expect(ride.score).toBeGreaterThanOrEqual(100);
    expect(spy.calls).not.toContain('afterMiss:false');
  });

  it('multiplies the points of a right answer and the coins by setMultiplier', () => {
    start();
    ride.setMultiplier(7);
    expect(document.querySelector('.sz-multiplier')?.textContent).toBe('×7');
    toFirstTurn();
    ride.startClock(6);
    const left = ride.clockLeft;
    ride.answer(true);
    expect(runUntil(() => spy.turns.length === 2)).toBe(true);
    // The points of the trick, times 7, and any coins (25 each, times 7).
    const trick = hitPoints(left, 6, 1) * 7;
    expect(ride.score).toBeGreaterThanOrEqual(trick);
    expect((ride.score - trick) % (25 * 7)).toBe(0);
  });

  it('shows no multiplier pill unless the game sets one', () => {
    start();
    const pill = document.querySelector('.sz-multiplier');
    expect(pill).not.toBeNull();
    expect((pill as HTMLElement).hidden).toBe(true);
  });

  it('resetStreak lands the trick but sets the streak back to 0', () => {
    start('?streak=4');
    toFirstTurn();
    ride.startClock(6);
    ride.answer(true, { resetStreak: true });
    expect(ride.streak).toBe(0);
    expect(runUntil(() => ride.phase === 'stunt')).toBe(true);
    expect(runUntil(() => spy.turns.length === 2)).toBe(true);
    expect(ride.score).toBeGreaterThan(0);
  });

  it('a wrong answer wipes out, asks for the result, and goes on by itself when nothing waits', () => {
    start();
    toFirstTurn();
    ride.startClock(6);
    ride.answer(false);
    expect(ride.streak).toBe(0);
    expect(runUntil(() => spy.calls.includes('afterMiss:false'))).toBe(true);
    expect(ride.phase).toBe('result');
    expect(runUntil(() => spy.turns.length === 2)).toBe(true);
  });

  it('a result that waits holds until proceed()', () => {
    start();
    spy.missWait = true;
    toFirstTurn();
    ride.startClock(6);
    ride.answer(false);
    expect(runUntil(() => ride.phase === 'result')).toBe(true);
    run(8);
    expect(spy.turns).toHaveLength(1);
    expect(ride.phase).toBe('result');
    ride.proceed();
    expect(runUntil(() => spy.turns.length === 2)).toBe(true);
  });

  it('a clock that runs out tells the driver, then wipes out as a time-out', () => {
    start();
    toFirstTurn();
    ride.startClock(3);
    expect(runUntil(() => spy.calls.includes('timeUp'), 6)).toBe(true);
    expect(ride.clockLeft).toBe(0);
    expect(runUntil(() => spy.calls.includes('afterMiss:true'))).toBe(true);
  });

  it('an answer before the clock starts counts as full time at the length set by setClock', () => {
    start();
    toFirstTurn();
    ride.setClock(9);
    expect(ride.clockTotal).toBe(9);
    ride.answer(true);
    expect(ride.clockLeft).toBe(9);
    expect(ride.phase).toBe('turbo');
  });

  it('out of skis: a driver that waits holds the end until proceed(), then finishes', () => {
    start('?skis=1');
    toFirstTurn();
    ride.startClock(6);
    ride.answer(false);
    expect(runUntil(() => spy.calls.includes('ending'))).toBe(true);
    expect(spy.calls).not.toContain('afterMiss:false');
    expect(ride.phase).toBe('ending');
    expect(document.querySelector('.sz-banner-title')?.textContent).toBe(OUT_OF_SKIS_SPEECH);
    expect(document.querySelector('.sz-banner-detail')?.textContent).toBe('the fact');
    run(5);
    expect(spy.finished).toHaveLength(0);
    ride.proceed();
    expect(spy.finished).toHaveLength(1);
    expect(ride.phase).toBe('done');
  });

  it('out of skis: with a line to say the ride speaks it, then finishes when it ends', () => {
    start('?skis=1');
    spy.ending = { detail: '', wait: false, say: OUT_OF_SKIS_SPEECH };
    toFirstTurn();
    ride.startClock(6);
    ride.answer(false);
    expect(runUntil(() => speaks.some((s) => s.text === OUT_OF_SKIS_SPEECH))).toBe(true);
    run(3);
    expect(spy.finished).toHaveLength(0);
    speaks.find((s) => s.text === OUT_OF_SKIS_SPEECH)?.done?.();
    expect(spy.finished).toHaveLength(1);
  });

  it('out of skis: with nothing to say or wait on it finishes after 1.5 s', () => {
    start('?skis=1');
    spy.ending = { detail: '', wait: false };
    toFirstTurn();
    ride.startClock(6);
    ride.answer(false);
    expect(runUntil(() => spy.calls.includes('ending'))).toBe(true);
    run(1.3);
    expect(spy.finished).toHaveLength(0);
    run(0.4);
    expect(spy.finished).toHaveLength(1);
    expect(speaks.some((s) => s.text === OUT_OF_SKIS_SPEECH)).toBe(false);
  });

  it('again() starts a new run at the countdown, without the intro', () => {
    start('?skis=1');
    spy.ending = { detail: '', wait: false };
    toFirstTurn();
    ride.startClock(6);
    ride.answer(false);
    expect(runUntil(() => spy.finished.length === 1)).toBe(true);
    const turns = spy.turns.length;
    spy.finished[0].again();
    expect(spy.calls.filter((c) => c === 'intro')).toHaveLength(1);
    expect(ride.score).toBe(0);
    expect(runUntil(() => spy.turns.length === turns + 1, 10)).toBe(true);
    expect(ride.phase).toBe('riding');
  });

  it('a Mega Stunt asks three gate turns, and a missed gate is reported after the course', () => {
    start('?mega=1');
    toFirstTurn();
    expect(spy.turns[0]).toEqual({ target: 'gate', tier: 1, piece: 1 });
    ride.startClock(6);
    ride.answer(false);
    // The ski rides on through the course; the result comes only once the stunt is over.
    expect(runUntil(() => ride.phase === 'stunt')).toBe(true);
    expect(spy.calls.some((c) => c.startsWith('afterMiss'))).toBe(false);
    expect(runUntil(() => spy.calls.includes('afterMiss:false'))).toBe(true);
    expect(spy.calls.filter((c) => c.startsWith('afterMiss'))).toHaveLength(1);
    expect(spy.turns).toHaveLength(1);
    expect(ride.phase).toBe('result');
  });

  it('a time-out at a gate is reported as a time-out after the course', () => {
    start('?mega=1');
    toFirstTurn();
    ride.startClock(2);
    expect(runUntil(() => spy.calls.includes('timeUp'), 6)).toBe(true);
    expect(runUntil(() => spy.calls.some((c) => c.startsWith('afterMiss')))).toBe(true);
    expect(spy.calls).toContain('afterMiss:true');
  });

  it('a cleared Mega Stunt holds the next turn for betweenWorlds until it resumes', () => {
    start('?mega=1');
    let resume: (() => void) | null = null;
    spy.driver.betweenWorlds = (go) => {
      spy.calls.push('betweenWorlds');
      resume = go;
    };
    toFirstTurn();
    for (let piece = 1; piece <= 3; piece++) {
      expect(runUntil(() => spy.turns.length === piece)).toBe(true);
      expect(spy.turns[piece - 1].piece).toBe(piece);
      ride.startClock(6);
      ride.answer(true);
    }
    expect(runUntil(() => resume !== null, 90)).toBe(true);
    const turns = spy.turns.length;
    expect(turns).toBe(3);
    run(5);
    expect(spy.turns).toHaveLength(turns);
    (resume as unknown as () => void)();
    expect(runUntil(() => spy.turns.length === turns + 1, 10)).toBe(true);
    expect(spy.turns[turns]).toEqual({ target: 'launcher', tier: expect.any(Number), piece: 0 });
  });

  it('without betweenWorlds the next turn comes straight after the world title', () => {
    start('?mega=1');
    toFirstTurn();
    for (let piece = 1; piece <= 3; piece++) {
      expect(runUntil(() => spy.turns.length === piece)).toBe(true);
      ride.startClock(6);
      ride.answer(true);
    }
    expect(runUntil(() => spy.turns.length === 4, 90)).toBe(true);
    expect(spy.turns[3].target).toBe('launcher');
  });

  it('the Mega bonus is multiplied too', () => {
    start('?mega=1');
    ride.setMultiplier(3);
    toFirstTurn();
    for (let piece = 1; piece <= 3; piece++) {
      expect(runUntil(() => spy.turns.length === piece)).toBe(true);
      ride.startClock(6);
      ride.answer(true);
    }
    expect(runUntil(() => spy.turns.length === 4, 90)).toBe(true);
    expect(ride.score).toBeGreaterThanOrEqual(500 * 3);
    expect(document.querySelector('.sz-banner-detail')).not.toBeNull();
  });

  it('ignores an answer when no turn is riding', () => {
    start();
    ride.answer(true);
    expect(ride.score).toBe(0);
    expect(ride.phase).toBe('preview');
  });

  it('skip() does nothing outside a stunt', () => {
    start();
    expect(() => ride.skip()).not.toThrow();
  });

  it('ride.after runs a callback after the seconds of game time', () => {
    start();
    let ran = false;
    ride.after(0.5, () => (ran = true));
    run(0.4);
    expect(ran).toBe(false);
    run(0.2);
    expect(ran).toBe(true);
  });
});
