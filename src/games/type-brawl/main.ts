import { Vector3 } from 'three';
import { sfx, speak, unlockAudio } from '../../shared/audio';
import { showResults } from '../../shared/results';
import { starsFor } from '../../shared/round';
import { DANCE_SECONDS } from '../../shared/dances';
import { chooseDance } from '../../shared/dances/dev';
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
import { createBonkStars, createEffects, createWords } from './effects';
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
  BOSS_FONT_FLOOR,
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
import { MOVES, POP_AT } from './moves';
import {
  BOSS_BANNER_SECONDS,
  BOSS_GAP_SECONDS,
  HIT_GRACE,
  HIT_WRONG,
  HP_MAX,
  ITEM_EMOJI,
  ITEM_HEAL,
  ITEM_KEYS,
  MAX_THUGS,
  READ_SECONDS,
  REFILL_STAGE,
  SPEED_GROUP,
  STAGE_SCRAPS,
  STAR_KNOCKOUTS,
  attackerOf,
  blockPlan,
  blockPoints,
  bossScrapKinds,
  dropsItem,
  emptyStats,
  fightNumber,
  hitHero,
  killPoints,
  lockThug,
  mastered,
  moveClassOf,
  pickItem,
  pickMove,
  pickWord,
  refill,
  resultsText,
  ringDamage,
  ringSeconds,
  scrapBonus,
  scrapKinds,
  scrapSize,
  slackFor,
  speedGroupPasses,
  spkFor,
  stageBonus,
  stageInfo,
  streakMultiplier,
  type Group,
  type ItemType,
  type Kind,
  type MoveId,
} from './rules';
import { createStreet } from './street';

const GAME_ID = 'type-brawl';
const READY_LINE = 'Ready to brawl?';
const SPACE_LINE = 'Every block ends with the space bar: that is the punch!';
const COLORS: Record<Kind, string> = { thug: '#7dd3fc', bruiser: '#f472b6', boss: '#fb923c' };
const ENTER_DELAY = 0.6;

type Phase = 'start' | 'walking' | 'entering' | 'fighting' | 'scrapclear' | 'stageclear' | 'over';
/** Seconds the hero takes to jog over to an item. */
const GRAB_SECONDS = 0.4;
const ITEM_COLOR = '#4ade80';

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

/** A dropped item: a block of 2 keys and its space, shown as a floating label with its emoji. */
interface Item {
  id: string;
  type: ItemType;
  text: string;
  /** World x of the drop. */
  x: number;
  z: number;
  label: Label;
  font: number;
  pos: number;
  mistakes: Set<number>;
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
  let street = createStreet(ctx.scene, stageInfo(1).def);
  let streetId = stageInfo(1).def.id;
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
  const bonkStars = createBonkStars();
  hero.person.head.add(bonkStars.object);
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

  /** The stage (from 1, counting loops of the six) and the fight in it (the last is the boss). */
  let stage = 1;
  let fight = 1;
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
  let dying: {
    fighter: Fighter;
    away: 1 | -1;
    strike: Strike | null;
    flown: number;
    popped: boolean;
  }[] = [];
  let strikes: Strike[] = [];
  let strike: Strike | null = null;
  /** The thug the hero is locked on, and how many keys of its block are typed. */
  let locked: Thug | null = null;
  let pos = 0;
  /** Every thug whose block still matches the keys typed (the locked one is among them). */
  let fits: Thug[] = [];
  let blockStart: number | null = null;
  /** Dev `at`: the first move holds at this time. */
  let holding = false;
  let strikesStarted = 0;
  /** Items on the street, the one being typed, those typed and waiting for the hero, and the jog. */
  let items: Item[] = [];
  let itemSeq = 0;
  let lockedItem: Item | null = null;
  let grabQueue: Item[] = [];
  let grab: { item: Item; t: number; from: number } | null = null;
  /** Knock-outs the star still makes perfect. */
  let starLeft = 0;
  /** Seconds before the boss walks in (the banner shows meanwhile). */
  let bossWait = 0;
  let winUsed = false;
  let devItemUsed = false;
  /** Dev `?win=dance`: the stage clear holds the dance for ever. */
  const holdDance = dev?.win ?? false;

  const speedLevel = () => levelOf(playLevel).kind === 'speed';
  const frozen = () => dev?.freeze ?? false;
  const paused = () => pause.isPaused;
  const stageDef = () => stageInfo(stage).def;
  const loopNo = () => stageInfo(stage).loop;
  const bossFight = () => fight > STAGE_SCRAPS;
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
      fight: `Stage ${stage} · ${bossFight() ? 'Boss' : `${fight}/${STAGE_SCRAPS}`}`,
      stars: starLeft,
      best: session.highScore(),
    });
  };

  const rise = (text: string, thug: Fighter, color?: string, big = false) => {
    const p = project(thug.worldX(), thug.headHeight() * 0.6);
    pops.rise(text, p.x, p.y, color, big);
  };

  /** The street the stage is set in: rebuilt when the stage's look changes. */
  const applyStage = () => {
    const def = stageDef();
    if (def.id === streetId) return;
    street.dispose();
    street = createStreet(ctx.scene, def);
    streetId = def.id;
    ctx.scene.add(street.object);
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
    const typed = isLocked || fits.includes(t) ? pos : 0;
    t.label.setState({ typed, locked: isLocked, wrong: false });
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
    const fighter = createFighter(
      lookFor(kind, Math.random, stage - 1, dev?.species ?? undefined),
      Math.random() * 6,
    );
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

  const spawnFromQueue = (instant: boolean, limit = Infinity) => {
    let spawned = 0;
    while (queue.length > 0 && thugs.length < MAX_THUGS && spawned < limit) {
      spawn(queue.shift() as Kind, instant);
      spawned++;
      if (takenSlots().size >= SLOTS.length) break;
    }
  };

  // ---------- Items ----------
  const paintItem = (it: Item) => {
    it.label.setState({ typed: it.pos, locked: lockedItem === it, wrong: false });
  };

  /** An item lands at (x, z): a 2-key block whose first key differs from every label showing. */
  const dropItem = (type: ItemType, x: number, z: number) => {
    if (phase === 'over' || phase === 'walking' || phase === 'start') return;
    const avoid = [...thugs.map((t) => t.text[0]), ...items.map((i) => i.text[0])];
    const text = targetText(
      planChunk({
        level: playLevel,
        keys: ITEM_KEYS,
        random: Math.random,
        history: typing.keys,
        avoid,
      }),
    );
    const label = createLabel(labelLayer, `${text}`, ITEM_COLOR, ITEM_EMOJI[type]);
    const it: Item = {
      id: `i${itemSeq++}`,
      type,
      text,
      x,
      z,
      label,
      font: 0,
      pos: 0,
      mistakes: new Set(),
    };
    items.push(it);
    paintItem(it);
  };

  /** Removes every item (and what is waiting to grab them); with `fade` they fade out. */
  const clearItems = (fade: boolean) => {
    for (const it of items) {
      if (fade) it.label.fade();
      else it.label.remove();
    }
    items = [];
    lockedItem = null;
    grabQueue = [];
    grab = null;
  };

  const finishGrab = (it: Item) => {
    grab = null;
    sfx.chime();
    const at = project(hero.worldX(), 2.1);
    if (it.type === 'star') {
      starLeft = STAR_KNOCKOUTS;
      pops.rise('⭐ Next 3 are perfect!', at.x, at.y, '#c4b5fd', true);
    } else {
      const before = hp;
      hp = refill(hp, ITEM_HEAL[it.type]);
      hud.setHealth(hp);
      pops.rise(`+${hp - before} HP`, at.x, at.y, '#4ade80', true);
    }
    items = items.filter((x) => x !== it);
    it.label.fade();
    hero.setMode({ kind: 'idle' });
    renderHud();
  };

  const pumpGrabs = () => {
    if (grab) {
      grab.t += dtNow;
      const k = Math.min(1, grab.t / GRAB_SECONDS);
      hero.x = grab.from + (grab.item.x - grab.from) * k;
      if (k >= 1) finishGrab(grab.item);
    } else if (
      grabQueue.length > 0 &&
      strike === null &&
      strikes.length === 0 &&
      !hero.busy &&
      phase !== 'over'
    ) {
      const item = grabQueue.shift() as Item;
      grab = { item, t: 0, from: hero.x };
      hero.face(item.x >= hero.x ? 1 : -1);
      hero.setMode({ kind: 'walk' });
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
    const species = target.look.species ?? 'robot';
    effects.hit(chest, def.cls, species, target.look.color ?? 0xffffff);
    const at = project(chest.x, chest.y + 0.3, chest.z);
    words.pop(pickWord(species, def.cls, Math.random), at, frozen());
    if (def.cls === 'finisher') sfx.boom();
    else if (def.cls === 'heavy') sfx.thud();
    else if (species === 'robot') sfx.slap();
    else sfx.glove();
    const away = sideOf(target) as 1 | -1;
    if (s.finisher) {
      effects.shake('finisher');
      const entry = dying.find((d) => d.fighter === target);
      if (entry) {
        entry.flown = 0;
        entry.away = away;
      }
      const launch = MOVES[def.launch ? s.move : 'flying-kick'].launch;
      // The flight ends inside the picture, so the pop can be seen.
      const dir = away * (launch?.dir ?? 1);
      const room = dir * (anchorX + dir * (halfWidth() - 1.6) - target.worldX());
      target.setMode({
        kind: 'launch',
        move: def.launch ? s.move : 'flying-kick',
        t: 0,
        away,
        cap: Math.max(0.5, room),
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

  const heroIdle = () =>
    strike === null &&
    strikes.length === 0 &&
    !hero.busy &&
    grab === null &&
    grabQueue.length === 0;

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
      bonk(frozen());
      effects.shake('hit');
      sfx.thud();
      // A hero in the middle of a move shows the hit only on the HUD.
      if (strike === null && !hero.busy) hero.setMode({ kind: 'hurt', t: 0 });
      if (hp <= 0) over();
    });
  };

  /** The silly bonk: stars circle the hero's head for 0.8 s and a BONK! word pops over it. */
  const bonk = (hold = false) => {
    bonkStars.show(hold ? Infinity : 0.8);
    const head = hero.person.head.getWorldPosition(new Vector3());
    words.pop('BONK!', project(head.x, head.y + 0.55, head.z), hold);
  };

  const ringHit = (t: Thug) => {
    t.perfect = false;
    t.turn = ++turnCounter;
    t.ring = 0;
    t.readLeft = READ_SECONDS;
    if (!speedLevel()) typing.spk = nextSpk(typing.spk, 'timeout');
    save();
    hurtHero(ringDamage(t.kind), t);
  };

  // ---------- Keys ----------
  const lockOn = (t: Thug) => {
    locked = t;
    if (!fits.includes(t)) fits = [t];
    hero.face(sideOf(t.fighter));
    for (const f of fits) paintLabel(f);
  };

  const unlock = () => {
    const old = [...fits];
    if (locked && !old.includes(locked)) old.push(locked);
    locked = null;
    fits = [];
    pos = 0;
    for (const f of old) paintLabel(f);
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
    const clean = t.perfect;
    // The star makes the next knock-outs perfect for the streak and the score, not for the typing stats.
    const perfect = clean || starLeft > 0;
    if (starLeft > 0) starLeft--;
    const before = streakMultiplier(streak);
    streak = perfect ? streak + 1 : 0;
    const points = killPoints(t.kind, streak, playLevel);
    score += points;
    stats.knockouts++;
    if (!speedLevel()) typing.spk = nextSpk(typing.spk, clean ? 'perfect' : 'mistakes');
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
    dying.push({
      fighter: t.fighter,
      away: sideOf(t.fighter),
      strike: s,
      flown: -1,
      popped: false,
    });
    spawnCooldown = Math.max(spawnCooldown, ENTER_DELAY);
    if (dev?.item || dropsItem(t.kind, Math.random)) {
      const type = dev?.item ?? pickItem(Math.random);
      const { x, z } = t.fighter;
      timers.after(0.5, () => dropItem(type, x, z));
    }
    renderHud();
  };

  /** A key on the item being typed: a wrong one only buzzes (recorded once per spot, no hit). */
  const itemKey = (it: Item, char: string) => {
    const expected = it.text[it.pos];
    if (char === expected) {
      if (!it.mistakes.has(it.pos)) recordPress(typing, expected, true);
      sfx.key();
      it.pos++;
      if (it.pos < it.text.length) {
        paintItem(it);
        return;
      }
      stats.keys += it.text.length;
      stats.right += it.text.length - it.mistakes.size;
      lockedItem = null;
      paintItem(it);
      grabQueue.push(it);
      save();
    } else {
      it.label.flashWrong();
      sfx.wrongKey();
      if (!it.mistakes.has(it.pos)) {
        recordPress(typing, expected, false);
        it.mistakes.add(it.pos);
      }
    }
  };

  const onKey = (char: string) => {
    if (paused()) return;
    // Only the items can be typed once the scrap is cleared.
    if (phase !== 'fighting' && !(phase === 'scrapclear' && items.length > 0)) return;
    if (lockedItem) {
      itemKey(lockedItem, char);
      return;
    }
    let t = locked;
    if (!t) {
      const free = items.filter((i) => !grabQueue.includes(i) && grab?.item !== i);
      const id = lockThug(
        [
          ...thugs.map((x) => ({
            id: x.id,
            text: x.text,
            x: x.fighter.worldX(),
            engaged: x.engaged,
          })),
          ...free.map((i) => ({ id: i.id, text: i.text, x: i.x, engaged: true, item: true })),
        ],
        char,
        hero.x,
      );
      const item = free.find((i) => i.id === id);
      if (item) {
        lockedItem = item;
        item.pos = 0;
        itemKey(item, char);
        return;
      }
      t = thugs.find((x) => x.id === id) ?? null;
      if (!t) {
        sfx.wrongKey();
        return;
      }
      pos = 0;
      fits = thugs.filter((x) => x.engaged && x.text[0] === char);
      lockOn(t);
    } else if (t.text[pos] !== char) {
      // The key fits another thug that is still in play: aim at the nearest of those instead.
      const alt = fits.filter((x) => x !== t && x.text[pos] === char);
      if (alt.length > 0) {
        const hx = hero.x;
        alt.sort((p, q) => Math.abs(p.fighter.worldX() - hx) - Math.abs(q.fighter.worldX() - hx));
        t = alt[0];
        lockOn(t);
      }
    }
    const expected = t.text[pos];
    if (char === expected && fits.length > 1) {
      const was = fits;
      fits = was.filter((x) => x.text[pos] === char);
      for (const f of was) if (!fits.includes(f)) paintLabel(f);
    }
    if (char === expected) {
      if (pos === 0) blockStart = activeTime;
      if (!t.mistakes.has(pos)) recordPress(typing, expected, true);
      sfx.key();
      pos++;
      if (pos >= t.text.length) landBlock(t);
      else for (const f of fits) paintLabel(f);
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

  // ---------- Scraps and stages ----------
  const startWalking = () => {
    phase = 'walking';
    clearItems(true);
    applyStage();
    walkLeft = firstScrap ? FIRST_WALK_SECONDS : WALK_SECONDS;
    hero.face(1, true);
    hero.setMode({ kind: 'walk' });
    if (fight === 1) pops.centre(`Stage ${stage}: ${stageDef().title}`, '#ffffff');
    else if (!bossFight()) pops.centre(`Fight ${fight}`, '#ffffff');
    renderHud();
    if (frozen()) startEntering();
  };

  const startEntering = () => {
    if (dev?.win && !winUsed) {
      // Dev: no fight, the stage clears at once.
      winUsed = true;
      firstScrap = false;
      clearStage();
      return;
    }
    phase = 'entering';
    hero.setMode({ kind: 'idle' });
    hero.x = anchorX;
    const first = firstScrap;
    let kinds: Kind[];
    if (bossFight()) kinds = bossScrapKinds(loopNo());
    else if (dev?.kind && dev.kind !== 'boss') {
      kinds = Array.from({ length: scrapSize(fight, loopNo()) }, () => dev.kind as Kind);
    } else kinds = scrapKinds(fight, Math.random, loopNo(), stage);
    queue = first && dev?.thugs ? kinds.slice(0, dev.thugs) : kinds;
    firstScrap = false;
    nextSide = 1;
    if (bossFight() && !frozen()) {
      // The alarm and the banner, then the boss walks in alone.
      bossWait = BOSS_BANNER_SECONDS;
      pops.centre(`Boss: ${stageDef().boss}`, '#fb923c');
      sfx.alarm();
      return;
    }
    spawning = true;
    spawnFromQueue(frozen(), bossFight() && !frozen() ? 1 : undefined);
    spawning = false;
    if (bossFight()) spawnCooldown = BOSS_GAP_SECONDS;
    if (thugs.some((t) => t.engaged)) beginFighting();
  };

  const beginFighting = () => {
    if (phase !== 'entering') return;
    phase = 'fighting';
    if (dev?.lock && !devLockUsed) applyDevLock();
    if (dev?.bonk && !bonkUsed) {
      bonkUsed = true;
      hud.hurt(true);
      bonk(true);
    }
    if (dev?.item && !devItemUsed) {
      devItemUsed = true;
      dropItem(dev.item, anchorX - 1.9, 0.3);
    }
    if (dev?.keys && !devKeysUsed) {
      devKeysUsed = true;
      for (const c of dev.keys) onKey(c);
    }
  };
  let popHeld = false;
  let popHeldUsed = false;
  let bonkUsed = false;
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

  /** The next fight of the stage, or the next stage after a boss. */
  const nextFight = () => {
    if (bossFight()) {
      stage++;
      fight = 1;
    } else fight++;
    if (pendingLevel === null) {
      startWalking();
      return;
    }
    // A level opened in the stage that just ended: its lesson shows, then the walk goes on with the new keys.
    playLevel = pendingLevel;
    pendingLevel = null;
    typing.level = playLevel;
    save();
    renderHud();
    lessonThen(playLevel, true, startWalking);
  };

  /** A scrap is cleared: the bonus, then the walk to the next fight (a little longer while an item waits). */
  const clearScrap = () => {
    phase = 'scrapclear';
    sfx.chime();
    const bonus = scrapBonus(fightNumber(stage, fight), playLevel);
    score += bonus;
    pops.centre(`Fight cleared! +${fmt(bonus)}`, '#4ade80');
    renderHud();
    timers.after(1.4, () => {
      if (items.length > 0) timers.after(2.0, nextFight);
      else nextFight();
    });
  };

  /** The boss is down: the stage bonus, health back, the dance, the level-up check, then the next stage. */
  const clearStage = () => {
    phase = 'stageclear';
    clearItems(true);
    sfx.chime();
    const bonus = stageBonus(stage, playLevel);
    score += bonus;
    pops.centre(`Stage ${stage} clear! +${fmt(bonus)}`, '#4ade80');
    const before = hp;
    hp = refill(hp, REFILL_STAGE);
    hud.setHealth(hp, before > hp ? before : undefined);
    hero.setMode({ kind: 'dance', dance: chooseDance(), t: 0 });
    renderHud();
    if (holdDance) return;
    timers.after(DANCE_SECONDS, () => {
      hero.face(1);
      hero.setMode({ kind: 'idle' });
      if (mastered(typing, playLevel)) rampSteps++;
      checkLevelUp();
      renderHud();
      timers.after(pendingLevel === null ? 0.3 : 1.4, nextFight);
    });
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
    clearItems(false);
    labelLayer.hidden = true;
    hero.setMode({ kind: 'down', t: 0 });
    bonkStars.show(Infinity);
    sfx.miss();
    pops.centre('Bonked out!', '#ffd23f');
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
      outcome: resultsText(stats, stage, opened),
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
    clearItems(false);
    bossWait = 0;
    words.clear();
    effects.clear();
    bonkStars.hide();
    timers.clear();
  };

  // ---------- Placing labels ----------
  const placeLabels = () => {
    const showLabels = phase === 'entering' || phase === 'fighting' || phase === 'scrapclear';
    labelLayer.hidden = !showLabels;
    if (!showLabels) return;
    const { w, h } = size();
    const safeTop = parseFloat(getComputedStyle(probe).paddingTop) || 0;
    const pitch = Math.abs(project(2, 1).x - project(0, 1).x);
    const cap = h < 500 ? 18 : 22;
    const boxes: { label: Label; box: LabelBox }[] = [];
    for (const t of thugs) {
      if (!t.engaged) continue;
      const floor = t.kind === 'boss' ? BOSS_FONT_FLOOR : 13;
      const font = Math.min(labelFontPx(pitch, t.text.length, floor), cap);
      if (font !== t.font) {
        t.font = font;
        t.label.setFont(font);
      }
      const lw = t.label.width;
      const lh = t.label.height;
      const head = project(t.fighter.worldX(), t.fighter.headHeight() + 0.1, t.fighter.z);
      const far = t.slot >= 2 ? lh + 2 : 0;
      boxes.push({
        label: t.label,
        box: { x: head.x - lw / 2, y: head.y - lh - 6 - far, w: lw, h: lh },
      });
    }
    // Items float at the height of the hero's chest.
    for (const it of items) {
      const font = Math.min(labelFontPx(pitch, it.text.length), cap);
      if (font !== it.font) {
        it.font = font;
        it.label.setFont(font);
      }
      const p = project(it.x, 1.0, it.z);
      boxes.push({
        label: it.label,
        box: {
          x: p.x - it.label.width / 2,
          y: p.y - it.label.height,
          w: it.label.width,
          h: it.label.height,
        },
      });
    }
    const dy = staggerLabels(boxes.map((b) => b.box));
    boxes.forEach((b, i) => {
      const x = clamp(b.box.x, 4, Math.max(4, w - b.box.w - 4));
      b.label.place(x, clampLabelY(b.box.y + dy[i], b.box.h, w, h, safeTop));
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
    // Dev `at` with `win=dance`: the dance holds at that time.
    if (dev?.at != null && dev.win && hero.mode.kind === 'dance') {
      dt = Math.min(dt, Math.max(0, dev.at - hero.mode.t));
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
      if (bossWait > 0) {
        bossWait -= dt;
        if (bossWait <= 0) {
          bossWait = 0;
          spawning = true;
          spawnFromQueue(false, 1);
          spawning = false;
          spawnCooldown = BOSS_GAP_SECONDS;
        }
      }
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
          spawnFromQueue(false, bossFight() ? 1 : undefined);
          spawnCooldown = bossFight() ? BOSS_GAP_SECONDS : ENTER_DELAY;
        }
        updateRings(dt, hold);
        // The scrap is over when nobody is left and the last hit has landed.
        if (
          thugs.length === 0 &&
          queue.length === 0 &&
          dying.length === 0 &&
          heroIdle() &&
          bossWait <= 0 &&
          phase === 'fighting'
        ) {
          if (bossFight()) clearStage();
          else clearScrap();
        }
      }
    }

    pumpStrikes();
    pumpGrabs();
    // The hero slides back to the middle when nothing is going on.
    if (
      heroIdle() &&
      phase !== 'walking' &&
      phase !== 'over' &&
      phase !== 'stageclear' &&
      hero.mode.kind !== 'down'
    ) {
      const d = anchorX - hero.x;
      if (Math.abs(d) > 0.02) {
        const step = 8 * dt;
        hero.x += Math.abs(d) <= step ? d : Math.sign(d) * step;
        if (hero.mode.kind === 'idle') hero.setMode({ kind: 'walk' });
      } else if (hero.mode.kind === 'walk') hero.setMode({ kind: 'idle' });
    }

    // Bodies that were launched go when they have flown.
    for (const d of dying) {
      if (d.flown < 0 || (d.popped && popHeld)) continue;
      d.flown += dt;
      if (!d.popped && d.flown >= POP_AT) {
        d.popped = true;
        const f = d.fighter;
        const species = f.look.species ?? 'robot';
        effects.pop({ x: f.worldX(), y: 0.45, z: f.z }, species, f.look.color ?? 0xffffff);
        sfx.fizz();
        if (dev?.pop && !popHeldUsed) {
          // Dev: the first pop shows 0.15 s of its burst and holds there.
          popHeldUsed = true;
          popHeld = true;
          effects.update(0.15);
        }
      }
    }
    for (const d of dying.filter((x) => x.flown >= LAUNCH_TOTAL)) disposeFighter(d.fighter);
    dying = dying.filter((d) => d.flown < LAUNCH_TOTAL);

    bonkStars.update(dt);
    hero.update(dt);
    for (const t of thugs) {
      t.fighter.hurry = t.id === lastAttacker && t.readLeft <= 0;
      t.fighter.update(dt);
    }
    for (const d of dying) d.fighter.update(dt);
    effects.update(dt, hold && dev?.at == null);
    hud.update(dt, hold);
    street.update(anchorX, performance.now() / 1000);
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
      stage = (dev?.loop ?? 0) * 4 + (dev?.stage ?? 1);
      fight = dev?.kind === 'boss' ? STAGE_SCRAPS + 1 : (dev?.scrap ?? 1);
      starLeft = 0;
      clearItems(false);
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
