import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runs } from './helpers/full';
import { validateManifest } from '../src/shared/manifest';
import {
  centreX,
  FAIRWAY_HALF,
  GREEN_R,
  HOLES,
  ROUGH_HALF,
  surfaceAt,
  type Hole,
} from '../src/games/fairway-golf/course';
import {
  AIM_MAX,
  clubFor,
  CUP_R,
  DUFF_ANGLE,
  DUFF_FRACTION,
  finishShot,
  MAX_SIDE,
  planShot,
  resolveShot,
  type Lie,
  type Plan,
} from '../src/games/fairway-golf/shot';
import {
  afterShot,
  allCallLines,
  callKindFor,
  holeCall,
  holeIntro,
  holeOver,
  holeScore,
  nameFor,
  pillFor,
  relFromStored,
  relText,
  roundOutcome,
  shotCall,
  startHole,
  STROKE_CAP,
  storedFor,
  totalVsPar,
  vsPar,
  type HoleState,
} from '../src/games/fairway-golf/rules';
import { VOICE_LINES } from '../src/games/fairway-golf/voice';

const dir = resolve(import.meta.dirname, '../src/games/fairway-golf');
const RAD = Math.PI / 180;

describe('manifest', () => {
  it('is valid, matches its folder and is scored in points', () => {
    const manifest = JSON.parse(readFileSync(resolve(dir, 'game.json'), 'utf8'));
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.id).toBe('fairway-golf');
    expect(manifest.scoring).toBe('score');
  });
});

describe('the nine holes', () => {
  it('make par 36 and have the pin on the line at the end', () => {
    expect(HOLES).toHaveLength(9);
    expect(HOLES.reduce((s, h) => s + h.par, 0)).toBe(36);
    for (const h of HOLES) {
      expect(h.pin).toEqual({ x: 0, z: h.length });
      expect(centreX(h, h.length)).toBeCloseTo(0, 9);
      expect(h.trees).toEqual([]);
    }
  });
});

describe('surfaceAt', () => {
  const bent = HOLES[2];
  const first = HOLES[0];

  it('the tee box is fairway and anything behind it is rough', () => {
    expect(surfaceAt(first, 0, 0)).toBe('fairway');
    expect(surfaceAt(first, 0, -1)).toBe('rough');
    expect(surfaceAt(bent, centreX(bent, 0), -5)).toBe('rough');
  });

  it('follows the bent centre line', () => {
    for (const z of [20, 100, 180, 260, 330]) {
      const c = centreX(bent, z);
      if (Math.abs(c) < 1) continue;
      if (surfaceAt(bent, c, z) === 'sand') continue;
      expect(surfaceAt(bent, c, z)).toBe('fairway');
      expect(surfaceAt(bent, c + FAIRWAY_HALF - 0.1, z)).toBe('fairway');
      expect(surfaceAt(bent, c + FAIRWAY_HALF + 0.5, z)).toBe('rough');
      expect(surfaceAt(bent, c - FAIRWAY_HALF - 0.5, z)).toBe('rough');
    }
    // Straight down the middle of a bent hole at 100 yd is off the line.
    expect(centreX(bent, 180)).toBeCloseTo(14, 5);
    expect(surfaceAt(bent, 0, 180)).toBe('fairway');
    expect(surfaceAt(bent, -5, 180)).toBe('rough');
  });

  it('is green around the pin', () => {
    for (const h of HOLES) {
      expect(surfaceAt(h, 0, h.length + 3)).toBe('green');
      expect(surfaceAt(h, GREEN_R - 0.1, h.length)).toBe('green');
      expect(surfaceAt(h, GREEN_R + 4, h.length + 4)).toBe('rough');
    }
  });

  it('is sand and water at the hazard centres, and water beats the green', () => {
    for (const h of HOLES) {
      for (const hz of h.hazards) {
        expect(surfaceAt(h, hz.at.x, hz.at.z)).toBe(hz.kind);
      }
    }
    // Hole 6's pond reaches into the front of the green.
    expect(surfaceAt(HOLES[5], 0, 145)).toBe('water');
  });
});

describe('clubFor', () => {
  it('uses the putter on the green and the sand wedge in a bunker', () => {
    expect(clubFor('green', 12).id).toBe('putter');
    expect(clubFor('green', 200).id).toBe('putter');
    expect(clubFor('sand', 80).id).toBe('sand');
  });

  it('picks the club closest to the distance, the shorter on a tie', () => {
    expect(clubFor('fairway', 240).id).toBe('driver');
    expect(clubFor('tee', 340).id).toBe('driver');
    expect(clubFor('fairway', 150).id).toBe('iron5');
    expect(clubFor('fairway', 100).id).toBe('wedge');
    expect(clubFor('fairway', 175).id).toBe('iron5'); // 15 from 160, 15 from 190
    expect(clubFor('fairway', 145).id).toBe('iron7'); // 15 from 130, 15 from 160
  });

  it('chips to the distance, never below 10 yd', () => {
    expect(clubFor('fairway', 20).carry).toBe(20);
    expect(clubFor('rough', 30).carry).toBe(30);
    expect(clubFor('fairway', 4).carry).toBe(10);
    expect(clubFor('sand', 20).carry).toBe(20);
    expect(clubFor('sand', 60).carry).toBe(50);
  });

  it('pitches with the wedge inside a full wedge, and never carries past the green', () => {
    expect(clubFor('fairway', 60).id).toBe('wedge');
    expect(clubFor('fairway', 60).carry).toBe(60);
    expect(clubFor('fairway', 95).carry).toBe(95);
  });
});

describe('planShot', () => {
  const flat: Hole = { ...HOLES[0] };
  const from = { x: 0, z: 0 };

  it('aim 0 lands on the pin line at the carry', () => {
    const p = planShot(flat, from, 'tee', 0);
    expect(p.club.id).toBe('driver');
    expect(p.carry).toBe(240);
    expect(p.landing.x).toBeCloseTo(0, 9);
    expect(p.landing.z).toBeCloseTo(240, 9);
  });

  it('wind shifts the landing sideways by wind * carry / 100', () => {
    const windy: Hole = { ...flat, wind: 3 };
    const p = planShot(windy, from, 'tee', 0);
    expect(p.landing.x).toBeCloseTo((3 * 240) / 100, 9);
    const back = planShot({ ...flat, wind: -2 }, from, 'tee', 0);
    expect(back.landing.x).toBeCloseTo(-4.8, 9);
  });

  it('aim turns the shot from the line to the pin and is clamped', () => {
    const p = planShot(flat, from, 'tee', 10);
    expect(p.landing.x).toBeCloseTo(240 * Math.sin(10 * RAD), 9);
    expect(p.landing.z).toBeCloseTo(240 * Math.cos(10 * RAD), 9);
    expect(planShot(flat, from, 'tee', 90).aimDeg).toBe(AIM_MAX);
    expect(planShot(flat, from, 'tee', -90).aimDeg).toBe(-AIM_MAX);
    expect(planShot(flat, from, 'tee', 99).landing).toEqual(
      planShot(flat, from, 'tee', AIM_MAX).landing,
    );
  });

  it('a putt carries to the pin and the slope shifts it', () => {
    const h: Hole = { ...HOLES[0], slope: 0.4 };
    const at = { x: 3, z: h.length - 9 };
    const p = planShot(h, at, 'green', 0);
    const dist = Math.hypot(h.pin.x - at.x, h.pin.z - at.z);
    expect(p.club.id).toBe('putter');
    expect(p.carry).toBeCloseTo(dist, 9);
    expect(p.landing.x).toBeCloseTo(h.pin.x + (0.4 * dist) / 10, 9);
    expect(p.landing.z).toBeCloseTo(h.pin.z, 9);
    expect(planShot(h, { x: 0, z: h.length - 0.2 }, 'green', 0).carry).toBe(1);
  });

  it('the rough takes a fifth off a full club but not off a chip', () => {
    const p = planShot(flat, { x: 30, z: 100 }, 'rough', 0);
    expect(p.club.id).toBe('driver');
    expect(p.carry).toBeCloseTo(240 * 0.8, 9);
    const near = planShot(flat, { x: 0, z: flat.length - 20 }, 'rough', 0);
    expect(near.carry).toBe(20);
  });
});

describe('resolveShot', () => {
  const h = HOLES[0];
  const plan = planShot(h, { x: 0, z: 0 }, 'tee', 0);

  it('a quick right answer lands exactly on the ring', () => {
    for (const used of [0, 0.4, 0.999]) {
      const o = resolveShot(plan, true, used, 10, 1);
      expect(o.quality).toBe('perfect');
      expect(o.end).toEqual(plan.landing);
    }
  });

  it('a slower right answer wobbles, none at 1 s and the most at the full clock', () => {
    const at1 = resolveShot(plan, true, 1, 10, 1);
    expect(at1.quality).toBe('wobbly');
    expect(at1.end.x).toBeCloseTo(plan.landing.x, 9);
    const full = resolveShot(plan, true, 10, 10, 1);
    expect(full.end.x - plan.landing.x).toBeCloseTo(MAX_SIDE * plan.carry, 9);
    const left = resolveShot(plan, true, 10, 10, -1);
    expect(left.end.x - plan.landing.x).toBeCloseTo(-MAX_SIDE * plan.carry, 9);
    expect(left.side).toBe(-1);
    const half = resolveShot(plan, true, 5.5, 10, 1);
    expect(half.end.x - plan.landing.x).toBeCloseTo((MAX_SIDE * plan.carry) / 2, 9);
    expect(full.end.z).toBe(plan.landing.z);
  });

  it('a wrong answer is a duff: a share of the carry, turned by the duff angle', () => {
    const o = resolveShot(plan, false, 3, 10, 1);
    expect(o.quality).toBe('duff');
    const d = DUFF_FRACTION * plan.carry;
    expect(Math.hypot(o.end.x, o.end.z)).toBeCloseTo(d, 9);
    expect(Math.atan2(o.end.x, o.end.z)).toBeCloseTo(DUFF_ANGLE * RAD, 9);
    expect(resolveShot(plan, false, 3, 10, -1).end.x).toBeLessThan(0);
  });

  it('a duffed putt stops short', () => {
    const putt = planShot(h, { x: 0, z: h.length - 10 }, 'green', 0);
    const o = resolveShot(putt, false, 3, 10, 1);
    expect(o.end.z).toBeCloseTo(h.length - 10 + 4, 9);
    expect(o.end.x).toBeCloseTo(1.5, 9);
  });
});

describe('finishShot', () => {
  const h = HOLES[0];
  const plan = planShot(h, { x: 0, z: 100 }, 'fairway', 0);
  const end = (x: number, z: number) => ({ quality: 'perfect' as const, end: { x, z }, side: 1 as const });

  it('holes anything that ends within the cup radius', () => {
    expect(finishShot(h, plan, end(0, h.length)).kind).toBe('holed');
    expect(finishShot(h, plan, end(CUP_R - 0.01, h.length)).kind).toBe('holed');
    expect(finishShot(h, plan, end(CUP_R + 0.05, h.length)).kind).toBe('rest');
  });

  it('a ball at rest knows its surface', () => {
    expect(finishShot(h, plan, end(0, 200))).toEqual({
      kind: 'rest',
      at: { x: 0, z: 200 },
      surface: 'fairway',
    });
    expect(finishShot(h, plan, end(40, 200))).toMatchObject({ surface: 'rough' });
    expect(finishShot(h, plan, end(0, h.length - 6))).toMatchObject({ surface: 'green' });
    const s = HOLES[1];
    const sp = planShot(s, { x: 0, z: 0 }, 'tee', 0);
    expect(finishShot(s, sp, end(-10, 128))).toMatchObject({ surface: 'sand' });
  });

  it('water drops dry, back towards where the shot was played from', () => {
    const w = HOLES[4];
    const p = planShot(w, { x: 0, z: 0 }, 'tee', 0);
    const r = finishShot(w, p, end(-14, 200));
    expect(r.kind).toBe('water');
    if (r.kind !== 'water') return;
    expect(r.splash).toEqual({ x: -14, z: 200 });
    expect(surfaceAt(w, r.drop.x, r.drop.z)).not.toBe('water');
    // Back towards the start: nearer the tee than the splash, on the line between them.
    expect(r.drop.z).toBeLessThan(200);
    expect(r.drop.x / r.drop.z).toBeCloseTo(-14 / 200, 6);
  });

  it('falls back to the start when no dry ground is found', () => {
    const lake: Hole = {
      ...HOLES[0],
      hazards: [{ kind: 'water', at: { x: 0, z: 50, rx: 500, rz: 500 } }],
    };
    const p = planShot(lake, { x: 0, z: 40 }, 'fairway', 0);
    const r = finishShot(lake, p, end(0, 60));
    expect(r).toEqual({ kind: 'water', splash: { x: 0, z: 60 }, drop: { x: 0, z: 40 } });
  });

  it('keeps the ball inside the rough wall', () => {
    const r = finishShot(h, plan, end(500, 200));
    expect(r).toMatchObject({ kind: 'rest', at: { x: ROUGH_HALF, z: 200 } });
  });
});

describe('afterShot, holeScore and holeOver', () => {
  const h = HOLES[0];
  const rest = (x: number, z: number, surface: 'fairway' | 'rough' = 'fairway') =>
    ({ kind: 'rest', at: { x, z }, surface }) as const;

  it('a shot adds a stroke and moves the ball', () => {
    const s = afterShot(startHole(h), h, rest(2, 200, 'rough'));
    expect(s).toMatchObject({ strokes: 1, penalties: 0, lie: 'rough', at: { x: 2, z: 200 } });
    expect(holeOver(s)).toBe(false);
  });

  it('water adds a penalty and a drop, with the lie of the drop', () => {
    const w = HOLES[4];
    const s = afterShot(startHole(w), w, {
      kind: 'water',
      splash: { x: -14, z: 200 },
      drop: { x: -5, z: 120 },
    });
    expect(s).toMatchObject({ strokes: 1, penalties: 1, at: { x: -5, z: 120 }, lie: 'fairway' });
    expect(holeScore(s)).toBe(2);
  });

  it('holed ends the hole', () => {
    const s = afterShot({ ...startHole(h), strokes: 2 }, h, { kind: 'holed' });
    expect(s.holed).toBe(true);
    expect(holeOver(s)).toBe(true);
    expect(holeScore(s)).toBe(3);
  });

  it('the cap picks up at seven, strokes and penalties together', () => {
    let s: HoleState = startHole(h);
    for (let i = 0; i < 6; i++) s = afterShot(s, h, rest(0, 100));
    expect(holeOver(s)).toBe(false);
    expect(afterShot(s, h, rest(0, 100))).toMatchObject({ strokes: 7 });
    expect(holeOver(afterShot(s, h, rest(0, 100)))).toBe(true);
    const wet = afterShot(s, h, { kind: 'water', splash: { x: 0, z: 1 }, drop: { x: 0, z: 0 } });
    expect(wet.strokes + wet.penalties).toBe(8);
    expect(holeOver(wet)).toBe(true);
    expect(holeScore(wet)).toBe(STROKE_CAP);
    expect(holeOver({ ...startHole(h), strokes: 3, penalties: 3 })).toBe(false);
    expect(holeOver({ ...startHole(h), strokes: 3, penalties: 4 })).toBe(true);
  });

  it('adds up against par', () => {
    expect(vsPar(5, 4)).toBe(1);
    expect(vsPar(2, 4)).toBe(-2);
    const pars = HOLES.map((x) => x.par);
    expect(totalVsPar(pars, pars)).toBe(0);
    expect(totalVsPar(pars.map((p) => p + 1), pars)).toBe(9);
    expect(totalVsPar([3, 7, 4], [4, 4, 4])).toBe(2);
  });
});

describe('names and stored scores', () => {
  it('names a holed score from albatross to over par', () => {
    expect(nameFor(1, 4, true)).toBe('Hole in one');
    expect(nameFor(1, 3, true)).toBe('Hole in one');
    expect(nameFor(2, 5, true)).toBe('Albatross');
    expect(nameFor(2, 4, true)).toBe('Eagle');
    expect(nameFor(3, 4, true)).toBe('Birdie');
    expect(nameFor(4, 4, true)).toBe('Par');
    expect(nameFor(5, 4, true)).toBe('Bogey');
    expect(nameFor(6, 4, true)).toBe('Double bogey');
    expect(nameFor(7, 4, true)).toBe('Triple bogey');
    expect(nameFor(7, 3, true)).toBe('+4');
    expect(nameFor(STROKE_CAP, 4, false)).toBe('Pick up');
  });

  it('writes strokes against par as text', () => {
    expect(relText(0)).toBe('E');
    expect(relText(5)).toBe('+5');
    expect(relText(-2)).toBe('-2');
    expect(roundOutcome(41, 5)).toBe('You shot 41, 5 over par.');
    expect(roundOutcome(34, -2)).toBe('You shot 34, 2 under par.');
    expect(roundOutcome(36, 0)).toBe('You shot 36, level with par.');
  });

  it('stores a round as a bigger-is-better number that always round-trips', () => {
    for (let rel = -20; rel <= 36; rel++) {
      expect(relFromStored(storedFor(rel))).toBe(rel);
      expect(storedFor(rel)).toBeGreaterThan(0);
    }
    expect(storedFor(-2)).toBeGreaterThan(storedFor(5));
  });
});

// ---------- Playing whole holes ----------

/** The aim that puts a perfect shot's landing closest to the pin (cancels wind or slope). */
function bestAim(h: Hole, at: { x: number; z: number }, lie: Lie): number {
  const err = (a: number) => {
    const p = planShot(h, at, lie, a);
    return Math.hypot(p.landing.x - h.pin.x, p.landing.z - h.pin.z);
  };
  let best = 0;
  for (let a = -AIM_MAX; a <= AIM_MAX; a += 0.25) if (err(a) < err(best)) best = a;
  const centre = best;
  for (let a = centre - 0.25; a <= centre + 0.25; a += 0.005) if (err(a) < err(best)) best = a;
  return best;
}

interface Played {
  state: HoleState;
  wet: boolean;
}

/** Plays a hole, `answer` deciding each shot's answer and time. */
function playHole(
  h: Hole,
  answer: (shot: number) => { right: boolean; used: number; side: -1 | 1; aim?: number },
): Played {
  let state = startHole(h);
  let wet = false;
  for (let shot = 0; !holeOver(state); shot++) {
    if (shot > 20) throw new Error('hole never ended');
    const a = answer(shot);
    const aim = a.aim ?? bestAim(h, state.at, state.lie);
    const plan = planShot(h, state.at, state.lie, aim);
    const outcome = resolveShot(plan, a.right, a.used, 10, a.side);
    const result = finishShot(h, plan, outcome);
    if (result.kind === 'water') wet = true;
    state = afterShot(state, h, result);
  }
  return { state, wet };
}

describe('perfect play', () => {
  HOLES.forEach((h, i) => {
    it(`hole ${i + 1} (par ${h.par}) takes par or a little better and stays dry`, () => {
      const { state, wet } = playHole(h, () => ({ right: true, used: 0.2, side: 1 }));
      expect(wet).toBe(false);
      expect(state.holed).toBe(true);
      expect(state.strokes).toBeLessThanOrEqual(h.par);
      expect(state.strokes).toBeGreaterThanOrEqual(h.par - 2);
      expect(state.penalties).toBe(0);
    });
  });
});

describe('random play', () => {
  it('every hole ends inside the cap and the round adds up', () => {
    const rounds = runs(3000, 300);
    for (let r = 0; r < rounds; r++) {
      const quality = Math.random();
      const scores: number[] = [];
      HOLES.forEach((h) => {
        const { state } = playHole(h, () => ({
          right: Math.random() < quality,
          used: Math.random() * 10,
          side: Math.random() < 0.5 ? -1 : 1,
          aim: Math.random() < 0.5 ? undefined : (Math.random() - 0.5) * 2 * AIM_MAX,
        }));
        expect(state.strokes + state.penalties).toBeLessThanOrEqual(STROKE_CAP + 1);
        expect(holeScore(state)).toBeLessThanOrEqual(STROKE_CAP);
        expect(holeScore(state)).toBeGreaterThanOrEqual(1);
        scores.push(holeScore(state));
      });
      const total = scores.reduce((s, n) => s + n, 0);
      const rel = totalVsPar(
        scores,
        HOLES.map((x) => x.par),
      );
      expect(total - 36).toBe(rel);
      expect(storedFor(rel)).toBeGreaterThan(0);
      expect(rel).toBeLessThanOrEqual(36);
    }
  });
});

// ---------- Voice ----------

describe('voice lines', () => {
  it('lists every call the game can make', () => {
    const lines = allCallLines();
    const wanted = [
      'Fairway!',
      'In the rough.',
      'Bunker.',
      'On the green!',
      'Splash!',
      'In the hole!',
      'Nice putt.',
      'Missed it.',
      'Duffed it.',
      'Hole in one!',
      'Albatross!',
      'Eagle!',
      'Birdie!',
      'Par.',
      'Bogey.',
      'Double bogey.',
      'Triple bogey.',
      'Over par.',
      'Pick up.',
      'Last hole.',
      'Round over.',
      'New best!',
    ];
    for (const line of wanted) expect(lines).toContain(line);
    HOLES.forEach((_, i) => expect(lines).toContain(holeIntro(i)));
    expect(holeIntro(0)).toBe('Hole one, par four.');
    expect(holeIntro(8)).toBe('Hole nine, par four.');
    expect(holeIntro(1)).toBe('Hole two, par three.');
    expect(holeIntro(3)).toBe('Hole four, par five.');
    expect(new Set(lines).size).toBe(lines.length);
  });

  it('every call a shot or hole can get is in VOICE_LINES', () => {
    const results = [
      { kind: 'holed' },
      { kind: 'water', splash: { x: 0, z: 0 }, drop: { x: 0, z: 0 } },
      ...(['fairway', 'rough', 'sand', 'green'] as const).map((surface) => ({
        kind: 'rest' as const,
        at: { x: 0, z: 0 },
        surface,
      })),
    ] as const;
    for (const result of results) {
      for (const quality of ['perfect', 'wobbly', 'duff'] as const) {
        for (const putt of [false, true]) {
          const line = shotCall(callKindFor(result, quality, putt));
          expect(VOICE_LINES).toContain(line);
        }
      }
    }
    for (const par of [3, 4, 5]) {
      for (let score = 1; score <= STROKE_CAP; score++) {
        for (const holed of [true, false]) {
          expect(VOICE_LINES).toContain(holeCall(nameFor(score, par, holed)));
        }
      }
    }
    expect(pillFor({ kind: 'water', splash: { x: 0, z: 0 }, drop: { x: 0, z: 0 } })).toBe(
      'Water +1',
    );
  });
});

describe('duff and wobble calls', () => {
  const rest = { kind: 'rest', at: { x: 0, z: 0 }, surface: 'fairway' } as const;
  it('name the shot by where it landed, or as a duff', () => {
    expect(shotCall(callKindFor(rest, 'perfect', false))).toBe('Fairway!');
    expect(shotCall(callKindFor(rest, 'wobbly', false))).toBe('Fairway!');
    expect(shotCall(callKindFor(rest, 'duff', false))).toBe('Duffed it.');
    expect(shotCall(callKindFor(rest, 'perfect', true))).toBe('Nice putt.');
    expect(shotCall(callKindFor(rest, 'duff', true))).toBe('Missed it.');
    expect(shotCall(callKindFor({ kind: 'holed' }, 'duff', false))).toBe('In the hole!');
  });
});

describe('plan', () => {
  it('has the documented shape', () => {
    const p: Plan = planShot(HOLES[0], { x: 0, z: 0 }, 'tee', 0);
    expect(Object.keys(p).sort()).toEqual(
      ['aimDeg', 'carry', 'club', 'dir', 'from', 'landing'].sort(),
    );
  });
});
