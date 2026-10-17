import './style.css';
import { MathUtils, Vector3, type Object3D } from 'three';
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
import {
  createBall,
  createBatter,
  createCatcher,
  createFielder,
  createPitcher,
  createUmpire,
  FIELDER_SPOTS,
  type Batter,
  type Actor,
  type Fielder,
  type FielderId,
  type Prop,
} from './characters';
import { planBatted, type BattedBall } from './batted';
import { planPlay, type PlayEvent, type PlayScript } from './choreo';
import { POSITIONS } from './defense';
import { createPlayRunner } from './play';
import { devStart, forcedPlay } from './dev';
import { createEffects, fireworkColour } from './effects';
import { buildField } from './field';
import {
  BALL_RADIUS,
  BASE_SIDE,
  BASE_SPOTS,
  CONTACT,
  dashPosition,
  GLOVE,
  GLOVE_TIME,
  MISS_POINT,
  pitchPosition,
  RELEASE,
  ZIP_TIME,
  type Vec,
} from './flight';
import { createHud } from './hud';
import {
  centreShift,
  fireworksAim,
  fireworksFit,
  fitMoundView,
  fitView,
  followGoal,
  frameAction,
  hitBand,
  ballScale,
  homeView,
  hudRects,
  keepBoardClear,
  moundView,
  type HomeView,
  type Rect,
  type ViewFit,
} from './layout';
import { createPitching, REVEAL_FOR, SKIP_AFTER } from './pitching';
import {
  applyHit,
  applyStrike,
  batterNumber,
  easeToward,
  EXTRA_INNINGS,
  finalSpeech,
  halfEndSpeech,
  halfEndTitle,
  halfOver,
  hitFor,
  hitKindSpeech,
  hitLabel,
  hitOfKind,
  hitSubtitle,
  inningBanner,
  inningSpeech,
  INNINGS,
  isBatting,
  leadSpeech,
  lineScore,
  newGame,
  nextHalf,
  PLAY_BALL,
  pickHitKind,
  runsText,
  strikeCall,
  totals,
  YOU_WIN,
  type GameState,
  type Hit,
  type Move,
  type Position,
} from './rules';
import {
  coloursOf,
  loseSpeech,
  matchupSpeech,
  OUR_COLOURS,
  ourAbbr,
  outcomeText,
  pickRival,
  scoreLine,
  teamName,
  walkOffSpeech,
  type Team,
} from './teams';

const GAME_ID = 'batter-up';

/** Seconds the name of a hit stays up while the ball is in the air. */
const BANNER_FOR = 1.4;
/** The pitcher winds up at least this long, however quickly the question is read. */
const MIN_WIND = 0.9;
/** Seconds into a hit before a tap can skip the rest of it. */
const HIT_SKIP_AFTER = 1.4;
/** Seconds an announcement (a new inning, the end of one) stays up at least. */
const ANNOUNCE_FOR = 1.8;

type Phase =
  | 'preview'
  | 'announce'
  | 'windup'
  | 'release'
  | 'pitch'
  | 'swing'
  | 'result'
  | 'hit'
  | 'pitching'
  | 'done';

type CamMode = 'home' | 'follow' | 'frame' | 'mound';

/** A runner on the move: where they end up, and what happens when they get there. */
interface Running {
  batter: Batter;
  final: Vec;
  arrive: () => void;
  done: boolean;
}

function run(session: GameSession): void {
  const container = document.getElementById('game');
  if (!container) throw new Error('Missing #game container');

  // ---------- Scene ----------
  const ctx = createScene(container, { fov: 60, near: 0.3, far: 600 });
  const { scene, camera } = ctx;
  const field = buildField(scene);
  const effects = createEffects();
  scene.add(effects.object);
  const ball = createBall();
  ball.setVisible(false);
  scene.add(ball.object);
  const pitcher = createPitcher();
  const catcher = createCatcher();
  const umpire = createUmpire();
  scene.add(pitcher.root, catcher.root, umpire.root);
  const fielders: Fielder[] = (Object.keys(FIELDER_SPOTS) as FielderId[]).map((id, i) =>
    createFielder(id, i),
  );
  fielders.forEach((f) => scene.add(f.mover.person.root));
  /** All nine, by position. */
  const actors = {
    P: pitcher,
    C: catcher,
    ...Object.fromEntries(fielders.map((f) => [f.id, f])),
  } as unknown as Record<Position, Actor>;

  // ---------- HUD ----------
  const hud = createHud();
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
  let state: GameState = newGame();
  /** The high score when this run began; the run saves its score as it goes. */
  let bestAtStart = session.highScore();
  /** Who we play this game, and how we are called on the scorebug. */
  let rival: Team = pickRival(Math.random());
  let usAbbr = 'YOU';
  /** What the scorebug shows; it lags the real state while a play is still happening. */
  const shown = { runs: 0, strikes: 0, outs: 0 };
  let fact: Fact | undefined;
  let options: string[] = [];
  let chosen = -1;
  /** Ticks up for each pitch, so late callbacks can tell they are stale. */
  let turn = 0;

  // The pitch in flight.
  let speechDone = false;
  let speechToken = 0;
  let flightTotal = 10;
  let elapsed = 0;
  /** Seconds since the question finished being read, which runs on through the wind-up and flight. */
  let answerTime = 0;
  const pitchStart: Vec = { ...RELEASE };
  const ballPos: Vec = { ...RELEASE };
  let lastTick = 0;
  /** The ball's current dash (zipping to the bat, then the mitt), if any. */
  let dash: {
    from: Vec;
    segments: { to: Vec; dur: number; onEnd?: () => void }[];
    t: number;
  } | null = null;
  let resultAt = 0;

  // The people.
  let batter: Batter = createBatter();
  let onBase: (Batter | null)[] = [null, null, null];
  let running: Running[] = [];
  let leaving: Batter[] = [];
  let props: Prop[] = [];

  // A hit in progress.
  /** How much the ball is scaled up now, so its trail can match. */
  let ballScaleNow = 1;
  /** The path of the ball in play, and the script of the play being run. */
  let plan: BattedBall | null = null;
  let script: PlayScript | null = null;
  /** The people in the play: the batter, and the runners from first, second and third. */
  let playFigures: (Batter | null)[] = [null, null, null, null];
  let fireworksFrom = Infinity;
  /** Seconds the batter and runners need to finish running the bases (for the rival's plays). */
  let runTime = 0;
  /** The batter at the plate was just struck out. */
  let struckOut = false;
  /** Replays of the fact the player asked for during a result; the next pitch waits for them. */
  let replaying = 0;
  /** Moves on from a result if everything it was waiting for is done. */
  let resultDone: (() => void) | null = null;
  /** Skips the announcement on screen, once it has been up a moment. */
  let skipAnnounce: (() => void) | null = null;
  let announceToken = 0;

  // The camera.
  let camMode: CamMode = 'home';
  let home: HomeView = homeView(0.5);
  let mound: HomeView = moundView(0.5);
  /** The pitching view's field of view and shift, for this screen. */
  let moundFit: ViewFit = { fov: 60, shift: 0 };
  const cam = new Vector3(home.cam.x, home.cam.y, home.cam.z);
  const look = new Vector3(home.look.x, home.look.y, home.look.z);
  const goalPos: Vec = { ...home.cam };
  const goalLook: Vec = { ...home.look };
  const handPoint = new Vector3();
  const point = new Vector3();

  // Delayed actions run on game time so pausing freezes them too. `after` is for the flow of the
  // game and is wiped at each pitch; `later` is for scenery and only cleared on a new game.
  let gameTime = 0;
  let pending: { at: number; fn: () => void }[] = [];
  let scenery: { at: number; fn: () => void }[] = [];
  const after = (seconds: number, fn: () => void) => pending.push({ at: gameTime + seconds, fn });
  const later = (seconds: number, fn: () => void) => scenery.push({ at: gameTime + seconds, fn });

  /** Everyone and everything added to the scene during play, so a new game can clear it away. */
  const spawned = new Set<Object3D>();
  const spawn = (object: Object3D) => {
    spawned.add(object);
    scene.add(object);
  };
  /** Takes something out of the scene for good, freeing what it was made of. */
  const retire = (object: Object3D) => {
    spawned.delete(object);
    scene.remove(object);
    object.traverse((child) => {
      const part = child as Partial<{ geometry: { dispose(): void }; material: unknown }>;
      part.geometry?.dispose();
      const materials = Array.isArray(part.material) ? part.material : [part.material];
      materials.forEach((m) => (m as { dispose?: () => void } | undefined)?.dispose?.());
    });
  };

  // ---------- Layout ----------
  let viewW = 0;
  let viewH = 0;

  /** The batting view's field of view and shift, for this screen. */
  let fit: ViewFit = { fov: 60, shift: 0 };
  /** What the camera uses now: it eases between the batting view and the views of a hit. */
  let viewFov = 60;
  let viewShift = 0;
  /** The part of the screen a hit plays out in (the question is hidden), and its two framings. */
  let hitFrame = {
    band: hitBand(0, 0),
    blocked: [] as Rect[],
    shift: 0,
    fireworks: { fov: 60, shift: 0 } as ViewFit,
  };

  const applyView = () => {
    camera.fov = viewFov;
    camera.setViewOffset(viewW, viewH, 0, viewShift, viewW, viewH);
    camera.updateProjectionMatrix();
    effects.setScale(
      (viewH * ctx.renderer.getPixelRatio()) / (2 * Math.tan((viewFov * Math.PI) / 360)),
    );
  };

  /** Works out where a hit's view goes, from where the scorebug really is. */
  const measureHit = () => {
    const bug = hud.bugRect();
    const band = hitBand(viewW, viewH, bug.bottom);
    hitFrame = {
      band,
      blocked: hudRects(viewW, viewH, bug),
      shift: centreShift(viewH, band),
      fireworks: fireworksFit(viewW, viewH, fit.fov, band),
    };
  };

  const layout = (force = false) => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!force && w === viewW && h === viewH) return;
    viewW = w;
    viewH = h;
    const measured = hud.measureBand();
    // A little air between the HUD and the field.
    fit = fitView(w, h, { top: measured.top + 8, bottom: measured.bottom - 8 });
    home = homeView(w / Math.max(h, 1));
    mound = moundView(w / Math.max(h, 1));
    moundFit = fitMoundView(w, h, { top: measured.top + 8, bottom: measured.bottom - 8 });
    camera.aspect = w / Math.max(h, 1);
    const pitchingNow = camMode === 'mound';
    viewFov = pitchingNow ? moundFit.fov : fit.fov;
    viewShift = pitchingNow ? moundFit.shift : fit.shift;
    measureHit();
    applyView();
  };

  const toScreen = (world: Vec) => {
    const p = point.set(world.x, world.y, world.z).project(camera);
    return {
      x: MathUtils.clamp(((p.x + 1) / 2) * viewW, 40, viewW - 40),
      y: MathUtils.clamp(((1 - p.y) / 2) * viewH, 90, viewH - 90),
    };
  };

  // ---------- Saving ----------
  /** Stars are only worth saving once there are enough answers to judge by. */
  const MIN_ANSWERS_FOR_STARS = 10;
  /**
   * Saves how the run stands: the score as the high score, and the stars once there are enough
   * answers. Each answer is saved by the session as it is given, so the player can quit at any
   * moment and keep everything so far. Both are "best so far" records, so saving them again at
   * the end, or on the next run, never takes anything away.
   */
  const saveProgress = () => {
    session.recordScore(totals(state).us);
    if (feed.answered >= MIN_ANSWERS_FOR_STARS) {
      session.recordStars(starsFor(feed.correct, feed.answered));
    }
  };

  // ---------- HUD helpers ----------
  const refresh = () => {
    const line = lineScore(state, shown.runs);
    hud.renderBug({
      usAbbr,
      themAbbr: rival.abbr,
      usRuns: line.usTotal,
      themRuns: line.themTotal,
      inning: state.inning,
      half: state.half,
      best: Math.max(session.highScore(), 0),
      outs: shown.outs,
      strikes: shown.strikes,
      bases: state.bases,
    });
    field.setBoard({
      usAbbr,
      themAbbr: rival.abbr,
      line,
      inning: state.inning,
      half: state.half,
      outs: shown.outs,
    });
  };

  // ---------- The ball ----------
  const putBall = (p: Vec, followed = false) => {
    ballPos.x = p.x;
    ballPos.y = p.y;
    ballPos.z = p.z;
    const far = camera.position.distanceTo(point.set(p.x, p.y, p.z));
    if (!followed) {
      // Far from the camera the ball is drawn bigger, so it can still be seen.
      ball.place(ballPos, MathUtils.clamp(far / 20, 1, 3));
      return;
    }
    // A ball in flight after a hit is never smaller than a few pixels on screen, however far
    // it goes. A bigger ball must not sink into the ground.
    const scale = ballScale(far, viewFov, viewH);
    ball.place({ x: p.x, y: Math.max(p.y, BALL_RADIUS * scale), z: p.z }, scale);
    ballScaleNow = scale;
  };

  /** Sends the ball along straight segments, running each one's `onEnd` as it gets there. */
  const startDash = (
    segments: { to: Vec; dur: number; onEnd?: () => void }[],
    from: Vec = ballPos,
  ) => {
    dash = { from: { ...from }, segments: [...segments], t: 0 };
  };

  const updateDash = (delta: number) => {
    if (!dash) return;
    const current = dash;
    const segment = current.segments[0];
    if (!segment) {
      dash = null;
      return;
    }
    current.t += delta;
    const s = current.t / segment.dur;
    putBall(dashPosition(current.from, segment.to, s, { x: 0, y: 0, z: 0 }));
    ball.spin(delta, 30);
    effects.trail(ballPos);
    if (s >= 1) {
      current.segments.shift();
      current.from = { ...segment.to };
      current.t = 0;
      if (!current.segments.length && dash === current) dash = null;
      segment.onEnd?.();
    }
  };

  // ---------- Batting ----------
  /** Takes the next fact and puts its question and answers up, for either side of the game. */
  const ask = () => {
    fact = feed.take();
    options = answerOptions(session.topic, fact, 4);
    chosen = -1;
    hud.setOptions(options);
    hud.setQuestion(fact.prompt);
    // A long prompt may need to drop below the scorebug; then the view fits the new band.
    if (hud.settleQuestion()) layout(true);
    return { fact, options, seconds: session.timerSecondsFor(fact) };
  };

  /** Starts a new pitch: the question, the answers, and the pitcher winding up as it is read. */
  const nextPitch = () => {
    if (state.over || phase === 'done') return;
    pending = [];
    stopSpeaking();
    hud.hideBanner();
    const thisTurn = ++turn;
    ({ seconds: flightTotal } = ask());
    elapsed = 0;
    answerTime = 0;
    speechDone = false;
    dash = null;
    hud.setClock(1);
    hud.hideQuestion(false);
    ball.setVisible(false);
    ball.setGlow(false);
    umpire.reset();
    batter.ready();
    pitcher.windUp();
    phase = 'windup';
    refresh();
    readQuestion(thisTurn);
  };

  /** Reads the question out. The pitcher lets go once it is finished. */
  const readQuestion = (thisTurn: number) => {
    if (!fact) return;
    const token = ++speechToken;
    speak(fact.spokenPrompt ?? fact.prompt, () => {
      if (token !== speechToken || turn !== thisTurn || phase !== 'windup') return;
      speechDone = true;
    });
  };

  /** The question has been read and the wind-up held long enough: let it go. */
  const throwPitch = () => {
    const thisTurn = turn;
    phase = 'release';
    pitcher.release(() => {
      if (turn !== thisTurn || phase !== 'release') return;
      pitcher.handPosition(handPoint);
      pitchStart.x = handPoint.x;
      pitchStart.y = handPoint.y;
      pitchStart.z = handPoint.z;
      putBall(pitchStart);
      ball.setVisible(true);
      phase = 'pitch';
      elapsed = 0;
      lastTick = Math.ceil(flightTotal);
    });
  };

  const updatePitch = (delta: number) => {
    if (speechDone && (phase === 'windup' || phase === 'release' || phase === 'pitch')) {
      answerTime += delta;
    }
    if (phase === 'windup' && speechDone && pitcher.windTime >= MIN_WIND) throwPitch();
    if (phase !== 'pitch') return;
    elapsed += delta;
    const u = elapsed / flightTotal;
    putBall(pitchPosition(u, { x: 0, y: 0, z: 0 }, pitchStart));
    ball.spin(delta, 9);
    effects.halo(ballPos, 0.75, delta * 2.5);
    hud.setClock(1 - u);
    const seconds = Math.ceil(flightTotal - elapsed);
    if (seconds < lastTick && seconds > 0 && seconds <= 3) sfx.tick();
    lastTick = seconds;
    if (elapsed >= flightTotal) timeUp();
  };

  // ---------- Answering ----------
  /** The player picks an answer, in the windup or while the ball floats in. */
  const select = (index: number) => {
    if ((phase !== 'windup' && phase !== 'release' && phase !== 'pitch') || !fact) return;
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
    if (phase === 'windup') {
      pitcher.release(() => {});
    }
    if (phase !== 'pitch') {
      pitcher.handPosition(handPoint);
      putBall(handPoint);
      ball.setVisible(true);
    }
    const correct = options[index] === fact.answer;
    chosen = index;
    phase = 'swing';
    hud.lock();
    hud.buttons[index].classList.add('chosen');
    batter.swing();
    sfx.whoosh();
    if (correct) {
      feed.recordHit(fact);
      session.recordAnswer(fact, true);
      const hit = hitFor(used);
      startDash([{ to: CONTACT, dur: ZIP_TIME, onEnd: () => contact(hit) }]);
    } else {
      feed.recordMiss(fact);
      session.recordAnswer(fact, false);
      startDash([
        { to: MISS_POINT, dur: ZIP_TIME },
        { to: GLOVE, dur: GLOVE_TIME, onEnd: () => strike(false) },
      ]);
    }
  };

  /** The ball reaches the plate with nobody having answered: a called strike. */
  const timeUp = () => {
    if (!fact) return;
    phase = 'swing';
    chosen = -1;
    hud.lock();
    hud.setClock(0);
    feed.recordMiss(fact);
    session.recordAnswer(fact, false);
    startDash([{ to: GLOVE, dur: GLOVE_TIME, onEnd: () => strike(true) }], CONTACT);
  };

  // ---------- Strikes ----------
  /** The ball is in the catcher's mitt and the umpire makes the call. */
  const strike = (called: boolean) => {
    if (!fact) return;
    const current = fact;
    ball.setVisible(true);
    putBall(GLOVE);
    sfx.glove();
    catcher.pop();
    effects.pop(GLOVE);
    const call = strikeCall(state.strikes + 1, called);
    const outcome = applyStrike(state);
    state = outcome.state;
    saveProgress();
    struckOut = call.out;
    shown.strikes = call.out ? 3 : state.strikes;
    shown.outs = state.outs;
    umpire.callStrike(call.out);
    if (call.out) batter.slump();
    refresh();
    phase = 'result';
    resultAt = gameTime;
    hud.mark(chosen, options.indexOf(current.answer), false);
    hud.showBanner(call.title, current.statement, 'miss', 'aside');
    sfx.miss();
    // Move on once the umpire has called it, the fact has been read out and shown for a while.
    const thisTurn = turn;
    let spoken = false;
    let shownLongEnough = false;
    const next = () => {
      if (spoken && shownLongEnough && !replaying && turn === thisTurn && phase === 'result') {
        advance();
      }
    };
    resultDone = next;
    speak(call.spoken, () => {
      if (turn !== thisTurn || phase !== 'result') return;
      speak(current.spokenStatement ?? current.statement, () => {
        spoken = true;
        next();
      });
    });
    after(REVEAL_FOR, () => {
      shownLongEnough = true;
      next();
    });
  };

  /** After a result: the same batter again, or the next one if that was an out. */
  const advance = () => {
    stopSpeaking();
    pending = [];
    hud.hideBanner();
    ball.setVisible(false);
    umpire.reset();
    if (struckOut) {
      struckOut = false;
      // Struck out: the batter trudges off.
      sendOff();
      afterPlay(true, 0);
      return;
    }
    nextPitch();
  };

  /** The batter at the plate trudges off to the dugout. */
  const sendOff = () => {
    leaving.push(batter);
    const gone = batter;
    gone.mover.runTo([{ x: -6, y: 0, z: 4.5 }], 3.2);
    later(1.8, () => retire(gone.person.root));
  };

  /** A new batter for the side at bat: ours in their own colours, the rival's in theirs. */
  const newBatter = () => {
    batter = createBatter();
    if (isBatting(state)) {
      batter.setLook(batterNumber(state) - 1);
    } else {
      const colours = coloursOf(rival);
      batter.person.recolour(colours.shirt, colours.cap);
    }
    spawn(batter.person.root);
  };

  /** The next batter walks to the plate. */
  const stepUp = () => {
    newBatter();
    shown.strikes = state.strikes;
    shown.outs = state.outs;
    refresh();
  };

  /**
   * A play is over. The game may be won, the half-inning may be done, or else the next pitch
   * comes up (with the next batter first, if this one is done) after `delay` seconds.
   */
  const afterPlay = (batterGone: boolean, delay: number) => {
    if (state.over) {
      finishGame();
      return;
    }
    const reason = halfOver(state);
    if (reason) {
      endHalf(reason);
      return;
    }
    if (batterGone) stepUp();
    if (isBatting(state)) {
      if (delay > 0) after(delay, nextPitch);
      else nextPitch();
    } else {
      after(delay, beginPitching);
    }
  };

  // ---------- Hits ----------
  const playRunner = createPlayRunner({
    actor: (p) => actors[p],
    runner: (from) => playFigures[from],
    ball: (p, kind, delta) => {
      ball.setVisible(true);
      if (kind === 'held') {
        putBall(p);
        ball.setGlow(false);
        return;
      }
      putBall(p, true);
      ball.spin(delta, kind === 'throw' ? 30 : 18);
      ball.setGlow(kind === 'batted');
      // The trail grows with the ball, so it can be followed all the way.
      if (kind === 'throw' || (kind === 'batted' && plan && playRunner.time < plan.airTime)) {
        effects.trail(ballPos, Math.max(0.5, BALL_RADIUS * 2 * ballScaleNow));
      }
    },
    hideBall: () => {
      ball.setVisible(false);
      ball.setGlow(false);
    },
    scored: (from) => {
      const fig = playFigures[from];
      if (!fig) return;
      playFigures[from] = null;
      retire(fig.person.root);
    },
  });

  /** The bat meets the ball. */
  const contact = (answered: Hit) => {
    sfx.bat();
    measureHit();
    effects.crack(CONTACT);
    // The answer's speed picks the hit; a random kind of that hit is the play.
    const forced = forcedPlay().hit;
    const kind = forced ?? pickHitKind(answered, Math.random());
    const hit = hitOfKind(kind);
    const ballPlan = planBatted(kind, { side: Math.random(), a: Math.random(), b: Math.random() });
    const before = state;
    const outcome = applyHit(state, hit, { kind, zone: ballPlan.zone });
    state = outcome.state;
    saveProgress();
    refresh();
    hud.markHit(chosen);
    // The question gives way to the view of the field.
    after(0.25, () => hud.hideQuestion(true));

    // The play: where everybody is, and what the rules decided.
    plan = ballPlan;
    const spots = {} as Record<Position, Vec>;
    for (const p of POSITIONS) {
      const at = actors[p].mover.person.root.position;
      spots[p] = { x: at.x, y: 0, z: at.z };
    }
    const leads: (Vec | null)[] = [
      null,
      ...onBase.map((fig) => (fig ? { ...fig.person.root.position } : null)),
    ];
    script = planPlay({
      ball: ballPlan,
      moves: outcome.moves,
      retired: [],
      bases: before.bases,
      outs: before.outs,
      call: kind,
      spots,
      leads,
      runs: outcome.runs,
    });
    playFigures = [batter, ...onBase];
    const next: (Batter | null)[] = [null, null, null];
    for (const move of outcome.moves) {
      const fig = playFigures[move.from];
      if (fig && move.to < 4) next[move.to - 1] = fig;
    }
    onBase = next;
    running = [];
    fireworksFrom = hit === 'homer' ? plan.airTime * 0.78 : Infinity;
    phase = 'hit';
    camMode = 'follow';
    dash = null;
    ball.setVisible(true);
    playRunner.start(script, onPlayEvent, endPlay);
    const detail = [hitSubtitle(kind, plan.zone, script.fielder), runsText(outcome.runs)]
      .filter(Boolean)
      .join(' · ');
    hud.showBanner(hitLabel(hit), detail, 'hit', 'top');
    // The callout has been seen and heard; it comes down so it never hides the ball.
    after(BANNER_FOR, () => hud.hideBanner());
    speak(hitKindSpeech(kind));
    after(0.35, hit === 'homer' ? sfx.bigCheer : sfx.cheer);
    const dropped = batter.dropBat();
    if (dropped) {
      props.push(dropped);
      spawn(dropped.object);
    }
    resultAt = gameTime;
  };

  /** Things that happen in a play as it runs: a catch, a run scoring, a slide. */
  const onPlayEvent = (e: PlayEvent) => {
    const us = isBatting(state);
    switch (e.type) {
      case 'catch':
        sfx.glove();
        // The ball is in a glove: from here the camera frames the play, not the flight.
        if (camMode === 'follow' && plan && !plan.overWall) camMode = 'frame';
        break;
      case 'run': {
        shown.runs++;
        refresh();
        hud.flashRuns(us ? 'us' : 'them');
        if (us) sfx.chime();
        const at = toScreen(BASE_SPOTS[0]);
        hud.pop('+1', at.x, at.y - 30, us ? 'good' : 'bad');
        break;
      }
      case 'safe':
        effects.dust({ ...BASE_SPOTS[e.base % 4], y: 0.1 }, 8);
        if (e.base === 4) umpire.callSafe();
        break;
      case 'out':
        shown.outs++;
        refresh();
        break;
      case 'wall':
      case 'land':
      case 'dust':
        effects.dust({ x: e.p.x, y: 0.1, z: e.p.z }, 7);
        break;
    }
  };

  /** The batter and every runner advance together, running the bases. */
  const runBases = (moves: Move[], runs: number, speed: number, retired: number[] = []): number => {
    const next: (Batter | null)[] = [null, null, null];
    running = [];
    // Runners put out leave the bases; those who do not move stay where they are.
    retired.filter((base) => base > 0).forEach(retireRunner);
    onBase.forEach((fig, i) => {
      if (fig && !moves.some((m) => m.from === i + 1)) next[i] = fig;
    });
    const old = batter;
    const us = isBatting(state);
    // Runs past the mercy rule or the winning run are run, but do not count.
    let credited = 0;
    for (const move of moves) {
      const runner = move.from === 0 ? old : onBase[move.from - 1];
      if (!runner) continue;
      const scored = move.to >= 4;
      if (!scored) next[move.to - 1] = runner;
      const route: Vec[] = [];
      for (let k = move.from + 1; k <= move.to; k++) route.push(BASE_SPOTS[k % 4]);
      const final = route[route.length - 1];
      const entry: Running = {
        batter: runner,
        final,
        done: false,
        arrive: () => {
          if (entry.done) return;
          entry.done = true;
          if (scored) {
            if (credited < runs) {
              credited++;
              shown.runs++;
              refresh();
              hud.flashRuns(us ? 'us' : 'them');
              if (us) sfx.chime();
              const at = toScreen(BASE_SPOTS[0]);
              hud.pop('+1', at.x, at.y - 30, us ? 'good' : 'bad');
            }
            runner.cheer();
            later(0.7, () => retire(runner.person.root));
          } else {
            runner.runnerStance();
            runner.mover.face(BASE_SPOTS[(move.to + 1) % 4]);
          }
        },
      };
      running.push(entry);
      later(0.2, () => {
        runner.runnerStance();
        runner.mover.runTo(route, speed, entry.arrive);
      });
    }
    onBase = next;
    // A new batter steps up once the play is over.
    const longest = moves.reduce((m, mv) => Math.max(m, (mv.to - mv.from) * BASE_SIDE), 0);
    runTime = 0.2 + longest / speed;
    return runTime;
  };

  /** A runner who is out trudges off from the base he was on. */
  const retireRunner = (base: number) => {
    const gone = onBase[base - 1];
    if (!gone) return;
    onBase[base - 1] = null;
    leaving.push(gone);
    const towards = BASE_SPOTS[base % 4];
    gone.runnerStance();
    gone.mover.runTo([towards], 10, () => {
      gone.slump();
      gone.mover.runTo([{ x: -6, y: 0, z: 4.5 }], 3.2);
    });
    later(2.6, () => retire(gone.person.root));
  };

  /** Anybody still running gets where they were going, and the scorebug catches up. */
  const settleRunners = () => {
    for (const r of running) {
      if (r.done) continue;
      r.batter.mover.halt();
      r.batter.mover.place(r.final.x, r.final.z);
      r.arrive();
    }
    running = [];
    shown.runs = state.runs;
    refresh();
  };

  /** The play is over: back to the batting view and the next batter. */
  const endPlay = () => {
    if (phase !== 'hit') return;
    playRunner.settle();
    playFigures = [null, null, null, null];
    shown.runs = state.runs;
    refresh();
    plan = null;
    script = null;
    camMode = 'home';
    ball.setVisible(false);
    ball.setGlow(false);
    stopSpeaking();
    hud.hideBanner();
    effects.onBurst = null;
    goHomeAll(7);
    pending = [];
    afterPlay(true, 0.7);
  };

  /** Everybody in the field jogs back to where they stand. */
  const goHomeAll = (speed: number) => {
    for (const p of POSITIONS) actors[p].goHome(speed);
  };

  const updateHit = (delta: number) => {
    if (!plan) return;
    playRunner.update(delta);
    if (!plan) return;
    const hitT = playRunner.time;
    // Fireworks over the scoreboard once the ball clears the wall.
    if (hitT >= fireworksFrom) {
      fireworksFrom = Infinity;
      effects.onBurst = () => sfx.firework();
      // The callout has done its job; clear the sky for the show.
      after(0.2, () => hud.hideBanner());
      const centre = field.fireworksCentre;
      for (let i = 0; i < 7; i++) {
        const x = centre.x + (i - 3) * 5 + (Math.random() - 0.5) * 3;
        const y = centre.y + (Math.random() - 0.5) * 10;
        effects.firework({ x, y, z: centre.z }, fireworkColour(i), 0.1 + i * 0.24);
      }
    }
    if (camMode === 'follow' && plan.overWall && hitT > plan.airTime + 1.4) camMode = 'home';
  };

  // ---------- Pitching ----------
  const pitching = createPitching({
    hud,
    pitcher,
    catcher,
    umpire,
    ball,
    effects,
    fielders,
    shown,
    rival: () => rival,
    batter: () => batter,
    state: () => state,
    commit: (next) => {
      state = next;
      saveProgress();
    },
    ask,
    answered: (answered, correct) => {
      if (correct) feed.recordHit(answered);
      else feed.recordMiss(answered);
      session.recordAnswer(answered, correct);
    },
    runBases,
    settleRunners,
    sendOff,
    addProp: (prop) => {
      props.push(prop);
      spawn(prop.object);
    },
    putBall: (p) => putBall(p),
    toScreen,
    refresh,
    now: () => gameTime,
    after,
    clearTimers: () => {
      pending = [];
    },
    playOver: (batterGone) => afterPlay(batterGone, 0.4),
  });

  /** The rival's turn at bat: our pitch. */
  const beginPitching = () => {
    phase = 'pitching';
    pitching.begin();
  };

  // ---------- The game's flow ----------
  /**
   * Puts a banner up and says some lines, then calls `then`: once the lines are said and the
   * banner has been up for `hold` seconds, or when a tap skips it.
   */
  const announce = (
    title: string,
    detail: string,
    kind: 'info' | 'good' | 'miss',
    lines: string[],
    then: () => void,
    hold = ANNOUNCE_FOR,
  ) => {
    phase = 'announce';
    const token = ++announceToken;
    const startedAt = gameTime;
    stopSpeaking();
    hud.hideQuestion(true);
    hud.showBanner(title, detail, kind);
    let spoken = false;
    let shownLongEnough = false;
    let done = false;
    const go = () => {
      if (done || token !== announceToken) return;
      done = true;
      skipAnnounce = null;
      stopSpeaking();
      hud.hideBanner();
      then();
    };
    const next = () => {
      if (spoken && shownLongEnough) go();
    };
    const say = (i: number) => {
      if (done || token !== announceToken) return;
      if (i >= lines.length) {
        spoken = true;
        next();
        return;
      }
      speak(lines[i], () => say(i + 1));
    };
    say(0);
    after(hold, () => {
      shownLongEnough = true;
      next();
    });
    skipAnnounce = () => {
      if (gameTime - startedAt >= SKIP_AFTER) go();
    };
  };

  /** The half-inning is over: the banner and the score, then the other side comes in. */
  const endHalf = (reason: 'outs' | 'mercy') => {
    pending = [];
    turn++;
    shown.runs = state.runs;
    shown.outs = state.outs;
    refresh();
    const { us, them } = totals(state);
    announce(
      halfEndTitle(reason),
      scoreLine(rival, us, them),
      'info',
      [halfEndSpeech(reason), leadSpeech(us - them)],
      changeSides,
      REVEAL_FOR,
    );
  };

  /** Everybody leaves the field, the teams swap jobs, and the camera moves to the other end. */
  const setSide = () => {
    shown.runs = 0;
    shown.strikes = 0;
    shown.outs = 0;
    pending = [];
    [...spawned].forEach(retire);
    props = [];
    onBase = [null, null, null];
    running = [];
    leaving = [];
    dash = null;
    plan = null;
    script = null;
    playFigures = [null, null, null, null];
    effects.clear();
    effects.onBurst = null;
    ball.setVisible(false);
    ball.setGlow(false);
    // Whoever is in the field wears the colours of the side that is not at bat.
    const batting = isBatting(state);
    const wear = batting ? coloursOf(rival) : OUR_COLOURS;
    for (const p of POSITIONS) {
      const a = actors[p];
      a.setColours(wear);
      a.mover.halt();
      a.actions.stop();
      a.mover.place(a.home.x, a.home.z);
      a.mover.face(p === 'C' ? { x: 0, y: 0, z: -10 } : { x: 0, y: 0, z: 0 });
    }
    newBatter();
    pitcher.reset();
    umpire.reset();
    camMode = batting ? 'home' : 'mound';
    hud.hideQuestion(true);
    hud.hideBanner();
    refresh();
  };

  /** The next half-inning, or the end of the game. */
  const changeSides = () => {
    state = nextHalf(state);
    if (state.over) {
      finishGame();
      return;
    }
    startHalf();
  };

  /** "Top of the 3rd. You're up to bat!", and then the first pitch of the half. */
  const startHalf = () => {
    setSide();
    devRunners();
    const { inning, half } = state;
    const batting = half === 'top';
    const banner = inningBanner(inning, half);
    const extra = batting && inning === INNINGS + 1;
    announce(
      extra ? EXTRA_INNINGS : banner.title,
      extra ? `${banner.title}. ${banner.detail}` : banner.detail,
      'info',
      [...(extra ? [EXTRA_INNINGS] : []), inningSpeech(inning, half)],
      () => (batting ? nextPitch() : beginPitching()),
    );
  };

  /** The game is won or lost: the banner, then the results. */
  const finishGame = () => {
    pending = [];
    turn++;
    const { us, them } = totals(state);
    shown.runs = state.runs;
    refresh();
    const won = state.winner === 'us';
    const title = won ? 'You win!' : state.walkOff ? 'Walk-off!' : `${rival.nickname} win!`;
    const line = won ? YOU_WIN : state.walkOff ? walkOffSpeech(rival) : loseSpeech(rival);
    announce(
      title,
      scoreLine(rival, us, them),
      won ? 'good' : 'miss',
      [line],
      finishRun,
      REVEAL_FOR,
    );
  };

  const finishRun = () => {
    phase = 'done';
    hud.hideBanner();
    hud.hideQuestion(true);
    camMode = 'home';
    const { us, them } = totals(state);
    const stars = starsFor(feed.correct, feed.answered);
    session.recordStars(stars);
    session.recordScore(us);
    const newHighScore = us > bestAtStart;
    refresh();
    if (newHighScore) sfx.cheer();
    speak(finalSpeech(us));
    showResults({
      topicId: session.topic.id,
      correct: feed.correct,
      total: feed.answered,
      stars,
      newBest: false,
      missed: feed.missed(),
      playerName: session.player?.name,
      score: us,
      outcome: outcomeText(rival, us, them),
      highScore: session.highScore(),
      newHighScore,
      playAgainLabel: 'Play ball ⚾',
      onPlayAgain: () => startRun(false),
    });
  };

  // ---------- Run flow ----------
  const startRun = (withPreview: boolean) => {
    pending = [];
    scenery = [];
    turn++;
    announceToken++;
    skipAnnounce = null;
    speechToken++;
    struckOut = false;
    replaying = 0;
    stopSpeaking();
    pitching.reset();
    feed = createFactFeed(() => session.chooseFacts());
    state = newGame();
    rival = pickRival(Math.random());
    usAbbr = ourAbbr(session.player?.name, rival);
    bestAtStart = session.highScore();
    fact = undefined;
    options = [];
    devSetup();
    setSide();
    if (!withPreview) {
      startIntro();
      return;
    }
    phase = 'preview';
    showPreview({ topic: session.topic, facts: feed.peek(10), onDone: startIntro });
  };

  /** Dev only: begins the game in the half, with the outs and runners the address asks for. */
  let devRunnersPending = false;
  const devSetup = () => {
    const start = devStart();
    if (!start.half && !start.bases && !start.outs) return;
    if (start.half === 'bottom') state = { ...state, half: 'bottom', them: [0] };
    state = { ...state, bases: start.bases ?? state.bases, outs: start.outs ?? state.outs };
    devRunnersPending = true;
  };

  /** Dev only: puts the runners the address asked for on their bases, once the field is set. */
  const devRunners = () => {
    if (!devRunnersPending) return;
    devRunnersPending = false;
    shown.outs = state.outs;
    state.bases.forEach((on, i) => {
      if (!on) return;
      const runner = createBatter();
      if (isBatting(state)) runner.setLook(i + 3);
      else {
        const colours = coloursOf(rival);
        runner.person.recolour(colours.shirt, colours.cap);
      }
      runner.mover.place(BASE_SPOTS[i + 1].x, BASE_SPOTS[i + 1].z);
      runner.runnerStance();
      spawn(runner.person.root);
      onBase[i] = runner;
    });
    refresh();
  };

  /** "Today you play the Toledo Mud Hens! Play ball!" and then the first inning. */
  const startIntro = () => {
    sfx.cheer();
    announce(
      PLAY_BALL,
      `vs ${teamName(rival)}`,
      'info',
      [matchupSpeech(rival), PLAY_BALL],
      startHalf,
      1.6,
    );
  };

  // ---------- Input ----------
  /** A tap while a result is showing skips ahead, so it never feels ignored. */
  const skip = () => {
    if (phase === 'result' && gameTime - resultAt >= SKIP_AFTER) advance();
    else if (phase === 'hit' && playRunner.time >= HIT_SKIP_AFTER) endPlay();
    else if (phase === 'pitching') pitching.skip();
    else if (phase === 'announce') skipAnnounce?.();
  };
  const onAnswer = (index: number) => {
    if (phase === 'pitching') pitching.press(index);
    else if (phase === 'windup' || phase === 'release' || phase === 'pitch') select(index);
    else skip();
  };
  const unpress = hud.buttons.map((button, i) => {
    // A touch press doesn't count as a user gesture for iOS audio; the release does.
    button.addEventListener('pointerup', unlockAudio);
    return onPress(button, () => onAnswer(i));
  });
  hud.hear.addEventListener('click', () => {
    unlockAudio();
    if (phase === 'pitching') {
      pitching.hear();
    } else if (fact && hud.callInPanel()) {
      // The call has taken the question's place: the button says the fact again.
      const current = fact;
      const thisTurn = turn;
      replaying++;
      speechToken++;
      speak(current.spokenStatement ?? current.statement, () => {
        replaying--;
        if (turn === thisTurn) resultDone?.();
      });
    } else if (fact) {
      const token = ++speechToken;
      const thisTurn = turn;
      speak(fact.spokenPrompt ?? fact.prompt, () => {
        if (token !== speechToken || turn !== thisTurn || phase !== 'windup') return;
        speechDone = true;
      });
    }
  });
  const stopPointer = createPointerInput(ctx.renderer.domElement, {
    onDragStart: () => unlockAudio(),
    onTap: skip,
  });
  // Keys 1-4 pick the answers from left to right.
  const onKey = (e: KeyboardEvent) => {
    if (pause.isPaused) return;
    const index = Number(e.key) - 1;
    if (index >= 0 && index < hud.buttons.length) onAnswer(index);
  };
  window.addEventListener('keydown', onKey);

  // ---------- Loop ----------
  /**
   * Runs the timers that are due. They come off the list first: a timer may well clear the list
   * or add new ones (a banner ending starts the next), and those must be kept.
   */
  const runDue = (list: { at: number; fn: () => void }[], keep: (rest: typeof list) => void) => {
    const due = list.filter((p) => p.at <= gameTime);
    if (!due.length) return;
    keep(list.filter((p) => p.at > gameTime));
    due.forEach((p) => p.fn());
  };

  ctx.onUpdate((delta, time) => {
    layout();
    gameTime += delta;
    runDue(pending, (rest) => (pending = rest));
    runDue(scenery, (rest) => (scenery = rest));

    // --- The people ---
    pitcher.update(delta, time);
    catcher.update(delta, time);
    umpire.update(delta, time);
    const figures = new Set<Batter>([batter, ...running.map((r) => r.batter), ...leaving]);
    playFigures.forEach((fig) => fig && figures.add(fig));
    onBase.forEach((fig) => fig && figures.add(fig));
    figures.forEach((fig) => fig.mover.update(delta, time));
    fielders.forEach((f) => f.mover.update(delta, time));
    props = props.filter((p) => {
      const alive = p.update(delta);
      if (!alive) retire(p.object);
      return alive;
    });

    // --- The pitch, the swing and the hit ---
    updatePitch(delta);
    updateDash(delta);
    pitching.update(delta);
    if (phase === 'hit') updateHit(delta);
    if (phase === 'result' || phase === 'swing') {
      // The ball stays in the mitt.
      if (!dash && phase === 'result') ball.place(GLOVE);
    }
    effects.update(delta);

    // --- The camera: behind the plate, or following the ball ---
    let goalFov = fit.fov;
    let goalShift = fit.shift;
    if ((camMode === 'follow' || camMode === 'frame') && plan) {
      // Once the fireworks are up, the shot is of the scoreboard and the bursts.
      const closing =
        fireworksFrom === Infinity && plan.overWall && playRunner.time >= plan.airTime * 0.78;
      followGoal(closing ? fireworksAim() : ballPos, goalPos, goalLook, home);
      if (closing) {
        goalFov = hitFrame.fireworks.fov;
        goalShift = hitFrame.fireworks.shift;
      } else if (camMode === 'frame' && script) {
        // The ball is in play on the field: frame it and where it is going.
        goalShift = hitFrame.shift;
        const now = playRunner.time;
        const marks = script.frames.filter((f) => f.from <= now).at(-1)?.points ?? [];
        const shot = frameAction(
          [ballPos, ...marks],
          goalPos,
          fit.fov,
          viewW,
          viewH,
          hitFrame.band,
        );
        Object.assign(goalLook, shot.look);
        goalFov = shot.fov;
      } else {
        goalShift = hitFrame.shift;
        keepBoardClear(
          ballPos,
          goalPos,
          goalLook,
          fit.fov,
          viewW,
          viewH,
          hitFrame.band,
          hitFrame.blocked,
        );
      }
    } else {
      const view = camMode === 'mound' ? mound : home;
      Object.assign(goalPos, view.cam);
      Object.assign(goalLook, view.look);
      if (camMode === 'mound') {
        goalFov = moundFit.fov;
        goalShift = moundFit.shift;
      }
      // Crossing the field between the two ends, the camera rises so it flies over the players.
      goalPos.y += Math.min(Math.abs(cam.z - goalPos.z) / 6, 1) * 4;
    }
    const follow = camMode === 'follow' || camMode === 'frame';
    cam.x = easeToward(cam.x, goalPos.x, follow ? 1.8 : 2.2, delta);
    cam.y = easeToward(cam.y, goalPos.y, follow ? 1.8 : 2.2, delta);
    cam.z = easeToward(cam.z, goalPos.z, follow ? 1.8 : 2.2, delta);
    look.x = easeToward(look.x, goalLook.x, follow ? 3.5 : 3, delta);
    look.y = easeToward(look.y, goalLook.y, follow ? 3.5 : 3, delta);
    look.z = easeToward(look.z, goalLook.z, follow ? 3.5 : 3, delta);
    // The picture slides and zooms along with the camera, and only while it still has to.
    const settle = (now: number, goal: number, near: number) =>
      Math.abs(goal - now) < near ? goal : easeToward(now, goal, 2.5, delta);
    const nextShift = settle(viewShift, goalShift, 0.05);
    const nextFov = settle(viewFov, goalFov, 0.02);
    if (nextShift !== viewShift || nextFov !== viewFov) {
      viewShift = nextShift;
      viewFov = nextFov;
      applyView();
    }
    camera.position.set(cam.x + Math.sin(time * 0.5) * 0.03, cam.y, cam.z);
    camera.lookAt(look);
    camera.updateMatrixWorld();
  });

  layout();
  refresh();
  ctx.start();
  startRun(true);

  window.addEventListener('pagehide', () => {
    stopSpeaking();
    window.removeEventListener('keydown', onKey);
    stopPointer();
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
