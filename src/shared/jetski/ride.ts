import { CylinderGeometry, MathUtils, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { sfx, speak, stopSpeaking, unlockAudio } from '../audio';
import { createPointerInput } from '../input';
import { createScene } from '../scene';
import { createTimers } from '../timers';
import { createBackButton, createMuteButton, createPauseOverlay } from '../ui';
import { swell } from './anim';
import { createCloud, createDolphin, createEgg, createTail, type Dolphin } from './critters';
import type { Lab, RideDev } from './dev';
import { createEffects, type EffectKind } from './effects';
import { createHud, type Hud } from './hud';
import { createJetSki, createRescueBoat, type JetSki } from './jetski';
import { createLauncherPool, type Launcher } from './launchers';
import {
  SWING_IN,
  SWING_OUT,
  bandShift,
  blendCam,
  chasePose,
  createPose,
  followSide,
  fovFor,
  playBand,
  bandFraction,
  framingMid,
  stuntDistance,
  stuntLookD,
  stuntPose,
  type Framing,
} from './layout';
import {
  MEGA_SPECS,
  megaDuration,
  megaEvents,
  megaFramingAt,
  megaLocate,
  megaLookBias,
  megaFrame,
  megaLength,
  megaRate,
  megaWordAt,
} from './mega/mega';
import {
  GATE_HEIGHT,
  createGate,
  createMegaCoursePool,
  type Gate,
  type MegaCourse,
} from './mega/mega-props';
import { createRider } from './rider';
import {
  COIN_GAP,
  COIN_POINTS,
  GATE_BEAT,
  MEGA_BANNER,
  MEGA_BONUS,
  MEGA_CLEARED_BEAT,
  MEGA_PIECES,
  WIPE_SECONDS,
  WORLD_MEGA,
  WORLD_NAMES,
  WORLD_ORDER,
  WORLD_TITLE_SECONDS,
  COIN_Y,
  ENTRY_SPEED,
  OUT_OF_SKIS_SPEECH,
  RIDE_SPEED,
  SKIS,
  TIER_LAUNCHER,
  TRAIL_MIN_GAP,
  TRICK_TIER,
  TURBO_MAX,
  approach,
  approachProgress,
  coinSide,
  easeToward,
  hitPoints,
  loseSki,
  meterFill,
  nextStreak,
  nextTrick,
  nextWorld,
  outOfSkis,
  startsMega,
  tierFor,
  trailLength,
  turboSpeed,
  worldSpeedFactor,
  type MegaId,
  type Outcome,
  type Passed,
  type Tier,
  type TrickId,
  type WorldId,
} from './rules';
import {
  LAUNCHERS,
  RESPAWN_TIME,
  createFrame,
  createRespawnFrame,
  respawnFrame,
  trickDuration,
  trickEvents,
  focusOf,
  trickFraming,
  trickFrame,
  trickRate,
  trickWord,
  TRICK_SPECS,
  type Frame,
  type TrickEvent,
} from './tricks';
import { createWater } from './water';
import { createWorld, type World } from './world';

/** The framing once a trick is over: the wreck, the boat and the rider climbing back on. */
const RESULT_FRAMING: Framing = { peak: 3.5, low: -1.2 };

/** Seconds a trick runs before a tap can fast-forward it. */
const FAST_FORWARD_AFTER = 0.6;
/** Seconds each step of the 3, 2, 1, Go! lasts. */
const COUNT_STEP = 0.75;
/** How fast a trick plays after a tap. */
const FAST_FORWARD = 3;
/** Seconds into the result before the lifeguard boat comes. */
const RESPAWN_DELAY = 0.6;

/** Seconds the ride waits before it finishes when the driver has nothing to say or tap. */
const ENDING_WAIT = 1.5;

export type Phase =
  'preview' | 'countdown' | 'riding' | 'turbo' | 'stunt' | 'result' | 'ending' | 'done';

/** What the ski is riding to in the turn that is starting. `piece` is 1 to 3 in a Mega, else 0. */
export interface RideTurn {
  target: 'launcher' | 'gate';
  tier: Tier;
  piece: number;
}

/**
 * What the game puts on the ride: the prompt of each turn and what happens after a miss and at
 * the end. A quiz (Splash Zone) asks facts; a typing game shows a block of keys. The ride calls
 * these; the driver answers through `Ride.answer`, `startClock` and `proceed`.
 */
export interface RideDriver {
  /** Page load only: show anything that comes before the ride; `go()` starts the 3, 2, 1. */
  intro(go: () => void): void;
  /** Puts the prompt up and calls `ride.startClock(seconds)` once the player may start. */
  beginTurn(turn: RideTurn): void;
  /** The clock ran out: lock input. */
  timeUp(): void;
  /** A wipeout (or a time-out) result is showing: what it says, and whether it waits for a tap. */
  afterMiss(info: { timedOut: boolean }): { detail: string; wait: boolean };
  /**
   * The last jet ski is gone. With `wait` the ride holds until `ride.proceed()`; without it, the
   * ride speaks `say` and finishes when it ends, or finishes after 1.5 s with no `say`.
   */
  ending(): { detail: string; wait: boolean; say?: string };
  /** The run is over: show the results; `again()` starts a new run. */
  finish(score: number, again: () => void): void;
  /** After the world title, before the next turn: call `resume()` to go on. */
  betweenWorlds?(resume: () => void): void;
  /** Drops whatever the driver has armed (a tap flow); the ride calls it where a turn is cut off. */
  cancel(): void;
  /** Once per frame. */
  frame?(delta: number): void;
  dispose(): void;
}

export interface Ride {
  hud: Hud;
  readonly phase: Phase;
  readonly clockLeft: number;
  readonly clockTotal: number;
  /** The game is paused (the pause overlay is up). */
  readonly paused: boolean;
  /**
   * Sets this turn's time without starting the clock, so an answer before the clock starts
   * counts as full time and rides the gap that time gives.
   */
  setClock(seconds: number): void;
  /** Starts the clock (and the ski's approach): it arrives as `seconds` run out. */
  startClock(seconds: number): void;
  /** The player's answer: lands the trick (or lights the gate) when right, a wipeout when wrong. */
  answer(right: boolean, opts?: { resetStreak?: boolean }): void;
  /** After a wait: on from a miss, or from the ending to `finish`. */
  proceed(): void;
  /** Fast-forwards a stunt. */
  skip(): void;
  /** The ride's pausable scheduler. */
  after(seconds: number, fn: () => void): void;
  /** Every award (points, coins, the Mega bonus) is multiplied by n; 1 by default. */
  setMultiplier(n: number): void;
  readonly score: number;
  readonly streak: number;
}

export interface RideOptions {
  avatar: string;
  driver: RideDriver;
  dev: RideDev | null;
  highScore: () => number;
  /** false: no answer grid or 🔊 button. */
  answers: boolean;
  /** Pixels kept clear at the bottom of the screen (a game's own strip, in place of the answers). */
  bottomInset?: () => number;
}

/** A trick, a wipeout or a Mega course being played: they all step the same way. */
interface Stunt {
  /** The trick being played; null for a Mega course. */
  trick: TrickId | null;
  mega: boolean;
  outcome: Outcome;
  t: number;
  duration: number;
  events: TrickEvent[];
  next: number;
  scale: number;
  /** d of the end of what it plays on (the trick's landing, or the whole Mega course). */
  length: number;
  /** What the stunt camera has to fit at a stunt time, and where it looks first (Infinity: it just follows). */
  framingAt(t: number): Framing;
  lipD: number;
  /** A Mega course: how far ahead of the ski (course d) the camera looks, towards the element it is on. */
  lookBias?(d: number): number;
  /** A Mega course: which element is playing at a time, so a word never outlives its element. */
  segmentAt?(t: number): number;
  seg: number;
  frameAt(t: number, out: Frame): void;
  /** Playback rate at a stunt time: 1 normally, slower in slow motion. */
  rateAt(t: number): number;
  /** The comic word at a time, and whether it is a good one. */
  wordAt(t: number): { text: string; good: boolean };
  /** Poses the props that belong to the stunt (a Mega course's whale, ferry or bridge). */
  propsAt?(t: number): void;
}

/** Where a Mega Stunt has got to: its questions up front, then the long stunt. */
interface MegaRun {
  id: MegaId;
  /** Questions answered right before the first miss. */
  passed: number;
  /** Questions asked so far. */
  asked: number;
  /** A miss or a time-out stopped the questions. */
  ended: boolean;
  /** Whether the miss that stopped the questions was a time-out. */
  timedOut: boolean;
}

/** What the ski is riding to: a launcher, a checkpoint gate or the Mega course. */
type Target = 'launcher' | 'gate' | 'course';

/** How far ahead the Mega course waits when the questions are over (u). */
const COURSE_GAP = 120;

const EFFECT_KINDS: readonly string[] = [
  'spray',
  'splash',
  'bigSplash',
  'bubbles',
  'drips',
  'stars',
  'confetti',
];

export function createRide(container: HTMLElement, o: RideOptions): Ride {
  const { avatar, driver, dev } = o;
  const lab: Lab | null = dev?.lab ?? null;

  // ---------- Scene ----------
  const ctx = createScene(container, { fov: 52, near: 0.3, far: 420 });
  const { scene, camera } = ctx;
  let worldId: WorldId = dev?.world ?? 'lagoon';
  let world: World = createWorld(scene, worldId);
  const water = createWater(world.water);
  scene.add(water.object);
  const effects = createEffects();
  scene.add(effects.object);
  const launchers = createLauncherPool();
  for (const kind of ['wave', 'kicker', 'mega-ramp'] as const) {
    scene.add(launchers.get(kind).object);
  }
  // Three checkpoint gates and the Mega courses, built once and reused by every Mega Stunt.
  const megaPool = createMegaCoursePool();
  const gates: Gate[] = Array.from({ length: MEGA_PIECES }, (_, i) => {
    const gate = createGate(i + 1);
    scene.add(gate.object);
    return gate;
  });

  const skis: [JetSki, JetSki] = [createJetSki(), createJetSki()];
  for (const ski of skis) scene.add(ski.object);
  skis[1].object.visible = false;
  let activeIndex = 0;
  const active = () => skis[activeIndex];
  const rider = createRider(avatar);
  rider.setMode('seated', skis[0].seat, scene);
  const boat = createRescueBoat();
  scene.add(boat.object);
  boat.object.visible = false;
  const dolphins: [Dolphin, Dolphin] = [createDolphin(), createDolphin()];
  for (const d of dolphins) {
    d.object.visible = false;
    scene.add(d.object);
  }

  const cloud = createCloud();
  scene.add(cloud.object);
  const tail = createTail();
  scene.add(tail.object);
  const egg = createEgg();
  scene.add(egg.object);

  // Coins in trails.
  const coinMaterial = new MeshStandardMaterial({
    color: 0xffd43b,
    emissive: 0xc88a00,
    emissiveIntensity: 0.7,
    roughness: 0.35,
    metalness: 0.15,
  });
  const coinGeometry = new CylinderGeometry(0.4, 0.4, 0.1, 20);
  coinGeometry.rotateX(Math.PI / 2);
  const coins = Array.from({ length: 24 }, () => {
    const mesh = new Mesh(coinGeometry, coinMaterial);
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  });

  // ---------- HUD ----------
  const hud = createHud(avatar, { answers: o.answers });
  if (lab) document.body.classList.add('sz-lab');
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
  /** How the turn that is riding to its target was answered: right, wrong, or not yet (a time-out stays null). */
  let answeredRight: boolean | null = null;
  let score = 0;
  let streak = 0;
  let multiplier = 1;
  let skisLeft = dev?.skis ?? SKIS;
  let landed = 0;
  let lastTrick: TrickId | null = null;
  let devTrickIndex = 0;
  /** Ticks up for each question, so late callbacks can tell they are stale. */
  let turn = 0;
  let gameTime = 0;
  const timers = createTimers();
  const after = timers.after;
  let timedOut = false;

  // The question and its approach.
  let trick: TrickId = 'wave-hop';
  let tier: Tier = 1;
  let launcher: Launcher | null = null;
  // The Mega Stunt in progress, and the count towards the next one.
  let mega: MegaRun | null = null;
  let target: Target = 'launcher';
  let course: MegaCourse | null = null;
  /** The stunt has posed the course's props: they stay as it left them, so no idle motion on top. */
  let courseHeld = false;
  let normals = 0;
  let nextIsMega = dev?.mega ?? false;
  let worldChangePending = false;
  let entryZ = 0;
  let approachGap = 0;
  let approachStartZ = 0;
  let rideSpeedGoal = RIDE_SPEED;
  let startSpeed = 0;
  let clockLeft = 0;
  let clockTotal = 1;
  let clockRunning = false;
  let launcherPlaced = false;
  let lastTick = 0;
  let pendingPoints = 0;
  let stunt: Stunt | null = null;

  // The ski, in the world.
  let skiX = 0;
  let skiZ = 0;
  let speed = 0;
  let prevSkiX = 0;
  let lean = 0;
  let wetSki = true;

  // The camera.
  const chase = createPose();
  const stuntCam = createPose();
  const blended = createPose();
  let camSide = 0;
  let camW = 0;
  let camGoal = 0;
  const focus = new Vector3();
  const camFocus = new Vector3();
  // What the stunt view frames: how high and low the trick goes, and where its launcher's lip is.
  let camStunt: Stunt | null = null;
  let followTrick = false;
  let camMid = framingMid(RESULT_FRAMING);
  let camDist = 12;
  const look = new Vector3();
  let shake = 0;
  let turboAmount = 0;
  let wakeIn = 0;
  let coinIn = 1;

  const frame: Frame = createFrame();
  const point = new Vector3();

  // The respawn.
  const rf = createRespawnFrame();
  let respawnT = 0;
  let respawnStarted = false;
  let respawnDone = true;
  let respawnSkiD = 0;
  let respawnRiderD = 0;
  let respawnRiderS = 0;
  const failEnd: Frame = createFrame();
  let oldIndex = 1;

  // ---------- Layout ----------
  let viewW = 0;
  let viewH = 0;
  let viewInset: number | undefined;
  const layout = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    const inset = o.bottomInset?.();
    if (w === viewW && h === viewH && inset === viewInset) return;
    viewW = w;
    viewH = h;
    viewInset = inset;
    camera.aspect = w / Math.max(h, 1);
    camera.fov = fovFor(camera.aspect);
    camera.setViewOffset(w, h, 0, bandShift(w, h, inset), w, h);
    camera.updateProjectionMatrix();
  };

  const toScreen = (x: number, y: number, z: number) => {
    const p = point.set(x, y, z).project(camera);
    const band = playBand(viewW, viewH, viewInset);
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

  const setScoreHud = (pulse = false) => hud.setScore(score, Math.max(o.highScore(), 0), pulse);

  /** Puts the target (a launcher, the question's gate or the Mega course) `gap` ahead of the ski. */
  const placeTarget = (gap: number) => {
    launcherPlaced = true;
    approachGap = gap;
    approachStartZ = skiZ;
    entryZ = skiZ - gap;
    launchers.hideAll();
    launcher = null;
    course = null;
    if (target === 'gate' && mega) {
      const gate = gates[Math.max(mega.asked - 1, 0)];
      gate.object.position.set(0, 0, entryZ);
      gate.object.visible = true;
    } else if (target === 'course' && mega) {
      course = megaPool.get(mega.id);
      if (course.object.parent !== scene) scene.add(course.object);
      course.reset();
      courseHeld = false;
      course.object.position.set(0, 0, entryZ);
      course.object.visible = true;
    } else {
      launcher = launchers.get(TIER_LAUNCHER[tier]);
      launcher.object.position.set(0, 0, entryZ);
      launcher.object.visible = true;
    }
  };

  /** Hides the gates and the Mega course (a new world, a new run). */
  const clearMegaProps = () => {
    gates.forEach((gate) => {
      gate.reset();
      gate.object.visible = false;
    });
    if (course) course.object.visible = false;
    course = null;
  };

  /** The nearest thing a reader would call the action on screen, for the comic words. */
  const focusScreen = (dy = 2.2) => toScreen(focus.x, focus.y + dy, focus.z);

  /** Where the comic word goes: above the action, or below it when there is no room up there. */
  const wordScreen = () => {
    const p = toScreen(focus.x, focus.y, focus.z);
    const band = playBand(viewW, viewH, viewInset);
    const above = p.y - 100;
    return { x: p.x, y: above >= band.top + 30 ? above : Math.min(p.y + 100, band.bottom - 30) };
  };

  // ---------- Posing the ski and the rider ----------
  /** Puts the ski and rider where a trick frame says (launcher-local, `entryZ` as the origin). */
  const applyFrame = (f: Frame, time: number) => {
    const k = f.ski;
    const ski = active();
    const x = k.s;
    const z = entryZ - k.d;
    ski.object.visible = k.visible;
    ski.object.rotation.order = 'YXZ';
    ski.object.position.set(x, k.y + (k.wet ? swell(x, z, time) : 0), z);
    ski.object.rotation.set(k.pitch, k.yaw, -k.roll);
    wetSki = k.wet && k.y < 0.6;
    const r = f.rider;
    if (rider.mode !== r.mode) rider.setMode(r.mode, ski.seat, scene);
    rider.setPose(r.pose);
    rider.setFace(r.face);
    rider.setProps(r.props.seaweed, r.props.fish);
    rider.setVisible(r.visible && (r.mode === 'free' || k.visible));
    if (r.mode === 'free') rider.place(r.s, r.y, entryZ - r.d, r.pitch, r.roll, r.yaw);
    f.dolphins.forEach((d, i) => {
      const dolphin = dolphins[i];
      dolphin.object.visible = d.visible;
      if (!d.visible) return;
      dolphin.object.position.set(d.s, d.y, entryZ - d.d);
      dolphin.pose(d.phase);
    });
    cloud.object.visible = f.cloud.visible;
    if (f.cloud.visible) {
      cloud.object.position.set(f.cloud.s, f.cloud.y, entryZ - f.cloud.d);
      cloud.pose(f.cloud.scale);
    }
    tail.object.visible = f.tail.visible;
    if (f.tail.visible) {
      tail.object.position.set(f.tail.s, f.tail.y, entryZ - f.tail.d);
      tail.pose(f.tail.rise, f.tail.swing);
    }
    egg.object.visible = f.egg.visible;
    if (f.egg.visible) {
      egg.object.position.set(f.egg.s, f.egg.y, entryZ - f.egg.d);
      egg.pose(f.egg.scale, f.egg.crack, f.egg.hatch, f.egg.shut);
    }
    // The camera follows the ski, or the middle of the ski and a rider thrown clear of it.
    const target = focusOf(f);
    focus.set(target.s, target.y, entryZ - target.d);
    skiX = x;
    skiZ = z;
  };

  /** The ski riding along the water at (x, z) with the rider in `pose`. */
  const rideAt = (x: number, z: number, pose: Frame['rider']['pose'], dt: number, time: number) => {
    const ski = active();
    const vx = dt > 0 ? (x - prevSkiX) / dt : 0;
    prevSkiX = x;
    lean = easeToward(lean, MathUtils.clamp(vx * 0.07, -0.25, 0.25), 8, dt);
    const trim = 0.02 + 0.06 * MathUtils.clamp(speed / 20, 0, 1);
    ski.object.visible = true;
    ski.object.rotation.order = 'YXZ';
    ski.object.position.set(x, swell(x, z, time) + 0.03, z);
    ski.object.rotation.set(
      trim + Math.sin(time * 2.1) * 0.015,
      0,
      -lean + Math.sin(time * 1.7) * 0.01,
    );
    if (rider.mode !== 'seated') rider.setMode('seated', ski.seat, scene);
    rider.setPose(pose);
    rider.setFace('happy');
    rider.setProps(false, false);
    rider.setVisible(true);
    wetSki = true;
    focus.set(x, 0, z);
  };

  // ---------- Run flow ----------
  const updateTier = (pulse = false) => hud.setTier(meterFill(streak), pulse);

  const startRun = (withPreview: boolean) => {
    timers.clear();
    turn++;
    driver.cancel();
    score = 0;
    streak = dev?.streak ?? 0;
    skisLeft = dev?.skis ?? SKIS;
    landed = 0;
    lastTrick = null;
    devTrickIndex = 0;
    answeredRight = null;
    stunt = null;
    clockRunning = false;
    launcherPlaced = false;
    launchers.hideAll();
    launcher = null;
    mega = null;
    target = 'launcher';
    normals = 0;
    nextIsMega = dev?.mega ?? false;
    worldChangePending = false;
    clearMegaProps();
    hud.setMega(0, 0);
    hud.wipe('idle');
    hud.hideWorldTitle();
    setWorld(dev?.world ?? 'lagoon');
    effects.clear();
    coins.forEach((c) => (c.visible = false));
    world.setShadow(0, 0, 0, 0);
    world.setShadow(1, 0, 0, 0);
    boat.object.visible = false;
    activeIndex = 0;
    skis[1].object.visible = false;
    skis[0].object.visible = true;
    rider.setMode('seated', skis[0].seat, scene);
    rider.setFace('happy');
    rider.setProps(false, false);
    rider.setVisible(true);
    water.clearWake();
    skiX = prevSkiX = 0;
    entryZ = skiZ;
    speed = 0;
    turboAmount = 0;
    respawnDone = true;
    respawnStarted = false;
    camGoal = 0;
    camW = 0;
    hud.setSkis(skisLeft);
    hud.setTier(meterFill(streak));
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
    driver.intro(startCountdown);
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

  /** The next turn: a Mega Stunt after seven normal ones in a world, else the next trick. */
  const askNext = () => {
    if (phase === 'ending' || phase === 'done') return;
    timers.clear();
    driver.cancel();
    stopSpeaking();
    hud.hideWord();
    hud.hideBanner();
    if (mega === null && (nextIsMega || startsMega(normals))) {
      nextIsMega = false;
      beginMega();
      return;
    }
    askPiece();
  };

  /**
   * A Mega Stunt: three questions up front, each ridden to a checkpoint gate, then one long
   * course that clears as many elements as were right and wipes out on the next.
   */
  const beginMega = () => {
    const id = WORLD_MEGA[worldId];
    mega = { id, passed: 0, asked: 0, ended: false, timedOut: false };
    target = 'gate';
    clearMegaProps();
    hud.setMega(MEGA_PIECES, 0);
    hud.setLauncher('gate');
    phase = 'riding';
    clockRunning = false;
    launcherPlaced = false;
    rideSpeedGoal = RIDE_SPEED * worldSpeedFactor(landed);
    hud.setTopVisible(false, 0);
    hud.showBanner('MEGA STUNT!', MEGA_SPECS[id].title, 'warn');
    sfx.alarm();
    const thisTurn = ++turn;
    after(MEGA_BANNER, () => {
      if (turn !== thisTurn) return;
      hud.hideBanner();
      askPiece();
    });
  };

  /**
   * Picks the trick (a normal turn), shows the question and reads it out. In a Mega Stunt the
   * target is that question's gate and there is no trick.
   */
  const askPiece = () => {
    if (phase === 'ending' || phase === 'done') return;
    // The tier is fixed now, from the streak before the question, so the launcher on screen always
    // matches the trick that plays and the points it pays.
    if (mega) {
      mega.asked++;
      target = 'gate';
      tier = tierFor(streak);
    } else {
      normals++;
      target = 'launcher';
      if (dev && dev.tricks.length > 0) {
        trick = dev.tricks[devTrickIndex++ % dev.tricks.length];
        tier = TRICK_TIER[trick];
      } else {
        tier = tierFor(streak);
        trick = nextTrick(tier, lastTrick, Math.random());
      }
    }
    ++turn;
    answeredRight = null;
    timedOut = false;
    pendingPoints = 0;
    hud.setLauncher(mega ? 'gate' : TIER_LAUNCHER[tier]);
    hud.setMega(mega ? MEGA_PIECES : 0, mega?.passed ?? 0);
    clockTotal = 1;
    clockLeft = clockTotal;
    clockRunning = false;
    launcherPlaced = false;
    rideSpeedGoal = RIDE_SPEED * worldSpeedFactor(landed);
    phase = 'riding';
    hud.setWake(0, { urgent: false, waiting: true });
    // The driver puts the prompt up and starts the clock once the player may begin.
    driver.beginTurn({ target: mega ? 'gate' : 'launcher', tier, piece: mega?.asked ?? 0 });
  };

  const setClock = (seconds: number) => {
    if (clockRunning || launcherPlaced) return;
    clockTotal = Math.max(seconds, 1);
    clockLeft = clockTotal;
  };

  const startClock = (seconds: number) => {
    if (phase !== 'riding' || clockRunning || launcherPlaced) return;
    setClock(seconds);
    const ap = approach(landed, clockTotal);
    placeTarget(ap.gap);
    rideSpeedGoal = ap.rideSpeed;
    startSpeed = speed;
    clockRunning = true;
    lastTick = Math.ceil(clockLeft);
    coinIn = 0.2;
    // Coins that were out there already must not sit across the launcher.
    for (const coin of coins)
      if (coin.visible && coin.position.z < entryZ + TRAIL_MIN_GAP) coin.visible = false;
  };

  /** The player's answer (the driver has done its own half): the ride half of picking an answer. */
  const answer = (right: boolean, opts: { resetStreak?: boolean } = {}) => {
    if (phase !== 'riding') return;
    // If the prompt is still being read the clock has not started: the answer counts as full time.
    if (!launcherPlaced) placeTarget(approach(landed, clockTotal).gap);
    clockRunning = false;
    answeredRight = right;
    if (right) {
      streak = opts.resetStreak ? 0 : nextStreak(streak, true);
      pendingPoints = hitPoints(clockLeft, clockTotal, tier) * multiplier;
    } else {
      streak = nextStreak(streak, false);
    }
    setScoreHud();
    // Turbo to the launcher.
    phase = 'turbo';
    coinIn = 0;
    sfx.rev();
    hud.speedLines(true);
  };

  /** The clock ran out: the ski arrives and wipes out. */
  const timeUp = () => {
    clockRunning = false;
    clockLeft = 0;
    answeredRight = null;
    timedOut = true;
    streak = nextStreak(streak, false);
    driver.timeUp();
    setScoreHud();
    // At a gate the ski has just arrived and rides on; at a launcher it wipes out.
    if (target === 'gate') passGate(false);
    else startStunt('fail');
  };

  // ---------- Mega Stunt: gates and the course ----------
  /** The ski reaches a gate: its light shows whether the answer was right, and the ride goes on. */
  const passGate = (right: boolean) => {
    const m = mega;
    if (!m) return;
    const gate = gates[Math.max(m.asked - 1, 0)];
    const thisTurn = turn;
    hud.speedLines(false);
    phase = 'riding';
    clockRunning = false;
    if (right) {
      m.passed++;
      gate.setState('pass');
      hud.setMega(MEGA_PIECES, m.passed);
      sfx.chime();
      effects.sparkle(0, GATE_HEIGHT + 0.6, entryZ);
      awardPoints(toScreen(0, GATE_HEIGHT - 0.6, entryZ));
      updateTier(true);
    } else {
      m.ended = true;
      m.timedOut = timedOut;
      gate.setState('miss');
      hud.setMega(MEGA_PIECES, m.passed, true);
      updateTier();
      sfx.miss();
      effects.fire('stars', 0, GATE_HEIGHT + 0.6, entryZ);
      pendingPoints = 0;
    }
    after(GATE_BEAT, () => {
      if (turn !== thisTurn || mega !== m) return;
      if (m.ended || m.asked >= MEGA_PIECES) enterCourse();
      else askPiece();
    });
  };

  /** The questions are over: the ski turbos to the course, which waits far ahead. */
  const enterCourse = () => {
    const m = mega;
    if (!m) return;
    target = 'course';
    hud.lockAnswers();
    hud.setLauncher(m.id);
    if (m.passed >= MEGA_PIECES) hud.showBanner(MEGA_SPECS[m.id].title, '', 'hit');
    placeTarget(COURSE_GAP);
    phase = 'turbo';
    coinIn = 0;
    sfx.rev();
    hud.speedLines(true);
  };

  /** The ski is at the entry line: the elements the player earned, then the finale or a wipeout. */
  const startMegaStunt = () => {
    const m = mega;
    if (!m || !course) return;
    stunt = makeMegaStunt(m.id, m.passed as Passed);
    course.reset();
    courseHeld = true;
    frameStunt(stunt);
    phase = 'stunt';
    camGoal = 1;
    hud.speedLines(false);
    // A clean finale: nothing to answer any more, so the question comes down.
    if (m.passed >= MEGA_PIECES) hud.setTopVisible(false, 0);
    hud.hideBanner();
    skiZ = entryZ;
  };

  // ---------- Tricks ----------
  const makeStunt = (id: TrickId, outcome: Outcome): Stunt => {
    const framing = trickFraming(id, outcome);
    return {
      trick: id,
      mega: false,
      outcome,
      t: 0,
      duration: trickDuration(id, outcome),
      events: trickEvents(id, outcome),
      next: 0,
      scale: 1,
      length: TRICK_SPECS[id].length,
      framingAt: () => framing,
      seg: 0,
      lipD: LAUNCHERS[TRICK_SPECS[id].launcher].lipD,
      frameAt: (t, out) => void trickFrame(id, outcome, t, out),
      rateAt: (t) => trickRate(id, outcome, t),
      wordAt: () => ({ text: trickWord(id, outcome), good: outcome === 'clear' }),
    };
  };

  /** The one long stunt of a Mega course that clears `passed` elements and wipes out on the next. */
  const makeMegaStunt = (id: MegaId, passed: Passed): Stunt => ({
    trick: null,
    mega: true,
    outcome: passed === MEGA_PIECES ? 'clear' : 'fail',
    t: 0,
    duration: megaDuration(id, passed),
    events: megaEvents(id, passed),
    next: 0,
    scale: 1,
    length: megaLength(id),
    framingAt: (t) => megaFramingAt(id, passed, t),
    lookBias: (d) => megaLookBias(id, d),
    segmentAt: (t) => megaLocate(id, passed, t).index,
    seg: 0,
    lipD: Number.POSITIVE_INFINITY,
    frameAt: (t, out) => void megaFrame(id, passed, t, out),
    rateAt: (t) => megaRate(id, passed, t),
    wordAt: (t) => megaWordAt(id, passed, t),
    propsAt: (t) => {
      courseHeld = true;
      megaPool.get(id).update(passed, t);
    },
  });

  /** The camera frames this stunt: its height range, and the lip it takes off from. */
  const frameStunt = (s: Stunt) => {
    camStunt = s;
    followTrick = true;
  };

  const startStunt = (outcome: Outcome) => {
    stunt = makeStunt(trick, outcome);
    frameStunt(stunt);
    phase = 'stunt';
    camGoal = 1;
    hud.speedLines(false);
    skiZ = entryZ;
  };

  const fireEvent = (e: TrickEvent, s: Stunt) => {
    const x = e.s;
    const z = entryZ - e.d;
    if (EFFECT_KINDS.includes(e.type)) {
      effects.fire(e.type as EffectKind, x, e.y, z);
      return;
    }
    if (e.type.startsWith('sfx:')) {
      play(e.type.slice(4));
      return;
    }
    switch (e.type) {
      case 'cheer': {
        world.cheer();
        sfx.cheer();
        if (s.outcome === 'clear' && !s.mega) {
          const before = hud.tierShown;
          updateTier(true);
          awardPoints(focusScreen(1.6));
          if (meterFill(streak) === 3 && before < 3) {
            hud.pop('WILD TRICKS!', { x: viewW / 2, y: viewH * 0.4 }, 'plain');
          }
        }
        break;
      }
      case 'groan': {
        world.groan();
        sfx.miss();
        shake = Math.max(shake, 1);
        hud.flashCrash();
        skisLeft = loseSki(skisLeft);
        hud.setSkis(skisLeft, true);
        hud.setTier(0);
        break;
      }
      case 'word': {
        const w = s.wordAt(e.at);
        hud.showWord(w.text, wordScreen(), w.good);
        break;
      }
      case 'fireworks': {
        effects.fireworks(x, e.y, z);
        sfx.firework();
        break;
      }
      default:
        break;
    }
  };

  /** Adds the points of a right answer to the score, with a pop at `at`. */
  const awardPoints = (at: { x: number; y: number }) => {
    if (pendingPoints <= 0) return;
    score += pendingPoints;
    hud.pop(`+${pendingPoints.toLocaleString()}`, at, 'good');
    pendingPoints = 0;
    setScoreHud(true);
  };

  /** Advances the trick by `dt` seconds of trick time, firing the events it passes. */
  const stepStunt = (s: Stunt, dt: number) => {
    s.t = Math.min(s.t + dt, s.duration);
    // A comic word never outlives its element: when the stunt moves on to the next, it goes.
    const sync = (at: number) => {
      const k = s.segmentAt?.(at);
      if (k === undefined || k === s.seg) return;
      s.seg = k;
      hud.hideWord();
    };
    while (s.next < s.events.length && s.events[s.next].at <= s.t) {
      sync(s.events[s.next].at);
      fireEvent(s.events[s.next++], s);
    }
    sync(s.t);
  };

  const finishStunt = (s: Stunt) => {
    const m = mega;
    if (s.trick) lastTrick = s.trick;
    followTrick = false;
    if (s.outcome === 'clear') {
      // Riding on from the end of the trick at the speed it left off.
      landed += m ? m.passed : 1;
      skiX = 0;
      skiZ = entryZ - s.length;
      speed = ENTRY_SPEED - 2;
      stunt = null;
      if (pendingPoints > 0) awardPoints(focusScreen(1.6));
      phase = 'riding';
      camGoal = 0;
      if (m) {
        // All three elements: the finale, the fireworks and the bonus, then on to the next world.
        score += MEGA_BONUS * multiplier;
        setScoreHud(true);
        effects.fireworks(skiX, 3, skiZ);
        sfx.firework();
        sfx.bigCheer();
        mega = null;
        target = 'launcher';
        hud.setMega(0, 0);
        hud.setTopVisible(false, 0);
        hud.showBanner('MEGA STUNT CLEARED!', `+${MEGA_BONUS * multiplier}`, 'hit');
        worldChangePending = true;
        timers.clear();
        const thisTurn = ++turn;
        after(0.25, sfx.firework);
        after(0.5, sfx.firework);
        after(MEGA_CLEARED_BEAT, () => turn === thisTurn && changeWorld());
        return;
      }
      askNext();
      return;
    }
    if (m) {
      // A wipeout in a Mega Stunt: the miss that stopped the questions is the one shown (the
      // driver remembers it), and the world changes once the player has gone on from it.
      timedOut = m.timedOut;
      landed += m.passed;
      mega = null;
      target = 'launcher';
      hud.setMega(0, 0);
      worldChangePending = true;
    }
    // A wipeout: the ski and the rider stay where they ended while the lifeguard comes.
    s.frameAt(s.duration, failEnd);
    const reach = Math.max(failEnd.ski.d, failEnd.rider.mode === 'free' ? failEnd.rider.d : 0);
    respawnSkiD = reach + 5;
    respawnRiderD = failEnd.rider.d;
    respawnRiderS = failEnd.rider.s;
    stunt = null;
    speed = 0;
    beginResult();
  };

  // ---------- After a wipeout ----------
  const beginResult = () => {
    timers.clear();
    hud.hideWord();
    if (outOfSkis(skisLeft)) {
      beginEnding();
      return;
    }
    phase = 'result';
    respawnDone = false;
    respawnStarted = false;
    // The driver starts whatever it reads or waits on (the banner is up a moment later, in the same frame).
    const miss = driver.afterMiss({ timedOut });
    hud.showBanner(timedOut ? "Time's up!" : 'Wipeout!', miss.detail, 'miss');
    after(RESPAWN_DELAY, () => {
      startRespawn();
      // Nothing to read or tap on: go on once the new ski is ready.
      if (!miss.wait) after(RESPAWN_TIME, advance);
    });
  };

  /** The lifeguard boat brings a new ski, and the rider climbs on. */
  const startRespawn = () => {
    if (respawnStarted) return;
    respawnStarted = true;
    respawnT = 0;
    oldIndex = activeIndex;
    activeIndex = 1 - activeIndex;
    const ski = active();
    ski.object.visible = true;
    boat.object.visible = true;
    sfx.honk();
  };

  const poseRespawn = (time: number) => {
    respawnFrame(respawnT, rf, respawnSkiD, respawnRiderD, respawnRiderS);
    const ski = active();
    const old = skis[oldIndex];
    // The new ski, towed by the boat and then at rest.
    const z = entryZ - rf.ski.d;
    ski.object.visible = true;
    ski.object.rotation.order = 'YXZ';
    ski.object.position.set(rf.ski.s, swell(rf.ski.s, z, time) + 0.03, z);
    ski.object.rotation.set(0, 0, 0);
    // The old ski sinks out of sight.
    const oz = entryZ - failEnd.ski.d;
    old.object.position.set(failEnd.ski.s, failEnd.ski.y + rf.sink, oz);
    old.object.visible = rf.sink > -1.95;
    // The rider.
    const r = rf.rider;
    if (rider.mode !== r.mode) rider.setMode(r.mode, ski.seat, scene);
    rider.setPose(r.pose);
    rider.setFace(r.face);
    rider.setProps(false, false);
    rider.setVisible(true);
    if (r.mode === 'free') rider.place(r.s, r.y, entryZ - r.d, r.pitch, r.roll, r.yaw);
    // The boat.
    const b = rf.boat;
    boat.object.visible = b.visible;
    boat.object.position.set(b.s, swell(b.s, entryZ - b.d, time) + 0.05, entryZ - b.d);
    boat.object.rotation.y = b.yaw;
    boat.setOpacity(b.opacity);
    if (respawnT < 1.3) {
      ski.object.updateWorldMatrix(true, false);
      point.set(0, 0.35, -1.3);
      ski.object.localToWorld(point);
      boat.aimRope(point.x, point.y, point.z);
    } else {
      boat.aimRope(0, 0, 0);
    }
    // Where the camera and the next question start from.
    skiX = rf.ski.s;
    skiZ = z;
    focus.set(
      r.mode === 'free' ? r.s : rf.ski.s,
      Math.max(r.mode === 'free' ? r.y : 0, 0),
      r.mode === 'free' ? entryZ - r.d : z,
    );
    if (respawnT >= RESPAWN_TIME && !respawnDone) {
      respawnDone = true;
      old.object.visible = false;
    }
  };

  const endRespawn = () => {
    if (!respawnStarted) startRespawn();
    respawnT = Math.max(respawnT, RESPAWN_TIME);
    poseRespawn(gameTime);
    respawnDone = true;
    skis[oldIndex].object.visible = false;
    rider.setPose('wave');
  };

  /** Moves on after a reveal. */
  const advance = () => {
    driver.cancel();
    stopSpeaking();
    timers.clear();
    if (!respawnDone) endRespawn();
    skis[oldIndex].object.visible = false;
    boat.object.visible = false;
    hud.hideBanner();
    speed = 0;
    camGoal = 0;
    if (worldChangePending) {
      changeWorld();
      return;
    }
    askNext();
  };

  // ---------- A new world ----------
  /** Builds the world `id` (the scenery, the sky and the water's colour) in place of this one. */
  function setWorld(id: WorldId) {
    if (id === worldId && world) return;
    world.dispose();
    worldId = id;
    world = createWorld(scene, worldId);
    water.setColor(world.water);
  }

  /**
   * After a Mega Stunt: a blue wave sweeps up over the screen, the next world is built behind it,
   * the wave sweeps off and the world's name shows, then the next question.
   */
  function changeWorld() {
    worldChangePending = false;
    timers.clear();
    driver.cancel();
    stopSpeaking();
    hud.hideBanner();
    hud.hideWord();
    const thisTurn = ++turn;
    clockRunning = false;
    phase = 'riding';
    hud.wipe('cover');
    after(WIPE_SECONDS, () => {
      if (turn !== thisTurn) return;
      hud.setTopVisible(false, 0);
      hud.setMega(0, 0);
      clearMegaProps();
      launchers.hideAll();
      launcher = null;
      launcherPlaced = false;
      effects.clear();
      coins.forEach((c) => (c.visible = false));
      boat.object.visible = false;
      skis[1 - activeIndex].object.visible = false;
      normals = 0;
      setWorld(nextWorld(worldId));
      hud.wipe('off');
    });
    after(2 * WIPE_SECONDS, () => {
      if (turn !== thisTurn) return;
      hud.wipe('idle');
      hud.showWorldTitle(WORLD_NAMES[worldId]);
    });
    after(2 * WIPE_SECONDS + WORLD_TITLE_SECONDS, () => {
      if (turn !== thisTurn) return;
      hud.hideWorldTitle();
      if (!driver.betweenWorlds) {
        askNext();
        return;
      }
      // The driver may show something first (a lesson): the ride waits until it calls resume.
      let resumed = false;
      driver.betweenWorlds(() => {
        if (resumed) return;
        resumed = true;
        if (turn === thisTurn) askNext();
      });
    });
  }

  const beginEnding = () => {
    phase = 'ending';
    timers.clear();
    turn++;
    clockRunning = false;
    driver.cancel();
    const ending = driver.ending();
    hud.showBanner(OUT_OF_SKIS_SPEECH, ending.detail, 'out');
    // The driver holds the results until the player has gone on (the green answer, say).
    if (ending.wait) return;
    // Nothing to wait on: show the end soon.
    hud.setTopVisible(false, 0);
    const thisTurn = turn;
    const done = () => turn === thisTurn && phase === 'ending' && finishRun();
    if (ending.say !== undefined) speak(ending.say, done);
    else after(ENDING_WAIT, done);
  };

  const finishRun = () => {
    phase = 'done';
    driver.cancel();
    hud.hideBanner();
    hud.setTopVisible(false, 0);
    driver.finish(score, () => startRun(false));
  };

  // ---------- Input ----------
  /** A tap fast-forwards a trick, so it never feels ignored. */
  const skip = () => {
    if (phase === 'stunt' && stunt && stunt.t >= FAST_FORWARD_AFTER) stunt.scale = FAST_FORWARD;
  };
  /** The player has gone on from a reveal: the new ski is down at once and the next turn comes. */
  const proceed = () => {
    if (phase === 'ending') {
      finishRun();
      return;
    }
    if (phase !== 'result') return;
    advance();
  };
  const stopPointer = createPointerInput(ctx.renderer.domElement, {
    onDragStart: () => unlockAudio(),
    onTap: skip,
  });

  // ---------- Coins ----------
  const spawnTrail = () => {
    const count = trailLength(Math.random());
    const sign = Math.random() < 0.5 ? -1 : 1;
    const z0 = skiZ - 18;
    // Keep clear of the launcher: the ski must be back in the middle well before the entry line.
    if (launcherPlaced && z0 - (count - 1) * COIN_GAP < entryZ + TRAIL_MIN_GAP) return;
    let placed = 0;
    for (const coin of coins) {
      if (coin.visible) continue;
      coin.visible = true;
      coin.position.set(coinSide(placed, count, sign), COIN_Y, z0 - placed * COIN_GAP);
      if (++placed >= count) break;
    }
  };

  /** The side position the ski eases to: the coin it is about to ride through, else the middle. */
  const coinGoalX = () => {
    let goal = 0;
    let best = phase === 'turbo' ? 24 : 12;
    for (const coin of coins) {
      if (!coin.visible) continue;
      const ahead = skiZ - coin.position.z;
      if (ahead > -1 && ahead < best) {
        best = ahead;
        goal = coin.position.x;
      }
    }
    return goal;
  };

  const updateCoins = (delta: number, time: number, collecting: boolean) => {
    for (const coin of coins) {
      if (!coin.visible) continue;
      coin.rotation.y = time * 4 + coin.position.z;
      coin.position.y = COIN_Y + Math.sin(time * 2 + coin.position.z) * 0.08;
      if (coin.position.z > skiZ + 14) coin.visible = false;
      else if (
        collecting &&
        Math.abs(coin.position.z - skiZ) < 1.1 &&
        Math.abs(coin.position.x - skiX) < 1.1
      ) {
        coin.visible = false;
        score += COIN_POINTS * multiplier;
        setScoreHud(true);
        effects.sparkle(coin.position.x, coin.position.y, coin.position.z);
        sfx.chime();
        hud.pop(
          `+${COIN_POINTS * multiplier}`,
          toScreen(coin.position.x, coin.position.y + 0.9, coin.position.z),
          'good',
        );
      }
    }
    if (collecting || (phase === 'riding' && clockRunning)) {
      coinIn -= delta;
      if (coinIn <= 0) {
        coinIn = collecting ? 0.5 : 2 + Math.random() * 2;
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

  /** How far the ski has come since the clock started: it arrives as the clock hits zero. */
  const clockDistance = () => {
    const elapsed = clockTotal - clockLeft;
    const dv = startSpeed - rideSpeedGoal;
    const wobble = (dv * (1 - Math.exp(-4 * elapsed))) / 4 - (dv / 4) * (elapsed / clockTotal);
    return rideSpeedGoal * elapsed + wobble;
  };

  /** Seconds of trick per second of real time: a tap fast-forwards, else the slow motion. */
  const playRate = (s: Stunt) => (s.scale > 1 ? s.scale : s.rateAt(s.t));

  /** Foam and spray from the nozzle while the ski is on the water. */
  const wakeEffects = (delta: number) => {
    const ski = active();
    ski.update();
    water.setWake(ski.object.position.x, ski.object.position.z, wetSki && ski.object.visible);
    wakeIn -= delta;
    if (wakeIn <= 0 && wetSki && speed > 1.5 && ski.object.visible) {
      wakeIn = 0.03;
      const p = ski.nozzleWorld;
      effects.wake(p.x, p.y, p.z, speed);
      if (phase === 'turbo') effects.wake(p.x, p.y, p.z, speed);
    }
  };

  const stepWorld = (delta: number, elapsed: number) => {
    // --- The ride, by phase ---
    switch (phase) {
      case 'riding': {
        if (clockRunning) {
          runClock(delta);
          const dist = Math.min(clockDistance(), approachGap);
          const z = approachStartZ - dist;
          const moved = Math.max(skiZ - z, 0);
          skiZ = z;
          speed = delta > 0 ? moved / delta : speed;
        } else {
          speed = easeToward(speed, rideSpeedGoal, 2.5, delta);
          skiZ -= speed * delta;
        }
        break;
      }
      case 'turbo': {
        const remaining = Math.max(skiZ - entryZ, 0);
        // The turbo never lets up until the last few units.
        const goal = Math.max(turboSpeed(remaining), Math.min(remaining / 0.3, TURBO_MAX));
        speed = easeToward(speed, goal, 8, delta);
        skiZ = Math.max(skiZ - speed * delta, entryZ);
        if (skiZ <= entryZ + 1e-6) {
          if (target === 'course') startMegaStunt();
          else if (target === 'gate') passGate(answeredRight === true);
          else startStunt(answeredRight === true ? 'clear' : 'fail');
        }
        break;
      }
      default:
        break;
    }

    // --- The ski and rider ---
    const riding =
      phase === 'riding' || phase === 'turbo' || phase === 'countdown' || phase === 'preview';
    if (phase === 'stunt' && stunt) {
      stepStunt(stunt, delta * playRate(stunt));
      stunt.frameAt(stunt.t, frame);
      applyFrame(frame, elapsed);
      stunt.propsAt?.(stunt.t);
      speed = ENTRY_SPEED;
      if (stunt.t >= stunt.duration) finishStunt(stunt);
    } else if (phase === 'result') {
      if (respawnStarted) {
        respawnT += delta;
        poseRespawn(elapsed);
      }
      // Until the boat comes the wipeout lies where it ended.
    } else if (phase === 'ending') {
      // The last ski lies where it was wrecked.
    } else if (riding || phase === 'done') {
      // Before the answer the ski plods straight on; after it the turbo steers through the coins.
      const goalX = phase === 'turbo' ? coinGoalX() : 0;
      const nextX = easeToward(skiX, goalX, phase === 'turbo' ? 9 : 4, delta);
      const pose =
        phase === 'preview' || phase === 'countdown' || phase === 'done' ? 'wave' : 'ride';
      rideAt(nextX, skiZ, pose, delta, elapsed);
      skiX = nextX;
    }

    wakeEffects(delta);
    updateCoins(delta, elapsed, phase === 'turbo');
  };

  /**
   * What the stunt view looks at and how far it stands back. While a trick plays it looks at the
   * launcher's lip (the ski a little ahead of the middle), then follows the ski, or the thrown
   * rider; afterwards it frames the wreck. Eased so a thrown rider is followed smoothly.
   */
  const updateCameraTargets = (delta: number, snap: boolean) => {
    const cs = followTrick ? camStunt : null;
    const f = cs ? cs.framingAt(cs.t) : RESULT_FRAMING;
    const fov = fovFor(camera.aspect);
    const dist = stuntDistance(f, fov, bandFraction(viewW, viewH), camera.aspect);
    const d = entryZ - focus.z;
    // A Mega course looks towards the element it is on; a trick looks at its lip, then follows.
    const lookD = !cs
      ? d
      : cs.lookBias
        ? d + cs.lookBias(d)
        : stuntLookD(d, cs.lipD, dist, fov, camera.aspect);
    const lookZ = entryZ - lookD;
    look.set(focus.x, 0, lookZ);
    if (snap || (camW <= 0.001 && camGoal === 0)) {
      camFocus.copy(look);
      camMid = framingMid(f);
      camDist = dist;
      return;
    }
    camFocus.x = easeToward(camFocus.x, look.x, 8, delta);
    camFocus.z = easeToward(camFocus.z, look.z, 8, delta);
    camMid = easeToward(camMid, framingMid(f), 5, delta);
    camDist = easeToward(camDist, dist, 5, delta);
  };

  /** Points the camera: the chase view blended into the three-quarter side view. */
  const aimCamera = (dx: number, dy: number) => {
    chasePose(camSide, 0, skiZ, chase);
    stuntPose(camFocus.x, camFocus.z, camMid, camDist, stuntCam);
    blendCam(chase, stuntCam, camW, blended);
    camera.position.set(blended.x + dx, blended.y + dy, blended.z);
    camera.lookAt(blended.lookX + dx, blended.lookY + dy, blended.lookZ);
    camera.updateMatrixWorld();
    effects.setScale(
      (ctx.renderer.getPixelRatio() * viewH) / (2 * Math.tan((camera.fov * Math.PI) / 360)),
    );
  };

  ctx.onUpdate((delta, elapsed) => {
    layout();
    gameTime += delta;
    driver.frame?.(delta);
    timers.update(delta);

    if (lab) stepLab(delta, elapsed);
    else stepWorld(delta, elapsed);

    // The wake strip and the turbo.
    if (!lab && (phase === 'riding' || phase === 'turbo')) {
      const progress = clockRunning
        ? approachProgress(clockLeft, clockTotal)
        : launcherPlaced
          ? MathUtils.clamp((approachStartZ - skiZ) / Math.max(approachGap, 1), 0, 1)
          : 0;
      hud.setWake(progress, {
        urgent: clockRunning && clockLeft / clockTotal < 0.4,
        waiting: phase === 'riding' && !clockRunning,
      });
    }
    turboAmount = easeToward(turboAmount, phase === 'turbo' ? 1 : 0, 6, delta);

    // Idle motion of the launchers, the water and the world.
    launcher?.ambient(elapsed);
    // The course idles only while it waits ahead: a stunt poses its props itself every frame.
    if (!courseHeld) course?.ambient(elapsed);
    gates.forEach((gate) => gate.object.visible && gate.ambient(elapsed));
    const ski = active();
    world.update(skiZ, camera.position, delta, elapsed);
    water.update(elapsed, skiX, skiZ);
    // Soft blobs on the water under the ski and under a free rider show how high they are.
    const skiUp = ski.object.position.y;
    world.setShadow(
      0,
      ski.object.position.x,
      ski.object.position.z,
      ski.object.visible && !wetSki ? skiUp : 0,
    );
    const free = rider.mode === 'free' && rider.root.visible;
    world.setShadow(
      1,
      rider.root.position.x,
      rider.root.position.z,
      free ? rider.root.position.y : 0,
    );
    // A lab frozen at a time (`&at=`) keeps its splashes and spray as they were.
    if (!(lab && dev?.at !== null && dev?.at !== undefined)) effects.update(delta);
    rider.update(delta, elapsed);
    boat.update(elapsed);
    for (const d of dolphins) d.update(elapsed);

    // --- Camera ---
    const stuntView = phase === 'stunt' || phase === 'result' || phase === 'ending';
    if (!stuntView && camGoal === 1 && !lab) camGoal = 0;
    const rate = camGoal > camW ? 1 / SWING_IN : 1 / SWING_OUT;
    camW = MathUtils.clamp(
      camW + Math.sign(camGoal - camW) * Math.min(Math.abs(camGoal - camW), rate * delta),
      0,
      1,
    );
    updateCameraTargets(delta, !!lab && dev?.at !== null && dev?.at !== undefined);
    camSide = easeToward(camSide, followSide(skiX), 4, delta);
    shake = easeToward(shake, 0, 3.5, delta);
    const fov = fovFor(camera.aspect) + 6 * turboAmount;
    if (Math.abs(camera.fov - fov) > 0.02) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    aimCamera(Math.sin(elapsed * 61) * shake * 0.12, Math.sin(elapsed * 73 + 1) * shake * 0.12);
  });

  // ---------- The trick lab (dev only) ----------
  interface LabState {
    phase: 'ride' | 'play' | 'hold';
    t: number;
    stunt: Stunt | null;
    z: number;
    wait: number;
  }
  let labState: LabState | null = null;
  const LAB_ENTRY_Z = -40;

  /** Resets everything a lab loop leaves behind. */
  const labReset = () => {
    effects.clear();
    hud.hideWord();
    rider.setMode('seated', active().seat, scene);
    rider.setProps(false, false);
    dolphins.forEach((d) => (d.object.visible = false));
    cloud.object.visible = false;
    tail.object.visible = false;
    egg.object.visible = false;
    boat.object.visible = false;
    skis[1].object.visible = false;
    activeIndex = 0;
    skis[0].object.visible = true;
    course?.reset();
    courseHeld = false;
  };

  function stepLab(delta: number, elapsed: number) {
    if (!lab) return;
    if (!labState) {
      entryZ = LAB_ENTRY_Z;
      labState = { phase: 'ride', t: 0, stunt: null, z: entryZ + 13, wait: 0 };
      if ('trick' in lab) {
        trick = lab.trick;
        tier = TRICK_TIER[trick];
        placeTarget(0);
        entryZ = LAB_ENTRY_Z;
        launcher?.object.position.set(0, 0, entryZ);
      } else if ('mega' in lab) {
        // A Mega lab shows the course in its own world.
        setWorld(WORLD_ORDER.find((w) => WORLD_MEGA[w] === lab.mega) ?? 'lagoon');
        mega = {
          id: lab.mega,
          passed: lab.passed,
          asked: MEGA_PIECES,
          ended: false,
          timedOut: false,
        };
        target = 'course';
        placeTarget(0);
        entryZ = LAB_ENTRY_Z;
        course?.object.position.set(0, 0, entryZ);
      } else {
        respawnSkiD = 14;
        respawnRiderD = 9;
        respawnRiderS = 1.5;
        failEnd.ski.d = 4;
        failEnd.ski.s = 0;
        failEnd.ski.y = 0;
      }
      phase = 'riding';
      hud.setTopVisible(false, 0);
      if (dev?.at !== null && dev?.at !== undefined) {
        labState.phase = 'hold';
        scrubLab(dev.at);
      } else if ('respawn' in lab) {
        labState.phase = 'play';
        beginLabRespawn();
      }
    }
    const s = labState;
    if (s.phase === 'hold') {
      // Frozen for screenshots: posed at `at` and nothing advances.
      ctx.renderer.domElement.dataset.frozen = '1';
      camW = camGoal = 1;
      camSide = 0;
      return;
    }
    if ('respawn' in lab) {
      respawnT += delta;
      poseRespawn(elapsed);
      if (respawnT > RESPAWN_TIME + 1.4) {
        s.phase = 'ride';
        labReset();
        beginLabRespawn();
        s.phase = 'play';
      }
      camW = camGoal = 1;
      return;
    }
    if (s.phase === 'ride') {
      speed = ENTRY_SPEED;
      s.z -= speed * delta;
      skiZ = s.z;
      skiX = 0;
      rideAt(0, s.z, 'ride', delta, elapsed);
      camGoal = 0;
      if (s.z <= entryZ) {
        s.phase = 'play';
        s.stunt = labStunt(lab);
        frameStunt(s.stunt);
        course?.reset();
        camGoal = 1;
      }
    } else if (s.phase === 'play' && s.stunt) {
      stunt = s.stunt;
      stepStunt(s.stunt, delta * playRate(s.stunt));
      s.stunt.frameAt(s.stunt.t, frame);
      applyFrame(frame, elapsed);
      s.stunt.propsAt?.(s.stunt.t);
      camGoal = 1;
      if (s.stunt.t >= s.stunt.duration) {
        s.phase = 'hold';
        stunt = null;
        after(1.2, () => {
          if (!labState) return;
          labReset();
          labState.phase = 'ride';
          labState.z = entryZ + 13;
          labState.stunt = null;
          speed = ENTRY_SPEED;
        });
      }
    }
    wakeEffects(delta);
  }

  /** The stunt a trick or Mega lab loops. */
  const labStunt = (l: Exclude<Lab, { respawn: true }>): Stunt =>
    'mega' in l ? makeMegaStunt(l.mega, l.passed) : makeStunt(l.trick, l.outcome);

  /** Starts the lab's boat loop: a fallen rider in the water and the lifeguard on the way. */
  function beginLabRespawn() {
    respawnStarted = false;
    respawnDone = false;
    startRespawn();
    respawnT = 0;
    // The old ski lies upside down where the wipeout left it.
    skis[oldIndex].object.rotation.set(0, 0, Math.PI);
    poseRespawn(0);
  }

  /** Plays the lab trick up to `at` seconds in one go, so effects and props are where they would be. */
  function scrubLab(at: number) {
    if (!labState || !lab) return;
    effects.clear();
    if ('respawn' in lab) {
      beginLabRespawn();
      respawnT = at;
      poseRespawn(2);
      followTrick = false;
      updateCameraTargets(0, true);
      return;
    }
    const s = labStunt(lab);
    course?.reset();
    // Aim the camera first, so the comic word lands where the ski will be.
    s.frameAt(Math.min(at, s.duration), frame);
    applyFrame(frame, 2);
    frameStunt(s);
    camW = camGoal = 1;
    layout();
    s.t = Math.min(at, s.duration);
    updateCameraTargets(0, true);
    aimCamera(0, 0);
    s.t = 0;
    const step = 1 / 30;
    for (let t = 0; t < at; t += step) {
      stepStunt(s, Math.min(step, at - t));
      effects.update(Math.min(step, at - t));
    }
    labState.stunt = s;
    stunt = null;
    s.frameAt(s.t, frame);
    applyFrame(frame, 2);
    s.propsAt?.(s.t);
  }

  // ---------- Start ----------
  layout();
  hud.setTopVisible(false, 0);
  setScoreHud();
  ctx.start();
  if (lab) {
    startRun(false);
    timers.clear();
    hud.showCount(null);
    hud.setTopVisible(false, 0);
    phase = 'riding';
  } else {
    startRun(true);
  }

  window.addEventListener('pagehide', () => {
    stopSpeaking();
    stopPointer();
    driver.dispose();
    pause.dispose();
    mute.dispose();
    hud.dispose();
    effects.dispose();
    rider.dispose();
    for (const ski of skis) ski.dispose();
    boat.dispose();
    dolphins.forEach((d) => d.dispose());
    cloud.dispose();
    tail.dispose();
    egg.dispose();
    launchers.dispose();
    megaPool.dispose();
    gates.forEach((gate) => gate.dispose());
    water.dispose();
    world.dispose();
    coinGeometry.dispose();
    coinMaterial.dispose();
    ctx.dispose();
  });

  return {
    hud,
    get phase() {
      return phase;
    },
    get clockLeft() {
      return clockLeft;
    },
    get clockTotal() {
      return clockTotal;
    },
    get paused() {
      return pause.isPaused;
    },
    setClock,
    startClock,
    answer,
    proceed,
    skip,
    after,
    setMultiplier(n) {
      multiplier = n;
      hud.setMultiplier(n);
    },
    get score() {
      return score;
    },
    get streak() {
      return streak;
    },
  };
}
