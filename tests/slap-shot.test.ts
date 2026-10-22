import { describe, expect, it } from 'vitest';
import { runs } from './helpers/full';
import { formation, maxSeconds, planPlay } from '../src/games/slap-shot/plays';
import {
  ACTORS,
  SKATERS,
  actorAt,
  isGoalie,
  puckAt,
  type PlayScript,
} from '../src/shared/hockey/script';
import { shootoutFormation } from '../src/shared/hockey/shootout';
import { inNet, vec } from '../src/shared/hockey/geometry';
import {
  DROP_THE_PUCK,
  END_OF_PERIOD,
  OT_SECONDS,
  PERIOD_SECONDS,
  PLAY_CALL,
  PLAY_LABEL,
  SECONDS_PER_QUESTION,
  bandFor,
  bannerFor,
  callFor,
  clockText,
  isTheirGoal,
  newGame,
  shootoutDecided,
  shootoutStep,
  step,
  type Band,
  type GameState,
  type PlayKind,
  type Puck,
  type Zone,
} from '../src/games/slap-shot/rules';
import {
  RIVALS,
  US,
  outcomeText,
  pickRival,
  rivalWinsSpeech,
  theirGoalSpeech,
} from '../src/shared/hockey/teams';
import { VOICE_LINES } from '../src/games/slap-shot/voice';

const BANDS: Band[] = ['flashy', 'solid', 'plain'];
const ZONES: Zone[] = ['our-end', 'neutral', 'their-end'];
const PUCKS: Puck[] = [
  ...ZONES.map((zone): Puck => ({ kind: 'faceoff', zone })),
  ...ZONES.flatMap((zone): Puck[] => [
    { kind: 'held', side: 'us', zone },
    { kind: 'held', side: 'them', zone },
  ]),
];
const withPuck = (puck: Puck, extra: Partial<GameState> = {}): GameState => ({
  ...newGame(),
  puck,
  ...extra,
});
const held = (side: 'us' | 'them', zone: Zone): Puck => ({ kind: 'held', side, zone });

describe('bandFor', () => {
  it('splits at 0.6 and 1.2 seconds', () => {
    expect([0, 0.59, 0.6, 1.19, 1.2, 30].map(bandFor)).toEqual([
      'flashy',
      'flashy',
      'solid',
      'solid',
      'plain',
      'plain',
    ]);
  });
});

describe('step: the ladder', () => {
  it('a faceoff goes to whoever answers', () => {
    for (const zone of ZONES) {
      const s = withPuck({ kind: 'faceoff', zone });
      const win = step(s, true, 'plain', 0.9, 0.9);
      expect(win.play).toBe('faceoff-win');
      expect(win.state.puck).toEqual(held('us', zone));
      const loss = step(s, false, 'plain', 0.1, 0.1);
      expect(loss.play).toBe('faceoff-loss');
      expect(loss.state.puck).toEqual(held('them', zone));
      expect(loss.goal).toBeNull();
    }
  });

  it('our puck in our end', () => {
    const s = withPuck(held('us', 'our-end'));
    const plays = BANDS.map((b) => step(s, true, b, 0.9, 0.9).play);
    expect(plays).toEqual(['stretch-pass', 'tape-to-tape', 'skate-out']);
    expect(step(s, true, 'plain', 0, 0).state.puck).toEqual(held('us', 'neutral'));
    const turnover = step(s, false, 'plain', 0.5, 0.1);
    expect(turnover.play).toBe('picked-off');
    expect(turnover.state.puck).toEqual(held('them', 'our-end'));
    const steal = step(s, false, 'plain', 0.49, 0.9);
    expect(steal.play).toBe('steal-score');
    expect(steal.goal).toBe('them');
    expect(steal.state.them).toBe(1);
    expect(steal.state.puck).toEqual({ kind: 'faceoff', zone: 'neutral' });
  });

  it('our puck in the neutral zone', () => {
    const s = withPuck(held('us', 'neutral'));
    expect(step(s, true, 'flashy', 0, 0.4).play).toBe('spin-o-rama');
    expect(step(s, true, 'flashy', 0, 0.5).play).toBe('toe-drag');
    expect(step(s, true, 'solid', 0, 0).play).toBe('give-and-go');
    expect(step(s, true, 'plain', 0, 0).play).toBe('dump-and-chase');
    expect(step(s, true, 'plain', 0, 0).state.puck).toEqual(held('us', 'their-end'));
    const turnover = step(s, false, 'plain', 0.5, 0);
    expect(turnover.play).toBe('picked-off');
    expect(turnover.state.puck).toEqual(held('them', 'neutral'));
    const away = step(s, false, 'plain', 0.2, 0);
    expect(away.play).toBe('breakaway-against');
    expect(away.goal).toBe('them');
  });

  it('our puck in their end', () => {
    const s = withPuck(held('us', 'their-end'));
    for (const [band, play] of [
      ['flashy', 'one-timer'],
      ['solid', 'wrist-shot'],
      ['plain', 'rebound-goal'],
    ] as const) {
      const r = step(s, true, band, 0.1, 0.9);
      expect(r.play).toBe(play);
      expect(r.goal).toBe('us');
      expect(r.state.us).toBe(1);
      expect(r.state.puck).toEqual({ kind: 'faceoff', zone: 'neutral' });
    }
    for (const band of ['flashy', 'solid', 'plain'] as const) {
      const blocked = step(s, true, band, 0.25, 0);
      expect(blocked.play).toBe('save');
      expect(blocked.goal).toBeNull();
      expect(blocked.state.puck).toEqual({ kind: 'faceoff', zone: 'their-end' });
    }
    const saved = step(s, false, 'plain', 0.5, 0);
    expect(saved.play).toBe('save');
    expect(saved.state.puck).toEqual({ kind: 'faceoff', zone: 'their-end' });
    const rush = step(s, false, 'plain', 0.1, 0);
    expect(rush.play).toBe('counter-rush');
    expect(rush.goal).toBe('them');
  });

  it('their puck in any zone: a right answer is our puck in our end, a wrong one their goal', () => {
    for (const zone of ZONES) {
      const s = withPuck(held('them', zone));
      for (const band of BANDS) {
        for (const r2 of [0.1, 0.9]) {
          for (const r1 of [0.1, 0.9]) {
            const right = step(s, true, band, r1, r2);
            expect(right.state.puck).toEqual(held('us', 'our-end'));
            expect(right.goal).toBeNull();
            expect(right.play).toBe(
              band === 'flashy'
                ? 'body-check'
                : band === 'solid'
                  ? r2 < 0.5
                    ? 'poke-check'
                    : 'intercept'
                  : r2 < 0.5
                    ? 'goalie-save'
                    : 'shot-block',
            );
            const wrong = step(s, false, band, r1, r2);
            expect(wrong.goal).toBe('them');
            expect(wrong.play).toBe(r2 < 0.5 ? 'they-score-wrister' : 'they-score-deke');
            expect(wrong.state.puck).toEqual({ kind: 'faceoff', zone: 'neutral' });
          }
        }
      }
    }
  });
});

describe('the clock and the periods', () => {
  it('takes 60 seconds a step and never goes below 0', () => {
    const s = withPuck(held('us', 'neutral'), { clock: 100 });
    expect(step(s, true, 'plain', 0, 0).state.clock).toBe(100 - SECONDS_PER_QUESTION);
    expect(step({ ...s, clock: 50 }, true, 'plain', 0, 0).state.clock).toBe(14);
  });

  it('period 1 ends into period 2', () => {
    const r = step(withPuck(held('us', 'neutral'), { clock: SECONDS_PER_QUESTION }), true, 'plain', 0, 0);
    expect(r.periodEnd).toBe('period');
    expect(r.state.period).toBe(2);
    expect(r.state.clock).toBe(PERIOD_SECONDS);
    expect(r.state.puck).toEqual({ kind: 'faceoff', zone: 'neutral' });
  });

  it('a tied third period goes to overtime, an untied one is final', () => {
    const tied = step(
      withPuck(held('us', 'neutral'), { period: 3, clock: 0 }),
      true,
      'plain',
      0,
      0,
    );
    expect(tied.periodEnd).toBe('regulation-tied');
    expect(tied.state.period).toBe(4);
    expect(tied.state.clock).toBe(OT_SECONDS);
    const won = step(
      withPuck(held('us', 'neutral'), { period: 3, clock: 10, us: 2, them: 1 }),
      true,
      'plain',
      0,
      0,
    );
    expect(won.periodEnd).toBe('final');
    expect(won.state.over).toBe(true);
    expect(won.state.winner).toBe('us');
  });

  it('the first goal in overtime ends the game', () => {
    const ot = { period: 4, clock: 300 };
    const us = step(withPuck(held('us', 'their-end'), ot), true, 'plain', 0, 0);
    expect(us.state).toMatchObject({ over: true, winner: 'us' });
    const them = step(withPuck(held('them', 'neutral'), ot), false, 'plain', 0, 0);
    expect(them.state).toMatchObject({ over: true, winner: 'them' });
    expect(them.periodEnd).toBe('final');
  });

  it('overtime at 0:00 tied starts the shootout', () => {
    const r = step(withPuck(held('us', 'neutral'), { period: 4, clock: 10 }), true, 'plain', 0, 0);
    expect(r.periodEnd).toBe('overtime-tied');
    expect(r.state.period).toBe(5);
    expect(r.state.shootout).toEqual({ round: 1, us: 0, them: 0, shooter: 'us' });
  });
});

describe('the shootout', () => {
  const so = (round: number, us: number, them: number, shooter: 'us' | 'them') => ({
    round,
    us,
    them,
    shooter,
  });

  it('decides early when a side cannot catch up', () => {
    expect(shootoutDecided(so(3, 2, 0, 'us'))).toBe('us');
    expect(shootoutDecided(so(3, 1, 0, 'us'))).toBeNull();
    expect(shootoutDecided(so(1, 0, 0, 'them'))).toBeNull();
  });

  it('a miss on the third shot can lose it', () => {
    let state: GameState = {
      ...newGame(),
      period: 5,
      clock: 0,
      shootout: so(1, 0, 0, 'us'),
    };
    const shots: [boolean][] = [[false], [false], [false], [true], [false]];
    // us miss, them goal (their wrong answer), us miss, them stopped, us miss.
    for (const [right] of shots) state = shootoutStep(state, right).state;
    expect(state.over).toBe(true);
    expect(state.winner).toBe('them');
    expect(state.them).toBe(1);
  });

  it('tied after three rounds goes on; a full round with different totals decides', () => {
    expect(shootoutDecided(so(4, 1, 1, 'us'))).toBeNull();
    expect(shootoutDecided(so(4, 1, 1, 'them'))).toBeNull();
    expect(shootoutDecided(so(5, 2, 1, 'us'))).toBe('us');
    expect(shootoutDecided(so(4, 2, 1, 'them'))).toBeNull();
    expect(shootoutDecided(so(5, 1, 2, 'us'))).toBe('them');
  });

  it('plays the shots and gives the winner one goal', () => {
    let state: GameState = { ...newGame(), period: 5, clock: 0, shootout: so(1, 0, 0, 'us') };
    const plays: PlayKind[] = [];
    // We score every shot; we stop every one of theirs: 3-0.
    for (let i = 0; i < 6; i++) {
      const r = shootoutStep(state, true);
      plays.push(r.play);
      state = r.state;
      if (state.over) break;
    }
    expect(plays.slice(0, 4)).toEqual(['so-goal', 'so-stopped', 'so-goal', 'so-stopped']);
    expect(state.over).toBe(true);
    expect(state.winner).toBe('us');
    expect(state.us).toBe(1);
  });
});

describe('random games', () => {
  it('always end with the better side winning, and every play has words', () => {
    const n = runs(2000, 200);
    const problems: string[] = [];
    for (let g = 0; g < n; g++) {
      let state = newGame();
      let questions = 0;
      while (!state.over && questions < 3000) {
        const r = step(
          state,
          Math.random() < 0.6,
          BANDS[Math.floor(Math.random() * 3)],
          Math.random(),
          Math.random(),
        );
        if (!PLAY_LABEL[r.play] || !callFor(r.play, 'x')) problems.push(`no words: ${r.play}`);
        if (isTheirGoal(r.play) && r.goal !== 'them') problems.push(`goal side: ${r.play}`);
        if (r.state.period > 5) problems.push(`period ${r.state.period}`);
        state = r.state;
        questions++;
      }
      if (!state.over) problems.push('the game never ended');
      if (state.winner !== (state.us > state.them ? 'us' : 'them')) problems.push('wrong winner');
      if (state.us === state.them) problems.push('a tie');
    }
    expect(problems).toEqual([]);
  });
});

// ---------- Plays ----------

/** Every (kind, before, after) the rules can produce. */
function allPlays(): { kind: PlayKind; before: Puck; after: Puck }[] {
  const seen = new Map<string, { kind: PlayKind; before: Puck; after: Puck }>();
  for (const before of PUCKS) {
    for (const right of [true, false]) {
      for (const band of BANDS) {
        for (const r1 of [0.1, 0.9]) {
          for (const r2 of [0.1, 0.9]) {
            const r = step(withPuck(before), right, band, r1, r2);
            seen.set(`${r.play}|${JSON.stringify(before)}`, {
              kind: r.play,
              before,
              after: r.state.puck,
            });
          }
        }
      }
    }
  }
  return [...seen.values()];
}

const SHOOTOUT_KINDS: PlayKind[] = ['so-goal', 'so-saved', 'so-stopped', 'so-goal-against'];
const SO_PUCK: Puck = { kind: 'faceoff', zone: 'neutral' };

describe('planPlay', () => {
  const cases = [
    ...allPlays(),
    ...SHOOTOUT_KINDS.map((kind) => ({ kind, before: SO_PUCK, after: SO_PUCK })),
  ];

  it('covers every play kind', () => {
    const kinds = new Set(cases.map((c) => c.kind));
    expect(kinds.size).toBe(Object.keys(PLAY_LABEL).length);
  });

  for (const c of cases) {
    const name = `${c.kind} from ${JSON.stringify(c.before)}`;
    it(`${name}: a well-formed script`, () => {
      for (const roll of [0.1, 0.9]) {
        const script = planPlay(c.kind, c.before, c.after, () => roll);
        checkScript(script, c.kind, c.after);
      }
    });
  }
});

function checkScript(script: PlayScript, kind: PlayKind, after: Puck) {
  expect(script.duration).toBeLessThanOrEqual(maxSeconds(kind) + 1e-9);
  // The puck covers 0..duration with no gaps.
  let t = 0;
  for (const seg of script.puck) {
    expect(seg.t0).toBeCloseTo(t, 4);
    expect(seg.t1).toBeGreaterThanOrEqual(seg.t0);
    t = seg.t1;
  }
  expect(t).toBeCloseTo(script.duration, 4);
  for (const id of ACTORS) {
    const keys = script.actors[id];
    expect(keys[0].t).toBe(0);
    expect(keys[keys.length - 1].t).toBeCloseTo(script.duration, 6);
    for (let i = 1; i < keys.length; i++) expect(keys[i].t).toBeGreaterThan(keys[i - 1].t);
    for (let s = 0; s <= 40; s++) {
      const p = actorAt(keys, (s / 40) * script.duration).pos;
      expect(Math.abs(p.x)).toBeLessThanOrEqual(29);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(12.5);
    }
  }
  for (let s = 0; s <= 80; s++) {
    const p = puckAt(script, (s / 80) * script.duration);
    expect(Math.abs(p.x)).toBeLessThanOrEqual(29);
    expect(Math.abs(p.z)).toBeLessThanOrEqual(12.5);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
  }
  const goal = script.events.find((e) => e.type === 'goal');
  if (isTheirGoal(kind) || ['one-timer', 'wrist-shot', 'rebound-goal', 'so-goal'].includes(kind)) {
    expect(goal).toBeTruthy();
    expect(script.goal).toBe(isTheirGoal(kind) ? 'them' : 'us');
    expect(inNet(puckAt(script, script.duration), script.goal!)).toBe(true);
    expect(inNet(puckAt(script, goal!.t + 0.3), script.goal!)).toBe(true);
  } else {
    expect(goal).toBeUndefined();
    expect(script.goal).toBeNull();
    if (!SHOOTOUT_KINDS.includes(kind)) {
      const f = formation(after);
      for (const id of ACTORS) {
        const end = actorAt(script.actors[id], script.duration).pos;
        expect(end.x).toBeCloseTo(f.spots[id].pos.x, 4);
        expect(end.z).toBeCloseTo(f.spots[id].pos.z, 4);
      }
    }
  }
}

describe('formation', () => {
  it('keeps skaters at least 0.8 m apart for every puck', () => {
    const fs = [...PUCKS.map(formation), shootoutFormation('us'), shootoutFormation('them')];
    for (const f of fs) {
      for (const a of SKATERS) {
        for (const b of SKATERS) {
          if (a >= b) continue;
          const d = Math.hypot(
            f.spots[a].pos.x - f.spots[b].pos.x,
            f.spots[a].pos.z - f.spots[b].pos.z,
          );
          expect(d).toBeGreaterThanOrEqual(0.8);
        }
      }
    }
  });

  it('puts the carrier at the zone and the goalies on their creases', () => {
    const f = formation(held('us', 'neutral'));
    expect(f.carrier).toBe('uC');
    expect(f.spots.uC.pos).toMatchObject({ x: 0, z: 0 });
    for (const p of PUCKS) {
      const g = formation(p);
      expect(Math.abs(g.spots.uG.pos.x)).toBeCloseTo(25.6);
      expect(g.spots.tG.pos.x).toBeCloseTo(25.6);
      expect(isGoalie('uG')).toBe(true);
    }
  });

  it('starts a faceoff with the puck on the dot', () => {
    const f = formation({ kind: 'faceoff', zone: 'neutral' });
    expect(f.carrier).toBeNull();
    expect(f.puck).toMatchObject({ x: 0, z: 0 });
    expect(vec().x).toBe(0);
  });
});

describe('words', () => {
  const rival = RIVALS[2];

  it('team lines', () => {
    expect(theirGoalSpeech(rival)).toBe('Wolves score.');
    expect(rivalWinsSpeech(rival)).toBe('The Wolves win.');
    expect(outcomeText(rival, 4, 2, false)).toBe('You won 4–2!');
    expect(outcomeText(rival, 3, 2, true)).toBe('You won 3–2 in a shootout!');
    expect(outcomeText(rival, 1, 3, false)).toBe('The Wolves won 3–1.');
    expect(pickRival(0)).toBe(RIVALS[0]);
    expect(pickRival(0.9999)).toBe(RIVALS[5]);
    expect(US.abbr).toBe('HOM');
  });

  it('banners and the clock', () => {
    expect(bannerFor('one-timer', rival)).toBe('GOAL!');
    expect(bannerFor('they-score-deke', rival)).toBe('WLV GOAL');
    expect(clockText(1200)).toBe('20:00');
    expect(clockText(744)).toBe('12:24');
    expect(clockText(-3)).toBe('0:00');
  });

  it('records every call exactly once', () => {
    expect(new Set(VOICE_LINES).size).toBe(VOICE_LINES.length);
    for (const line of [
      ...Object.values(PLAY_CALL),
      DROP_THE_PUCK,
      ...END_OF_PERIOD,
      ...RIVALS.flatMap((t) => [theirGoalSpeech(t), rivalWinsSpeech(t)]),
    ]) {
      expect(VOICE_LINES).toContain(line);
    }
  });
});
