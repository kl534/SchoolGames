import { MathUtils, PerspectiveCamera, Vector3, type Object3D } from 'three';
import { sfx, speak, unlockAudio } from '../../shared/audio';
import { DANCE_SECONDS } from '../../shared/dances';
import { chooseDance } from '../../shared/dances/dev';
import { showResults } from '../../shared/results';
import { starsFor } from '../../shared/round';
import { createScene } from '../../shared/scene';
import { createTimers } from '../../shared/timers';
import { createBackButton, createMuteButton, createPauseOverlay } from '../../shared/ui';
import { createBlockView } from '../../shared/typing/block';
import { planBlock } from '../../shared/typing/blocks';
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
  wpm,
} from '../../shared/typing/progress';
import { startTypingSession, type TypingSession } from '../../shared/typing/session';
import { showTestOut } from '../../shared/typing/testout';
import { createCrowd } from './crowd';
import { devOptions } from './dev';
import { createStars } from './effects';
import { createHud } from './hud';
import {
  CAMERA_SMOOTH,
  FOV,
  PODIUM_CAMERA,
  PODIUM_Z,
  backRowSpot,
  cameraFor,
  laneX,
  podiumSpot,
} from './layout';
import {
  createRunner,
  playerLook,
  rivalCss,
  rivalLook,
  type Runner,
  type RunnerMode,
} from './runners';
import {
  BLOCK_KEYS_RACE,
  FACEPLANT_SECONDS,
  GETUP_RATE,
  MEDALS,
  MISS_RATE,
  PLAYER_LANE,
  RACE_METRES,
  REACTION,
  RIVAL_FACTORS,
  RIVAL_NAMES,
  SURGE_PERIOD,
  blockOutcome,
  easeSpeed,
  emptyStats,
  goesOn,
  heatOver,
  heatWpm,
  keyPoints,
  liveRate,
  nextRate,
  onMiss,
  ordinal,
  placeOf,
  placePoints,
  resultsText,
  rivalSpeed,
  shuffleLanes,
  speedStreak,
  stepStride,
  strideSpeedFactor,
  targetSpeed,
  wpmOf,
  type BlockResult,
  type RunnerMark,
  type Stride,
} from './rules';
import { createTrack } from './track';

const GAME_ID = 'recess-run';
const READY_LINE = "You're ready! Let's race!";
const SPACE_LINE = 'Press the space bar to race!';

type Phase = 'start' | 'marks' | 'racing' | 'finished' | 'podium' | 'out' | 'results';

/** Seconds each word of the countdown shows. */
const MARK_SECONDS = 0.9;
/** A runner past the line slows to this walk (m/s) over `SLOW_METRES`, and stops at `STOP_METRES`. */
const WALK_SPEED = 1.4;
const SLOW_METRES = 8;
const STOP_METRES = RACE_METRES + 6;
/** Seconds the finish text shows, and the out ending holds. */
const PLACE_TEXT_SECONDS = 1.2;
const OUT_SECONDS = 2.5;
const NO_DANCE_SECONDS = 2.5;
/** Seconds the camera takes to move to the podium. */
const PODIUM_EASE = 1;
/** How far down the clear band the player's feet sit. */
const FEET_AT = 0.7;
/** Metres of a runner's head over the ground, for labels. */
const HEAD_TOP = 2.0;

const clamp = (n: number, low: number, high: number): number => Math.min(Math.max(n, low), high);

/** One of the ten kids on the track. */
interface Racer {
  runner: Runner;
  lane: number;
  /** Index into `RIVAL_FACTORS` and `RIVAL_NAMES`; -1 for the player. */
  index: number;
  name: string;
  factor: number;
  period: number;
  surgePhase: number;
  reaction: number;
  metres: number;
  speed: number;
  /** Where the legs are in their swing. */
  gait: number;
  finishedAt: number | null;
  /** The speed it crossed the line at. */
  crossSpeed: number;
}

function disposeTree(root: Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as Partial<{ geometry: { dispose(): void }; material: unknown }>;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((m) => (m as { dispose?: () => void } | undefined)?.dispose?.());
  });
}

/**
 * Recess Race: ten kids sprint 100 m on the blacktop. Every right key pushes the player on; their
 * speed is how fast they type, against the heat's pace. Top three go on to a faster heat. Only
 * the lesson reads aloud; nothing else here does.
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
  const ctx = createScene(container, { fov: FOV, near: 0.3, far: 300 });
  const camera = ctx.camera;
  const track = createTrack(ctx.scene);
  const crowd = createCrowd();
  ctx.scene.add(crowd.object);
  const timers = createTimers();
  const hud = createHud(rivalCss);
  const block = createBlockView();
  hud.blockSlot.appendChild(block.element);
  const stars = createStars();

  const keyboard = createKeyboard({ hands: false });
  keyboard.element.classList.add('rr-kb');
  keyboard.element.dataset.hidden = '';
  document.body.appendChild(keyboard.element);
  const showKeyboard = (shown: boolean) => {
    if (shown) delete keyboard.element.dataset.hidden;
    else keyboard.element.dataset.hidden = '';
  };

  const note = document.createElement('div');
  note.className = 'rr-note';
  note.hidden = true;
  const noteTitle = document.createElement('strong');
  noteTitle.textContent = 'Recess Race needs a keyboard ⌨️';
  note.append(noteTitle, 'Plug one in or open it, then press the space bar.');
  document.body.appendChild(note);

  createBackButton();
  const mute = createMuteButton();
  const pause = createPauseOverlay();

  // ---------- State ----------
  let phase: Phase = 'start';
  /** The level being played (the picker's choice; the next one after a level-up and a podium). */
  let playLevel = typing.level;
  /** A level that opened in this heat: its lesson shows after the podium. */
  let pendingLevel: number | null = null;
  let stats = emptyStats();
  let opened: number[] = [];
  let speedRun = 0;
  let levelupUsed = false;
  let firstBlock = true;
  let heat = 1;
  let score = 0;
  let lastPlace = 0;
  /** Race seconds since GO. */
  let t = 0;
  /** Ticks up at each phase change so a late timer can tell it is stale. */
  let token = 0;
  let picker: LevelPicker | null = null;
  let racers: Racer[] = [];
  let player: Racer;
  let cardOpen = false;
  let cheerLeft = 0;
  /** 0 on the chase camera, 1 on the podium camera. */
  let podiumBlend = 0;
  let camZ = 0;

  // The player's typing.
  let rate = 0;
  let lastRight = 0;
  let stride: Stride = { kind: 'run' };
  let missesInRow = 0;
  let blockOn = false;
  const wrongAt = new Set<number>();
  let firstKeyAt: number | null = null;

  const speedLevel = () => levelOf(playLevel).kind === 'speed';
  const frozen = () => dev?.freeze ?? false;

  /** Skills a char needs: a capital needs its letter and its Shift. */
  const skillsOf = (char: string): string[] =>
    char !== char.toLowerCase() && /[A-Z]/.test(char)
      ? [char.toLowerCase(), skillOf(char)]
      : [skillOf(char)];
  const learned = (char: string) => skillsOf(char).every((skill) => skillLearned(typing, skill));

  /** Lights the next key unless it is learned; the whole strip fades when every key of the block is. */
  const paintKeyboard = () => {
    const next = block.current;
    keyboard.light(next !== null && !learned(next) ? next : null);
    keyboard.setFaint([...block.text].every(learned));
  };

  // ---------- The field: the player and nine rivals ----------
  const clearField = () => {
    for (const r of racers) {
      ctx.scene.remove(r.runner.person.root);
      disposeTree(r.runner.person.root);
    }
    racers = [];
  };

  const buildField = () => {
    clearField();
    const lanes = shuffleLanes(Math.random);
    const make = (index: number, lane: number): Racer => {
      const style = index < 0 ? playerLook() : rivalLook(index, lane, Math.random);
      const runner = createRunner(style);
      ctx.scene.add(runner.person.root);
      const [lo, hi] = SURGE_PERIOD;
      const [rlo, rhi] = REACTION;
      return {
        runner,
        lane,
        index,
        name: index < 0 ? 'You' : RIVAL_NAMES[index],
        factor: index < 0 ? 1 : RIVAL_FACTORS[index],
        period: lo + Math.random() * (hi - lo),
        surgePhase: Math.random() * Math.PI * 2,
        reaction: rlo + Math.random() * (rhi - rlo),
        metres: 0,
        speed: 0,
        gait: 0,
        finishedAt: null,
        crossSpeed: 0,
      };
    };
    player = make(-1, PLAYER_LANE);
    player.runner.person.root.add(stars.object);
    racers = [player, ...RIVAL_FACTORS.map((_, i) => make(i, lanes[i]))];
    resetField();
  };

  /** Everyone back on the start line, crouched (or at the dev's metres). */
  const resetField = () => {
    for (const r of racers) {
      const at = dev?.at;
      r.metres = at === null || at === undefined ? 0 : Math.min(at * r.factor, 99);
      r.speed = 0;
      r.gait = r.metres * 3.2;
      r.finishedAt = null;
      r.crossSpeed = 0;
      r.runner.person.root.rotation.y = Math.PI;
      r.runner.setMode({ kind: 'crouch' });
    }
    if (dev?.at !== null && dev?.at !== undefined) {
      // A frozen spread-out shot: the player is exactly at `at`.
      player.metres = Math.min(dev.at, 99);
      player.gait = player.metres * 3.2;
    }
    stars.hide();
    track.tape.reset();
    track.tape.object.visible = true;
    placeAll();
  };

  const placeAll = () => {
    for (const r of racers) {
      r.runner.person.root.position.set(laneX(r.lane), 0, -r.metres);
    }
  };

  const marks = (): RunnerMark[] =>
    racers.filter((r) => r !== player).map((r) => ({ metres: r.metres, finishedAt: r.finishedAt }));
  const playerMark = (): RunnerMark => ({ metres: player.metres, finishedAt: player.finishedAt });

  // ---------- The camera ----------
  const tmpCamera = new PerspectiveCamera(FOV, 1, 0.3, 300);
  const tmpVec = new Vector3();
  let shiftChase = 0;
  let shiftPodium = 0;
  let laidOut = '';

  const bandBottom = () => keyboard.element.getBoundingClientRect().top;

  /** Works out how far to slide the picture so the feet sit 70% down the band between the panels. */
  const relayout = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / h;
    const top = hud.clearTop();
    const bottom = Math.max(bandBottom(), top + 40);
    const spot = cameraFor(aspect);
    tmpCamera.aspect = aspect;
    tmpCamera.updateProjectionMatrix();
    tmpCamera.position.set(0, spot.height, spot.back);
    tmpCamera.lookAt(0, 0, -spot.ahead);
    tmpCamera.updateMatrixWorld();
    const feetY = ((1 - tmpVec.set(0, 0, 0).project(tmpCamera).y) / 2) * h;
    // A short band (a phone on its side) puts the feet lower so the runners ahead have room.
    const feetAt = bottom - top < 220 ? 0.85 : FEET_AT;
    shiftChase = top + feetAt * (bottom - top) - feetY;
    // The winners stand high in the band, so the card (lower than the middle) leaves them in view.
    shiftPodium = top + 0.3 * (bottom - top) - h / 2;
    document.documentElement.style.setProperty('--rr-mid', `${((top + bottom) / 2).toFixed(0)}px`);
    laidOut = `${w}x${h}`;
    block.fit();
  };

  const podiumBackFor = (aspect: number) => {
    const halfTan = Math.tan((FOV * Math.PI) / 360) * aspect;
    return clamp(3.0 / halfTan, 7, 16);
  };

  const chasePos = new Vector3();
  const chaseLook = new Vector3();
  const podiumPos = new Vector3();
  const podiumLook = new Vector3();

  const syncCamera = (delta: number) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (laidOut !== `${w}x${h}`) relayout();
    const spot = cameraFor(w / h);
    // Follow the player's z with a little smoothing, so a stumble reads.
    const target = -player.metres;
    camZ += (target - camZ) * (delta > 0 ? 1 - Math.exp(-delta / CAMERA_SMOOTH) : 1);
    chasePos.set(0, spot.height, camZ + spot.back);
    chaseLook.set(0, 0, camZ - spot.ahead);
    podiumPos.set(0, PODIUM_CAMERA.y, PODIUM_Z + podiumBackFor(w / h));
    podiumLook.set(0, PODIUM_CAMERA.lookY, PODIUM_Z);
    const k = MathUtils.smoothstep(podiumBlend, 0, 1);
    camera.position.lerpVectors(chasePos, podiumPos, k);
    tmpVec.lerpVectors(chaseLook, podiumLook, k);
    camera.lookAt(tmpVec);
    const shift = MathUtils.lerp(shiftChase, shiftPodium, k);
    camera.setViewOffset(w, h, 0, -shift, w, h);
  };

  // ---------- Pops ----------
  const pop = (text: string, y: number, kind: 'good' | 'plain') => hud.pop(text, y, kind);
  const popY = (rows: number) => (hud.clearTop() + rows) / window.innerHeight;

  // ---------- Level up ----------
  /** After a block on the open level: does the level pass? Opens the next one. */
  const checkLevelUp = (result: BlockResult) => {
    if (playLevel !== typing.open) return;
    let passed: boolean;
    if (speedLevel()) {
      speedRun = speedStreak(speedRun, playLevel, result);
      passed = speedRun >= SPEED_STREAK;
    } else {
      passed = levelPassed(typing, playLevel);
    }
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
    pop(`Level ${next} opened!`, popY(70), 'plain');
    sfx.chime();
  };

  // ---------- Blocks ----------
  const planNext = (): string => {
    if (dev?.block) return dev.block;
    const text = planBlock({
      level: playLevel,
      length: BLOCK_KEYS_RACE,
      random: Math.random,
      history: typing.keys,
    }).trim();
    return text || 'f j';
  };

  const newBlock = () => {
    const text = planNext();
    block.set(text);
    wrongAt.clear();
    firstKeyAt = null;
    blockOn = true;
    if (firstBlock) {
      firstBlock = false;
      for (let i = 0; i < (dev?.typed ?? 0) && block.position < text.length - 1; i++) {
        block.advance();
      }
      if (dev?.wrong) {
        block.wrong(true);
        const key = block.current;
        if (key !== null) keyboard.flash(key, 'wrong', true);
      }
    }
    paintKeyboard();
    block.fit();
  };

  const finishBlock = () => {
    blockOn = false;
    const keys = block.text.length;
    const mistakes = wrongAt.size;
    const seconds = firstKeyAt === null ? 0 : t - firstKeyAt;
    const result: BlockResult = { keys, mistakes, seconds };
    const outcome = blockOutcome(mistakes);
    stats.keys += keys;
    stats.right += keys - mistakes;
    if (seconds > 0) stats.bestWpm = Math.max(stats.bestWpm, wpm(keys, seconds));
    if (!speedLevel())
      typing.spk = nextSpk(typing.spk, outcome === 'perfect' ? 'perfect' : 'mistakes');
    if (outcome === 'perfect') pop('Perfect!', popY(8), 'good');
    checkLevelUp(result);
    save();
  };

  /** The block that was up when the heat ended counts for the keys typed in it. */
  const closePartialBlock = () => {
    if (!blockOn) return;
    blockOn = false;
    const done = block.position;
    let wrong = 0;
    for (const i of wrongAt) if (i < done) wrong++;
    stats.keys += done;
    stats.right += done - wrong;
    save();
  };

  // ---------- Keys ----------
  /** Where the player's head is on the screen (lying forward of the hips after a face-plant). */
  const headPoint = (): { x: number; y: number } => {
    const root = player.runner.person.root;
    const down = stride.kind === 'down';
    tmpVec.set(root.position.x, down ? 0.7 : HEAD_TOP, root.position.z - (down ? 1.1 : 0));
    tmpVec.project(camera);
    return {
      x: ((tmpVec.x + 1) / 2) * window.innerWidth,
      y: ((1 - tmpVec.y) / 2) * window.innerHeight,
    };
  };

  const onRight = (char: string) => {
    if (!wrongAt.has(block.position)) recordPress(typing, char, true);
    keyboard.flash(char, 'right');
    sfx.key();
    block.advance();
    const gap = t - lastRight;
    rate = nextRate(rate, gap);
    lastRight = t;
    missesInRow = 0;
    score += keyPoints(playLevel);
    hud.setScore(score, session.highScore(), multiplier(playLevel));
    if (block.current === null) {
      finishBlock();
      newBlock();
    } else paintKeyboard();
  };

  const onWrong = (char: string, expected: string) => {
    if (!wrongAt.has(block.position)) {
      wrongAt.add(block.position);
      recordPress(typing, expected, false);
    }
    keyboard.flash(char, 'wrong');
    sfx.wrongKey();
    block.wrong();
    missesInRow++;
    rate *= MISS_RATE;
    stride = onMiss(stride, missesInRow);
    if (stride.kind === 'down') {
      sfx.splat();
      stars.show(FACEPLANT_SECONDS);
      hud.splat('SPLAT!', headPoint());
    } else sfx.wobble();
  };

  const onKey = (char: string) => {
    if (pause.isPaused) return;
    if (cardOpen && char === ' ') {
      proceed();
      return;
    }
    if (phase !== 'racing' || !blockOn) return;
    // Face down: keys do nothing at all.
    if (stride.kind === 'down') return;
    const expected = block.current;
    if (expected === null) return;
    firstKeyAt ??= t;
    if (char === expected) onRight(char);
    else onWrong(char, expected);
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
      paused: () => pause.isPaused,
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

  /** Everything before a run: the picker and the lesson (or neither with `start=1`), then the run. */
  const showStart = (firstRun = false) => {
    token++;
    phase = 'start';
    hud.show(false);
    hud.clearBig();
    hud.hideCard();
    cardOpen = false;
    showKeyboard(false);
    podiumBlend = 0;
    heat = 1;
    buildField();
    const begin = () => {
      playLevel = clamp(typing.level, 1, typing.open);
      typing.level = playLevel;
      pendingLevel = null;
      stats = emptyStats();
      opened = [];
      speedRun = 0;
      score = 0;
      lastPlace = 0;
      heat = firstRun && dev?.heat ? dev.heat : 1;
      save();
      startHeat();
    };
    // `start=1` skips the picker on page load only; play again always shows it.
    if (!dev?.start || !firstRun) openPicker(begin);
    else if (dev.lesson) lessonThen(typing.level, true, begin);
    else begin();
  };

  // ---------- A heat ----------
  const renderHud = () => {
    hud.setHeat(heat, heatWpm(heat));
    hud.setScore(score, session.highScore(), multiplier(playLevel));
    hud.setPlace(ordinal(placeOf(playerMark(), marks())));
    hud.setSpeed(0, 0);
  };

  /** The start of a heat: everyone on the line, the first block up, the countdown. */
  const startHeat = () => {
    const mine = ++token;
    buildField();
    podiumBlend = 0;
    cardOpen = false;
    hud.hideCard();
    hud.clearBig();
    hud.show(true);
    hud.blockSlot.style.visibility = '';
    showKeyboard(true);
    t = 0;
    rate = dev?.wpm ? dev.wpm / 12 : 0;
    lastRight = 0;
    stride = dev?.faceplant
      ? { kind: 'down', t: 0.9 }
      : dev?.stumble
        ? { kind: 'stumble', t: 0.12 }
        : { kind: 'run' };
    missesInRow = 0;
    camZ = -player.metres;
    renderHud();
    relayout();
    firstBlock = heat === (dev?.heat ?? 1) && firstBlock;
    newBlock();
    relayout();

    if (dev?.podium || dev?.out) {
      settleHeat(dev.podium ?? dev.out ?? 1);
      beginRace();
      endHeat();
      return;
    }
    if (frozen()) {
      beginRace();
      return;
    }
    phase = 'marks';
    const words = ['On your marks…', 'Get set…'];
    const word = (i: number) => {
      hud.big(words[i]);
      sfx.tick();
    };
    if (dev?.count) {
      if (dev.count === 3) {
        hud.big('GO!');
      } else hud.big(words[dev.count - 1]);
      return;
    }
    word(0);
    timers.after(MARK_SECONDS, () => token === mine && word(1));
    timers.after(MARK_SECONDS * 2, () => {
      if (token !== mine) return;
      sfx.bell();
      hud.big('GO!', 0.6);
      timers.after(0.6, () => token === mine && hud.clearBig());
      beginRace();
    });
  };

  const beginRace = () => {
    phase = 'racing';
    t = 0;
    for (const r of racers) r.runner.setMode({ kind: 'run', phase: r.gait, speed: 0 });
    if (dev?.keys) {
      const mine = token;
      [...dev.keys].forEach((char, i) =>
        timers.after(0.15 * (i + 1), () => token === mine && onKey(char)),
      );
    }
  };

  /** Dev: every runner has finished, the player in `place`. */
  const settleHeat = (place: number) => {
    const times = RIVAL_FACTORS.map((f) => RACE_METRES / (RACE_METRES / 45) / f).sort(
      (a, b) => a - b,
    );
    const rivals = racers.filter((r) => r !== player);
    // Rival 8 (the fastest) first.
    rivals
      .sort((a, b) => b.factor - a.factor)
      .forEach((r, i) => {
        r.metres = RACE_METRES + 4;
        r.finishedAt = times[i];
      });
    player.metres = RACE_METRES + 4;
    player.finishedAt = place === 1 ? times[0] - 1 : (times[place - 2] + times[place - 1]) / 2;
    t = times[8] + 1;
    placeAll();
  };

  /** One runner's step: the rival's own pace, or the jog after the line. */
  const crossLine = (r: Racer, before: number, dt: number) => {
    if (r.finishedAt !== null || r.metres < RACE_METRES) return;
    const frac = (RACE_METRES - before) / Math.max(r.metres - before, 1e-6);
    r.finishedAt = t - dt + dt * frac;
    r.crossSpeed = r.speed;
    if (!track.tape.broken) {
      track.tape.snap();
      cheerLeft = 3;
    }
    if (r === player) sfx.cheer();
  };

  const jog = (r: Racer, dt: number) => {
    const into = clamp((r.metres - RACE_METRES) / SLOW_METRES, 0, 1);
    let v = MathUtils.lerp(r.crossSpeed, WALK_SPEED, into);
    v *= clamp((STOP_METRES - r.metres) / 2, 0, 1);
    r.speed = v;
    r.metres = Math.min(STOP_METRES, r.metres + v * dt);
  };

  const stepRacers = (dt: number) => {
    if (frozen()) return;
    for (const r of racers) {
      const before = r.metres;
      if (r.finishedAt !== null) {
        jog(r, dt);
      } else if (r === player) {
        const live = liveRate(rate, t - lastRight);
        const target = targetSpeed(live, heat) * strideSpeedFactor(stride);
        r.speed = easeSpeed(r.speed, target, dt);
        r.metres += r.speed * dt;
      } else if (t >= r.reaction) {
        r.speed = rivalSpeed(r.factor, t - r.reaction, r.period, r.surgePhase);
        r.metres += r.speed * dt;
      }
      r.gait += (r.metres - before) * 3.2;
      crossLine(r, before, dt);
    }
  };

  /** The player's stride: stumbles and face-plants end, and getting up costs half the rate. */
  const stepStrideState = (dt: number) => {
    if (dev?.stumble || dev?.faceplant) return;
    const wasDown: boolean = stride.kind === 'down';
    stride = stepStride(stride, dt);
    if (wasDown && (stride as Stride).kind === 'run') {
      missesInRow = 0;
      rate *= GETUP_RATE;
      lastRight = t;
      stars.hide();
    }
  };

  const modeFor = (r: Racer): RunnerMode => {
    if (r === player && phase === 'racing') {
      if (stride.kind === 'down') return { kind: 'down', t: stride.t };
      if (stride.kind === 'stumble') return { kind: 'stumble', phase: r.gait, t: stride.t };
    }
    return { kind: 'run', phase: r.gait, speed: r.speed };
  };

  // ---------- The end of a heat ----------
  const endHeat = () => {
    const mine = ++token;
    phase = 'finished';
    closePartialBlock();
    blockOn = false;
    hud.blockSlot.style.visibility = 'hidden';
    showKeyboard(false);
    const place = placeOf(playerMark(), marks());
    lastPlace = place;
    stats.heats = heat;
    hud.setPlace(ordinal(place));
    const medal = MEDALS[place - 1];
    if (goesOn(place)) {
      stats.medals[place - 1]++;
      score += placePoints(place, heat, playLevel);
      hud.setScore(score, session.highScore(), multiplier(playLevel));
      if (dev?.podium) {
        startPodium(place);
        return;
      }
      hud.big(`${ordinal(place)}! ${medal}`);
      timers.after(0.3, () => token === mine && (place === 1 ? sfx.bigCheer() : sfx.cheer()));
      timers.after(PLACE_TEXT_SECONDS, () => token === mine && startPodium(place));
    } else {
      phase = 'out';
      sfx.aww();
      player.speed = 0;
      hud.big(`You came ${ordinal(place)} — out!`);
      timers.after(OUT_SECONDS, () => token === mine && finish());
    }
  };

  // ---------- The podium ----------
  const startPodium = (place: number) => {
    const mine = ++token;
    phase = 'podium';
    hud.clearBig();
    hud.you(null);
    stars.hide();
    track.tape.object.visible = false;
    cheerLeft = 1e9;
    if (dev?.podium) podiumBlend = 1;
    const ranking = [...racers].sort((a, b) => {
      const fa = a.finishedAt ?? Infinity;
      const fb = b.finishedAt ?? Infinity;
      if (fa !== fb) return fa - fb;
      if (a === player) return -1;
      if (b === player) return 1;
      return b.metres - a.metres;
    });
    const dance = chooseDance();
    ranking.forEach((r, i) => {
      const root = r.runner.person.root;
      root.rotation.y = 0;
      r.speed = 0;
      if (i < 3) {
        const spot = podiumSpot(i + 1);
        root.position.set(spot.x, spot.y, spot.z);
        if (i === 0 && r === player) {
          r.runner.setMode({ kind: 'dance', dance, t: 0 });
        } else r.runner.setMode({ kind: 'wave', t: Math.random() * 3 });
      } else {
        const spot = backRowSpot(i - 3, ranking.length - 3);
        root.position.set(spot.x, 0, spot.z);
        r.runner.setMode({ kind: 'clap', t: Math.random() * 3 });
      }
    });
    const winnerDances = place === 1;
    const holdForever = dev?.win && winnerDances;
    const showCard = () => {
      if (token !== mine) return;
      const names = ranking.slice(0, 3).map((r) => r.name);
      const next = heat + 1;
      cardOpen = true;
      hud.showCard({
        title: `${ordinal(place)} place! ${MEDALS[place - 1]}`,
        names,
        heatLine: `Heat ${next}: ${heatWpm(next)} words a minute`,
        onRace: () => {
          if (!pause.isPaused) proceed();
        },
      });
    };
    if (holdForever) return;
    if (dev?.card) showCard();
    else timers.after(winnerDances ? DANCE_SECONDS : NO_DANCE_SECONDS, showCard);
  };

  /** Space or the Race button: the new level's lesson if there is one, then the next heat. */
  const proceed = () => {
    if (!cardOpen) return;
    cardOpen = false;
    hud.hideCard();
    const next = () => {
      heat++;
      startHeat();
    };
    if (pendingLevel !== null) {
      playLevel = pendingLevel;
      pendingLevel = null;
      typing.level = playLevel;
      save();
      lessonThen(playLevel, true, next);
    } else next();
  };

  // ---------- The results ----------
  const finish = () => {
    token++;
    phase = 'results';
    blockOn = false;
    hud.show(false);
    hud.clearBig();
    hud.you(null);
    showKeyboard(false);
    typing.bestWpm = Math.max(typing.bestWpm, Math.round(stats.bestWpm));
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
      outcome: resultsText(stats, lastPlace, opened),
      playAgainLabel: 'Race again 🏃',
      onPlayAgain: () => showStart(),
    });
  };

  // ---------- Each frame ----------
  const update = (rawDelta: number) => {
    const paused = pause.isPaused;
    const delta = paused ? 0 : rawDelta;
    if (!paused) timers.update(delta);
    if (phase === 'racing' || phase === 'finished' || phase === 'out') {
      if (phase === 'racing') t += delta;
      if (phase === 'racing') stepStrideState(delta);
      stepRacers(delta);
      if (phase === 'racing' && !dev?.podium && !dev?.out) {
        if (heatOver(playerMark(), marks(), t)) endHeat();
      }
    }
    if (phase === 'podium') podiumBlend = Math.min(1, podiumBlend + delta / PODIUM_EASE);
    else if (phase === 'start' || phase === 'marks') podiumBlend = 0;

    // Poses.
    for (const r of racers) {
      const mode = r.runner.mode;
      if (phase === 'podium') {
        if (mode.kind === 'dance') r.runner.setMode({ ...mode, t: mode.t + delta });
        else if (mode.kind === 'wave' || mode.kind === 'clap') {
          r.runner.setMode({ ...mode, t: mode.t + delta });
        }
      } else if (phase === 'racing' || phase === 'finished' || phase === 'out') {
        if (phase === 'out' && r === player) r.runner.setMode({ kind: 'headdown' });
        else r.runner.setMode(modeFor(r));
      }
      r.runner.step(delta);
    }
    if (phase !== 'podium') placeAll();
    // The stars circle the head: over it standing, out in front of the hips when face down.
    if (stride.kind === 'down') stars.object.position.set(0, 0.4, 0.85);
    else stars.object.position.set(0, 1.22, 0);
    stars.update(delta);
    track.tape.update(delta);
    cheerLeft = Math.max(0, cheerLeft - delta);
    crowd.update(
      delta,
      racers.map((r) => -r.metres),
      cheerLeft > 0,
    );
    syncCamera(delta);

    // The HUD.
    if (phase === 'racing') {
      const live = liveRate(rate, t - lastRight);
      hud.setSpeed(wpmOf(live), (live * 12) / heatWpm(heat));
      hud.setPlace(ordinal(placeOf(playerMark(), marks())));
    }
    if (phase === 'marks' || phase === 'racing' || phase === 'finished' || phase === 'out') {
      hud.setRace(
        player.metres,
        RIVAL_FACTORS.map((_, i) => racers.find((r) => r.index === i)?.metres ?? 0),
      );
      const showYou = phase === 'marks' || phase === 'racing';
      const head = headPoint();
      hud.you(showYou ? { x: head.x, y: head.y - 4 } : null);
    }
    if (dev?.faceplant && phase === 'racing' && !splatShown) {
      splatShown = true;
      stars.show(1e9);
      hud.splat('SPLAT!', headPoint(), true);
    }
  };
  let splatShown = false;

  // ---------- Keys, and the note for a player with no keyboard ----------
  let sawKey = false;
  let noteTimer: ReturnType<typeof setTimeout> | undefined;
  const onAnyKey = () => {
    if (!sawKey) {
      sawKey = true;
      try {
        unlockAudio();
      } catch {
        // Audio trouble must never stop the race.
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

  ctx.onUpdate(update);
  ctx.start();
  // The scene is up behind the start screen: a tick later so the HUD has its size.
  buildField();
  syncCamera(0);
  setTimeout(() => showStart(true), 0);

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
    keyboard.dispose();
    block.dispose();
    note.remove();
    clearField();
    crowd.dispose();
    track.dispose();
    ctx.dispose();
  });
}

run(startTypingSession(GAME_ID));
