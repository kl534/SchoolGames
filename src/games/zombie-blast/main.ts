import './style.css';
import {
  CircleGeometry,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector2,
  Vector3,
} from 'three';
import { sfx, speak, stopSpeaking, unlockAudio } from '../../shared/audio';
import { createPointerInput, onPress } from '../../shared/input';
import { showPreview } from '../../shared/preview';
import { shuffle } from '../../shared/random';
import { showResults } from '../../shared/results';
import { createRound, starsFor, type Round } from '../../shared/round';
import { createScene } from '../../shared/scene';
import { startGameSession, type GameSession } from '../../shared/session';
import { answerOptions, type Fact } from '../../shared/topics';
import { createBackButton, createMuteButton, createPauseOverlay, menuUrl } from '../../shared/ui';
import { BOMB_RADIUS, createBomb } from './bomb';
import { createEffects } from './effects';
import { buildField, HORIZON_COLOR } from './field';
import {
  BARRICADE_Z,
  BREAK_Z,
  END_Z,
  fitView,
  CAMERA,
  LANES,
  laneX,
  layoutSigns,
  SPAWN_Z,
  START_Z,
  TARGET,
} from './layout';
import {
  approachZ,
  arcHeightFor,
  bombPosition,
  BRAINS,
  easeOut,
  loseBrain,
  outOfBrains,
  zombieProgress,
} from './rules';
import { createThrower } from './thrower';
import { createZombie, ZOMBIE_LOOKS, type Zombie } from './zombie';

const GAME_ID = 'zombie-blast';

/** The kid stands this far behind the barricade, nearer the camera. */
const KID_Z = 1.5;
/** Seconds a thrown bomb is in the air. */
const BOMB_TIME = 0.7;
/** Seconds the zombies take to shuffle out of the mist and reach the start line. */
const ARRIVE_TIME = 2.2;
/** How fast zombies flee back into the mist, in world units per second. */
const RUN_SPEED = 11;
/** Zombies that have run this far back are hidden in the mist. */
const GONE_Z = -23;
/** How fast zombies charge through the barricade, in world units per second. */
const CHARGE_SPEED = 7;
/** Longest random wait before a zombie joins the charge, in seconds. */
const CHARGE_STAGGER = 0.25;
/** Pause after the last zombie is through, before the next wave or the end banner. */
const BREAK_GAP = 0.9;

const SIGN_HEIGHT = 64;
const SIGN_GAP = 6;
/** Gap between the bottom of a sign and the top of the head it hangs over (the sign's tail). */
const SIGN_TAIL = 12;
/** Bottom of the play area; the brains and progress dots sit underneath. */
const STATUS_HEIGHT = 64;
/** Seconds a result stays up before a tap can skip to the next question. */
const SKIP_AFTER = 0.6;

type Phase = 'preview' | 'aiming' | 'throw' | 'result' | 'breaking' | 'ending' | 'done';

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

  const zombies = ZOMBIE_LOOKS.slice(0, LANES).map((look) => createZombie(look));
  zombies.forEach((z) => scene.add(z.object));
  /** Depth of each zombie along its walk. */
  const zs = zombies.map(() => SPAWN_Z);

  const effects = createEffects();
  scene.add(effects.object);

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
  const clockBar = el('div', 'zb-clock', hud);
  const clockFill = el('div', 'zb-clock-fill', clockBar);
  const status = el('div', 'zb-status', document.body);
  const brainsBar = el('div', 'zb-brains', status);
  const dotsBar = el('div', 'zb-dots', status);
  dotsBar.setAttribute('aria-hidden', 'true');
  const signs = zombies.map(() => {
    const button = el('button', 'zb-sign', document.body);
    button.type = 'button';
    return button;
  });
  const banner = el('div', 'zb-banner', document.body);
  banner.setAttribute('role', 'status');
  const bannerTitle = el('div', 'zb-banner-title', banner);
  const bannerDetail = el('div', 'zb-banner-detail', banner);
  banner.hidden = true;

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
  let round: Round = createRound([]);
  let fact: Fact | undefined;
  let options: string[] = [];
  let chosen = -1;
  let turn = 0;
  let brains = BRAINS;
  /** The question has been read out. */
  let speechDone = false;
  /** Seconds since this wave came out of the mist, and when each lane sets off. */
  let arriveTime = 0;
  let arriveDelay = [0, 0.12, 0.25, 0.37];
  let clockLeft = 0;
  /** Seconds this question started with, for the bar's fill and the zombies' pace. */
  let clockTotal = 1;
  let clockRunning = false;
  let lastTick = 0;
  /** Game time at which the current result was shown. */
  let resultAt = 0;
  /** The other zombies have already run off, so the next wave can follow straight away. */
  let survivorsGone = false;
  /** Per zombie while the barricade is being smashed: seconds until it sets off, and its progress. */
  const charge = zombies.map(() => ({ delay: 0, smashed: false, through: false }));
  let breakQueued = false;
  let flight: { from: Vector3; to: Vector3; t: number; arc: number } | null = null;

  // Delayed actions run on game time so pausing freezes them too.
  let gameTime = 0;
  let pending: { at: number; fn: () => void }[] = [];
  const after = (seconds: number, fn: () => void) => pending.push({ at: gameTime + seconds, fn });

  /**
   * Dims the signs while a throw plays out. They are not `disabled`, so a tap in that window
   * still reaches `onSignTap` instead of being swallowed.
   */
  const lockAnswers = () => signs.forEach((b) => b.setAttribute('aria-disabled', 'true'));

  const setPlayVisible = (visible: boolean) => {
    hud.hidden = !visible;
    status.hidden = !visible;
    signs.forEach((b, i) => (b.hidden = !visible || options[i] === undefined));
    if (!visible) banner.hidden = true;
  };

  // ---------- Layout ----------
  let viewW = 0;
  let viewH = 0;
  let lane = fitView(1).lane;
  const point = new Vector3();

  /** Fits the lanes to the screen, for any aspect ratio. */
  const layout = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === viewW && h === viewH) return;
    viewW = w;
    viewH = h;
    const aspect = w / Math.max(h, 1);
    const fit = fitView(aspect);
    lane = fit.lane;
    field.layout(lane);
    camera.fov = fit.fov;
    camera.aspect = aspect;
    camera.position.copy(CAMERA);
    camera.lookAt(TARGET);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  };

  const toScreen = (world: Vector3) => {
    const p = world.clone().project(camera);
    return { x: ((p.x + 1) / 2) * viewW, y: ((1 - p.y) / 2) * viewH };
  };

  /** Hangs each answer sign over its zombie's head without overlapping the others or the HUD. */
  const positionSigns = () => {
    if (!viewW) return;
    const top = hud.hidden ? 80 : hud.getBoundingClientRect().bottom + 8;
    const wishes = signs.map((button, i) => {
      const p = toScreen(zombies[i].signAnchor(point));
      return { x: p.x, y: p.y - SIGN_TAIL - SIGN_HEIGHT / 2, w: button.offsetWidth || 72 };
    });
    const placed = layoutSigns(wishes, SIGN_HEIGHT, SIGN_GAP, {
      left: 8,
      right: viewW - 8,
      top,
      bottom: viewH - STATUS_HEIGHT,
    });
    signs.forEach((button, i) => {
      const { x, y } = placed[i];
      button.style.transform = `translate(${x - wishes[i].w / 2}px, ${y - SIGN_HEIGHT / 2}px)`;
      // Signs fade in as their zombies come out of the mist.
      button.style.setProperty('--fade', String(MathUtils.clamp((zs[i] - SPAWN_Z - 3) / 7, 0, 1)));
    });
  };

  // ---------- HUD helpers ----------
  const renderDots = () => {
    const dots = Array.from({ length: round.length }, (_, i) => {
      const dot = document.createElement('span');
      const result = round.results[i];
      dot.className = `zb-dot${result === true ? ' hit' : result === false ? ' miss' : ''}`;
      if (i === round.played && phase === 'aiming') dot.classList.add('current');
      return dot;
    });
    dotsBar.replaceChildren(...dots);
  };

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

  const setClock = (fraction: number) => {
    const f = MathUtils.clamp(fraction, 0, 1);
    clockFill.style.transform = `scaleX(${f})`;
    clockBar.classList.toggle('urgent', f < 0.4);
  };

  /**
   * Centres the banner on the barricade (zombies still at the start line) or on the kid (zombies
   * crowding the barricade), so it never covers the zombies or their signs.
   */
  const showBanner = (
    title: string,
    detail: string,
    kind: 'hit' | 'miss' | 'out',
    place: 'barricade' | 'kid' = 'barricade',
  ) => {
    bannerTitle.textContent = title;
    bannerDetail.textContent = detail;
    bannerDetail.hidden = !detail;
    banner.className = `zb-banner ${kind}`;
    banner.hidden = false;
    const anchor = place === 'kid' ? point.set(0, 0.6, KID_Z) : point.set(0, 0.2, BARRICADE_Z);
    const half = banner.offsetHeight / 2;
    const top = hud.hidden ? 0 : hud.getBoundingClientRect().bottom + 8;
    const centre = toScreen(anchor).y + (place === 'kid' ? 0 : 36);
    const lowest = viewH - STATUS_HEIGHT - 4 - half;
    banner.style.top = `${Math.min(Math.max(centre, top + half), Math.max(lowest, top + half))}px`;
  };

  // ---------- Round flow ----------
  const startRound = () => {
    field.repairFence();
    const facts = session.chooseFacts();
    round = createRound(facts);
    phase = 'preview';
    options = [];
    brains = BRAINS;
    renderBrains();
    setPlayVisible(false);
    effects.clear();
    thrower.reset();
    showPreview({
      topic: session.topic,
      facts,
      onDone: () => {
        setPlayVisible(true);
        startTurn();
      },
    });
  };

  const startTurn = () => {
    pending = [];
    field.repairFence();
    fact = round.current();
    if (!fact) {
      finishRound();
      return;
    }
    const current = fact;
    const thisTurn = ++turn;
    options = answerOptions(session.topic, current, LANES);
    chosen = -1;
    flight = null;
    survivorsGone = false;
    flyingBomb.object.visible = false;
    bombShadow.visible = false;
    effects.clear();
    thrower.reset();
    arriveTime = 0;
    arriveDelay = shuffle([0, 0.12, 0.25, 0.37]);
    speechDone = false;
    zombies.forEach((zombie, i) => {
      zombie.reset();
      zombie.setMode('walk');
      zombie.object.visible = options[i] !== undefined;
      zs[i] = SPAWN_Z;
    });
    signs.forEach((button, i) => {
      const text = options[i];
      button.hidden = text === undefined;
      button.textContent = text ?? '';
      button.setAttribute('aria-label', `Answer ${text ?? ''}`);
      button.removeAttribute('aria-disabled');
      button.className = 'zb-sign';
    });
    problemText.textContent = current.prompt;
    banner.hidden = true;
    phase = 'aiming';
    renderDots();
    clockRunning = false;
    setClock(1);
    positionSigns();
    sfx.groan();

    // The clock starts once the question has been read out and the zombies are in place.
    speak(current.spokenPrompt ?? current.prompt, () => {
      if (turn !== thisTurn || phase !== 'aiming') return;
      speechDone = true;
    });
  };

  /** Throw at the sign's zombie: all the zombies freeze, the kid winds up and lets fly. */
  const select = (index: number) => {
    if (phase !== 'aiming' || !fact || options[index] === undefined) return;
    try {
      unlockAudio();
      stopSpeaking();
    } catch {
      // Audio trouble must never stop the throw.
    }
    phase = 'throw';
    clockRunning = false;
    chosen = index;
    lockAnswers();
    signs[index].classList.add('chosen');
    renderDots();
    zombies.forEach((zombie) => zombie.setMode('freeze'));
    thrower.throwBomb(() => {
      const from = thrower.handPosition(new Vector3());
      const to = zombies[index].feetPosition(new Vector3());
      flight = { from, to, t: 0, arc: arcHeightFor(from.distanceTo(to)) };
      flyingBomb.object.visible = true;
      bombShadow.visible = true;
      sfx.whoosh();
    });
  };

  /** Brain lost: update the bar and let the brain fly off. */
  const hurt = () => {
    brains = loseBrain(brains);
    renderBrains(true);
  };

  /** Shows the right answer and reads the fact out before moving on (misses and time-outs). */
  const resolveMiss = (title: string, place: 'barricade' | 'kid' = 'barricade') => {
    if (!fact) return;
    const current = fact;
    phase = 'result';
    resultAt = gameTime;
    round.record(false);
    session.recordAnswer(current, false);
    renderDots();
    hurt();
    signs[options.indexOf(current.answer)]?.classList.add('right');
    if (chosen >= 0) signs[chosen].classList.add('wrong');
    showBanner(title, current.statement, 'miss', place);
    sfx.miss();
    // Move on once the correct fact has been read out and shown for a bit.
    const thisTurn = turn;
    let spoken = false;
    let shown = false;
    const next = () => {
      if (spoken && shown && turn === thisTurn && phase === 'result') advance();
    };
    after(0.6, () =>
      speak(current.spokenStatement ?? current.statement, () => {
        spoken = true;
        next();
      }),
    );
    after(2.6, () => {
      shown = true;
      next();
    });
  };

  const hit = () => {
    if (!fact) return;
    const current = fact;
    phase = 'result';
    resultAt = gameTime;
    round.record(true);
    session.recordAnswer(current, true);
    renderDots();
    signs.forEach((button, i) => button.classList.add(i === chosen ? 'right' : 'gone'));
    zombies.forEach((zombie, i) => zombie.setMode(i === chosen ? 'blast' : 'run'));
    survivorsGone = true;
    thrower.react('cheer');
    showBanner('BOOM!', '', 'hit');
    sfx.boom();
    after(0.3, sfx.goal);
    // The knocked-out zombie vanishes in a puff, then the next wave comes.
    const thisTurn = turn;
    const victim = zombies[chosen];
    after(1.9, () => {
      if (turn !== thisTurn) return;
      effects.poof(victim.object.position);
      victim.object.visible = false;
      signs[chosen].classList.add('gone');
    });
    after(2.5, () => turn === thisTurn && phase === 'result' && startTurn());
  };

  const dud = () => {
    thrower.react('cower');
    zombies[chosen].setMode('laugh');
    sfx.fizz();
    resolveMiss('Dud!');
  };

  const timeUp = () => {
    phase = 'result';
    clockRunning = false;
    chosen = -1;
    lockAnswers();
    renderDots();
    zombies.forEach((zombie) => zombie.setMode('lean'));
    thrower.react('cower');
    sfx.groan();
    resolveMiss("Time's up!", 'kid');
  };

  /** Lands the bomb: BOOM on the right zombie, a fizzle on a wrong one. */
  const land = (at: Vector3) => {
    flight = null;
    flyingBomb.object.visible = false;
    bombShadow.visible = false;
    if (fact && options[chosen] === fact.answer) {
      effects.boom(at);
      hit();
    } else {
      effects.fizzle(at);
      dud();
    }
  };

  /** After a result: on to the next wave, or the end if the brains have run out. */
  const advance = () => {
    stopSpeaking();
    pending = [];
    if (survivorsGone) {
      startTurn();
      return;
    }
    // A miss: the zombies charge and smash through the barricade.
    phase = 'breaking';
    breakQueued = false;
    banner.hidden = true;
    signs.forEach((button) => button.classList.add('gone'));
    thrower.react('cower');
    zombies.forEach((_, i) => {
      charge[i].delay = Math.random() * CHARGE_STAGGER;
      charge[i].smashed = false;
      charge[i].through = false;
    });
  };

  /** The zombies are through the barricade: on to the next wave, or the end if brains ran out. */
  const afterBreak = () => {
    if (outOfBrains(brains)) endRound();
    else startTurn();
  };

  /** The zombies swarm the barricade, the kid is out of brains, and the round is over. */
  const endRound = () => {
    phase = 'ending';
    signs.forEach((button) => button.classList.add('gone'));
    showBanner('The zombies got your brains!', '', 'out', 'kid');
    // Zombies already through the barricade stay where they are.
    zombies.forEach((zombie, i) => {
      if (zombie.object.visible && zs[i] < END_Z) zombie.setMode('walk');
    });
    thrower.react('cower');
    const thisTurn = turn;
    let spoken = false;
    let shown = false;
    const next = () => {
      if (spoken && shown && turn === thisTurn && phase === 'ending') finishRound();
    };
    speak('The zombies got your brains!', () => {
      spoken = true;
      next();
    });
    after(2.2, () => {
      shown = true;
      next();
    });
  };

  const finishRound = () => {
    phase = 'done';
    setPlayVisible(false);
    effects.clear();
    thrower.reset();
    const stars = starsFor(round.correct, round.length);
    const newBest = session.recordStars(stars);
    if (stars === 3) sfx.goal();
    speak(`You scored ${round.correct} out of ${round.length}!`);
    showResults({
      topicId: session.topic.id,
      correct: round.correct,
      total: round.length,
      stars,
      newBest,
      missed: round.missed(),
      playerName: session.player?.name,
      onPlayAgain: startRound,
    });
  };

  // ---------- Input ----------
  /** A tap while a result is showing skips ahead, so it never feels ignored. */
  const onSignTap = (index: number) => {
    if (phase === 'aiming') select(index);
    else skip();
  };
  const skip = () => {
    if (phase === 'result' && gameTime - resultAt >= SKIP_AFTER) advance();
  };
  signs.forEach((button, i) => {
    onPress(button, () => onSignTap(i));
    // A touch press doesn't count as a user gesture for iOS audio; the release does.
    button.addEventListener('pointerup', unlockAudio);
  });
  hear.addEventListener('click', () => {
    unlockAudio();
    if (fact) speak(fact.spokenPrompt ?? fact.prompt);
  });

  // Tapping a zombie itself picks its answer too.
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const zombieAt = (clientX: number, clientY: number): number => {
    const rect = container.getBoundingClientRect();
    pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    );
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(
      zombies.filter((z) => z.object.visible).map((z) => z.hitbox),
      false,
    );
    return hits.length ? zombies.findIndex((z) => z.hitbox === hits[0].object) : -1;
  };
  const stopPointer = createPointerInput(ctx.renderer.domElement, {
    // Act on the press, not the release: a tap that slides a little is still a tap.
    onDragStart: ({ x, y }) => {
      unlockAudio();
      if (phase === 'aiming') {
        const index = zombieAt(x, y);
        if (index >= 0) select(index);
      } else {
        skip();
      }
    },
  });

  // Keys 1-4 pick the zombies from left to right.
  const onKey = (e: KeyboardEvent) => {
    const index = Number(e.key) - 1;
    if (!pause.isPaused && index >= 0 && index < LANES) select(index);
  };
  window.addEventListener('keydown', onKey);

  // ---------- Loop ----------
  /**
   * Runs one zombie at the kid after a miss: it smashes the barricade as it reaches it, carries on
   * through, then waves its arms. Once the last one is through, a short pause leads to what's next.
   */
  const chargeThrough = (zombie: Zombie, i: number, delta: number) => {
    const c = charge[i];
    if (c.through) return;
    if (c.delay > 0) {
      c.delay -= delta;
      return;
    }
    zombie.setMode('charge');
    zs[i] = Math.min(zs[i] + CHARGE_SPEED * delta, BREAK_Z);
    if (!c.smashed && zs[i] >= END_Z) {
      c.smashed = true;
      field.smashFence(laneX(i, BARRICADE_Z, lane));
      sfx.crash();
    }
    if (zs[i] < BREAK_Z) return;
    c.through = true;
    zombie.setMode('lean');
    const allThrough = zombies.every((z, j) => !z.object.visible || charge[j].through);
    if (allThrough && !breakQueued) {
      breakQueued = true;
      const thisTurn = turn;
      after(BREAK_GAP, () => turn === thisTurn && phase === 'breaking' && afterBreak());
    }
  };

  /** Moves each zombie along its path for the current phase and picks its animation. */
  const moveZombies = (delta: number) => {
    const arriving = phase === 'aiming' && arriveTime < ARRIVE_TIME;
    zombies.forEach((zombie, i) => {
      if (phase === 'aiming') {
        if (clockRunning) {
          zs[i] = approachZ(zombieProgress(clockLeft, clockTotal), START_Z, END_Z);
          zombie.setMode('walk');
        } else if (arriving) {
          const span = ARRIVE_TIME - Math.max(...arriveDelay);
          const k = MathUtils.clamp((arriveTime - arriveDelay[i]) / span, 0, 1);
          zs[i] = SPAWN_Z + (START_Z - SPAWN_Z) * easeOut(k);
          zombie.setMode(k < 1 ? 'walk' : 'sway');
        } else {
          zs[i] = START_Z;
          zombie.setMode('sway');
        }
      } else if (phase === 'breaking') {
        if (zombie.object.visible) chargeThrough(zombie, i, delta);
      } else if (zombie.mode === 'run') {
        zs[i] = Math.max(zs[i] - RUN_SPEED * delta, SPAWN_Z - 8);
        if (zs[i] <= GONE_Z) zombie.object.visible = false;
      } else if (phase === 'ending' && zombie.object.visible && zs[i] < END_Z) {
        zs[i] = Math.min(zs[i] + 4 * delta, END_Z);
        zombie.setMode(zs[i] >= END_Z ? 'lean' : 'walk');
      }
      zombie.object.position.set(laneX(i, zs[i], lane), 0, zs[i]);
      zombie.update(delta);
    });
  };

  ctx.onUpdate((delta, elapsed) => {
    layout();

    gameTime += delta;
    const due = pending.filter((p) => p.at <= gameTime);
    if (due.length) {
      pending = pending.filter((p) => p.at > gameTime);
      due.forEach((p) => p.fn());
    }

    if (phase === 'aiming') {
      arriveTime += delta;
      if (!clockRunning && speechDone && arriveTime >= ARRIVE_TIME && fact) {
        clockTotal = session.timerSecondsFor(fact);
        clockLeft = clockTotal;
        lastTick = Math.ceil(clockLeft);
        clockRunning = true;
      }
      if (clockRunning) {
        clockLeft -= delta;
        setClock(clockLeft / clockTotal);
        const seconds = Math.ceil(clockLeft);
        if (seconds < lastTick && seconds > 0 && seconds <= 3) sfx.tick();
        lastTick = seconds;
        if (clockLeft <= 0) {
          clockLeft = 0;
          zs.fill(END_Z);
          timeUp();
        }
      }
    }

    moveZombies(delta);
    thrower.update(delta, elapsed);
    effects.update(delta);
    field.update(elapsed, delta);

    if (flight) {
      flight.t += delta;
      const p = bombPosition(flight.from, flight.to, flight.t, BOMB_TIME, flight.arc);
      flyingBomb.object.position.set(p.x, p.y, p.z);
      flyingBomb.object.rotation.x = -flight.t * 14;
      flyingBomb.update(elapsed);
      bombShadow.position.set(p.x, 0.02, p.z);
      bombShadow.scale.setScalar(Math.max(0.4, 1 - p.y * 0.12));
      if (flight.t >= BOMB_TIME) land(flight.to.clone());
    }

    positionSigns();
  });

  layout();
  setPlayVisible(false);
  renderBrains();
  ctx.start();
  startRound();

  window.addEventListener('pagehide', () => {
    stopSpeaking();
    window.removeEventListener('keydown', onKey);
    stopPointer();
    pause.dispose();
    mute.dispose();
    effects.clear();
    ctx.dispose();
  });
}

const session = startGameSession(GAME_ID);
if (session) run(session);
else location.replace(menuUrl());
