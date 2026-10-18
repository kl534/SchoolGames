import './style.css';
import { CylinderGeometry, MathUtils, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { sfx, speak, stopSpeaking, unlockAudio } from '../../shared/audio';
import { createFactFeed, type FactFeed } from '../../shared/feed';
import { createPointerInput, onPress } from '../../shared/input';
import { showPreview } from '../../shared/preview';
import { showResults } from '../../shared/results';
import { starsFor } from '../../shared/round';
import { createScene } from '../../shared/scene';
import { startGameSession, type GameSession } from '../../shared/session';
import { answerOptions, type Fact } from '../../shared/topics';
import { createBackButton, createMuteButton, createPauseOverlay, menuUrl } from '../../shared/ui';
import { createBike, createParachute, type Bike } from './bike';
import { devOptions, type DevOptions } from './dev';
import { createEffects, type EffectKind } from './effects';
import { createHud } from './hud';
import { FOV, fitView, playBand, type Fit } from './layout';
import { createObstaclePool, type Obstacle } from './obstacles';
import { createRider, type Rider } from './rider';
import {
  approach,
  approachProgress,
  BIKES,
  COIN_GAP,
  COIN_POINTS,
  COIN_Y,
  easeToward,
  ENTRY_SPEED,
  GREAT_RIDING_SPEECH,
  hitPoints,
  loseBike,
  MEGA_BONUS,
  MEGA_PIECES,
  megaKinds,
  multiplierFor,
  NEW_HIGH_SCORE_SPEECH,
  nextKind,
  nextStreak,
  nitroSpeed,
  NITRO_MAX,
  OUT_OF_BIKES_SPEECH,
  outOfBikes,
  pickVariant,
  RIDE_SPEED,
  startsMega,
  trailLength,
  worldSpeedFactor,
  type ObstacleKind,
  type Outcome,
  type Variant,
} from './rules';
import {
  BIKE_Y,
  createFrame,
  SPECS,
  stuntDuration,
  stuntEvents,
  stuntFrame,
  stuntWord,
  type Frame,
  type StuntEvent,
} from './stunts';
import { createWorld, type Cut } from './world';

const GAME_ID = 'crash-course';

/** Seconds a result or a stunt runs before a tap can skip it. */
const SKIP_AFTER = 0.6;
/** Least seconds the correct fact stays up after a miss. */
const REVEAL_FOR = 2.2;
/** Seconds each step of the 3, 2, 1, Go! lasts. */
const COUNT_STEP = 0.75;
/** The new bike's parachute drop. */
const RESPAWN_TIME = 1.6;
/** How fast a stunt plays after a tap. */
const FAST_FORWARD = 3;
/** Seconds the banner of a Mega Stunt shows. */
const MEGA_BANNER = 1.5;

type Phase =
  'preview' | 'countdown' | 'riding' | 'nitro' | 'stunt' | 'result' | 'respawn' | 'ending' | 'done';

interface Pair {
  bike: Bike;
  rider: Rider;
  lastX: number;
}

interface Stunt {
  kind: ObstacleKind;
  outcome: Outcome;
  variant: Variant;
  t: number;
  duration: number;
  events: StuntEvent[];
  next: number;
  scale: number;
}

const EFFECT_KINDS: readonly string[] = [
  'dust',
  'splash',
  'spark',
  'flame',
  'smoke',
  'debris',
  'confetti',
  'stars',
  'sweat',
  'poof',
];

function run(session: GameSession, dev: DevOptions | null): void {
  const container = document.getElementById('game');
  if (!container) throw new Error('Missing #game container');

  const avatar = session.player?.avatar ?? '⭐';
  const lab = dev?.lab ?? null;

  // ---------- Scene ----------
  const ctx = createScene(container, { fov: FOV, near: 5, far: 400 });
  const { scene, camera } = ctx;
  const world = createWorld(scene);
  const effects = createEffects();
  scene.add(effects.object);
  const pool = createObstaclePool();

  const makePair = (): Pair => {
    const bike = createBike();
    const rider = createRider(avatar);
    scene.add(bike.object);
    rider.setMode('seated', bike.seat, scene);
    return { bike, rider, lastX: 0 };
  };
  const pairs: [Pair, Pair] = [makePair(), makePair()];
  let activeIndex = 0;
  const active = () => pairs[activeIndex];
  const parachute = createParachute();
  scene.add(parachute.object);

  // Coins on the straights.
  const coinMaterial = new MeshStandardMaterial({
    color: 0xffd43b,
    roughness: 0.25,
    metalness: 0.6,
  });
  const coinGeometry = new CylinderGeometry(0.34, 0.34, 0.09, 18);
  coinGeometry.rotateX(Math.PI / 2);
  const coins = Array.from({ length: 16 }, () => {
    const mesh = new Mesh(coinGeometry, coinMaterial);
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  });

  // ---------- HUD ----------
  const hud = createHud(avatar);
  const { buttons } = hud;
  if (lab) document.body.classList.add('cc-lab');
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
  let streak = 0;
  let bikes = dev?.bikes ?? BIKES;
  let cleared = 0;
  let obstacleNumber = 0;
  let lastKind: ObstacleKind | null = null;
  let devKindIndex = 0;
  const lastVariant: Record<string, Variant | undefined> = {};
  /** Ticks up for each question, so late callbacks can tell they are stale. */
  let turn = 0;
  let gameTime = 0;
  let pending: { at: number; fn: () => void }[] = [];
  const after = (seconds: number, fn: () => void) => pending.push({ at: gameTime + seconds, fn });
  let resultAt = 0;
  let bannerUntil = 0;

  // The Mega Stunt in progress.
  let megaQueue: ObstacleKind[] = [];
  let megaTotal = 0;
  let megaDone = 0;
  let megaFirst = 0;
  let nextIsMega = dev?.mega ?? false;

  // The question and its approach.
  let kind: ObstacleKind = 'loop';
  let obstacle: Obstacle | null = null;
  const live: { obstacle: Obstacle; originX: number }[] = [];
  let originX = 0;
  let approachGap = 0;
  let approachStart = 0;
  let rideSpeedGoal = RIDE_SPEED;
  let startSpeed = 0;
  let clockLeft = 0;
  let clockTotal = 1;
  let clockRunning = false;
  let obstaclePlaced = false;
  let lastTick = 0;
  let pendingPoints = 0;
  let stunt: Stunt | null = null;
  let timedOut = false;

  // The bike.
  let bikeX = 0;
  let speed = 0;
  let camX = 0;
  let shake = 0;
  /** What the camera and the comic words follow: the bike, or the rider once he is thrown clear. */
  const focus = { x: 0, y: 0 };
  /** How far the camera has dropped to follow a bike down into a pit. */
  let camPan = 0;
  let panGoal = 0;
  let nitroAmount = 0;
  let coinIn = 3;
  let exhaustIn = 0;
  const frame: Frame = createFrame();
  const point = new Vector3();
  let respawnT = 0;
  let respawnDone = true;
  let respawnStarted = false;
  let respawnX = 0;

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

  const cuts = (): Cut[] =>
    live.flatMap(({ obstacle: o, originX: x }) =>
      o.cut ? [[x + o.cut[0], x + o.cut[1]] as Cut] : [],
    );

  const retireFar = () => {
    for (let i = live.length - 1; i >= 0; i--) {
      const { obstacle: o, originX: x } = live[i];
      if (o === obstacle) continue;
      if (camX - (x + o.spec.length) > fit.viewW + 20) {
        o.object.visible = false;
        live.splice(i, 1);
      }
    }
  };

  /** Puts an obstacle `gap` ahead of the bike. */
  const placeObstacle = (gap: number) => {
    obstaclePlaced = true;
    approachGap = gap;
    approachStart = bikeX;
    originX = bikeX + gap;
    obstacle = pool.get(kind);
    obstacle.reset();
    obstacle.object.position.set(originX, 0, 0);
    if (obstacle.object.parent !== scene) scene.add(obstacle.object);
    obstacle.object.visible = true;
    const existing = live.find((l) => l.obstacle === obstacle);
    if (existing) existing.originX = originX;
    else live.push({ obstacle, originX });
  };

  const setScoreHud = (pulse = false) =>
    hud.setScore(score, streak, Math.max(session.highScore(), 0), pulse);

  const showTimedBanner = (
    title: string,
    detail: string,
    k: 'hit' | 'miss' | 'warn' | 'out',
    s: number,
  ) => {
    hud.showBanner(title, detail, k);
    bannerUntil = gameTime + s;
  };

  /** The nearest thing a reader would call the bike on screen, for the comic words. */
  const bikeScreen = (dy = 1) => toScreen(focus.x, focus.y + dy);

  // ---------- Posing the bike and the rider ----------
  const applyFrame = (pair: Pair, f: Frame, x0: number, dt: number) => {
    const b = f.bike;
    const bike = pair.bike;
    bike.object.visible = b.visible;
    bike.object.rotation.order = 'ZXY';
    bike.object.position.set(x0 + b.x, b.y, b.z);
    bike.object.rotation.set(b.roll, 0, b.pitch);
    bike.setSquash(b.squash);
    const dx = x0 + b.x - pair.lastX;
    pair.lastX = x0 + b.x;
    if (b.grounded) bike.spin(dx);
    else bike.spin(ENTRY_SPEED * dt);
    const r = f.rider;
    if (r.mode === 'free' && r.visible) {
      focus.x = x0 + r.x;
      focus.y = r.y;
    } else {
      focus.x = x0 + b.x;
      focus.y = b.y;
    }
    if (pair.rider.mode !== r.mode) pair.rider.setMode(r.mode, bike.seat, scene);
    pair.rider.setPose(r.pose);
    pair.rider.setFace(r.face);
    pair.rider.setVisible(r.visible && (r.mode === 'free' || b.visible));
    if (r.mode === 'free') pair.rider.place(x0 + r.x, r.y, r.rot);
  };

  /** The bike riding along the road at `x`, with the rider in `pose`. */
  const rideAt = (pair: Pair, x: number, pose: Frame['rider']['pose'], dt: number) => {
    frame.bike.x = x;
    frame.bike.y = BIKE_Y;
    frame.bike.pitch = frame.bike.roll = frame.bike.z = 0;
    frame.bike.squash = 1;
    frame.bike.visible = true;
    frame.bike.grounded = true;
    frame.rider.mode = 'seated';
    frame.rider.pose = pose;
    frame.rider.face = 'happy';
    frame.rider.visible = true;
    applyFrame(pair, frame, 0, dt);
  };

  // ---------- Run flow ----------
  const startRun = (withPreview: boolean) => {
    pending = [];
    turn++;
    feed = createFactFeed(() => session.chooseFacts());
    score = 0;
    streak = nextStreak(streak, false);
    bikes = dev?.bikes ?? BIKES;
    cleared = 0;
    obstacleNumber = nextIsMega || dev?.mega ? 7 : 0;
    lastKind = null;
    devKindIndex = 0;
    megaQueue = [];
    megaTotal = 0;
    megaDone = 0;
    fact = undefined;
    options = [];
    stunt = null;
    clockRunning = false;
    obstaclePlaced = false;
    for (const l of live) l.obstacle.object.visible = false;
    live.length = 0;
    obstacle = null;
    effects.clear();
    coins.forEach((c) => (c.visible = false));
    activeIndex = 0;
    for (const pair of pairs) {
      pair.bike.object.visible = false;
      pair.rider.setMode('seated', pair.bike.seat, scene);
      pair.rider.setFace('happy');
    }
    bikeX = Math.round(camX / 4) * 4;
    camX = bikeX + fit.viewW * (0.5 - 0.28);
    speed = 0;
    nitroAmount = 0;
    respawnDone = true;
    respawnStarted = false;
    parachute.object.visible = false;
    pairs[0].bike.object.visible = true;
    pairs[0].lastX = bikeX;
    hud.setBikes(bikes);
    hud.setMega(0, 0);
    setScoreHud();
    hud.setTopVisible(false, 0);
    hud.showCount(null);
    hud.hideWord();
    hud.speedLines(false);
    if (!withPreview) {
      startCountdown();
      return;
    }
    phase = 'preview';
    showPreview({ topic: session.topic, facts: feed.peek(10), onDone: startCountdown });
  };

  /** 3, 2, 1, Go! and the ride begins. */
  const startCountdown = () => {
    phase = 'countdown';
    const steps = ['3', '2', '1', 'Go!'];
    steps.forEach((text, i) => {
      after(i * COUNT_STEP, () => {
        hud.showCount(text);
        if (i < 3) sfx.tick();
        else sfx.rev();
      });
    });
    after(steps.length * COUNT_STEP, () => {
      hud.showCount(null);
      askNext();
    });
  };

  /** Picks the next obstacle, or starts a Mega Stunt. */
  const askNext = () => {
    if (phase === 'ending' || phase === 'done') return;
    pending = [];
    stopSpeaking();
    hud.hideWord();
    if (
      megaQueue.length === 0 &&
      megaTotal === 0 &&
      (nextIsMega || startsMega(obstacleNumber + 1))
    ) {
      nextIsMega = false;
      beginMega();
      return;
    }
    askPiece();
  };

  const beginMega = () => {
    megaQueue = megaKinds(lastKind, [Math.random(), Math.random(), Math.random()]);
    megaTotal = MEGA_PIECES;
    megaDone = 0;
    megaFirst = obstacleNumber + 1;
    hud.setMega(megaTotal, 0);
    phase = 'riding';
    fact = undefined;
    clockRunning = false;
    obstaclePlaced = false;
    rideSpeedGoal = RIDE_SPEED * worldSpeedFactor(cleared);
    hud.setTopVisible(false, 0);
    showTimedBanner('MEGA STUNT!', '', 'warn', MEGA_BANNER);
    sfx.alarm();
    const thisTurn = ++turn;
    after(MEGA_BANNER, () => turn === thisTurn && askPiece());
  };

  /** Shows a question with its four answers and reads it out; the clock waits for the reading. */
  const askPiece = () => {
    if (phase === 'ending' || phase === 'done') return;
    obstacleNumber++;
    if (megaQueue.length > 0) kind = megaQueue.shift() as ObstacleKind;
    else if (dev && dev.kinds.length > 0) kind = dev.kinds[devKindIndex++ % dev.kinds.length];
    else kind = nextKind(lastKind, Math.random());
    lastKind = kind;
    const thisTurn = ++turn;
    fact = feed.take();
    const current = fact;
    options = answerOptions(session.topic, current, buttons.length);
    chosen = -1;
    timedOut = false;
    pendingPoints = 0;
    hud.setAnswers(options);
    hud.problemText.textContent = current.prompt;
    hud.setGoal(kind);
    hud.setMega(megaTotal, megaDone);
    hud.hideBanner();
    clockTotal = Math.max(session.timerSecondsFor(current), 1);
    clockLeft = clockTotal;
    clockRunning = false;
    obstaclePlaced = false;
    obstacle = null;
    rideSpeedGoal = RIDE_SPEED * worldSpeedFactor(cleared);
    phase = 'riding';
    hud.setTopVisible(true, options.length);
    hud.setRoad(0, { urgent: false, waiting: true });
    // The clock starts once the question has been read out, as long as this turn is current.
    speak(current.spokenPrompt ?? current.prompt, () => {
      if (turn !== thisTurn || phase !== 'riding') return;
      startClock();
    });
  };

  const startClock = () => {
    if (clockRunning || obstaclePlaced) return;
    const ap = approach(cleared, clockTotal, fit.ahead);
    placeObstacle(ap.gap);
    rideSpeedGoal = ap.rideSpeed;
    startSpeed = speed;
    clockRunning = true;
    lastTick = Math.ceil(clockLeft);
  };

  /** The player picks an answer. */
  const select = (index: number) => {
    if (phase !== 'riding' || !fact || options[index] === undefined) return;
    try {
      unlockAudio();
      stopSpeaking();
    } catch {
      // Audio trouble must never stop the ride.
    }
    const current = fact;
    chosen = index;
    hud.lockAnswers();
    const correct = options[index] === current.answer;
    // If the question is still being read the clock has not started: the answer counts as full time.
    if (!obstaclePlaced) {
      const ap = approach(cleared, clockTotal, fit.ahead);
      placeObstacle(ap.gap);
    }
    clockRunning = false;
    buttons[index].classList.add('chosen');
    if (correct) {
      feed.recordHit(current);
      session.recordAnswer(current, true);
      streak = nextStreak(streak, true);
      pendingPoints = hitPoints(clockLeft, clockTotal, streak);
      buttons.forEach((b, i) => b.classList.add(i === index ? 'right' : 'gone'));
    } else {
      feed.recordMiss(current);
      session.recordAnswer(current, false);
      streak = nextStreak(streak, false);
      buttons[index].classList.add('wrong');
      buttons[options.indexOf(current.answer)]?.classList.add('right');
    }
    setScoreHud();
    // Nitro to the obstacle.
    phase = 'nitro';
    sfx.rev();
    hud.speedLines(true);
  };

  /** The clock ran out: the bike arrives and crashes. */
  const timeUp = () => {
    if (!fact) return;
    const current = fact;
    clockRunning = false;
    clockLeft = 0;
    chosen = -1;
    timedOut = true;
    hud.lockAnswers();
    feed.recordMiss(current);
    session.recordAnswer(current, false);
    streak = nextStreak(streak, false);
    buttons[options.indexOf(current.answer)]?.classList.add('right');
    setScoreHud();
    startStunt('crash');
  };

  // ---------- Stunts ----------
  const makeStunt = (k: ObstacleKind, outcome: Outcome, variant: Variant): Stunt => ({
    kind: k,
    outcome,
    variant,
    t: 0,
    duration: stuntDuration(k, outcome, variant),
    events: stuntEvents(k, outcome, variant),
    next: 0,
    scale: 1,
  });

  const startStunt = (outcome: Outcome) => {
    const key = `${kind}:${outcome}`;
    const variant = pickVariant(lastVariant[key], Math.random());
    lastVariant[key] = variant;
    stunt = makeStunt(kind, outcome, variant);
    if (obstacle) obstacle.reset();
    phase = 'stunt';
    hud.speedLines(false);
    bikeX = originX;
  };

  const fireEvent = (e: StuntEvent, s: Stunt) => {
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
      case 'cheer': {
        world.setMood('cheer', 2.2);
        sfx.cheer();
        cleared++;
        if (pendingPoints > 0) {
          const multiplier = multiplierFor(streak);
          const before = multiplierFor(streak - 1);
          score += pendingPoints;
          hud.pop(`+${pendingPoints.toLocaleString()}`, bikeScreen(1.6), 'good');
          if (multiplier > before) {
            hud.pop(`×${multiplier} streak!`, { x: viewW / 2, y: viewH * 0.4 }, 'plain');
          }
          pendingPoints = 0;
          setScoreHud(true);
        }
        break;
      }
      case 'groan': {
        world.setMood('groan', 2.4);
        sfx.miss();
        shake = Math.max(shake, 1);
        hud.flashCrash();
        bikes = loseBike(bikes);
        hud.setBikes(bikes, true);
        break;
      }
      case 'word': {
        hud.showWord(
          stuntWord(s.kind, s.outcome, s.variant),
          bikeScreen(2.4),
          s.outcome === 'clear',
        );
        break;
      }
      default:
        break;
    }
  };

  /** Advances the stunt by `dt` seconds of stunt time, firing the events it passes. */
  const stepStunt = (s: Stunt, dt: number) => {
    s.t = Math.min(s.t + dt, s.duration);
    while (s.next < s.events.length && s.events[s.next].at <= s.t) fireEvent(s.events[s.next++], s);
  };

  const finishStunt = (s: Stunt) => {
    if (s.outcome === 'clear') {
      // Riding on from the end of the obstacle, at the speed the stunt left off.
      stuntFrame(s.kind, s.outcome, s.variant, s.duration - 0.05, frame);
      const before = frame.bike.x;
      stuntFrame(s.kind, s.outcome, s.variant, s.duration, frame);
      speed = Math.max((frame.bike.x - before) / 0.05, 3);
      bikeX = originX + SPECS[s.kind].length;
      stunt = null;
      if (pendingPoints > 0) {
        score += pendingPoints;
        pendingPoints = 0;
        setScoreHud(true);
      }
      if (megaTotal > 0) {
        megaDone++;
        hud.setMega(megaTotal, megaDone);
        if (megaDone >= megaTotal) {
          score += MEGA_BONUS;
          setScoreHud(true);
          effects.fireworks(bikeX, 3);
          sfx.firework();
          after(0.25, sfx.firework);
          after(0.5, sfx.firework);
          sfx.bigCheer();
          showTimedBanner('MEGA STUNT CLEARED!', `+${MEGA_BONUS}`, 'hit', 2.2);
          megaTotal = 0;
          megaDone = 0;
          megaQueue = [];
        }
      }
      phase = 'riding';
      askNext();
      return;
    }
    // A crash: the bike stays where it ended. Cut short, a Mega Stunt still uses up its numbers.
    if (megaTotal > 0) {
      obstacleNumber = megaFirst + MEGA_PIECES - 1;
      megaTotal = 0;
      megaDone = 0;
      megaQueue = [];
      hud.setMega(0, 0);
    }
    stuntFrame(s.kind, s.outcome, s.variant, s.duration, frame);
    const reach = Math.max(
      SPECS[s.kind].length,
      frame.bike.visible ? frame.bike.x : 0,
      frame.rider.mode === 'free' ? frame.rider.x : 0,
    );
    respawnX = originX + reach + 4;
    stunt = null;
    beginResult();
  };

  // ---------- After a crash ----------
  const beginResult = () => {
    const current = fact;
    resultAt = gameTime;
    pending = [];
    hud.hideWord();
    if (outOfBikes(bikes)) {
      beginEnding(current);
      return;
    }
    phase = 'result';
    respawnDone = false;
    respawnStarted = false;
    let spoken = false;
    let shown = false;
    const thisTurn = turn;
    const next = () => {
      if (!spoken || !shown || turn !== thisTurn || phase !== 'result') return;
      if (respawnDone) advance();
      else phase = 'respawn';
    };
    hud.showBanner(timedOut ? "Time's up!" : 'Wipeout!', current?.statement ?? '', 'miss');
    after(0.6, () => {
      startRespawn();
      speak(current?.spokenStatement ?? current?.statement ?? '', () => {
        spoken = true;
        next();
      });
    });
    after(REVEAL_FOR, () => {
      shown = true;
      next();
    });
  };

  /** A parachute drops a new bike with the rider on it, further along the road. */
  const startRespawn = () => {
    activeIndex = 1 - activeIndex;
    const pair = active();
    pair.bike.object.visible = true;
    pair.rider.setMode('seated', pair.bike.seat, scene);
    pair.rider.setFace('happy');
    pair.rider.setVisible(true);
    bikeX = respawnX;
    pair.lastX = respawnX;
    respawnT = 0;
    respawnStarted = true;
    speed = 0;
    rideAt(pair, respawnX, 'ride', 0);
    pair.bike.object.position.y = 10;
    parachute.object.visible = true;
  };

  const endRespawn = () => {
    respawnDone = true;
    respawnT = RESPAWN_TIME;
    parachute.object.visible = false;
    rideAt(active(), bikeX, 'wave', 0);
  };

  /** Moves on after a reveal. */
  const advance = () => {
    stopSpeaking();
    pending = [];
    if (!respawnDone) endRespawn();
    hud.hideBanner();
    askNext();
  };

  const beginEnding = (last: Fact | undefined) => {
    phase = 'ending';
    pending = [];
    turn++;
    clockRunning = false;
    hud.setTopVisible(false, 0);
    hud.setMega(0, 0);
    hud.showBanner(OUT_OF_BIKES_SPEECH, last?.statement ?? '', 'out');
    const thisTurn = turn;
    let spoken = false;
    let shown = false;
    const next = () => {
      if (spoken && shown && turn === thisTurn && phase === 'ending') finishRun();
    };
    const done = () => {
      spoken = true;
      next();
    };
    speak(OUT_OF_BIKES_SPEECH, () => {
      if (turn !== thisTurn || phase !== 'ending') return;
      if (last) speak(last.spokenStatement ?? last.statement, done);
      else done();
    });
    after(REVEAL_FOR, () => {
      shown = true;
      next();
    });
  };

  const finishRun = () => {
    phase = 'done';
    hud.hideBanner();
    hud.setTopVisible(false, 0);
    const stars = starsFor(feed.correct, feed.answered);
    session.recordStars(stars);
    const newHighScore = session.recordScore(score);
    setScoreHud();
    if (newHighScore) sfx.goal();
    speak(newHighScore ? NEW_HIGH_SCORE_SPEECH : GREAT_RIDING_SPEECH);
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
      playAgainLabel: 'Ride again 🏍️',
      onPlayAgain: () => startRun(false),
    });
  };

  // ---------- Input ----------
  /** A tap fast-forwards a stunt and skips a result, so it never feels ignored. */
  const skip = () => {
    if (phase === 'stunt' && stunt && stunt.t >= SKIP_AFTER) stunt.scale = FAST_FORWARD;
    else if ((phase === 'result' || phase === 'respawn') && gameTime - resultAt >= SKIP_AFTER)
      advance();
  };
  const onAnswer = (index: number) => {
    if (phase === 'riding') select(index);
    else skip();
  };
  const unpress = buttons.map((button, i) => {
    // A touch press doesn't count as a user gesture for iOS audio; the release does.
    button.addEventListener('pointerup', unlockAudio);
    return onPress(button, () => onAnswer(i));
  });
  hud.hear.addEventListener('click', () => {
    unlockAudio();
    if (fact) speak(fact.spokenPrompt ?? fact.prompt);
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

  // ---------- Coins ----------
  const spawnTrail = () => {
    const count = trailLength(Math.random());
    const x0 = camX + fit.viewW * 0.5 + 1.5;
    // Keep clear of the obstacle once it is out there.
    if (obstaclePlaced && x0 + count * COIN_GAP > originX - 6) return;
    let placed = 0;
    for (const coin of coins) {
      if (coin.visible) continue;
      coin.visible = true;
      coin.position.set(x0 + placed * COIN_GAP, COIN_Y, 0);
      if (++placed >= count) break;
    }
  };

  const updateCoins = (delta: number, time: number, collecting: boolean) => {
    for (const coin of coins) {
      if (!coin.visible) continue;
      coin.rotation.y = time * 4 + coin.position.x;
      if (coin.position.x < camX - fit.viewW * 0.4) coin.visible = false;
      else if (collecting && Math.abs(coin.position.x - bikeX) < 0.9) {
        coin.visible = false;
        score += COIN_POINTS;
        setScoreHud(true);
        effects.sparkle(coin.position.x, coin.position.y);
        sfx.chime();
        hud.pop(`+${COIN_POINTS}`, toScreen(coin.position.x, coin.position.y + 0.8), 'good');
      }
    }
    if (collecting) {
      coinIn -= delta;
      if (coinIn <= 0) {
        coinIn = 3 + Math.random() * 3;
        spawnTrail();
      }
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

  /** Where the bike is while the clock runs: it arrives at the entry line as the clock hits zero. */
  const clockPosition = () => {
    const elapsed = clockTotal - clockLeft;
    const dv = startSpeed - rideSpeedGoal;
    const wobble = (dv * (1 - Math.exp(-4 * elapsed))) / 4 - (dv / 4) * (elapsed / clockTotal);
    return approachStart + rideSpeedGoal * elapsed + wobble;
  };

  const nitroEffects = (delta: number) => {
    exhaustIn -= delta;
    if (exhaustIn <= 0) {
      exhaustIn = 0.02;
      const p = active().bike.exhaust;
      effects.exhaust(p.x, p.y, speed, true);
      effects.exhaust(p.x, p.y, speed, true);
    }
  };

  /** How far to drop the camera so a bike or rider that has fallen into a pit stays in view. */
  const panFor = (f: Frame) => {
    const lowest = Math.min(
      f.bike.visible ? f.bike.y : 9,
      f.rider.mode === 'free' && f.rider.visible ? f.rider.y - 0.6 : 9,
    );
    return MathUtils.clamp((0.6 - lowest) * 0.85, 0, 4.4);
  };

  const stepWorld = (delta: number, elapsed: number) => {
    if (phase !== 'stunt' && !(phase === 'result' && !respawnStarted)) panGoal = 0;
    // --- The ride, by phase ---
    const pair = active();
    switch (phase) {
      case 'countdown':
      case 'preview':
        break;
      case 'riding': {
        if (clockRunning) {
          runClock(delta);
          const x = Math.min(clockPosition(), originX);
          const moved = Math.max(x - bikeX, 0);
          bikeX = x;
          speed = delta > 0 ? moved / delta : speed;
        } else {
          speed = easeToward(speed, rideSpeedGoal, 2.5, delta);
          bikeX += speed * delta;
        }
        break;
      }
      case 'nitro': {
        const remaining = Math.max(originX - bikeX, 0);
        // The nitro never lets up until the last few units, so the stunt starts about two seconds on.
        const goal = Math.max(nitroSpeed(remaining), Math.min(remaining / 0.3, NITRO_MAX));
        speed = easeToward(speed, goal, 8, delta);
        bikeX = Math.min(bikeX + speed * delta, originX);
        nitroEffects(delta);
        if (bikeX >= originX - 1e-6)
          startStunt(chosen >= 0 && options[chosen] === fact?.answer ? 'clear' : 'crash');
        break;
      }
      default:
        break;
    }

    // --- The bike and rider ---
    if (phase === 'stunt' && stunt) {
      stepStunt(stunt, delta * stunt.scale);
      stuntFrame(stunt.kind, stunt.outcome, stunt.variant, stunt.t, frame);
      applyFrame(pair, frame, originX, delta);
      panGoal = panFor(frame);
      bikeX = originX + frame.bike.x;
      obstacle?.update(stunt.outcome, stunt.variant, stunt.t);
      if (stunt.t >= stunt.duration) finishStunt(stunt);
    } else if (phase === 'result' || phase === 'respawn') {
      // Until the parachute opens the crashed bike lies where it ended.
      if (respawnStarted && !respawnDone) respawnT += delta;
      if (!respawnStarted) {
        // nothing to pose yet
      } else if (!respawnDone) {
        const u = MathUtils.clamp(respawnT / RESPAWN_TIME, 0, 1);
        const y = MathUtils.lerp(10, BIKE_Y, 1 - (1 - u) ** 2);
        pair.bike.object.position.set(respawnX, y, 0);
        pair.bike.object.rotation.set(0, 0, 0.06 * Math.sin(respawnT * 3) * (1 - u));
        parachute.object.position.set(respawnX, y, 0);
        parachute.object.scale.setScalar(u < 1 ? 1 : 0.01);
        pair.rider.setPose('ride');
        if (u >= 1) {
          endRespawn();
          if (phase === 'respawn') advance();
        }
      } else {
        rideAt(pair, bikeX, 'wave', delta);
      }
    } else if (phase === 'ending') {
      // The last bike lies where it crashed.
    } else if (phase !== 'done') {
      const pose =
        phase === 'preview' || phase === 'countdown' ? 'wave' : phase === 'nitro' ? 'duck' : 'ride';
      rideAt(pair, bikeX, pose, delta);
      if (phase === 'riding' || phase === 'nitro') {
        const bob = Math.sin(elapsed * 25) * 0.015 * Math.min(speed / 6, 1.5);
        pair.bike.object.position.y = BIKE_Y + bob;
      }
    }

    if (phase === 'done') {
      // Waiting at the results screen: the bike idles and waves.
      rideAt(pair, bikeX, 'wave', delta);
    }

    // --- The speed, for the next frame ---
    if (phase === 'riding' && !clockRunning) {
      // already integrated above
    }

    // --- Exhaust puffs ---
    if ((phase === 'riding' || phase === 'countdown') && speed > 1) {
      exhaustIn -= delta;
      if (exhaustIn <= 0) {
        exhaustIn = 0.1;
        pair.bike.update();
        effects.exhaust(pair.bike.exhaust.x, pair.bike.exhaust.y, speed, false);
      }
    }
    pair.bike.update();

    // --- Coins ---
    const collecting = phase === 'riding' || phase === 'nitro';
    updateCoins(delta, elapsed, collecting);

    // --- Shadow ---
    const b = pair.bike.object;
    const grounded = b.position.y < 1.2 && phase !== 'ending' && b.visible;
    const onPit = cuts().some(([from, to]) => b.position.x > from && b.position.x < to);
    world.setShadow(
      b.position.x,
      grounded && !onPit && !(phase === 'stunt' && frame.bike.y < 0),
      1,
    );
  };

  /** Points the camera at the road beside the bike, shaken by (dx, dy). */
  const aimCamera = (dx: number, dy: number) => {
    camera.position.set(camX + dx, fit.camY - camPan + dy, fit.distance);
    camera.lookAt(camX, fit.camY - camPan, 0);
    camera.updateMatrixWorld();
    effects.setScale(
      (ctx.renderer.getPixelRatio() * viewH) / (2 * Math.tan((camera.fov * Math.PI) / 360)),
    );
  };

  ctx.onUpdate((delta, elapsed) => {
    layout();
    gameTime += delta;
    const due = pending.filter((p) => p.at <= gameTime);
    if (due.length) {
      pending = pending.filter((p) => p.at > gameTime);
      due.forEach((p) => p.fn());
    }
    if (bannerUntil > 0 && gameTime >= bannerUntil) {
      bannerUntil = 0;
      hud.hideBanner();
    }

    if (lab) stepLab(delta, elapsed);
    else stepWorld(delta, elapsed);

    // The road strip and the nitro.
    if (!lab) {
      if (phase === 'riding' || phase === 'nitro') {
        const progress = clockRunning
          ? approachProgress(clockLeft, clockTotal)
          : obstaclePlaced
            ? MathUtils.clamp((bikeX - approachStart) / Math.max(approachGap, 1), 0, 1)
            : 0;
        hud.setRoad(progress, {
          urgent: clockRunning && clockLeft / clockTotal < 0.4,
          waiting: phase === 'riding' && !clockRunning,
        });
      }
    }
    nitroAmount = easeToward(
      nitroAmount,
      phase === 'nitro' || (lab && dev?.nitro && phase === 'riding') ? 1 : 0,
      6,
      delta,
    );

    // Obstacles' idle motion, and the ones left behind.
    for (const l of live) l.obstacle.ambient(elapsed);
    retireFar();
    world.update(camX, cuts(), delta, fit.distance, fit.camY);
    effects.update(delta);
    for (const pair of pairs) pair.rider.update(delta, elapsed);

    // --- Camera: follows the bike, eased so stunts are followed smoothly ---
    const goal =
      (phase === 'result' || phase === 'respawn') && respawnStarted && !respawnDone
        ? respawnX
        : phase === 'stunt' || phase === 'result' || phase === 'ending'
          ? focus.x
          : bikeX;
    const camGoal = goal + fit.viewW * (0.5 - 0.28);
    camX = easeToward(camX, camGoal, phase === 'stunt' || phase === 'nitro' ? 6 : 5, delta);
    if (!Number.isFinite(camX) || Math.abs(camX - camGoal) > 400) camX = camGoal;
    shake = easeToward(shake, 0, 3.5, delta);
    camPan = easeToward(camPan, panGoal, 4, delta);
    const fov = FOV + 6 * nitroAmount;
    if (Math.abs(camera.fov - fov) > 0.02) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    aimCamera(Math.sin(elapsed * 61) * shake * 0.18, Math.sin(elapsed * 73 + 1) * shake * 0.18);
  });

  // ---------- The stunt lab (dev only) ----------
  let labState: { stunt: Stunt; phase: 'ride' | 'play' | 'hold'; t: number; x: number } | null =
    null;
  function stepLab(delta: number, elapsed: number) {
    if (!lab) return;
    const pair = active();
    if (!labState) {
      originX = 40;
      kind = lab.kind;
      obstacle = pool.get(kind);
      obstacle.reset();
      obstacle.object.position.set(originX, 0, 0);
      scene.add(obstacle.object);
      obstacle.object.visible = true;
      live.push({ obstacle, originX });
      labState = {
        stunt: makeStunt(lab.kind, lab.outcome, lab.variant),
        phase: dev?.at !== null && dev?.at !== undefined ? 'hold' : 'ride',
        t: 0,
        x: originX - (dev?.nitro ? 24 : 12),
      };
      pair.bike.object.visible = true;
      phase = 'riding';
      hud.setTopVisible(false, 0);
      if (dev?.at !== null && dev?.at !== undefined) scrubLab(dev.at);
    }
    const s = labState;
    if (s.phase === 'hold') {
      // Frozen for screenshots: the stunt is posed at `at` and nothing advances.
      ctx.renderer.domElement.dataset.frozen = '1';
      applyFrame(pair, frame, originX, 0);
      obstacle?.update(s.stunt.outcome, s.stunt.variant, s.stunt.t);
      camX = focus.x + fit.viewW * (0.5 - 0.28);
      bikeX = originX + frame.bike.x;
      panGoal = camPan = panFor(frame);
      return;
    }
    if (s.phase === 'ride') {
      const fast = dev?.nitro;
      speed = fast ? 30 : ENTRY_SPEED;
      s.x += speed * delta;
      bikeX = s.x;
      if (fast) nitroEffects(delta);
      hud.speedLines(!!fast);
      rideAt(pair, s.x, fast ? 'duck' : 'ride', delta);
      if (s.x >= originX) {
        s.phase = 'play';
        s.stunt = makeStunt(lab.kind, lab.outcome, lab.variant);
        hud.speedLines(false);
      }
    } else if (s.phase === 'play') {
      stunt = s.stunt;
      stepStunt(s.stunt, delta);
      stuntFrame(s.stunt.kind, s.stunt.outcome, s.stunt.variant, s.stunt.t, frame);
      applyFrame(pair, frame, originX, delta);
      bikeX = originX + frame.bike.x;
      obstacle?.update(s.stunt.outcome, s.stunt.variant, s.stunt.t);
      if (s.stunt.t >= s.stunt.duration) {
        s.phase = 'hold';
        s.t = 0;
        stunt = null;
        after(1.2, () => {
          if (!labState) return;
          labState.phase = 'ride';
          labState.x = originX - 12;
          obstacle?.reset();
          effects.clear();
          pair.rider.setMode('seated', pair.bike.seat, scene);
          pair.bike.object.visible = true;
          hud.hideWord();
          speed = 0;
        });
      }
    }
    void elapsed;
  }

  /** Plays the lab stunt up to `at` seconds in one go, so effects and props are where they would be. */
  function scrubLab(at: number) {
    if (!labState || !lab) return;
    const s = makeStunt(lab.kind, lab.outcome, lab.variant);
    effects.clear();
    // Aim the camera first, so the comic word lands where the bike will be.
    stuntFrame(s.kind, s.outcome, s.variant, Math.min(at, s.duration), frame);
    applyFrame(active(), frame, originX, 0);
    camX = focus.x + fit.viewW * (0.5 - 0.28);
    camPan = panFor(frame);
    aimCamera(0, 0);
    const step = 1 / 30;
    for (let t = 0; t < at; t += step) {
      stepStunt(s, Math.min(step, at - t));
      effects.update(Math.min(step, at - t));
    }
    labState.stunt = s;
    stuntFrame(s.kind, s.outcome, s.variant, s.t, frame);
  }

  // ---------- Start ----------
  layout();
  hud.setTopVisible(false, 0);
  setScoreHud();
  camX = 0;
  ctx.start();
  if (lab) {
    startRun(false);
    pending = [];
    hud.showCount(null);
    hud.setTopVisible(false, 0);
    phase = 'riding';
  } else {
    startRun(true);
  }

  window.addEventListener('pagehide', () => {
    stopSpeaking();
    window.removeEventListener('keydown', onKey);
    stopPointer();
    unpress.forEach((fn) => fn());
    pause.dispose();
    mute.dispose();
    hud.dispose();
    effects.dispose();
    for (const pair of pairs) {
      pair.rider.dispose();
      pair.bike.dispose();
    }
    parachute.dispose();
    pool.dispose();
    world.dispose();
    coinGeometry.dispose();
    coinMaterial.dispose();
    ctx.dispose();
  });
}

const session = startGameSession(GAME_ID);
if (session) run(session, devOptions());
else location.replace(menuUrl());
