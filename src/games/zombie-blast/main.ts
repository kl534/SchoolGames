import './style.css';
import { CircleGeometry, MathUtils, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { sfx, speak, stopSpeaking, unlockAudio } from '../../shared/audio';
import { createFactFeed, type FactFeed } from '../../shared/feed';
import { createPointerInput, onPress } from '../../shared/input';
import { showPreview } from '../../shared/preview';
import { showResults } from '../../shared/results';
import { starsFor } from '../../shared/round';
import { createScene } from '../../shared/scene';
import { startGameSession, type GameSession } from '../../shared/session';
import { createTapFlow } from '../../shared/tapflow';
import { answerOptions, type Fact } from '../../shared/topics';
import { createBackButton, createMuteButton, createPauseOverlay, menuUrl } from '../../shared/ui';
import { BOMB_RADIUS, createBomb } from './bomb';
import { createEffects } from './effects';
import { buildField, HORIZON_COLOR } from './field';
import { createHorde, type Slot } from './horde';
import { BOSS_TOP, CAMERA, fitView, LANES, SPAWN_Z, TARGET } from './layout';
import {
  arcHeightFor,
  BOSS_BONUS,
  BOSS_DOWN_SPEECH,
  BOSS_HITS,
  BOSS_KNOCKBACK,
  BOSS_SPEECH,
  bombPosition,
  BRAINS,
  createWaveSpawner,
  easeToward,
  GAME_OVER_SPEECH,
  GREAT_BLASTING_SPEECH,
  hitPoints,
  loseBrain,
  multiplierFor,
  NEW_HIGH_SCORE_SPEECH,
  NEXT_WAVE_SPEECH,
  nextStreak,
  outcomeText,
  outOfBrains,
  walkSpeed,
  type WaveSpawner,
} from './rules';
import { createThrower } from './thrower';

const GAME_ID = 'zombie-blast';

/** The kid stands this far behind the barricade, nearer the camera. */
const KID_Z = 1.5;
/** Seconds a thrown bomb is in the air. */
const BOMB_TIME = 0.7;
/** Room kept under the "Dud!" banner for the finger and caption that point at the green answer. */
const TAP_ROOM = 104;
/** Seconds each step of the 3, 2, 1, Go! lasts. */
const COUNT_STEP = 0.75;
/** How quickly the shared walking pace follows a new question (1/seconds): about half a second. */
const PACE_RATE = 6;
/** The barricade mends itself this long after the most recent smash. */
const REPAIR_AFTER = 3;
/** Seconds after a boss is knocked out until "Wave N" shows, and until the next wave starts. */
const WAVE_BANNER_AT = 1.5;
const WAVE_BREAK = 2.5;
const BOSS_BANNER_FOR = 1.8;
/** Least seconds the game-over banner stays up. */
const END_FOR = 2.2;
/** The field gets at least this share of the screen height, or the HUD overlaps the sky instead. */
const MIN_FRAME = 0.5;
/** Space kept between the HUD and the boss's head, and between the kid's feet and the answers, px. */
const BOSS_CLEARANCE = 6;
const KID_MARGIN = 14;
/** Camera shake (world units) from a boss footfall, a barricade smash and a boss hit. */
const STEP_SHAKE = 0.04;
const SMASH_SHAKE = 0.12;
const HIT_SHAKE = 0.1;

type Phase = 'preview' | 'countdown' | 'playing' | 'waveBreak' | 'ending' | 'done';
type BannerKind = 'hit' | 'miss' | 'warn' | 'out';

interface Question {
  fact: Fact;
  options: string[];
  /** Seconds the fact gives: sets the zombies' pace and what counts as a quick answer. */
  seconds: number;
  /** open: tappable; throwing: a bomb is in the air; reveal: the right answer is being shown. */
  state: 'open' | 'throwing' | 'reveal';
  /** Game time at which the question finished being read out. */
  speechEndAt: number | null;
  chosen: number;
}

interface Flight {
  kind: 'bomb' | 'dud';
  question: Question;
  slot: Slot | null;
  from: Vector3;
  to: Vector3;
  t: number;
  arc: number;
  points: number;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent: HTMLElement,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  parent.appendChild(node);
  return node;
}

function run(session: GameSession): void {
  const container = document.getElementById('game');
  if (!container) throw new Error('Missing #game container');

  // ---------- Scene ----------
  const ctx = createScene(container, { fov: 60, near: 0.5, far: 800 });
  const { scene, camera } = ctx;
  ctx.renderer.setClearColor(HORIZON_COLOR);
  const field = buildField(scene);

  const thrower = createThrower();
  thrower.object.position.set(0, 0, KID_Z);
  scene.add(thrower.object);

  const effects = createEffects();
  scene.add(effects.object);
  const horde = createHorde(scene, effects);

  const flyingBomb = createBomb();
  flyingBomb.object.visible = false;
  flyingBomb.object.scale.setScalar(1.5);
  scene.add(flyingBomb.object);
  const bombShadow = new Mesh(
    new CircleGeometry(BOMB_RADIUS, 16),
    new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }),
  );
  bombShadow.rotation.x = -Math.PI / 2;
  bombShadow.visible = false;
  scene.add(bombShadow);

  // ---------- HUD ----------
  const hud = el('div', 'zb-hud', document.body);
  const problem = el('div', 'zb-problem', hud);
  problem.setAttribute('aria-live', 'polite');
  const problemText = el('span', 'zb-problem-text', problem);
  const hear = el('button', 'zb-hear', problem);
  hear.type = 'button';
  hear.textContent = '🔊';
  hear.setAttribute('aria-label', 'Hear the question');
  const stats = el('div', 'zb-stats', hud);
  const brainsBar = el('div', 'zb-brains', stats);
  const waveText = el('div', 'zb-wave', stats);
  const scoreRow = el('div', 'zb-score', stats);
  const scoreValue = el('span', 'zb-score-value', scoreRow);
  const multBadge = el('span', 'zb-mult', scoreRow);
  const bossStatus = el('div', 'zb-sr', document.body);
  bossStatus.setAttribute('aria-live', 'polite');
  const answers = el('div', 'zb-answers', document.body);
  const buttons = Array.from({ length: LANES }, () => {
    const button = el('button', 'zb-answer', answers);
    button.type = 'button';
    return button;
  });
  const tapFlow = createTapFlow();
  const banner = el('div', 'zb-banner', document.body);
  banner.setAttribute('role', 'status');
  const bannerTitle = el('div', 'zb-banner-title', banner);
  const bannerDetail = el('div', 'zb-banner-detail', banner);
  banner.hidden = true;
  const count = el('div', 'zb-count', document.body);
  count.setAttribute('aria-live', 'assertive');
  count.hidden = true;

  createBackButton();
  const mute = createMuteButton();
  const pause = createPauseOverlay({
    onPause: () => {
      ctx.stop();
      stopSpeaking();
    },
    onResume: () => ctx.start(),
  });

  // ---------- State ----------
  let phase: Phase = 'preview';
  let feed: FactFeed = createFactFeed(() => session.chooseFacts());
  let spawner: WaveSpawner = createWaveSpawner();
  let question: Question | null = null;
  let flight: Flight | null = null;
  let score = 0;
  /** Right answers in a row since the last wrong answer or lost brain; sets the multiplier. */
  let streak = 0;
  let brains = BRAINS;
  /** Zombies and bosses knocked out this run. */
  let blasted = 0;
  let bossActive = false;
  let bossHp = 0;
  /** Seconds the current question gives, and the shared walking pace (units/s) following it. */
  let paceSeconds = 10;
  let pace = 0;
  /** Whether the wrong-answer reveal has been read out. */
  let revealSpoken = false;
  /** Between the tap and the bomb leaving the hand. */
  let releasePending = false;
  /** Game time at which the kid goes back to waiting, the barricade is mended, 0 for never. */
  let kidResetAt = 0;
  let repairAt = 0;
  /** Bumped by each new run and wave, so late callbacks can tell they are stale. */
  let epoch = 0;
  let bannerId = 0;
  let shake = 0;

  // Delayed actions run on game time so pausing freezes them too.
  let gameTime = 0;
  let pending: { at: number; fn: () => void }[] = [];
  const after = (seconds: number, fn: () => void) => pending.push({ at: gameTime + seconds, fn });

  /**
   * Dims the answers while a bomb is in the air. They are not `disabled`, so a tap in that window
   * still reaches `onAnswer` instead of being swallowed.
   */
  const lockAnswers = () => buttons.forEach((b) => b.setAttribute('aria-disabled', 'true'));
  const unlockAnswers = () => buttons.forEach((b) => b.removeAttribute('aria-disabled'));

  /** The top HUD, with or without the question; the answer bar goes with the question. */
  const setHud = (visible: boolean, withQuestion: boolean) => {
    hud.hidden = !visible;
    problem.hidden = !withQuestion;
    answers.classList.toggle('off', !withQuestion);
    if (!visible) banner.hidden = true;
  };

  // ---------- Layout ----------
  let viewW = 0;
  let viewH = 0;
  let wantAspect = 1;
  let lane = fitView(1).lane;
  const point = new Vector3();

  /** Where the HUD ends, measured as if the question were showing so the camera never moves. */
  const hudBottom = () => {
    const hudWas = hud.hidden;
    const problemWas = problem.hidden;
    hud.hidden = false;
    problem.hidden = false;
    const bottom = hud.getBoundingClientRect().bottom;
    hud.hidden = hudWas;
    problem.hidden = problemWas;
    return bottom;
  };

  /**
   * Fits the field to the part of the screen between the HUD and the answer bar, for any shape:
   * the camera frames a picture that size, with the grass under the bar and the sky behind the
   * HUD running on past its edges. On a short screen the HUD overlaps the sky instead, so the
   * field keeps room to be seen.
   */
  const layout = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w !== viewW || h !== viewH) {
      viewW = w;
      viewH = h;
      const barTop = answers.getBoundingClientRect().top;
      const bottom = MathUtils.clamp(barTop > 0 ? barTop : h, h * 0.5, h);
      let top = hudBottom() + 4;
      if (bottom - top < h * MIN_FRAME) top = 0;
      const frameH = Math.max(bottom - top, 1);
      wantAspect = w / frameH;
      const fit = fitView(wantAspect);
      lane = fit.lane;
      field.layout(lane);
      horde.setLane(lane);
      camera.fov = fit.fov;
      camera.position.copy(CAMERA);
      camera.lookAt(TARGET);
      camera.updateMatrixWorld();
      const setFrame = (shift: number) => {
        camera.setViewOffset(w, frameH, 0, -(top + shift), w, h);
        camera.aspect = wantAspect;
        camera.updateProjectionMatrix();
      };
      setFrame(0);
      // The boss stands taller than the camera, so its head would sit behind the HUD while it
      // walks out of the mist. Slide the picture down until the head clears the HUD, as far as
      // the kid's feet can go before they reach the answer bar.
      const screenY = (y: number, z: number) =>
        ((1 - point.set(0, y, z).project(camera).y) / 2) * h;
      const headY = screenY(BOSS_TOP, SPAWN_Z);
      const feetY = screenY(0, KID_Z);
      const wanted = top + BOSS_CLEARANCE - headY;
      const room = bottom - KID_MARGIN - feetY;
      setFrame(Math.max(0, Math.min(wanted, room)));
    } else if (camera.aspect !== wantAspect) {
      // The shared resize handler sets the aspect of the whole screen; put ours back.
      camera.aspect = wantAspect;
      camera.updateProjectionMatrix();
    }
  };

  const toScreen = (world: Vector3) => {
    const p = point.copy(world).project(camera);
    return {
      x: MathUtils.clamp(((p.x + 1) / 2) * viewW, 40, viewW - 40),
      y: MathUtils.clamp(((1 - p.y) / 2) * viewH, 90, viewH - 90),
    };
  };

  // ---------- HUD helpers ----------
  const renderBrains = (justLost = false) => {
    const icons = Array.from({ length: BRAINS }, (_, i) => {
      const icon = document.createElement('span');
      icon.className = `zb-brain${i >= brains ? ' lost' : ''}`;
      icon.textContent = '🧠';
      return icon;
    });
    brainsBar.replaceChildren(...icons);
    brainsBar.setAttribute('role', 'img');
    brainsBar.setAttribute('aria-label', `${brains} of ${BRAINS} brains left`);
    if (!justLost) return;
    // The brain that was just lost pops off the bar and floats away.
    const rect = icons[brains].getBoundingClientRect();
    const fly = el('span', 'zb-brain-fly', document.body);
    fly.textContent = '🧠';
    fly.style.left = `${rect.left}px`;
    fly.style.top = `${rect.top}px`;
    fly.addEventListener('animationend', () => fly.remove());
    setTimeout(() => fly.remove(), 1200);
  };

  const renderScore = () => {
    scoreValue.textContent = score.toLocaleString();
    const multiplier = multiplierFor(streak);
    multBadge.hidden = multiplier === 1;
    multBadge.textContent = `×${multiplier}`;
    waveText.textContent = `Wave ${spawner.wave}`;
  };

  const renderBossStatus = () => {
    bossStatus.textContent = bossActive
      ? `Boss: ${bossHp} ${bossHp === 1 ? 'hit' : 'hits'} left`
      : '';
  };

  /** Floats a short message up from a spot on the screen. */
  const pop = (text: string, at: { x: number; y: number }, kind: 'good' | 'bad' | 'plain') => {
    const node = el('div', `zb-pop ${kind}`, document.body);
    node.textContent = text;
    node.style.left = `${at.x}px`;
    node.style.top = `${at.y}px`;
    node.addEventListener('animationend', () => node.remove());
    setTimeout(() => node.remove(), 1600);
  };

  /** Restarts a CSS animation on an overlay. */
  const replay = (node: HTMLElement) => {
    node.classList.remove('on');
    void node.offsetWidth;
    node.classList.add('on');
  };

  /**
   * Centres the banner in the clear space between the HUD and the answer bar, or (for the game
   * over message) on the kid.
   */
  const showBanner = (
    title: string,
    detail: string,
    kind: BannerKind,
    place: 'middle' | 'kid' = 'middle',
  ): number => {
    bannerTitle.textContent = title;
    bannerDetail.textContent = detail;
    bannerDetail.hidden = !detail;
    banner.className = `zb-banner ${kind}`;
    banner.hidden = false;
    const top = hud.hidden ? 20 : hud.getBoundingClientRect().bottom + 8;
    const room = kind === 'miss' ? TAP_ROOM : 0;
    const bottom =
      (answers.classList.contains('off') ? viewH - 20 : answers.getBoundingClientRect().top - 8) -
      room;
    const half = banner.offsetHeight / 2;
    const wish = place === 'kid' ? toScreen(point.set(0, 0.6, KID_Z)).y : (top + bottom) / 2;
    banner.style.top = `${Math.min(Math.max(wish, top + half), Math.max(bottom - half, top + half))}px`;
    return ++bannerId;
  };

  // ---------- Run flow ----------
  const startRun = (withPreview: boolean) => {
    pending = [];
    epoch++;
    tapFlow.disarm();
    feed = createFactFeed(() => session.chooseFacts());
    spawner = createWaveSpawner();
    score = 0;
    streak = 0;
    brains = BRAINS;
    blasted = 0;
    bossActive = false;
    bossHp = 0;
    question = null;
    flight = null;
    releasePending = false;
    kidResetAt = 0;
    repairAt = 0;
    pace = 0;
    flyingBomb.object.visible = false;
    bombShadow.visible = false;
    horde.clear();
    horde.setLingering(false);
    field.repairFence();
    effects.clear();
    thrower.reset();
    renderBrains();
    renderScore();
    renderBossStatus();
    setHud(false, false);
    count.hidden = true;
    if (!withPreview) {
      startCountdown();
      return;
    }
    phase = 'preview';
    showPreview({ topic: session.topic, facts: feed.peek(10), onDone: startCountdown });
  };

  /** 3, 2, 1, Go! and the zombies start to come. */
  const startCountdown = () => {
    phase = 'countdown';
    setHud(true, false);
    const thisEpoch = epoch;
    const steps = ['3', '2', '1', 'Go!'];
    steps.forEach((text, i) => {
      after(i * COUNT_STEP, () => {
        if (epoch !== thisEpoch) return;
        count.textContent = text;
        count.hidden = false;
        replay(count);
        if (i < 3) sfx.tick();
        else sfx.goal();
      });
    });
    after(steps.length * COUNT_STEP, () => {
      if (epoch !== thisEpoch) return;
      count.hidden = true;
      phase = 'playing';
      openQuestion();
    });
  };

  /** Whether a spoken question or explanation is being read out right now. */
  const isReading = () =>
    question !== null &&
    (question.state === 'reveal' ? !revealSpoken : question.speechEndAt === null);

  /** Shows the next question with its four answers and reads it out. The zombies keep walking. */
  const openQuestion = (locked = false) => {
    const fact = feed.take();
    tapFlow.disarm();
    const q: Question = {
      fact,
      options: answerOptions(session.topic, fact, buttons.length),
      seconds: session.timerSecondsFor(fact),
      state: locked ? 'throwing' : 'open',
      speechEndAt: null,
      chosen: -1,
    };
    question = q;
    paceSeconds = q.seconds;
    buttons.forEach((button, i) => {
      const text = q.options[i];
      button.hidden = text === undefined;
      button.textContent = text ?? '';
      button.setAttribute('aria-label', `Answer ${text ?? ''}`);
      button.className = 'zb-answer';
      if (locked) button.setAttribute('aria-disabled', 'true');
      else button.removeAttribute('aria-disabled');
    });
    problemText.textContent = fact.prompt;
    setHud(true, true);
    speak(fact.spokenPrompt ?? fact.prompt, () => {
      if (question === q && q.speechEndAt === null) q.speechEndAt = gameTime;
    });
  };

  /** The player picks an answer: the kid throws a bomb (a real one for the right answer). */
  const select = (index: number) => {
    const q = question;
    if (phase !== 'playing' || !q || q.state !== 'open' || q.options[index] === undefined) return;
    try {
      unlockAudio();
      stopSpeaking();
    } catch {
      // Audio trouble must never stop the throw.
    }
    q.state = 'throwing';
    q.chosen = index;
    lockAnswers();
    buttons[index].classList.add('chosen');
    const right = q.options[index] === q.fact.answer;
    let points = 0;
    if (right) {
      feed.recordHit(q.fact);
      session.recordAnswer(q.fact, true);
      streak = nextStreak(streak, true);
      const answerSeconds = q.speechEndAt === null ? 0 : Math.max(0, gameTime - q.speechEndAt);
      points = hitPoints(answerSeconds, q.seconds, streak);
      score += points;
      renderScore();
      replay(scoreValue);
      if (multiplierFor(streak) > multiplierFor(streak - 1)) {
        pop(`×${multiplierFor(streak)} streak!`, { x: viewW / 2, y: viewH * 0.3 }, 'plain');
      }
      buttons.forEach((button, i) => button.classList.add(i === index ? 'right' : 'gone'));
    } else {
      feed.recordMiss(q.fact);
      session.recordAnswer(q.fact, false);
      streak = nextStreak(streak, false);
      renderScore();
      buttons[index].classList.add('wrong');
      buttons[q.options.indexOf(q.fact.answer)]?.classList.add('right');
    }
    releasePending = true;
    kidResetAt = 0;
    const thisEpoch = epoch;
    thrower.throwBomb(() => {
      releasePending = false;
      if (epoch === thisEpoch && phase === 'playing') release(q, right, points);
    });
  };

  /** The bomb leaves the hand, aimed at the zombie nearest the barricade. */
  const release = (q: Question, right: boolean, points: number) => {
    const slot = horde.closest();
    const from = thrower.handPosition(new Vector3());
    const to = new Vector3(0, 0.12, -8);
    if (slot) slot.zombie.feetPosition(to);
    flight = { kind: right ? 'bomb' : 'dud', question: q, slot, from, to, t: 0, arc: 0, points };
    flight.arc = arcHeightFor(from.distanceTo(to));
    flyingBomb.object.visible = true;
    bombShadow.visible = true;
    sfx.whoosh();
    if (!right) return;
    if (slot?.boss && bossHp === 1) {
      // This hit knocks the boss out: no more questions until the next wave.
      question = null;
      setHud(true, false);
    } else {
      openQuestion(true);
    }
  };

  /** The bomb lands on its target. */
  const land = (f: Flight) => {
    flight = null;
    flyingBomb.object.visible = false;
    bombShadow.visible = false;
    const at = f.to.clone();
    const alive = f.slot !== null && f.slot.state === 'walking';
    if (f.kind === 'dud') {
      effects.fizzle(at);
      sfx.fizz();
      if (f.slot && alive) horde.laugh(f.slot);
      thrower.react('cower');
      startReveal(f.question);
      return;
    }
    if (f.slot && alive) {
      if (f.slot.boss) hitBoss(f.slot, at, f.points);
      else blast(f.slot, at, f.points);
    } else {
      // Whatever it was aimed at is gone: the bomb just goes off in the grass.
      effects.boom(at);
      sfx.boom();
    }
    thrower.react('cheer');
    kidResetAt = gameTime + 1;
    // The question that opened when the bomb left the hand can be answered now.
    if (question && question.state === 'throwing') {
      question.state = 'open';
      unlockAnswers();
    }
  };

  /** Knocks a regular zombie flat. */
  const blast = (slot: Slot, at: Vector3, points: number) => {
    effects.boom(at);
    sfx.boom();
    horde.blast(slot);
    blasted++;
    const head = slot.zombie.signAnchor(new Vector3());
    pop(`+${points.toLocaleString()}`, toScreen(head), 'good');
  };

  /** A hit on the boss: a flash, a stagger, and a piece of armour flies off. */
  const hitBoss = (slot: Slot, at: Vector3, points: number) => {
    bossHp = Math.max(0, bossHp - 1);
    renderBossStatus();
    slot.zombie.flash();
    slot.zombie.knockOffArmour();
    sfx.boom();
    sfx.crash();
    shake = Math.max(shake, HIT_SHAKE);
    pop(`+${points.toLocaleString()}`, toScreen(slot.zombie.signAnchor(new Vector3())), 'good');
    if (bossHp > 0) {
      effects.boom(at, 0.7);
      slot.zombie.stagger();
      horde.knockBack(slot, BOSS_KNOCKBACK);
      return;
    }
    // Knocked out: a big boom, the bonus, and then the break before the next wave.
    effects.boom(at, 1.8);
    horde.blast(slot);
    blasted++;
    bossActive = false;
    score += BOSS_BONUS;
    renderScore();
    replay(scoreValue);
    pop(`+${BOSS_BONUS}`, { x: viewW / 2, y: viewH * 0.4 }, 'good');
    showBanner('Boss down!', '', 'hit');
    sfx.goal();
    speak(BOSS_DOWN_SPEECH);
    startWaveBreak(true);
  };

  /**
   * The wrong answer's explanation: shown and read out. The game then waits for a tap on the
   * green answer, with the zombies standing still.
   */
  const startReveal = (q: Question) => {
    q.state = 'reveal';
    revealSpoken = false;
    showBanner('Dud!', q.fact.statement, 'miss');
    sfx.miss();
    tapFlow.arm(buttons, q.options.indexOf(q.fact.answer), [hud, banner], q.fact.prompt);
    const id = epoch;
    after(0.6, () => {
      if (question !== q || q.state !== 'reveal') return;
      speak(q.fact.spokenStatement ?? q.fact.statement, () => {
        if (epoch !== id || question !== q || q.state !== 'reveal') return;
        revealSpoken = true;
        tapFlow.readFinished();
      });
    });
  };

  const endReveal = () => {
    tapFlow.disarm();
    stopSpeaking();
    banner.hidden = true;
    horde.unlaugh();
    thrower.reset();
    if (phase === 'playing') openQuestion();
  };

  // ---------- Zombies reaching the barricade ----------
  horde.onReach((slot) => {
    if (phase !== 'playing' && phase !== 'waveBreak') return;
    field.smashFence(slot.zombie.object.position.x);
    repairAt = gameTime + REPAIR_AFTER;
    sfx.crash();
    shake = Math.max(shake, SMASH_SHAKE);
    brains = loseBrain(brains);
    streak = nextStreak(streak, false);
    renderBrains(true);
    renderScore();
    if (!releasePending) {
      thrower.react('cower');
      kidResetAt = gameTime + 0.9;
    }
    if (outOfBrains(brains)) {
      endRun();
      return;
    }
    if (slot.boss) {
      // The boss got through: no bonus, but the wave is over.
      bossActive = false;
      startWaveBreak(false);
    }
  });

  // ---------- Bosses and waves ----------
  const startBoss = () => {
    bossActive = true;
    bossHp = BOSS_HITS;
    spawner.bossSent();
    horde.spawnBoss();
    renderBossStatus();
    sfx.alarm();
    const id = showBanner('BOSS ZOMBIE!', '', 'warn');
    after(BOSS_BANNER_FOR, () => {
      if (id === bannerId) banner.hidden = true;
    });
    // Never cut off a question that is being read.
    if (!isReading()) speak(BOSS_SPEECH);
  };

  /** The wave is over: the question goes away, then "Wave N" and the next wave. */
  const startWaveBreak = (bossDown: boolean) => {
    phase = 'waveBreak';
    tapFlow.disarm();
    const thisEpoch = ++epoch;
    question = null;
    flight = null;
    flyingBomb.object.visible = false;
    bombShadow.visible = false;
    horde.unlaugh();
    renderBossStatus();
    setHud(true, false);
    if (!bossDown) banner.hidden = true;
    after(WAVE_BANNER_AT, () => {
      if (epoch !== thisEpoch || phase !== 'waveBreak') return;
      horde.clearBlasted();
      showBanner(`Wave ${spawner.wave + 1}`, '', 'hit');
      speak(NEXT_WAVE_SPEECH);
    });
    after(WAVE_BREAK, () => {
      if (epoch !== thisEpoch || phase !== 'waveBreak') return;
      banner.hidden = true;
      spawner.nextWave();
      renderScore();
      phase = 'playing';
      openQuestion();
    });
  };

  // ---------- The end ----------
  /** The last brain is gone: the zombies finish the walk and swarm the barricade. */
  const endRun = () => {
    phase = 'ending';
    tapFlow.disarm();
    const thisEpoch = ++epoch;
    pending = [];
    question = null;
    flight = null;
    flyingBomb.object.visible = false;
    bombShadow.visible = false;
    bossActive = false;
    renderBossStatus();
    horde.unlaugh();
    horde.setLingering(true);
    stopSpeaking();
    setHud(true, false);
    thrower.react('cower');
    showBanner(GAME_OVER_SPEECH, '', 'out', 'kid');
    let spoken = false;
    let shown = false;
    const next = () => {
      if (spoken && shown && epoch === thisEpoch && phase === 'ending') finishRun();
    };
    speak(GAME_OVER_SPEECH, () => {
      spoken = true;
      next();
    });
    after(END_FOR, () => {
      shown = true;
      next();
    });
  };

  const finishRun = () => {
    phase = 'done';
    setHud(false, false);
    count.hidden = true;
    effects.clear();
    const stars = starsFor(feed.correct, feed.answered);
    session.recordStars(stars);
    const newHighScore = session.recordScore(score);
    renderScore();
    if (newHighScore) sfx.goal();
    speak(newHighScore ? NEW_HIGH_SCORE_SPEECH : GREAT_BLASTING_SPEECH);
    showResults({
      topicId: session.topic.id,
      correct: feed.correct,
      total: feed.answered,
      stars,
      newBest: false,
      missed: feed.missed(),
      playerName: session.player?.name,
      score,
      highScore: session.highScore(),
      newHighScore,
      outcome: outcomeText(spawner.wave, blasted),
      playAgainLabel: 'Play again 💣',
      onPlayAgain: () => startRun(false),
    });
  };

  // ---------- Input ----------
  /** After a dud, only the green answer moves on; any other answer is ignored. */
  const onAnswer = (index: number) => {
    if (tapFlow.armed) {
      if (tapFlow.tap(index)) endReveal();
      return;
    }
    if (phase === 'playing' && question?.state === 'open') select(index);
  };
  const unpress = buttons.map((button, i) => {
    // A touch press doesn't count as a user gesture for iOS audio; the release does.
    button.addEventListener('pointerup', unlockAudio);
    return onPress(button, () => onAnswer(i));
  });
  hear.addEventListener('click', () => {
    unlockAudio();
    if (question) speak(question.fact.spokenPrompt ?? question.fact.prompt);
  });
  const stopPointer = createPointerInput(ctx.renderer.domElement, {
    onDragStart: () => unlockAudio(),
  });

  // Keys 1-4 pick the answers from left to right.
  const onKey = (e: KeyboardEvent) => {
    const index = Number(e.key) - 1;
    if (!pause.isPaused && index >= 0 && index < LANES) onAnswer(index);
  };
  window.addEventListener('keydown', onKey);

  // The boss's heavy steps shake the camera and thump.
  horde.boss.zombie.onFootfall = () => {
    shake = Math.max(shake, STEP_SHAKE);
    if (horde.boss.state === 'walking') sfx.kick();
  };

  // ---------- Loop ----------
  ctx.onUpdate((delta, elapsed) => {
    layout();

    gameTime += delta;
    tapFlow.update(delta);
    const due = pending.filter((p) => p.at <= gameTime);
    if (due.length) {
      pending = pending.filter((p) => p.at > gameTime);
      due.forEach((p) => p.fn());
    }
    if (kidResetAt && gameTime >= kidResetAt && !releasePending) {
      kidResetAt = 0;
      if (question?.state !== 'reveal') thrower.reset();
    }
    if (repairAt && gameTime >= repairAt) {
      repairAt = 0;
      field.repairFence();
    }

    // The zombies' pace follows the current question. While a wrong answer is explained they stand
    // still at once, and nothing new spawns, until the player taps the green answer.
    const revealing = question?.state === 'reveal';
    const goal = walkSpeed(paceSeconds, false, revealing);
    pace = revealing ? 0 : easeToward(pace, goal, PACE_RATE, delta);

    if (phase === 'playing' && !revealing) {
      const spawns = spawner.update(delta, horde.walkingCount);
      for (let i = 0; i < spawns; i++) horde.spawn();
      // The boss waits for a wrong answer's explanation to finish rather than hide it.
      if (spawner.bossDue && !bossActive) startBoss();
    }

    horde.update(delta, pace);
    thrower.update(delta, elapsed);
    effects.update(delta);
    field.update(elapsed, delta);

    if (flight) {
      const f = flight;
      f.t += delta;
      // The bomb's end point follows its target, which keeps walking.
      if (f.slot && f.slot.state === 'walking') f.slot.zombie.feetPosition(f.to);
      const p = bombPosition(f.from, f.to, f.t, BOMB_TIME, f.arc);
      flyingBomb.object.position.set(p.x, p.y, p.z);
      flyingBomb.object.rotation.x = -f.t * 14;
      flyingBomb.update(elapsed);
      bombShadow.position.set(p.x, 0.02, p.z);
      bombShadow.scale.setScalar(Math.max(0.4, 1 - p.y * 0.12));
      if (f.t >= BOMB_TIME) land(f);
    }

    // Camera shake from the boss's steps, hits and smashed barricades.
    shake = easeToward(shake, 0, 20, delta);
    camera.position.set(
      CAMERA.x + Math.sin(elapsed * 61) * shake,
      CAMERA.y + Math.sin(elapsed * 73 + 1) * shake,
      CAMERA.z,
    );
    camera.lookAt(TARGET);
    camera.updateMatrixWorld();
  });

  layout();
  setHud(false, false);
  renderBrains();
  renderScore();
  ctx.start();
  startRun(true);

  window.addEventListener('pagehide', () => {
    stopSpeaking();
    window.removeEventListener('keydown', onKey);
    stopPointer();
    tapFlow.dispose();
    unpress.forEach((fn) => fn());
    pause.dispose();
    mute.dispose();
    effects.clear();
    [hud, bossStatus, answers, banner, count].forEach((node) => node.remove());
    document.querySelectorAll('.zb-brain-fly, .zb-pop').forEach((node) => node.remove());
    ctx.dispose();
  });
}

const session = startGameSession(GAME_ID);
if (session) run(session);
else location.replace(menuUrl());
