import './style.css';
import {
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  ConeGeometry,
  Vector3,
} from 'three';
import { pressAnswers } from '../../shared/answers';
import { preloadCatSounds, sfx, speak, stopSpeaking, unlockAudio } from '../../shared/audio';
import { createFactFeed, type FactFeed } from '../../shared/feed';
import { createPointerInput } from '../../shared/input';
import { hideFactMap, showFactMap } from '../../shared/maps';
import { getSetting, setSetting } from '../../shared/progress';
import { showPreview } from '../../shared/preview';
import { showResults } from '../../shared/results';
import { starsFor } from '../../shared/round';
import { createScene } from '../../shared/scene';
import { startGameSession, type GameSession } from '../../shared/session';
import { createTapFlow } from '../../shared/tapflow';
import { createTimers } from '../../shared/timers';
import { answerOptions, promptSpeech, type Fact } from '../../shared/topics';
import { createBackButton, createMuteButton, createPauseOverlay, menuUrl } from '../../shared/ui';
import { createCat, type Cat } from './cat';
import { devOptions, type DevOptions } from './dev';
import { createDoorway, DOOR_Z, type Doorway } from './door';
import { createEffects, type EffectKind } from './effects';
import { createHud, type DotState } from './hud';
import { CAT_LOOKS, CAT_SETTING, savedCat, type CatId } from './looks';
import { CAT_COL, FOV, fitView, playBand, riseFor, type Fit } from './layout';
import type { Prop } from './kit';
import {
  MOVE_SPECS,
  MOVE_WORDS,
  createFrame,
  moveDuration,
  moveEvents,
  moveFrame,
  type CatFrame,
  type MoveEvent,
} from './moves';
import {
  PLACES,
  PLACE_IDS,
  doorOf,
  placeOf,
  type ObstacleId,
  type Place,
  type PlaceId,
} from './places';
import { showCatPicker, type CatPicker } from './picker';
import { createPropPool } from './props/pool';
import {
  FIRST_PLACE,
  FISH_ARC,
  FISH_GAP,
  fishPoints,
  FISH_Y,
  GREAT_RUNNING_SPEECH,
  LIVES,
  NEW_HIGH_SCORE_SPEECH,
  OUT_OF_LIVES_SPEECH,
  RUN_SPEED,
  VISIT_LENGTH,
  approach,
  approachProgress,
  easeToward,
  fishTrailLength,
  leapLift,
  hitPoints,
  loseLife,
  multiplierFor,
  nextPlace,
  nextStreak,
  outOfLives,
  sprintSpeed,
  visitPlan,
  type Outcome,
  type Variant,
} from './rules';
import { createLook } from './render';
import {
  QUALITY_KEY,
  QUALITY_SETTINGS,
  createGovernor,
  initialQuality,
  type Quality,
} from './quality';
import { createWorld } from './world';

const GAME_ID = 'cat-dash';

/** Seconds a move runs before a tap can fast-forward it. */
const FAST_FORWARD_AFTER = 0.6;
/** Seconds each step of the 3, 2, 1, Go! lasts. */
const COUNT_STEP = 0.75;
/** How fast a move plays after a tap. */
const FAST_FORWARD = 3;
/** The iris wipe, closing and opening (s). */
const IRIS_TIME = 0.35;
/** The banner with the place name. */
const PLACE_BANNER = 1.5;
/** The most the next question waits for the place name to be read. */
const PLACE_WAIT = 1.6;

type Phase =
  | 'picker'
  | 'preview'
  | 'countdown'
  | 'riding'
  | 'sprint'
  | 'move'
  | 'result'
  | 'door'
  | 'ending'
  | 'done';

interface Move {
  obstacle: ObstacleId;
  outcome: Outcome;
  variant: Variant;
  t: number;
  duration: number;
  events: MoveEvent[];
  next: number;
  scale: number;
  length: number;
  prop: Prop;
}

const EFFECT_KINDS: readonly string[] = [
  'dust',
  'splash',
  'stars',
  'poof',
  'bubbles',
  'feathers',
  'sparkle',
  'confetti',
];

/** The door timeline (s): the cat runs to the door, the iris closes, the place swaps, it opens. */
interface DoorPlan {
  runTime: number;
  /** Where the cat is when it starts, and where the doorway stands. */
  fromX: number;
  doorX: number;
}

function run(session: GameSession, dev: DevOptions | null): void {
  const container = document.getElementById('game');
  if (!container) throw new Error('Missing #game container');

  const lab = dev?.lab ?? null;
  const doorLab = dev?.door ?? null;
  const playerId = session.player?.id ?? null;
  let catId: CatId = dev?.cat ?? savedCat(getSetting(CAT_SETTING(playerId)));

  // ---------- Scene ----------
  const ctx = createScene(container, { fov: FOV, near: 5, far: 400 });
  const { scene, camera } = ctx;
  const world = createWorld(scene);
  const effects = createEffects();
  scene.add(effects.object);
  const props = createPropPool();
  const cat: Cat = createCat(CAT_LOOKS[catId]);
  scene.add(cat.object);

  // Quality tier: the saved one or one from the device's hints; it steps down when frames are slow.
  const look = createLook(ctx, world);
  const readSavedQuality = () => {
    try {
      return localStorage.getItem(QUALITY_KEY);
    } catch {
      return null;
    }
  };
  const hints = navigator as Navigator & { deviceMemory?: number };
  let quality: Quality =
    dev?.quality ??
    initialQuality({
      saved: readSavedQuality(),
      cores: hints.hardwareConcurrency,
      memoryGb: hints.deviceMemory,
    });
  const applyQuality = (q: Quality) => {
    quality = q;
    look.setQuality(q);
    cat.outline.setVisible(QUALITY_SETTINGS[q].outlines);
    world.setShadows(QUALITY_SETTINGS[q].decorShadows);
  };
  applyQuality(quality);
  const governor = !dev?.quality && !lab && !doorLab ? createGovernor(quality) : null;

  // Fish treats on the straights: small orange fish with a blue tail.
  const fishBody = new SphereGeometry(0.28, 12, 8);
  const fishTail = new ConeGeometry(0.2, 0.34, 6);
  const fishMaterial = new MeshStandardMaterial({ color: 0xff9f1c, roughness: 0.4 });
  const tailMaterial = new MeshStandardMaterial({ color: 0x3f8fd8, roughness: 0.4 });
  const CAT_CHEST = 1.0;
  const fish = Array.from({ length: 16 }, () => {
    const group = new Group();
    const body = new Mesh(fishBody, fishMaterial);
    body.scale.set(1.4, 0.8, 0.6);
    const tail = new Mesh(fishTail, tailMaterial);
    tail.position.x = -0.42;
    tail.rotation.z = Math.PI / 2;
    group.add(body, tail);
    group.visible = false;
    scene.add(group);
    return group;
  });

  // ---------- HUD ----------
  const hud = createHud(catId);
  const { buttons } = hud;
  const tapFlow = createTapFlow();
  if (lab || doorLab) document.body.classList.add('cd-lab');
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
  let phase: Phase = 'picker';
  let feed: FactFeed = createFactFeed(() => session.chooseFacts());
  let fact: Fact | undefined;
  let options: string[] = [];
  let chosen = -1;
  let score = 0;
  let streak = 0;
  let lives = dev?.lives ?? LIVES;
  /** Ticks up for each question, so late callbacks can tell they are stale. */
  let turn = 0;
  let gameTime = 0;
  const timers = createTimers();
  const after = timers.after;
  let bannerUntil = 0;

  // The place and the visit.
  let place: Place = PLACES[0];
  let nextId: PlaceId = PLACES[0].id;
  let visited = new Set<PlaceId>();
  let plan: { obstacle: ObstacleId; variant: Variant }[] = [];
  let planIndex = 0;
  let dots: DotState[] = [];
  let devPlaceIndex = 0;

  // The question and its approach.
  let obstacle: ObstacleId = 'couch';
  let variant: Variant = 0;
  let prop: Prop | null = null;
  const live: { item: Prop; id: ObstacleId; originX: number }[] = [];
  let originX = 0;
  let approachGap = 0;
  let approachStart = 0;
  let runSpeedGoal = RUN_SPEED;
  let startSpeed = 0;
  let clockLeft = 0;
  let clockTotal = 1;
  let clockRunning = false;
  let obstaclePlaced = false;
  let lastTick = 0;
  let pendingPoints = 0;
  let move: Move | null = null;
  let timedOut = false;
  /** The miss has been shown: the game waits for the tap on the green answer. */
  let revealed = false;
  let trailDue = false;
  /** Fish caught from the current trail; each one is worth more than the last. */
  let trailCaught = 0;

  // The cat.
  let catX = 0;
  let speed = 0;
  let camX = 0;
  let shake = 0;
  const focus = { x: 0, y: 0 };
  let camPan = 0;
  let panGoal = 0;
  const frame: CatFrame = createFrame();
  const point = new Vector3();

  // The doorway between places.
  let doorway: Doorway | null = null;
  let doorPlan: DoorPlan | null = null;
  let doorT = 0;
  let doorSwapped = false;
  let doorIntroduced = false;
  let doorFrozen = false;

  // ---------- Layout ----------
  let viewW = 0;
  let viewH = 0;
  let fit: Fit = fitView(390, 844);
  const layout = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === viewW && h === viewH) return;
    viewW = w;
    viewH = h;
    fit = fitView(w, h);
    camera.aspect = w / Math.max(h, 1);
    camera.fov = FOV;
    camera.updateProjectionMatrix();
  };

  const toScreen = (x: number, y: number) => {
    const p = point.set(x, y, 0).project(camera);
    const band = playBand(viewW, viewH);
    return {
      x: MathUtils.clamp(((p.x + 1) / 2) * viewW, 60, viewW - 60),
      y: MathUtils.clamp(((1 - p.y) / 2) * viewH, band.top + 24, band.bottom - 24),
    };
  };

  // ---------- Helpers ----------
  const play = (name: string) => {
    const fn = (sfx as unknown as Record<string, unknown>)[name];
    if (typeof fn === 'function') (fn as () => void)();
  };

  const retireFar = () => {
    for (let i = live.length - 1; i >= 0; i--) {
      const { item, id, originX: x } = live[i];
      if (item === prop) continue;
      if (camX - (x + MOVE_SPECS[id].length) > fit.viewW + 20) {
        item.object.visible = false;
        live.splice(i, 1);
      }
    }
  };

  /** Adds an obstacle to the floor at `x`, ready to be run to. */
  const putOnFloor = (id: ObstacleId, x: number) => {
    const item = props.get(id);
    item.reset();
    item.object.position.set(x, 0, 0);
    if (item.object.parent !== scene) scene.add(item.object);
    item.object.visible = true;
    const existing = live.find((l) => l.item === item);
    if (existing) existing.originX = x;
    else live.push({ item, id, originX: x });
    prop = item;
    return item;
  };

  const hideAllProps = () => {
    for (const l of live) l.item.object.visible = false;
    live.length = 0;
    prop = null;
  };

  const placeTarget = (gap: number) => {
    obstaclePlaced = true;
    approachGap = gap;
    approachStart = catX;
    originX = catX + gap;
    putOnFloor(obstacle, originX);
  };

  const setScoreHud = (pulse = false) =>
    hud.setScore(score, streak, Math.max(session.highScore(), 0), pulse);

  const awardPoints = (at: { x: number; y: number }) => {
    if (pendingPoints <= 0) return;
    const multiplier = multiplierFor(streak);
    const before = multiplierFor(streak - 1);
    score += pendingPoints;
    hud.pop(`+${pendingPoints.toLocaleString()}`, at, 'good');
    if (multiplier > before) {
      hud.pop(`×${multiplier} streak!`, { x: viewW / 2, y: viewH * 0.4 }, 'plain');
    }
    pendingPoints = 0;
    setScoreHud(true);
  };

  const showTimedBanner = (
    title: string,
    detail: string,
    kind: 'hit' | 'miss' | 'place' | 'out',
    s: number,
  ) => {
    hud.showBanner(title, detail, kind);
    bannerUntil = gameTime + s;
  };

  const catScreen = (dy = 1) => toScreen(focus.x, focus.y + dy);

  // ---------- Posing the cat ----------
  const applyFrame = (f: CatFrame, x0: number, dt: number) => {
    cat.apply(f, x0, dt);
    focus.x = x0 + f.x;
    focus.y = f.y;
  };

  /** The cat on the floor at `x`, in `pose`. */
  const catAt = (x: number, pose: CatFrame['pose'], dt: number, y = 0) => {
    frame.x = x;
    frame.y = y;
    frame.rot = 0;
    frame.z = 0;
    frame.sx = frame.sy = 1;
    frame.pose = pose;
    frame.face = 'happy';
    frame.coat = 'none';
    frame.hat = 'none';
    frame.visible = true;
    applyFrame(frame, 0, dt);
  };

  // ---------- Places ----------
  const showPlaceScenery = (p: Place) => {
    place = p;
    world.setPlace(p);
    look.setPlace(p);
    // Keep the props of this place and of the next, drop the rest.
    props.prune(PLACES.filter((q) => q.id === p.id || q.id === nextId).flatMap((q) => q.obstacles));
  };

  /** Picks the place the next visit goes to (the dev hooks can fix the order). */
  const chooseNext = () => {
    if (dev && dev.places.length > 0) {
      nextId = dev.places[devPlaceIndex++ % dev.places.length];
    } else {
      const fresh = PLACE_IDS.filter((p) => p !== place.id && !visited.has(p));
      nextId = nextPlace(PLACE_IDS, visited, place.id, Math.random());
      if (fresh.length === 0) visited = new Set<PlaceId>();
      visited.add(nextId);
    }
    hud.setPlace(place.name, doorOf(placeById(nextId)));
  };

  const placeById = (id: PlaceId): Place => PLACES.find((p) => p.id === id) ?? PLACES[0];

  /** Six obstacles for a visit to `place`: each of its three twice. */
  const newVisit = () => {
    plan = dev?.obstacle
      ? [0, 0, 0, 1, 1, 1].map((v) => ({
          obstacle: dev.obstacle as ObstacleId,
          variant: v as Variant,
        }))
      : visitPlan(place.obstacles, Math.random(), Math.random());
    planIndex = 0;
    dots = [];
    hud.setDots(dots, 0);
    chooseNext();
  };

  /** The banner and the spoken name of a place; `then` runs after the line or PLACE_WAIT s. */
  const introducePlace = (then: () => void) => {
    showTimedBanner(place.name, '', 'place', PLACE_BANNER);
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      then();
    };
    const thisTurn = ++turn;
    after(PLACE_WAIT, () => turn === thisTurn && go());
    speak(place.speech, () => turn === thisTurn && go());
  };

  // ---------- Run flow ----------
  const startRun = (withPreview: boolean) => {
    timers.clear();
    turn++;
    tapFlow.disarm();
    feed = createFactFeed(() => session.chooseFacts());
    score = 0;
    streak = nextStreak(streak, false);
    lives = dev?.lives ?? LIVES;
    fact = undefined;
    options = [];
    move = null;
    clockRunning = false;
    obstaclePlaced = false;
    revealed = false;
    trailDue = false;
    devPlaceIndex = 0;
    visited = new Set<PlaceId>();
    hideAllProps();
    effects.clear();
    fish.forEach((f) => (f.visible = false));
    doorway?.dispose();
    doorway = null;
    doorPlan = null;
    const first =
      dev?.places[0] ?? dev?.place ?? (dev?.obstacle ? placeOf(dev.obstacle).id : FIRST_PLACE);
    if (dev && dev.places.length > 0) devPlaceIndex = 1;
    place = placeById(first);
    visited.add(place.id);
    showPlaceScenery(place);
    newVisit();
    catX = Math.round(camX / 4) * 4;
    camX = catX + fit.viewW * (0.5 - CAT_COL);
    speed = 0;
    cat.setLook(CAT_LOOKS[catId]);
    hud.setCat(catId);
    hud.setLives(lives);
    setScoreHud();
    hud.setTopVisible(false, 0);
    hud.showCount(null);
    hud.hideWord();
    hud.setIris(null);
    hud.setPlace(place.name, doorOf(placeById(nextId)));
    if (!withPreview) {
      startCountdown();
      return;
    }
    phase = 'preview';
    showPreview({ topic: session.topic, facts: feed.peek(10), onDone: startCountdown });
  };

  /** 3, 2, 1, Go! and the run begins in the first place. */
  const startCountdown = () => {
    phase = 'countdown';
    const steps = ['3', '2', '1', 'Go!'];
    steps.forEach((text, i) => {
      after(i * COUNT_STEP, () => {
        hud.showCount(text);
        if (i < 3) sfx.tick();
        else sfx.meow();
      });
    });
    after(steps.length * COUNT_STEP, () => {
      hud.showCount(null);
      introducePlace(askNext);
    });
  };

  const showPicker = (onGo: () => void): CatPicker => {
    phase = 'picker';
    hud.setTopVisible(false, 0);
    return showCatPicker({
      current: catId,
      onGo: (picked) => {
        catId = picked;
        setSetting(CAT_SETTING(playerId), picked);
        onGo();
      },
    });
  };

  /** The next obstacle of the visit, or the doorway when the six are done. */
  const askNext = () => {
    if (phase === 'ending' || phase === 'done') return;
    timers.clear();
    tapFlow.disarm();
    stopSpeaking();
    hud.hideWord();
    if (planIndex >= VISIT_LENGTH) {
      startDoor();
      return;
    }
    askObstacle();
  };

  /** Shows a question with its four answers and reads it out; the clock waits for the reading. */
  const askObstacle = () => {
    const step = plan[planIndex];
    obstacle = step.obstacle;
    variant = step.variant;
    const thisTurn = ++turn;
    fact = feed.take();
    const current = fact;
    options = answerOptions(session.topic, current, buttons.length);
    chosen = -1;
    timedOut = false;
    revealed = false;
    pendingPoints = 0;
    hud.setAnswers(options);
    hud.problemText.textContent = current.prompt;
    showFactMap(current);
    hud.setDots(dots, planIndex);
    if (bannerUntil <= gameTime) hud.hideBanner();
    clockTotal = Math.max(session.timerSecondsFor(current), 1);
    clockLeft = clockTotal;
    clockRunning = false;
    obstaclePlaced = false;
    runSpeedGoal = RUN_SPEED;
    phase = 'riding';
    hud.setTopVisible(true, options.length);
    hud.setClock(0, { urgent: false, waiting: true });
    // The clock starts once the question has been read out, as long as this turn is current.
    speak(promptSpeech(current), () => {
      if (turn !== thisTurn || phase !== 'riding') return;
      startClock();
    });
  };

  const startClock = () => {
    if (clockRunning || obstaclePlaced) return;
    const ap = approach(clockTotal, fit.ahead);
    placeTarget(ap.gap);
    runSpeedGoal = ap.runSpeed;
    startSpeed = speed;
    clockRunning = true;
    lastTick = Math.ceil(clockLeft);
    if (trailDue) {
      trailDue = false;
      spawnTrail();
    }
  };

  /** The player picks an answer. */
  const select = (index: number) => {
    if (phase !== 'riding' || !fact || options[index] === undefined) return;
    try {
      unlockAudio();
      stopSpeaking();
    } catch {
      // Audio trouble must never stop the run.
    }
    const current = fact;
    chosen = index;
    hud.lockAnswers();
    const correct = options[index] === current.answer;
    // If the question is still being read the clock has not started: the answer counts as full time.
    if (!obstaclePlaced) placeTarget(approach(clockTotal, fit.ahead).gap);
    clockRunning = false;
    buttons[index].classList.add('chosen');
    if (correct) {
      feed.recordHit(current);
      hideFactMap();
      session.recordAnswer(current, true);
      streak = nextStreak(streak, true);
      pendingPoints = hitPoints(clockLeft, clockTotal, streak);
      buttons.forEach((b, i) => b.classList.add(i === index ? 'right' : 'gone'));
    } else {
      feed.recordMiss(current);
      hideFactMap();
      session.recordAnswer(current, false);
      streak = nextStreak(streak, false);
      buttons[index].classList.add('wrong');
      buttons[options.indexOf(current.answer)]?.classList.add('right');
    }
    setScoreHud();
    phase = 'sprint';
    sfx.whoosh();
  };

  /** The clock ran out: the cat arrives and flops. */
  const timeUp = () => {
    if (!fact) return;
    const current = fact;
    clockRunning = false;
    clockLeft = 0;
    chosen = -1;
    timedOut = true;
    hud.lockAnswers();
    feed.recordMiss(current);
    hideFactMap();
    session.recordAnswer(current, false);
    streak = nextStreak(streak, false);
    buttons[options.indexOf(current.answer)]?.classList.add('right');
    setScoreHud();
    startMove('fail');
  };

  // ---------- Moves ----------
  const makeMove = (id: ObstacleId, outcome: Outcome, v: Variant): Move => ({
    obstacle: id,
    outcome,
    variant: v,
    t: 0,
    duration: moveDuration(id, outcome, v),
    events: moveEvents(id, outcome, v),
    next: 0,
    scale: 1,
    length: MOVE_SPECS[id].length,
    prop: props.get(id),
  });

  const startMove = (outcome: Outcome) => {
    move = makeMove(obstacle, outcome, variant);
    prop?.reset();
    phase = 'move';
    catX = originX;
    dots[planIndex] = outcome;
    hud.setDots(dots, planIndex);
  };

  const fireEvent = (e: MoveEvent, m: Move) => {
    const x = originX + e.x;
    if (EFFECT_KINDS.includes(e.type)) {
      effects.fire(e.type as EffectKind, x, e.y, e.color);
      return;
    }
    if (e.type.startsWith('sfx:')) {
      play(e.type.slice(4));
      return;
    }
    switch (e.type) {
      case 'word': {
        hud.showWord(MOVE_WORDS[m.obstacle][m.variant], catScreen(2.2), true);
        awardPoints(catScreen(1.6));
        effects.fire('sparkle', focus.x, focus.y + 1.2);
        break;
      }
      case 'bonk': {
        sfx.yowl();
        shake = Math.max(shake, 1);
        hud.flashBonk();
        // The move lab only plays the move: nothing is lost and nothing is asked.
        if (lab) break;
        lives = loseLife(lives);
        hud.setLives(lives, true);
        // The green answer and the miss picture wait for the flop to finish (finishMove).
        break;
      }
      default:
        break;
    }
  };

  const stepMove = (m: Move, dt: number) => {
    m.t = Math.min(m.t + dt, m.duration);
    while (m.next < m.events.length && m.events[m.next].at <= m.t) fireEvent(m.events[m.next++], m);
  };

  const finishMove = (m: Move) => {
    // The cat runs on from the end of the obstacle, at the speed the move left off.
    moveFrame(m.obstacle, m.outcome, m.variant, m.duration - 0.05, frame);
    const before = frame.x;
    moveFrame(m.obstacle, m.outcome, m.variant, m.duration, frame);
    speed = Math.max((frame.x - before) / 0.05, 3);
    catX = originX + m.length;
    move = null;
    if (m.outcome === 'clear') {
      cleared();
      phase = 'riding';
      planIndex++;
      askNext();
      return;
    }
    // A fail: the flop has played out, so now the green answer and the miss picture show, and
    // the cat trots on while the game waits for the tap on it.
    speed = RUN_SPEED;
    if (phase === 'move') phase = outOfLives(lives) ? 'ending' : 'result';
    if (!lab) beginResult();
  };

  /** A clear: any points still owed are paid and a trail of fish is laid for the next stretch. */
  const cleared = () => {
    if (pendingPoints > 0) {
      score += pendingPoints;
      pendingPoints = 0;
      setScoreHud(true);
    }
    trailDue = true;
  };

  // ---------- After a miss ----------
  /** The miss is shown with the right answer in green; the move keeps playing beneath it. */
  const beginResult = () => {
    if (revealed) return;
    revealed = true;
    const current = fact;
    hud.hideWord();
    if (outOfLives(lives)) {
      beginEnding(current);
      return;
    }
    hud.showBanner(timedOut ? "Time's up!" : 'Oops!', current?.statement ?? '', 'miss');
    if (current) {
      tapFlow.reveal(buttons, options, current, {
        avoid: [hud.top, hud.banner],
        problem: current.prompt,
        chosen: options[chosen],
      });
    } else {
      after(1.2, advance);
    }
  };

  /** Moves on after a reveal. */
  const advance = () => {
    tapFlow.disarm();
    stopSpeaking();
    timers.clear();
    if (move) {
      // Tapped before the move ended: the cat lands on the far side at once.
      catX = originX + move.length;
      move.prop.reset();
      move = null;
      speed = RUN_SPEED;
    }
    hud.hideBanner();
    phase = 'riding';
    planIndex++;
    askNext();
  };

  const beginEnding = (last: Fact | undefined) => {
    phase = move ? 'move' : 'ending';
    timers.clear();
    turn++;
    clockRunning = false;
    tapFlow.disarm();
    hud.showBanner(OUT_OF_LIVES_SPEECH, last?.statement ?? '', 'out');
    const thisTurn = turn;
    if (!last) {
      hud.setTopVisible(false, 0);
      speak(OUT_OF_LIVES_SPEECH, () => turn === thisTurn && finishRun());
      return;
    }
    // The question and answers stay up: the player taps the green one before the results appear.
    tapFlow.reveal(buttons, options, last, {
      avoid: [hud.top, hud.banner],
      problem: last.prompt,
      lead: OUT_OF_LIVES_SPEECH,
      chosen: options[chosen],
    });
  };

  const finishRun = () => {
    hideFactMap();
    phase = 'done';
    tapFlow.disarm();
    hud.hideBanner();
    hud.setTopVisible(false, 0);
    const stars = starsFor(feed.correct, feed.answered);
    session.recordStars(stars);
    const newHighScore = session.recordScore(score);
    setScoreHud();
    if (newHighScore) sfx.goal();
    speak(newHighScore ? NEW_HIGH_SCORE_SPEECH : GREAT_RUNNING_SPEECH);
    showResults({
      topicId: session.topic.id,
      steps: session.takeStepReport(),
      correct: feed.correct,
      total: feed.answered,
      stars,
      newBest: false,
      missed: feed.missed(),
      playerName: session.player?.name,
      score,
      highScore: session.highScore(),
      newHighScore,
      playAgainLabel: 'Run again 🐾',
      onPlayAgain: () => {
        move = null;
        picker = showPicker(() => startRun(false));
      },
    });
  };

  // ---------- The doorway between places ----------
  const startDoor = () => {
    const target = placeById(nextId);
    props.get(target.obstacles[0]);
    doorway?.dispose();
    doorway = createDoorway(doorOf(target), target.look);
    const distance = dev && doorLab ? 6.8 : fit.ahead + 6;
    doorPlan = {
      runTime: dev && doorLab ? 0.85 : 1.2,
      fromX: catX,
      doorX: catX + distance,
    };
    doorway.object.position.set(doorPlan.doorX, 0, 0);
    scene.add(doorway.object);
    doorT = 0;
    doorSwapped = false;
    doorIntroduced = false;
    phase = 'door';
    hud.setTopVisible(false, 0);
    hud.hideBanner();
    hud.setPlace(target.name, doorOf(target));
  };

  /** Poses everything of the doorway at time `t`; each step fires once. */
  const poseDoor = (t: number, silent = false) => {
    if (!doorPlan) return;
    const { runTime, fromX, doorX } = doorPlan;
    const closedAt = runTime + IRIS_TIME;
    const openAt = closedAt + IRIS_TIME;
    if (t < closedAt) {
      // Running to the door, shrinking into it at the end.
      const u = Math.min(t / runTime, 1);
      const x = lerpNumber(fromX, doorX, u);
      const into = MathUtils.clamp((u - 0.75) / 0.25, 0, 1);
      frame.x = x;
      frame.y = 0;
      frame.rot = 0;
      frame.z = DOOR_Z * 0.7 * into;
      frame.sx = frame.sy = 1 - 0.25 * into;
      frame.pose = 'run';
      frame.face = 'happy';
      frame.coat = 'none';
      frame.hat = 'none';
      frame.visible = u < 1;
      applyFrame(frame, 0, 1 / 60);
      catX = x;
      speed = (doorX - fromX) / runTime;
    }
    // The iris closes on the cat, then opens on the new place.
    const at = catScreen(0.6);
    const diag = Math.hypot(viewW, viewH);
    if (t < runTime) hud.setIris(null);
    else if (t < closedAt) hud.setIris(diag * (1 - (t - runTime) / IRIS_TIME), at);
    else if (t < openAt) hud.setIris(diag * ((t - closedAt) / IRIS_TIME), at);
    else hud.setIris(null);
    if (t >= closedAt && !doorSwapped) {
      doorSwapped = true;
      const target = placeById(nextId);
      doorway?.dispose();
      doorway = null;
      hideAllProps();
      visited.add(target.id);
      place = target;
      showPlaceScenery(target);
      newVisit();
      hud.setPlace(place.name, doorOf(placeById(nextId)));
      frame.x = catX;
      frame.y = 0;
      frame.z = 0;
      frame.sx = frame.sy = 1;
      frame.pose = 'run';
      frame.visible = true;
      applyFrame(frame, 0, 0);
      camX = catX + fit.viewW * (0.5 - CAT_COL);
      if (!silent) sfx.meow();
    }
    if (doorSwapped && t >= closedAt) {
      frame.visible = true;
      frame.z = 0;
      frame.sx = frame.sy = 1;
      frame.x = catX;
      applyFrame(frame, 0, 1 / 60);
    }
    if (doorSwapped && !doorIntroduced) {
      doorIntroduced = true;
      if (silent) hud.showBanner(place.name, '', 'place');
      else showTimedBanner(place.name, '', 'place', PLACE_BANNER);
      if (!silent) {
        let finished = false;
        const go = () => {
          if (finished) return;
          finished = true;
          phase = 'riding';
          speed = RUN_SPEED;
          askNext();
        };
        const thisTurn = ++turn;
        after(PLACE_WAIT, () => turn === thisTurn && go());
        speak(place.speech, () => turn === thisTurn && go());
      }
    }
  };

  // ---------- Input ----------
  /** A tap fast-forwards a move, so it never feels ignored. */
  const skip = () => {
    if (phase === 'move' && move && move.t >= FAST_FORWARD_AFTER) move.scale = FAST_FORWARD;
  };
  /** The player tapped the green answer. */
  const proceed = () => {
    if (phase === 'ending' || (phase === 'move' && outOfLives(lives))) {
      finishRun();
      return;
    }
    if (phase === 'result' || (phase === 'move' && revealed)) advance();
  };
  const onAnswer = (index: number) => {
    if (tapFlow.armed) {
      if (tapFlow.tap(index)) proceed();
      return;
    }
    if (phase === 'riding') select(index);
    else skip();
  };
  const unpress = pressAnswers(buttons, onAnswer);
  hud.hear.addEventListener('click', () => {
    unlockAudio();
    if (fact) speak(promptSpeech(fact));
  });
  const stopPointer = createPointerInput(ctx.renderer.domElement, {
    onDragStart: () => unlockAudio(),
    onTap: skip,
  });
  const onKey = (e: KeyboardEvent) => {
    if (pause.isPaused) return;
    const index = Number(e.key) - 1;
    if (index >= 0 && index < buttons.length) onAnswer(index);
  };
  window.addEventListener('keydown', onKey);

  // ---------- Fish ----------
  const rightNow = () => chosen >= 0 && options[chosen] === fact?.answer && !timedOut;
  const spawnTrail = () => {
    const count = fishTrailLength(Math.random());
    trailCaught = 0;
    const x0 = camX + fit.viewW * 0.5 + 1.5;
    // Keep clear of the obstacle once it is out there.
    if (obstaclePlaced && x0 + count * FISH_GAP > originX - 6) return;
    let placed = 0;
    for (const f of fish) {
      if (f.visible) continue;
      f.visible = true;
      f.position.set(x0 + placed * FISH_GAP, FISH_Y, 0);
      f.userData.grab = false;
      f.userData.arc = count > 1 ? Math.sin((Math.PI * placed) / (count - 1)) * FISH_ARC : 0;
      if (++placed >= count) break;
    }
  };

  /** How high the cat is lifted while it leaps for the fish near it (0 when none is in reach). */
  const leapHeight = (): number => {
    let best = 0;
    for (const f of fish) {
      if (!f.visible) continue;
      best = Math.max(best, leapLift(f.position.x - catX, f.position.y - CAT_CHEST));
    }
    return best;
  };

  /** Fish are only won by a right answer: the cat leaps for the ones on the straight, and any
   *  still out when the obstacle move starts fly to it. */
  const updateFish = (time: number, delta: number, grabbing: boolean) => {
    for (const f of fish) {
      if (!f.visible) continue;
      if (phase === 'sprint' && grabbing && f.userData.grab !== true) {
        // Caught by the leap, however fast the sprint: any fish the cat reaches or has passed.
        if (f.position.x <= catX + 0.5) {
          f.userData.grab = true;
          f.position.x = catX;
          f.position.y = frame.y + CAT_CHEST;
        }
      }
      const grab = f.userData.grab === true;
      if (grab) {
        const dx = catX - f.position.x;
        const dy = CAT_CHEST - f.position.y;
        const step = Math.min(1, delta * 9);
        f.position.x += dx * step;
        f.position.y += dy * step;
        f.rotation.z = 0;
        if (Math.hypot(dx, dy) < 0.6) {
          f.visible = false;
          const worth = fishPoints(++trailCaught);
          score += worth;
          setScoreHud(true);
          effects.sparkle(f.position.x, f.position.y);
          sfx.purr();
          hud.pop(`+${worth}`, toScreen(f.position.x, f.position.y + 0.8), 'good');
        }
        continue;
      }
      f.position.y = FISH_Y + (f.userData.arc as number) + Math.sin(time * 3 + f.position.x) * 0.12;
      f.rotation.z = Math.sin(time * 4 + f.position.x) * 0.25;
      if (f.position.x < camX - fit.viewW * 0.4) f.visible = false;
      else if (grabbing && phase !== 'sprint' && f.position.x >= catX - 0.3) f.userData.grab = true;
    }
  };

  // ---------- Loop ----------
  const runClock = (delta: number) => {
    if (!clockRunning) return;
    clockLeft -= delta;
    const seconds = Math.ceil(clockLeft);
    if (seconds < lastTick && seconds > 0 && seconds <= 3) sfx.tick();
    lastTick = seconds;
    if (clockLeft <= 0) {
      clockLeft = 0;
      timeUp();
    }
  };

  /** Where the cat is while the clock runs: it arrives at the entry line as the clock hits zero. */
  const clockPosition = () => {
    const elapsed = clockTotal - clockLeft;
    const dv = startSpeed - runSpeedGoal;
    const wobble = (dv * (1 - Math.exp(-4 * elapsed))) / 4 - (dv / 4) * (elapsed / clockTotal);
    return approachStart + runSpeedGoal * elapsed + wobble;
  };

  /** The camera rises to follow a cat that leaps high. */
  const panFor = (f: CatFrame, id: ObstacleId) => {
    const top = f.y + 1.3;
    return -riseFor(top, f.y, MOVE_SPECS[id].height <= 3 ? 1.2 : 2.2);
  };

  const playRate = (m: Move) => (m.scale > 1 ? m.scale : 1);

  const stepWorld = (delta: number, elapsed: number) => {
    if (phase !== 'move') panGoal = 0;
    switch (phase) {
      case 'riding': {
        if (clockRunning) {
          runClock(delta);
          const x = Math.min(clockPosition(), originX);
          const moved = Math.max(x - catX, 0);
          catX = x;
          speed = delta > 0 ? moved / delta : speed;
        } else {
          speed = easeToward(speed, runSpeedGoal, 2.5, delta);
          catX += speed * delta;
        }
        break;
      }
      case 'sprint': {
        const remaining = Math.max(originX - catX, 0);
        const goal = Math.max(sprintSpeed(remaining), Math.min(remaining / 0.3, 40));
        speed = easeToward(speed, goal, 8, delta);
        catX = Math.min(catX + speed * delta, originX);
        if (catX >= originX - 1e-6) {
          startMove(chosen >= 0 && options[chosen] === fact?.answer ? 'clear' : 'fail');
        }
        break;
      }
      case 'result':
      case 'ending':
        catX += speed * delta;
        break;
      case 'door':
        doorT += delta;
        poseDoor(doorT);
        break;
      default:
        break;
    }

    if (phase === 'move' && move) {
      const m = move;
      stepMove(m, delta * playRate(m));
      moveFrame(m.obstacle, m.outcome, m.variant, m.t, frame);
      applyFrame(frame, originX, delta);
      panGoal = panFor(frame, m.obstacle);
      catX = originX + frame.x;
      m.prop.update(m.outcome, m.variant, m.t);
      if (m.t >= m.duration) finishMove(m);
    } else if (phase === 'door' || phase === 'done') {
      // posed above (the door), or idling at the results
      if (phase === 'done') catAt(catX, 'sit', delta);
    } else if (phase !== 'picker') {
      const pose = phase === 'preview' || phase === 'countdown' ? 'trot' : 'run';
      const lift = phase === 'sprint' && rightNow() ? leapHeight() : 0;
      catAt(
        catX,
        phase === 'preview' || phase === 'countdown' ? 'sit' : lift > 0.15 ? 'leap' : pose,
        delta,
        lift,
      );
      if (phase === 'riding' && prop && obstaclePlaced) prop.update(null, 0, elapsed);
    } else {
      catAt(catX, 'sit', delta);
    }

    const rightAnswer = rightNow();
    updateFish(
      elapsed,
      delta,
      (phase === 'sprint' || phase === 'move') && rightAnswer && !timedOut,
    );
    // The shadow.
    const grounded = focus.y < 1.2 && (phase !== 'move' || frame.visible);
    world.setShadow(focus.x, grounded && cat.object.visible, 1 - Math.min(focus.y * 0.12, 0.5));
  };

  const aimCamera = (dx: number, dy: number) => {
    camera.position.set(camX + dx, fit.camY - camPan + dy, fit.distance);
    camera.lookAt(camX, fit.camY - camPan, 0);
    camera.updateMatrixWorld();
    look.frame(camX, fit);
    effects.setScale(
      (ctx.renderer.getPixelRatio() * viewH) / (2 * Math.tan((camera.fov * Math.PI) / 360)),
    );
  };

  ctx.onUpdate((delta, elapsed) => {
    const stepped = governor?.sample(delta);
    if (stepped) {
      applyQuality(stepped);
      try {
        localStorage.setItem(QUALITY_KEY, stepped);
      } catch {
        // No storage: the tier is just not remembered.
      }
    }
    layout();
    gameTime += delta;
    tapFlow.update(delta);
    timers.update(delta);
    if (bannerUntil > 0 && gameTime >= bannerUntil) {
      bannerUntil = 0;
      hud.hideBanner();
    }

    if (lab) stepLab(delta);
    else if (doorLab) stepDoorLab();
    else stepWorld(delta, elapsed);

    if (!lab && !doorLab && (phase === 'riding' || phase === 'sprint')) {
      const progress = clockRunning
        ? approachProgress(clockLeft, clockTotal)
        : obstaclePlaced
          ? MathUtils.clamp((catX - approachStart) / Math.max(approachGap, 1), 0, 1)
          : 0;
      hud.setClock(progress, {
        urgent: clockRunning && clockLeft / clockTotal < 0.4,
        waiting: phase === 'riding' && !clockRunning,
      });
    }

    for (const l of live) {
      if (l.item !== prop || phase === 'move') continue;
    }
    retireFar();
    world.update(camX, fit);
    effects.update(delta);
    cat.update(delta, elapsed);

    // --- Camera: follows the cat, eased so moves are followed smoothly ---
    const goal = phase === 'move' || phase === 'door' ? focus.x : catX;
    const camGoal = goal + fit.viewW * (0.5 - CAT_COL);
    camX = easeToward(camX, camGoal, phase === 'move' || phase === 'sprint' ? 6 : 5, delta);
    if (!Number.isFinite(camX) || Math.abs(camX - camGoal) > 400) camX = camGoal;
    shake = easeToward(shake, 0, 3.5, delta);
    camPan = easeToward(camPan, panGoal, 4, delta);
    aimCamera(Math.sin(elapsed * 61) * shake * 0.18, Math.sin(elapsed * 73 + 1) * shake * 0.18);
  });

  // ---------- The move lab (dev only) ----------
  let labState: { move: Move; phase: 'ride' | 'play' | 'hold'; x: number } | null = null;
  function stepLab(delta: number) {
    if (!lab) return;
    if (!labState) {
      originX = 40;
      obstacle = lab.obstacle;
      showPlaceScenery(placeOf(obstacle));
      putOnFloor(obstacle, originX);
      labState = {
        move: makeMove(lab.obstacle, lab.outcome, lab.variant),
        phase: dev?.at != null ? 'hold' : 'ride',
        x: originX - 12,
      };
      phase = 'riding';
      hud.setTopVisible(false, 0);
      if (dev?.at != null) scrubLab(dev.at);
    }
    const s = labState;
    if (s.phase === 'hold') {
      if (dev?.at != null) ctx.renderer.domElement.dataset.frozen = '1';
      applyFrame(frame, originX, 0);
      s.move.prop.update(s.move.outcome, s.move.variant, s.move.t);
      camX = focus.x + fit.viewW * (0.5 - CAT_COL);
      catX = originX + frame.x;
      panGoal = camPan = panFor(frame, lab.obstacle);
      return;
    }
    if (s.phase === 'ride') {
      speed = 8;
      s.x += speed * delta;
      catX = s.x;
      catAt(s.x, 'run', delta);
      if (s.x >= originX) {
        s.phase = 'play';
        s.move = makeMove(lab.obstacle, lab.outcome, lab.variant);
        s.move.prop.reset();
      }
    } else {
      move = s.move;
      stepMove(s.move, delta);
      moveFrame(s.move.obstacle, s.move.outcome, s.move.variant, s.move.t, frame);
      applyFrame(frame, originX, delta);
      catX = originX + frame.x;
      panGoal = panFor(frame, lab.obstacle);
      s.move.prop.update(s.move.outcome, s.move.variant, s.move.t);
      if (s.move.t >= s.move.duration) {
        s.phase = 'hold';
        move = null;
        after(1.2, () => {
          if (!labState) return;
          labState.phase = 'ride';
          labState.x = originX - 12;
          s.move.prop.reset();
          effects.clear();
          hud.hideWord();
          hud.hideBanner();
          lives = LIVES;
          speed = 0;
        });
      }
    }
  }

  /** Plays the lab move up to `at` seconds in one go, so effects and props are where they would be. */
  function scrubLab(at: number) {
    if (!labState || !lab) return;
    const m = makeMove(lab.obstacle, lab.outcome, lab.variant);
    effects.clear();
    moveFrame(m.obstacle, m.outcome, m.variant, Math.min(at, m.duration), frame);
    applyFrame(frame, originX, 0);
    camX = focus.x + fit.viewW * (0.5 - CAT_COL);
    camPan = panFor(frame, lab.obstacle);
    aimCamera(0, 0);
    const step = 1 / 30;
    for (let t = 0; t < at; t += step) {
      stepMove(m, Math.min(step, at - t));
      effects.update(Math.min(step, at - t));
    }
    labState.move = m;
    moveFrame(m.obstacle, m.outcome, m.variant, m.t, frame);
  }

  // ---------- The door lab (dev only) ----------
  let doorLabReady = false;
  function stepDoorLab() {
    if (!doorLab) return;
    if (!doorLabReady) {
      doorLabReady = true;
      // The place before the door is the one whose group is the first in the list that is not the target.
      const from = PLACES.find((p) => p.id !== doorLab) ?? PLACES[0];
      place = from;
      showPlaceScenery(from);
      nextId = doorLab;
      catX = 0;
      camX = catX + fit.viewW * (0.5 - CAT_COL);
      phase = 'riding';
      startDoor();
      ctx.renderer.domElement.dataset.frozen = '1';
    }
    // Frozen at `at`, or looping the whole doorway.
    const at = dev?.at ?? null;
    if (at !== null) {
      if (!doorFrozen) {
        doorFrozen = true;
        // Step through the events up to `at` so the swap and the banner have happened.
        poseDoor(Math.min(at, 0.5), true);
        poseDoor(at, true);
        doorT = at;
        camX = focus.x + fit.viewW * (0.5 - CAT_COL);
      }
      poseDoor(at, true);
      applyFrame(frame, 0, 0);
      camX = easeToward(camX, focus.x + fit.viewW * (0.5 - CAT_COL), 20, 1 / 30);
    } else {
      doorT += 1 / 60;
      poseDoor(doorT);
    }
  }

  // ---------- Start ----------
  layout();
  hud.setTopVisible(false, 0);
  setScoreHud();
  camX = 0;
  ctx.start();
  let picker: CatPicker | null = null;
  if (lab || doorLab) {
    startRun(false);
    timers.clear();
    hud.showCount(null);
    hud.setTopVisible(false, 0);
    phase = 'riding';
  } else if (dev?.cat) {
    startRun(true);
  } else {
    // Show the first place behind the picker, then the preview and the countdown.
    picker = showPicker(() => startRun(true));
  }

  window.addEventListener('pagehide', () => {
    stopSpeaking();
    window.removeEventListener('keydown', onKey);
    stopPointer();
    tapFlow.dispose();
    unpress();
    pause.dispose();
    mute.dispose();
    picker?.dispose();
    hud.dispose();
    effects.dispose();
    cat.dispose();
    props.dispose();
    doorway?.dispose();
    world.dispose();
    look.dispose();
    fishBody.dispose();
    fishTail.dispose();
    fishMaterial.dispose();
    tailMaterial.dispose();
    ctx.dispose();
  });
}

const lerpNumber = (a: number, b: number, t: number) => a + (b - a) * t;

const session = startGameSession(GAME_ID);
if (session) {
  preloadCatSounds();
  run(session, devOptions());
} else location.replace(menuUrl());
