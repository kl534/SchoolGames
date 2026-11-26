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
} from '../src/games/fore/course';
import {
  clampTarget,
  clubFor,
  CUP_R,
  finishShot,
  MIN_PUTT,
  MIN_SHOT,
  MISS_FLOOR,
  pathAt,
  planShot,
  predictRest,
  reachFor,
  resolveShot,
  ringRadius,
  rollFrom,
  suggestTarget,
  TREE_HEIGHT,
  treeHit,
  type Outcome,
  type Plan,
  type Result,
  type XZ,
} from '../src/games/fore/shot';
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
  reactionFor,
  relText,
  roundOutcome,
  shotCall,
  startHole,
  STROKE_CAP,
  storedFor,
  totalVsPar,
  vsPar,
  type HoleState,
} from '../src/games/fore/rules';
import { bigMapSpan, bigMapWorld, cornerMapWorld } from '../src/games/fore/hud';
import { VOICE_LINES } from '../src/games/fore/voice';

const dir = resolve(import.meta.dirname, '../src/games/fore');
const RAD = Math.PI / 180;

describe('manifest', () => {
  it('is valid, matches its folder and is scored in points', () => {
    const manifest = JSON.parse(readFileSync(resolve(dir, 'game.json'), 'utf8'));
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.id).toBe('fore');
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

describe('reachFor', () => {
  it('is 240 off the tee and fairway, 192 in the rough, 50 in sand and 40 on the green', () => {
    expect(reachFor('tee')).toBe(240);
    expect(reachFor('fairway')).toBe(240);
    expect(reachFor('rough')).toBe(192);
    expect(reachFor('sand')).toBe(50);
    expect(reachFor('green')).toBe(40);
  });
});

describe('clubFor', () => {
  it('uses the putter on the green and the sand wedge in a bunker', () => {
    expect(clubFor('green', 12).id).toBe('putter');
    expect(clubFor('sand', 45).id).toBe('sand');
  });

  it('picks the shortest club that reaches, and its carry becomes the distance', () => {
    expect(clubFor('fairway', 30).id).toBe('sand');
    expect(clubFor('fairway', 31).id).toBe('sand');
    expect(clubFor('fairway', 50).id).toBe('sand');
    expect(clubFor('fairway', 96).id).toBe('iron7');
    expect(clubFor('fairway', 95).id).toBe('wedge');
    expect(clubFor('fairway', 131).id).toBe('iron5');
    expect(clubFor('fairway', 191).id).toBe('driver');
    expect(clubFor('tee', 240).id).toBe('driver');
    for (const lie of ['tee', 'fairway', 'rough', 'sand', 'green'] as const) {
      for (const d of [0.5, 12, 30, 51, 96, 150, 191, 240]) {
        expect(clubFor(lie, d).carry).toBe(d);
      }
    }
  });

  it('a ball in the rough flies 80 % of the club', () => {
    expect(clubFor('rough', 150).id).toBe('iron3'); // 190 x 0.8 = 152 reaches
    expect(clubFor('rough', 153).id).toBe('driver');
    expect(clubFor('rough', 40).id).toBe('sand');
    expect(clubFor('rough', 76).id).toBe('wedge'); // 95 x 0.8 = 76
    expect(clubFor('rough', 77).id).toBe('iron7');
  });
});

describe('clampTarget', () => {
  const h = HOLES[0];
  const from = { x: 0, z: 100 };
  const bearing = (p: XZ) => Math.atan2(p.x - from.x, p.z - from.z);
  const dist = (p: XZ) => Math.hypot(p.x - from.x, p.z - from.z);

  it('never goes under the minimum or over the reach', () => {
    for (const lie of ['tee', 'fairway', 'rough', 'sand'] as const) {
      expect(dist(clampTarget(h, from, lie, { x: 0, z: 101 }))).toBeCloseTo(MIN_SHOT, 9);
      expect(dist(clampTarget(h, from, lie, { x: 0, z: 900 }))).toBeCloseTo(reachFor(lie), 9);
    }
    const putt = { x: 0, z: h.length - 10 };
    expect(
      Math.hypot(...pair(clampTarget(h, putt, 'green', { x: 0, z: putt.z + 0.1 }), putt)),
    ).toBeCloseTo(MIN_PUTT, 9);
    expect(
      Math.hypot(...pair(clampTarget(h, putt, 'green', { x: 80, z: putt.z }), putt)),
    ).toBeCloseTo(40, 9);
  });

  it('turns a spot 120 degrees off the pin line back to 90', () => {
    const want = { x: 100 * Math.sin(120 * RAD), z: 100 + 100 * Math.cos(120 * RAD) };
    const got = clampTarget(h, from, 'fairway', want);
    expect(Math.abs(bearing(got))).toBeCloseTo(90 * RAD, 9);
    expect(dist(got)).toBeCloseTo(100, 9);
    const left = clampTarget(h, from, 'fairway', { x: -want.x, z: want.z });
    expect(bearing(left)).toBeCloseTo(-90 * RAD, 9);
  });

  it('leaves a spot already inside the limits alone', () => {
    const want = { x: -20, z: 160 };
    const got = clampTarget(h, from, 'fairway', want);
    expect(got.x).toBeCloseTo(want.x, 9);
    expect(got.z).toBeCloseTo(want.z, 9);
  });

  it('a spot on the ball goes straight at the pin at the minimum', () => {
    const got = clampTarget(h, { x: 5, z: 100 }, 'fairway', { x: 5, z: 100 });
    const toPin = Math.atan2(h.pin.x - 5, h.pin.z - 100);
    expect(Math.atan2(got.x - 5, got.z - 100)).toBeCloseTo(toPin, 9);
    expect(Math.hypot(got.x - 5, got.z - 100)).toBeCloseTo(MIN_SHOT, 9);
  });
});

function pair(a: XZ, b: XZ): [number, number] {
  return [a.x - b.x, a.z - b.z];
}

describe('ringRadius', () => {
  it('is 5 % of the distance, at least 3 yd; a putt 10 %, at least 1 yd', () => {
    expect(ringRadius(40, false)).toBe(3);
    expect(ringRadius(240, false)).toBe(12);
    expect(ringRadius(5, true)).toBe(1);
    expect(ringRadius(20, true)).toBe(2);
  });
});

describe('planShot', () => {
  const h = HOLES[0];
  const from = { x: 0, z: 0 };

  it('lands on the clamped spot, with its distance as the carry and the ring size', () => {
    const p = planShot(h, from, 'tee', { x: -30, z: 120 });
    expect(p.landing.x).toBeCloseTo(-30, 9);
    expect(p.landing.z).toBeCloseTo(120, 9);
    expect(p.carry).toBeCloseTo(Math.hypot(30, 120), 9);
    expect(p.club.carry).toBe(p.carry);
    expect(p.club.id).toBe('iron7'); // 124 yd
    expect(p.ringR).toBe(ringRadius(p.carry, false));
    expect(p.dir).toBeCloseTo(Math.atan2(-30, 120), 9);
    const far = planShot(h, from, 'tee', { x: 0, z: 999 });
    expect(far.carry).toBe(240);
    expect(far.club.id).toBe('driver');
  });

  it('a putt is the putter with the small ring', () => {
    const at = { x: 3, z: h.length - 9 };
    const p = planShot(h, at, 'green', h.pin);
    expect(p.club.id).toBe('putter');
    expect(p.carry).toBeCloseTo(Math.hypot(3, 9), 9);
    expect(p.ringR).toBe(ringRadius(p.carry, true));
    expect(p.landing.x).toBeCloseTo(h.pin.x, 9);
  });

  it('has the documented shape', () => {
    const p: Plan = planShot(h, from, 'tee', h.pin);
    expect(Object.keys(p).sort()).toEqual(
      ['carry', 'club', 'dir', 'from', 'landing', 'ringR'].sort(),
    );
  });
});

describe('resolveShot', () => {
  const h = HOLES[0];
  const plan = planShot(h, { x: 0, z: 0 }, 'tee', { x: 0, z: 150 });
  const off = (o: Outcome) => Math.hypot(o.land.x - plan.landing.x, o.land.z - plan.landing.z);

  it('a quick right answer lands exactly on the ring centre', () => {
    for (const used of [0, 2.5]) {
      const o = resolveShot(plan, true, used, 10, 1.3, 0.5);
      expect(o.quality).toBe('perfect');
      expect(o.land).toEqual(plan.landing);
    }
  });

  it('a slower right answer drifts out to 95 % of the ring at the full clock', () => {
    const slow = resolveShot(plan, true, 10, 10, 0, 0.5);
    expect(slow.quality).toBe('close');
    expect(off(slow)).toBeCloseTo(0.95 * plan.ringR, 9);
    const half = resolveShot(plan, true, 6.25, 10, 0, 0.5);
    expect(off(half)).toBeCloseTo(0.95 * plan.ringR * 0.5, 9);
  });

  it('angle 0 is straight on and pi/2 is right on screen (-x when the shot goes down +z)', () => {
    const ahead = resolveShot(plan, true, 10, 10, 0, 0.5);
    expect(ahead.land.z).toBeGreaterThan(plan.landing.z);
    expect(ahead.land.x).toBeCloseTo(plan.landing.x, 9);
    const right = resolveShot(plan, true, 10, 10, Math.PI / 2, 0.5);
    expect(right.land.x).toBeLessThan(plan.landing.x);
    expect(right.land.z).toBeCloseTo(plan.landing.z, 9);
  });

  it('a wrong answer lands 15 to 30 % of the carry away, never under 2.2 yd', () => {
    const lo = resolveShot(plan, false, 3, 10, 1, 0);
    const hi = resolveShot(plan, false, 3, 10, 1, 1);
    expect(lo.quality).toBe('miss');
    expect(off(lo)).toBeCloseTo(0.15 * plan.carry, 9);
    expect(off(hi)).toBeCloseTo(0.3 * plan.carry, 9);
    const short = planShot(h, { x: 0, z: 0 }, 'tee', { x: 0, z: 10 });
    const o = resolveShot(short, false, 3, 10, 1, 0);
    expect(
      Math.hypot(o.land.x - short.landing.x, o.land.z - short.landing.z),
    ).toBeGreaterThanOrEqual(MISS_FLOOR);
    expect(MISS_FLOOR).toBeCloseTo(2.2, 9);
  });

  it('a right answer is always inside the ring and a wrong one always outside it', () => {
    for (let i = 0; i < 500; i++) {
      const want = { x: (Math.random() - 0.5) * 100, z: 10 + Math.random() * 230 };
      const p = planShot(h, { x: 0, z: 0 }, 'tee', want);
      const used = Math.random() * 12;
      const angle = Math.random() * 2 * Math.PI;
      const u = Math.random();
      const right = resolveShot(p, true, used, 10, angle, u);
      const wrong = resolveShot(p, false, used, 10, angle, u);
      const dr = Math.hypot(right.land.x - p.landing.x, right.land.z - p.landing.z);
      const dw = Math.hypot(wrong.land.x - p.landing.x, wrong.land.z - p.landing.z);
      expect(dr).toBeLessThan(p.ringR);
      expect(dw).toBeGreaterThan(p.ringR);
      expect(dw).toBeGreaterThanOrEqual(MISS_FLOOR - 1e-9);
    }
  });

  it('a wrong putt is never holed', () => {
    for (let i = 0; i < 500; i++) {
      const d = 2 + Math.random() * 13;
      const at = { x: 0, z: h.length - d };
      const p = planShot(h, at, 'green', h.pin);
      const o = resolveShot(p, false, 3, 10, Math.random() * 2 * Math.PI, Math.random());
      expect(finishShot(h, p, o).kind).not.toBe('holed');
    }
  });
});

describe('rollFrom and finishShot', () => {
  const flat = HOLES[0];
  const drive = (h: Hole, want: XZ, from: XZ = { x: 0, z: 0 }, lie: 'tee' | 'fairway' = 'tee') => {
    const plan = planShot(h, from, lie, want);
    return { plan, outcome: { quality: 'perfect' as const, land: plan.landing } };
  };

  it('a driver landing on the fairway runs 24 yd on', () => {
    const { plan, outcome } = drive(flat, { x: 0, z: 240 });
    const rest = rollFrom(flat, plan, outcome.land);
    expect(rest.z).toBeCloseTo(264, 9);
    expect(finishShot(flat, plan, outcome)).toMatchObject({
      kind: 'rest',
      land: { z: 240 },
      at: { z: 264 },
      surface: 'fairway',
    });
  });

  it('landing in the rough runs 0.3 as far, and landing in sand stays', () => {
    const h: Hole = { ...flat, hazards: [{ kind: 'sand', at: { x: 40, z: 200, rx: 6, rz: 6 } }] };
    const rough = drive(h, { x: 40, z: 100 }, { x: 40, z: 0 });
    expect(rollFrom(h, rough.plan, rough.outcome.land).z).toBeCloseTo(100 + 100 * 0.05 * 0.3, 9);
    const inSand = drive(h, { x: 40, z: 200 }, { x: 40, z: 100 }, 'fairway');
    const r = finishShot(h, inSand.plan, inSand.outcome);
    expect(r).toMatchObject({ kind: 'rest', surface: 'sand', at: { x: 40, z: 200 } });
  });

  it('a roll into a bunker stops on its edge, in the sand', () => {
    const h: Hole = { ...flat, hazards: [{ kind: 'sand', at: { x: 0, z: 255, rx: 5, rz: 5 } }] };
    const { plan, outcome } = drive(h, { x: 0, z: 240 });
    const r = finishShot(h, plan, outcome);
    expect(r.kind).toBe('rest');
    if (r.kind !== 'rest') return;
    expect(r.surface).toBe('sand');
    expect(r.at.z).toBeGreaterThanOrEqual(249.5);
    expect(r.at.z).toBeLessThanOrEqual(250.5);
  });

  it('a roll into a pond is water, the splash at the entry', () => {
    const h: Hole = { ...flat, hazards: [{ kind: 'water', at: { x: 0, z: 255, rx: 5, rz: 5 } }] };
    const { plan, outcome } = drive(h, { x: 0, z: 240 });
    const r = finishShot(h, plan, outcome);
    expect(r.kind).toBe('water');
    if (r.kind !== 'water') return;
    expect(r.land.z).toBe(240);
    expect(r.splash.z).toBeGreaterThanOrEqual(249.5);
    expect(r.splash.z).toBeLessThanOrEqual(250.5);
    expect(surfaceAt(h, r.drop.x, r.drop.z)).not.toBe('water');
  });

  it('landing in a pond is a splash right there', () => {
    const h: Hole = { ...flat, hazards: [{ kind: 'water', at: { x: 0, z: 200, rx: 9, rz: 9 } }] };
    const { plan, outcome } = drive(h, { x: 0, z: 200 });
    expect(finishShot(h, plan, outcome)).toMatchObject({ kind: 'water', splash: { z: 200 } });
  });

  it('a putt rests where it lands', () => {
    const at = { x: 3, z: flat.length - 12 };
    const plan = planShot(flat, at, 'green', { x: 0, z: flat.length - 3 });
    const land = { x: 0.5, z: flat.length - 4 };
    expect(rollFrom(flat, plan, land)).toEqual(land);
    expect(finishShot(flat, plan, { quality: 'close', land })).toMatchObject({
      kind: 'rest',
      land,
      at: land,
      surface: 'green',
    });
  });

  it('holes anything that ends within the cup radius', () => {
    const plan = planShot(flat, { x: 0, z: flat.length - 12 }, 'green', flat.pin);
    const put = (x: number, z: number) =>
      finishShot(flat, plan, { quality: 'perfect', land: { x, z } }).kind;
    expect(put(0, flat.length)).toBe('holed');
    expect(put(CUP_R - 0.01, flat.length)).toBe('holed');
    expect(put(CUP_R + 0.05, flat.length)).toBe('rest');
  });

  it('a ball at rest knows its surface', () => {
    const plan = planShot(flat, { x: 0, z: 100 }, 'fairway', { x: 0, z: 200 });
    const at = (x: number, z: number) =>
      finishShot(flat, plan, { quality: 'close', land: { x, z } });
    expect(at(40, 200)).toMatchObject({ surface: 'rough' });
    expect(at(0, flat.length - 6)).toMatchObject({ surface: 'green' });
  });

  it('water drops dry, back towards where the shot was played from', () => {
    const w = HOLES[4];
    const p = planShot(w, { x: 0, z: 0 }, 'tee', { x: -14, z: 200 });
    const r = finishShot(w, p, { quality: 'perfect', land: { x: -14, z: 200 } });
    expect(r.kind).toBe('water');
    if (r.kind !== 'water') return;
    expect(r.splash).toEqual({ x: -14, z: 200 });
    expect(surfaceAt(w, r.drop.x, r.drop.z)).not.toBe('water');
    expect(r.drop.z).toBeLessThan(200);
    expect(r.drop.x / r.drop.z).toBeCloseTo(-14 / 200, 6);
  });

  it('falls back to the start when no dry ground is found', () => {
    const lake: Hole = {
      ...flat,
      hazards: [{ kind: 'water', at: { x: 0, z: 50, rx: 500, rz: 500 } }],
    };
    const p = planShot(lake, { x: 0, z: 40 }, 'fairway', { x: 0, z: 60 });
    const r = finishShot(lake, p, { quality: 'perfect', land: { x: 0, z: 60 } });
    expect(r).toEqual({
      kind: 'water',
      land: { x: 0, z: 60 },
      splash: { x: 0, z: 60 },
      drop: { x: 0, z: 40 },
    });
  });

  it('keeps the ball inside the rough wall', () => {
    const plan = planShot(flat, { x: 0, z: 100 }, 'fairway', { x: 0, z: 200 });
    const r = finishShot(flat, plan, { quality: 'perfect', land: { x: 500, z: 200 } });
    expect(r).toMatchObject({ kind: 'rest', land: { x: ROUGH_HALF, z: 200 } });
  });

  it('pathAt flies to the ring and bends late to where it touches down, as high for every quality', () => {
    const plan = planShot(flat, { x: 0, z: 0 }, 'tee', { x: 0, z: 150 });
    const miss = resolveShot(plan, false, 5, 10, Math.PI / 2, 0.5);
    expect(pathAt(plan, miss, 0)).toMatchObject({ x: 0, z: 0, h: 0 });
    const end = pathAt(plan, miss, 1);
    expect(end.x).toBeCloseTo(miss.land.x, 9);
    expect(end.z).toBeCloseTo(miss.land.z, 9);
    expect(pathAt(plan, miss, 0.5).h).toBeCloseTo(plan.club.apex * plan.carry, 9);
  });

  it('predictRest is a perfect shot to the ring', () => {
    const plan = planShot(flat, { x: 0, z: 0 }, 'tee', { x: 0, z: 240 });
    expect(predictRest(flat, plan)).toEqual(
      finishShot(flat, plan, { quality: 'perfect', land: plan.landing }),
    );
  });
});

describe('suggestTarget', () => {
  it('is the pin on the green', () => {
    const h = HOLES[1];
    const at = { x: 3, z: h.length - 12 };
    const t = suggestTarget(h, at, 'green');
    expect(t.x).toBeCloseTo(h.pin.x, 9);
    expect(t.z).toBeCloseTo(h.pin.z, 9);
  });

  it('stays inside the limits and never lands or rests in sand or water on any tee shot', () => {
    HOLES.forEach((h) => {
      const from = { x: 0, z: 0 };
      const t = suggestTarget(h, from, 'tee');
      expect(clampTarget(h, from, 'tee', t)).toEqual(t);
      const plan = planShot(h, from, 'tee', t);
      expect(plan.carry).toBeLessThanOrEqual(240 + 1e-9);
      expect(plan.carry).toBeGreaterThanOrEqual(MIN_SHOT - 1e-9);
      expect(surfaceAt(h, plan.landing.x, plan.landing.z)).not.toBe('sand');
      expect(surfaceAt(h, plan.landing.x, plan.landing.z)).not.toBe('water');
      const r = predictRest(h, plan);
      expect(r.kind).not.toBe('water');
      if (r.kind === 'rest') {
        expect(r.surface).not.toBe('sand');
        expect(r.tree).toBeUndefined();
      }
    });
  });
});

describe('afterShot, holeScore and holeOver', () => {
  const h = HOLES[0];
  const rest = (x: number, z: number, surface: 'fairway' | 'rough' = 'fairway') =>
    ({ kind: 'rest', land: { x, z }, at: { x, z }, surface }) as const;

  it('a shot adds a stroke and moves the ball', () => {
    const s = afterShot(startHole(h), h, rest(2, 200, 'rough'));
    expect(s).toMatchObject({ strokes: 1, penalties: 0, lie: 'rough', at: { x: 2, z: 200 } });
    expect(holeOver(s)).toBe(false);
  });

  it('water adds a penalty and a drop, with the lie of the drop', () => {
    const w = HOLES[4];
    const s = afterShot(startHole(w), w, {
      kind: 'water',
      land: { x: -14, z: 200 },
      splash: { x: -14, z: 200 },
      drop: { x: -5, z: 120 },
    });
    expect(s).toMatchObject({ strokes: 1, penalties: 1, at: { x: -5, z: 120 }, lie: 'fairway' });
    expect(holeScore(s)).toBe(2);
  });

  it('holed ends the hole', () => {
    const s = afterShot({ ...startHole(h), strokes: 2 }, h, { kind: 'holed', land: h.pin });
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
    const wet = afterShot(s, h, {
      kind: 'water',
      land: { x: 0, z: 1 },
      splash: { x: 0, z: 1 },
      drop: { x: 0, z: 0 },
    });
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
    expect(
      totalVsPar(
        pars.map((p) => p + 1),
        pars,
      ),
    ).toBe(9);
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

interface Played {
  state: HoleState;
  wet: boolean;
  trees: number;
  sand: boolean;
}

/** Plays a hole, `answer` deciding each shot's answer, time and (optionally) ring spot. */
function playHole(
  h: Hole,
  answer: (shot: number) => { right: boolean; used: number; want?: XZ },
): Played {
  let state = startHole(h);
  let wet = false;
  let sand = false;
  let trees = 0;
  for (let shot = 0; !holeOver(state); shot++) {
    if (shot > 20) throw new Error('hole never ended');
    const a = answer(shot);
    const want = a.want ?? suggestTarget(h, state.at, state.lie);
    const plan = planShot(h, state.at, state.lie, want);
    const outcome = resolveShot(
      plan,
      a.right,
      a.used,
      10,
      Math.random() * 2 * Math.PI,
      Math.random(),
    );
    const result = finishShot(h, plan, outcome);
    if (result.kind === 'water') wet = true;
    if (result.kind === 'rest' && result.tree !== undefined) trees++;
    if (result.kind === 'rest' && result.surface === 'sand') sand = true;
    state = afterShot(state, h, result);
  }
  return { state, wet, trees, sand };
}

describe('perfect play', () => {
  HOLES.forEach((h, i) => {
    it(`hole ${i + 1} (par ${h.par}) with the suggested ring and quick answers takes par or better and stays clear of water, sand and trees`, () => {
      const { state, wet, trees, sand } = playHole(h, () => ({ right: true, used: 0.2 }));
      expect(wet).toBe(false);
      expect(sand).toBe(false);
      expect(trees).toBe(0);
      expect(state.holed).toBe(true);
      expect(state.strokes).toBeLessThanOrEqual(h.par);
      expect(state.penalties).toBe(0);
    });
  });
});

describe('random play', () => {
  it('every hole ends inside the cap and the round adds up', () => {
    const rounds = runs(1000, 100);
    for (let r = 0; r < rounds; r++) {
      const quality = Math.random();
      const scores: number[] = [];
      HOLES.forEach((h) => {
        const { state } = playHole(h, () => ({
          right: Math.random() < quality,
          used: Math.random() * 10,
          want:
            Math.random() < 0.5
              ? undefined
              : { x: (Math.random() - 0.5) * 300, z: Math.random() * 500 - 20 },
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
  }, 60_000);
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
      'Off target.',
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
      { kind: 'holed', land: { x: 0, z: 0 } },
      { kind: 'water', land: { x: 0, z: 0 }, splash: { x: 0, z: 0 }, drop: { x: 0, z: 0 } },
      ...(['fairway', 'rough', 'sand', 'green'] as const).map((surface) => ({
        kind: 'rest' as const,
        land: { x: 0, z: 0 },
        at: { x: 0, z: 0 },
        surface,
      })),
    ] as const;
    for (const result of results) {
      for (const quality of ['perfect', 'close', 'miss'] as const) {
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
    expect(
      pillFor({
        kind: 'water',
        land: { x: 0, z: 0 },
        splash: { x: 0, z: 0 },
        drop: { x: 0, z: 0 },
      }),
    ).toBe('Water +1');
    expect(VOICE_LINES).toContain('Off target.');
    expect(VOICE_LINES).not.toContain('Duffed it.');
  });
});

describe('calls after a shot', () => {
  const rest = (surface: 'fairway' | 'green' | 'rough' | 'sand') =>
    ({ kind: 'rest', land: { x: 0, z: 0 }, at: { x: 0, z: 0 }, surface }) as const;
  it('name the shot by where it landed, or "Off target." when a miss still finds the short grass', () => {
    expect(shotCall(callKindFor(rest('fairway'), 'perfect', false))).toBe('Fairway!');
    expect(shotCall(callKindFor(rest('fairway'), 'close', false))).toBe('Fairway!');
    expect(shotCall(callKindFor(rest('fairway'), 'miss', false))).toBe('Off target.');
    expect(shotCall(callKindFor(rest('green'), 'miss', false))).toBe('Off target.');
    expect(shotCall(callKindFor(rest('rough'), 'miss', false))).toBe('In the rough.');
    expect(shotCall(callKindFor(rest('sand'), 'miss', false))).toBe('Bunker.');
    expect(shotCall(callKindFor(rest('fairway'), 'perfect', true))).toBe('Nice putt.');
    expect(shotCall(callKindFor(rest('green'), 'miss', true))).toBe('Missed it.');
    expect(shotCall(callKindFor({ kind: 'holed', land: { x: 0, z: 0 } }, 'miss', false))).toBe(
      'In the hole!',
    );
  });
});

// ---------- Trees and the caddie ----------

describe('trees', () => {
  it('stand only on holes 3, 6, 7 and 9, two or three each, well off the centre line', () => {
    HOLES.forEach((h, i) => {
      if ([2, 5, 6, 8].includes(i)) expect(h.trees.length).toBeGreaterThanOrEqual(2);
      else expect(h.trees).toEqual([]);
      expect(h.trees.length).toBeLessThanOrEqual(3);
      for (const t of h.trees) {
        expect(Math.abs(t.x - centreX(h, t.z)) - t.r).toBeGreaterThanOrEqual(22 - t.r);
        expect(Math.abs(t.x - centreX(h, t.z))).toBeGreaterThanOrEqual(22);
        expect(surfaceAt(h, t.x, t.z)).toBe('rough');
        expect(h.hazards.every((hz) => surfaceAt(h, t.x, t.z) !== hz.kind)).toBe(true);
      }
    });
  });

  const h: Hole = {
    ...HOLES[0],
    trees: [{ x: 30, z: 100, r: 4 }],
  };
  const shot = (from: XZ, want: XZ, end?: XZ) => {
    const plan = planShot(h, from, 'fairway', want);
    return {
      plan,
      outcome: { quality: 'perfect' as const, land: end ?? plan.landing },
    };
  };

  it('a low ball through a tree drops in the rough at the first point inside it', () => {
    // A driver off the tee is still low 10 yd out.
    const near: Hole = { ...HOLES[0], trees: [{ x: 30, z: 10, r: 4 }] };
    const plan = planShot(near, { x: 30, z: 0 }, 'tee', { x: 30, z: 240 });
    const outcome = { quality: 'perfect' as const, land: plan.landing };
    expect(pathAt(plan, outcome, 10 / 240).h).toBeLessThan(TREE_HEIGHT);
    const hit = treeHit(near, plan, outcome);
    expect(hit).not.toBeNull();
    expect(Math.hypot(hit!.at.x - 30, hit!.at.z - 10)).toBeLessThanOrEqual(4);
    expect(hit!.at.z).toBeLessThan(10);
    const r = finishShot(near, plan, outcome);
    expect(r).toMatchObject({ kind: 'rest', surface: 'rough', at: hit!.at });
    expect(r.kind === 'rest' && r.tree).toBeCloseTo(hit!.t, 9);
  });

  it('a ball above the tops flies over', () => {
    const plan = planShot(h, { x: 30, z: 0 }, 'tee', { x: 30, z: 240 });
    const outcome = { quality: 'perfect' as const, land: plan.landing };
    expect(pathAt(plan, outcome, 100 / 240).h).toBeGreaterThan(TREE_HEIGHT);
    expect(treeHit(h, plan, outcome)).toBeNull();
    expect(finishShot(h, plan, outcome)).toMatchObject({ kind: 'rest' });
  });

  it('a ball that misses the tree sideways is not stopped', () => {
    const { plan, outcome } = shot({ x: 0, z: 60 }, { x: 0, z: 150 });
    expect(treeHit(h, plan, outcome)).toBeNull();
  });

  it('a putt never hits a tree, and a ball standing in a tree can play on', () => {
    const near: Hole = { ...HOLES[0], trees: [{ x: 0, z: h.length - 5, r: 4 }] };
    const putt = planShot(near, { x: 0, z: near.length - 12 }, 'green', near.pin);
    expect(treeHit(near, putt, { quality: 'perfect', land: near.pin })).toBeNull();
    const inTree = planShot(h, { x: 30, z: 100 }, 'rough', { x: 30, z: 180 });
    const o = { quality: 'perfect' as const, land: { x: 30, z: 180 } };
    expect(treeHit(h, inTree, o)).toBeNull();
  });

  it('a miss into a tree stops there too, with no roll', () => {
    const plan = planShot(h, { x: 30, z: 60 }, 'fairway', { x: 30, z: 120 });
    const outcome = resolveShot(plan, false, 0, 10, 1, 0.5);
    const hit = treeHit(
      { ...h, trees: [{ x: outcome.land.x, z: outcome.land.z, r: 2 }] },
      plan,
      outcome,
    );
    expect(hit).not.toBeNull();
    const tree = { ...h, trees: [{ x: outcome.land.x, z: outcome.land.z, r: 2 }] };
    const r = finishShot(tree, plan, outcome);
    expect(r).toMatchObject({ kind: 'rest', surface: 'rough' });
    expect(r.kind === 'rest' && r.tree).toBeDefined();
    expect(r.kind === 'rest' && r.at).toEqual(r.land);
  });
});

describe('reactionFor', () => {
  const rest = (surface: 'fairway' | 'rough' | 'sand' | 'green'): Result => ({
    kind: 'rest',
    land: { x: 0, z: 100 },
    at: { x: 0, z: 100 },
    surface,
  });
  const water: Result = {
    kind: 'water',
    land: { x: 0, z: 1 },
    splash: { x: 0, z: 1 },
    drop: { x: 0, z: 0 },
  };
  const holed: Result = { kind: 'holed', land: { x: 0, z: 1 } };

  it('cheers a hole out and a full shot onto the green', () => {
    expect(reactionFor(holed, null)).toBe('cheer');
    expect(reactionFor(rest('green'), null)).toBe('cheer');
    expect(reactionFor(rest('green'), null, { putt: true })).toBe('idle');
  });

  it('groans at water and misses, even when a name is given', () => {
    expect(reactionFor(water, null)).toBe('groan');
    expect(reactionFor(rest('rough'), null, { quality: 'miss' })).toBe('groan');
    expect(reactionFor(holed, 'Birdie', { quality: 'miss' })).toBe('groan');
  });

  it('follows the hole name when the hole ends', () => {
    for (const n of ['Hole in one', 'Albatross', 'Eagle', 'Birdie']) {
      expect(reactionFor(holed, n)).toBe('cheer');
    }
    expect(reactionFor(holed, 'Par')).toBe('cheer');
    for (const n of ['Bogey', 'Double bogey', 'Triple bogey', '+4', 'Pick up']) {
      expect(reactionFor(rest('rough'), n)).toBe('groan');
    }
    expect(reactionFor(rest('fairway'), 'Par')).toBe('idle');
  });

  it('is idle for an ordinary shot', () => {
    expect(reactionFor(rest('fairway'), null)).toBe('idle');
    expect(reactionFor(rest('rough'), null)).toBe('idle');
    expect(reactionFor(rest('sand'), null)).toBe('idle');
  });
});

describe('the big map', () => {
  const span = { z0: 80, z1: 330 };
  const box = { w: 300, h: 600 };

  it('finds the world spot under a point, upright and rotated, with true proportions', () => {
    // Upright: 120 yd across by 250 down fit a 300 x 600 box at 2.4 px a yard (240 x 600... width wins).
    const scale = Math.min(300 / 120, 600 / 250);
    const left = (300 - 120 * scale) / 2;
    const p = bigMapWorld(false, span, box, left + 60 * scale, 0);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.z).toBeCloseTo(330, 6);
    // The right edge is -x, as screen-right is in the 3D view.
    const q = bigMapWorld(false, span, box, left + 120 * scale, 250 * scale);
    expect(q.x).toBeCloseTo(-60, 6);
    expect(q.z).toBeCloseTo(80, 6);
    // Rotated: the hole runs left to right, tee on the left; the bottom edge is -x.
    const wide = { w: 600, h: 300 };
    const s = Math.min(600 / 250, 300 / 120);
    const top = (300 - 120 * s) / 2;
    const a = bigMapWorld(true, span, wide, 0, top);
    expect(a.z).toBeCloseTo(80, 6);
    expect(a.x).toBeCloseTo(60, 6);
    const b = bigMapWorld(true, span, wide, 250 * s, top + 120 * s);
    expect(b.z).toBeCloseTo(330, 6);
    expect(b.x).toBeCloseTo(-60, 6);
  });

  it('a point right of centre is world -x, and world to map to world is the identity', () => {
    expect(cornerMapWorld(HOLES[0], { w: 84, h: 150 }, 63, 75).x).toBeLessThan(0);
    const scale = Math.min(300 / 120, 600 / 250);
    const left = (300 - 120 * scale) / 2;
    expect(bigMapWorld(false, span, box, left + 90 * scale, 100).x).toBeLessThan(0);
    // world -> map (the drawing's matrices) -> world
    const world = { x: -22, z: 150 };
    const px = (60 - world.x) * scale + left;
    const py = (span.z1 - world.z) * scale;
    const back = bigMapWorld(false, span, box, px, py);
    expect(back.x).toBeCloseTo(world.x, 6);
    expect(back.z).toBeCloseTo(world.z, 6);
    const cx = ((60 - world.x) / 120) * 84;
    const cy = (1 - world.z / HOLES[0].length) * 150;
    const c = cornerMapWorld(HOLES[0], { w: 84, h: 150 }, cx, cy);
    expect(c.x).toBeCloseTo(world.x, 6);
    expect(c.z).toBeCloseTo(world.z, 6);
  });

  it('shows 20 yd behind the ball to 280 yd ahead, or 30 yd past the pin', () => {
    expect(bigMapSpan(HOLES[0], 0)).toEqual({ z0: -20, z1: 280 });
    expect(bigMapSpan(HOLES[0], 200)).toEqual({ z0: 180, z1: 370 });
  });

  it('the corner map is 120 yd across and the hole long', () => {
    const p = cornerMapWorld(HOLES[0], { w: 84, h: 150 }, 42, 75);
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.z).toBeCloseTo(170, 9);
  });
});
