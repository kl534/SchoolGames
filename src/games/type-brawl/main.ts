import { Vector3 } from 'three';
import { sfx, speak, unlockAudio } from '../../shared/audio';
import { showResults } from '../../shared/results';
import { starsFor } from '../../shared/round';
import { createScene } from '../../shared/scene';
import { createTimers } from '../../shared/timers';
import { createBackButton, createMuteButton, createPauseOverlay } from '../../shared/ui';
import { planChunk, targetText } from '../../shared/typing/chunks';
import { TYPING_LEVELS, levelOf } from '../../shared/typing/course';
import { onTypingKey } from '../../shared/typing/keys';
import { showKeyLesson } from '../../shared/typing/lesson';
import { showLevelPicker, type LevelPicker } from '../../shared/typing/picker';
import {
  HISTORY,
  SPEED_STREAK,
  TYPING_LEVEL_ID,
  levelPassed,
  levelUp,
  nextSpk,
  openLevel,
  recordPress,
} from '../../shared/typing/progress';
import { startTypingSession, type TypingSession } from '../../shared/typing/session';
import { showTestOut } from '../../shared/typing/testout';
import { devOptions } from './dev';
import { createEffects, createWords } from './effects';
import {
  HERO_LOOK,
  LAUNCH_TOTAL,
  createFighter,
  disposeFighter,
  lookFor,
  type Fighter,
} from './fighters';
import { createHud } from './hud';
import {
  createLabel,
  createPops,
  labelFontPx,
  staggerLabels,
  type Label,
  type LabelBox,
} from './labels';
import {
  CAMERA_D,
  CAMERA_Y,
  ENTER_SPEED,
  FIRST_WALK_SECONDS,
  REACH,
  SLOTS,
  WALK_SECONDS,
  WALK_SPEED,
  clampLabelY,
  fovFor,
  lookYFor,
  halfWidthFor,
  pickSlot,
  spawnOffset,
} from './layout';
import { MOVES } from './moves';
import {
  HIT_GRACE,
  HIT_RING,
  HIT_WRONG,
  HP_MAX,
  MAX_THUGS,
  READ_SECONDS,
  REFILL_SCRAP,
  SPEED_GROUP,
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
  scrapBonus,
  scrapKinds,
  slackFor,
  speedGroupPasses,
  spkFor,
  streakMultiplier,
  type Group,
  type Kind,
  type MoveId,
} from './rules';
import { createStreet } from './street';

const GAME_ID = 'type-brawl';
const READY_LINE = 'Ready to brawl?';
const SPACE_LINE = 'Every block ends with the space bar: that is the punch!';
const COLORS: Record<Kind, string> = { thug: '#7dd3fc', bruiser: '#f472b6', boss: '#fb923c' };
const ENTER_DELAY = 0.6;

type Phase = 'start' | 'walking' | 'entering' | 'fighting' | 'scrapclear' | 'over';

const clamp = (n: number, low: number, high: number): number => Math.min(Math.max(n, low), high);
const fmt = (n: number): string => n.toLocaleString('en-US');

/** One thug on the street: where it stands, the block showing and the wind-up ring. */
interface Thug {
  id: string;
  kind: Kind;
  fighter: Fighter;
  slot: number;
  side: 1 | -1;
  /** True once it has reached its slot. */
  engaged: boolean;
  plan: number[];
  block: number;
  /** The block showing and its closing space bar. */
  text: string;
  label: Label;
  font: number;
  /** Who attacks next: the lowest turn. */
  turn: number;
  /** Seconds of the ring so far, and the seconds before it starts counting. */
  ring: number;
  readLeft: number;
  /** Positions of the block typed wrong at least once. */
  mistakes: Set<number>;
  /** No wrong key and no ring hit on the whole combo so far. */
  perfect: boolean;
}

/** A move the hero is about to throw or is throwing at a thug. */
interface Strike {
  move: MoveId;
  /** The thug's fighter and slot's side, kept after the thug leaves the game state. */
  target: Fighter;
  finisher: boolean;
  /** The pops that go up when the hit lands. */
  popText: string;
  popColor: string;
  big: boolean;
  perfect: boolean;
  streakUp: number | null;
  stage: 'step' | 'move';
  t: number;
  contacted: boolean;
}

/**
 * Type Brawl: a side-on street fight. Each thug shows a block of keys; the first key locks the hero
 * onto it, the block ending with the space bar throws one move, and the last block of a thug is the
 * finisher. A wrong key or a full ring lets a thug hit the hero. Only the lesson speaks.
 */
function run(session: TypingSession): void {
  const container = document.getElementById('game');
  if (!container) throw new Error('Missing #game container');

  const dev = devOptions();
  /** With any dev hook nothing is saved. */
  const hooked = dev?.hooked ?? false;
  const typing = session.typing;
  const save = () => {
    if (!hooked) session.save();
  };

  if (dev?.level) {
    // The level is open in memory, with the keys of the levels before it learned.
    openLevel(typing, dev.level);
    typing.level = dev.level;
    for (const level of TYPING_LEVELS) {
      if (level.n >= dev.level) break;
      for (const skill of level.skills) typing.keys[skill] = '1'.repeat(HISTORY);
    }
  }
  if (dev?.spk) typing.spk = dev.spk;
  typing.level = clamp(typing.level, 1, typing.open);

  // ---------- The scene ----------
  const ctx = createScene(container, { fov: 40, near: 0.5, far: 140 });
  const camera = ctx.camera;
  const street = createStreet(ctx.scene);
  ctx.scene.add(street.object);
  const effects = createEffects();
  ctx.scene.add(effects.object);
  const timers = createTimers();
  const pops = createPops(document.body);
  const words = createWords();
  const labelLayer = document.createElement('div');
  labelLayer.className = 'br-labels';
  document.body.appendChild(labelLayer);

  const hero = createFighter(HERO_LOOK);
  ctx.scene.add(hero.person.root);
  const hud = createHud(session.player?.avatar ?? '⭐');

  const note = document.createElement('div');
  note.className = 'br-note';
  note.hidden = true;
  const noteTitle = document.createElement('strong');
  noteTitle.textContent = 'Type Brawl needs a keyboard ⌨️';
  note.append(noteTitle, 'Plug one in or open it, then press the space bar.');
  document.body.appendChild(note);

  createBackButton();
  const mute = createMuteButton();
  const pause = createPauseOverlay();

  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top)';
  document.body.appendChild(probe);

  // ---------- State ----------
  let phase: Phase = 'start';
  /** The level being played (the picker's choice; the next one after a level-up). */
  let playLevel = typing.level;
  /** A level that opened in this fight: its lesson shows after the fight is cleared. */
  let pendingLevel: number | null = null;
  let stats = emptyStats();
  let opened: number[] = [];
  let levelupUsed = false;
  let picker: LevelPicker | null = null;
  let finished = false;

  let scrap = 1;
  let firstScrap = true;
  let rampSteps = 0;
  let hp = HP_MAX;
  let score = 0;
  let streak = 0;
  let turnCounter = 0;
  let thugSeq = 0;
  let nextSide: 1 | -1 = 1;
  /** Seconds of game time while fighting and not paused. */
  let activeTime = 0;
  let graceLeft = 0;
  let walkLeft = 0;
  let spawnCooldown = 0;
  let lastAttacker: string | null = null;
  let devRingUsed = false;
  let lastMove: MoveId | null = null;
  /** Speed levels: the group of knock-outs so far and the groups in a row at the goal. */
  let group: Group = { keys: 0, mistakes: 0, seconds: 0 };
  let groupKills = 0;
  let speedRun = 0;

  let anchorX = 0;
  let thugs: Thug[] = [];
  let queue: Kind[] = [];
  /** Thugs that were knocked out and are waiting for the hit to land, then flying away. */
  let dying: { fighter: Fighter; away: 1 | -1; strike: Strike | null; flown: number }[] = [];
  let strikes: Strike[] = [];
  let strike: Strike | null = null;
  /** The thug the hero is locked on, and how many keys of its block are typed. */
  let locked: Thug | null = null;
  let pos = 0;
  let blockStart: number | null = null;
  /** Dev `at`: the first move holds at this time. */
  let holding = false;
  let strikesStarted = 0;

  const speedLevel = () => levelOf(playLevel).kind === 'speed';
  const frozen = () => dev?.freeze ?? false;
  const paused = () => pause.isPaused;
  const spkEff = () => spkFor(playLevel, typing.spk);
  const ringFor = (t: Thug) => ringSeconds(t.plan[t.block], spkEff(), slackFor(rampSteps));

  // ---------- Camera and projection ----------
  const size = () => ({
    w: container.clientWidth || window.innerWidth,
    h: container.clientHeight || window.innerHeight,
  });
  const syncCamera = () => {
    const fov = fovFor(camera.aspect);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    const sx = effects.offset.x;
    const sy = effects.offset.y;
    camera.position.set(anchorX + sx, CAMERA_Y + sy, CAMERA_D);
    camera.lookAt(anchorX + sx, lookYFor(camera.aspect) + sy, 0);
    camera.updateMatrixWorld();
  };
  const tmp = new Vector3();
  const project = (x: number, y: number, z = 0): { x: number; y: number } => {
    const { w, h } = size();
    tmp.set(x, y, z).project(camera);
    return { x: ((tmp.x + 1) / 2) * w, y: ((1 - tmp.y) / 2) * h };
  };
  const halfWidth = () => halfWidthFor(camera.aspect);

  // ---------- HUD ----------
  const renderHud = () => {
    hud.render({
      score,
      streak: streakMultiplier(streak),
      level: playLevel,
      fight: scrap,
      best: session.highScore(),
    });
  };

  const rise = (text: string, thug: Fighter, color?: string, big = false) => {
    const p = project(thug.worldX(), thug.headHeight() * 0.6);
    pops.rise(text, p.x, p.y, color, big);
  };

  // ---------- Thugs and their labels ----------
  const firstsExcept = (except: Thug | null): string[] =>
    thugs.filter((t) => t !== except).map((t) => t.text[0]);

  const planText = (block: number, plan: number[], except: Thug | null): string => {
    if (dev?.chunk) return targetText(dev.chunk);
    return targetText(
      planChunk({
        level: playLevel,
        keys: plan[block],
        random: Math.random,
        history: typing.keys,
        avoid: firstsExcept(except),
      }),
    );
  };

  const paintLabel = (t: Thug) => {
    const isLocked = locked === t;
    t.label.setState({ typed: isLocked ? pos : 0, locked: isLocked, wrong: false });
    t.label.setPips(t.block, t.plan.length);
  };

  const showBlock = (t: Thug) => {
    t.text = planText(t.block, t.plan, t);
    t.label.remove();
    t.label = createLabel(labelLayer, t.text, COLORS[t.kind]);
    t.label.element.hidden = !t.engaged;
    t.font = 0;
    t.ring = 0;
    t.readLeft = READ_SECONDS;
    t.mistakes.clear();
    paintLabel(t);
  };

  const takenSlots = () => new Set(thugs.map((t) => t.slot));

  const spawn = (kind: Kind, instant: boolean) => {
    const side = nextSide;
    const slot = pickSlot(side, takenSlots());
    if (slot === null) return;
    nextSide = side === 1 ? -1 : 1;
    const plan = blockPlan(kind);
    const fighter = createFighter(lookFor(kind, Math.random), Math.random() * 6);
    ctx.scene.add(fighter.person.root);
    const slotSide = SLOTS[slot].side;
    fighter.z = SLOTS[slot].z;
    fighter.x = instant ? anchorX + SLOTS[slot].x : anchorX + spawnOffset(halfWidth(), side);
    fighter.face(-slotSide as 1 | -1, true);
    const thug: Thug = {
      id: `t${thugSeq++}`,
      kind,
      fighter,
      slot,
      side,
      engaged: false,
      plan,
      block: 0,
      text: '',
      label: createLabel(labelLayer, ' ', COLORS[kind]),
      font: 0,
      turn: ++turnCounter,
      ring: 0,
      readLeft: READ_SECONDS,
      mistakes: new Set(),
      perfect: true,
    };
    thugs.push(thug);
    showBlock(thug);
    if (instant) engage(thug);
    else fighter.setMode({ kind: 'walk' });
  };

  const engage = (t: Thug) => {
    t.engaged = true;
    t.fighter.x = anchorX + SLOTS[t.slot].x;
    t.fighter.face(-SLOTS[t.slot].side as 1 | -1);
    t.fighter.setMode({ kind: 'idle' });
    t.label.element.hidden = false;
    t.readLeft = READ_SECONDS;
    if (phase === 'entering' && !spawning) beginFighting();
  };
  let spawning = false;

  const spawnFromQueue = (instant: boolean) => {
    while (queue.length > 0 && thugs.length < MAX_THUGS) {
      spawn(queue.shift() as Kind, instant);
      if (takenSlots().size >= SLOTS.length) break;
    }
  };

  // ---------- Level up ----------
  const checkLevelUp = () => {
    if (playLevel !== typing.open) return;
    let passed = speedLevel() ? speedRun >= SPEED_STREAK : levelPassed(typing, playLevel);
    if (dev?.levelup && !levelupUsed) {
      levelupUsed = true;
      passed = true;
    }
    if (!passed) return;
    const next = levelUp(typing);
    if (next === null) return;
    speedRun = 0;
    rampSteps = 0;
    opened.push(next);
    pendingLevel = next;
    pops.centre(`Level ${next} opened!`, '#facc15');
    sfx.chime();
  };

  const closeGroup = () => {
    speedRun = speedGroupPasses(playLevel, group) ? speedRun + 1 : 0;
    group = { keys: 0, mistakes: 0, seconds: 0 };
    groupKills = 0;
  };

  // ---------- The hero ----------
  const sideOf = (target: Fighter): 1 | -1 => (target.x >= hero.x ? 1 : -1);

  const startStrike = (s: Strike) => {
    strike = s;
    strikesStarted++;
    const dir = sideOf(s.target);
    hero.face(dir);
    const dx = Math.abs(s.target.x - hero.x);
    s.stage = dx > REACH ? 'step' : 'move';
    s.t = 0;
    if (s.stage === 'step') {
      stepTarget = s.target.x - dir * REACH;
      stepSpeed = (dx - REACH) / 0.15;
      hero.setMode({ kind: 'walk' });
    } else beginMove(s);
  };
  let stepTarget = 0;
  let stepSpeed = 0;

  const beginMove = (s: Strike) => {
    s.stage = 'move';
    s.t = 0;
    hero.setMode({ kind: 'move', move: s.move, t: 0 });
  };

  /** The hit lands: bits, the comic word, sound, the pops and what the thug does. */
  const contact = (s: Strike) => {
    s.contacted = true;
    const def = MOVES[s.move];
    const target = s.target;
    const chest = { x: target.worldX(), y: target.headHeight() * 0.6, z: target.z + 0.2 };
    effects.burst(chest, def.cls);
    const at = project(chest.x, chest.y + 0.3, chest.z);
    words.pop(def.word, at, frozen());
    if (def.cls === 'light') sfx.slap();
    else if (def.cls === 'finisher') sfx.boom();
    else sfx.thud();
    const away = sideOf(target) as 1 | -1;
    if (s.finisher) {
      effects.shake('finisher');
      const entry = dying.find((d) => d.fighter === target);
      if (entry) {
        entry.flown = 0;
        entry.away = away;
      }
      target.setMode({
        kind: 'launch',
        move: def.launch ? s.move : 'flying-kick',
        t: 0,
        away,
      });
    } else {
      target.setMode({ kind: 'react', move: s.move, t: 0, away });
    }
    rise(s.popText, target, s.popColor, s.big);
    if (s.perfect) timers.after(0.15, () => rise('Perfect!', target, '#4ade80'));
    if (s.streakUp !== null) pops.centre(`Streak ×${s.streakUp}!`, '#ff9a3d');
  };

  const pumpStrikes = () => {
    if (strike) {
      if (strike.stage === 'step') {
        const dir = Math.sign(stepTarget - hero.x);
        const move = stepSpeed * dtNow;
        hero.x += Math.abs(stepTarget - hero.x) <= move ? stepTarget - hero.x : dir * move;
        if (Math.abs(stepTarget - hero.x) < 1e-6) beginMove(strike);
      } else {
        strike.t += dtNow;
        if (!strike.contacted && strike.t >= MOVES[strike.move].contact) contact(strike);
        if (strike.t >= MOVES[strike.move].duration) strike = null;
      }
    }
    // A waiting move starts at once when the one in progress has landed.
    if (strikes.length > 0 && (strike === null || (strike.stage === 'move' && strike.contacted))) {
      startStrike(strikes.shift() as Strike);
    }
  };
  let dtNow = 0;

  const heroIdle = () => strike === null && strikes.length === 0 && !hero.busy;

  // ---------- Hits on the hero ----------
  const hurtHero = (amount: number, thug: Thug) => {
    if (phase === 'over') return;
    graceLeft = HIT_GRACE;
    thug.fighter.face(-SLOTS[thug.slot].side as 1 | -1);
    thug.fighter.setMode({ kind: 'swing', t: 0 });
    timers.after(0.25, () => {
      if (phase === 'over') return;
      const before = hp;
      hp = hitHero(hp, amount);
      hud.setHealth(hp, before);
      hud.hurt();
      effects.shake('hit');
      sfx.thud();
      // A hero in the middle of a move shows the hit only on the HUD.
      if (strike === null && !hero.busy) hero.setMode({ kind: 'hurt', t: 0 });
      if (hp <= 0) over();
    });
  };

  const ringHit = (t: Thug) => {
    t.perfect = false;
    t.turn = ++turnCounter;
    t.ring = 0;
    t.readLeft = READ_SECONDS;
    if (!speedLevel()) typing.spk = nextSpk(typing.spk, 'timeout');
    save();
    hurtHero(HIT_RING, t);
  };

  // ---------- Keys ----------
  const lockOn = (t: Thug) => {
    locked = t;
    pos = 0;
    hero.face(sideOf(t.fighter));
    paintLabel(t);
  };

  const unlock = () => {
    const old = locked;
    locked = null;
    pos = 0;
    if (old) paintLabel(old);
  };

  const landBlock = (t: Thug) => {
    const keys = t.text.length;
    const mistakes = t.mistakes.size;
    const seconds = activeTime - (blockStart ?? activeTime);
    stats.keys += keys;
    stats.right += keys - mistakes;
    stats.fastKeys += keys;
    stats.fastSeconds += seconds;
    if (speedLevel()) {
      group.keys += keys;
      group.mistakes += mistakes;
      group.seconds += seconds;
    }
    blockStart = null;
    const last = t.block >= t.plan.length - 1;
    const move = dev?.move ?? pickMove(moveClassOf(t.plan, t.block), lastMove, Math.random);
    lastMove = move;
    unlock();

    if (!last) {
      const points = blockPoints(keys, playLevel);
      score += points;
      strikes.push({
        move,
        target: t.fighter,
        finisher: false,
        popText: `+${fmt(points)}`,
        popColor: '#facc15',
        big: false,
        perfect: false,
        streakUp: null,
        stage: 'move',
        t: 0,
        contacted: false,
      });
      t.block++;
      showBlock(t);
      return;
    }

    // The finisher: the thug is knocked out.
    const perfect = t.perfect;
    const before = streakMultiplier(streak);
    streak = perfect ? streak + 1 : 0;
    const points = killPoints(t.kind, streak, playLevel);
    score += points;
    stats.knockouts++;
    if (!speedLevel()) typing.spk = nextSpk(typing.spk, perfect ? 'perfect' : 'mistakes');
    else {
      groupKills++;
      if (groupKills >= SPEED_GROUP) closeGroup();
    }
    save();
    const now = streakMultiplier(streak);
    const s: Strike = {
      move,
      target: t.fighter,
      finisher: true,
      popText: `+${fmt(points)}`,
      popColor: '#ffc928',
      big: true,
      perfect,
      streakUp: now > before ? now : null,
      stage: 'move',
      t: 0,
      contacted: false,
    };
    strikes.push(s);
    thugs = thugs.filter((x) => x !== t);
    t.label.remove();
    dying.push({ fighter: t.fighter, away: sideOf(t.fighter), strike: s, flown: -1 });
    spawnCooldown = ENTER_DELAY;
    renderHud();
  };

  const onKey = (char: string) => {
    if (paused() || phase !== 'fighting') return;
    let t = locked;
    if (!t) {
      const id = lockThug(
        thugs.map((x) => ({ id: x.id, text: x.text, x: x.fighter.worldX(), engaged: x.engaged })),
        char,
        hero.x,
      );
      t = thugs.find((x) => x.id === id) ?? null;
      if (!t) {
        sfx.wrongKey();
        return;
      }
      lockOn(t);
    }
    const expected = t.text[pos];
    if (char === expected) {
      if (pos === 0) blockStart = activeTime;
      if (!t.mistakes.has(pos)) recordPress(typing, expected, true);
      sfx.key();
      pos++;
      if (pos >= t.text.length) landBlock(t);
      else paintLabel(t);
    } else {
      t.label.flashWrong();
      sfx.wrongKey();
      if (!t.mistakes.has(pos)) {
        recordPress(typing, expected, false);
        t.mistakes.add(pos);
        t.perfect = false;
        hurtHero(HIT_WRONG, t);
      }
    }
  };

  // ---------- Scraps ----------
  const startWalking = () => {
    phase = 'walking';
    walkLeft = firstScrap ? FIRST_WALK_SECONDS : WALK_SECONDS;
    hero.face(1, true);
    hero.setMode({ kind: 'walk' });
    pops.centre(`Fight ${scrap}`, '#ffffff');
    renderHud();
    if (frozen()) startEntering();
  };

  const startEntering = () => {
    phase = 'entering';
    hero.setMode({ kind: 'idle' });
    hero.x = anchorX;
    const first = firstScrap;
    const kinds = dev?.kind
      ? Array.from({ length: scrapKinds(scrap, Math.random).length }, () => dev.kind as Kind)
      : scrapKinds(scrap, Math.random);
    queue = first && dev?.thugs ? kinds.slice(0, dev.thugs) : kinds;
    firstScrap = false;
    nextSide = 1;
    spawning = true;
    spawnFromQueue(frozen());
    spawning = false;
    if (thugs.some((t) => t.engaged)) beginFighting();
  };

  const beginFighting = () => {
    if (phase !== 'entering') return;
    phase = 'fighting';
    if (dev?.lock && scrap === (dev.scrap ?? 1) && !devLockUsed) applyDevLock();
    if (dev?.keys && !devKeysUsed) {
      devKeysUsed = true;
      for (const c of dev.keys) onKey(c);
    }
  };
  let devLockUsed = false;
  let devKeysUsed = false;

  /** Dev: the thug in a slot starts locked with some keys done. */
  const applyDevLock = () => {
    devLockUsed = true;
    if (!dev?.lock) return;
    const t = thugs.find((x) => x.slot === dev.lock! - 1 && x.engaged);
    if (!t) return;
    lockOn(t);
    pos = Math.min(dev.typed, t.text.length - 1);
    blockStart = activeTime;
    hero.face(sideOf(t.fighter), true);
    paintLabel(t);
    if (dev.wrong) {
      t.label.flashWrong(true);
      hud.setHealth(hp, Math.min(HP_MAX, hp + HIT_WRONG));
    }
  };

  const afterScrap = () => {
    scrap++;
    if (pendingLevel === null) {
      startWalking();
      return;
    }
    // A level opened in this fight: its lesson shows, then the walk goes on with the new keys.
    playLevel = pendingLevel;
    pendingLevel = null;
    typing.level = playLevel;
    save();
    renderHud();
    lessonThen(playLevel, true, startWalking);
  };

  const clearScrap = () => {
    phase = 'scrapclear';
    sfx.chime();
    const bonus = scrapBonus(scrap, playLevel);
    score += bonus;
    pops.centre(`Fight cleared! +${fmt(bonus)}`, '#4ade80');
    if (mastered(typing, playLevel)) rampSteps++;
    const before = hp;
    hp = refill(hp, REFILL_SCRAP);
    hud.setHealth(hp, before > hp ? before : undefined);
    checkLevelUp();
    renderHud();
    timers.after(1.4, afterScrap);
  };

  const over = () => {
    phase = 'over';
    graceLeft = 0;
    if (locked) {
      stats.keys += pos;
      stats.right += pos - [...locked.mistakes].filter((i) => i < pos).length;
      unlock();
    }
    strikes = [];
    strike = null;
    labelLayer.hidden = true;
    hero.setMode({ kind: 'down', t: 0 });
    sfx.miss();
    pops.centre('Knocked out!', '#ff5a5a');
    timers.after(1.6, finish);
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    hud.show(false);
    const speedNow = stats.fastSeconds > 0 ? stats.fastKeys / 5 / (stats.fastSeconds / 60) : 0;
    typing.bestWpm = Math.max(typing.bestWpm, Math.round(speedNow));
    const before = session.highScore();
    const newHighScore = hooked ? score > before : session.recordScore(score);
    save();
    if (newHighScore) sfx.goal();
    showResults({
      topicId: TYPING_LEVEL_ID,
      correct: stats.right,
      total: stats.keys,
      stars: starsFor(stats.right, stats.keys),
      newBest: false,
      missed: [],
      playerName: session.player?.name,
      score,
      highScore: Math.max(before, score),
      newHighScore,
      outcome: resultsText(stats, scrap, opened),
      playAgainLabel: 'Brawl again 🥊',
      onPlayAgain: () => showStart(),
    });
  };

  /** Removes every thug, flying body and waiting move: a fresh street. */
  const clearStreet = () => {
    for (const t of thugs) {
      t.label.remove();
      disposeFighter(t.fighter);
    }
    for (const d of dying) disposeFighter(d.fighter);
    thugs = [];
    dying = [];
    queue = [];
    strikes = [];
    strike = null;
    locked = null;
    pos = 0;
    words.clear();
    effects.clear();
    timers.clear();
  };

  // ---------- Placing labels ----------
  const placeLabels = () => {
    const showLabels = phase === 'entering' || phase === 'fighting' || phase === 'scrapclear';
    labelLayer.hidden = !showLabels;
    if (!showLabels) return;
    const { h } = size();
    const safeTop = parseFloat(getComputedStyle(probe).paddingTop) || 0;
    const pitch = Math.abs(project(2, 1).x - project(0, 1).x);
    const boxes: { t: Thug; box: LabelBox }[] = [];
    for (const t of thugs) {
      if (!t.engaged) continue;
      const font = Math.min(labelFontPx(pitch, t.text.length), h < 500 ? 18 : 22);
      if (font !== t.font) {
        t.font = font;
        t.label.setFont(font);
      }
      const w = t.label.width;
      const lh = t.label.height;
      const head = project(t.fighter.worldX(), t.fighter.headHeight() + 0.1, t.fighter.z);
      const far = t.slot >= 2 ? lh + 2 : 0;
      boxes.push({ t, box: { x: head.x - w / 2, y: head.y - lh - 6 - far, w, h: lh } });
    }
    const dy = staggerLabels(boxes.map((b) => b.box));
    boxes.forEach((b, i) => {
      const { w } = size();
      const x = clamp(b.box.x, 4, Math.max(4, w - b.box.w - 4));
      b.t.label.place(x, clampLabelY(b.box.y + dy[i], b.box.h, w, h, safeTop));
    });
  };

  // ---------- The frame ----------
  const update = (delta: number) => {
    let dt = paused() ? 0 : delta;
    // Dev `at`: the first move holds when it reaches that time.
    if (dev?.at != null && strikesStarted > 0) {
      if (holding) dt = 0;
      else if (strike && strike.stage === 'move') {
        const left = dev.at - strike.t;
        if (dt >= left) {
          dt = Math.max(0, left);
          holding = true;
        }
      }
    }
    dtNow = dt;
    timers.update(dt);
    const hold = frozen();

    if (phase === 'walking') {
      if (!hold) {
        anchorX += WALK_SPEED * dt;
        hero.x = anchorX;
        walkLeft -= dt;
        if (walkLeft <= 0) startEntering();
      }
    } else if (phase === 'entering' || phase === 'fighting') {
      if (phase === 'fighting') activeTime += dt;
      // Thugs walk in to their slots.
      for (const t of thugs) {
        if (t.engaged) continue;
        const to = anchorX + SLOTS[t.slot].x;
        const d = to - t.fighter.x;
        const step = ENTER_SPEED * dt;
        t.fighter.face(d >= 0 ? 1 : -1);
        if (Math.abs(d) <= step) {
          t.fighter.x = to;
          engage(t);
        } else t.fighter.x += Math.sign(d) * step;
      }
      if (phase === 'fighting') {
        spawnCooldown -= dt;
        if (spawnCooldown <= 0 && queue.length > 0 && thugs.length < MAX_THUGS) {
          spawnFromQueue(false);
          spawnCooldown = ENTER_DELAY;
        }
        updateRings(dt, hold);
        // The scrap is over when nobody is left and the last hit has landed.
        if (
          thugs.length === 0 &&
          queue.length === 0 &&
          dying.length === 0 &&
          heroIdle() &&
          phase === 'fighting'
        ) {
          clearScrap();
        }
      }
    }

    pumpStrikes();
    // The hero slides back to the middle when nothing is going on.
    if (heroIdle() && phase !== 'walking' && phase !== 'over' && hero.mode.kind !== 'down') {
      const d = anchorX - hero.x;
      if (Math.abs(d) > 0.02) {
        const step = 8 * dt;
        hero.x += Math.abs(d) <= step ? d : Math.sign(d) * step;
        if (hero.mode.kind === 'idle') hero.setMode({ kind: 'walk' });
      } else if (hero.mode.kind === 'walk') hero.setMode({ kind: 'idle' });
    }

    // Bodies that were launched go when they have flown.
    for (const d of dying) if (d.flown >= 0) d.flown += dt;
    for (const d of dying.filter((x) => x.flown >= LAUNCH_TOTAL)) disposeFighter(d.fighter);
    dying = dying.filter((d) => d.flown < LAUNCH_TOTAL);

    hero.update(dt);
    for (const t of thugs) t.fighter.update(dt);
    for (const d of dying) d.fighter.update(dt);
    effects.update(dt, hold && dev?.at == null);
    hud.update(dt, hold);
    street.update(anchorX);
    syncCamera();
    placeLabels();
  };

  /** Rings: only the attacker's runs; all hold for a second after any hit on the hero. */
  const updateRings = (dt: number, hold: boolean) => {
    const attackerId = attackerOf(thugs);
    const attacker = thugs.find((t) => t.id === attackerId) ?? null;
    if (attackerId !== lastAttacker) {
      lastAttacker = attackerId;
      if (attacker) {
        attacker.ring = 0;
        attacker.readLeft = READ_SECONDS;
        if (dev?.ring != null && !devRingUsed) {
          devRingUsed = true;
          attacker.ring = dev.ring * ringFor(attacker);
          attacker.readLeft = 0;
        }
      }
    }
    if (graceLeft > 0) graceLeft = Math.max(0, graceLeft - dt);
    else if (attacker && !hold) {
      if (attacker.readLeft > 0) attacker.readLeft = Math.max(0, attacker.readLeft - dt);
      else {
        attacker.ring += dt;
        if (attacker.ring >= ringFor(attacker)) ringHit(attacker);
      }
    }
    for (const t of thugs) {
      t.label.setRing(t.ring / ringFor(t), t === attacker);
    }
  };

  // ---------- The start screen and the lessons ----------
  /** Shows the level's lesson (once, or always with `force`), then `next`. */
  const lessonThen = (level: number, force: boolean, next: () => void) => {
    if (!force && typing.lessons.includes(level)) {
      next();
      return;
    }
    const done = () => {
      if (!typing.lessons.includes(level)) typing.lessons.push(level);
      save();
      next();
    };
    showKeyLesson({
      level,
      onDone: done,
      onSkip: done,
      speak,
      paused,
      readyLine: READY_LINE,
      spaceLine: SPACE_LINE,
    });
  };

  /** The start screen: pick a level, test out of a locked one, see a lesson again, press the space bar. */
  const openPicker = (begin: () => void) => {
    picker?.dispose();
    const mine: LevelPicker = showLevelPicker({
      typing,
      selected: typing.level,
      spaceLine: SPACE_LINE,
      onPick(n) {
        typing.level = n;
        save();
      },
      onTestOut(n) {
        mine.dispose();
        showTestOut({
          level: n,
          onDone(passed) {
            if (passed) {
              openLevel(typing, n);
              typing.level = n;
              save();
            }
            openPicker(begin);
          },
        });
      },
      onLesson(n) {
        mine.dispose();
        lessonThen(n, true, () => openPicker(begin));
      },
      onStart() {
        mine.dispose();
        lessonThen(typing.level, dev?.lesson ?? false, begin);
      },
    });
    picker = mine;
  };

  /** Everything before a run: the picker and the lesson (or neither with `start=1`), then the first walk. */
  const showStart = (firstRun = false) => {
    phase = 'start';
    hud.show(false);
    clearStreet();
    labelLayer.hidden = true;
    const begin = () => {
      playLevel = clamp(typing.level, 1, typing.open);
      typing.level = playLevel;
      pendingLevel = null;
      stats = emptyStats();
      opened = [];
      speedRun = 0;
      group = { keys: 0, mistakes: 0, seconds: 0 };
      groupKills = 0;
      score = 0;
      streak = 0;
      hp = dev?.hp ?? HP_MAX;
      scrap = dev?.scrap ?? 1;
      rampSteps = dev?.ramp ?? 0;
      firstScrap = true;
      finished = false;
      activeTime = 0;
      graceLeft = 0;
      spawnCooldown = 0;
      lastAttacker = null;
      lastMove = null;
      turnCounter = 0;
      anchorX = 0;
      hero.x = 0;
      hero.face(1, true);
      hero.setMode({ kind: 'idle' });
      save();
      hud.setHealth(hp);
      hud.show(true);
      renderHud();
      startWalking();
    };
    // `start=1` skips the picker on page load only; play again always shows it.
    if (!dev?.start || !firstRun) openPicker(begin);
    else if (dev.lesson) lessonThen(typing.level, true, begin);
    else begin();
  };

  // ---------- Keys, and the note for a player with no keyboard ----------
  let sawKey = false;
  let noteTimer: ReturnType<typeof setTimeout> | undefined;
  const onAnyKey = () => {
    if (!sawKey) {
      sawKey = true;
      try {
        unlockAudio();
      } catch {
        // Audio trouble must never stop the game.
      }
    }
    note.hidden = true;
  };
  const onPointer = () => {
    if (sawKey) return;
    note.hidden = false;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => (note.hidden = true), 4000);
  };
  window.addEventListener('keydown', onAnyKey, true);
  window.addEventListener('pointerdown', onPointer);
  const stopKeys = onTypingKey((char) => onKey(char));

  ctx.onUpdate(update);
  ctx.start();
  syncCamera();
  showStart(true);

  window.addEventListener('pagehide', () => {
    stopKeys();
    window.removeEventListener('keydown', onAnyKey, true);
    window.removeEventListener('pointerdown', onPointer);
    clearTimeout(noteTimer);
    timers.clear();
    picker?.dispose();
    pause.dispose();
    mute.dispose();
    hud.dispose();
    pops.dispose();
    words.clear();
    effects.dispose();
    street.dispose();
    labelLayer.remove();
    note.remove();
    probe.remove();
    ctx.dispose();
  });
}

run(startTypingSession(GAME_ID));
