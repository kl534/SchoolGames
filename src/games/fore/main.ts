import './style.css';
import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  MathUtils,
  PCFShadowMap,
  Vector3,
  type Object3D,
} from 'three';
import { pressAnswers } from '../../shared/answers';
import { sfx, speak, stopSpeaking, unlockAudio } from '../../shared/audio';
import { createFactFeed, type FactFeed } from '../../shared/feed';
import { createPointerInput, onPress } from '../../shared/input';
import { showPreview } from '../../shared/preview';
import { showResults } from '../../shared/results';
import { starsFor } from '../../shared/round';
import { createScene } from '../../shared/scene';
import { startGameSession, type GameSession } from '../../shared/session';
import { createTapFlow } from '../../shared/tapflow';
import { createTimers } from '../../shared/timers';
import { answerOptions, promptSpeech, type Fact } from '../../shared/topics';
import { createBackButton, createMuteButton, createPauseOverlay, menuUrl } from '../../shared/ui';
import { BALL_R, createBall, flightPoint, flightSeconds } from './ball';
import { createTravel, type Travel } from './travel';
import { HOLES, surfaceAt, type Hole } from './course';
import {
  devAim,
  devCam,
  devClubPlan,
  devHoleState,
  devHolesOk,
  devIntroAt,
  devQuality,
  devShadows,
  devSide,
  devSkipIntro,
  devStart,
  devSwing,
  type DevCam,
} from './dev';
import { createCaddie } from './caddie';
import { createGolfer, type GolfMove } from './golfer';
import { createGuide } from './guide';
import { buildHole, CUP_AID_RANGE, SKY, type HoleScene } from './hole';
import { createSky } from './sky';
import { createHud, SURFACE_NAMES, windChip, type Bands, type CardCell } from './hud';
import {
  afterShot,
  callKindFor,
  holeCall,
  holeIntro,
  holeOver,
  holeScore,
  LAST_HOLE_SPEECH,
  NEW_BEST_SPEECH,
  nameFor,
  reactionFor,
  pillFor,
  relFromStored,
  relText,
  ROUND_OVER_SPEECH,
  roundOutcome,
  shotCall,
  startHole,
  storedFor,
  totalVsPar,
  type HoleState,
} from './rules';
import {
  AIM_MAX,
  AIM_STEP,
  finishShot,
  holedOutcome,
  isPutt,
  planShot,
  resolveShot,
  type Outcome,
  type Plan,
  type Result,
} from './shot';
import { timingFor } from './swing';
import {
  aimView,
  centreShift,
  centreShiftX,
  followView,
  introView,
  landView,
  type CamView,
  type Vec,
} from './views';

const GAME_ID = 'fore';

/** Seconds the hole is shown from above before the golfer is lined up. */
const INTRO_FOR = 2.6;
/** The flyover sweeps from the tee to the green over this many seconds of the intro. */
const SWEEP_FOR = 2.4;
/** Seconds the shot call stays up, and the hole call. */
const SHOT_HOLD = 1.2;
const HOLE_HOLD = 2.0;
/** Seconds the big scorecard stays up before the results. */
const FINAL_FOR = 3.0;
const PILL_FOR = 1.6;
/** The question and answers go this long after the answer. */
const HIDE_QUESTION_AFTER = 0.5;
/** Seconds after a result is ready before a tap skips ahead. */
const SKIP_RESULT_AFTER = 0.6;
/** A tap cuts the hole flyover short once it has been running this long (not by a double tap). */
const SKIP_INTRO_AFTER = 0.3;
/** A tap in flight lands the ball once it has been flying this long. */
const FAST_AFTER = 0.3;
/** A holed ball takes this long to drop out of sight in the cup, seconds. */
const HOLE_DROP_FOR = 0.15;
/** Degrees of aim for each pixel of a sideways drag. */
const DEG_PER_PX = 0.12;

type Phase =
  | 'preview'
  | 'intro'
  | 'aim'
  | 'ask'
  | 'swing'
  | 'flight'
  | 'landed'
  | 'result'
  | 'holecall'
  | 'over'
  | 'done';

type ViewKind = 'intro' | 'aim' | 'ask' | 'follow' | 'land';

const lerpVec = (a: Vec, b: Vec, t: number): Vec => ({
  x: MathUtils.lerp(a.x, b.x, t),
  y: MathUtils.lerp(a.y, b.y, t),
  z: MathUtils.lerp(a.z, b.z, t),
});

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

function run(session: GameSession): void {
  const container = document.getElementById('game');
  if (!container) throw new Error('Missing #game container');

  // ---------- Scene ----------
  const ctx = createScene(container, { fov: 40, near: 0.5, far: 900 });
  const { scene, camera } = ctx;
  scene.background = new Color(SKY);
  scene.fog = new Fog(0xcfe9ff, 320, 820);
  scene.add(new HemisphereLight(0xdff0ff, 0x5e8a46, 1.6));
  const sun = new DirectionalLight(0xfff0d0, 2.4);
  scene.add(sun, sun.target);
  const sky = createSky();
  scene.add(sky.object);
  ctx.renderer.toneMapping = ACESFilmicToneMapping;
  ctx.renderer.toneMappingExposure = 0.9;
  // One shadow map for the people and the flag; its box (14 x 14 yd) follows the golfer.
  const shadows = devShadows();
  if (shadows) {
    ctx.renderer.shadowMap.enabled = true;
    ctx.renderer.shadowMap.type = PCFShadowMap;
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const box = sun.shadow.camera;
    box.left = box.bottom = -7;
    box.right = box.top = 7;
    box.near = 1;
    box.far = 160;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.03;
  }
  const ball = createBall();
  scene.add(ball.object);
  const guide = createGuide();
  scene.add(guide.object);
  const golfer = createGolfer();
  scene.add(golfer.root);
  const caddie = createCaddie();
  scene.add(caddie.root);
  // Real shadows from the people; the round blob under them is the fallback with shadows off.
  for (const root of [golfer.root, caddie.root]) {
    root.traverse((o: Object3D) => {
      if (o.name === 'blob') o.visible = !shadows;
      else if ((o as { isMesh?: boolean }).isMesh) o.castShadow = shadows;
    });
  }
  let holeScene: HoleScene | null = null;

  // ---------- HUD ----------
  const hud = createHud();
  const tapFlow = createTapFlow();
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
  let bestAtStart = session.highScore();
  let holeIndex = 0;
  let hole: Hole = HOLES[0];
  let hstate: HoleState = startHole(hole);
  let scores: number[] = [];
  let aimDeg = 0;
  let plan: Plan = devClubPlan(planShot(hole, hstate.at, hstate.lie, aimDeg), hstate.lie);
  let devPending = true;
  let fact: Fact | undefined;
  let options: string[] = [];
  let chosen = -1;
  /** Ticks up for each shot, so late callbacks can tell they are stale. */
  let turn = 0;
  let speechToken = 0;
  let speechDone = false;
  let answerTime = 0;
  let clockTotal = 10;
  let lastTick = 0;
  let forcedQuality = devQuality();

  // The shot.
  let outcome: Outcome | null = null;
  let result: Result | null = null;
  let afterHole: HoleState = hstate;
  let missed = false;
  let swingAt = 0;
  let flightT = 0;
  let flightDur = 1;
  /** The outcome the ball is drawn flying: a holed shot flies to the pin. */
  let flightOutcome: Outcome | null = null;
  /** How the ball gets there: the flight, the hops and the roll (not for a tree or the water). */
  let travel: Travel | null = null;
  let holeDropAt = -1;
  let launched = false;
  let golfMove: GolfMove = 'address';
  let golfSince = 0;
  let splashAt = -1;

  // The result.
  let resultAt = 0;
  let speechOver = false;
  let holdOver = false;

  // Delayed actions run on game time so pausing freezes them too.
  let gameTime = 0;
  const timers = createTimers();
  const after = timers.after;

  // ---------- Layout and the camera ----------
  let viewW = 0;
  let viewH = 0;
  let bands: Bands = {
    aim: { top: 0, bottom: 0 },
    ask: { top: 0, bottom: 0 },
    play: { top: 0, bottom: 0 },
  };
  let goal: ViewKind = 'intro';
  let introAt = 0;
  const cur: CamView = {
    pos: { x: 0, y: 55, z: -45 },
    look: { x: 0, y: 0, z: 100 },
    fov: 50,
    shift: 0,
    shiftX: 0,
  };
  let from: CamView = { ...cur };
  let target: CamView = { ...cur };
  let moveT = 1;
  let moveDur = 0.5;
  const lookAtPoint = new Vector3();
  let ballPos = { x: 0, y: BALL_R, z: 0 };

  const golferAt = (): Vec => ({
    x: golfer.root.position.x,
    y: 0,
    z: golfer.root.position.z,
  });

  /** A dev camera 5 yd from the golfer at chest height, for checking the swing from each side. */
  const devCamView = (cam: DevCam): CamView => {
    const g = golfer.root.position;
    const chest = { x: -Math.cos(plan.dir), z: Math.sin(plan.dir) };
    const line = { x: Math.sin(plan.dir), z: Math.cos(plan.dir) };
    const ballAt = hstate.at;
    const eye = (x: number, z: number): Vec => ({ x, y: 1.2, z });
    const [pos, look]: [Vec, Vec] =
      cam === 'face'
        ? [eye(g.x + chest.x * 5, g.z + chest.z * 5), { x: g.x, y: 1, z: g.z }]
        : cam === 'dtl'
          ? [
              eye(ballAt.x - line.x * 5, ballAt.z - line.z * 5),
              { x: ballAt.x + line.x * 5, y: 0.9, z: ballAt.z + line.z * 5 },
            ]
          : [eye(g.x + line.x * 5, g.z + line.z * 5), { x: g.x, y: 1, z: g.z }];
    return {
      pos,
      look,
      fov: 40,
      shift: centreShift(viewH, bands.aim),
      shiftX: centreShiftX(viewW, bands.aim),
    };
  };

  const buildView = (kind: ViewKind): CamView => {
    const dev = devCam();
    if (dev && kind !== 'intro') return devCamView(dev);
    switch (kind) {
      case 'intro':
        return introView(
          hole,
          viewW,
          viewH,
          bands.play,
          devIntroAt() ?? (gameTime - introAt) / SWEEP_FOR,
        );
      case 'aim':
        return aimView(plan, hole, golferAt(), viewW, viewH, bands.aim);
      case 'ask':
        return aimView(plan, hole, golferAt(), viewW, viewH, bands.ask);
      case 'follow':
        return followView(ballPos, plan.dir, isPutt(plan), viewW, viewH, bands.play);
      case 'land':
        return landView(
          { x: afterHole.at.x, y: 0, z: afterHole.at.z },
          plan.dir,
          viewW,
          viewH,
          bands.play,
        );
    }
  };

  /** Eases the camera to a view (or snaps there with 0 seconds). */
  const goTo = (kind: ViewKind, seconds: number) => {
    goal = kind;
    if (!viewW) return;
    from = {
      pos: { ...cur.pos },
      look: { ...cur.look },
      fov: cur.fov,
      shift: cur.shift,
      shiftX: cur.shiftX,
    };
    target = buildView(kind);
    moveT = seconds <= 0 ? 1 : 0;
    moveDur = seconds;
  };

  /** Re-aims the target of the view we are in (the aim moved) without restarting the ease. */
  const retarget = (seconds: number) => goTo(goal, seconds);

  const layout = (force = false) => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!force && w === viewW && h === viewH) return;
    viewW = w;
    viewH = h;
    bands = hud.measureBands();
    camera.aspect = w / Math.max(h, 1);
    target = buildView(goal);
    from = target;
    moveT = 1;
  };

  const applyCamera = () => {
    if (goal === 'follow' || goal === 'intro') target = buildView(goal);
    const e = moveT >= 1 ? 1 : ease(moveT);
    const a = moveT >= 1 ? target : from;
    cur.pos = lerpVec(a.pos, target.pos, e);
    cur.look = lerpVec(a.look, target.look, e);
    cur.fov = MathUtils.lerp(a.fov, target.fov, e);
    cur.shift = MathUtils.lerp(a.shift, target.shift, e);
    cur.shiftX = MathUtils.lerp(a.shiftX, target.shiftX, e);
    camera.fov = cur.fov;
    camera.setViewOffset(viewW, viewH, cur.shiftX, cur.shift, viewW, viewH);
    camera.updateProjectionMatrix();
    camera.position.set(cur.pos.x, cur.pos.y, cur.pos.z);
    lookAtPoint.set(cur.look.x, cur.look.y, cur.look.z);
    camera.lookAt(lookAtPoint);
    camera.updateMatrixWorld();
  };

  // ---------- Showing the game ----------
  const renderCard = () => {
    const cells: CardCell[] = HOLES.map((h, i) => ({
      par: h.par,
      strokes:
        i < scores.length
          ? scores[i]
          : i === holeIndex && hstate.strokes + hstate.penalties > 0
            ? hstate.strokes + hstate.penalties
            : null,
      current: i === holeIndex && scores.length <= i,
    }));
    hud.renderCard(cells);
  };

  const setGolf = (move: GolfMove) => {
    golfMove = move;
    golfSince = gameTime;
  };

  const makePlan = (): Plan =>
    devClubPlan(planShot(hole, hstate.at, hstate.lie, aimDeg), hstate.lie);

  const placeGolfer = () => {
    golfer.setClub(plan.club);
    golfer.stand(hstate.at, plan.dir, plan.club.id);
    sun.target.position.copy(golfer.root.position);
    sun.position.set(golfer.root.position.x + 36, 72, golfer.root.position.z - 30);
    caddie.stand(golfer.root.position, plan.dir);
    // The flash ring around the cup shows on the green and when the pin is near.
    const toPin = Math.hypot(hole.pin.x - hstate.at.x, hole.pin.z - hstate.at.z);
    holeScene?.setCupAid(hstate.lie === 'green' || toPin <= CUP_AID_RANGE);
  };

  /** Plans the shot from the current aim and shows the ring, the chips and the map. */
  const refreshAim = () => {
    plan = makePlan();
    aimDeg = plan.aimDeg;
    const over = surfaceAt(hole, plan.landing.x, plan.landing.z);
    guide.update(plan, over);
    const putt = isPutt(plan);
    const toPin = Math.hypot(hole.pin.x - hstate.at.x, hole.pin.z - hstate.at.z);
    hud.renderChips(
      {
        club: putt ? 'Putter' : `${plan.club.name} · ${Math.round(plan.carry)} yd`,
        surface: SURFACE_NAMES[over],
        wind: windChip(hole, putt),
        pin: `Pin ${Math.round(toPin)} yd`,
      },
      putt,
    );
    hud.renderMap(hole, hstate.at, plan.landing);
    placeGolfer();
  };

  // ---------- Speech ----------
  const sayLines = (lines: string[], thisTurn: number, done: () => void) => {
    const token = ++speechToken;
    const say = (i: number) => {
      if (token !== speechToken || turn !== thisTurn) return;
      if (i >= lines.length) {
        done();
        return;
      }
      speak(lines[i], () => say(i + 1));
    };
    say(0);
  };

  // ---------- Starting a hole ----------
  const startHoleAt = (index: number) => {
    holeIndex = index;
    hole = HOLES[index];
    holeScene?.dispose();
    holeScene = buildHole(hole);
    scene.add(holeScene.object);
    const first = devPending;
    hstate = first ? devHoleState(hole) : startHole(hole);
    aimDeg = (first ? devAim(hole, hstate) : null) ?? 0;
    const skipIntro = first && devSkipIntro();
    devPending = false;
    const thisTurn = ++turn;
    timers.clear();
    tapFlow.disarm();
    hud.hideBanner();
    hud.hidePill();
    hud.showQuestion(false);
    hud.showControls(false);
    hud.showMap(false);
    guide.setVisible(false);
    plan = makePlan();
    placeGolfer();
    ball.setVisible(true);
    ball.splash(null);
    ball.place({ x: hstate.at.x, y: BALL_R, z: hstate.at.z }, hstate.lie);
    hud.renderMap(hole, hstate.at, null);
    renderCard();
    setGolf('address');
    ball.setAddress(false);
    if (skipIntro) {
      beginAim(0);
      return;
    }
    phase = 'intro';
    introAt = gameTime;
    goTo('intro', 0);
    hud.showBanner(`Hole ${index + 1}`, `Par ${hole.par} · ${hole.length} yd`, 'info', 'aim');
    const lines = [holeIntro(index)];
    if (index === HOLES.length - 1) lines.push(LAST_HOLE_SPEECH);
    sayLines(lines, thisTurn, () => undefined);
    after(INTRO_FOR, () => {
      if (turn === thisTurn && phase === 'intro' && devIntroAt() === null) beginAim(0.9);
    });
  };

  const beginAim = (seconds: number) => {
    phase = 'aim';
    hud.hideBanner();
    hud.showQuestion(false);
    guide.setVisible(true);
    ball.setVisible(true);
    ball.splash(null);
    ball.place({ x: hstate.at.x, y: BALL_R, z: hstate.at.z }, hstate.lie);
    ball.setAddress(true);
    refreshAim();
    renderCard();
    hud.showControls(true);
    hud.showMap(true);
    setGolf('address');
    goTo('aim', seconds);
  };

  // ---------- Asking ----------
  const readQuestion = (thisTurn: number) => {
    if (!fact) return;
    const token = ++speechToken;
    speak(promptSpeech(fact), () => {
      if (token !== speechToken || turn !== thisTurn || phase !== 'ask') return;
      speechDone = true;
    });
  };

  /** Tap Swing!: the question is read and the clock starts once the reading ends. */
  const ask = () => {
    if (phase !== 'aim') return;
    unlockAudio();
    timers.clear();
    tapFlow.disarm();
    stopSpeaking();
    hud.hideBanner();
    hud.hidePill();
    hud.showControls(false);
    hud.showMap(false);
    const thisTurn = ++turn;
    fact = feed.take();
    options = answerOptions(session.topic, fact, 4);
    chosen = -1;
    clockTotal = session.timerSecondsFor(fact);
    answerTime = 0;
    speechDone = false;
    lastTick = Math.ceil(clockTotal);
    phase = 'ask';
    hud.setOptions(options);
    hud.setQuestion(fact.prompt);
    hud.setClock(1, false);
    hud.showQuestion(true);
    // A long question may be taller: the view fits the band that is left.
    bands = hud.measureBands();
    goTo('ask', 0.35);
    readQuestion(thisTurn);
  };

  const updateAsk = (delta: number) => {
    if (phase !== 'ask') return;
    if (speechDone) answerTime += delta;
    const remaining = clockTotal - (speechDone ? answerTime : 0);
    const seconds = Math.max(Math.ceil(remaining), 0);
    if (seconds < lastTick && seconds > 0 && seconds <= 3) sfx.tick();
    lastTick = seconds;
    hud.setClock(Math.max(remaining, 0) / clockTotal, seconds <= 3 && speechDone);
    if (speechDone && remaining <= 0) timeUp();
  };

  /** The kid taps an answer, while the question is read or the clock runs. */
  const select = (index: number) => {
    if (phase !== 'ask' || !fact) return;
    if (options[index] === undefined) return;
    try {
      unlockAudio();
      stopSpeaking();
    } catch {
      // Audio trouble must never stop the swing.
    }
    speechToken++;
    // A tap before the question has been read out counts as no time used at all.
    const used = speechDone ? answerTime : 0;
    chosen = index;
    hud.lock();
    answered(options[index] === fact.answer, used, false);
  };

  const timeUp = () => {
    if (phase !== 'ask' || !fact) return;
    chosen = -1;
    hud.lock();
    answered(false, clockTotal, true);
  };

  const answered = (right: boolean, used: number, timedOut: boolean) => {
    const f = fact;
    if (!f) return;
    const thisTurn = turn;
    if (right) {
      feed.recordHit(f);
      session.recordAnswer(f, true);
    } else {
      feed.recordMiss(f);
      session.recordAnswer(f, false);
    }
    hud.mark(chosen, options.indexOf(f.answer), right);
    hud.setClock(null, false);
    guide.setVisible(false);

    // A dev address may force the next shot's quality, whatever the answer.
    const forced = forcedQuality;
    forcedQuality = null;
    const strikeRight = forced ? forced !== 'duff' : right;
    const strikeUsed = forced === 'perfect' ? 0 : forced === 'wobbly' ? clockTotal * 0.6 : used;
    const side = devSide() || (Math.random() < 0.5 ? -1 : 1);
    outcome = resolveShot(plan, strikeRight, strikeUsed, clockTotal, side);
    result = finishShot(hole, plan, outcome);
    afterHole = afterShot(hstate, hole, result);
    missed = !right;
    // A holed shot is drawn flying to the pin, since the cup is drawn much smaller than the holing radius.
    flightOutcome = result.kind === 'holed' ? holedOutcome(outcome, hole.pin) : outcome;
    if (result.kind === 'rest' && result.tree !== undefined) {
      // A ball that hits a tree stops flying and drops there.
      travel = null;
      flightDur = flightSeconds(plan, flightOutcome) * result.tree;
    } else {
      // Otherwise it lands short, hops and rolls to where it rests.
      const end = result.kind === 'rest' ? result.at : flightOutcome.end;
      const surface =
        result.kind === 'holed' ? 'green' : result.kind === 'rest' ? result.surface : null;
      travel = createTravel(plan, { ...flightOutcome, end }, surface);
      flightDur = travel.seconds;
    }

    after(HIDE_QUESTION_AFTER, () => {
      if (turn !== thisTurn) return;
      // The question goes; after a miss the answers stay up for the tap.
      hud.showQuestion(false, !right);
    });
    if (!right) {
      // A math fact shows its picture instead of the statement.
      hud.showBanner(
        timedOut ? "Time's up!" : 'Not quite!',
        f.visual ? '' : f.statement,
        'miss',
        'ask',
      );
      // The fact is read once the ball has landed; the game then waits for the green answer.
      tapFlow.reveal(hud.buttons, options, f, {
        avoid: hud.avoid,
        problem: f.prompt,
        chosen: options[chosen],
        delay: timingFor(plan.club).seconds + flightDur,
      });
    }
    startSwing();
  };

  // ---------- The swing and the flight ----------
  const startSwing = () => {
    phase = 'swing';
    launched = false;
    swingAt = gameTime;
    flightT = 0;
    ballPos = { x: plan.from.x, y: BALL_R, z: plan.from.z };
    ball.setAddress(false);
    setGolf('swing');
    goTo('follow', 0.6);
  };

  const updateSwing = () => {
    if (phase !== 'swing') return;
    if (!launched && gameTime - swingAt >= timingFor(plan.club).impact) {
      launched = true;
      sfx.kick();
      // The club throws up grass or sand where it meets the ground (the putter just rolls it).
      if (!isPutt(plan)) {
        ball.puff(hstate.lie === 'sand' ? 'sand' : 'grass', plan.from, gameTime, plan.dir);
      }
      phase = 'flight';
      flightT = 0;
      ballPos = { x: plan.from.x, y: BALL_R, z: plan.from.z };
    }
  };

  const updateFlight = (delta: number) => {
    if (phase !== 'flight' || !outcome || !flightOutcome) return;
    flightT += delta;
    const u = flightT / flightDur;
    // A ball that hits a tree stops flying at that point of its path.
    const stop = result?.kind === 'rest' ? (result.tree ?? 1) : 1;
    const p = travel ? travel.at(flightT) : flightPoint(plan, flightOutcome, Math.min(u, 1) * stop);
    ballPos = p;
    ball.place(p, 'rough');
    ball.trail(gameTime, p);
    if (u >= 1) land();
  };

  /** The ball has finished: where it ended, the new lie, and the camera settling there. */
  const land = () => {
    if (phase !== 'flight' && phase !== 'swing') return;
    if (!outcome || !result) return;
    phase = 'landed';
    hstate = afterHole;
    // The golfer and the caddie walk up to the ball, so their reactions are in the landing view.
    placeGolfer();
    if (result.kind === 'holed') {
      // The ball drops into the cup (see the loop) and then goes.
      ball.place({ x: hole.pin.x, y: BALL_R, z: hole.pin.z }, 'green');
      holeDropAt = gameTime;
    } else if (result.kind === 'water') {
      ball.setVisible(false);
      splashAt = gameTime;
      ball.splash(result.splash, 0);
    } else {
      ball.place({ x: result.at.x, y: BALL_R, z: result.at.z }, result.surface);
    }
    if (result.kind === 'water' || outcome.quality === 'duff') sfx.miss();
    else if (result.kind === 'holed') sfx.cheer();
    else sfx.tick();
    ballPos = { x: hstate.at.x, y: 0, z: hstate.at.z };
    goTo('land', 1.0);
    renderCard();
    if (!missed) showResult();
    // After a miss the reveal is already waiting; the tap on the green answer shows the result.
  };

  // ---------- The result ----------
  const showResult = () => {
    if (!outcome || !result) return;
    const thisTurn = turn;
    phase = 'result';
    resultAt = gameTime;
    const call = shotCall(callKindFor(result, outcome.quality, isPutt(plan)));
    const holed = result.kind === 'holed';
    hud.showBanner(call, '', holed ? 'good' : outcome.quality === 'duff' ? 'miss' : 'info', 'aim');
    hud.showPill(`${pillFor(result)} · Shot ${hstate.strokes}`);
    after(PILL_FOR, () => hud.hidePill());
    if (outcome.quality === 'duff' || result.kind === 'water') setGolf('groan');
    else if (holed || (result.kind === 'rest' && result.surface === 'green' && !isPutt(plan))) {
      setGolf('cheer');
    } else setGolf('follow');
    // The caddie reacts to the shot, or to the hole when this shot ends it.
    caddie.react(
      reactionFor(
        result,
        holeOver(hstate) ? nameFor(holeScore(hstate), hole.par, hstate.holed) : null,
        { quality: outcome.quality, putt: isPutt(plan) },
      ),
    );
    speechOver = false;
    holdOver = false;
    sayLines([call], thisTurn, () => (speechOver = true));
    after(SHOT_HOLD, () => (holdOver = true));
  };

  /** A miss never moves on by itself: only a tap on the green answer does. */
  const proceedAfterMiss = () => {
    if (phase === 'swing' || phase === 'flight') land();
    hud.hideBanner();
    hud.showQuestion(false);
    missed = false;
    showResult();
  };

  const advance = () => {
    if (phase !== 'result') return;
    timers.clear();
    speechToken++;
    stopSpeaking();
    hud.hideBanner();
    hud.hidePill();
    hud.showQuestion(false);
    if (holeOver(hstate)) {
      showHoleCall();
      return;
    }
    // Back to the aim from the new lie.
    aimDeg = 0;
    plan = makePlan();
    ball.setVisible(true);
    ball.splash(null);
    splashAt = -1;
    beginAim(0.7);
  };

  const showHoleCall = () => {
    const thisTurn = ++turn;
    phase = 'holecall';
    resultAt = gameTime;
    const score = holeScore(hstate);
    const name = nameFor(score, hole.par, hstate.holed);
    const line = holeCall(name);
    scores = [...scores, score];
    renderCard();
    const rel = score - hole.par;
    hud.showBanner(
      line.replace(/[.!]$/, ''),
      '',
      rel <= -1 && hstate.holed ? 'good' : 'info',
      'aim',
    );
    if (hstate.holed && rel <= -1) sfx.cheer();
    setGolf(rel <= -1 && hstate.holed ? 'cheer' : rel >= 2 || !hstate.holed ? 'groan' : 'follow');
    speechOver = false;
    holdOver = false;
    sayLines([line], thisTurn, () => (speechOver = true));
    after(HOLE_HOLD, () => (holdOver = true));
  };

  const nextHole = () => {
    if (phase !== 'holecall') return;
    timers.clear();
    speechToken++;
    stopSpeaking();
    hud.hideBanner();
    if (holeIndex >= HOLES.length - 1) {
      finishGame();
      return;
    }
    startHoleAt(holeIndex + 1);
  };

  const updateGate = () => {
    if (phase === 'result' && !missed && speechOver && holdOver) advance();
    else if (phase === 'holecall' && speechOver && holdOver) nextHole();
  };

  // ---------- The end ----------
  const roundTotals = () => {
    const pars = HOLES.map((h) => h.par);
    const rel = totalVsPar(scores, pars);
    const strokes = scores.reduce((s, n) => s + n, 0);
    return { rel, strokes };
  };

  const finishGame = () => {
    phase = 'over';
    const thisTurn = ++turn;
    tapFlow.disarm();
    hud.hideBanner();
    hud.showControls(false);
    hud.showMap(false);
    hud.showQuestion(false);
    guide.setVisible(false);
    const { rel, strokes } = roundTotals();
    hud.setCardBig(true, `${strokes} strokes · ${relText(rel)}`);
    hud.showBanner('Round over', '', 'info', 'aim');
    const best = storedFor(rel) > bestAtStart;
    speak(best ? NEW_BEST_SPEECH : ROUND_OVER_SPEECH);
    sfx.cheer();
    after(FINAL_FOR, () => {
      if (turn === thisTurn && phase === 'over') finishRun();
    });
  };

  const finishRun = () => {
    if (phase !== 'over') return;
    phase = 'done';
    timers.clear();
    stopSpeaking();
    hud.hideBanner();
    hud.showCard(false);
    const { rel, strokes } = roundTotals();
    const stored = storedFor(rel);
    const stars = starsFor(feed.correct, feed.answered);
    session.recordStars(stars);
    session.recordScore(stored);
    const best = Math.max(session.highScore(), stored);
    showResults({
      topicId: session.topic.id,
      correct: feed.correct,
      total: feed.answered,
      stars,
      newBest: false,
      missed: feed.missed(),
      playerName: session.player?.name,
      score: stored,
      scoreText: relText(rel),
      outcome: roundOutcome(strokes, rel),
      highScore: best,
      highScoreText: `Best: ${relText(relFromStored(best))}`,
      newHighScore: stored > bestAtStart,
      playAgainLabel: 'Play again ⛳',
      onPlayAgain: () => startGame(false),
    });
  };

  const startGame = (withPreview: boolean) => {
    timers.clear();
    turn++;
    speechToken++;
    tapFlow.disarm();
    stopSpeaking();
    feed = createFactFeed(() => session.chooseFacts());
    bestAtStart = session.highScore();
    fact = undefined;
    options = [];
    outcome = null;
    result = null;
    missed = false;
    splashAt = -1;
    forcedQuality = devQuality();
    const start = withPreview || devPending ? devStart() : { hole: 0, scores: [] };
    scores = start.scores;
    hud.setCardBig(false);
    hud.showCard(true);
    hud.hideBanner();
    hud.hidePill();
    hud.showQuestion(false);
    hud.showControls(false);
    if (devHolesOk()) {
      // Every hole played at once, a little over and under par, for a look at the results.
      const wobble = [1, 0, -1, 2, 0, 1, 0, -1, 1];
      scores = HOLES.map((h, i) => h.par + wobble[i]);
      holeIndex = HOLES.length - 1;
      hole = HOLES[holeIndex];
      phase = 'over';
      finishRun();
      return;
    }
    if (!withPreview) {
      devPending = false;
      startHoleAt(0);
      return;
    }
    phase = 'preview';
    holeIndex = start.hole;
    hole = HOLES[holeIndex];
    plan = makePlan();
    goTo('intro', 0);
    showPreview({
      topic: session.topic,
      facts: feed.peek(10),
      onDone: () => startHoleAt(start.hole),
    });
  };

  // ---------- Input ----------
  const swingNow = () => {
    if (phase === 'aim') ask();
  };

  const nudge = (deg: number) => {
    if (phase !== 'aim') return;
    aimDeg = Math.min(Math.max(aimDeg + deg, -AIM_MAX), AIM_MAX);
    refreshAim();
    retarget(0.15);
  };

  const skip = () => {
    if (tapFlow.armed) return;
    if (phase === 'intro' && gameTime - introAt >= SKIP_INTRO_AFTER && devIntroAt() === null) {
      // Cut the flyover and the hole's introduction short and line up the shot.
      speechToken++;
      stopSpeaking();
      beginAim(0.6);
    } else if ((phase === 'flight' || phase === 'swing') && gameTime - swingAt >= FAST_AFTER) {
      land();
    } else if (phase === 'result' && gameTime - resultAt >= SKIP_RESULT_AFTER) {
      advance();
    } else if (phase === 'holecall' && gameTime - resultAt >= SKIP_RESULT_AFTER) {
      nextHole();
    }
  };

  const onAnswer = (index: number) => {
    if (tapFlow.armed) {
      // After a miss only the green answer moves on; any other answer is ignored.
      if (tapFlow.tap(index)) proceedAfterMiss();
      return;
    }
    if (phase === 'ask') select(index);
    else skip();
  };

  const unpress: (() => void)[] = [];
  const press = (button: HTMLElement, handler: () => void) => {
    // A touch press doesn't count as a user gesture for iOS audio; the release does.
    button.addEventListener('pointerup', unlockAudio);
    unpress.push(onPress(button, handler));
  };
  unpress.push(pressAnswers(hud.buttons, onAnswer));
  press(hud.swing, swingNow);
  press(hud.nudgeLeft, () => nudge(-AIM_STEP));
  press(hud.nudgeRight, () => nudge(AIM_STEP));
  hud.hear.addEventListener('click', () => {
    unlockAudio();
    if (!fact || phase !== 'ask') return;
    const thisTurn = turn;
    const token = ++speechToken;
    speak(promptSpeech(fact), () => {
      if (token !== speechToken || turn !== thisTurn || phase !== 'ask') return;
      speechDone = true;
    });
  });

  // Dragging sideways turns the aim.
  const stopPointer = createPointerInput(ctx.renderer.domElement, {
    onDragStart: () => unlockAudio(),
    onDrag: (state) => {
      if (phase !== 'aim') return;
      const before = aimDeg;
      aimDeg = Math.min(Math.max(aimDeg + state.dx * DEG_PER_PX, -AIM_MAX), AIM_MAX);
      if (aimDeg === before) return;
      refreshAim();
      retarget(0.08);
    },
    onTap: skip,
  });

  const onKey = (e: KeyboardEvent) => {
    if (pause.isPaused) return;
    const index = Number(e.key) - 1;
    if ((phase === 'ask' || tapFlow.armed) && index >= 0 && index < hud.buttons.length) {
      onAnswer(index);
      return;
    }
    if (phase === 'intro' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      skip();
      return;
    }
    if (phase !== 'aim') return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      swingNow();
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      nudge(-AIM_STEP);
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      nudge(AIM_STEP);
    }
  };
  window.addEventListener('keydown', onKey);

  // ---------- Loop ----------
  ctx.onUpdate((delta) => {
    layout();
    gameTime += delta;
    tapFlow.update(delta);
    timers.update(delta);
    if (moveT < 1) moveT = Math.min(1, moveT + delta / Math.max(moveDur, 1e-3));

    updateAsk(delta);
    updateSwing();
    updateFlight(delta);
    updateGate();
    // A miss whose reveal has not been tapped yet leaves the ball where it landed.
    if (splashAt >= 0 && result?.kind === 'water') ball.splash(result.splash, gameTime - splashAt);

    ball.trail(gameTime);
    if (holeDropAt >= 0) {
      const u = (gameTime - holeDropAt) / HOLE_DROP_FOR;
      ball.sink(hole.pin, u);
      if (u >= 1) {
        ball.setVisible(false);
        holeDropAt = -1;
      }
    }
    ball.update(gameTime);
    const frozen = devSwing();
    if (frozen !== null) golfer.play('swing', frozen, delta);
    else golfer.play(golfMove, gameTime - golfSince, delta);
    caddie.update(delta);
    holeScene?.update(gameTime);
    sky.update(gameTime, camera.position, hole.length / 2);
    applyCamera();
  });

  layout(true);
  ctx.start();
  startGame(true);

  window.addEventListener('pagehide', () => {
    stopSpeaking();
    window.removeEventListener('keydown', onKey);
    stopPointer();
    tapFlow.dispose();
    unpress.forEach((fn) => fn());
    pause.dispose();
    mute.dispose();
    hud.dispose();
    holeScene?.dispose();
    sky.dispose();
    ctx.dispose();
  });
}

const session = startGameSession(GAME_ID);
if (session) run(session);
else location.replace(menuUrl());
