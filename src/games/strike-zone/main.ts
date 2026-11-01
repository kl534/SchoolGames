import './style.css';
import { MathUtils, Vector3 } from 'three';
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
import { answerOptions, missSpeech, promptSpeech, type Fact } from '../../shared/topics';
import { createBackButton, createMuteButton, createPauseOverlay, menuUrl } from '../../shared/ui';
import { hideFactMap, showFactMap } from '../../shared/maps';
import {
  arrowTipX,
  DEFAULT_AIM,
  driftFor,
  driftSide,
  gutterSide,
  moveBowler,
  MOVE_PX_PER_BOARD,
  SWING_PX_PER_BOARD,
  swingArrow,
  thrownAim,
  throwPath,
  type Aim,
} from './aim';
import { buildAlley } from './alley';
import { createBall } from './ball';
import {
  createBowler,
  gutterBallAt,
  GUTTER_SPEED,
  SLIP_BALL_LANDS,
  SLIP_SECONDS,
  THROW_SECONDS,
  type BowlerMove,
} from './bowler';
import { devDrift, devFriends, devStart } from './dev';
import { createFriends, type FriendMove } from './friends';
import {
  ARROW_Z,
  BALL_R,
  BOARD_W,
  BOWLER_Z,
  DECK_BACK_Z,
  HEAD_Z,
  PIN_IDS,
  type PinId,
  type Vec,
} from './geometry';
import { createHud, type Bands, type ScreenKind } from './hud';
import { createPhysics, FAST_STEPS, FIXED_STEP } from './physics';
import { createPins } from './pins';
import {
  bigTitle,
  callFor,
  callSpeech,
  GAME_OVER_SPEECH,
  LAST_FRAME_SPEECH,
  NEW_HIGH_SCORE_SPEECH,
  outcomeText,
  pillText,
  position,
  totalScore,
  type Call,
} from './rules';
import {
  AIM_CAM,
  aimKeys,
  fitView,
  followView,
  FRIENDS_CAM,
  friendsKeys,
  PINS_CAM,
  pinsKeys,
  type CamView,
  type PlayBand,
} from './views';

const GAME_ID = 'strike-zone';

/** Seconds the pins are shown before the next ball (and after a strike or a spare, the reaction). */
const PIN_HOLD = 1.2;
/** Seconds the friends are on screen. */
const REACTION_FOR = 1.3;
/** After a gutter ball the friends come in this long after the drop. */
const GUTTER_HOLD = 0.9;
/** Seconds after a result is ready before a tap skips ahead (not after a gutter ball). */
const SKIP_RESULT_AFTER = 0.6;
/** Seconds the pins are put back and the camera comes back to the lane. */
const RESET_FOR = 0.6;
/** Seconds the big scorecard stays up before the results. */
const FINAL_FOR = 3.0;
/** The alley screen and the small pill stay up this long. */
const SCREEN_FOR = 1.8;
const PILL_FOR = 1.6;
/** The question and answers go 0.5 s after the answer. */
const HIDE_QUESTION_AFTER = 0.5;
/** A tap fast-forwards the roll once it has been rolling this long. */
const FAST_AFTER = 0.3;
/** Within this far of a standing pin, the crash sound plays. */
const CRASH_RANGE = 0.25;
/** The camera leaves the follow view for the pins when the ball is this near the head pin. */
const PINS_SWITCH_Z = HEAD_Z + 6;

type Phase =
  'preview' | 'aim' | 'ask' | 'throw' | 'roll' | 'gutter' | 'result' | 'reset' | 'over' | 'done';

type ViewKind = 'aim' | 'ask' | 'follow' | 'pins' | 'friends';

const lerpVec = (a: Vec, b: Vec, t: number): Vec => ({
  x: MathUtils.lerp(a.x, b.x, t),
  y: MathUtils.lerp(a.y, b.y, t),
  z: MathUtils.lerp(a.z, b.z, t),
});

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

function screenKind(call: Call): ScreenKind {
  if (call.kind === 'spare') return 'spare';
  if (call.kind === 'split') return 'split';
  if (call.kind === 'strike') {
    if (call.streak <= 1) return 'strike';
    if (call.streak === 2) return 'double';
    return call.streak >= 12 ? 'perfect' : 'turkey';
  }
  return 'strike';
}

function run(session: GameSession): void {
  const container = document.getElementById('game');
  if (!container) throw new Error('Missing #game container');

  // ---------- Scene ----------
  const ctx = createScene(container, { fov: 40, near: 0.1, far: 120 });
  const { scene, camera } = ctx;
  const alley = buildAlley(scene);
  const physics = createPhysics();
  const pins = createPins();
  scene.add(pins.object);
  const ball = createBall();
  scene.add(ball.object);
  const bowler = createBowler();
  scene.add(bowler.root);
  const friends = createFriends();
  scene.add(friends.object);

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
  let rolls: number[] = [];
  let aim: Aim = DEFAULT_AIM;
  let bestAtStart = session.highScore();
  /** The pins standing for the next ball. */
  let standing: PinId[] = [...PIN_IDS];
  let splitBefore = false;
  let fact: Fact | undefined;
  let options: string[] = [];
  let chosen = -1;
  /** Ticks up for each ball, so late callbacks can tell they are stale. */
  let turn = 0;
  let speechToken = 0;
  let speechDone = false;
  /** Seconds since the question finished being read. */
  let answerTime = 0;
  let clockTotal = 10;
  let lastTick = 0;
  /** The line the ball is thrown along (the aim, moved by the drift). */
  let thrown: Aim = DEFAULT_AIM;
  let isGutter = false;
  let tenthShown = false;
  const hints = { move: true, swing: true };
  let aimDirty = true;

  // The bowler.
  let bowlerMove: BowlerMove = 'hold';
  let bowlerSince = 0;
  let slipSide: -1 | 1 = 1;
  const handBall = new Vector3();

  // The roll.
  let rollT = 0;
  let fast = false;
  let crashed = false;
  let switchedToPins = false;
  let ballPos: Vec = { x: 0, y: BALL_R, z: BOWLER_Z };
  let lastGutterPos: Vec | null = null;
  let gutterScript: { since: number; from: Vec; side: -1 | 1 } | null = null;

  // The result.
  let resultAt = 0;
  let speechOver = false;
  let holdOver = false;
  let standingAfter: PinId[] = [];
  let lastCall: Call = { kind: 'count', pins: 0 };
  let overAt = 0;

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
  const viewCache = new Map<string, CamView>();
  let goal: ViewKind = 'aim';
  const cur: CamView = { pos: { ...AIM_CAM }, look: { x: 0, y: 0, z: -10 }, fov: 20, shift: 0 };
  let from: CamView = { ...cur };
  let moveT = 1;
  let moveDur = 0.5;
  const point = new Vector3();
  const lookAtPoint = new Vector3();

  const bandFor = (kind: ViewKind): PlayBand =>
    kind === 'aim' ? bands.aim : kind === 'ask' ? bands.ask : bands.play;

  const viewFor = (kind: ViewKind): CamView => {
    if (kind === 'follow') return followView(ballPos, bands.play, viewH);
    const hit = viewCache.get(kind);
    if (hit) return hit;
    const cam = kind === 'pins' ? PINS_CAM : kind === 'friends' ? FRIENDS_CAM : AIM_CAM;
    const keys = kind === 'pins' ? pinsKeys() : kind === 'friends' ? friendsKeys() : aimKeys();
    const fit = fitView(cam, keys, viewW, viewH, bandFor(kind));
    const view = { pos: cam, look: fit.look, fov: fit.fov, shift: fit.shift };
    viewCache.set(kind, view);
    return view;
  };

  /** Eases the camera to a view (or snaps there with 0 seconds). */
  const goTo = (kind: ViewKind, seconds: number) => {
    goal = kind;
    if (!viewW) return;
    from = { pos: { ...cur.pos }, look: { ...cur.look }, fov: cur.fov, shift: cur.shift };
    moveT = seconds <= 0 ? 1 : 0;
    moveDur = seconds;
  };

  const layout = (force = false) => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!force && w === viewW && h === viewH) return;
    viewW = w;
    viewH = h;
    bands = hud.measureBands();
    camera.aspect = w / Math.max(h, 1);
    viewCache.clear();
    // Fit every view now, so none of them costs a hitch in the middle of a ball.
    for (const kind of ['ask', 'pins', 'friends', 'aim'] as const) viewFor(kind);
    const target = viewFor(goal);
    from = target;
    moveT = 1;
  };

  const applyCamera = () => {
    const target = viewFor(goal);
    const e = moveT >= 1 ? 1 : ease(moveT);
    const a = moveT >= 1 ? target : from;
    cur.pos = lerpVec(a.pos, target.pos, e);
    cur.look = lerpVec(a.look, target.look, e);
    cur.fov = MathUtils.lerp(a.fov, target.fov, e);
    cur.shift = MathUtils.lerp(a.shift, target.shift, e);
    camera.fov = cur.fov;
    camera.setViewOffset(viewW, viewH, 0, cur.shift, viewW, viewH);
    camera.updateProjectionMatrix();
    camera.position.set(cur.pos.x, cur.pos.y, cur.pos.z);
    lookAtPoint.set(cur.look.x, cur.look.y, cur.look.z);
    camera.lookAt(lookAtPoint);
    camera.updateMatrixWorld();
  };

  /** Where a point in the world is on the screen, in CSS px. */
  const toScreen = (p: Vec) => {
    point.set(p.x, p.y, p.z).project(camera);
    return { x: ((point.x + 1) / 2) * viewW, y: ((1 - point.y) / 2) * viewH };
  };

  // ---------- Showing the game ----------
  const renderCard = () => hud.renderCard({ rolls, best: Math.max(session.highScore(), 0) });
  const renderPins = (withAim: boolean) => {
    const where = position(rolls);
    hud.renderPins({
      standing,
      aim: withAim ? aim : null,
      frame: where.frame,
      ball: where.ball,
    });
  };
  const setAimMarks = () => {
    alley.aim.setAim(aim);
    aimDirty = false;
  };

  const setBowler = (move: BowlerMove) => {
    bowlerMove = move;
    bowlerSince = gameTime;
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

  /** Tap Bowl!: the question is read and the clock starts once the reading ends. */
  const ask = () => {
    if (phase !== 'aim') return;
    unlockAudio();
    timers.clear();
    tapFlow.disarm();
    stopSpeaking();
    hud.hideBanner();
    hud.hidePill();
    hud.showControls(false);
    hud.showSide(false);
    hints.move = false;
    hints.swing = false;
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
    showFactMap(fact);
    hud.setClock(1, false);
    hud.showQuestion(true);
    // A long question may be taller: the view fits the band that is left.
    const before = bands.ask;
    bands = hud.measureBands();
    if (
      Math.abs(before.top - bands.ask.top) > 1 ||
      Math.abs(before.bottom - bands.ask.bottom) > 1
    ) {
      viewCache.delete('ask');
    }
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
      // Audio trouble must never stop the throw.
    }
    speechToken++;
    // A tap before the question has been read out counts as no time used at all.
    const used = speechDone ? answerTime : 0;
    const right = options[index] === fact.answer;
    chosen = index;
    hud.lock();
    answered(right, used);
  };

  const timeUp = () => {
    if (phase !== 'ask' || !fact) return;
    chosen = -1;
    hud.lock();
    answered(false, clockTotal);
  };

  const answered = (right: boolean, used: number) => {
    const f = fact;
    if (!f) return;
    const thisTurn = turn;
    if (right) {
      feed.recordHit(f);
      hideFactMap();
      session.recordAnswer(f, true);
    } else {
      feed.recordMiss(f);
      hideFactMap();
      session.recordAnswer(f, false);
    }
    isGutter = !right;
    hud.mark(chosen, options.indexOf(f.answer), right);
    // After a gutter ball the green answer pulses at once and the game waits for a tap on it.
    if (!right) tapFlow.arm(hud.buttons, options.indexOf(f.answer), hud.avoid, f);
    hud.setClock(null, false);
    alley.aim.setVisible(false);
    after(HIDE_QUESTION_AFTER, () => {
      if (turn !== thisTurn) return;
      // The question goes; after a gutter ball the answers stay up for the tap.
      hud.showQuestion(false, !right);
      if (!right) goTo('aim', 0.35);
    });
    if (right) {
      const forced = devDrift();
      const drift = forced ?? driftFor(used, clockTotal);
      thrown = thrownAim(aim, drift, driftSide(Math.random()));
      startThrow();
    } else {
      startGutter();
    }
  };

  // ---------- The throw ----------
  const startThrow = () => {
    phase = 'throw';
    rollT = 0;
    fast = false;
    crashed = false;
    switchedToPins = false;
    setBowler('throw');
  };

  const launch = () => {
    physics.launch(throwPath(thrown));
    sfx.roll(2.0);
    phase = 'roll';
    rollT = 0;
    setBowler('follow');
    goTo('follow', 0.5);
  };

  const updateThrow = () => {
    if (phase !== 'throw') return;
    if (gameTime - bowlerSince >= THROW_SECONDS) launch();
  };

  const updateRoll = (delta: number) => {
    if (phase !== 'roll') return;
    rollT += delta;
    if (fast) physics.step(FAST_STEPS * FIXED_STEP, FAST_STEPS);
    else physics.step(delta);
    const b = physics.ball();
    ballPos = { x: b.x, y: b.y, z: b.z };
    if (!switchedToPins && b.z < PINS_SWITCH_Z) {
      switchedToPins = true;
      goTo('pins', 0.7);
    }
    if (!crashed) {
      for (const id of standing) {
        const p = physics.pin(id);
        if (p && Math.hypot(p.x - b.x, p.y - b.y, p.z - b.z) < CRASH_RANGE) {
          crashed = true;
          sfx.pins();
          break;
        }
      }
    }
    if (physics.settled()) finishRoll();
  };

  const finishRoll = () => {
    const left = physics.standing();
    result(standing.length - left.length, left, false);
  };

  // ---------- The gutter ball ----------
  const startGutter = () => {
    phase = 'gutter';
    slipSide = gutterSide(aim, Math.random());
    setBowler('slip');
    lastGutterPos = null;
    gutterScript = null;
  };

  const updateGutter = () => {
    if (phase !== 'gutter') return;
    if (gameTime - bowlerSince >= SLIP_BALL_LANDS) {
      sfx.bump();
      sfx.roll(1.5);
      result(0, standing, true);
    }
  };

  // ---------- The result ----------
  /** Speaks lines one after the other; `done` runs after the last (unless a newer ball started). */
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

  const result = (pinsDown: number, left: PinId[], gutter: boolean) => {
    const f = fact;
    const thisTurn = turn;
    phase = 'result';
    resultAt = gameTime;
    standingAfter = left;
    const call = callFor(rolls, pinsDown, left, gutter, splitBefore);
    lastCall = call;
    rolls = [...rolls, pinsDown];
    renderCard();
    standing = left;
    renderPins(false);
    hud.showSide(true);

    // The alley screen for a big moment, a small pill for the rest.
    const title = bigTitle(call);
    if (title) {
      hud.showScreen(title, screenKind(call));
      after(SCREEN_FOR, () => hud.hideScreen());
    } else {
      const text = pillText(call);
      if (text) {
        hud.showPill(text);
        after(PILL_FOR, () => hud.hidePill());
      }
    }
    if (gutter && f) hud.showBanner('GUTTER BALL', f.statement, 'miss', 'ask');

    // Sounds.
    if (gutter) sfx.miss();
    else if (call.kind === 'strike') {
      if (call.streak >= 3) sfx.bigCheer();
      else sfx.cheer();
    } else if (call.kind === 'spare') sfx.cheer();
    if (call.kind === 'strike') hud.confetti();

    // The announcer, then the fact after a wrong answer.
    speechOver = false;
    const lines = callSpeech(call);
    if (gutter && f) lines.push(...missSpeech(f, options[chosen]));
    sayLines(lines, thisTurn, () => {
      speechOver = true;
      if (gutter) tapFlow.readFinished();
    });

    // The reaction shot from the friends.
    const reacts = call.kind === 'strike' || call.kind === 'spare' || gutter;
    const forced = devFriends();
    holdOver = false;
    const holdFor = gutter ? GUTTER_HOLD : PIN_HOLD;
    if (reacts || forced) {
      const move: FriendMove = gutter || pinsDown === 0 ? 'groan' : 'cheer';
      after(holdFor, () => {
        if (turn !== thisTurn || phase !== 'result') return;
        goTo('friends', 0);
        friends.set(move, gameTime);
        after(REACTION_FOR, () => {
          holdOver = true;
        });
      });
    } else {
      after(holdFor, () => {
        holdOver = true;
      });
    }
  };

  /** A gutter ball never moves on by itself: only a tap on the green answer does. */
  const updateResult = () => {
    if (phase !== 'result' || isGutter) return;
    if (speechOver && holdOver) reset();
  };

  /** A tap while a result shows skips ahead, so it never feels ignored. */
  const canSkip = () => phase === 'result' && gameTime - resultAt >= SKIP_RESULT_AFTER;

  /** The player tapped the green answer after a gutter ball: the ball lands at once, then on. */
  const proceedAfterGutter = () => {
    if (phase === 'gutter') result(0, standing, true);
    hud.hideBanner();
    reset();
  };

  // ---------- Reset and the next ball ----------
  const reset = () => {
    if (phase !== 'result') return;
    timers.clear();
    speechToken++;
    tapFlow.disarm();
    stopSpeaking();
    hud.hideScreen();
    hud.hidePill();
    hud.showQuestion(false);
    const where = position(rolls);
    if (where.over) {
      finishGame();
      return;
    }
    phase = 'reset';
    const fromFriends = goal === 'friends';
    goTo('aim', fromFriends ? 0 : RESET_FOR);
    if (where.fullRack) {
      standing = [...PIN_IDS];
      splitBefore = false;
      physics.rack(standing);
      pins.rack(standing, true);
    } else {
      standing = standingAfter;
      splitBefore = lastCall.kind === 'split';
      physics.rack(standing);
      pins.rack(standing, false);
    }
    gutterScript = null;
    setBowler('hold');
    const thisTurn = turn;
    after(RESET_FOR, () => {
      if (turn !== thisTurn || phase !== 'reset') return;
      startAim();
    });
  };

  const startAim = () => {
    phase = 'aim';
    timers.clear();
    const where = position(rolls);
    renderCard();
    renderPins(true);
    setAimMarks();
    alley.aim.setVisible(true);
    hud.showSide(true);
    hud.showControls(true);
    hud.showHints(hints.move, hints.swing);
    goTo('aim', 0);
    setBowler('hold');
    if (where.frame === 10 && where.ball === 1 && !tenthShown) {
      tenthShown = true;
      hud.showPill('10TH FRAME');
      const thisTurn = turn;
      after(1.4, () => {
        if (turn === thisTurn) hud.hidePill();
      });
      speak(LAST_FRAME_SPEECH);
    }
  };

  // ---------- The end ----------
  const finishGame = () => {
    hideFactMap();
    phase = 'over';
    overAt = gameTime;
    const thisTurn = ++turn;
    tapFlow.disarm();
    hud.hideBanner();
    hud.showControls(false);
    hud.showSide(false);
    hud.showQuestion(false);
    alley.aim.setVisible(false);
    const total = totalScore(rolls);
    hud.setCardBig(true);
    hud.showBanner('GAME OVER', `Final score ${total}`, 'info', 'aim');
    if (total > bestAtStart && total > 0) {
      speak(NEW_HIGH_SCORE_SPEECH);
      sfx.bigCheer();
    } else {
      speak(GAME_OVER_SPEECH);
      sfx.cheer();
    }
    after(FINAL_FOR, () => {
      if (turn === thisTurn && phase === 'over') finishRun();
    });
  };

  const finishRun = () => {
    hideFactMap();
    if (phase !== 'over') return;
    phase = 'done';
    timers.clear();
    stopSpeaking();
    hud.hideBanner();
    hud.showCard(false);
    const total = totalScore(rolls);
    const stars = starsFor(feed.correct, feed.answered);
    session.recordStars(stars);
    session.recordScore(total);
    showResults({
      topicId: session.topic.id,
      correct: feed.correct,
      total: feed.answered,
      stars,
      newBest: false,
      missed: feed.missed(),
      playerName: session.player?.name,
      score: total,
      outcome: outcomeText(rolls),
      highScore: session.highScore(),
      newHighScore: total > bestAtStart && total > 0,
      playAgainLabel: 'Play again 🎳',
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
    const start = devStart();
    rolls = start.rolls;
    standing = start.rack;
    splitBefore = start.splitBefore;
    aim = DEFAULT_AIM;
    thrown = DEFAULT_AIM;
    bestAtStart = session.highScore();
    fact = undefined;
    options = [];
    tenthShown = false;
    hints.move = rolls.length === 0;
    hints.swing = rolls.length === 0;
    gutterScript = null;
    isGutter = false;
    const where = position(rolls);
    physics.rack(standing);
    pins.rack(standing, where.fullRack);
    hud.setCardBig(false);
    hud.showCard(true);
    hud.hideBanner();
    hud.hidePill();
    hud.hideScreen();
    hud.showQuestion(false);
    hud.showControls(false);
    renderCard();
    renderPins(true);
    setAimMarks();
    alley.aim.setVisible(true);
    setBowler('hold');
    goTo('aim', 0);
    if (!withPreview) {
      phase = 'reset';
      startAim();
      return;
    }
    phase = 'preview';
    showPreview({ topic: session.topic, facts: feed.peek(10), onDone: startAim });
  };

  // ---------- Input ----------
  const bowl = () => {
    if (phase === 'aim') ask();
  };

  const changeAim = (kind: 'move' | 'swing', dx: number) => {
    if (phase !== 'aim') return;
    aim = kind === 'move' ? moveBowler(aim, dx) : swingArrow(aim, dx);
    aimDirty = true;
    if (kind === 'move') hints.move = false;
    else hints.swing = false;
    hud.showHints(hints.move, hints.swing);
  };

  const skip = () => {
    if (tapFlow.armed) return;
    if (phase === 'roll' && rollT >= FAST_AFTER && !fast) {
      fast = true;
      goTo('pins', 0);
      switchedToPins = true;
    } else if (canSkip()) {
      reset();
    } else if (phase === 'over' && gameTime - overAt >= SKIP_RESULT_AFTER) {
      finishRun();
    }
  };

  const onAnswer = (index: number) => {
    if (tapFlow.armed) {
      // After a gutter ball only the green answer moves on; any other answer is ignored.
      if (tapFlow.tap(index)) proceedAfterGutter();
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
  press(hud.bowl, bowl);
  press(hud.nudges.moveLeft, () => changeAim('move', -BOARD_W));
  press(hud.nudges.moveRight, () => changeAim('move', BOARD_W));
  press(hud.nudges.aimLeft, () => changeAim('swing', -BOARD_W));
  press(hud.nudges.aimRight, () => changeAim('swing', BOARD_W));
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

  // Dragging the bottom strip slides the bowler; dragging above it swings the arrow.
  let dragKind: 'move' | 'swing' | null = null;
  const stopPointer = createPointerInput(ctx.renderer.domElement, {
    onDragStart: (state) => {
      unlockAudio();
      dragKind = null;
      if (phase !== 'aim') return;
      const ballAt = toScreen({ x: aim.startX, y: 0, z: BOWLER_Z });
      const tipAt = toScreen({ x: arrowTipX(aim), y: 0, z: ARROW_Z });
      dragKind = state.y > (ballAt.y + tipAt.y) / 2 ? 'move' : 'swing';
    },
    onDrag: (state) => {
      if (!dragKind || phase !== 'aim') return;
      const perBoard = dragKind === 'move' ? MOVE_PX_PER_BOARD : SWING_PX_PER_BOARD;
      changeAim(dragKind, (state.dx / perBoard) * BOARD_W);
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
    if (phase !== 'aim') return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      bowl();
      return;
    }
    const swing = e.shiftKey || e.key === 'a' || e.key === 'A' || e.key === 'd' || e.key === 'D';
    const left = e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A';
    const right = e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D';
    if (left || right) {
      e.preventDefault();
      changeAim(swing ? 'swing' : 'move', (left ? -1 : 1) * BOARD_W);
    }
  };
  window.addEventListener('keydown', onKey);

  // ---------- Loop ----------
  const updateScene = (delta: number) => {
    // The bowler and the ball.
    if (bowlerMove === 'slip' && gameTime - bowlerSince >= SLIP_SECONDS) {
      // The slip is over: the bowler hangs their head (the gutter ball keeps rolling on its own).
      bowlerMove = 'slump';
      bowlerSince += SLIP_SECONDS;
    }
    const t = gameTime - bowlerSince;
    bowler.play(bowlerMove, t, delta, aim.startX, slipSide);
    if (phase === 'roll' || (phase === 'result' && !isGutter) || (phase === 'over' && !isGutter)) {
      ball.object.visible = true;
      ball.setPose(physics.ball());
    } else if (gutterScript || (bowlerMove === 'slip' && t >= 0.45)) {
      // The gutter ball is a script: it leaves the hand, lands, and rolls down the gutter.
      if (!gutterScript) {
        gutterScript = {
          since: bowlerSince,
          from: lastGutterPos ?? { x: aim.startX, y: BALL_R, z: BOWLER_Z },
          side: slipSide,
        };
      }
      const g = gutterBallAt(
        gameTime - gutterScript.since,
        gutterScript.from,
        gutterScript.side,
        DECK_BACK_Z - 0.4,
      );
      ball.object.visible = !g.gone;
      if (g.rolling) {
        ball.rollBy(0, -GUTTER_SPEED * delta);
        ball.place(g.pos, -0.048);
      } else {
        ball.place(g.pos);
      }
      ballPos = g.pos;
    } else if (bowler.ballAt(bowlerMove, t, aim.startX, handBall)) {
      ball.object.visible = true;
      ball.place({ x: handBall.x, y: handBall.y, z: handBall.z });
      lastGutterPos = { x: handBall.x, y: handBall.y, z: handBall.z };
      if (phase === 'throw') ballPos = lastGutterPos;
    }
    pins.sync(physics, delta);
    friends.update(gameTime, delta);
  };

  ctx.onUpdate((delta) => {
    layout();
    gameTime += delta;
    tapFlow.update(delta);
    timers.update(delta);
    if (moveT < 1) moveT = Math.min(1, moveT + delta / Math.max(moveDur, 1e-3));

    updateAsk(delta);
    updateThrow();
    updateRoll(delta);
    updateGutter();
    updateResult();

    if (aimDirty && (phase === 'aim' || phase === 'ask')) {
      setAimMarks();
      renderPins(phase === 'aim');
    }
    updateScene(delta);
    applyCamera();

    if (phase === 'aim' && (hints.move || hints.swing)) {
      const feet = toScreen({ x: aim.startX, y: 0, z: BOWLER_Z });
      const tip = toScreen({ x: arrowTipX(aim), y: 0, z: ARROW_Z });
      const clampX = (x: number) => Math.min(Math.max(x, 90), viewW - 90);
      // "Drag to move" sits in the strip below the bowler, kept clear of the nudge row.
      const moveY = Math.min(feet.y + 30, bands.aim.bottom - 26);
      hud.placeHints(clampX(feet.x), moveY, clampX(tip.x), tip.y - 26);
    }
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
    ctx.dispose();
  });
}

const session = startGameSession(GAME_ID);
if (session) run(session);
else location.replace(menuUrl());
