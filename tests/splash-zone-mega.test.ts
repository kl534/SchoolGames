import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { TAU, createFrame, seatOf, type Frame } from '../src/games/splash-zone/anim';
import {
  SIDE_MARGIN,
  SWING_IN,
  bandFraction,
  bandShift,
  fovFor,
  framingMid,
  playBand,
  stuntDistance,
  stuntPose,
} from '../src/games/splash-zone/layout';
import {
  MEGA_SPECS,
  megaDuration,
  megaEvents,
  megaFloorY,
  LOOK_BIAS_MAX,
  megaFramingAt,
  megaLookBias,
  megaSegmentFraming,
  megaFrame,
  megaLength,
  megaLocate,
  megaOffsets,
  megaRate,
  megaSegments,
  megaWord,
  megaWordAt,
} from '../src/games/splash-zone/mega/mega';
import {
  GATE_BEAT,
  MEGA_BANNER,
  MEGA_BONUS,
  MEGA_IDS,
  MEGA_PIECES,
  NORMALS_PER_WORLD,
  WORLD_MEGA,
  WORLD_NAMES,
  WORLD_ORDER,
  easeToward,
  nextWorld,
  startsMega,
  type MegaId,
  type Passed,
  type WorldId,
} from '../src/games/splash-zone/rules';
import { SLOW_RATE, focusOf as focusOf2 } from '../src/games/splash-zone/tricks';
import { PALETTES } from '../src/games/splash-zone/world';
import { createGate, createMegaCoursePool } from '../src/games/splash-zone/mega/mega-props';
import {
  BRIDGE,
  CRASH,
  FERRY,
  LEAF_REST,
  LIFEBOAT,
  PIER,
  ferryY,
  leafAngle,
} from '../src/games/splash-zone/mega/harbour-havoc';
import {
  FIZZLE,
  SANDBAR,
  SPOUT,
  TANGLE,
  T_FLICK,
  WHALE,
  sandbarY,
  spoutY,
  whaleY,
} from '../src/games/splash-zone/mega/whale-of-a-time';
import { spoutLevel, tailAngle } from '../src/games/splash-zone/mega/whale-of-a-time-props';
import {
  FETCH,
  SHARK,
  SHIP,
  TANGLE as SAIL_TANGLE,
  TUMBLE,
  WAVE,
  plankY,
  sharkMouth,
  sharkPose,
  waveLevel,
} from '../src/games/splash-zone/mega/jaws-some-jump';
import {
  BONK,
  BOULDERS,
  CHUTE,
  GEYSER,
  LAVA,
  SOOT,
  boulderLandAt,
  lavaY,
} from '../src/games/splash-zone/mega/geyser-blast';
import { geyserLevel } from '../src/games/splash-zone/mega/geyser-blast-props';
import {
  ARCH,
  BERG,
  BUMP,
  FLOE,
  FREEZE,
  SKID,
  bergY,
  floeY,
} from '../src/games/splash-zone/mega/penguin-parade';

const PASSED: Passed[] = [0, 1, 2, 3];

/** The worlds in the order the run visits them: id, name and the Mega each one holds. */
const WORLDS: [WorldId, string, MegaId][] = [
  ['lagoon', 'Lagoon', 'whale-of-a-time'],
  ['harbour', 'Harbour City', 'harbour-havoc'],
  ['iceberg', 'Iceberg Bay', 'penguin-parade'],
  ['volcano', 'Volcano Island', 'geyser-blast'],
  ['reef', 'Shark Reef', 'jaws-some-jump'],
];
const FPS = 60;
const DT = 1 / FPS;

const cases: [MegaId, Passed][] = MEGA_IDS.flatMap((id) =>
  PASSED.map((p): [MegaId, Passed] => [id, p]),
);

/** The angle's distance from the nearest whole number of turns. */
const offTurn = (angle: number) => Math.abs(angle - TAU * Math.round(angle / TAU));

function numbers(f: Frame): number[] {
  const k = f.ski;
  const r = f.rider;
  return [k.d, k.y, k.s, k.pitch, k.roll, k.yaw, r.d, r.y, r.s, r.pitch, r.roll, r.yaw];
}

// ---------- Worlds and the Mega count ----------

describe('worlds and the Mega count', () => {
  it('has seven normal turns, then the Mega', () => {
    expect(NORMALS_PER_WORLD).toBe(7);
    for (let n = 0; n <= 20; n++) expect(startsMega(n)).toBe(n === 7);
    expect(MEGA_PIECES).toBe(3);
    expect(MEGA_BONUS).toBe(500);
    expect(GATE_BEAT).toBe(0.5);
    expect(MEGA_BANNER).toBe(1.5);
  });

  it('visits the worlds in order and loops round', () => {
    expect(WORLD_ORDER).toEqual(['lagoon', 'harbour', 'iceberg', 'volcano', 'reef']);
    expect(WORLD_ORDER).toEqual(WORLDS.map(([id]) => id));
    expect(nextWorld('reef')).toBe('lagoon');
    WORLDS.forEach(([id], i) => expect(nextWorld(id)).toBe(WORLDS[(i + 1) % WORLDS.length][0]));
    expect(nextWorld(WORLDS[WORLDS.length - 1][0])).toBe('lagoon');
    let world: WorldId = 'lagoon';
    const seen: WorldId[] = [];
    for (let i = 0; i < 2 * WORLDS.length; i++) {
      seen.push(world);
      world = nextWorld(world);
    }
    expect(seen).toEqual([...WORLD_ORDER, ...WORLD_ORDER]);
  });

  it('gives every world a name, a palette and its own Mega', () => {
    expect(WORLD_NAMES).toEqual(Object.fromEntries(WORLDS.map(([id, name]) => [id, name])));
    expect(WORLD_MEGA).toEqual(Object.fromEntries(WORLDS.map(([id, , mega]) => [id, mega])));
    for (const world of WORLD_ORDER) {
      expect(PALETTES[world]).toBeDefined();
      expect(MEGA_SPECS[WORLD_MEGA[world]]).toBeDefined();
    }
    expect(PALETTES.harbour).toMatchObject({ skyTop: 0x7ab8e8, water: 0x2a8fb0 });
    expect(PALETTES.iceberg).toMatchObject({
      skyTop: 0xbfe6ff,
      skyBottom: 0xffffff,
      water: 0x3aa0c8,
    });
    expect(PALETTES.volcano).toMatchObject({
      skyTop: 0xff9a5c,
      skyBottom: 0xffd38a,
      water: 0x1aa39a,
    });
    expect(PALETTES.reef).toMatchObject({
      skyTop: 0xff7a59,
      skyBottom: 0xffd1a1,
      water: 0x1f8fb8,
    });
    // Every world looks different at a glance: its own sky and its own water.
    const palettes = WORLD_ORDER.map((w) => PALETTES[w]);
    expect(new Set(palettes.map((p) => p.water)).size).toBe(WORLD_ORDER.length);
    expect(new Set(palettes.map((p) => p.skyTop)).size).toBe(WORLD_ORDER.length);
    expect(new Set(Object.values(WORLD_MEGA)).size).toBe(WORLD_ORDER.length);
    expect(Object.keys(MEGA_SPECS).sort()).toEqual([...MEGA_IDS].sort());
  });
});

// ---------- The courses ----------

describe.each(MEGA_IDS)('the %s course', (id) => {
  const spec = MEGA_SPECS[id];

  it('has three named elements of a sensible size', () => {
    expect(spec.id).toBe(id);
    expect(spec.title.length).toBeGreaterThan(0);
    expect(spec.emoji.length).toBeGreaterThan(0);
    expect(spec.elements).toHaveLength(3);
    for (const element of spec.elements) {
      expect(element.name.length).toBeGreaterThan(0);
      expect(element.length).toBeGreaterThanOrEqual(30);
      expect(element.length).toBeLessThanOrEqual(70);
      expect(element.floorY).toBeLessThanOrEqual(0);
      expect(element.cue.d).toBeGreaterThan(0);
      expect(element.cue.d).toBeLessThanOrEqual(10);
      expect(element.clear.length).toBe(element.length);
    }
  });

  it('is 110 to 150 u long, with the elements one after the other', () => {
    const [a, b, c] = spec.elements;
    expect(megaLength(id)).toBe(a.length + b.length + c.length);
    expect(megaLength(id)).toBeGreaterThanOrEqual(110);
    expect(megaLength(id)).toBeLessThanOrEqual(150);
    expect(megaOffsets(id)).toEqual([0, a.length, a.length + b.length]);
    expect(megaFloorY(id)).toBe(Math.min(a.floorY, b.floorY, c.floorY));
  });
});

describe('the courses', () => {
  it('are all different', () => {
    const specs = MEGA_IDS.map((id) => MEGA_SPECS[id]);
    expect(new Set(specs.map((s) => s.title)).size).toBe(specs.length);
    expect(new Set(specs.map((s) => s.emoji)).size).toBe(specs.length);
    const names = specs.flatMap((s) => s.elements.map((e) => e.name));
    expect(new Set(names).size).toBe(names.length);
    const words = specs.flatMap((s) => s.elements.flatMap((e) => [e.clear.word, e.fail.word]));
    expect(new Set(words).size).toBe(words.length);
  });
});

// ---------- Every course with 0 to 3 right ----------

describe.each(cases)('%s with %i right', (id, passed) => {
  const spec = MEGA_SPECS[id];
  const plan = megaSegments(id, passed);
  const duration = megaDuration(id, passed);
  const frame = (t: number) => megaFrame(id, passed, t);

  it('plays the cleared elements back to back, then the wipeout on the next', () => {
    expect(plan).toHaveLength(passed < 3 ? passed + 1 : 3);
    plan.forEach((seg, i) => {
      expect(seg.index).toBe(i);
      expect(seg.outcome).toBe(i < passed ? 'clear' : 'fail');
      if (i > 0) expect(seg.start).toBeCloseTo(plan[i - 1].start + plan[i - 1].duration, 9);
    });
    expect(plan[0].start).toBe(0);
  });

  it('lasts the sum of its parts, each within its limits, 15 s of real time at most', () => {
    expect(duration).toBeCloseTo(
      plan.reduce((sum, seg) => sum + seg.duration, 0),
      9,
    );
    for (const seg of plan) {
      if (seg.outcome === 'fail') {
        expect(seg.duration).toBeGreaterThanOrEqual(2.5);
        expect(seg.duration).toBeLessThanOrEqual(6.0);
      } else {
        expect(seg.duration).toBeGreaterThanOrEqual(2.0);
        expect(seg.duration).toBeLessThanOrEqual(5.5);
      }
    }
    let real = 0;
    for (let t = 0; t < duration; t += 1 / 240) real += 1 / 240 / megaRate(id, passed, t);
    expect(real).toBeLessThanOrEqual(15);
  });

  it('finds the right segment and local time, clamped', () => {
    const first = megaLocate(id, passed, 0);
    expect(first).toMatchObject({ index: 0, start: 0, localT: 0 });
    for (const seg of plan.slice(1)) {
      const before = megaLocate(id, passed, seg.start - 1e-6);
      expect(before.index).toBe(seg.index - 1);
      expect(before.localT).toBeCloseTo(plan[seg.index - 1].duration, 5);
      const on = megaLocate(id, passed, seg.start);
      expect(on).toMatchObject({ index: seg.index, outcome: seg.outcome, localT: 0 });
    }
    const last = plan[plan.length - 1];
    for (const t of [duration, duration + 5, Number.POSITIVE_INFINITY]) {
      const end = megaLocate(id, passed, t);
      expect(end.index).toBe(last.index);
      expect(end.localT).toBeCloseTo(last.duration, 9);
    }
    expect(megaLocate(id, passed, -3)).toEqual(first);
    expect(megaLocate(id, passed, Number.NaN)).toEqual(first);
  });

  it('starts as the arrival pose, on the water, level, with the rider seated', () => {
    const f = frame(0);
    expect(f.ski).toMatchObject({ d: 0, y: 0, s: 0, pitch: 0, roll: 0, yaw: 0, wet: true });
    expect(f.rider).toMatchObject({ mode: 'seated', pose: 'ride', face: 'happy' });
    const seat = seatOf(f.ski);
    expect(f.rider.d).toBeCloseTo(seat.d, 9);
    expect(f.rider.y).toBeCloseTo(seat.y, 9);
  });

  it('is smooth, finite and never sinks, also across the element boundaries', () => {
    let last = createFrame();
    megaFrame(id, passed, 0, last);
    const prev = createFrame();
    for (let t = DT; t <= duration + 1e-9; t += DT) {
      Object.assign(prev, structuredClone(last));
      const f = frame(t);
      const seg = megaLocate(id, passed, t);
      const floor = spec.elements[seg.index].floorY;
      for (const n of numbers(f)) expect(Number.isFinite(n)).toBe(true);
      const k = f.ski;
      expect(k.y, `ski y at ${t}`).toBeGreaterThanOrEqual(floor);
      // 60 u/s at most for the ski and a free rider.
      expect(
        Math.hypot(k.d - last.ski.d, k.y - last.ski.y, k.s - last.ski.s),
        `ski at ${t}`,
      ).toBeLessThan(60 * DT);
      expect(Math.abs(k.pitch - last.ski.pitch), `pitch at ${t}`).toBeLessThan(0.5);
      expect(Math.abs(k.roll - last.ski.roll), `roll at ${t}`).toBeLessThan(0.5);
      expect(Math.abs(k.yaw - last.ski.yaw), `yaw at ${t}`).toBeLessThan(0.5);
      const r = f.rider;
      if (r.mode === 'seated') {
        const seat = seatOf(k);
        expect(r.d).toBeCloseTo(seat.d, 6);
        expect(r.y).toBeCloseTo(seat.y, 6);
        expect(r.s).toBeCloseTo(seat.s, 6);
      } else {
        expect(r.y, `rider y at ${t}`).toBeGreaterThanOrEqual(floor);
        if (last.rider.mode === 'free') {
          expect(
            Math.hypot(r.d - last.rider.d, r.y - last.rider.y, r.s - last.rider.s),
            `rider at ${t}`,
          ).toBeLessThan(60 * DT);
        }
      }
      last = structuredClone(f);
    }
  });

  it('hands over riding on the water at each cleared element, at a rolling speed', () => {
    const offsets = megaOffsets(id);
    for (const seg of plan.slice(1)) {
      const f = frame(seg.start);
      expect(f.ski.d).toBeCloseTo(offsets[seg.index], 6);
      expect(Math.abs(f.ski.y)).toBeLessThanOrEqual(0.3);
      expect(f.ski.wet).toBe(true);
      expect(offTurn(f.ski.pitch)).toBeLessThan(0.05);
      expect(offTurn(f.ski.roll)).toBeLessThan(0.05);
      expect(offTurn(f.ski.yaw)).toBeLessThan(0.05);
      expect(f.rider).toMatchObject({ mode: 'seated', pose: 'ride', face: 'happy' });
      // The frame is continuous across the boundary.
      const before = frame(seg.start - 1e-6);
      expect(Math.abs(f.ski.d - before.ski.d)).toBeLessThan(0.05);
      expect(Math.abs(f.ski.y - before.ski.y)).toBeLessThan(0.05);
    }
    for (const seg of plan.filter((s) => s.outcome === 'clear')) {
      const startSpeed = (frame(seg.start + 0.15).ski.d - frame(seg.start).ski.d) / 0.15;
      const e = seg.start + seg.duration - 1e-3;
      const endSpeed = (frame(e).ski.d - frame(e - 0.15).ski.d) / 0.15;
      expect(startSpeed, `start of ${seg.index}`).toBeGreaterThanOrEqual(5);
      expect(startSpeed, `start of ${seg.index}`).toBeLessThanOrEqual(14);
      expect(endSpeed, `end of ${seg.index}`).toBeGreaterThanOrEqual(5);
      expect(endSpeed, `end of ${seg.index}`).toBeLessThanOrEqual(14);
    }
  });

  if (passed === 3) {
    it('ends settled and riding on the water at the end of the course', () => {
      const f = frame(duration);
      expect(f.ski.d).toBeCloseTo(megaLength(id), 6);
      expect(Math.abs(f.ski.y)).toBeLessThanOrEqual(0.3);
      expect(offTurn(f.ski.pitch)).toBeLessThan(0.05);
      expect(offTurn(f.ski.roll)).toBeLessThan(0.05);
      expect(offTurn(f.ski.yaw)).toBeLessThan(0.05);
      expect(f.rider).toMatchObject({ mode: 'seated', pose: 'ride', face: 'happy' });
    });
  } else {
    it('ends with the rider floating and everything at rest in the last second', () => {
      const f = frame(duration);
      expect(f.rider.mode).toBe('free');
      expect(f.rider.pose).toBe('float');
      expect(f.rider.face).not.toBe('happy');
      expect(Math.abs(f.rider.y)).toBeLessThanOrEqual(0.6);
      expect(Math.abs(f.ski.y)).toBeLessThanOrEqual(0.6);
      const a = numbers(frame(duration - 1));
      const b = numbers(f);
      a.forEach((value, i) => {
        const angle = i === 3 || i === 4 || i === 5 || i >= 9;
        const delta = Math.abs(value - b[i]);
        expect(
          angle ? Math.min(delta % TAU, TAU - (delta % TAU)) : delta,
          `value ${i}`,
        ).toBeLessThan(0.02);
      });
    });
  }

  it('is deterministic and copes with any time', () => {
    for (const t of [0, 0.37, duration / 2, duration - 0.1, duration]) {
      expect(frame(t)).toEqual(frame(t));
    }
    expect(megaEvents(id, passed)).toEqual(megaEvents(id, passed));
    expect(frame(-5)).toEqual(frame(0));
    expect(frame(duration + 5)).toEqual(frame(duration));
    for (const t of [-1, duration + 1, 0.123, Number.NaN]) {
      for (const n of numbers(frame(t))) expect(Number.isFinite(n)).toBe(true);
    }
  });

  it('fires sorted events: a cheer per cleared element, one groan on a wipeout, a word each', () => {
    const events = megaEvents(id, passed);
    const offsets = megaOffsets(id);
    for (let i = 1; i < events.length; i++)
      expect(events[i].at).toBeGreaterThanOrEqual(events[i - 1].at);
    for (const e of events) {
      expect(e.at).toBeGreaterThanOrEqual(0);
      expect(e.at).toBeLessThanOrEqual(duration);
      expect(Number.isFinite(e.d) && Number.isFinite(e.y) && Number.isFinite(e.s)).toBe(true);
      const seg = megaLocate(id, passed, e.at);
      const from = offsets[seg.index];
      const to = from + spec.elements[seg.index].length;
      expect(e.d, `${e.type} at ${e.at}`).toBeGreaterThanOrEqual(from - 3);
      expect(e.d, `${e.type} at ${e.at}`).toBeLessThanOrEqual(to + 3);
    }
    expect(events.filter((e) => e.type === 'cheer')).toHaveLength(passed);
    expect(events.filter((e) => e.type === 'groan')).toHaveLength(passed < 3 ? 1 : 0);
    expect(events.filter((e) => e.type === 'word')).toHaveLength(plan.length);
    for (const seg of plan) {
      const inside = events.filter((e) => e.at >= seg.start && e.at <= seg.start + seg.duration);
      const cheer = inside.filter((e) => e.type === 'cheer');
      if (seg.outcome === 'clear') {
        expect(cheer).toHaveLength(1);
        expect(cheer[0].at).toBeGreaterThan(seg.start + seg.duration * 0.6);
        expect(inside.some((e) => e.type === 'sfx:splash')).toBe(true);
      } else {
        expect(cheer).toHaveLength(0);
        expect(inside.some((e) => e.type === 'sfx:splash')).toBe(true);
      }
    }
    if (passed === 3) {
      const finale = plan[2];
      const inside = events.filter((e) => e.at >= finale.start);
      expect(inside.some((e) => e.type === 'confetti')).toBe(true);
    }
  });

  it('says the finale word when all are right and the wipeout word otherwise', () => {
    const word = megaWord(id, passed);
    expect(word.endsWith('!')).toBe(true);
    const element = spec.elements[passed === 3 ? 2 : passed];
    expect(word).toBe(passed === 3 ? element.clear.word : element.fail.word);
    for (const seg of plan) {
      const at = megaWordAt(id, passed, seg.start + seg.duration / 2);
      expect(at.good).toBe(seg.outcome === 'clear');
      expect(at.text).toBe(spec.elements[seg.index][seg.outcome].word);
    }
  });

  it('slows down only in the finale', () => {
    let slowest = 1;
    for (let t = 0; t <= duration; t += 1 / 120) {
      const rate = megaRate(id, passed, t);
      slowest = Math.min(slowest, rate);
      expect(rate).toBeGreaterThanOrEqual(SLOW_RATE - 1e-9);
      expect(rate).toBeLessThanOrEqual(1);
      if (rate < 1) {
        expect(passed).toBe(3);
        expect(megaLocate(id, passed, t).index).toBe(2);
      }
    }
    if (passed === 3) expect(slowest).toBeCloseTo(SLOW_RATE, 6);
    else expect(slowest).toBe(1);
    expect(megaRate(id, passed, Number.NaN)).toBe(1);
  });
});

// ---------- The stunt camera over every course ----------

const SCREENS: [number, number][] = [
  [390, 844],
  [844, 390],
  [1024, 768],
];

/** A camera with the picture slid so its middle is the middle of the band. */
function probeCamera(width: number, height: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(fovFor(width / height), width / height, 0.3, 400);
  camera.setViewOffset(width, height, 0, bandShift(width, height), width, height);
  return camera;
}

/** The ski plus a seated rider (1.7 u tall) must be at least this much of the band's height. */
const MIN_SKI_BAND = 0.06;

describe.each(cases)('the stunt camera over %s with %i right', (id, passed) => {
  it.each(SCREENS)('keeps the ski, a free rider and the element in frame at %i x %i', (w, h) => {
    const band = playBand(w, h);
    const bandH = band.bottom - band.top;
    const aspect = w / h;
    const fov = fovFor(aspect);
    const camera = probeCamera(w, h);
    const frame = createFrame();
    const focus = { d: 0, y: 0, s: 0 };
    const plan = megaSegments(id, passed);
    const offsets = megaOffsets(id);
    const elements = MEGA_SPECS[id].elements;
    const boundaries = new Map(plan.slice(1).map((seg) => [Math.round(seg.start * FPS), seg]));
    const duration = megaDuration(id, passed);
    // What the game's camera aims at for a frame, as `updateCameraTargets` does.
    const targets = (t: number) => {
      const framing = megaFramingAt(id, passed, t);
      return {
        look: focus.d + megaLookBias(id, focus.d),
        dist: stuntDistance(framing, fov, bandFraction(w, h), aspect),
        mid: framingMid(framing),
      };
    };
    megaFrame(id, passed, 0, frame);
    focusOf2(frame, focus);
    // The camera snaps to its targets at the start, then eases after them.
    let aim = targets(0);
    let camD = aim.look;
    let camS = focus.s;
    let camDist = aim.dist;
    let camMid = aim.mid;
    const screen = (s: number, y: number, d: number) => {
      const p = new Vector3(s, y, -d).project(camera);
      return { x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h };
    };
    const place = () => {
      const pose = stuntPose(camS, -camD, camMid, camDist);
      camera.position.set(pose.x, pose.y, pose.z);
      camera.lookAt(pose.lookX, pose.lookY, pose.lookZ);
      camera.updateMatrixWorld();
    };
    let smallest = Infinity;
    for (let t = 0; t <= duration + 1e-9; t += DT) {
      megaFrame(id, passed, t, frame);
      focusOf2(frame, focus);
      aim = targets(t);
      camD = easeToward(camD, aim.look, 8, DT);
      camS = easeToward(camS, focus.s, 8, DT);
      camMid = easeToward(camMid, aim.mid, 5, DT);
      camDist = easeToward(camDist, aim.dist, 5, DT);
      if (t < SWING_IN) continue;
      place();
      const seen: { x: number; y: number; what: string }[] = [];
      if (frame.ski.visible) {
        seen.push({ ...screen(frame.ski.s, frame.ski.y, frame.ski.d), what: 'ski' });
        // The ski and a seated rider: how many band-heights tall are 1.7 u at the ski?
        const top = screen(frame.ski.s, frame.ski.y + 1.7, frame.ski.d);
        const base = screen(frame.ski.s, frame.ski.y, frame.ski.d);
        smallest = Math.min(smallest, Math.abs(base.y - top.y) / bandH);
      }
      if (frame.rider.mode === 'free' && frame.rider.visible) {
        seen.push({ ...screen(frame.rider.s, frame.rider.y, frame.rider.d), what: 'rider' });
      }
      const seg = boundaries.get(Math.round(t * FPS));
      if (seg && plan[seg.index - 1].outcome === 'clear') {
        // The next element's cue is in frame as the ski reaches it.
        const cue = elements[seg.index].cue;
        seen.push({ ...screen(0, cue.y, offsets[seg.index] + cue.d), what: 'next element' });
      }
      // The element being ridden is in frame while the ski is on it.
      const here = megaLocate(id, passed, t);
      const element = elements[here.index];
      const on = frame.ski.d - offsets[here.index];
      if (frame.ski.visible && on >= element.extent[0] && on <= element.extent[1]) {
        seen.push({
          ...screen(0, element.anchor.y, offsets[here.index] + element.anchor.d),
          what: `${element.name}`,
        });
      }
      for (const point of seen) {
        const where = `${id}:${passed} ${point.what} at ${t.toFixed(2)}s, ${w}x${h}`;
        expect(point.x, where).toBeGreaterThanOrEqual(SIDE_MARGIN * w);
        expect(point.x, where).toBeLessThanOrEqual((1 - SIDE_MARGIN) * w);
        expect(point.y, where).toBeGreaterThanOrEqual(band.top);
        expect(point.y, where).toBeLessThanOrEqual(band.bottom);
      }
    }
    expect(smallest, `smallest ski and rider at ${w}x${h}`).toBeGreaterThanOrEqual(MIN_SKI_BAND);
  });
});

describe('the Mega camera framing', () => {
  it.each(cases)('%s with %i right frames the element being ridden', (id, passed) => {
    const plan = megaSegments(id, passed);
    for (const seg of plan) {
      const own = megaSegmentFraming(id, passed, seg.index);
      expect(own.peak).toBeGreaterThan(own.low);
      expect(own.span ?? 0).toBeGreaterThan(0);
      // At any moment of an element the view fits at least that element's own framing.
      for (const at of [seg.start, seg.start + seg.duration / 2, seg.start + seg.duration]) {
        const f = megaFramingAt(id, passed, at);
        expect(f.peak).toBeGreaterThanOrEqual(own.peak - 1e-9);
        expect(f.low).toBeLessThanOrEqual(own.low + 1e-9);
        expect(f.span ?? 0).toBeGreaterThanOrEqual((own.span ?? 0) - 1e-9);
      }
    }
    for (let x = -5; x < megaLength(id) + 5; x += 0.5) {
      expect(Math.abs(megaLookBias(id, x))).toBeLessThanOrEqual(LOOK_BIAS_MAX + 1e-9);
    }
  });

  it.each(MEGA_IDS)('%s starts tighter than its finale needs', (id) => {
    expect(megaFramingAt(id, 3, 0).peak).toBeLessThan(megaSegmentFraming(id, 3, 2).peak);
  });
});

// ---------- The props ----------

describe('the course props', () => {
  it.each(MEGA_IDS)('%s builds, follows every moment of every stunt and disposes', (id) => {
    const pool = createMegaCoursePool();
    const course = pool.get(id);
    expect(pool.get(id)).toBe(course);
    expect(course.id).toBe(id);
    expect(course.length).toBe(megaLength(id));
    expect(course.object.children).toHaveLength(3);
    for (const passed of PASSED) {
      const duration = megaDuration(id, passed);
      for (let t = 0; t <= duration + 1e-9; t += 1 / 20) {
        course.update(passed, t);
        course.ambient(t);
      }
      course.update(passed, duration + 3);
      course.reset();
    }
    course.object.traverse((o) => {
      expect(Number.isFinite(o.position.x + o.position.y + o.position.z)).toBe(true);
      expect(Number.isFinite(o.scale.x + o.scale.y + o.scale.z)).toBe(true);
    });
    pool.dispose();
  });

  it('builds three checkpoint gates that light up and dispose', () => {
    for (const n of [1, 2, 3]) {
      const gate = createGate(n);
      expect(gate.number).toBe(n);
      expect(gate.object.visible).toBe(false);
      for (const state of ['idle', 'pass', 'miss'] as const) {
        gate.setState(state);
        gate.ambient(0.3);
      }
      gate.reset();
      gate.dispose();
    }
  });
});

// ---------- Whale of a Time ----------

const frameAt = (id: MegaId, passed: Passed, t: number) => megaFrame(id, passed, t);

describe('Whale of a Time specifics', () => {
  const [e1, e2, e3] = megaOffsets('whale-of-a-time');

  it('flies over the sandbar island with room to spare and never touches a palm', () => {
    const d1 = MEGA_SPECS['whale-of-a-time'].elements[0].clear.duration;
    for (let t = 0; t <= d1; t += DT) {
      const f = frameAt('whale-of-a-time', 1, t);
      expect(f.ski.y).toBeGreaterThanOrEqual(sandbarY(f.ski.d) - 1e-6);
      if (f.ski.d > SANDBAR.lip + 0.5 && f.ski.d < SANDBAR.end) {
        expect(f.ski.y - sandbarY(f.ski.d)).toBeGreaterThan(0.2);
      }
    }
    for (const [, s] of SANDBAR.palms) expect(Math.abs(s)).toBeGreaterThan(3);
    expect(e1).toBe(0);
  });

  it('tangles the rider in the palm fronds and drops him in the water', () => {
    const duration = megaDuration('whale-of-a-time', 0);
    const [, , crownY] = TANGLE.crown;
    let hung = 0;
    for (let t = 0; t <= duration; t += DT) {
      const f = frameAt('whale-of-a-time', 0, t);
      if (f.rider.mode === 'free' && f.rider.y > crownY - 0.4 && f.rider.pose === 'flail') {
        hung++;
        expect(f.rider.props.seaweed).toBe(true);
      }
    }
    expect(hung).toBeGreaterThan(0.8 * FPS);
    const end = frameAt('whale-of-a-time', 0, duration);
    expect(end.rider.props.seaweed).toBe(true);
    expect(end.rider.y).toBeLessThan(0);
    // The ski skids to the palm that is hit.
    const hit = frameAt('whale-of-a-time', 0, TANGLE.hitAt);
    expect(Math.abs(hit.ski.s - TANGLE.tree[1])).toBeLessThan(0.3);
    expect(Math.abs(hit.ski.d - TANGLE.tree[0])).toBeLessThan(0.6);
  });

  it('bounces off the top of the whale and flips once', () => {
    const plan = megaSegments('whale-of-a-time', 2);
    const top = frameAt('whale-of-a-time', 2, plan[1].start + WHALE.d / 12);
    expect(top.ski.d - e2).toBeCloseTo(WHALE.d, 1);
    expect(top.ski.y).toBeCloseTo(WHALE.top, 1);
    expect(frameAt('whale-of-a-time', 2, plan[2].start).ski.d).toBeCloseTo(e3, 6);
    // Up the whale's side the ski rides on its back.
    for (let t = 0.5; t < WHALE.d / 12; t += DT) {
      const g = frameAt('whale-of-a-time', 2, plan[1].start + t);
      expect(g.ski.y).toBeCloseTo(whaleY(g.ski.d - e2), 1);
    }
    const flipped = frameAt('whale-of-a-time', 2, plan[2].start - 1e-6);
    expect(flipped.ski.pitch).toBeCloseTo(TAU, 3);
  });

  it('is flicked off by the tail and thrown clear down the course', () => {
    const plan = megaSegments('whale-of-a-time', 1);
    const duration = megaDuration('whale-of-a-time', 1);
    let farthest = 0;
    let furthestOut = 0;
    for (let t = plan[1].start; t <= duration; t += DT) {
      const f = frameAt('whale-of-a-time', 1, t);
      farthest = Math.max(farthest, f.rider.mode === 'free' ? f.rider.d - e2 : 0);
      furthestOut = Math.max(furthestOut, f.ski.s, f.rider.mode === 'free' ? f.rider.s : 0);
    }
    // Thrown well on along the course and a little to the side.
    expect(farthest).toBeGreaterThan(20);
    expect(furthestOut).toBeGreaterThan(7);
    expect(tailAngle('fail', T_FLICK + 0.18)).toBeGreaterThan(1.2);
    expect(tailAngle('fail', 0)).toBeLessThan(0.3);
    expect(tailAngle('fail', 6)).toBeLessThan(0.3);
    expect(tailAngle('clear', 1)).toBeLessThan(0.3);
  });

  it('rides the spout up and does a triple backflip off it', () => {
    const plan = megaSegments('whale-of-a-time', 3);
    const start = plan[2].start;
    for (let t = SPOUT.foot / 12 + 0.05; t < SPOUT.foot / 12 + 0.65; t += DT) {
      const f = frameAt('whale-of-a-time', 3, start + t);
      expect(f.ski.y).toBeCloseTo(spoutY(f.ski.d - e3), 1);
      expect(spoutLevel('clear', t)).toBeCloseTo(1, 6);
    }
    const end = frameAt('whale-of-a-time', 3, megaDuration('whale-of-a-time', 3));
    // Three more turns on top of the whale bounce's one.
    expect(end.ski.pitch).toBeCloseTo(4 * TAU, 6);
    const rates = Array.from({ length: 1000 }, (_, i) =>
      megaRate('whale-of-a-time', 3, start + i * 0.005),
    );
    expect(Math.min(...rates)).toBeCloseTo(SLOW_RATE, 6);
  });

  it('lets the spout fizzle out before the ski comes down flat', () => {
    expect(spoutLevel('fail', FIZZLE.at - 0.01)).toBeGreaterThan(0.99);
    expect(spoutLevel('fail', FIZZLE.gone)).toBeCloseTo(0, 6);
    const plan = megaSegments('whale-of-a-time', 2);
    let topY = 0;
    let flat = 0;
    for (let t = 0; t <= plan[2].duration; t += DT) {
      const f = frameAt('whale-of-a-time', 2, plan[2].start + t);
      topY = Math.max(topY, f.ski.y);
      if (t > 2.2 && offTurn(f.ski.pitch) < 0.2) flat++;
    }
    expect(topY).toBeLessThan(5.5);
    expect(topY).toBeGreaterThan(2);
    expect(flat).toBeGreaterThan(0);
  });
});

// ---------- Harbour Havoc ----------

describe('Harbour Havoc specifics', () => {
  const [, h2, h3] = megaOffsets('harbour-havoc');

  it('leaps the ferry above the passengers, the cabin and the funnels', () => {
    const d1 = MEGA_SPECS['harbour-havoc'].elements[0].clear.duration;
    for (let t = 0; t <= d1; t += DT) {
      const f = frameAt('harbour-havoc', 1, t);
      expect(f.ski.y).toBeGreaterThanOrEqual(ferryY(f.ski.d) - 1e-6);
      if (f.ski.d > FERRY.cabinFrom - 1 && f.ski.d < FERRY.end + 1) {
        expect(f.ski.y).toBeGreaterThan(FERRY.cabinTop + 0.4);
      }
      // The lifeboat floats astern and the ski sails over it.
      if (Math.abs(f.ski.d - FERRY.boatD) < 2.2) expect(f.ski.y).toBeGreaterThan(1.5);
    }
    // The passengers stand to the sides of the middle line the ski flies along.
    for (const [, s] of FERRY.passengers) expect(Math.abs(s)).toBeGreaterThan(1);
    expect(FERRY.funnelS).toBeGreaterThan(1.5);
  });

  it('lands the short leap in the lifeboat, which tips them out', () => {
    const f = frameAt('harbour-havoc', 0, LIFEBOAT.landAt + 0.3);
    expect(Math.abs(f.ski.d - FERRY.boatD)).toBeLessThan(0.8);
    expect(f.ski.y).toBeLessThan(0.7);
    expect(f.rider.mode).toBe('seated');
    const after = frameAt('harbour-havoc', 0, LIFEBOAT.tipAt + 0.9);
    expect(after.rider.mode).toBe('free');
  });

  it('grinds along the railing, balancing, and hops off the end', () => {
    const start = megaSegments('harbour-havoc', 2)[1].start;
    let grinding = 0;
    for (let t = 0; t < 3.4; t += DT) {
      const f = frameAt('harbour-havoc', 2, start + t);
      if (f.ski.d - h2 > PIER.railFrom + 0.2 && f.ski.d - h2 < PIER.railTo - 0.2) {
        grinding++;
        expect(f.ski.y).toBeCloseTo(PIER.railY, 6);
        expect(f.ski.wet).toBe(false);
        expect(f.rider.pose).toBe('armsUp');
      }
    }
    expect(grinding).toBeGreaterThan(1.5 * FPS);
  });

  it('ploughs into the crab pots and is thrown into the water with a fish', () => {
    const start = megaSegments('harbour-havoc', 1)[1].start;
    const hit = frameAt('harbour-havoc', 1, start + CRASH.hitAt);
    expect(Math.abs(hit.ski.d - h2 - PIER.crab.d)).toBeLessThan(1);
    expect(Math.abs(hit.ski.s - PIER.crab.s)).toBeLessThan(1);
    const end = frameAt('harbour-havoc', 1, megaDuration('harbour-havoc', 1));
    expect(end.rider.props.fish).toBe(true);
    expect(end.rider.s).toBeGreaterThan(PIER.deckS[1]);
  });

  it('launches off the raised drawbridge into a double backflip with three fireworks', () => {
    const plan = megaSegments('harbour-havoc', 3);
    const start = plan[2].start;
    expect(leafAngle.clear(0)).toBeCloseTo(LEAF_REST, 6);
    expect(leafAngle.clear(1)).toBeCloseTo(0.44, 6);
    for (let t = BRIDGE.hinge / 12 + 0.1; t < BRIDGE.lip / 12; t += DT) {
      const f = frameAt('harbour-havoc', 3, start + t);
      expect(f.ski.y).toBeCloseTo((f.ski.d - h3 - BRIDGE.hinge) * Math.tan(leafAngle.clear(t)), 6);
    }
    const end = frameAt('harbour-havoc', 3, megaDuration('harbour-havoc', 3));
    expect(end.ski.pitch).toBeCloseTo(2 * TAU, 6);
    const fireworks = megaEvents('harbour-havoc', 3).filter((e) => e.type === 'fireworks');
    expect(fireworks).toHaveLength(3);
    for (const e of fireworks) expect(e.at).toBeGreaterThan(start + 1.7);
    for (const passed of [0, 1, 2] as const) {
      expect(megaEvents('harbour-havoc', passed).some((e) => e.type === 'fireworks')).toBe(false);
    }
  });

  it('drops the bridge under the ski, which slides off the end', () => {
    expect(leafAngle.fail(1.3)).toBeCloseTo(0.44, 6);
    expect(leafAngle.fail(2.4)).toBeLessThan(0.05);
    const plan = megaSegments('harbour-havoc', 2);
    let highest = 0;
    for (let t = 0; t <= plan[2].duration; t += DT) {
      highest = Math.max(highest, frameAt('harbour-havoc', 2, plan[2].start + t).ski.y);
    }
    expect(highest).toBeLessThan(6);
    const end = frameAt('harbour-havoc', 2, megaDuration('harbour-havoc', 2));
    expect(end.rider.mode).toBe('free');
  });
});

// ---------- Penguin Parade ----------

describe('Penguin Parade specifics', () => {
  const id = 'penguin-parade';
  const [, p2, p3] = megaOffsets(id);

  it('hops the row of penguins with room to spare', () => {
    const d1 = MEGA_SPECS[id].elements[0].clear.duration;
    for (let t = 0; t <= d1; t += DT) {
      const f = frameAt(id, 1, t);
      expect(f.ski.y).toBeGreaterThanOrEqual(floeY(f.ski.d) - 1e-6);
      for (const d of FLOE.penguins) {
        if (Math.abs(f.ski.d - d) < 1.2) {
          expect(f.ski.y, `over the penguin at ${d}`).toBeGreaterThan(
            FLOE.deckY + FLOE.penguinHeight + 0.3,
          );
        }
      }
    }
    // They stand on the middle line, one after another along the floe.
    expect(FLOE.penguins).toHaveLength(5);
    for (const d of FLOE.penguins) expect(d).toBeGreaterThan(FLOE.lip);
  });

  it('is bumped off by the penguins: the ski one way, the rider the other', () => {
    const hit = frameAt(id, 0, BUMP.at + 0.05);
    expect(hit.ski.y).toBeCloseTo(FLOE.deckY, 1);
    expect(Math.abs(hit.ski.d - FLOE.penguins[0])).toBeLessThan(1.5);
    const end = frameAt(id, 0, megaDuration(id, 0));
    expect(end.rider.mode).toBe('free');
    expect(Math.sign(end.rider.s)).toBe(-Math.sign(end.ski.s));
    expect(Math.abs(end.ski.s)).toBeGreaterThan(FLOE.halfWidth);
  });

  it('climbs the iceberg and slides down its chute on the ice', () => {
    const plan = megaSegments(id, 2);
    const start = plan[1].start;
    let highest = 0;
    let sliding = 0;
    for (let t = 0; t < plan[1].duration; t += DT) {
      const f = frameAt(id, 2, start + t);
      const d = f.ski.d - p2;
      if (d > BERG.foot + 0.5 && d < BERG.chuteEnd - 0.1) {
        sliding++;
        expect(f.ski.y).toBeCloseTo(bergY(d), 6);
        expect(f.ski.wet).toBe(false);
        highest = Math.max(highest, f.ski.y);
      }
    }
    expect(highest).toBeCloseTo(BERG.summitY, 1);
    expect(sliding).toBeGreaterThan(1.8 * FPS);
  });

  it('skids off the chute and ploughs into the snow bank, throwing the rider on', () => {
    const start = megaSegments(id, 1)[1].start;
    const hit = frameAt(id, 1, start + SKID.hitAt);
    expect(Math.abs(hit.ski.d - p2 - BERG.bank.d)).toBeLessThan(1.2);
    expect(Math.abs(hit.ski.s - BERG.bank.s)).toBeLessThan(1.2);
    const end = frameAt(id, 1, megaDuration(id, 1));
    expect(end.rider.mode).toBe('free');
    expect(end.rider.d).toBeGreaterThan(hit.ski.d + 3);
    expect(end.ski.y).toBeLessThan(0.6);
  });

  it('spins twice through the opening of the arch, which the ski clears', () => {
    const plan = megaSegments(id, 3);
    const start = plan[2].start;
    let through = 0;
    for (let t = 0; t < plan[2].duration; t += DT) {
      const f = frameAt(id, 3, start + t);
      if (Math.abs(f.ski.d - p3 - ARCH.d) < 1.5) {
        through++;
        expect(f.ski.y).toBeGreaterThan(0.8);
        expect(f.ski.y + 1.7).toBeLessThan(ARCH.cy + ARCH.radius);
        expect(Math.abs(f.ski.s)).toBeLessThan(ARCH.radius - 1.5);
      }
    }
    expect(through).toBeGreaterThan(5);
    const end = frameAt(id, 3, megaDuration(id, 3));
    expect(end.ski.roll).toBeCloseTo(2 * TAU, 6);
    expect(megaEvents(id, 3).some((e) => e.type === 'confetti')).toBe(true);
  });

  it('freezes the rider into an ice cube under the arch, who then floats on his own', () => {
    const start = megaSegments(id, 2)[2].start;
    const before = frameAt(id, 2, start + FREEZE.at - 0.1);
    expect(before.rider.mode).toBe('seated');
    const frozen = frameAt(id, 2, start + FREEZE.at + FREEZE.hold - 0.05);
    expect(frozen.rider.mode).toBe('seated');
    expect(frozen.rider.pose).toBe('flail');
    expect(Math.abs(frozen.ski.d - p3 - ARCH.d)).toBeLessThan(5);
    const end = frameAt(id, 2, megaDuration(id, 2));
    expect(end.rider).toMatchObject({ mode: 'free', pose: 'float', face: 'scared' });
    const pool = createMegaCoursePool();
    const course = pool.get(id);
    course.update(2, megaSegments(id, 2)[2].start + FREEZE.at - 0.2);
    const cubes = () => {
      let shown = 0;
      course.object.traverse((o) => {
        if (
          o.visible &&
          o.type === 'Group' &&
          o.children.length === 1 &&
          o.parent?.type === 'Group'
        )
          shown++;
      });
      return shown;
    };
    const idle = cubes();
    course.update(2, megaSegments(id, 2)[2].start + FREEZE.at + 0.5);
    expect(cubes()).toBeGreaterThan(idle);
    pool.dispose();
  });
});

// ---------- Geyser Blast ----------

describe('Geyser Blast specifics', () => {
  const id = 'geyser-blast';
  const [, g2, g3] = megaOffsets(id);

  it('rides over the lava arch and leaps off its far end', () => {
    const d1 = MEGA_SPECS[id].elements[0].clear.duration;
    let crown = 0;
    for (let t = 0; t <= d1; t += DT) {
      const f = frameAt(id, 1, t);
      expect(f.ski.y).toBeGreaterThanOrEqual(lavaY(f.ski.d) - 1e-6);
      if (f.ski.d > LAVA.foot + 0.5 && f.ski.d < LAVA.lipD - 0.1) {
        crown++;
        expect(f.ski.y).toBeCloseTo(lavaY(f.ski.d), 6);
        expect(f.ski.wet).toBe(false);
      }
    }
    expect(crown).toBeGreaterThan(1.5 * FPS);
    expect(frameAt(id, 1, LAVA.lipD / 12 + 0.5).ski.y).toBeGreaterThan(LAVA.lipY + 1);
  });

  it('blows soot into the rider face from the vent and sends the blind ski off the side', () => {
    const start = SOOT.at;
    expect(frameAt(id, 0, start - 0.1).rider.face).toBe('happy');
    expect(frameAt(id, 0, start + 0.3).rider.face).toBe('sooty');
    expect(Math.abs(frameAt(id, 0, start).ski.d - LAVA.vent)).toBeLessThan(0.5);
    const end = frameAt(id, 0, megaDuration(id, 0));
    expect(end.rider).toMatchObject({ mode: 'free', pose: 'float', face: 'sooty' });
    expect(Math.abs(end.ski.s)).toBeGreaterThan(LAVA.halfWidth);
    expect(Math.abs(end.rider.s)).toBeGreaterThan(LAVA.halfWidth);
  });

  it('weaves round every coconut-boulder, which lands before the ski gets there', () => {
    const d2 = MEGA_SPECS[id].elements[1].clear.duration;
    BOULDERS.list.forEach(({ d, s }, i) => {
      const t = d / 12;
      const f = frameAt(id, 2, megaSegments(id, 2)[1].start + t);
      expect(Math.abs(f.ski.s - s), `clear of boulder ${i}`).toBeGreaterThan(BOULDERS.radius + 1.2);
      expect(boulderLandAt(i)).toBeLessThan(t);
      expect(boulderLandAt(i)).toBeGreaterThan(BOULDERS.fall);
    });
    expect(frameAt(id, 2, megaSegments(id, 2)[1].start + d2).ski.s).toBeCloseTo(0, 6);
    for (let t = 0; t <= d2; t += DT) {
      expect(frameAt(id, 2, megaSegments(id, 2)[1].start + t).ski.wet).toBe(true);
    }
  });

  it('gets bonked on the head by the second boulder and sees stars', () => {
    const dodged = frameAt(id, 1, megaSegments(id, 1)[1].start + 13 / 12);
    expect(Math.abs(dodged.ski.s)).toBeGreaterThan(2);
    const hit = frameAt(id, 1, megaSegments(id, 1)[1].start + BONK.at);
    expect(Math.abs(hit.ski.d - g2 - BONK.d)).toBeLessThan(0.1);
    expect(Math.abs(hit.ski.s - BONK.s)).toBeLessThan(0.1);
    const dizzy = frameAt(id, 1, megaSegments(id, 1)[1].start + BONK.at + 0.6);
    expect(dizzy.rider).toMatchObject({ mode: 'seated', pose: 'dizzy', face: 'dizzy' });
    const stars = megaEvents(id, 1).filter((e) => e.type === 'stars');
    expect(stars.length).toBeGreaterThanOrEqual(4);
    const end = frameAt(id, 1, megaDuration(id, 1));
    expect(end.rider).toMatchObject({ mode: 'free', pose: 'float', face: 'dizzy' });
  });

  it('rides the steam geyser up and does a double corkscrew off it', () => {
    const plan = megaSegments(id, 3);
    const start = plan[2].start;
    let highest = 0;
    for (let t = 0; t < plan[2].duration; t += DT) {
      highest = Math.max(highest, frameAt(id, 3, start + t).ski.y);
    }
    expect(highest).toBeGreaterThan(GEYSER.crownY + 3);
    const end = frameAt(id, 3, megaDuration(id, 3));
    expect(end.ski.roll).toBeCloseTo(2 * TAU, 6);
    expect(end.ski.s).toBeCloseTo(0, 6);
    expect(frameAt(id, 3, start).ski.d).toBeCloseTo(g3, 6);
    expect(geyserLevel('clear', 0)).toBe(0);
    expect(geyserLevel('clear', 1)).toBeCloseTo(1, 6);
    expect(megaEvents(id, 3).some((e) => e.type === 'confetti')).toBe(true);
  });

  it('shoots the rider up on a surge and brings him down slowly under a seaweed parachute', () => {
    const plan = megaSegments(id, 2);
    const start = plan[2].start;
    expect(geyserLevel('fail', CHUTE.shotAt + 0.3)).toBeGreaterThan(1.1);
    let peak = 0;
    let fastest = 0;
    let last = frameAt(id, 2, start + CHUTE.peakAt).rider.y;
    for (let t = CHUTE.peakAt; t < CHUTE.landAt - 0.1; t += DT) {
      const f = frameAt(id, 2, start + t);
      peak = Math.max(peak, f.rider.y);
      fastest = Math.max(fastest, (last - f.rider.y) * FPS);
      last = f.rider.y;
    }
    expect(peak).toBeCloseTo(CHUTE.peakY, 0);
    expect(fastest).toBeLessThan(7);
    const end = frameAt(id, 2, megaDuration(id, 2));
    expect(end.rider).toMatchObject({ mode: 'free', pose: 'float', face: 'soaked' });
    expect(end.rider.props.seaweed).toBe(true);
    // The ski comes down on its own, well before the rider does.
    expect(frameAt(id, 2, start + CHUTE.shotAt + 1.6).ski.y).toBeCloseTo(0, 1);
  });
});

// ---------- Jaws-Some Jump ----------

describe('Jaws-Some Jump specifics', () => {
  const id = 'jaws-some-jump';
  const [, j2, j3] = megaOffsets(id);

  it('jumps the shark well above its back and its dorsal fin', () => {
    const d1 = MEGA_SPECS[id].elements[0].clear.duration;
    for (let t = 0; t <= d1; t += DT) {
      const f = frameAt(id, 1, t);
      if (f.ski.d > SHARK.nose - 1 && f.ski.d < SHARK.centerD + SHARK.half + 1) {
        expect(f.ski.y).toBeGreaterThan(SHARK.backY + 1);
      }
      if (Math.abs(f.ski.d - SHARK.finD) < 2) expect(f.ski.y).toBeGreaterThan(SHARK.finTop + 1);
    }
    expect(sharkPose('clear', 1.2)).toEqual({ lift: 0, pitch: 0, yaw: 0, roll: 0 });
  });

  it('is caught in the shark jaws, shaken like a fetch toy and tossed away', () => {
    const hold = (FETCH.catchAt + FETCH.tossAt) / 2;
    const f = frameAt(id, 0, hold);
    const mouth = sharkMouth('fail', hold);
    expect(Math.abs(f.ski.d - mouth.d - 0.4)).toBeLessThan(1e-6);
    expect(Math.abs(f.ski.y - mouth.y)).toBeLessThan(1e-6);
    expect(f.ski.y).toBeGreaterThan(2.5);
    expect(sharkPose('fail', hold).lift).toBeGreaterThan(1);
    const end = frameAt(id, 0, megaDuration(id, 0));
    expect(end.ski.d).toBeGreaterThan(FETCH.skiLand[0]);
    expect(Math.sign(end.ski.s)).toBe(-Math.sign(end.rider.s));
    expect(end.rider).toMatchObject({ mode: 'free', pose: 'float' });
    // The shark settles back into the water before the end.
    expect(sharkPose('fail', megaDuration(id, 0)).lift).toBe(0);
  });

  it('carves through the barrel of the wave, which builds up first', () => {
    const plan = megaSegments(id, 2);
    const start = plan[1].start;
    let inside = 0;
    for (let t = 0; t < plan[1].duration; t += DT) {
      const f = frameAt(id, 2, start + t);
      expect(f.ski.wet).toBe(true);
      if (f.ski.d - j2 > WAVE.from && f.ski.d - j2 < WAVE.to) {
        inside++;
        expect(Math.abs(f.ski.s - WAVE.axisS)).toBeLessThan(WAVE.radius - 1.5);
      }
    }
    expect(inside).toBeGreaterThan(1.5 * FPS);
    expect(waveLevel('clear', 0)).toBeLessThan(0.3);
    expect(waveLevel('clear', 1)).toBeCloseTo(1, 6);
  });

  it('is tumbled by the curl coming down mid-barrel', () => {
    const start = megaSegments(id, 1)[1].start;
    expect(waveLevel('fail', TUMBLE.at - 0.05)).toBeGreaterThan(0.9);
    expect(waveLevel('fail', TUMBLE.at + 0.6)).toBeLessThan(0.3);
    const before = frameAt(id, 1, start + TUMBLE.at - 0.05);
    expect(before.rider.mode).toBe('seated');
    expect(before.ski.d - j2).toBeGreaterThan(WAVE.from);
    const end = frameAt(id, 1, megaDuration(id, 1));
    expect(end.rider).toMatchObject({ mode: 'free', pose: 'float' });
    expect(end.ski.roll).toBeCloseTo(2 * TAU + Math.PI, 6);
  });

  it('flies through the hole in each sail and does a double backflip with three fireworks', () => {
    const plan = megaSegments(id, 3);
    const start = plan[2].start;
    expect(plankY(SHIP.lip)).toBeCloseTo(SHIP.lipY, 6);
    for (const sail of SHIP.sails) {
      // The moment the ski crosses the sail's plane, the hole's middle is half a unit or so over it.
      let best = Number.POSITIVE_INFINITY;
      let height = 0;
      for (let t = 0; t < plan[2].duration; t += 1 / 240) {
        const g = megaFrame(id, 3, start + t);
        const away = Math.abs(g.ski.d - j3 - sail.d);
        if (away < best) {
          best = away;
          height = g.ski.y;
        }
      }
      expect(Math.abs(height + 0.7 - sail.y), `hole of the sail at ${sail.d}`).toBeLessThan(
        SHIP.holeRadius - 0.9,
      );
    }
    const end = frameAt(id, 3, megaDuration(id, 3));
    expect(end.ski.pitch).toBeCloseTo(2 * TAU, 6);
    const fireworks = megaEvents(id, 3).filter((e) => e.type === 'fireworks');
    expect(fireworks).toHaveLength(3);
    for (const e of fireworks) expect(e.at).toBeGreaterThan(start + 2.0);
    for (const passed of [0, 1, 2] as const) {
      expect(megaEvents(id, passed).some((e) => e.type === 'fireworks')).toBe(false);
    }
  });

  it('flies short into the first sail and hangs there tangled before it all drops', () => {
    const start = megaSegments(id, 2)[2].start;
    const hit = frameAt(id, 2, start + SAIL_TANGLE.hitAt);
    expect(Math.abs(hit.ski.d - j3 - SAIL_TANGLE.hit[0])).toBeLessThan(0.1);
    // Below the hole, so it meets the canvas.
    expect(hit.ski.y).toBeLessThan(SHIP.sails[0].y - SHIP.holeRadius);
    const hang = frameAt(id, 2, start + (SAIL_TANGLE.hitAt + SAIL_TANGLE.dropAt) / 2);
    expect(hang.rider).toMatchObject({ mode: 'free', pose: 'flail', face: 'scared' });
    expect(hang.rider.y).toBeGreaterThan(4);
    const end = frameAt(id, 2, megaDuration(id, 2));
    expect(end.rider).toMatchObject({ mode: 'free', pose: 'float' });
    expect(end.ski.y).toBeLessThan(0.6);
  });
});

// ---------- The comic word follows the element ----------

describe.each(cases)('the comic word of %s with %i right', (id, passed) => {
  it('belongs to the element being ridden, and changes when the next one starts', () => {
    const plan = megaSegments(id, passed);
    const elements = MEGA_SPECS[id].elements;
    const words = megaEvents(id, passed).filter((e) => e.type === 'word');
    for (const seg of plan) {
      const own = elements[seg.index][seg.outcome];
      for (let t = seg.start; t < seg.start + seg.duration - 1e-6; t += 1 / 20) {
        const w = megaWordAt(id, passed, t);
        expect(w.text, `at ${t.toFixed(2)}s`).toBe(own.word);
        expect(w.good).toBe(seg.outcome === 'clear');
      }
      // The word event of an element fires inside that element's own window.
      const inside = words.filter((e) => e.at >= seg.start && e.at <= seg.start + seg.duration);
      expect(inside.length).toBeGreaterThanOrEqual(1);
      for (const e of inside) expect(megaWordAt(id, passed, e.at).text).toBe(own.word);
    }
    // Neighbouring elements never share a word.
    for (let i = 1; i < plan.length; i++) {
      expect(megaWordAt(id, passed, plan[i].start).text).not.toBe(
        megaWordAt(id, passed, plan[i].start - 1e-6).text,
      );
    }
  });
});
