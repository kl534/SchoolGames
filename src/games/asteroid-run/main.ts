import './style.css';
import { MathUtils, Vector3 } from 'three';
import { sfx, speak, stopSpeaking, unlockAudio } from '../../shared/audio';
import { createPointerInput, onPress } from '../../shared/input';
import { showPreview } from '../../shared/preview';
import { showResults } from '../../shared/results';
import { starsFor } from '../../shared/round';
import { createScene } from '../../shared/scene';
import { startGameSession, type GameSession } from '../../shared/session';
import { createTapFlow } from '../../shared/tapflow';
import { answerOptions, type Fact } from '../../shared/topics';
import { createBackButton, createMuteButton, createPauseOverlay, menuUrl } from '../../shared/ui';
import { createAsteroid, type Asteroid } from './asteroid';
import { buildBackdrop, FOG_COLOR } from './backdrop';
import { createEffects } from './effects';
import { createFactFeed, type FactFeed } from '../../shared/feed';
import {
  BOSS_LOCK_Z,
  cameraGoal,
  clampToBox,
  dragScale,
  fitView,
  LOCK_Z,
  lookGoal,
  SHIP_Z,
  TARGET_SPAWN_Z,
  viewShift,
  type FlightFit,
} from './layout';
import { CRYSTAL_RADIUS, createObstacles, SHIP_RADIUS } from './obstacles';
import {
  approachProgress,
  approachZ,
  BOSS_BONUS,
  BOSS_HITS,
  bossClockTotal,
  crystalInterval,
  CRYSTAL_POINTS,
  easeIn,
  easeOut,
  easeToward,
  GREAT_FLYING_SPEECH,
  hitPoints,
  isBossTarget,
  loseShield,
  multiplierFor,
  NEW_HIGH_SCORE_SPEECH,
  nextStreak,
  outOfShields,
  SHIELDS,
  SHIP_DESTROYED_SPEECH,
  worldSpeedFactor,
} from './rules';
import { createShip } from './ship';

const GAME_ID = 'asteroid-run';

/** How fast the world streams past at the start, in world units per second. */
const BASE_SPEED = 28;
/** The slow drift behind the preview and results screens. */
const IDLE_SPEED = 7;
/** Seconds a target takes to fly in to its lock distance (a boss takes a little longer). */
const ARRIVE_TIME = 2;
const BOSS_ARRIVE_TIME = 2.6;
/** Seconds the laser bolts take to reach the asteroid, and a thrown chunk to reach the ship. */
const LASER_TIME = 0.32;
const DEBRIS_TIME = 0.5;
/** Seconds a boss's direct hit stays up before a tap can skip to its next question. */
const HIT_SKIP = 0.6;
/** Room kept under a miss banner for the finger and caption that point at the green answer, px. */
const TAP_ROOM = 104;
/** Seconds each step of the 3, 2, 1, Go! lasts. */
const COUNT_STEP = 0.75;
/** Gap between a destroyed asteroid and the next one appearing. */
const NEXT_GAP = 1.3;
/** Pull the camera back this far when the ship blows up. */
const PULL_BACK = 9;

type Phase = 'preview' | 'countdown' | 'idle' | 'aiming' | 'firing' | 'result' | 'ending' | 'done';

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

/** A little shield badge, drawn rather than typed so it looks the same everywhere. */
function shieldIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 28');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M12 1.5 22 5v9c0 6-4.2 10.2-10 12.5C6.2 24.200 2 20 2 14V5Z');
  path.setAttribute('fill', 'currentColor');
  const shine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  shine.setAttribute('d', 'M12 5 18.500 7.400V14c0 3.800-2.500 6.600-6.500 8.400Z');
  shine.setAttribute('fill', 'rgba(255,255,255,0.35)');
  svg.append(path, shine);
  return svg;
}

function run(session: GameSession): void {
  const container = document.getElementById('game');
  if (!container) throw new Error('Missing #game container');

  // ---------- Scene ----------
  const ctx = createScene(container, { fov: 62, near: 0.3, far: 900 });
  const { scene, camera } = ctx;
  ctx.renderer.setClearColor(FOG_COLOR);
  const backdrop = buildBackdrop(scene);

  const ship = createShip();
  scene.add(ship.object, ship.trail);
  const obstacles = createObstacles();
  obstacles.crystals.forEach((c) => scene.add(c.object));
  const rockTarget = createAsteroid(false);
  const bossTarget = createAsteroid(true);
  for (const asteroid of [rockTarget, bossTarget]) {
    asteroid.object.visible = false;
    scene.add(asteroid.object);
  }
  const effects = createEffects();
  scene.add(effects.object);

  // ---------- HUD ----------
  const hud = el('div', 'ar-hud', document.body);
  const problem = el('div', 'ar-problem', hud);
  problem.setAttribute('aria-live', 'polite');
  const problemText = el('span', 'ar-problem-text', problem);
  const hear = el('button', 'ar-hear', problem);
  hear.type = 'button';
  hear.textContent = '🔊';
  hear.setAttribute('aria-label', 'Hear the question');
  const clockBar = el('div', 'ar-clock', hud);
  const clockFill = el('div', 'ar-clock-fill', clockBar);
  const bossBar = el('div', 'ar-boss', hud);
  bossBar.setAttribute('role', 'img');
  const bossSegments = Array.from({ length: BOSS_HITS }, () => el('span', 'ar-boss-seg', bossBar));
  const shieldsBar = el('div', 'ar-shields', document.body);
  const scorePanel = el('div', 'ar-score', document.body);
  const scoreRow = el('div', 'ar-score-row', scorePanel);
  const scoreValue = el('span', 'ar-score-value', scoreRow);
  const multBadge = el('span', 'ar-mult', scoreRow);
  const bestText = el('div', 'ar-best', scorePanel);
  const answers = el('div', 'ar-answers', document.body);
  const buttons = Array.from({ length: 4 }, () => {
    const button = el('button', 'ar-answer', answers);
    button.type = 'button';
    return button;
  });
  const tapFlow = createTapFlow();
  const banner = el('div', 'ar-banner', document.body);
  banner.setAttribute('role', 'status');
  const bannerTitle = el('div', 'ar-banner-title', banner);
  const bannerDetail = el('div', 'ar-banner-detail', banner);
  banner.hidden = true;
  const count = el('div', 'ar-count', document.body);
  count.setAttribute('aria-live', 'assertive');
  count.hidden = true;
  const flash = el('div', 'ar-flash', document.body);
  const crack = el('div', 'ar-crack', document.body);
  crack.innerHTML =
    '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
    '<g fill="none" stroke="#e8f8ff" stroke-width="0.7" stroke-linejoin="bevel">' +
    '<path d="M50 52 41 38 44 24 33 12 35 0M41 38 28 34 18 20 4 18M50 52 62 41 77 44 86 30 100 28M62 41 66 26 78 18M50 52 56 66 48 79 55 100M48 79 34 84 24 97M56 66 72 72 83 90M50 52 36 58 20 55 8 66 0 62"/>' +
    '</g></svg>';

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
  let fact: Fact | undefined;
  let options: string[] = [];
  let chosen = -1;
  let score = 0;
  /** Hits in a row since the last miss; sets the score multiplier. */
  let streak = 0;
  let shields = SHIELDS;
  /** Asteroids destroyed this run; the world speeds up with each. */
  let destroyed = 0;
  let targetNumber = 0;

  // The asteroid in play, and the boss fight it may be part of.
  let target: Asteroid = rockTarget;
  let targetAlive = false;
  let isBoss = false;
  let bossHp = 0;
  /** Boss questions still to ask. */
  let bossFacts: Fact[] = [];
  const targetPos = new Vector3(0, 0, TARGET_SPAWN_Z);
  let arriveTime = 0;
  let arriveFor = ARRIVE_TIME;
  let lockZ = LOCK_Z;
  let hitZ = -3.5;
  let ram: { t: number; duration: number; from: number } | null = null;
  /** The boss's thrown chunk is in the air; set while its landing is still to happen. */
  let debrisInAir = false;

  /** The question has been read out. */
  let speechDone = false;
  let clockLeft = 0;
  /** Seconds the clock started with; a boss fight has one clock for all its questions. */
  let clockTotal = 1;
  let clockRunning = false;
  let lastTick = 0;
  /** Game time at which the current result was shown. */
  let resultAt = 0;
  /** Ticks up for each asteroid and question, so late callbacks can tell they are stale. */
  let turn = 0;

  // The ship and its chase camera.
  const shipPos = { x: 0, y: 0 };
  const goal = { x: 0, y: 0 };
  const motion = { vx: 0, vy: 0, bank: 0, pitch: 0, yaw: 0 };
  let speed = IDLE_SPEED;
  let flightActive = false;
  let crystalIn = 4;
  let shake = 0;
  let pullBack = 0;
  let roll = 0;
  const cam = new Vector3(0, 2.3, 7.2);
  const look = new Vector3(0, 0.5, -18);
  const want = new Vector3();
  const aim = new Vector3();
  const muzzleLeft = new Vector3();
  const muzzleRight = new Vector3();
  const point = new Vector3();

  // Delayed actions run on game time so pausing freezes them too.
  let gameTime = 0;
  let pending: { at: number; fn: () => void }[] = [];
  const after = (seconds: number, fn: () => void) => pending.push({ at: gameTime + seconds, fn });

  /**
   * Dims the answers while a result plays out. They are not `disabled`, so a tap in that window
   * still reaches `onAnswer` instead of being swallowed.
   */
  const lockAnswers = () => buttons.forEach((b) => b.setAttribute('aria-disabled', 'true'));

  const setHudVisible = (visible: boolean) => {
    hud.hidden = !visible;
    answers.hidden = !visible;
    buttons.forEach((b, i) => (b.hidden = options[i] === undefined));
    if (!visible) banner.hidden = true;
  };

  // ---------- Layout ----------
  let viewW = 0;
  let viewH = 0;
  let fit: FlightFit = fitView(1);
  let baseFov = fit.fov;
  let drag = dragScale(1, 1, fit);

  /** Fits the flight box and field of view to the screen, for any aspect ratio. */
  const layout = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === viewW && h === viewH) return;
    viewW = w;
    viewH = h;
    const aspect = w / Math.max(h, 1);
    fit = fitView(aspect);
    baseFov = fit.fov;
    drag = dragScale(w, h, fit);
    camera.aspect = aspect;
    camera.fov = baseFov;
    camera.setViewOffset(w, h, 0, viewShift(w, h, fit), w, h);
    camera.updateProjectionMatrix();
    clampToBox(goal, fit);
    clampToBox(shipPos, fit);
  };

  const toScreen = (world: Vector3) => {
    const p = point.copy(world).project(camera);
    return {
      x: MathUtils.clamp(((p.x + 1) / 2) * viewW, 40, viewW - 40),
      y: MathUtils.clamp(((1 - p.y) / 2) * viewH, 90, viewH - 90),
    };
  };

  // ---------- HUD helpers ----------
  const renderShields = (justLost = false) => {
    const icons = Array.from({ length: SHIELDS }, (_, i) => {
      const icon = document.createElement('span');
      icon.className = `ar-shield${i >= shields ? ' lost' : ''}`;
      icon.appendChild(shieldIcon());
      return icon;
    });
    shieldsBar.replaceChildren(...icons);
    shieldsBar.setAttribute('role', 'img');
    shieldsBar.setAttribute('aria-label', `${shields} of ${SHIELDS} shields left`);
    if (!justLost) return;
    // The shield that was just lost pops off the bar and floats away.
    const rect = icons[shields].getBoundingClientRect();
    const fly = el('span', 'ar-shield-fly', document.body);
    fly.appendChild(shieldIcon());
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
    bestText.textContent = `Best ${session.highScore().toLocaleString()}`;
  };

  const renderBoss = () => {
    bossBar.hidden = !isBoss;
    bossSegments.forEach((segment, i) => segment.classList.toggle('lost', i >= bossHp));
    bossBar.setAttribute('aria-label', `Boss asteroid: ${bossHp} of ${BOSS_HITS} hits left`);
  };

  const setClock = (fraction: number) => {
    const f = MathUtils.clamp(fraction, 0, 1);
    clockFill.style.transform = `scaleX(${f})`;
    clockBar.classList.toggle('urgent', f < 0.4);
  };

  /** Floats a short message up from a spot on the screen. */
  const pop = (text: string, at: { x: number; y: number }, kind: 'good' | 'bad' | 'plain') => {
    const node = el('div', `ar-pop ${kind}`, document.body);
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

  /** Centres the banner in the clear space between the question and the answers. */
  const showBanner = (title: string, detail: string, kind: 'hit' | 'miss' | 'warn' | 'out') => {
    bannerTitle.textContent = title;
    bannerDetail.textContent = detail;
    bannerDetail.hidden = !detail;
    banner.className = `ar-banner ${kind}`;
    banner.hidden = false;
    const top = hud.hidden ? 130 : hud.getBoundingClientRect().bottom + 8;
    const room = kind === 'miss' || kind === 'out' ? TAP_ROOM : 0;
    const bottom = (answers.hidden ? viewH - 20 : answers.getBoundingClientRect().top - 8) - room;
    const half = banner.offsetHeight / 2;
    const centre = (top + bottom) / 2;
    banner.style.top = `${Math.min(Math.max(centre, top + half), Math.max(bottom - half, top + half))}px`;
  };

  // ---------- Run flow ----------
  const startRun = (withPreview: boolean) => {
    pending = [];
    turn++;
    tapFlow.disarm();
    feed = createFactFeed(() => session.chooseFacts());
    score = 0;
    streak = nextStreak(streak, false);
    shields = SHIELDS;
    destroyed = 0;
    targetNumber = 0;
    isBoss = false;
    bossHp = 0;
    bossFacts = [];
    fact = undefined;
    options = [];
    targetAlive = false;
    ram = null;
    debrisInAir = false;
    rockTarget.object.visible = false;
    bossTarget.object.visible = false;
    obstacles.clear();
    effects.clear();
    ship.setVisible(true);
    pullBack = 0;
    shipPos.x = shipPos.y = goal.x = goal.y = 0;
    crystalIn = 5;
    flightActive = false;
    renderShields();
    renderScore();
    renderBoss();
    setHudVisible(false);
    count.hidden = true;
    if (!withPreview) {
      startCountdown();
      return;
    }
    phase = 'preview';
    showPreview({ topic: session.topic, facts: feed.peek(10), onDone: startCountdown });
  };

  /** 3, 2, 1, Go! and the run begins. */
  const startCountdown = () => {
    phase = 'countdown';
    flightActive = true;
    const steps = ['3', '2', '1', 'Go!'];
    steps.forEach((text, i) => {
      after(i * COUNT_STEP, () => {
        count.textContent = text;
        count.hidden = false;
        replay(count);
        if (i < 3) sfx.tick();
        else sfx.goal();
      });
    });
    after(steps.length * COUNT_STEP, () => {
      count.hidden = true;
      phase = 'idle';
      spawnTarget();
    });
  };

  const other = (a: Asteroid) => (a === rockTarget ? bossTarget : rockTarget);

  /** The next asteroid appears far ahead: a boss every `BOSS_EVERY`th, else a normal one. */
  const spawnTarget = () => {
    if (phase === 'ending' || phase === 'done') return;
    pending = [];
    tapFlow.disarm();
    stopSpeaking();
    banner.hidden = true;
    const thisTurn = ++turn;
    targetNumber++;
    isBoss = isBossTarget(targetNumber);
    target = isBoss ? bossTarget : rockTarget;
    const facts = Array.from({ length: isBoss ? BOSS_HITS : 1 }, () => feed.take());
    // One clock for the whole fight: a boss gets the time its questions would each have had.
    clockTotal = bossClockTotal(facts.map((f) => session.timerSecondsFor(f)));
    clockLeft = clockTotal;
    bossHp = isBoss ? BOSS_HITS : 0;
    bossFacts = facts.slice(1);
    lockZ = isBoss ? BOSS_LOCK_Z : LOCK_Z;
    hitZ = -(target.radius + 1.1);
    arriveFor = isBoss ? BOSS_ARRIVE_TIME : ARRIVE_TIME;
    arriveTime = 0;
    ram = null;
    targetAlive = true;
    other(target).object.visible = false;
    target.reset();
    target.setDamage(0);
    targetPos.set(shipPos.x, shipPos.y, TARGET_SPAWN_Z);
    target.object.position.copy(targetPos);
    renderBoss();
    askQuestion(facts[0], isBoss ? 1.5 : 0);
    if (isBoss) {
      showBanner('BOSS ASTEROID!', '', 'warn');
      sfx.alarm();
      after(1.8, () => turn === thisTurn && phase === 'aiming' && (banner.hidden = true));
    }
  };

  /** Shows a question with its four answers and reads it out; the clock waits for the reading. */
  const askQuestion = (next: Fact, readAfter = 0) => {
    pending = [];
    tapFlow.disarm();
    fact = next;
    banner.hidden = true;
    const thisTurn = ++turn;
    options = answerOptions(session.topic, next, buttons.length);
    chosen = -1;
    buttons.forEach((button, i) => {
      const text = options[i];
      button.textContent = text ?? '';
      button.setAttribute('aria-label', `Answer ${text ?? ''}`);
      button.removeAttribute('aria-disabled');
      button.className = 'ar-answer';
    });
    problemText.textContent = next.prompt;
    clockRunning = false;
    speechDone = false;
    phase = 'aiming';
    setHudVisible(true);
    setClock(clockLeft / clockTotal);
    // The clock starts once the question has been read out and the asteroid is locked.
    const read = () =>
      speak(next.spokenPrompt ?? next.prompt, () => {
        if (turn !== thisTurn || phase !== 'aiming') return;
        speechDone = true;
      });
    if (readAfter > 0) after(readAfter, read);
    else read();
  };

  /** The player picks an answer: the ship fires twin lasers at the asteroid. */
  const select = (index: number) => {
    if (phase !== 'aiming' || !fact || options[index] === undefined) return;
    try {
      unlockAudio();
      stopSpeaking();
    } catch {
      // Audio trouble must never stop the shot.
    }
    phase = 'firing';
    clockRunning = false;
    chosen = index;
    lockAnswers();
    buttons[index].classList.add('chosen');
    ship.muzzle(0, muzzleLeft);
    ship.muzzle(1, muzzleRight);
    sfx.laser();
    effects.fireBolts(muzzleLeft, muzzleRight, aim, LASER_TIME, () => {
      if (fact && options[chosen] === fact.answer) hit();
      else deflect();
    });
  };

  /** Points for a hit, with the streak multiplier, floating up from the asteroid. */
  const award = () => {
    streak = nextStreak(streak, true);
    const points = hitPoints(clockLeft, clockTotal, streak);
    const before = multiplierFor(streak - 1);
    score += points;
    renderScore();
    replay(scoreValue);
    const multiplier = multiplierFor(streak);
    pop(`+${points.toLocaleString()}`, toScreen(targetPos), 'good');
    if (multiplier > before) {
      pop(`×${multiplier} streak!`, { x: viewW / 2, y: viewH * 0.3 }, 'plain');
    }
  };

  /** A correct answer: the lasers strike. A normal asteroid blows up; a boss loses a segment. */
  const hit = () => {
    if (!fact) return;
    const current = fact;
    feed.recordHit(current);
    session.recordAnswer(current, true);
    buttons.forEach((button, i) => button.classList.add(i === chosen ? 'right' : 'gone'));
    award();
    const thisTurn = turn;
    if (isBoss && bossHp > 1) {
      bossHp--;
      renderBoss();
      target.setDamage(1 - bossHp / BOSS_HITS);
      effects.knockOff(aim, 1.6);
      sfx.boom();
      shake = Math.max(shake, 0.5);
      phase = 'result';
      resultAt = gameTime;
      pop('Direct hit!', { x: viewW / 2, y: viewH * 0.36 }, 'plain');
      after(1.2, () => {
        const next = bossFacts.shift();
        if (turn === thisTurn && phase === 'result' && next) askQuestion(next);
      });
      return;
    }
    // The asteroid, or the boss's last segment, is destroyed.
    bossHp = 0;
    renderBoss();
    destroyed++;
    targetAlive = false;
    target.object.visible = false;
    effects.explosion(targetPos, isBoss ? 3 : 1.4);
    sfx.boom();
    after(0.25, sfx.goal);
    shake = Math.max(shake, isBoss ? 0.9 : 0.5);
    phase = 'idle';
    setHudVisible(false);
    if (isBoss) {
      score += BOSS_BONUS;
      renderScore();
      replay(scoreValue);
      showBanner('Boss destroyed!', `+${BOSS_BONUS}`, 'hit');
      sfx.chime();
    }
    after(isBoss ? NEXT_GAP + 1 : NEXT_GAP, () => phase === 'idle' && spawnTarget());
  };

  /** A wrong answer: the lasers glance off, and the asteroid or boss hits back. */
  const deflect = () => {
    effects.ricochet(aim);
    sfx.fizz();
    resolveMiss('Deflected!');
    if (isBoss) {
      // The boss flings a chunk at the ship.
      debrisInAir = true;
      effects.throwDebris(
        targetPos,
        point.set(shipPos.x, shipPos.y, SHIP_Z),
        DEBRIS_TIME,
        landDebris,
      );
    } else {
      startRam();
    }
  };

  /** The thrown chunk reaches the ship. Does nothing a second time, so a tap can land it early. */
  const landDebris = () => {
    if (!debrisInAir) return;
    debrisInAir = false;
    effects.rockBurst(point.set(shipPos.x, shipPos.y, SHIP_Z - 0.5), 1.4);
    shieldHit();
  };

  const timeUp = () => {
    clockRunning = false;
    chosen = -1;
    lockAnswers();
    resolveMiss("Time's up!");
    startRam();
  };

  /** The asteroid lunges at the ship. */
  const startRam = () => {
    const remaining = 1 - approachProgress(clockLeft, clockTotal);
    ram = { t: 0, duration: 0.15 + 0.4 * remaining, from: targetPos.z };
    sfx.whoosh();
  };

  /** The ram lands: the asteroid or boss breaks apart on the shield. */
  const rammed = () => {
    ram = null;
    targetAlive = false;
    target.object.visible = false;
    effects.explosion(
      point.set(targetPos.x, targetPos.y, targetPos.z + target.radius * 0.5),
      isBoss ? 2.6 : 1.5,
    );
    shieldHit();
  };

  /** The ship takes a hit on the shields: flash, crack, shake, and one shield gone. */
  const shieldHit = () => {
    shields = loseShield(shields);
    streak = nextStreak(streak, false);
    renderShields(true);
    renderScore();
    ship.flashShield();
    sfx.shieldHit();
    shake = 1;
    replay(flash);
    replay(crack);
    if (outOfShields(shields)) endRun();
  };

  /**
   * Shows the right answer and reads the fact out; the game then waits for a tap on the green
   * answer (misses and time-outs).
   */
  const resolveMiss = (title: string) => {
    if (!fact) return;
    const current = fact;
    phase = 'result';
    resultAt = gameTime;
    if (isBoss && chosen >= 0 && targetAlive) {
      // A boss question answered wrongly comes round again once the others have been asked.
      feed.recordMiss(current, false);
      bossFacts.push(current);
    } else {
      if (isBoss) {
        // Out of time against a boss: the questions never reached go back for another day.
        feed.returnUnused(bossFacts);
        bossFacts = [];
      }
      feed.recordMiss(current);
    }
    session.recordAnswer(current, false);
    streak = nextStreak(streak, false);
    renderScore();
    buttons[options.indexOf(current.answer)]?.classList.add('right');
    if (chosen >= 0) buttons[chosen].classList.add('wrong');
    showBanner(title, current.statement, 'miss');
    sfx.miss();
    // Move on once the correct fact has been read out and shown for a bit.
    tapFlow.arm(buttons, options.indexOf(current.answer), [hud, banner]);
    const thisTurn = turn;
    after(0.6, () =>
      speak(current.spokenStatement ?? current.statement, () => {
        if (turn === thisTurn && phase === 'result') tapFlow.readFinished();
      }),
    );
  };

  /** After a reveal: the boss's next question, or the next asteroid. */
  const advance = () => {
    tapFlow.disarm();
    stopSpeaking();
    pending = [];
    const next = isBoss && targetAlive ? bossFacts.shift() : undefined;
    if (next) {
      banner.hidden = true;
      askQuestion(next);
      return;
    }
    phase = 'idle';
    setHudVisible(false);
    after(0.5, () => phase === 'idle' && spawnTarget());
  };

  /** Shields are gone: the ship blows up and the run is over. */
  const endRun = () => {
    const last = fact;
    phase = 'ending';
    pending = [];
    turn++;
    clockRunning = false;
    ram = null;
    ship.setVisible(false);
    effects.explosion(point.set(shipPos.x, shipPos.y, SHIP_Z), 2.6);
    sfx.boom();
    shake = 1.2;
    debrisInAir = false;
    tapFlow.disarm();
    if (!last) {
      // No fact to wait on: show the end at once.
      setHudVisible(false);
      showBanner(SHIP_DESTROYED_SPEECH, '', 'out');
      speak(SHIP_DESTROYED_SPEECH, () => phase === 'ending' && finishRun());
      return;
    }
    // The answers stay up: the player taps the green one before the results appear.
    showBanner(SHIP_DESTROYED_SPEECH, last.statement, 'out');
    tapFlow.arm(buttons, options.indexOf(last.answer), [hud, banner]);
    const thisTurn = turn;
    speak(SHIP_DESTROYED_SPEECH, () => {
      if (turn !== thisTurn || phase !== 'ending') return;
      speak(last.spokenStatement ?? last.statement, () => {
        if (turn === thisTurn && phase === 'ending') tapFlow.readFinished();
      });
    });
  };

  const finishRun = () => {
    phase = 'done';
    flightActive = false;
    setHudVisible(false);
    count.hidden = true;
    obstacles.clear();
    effects.clear();
    const stars = starsFor(feed.correct, feed.answered);
    session.recordStars(stars);
    const newHighScore = session.recordScore(score);
    renderScore();
    if (newHighScore) sfx.goal();
    speak(newHighScore ? NEW_HIGH_SCORE_SPEECH : GREAT_FLYING_SPEECH);
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
      playAgainLabel: 'Fly again 🚀',
      onPlayAgain: () => startRun(false),
    });
  };

  // ---------- Input ----------
  /** A tap after a boss's direct hit skips ahead to its next question. */
  const skip = () => {
    if (!tapFlow.armed && phase === 'result' && gameTime - resultAt >= HIT_SKIP) advance();
  };
  /** The player tapped the green answer: land what is still in flight, then move on. */
  const proceed = () => {
    if (phase === 'ending') {
      finishRun();
      return;
    }
    if (ram) rammed();
    landDebris();
    // If that took the last shield, `endRun` is waiting for its own tap.
    if (phase === 'result') advance();
  };
  const onAnswer = (index: number) => {
    if (tapFlow.armed) {
      if (tapFlow.tap(index)) proceed();
      return;
    }
    if (phase === 'aiming') select(index);
    else skip();
  };
  const unpress = buttons.map((button, i) => {
    // A touch press doesn't count as a user gesture for iOS audio; the release does.
    button.addEventListener('pointerup', unlockAudio);
    return onPress(button, () => onAnswer(i));
  });
  hear.addEventListener('click', () => {
    unlockAudio();
    if (fact) speak(fact.spokenPrompt ?? fact.prompt);
  });

  const canSteer = () =>
    phase === 'countdown' ||
    phase === 'idle' ||
    phase === 'aiming' ||
    phase === 'firing' ||
    phase === 'result';

  // Dragging anywhere on the screen works like a trackpad: the finger's movement moves the ship,
  // so the finger never covers it.
  const stopPointer = createPointerInput(ctx.renderer.domElement, {
    onDragStart: () => unlockAudio(),
    onDrag: ({ dx, dy }) => {
      if (!canSteer()) return;
      goal.x += dx * drag.x;
      goal.y -= dy * drag.y;
      clampToBox(goal, fit);
    },
    onTap: skip,
  });

  const keys = new Set<string>();
  const STEER_KEYS: Record<string, [number, number]> = {
    arrowleft: [-1, 0],
    a: [-1, 0],
    arrowright: [1, 0],
    d: [1, 0],
    arrowup: [0, 1],
    w: [0, 1],
    arrowdown: [0, -1],
    s: [0, -1],
  };
  // Keys 1-4 pick the answers from left to right; the arrow keys and WASD steer.
  const onKey = (e: KeyboardEvent) => {
    if (pause.isPaused) return;
    const key = e.key.toLowerCase();
    const index = Number(e.key) - 1;
    if (index >= 0 && index < buttons.length) {
      onAnswer(index);
    } else if (STEER_KEYS[key]) {
      keys.add(key);
      e.preventDefault();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
  const onBlur = () => keys.clear();
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  // ---------- Loop ----------
  const spawnCrystals = (delta: number) => {
    crystalIn -= delta;
    if (crystalIn <= 0) {
      crystalIn = crystalInterval(Math.random());
      obstacles.spawnCrystal(
        MathUtils.randFloatSpread(1.8 * fit.halfW),
        MathUtils.randFloatSpread(1.8 * fit.halfH),
      );
    }
  };

  /** Crystals the ship is touching, using the span they swept this frame. */
  const collide = (delta: number) => {
    const step = speed * delta;
    const touches = (object: { position: Vector3 }, radius: number) => {
      const z = object.position.z;
      if (z + radius < SHIP_Z - 1.3 || z - step - radius > SHIP_Z + 1) return false;
      const dx = object.position.x - shipPos.x;
      const dy = object.position.y - shipPos.y;
      return dx * dx + dy * dy <= (radius + SHIP_RADIUS + 0.1) ** 2;
    };
    for (const crystal of obstacles.crystals) {
      if (!crystal.active || !touches(crystal.object, CRYSTAL_RADIUS)) continue;
      obstacles.retire(crystal);
      score += CRYSTAL_POINTS;
      renderScore();
      replay(scoreValue);
      effects.sparkle(crystal.object.position);
      sfx.chime();
      pop(`+${CRYSTAL_POINTS}`, toScreen(crystal.object.position), 'good');
    }
  };

  /** Moves the target asteroid along its path for the current phase. */
  const moveTarget = (delta: number) => {
    arriveTime += delta;
    const arrived = arriveTime >= arriveFor;
    let z: number;
    let rate: number;
    if (ram) {
      ram.t += delta;
      z = ram.from + (hitZ - ram.from) * easeIn(ram.t / ram.duration);
      rate = 14;
    } else if (!arrived) {
      z = TARGET_SPAWN_Z + (lockZ - TARGET_SPAWN_Z) * easeOut(arriveTime / arriveFor);
      rate = 3;
    } else {
      const progress = approachProgress(clockLeft, clockTotal);
      z = approachZ(progress, lockZ, hitZ);
      rate = 2.2 + 9 * progress;
    }
    // It steers onto wherever the ship is, a little late, so it is always on a collision course.
    targetPos.x = easeToward(targetPos.x, shipPos.x, rate, delta);
    targetPos.y = easeToward(targetPos.y, shipPos.y, rate, delta);
    targetPos.z = z;
    target.object.position.copy(targetPos);
    target.setLock(arriveTime / arriveFor);
    aim.set(targetPos.x, targetPos.y, targetPos.z + target.radius * 0.8);
    if (ram && ram.t >= ram.duration) rammed();
  };

  /** Runs the clock once the question is read and the asteroid is locked on. */
  const runClock = (delta: number) => {
    if (!clockRunning && speechDone && arriveTime >= arriveFor) {
      clockRunning = true;
      lastTick = Math.ceil(clockLeft);
    }
    if (!clockRunning) return;
    clockLeft -= delta;
    setClock(clockLeft / clockTotal);
    target.setUrgent(clockLeft <= 3 || clockLeft / clockTotal < 0.3);
    const seconds = Math.ceil(clockLeft);
    if (seconds < lastTick && seconds > 0 && seconds <= 3) sfx.tick();
    lastTick = seconds;
    if (clockLeft <= 0) {
      clockLeft = 0;
      timeUp();
    }
  };

  ctx.onUpdate((delta, elapsed) => {
    layout();

    gameTime += delta;
    tapFlow.update(delta);
    const due = pending.filter((p) => p.at <= gameTime);
    if (due.length) {
      pending = pending.filter((p) => p.at > gameTime);
      due.forEach((p) => p.fn());
    }

    // --- Steering ---
    if (canSteer()) {
      let kx = 0;
      let ky = 0;
      for (const key of keys) {
        kx += STEER_KEYS[key][0];
        ky += STEER_KEYS[key][1];
      }
      goal.x += kx * fit.halfW * 1.8 * delta;
      goal.y += ky * fit.halfH * 1.8 * delta;
      clampToBox(goal, fit);
    }
    const lastX = shipPos.x;
    const lastY = shipPos.y;
    shipPos.x = easeToward(shipPos.x, goal.x, 7, delta);
    shipPos.y = easeToward(shipPos.y, goal.y, 7, delta);
    motion.vx = (shipPos.x - lastX) / Math.max(delta, 1e-4);
    motion.vy = (shipPos.y - lastY) / Math.max(delta, 1e-4);
    // Bank into sideways motion, pitch with vertical motion, and ease so quick drags don't snap.
    motion.bank = easeToward(motion.bank, MathUtils.clamp(-motion.vx * 0.075, -0.7, 0.7), 8, delta);
    motion.pitch = easeToward(motion.pitch, MathUtils.clamp(motion.vy * 0.06, -0.4, 0.4), 8, delta);
    motion.yaw = easeToward(motion.yaw, MathUtils.clamp(-motion.vx * 0.03, -0.3, 0.3), 8, delta);
    const bob = Math.sin(elapsed * 1.7) * 0.05;
    ship.object.position.set(shipPos.x, shipPos.y + bob, SHIP_Z);
    ship.object.rotation.set(
      motion.pitch,
      motion.yaw,
      motion.bank + Math.sin(elapsed * 1.3) * 0.02,
    );

    // --- World speed: faster with each asteroid destroyed, never touching the clock ---
    const speedFactor = worldSpeedFactor(destroyed);
    const goalSpeed = flightActive ? BASE_SPEED * speedFactor : IDLE_SPEED;
    speed = easeToward(speed, goalSpeed, 1.5, delta);

    // --- The target asteroid and its clock ---
    if (targetAlive) {
      moveTarget(delta);
      if (phase === 'aiming') runClock(delta);
    }

    // --- Crystals ---
    // While the game waits for the tap, nothing new appears and nothing can hit the ship.
    const hazards = flightActive && phase !== 'ending' && !tapFlow.armed;
    if (hazards) spawnCrystals(delta);
    obstacles.update(delta, speed, elapsed);
    if (hazards) collide(delta);

    ship.update(delta, elapsed, speed / BASE_SPEED, speed);
    rockTarget.update(delta, elapsed);
    bossTarget.update(delta, elapsed);
    effects.update(delta);
    backdrop.update(delta, speed, cam);

    // --- Chase camera: follows with damping, looks ahead, banks with the ship, shakes on impact ---
    cameraGoal(shipPos.x, shipPos.y, 7.2 + pullBack, want);
    cam.x = easeToward(cam.x, want.x, 5, delta);
    cam.y = easeToward(cam.y, want.y, 5, delta);
    cam.z = easeToward(cam.z, want.z, 3, delta);
    lookGoal(shipPos.x, shipPos.y, want);
    look.x = easeToward(look.x, want.x, 6, delta);
    look.y = easeToward(look.y, want.y, 6, delta);
    if (phase === 'ending') pullBack = easeToward(pullBack, PULL_BACK, 1.2, delta);
    shake = easeToward(shake, 0, 3.5, delta);
    camera.position.set(
      cam.x + Math.sin(elapsed * 61) * shake * 0.3,
      cam.y + Math.sin(elapsed * 73 + 1) * shake * 0.3,
      cam.z,
    );
    camera.lookAt(look);
    roll = easeToward(roll, motion.bank * 0.4, 4, delta);
    camera.rotateZ(roll + Math.sin(elapsed * 57) * shake * 0.01);
    const fov = baseFov + 9 * MathUtils.clamp((speed / BASE_SPEED - 0.25) / 1.35, 0, 1);
    if (Math.abs(camera.fov - fov) > 0.02) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
  });

  layout();
  setHudVisible(false);
  renderShields();
  renderScore();
  renderBoss();
  ctx.start();
  startRun(true);

  window.addEventListener('pagehide', () => {
    stopSpeaking();
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    stopPointer();
    tapFlow.dispose();
    unpress.forEach((fn) => fn());
    pause.dispose();
    mute.dispose();
    effects.clear();
    ctx.dispose();
  });
}

const session = startGameSession(GAME_ID);
if (session) run(session);
else location.replace(menuUrl());
