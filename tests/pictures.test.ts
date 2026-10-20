import { describe, expect, it, vi } from 'vitest';
import { seededRandom } from '../src/shared/random';
import { HOPPERS, pickCritters } from '../src/shared/pictures/critters';
import {
  buildPicture,
  countSpeech,
  MAX_COUNT,
  STAGE_W,
  type Picture,
} from '../src/shared/pictures/plan';
import {
  createPicturePlayer,
  FINALE,
  STEP_MIN,
  type PicturePlayer,
} from '../src/shared/pictures/player';
import { canUse, pickWay, WAYS, type Way } from '../src/shared/pictures/ways';
import { TOPICS, type FactVisual } from '../src/shared/topics';
import { mathFact } from '../src/shared/topics/math';
import { runs } from './helpers/full';

const add = (a: number, b: number): FactVisual => ({ kind: 'add', a, b });
const sub = (a: number, b: number): FactVisual => ({ kind: 'subtract', a, b });
const mul = (a: number, b: number): FactVisual => ({ kind: 'multiply', a, b });
const div = (a: number, b: number): FactVisual => ({ kind: 'divide', a, b });

const looks = { critters: pickCritters(10, seededRandom(3)), hopper: HOPPERS[0] };
const picture = (visual: FactVisual, way: Way): Picture => buildPicture(visual, way, looks);
const counts = (p: Picture) => p.steps.map((s) => s.count);
const captions = (p: Picture) => p.steps.map((s) => s.caption);
const critters = (p: Picture) => p.sprites.filter((s) => s.type === 'critter').length;

describe('pickWay', () => {
  it('walks the ways in order and wraps', () => {
    const picked: Way[] = [];
    let turn = 0;
    for (let i = 0; i < 7; i++) {
      const pick = pickWay(add(8, 5), turn)!;
      picked.push(pick.way);
      turn = pick.nextTurn;
    }
    expect(picked).toEqual([
      'add-join',
      'add-line',
      'add-make-ten',
      'add-join',
      'add-line',
      'add-make-ten',
      'add-join',
    ]);
    expect(WAYS.subtract).toEqual(['sub-take-away', 'sub-line', 'sub-cross-out', 'sub-gap']);
  });

  it('skips ways that do not fit the fact', () => {
    // 8 + 2 reaches ten exactly, so no make-ten: after the line comes the join again.
    expect(pickWay(add(8, 2), 2)).toEqual({ way: 'add-join', nextTurn: 1 });
    // 25 - 3 is too big for the gap picture.
    expect(pickWay(sub(25, 3), 3)).toEqual({ way: 'sub-take-away', nextTurn: 1 });
    expect(pickWay(sub(13, 5), 3)).toEqual({ way: 'sub-gap', nextTurn: 4 });
  });

  it('copes with a broken turn', () => {
    expect(pickWay(add(1, 1), -4)?.way).toBe('add-join');
    expect(pickWay(add(1, 1), Number.NaN)?.way).toBe('add-join');
    expect(pickWay(add(1, 1), 1.5)?.way).toBe('add-join');
  });

  it('has no ways for multiply and divide yet', () => {
    expect(pickWay(mul(7, 3), 0)).toBeNull();
    expect(pickWay(div(12, 3), 0)).toBeNull();
  });
});

describe('canUse', () => {
  it('follows the table at its edges', () => {
    expect(canUse(add(7, 3), 'add-make-ten')).toBe(false);
    expect(canUse(add(7, 4), 'add-make-ten')).toBe(true);
    expect(canUse(add(10, 5), 'add-make-ten')).toBe(false);
    expect(canUse(add(16, 4), 'add-make-ten')).toBe(false);
    expect(canUse(add(16, 5), 'add-make-ten')).toBe(true);
    expect(canUse(sub(20, 3), 'sub-gap')).toBe(true);
    expect(canUse(sub(21, 3), 'sub-gap')).toBe(false);
    expect(canUse(mul(10, 6), 'mul-groups')).toBe(true);
    expect(canUse(mul(10, 7), 'mul-groups')).toBe(false);
    expect(canUse(mul(11, 2), 'mul-groups')).toBe(false);
    expect(canUse(mul(10, 10), 'mul-array')).toBe(true);
    expect(canUse(mul(11, 3), 'mul-array')).toBe(false);
    expect(canUse(mul(10, 16), 'mul-add-up')).toBe(true);
    expect(canUse(mul(11, 2), 'mul-add-up')).toBe(false);
    expect(canUse(mul(10, 10), 'mul-split')).toBe(false);
    expect(canUse(mul(12, 4), 'mul-split')).toBe(true);
    expect(canUse(mul(7, 14), 'mul-split')).toBe(true);
    expect(canUse(div(60, 10), 'div-share')).toBe(true);
    expect(canUse(div(66, 11), 'div-share')).toBe(false);
    expect(canUse(div(60, 6), 'div-groups')).toBe(true);
    expect(canUse(div(60, 5), 'div-groups')).toBe(false);
    expect(canUse(div(100, 10), 'div-rows')).toBe(true);
    expect(canUse(div(110, 10), 'div-rows')).toBe(false);
    expect(canUse(div(256, 16), 'div-line')).toBe(true);
  });

  it('never uses another operation’s way', () => {
    expect(canUse(add(1, 1), 'sub-line')).toBe(false);
    expect(canUse(sub(5, 1), 'add-line')).toBe(false);
  });
});

describe('counts and captions', () => {
  it('counts each way as the design says', () => {
    expect(counts(picture(add(8, 5), 'add-join'))).toEqual([8, 9, 10, 11, 12, 13]);
    expect(counts(picture(add(8, 5), 'add-line'))).toEqual([8, 9, 10, 11, 12, 13]);
    expect(counts(picture(add(8, 5), 'add-make-ten'))).toEqual([8, 10, 13]);
    expect(captions(picture(add(8, 5), 'add-make-ten'))).toEqual([
      undefined,
      '8 + 2 = 10',
      '10 + 3 = 13',
    ]);
    expect(counts(picture(sub(13, 5), 'sub-take-away'))).toEqual([13, 12, 11, 10, 9, 8]);
    expect(counts(picture(sub(13, 5), 'sub-line'))).toEqual([13, 12, 11, 10, 9, 8]);
    expect(counts(picture(sub(13, 5), 'sub-cross-out'))).toEqual([13, 12, 11, 10, 9, 8]);
    expect(counts(picture(sub(13, 5), 'sub-gap'))).toEqual([null, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('makes a ten from a number above ten', () => {
    const p = picture(add(14, 7), 'add-make-ten');
    expect(counts(p)).toEqual([14, 20, 21]);
    expect(captions(p)).toEqual([undefined, '14 + 6 = 20', '20 + 1 = 21']);
  });
});

/** Every add and subtract fact in the topics, once. */
function mathVisuals(): FactVisual[] {
  const seen = new Map<string, FactVisual>();
  for (const topic of TOPICS) {
    for (const fact of topic.facts) {
      if (fact.visual)
        seen.set(`${fact.visual.kind}:${fact.visual.a}:${fact.visual.b}`, fact.visual);
    }
  }
  return [...seen.values()].filter((v) => WAYS[v.kind].length > 0);
}

const sample = <T>(items: T[], count: number): T[] => {
  if (count >= items.length) return items;
  const random = seededRandom(11);
  return [...items].sort(() => random() - 0.5).slice(0, count);
};

describe('every picture', () => {
  it('is sound for every math fact and usable way', () => {
    const visuals = sample(mathVisuals(), runs(10_000, 60));
    expect(visuals.length).toBeGreaterThan(50);
    // Problems are collected, not asserted one by one: there are tens of thousands of checks.
    const problems: string[] = [];
    let checked = 0;
    for (const visual of visuals) {
      const fact = mathFact(visual.kind, visual.a, visual.b);
      for (const way of WAYS[visual.kind]) {
        if (!canUse(visual, way)) continue;
        checked++;
        const label = `${fact.statement} ${way}`;
        const check = (ok: boolean, what: string) => {
          if (!ok && problems.length < 20) problems.push(`${label}: ${what}`);
        };
        const p = picture(visual, way);
        const said = counts(p).filter((c): c is number => c !== null);
        check(said.at(-1) === Number(fact.answer), `last count ${said.at(-1)}`);
        check(
          said.every((c) => Number.isInteger(c) && c >= 1 && c <= MAX_COUNT),
          'a count is out of range',
        );
        const rising = way.startsWith('add') || way === 'sub-gap';
        check(
          said.every((c, i) => i === 0 || (rising ? c > said[i - 1] : c < said[i - 1])),
          `counts do not ${rising ? 'rise' : 'fall'}`,
        );
        const { a, b } = visual;
        const stepCount = way === 'add-make-ten' ? 3 : way === 'sub-gap' ? a - b + 1 : b + 1;
        check(p.steps.length === stepCount, `${p.steps.length} steps, not ${stepCount}`);
        const critterCount =
          way === 'add-line' || way === 'sub-line'
            ? 1
            : way === 'add-join' || way === 'add-make-ten' || way === 'sub-gap'
              ? a + b
              : a;
        check(critters(p) === critterCount, `${critters(p)} critters, not ${critterCount}`);
        check(p.width === STAGE_W, 'width');
        check(p.height >= 120 && p.height <= 360, `height ${p.height}`);

        for (let done = 0; done <= p.steps.length; done++) {
          for (const t of [0, 0.5, 1]) {
            const poses = p.at(done, t);
            check(poses.length === p.sprites.length, 'pose count');
            poses.forEach((pose, i) => {
              check(Object.values(pose).every(Number.isFinite), `sprite ${i} not finite`);
              if (pose.opacity > 0.05) {
                check(pose.x >= 0 && pose.x <= STAGE_W, `sprite ${i} x ${pose.x}`);
                check(pose.y >= 0 && pose.y <= p.height, `sprite ${i} y ${pose.y}`);
              }
            });
          }
          // Critters at rest never overlap.
          const rest = p.at(done, 0);
          const seen: { x: number; y: number; size: number }[] = [];
          p.sprites.forEach((sprite, i) => {
            if (sprite.type !== 'critter' || rest[i].opacity <= 0.05) return;
            for (const other of seen) {
              const d = Math.hypot(rest[i].x - other.x, rest[i].y - other.y);
              check(d >= 0.9 * (sprite.size / 0.8) - 0.01, `step ${done}: critters ${d} apart`);
            }
            seen.push({ x: rest[i].x, y: rest[i].y, size: sprite.size });
          });
        }
      }
    }
    expect(problems).toEqual([]);
    expect(checked).toBeGreaterThan(100);
  });
});

describe('player', () => {
  const small = () => picture(add(2, 2), 'add-join');

  /** A `say` that records lines and ends them when asked. */
  function voice(instant: boolean) {
    const lines: string[] = [];
    const ends: (() => void)[] = [];
    return {
      lines,
      ends,
      say: (text: string, onEnd: () => void) => {
        lines.push(text);
        if (instant) onEnd();
        else ends.push(onEnd);
      },
    };
  }

  /** Runs the player in small frames for `seconds`. */
  const run = (player: PicturePlayer, seconds: number) => {
    for (let t = 0; t < seconds - 1e-9; t += 0.05) player.update(0.05);
  };

  it('waits to start and then runs every step in STEP_MIN with an instant voice', () => {
    const v = voice(true);
    const done = [] as number[];
    const player = createPicturePlayer(small(), v.say);
    run(player, 5);
    expect(player.state.phase).toBe('waiting');
    expect(v.lines).toEqual([]);
    player.start(() => done.push(1));
    run(player, 3 * STEP_MIN + 0.01);
    expect(v.lines).toEqual(['2.', '3.', '4.']);
    expect(player.state.done).toBe(3);
    expect(player.state.phase).toBe('finale');
    run(player, FINALE + 0.1);
    expect(player.state.phase).toBe('done');
    expect(done).toEqual([1]);
    run(player, 5);
    expect(done).toEqual([1]);
    expect(player.state.count).toBe(4);
  });

  it('waits for a clip that ends later, and says the counts in order', () => {
    const v = voice(false);
    const player = createPicturePlayer(small(), v.say);
    player.start(() => undefined);
    run(player, 5);
    expect(v.lines).toEqual(['2.']);
    expect(player.state.done).toBe(0);
    v.ends[0]();
    run(player, 0.05);
    expect(player.state.done).toBe(1);
    run(player, 1);
    expect(v.lines).toEqual(['2.', '3.']);
  });

  it('holds on update(0)', () => {
    const v = voice(true);
    const player = createPicturePlayer(small(), v.say);
    player.start(() => undefined);
    run(player, 0.2);
    const before = { ...player.state };
    for (let i = 0; i < 20; i++) player.update(0);
    expect(player.state).toEqual(before);
  });

  it('shows a caption while its step is the latest', () => {
    const v = voice(true);
    const player = createPicturePlayer(picture(add(8, 5), 'add-make-ten'), v.say);
    player.start(() => undefined);
    run(player, 0.5);
    expect(player.state.caption).toBeUndefined();
    run(player, 0.7);
    expect(player.state.caption).toBe('8 + 2 = 10');
  });

  it('stop silences later callbacks', () => {
    const v = voice(false);
    const done = vi.fn();
    const player = createPicturePlayer(small(), v.say);
    player.start(done);
    run(player, 1);
    player.stop();
    v.ends.forEach((end) => end());
    run(player, 20);
    expect(v.lines).toEqual(['2.']);
    expect(done).not.toHaveBeenCalled();
  });

  it('says silent steps nothing', () => {
    const v = voice(true);
    const player = createPicturePlayer(picture(sub(5, 2), 'sub-gap'), v.say);
    player.start(() => undefined);
    run(player, STEP_MIN + 0.1);
    expect(v.lines).toEqual([]);
    expect(player.state.done).toBe(1);
    run(player, STEP_MIN);
    expect(v.lines).toEqual([countSpeech(1)]);
  });
});
