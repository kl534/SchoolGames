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
import { speciesOf, lookFor } from '../src/games/type-brawl/fighters';
import {
  AIR_SECONDS,
  LAUNCH_SECONDS,
  LYING_SECONDS,
  MOVES,
  launchPath,
  mirrorPose,
  moveFrame,
  moveSpin,
  reactionFrame,
} from '../src/games/type-brawl/moves';
import { neutralPose } from '../src/games/type-brawl/person';
import {
  BLOCKS,
  BOSS_BANNER_SECONDS,
  BOSS_GAP_SECONDS,
  HIT_RING,
  HIT_RING_BOSS,
  HIT_WORDS,
  THUG_BODIES,
  ITEM_DROP_CHANCE,
  ITEM_EMOJI,
  ITEM_HEAL,
  ITEM_KEYS,
  STAGES,
  STAGE_SCRAPS,
  STAR_KNOCKOUTS,
  HIT_WRONG,
  HP_MAX,
  MAX_THUGS,
  MOVES_BY_CLASS,
  REFILL_STAGE,
  RING_MIN,
  SLACK_MIN,
  SLACK_START,
  attackerOf,
  blockPlan,
  blockPoints,
  bossScrapKinds,
  dropsItem,
  fightNumber,
  pickItem,
  ringDamage,
  stageBonus,
  stageInfo,
  emptyStats,
  hitHero,
  killPoints,
  lockThug,
  mastered,
  moveClassOf,
  pickMove,
  pickWord,
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
  type Species,
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
      stage: null,
      loop: null,
      item: null,
      win: false,
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
      species: null,
      bonk: false,
      pop: false,
      hooked: false,
    });
  });

  it('reads every hook', () => {
    const dev = parseDev(
      '?level=7&start=1&lesson=1&spk=1.4&chunk=fj%20k&thugs=2&kind=bruiser&lock=3&typed=2&wrong=1' +
        '&hp=60&scrap=4&ramp=5&ring=0.85&freeze=1&move=flying-kick&at=0.55&levelup=1&keys=fjf%20' +
        '&stage=3&loop=2&item=pizza&win=dance&species=monster&bonk=1&pop=1',
    );
    expect(dev).toEqual({
      level: 7,
      start: true,
      lesson: true,
      spk: 1.4,
      chunk: 'fj k',
      thugs: 2,
      kind: 'bruiser',
      stage: 3,
      loop: 2,
      item: 'pizza',
      win: true,
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
      species: 'monster',
      bonk: true,
      pop: true,
      hooked: true,
    });
  });

  it('keeps numbers in range and ignores what is malformed', () => {
    const bad = parseDev(
      'level=0&spk=-1&thugs=4&kind=king&stage=5&loop=-1&item=milk&win=1&lock=5&typed=x&hp=0&hp=101&scrap=5&ramp=21&ring=1.5&move=headbite&species=ghost&bonk=2&pop=0&at=-1&keys=' +
        'a'.repeat(13),
    );
    expect(bad.level).toBeNull();
    expect(bad.spk).toBeNull();
    expect(bad.thugs).toBeNull();
    expect(bad.kind).toBeNull();
    expect(bad.stage).toBeNull();
    expect(bad.loop).toBeNull();
    expect(bad.item).toBeNull();
    expect(bad.win).toBe(false);
    expect(bad.lock).toBeNull();
    expect(bad.typed).toBe(0);
    expect(bad.hp).toBeNull();
    expect(bad.scrap).toBeNull();
    expect(bad.ramp).toBeNull();
    expect(bad.ring).toBeNull();
    expect(bad.move).toBeNull();
    expect(bad.species).toBeNull();
    expect(bad.bonk).toBe(false);
    expect(bad.pop).toBe(false);
    expect(bad.at).toBeNull();
    expect(bad.keys).toBeNull();
    expect(bad.hooked).toBe(true);
    expect(parseDev('?level=41').level).toBeNull();
    expect(parseDev('?level=40').level).toBe(40);
    expect(parseDev('?spk=0.1').spk).toBe(0.9);
    expect(parseDev('?spk=9').spk).toBe(2.5);
    expect(parseDev('?ring=0').ring).toBe(0);
    expect(parseDev('?kind=boss').kind).toBe('boss');
    expect(parseDev('?stage=4&loop=0&scrap=4').stage).toBe(4);
    expect(parseDev('?loop=0').loop).toBe(0);
    expect(parseDev('?scrap=4').scrap).toBe(4);
    expect(parseDev('?hp=1').hp).toBe(1);
    expect(parseDev('?hp=100').hp).toBe(100);
    expect(parseDev('?move=headbutt').move).toBe('headbutt');
    expect(parseDev('?move=knee').move).toBe('knee');
    expect(parseDev('?move=back-elbow').move).toBe('back-elbow');
    expect(parseDev('?species=robot').species).toBe('robot');
    expect(parseDev('?bonk=1&pop=1').hooked).toBe(true);
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

  it('a launch is ballistic: apex 1.2 at 0.4 s, on the ground at 0.8 s, then pops at 1.2 s', () => {
    const launch = MOVES['flying-kick'].launch!;
    expect(launchPath(launch, 0).y).toBe(0);
    expect(launchPath(launch, 0.4).y).toBeCloseTo(1.2, 5);
    expect(launchPath(launch, 0.8).y).toBeCloseTo(0, 5);
    expect(launchPath(launch, 0.8).dx).toBeCloseTo(4.5, 5);
    expect(launchPath(launch, 0.5).lying).toBe(false);
    expect(launchPath(launch, 1.0).lying).toBe(true);
    expect(LAUNCH_SECONDS).toBeCloseTo(AIR_SECONDS + LYING_SECONDS + 0.1, 9);
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
    expect(refill(90, REFILL_STAGE)).toBe(HP_MAX);
    expect(refill(50, REFILL_STAGE)).toBe(90);
  });

  it('scrapSize: 3 thugs, then 4, 5 and 6; each loop adds one, up to 8', () => {
    expect([1, 2, 3, 4, 5, 9].map((n) => scrapSize(n))).toEqual([3, 4, 5, 6, 6, 6]);
    expect(scrapSize(1)).toBe(MAX_THUGS);
    expect([1, 2, 3].map((n) => scrapSize(n, 1))).toEqual([4, 5, 6]);
    expect([1, 2, 3].map((n) => scrapSize(n, 3))).toEqual([6, 7, 8]);
    expect(scrapSize(3, 20)).toBe(8);
    expect(scrapSize(9, 20)).toBe(8);
  });

  it('bossScrapKinds: the boss first, then 2 thugs, one more each loop', () => {
    expect(bossScrapKinds()).toEqual(['boss', 'thug', 'thug']);
    expect(bossScrapKinds(2)).toEqual(['boss', 'thug', 'thug', 'thug', 'thug']);
    expect(bossScrapKinds(50)).toHaveLength(8);
  });

  it('later stages have bruisers from the first scrap', () => {
    const random = seededRandom(5);
    let bruisers = 0;
    for (let i = 0; i < 300; i++) {
      bruisers += scrapKinds(1, random, 0, 2).filter((k) => k === 'bruiser').length;
    }
    expect(bruisers).toBeGreaterThan(100);
    expect(scrapKinds(1, random, 0, 1).every((k) => k === 'thug')).toBe(true);
  });

  it('the stage bonus is three scrap bonuses and fights count on through the stages', () => {
    expect(stageBonus(1, 1)).toBe(150);
    expect(stageBonus(2, 7)).toBe(3 * 100 * 49);
    expect(fightNumber(1, 1)).toBe(1);
    expect(fightNumber(1, STAGE_SCRAPS)).toBe(3);
    expect(fightNumber(2, 1)).toBe(4);
    expect(fightNumber(5, 2)).toBe(14);
  });

  it('a boss hits for 20, the others for 12', () => {
    expect(HIT_RING_BOSS).toBe(20);
    expect(ringDamage('boss')).toBe(20);
    expect(ringDamage('thug')).toBe(HIT_RING);
    expect(ringDamage('bruiser')).toBe(HIT_RING);
    expect(BOSS_BANNER_SECONDS).toBe(1);
    expect(BOSS_GAP_SECONDS).toBe(2);
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
  it('puts the stage first, always, and leaves empty parts out', () => {
    expect(resultsText(emptyStats(), 1, [])).toBe('Stage 1');
    expect(
      resultsText({ keys: 100, right: 94, fastKeys: 140, fastSeconds: 60, knockouts: 11 }, 4, [8]),
    ).toBe('Stage 4 · 11 knock-outs · 28 words a minute · 94% right · Level 8 opened!');
    expect(
      resultsText({ keys: 10, right: 10, fastKeys: 0, fastSeconds: 0, knockouts: 1 }, 2, [3, 4, 5]),
    ).toBe('Stage 2 · 1 knock-out · 100% right · Levels 3 to 5 opened!');
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

describe('stages', () => {
  it('there are four, with the planned bosses, and each is distinct', () => {
    expect(STAGES.map((st) => st.id)).toEqual(['street', 'docks', 'dojo', 'rooftop']);
    expect(STAGES.map((st) => st.boss)).toEqual([
      'Giga-Bot',
      'Fuzzball King',
      'Slime Duke',
      'Robo-Rex',
    ]);
    expect(STAGES.map((st) => st.body)).toEqual([
      'giga-bot',
      'fuzzball-king',
      'slime-duke',
      'robo-rex',
    ]);
    expect(STAGES.map((st) => st.species)).toEqual(['robot', 'monster', 'monster', 'robot']);
    expect(STAGES.map((st) => st.bossColor)).toEqual([0x8aa4c8, 0x9b5de5, 0x5fd35f, 0x2ec4b6]);
    expect(new Set(STAGES.map((st) => st.palette.sky[0])).size).toBe(4);
    expect(new Set(STAGES.map((st) => st.palette.ground)).size).toBe(4);
    for (const st of STAGES) {
      expect(st.props.length).toBeGreaterThanOrEqual(3);
      expect(st.palette.walls.length).toBeGreaterThanOrEqual(3);
      for (const color of [
        ...st.palette.sky,
        st.palette.ground,
        st.palette.walk,
        st.palette.roof,
      ]) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it('stageInfo loops through the four, one loop harder each time', () => {
    expect([1, 2, 3, 4, 5, 6, 8, 9].map((n) => stageInfo(n).def.id)).toEqual([
      'street',
      'docks',
      'dojo',
      'rooftop',
      'street',
      'docks',
      'rooftop',
      'street',
    ]);
    expect([1, 4, 5, 8, 9, 13].map((n) => stageInfo(n).loop)).toEqual([0, 0, 1, 1, 2, 3]);
    expect(stageInfo(0).def.id).toBe('street');
  });

  it('a boss has the five blocks of the plan and is the heaviest hitter', () => {
    expect(blockPlan('boss')).toEqual([2, 3, 3, 4, 5]);
    expect(moveClassOf(blockPlan('boss'), 0)).toBe('light');
    expect(moveClassOf(blockPlan('boss'), 3)).toBe('heavy');
    expect(moveClassOf(blockPlan('boss'), 4)).toBe('finisher');
  });
});

describe('items', () => {
  it('drop from thugs and bruisers a quarter of the time, never from a boss', () => {
    const random = seededRandom(9);
    let drops = 0;
    const n = runs(4000, 400);
    for (let i = 0; i < n; i++) if (dropsItem('thug', random)) drops++;
    expect(ITEM_DROP_CHANCE).toBe(0.25);
    expect(drops / n).toBeGreaterThan(0.2);
    expect(drops / n).toBeLessThan(0.3);
    for (let i = 0; i < 200; i++) expect(dropsItem('boss', () => 0)).toBe(false);
    expect(dropsItem('bruiser', () => 0.24)).toBe(true);
    expect(dropsItem('bruiser', () => 0.25)).toBe(false);
  });

  it('are picked 6 cola : 3 pizza : 1 star', () => {
    expect(pickItem(() => 0)).toBe('cola');
    expect(pickItem(() => 0.59)).toBe('cola');
    expect(pickItem(() => 0.6)).toBe('pizza');
    expect(pickItem(() => 0.89)).toBe('pizza');
    expect(pickItem(() => 0.9)).toBe('star');
    expect(pickItem(() => 0.999)).toBe('star');
    const random = seededRandom(4);
    const counts = { cola: 0, pizza: 0, star: 0 };
    const n = runs(5000, 500);
    for (let i = 0; i < n; i++) counts[pickItem(random)]++;
    expect(counts.cola / n).toBeGreaterThan(0.5);
    expect(counts.cola / n).toBeLessThan(0.7);
    expect(counts.star / n).toBeLessThan(0.15);
    expect(counts.star).toBeGreaterThan(0);
  });

  it('heal 20 and 40, the star heals nothing, and a block is 2 keys', () => {
    expect(ITEM_HEAL).toEqual({ cola: 20, pizza: 40, star: 0 });
    expect(refill(70, ITEM_HEAL.pizza)).toBe(HP_MAX);
    expect(STAR_KNOCKOUTS).toBe(3);
    expect(ITEM_KEYS).toBe(2);
    expect(Object.keys(ITEM_EMOJI).sort()).toEqual(['cola', 'pizza', 'star']);
  });

  it('are locked after thugs, however near, and among themselves nearest first', () => {
    const cands: Candidate[] = [
      { id: 'i0', text: 'f ', x: 0.1, engaged: true, item: true },
      { id: 't1', text: 'f  ', x: 2.6, engaged: true },
      { id: 'i2', text: 'j ', x: 1.0, engaged: true, item: true },
      { id: 'i3', text: 'j ', x: 0.4, engaged: true, item: true },
    ];
    expect(lockThug(cands, 'f', 0)).toBe('t1');
    expect(lockThug(cands, 'j', 0)).toBe('i3');
    expect(lockThug(cands.slice(0, 1), 'f', 0)).toBe('i0');
    expect(lockThug([...cands].reverse(), 'f', 0)).toBe('t1');
  });
});

describe('robots, monsters and their moves', () => {
  it('has 13 moves, each in exactly one class, with the three new ones as planned', () => {
    const all = Object.values(MOVES_BY_CLASS).flat();
    expect(all).toHaveLength(13);
    expect(new Set(all).size).toBe(13);
    expect(Object.keys(MOVES)).toHaveLength(13);
    expect(Object.values(MOVES_BY_CLASS).map((m) => m.length)).toEqual([2, 5, 3, 3]);
    for (const id of all) {
      expect(MOVES[id].contact).toBeLessThan(MOVES[id].duration);
      expect(Object.values(MOVES_BY_CLASS).filter((m) => m.includes(id))).toHaveLength(1);
    }
    expect(MOVES.knee).toMatchObject({ cls: 'medium', duration: 0.5, contact: 0.24 });
    expect(MOVES.knee.reaction).toEqual({ push: 0.2, doubled: true });
    expect(MOVES.headbutt).toMatchObject({ cls: 'medium', duration: 0.45, contact: 0.22 });
    expect(MOVES.headbutt.reaction).toEqual({ push: 0.25, snap: true });
    expect(MOVES['back-elbow']).toMatchObject({
      cls: 'heavy',
      duration: 0.6,
      contact: 0.3,
      spin: 0.5,
    });
    expect(MOVES['back-elbow'].reaction).toEqual({ push: 0.45 });
  });

  it('pickMove draws every move of a class and never repeats', () => {
    const random = seededRandom(9);
    for (const cls of Object.keys(MOVES_BY_CLASS) as MoveClass[]) {
      const seen = new Set<MoveId>();
      let last: MoveId | null = null;
      for (let i = 0; i < 300; i++) {
        const move = pickMove(cls, last, random);
        if (MOVES_BY_CLASS[cls].length > 1) expect(move).not.toBe(last);
        seen.add(move);
        last = move;
      }
      expect(seen.size).toBe(MOVES_BY_CLASS[cls].length);
    }
  });

  it('the back-elbow turns half way round and back', () => {
    expect(moveSpin('back-elbow', 0)).toBeCloseTo(0, 6);
    expect(moveSpin('back-elbow', 0.3)).toBeCloseTo(Math.PI, 5);
    expect(moveSpin('back-elbow', 0.6)).toBeCloseTo(0, 5);
  });

  it('both species have words for every class and pickWord picks one of them', () => {
    const random = seededRandom(3);
    for (const species of ['robot', 'monster'] as Species[]) {
      for (const cls of Object.keys(MOVES_BY_CLASS) as MoveClass[]) {
        expect(HIT_WORDS[species][cls].length).toBeGreaterThan(0);
        const seen = new Set<string>();
        for (let i = 0; i < runs(200, 30); i++) {
          const word = pickWord(species, cls, random);
          expect(HIT_WORDS[species][cls]).toContain(word);
          seen.add(word);
        }
        expect(seen.size).toBe(HIT_WORDS[species][cls].length);
      }
    }
    expect(pickWord('robot', 'finisher', () => 0)).toBe('K.O.!');
    expect(pickWord('monster', 'light', () => 0.999)).toBe('POOF!');
  });

  it('lookFor: a thug is a toy robot or a monster, a bruiser a box robot or a big monster', () => {
    const random = seededRandom(11);
    const thugs = new Set<string>();
    const bruisers = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const thug = lookFor('thug', random);
      expect(THUG_BODIES.thug).toContain(thug.body);
      expect(thug.species).toBe(speciesOf(thug.body!));
      expect(thug.scale).toBe(1);
      expect(thug.color).toBe(thug.shirt);
      thugs.add(thug.body!);
      const bruiser = lookFor('bruiser', random);
      expect(THUG_BODIES.bruiser).toContain(bruiser.body);
      expect(bruiser.species).toBe(speciesOf(bruiser.body!));
      expect(bruiser.scale).toBe(1.2);
      bruisers.add(bruiser.body!);
    }
    expect([...thugs].sort()).toEqual(['monster', 'toy-robot']);
    expect([...bruisers].sort()).toEqual(['big-monster', 'box-robot']);
  });

  it('lookFor: a boss is its stage body at scale 1.4, and only= fixes the species', () => {
    STAGES.forEach((st, i) => {
      const look = lookFor('boss', seededRandom(1), i);
      expect(look.body).toBe(st.body);
      expect(look.species).toBe(st.species);
      expect(look.color).toBe(st.bossColor);
      expect(look.scale).toBe(1.4);
    });
    expect(lookFor('boss', seededRandom(1), 5).body).toBe(STAGES[1].body);
    for (let i = 0; i < 30; i++) {
      expect(lookFor('thug', seededRandom(i), 0, 'robot').species).toBe('robot');
      expect(lookFor('bruiser', seededRandom(i), 0, 'monster').species).toBe('monster');
    }
  });

  it('lookFor is deterministic for a seeded random', () => {
    expect(lookFor('thug', seededRandom(4))).toEqual(lookFor('thug', seededRandom(4)));
    expect(lookFor('bruiser', seededRandom(8))).toEqual(lookFor('bruiser', seededRandom(8)));
  });
});
