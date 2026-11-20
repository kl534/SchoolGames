import { sfx, speak, unlockAudio } from '../../shared/audio';
import { showResults } from '../../shared/results';
import { starsFor } from '../../shared/round';
import { createTimers } from '../../shared/timers';
import { createBackButton, createMuteButton, createPauseOverlay } from '../../shared/ui';
import { TYPING_LEVELS, levelOf, multiplier, skillOf } from '../../shared/typing/course';
import { createKeyboard } from '../../shared/typing/keyboard';
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
  skillLearned,
} from '../../shared/typing/progress';
import { startTypingSession, type TypingSession } from '../../shared/typing/session';
import { showTestOut } from '../../shared/typing/testout';
import { devOptions } from './dev';
import { createEffects } from './effects';
import {
  COLORS,
  createBunker,
  createCannon,
  createInvader,
  createOutline,
  invaderMaterial,
  type Voxels,
} from './invaders';
import {
  createLabel,
  createPops,
  labelFontPx,
  staggerLabels,
  type Label,
  type LabelBox,
} from './labels';
import {
  BUNKER_X,
  CANNON_ROWS,
  COL_PITCH,
  FIELD_HALF,
  GROUND_Y,
  LAND_Y,
  PIXEL,
  UFO_BOTTOM,
  bunkerCellAt,
  chipCount,
  extentOf,
  fieldRect,
  invaderBottom,
  invaderX,
  isCorner,
} from './layout';
import {
  CANNONS,
  CHUNK_KEYS,
  COLUMNS,
  ROWS,
  ROW_KINDS,
  SPEED_GROUP,
  UFO_AT_ALIVE,
  emptyStats,
  killPoints,
  NO_AIM,
  aimKey,
  aimWithout,
  type Aim,
  nextStep,
  planChunk,
  recoil,
  resultsText,
  speedGroupPasses,
  spkFor,
  stepSeconds,
  streakMultiplier,
  targetText,
  ufoSeconds,
  waveBonus,
  waveBudget,
  type Group,
  type Kind,
  type March,
} from './rules';
import { createKeyScene } from './scene3d';

const GAME_ID = 'key-invaders';
const READY_LINE = "You're ready! Let's blast!";
const SPACE_LINE = 'Press the space bar to play!';

type Phase = 'start' | 'entering' | 'marching' | 'cleared' | 'hit' | 'over';

const clamp = (n: number, low: number, high: number): number => Math.min(Math.max(n, low), high);
const fmt = (n: number): string => n.toLocaleString('en-US');

/** A thing the player can lock on: an invader at the front of its column, or the UFO. */
interface Target {
  id: string;
  kind: Kind;
  /** The chunk and its closing space bar. */
  text: string;
  voxels: Voxels;
  label: Label;
  ufo: boolean;
  /** Positions typed wrong at least once. */
  mistakes: Set<number>;
  font: number;
}

interface Invader {
  id: string;
  row: number;
  col: number;
  kind: Kind;
  alive: boolean;
  voxels: Voxels;
  target: Target | null;
}

/**
 * Key Invaders: a Space Invaders formation marches down on four bunkers; the lowest invader of each
 * column carries a chunk of keys. The first key locks the cannon on one, each right key chips it,
 * the closing space bar blasts it. Only the lesson speaks; nothing else here reads aloud.
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
  const scene = createKeyScene(container);
  const world = scene.world;
  const timers = createTimers();
  const effects = createEffects(world);
  const pops = createPops(document.body);
  const labelLayer = document.createElement('div');
  labelLayer.className = 'ki-labels';
  document.body.appendChild(labelLayer);

  const bunkers = BUNKER_X.map((x) => {
    const b = createBunker();
    b.place(x, 1.0);
    world.add(b.mesh);
    return b;
  });
  const cannon = createCannon();
  world.add(cannon.mesh);
  const outline = createOutline();
  world.add(outline.line);
  const invaders: Invader[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      const kind = ROW_KINDS[row];
      const voxels = createInvader(kind);
      world.add(voxels.mesh);
      voxels.mesh.visible = false;
      invaders.push({ id: `i${row}${col}`, row, col, kind, alive: false, voxels, target: null });
    }
  }
  const ufo = {
    voxels: createInvader('ufo'),
    active: false,
    t: 0,
    seconds: 10,
    dir: 1 as 1 | -1,
    x: 0,
    beep: 0,
    target: null as Target | null,
  };
  world.add(ufo.voxels.mesh);
  ufo.voxels.mesh.visible = false;

  // ---------- The keyboard strip, the HUD, the note ----------
  const keyboard = createKeyboard({ hands: false });
  keyboard.element.classList.add('ki-kb');
  keyboard.element.dataset.hidden = '';
  document.body.appendChild(keyboard.element);
  const showKeyboard = (shown: boolean) => {
    if (shown) delete keyboard.element.dataset.hidden;
    else keyboard.element.dataset.hidden = '';
  };

  const note = document.createElement('div');
  note.className = 'ki-note';
  note.hidden = true;
  const noteTitle = document.createElement('strong');
  noteTitle.textContent = 'Key Invaders needs a keyboard ⌨️';
  note.append(noteTitle, 'Plug one in or open it, then press the space bar.');
  document.body.appendChild(note);

  const hud = document.createElement('div');
  hud.className = 'ki-hud';
  hud.hidden = true;
  const hudScore = document.createElement('span');
  hudScore.className = 'ki-score';
  const hudLevel = document.createElement('span');
  hudLevel.className = 'ki-level';
  const hudStreak = document.createElement('span');
  hudStreak.className = 'ki-streak';
  const hudHigh = document.createElement('span');
  hudHigh.className = 'ki-hi';
  const hudCannons = document.createElement('span');
  hudCannons.className = 'ki-cannons';
  const cannonIcons = Array.from({ length: CANNONS }, () => {
    const icon = document.createElement('span');
    icon.textContent = '▲';
    hudCannons.appendChild(icon);
    return icon;
  });
  const hudWave = document.createElement('span');
  hudWave.className = 'ki-wave';
  hud.append(hudScore, hudLevel, hudStreak, hudHigh, hudCannons, hudWave);
  document.body.appendChild(hud);

  createBackButton();
  const mute = createMuteButton();
  const pause = createPauseOverlay();

  // ---------- State ----------
  let phase: Phase = 'start';
  /** The level being played (the picker's choice; the next one after a level-up and a wave). */
  let playLevel = typing.level;
  /** A level that opened in this wave: its lesson shows after the wave is cleared. */
  let pendingLevel: number | null = null;
  let stats = emptyStats();
  let opened: number[] = [];
  let levelupUsed = false;
  let picker: LevelPicker | null = null;

  let wave = 1;
  let waveIndex = 0;
  let lives = CANNONS;
  let score = 0;
  let streak = 0;
  let march: March = { offsetX: 0, drops: 0, dir: 1 };
  let stepClock = 0;
  let stepCount = 0;
  let budget = 60;
  /** Seconds of game time while marching and not paused. */
  let activeTime = 0;
  let entry = 0;
  let overTime = 0;
  let ufoSent = false;
  let bombClock = 2;
  let cannonX = 0;
  let finished = false;

  /** What is locked: the targets still in play, the one aimed at, and the keys typed. */
  let aim: Aim = NO_AIM;
  let lockedAt = 0;
  /** Speed levels: the group of kills so far and the groups in a row at the goal. */
  let group: Group = { keys: 0, mistakes: 0, seconds: 0 };
  let groupKills = 0;
  let groupStart: number | null = null;
  let speedRun = 0;

  const speedLevel = () => levelOf(playLevel).kind === 'speed';
  const frozen = () => dev?.freeze ?? false;
  const paused = () => pause.isPaused;
  const spkEff = () => spkFor(playLevel, typing.spk);

  /** Skills a char needs: a capital needs its letter and its Shift. */
  const skillsOf = (char: string): string[] =>
    char !== char.toLowerCase() && /[A-Z]/.test(char)
      ? [char.toLowerCase(), skillOf(char)]
      : [skillOf(char)];
  const learned = (char: string) => skillsOf(char).every((skill) => skillLearned(typing, skill));

  // ---------- Positions ----------
  const alive = () => invaders.filter((i) => i.alive);
  const aliveCount = () => alive().length;
  const invaderPos = (inv: Invader): { x: number; y: number } => {
    const x = invaderX(inv.col, march.offsetX);
    let y = invaderBottom(inv.row, march.drops) + entry;
    if (phase === 'over') {
      const k = clamp(overTime / 1.5, 0, 1);
      y = y * (1 - k * k) + (GROUND_Y + 0.1) * (k * k);
    }
    return { x, y };
  };
  const targetPos = (t: Target): { x: number; y: number } => {
    if (t.ufo) return { x: ufo.x, y: UFO_BOTTOM };
    const inv = invaders.find((i) => i.target === t);
    return inv ? invaderPos(inv) : { x: 0, y: 0 };
  };
  const targets = (): Target[] => {
    const out: Target[] = [];
    for (const inv of invaders) if (inv.alive && inv.target) out.push(inv.target);
    if (ufo.target && ufo.active) out.push(ufo.target);
    return out;
  };

  const byId = (id: string | null): Target | null =>
    id === null ? null : (targets().find((t) => t.id === id) ?? null);
  const primary = (): Target | null => byId(aim.primary);
  const pos = (): number => aim.typed.length;
  const candidatesOf = (): Target[] =>
    aim.candidates.map(byId).filter((t): t is Target => t !== null);
  const lockCandidates = () =>
    targets().map((t) => {
      const p = targetPos(t);
      return { id: t.id, text: t.text, bottomY: p.y, x: p.x, ufo: t.ufo };
    });

  // ---------- Keyboard strip ----------
  /** Lights the next key unless it is learned; the whole strip fades when every key on screen is. */
  const paintKeyboard = () => {
    let next: string | null;
    const aimed = primary();
    if (aimed) next = aimed.text[pos()] ?? null;
    else {
      // Nothing locked: the first key of the lowest target.
      let lowest: Target | null = null;
      let lowY = Infinity;
      for (const t of targets()) {
        if (t.ufo) continue;
        const p = targetPos(t);
        if (p.y < lowY) {
          lowY = p.y;
          lowest = t;
        }
      }
      next = lowest ? lowest.text[0] : null;
    }
    keyboard.light(next !== null && !learned(next) ? next : null);
    const all = targets();
    keyboard.setFaint(all.length > 0 && all.every((t) => [...t.text].every(learned)));
  };

  // ---------- HUD ----------
  const renderHud = () => {
    hudScore.textContent = fmt(score);
    const mult = multiplier(playLevel);
    hudLevel.hidden = mult <= 1;
    hudLevel.textContent = `×${fmt(mult)}`;
    const sm = streakMultiplier(streak);
    hudStreak.hidden = sm <= 1;
    hudStreak.textContent = `🔥×${sm}`;
    hudHigh.textContent = `HI ${fmt(Math.max(session.highScore(), score))}`;
    cannonIcons.forEach((icon, i) => {
      if (i < lives) delete icon.dataset.lost;
      else icon.dataset.lost = '';
    });
    hudWave.textContent = `Wave ${wave}`;
  };

  // ---------- Layout of the field ----------
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top)';
  document.body.appendChild(probe);
  const layout = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const corner = isCorner({ w, h });
    if (corner) keyboard.element.dataset.corner = '';
    else delete keyboard.element.dataset.corner;
    const kb = keyboard.element.getBoundingClientRect();
    const safeTop = parseFloat(getComputedStyle(probe).paddingTop) || 0;
    scene.setRect(fieldRect({ w, h }, { w: kb.width, h: kb.height, corner }, safeTop));
  };
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', layout);
  layout();

  // ---------- Targets and labels ----------
  let targetSeq = 0;
  const makeTarget = (kind: Kind, voxels: Voxels, ufoTarget: boolean): Target => {
    const taken = targets().map((t) => t.text[0]);
    const chunk =
      dev?.chunk && !ufoTarget
        ? dev.chunk
        : planChunk({
            level: playLevel,
            keys: CHUNK_KEYS[kind],
            random: Math.random,
            history: typing.keys,
            avoid: taken,
          });
    const text = targetText(chunk);
    const label = createLabel(labelLayer, text, COLORS[kind]);
    return {
      id: `t${targetSeq++}`,
      kind,
      text,
      voxels,
      label,
      ufo: ufoTarget,
      mistakes: new Set(),
      font: 0,
    };
  };

  const dropTarget = (t: Target) => {
    t.label.remove();
    t.voxels.chip(0);
    if (aim.candidates.includes(t.id)) {
      aim = aimWithout(aim, t.id, lockCandidates(), cannonX);
    }
  };

  /** The lowest living invader of a column. */
  const frontOf = (col: number): Invader | null => {
    for (let row = 0; row < ROWS; row++) {
      const inv = invaders[row * COLUMNS + col];
      if (inv.alive) return inv;
    }
    return null;
  };

  /** Gives every column's front invader a chunk (the others lose theirs) and lights it. */
  const refreshFronts = () => {
    for (let col = 0; col < COLUMNS; col++) {
      const front = frontOf(col);
      for (let row = 0; row < ROWS; row++) {
        const inv = invaders[row * COLUMNS + col];
        if (inv === front) continue;
        if (inv.target) {
          dropTarget(inv.target);
          inv.target = null;
        }
        if (inv.alive) inv.voxels.setMaterial(invaderMaterial(inv.kind, false));
      }
      if (front) {
        if (!front.target) front.target = makeTarget(front.kind, front.voxels, false);
        front.voxels.setMaterial(invaderMaterial(front.kind, true));
      }
    }
    paintKeyboard();
  };

  const paintLabel = (t: Target) => {
    const candidate = aim.candidates.includes(t.id);
    t.label.setState({ typed: candidate ? pos() : 0, locked: candidate, wrong: false });
  };

  const syncVisuals = () => {
    const showLabels = phase === 'entering' || phase === 'marching' || phase === 'cleared';
    labelLayer.hidden = !showLabels;
    for (const inv of invaders) {
      if (!inv.alive) {
        inv.voxels.mesh.visible = false;
        continue;
      }
      const p = invaderPos(inv);
      inv.voxels.mesh.visible = true;
      inv.voxels.place(p.x, p.y);
    }
    ufo.voxels.mesh.visible = ufo.active;
    ufo.voxels.place(ufo.x, UFO_BOTTOM);
    cannon.place(cannonX, GROUND_Y);

    const aimed = primary();
    if (aimed) {
      const p = targetPos(aimed);
      outline.setVisible(true);
      outline.place(p.x, p.y, aimed.voxels.width, aimed.voxels.height);
    } else {
      outline.setVisible(false);
    }

    if (!showLabels) return;
    const pitch = Math.abs(scene.project(COL_PITCH, 6).x - scene.project(0, 6).x);
    const under: { t: Target; box: LabelBox }[] = [];
    for (const t of targets()) {
      const font = labelFontPx(pitch, t.text.length);
      if (font !== t.font) {
        t.font = font;
        t.label.setFont(font);
      }
      const p = targetPos(t);
      const w = t.label.width;
      const h = t.label.height;
      if (t.ufo) {
        const top = scene.project(p.x, p.y + t.voxels.height);
        const x = clamp(top.x - w / 2, scene.rect.x, scene.rect.x + scene.rect.w - w);
        t.label.place(x, top.y - 8 - h);
      } else {
        const bottom = scene.project(p.x, p.y);
        under.push({ t, box: { x: bottom.x - w / 2, y: bottom.y + 8, w, h } });
      }
    }
    const dy = staggerLabels(under.map((u) => u.box));
    under.forEach((u, i) => u.t.label.place(u.box.x, u.box.y + dy[i]));
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
    opened.push(next);
    pendingLevel = next;
    pops.centre(`Level ${next} opened!`, '#facc15');
    sfx.chime();
  };

  // ---------- Locking and typing ----------
  const aimCannon = () => {
    const aimed = primary();
    if (aimed) cannonX = targetPos(aimed).x;
  };

  /** Clears the aim and repaints the labels of everything that was in play. */
  const clearAim = () => {
    const old = candidatesOf();
    aim = NO_AIM;
    for (const t of old) paintLabel(t);
  };

  /** The locked target is lost (the UFO left, or the row exploded): its typed keys still count. */
  const dropLock = () => {
    const aimed = primary();
    if (!aimed) return;
    const typed = pos();
    let wrong = 0;
    for (const i of aimed.mistakes) if (i < typed) wrong++;
    stats.keys += typed;
    stats.right += typed - wrong;
    clearAim();
  };

  const rise = (text: string, x: number, y: number, color?: string) => {
    const p = scene.project(x, y);
    pops.rise(text, p.x, p.y, color);
  };

  const closeGroup = () => {
    if (groupStart === null) return;
    group.seconds = activeTime - groupStart;
    speedRun = speedGroupPasses(playLevel, group) ? speedRun + 1 : 0;
    group = { keys: 0, mistakes: 0, seconds: 0 };
    groupKills = 0;
    groupStart = null;
  };

  const kill = (t: Target) => {
    const perfect = t.mistakes.size === 0;
    const before = streakMultiplier(streak);
    streak = perfect ? streak + 1 : 0;
    const points = killPoints(t.kind, streak, playLevel);
    score += points;
    const p = targetPos(t);
    const cx = p.x;
    const cy = p.y + t.voxels.height / 2;
    effects.beam(cannonX, CANNON_ROWS * PIXEL, cx, cy);
    effects.explode(cx, cy, COLORS[t.kind]);
    effects.shake('kill');
    sfx.boom();
    if (t.ufo) rise(`UFO +${fmt(points)}`, cx, p.y + t.voxels.height + 0.2, '#ff7a7a');
    else rise(`+${fmt(points)}`, cx, cy, '#facc15');
    if (streakMultiplier(streak) > before) {
      pops.centre(`Streak ×${streakMultiplier(streak)}!`, '#ff9a3d');
    }

    const seconds = activeTime - lockedAt;
    const keys = t.text.length;
    const mistakes = t.mistakes.size;
    stats.keys += keys;
    stats.right += keys - mistakes;
    stats.fastKeys += keys;
    stats.fastSeconds += seconds;
    if (!speedLevel()) typing.spk = nextSpk(typing.spk, perfect ? 'perfect' : 'mistakes');
    else {
      group.keys += keys;
      group.mistakes += mistakes;
      groupKills++;
      if (groupKills >= SPEED_GROUP) closeGroup();
    }
    checkLevelUp();
    save();

    // The invader (or the UFO) is gone.
    aim = NO_AIM;
    if (t.ufo) {
      ufo.active = false;
      ufo.target = null;
      dropTarget(t);
    } else {
      const inv = invaders.find((i) => i.target === t)!;
      inv.alive = false;
      inv.target = null;
      dropTarget(t);
    }
    renderHud();
    const left = aliveCount();
    if (left === 0) {
      cleared();
      return;
    }
    refreshFronts();
    if (!ufoSent && left <= UFO_AT_ALIVE) spawnUfo();
  };

  const onKey = (char: string) => {
    if (paused() || phase !== 'marching') return;
    const was = aim;
    const before = primary();
    const at = pos();
    const step = aimKey(aim, lockCandidates(), char, cannonX);
    if (step.kind === 'stray') {
      keyboard.flash(char, 'wrong');
      sfx.wrongKey();
      paintKeyboard();
      return;
    }
    if (was.candidates.length === 0) lockedAt = activeTime;
    if (groupStart === null && speedLevel()) groupStart = activeTime;

    if (step.kind === 'wrong') {
      const cands = candidatesOf();
      if (before && !before.mistakes.has(at)) recordPress(typing, before.text[at], false);
      for (const c of cands) {
        c.mistakes.add(at);
        c.label.flashWrong();
      }
      keyboard.flash(char, 'wrong');
      sfx.wrongKey();
    } else if (step.kind === 'right') {
      if (!before || !before.mistakes.has(at)) recordPress(typing, char, true);
      keyboard.flash(char, 'right');
      for (const id of step.dropped) {
        const d = byId(id);
        if (!d) continue;
        d.mistakes.clear();
        d.voxels.chip(0);
      }
      aim = step.aim;
      for (const id of step.dropped) {
        const d = byId(id);
        if (d) paintLabel(d);
      }
      if (before && before.id !== aim.primary) before.voxels.chip(0);
      const t = primary()!;
      const p = targetPos(t);
      sfx.zap();
      effects.bolt(cannonX, CANNON_ROWS * PIXEL, p.x, p.y + t.voxels.height / 2);
      t.voxels.chip(chipCount(t.voxels.cubes, pos(), t.text.length));
      for (const c of candidatesOf()) paintLabel(c);
      aimCannon();
    } else {
      const t = byId(step.id)!;
      if (!t.mistakes.has(at)) recordPress(typing, char, true);
      keyboard.flash(char, 'right');
      const others = step.others.map(byId).filter((o): o is Target => o !== null);
      for (const o of others) {
        o.mistakes.clear();
        o.voxels.chip(0);
      }
      aim = NO_AIM;
      for (const o of others) paintLabel(o);
      kill(t);
    }
    paintKeyboard();
  };

  // ---------- Waves ----------
  const spawnUfo = () => {
    ufoSent = true;
    const target = makeTarget('ufo', ufo.voxels, true);
    target.voxels.chip(0);
    ufo.target = target;
    ufo.active = true;
    ufo.t = 0;
    ufo.seconds = ufoSeconds(spkEff());
    ufo.dir = Math.random() < 0.5 ? 1 : -1;
    ufo.beep = 0;
    ufo.x = frozen() ? 0 : -ufo.dir * (FIELD_HALF + 0.9);
    paintKeyboard();
  };

  const ufoLeaves = () => {
    if (!ufo.target) return;
    const t = ufo.target;
    if (aim.candidates.includes(t.id)) {
      if (aim.candidates.length === 1) dropLock();
      else {
        const was = aim.primary;
        aim = aimWithout(aim, t.id, lockCandidates(), cannonX);
        const now = primary();
        if (now && aim.primary !== was) {
          now.voxels.chip(chipCount(now.voxels.cubes, pos(), now.text.length));
        }
      }
    }
    ufo.active = false;
    ufo.target = null;
    dropTarget(t);
    paintKeyboard();
  };

  const startWave = () => {
    phase = 'entering';
    aim = NO_AIM;
    const first = waveIndex === 0;
    for (const inv of invaders) {
      if (inv.target) {
        dropTarget(inv.target);
        inv.target = null;
      }
      inv.voxels.restore();
    }
    invaders.forEach((inv, i) => {
      inv.alive = first && dev?.left ? i < dev.left : true;
    });
    // Every kind's bottom row is row 0: `left` takes the bottom rows first, left to right.
    for (const b of bunkers) b.restore();
    cannon.mesh.visible = true;
    cannon.restore();
    effects.clear();
    if (ufo.target) dropTarget(ufo.target);
    ufo.target = null;
    ufo.active = false;
    ufoSent = false;
    march = { offsetX: 0, drops: first && dev?.drop ? dev.drop : 0, dir: 1 };
    stepClock = 0;
    stepCount = 0;
    entry = 4;
    budget = waveBudget(spkEff(), wave);
    bombClock = 1.2 + Math.random() * 1.4;
    refreshFronts();
    pops.centre(`Wave ${wave}`, '#ffffff');
    renderHud();
    timers.after(1.0, () => {
      phase = 'marching';
      entry = 0;
      if (first && dev?.keys) for (const c of dev.keys) onKey(c);
      paintKeyboard();
    });
    if (first) {
      if (dev?.ufo) spawnUfo();
      applyDevLock();
    }
    waveIndex++;
    syncVisuals();
  };

  /** Dev: the front invader of a column starts locked with some keys done. */
  const applyDevLock = () => {
    if (!dev?.lock) return;
    const front = frontOf(dev.lock - 1);
    if (!front?.target) return;
    const t = front.target;
    const typed = Math.min(dev.typed, t.text.length - 1);
    aim = { candidates: [t.id], primary: t.id, typed: t.text.slice(0, typed) };
    lockedAt = activeTime;
    t.voxels.chip(chipCount(t.voxels.cubes, typed, t.text.length));
    paintLabel(t);
    if (dev.wrong) t.label.flashWrong(true);
    cannonX = invaderX(front.col, march.offsetX);
    paintKeyboard();
  };

  const nextWave = () => {
    wave++;
    startWave();
  };

  const afterWave = () => {
    if (pendingLevel === null) {
      nextWave();
      return;
    }
    // A level opened in this wave: its lesson (or speed card) shows, then the next wave is on it.
    playLevel = pendingLevel;
    pendingLevel = null;
    typing.level = playLevel;
    save();
    renderHud();
    lessonThen(playLevel, true, nextWave);
  };

  function cleared() {
    phase = 'cleared';
    ufoLeaves();
    effects.clearBombs();
    sfx.chime();
    const bonus = waveBonus(wave, playLevel);
    score += bonus;
    pops.centre(`Wave ${wave} cleared! +${fmt(bonus)}`, '#4ade80');
    renderHud();
    timers.after(1.5, afterWave);
  }

  const hit = () => {
    phase = 'hit';
    sfx.crash();
    effects.shake('hit');
    lives--;
    streak = 0;
    if (!speedLevel()) typing.spk = nextSpk(typing.spk, 'timeout');
    group = { keys: 0, mistakes: 0, seconds: 0 };
    groupKills = 0;
    groupStart = null;
    speedRun = 0;
    dropLock();
    effects.clearBombs();
    // The lowest living row explodes.
    const live = alive();
    const lowRow = Math.min(...live.map((i) => i.row));
    for (const inv of live) {
      if (inv.row !== lowRow) continue;
      const p = invaderPos(inv);
      effects.explode(p.x, p.y + inv.voxels.height / 2, COLORS[inv.kind]);
      inv.alive = false;
      if (inv.target) {
        dropTarget(inv.target);
        inv.target = null;
      }
    }
    save();
    renderHud();
    pops.centre('Cannon lost!', '#ff5a5a');
    if (lives <= 0) {
      over();
      return;
    }
    timers.after(1.5, () => {
      march = recoil(march);
      if (aliveCount() === 0) {
        nextWave();
        return;
      }
      phase = 'marching';
      refreshFronts();
    });
  };

  const over = () => {
    phase = 'over';
    overTime = 0;
    ufoLeaves();
    effects.explode(cannonX, 0.4, COLORS.cannon);
    cannon.mesh.visible = false;
    effects.shake('hit');
    keyboard.light(null);
    timers.after(2.0, finish);
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    showKeyboard(false);
    hud.hidden = true;
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
      outcome: resultsText(stats, wave, opened),
      playAgainLabel: 'Play again 👾',
      onPlayAgain: () => showStart(),
    });
  };

  // ---------- The march ----------
  const doStep = () => {
    const live = alive();
    const extent = extentOf(live.map((i) => invaderX(i.col, march.offsetX)));
    if (!extent) return;
    march = nextStep(march, extent);
    sfx.march(stepCount);
    stepCount++;
    for (const inv of live) inv.voxels.setFrame(stepCount % 2);
    const lowest = Math.min(...live.map((i) => invaderBottom(i.row, march.drops)));
    if (lowest <= LAND_Y + 1e-6) hit();
  };

  const bombHit = (x: number, y: number): boolean => {
    const cell = bunkerCellAt(x, y);
    if (!cell) return false;
    const bunker = bunkers[cell.bunker];
    if (!bunker.hasCell(cell.col, cell.row)) return false;
    const c0 = Math.random() < 0.5 ? cell.col : cell.col - 1;
    for (let dc = 0; dc < 2; dc++) {
      for (let dr = 0; dr < 2; dr++) bunker.hideCell(c0 + dc, cell.row + dr);
    }
    effects.puff(x, y);
    return true;
  };

  const dropBomb = () => {
    const fronts: Invader[] = [];
    for (let col = 0; col < COLUMNS; col++) {
      const f = frontOf(col);
      if (f) fronts.push(f);
    }
    if (fronts.length === 0) return;
    const inv = fronts[Math.floor(Math.random() * fronts.length)];
    const p = invaderPos(inv);
    effects.bomb(p.x, p.y);
  };

  // ---------- The frame ----------
  const update = (delta: number) => {
    const dt = paused() ? 0 : delta;
    timers.update(dt);
    const hold = frozen();
    if (phase === 'entering') {
      entry = Math.max(0, entry - (4 / 1.0) * dt);
    }
    if (phase === 'marching') {
      activeTime += dt;
      if (!hold) {
        stepClock += dt;
        const every = stepSeconds(budget, aliveCount());
        while (stepClock >= every && phase === 'marching') {
          stepClock -= every;
          doStep();
        }
        bombClock -= dt;
        if (bombClock <= 0) {
          bombClock = 1.2 + Math.random() * 1.4;
          dropBomb();
        }
        if (ufo.active) {
          ufo.t += dt;
          const k = clamp(ufo.t / ufo.seconds, 0, 1);
          ufo.x = ufo.dir * (-(FIELD_HALF + 0.9) + k * 2 * (FIELD_HALF + 0.9));
          ufo.beep -= dt;
          if (ufo.beep <= 0) {
            ufo.beep = 0.5;
            sfx.ufo();
          }
          if (ufo.t >= ufo.seconds) ufoLeaves();
        }
      }
    }
    if (phase === 'over') overTime += dt;
    // The cannon slides under the locked target (0.15 s) and follows it as it marches.
    const aimed = primary();
    if (aimed && phase === 'marching') {
      const to = targetPos(aimed).x;
      cannonX += (to - cannonX) * (1 - Math.exp(-dt / 0.05));
    }
    effects.update(dt, bombHit, hold);
    scene.shake(effects.offset.x, effects.offset.y);
    syncVisuals();
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

  /** Everything before a run: the picker and the lesson (or neither with `start=1`), then the first wave. */
  const showStart = (firstRun = false) => {
    phase = 'start';
    showKeyboard(false);
    hud.hidden = true;
    const begin = () => {
      playLevel = clamp(typing.level, 1, typing.open);
      typing.level = playLevel;
      pendingLevel = null;
      stats = emptyStats();
      opened = [];
      speedRun = 0;
      group = { keys: 0, mistakes: 0, seconds: 0 };
      groupKills = 0;
      groupStart = null;
      score = 0;
      streak = 0;
      lives = dev?.lives ?? CANNONS;
      wave = dev?.wave ?? 1;
      waveIndex = 0;
      finished = false;
      activeTime = 0;
      cannonX = 0;
      save();
      showKeyboard(true);
      hud.hidden = false;
      layout();
      startWave();
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
  const stopKeys = onTypingKey((char) => onKey(char), { onCaps: (on) => keyboard.setCaps(on) });

  scene.ctx.onUpdate(update);
  scene.ctx.start();
  renderHud();
  syncVisuals();
  showStart(true);

  window.addEventListener('pagehide', () => {
    stopKeys();
    window.removeEventListener('keydown', onAnyKey, true);
    window.removeEventListener('resize', layout);
    window.removeEventListener('orientationchange', layout);
    window.removeEventListener('pointerdown', onPointer);
    picker?.dispose();
    pause.dispose();
    mute.dispose();
    keyboard.dispose();
    pops.dispose();
    labelLayer.remove();
    hud.remove();
    note.remove();
    probe.remove();
    scene.dispose();
  });
}

run(startTypingSession(GAME_ID));
