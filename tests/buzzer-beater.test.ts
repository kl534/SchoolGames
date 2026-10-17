import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  ballAt,
  actorAt,
  dribbleHeight,
  planPlay,
  scriptHand,
  SLOW_MO_SCALE,
  MAX_PLAY_SECONDS,
  type PlayInput,
  type PlayScript,
  type Who,
} from '../src/games/buzzer-beater/plays';
import {
  BALL_RADIUS,
  FENCE,
  FT_SPOT,
  GUARD_R,
  OFFENSE_R,
  RIM,
  RIM_RADIUS,
  SPOT_ANGLES,
  spotPos,
  vec,
  type Vec,
} from '../src/games/buzzer-beater/geometry';
import {
  endTurn,
  firstBall,
  isAndOne,
  newGame,
  onFire,
  ourBasket,
  ourFreeThrow,
  ourMiss,
  ourViolation,
  periodLabel,
  periodShort,
  pointsText,
  RIVAL_SCORES,
  rivalScoreFor,
  roundsLeft,
  SHOT_POINTS,
  SHOT_SPEECH,
  shotFor,
  STOP_SPEECH,
  stopFor,
  theirBasket,
  theirScoreSpeech,
  turnsInPeriod,
  AND_ONE_SPEECH,
  FREE_THROW_MADE_SPEECH,
  FREE_THROW_MISSED_SPEECH,
  HALFTIME_SPEECH,
  MISS_SPEECH,
  OFFENSIVE_REBOUND_SPEECH,
  ON_FIRE_SPEECH,
  OVERTIME_SPEECH,
  THEIR_BALL_SPEECH,
  VIOLATION_SPEECH,
  YOU_WIN_SPEECH,
  type GameState,
  type Shot,
  type TurnEnd,
} from '../src/games/buzzer-beater/rules';
import {
  darken,
  ourAbbr,
  outcomeText,
  pickRival,
  RIVALS,
  rivalWinsSpeech,
  scoreLine,
} from '../src/games/buzzer-beater/rivals';
import {
  boardBlocks,
  defenseCam,
  defenseKeys,
  fitView,
  offenseCam,
  offenseKeys,
  playBand,
} from '../src/games/buzzer-beater/layout';
import { VOICE_LINES } from '../src/games/buzzer-beater/voice';
import { seededRandom } from '../src/shared/random';

const SHOTS: Shot[] = ['three', 'dunk', 'jumper', 'layup'];

describe('shots and stops', () => {
  it('picks the shot by speed', () => {
    expect(shotFor(0, 0.49)).toBe('dunk');
    expect(shotFor(0, 0.5)).toBe('three');
    expect(['dunk', 'three']).toContain(shotFor(0.399, 0.1));
    expect(shotFor(0.4, 0)).toBe('jumper');
    expect(shotFor(0.999, 0.9)).toBe('jumper');
    expect(shotFor(1, 0)).toBe('layup');
    expect(shotFor(20, 0.7)).toBe('layup');
  });

  it('makes only some dunks and-ones', () => {
    expect(isAndOne('dunk', 0.2499)).toBe(true);
    expect(isAndOne('dunk', 0.25)).toBe(false);
    for (const shot of ['three', 'jumper', 'layup'] as const) {
      expect(isAndOne(shot, 0)).toBe(false);
    }
  });

  it('picks the stop by speed', () => {
    expect(stopFor(0)).toBe('block');
    expect(stopFor(0.4999)).toBe('block');
    expect(stopFor(0.5)).toBe('steal');
    expect(stopFor(0.999)).toBe('steal');
    expect(stopFor(1)).toBe('forced-miss');
    expect(stopFor(9)).toBe('forced-miss');
  });

  it('scores for the rival 70 / 25 / 5', () => {
    for (const r of [0, 0.6999]) expect(rivalScoreFor(r, 0.5).points).toBe(2);
    for (const r of [0.7, 0.9499]) {
      expect(rivalScoreFor(r, 0.5)).toEqual({ shot: 'three', andOne: false, points: 3 });
    }
    for (const r of [0.95, 0.9999]) {
      expect(rivalScoreFor(r, 0.5)).toEqual({ shot: 'layup', andOne: true, points: 3 });
    }
    expect(rivalScoreFor(0, 0)).toEqual({ shot: 'layup', andOne: false, points: 2 });
    expect(rivalScoreFor(0, 0.34).shot).toBe('jumper');
    expect(rivalScoreFor(0, 0.67).shot).toBe('dunk');
    expect(RIVAL_SCORES.reduce((n, s) => n + s.weight, 0)).toBeCloseTo(1);
    const random = seededRandom(7);
    const counts = { two: 0, three: 0, andOne: 0 };
    const n = 10000;
    for (let i = 0; i < n; i++) {
      const score = rivalScoreFor(random(), random());
      if (score.andOne) counts.andOne++;
      else if (score.shot === 'three') counts.three++;
      else counts.two++;
    }
    expect(Math.abs(counts.two / n - 0.7)).toBeLessThan(0.02);
    expect(Math.abs(counts.three / n - 0.25)).toBeLessThan(0.02);
    expect(Math.abs(counts.andOne / n - 0.05)).toBeLessThan(0.02);
  });
});

/** Plays a game where every turn is a basket for whoever has the ball (a stop for the rival). */
function playTurn(state: GameState): { state: GameState; end: TurnEnd } {
  const next = state.ball === 'us' ? ourBasket(state, 'layup', false).state : state;
  return endTurn(next);
}

describe('turn order', () => {
  it('goes us, them x5, halftime, them, us x5, then final', () => {
    let state = newGame();
    expect(state.ball).toBe('us');
    const order: string[] = [];
    const ends: TurnEnd[] = [];
    const rounds: number[] = [];
    for (let i = 0; i < 20; i++) {
      order.push(`${state.period}${state.ball}`);
      const result = playTurn(state);
      state = result.state;
      ends.push(result.end);
      rounds.push(roundsLeft(state));
    }
    expect(order.slice(0, 10)).toEqual(Array.from({ length: 5 }, () => ['1us', '1them']).flat());
    expect(order.slice(10)).toEqual(Array.from({ length: 5 }, () => ['2them', '2us']).flat());
    expect(ends.filter((e) => e === 'halftime')).toHaveLength(1);
    expect(ends[9]).toBe('halftime');
    expect(ends[19]).toBe('final');
    expect(state.over).toBe(true);
    expect(state.winner).toBe('us');
    // roundsLeft goes 5 to 0 in each half.
    expect(rounds.slice(0, 10).filter((_, i) => i % 2 === 1)).toEqual([4, 3, 2, 1, 5]);
    expect(roundsLeft(newGame())).toBe(5);
  });

  it('plays overtime when tied after the 2nd half', () => {
    let state: GameState = { ...newGame(), period: 2, ball: 'them', us: 10, them: 10 };
    for (let i = 0; i < 9; i++) state = endTurn(state).state;
    let result = endTurn(state);
    expect(result.end).toBe('overtime');
    state = result.state;
    expect([state.period, state.ball, state.usTurns, state.themTurns]).toEqual([3, 'us', 0, 0]);
    expect(turnsInPeriod(3)).toBe(1);
    expect(roundsLeft(state)).toBe(1);
    result = endTurn(state);
    expect(result.end).toBe('turn');
    expect(result.state.ball).toBe('them');
    result = endTurn(result.state);
    expect(result.end).toBe('overtime');
    expect(result.state.period).toBe(4);
    // Somebody leads after a pair: final.
    let ot = endTurn(ourBasket(result.state, 'three', false).state).state;
    ot = endTurn(ot).state;
    expect(ot.over).toBe(true);
    expect(ot.winner).toBe('us');
    expect(firstBall(1)).toBe('us');
    expect(firstBall(2)).toBe('them');
    expect(firstBall(5)).toBe('us');
  });

  it('labels the periods', () => {
    expect([1, 2, 3, 4].map(periodShort)).toEqual(['1st', '2nd', 'OT', '2OT']);
    expect(periodShort(5)).toBe('3OT');
    expect(periodLabel(1)).toBe('1st half');
    expect(periodLabel(2)).toBe('2nd half');
    expect(periodLabel(3)).toBe('Overtime');
    expect(periodLabel(4)).toBe('2nd overtime');
    expect(periodLabel(5)).toBe('3rd overtime');
    expect(periodLabel(12)).toBe('10th overtime');
  });
});

describe('transitions', () => {
  it('scores our baskets and lights the fire on the third in a row', () => {
    let state = newGame();
    const fires: boolean[] = [];
    for (const shot of ['three', 'dunk', 'jumper', 'layup', 'layup'] as const) {
      const before = state.us;
      const result = ourBasket(state, shot, false);
      expect(result.points).toBe(SHOT_POINTS[shot]);
      expect(result.state.us).toBe(before + SHOT_POINTS[shot]);
      fires.push(result.fireStarted);
      state = result.state;
    }
    expect(fires).toEqual([false, false, true, false, false]);
    expect(state.streak).toBe(5);
    expect(onFire(state)).toBe(true);
    expect(onFire({ ...state, streak: 2 })).toBe(false);
    const andOne = ourBasket(newGame(), 'dunk', true);
    expect(andOne.state.freeThrow).toBe(true);
    expect(andOne.state.us).toBe(2);
  });

  it('adds a free throw without touching the streak', () => {
    const base = { ...ourBasket(newGame(), 'dunk', true).state, streak: 4 };
    const made = ourFreeThrow(base, true);
    expect(made.us).toBe(3);
    expect(made.freeThrow).toBe(false);
    expect(made.streak).toBe(4);
    const missed = ourFreeThrow(base, false);
    expect(missed.us).toBe(2);
    expect(missed.freeThrow).toBe(false);
    expect(missed.streak).toBe(4);
  });

  it('gives one offensive rebound a turn', () => {
    const state = { ...newGame(), streak: 3 };
    const first = ourMiss(state, 0.3);
    expect(first.rebound).toBe(true);
    expect(first.state.reboundUsed).toBe(true);
    expect(first.state.streak).toBe(0);
    for (const r of [0, 0.1, 0.99]) expect(ourMiss(first.state, r).rebound).toBe(false);
    expect(ourMiss(state, 0.34).rebound).toBe(false);
    expect(ourMiss(state, 0.34).state.reboundUsed).toBe(false);
    expect(endTurn(first.state).state.reboundUsed).toBe(false);
  });

  it('ends the streak on a violation but not on the rival scoring', () => {
    const state = { ...newGame(), streak: 3 };
    expect(ourViolation(state).streak).toBe(0);
    const after = theirBasket(state, { shot: 'three', andOne: false, points: 3 });
    expect(after.them).toBe(3);
    expect(after.streak).toBe(3);
    expect(state.them).toBe(0);
  });

  it('plays 2000 random games to a sane end', () => {
    const random = seededRandom(2024);
    for (let game = 0; game < 2000; game++) {
      let state = newGame();
      let ours = 0;
      let theirs = 0;
      let steps = 0;
      let rebounds = 0;
      let lastPeriod = 1;
      const turns = { us: 0, them: 0 };
      const sequence: Array<'us' | 'them'> = [];
      let turnBegan = true;
      while (!state.over) {
        expect(++steps).toBeLessThan(500);
        if (turnBegan) {
          if (state.usTurns === 0 && state.themTurns === 0) {
            expect(state.ball).toBe(firstBall(state.period));
          }
          turnBegan = false;
        }
        const roll = random();
        const seconds = random() * 2;
        const answer = roll < 0.5 ? 'right' : roll < 0.8 ? 'wrong' : 'timeout';
        if (state.ball === 'us') {
          if (state.freeThrow) {
            const made = answer === 'right';
            state = ourFreeThrow(state, made);
            if (made) ours += 1;
            continue;
          }
          if (answer === 'right') {
            const shot = shotFor(seconds, random());
            const result = ourBasket(state, shot, isAndOne(shot, random()));
            state = result.state;
            ours += result.points;
            if (state.freeThrow) continue;
          } else if (answer === 'wrong') {
            const result = ourMiss(state, random());
            state = result.state;
            if (result.rebound) {
              rebounds++;
              expect(rebounds).toBe(1);
              continue;
            }
          } else {
            state = ourViolation(state);
          }
        } else if (answer !== 'right') {
          const score = rivalScoreFor(random(), random());
          state = theirBasket(state, score);
          theirs += score.points;
        } else {
          expect(['block', 'steal', 'forced-miss']).toContain(stopFor(seconds));
        }
        expect(state.freeThrow).toBe(false);
        const holder = state.ball;
        const before = state.period;
        const result = endTurn(state);
        state = result.state;
        turns[holder]++;
        sequence.push(holder);
        rebounds = 0;
        turnBegan = true;
        if (state.period !== before) {
          // Each side had exactly its turns in the period that just ended.
          expect(turns.us).toBe(turnsInPeriod(before));
          expect(turns.them).toBe(turnsInPeriod(before));
          expect(state.period).toBe(before + 1);
          turns.us = turns.them = 0;
          lastPeriod = state.period;
        }
      }
      void lastPeriod;
      expect(state.us).toBe(ours);
      expect(state.them).toBe(theirs);
      expect(state.us).not.toBe(state.them);
      expect(state.winner).toBe(state.us > state.them ? 'us' : 'them');
      // The turns alternate (within a period they swap every time).
      for (let i = 1; i < sequence.length; i++) {
        if (sequence[i] === sequence[i - 1]) {
          // Only across a period change where the same side starts the next one.
          expect(i % 2).toBe(0);
        }
      }
    }
  });
});

describe('spoken lines', () => {
  it('voices every line the game can say, once', () => {
    const expected = new Set<string>([
      ...Object.values(SHOT_SPEECH),
      ...Object.values(STOP_SPEECH),
      AND_ONE_SPEECH,
      FREE_THROW_MADE_SPEECH,
      FREE_THROW_MISSED_SPEECH,
      MISS_SPEECH,
      OFFENSIVE_REBOUND_SPEECH,
      THEIR_BALL_SPEECH,
      VIOLATION_SPEECH,
      ON_FIRE_SPEECH,
      HALFTIME_SPEECH,
      OVERTIME_SPEECH,
      YOU_WIN_SPEECH,
      ...SHOTS.map((shot) => theirScoreSpeech({ shot, andOne: false, points: SHOT_POINTS[shot] })),
      theirScoreSpeech({ shot: 'layup', andOne: true, points: 3 }),
      ...RIVALS.map(rivalWinsSpeech),
    ]);
    expect(new Set(VOICE_LINES).size).toBe(VOICE_LINES.length);
    expect(new Set(VOICE_LINES)).toEqual(expected);
    expect(theirScoreSpeech({ shot: 'layup', andOne: true, points: 3 })).toBe(
      'And one! They score three.',
    );
    expect(pointsText(3)).toBe('+3');
  });
});

describe('rivals', () => {
  it('has 12 distinct animals with 3-letter codes', () => {
    expect(RIVALS).toHaveLength(12);
    expect(new Set(RIVALS.map((r) => r.id)).size).toBe(12);
    expect(new Set(RIVALS.map((r) => r.name)).size).toBe(12);
    expect(new Set(RIVALS.map((r) => r.abbr)).size).toBe(12);
    for (const rival of RIVALS) {
      expect(rival.abbr).toMatch(/^[A-Z]{3}$/);
      expect(rival.abbr).not.toBe('YOU');
    }
    expect(pickRival(0)).toBe(RIVALS[0]);
    expect(pickRival(0.9999)).toBe(RIVALS[11]);
    expect(pickRival(1)).toBe(RIVALS[11]);
    expect(pickRival(-1)).toBe(RIVALS[0]);
  });

  it('names our player from their name, falling back to YOU', () => {
    const rival = RIVALS[0];
    expect(ourAbbr('Kevin', rival)).toBe('KEV');
    expect(ourAbbr('ava', rival)).toBe('AVA');
    expect(ourAbbr("D'Arcy", rival)).toBe('DAR');
    expect(ourAbbr(undefined, rival)).toBe('YOU');
    expect(ourAbbr('', rival)).toBe('YOU');
    expect(ourAbbr('7', rival)).toBe('YOU');
    expect(ourAbbr('Al', rival)).toBe('AL');
    // Never the same as the rival's.
    expect(ourAbbr('Rachel', rival)).toBe('YOU');
  });

  it('writes the score lines', () => {
    const rival = RIVALS[0];
    expect(scoreLine(rival, 24, 18)).toBe('You 24 – Rocket Raccoon 18');
    expect(outcomeText(rival, 24, 18)).toBe('You beat Rocket Raccoon 24–18!');
    expect(outcomeText(rival, 14, 18)).toBe('Rocket Raccoon beat you 18–14.');
    expect(rivalWinsSpeech(rival)).toBe('Rocket Raccoon wins!');
    expect(darken(0xffffff, 0.5)).toBe(0x808080);
    expect(darken(0x123456, 0)).toBe(0);
  });
});

// ---------- Plays ----------

const INPUTS: PlayInput[] = [
  ...SHOTS.flatMap((shot) =>
    (['us', 'them'] as const).flatMap((shooter) => [
      { kind: 'make', shooter, shot, andOne: false } as PlayInput,
      ...(shot === 'dunk' || shot === 'layup'
        ? [{ kind: 'make', shooter, shot, andOne: true } as PlayInput]
        : []),
    ]),
  ),
  ...(['us', 'them'] as const).flatMap((shooter) =>
    (['us', 'them'] as const).map((rebound) => ({ kind: 'miss', shooter, rebound }) as PlayInput),
  ),
  { kind: 'violation' },
  { kind: 'free-throw', shooter: 'us', made: true },
  { kind: 'free-throw', shooter: 'us', made: false },
  { kind: 'free-throw', shooter: 'them', made: true },
  { kind: 'free-throw', shooter: 'them', made: false },
  { kind: 'block' },
  { kind: 'steal' },
];

const describeInput = (i: PlayInput) => JSON.stringify(i);
const STEP = 1 / 60;

function sample(script: PlayScript, t: number): Vec {
  return ballAt(script, t, (who: Who) => scriptHand(script, who, t, vec()), vec());
}

describe('plays', () => {
  const cases = INPUTS.flatMap((input) =>
    SPOT_ANGLES.map((angle) => ({ input, angle, name: `${describeInput(input)} @ ${angle}` })),
  );

  it.each(cases)('is well formed: $name', ({ input, angle }) => {
    for (let seed = 1; seed <= 20; seed++) {
      const script = planPlay(input, angle, seededRandom(seed));
      expect(script.duration).toBeGreaterThan(0.5);
      expect(script.duration).toBeLessThanOrEqual(MAX_PLAY_SECONDS);

      // The ball covers 0...duration with no gaps, in order.
      expect(script.ball[0].t0).toBe(0);
      expect(script.ball.at(-1)!.t1).toBeCloseTo(script.duration, 9);
      script.ball.forEach((seg, i) => {
        expect(seg.t1).toBeGreaterThan(seg.t0);
        if (i > 0) expect(seg.t0).toBeCloseTo(script.ball[i - 1].t1, 9);
      });
      // Events are in order and inside the duration.
      script.events.forEach((e, i) => {
        expect(e.t).toBeGreaterThanOrEqual(0);
        expect(e.t).toBeLessThanOrEqual(script.duration + 1e-9);
        if (i > 0) expect(e.t).toBeGreaterThanOrEqual(script.events[i - 1].t);
      });
      // Both actors start at time 0 with keys in order.
      for (const who of ['us', 'them'] as const) {
        const keys = script.actors[who];
        expect(keys[0].t).toBe(0);
        keys.forEach((k, i) => {
          if (i > 0) expect(k.t).toBeGreaterThan(keys[i - 1].t);
          expect(k.t).toBeLessThanOrEqual(script.duration + 1e-9);
        });
      }

      // Sampled every 1/60 s.
      let prev: Vec | null = null;
      let prevT = 0;
      const rimHits: number[] = [];
      for (let t = 0; t <= script.duration + 1e-9; t += STEP) {
        const p = sample(script, t);
        expect(p.y).toBeGreaterThanOrEqual(BALL_RADIUS - 0.01);
        expect(Math.abs(p.x)).toBeLessThan(FENCE.x);
        expect(p.z).toBeGreaterThan(FENCE.zMin);
        expect(p.z).toBeLessThan(FENCE.zMax);
        if (prev) {
          const jump = Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z);
          if (jump > 0.5) {
            // Only allowed where a held segment begins.
            const startsHeld = script.ball.some(
              (seg) => seg.kind === 'held' && seg.t0 > prevT - 1e-9 && seg.t0 <= t + 1e-9,
            );
            expect(startsHeld, `jump ${jump} at ${t}`).toBe(true);
          }
          // Down through the rim's circle?
          if (
            prev.y > RIM.y &&
            p.y <= RIM.y &&
            Math.hypot(p.x - RIM.x, p.z - RIM.z) < RIM_RADIUS - 0.01
          ) {
            rimHits.push(t);
          }
        }
        prev = p;
        prevT = t;
      }

      const scores = script.events.filter((e) => e.type === 'score');
      const isMake = input.kind === 'make' || (input.kind === 'free-throw' && input.made);
      if (isMake) {
        expect(scores).toHaveLength(1);
        const net = script.events.find((e) => e.type === 'net')!;
        const here = sample(script, net.t);
        expect(Math.abs(here.x - RIM.x)).toBeLessThan(0.06);
        expect(Math.abs(here.z - RIM.z)).toBeLessThan(0.06);
        expect(sample(script, net.t + 0.01).y).toBeLessThan(sample(script, net.t - 0.01).y);
      } else {
        expect(scores).toHaveLength(0);
        expect(rimHits).toEqual([]);
      }
      if (input.kind === 'miss') {
        const rebound = script.events.find((e) => e.type === 'rebound');
        expect(rebound?.who).toBe(input.rebound);
      }
      if (input.kind === 'make' && input.shot === 'dunk') {
        expect(script.slowMo).toBeDefined();
        const e = script.events.find((x) => x.type === 'score')!;
        expect(script.slowMo!.t0).toBeLessThanOrEqual(e.t);
        expect(script.slowMo!.t1).toBeGreaterThanOrEqual(e.t);
      }
      if (input.kind === 'block') {
        const e = script.events.find((x) => x.type === 'block')!;
        expect(script.slowMo!.t0).toBeLessThanOrEqual(e.t);
        expect(script.slowMo!.t1).toBeGreaterThanOrEqual(e.t);
      }
    }
  });

  it('has a contact for an and-one only', () => {
    const plain = planPlay(
      { kind: 'make', shooter: 'us', shot: 'dunk', andOne: false },
      0,
      Math.random,
    );
    const bump = planPlay(
      { kind: 'make', shooter: 'us', shot: 'dunk', andOne: true },
      0,
      Math.random,
    );
    expect(plain.events.some((e) => e.type === 'contact')).toBe(false);
    expect(bump.events.some((e) => e.type === 'contact')).toBe(true);
    expect(SLOW_MO_SCALE).toBeCloseTo(1 / 3);
  });

  it('puts the actors at their keys, linear in between', () => {
    const script = planPlay(
      { kind: 'make', shooter: 'us', shot: 'dunk', andOne: false },
      0,
      Math.random,
    );
    const keys = script.actors.us;
    for (const key of keys) {
      const at = actorAt(keys, key.t);
      expect(at.pos.x).toBeCloseTo(key.pos.x);
      expect(at.pos.z).toBeCloseTo(key.pos.z);
    }
    const [a, b] = keys;
    const mid = actorAt(keys, (a.t + b.t) / 2);
    expect(mid.pos.x).toBeCloseTo((a.pos.x + b.pos.x) / 2);
    expect(mid.pos.z).toBeCloseTo((a.pos.z + b.pos.z) / 2);
    expect(mid.move).toBe(a.move);
    expect(mid.moveT).toBeCloseTo((b.t - a.t) / 2);
  });

  it('dribbles between the floor and the hand twice a second', () => {
    let floors = 0;
    let wasLow = false;
    for (let t = 0.25; t < 4.25; t += 0.005) {
      const h = dribbleHeight(t);
      expect(h).toBeGreaterThanOrEqual(BALL_RADIUS - 1e-9);
      expect(h).toBeLessThanOrEqual(0.95 + 1e-9);
      const low = h < BALL_RADIUS + 0.02;
      if (low && !wasLow) floors++;
      wasLow = low;
    }
    expect(floors).toBe(8);
  });

  it('starts the play from the spots', () => {
    const script = planPlay({ kind: 'violation' }, 30, Math.random);
    const s = spotPos(30, OFFENSE_R);
    const g = spotPos(30, GUARD_R);
    expect(script.actors.us[0].pos).toEqual(s);
    expect(script.actors.them[0].pos).toEqual(g);
    const ft = planPlay({ kind: 'free-throw', shooter: 'us', made: true }, 0, Math.random);
    expect(ft.actors.us[0].pos).toEqual(FT_SPOT);
  });
});

describe('layout', () => {
  it('never lets the backboard hide the players on defense', () => {
    for (const angle of SPOT_ANGLES) {
      const cam = defenseCam(angle);
      const s = spotPos(angle, OFFENSE_R);
      const g = spotPos(angle, GUARD_R);
      for (const p of [
        { ...s, y: 0 },
        { ...s, y: 2.1 },
        { ...g, y: 2.1 },
        { ...g, y: 0 },
      ]) {
        expect(boardBlocks(cam, p), `angle ${angle}`).toBe(false);
      }
    }
  });

  it('sees the board block a point straight behind its middle', () => {
    const cam = defenseCam(0);
    const middle = { x: 0, y: 3.425, z: 1.2 };
    const behind = {
      x: cam.x + (middle.x - cam.x) * 2,
      y: cam.y + (middle.y - cam.y) * 2,
      z: cam.z + (middle.z - cam.z) * 2,
    };
    expect(boardBlocks(cam, behind)).toBe(true);
    // The offense view looks at the front of it: nothing is behind the board.
    expect(boardBlocks(offenseCam(spotPos(0, OFFENSE_R)), { x: 0, y: 1, z: 9 })).toBe(false);
  });

  const SIZES: [number, number][] = [
    [390, 844],
    [844, 390],
    [1024, 768],
    [1366, 1024],
  ];

  const views: { name: string; cam: Vec; keys: Vec[] }[] = [
    ...[...SPOT_ANGLES.map((a) => spotPos(a, OFFENSE_R)), FT_SPOT].map((shooter, i) => ({
      name: `offense ${i}`,
      cam: offenseCam(shooter),
      keys: offenseKeys(shooter),
    })),
    ...SPOT_ANGLES.map((a) => ({
      name: `defense ${a}`,
      cam: defenseCam(a),
      keys: defenseKeys(a),
    })),
  ];

  it.each(SIZES)('fits every view inside the play band at %ix%i', (width, height) => {
    const band = playBand(width, height);
    for (const view of views) {
      const fit = fitView(view.cam, view.keys, width, height, band);
      expect(fit.fov, view.name).toBeGreaterThanOrEqual(30);
      expect(fit.fov, view.name).toBeLessThanOrEqual(85);
      const camera = new PerspectiveCamera(fit.fov, width / height, 0.3, 600);
      camera.position.set(view.cam.x, view.cam.y, view.cam.z);
      camera.lookAt(fit.look.x, fit.look.y, fit.look.z);
      camera.setViewOffset(width, height, 0, fit.shift, width, height);
      camera.updateMatrixWorld();
      for (const key of view.keys) {
        const v = new Vector3(key.x, key.y, key.z).project(camera);
        const x = ((v.x + 1) / 2) * width;
        const y = ((1 - v.y) / 2) * height;
        expect(v.z, view.name).toBeLessThan(1);
        expect(y, `${view.name} row ${JSON.stringify(key)}`).toBeGreaterThanOrEqual(band.top - 0.5);
        expect(y, `${view.name} row ${JSON.stringify(key)}`).toBeLessThanOrEqual(band.bottom + 0.5);
        expect(x, view.name).toBeGreaterThanOrEqual(0);
        expect(x, view.name).toBeLessThanOrEqual(width);
      }
    }
  });
});
