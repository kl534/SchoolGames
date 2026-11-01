import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { CAM_FOV, CAM_Y, fitCamera, LOOK_Y, playBand, SUBJECT } from '../src/games/en-garde/layout';
import {
  CAKE_TOP,
  CONTACT_T,
  finishFrame,
  FINISH_SPLAT,
  pokeFrame,
  POKE_TOTAL,
  restFrame,
} from '../src/games/en-garde/moves';
import {
  boutStars,
  CHAMPION_RUNG,
  HITS_TO_LOSE,
  newBout,
  nextRung,
  outcomeText,
  pickCall,
  pickPoke,
  POKE_CALLS,
  POKE_KINDS,
  rivalFor,
  RIVALS,
  rungLabel,
  step,
  vsSubtitle,
  type Bout,
  type PokeKind,
} from '../src/games/en-garde/rules';
import {
  autoAnswer,
  devPokes,
  devRival,
  devRung,
  forcedPoke,
  freezeAt,
  skipVs,
} from '../src/games/en-garde/dev';
import { VOICE_LINES } from '../src/games/en-garde/voice';
import { runs } from './helpers/full';

describe('en garde rivals', () => {
  it('has 5 rivals needing 8 to 12 pokes, with unique ids and two taunts each', () => {
    expect(RIVALS).toHaveLength(5);
    expect(RIVALS.map((r) => r.pokesToWin)).toEqual([8, 9, 10, 11, 12]);
    expect(new Set(RIVALS.map((r) => r.id)).size).toBe(5);
    for (const rival of RIVALS) {
      expect(rival.taunts).toHaveLength(2);
      expect(rival.taunts[0]).not.toBe(rival.taunts[1]);
    }
  });
});

describe('en garde bout', () => {
  it('counts pokes landed on right answers and taken on wrong ones', () => {
    let bout = newBout(0);
    expect(bout).toMatchObject({ rival: 0, pokesToWin: 8, landed: 0, taken: 0, winner: null });
    bout = step(bout, true);
    bout = step(bout, false);
    bout = step(bout, true);
    expect(bout).toMatchObject({ landed: 2, taken: 1, winner: null });
  });

  it('is won by us at pokesToWin and by them at 3 pokes', () => {
    let bout = newBout(1);
    for (let i = 0; i < 9; i++) bout = step(bout, true);
    expect(bout).toMatchObject({ landed: 9, taken: 0, winner: 'us' });
    bout = newBout(1);
    for (let i = 0; i < HITS_TO_LOSE; i++) bout = step(bout, false);
    expect(bout).toMatchObject({ landed: 0, taken: 3, winner: 'them' });
  });

  it('throws once the bout is over', () => {
    let bout = newBout(0);
    for (let i = 0; i < 3; i++) bout = step(bout, false);
    expect(() => step(bout, true)).toThrow();
    expect(() => step(bout, false)).toThrow();
  });

  it('ends within pokesToWin + 2 answers with one winner, for any random run of answers', () => {
    const rounds = runs(2000, 200);
    for (let rival = 0; rival < RIVALS.length; rival++) {
      for (let r = 0; r < rounds; r++) {
        const accuracy = Math.random();
        let bout: Bout = newBout(rival);
        let answers = 0;
        while (!bout.winner) {
          bout = step(bout, Math.random() < accuracy);
          answers++;
          expect(answers).toBeLessThanOrEqual(bout.pokesToWin + 2);
        }
        expect(['us', 'them']).toContain(bout.winner);
        expect(bout.landed === bout.pokesToWin).toBe(bout.winner === 'us');
        expect(bout.taken === HITS_TO_LOSE).toBe(bout.winner === 'them');
        if (bout.winner === 'us') {
          expect(bout.landed / answers).toBeGreaterThanOrEqual(
            bout.pokesToWin / (bout.pokesToWin + 2),
          );
        }
      }
    }
  });
});

describe('en garde ladder', () => {
  it('moves up on a win and down on a loss, and a champion stays crowned', () => {
    expect(nextRung(0, true)).toBe(1);
    expect(nextRung(0, false)).toBe(0);
    expect(nextRung(2, false)).toBe(1);
    expect(nextRung(4, true)).toBe(5);
    expect(nextRung(5, true)).toBe(5);
    expect(nextRung(5, false)).toBe(5);
  });

  it('faces the rival of the rung, and a random other rival once crowned', () => {
    for (let rung = 0; rung < CHAMPION_RUNG; rung++) expect(rivalFor(rung, 0.7)).toBe(rung);
    const seen = new Set<number>();
    for (let i = 0; i < runs(2000, 300); i++) {
      const last = i % 7 === 0 ? undefined : Math.floor(Math.random() * 5);
      const pick = rivalFor(CHAMPION_RUNG, Math.random(), last);
      expect(pick).toBeGreaterThanOrEqual(0);
      expect(pick).toBeLessThanOrEqual(4);
      expect(pick).not.toBe(last);
      seen.add(pick);
    }
    expect(seen.size).toBe(5);
    // The extremes of `random` stay in range.
    expect(rivalFor(CHAMPION_RUNG, 0, 0)).toBe(1);
    expect(rivalFor(CHAMPION_RUNG, 0.999999, 4)).toBe(3);
  });

  it('gives stars for an unpoked win, a win, a close loss and nothing otherwise', () => {
    expect(boutStars(true, 0, 8)).toBe(3);
    expect(boutStars(true, 2, 8)).toBe(2);
    expect(boutStars(false, 3, 5)).toBe(1);
    expect(boutStars(false, 3, 4)).toBe(0);
  });

  it('labels the rung and the VS card line', () => {
    expect(rungLabel(0, 0)).toBe('Rung 1 of 5');
    expect(rungLabel(3, 3)).toBe('Rung 4 of 5');
    expect(rungLabel(5, 2)).toBe('Rematch');
    expect(vsSubtitle(RIVALS[1])).toBe("Poke 9 times to win. Get poked 3 times and you're out!");
  });
});

describe('en garde pokes and calls', () => {
  it('never repeat the last kind or call, and cover every value', () => {
    const kinds = new Set<PokeKind>();
    const calls = new Set<string>();
    let lastKind: PokeKind | undefined;
    let lastCall: string | undefined;
    for (let i = 0; i < 500; i++) {
      const kind = pickPoke(Math.random(), lastKind);
      const call = pickCall(Math.random(), lastCall);
      expect(kind).not.toBe(lastKind);
      expect(call).not.toBe(lastCall);
      kinds.add(kind);
      calls.add(call);
      lastKind = kind;
      lastCall = call;
    }
    expect([...kinds].sort()).toEqual([...POKE_KINDS].sort());
    expect([...calls].sort()).toEqual([...POKE_CALLS].sort());
  });
});

describe('en garde outcome text', () => {
  it('says what happened, word for word', () => {
    expect(outcomeText(1, RIVALS[1], true, 9, 2)).toBe(
      'You beat Sir Sprinkles 9–2! Next up: Captain Cupcake.',
    );
    expect(outcomeText(4, RIVALS[4], true, 12, 1)).toBe(
      'You beat The Birthday Champion 12–1! You are the Party Champion! 👑',
    );
    expect(outcomeText(5, RIVALS[3], true, 11, 0)).toBe('You beat Ninja Noodle 11–0!');
    expect(outcomeText(1, RIVALS[1], false, 6, 3)).toBe(
      'Sir Sprinkles won 3–6. Back down to Pip the Party Pup.',
    );
    expect(outcomeText(0, RIVALS[0], false, 4, 3)).toBe('Pip the Party Pup won 3–4. Try again!');
    expect(outcomeText(5, RIVALS[0], false, 4, 3)).toBe('Pip the Party Pup won 3–4. Try again!');
  });
});

describe('en garde moves', () => {
  it('starts and ends every poke at rest for both fighters', () => {
    for (const kind of POKE_KINDS) {
      for (const t of [0, POKE_TOTAL]) {
        const f = pokeFrame(kind, t);
        expect(f.attacker).toEqual(restFrame());
        expect(f.victim).toEqual(restFrame());
      }
    }
  });

  it('flags the contact only within a frame of CONTACT_T', () => {
    for (const kind of POKE_KINDS) {
      for (let t = 0; t <= POKE_TOTAL; t += 0.005) {
        const near = Math.abs(t - CONTACT_T) <= 1 / 60;
        expect(pokeFrame(kind, t).contact).toBe(near);
      }
      expect(pokeFrame(kind, CONTACT_T).contact).toBe(true);
    }
    expect(finishFrame(CONTACT_T).contact).toBe(true);
    expect(finishFrame(CONTACT_T + 0.1).contact).toBe(false);
  });

  it('gives each kind its own reaction', () => {
    expect(pokeFrame('belly', 0.6).victim.fold).toBeGreaterThan(0.5);
    expect(pokeFrame('head', 0.5).victim.squash).toBeCloseTo(0.82, 2);
    expect(pokeFrame('head', 0.9).victim.dizzy).toBe(true);
    expect(pokeFrame('nose', 0.8).victim.crossEyes).toBe(true);
    const dodge = pokeFrame('bottom', 0.3).victim;
    expect(dodge.turn).toBeCloseTo(Math.PI * 0.8, 3);
    expect(pokeFrame('bottom', 0.6).victim.y).toBeGreaterThan(0.3);
    expect(pokeFrame('bottom', 0.6).victim.handsBehind).toBe(true);
    // Nobody walks through the other fighter.
    for (const kind of POKE_KINDS) {
      for (let t = 0; t <= POKE_TOTAL; t += 0.02) {
        expect(pokeFrame(kind, t).attacker.dx).toBeLessThanOrEqual(0.45 + 1e-9);
        expect(pokeFrame(kind, t).victim.dx).toBeGreaterThanOrEqual(-0.2 - 1e-9);
      }
    }
  });

  it('sends the loser flying to the top of the cake, from either side', () => {
    for (const fromX of [1.1, -1.1]) {
      const land = finishFrame(FINISH_SPLAT, fromX).victimPos;
      expect(
        Math.hypot(land.x - CAKE_TOP.x, land.y - CAKE_TOP.y, land.z - CAKE_TOP.z),
      ).toBeLessThan(0.05);
      const start = finishFrame(0, fromX).victimPos;
      expect(start.x).toBeCloseTo(fromX, 6);
      expect(start.z).toBeCloseTo(0, 6);
      let peak = 0;
      for (let t = 0; t <= FINISH_SPLAT; t += 0.01)
        peak = Math.max(peak, finishFrame(t, fromX).victimPos.y);
      expect(peak).toBeGreaterThan(2.5);
      expect(peak).toBeLessThan(2.7);
    }
    expect(finishFrame(FINISH_SPLAT).victim.spin).toBeCloseTo(3 * Math.PI, 6);
    // It stays in the cake after the splat.
    expect(finishFrame(FINISH_SPLAT + 1).victimPos).toEqual(finishFrame(FINISH_SPLAT).victimPos);
  });
});

describe('en garde layout', () => {
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
      cam.position.set(0, CAM_Y, distance);
      cam.lookAt(0, LOOK_Y, 0);
      cam.setViewOffset(w, h, 0, -shift, w, h);
      cam.updateMatrixWorld();
      for (const x of [-SUBJECT.halfW, SUBJECT.halfW]) {
        for (const y of [SUBJECT.bottom, SUBJECT.top]) {
          for (const z of [-1.9, 0.5]) {
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

  it('mirrors the HUD in playBand', () => {
    expect(playBand(390, 844)).toEqual({ top: 192, bottom: 674 });
    expect(playBand(844, 390)).toEqual({ top: 138, bottom: 310 });
    expect(playBand(1024, 768)).toEqual({ top: 138, bottom: 672 });
  });
});

describe('en garde voice lines', () => {
  it('lists 22 unique lines, including every intro and taunt', () => {
    expect(VOICE_LINES).toHaveLength(22);
    expect(new Set(VOICE_LINES).size).toBe(22);
    for (const rival of RIVALS) {
      expect(VOICE_LINES).toContain(rival.intro);
      for (const taunt of rival.taunts) expect(VOICE_LINES).toContain(taunt);
    }
    for (const call of POKE_CALLS) expect(VOICE_LINES).toContain(call);
    for (const line of [
      'Ahn gard!',
      'Victory!',
      'So close! Try again!',
      'You are the Party Champion!',
    ]) {
      expect(VOICE_LINES).toContain(line);
    }
  });
});

describe('en garde dev hooks', () => {
  it('reads ?pokes= for a rival and rejects counts that would end the bout', () => {
    expect(devPokes(8, '?pokes=7-2')).toEqual({ landed: 7, taken: 2 });
    expect(devPokes(8, '?pokes=0-0')).toEqual({ landed: 0, taken: 0 });
    expect(devPokes(8, '?pokes=8-0')).toBeNull();
    expect(devPokes(8, '?pokes=0-3')).toBeNull();
    expect(devPokes(12, '?pokes=11-2')).toEqual({ landed: 11, taken: 2 });
    for (const bad of ['', '?pokes=', '?pokes=7', '?pokes=a-b', '?pokes=-1-0', '?pokes=1-2-3']) {
      expect(devPokes(8, bad)).toBeNull();
    }
  });

  it('reads the other hooks and gives null for bad values', () => {
    expect(devRung('?rung=0')).toBe(0);
    expect(devRung('?rung=5')).toBe(5);
    expect(devRung('?rung=6')).toBeNull();
    expect(devRung('?rung=x')).toBeNull();
    expect(devRung('')).toBeNull();
    expect(devRival('?rival=1')).toBe(0);
    expect(devRival('?rival=5')).toBe(4);
    expect(devRival('?rival=0')).toBeNull();
    expect(devRival('?rival=6')).toBeNull();
    expect(forcedPoke('?poke=nose')).toBe('nose');
    expect(forcedPoke('?poke=kick')).toBeNull();
    expect(autoAnswer('?auto=right')).toBe('right');
    expect(autoAnswer('?auto=wrong')).toBe('wrong');
    expect(autoAnswer('?auto=maybe')).toBeNull();
    expect(freezeAt('?at=0.5')).toBe(0.5);
    expect(freezeAt('?at=')).toBeNull();
    expect(freezeAt('?at=soon')).toBeNull();
    expect(freezeAt('?at=-1')).toBeNull();
    expect(skipVs('?vs=skip')).toBe(true);
    expect(skipVs('?auto=right')).toBe(true);
    expect(skipVs('?vs=show')).toBeNull();
  });
});
