import { describe, expect, it } from 'vitest';
import { runs } from './helpers/full';
import {
  COIN_TOSS_SPEECH,
  FIRST_US_SPEECH,
  ROUNDS,
  SHOOTERS,
  SHOT_CALL,
  SUDDEN_DEATH_SPEECH,
  coinToss,
  dotsOf,
  firstBanner,
  firstThemSpeech,
  newShootout,
  nextShot,
  outcomeText,
  roundText,
  shooterBanner,
  shooterSpeech,
  shootoutDecided,
  shotBanner,
  step,
  type Role,
  type Shot,
  type State,
} from '../src/games/shootout-showdown/rules';
import { VOICE_LINES } from '../src/games/shootout-showdown/voice';
import { RIVALS, US } from '../src/shared/hockey/teams';
import type { Side } from '../src/shared/hockey/geometry';
import { voiceKey } from '../src/shared/voice';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** A state built from results: `us` and `them` strings of 1 (goal) and 0 (miss). */
function played(first: Side, us: string, them: string): State {
  const results: Record<Side, string> = { us, them };
  const taken: Record<Side, number> = { us: 0, them: 0 };
  let state = newShootout(first);
  const total = us.length + them.length;
  for (let i = 0; i < total; i++) {
    const ns = nextShot(state);
    const scored = results[ns.side][taken[ns.side]++] === '1';
    const shot: Shot = { side: ns.side, role: ns.role, scored };
    state = {
      ...state,
      shots: [...state.shots, shot],
      us: state.us + (scored && ns.side === 'us' ? 1 : 0),
      them: state.them + (scored && ns.side === 'them' ? 1 : 0),
    };
  }
  expect(taken.us + taken.them).toBe(total);
  return state;
}
const decided = (first: Side, us: string, them: string) => shootoutDecided(played(first, us, them));

describe('nextShot', () => {
  it('alternates from the side that shoots first', () => {
    for (const first of ['us', 'them'] as const) {
      let state = newShootout(first);
      for (let i = 0; i < 10; i++) {
        const ns = nextShot(state);
        expect(ns.side).toBe(i % 2 === 0 ? first : first === 'us' ? 'them' : 'us');
        state = {
          ...state,
          shots: [...state.shots, { side: ns.side, role: ns.role, scored: false }],
        };
      }
    }
  });

  it('runs the roles C, W, D, C, ... and counts rounds', () => {
    let state = newShootout('us');
    const seen: { role: Role; round: number; suddenDeath: boolean }[] = [];
    for (let i = 0; i < 10; i++) {
      const ns = nextShot(state);
      seen.push({ role: ns.role, round: ns.round, suddenDeath: ns.suddenDeath });
      state = {
        ...state,
        shots: [...state.shots, { side: ns.side, role: ns.role, scored: false }],
      };
    }
    expect(seen.map((s) => s.role)).toEqual(['C', 'C', 'W', 'W', 'D', 'D', 'C', 'C', 'W', 'W']);
    expect(seen.map((s) => s.round)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    // Shots 7 and up (index 6) are sudden death.
    expect(seen.map((s) => s.suddenDeath)).toEqual(seen.map((_, i) => i >= 6));
    expect(SHOOTERS).toEqual(['C', 'W', 'D']);
    expect(ROUNDS).toBe(3);
  });
});

describe('shootoutDecided', () => {
  it('is open at the start and after one shot', () => {
    expect(decided('us', '', '')).toBeNull();
    expect(decided('us', '1', '')).toBeNull();
  });

  it('finishes early when a side cannot catch up', () => {
    // 2-0 after two rounds: they have one shot left.
    expect(decided('us', '11', '00')).toBe('us');
    expect(decided('us', '00', '11')).toBe('them');
    expect(decided('them', '00', '11')).toBe('them');
    expect(decided('them', '11', '00')).toBe('us');
    // 2-0 after two rounds with one shot left each is still open at 1-0.
    expect(decided('us', '11', '0')).toBeNull();
    // 3-0 after three of our shots and two of theirs.
    expect(decided('us', '111', '00')).toBe('us');
    // A side that has shot first and is one ahead with the other's shots to come is not done.
    expect(decided('us', '1', '')).toBeNull();
    expect(decided('us', '11', '0')).toBeNull();
    expect(decided('us', '110', '00')).toBe('us');
  });

  it('goes on when it is tied after three and decides after a full extra round', () => {
    expect(decided('us', '110', '101')).toBeNull();
    expect(decided('us', '110', '110')).toBeNull();
    expect(decided('them', '110', '110')).toBeNull();
    // Third round decided by the last shot.
    expect(decided('us', '111', '110')).toBe('us');
    expect(decided('us', '110', '111')).toBe('them');
    expect(decided('them', '110', '111')).toBe('them');
  });

  it('decides sudden death only after the full round', () => {
    expect(decided('us', '1101', '1100')).toBe('us');
    expect(decided('us', '1100', '1101')).toBe('them');
    expect(decided('us', '1101', '110')).toBeNull();
    expect(decided('us', '1100', '1100')).toBeNull();
    expect(decided('us', '11011', '11010')).toBe('us');
    expect(decided('them', '1100', '1101')).toBe('them');
    expect(decided('them', '1101', '1100')).toBe('us');
  });

  it('keeps the side that shot first in sudden death from winning early', () => {
    // 2-2 after three each; we shoot first and score in round 4: not over until they shoot.
    expect(decided('us', '1101', '101')).toBeNull();
    expect(decided('us', '1101', '1010')).toBe('us');
    expect(decided('them', '101', '1101')).toBeNull();
    expect(decided('them', '1010', '1101')).toBe('them');
    expect(decided('them', '1100', '1101')).toBe('them');
  });
});

describe('step', () => {
  it('gives the four plays and goals', () => {
    const us = step(newShootout('us'), true);
    expect(us.play).toBe('so-goal');
    expect(us.goal).toBe('us');
    expect(us.state.us).toBe(1);
    expect(step(newShootout('us'), false).play).toBe('so-saved');
    expect(step(newShootout('us'), false).goal).toBeNull();
    const them = step(newShootout('them'), false);
    expect(them.play).toBe('so-goal-against');
    expect(them.goal).toBe('them');
    expect(them.state.them).toBe(1);
    const stopped = step(newShootout('them'), true);
    expect(stopped.play).toBe('so-stopped');
    expect(stopped.goal).toBeNull();
    expect(us.shot).toEqual({ side: 'us', role: 'C', scored: true });
  });

  it('right answers all the way win 2-0 after four shots', () => {
    let state = newShootout('us');
    let n = 0;
    while (!state.over) {
      state = step(state, true).state;
      n++;
    }
    expect(state.winner).toBe('us');
    expect(state.us).toBe(2);
    expect(state.them).toBe(0);
    expect(n).toBe(4);
  });

  it('always ends with the side with more goals, never before four shots', () => {
    let seed = 12345;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = 0; i < runs(2000, 300); i++) {
      const bias = random();
      let state = newShootout(random() < 0.5 ? 'us' : 'them');
      let guard = 0;
      while (!state.over) {
        state = step(state, random() < bias).state;
        expect(state.shots.length).toBeLessThan(80);
        if (++guard > 200) throw new Error('shootout never ends');
      }
      expect(state.shots.length).toBeGreaterThanOrEqual(4);
      expect(state.winner).toBe(state.us > state.them ? 'us' : 'them');
      expect(state.us).not.toBe(state.them);
      if (state.shots.length > 2 * ROUNDS) expect(state.shots.length % 2).toBe(0);
      expect(state.us).toBe(state.shots.filter((s) => s.side === 'us' && s.scored).length);
    }
  });

  it('builds dots and round text from the shots', () => {
    const state = played('us', '10', '01');
    expect(dotsOf(state)).toEqual({ us: [true, false], them: [false, true] });
    expect(roundText(nextShot(state))).toBe('R3');
    expect(roundText(nextShot(played('us', '110', '110')))).toBe('SD');
  });
});

describe('coin toss and words', () => {
  it('tosses on 0.5', () => {
    expect(coinToss(0)).toBe('us');
    expect(coinToss(0.49)).toBe('us');
    expect(coinToss(0.5)).toBe('them');
    expect(coinToss(0.99)).toBe('them');
  });

  it('writes the outcome with an en dash', () => {
    const wolves = RIVALS.find((r) => r.id === 'wolves')!;
    expect(outcomeText(wolves, 3, 2)).toBe('You won the shootout 3–2!');
    expect(outcomeText(wolves, 2, 3)).toBe('The Wolves won the shootout 3–2.');
  });

  it('speaks the shooters and who goes first', () => {
    const wolves = RIVALS.find((r) => r.id === 'wolves')!;
    expect(shooterSpeech(US, 'C')).toBe('Home Team, number 19.');
    expect(shooterSpeech(US, 'W')).toBe('Home Team, number 9.');
    expect(shooterSpeech(wolves, 'D')).toBe('Wolves, number 4.');
    expect(firstThemSpeech(wolves)).toBe('Wolves shoot first.');
    expect(COIN_TOSS_SPEECH).toBe('Coin toss!');
    expect(FIRST_US_SPEECH).toBe('We shoot first!');
    expect(SUDDEN_DEATH_SPEECH).toBe('Sudden death!');
    expect(SHOT_CALL['so-goal']).toBe('Shoots, scores!');
  });

  it('writes the banners', () => {
    const wolves = RIVALS.find((r) => r.id === 'wolves')!;
    expect(shotBanner('so-goal', wolves)).toBe('GOAL!');
    expect(shotBanner('so-saved', wolves)).toBe('SAVED!');
    expect(shotBanner('so-stopped', wolves)).toBe('STOPPED!');
    expect(shotBanner('so-goal-against', wolves)).toBe('WLV GOAL');
    expect(firstBanner('us', wolves)).toBe('WE SHOOT FIRST');
    expect(firstBanner('them', wolves)).toBe('WLV SHOOT FIRST');
    const state = newShootout('us');
    expect(shooterBanner(wolves, nextShot(state))).toEqual({ title: 'WLV #19', detail: 'ROUND 1' });
    const sd = played('us', '110', '110');
    expect(shooterBanner(US, nextShot(sd))).toEqual({ title: 'HOM #19', detail: 'SUDDEN DEATH' });
  });
});

describe('voice lines', () => {
  it('are non-empty and unique, with the expected count and a clip each', () => {
    expect(VOICE_LINES.length).toBeGreaterThan(0);
    for (const line of VOICE_LINES) expect(line.trim()).not.toBe('');
    expect(new Set(VOICE_LINES).size).toBe(VOICE_LINES.length);
    expect(VOICE_LINES).toContain(shooterSpeech(US, 'D'));
    for (const rival of RIVALS) {
      for (const role of SHOOTERS) expect(VOICE_LINES).toContain(shooterSpeech(rival, role));
      expect(VOICE_LINES).toContain(firstThemSpeech(rival));
    }
    for (const line of VOICE_LINES) {
      const clip = resolve(import.meta.dirname, '../public/voice', `${voiceKey(line)}.mp3`);
      expect(existsSync(clip), line).toBe(true);
    }
  });
});
