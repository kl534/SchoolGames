import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  autoAnswer,
  devPair,
  devRung,
  devScore,
  devServe,
  devStreak,
  forcedWhiff,
  freezeAt,
  skipVs,
} from '../src/games/hitting-handballs/dev';
import {
  CAM_FOV,
  CAM_Y,
  fitCamera,
  LOOK_X,
  LOOK_Y,
  playBand,
  SUBJECT,
  SUBJECT_Z,
} from '../src/games/hitting-handballs/layout';
import {
  BONK_TOTAL,
  bonk,
  cheer,
  dance,
  DIVE_TOTAL,
  dive,
  runFrame,
  smash,
  SMASH_CONTACT,
  SMASH_TOTAL,
  swing,
  SWING_CONTACT,
  SWING_TOTAL,
  whiffSpin,
  WHIFF_TOTAL,
} from '../src/games/hitting-handballs/moves';
import {
  allScoreCalls,
  CHAMPION_RUNG,
  coinToss,
  isMatchPoint,
  judgeHit,
  matchStars,
  matchWinner,
  newMatch,
  nextRung,
  outcomeText,
  PAIRS,
  pairFor,
  pickTarget,
  rungLabel,
  scoreCall,
  step,
  vsSubtitle,
  type Match,
} from '../src/games/hitting-handballs/rules';
import {
  ballAt,
  BALL_R,
  contactSpot,
  holdTime,
  PAST,
  pastShot,
  planShot,
  bonkShot,
  timeAtX,
  WALL_X,
  type Vec,
} from '../src/games/hitting-handballs/shots';
import { VOICE_LINES } from '../src/games/hitting-handballs/voice';
import { runs } from './helpers/full';

describe('hitting handballs judging', () => {
  it('smashes under the pair time, wins on the streak and whiffs on a wrong answer', () => {
    for (const pair of PAIRS) {
      expect(judgeHit(pair, 0, true, pair.smashUnder - 0.01)).toBe('smash');
      expect(judgeHit(pair, 0, true, pair.smashUnder)).not.toBe('smash');
      expect(judgeHit(pair, pair.streakToWin - 1, true, pair.smashUnder + 1)).toBe('winner');
      expect(judgeHit(pair, 0, true, 99)).toBe(pair.streakToWin === 1 ? 'winner' : 'return');
      for (const seconds of [0, pair.smashUnder - 0.01, pair.smashUnder, 99]) {
        expect(judgeHit(pair, pair.streakToWin - 1, false, seconds)).toBe('whiff');
      }
    }
  });

  it('has the five pairs of the design', () => {
    expect(PAIRS.map((p) => [p.smashUnder, p.streakToWin])).toEqual([
      [3, 2],
      [2.5, 3],
      [2, 3],
      [1.75, 4],
      [1.5, 4],
    ]);
  });
});

describe('hitting handballs match', () => {
  it('returns raise the streak and keep the score; smash, winner and whiff score', () => {
    const start = newMatch(1, 'them');
    const ret = step(start, true, 99);
    expect(ret.result).toBe('return');
    expect(ret.point).toBeNull();
    expect(ret.match).toMatchObject({ us: 0, them: 0, streak: 1, server: 'them' });

    const smashed = step({ ...ret.match }, true, 0.1);
    expect(smashed.result).toBe('smash');
    expect(smashed.point).toBe('us');
    expect(smashed.match).toMatchObject({ us: 1, them: 0, streak: 0, server: 'us' });

    const won = step({ ...start, streak: 2 }, true, 99);
    expect(won.result).toBe('winner');
    expect(won.match).toMatchObject({ us: 1, streak: 0, server: 'us' });

    const missed = step({ ...start, streak: 2, server: 'us' }, false, 1);
    expect(missed.result).toBe('whiff');
    expect(missed.point).toBe('them');
    expect(missed.match).toMatchObject({ them: 1, streak: 0, server: 'them' });
  });

  it('throws once the match is over', () => {
    const over: Match = { ...newMatch(0, 'us'), us: 11, them: 3, winner: 'us' };
    expect(() => step(over, true, 1)).toThrow();
  });

  it('decides the winner on 11 and a lead of 2', () => {
    expect(matchWinner(11, 9)).toBe('us');
    expect(matchWinner(11, 10)).toBeNull();
    expect(matchWinner(12, 10)).toBe('us');
    expect(matchWinner(13, 11)).toBe('us');
    expect(matchWinner(10, 12)).toBe('them');
    expect(matchWinner(9, 11)).toBe('them');
    expect(matchWinner(0, 0)).toBeNull();
  });

  it('knows match point', () => {
    expect(isMatchPoint(10, 5)).toBe(true);
    expect(isMatchPoint(11, 10)).toBe(true);
    expect(isMatchPoint(10, 10)).toBe(false);
    expect(isMatchPoint(11, 11)).toBe(false);
    expect(isMatchPoint(12, 11)).toBe(true);
    expect(isMatchPoint(11, 9)).toBe(false);
  });

  it('tosses a coin', () => {
    expect(coinToss(0.2)).toBe('us');
    expect(coinToss(0.5)).toBe('them');
  });

  it('plays random matches to a valid end', () => {
    const allowed = new Set(allScoreCalls());
    for (let i = 0; i < runs(3000, 400); i++) {
      const pair = Math.floor(Math.random() * PAIRS.length);
      const chance = Math.random();
      let match = newMatch(pair, Math.random() < 0.5 ? 'us' : 'them');
      let points = 0;
      while (!match.winner) {
        const right = Math.random() < chance;
        const out = step(match, right, Math.random() * 5);
        match = out.match;
        expect(match.streak).toBeLessThan(PAIRS[pair].streakToWin);
        if (out.point) {
          points++;
          expect(match.server).toBe(out.point);
        }
        const call = scoreCall(match.us, match.them);
        if (call) expect(allowed.has(call)).toBe(true);
        expect(points).toBeLessThan(500);
      }
      const { us, them } = match;
      const lead = match.winner === 'us' ? us - them : them - us;
      expect(Math.max(us, them)).toBeGreaterThanOrEqual(11);
      expect(lead).toBeGreaterThanOrEqual(2);
      expect(match.winner).toBe(matchWinner(us, them));
      expect(scoreCall(us, them)).toBeNull();
    }
  });
});

describe('hitting handballs calls', () => {
  it('says the score with ours first', () => {
    expect(scoreCall(5, 3)).toBe('Five, three.');
    expect(scoreCall(0, 1)).toBe('Zero, one.');
    expect(scoreCall(3, 3)).toBe('Three all.');
    expect(scoreCall(11, 11)).toBe('Eleven all.');
    expect(scoreCall(12, 11)).toBe('Advantage us!');
    expect(scoreCall(12, 13)).toBe('Advantage them!');
    expect(scoreCall(12, 12)).toBe('Deuce!');
    expect(scoreCall(0, 0)).toBeNull();
    expect(scoreCall(11, 9)).toBeNull();
    expect(scoreCall(14, 12)).toBeNull();
  });

  it('lists 126 distinct calls, all in VOICE_LINES', () => {
    const calls = allScoreCalls();
    expect(calls).toHaveLength(126);
    expect(new Set(calls).size).toBe(126);
    for (const call of calls) expect(VOICE_LINES).toContain(call);
  });

  it('records every line once', () => {
    expect(new Set(VOICE_LINES).size).toBe(VOICE_LINES.length);
    expect(VOICE_LINES).toHaveLength(126 + 5 + 5);
    for (const pair of PAIRS) expect(VOICE_LINES).toContain(pair.intro);
    for (const line of [
      'Play ball!',
      'Match point!',
      'We win!',
      'So close! Try again!',
      'You are the Recess Champions!',
    ]) {
      expect(VOICE_LINES).toContain(line);
    }
  });
});

describe('hitting handballs targets', () => {
  it('never sends the ball to the same kid three times in a row', () => {
    for (let run = 0; run < runs(300, 60); run++) {
      const history: (0 | 1)[] = [];
      for (let i = 0; i < 40; i++) {
        const kid = pickTarget(Math.random(), history);
        history.push(kid);
        if (history.length >= 3) {
          const [a, b, c] = history.slice(-3);
          expect(a === b && b === c).toBe(false);
        }
      }
    }
    expect(pickTarget(0.1, [])).toBe(0);
    expect(pickTarget(0.9, [])).toBe(1);
    expect(pickTarget(0.9, [1, 1])).toBe(0);
    expect(pickTarget(0.1, [0, 0])).toBe(1);
  });
});

describe('hitting handballs ladder', () => {
  it('moves up on a win and down on a loss, and a champion stays crowned', () => {
    expect(nextRung(0, true)).toBe(1);
    expect(nextRung(0, false)).toBe(0);
    expect(nextRung(2, false)).toBe(1);
    expect(nextRung(4, true)).toBe(5);
    expect(nextRung(5, true)).toBe(5);
    expect(nextRung(5, false)).toBe(5);
  });

  it('faces the pair of the rung, and a random other pair once crowned', () => {
    for (let rung = 0; rung < CHAMPION_RUNG; rung++) expect(pairFor(rung, 0.7)).toBe(rung);
    const seen = new Set<number>();
    for (let i = 0; i < runs(2000, 300); i++) {
      const last = i % 7 === 0 ? undefined : Math.floor(Math.random() * 5);
      const pick = pairFor(CHAMPION_RUNG, Math.random(), last);
      expect(pick).toBeGreaterThanOrEqual(0);
      expect(pick).toBeLessThanOrEqual(4);
      expect(pick).not.toBe(last);
      seen.add(pick);
    }
    expect(seen.size).toBe(5);
  });

  it('gives stars by the margin', () => {
    expect(matchStars(true, 11, 6)).toBe(3);
    expect(matchStars(true, 11, 7)).toBe(2);
    expect(matchStars(true, 13, 11)).toBe(2);
    expect(matchStars(false, 6, 11)).toBe(1);
    expect(matchStars(false, 5, 11)).toBe(0);
  });

  it('labels the rung and writes the outcome', () => {
    expect(rungLabel(0, 0)).toBe('Rung 1 of 5');
    expect(rungLabel(5, 2)).toBe('Rematch');
    expect(vsSubtitle(PAIRS[0])).toBe(
      'First to 11, win by 2. Answer in under 3 s to SMASH! 2 good hits in a row win the point.',
    );
    expect(outcomeText(0, PAIRS[0], true, 11, 4)).toBe(
      'You beat The Kinder Twins 11–4! Next up: The Hopscotch Sisters.',
    );
    expect(outcomeText(4, PAIRS[4], true, 11, 9)).toBe(
      'You beat The Fifth-Grade Legends 11–9! You are the Recess Champions! 👑',
    );
    expect(outcomeText(5, PAIRS[2], true, 11, 9)).toBe('You beat The Lunch Line Bullies 11–9!');
    expect(outcomeText(2, PAIRS[2], false, 5, 11)).toBe(
      'The Lunch Line Bullies won 11–5. Back down to The Hopscotch Sisters.',
    );
    expect(outcomeText(0, PAIRS[0], false, 5, 11)).toBe('The Kinder Twins won 11–5. Try again!');
    expect(outcomeText(5, PAIRS[3], false, 5, 11)).toBe('The Sneaker Squad won 11–5. Try again!');
  });
});

describe('hitting handballs shots', () => {
  const from: Vec = { x: 1, y: 1, z: 0.6 };
  const to: Vec = { x: 2, y: 1, z: -0.8 };

  it('joins its segments with no gap and never goes under the floor', () => {
    for (const kind of ['normal', 'smash'] as const) {
      for (const miss of [false, true]) {
        const shot = planShot(kind, from, to, 1.2, miss);
        for (let i = 1; i < shot.segments.length; i++) {
          expect(shot.segments[i].from).toEqual(shot.segments[i - 1].to);
        }
        for (let i = 0; i <= 200; i++) {
          const p = ballAt(shot, (shot.duration * i) / 200);
          expect(p.y).toBeGreaterThanOrEqual(BALL_R - 1e-9);
        }
      }
    }
  });

  it('touches the wall at the end of segment 1 and bounces on the floor at the end of 2', () => {
    const shot = planShot('normal', from, to, 1.2, false);
    const wall = ballAt(shot, shot.segments[0].duration);
    expect(wall.x).toBeCloseTo(WALL_X + BALL_R, 9);
    expect(wall.y).toBeCloseTo(1.2, 9);
    const bounce = ballAt(shot, shot.segments[0].duration + shot.segments[1].duration);
    expect(bounce.y).toBeCloseTo(BALL_R, 9);
    expect(bounce.x).toBeCloseTo(shot.segments[1].to.x, 9);
    expect(ballAt(shot, shot.duration)).toEqual(to);
    expect(ballAt(shot, -1)).toEqual(from);
    expect(ballAt(shot, 99)).toEqual(to);
  });

  it('is quicker for a smash, and a miss ends past the court', () => {
    const normal = planShot('normal', from, to, 1.2, false);
    const fast = planShot('smash', from, to, 1.2, false);
    expect(fast.duration).toBeLessThan(normal.duration);
    const missed = planShot('normal', from, to, 1.2, true);
    const end = ballAt(missed, missed.duration);
    expect(end.x).toBe(PAST.x);
    expect(end.y).toBe(PAST.y);
    expect(end.z).toBe(to.z);
    const crossing = timeAtX(missed, to.x);
    expect(crossing).not.toBeNull();
    expect(ballAt(missed, crossing ?? 0).x).toBeGreaterThanOrEqual(to.x);
    expect(timeAtX(missed, PAST.x + 1)).toBeNull();
  });

  it('holds 60 percent along the last segment', () => {
    const shot = planShot('normal', from, to, 1.2, false);
    const t = holdTime(shot);
    expect(t).toBeCloseTo(0.9 + 0.3, 9);
    expect(t).toBeLessThan(shot.duration);
  });

  it('has a ball that runs on past and one that drops after a bonk', () => {
    const held: Vec = { x: 1.5, y: 0.7, z: 0.6 };
    const past = pastShot(held);
    expect(ballAt(past, past.duration).x).toBe(PAST.x);
    const bonked = bonkShot(held, { x: 1.4, y: 1.5, z: 0.6 }, 1.8);
    expect(ballAt(bonked, bonked.duration).y).toBeCloseTo(BALL_R, 9);
  });

  it('picks a contact spot within a metre of home, on the court', () => {
    expect(contactSpot(-0.4, 0.5)).toBeCloseTo(-0.4, 9);
    expect(contactSpot(-1.4, 0)).toBe(-2.2);
    expect(contactSpot(2.2, 1)).toBe(2.8);
    for (let i = 0; i < 200; i++) {
      const spot = contactSpot(1.2, Math.random());
      expect(Math.abs(spot - 1.2)).toBeLessThanOrEqual(1);
    }
  });
});

describe('hitting handballs moves', () => {
  it('has swings that start and end at ready, with the contact inside', () => {
    expect(SWING_CONTACT).toBeLessThan(SWING_TOTAL);
    expect(SMASH_CONTACT).toBeLessThan(SMASH_TOTAL);
    for (const [move, total] of [
      [swing, SWING_TOTAL],
      [smash, SMASH_TOTAL],
      [dive, DIVE_TOTAL],
      [bonk, BONK_TOTAL],
    ] as const) {
      const start = move(0);
      const end = move(total);
      expect(end.hit?.raise).toBeCloseTo(start.hit?.raise ?? 0, 6);
      expect(end.lean ?? 0).toBeCloseTo(start.lean ?? 0, 6);
    }
    // The hand is forward at contact.
    expect(swing(SWING_CONTACT).hit?.raise).toBeGreaterThan(1.2);
    expect(smash(SMASH_CONTACT).hit?.raise).toBeGreaterThan(0.8);
  });

  it('spins a full turn on a whiff and dives sideways', () => {
    expect(whiffSpin(WHIFF_TOTAL).yaw).toBeCloseTo(Math.PI * 2, 6);
    expect(whiffSpin(0).yaw).toBe(0);
    expect(dive(DIVE_TOTAL / 2).roll).toBeGreaterThan(1);
    expect(bonk(0.4).dizzy).toBe(true);
    expect(cheer(0.1).hit?.raise).toBeGreaterThan(2);
    expect(dance(0.3).twist).toBeDefined();
    expect(runFrame(1, 0).legA?.raise).toBe(0);
  });
});

describe('hitting handballs layout', () => {
  const sizes: [number, number][] = [
    [390, 844],
    [844, 390],
    [1024, 768],
    [1366, 1024],
  ];

  it('fits every corner of the subject into the play band and the width', () => {
    for (const [w, h] of sizes) {
      const band = playBand(w, h);
      const { distance, shift } = fitCamera(w, h, band);
      const cam = new PerspectiveCamera(CAM_FOV, w / h, 0.1, 100);
      cam.position.set(LOOK_X, CAM_Y, distance);
      cam.lookAt(LOOK_X, LOOK_Y, 0);
      cam.setViewOffset(w, h, 0, -shift, w, h);
      cam.updateMatrixWorld();
      for (const x of [SUBJECT.minX, SUBJECT.maxX]) {
        for (const y of [SUBJECT.bottom, SUBJECT.top]) {
          for (const z of SUBJECT_Z) {
            const p = new Vector3(x, y, z).project(cam);
            const px = ((p.x + 1) / 2) * w;
            const py = ((1 - p.y) / 2) * h;
            expect(px).toBeGreaterThanOrEqual(-2);
            expect(px).toBeLessThanOrEqual(w + 2);
            expect(py).toBeGreaterThanOrEqual(band.top - 2);
            expect(py).toBeLessThanOrEqual(band.bottom + 2);
          }
        }
      }
    }
  });
});

describe('hitting handballs dev hooks', () => {
  it('reads the hooks and gives null for bad values', () => {
    expect(devRung('?rung=0')).toBe(0);
    expect(devRung('?rung=5')).toBe(5);
    expect(devRung('?rung=6')).toBeNull();
    expect(devRung('?rung=x')).toBeNull();
    expect(devPair('?pair=1')).toBe(0);
    expect(devPair('?pair=5')).toBe(4);
    expect(devPair('?pair=0')).toBeNull();
    expect(devPair('?pair=6')).toBeNull();
    expect(devScore('?score=10-9')).toEqual({ us: 10, them: 9 });
    expect(devScore('?score=11-3')).toBeNull();
    expect(devScore('?score=3-11')).toBeNull();
    expect(devScore('?score=11-11')).toEqual({ us: 11, them: 11 });
    expect(devScore('?score=a-b')).toBeNull();
    expect(devScore('?score=5')).toBeNull();
    expect(devScore('')).toBeNull();
    expect(devServe('?serve=them')).toBe('them');
    expect(devServe('?serve=x')).toBeNull();
    expect(devStreak(3, '?streak=2')).toBe(2);
    expect(devStreak(3, '?streak=3')).toBeNull();
    expect(devStreak(3, '?streak=-1')).toBeNull();
    expect(skipVs('?vs=skip')).toBe(true);
    expect(skipVs('?auto=smash')).toBe(true);
    expect(skipVs('')).toBeNull();
    for (const auto of ['smash', 'return', 'winner', 'wrong'] as const) {
      expect(autoAnswer(`?auto=${auto}`)).toBe(auto);
    }
    expect(autoAnswer('?auto=maybe')).toBeNull();
    expect(forcedWhiff('?whiff=bonk')).toBe('bonk');
    expect(forcedWhiff('?whiff=spin')).toBe('spin');
    expect(forcedWhiff('?whiff=x')).toBeNull();
    expect(freezeAt('?at=0.5')).toBe(0.5);
    expect(freezeAt('?at=')).toBeNull();
    expect(freezeAt('?at=soon')).toBeNull();
    expect(freezeAt('?at=-1')).toBeNull();
  });
});
