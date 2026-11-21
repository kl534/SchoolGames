import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDev } from '../src/games/type-brawl/dev';
import {
  CAMERA_D,
  SLOTS,
  WIDE,
  clampLabelY,
  fovFor,
  halfWidthFor,
  hudTop,
  labelMinY,
  lookYFor,
  pickSlot,
  spawnOffset,
} from '../src/games/type-brawl/layout';
import { labelFontPx, staggerLabels } from '../src/games/type-brawl/labels';
import {
  LAUNCH_SECONDS,
  MOVES,
  launchPath,
  mirrorPose,
  moveFrame,
  reactionFrame,
} from '../src/games/type-brawl/moves';
import { neutralPose } from '../src/games/type-brawl/person';
import {
  BLOCKS,
  HIT_RING,
  HIT_WRONG,
  HP_MAX,
  MAX_THUGS,
  MOVES_BY_CLASS,
  REFILL_SCRAP,
  RING_MIN,
  SLACK_MIN,
  SLACK_START,
  attackerOf,
  blockPlan,
  blockPoints,
  emptyStats,
  hitHero,
  killPoints,
  lockThug,
  mastered,
  moveClassOf,
  pickMove,
  refill,
  resultsText,
  ringSeconds,
  runWpm,
  scrapBonus,
  scrapKinds,
  scrapSize,
  slackFor,
  speedGroupPasses,
  spkFor,
  streakMultiplier,
  type Candidate,
  type Kind,
  type MoveClass,
  type MoveId,
} from '../src/games/type-brawl/rules';
import { VOICE_LINES } from '../src/games/type-brawl/voice';
import { seededRandom } from '../src/shared/random';
import { planChunk, targetText } from '../src/shared/typing/chunks';
import { knownChars, TYPING_LEVELS } from '../src/shared/typing/course';
import { TYPING_VOICE_LINES } from '../src/shared/typing/lines';
import { emptyTyping, HISTORY, levelUp, openLevel } from '../src/shared/typing/progress';
import { runs } from './helpers/full';

describe('parseDev', () => {
  it('has no hooks by default', () => {
    expect(parseDev('')).toEqual({
      level: null,
      start: false,
      lesson: false,
      spk: null,
      chunk: null,
      thugs: null,
      kind: null,
      lock: null,
      typed: 0,
      wrong: false,
      hp: null,
      scrap: null,
      ramp: null,
      ring: null,
      freeze: false,
      move: null,
      at: null,
      levelup: false,
      keys: null,
      hooked: false,
    });
  });

  it('reads every hook', () => {
    const dev = parseDev(
      '?level=7&start=1&lesson=1&spk=1.4&chunk=fj%20k&thugs=2&kind=bruiser&lock=3&typed=2&wrong=1' +
        '&hp=60&scrap=4&ramp=5&ring=0.85&freeze=1&move=flying-kick&at=0.55&levelup=1&keys=fjf%20',
    );
    expect(dev).toEqual({
      level: 7,
      start: true,
      lesson: true,
      spk: 1.4,
      chunk: 'fj k',
      thugs: 2,
      kind: 'bruiser',
      lock: 3,
      typed: 2,
      wrong: true,
      hp: 60,
      scrap: 4,
      ramp: 5,
      ring: 0.85,
      freeze: true,
      move: 'flying-kick',
      at: 0.55,
      levelup: true,
      keys: 'fjf ',
      hooked: true,
    });
  });

  it('keeps numbers in range and ignores what is malformed', () => {
    const bad = parseDev(
      'level=0&spk=-1&thugs=4&kind=boss&lock=5&typed=x&hp=0&hp=101&scrap=0&ramp=21&ring=1.5&move=headbutt&at=-1&keys=' +
        'a'.repeat(13),
    );
    expect(bad.level).toBeNull();
    expect(bad.spk).toBeNull();
    expect(bad.thugs).toBeNull();
    expect(bad.kind).toBeNull();
    expect(bad.lock).toBeNull();
    expect(bad.typed).toBe(0);
    expect(bad.hp).toBeNull();
    expect(bad.scrap).toBeNull();
    expect(bad.ramp).toBeNull();
    expect(bad.ring).toBeNull();
    expect(bad.move).toBeNull();
    expect(bad.at).toBeNull();
    expect(bad.keys).toBeNull();
    expect(bad.hooked).toBe(true);
    expect(parseDev('?level=41').level).toBeNull();
    expect(parseDev('?level=40').level).toBe(40);
    expect(parseDev('?spk=0.1').spk).toBe(0.9);
    expect(parseDev('?spk=9').spk).toBe(2.5);
    expect(parseDev('?ring=0').ring).toBe(0);
    expect(parseDev('?hp=1').hp).toBe(1);
    expect(parseDev('?hp=100').hp).toBe(100);
  });

  it('counts a hook with a bad value as hooked, a different query as not', () => {
    expect(parseDev('?topic=my-level').hooked).toBe(false);
    expect(parseDev('?hp=abc').hooked).toBe(true);
  });
});

describe('moves', () => {
  const plans: number[][] = [BLOCKS.thug, BLOCKS.bruiser, BLOCKS.boss, [2], [4, 4, 4]];

  it('moveClassOf: the last block is the finisher, the rest go by their keys', () => {
    expect(moveClassOf([3], 0)).toBe('finisher');
    expect(moveClassOf([3, 4], 0)).toBe('medium');
    expect(moveClassOf([3, 4], 1)).toBe('finisher');
    expect(moveClassOf([2, 3, 3, 4, 5], 0)).toBe('light');
    expect(moveClassOf([2, 3, 3, 4, 5], 1)).toBe('medium');
    expect(moveClassOf([2, 3, 3, 4, 5], 3)).toBe('heavy');
    expect(moveClassOf([2, 3, 3, 4, 5], 4)).toBe('finisher');
    for (const plan of plans) {
      expect(moveClassOf(plan, plan.length - 1)).toBe('finisher');
    }
  });

  it('pickMove is always of the class and never repeats the last move', () => {
    const classes = Object.keys(MOVES_BY_CLASS) as MoveClass[];
    const random = seededRandom(5);
    for (const cls of classes) {
      for (const last of [null, ...MOVES_BY_CLASS[cls]] as (MoveId | null)[]) {
        for (let i = 0; i < runs(200, 20); i++) {
          const move = pickMove(cls, last, random);
          expect(MOVES_BY_CLASS[cls]).toContain(move);
          if (last !== null && MOVES_BY_CLASS[cls].length > 1) expect(move).not.toBe(last);
        }
      }
    }
  });

  it('every move belongs to its class and lands before it ends', () => {
    for (const cls of Object.keys(MOVES_BY_CLASS) as MoveClass[]) {
      for (const id of MOVES_BY_CLASS[cls]) {
        expect(MOVES[id].cls).toBe(cls);
        expect(MOVES[id].contact).toBeGreaterThan(0);
        expect(MOVES[id].contact).toBeLessThan(MOVES[id].duration);
        expect(MOVES[id].word.length).toBeGreaterThan(0);
      }
    }
    expect(MOVES.jab.duration).toBe(0.35);
    expect(MOVES['flying-kick'].contact).toBe(0.4);
    expect(MOVES.throw.duration).toBe(1.1);
    for (const id of MOVES_BY_CLASS.finisher) expect(MOVES[id].launch).toBeDefined();
  });

  it('every frame of every move is a finite pose that starts and ends in the guard', () => {
    for (const id of Object.keys(MOVES) as MoveId[]) {
      const first = moveFrame(id, 0, neutralPose());
      const last = moveFrame(id, MOVES[id].duration + 1, neutralPose());
      for (let t = 0; t <= MOVES[id].duration; t += 0.05) {
        const pose = moveFrame(id, t, neutralPose());
        for (const n of [pose.lift, pose.lean, pose.twist, pose.armR.raise, pose.legR.raise]) {
          expect(Number.isFinite(n), `${id} at ${t}`).toBe(true);
        }
      }
      expect(last.armR.raise).toBeCloseTo(first.armR.raise, 6);
      expect(last.armR.bend).toBeCloseTo(first.armR.bend, 6);
      expect(last.legR.raise).toBeCloseTo(first.legR.raise, 6);
    }
  });

  it('a mirrored pose swaps the arms and legs and twists the other way', () => {
    const pose = moveFrame('jab', MOVES.jab.contact, neutralPose());
    const armR = { ...pose.armR };
    const twist = pose.twist;
    mirrorPose(pose);
    expect(pose.armL).toEqual(armR);
    expect(pose.twist).toBe(-twist);
  });

  it('a launch is ballistic: apex 1.2 at 0.4 s, on the ground at 0.8 s, gone at 1.6 s', () => {
    const launch = MOVES['flying-kick'].launch!;
    expect(launchPath(launch, 0).y).toBe(0);
    expect(launchPath(launch, 0.4).y).toBeCloseTo(1.2, 5);
    expect(launchPath(launch, 0.8).y).toBeCloseTo(0, 5);
    expect(launchPath(launch, 0.8).dx).toBeCloseTo(4.5, 5);
    expect(launchPath(launch, 0.5).lying).toBe(false);
    expect(launchPath(launch, 1.0).lying).toBe(true);
    expect(launchPath(launch, LAUNCH_SECONDS).scale).toBe(0);
    expect(launchPath(MOVES.throw.launch!, 0.8).dx).toBeCloseTo(-4, 5);
    expect(launchPath(MOVES['spin-kick'].launch!, 0.8).dx).toBeCloseTo(5, 5);
  });

  it('a reaction rises and comes back', () => {
    const pose = neutralPose();
    const mid = reactionFrame(MOVES.uppercut.reaction, 0.22, pose);
    expect(mid.lift).toBeGreaterThan(0.2);
    expect(mid.lift).toBeLessThanOrEqual(0.3);
    expect(reactionFrame(MOVES.uppercut.reaction, 0.5, pose).lift).toBeCloseTo(0, 1);
    expect(reactionFrame(MOVES.jab.reaction, 0.25, pose).push).toBeGreaterThan(0.1);
    expect(reactionFrame(MOVES.roundhouse.reaction, 0.5, pose).spin).toBeCloseTo(0.5, 5);
  });
});

describe('blocks and the rings', () => {
  it('a thug has one block, a bruiser two, a boss five; the plan is the kind table', () => {
    const kinds: Kind[] = ['thug', 'bruiser', 'boss'];
    for (const kind of kinds) expect(blockPlan(kind)).toEqual(BLOCKS[kind]);
    expect(BLOCKS.thug).toEqual([3]);
    expect(BLOCKS.bruiser).toEqual([3, 4]);
    expect(BLOCKS.boss).toEqual([2, 3, 3, 4, 5]);
  });

  it('ringSeconds: level 1 at 2.0 s a key is 25.5 s, and it never goes under the floor', () => {
    expect(ringSeconds(3, 2.0, slackFor(0))).toBeCloseTo(25.5, 5);
    expect(ringSeconds(3, 0.01, 1.5)).toBe(RING_MIN);
    expect(ringSeconds(1, 0.2, 1.5)).toBe(RING_MIN);
  });

  it('ringSeconds grows with the keys, the seconds per key and the slack', () => {
    for (let keys = 1; keys < 6; keys++) {
      expect(ringSeconds(keys + 1, 1.5, 2)).toBeGreaterThanOrEqual(ringSeconds(keys, 1.5, 2));
    }
    expect(ringSeconds(3, 2, 2)).toBeGreaterThan(ringSeconds(3, 1.5, 2));
    expect(ringSeconds(3, 1.5, 3)).toBeGreaterThan(ringSeconds(3, 1.5, 2));
    let last = 0;
    for (let spk = 0.9; spk <= 2.5; spk += 0.1) {
      const s = ringSeconds(4, spk, 3);
      expect(s).toBeGreaterThanOrEqual(last);
      last = s;
    }
  });

  it('slackFor starts at 3.0, loses 8% a step and stops at 1.5', () => {
    expect(slackFor(0)).toBe(SLACK_START);
    expect(slackFor(1)).toBeCloseTo(3 * 0.92, 10);
    expect(slackFor(5)).toBeCloseTo(3 * 0.92 ** 5, 10);
    expect(slackFor(20)).toBe(SLACK_MIN);
    for (let i = 0; i < 20; i++) expect(slackFor(i + 1)).toBeLessThanOrEqual(slackFor(i));
  });

  it('mastered: a new level is not, a passed or older level and any speed level is', () => {
    const typing = emptyTyping();
    expect(mastered(typing, 1)).toBe(false);
    for (const skill of TYPING_LEVELS[0].skills) typing.keys[skill] = '1'.repeat(HISTORY);
    expect(mastered(typing, 1)).toBe(true);
    const next = levelUp(typing);
    expect(next).toBe(2);
    expect(mastered(typing, 1)).toBe(true); // an older level
    expect(mastered(typing, 2)).toBe(false); // the new open level, unlearned
    const fresh = emptyTyping();
    expect(mastered(fresh, 29)).toBe(true); // a speed level
    openLevel(fresh, 5);
    expect(mastered(fresh, 5)).toBe(false);
  });

  it('spkFor: a speed level uses the goal, a key level the player', () => {
    expect(spkFor(1, 1.7)).toBe(1.7);
    expect(spkFor(31, 1.7)).toBeCloseTo(12 / 20, 10);
  });
});

describe('lock-on and who attacks', () => {
  const cand = (id: string, text: string, x: number, engaged = true): Candidate => ({
    id,
    text,
    x,
    engaged,
  });

  it('only an engaged thug whose block starts with the key can be locked', () => {
    const cands = [cand('a', 'fjf ', 2, false), cand('b', 'jfj ', 1), cand('c', 'kdk ', -1)];
    expect(lockThug(cands, 'f', 0)).toBeNull(); // not engaged yet
    expect(lockThug(cands, 'j', 0)).toBe('b');
    expect(lockThug(cands, 'k', 0)).toBe('c');
    expect(lockThug(cands, 'z', 0)).toBeNull();
    expect(lockThug([], 'f', 0)).toBeNull();
  });

  it('takes the nearest to the hero, then the lowest id', () => {
    const cands = [cand('b', 'fjf ', 2.6), cand('a', 'ffj ', -1.3), cand('c', 'fjj ', 1.3)];
    expect(lockThug(cands, 'f', 0)).toBe('a'); // 1.3 away, ties by id with c
    expect(lockThug(cands, 'f', 2)).toBe('b');
    expect(lockThug(cands, 'f', 1.2)).toBe('c');
  });

  it('attackerOf is the engaged thug with the lowest turn, ties by id', () => {
    const thugs = [
      { id: 't2', turn: 3, engaged: true },
      { id: 't1', turn: 2, engaged: true },
      { id: 't3', turn: 1, engaged: false },
    ];
    expect(attackerOf(thugs)).toBe('t1');
    expect(attackerOf([])).toBeNull();
    expect(attackerOf([{ id: 'x', turn: 1, engaged: false }])).toBeNull();
    expect(
      attackerOf([
        { id: 'b', turn: 1, engaged: true },
        { id: 'a', turn: 1, engaged: true },
      ]),
    ).toBe('a');
  });

  it('rotates after each ring hit bumps the turn', () => {
    const thugs = [
      { id: 'a', turn: 1, engaged: true },
      { id: 'b', turn: 2, engaged: true },
      { id: 'c', turn: 3, engaged: true },
    ];
    let counter = 3;
    const order: string[] = [];
    for (let i = 0; i < 7; i++) {
      const id = attackerOf(thugs)!;
      order.push(id);
      thugs.find((t) => t.id === id)!.turn = ++counter;
    }
    expect(order).toEqual(['a', 'b', 'c', 'a', 'b', 'c', 'a']);
  });
});

describe('points, health and scraps', () => {
  it('streakMultiplier thresholds', () => {
    expect([0, 1, 4].map(streakMultiplier)).toEqual([1, 1, 1]);
    expect([5, 9].map(streakMultiplier)).toEqual([2, 2]);
    expect([10, 19].map(streakMultiplier)).toEqual([3, 3]);
    expect([20, 99].map(streakMultiplier)).toEqual([4, 4]);
  });

  it('killPoints multiply the kind, the streak and the level', () => {
    expect(killPoints('thug', 1, 1)).toBe(30);
    expect(killPoints('bruiser', 1, 1)).toBe(60);
    expect(killPoints('boss', 1, 1)).toBe(300);
    expect(killPoints('thug', 5, 1)).toBe(60);
    expect(killPoints('thug', 20, 1)).toBe(120);
    expect(killPoints('thug', 1, 7)).toBe(30 * 49);
    expect(killPoints('thug', 5, 7)).toBe(30 * 2 * 49);
    expect(blockPoints(3, 1)).toBe(30);
    expect(blockPoints(4, 7)).toBe(40 * 49);
    expect(scrapBonus(3, 1)).toBe(150);
    expect(scrapBonus(2, 7)).toBe(100 * 49);
  });

  it('hitHero and refill stay between 0 and 100', () => {
    expect(hitHero(100, HIT_WRONG)).toBe(92);
    expect(hitHero(100, HIT_RING)).toBe(88);
    expect(hitHero(5, 12)).toBe(0);
    expect(refill(90, REFILL_SCRAP)).toBe(HP_MAX);
    expect(refill(50, REFILL_SCRAP)).toBe(65);
  });

  it('scrapSize: 3 thugs, then 4, 5 and 6', () => {
    expect([1, 2, 3, 4, 5, 9].map(scrapSize)).toEqual([3, 4, 5, 6, 6, 6]);
    expect(scrapSize(1)).toBe(MAX_THUGS);
  });

  it('scrapKinds: only thugs before scrap 3, about a third bruisers from then on', () => {
    const random = seededRandom(3);
    for (let i = 0; i < 30; i++) {
      expect(scrapKinds(1, random)).toEqual(['thug', 'thug', 'thug']);
      expect(scrapKinds(2, random)).toHaveLength(4);
      expect(scrapKinds(2, random).every((k) => k === 'thug')).toBe(true);
    }
    let bruisers = 0;
    let total = 0;
    for (let i = 0; i < runs(2000, 200); i++) {
      const kinds = scrapKinds(4 + (i % 3), random);
      total += kinds.length;
      bruisers += kinds.filter((k) => k === 'bruiser').length;
      expect(kinds.every((k) => k === 'thug' || k === 'bruiser')).toBe(true);
    }
    expect(bruisers / total).toBeGreaterThan(0.25);
    expect(bruisers / total).toBeLessThan(0.42);
  });
});

describe('speed groups', () => {
  it('pass at the goal words a minute with 90% right', () => {
    // 6 knock-outs of ~4.5 keys: 27 keys at 20 wpm needs 16.2 seconds.
    expect(speedGroupPasses(31, { keys: 27, mistakes: 0, seconds: 16 })).toBe(true);
    expect(speedGroupPasses(31, { keys: 27, mistakes: 0, seconds: 17 })).toBe(false);
    expect(speedGroupPasses(31, { keys: 30, mistakes: 3, seconds: 10 })).toBe(true);
    expect(speedGroupPasses(31, { keys: 30, mistakes: 4, seconds: 10 })).toBe(false);
    expect(speedGroupPasses(31, { keys: 27, mistakes: 0, seconds: 0 })).toBe(false);
    expect(speedGroupPasses(7, { keys: 27, mistakes: 0, seconds: 1 })).toBe(false);
  });
});

describe('resultsText', () => {
  it('puts the fight first, always, and leaves empty parts out', () => {
    expect(resultsText(emptyStats(), 1, [])).toBe('Fight 1');
    expect(
      resultsText({ keys: 100, right: 94, fastKeys: 140, fastSeconds: 60, knockouts: 11 }, 4, [8]),
    ).toBe('Fight 4 · 11 knock-outs · 28 words a minute · 94% right · Level 8 opened!');
    expect(
      resultsText({ keys: 10, right: 10, fastKeys: 0, fastSeconds: 0, knockouts: 1 }, 2, [3, 4, 5]),
    ).toBe('Fight 2 · 1 knock-out · 100% right · Levels 3 to 5 opened!');
    expect(runWpm({ keys: 0, right: 0, fastKeys: 10, fastSeconds: 0, knockouts: 0 })).toBe(0);
  });
});

describe('chunks for the blocks', () => {
  const seeds = runs(25, 3);

  it('every block of any level only uses keys the level can type', () => {
    for (const level of TYPING_LEVELS) {
      const known = new Set(knownChars(level.n));
      for (const kind of ['thug', 'bruiser', 'boss'] as Kind[]) {
        for (const keys of BLOCKS[kind]) {
          for (let seed = 1; seed <= seeds; seed++) {
            const chunk = planChunk({
              level: level.n,
              keys,
              random: seededRandom(seed * 13 + level.n * 5 + keys),
            });
            expect(chunk.length, `level ${level.n} "${chunk}"`).toBeGreaterThan(0);
            for (const c of chunk) expect(known.has(c), `level ${level.n} "${chunk}"`).toBe(true);
            const text = targetText(chunk);
            expect(text.endsWith(' ')).toBe(true);
            expect(text.trimEnd()).toBe(chunk);
          }
        }
      }
    }
  });

  it('three blocks on screen start with different keys when the level has enough of them', () => {
    let ok = 0;
    let total = 0;
    for (const level of TYPING_LEVELS) {
      const known = knownChars(level.n).filter((c) => c !== ' ');
      if (known.length < 5) continue;
      for (let seed = 1; seed <= seeds * 2; seed++) {
        const random = seededRandom(seed * 7 + level.n);
        const firsts: string[] = [];
        for (let i = 0; i < 3; i++) {
          const chunk = planChunk({
            level: level.n,
            keys: 3,
            random,
            avoid: firsts,
          });
          firsts.push(chunk[0]);
        }
        total++;
        if (new Set(firsts).size === 3) ok++;
      }
    }
    expect(ok / total).toBeGreaterThanOrEqual(0.9);
  });
});

describe('layout', () => {
  const sizes = [
    { w: 390, h: 844 },
    { w: 844, h: 390 },
    { w: 1024, h: 768 },
    { w: 1366, h: 1024 },
  ];

  it('halfWidthFor clamps between 3.4 and 5.6 units', () => {
    expect(halfWidthFor(0.2)).toBe(3.4);
    expect(halfWidthFor(0.46)).toBeCloseTo(3.4, 10);
    expect(halfWidthFor(1)).toBeCloseTo(3.4 + 0.54 * 3, 10);
    expect(halfWidthFor(3)).toBe(5.6);
    let last = 0;
    for (let a = 0.3; a < 3; a += 0.1) {
      expect(halfWidthFor(a)).toBeGreaterThanOrEqual(last);
      last = halfWidthFor(a);
    }
  });

  it('the camera shows exactly that half width at the action', () => {
    for (const { w, h } of sizes) {
      const aspect = w / h;
      const fov = (fovFor(aspect) * Math.PI) / 180;
      const halfHeight = CAMERA_D * Math.tan(fov / 2);
      expect(halfHeight * aspect).toBeCloseTo(halfWidthFor(aspect), 6);
    }
    expect(lookYFor(0.46)).toBe(1.1);
    expect(lookYFor(2.16)).toBe(2.1);
  });

  it('the four slots sit inside the view at all four sizes, with room for a person', () => {
    for (const { w, h } of sizes) {
      const half = halfWidthFor(w / h);
      for (const slot of SLOTS) expect(Math.abs(slot.x) + 0.4).toBeLessThan(half);
      expect(spawnOffset(half, 1)).toBeGreaterThan(half);
      expect(spawnOffset(half, -1)).toBeLessThan(-half);
    }
    expect(SLOTS.map((s) => s.x)).toEqual([1.3, -1.3, 2.6, -2.6]);
  });

  it('pickSlot: a free slot on its side first, then the other side, then none', () => {
    expect(pickSlot(1, new Set())).toBe(0);
    expect(pickSlot(-1, new Set())).toBe(1);
    expect(pickSlot(1, new Set([0]))).toBe(2);
    expect(pickSlot(1, new Set([0, 2]))).toBe(1);
    expect(pickSlot(-1, new Set([1, 3, 0]))).toBe(2);
    expect(pickSlot(1, new Set([0, 1, 2, 3]))).toBeNull();
  });

  it('labels stay under the HUD at all four sizes', () => {
    for (const { w, h } of sizes) {
      const min = labelMinY(0, w);
      expect(min).toBeGreaterThanOrEqual(hudTop(0, w) + 70);
      for (const y of [-50, 0, min - 1, min, 300, 5000]) {
        const placed = clampLabelY(y, 34, w, h, 0);
        expect(placed).toBeGreaterThanOrEqual(min);
        expect(placed).toBeLessThanOrEqual(Math.max(min, h - 34 - 4));
      }
    }
    // A notch pushes the panel and the labels down.
    expect(hudTop(44, 390)).toBe(96);
    expect(labelMinY(44, 390)).toBeGreaterThan(labelMinY(0, 390));
    expect(hudTop(0, WIDE)).toBeLessThan(hudTop(0, WIDE - 1));
  });
});

describe('labels', () => {
  it('staggerLabels moves a box that covers the one before it down', () => {
    const boxes = [
      { x: 0, y: 100, w: 60, h: 20 },
      { x: 40, y: 100, w: 60, h: 20 },
      { x: 300, y: 100, w: 60, h: 20 },
    ];
    expect(staggerLabels(boxes)).toEqual([0, 24, 0]);
    expect(staggerLabels([])).toEqual([]);
  });

  it('labelFontPx fits the pitch between 13 and 22 px', () => {
    expect(labelFontPx(40, 4)).toBe(13);
    expect(labelFontPx(1000, 4)).toBe(22);
    expect(labelFontPx(100, 6)).toBeLessThanOrEqual(labelFontPx(100, 4));
  });
});

describe('voice', () => {
  it('speaks only the lesson lines', () => {
    expect(VOICE_LINES).toEqual(TYPING_VOICE_LINES);
    expect(VOICE_LINES).not.toContain('Ready to brawl?');
    expect(VOICE_LINES).not.toContain('Every block ends with the space bar: that is the punch!');
  });

  it('calls speak() nowhere in the game: only the lesson gets the speaker', () => {
    const dir = resolve(import.meta.dirname, '../src/games/type-brawl');
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
    expect(files).toContain('main.ts');
    for (const file of files) {
      const source = readFileSync(resolve(dir, file), 'utf8');
      expect(source, file).not.toMatch(/\bspeak\(/);
    }
    const main = readFileSync(resolve(dir, 'main.ts'), 'utf8');
    expect(main.match(/\bspeak\b/g)?.length).toBe(2); // the import and the lesson option
    expect(main).toMatch(/showKeyLesson\(\{[^}]*\bspeak\b/s);
  });
});
