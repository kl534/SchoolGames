import { describe, expect, it } from 'vitest';
import {
  megaCuts,
  megaDuration,
  megaEvents,
  megaFloorY,
  megaFrame,
  megaLength,
  megaLocate,
  megaOffsets,
  megaSegments,
  megaWord,
  MEGA_MAX_H,
  MEGA_SPECS,
} from '../src/games/crash-course/mega/mega';
import { MEGA_IDS, type MegaId, type Passed } from '../src/games/crash-course/rules';
import { BIKE_Y, TAU, type Frame } from '../src/games/crash-course/stunts';

const PASSED: Passed[] = [0, 1, 2, 3];
const FPS = 60;

const cases: [MegaId, Passed][] = MEGA_IDS.flatMap((id) =>
  PASSED.map((p): [MegaId, Passed] => [id, p]),
);

function numbers(f: Frame): number[] {
  return [
    f.bike.x,
    f.bike.y,
    f.bike.pitch,
    f.bike.roll,
    f.bike.z,
    f.bike.squash,
    f.rider.x,
    f.rider.y,
    f.rider.rot,
  ];
}

describe.each(MEGA_IDS)('the %s course', (id) => {
  const spec = MEGA_SPECS[id];

  it('has three named elements of a sensible size', () => {
    expect(spec.id).toBe(id);
    expect(spec.title.length).toBeGreaterThan(0);
    expect(spec.emoji.length).toBeGreaterThan(0);
    expect(spec.elements).toHaveLength(3);
    for (const element of spec.elements) {
      expect(element.name.length).toBeGreaterThan(0);
      expect(element.length).toBeGreaterThanOrEqual(14);
      expect(element.length).toBeLessThanOrEqual(28);
      expect(element.height).toBeLessThanOrEqual(MEGA_MAX_H);
      expect(element.floorY).toBeLessThanOrEqual(0);
      for (const [from, to] of element.cuts) {
        expect(from).toBeGreaterThanOrEqual(0);
        expect(to).toBeGreaterThan(from);
        expect(to).toBeLessThanOrEqual(element.length);
      }
    }
  });

  it('adds the lengths up and places the elements one after the other', () => {
    const [a, b, c] = spec.elements;
    expect(megaLength(id)).toBe(a.length + b.length + c.length);
    expect(megaOffsets(id)).toEqual([0, a.length, a.length + b.length]);
    expect(megaFloorY(id)).toBe(Math.min(a.floorY, b.floorY, c.floorY));
    const offsets = megaOffsets(id);
    const expected = spec.elements.flatMap((e, i) =>
      e.cuts.map(([from, to]) => [offsets[i] + from, offsets[i] + to]),
    );
    expect(megaCuts(id)).toEqual(expected);
  });

  it('keeps the loops getting bigger', () => {
    const heights = spec.elements.map((e) => e.height);
    expect(heights).toEqual([...heights].sort((x, y) => x - y));
  });
});

describe('the courses', () => {
  it('are all different', () => {
    const specs = MEGA_IDS.map((id) => MEGA_SPECS[id]);
    expect(new Set(specs.map((s) => s.title)).size).toBe(specs.length);
    expect(new Set(specs.map((s) => s.emoji)).size).toBe(specs.length);
    const names = specs.flatMap((s) => s.elements.map((e) => e.name));
    expect(new Set(names).size).toBe(names.length);
  });

  it('are all in MEGA_SPECS', () => {
    expect(Object.keys(MEGA_SPECS).sort()).toEqual([...MEGA_IDS].sort());
  });
});

describe.each(cases)('%s with %i right', (id, passed) => {
  const spec = MEGA_SPECS[id];
  const plan = megaSegments(id, passed);
  const duration = megaDuration(id, passed);
  const frame = (t: number) => megaFrame(id, passed, t);

  it('plays the cleared elements back to back, then the crash on the next', () => {
    expect(plan).toHaveLength(passed < 3 ? passed + 1 : 3);
    plan.forEach((seg, i) => {
      expect(seg.index).toBe(i);
      expect(seg.outcome).toBe(i < passed ? 'clear' : 'crash');
      if (i > 0) expect(seg.start).toBeCloseTo(plan[i - 1].start + plan[i - 1].duration, 9);
    });
    expect(plan[0].start).toBe(0);
  });

  it('lasts the sum of its parts, each within its limits', () => {
    expect(duration).toBeCloseTo(
      plan.reduce((sum, seg) => sum + seg.duration, 0),
      9,
    );
    expect(duration).toBeLessThanOrEqual(15);
    for (const seg of plan) {
      if (seg.outcome === 'crash') {
        expect(seg.duration).toBeGreaterThanOrEqual(2.5);
        expect(seg.duration).toBeLessThanOrEqual(5.0);
      } else if (seg.index === 2) {
        expect(seg.duration).toBeGreaterThanOrEqual(3.0);
        expect(seg.duration).toBeLessThanOrEqual(5.5);
      } else {
        expect(seg.duration).toBeGreaterThanOrEqual(2.0);
        expect(seg.duration).toBeLessThanOrEqual(4.0);
      }
    }
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
      const after = megaLocate(id, passed, seg.start + 1e-6);
      expect(after.index).toBe(seg.index);
      expect(after.localT).toBeCloseTo(1e-6, 9);
    }
    for (const seg of plan) {
      const mid = megaLocate(id, passed, seg.start + seg.duration / 2);
      expect(mid).toMatchObject({ index: seg.index, outcome: seg.outcome });
      expect(mid.localT).toBeCloseTo(seg.duration / 2, 9);
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

  it('starts as the arrival pose', () => {
    const f = frame(0);
    expect(f.bike.x).toBeCloseTo(0, 9);
    expect(f.bike.y).toBeCloseTo(BIKE_Y, 9);
    expect(f.bike.pitch).toBeCloseTo(0, 9);
    expect(f.bike.roll).toBeCloseTo(0, 9);
    expect(f.bike.z).toBeCloseTo(0, 9);
    expect(f.bike.squash).toBe(1);
    expect(f.bike.grounded).toBe(true);
    expect(f.rider).toMatchObject({ mode: 'seated', pose: 'ride', face: 'happy' });
  });

  it('is smooth, finite and never sinks, also across the element boundaries', () => {
    let last = frame(0);
    for (let t = 1 / FPS; t <= duration + 1e-9; t += 1 / FPS) {
      const f = frame(t);
      const seg = megaLocate(id, passed, t);
      const floor = spec.elements[seg.index].floorY;
      for (const n of numbers(f)) expect(Number.isFinite(n)).toBe(true);
      if (seg.outcome === 'clear') expect(f.bike.y).toBeGreaterThanOrEqual(BIKE_Y - 0.05);
      else expect(f.bike.y).toBeGreaterThanOrEqual(floor + 0.2 - 1e-6);
      expect(
        Math.hypot(f.bike.x - last.bike.x, f.bike.y - last.bike.y),
        `bike at ${t}`,
      ).toBeLessThan(1.2);
      expect(Math.abs(f.bike.pitch - last.bike.pitch), `pitch at ${t}`).toBeLessThan(0.35);
      expect(Math.abs(f.bike.roll - last.bike.roll), `roll at ${t}`).toBeLessThan(0.35);
      if (f.rider.mode === 'free') {
        expect(f.rider.y).toBeGreaterThanOrEqual(floor - 0.05);
        if (last.rider.mode === 'free') {
          expect(
            Math.hypot(f.rider.x - last.rider.x, f.rider.y - last.rider.y),
            `rider at ${t}`,
          ).toBeLessThan(1.2);
          expect(Math.abs(f.rider.rot - last.rider.rot), `rider turn at ${t}`).toBeLessThan(0.35);
        }
      }
      last = f;
    }
  });

  it('hands over riding on the road at each cleared element, at a rolling speed', () => {
    const offsets = megaOffsets(id);
    for (const seg of plan.slice(1)) {
      const f = frame(seg.start);
      expect(f.bike.x).toBeCloseTo(offsets[seg.index], 9);
      expect(f.bike.y).toBeCloseTo(BIKE_Y, 9);
      expect(f.bike.grounded).toBe(true);
      expect(f.rider).toMatchObject({ mode: 'seated', pose: 'ride', face: 'happy' });
    }
    for (const seg of plan.filter((s) => s.outcome === 'clear')) {
      const startSpeed = (frame(seg.start + 0.15).bike.x - frame(seg.start).bike.x) / 0.15;
      const e = seg.start + seg.duration - 1e-3;
      const endSpeed = (frame(e).bike.x - frame(e - 0.15).bike.x) / 0.15;
      expect(startSpeed, `start of ${seg.index}`).toBeGreaterThanOrEqual(5);
      expect(startSpeed, `start of ${seg.index}`).toBeLessThanOrEqual(14);
      expect(endSpeed, `end of ${seg.index}`).toBeGreaterThanOrEqual(5);
      expect(endSpeed, `end of ${seg.index}`).toBeLessThanOrEqual(14);
    }
  });

  if (passed === 3) {
    it('ends settled and riding at the end of the course', () => {
      const f = frame(duration);
      expect(f.bike.x).toBeCloseTo(megaLength(id), 9);
      expect(f.bike.y).toBe(BIKE_Y);
      expect(f.bike.squash).toBe(1);
      expect(f.bike.grounded).toBe(true);
      expect(f.rider).toMatchObject({ mode: 'seated', pose: 'ride', face: 'happy' });
      const before = frame(duration - 1e-3);
      expect(Math.abs(before.bike.x - megaLength(id))).toBeLessThan(0.05);
      expect(Math.abs(before.bike.y - BIKE_Y)).toBeLessThan(0.01);
    });
  } else {
    it('comes to rest: nothing moves in the last second', () => {
      const a = numbers(frame(duration - 1));
      const b = numbers(frame(duration));
      a.forEach((value, i) => {
        const delta = Math.abs(value - b[i]);
        const isAngle = i === 2 || i === 3 || i === 8;
        const wrapped = isAngle ? Math.min(delta % TAU, TAU - (delta % TAU)) : delta;
        expect(wrapped, `value ${i}`).toBeLessThanOrEqual(0.02);
      });
    });
  }

  it('is deterministic and copes with any time', () => {
    for (const t of [0, 0.37, duration / 2, duration - 0.1, duration]) {
      expect(frame(t)).toEqual(frame(t));
      expect(megaEvents(id, passed)).toEqual(megaEvents(id, passed));
    }
    expect(frame(-5)).toEqual(frame(0));
    expect(frame(duration + 5)).toEqual(frame(duration));
    for (const t of [-1, duration + 1, 0.123, Number.NaN]) {
      for (const n of numbers(frame(t))) expect(Number.isFinite(n)).toBe(true);
    }
  });

  it('fires sorted events: a cheer per cleared element and one groan on a crash', () => {
    const events = megaEvents(id, passed);
    const offsets = megaOffsets(id);
    for (let i = 1; i < events.length; i++)
      expect(events[i].at).toBeGreaterThanOrEqual(events[i - 1].at);
    for (const e of events) {
      expect(e.at).toBeGreaterThanOrEqual(0);
      expect(e.at).toBeLessThanOrEqual(duration);
      expect(Number.isFinite(e.x) && Number.isFinite(e.y)).toBe(true);
      const seg = megaLocate(id, passed, e.at);
      const from = offsets[seg.index];
      const to = from + spec.elements[seg.index].length;
      expect(e.x, `${e.type} at ${e.at}`).toBeGreaterThanOrEqual(from - 3);
      expect(e.x, `${e.type} at ${e.at}`).toBeLessThanOrEqual(to + 3);
    }
    expect(events.filter((e) => e.type === 'cheer')).toHaveLength(passed);
    expect(events.filter((e) => e.type === 'groan')).toHaveLength(passed < 3 ? 1 : 0);
    expect(events.filter((e) => e.type === 'word')).toHaveLength(plan.length);
    for (const seg of plan) {
      const inside = events.filter((e) => e.at >= seg.start && e.at <= seg.start + seg.duration);
      // The one cheer of a cleared element comes near its end.
      const cheer = inside.filter((e) => e.type === 'cheer');
      if (seg.outcome === 'clear') {
        expect(cheer).toHaveLength(1);
        expect(cheer[0].at).toBeGreaterThan(seg.start + seg.duration * 0.6);
      } else {
        expect(cheer).toHaveLength(0);
      }
      expect(inside.filter((e) => e.type === 'word')).toHaveLength(1);
    }
    if (passed === 3) {
      const finale = plan[2];
      const inside = events.filter((e) => e.at >= finale.start);
      expect(inside.some((e) => e.type === 'confetti')).toBe(true);
      expect(inside.some((e) => e.type === 'word')).toBe(true);
    }
  });

  it('says the finale word when all are right and the crash word otherwise', () => {
    const word = megaWord(id, passed);
    expect(word.endsWith('!')).toBe(true);
    const element = spec.elements[passed === 3 ? 2 : passed];
    expect(word).toBe(passed === 3 ? element.clear.word : element.crash.word);
  });
});
