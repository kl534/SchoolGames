import './style.css';
import { MathUtils, Vector3 } from 'three';
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
import { createBall } from './ball';
import { buildCourt } from './court';
import { devGame, forcedPlay } from './dev';
import { createEffects } from './effects';
import {
  FT_DEFENDER,
  FT_SPOT,
  guardSpot,
  OFFENSE_R,
  RIM,
  RIM_GROUND,
  SPOT_ANGLES,
  lerpVec,
  spotPos,
  vec,
  type Vec,
} from './geometry';
import { createHud } from './hud';
import {
  callInPanel,
  defenseCam,
  defenseKeys,
  fitView,
  offenseCam,
  offenseKeys,
  playingBand,
  popPosition,
  type PlayBand,
  type Rect,
} from './layout';
import {
  actorAt,
  ballAt,
  planPlay,
  scriptHand,
  SLOW_MO_SCALE,
  dribbleHeight,
  type PlayEvent,
  type PlayInput,
  type PlayScript,
  type Who,
} from './plays';
import { createBaller, type Baller, type KidMove } from './players';
import {
  darken,
  OUR_JERSEY,
  OUR_TRIM,
  ourAbbr,
  outcomeText,
  pickRival,
  rivalWinsSpeech,
  scoreLine,
  type Rival,
} from './rivals';
import {
  AND_ONE_SPEECH,
  easeToward,
  endTurn,
  FREE_THROW_MADE_SPEECH,
  FREE_THROW_MISSED_SPEECH,
  HALFTIME_SPEECH,
  isAndOne,
  MISS_SPEECH,
  newGame,
  OFFENSIVE_REBOUND_SPEECH,
  ON_FIRE_SPEECH,
  onFire,
  OVERTIME_SPEECH,
  ourBasket,
  ourFreeThrow,
  ourMiss,
  ourViolation,
  periodShort,
  pointsText,
  rivalScoreFor,
  roundsLeft,
  SHOT_LABEL,
  SHOT_SPEECH,
  shotFor,
  STOP_LABEL,
  STOP_SPEECH,
  stopFor,
  theirBasket,
  THEIR_BALL_SPEECH,
  theirScoreSpeech,
  turnsInPeriod,
  VIOLATION_SPEECH,
  YOU_WIN_SPEECH,
  type GameState,
  type RivalScore,
  type Shot,
  type Side,
} from './rules';

const GAME_ID = 'buzzer-beater';

/** Seconds the intro banner stays up (a tap skips it). */
const INTRO_FOR = 1.8;
/** Seconds the players and the camera take to get to a new spot. */
const RESET_SECONDS = 0.9;
/** Seconds the players walk to the line for a free throw. */
const FT_SETUP = 1.0;
/** Seconds after a right answer's result is ready before a tap skips ahead. */
const SKIP_BANNER_AFTER = 0.6;
/** Seconds into a right answer's play before a tap can skip the rest of it. */
const PLAY_FAST_FORWARD_AFTER = 1.4;
/** Seconds an announcement (halftime, overtime) stays up at least. */
const ANNOUNCE_FOR = 1.8;
/** Seconds the final banner stays up before the results. */
const FINAL_FOR = 2.2;
/** Slow motion eases in and out over this many seconds of play time. */
const SLOW_EASE = 0.08;
/** Where the shot clock sits: just above the backboard. */
const CLOCK_SPOT = vec(0, 4.05, 1.2);

type Phase = 'preview' | 'intro' | 'reset' | 'ask' | 'play' | 'result' | 'announce' | 'done';

type ViewKind = 'offense' | 'defense' | 'ft-us' | 'ft-them';

interface CamView {
  pos: Vec;
  look: Vec;
  fov: number;
  shift: number;
}

const smooth = (x: number) => {
  const k = MathUtils.clamp(x, 0, 1);
  return k * k * (3 - 2 * k);
};

/** What is going on in the play that is running. */
interface Playing {
  input: PlayInput;
  script: PlayScript;
  /** Who scores at the script's `score` event, and how many points it adds to the scorebug. */
  side: Side;
  points: number;
  shot?: Shot;
  /** This basket brings the fire on. */
  fireStarts: boolean;
  eventIndex: number;
  /** Where the camera pushes in to during slow motion. */
  focus: Vec;
}

const pad = (r: Rect): Rect => ({
  left: r.left - 6,
  top: r.top - 6,
  right: r.right + 6,
  bottom: r.bottom + 6,
});

function run(session: GameSession): void {
  const container = document.getElementById('game');
  if (!container) throw new Error('Missing #game container');

  // ---------- Scene ----------
  const ctx = createScene(container, { fov: 60, near: 0.3, far: 600 });
  const { scene, camera } = ctx;
  const court = buildCourt(scene);
  const effects = createEffects();
  scene.add(effects.object);
  const ball = createBall();
  scene.add(ball.object);

  const us = createBaller({ shirt: OUR_JERSEY, pants: OUR_TRIM, hatColor: OUR_TRIM });
  const them = createBaller({ shirt: 0x6b7280, pants: 0x30343b, skin: 0xd9a066 });
  scene.add(us.root, them.root);
  const ballers: Record<Who, Baller> = { us, them };

  // The kids on the benches.
  const SHIRTS = [0xe63946, 0xf4a261, 0x2a9d8f, 0x8e7dbe, 0xffd166, 0x06d6a0];
  const SKINS = [0xf1b48a, 0xc68642, 0x8d5524, 0xffdbac, 0xe0ac69];
  const HAIRS = [0x2b1b10, 0x5a3416, 0xd8b45a, 0x111111, 0x8b3a1a];
  const pickOf = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];
  const kids = court.seats.map((seat) => {
    const baller = createBaller(
      {
        shirt: pickOf(SHIRTS),
        pants: 0x2b3a55,
        skin: pickOf(SKINS),
        hair: pickOf(HAIRS),
        hat: 'none',
      },
      0.7,
    );
    baller.setPos(seat.pos);
    baller.face(seat.facing);
    scene.add(baller.root);
    return { baller, move: 'sit' as KidMove, since: 0, phase: Math.random() * 20 };
  });

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
  let state: GameState = newGame();
  let bestAtStart = session.highScore();
  let rival: Rival = pickRival(Math.random());
  let usAbbr = 'YOU';
  /** What the scorebug shows; it lags the real state while a play is still happening. */
  const shown = { us: 0, them: 0, fire: false };
  let fact: Fact | undefined;
  let options: string[] = [];
  let chosen = -1;
  /** Ticks up for each question, so late callbacks can tell they are stale. */
  let turn = 0;
  let speechToken = 0;
  let speechDone = false;
  /** Seconds since the question finished being read. */
  let answerTime = 0;
  let clockTotal = 10;
  let lastTick = 0;
  /** The spot the players are at, and the one before. */
  let angle = 0;
  let lastAngle: number | null = null;
  /** Where each player stands now (it moves in resets and plays). */
  const spot: Record<Who, Vec> = { us: vec(), them: vec() };
  /** The moves each player plays outside a script. */
  const idle: Record<
    Who,
    { move: 'stand' | 'dribble' | 'guard' | 'run' | 'run-dribble'; t: number }
  > = {
    us: { move: 'stand', t: 0 },
    them: { move: 'stand', t: 0 },
  };
  /** Rival's and-one free throw waits after the layup. */
  let theirFreeThrow = false;
  /** The turn goes on after this play (our offensive rebound). */
  let keepBall = false;
  let current: Playing | null = null;
  /** Seconds into the play, in play time (slow motion stretches it). */
  let playClock = 0;
  let playEnded = false;
  let scriptEndedAt = 0;
  let resultDone: (() => void) | null = null;
  let skipAnnounce: (() => void) | null = null;
  let announceToken = 0;
  let replaying = 0;
  /** The ball drawn from the script (true) or from the holder's hand (false). */
  let ballFromScript = false;
  /** Moves the players along while a reset or free-throw setup is under way. */
  let movement: ((now: number) => void) | null = null;

  // Delayed actions run on game time so pausing freezes them too.
  let gameTime = 0;
  let pending: { at: number; fn: () => void }[] = [];
  const after = (seconds: number, fn: () => void) => pending.push({ at: gameTime + seconds, fn });

  // ---------- Layout and the camera ----------
  let viewW = 0;
  let viewH = 0;
  let liveBand: PlayBand = { top: 0, bottom: 0 };
  let goal: { kind: ViewKind; angle: number } = { kind: 'offense', angle: 0 };
  const viewCache = new Map<string, CamView>();
  const cur: CamView = { pos: vec(0, 3, 12), look: vec(0, 2, 0), fov: 60, shift: 0 };
  let from: CamView = { ...cur };
  let to: CamView = { ...cur };
  let moveT = 1;
  let moveDur = RESET_SECONDS;
  let push = 0;
  const point = new Vector3();
  const lookAtPoint = new Vector3();

  const viewFor = (kind: ViewKind, a: number): CamView => {
    const key = `${kind}:${a}`;
    const hit = viewCache.get(key);
    if (hit) return hit;
    let cam: Vec;
    let keys: Vec[];
    if (kind === 'ft-us') {
      cam = offenseCam(FT_SPOT);
      keys = offenseKeys(FT_SPOT);
    } else if (kind === 'offense') {
      const s = spotPos(a, OFFENSE_R);
      cam = offenseCam(s);
      keys = offenseKeys(s);
    } else {
      cam = defenseCam(kind === 'ft-them' ? 0 : a);
      keys = defenseKeys(kind === 'ft-them' ? 0 : a);
    }
    const fit = fitView(cam, keys, viewW, viewH, liveBand);
    const view = { pos: cam, look: fit.look, fov: fit.fov, shift: fit.shift };
    viewCache.set(key, view);
    return view;
  };

  /** Eases the camera to a view (or snaps there). */
  let seeFrom = 0;
  let seeTo = 0;
  let seeNow = 0;
  const goTo = (kind: ViewKind, a: number, seconds: number) => {
    goal = { kind, angle: a };
    // The backboard fades to see-through for the defense views, over the same ease as the camera.
    seeFrom = seeNow;
    seeTo = kind === 'defense' || kind === 'ft-them' ? 1 : 0;
    if (!viewW) {
      seeFrom = seeTo;
      return;
    }
    from = { pos: { ...cur.pos }, look: { ...cur.look }, fov: cur.fov, shift: cur.shift };
    to = viewFor(kind, a);
    moveT = 0;
    moveDur = seconds;
    if (seconds <= 0) moveT = 1;
  };

  const layout = (force = false) => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!force && w === viewW && h === viewH) return;
    viewW = w;
    viewH = h;
    const measured = hud.measureBand();
    liveBand = { top: measured.top + 8, bottom: measured.bottom - 8 };
    camera.aspect = w / Math.max(h, 1);
    viewCache.clear();
    to = viewFor(goal.kind, goal.angle);
    from = to;
    moveT = 1;
  };

  const applyCamera = () => {
    const e = moveT >= 1 ? 1 : moveT < 0.5 ? 2 * moveT * moveT : 1 - (-2 * moveT + 2) ** 2 / 2;
    cur.pos = lerpVec(from.pos, to.pos, e);
    cur.look = lerpVec(from.look, to.look, e);
    cur.fov = MathUtils.lerp(from.fov, to.fov, e);
    cur.shift = MathUtils.lerp(from.shift, to.shift, e);
    seeNow = MathUtils.lerp(seeFrom, seeTo, e);
    court.setBoardSeeThrough(seeNow);
    // The slow-motion push-in: a quarter of the way to the moment.
    // The look point goes a quarter of the way too, so the action stays in the picture.
    let pos = cur.pos;
    let look = cur.look;
    if (push > 0.001 && current) {
      pos = lerpVec(cur.pos, current.focus, 0.25 * push);
      look = lerpVec(cur.look, current.focus, 0.25 * push);
    }
    camera.fov = cur.fov;
    camera.setViewOffset(viewW, viewH, 0, cur.shift, viewW, viewH);
    camera.updateProjectionMatrix();
    camera.position.set(pos.x, pos.y, pos.z);
    lookAtPoint.set(look.x, look.y, look.z);
    camera.lookAt(lookAtPoint);
    camera.updateMatrixWorld();
    effects.setScale(
      (viewH * ctx.renderer.getPixelRatio()) / (2 * Math.tan((cur.fov * Math.PI) / 360)),
    );
  };

  /** Where a pop-up for a spot in the world goes, kept clear of the scorebug and the answers. */
  const toScreen = (world: Vec) => {
    const p = point.set(world.x, world.y, world.z).project(camera);
    const band = playingBand(viewW, viewH, hud.bugBottom());
    return popPosition(
      { x: ((p.x + 1) / 2) * viewW, y: ((1 - p.y) / 2) * viewH },
      p.z > 1,
      viewW,
      band,
    );
  };

  /**
   * Which side of the screen a card beside the court goes: the side the players are not on, as a
   * share of the width.
   */
  const cardSide = () => {
    const across = (['us', 'them'] as const).map((who) => {
      const p = point.set(spot[who].x, 1, spot[who].z).project(camera);
      return (p.x + 1) / 2;
    });
    return (across[0] + across[1]) / 2 > 0.5 ? 0.23 : 0.77;
  };

  // ---------- Saving and the scorebug ----------
  const MIN_ANSWERS_FOR_STARS = 10;
  /**
   * Saves how the run stands: the points as the high score, and the stars once there are enough
   * answers. Both are "best so far" records, so saving them again never takes anything away.
   */
  const saveProgress = () => {
    session.recordScore(state.us);
    if (feed.answered >= MIN_ANSWERS_FOR_STARS) {
      session.recordStars(starsFor(feed.correct, feed.answered));
    }
  };

  const refresh = () => {
    hud.renderBug({
      usAbbr,
      themAbbr: rival.abbr,
      themEmoji: rival.emoji,
      us: shown.us,
      them: shown.them,
      period: periodShort(state.period),
      roundsLeft: roundsLeft(state),
      rounds: turnsInPeriod(state.period),
      best: Math.max(session.highScore(), 0),
      ball: state.ball,
      fire: shown.fire,
    });
  };

  const syncShown = () => {
    shown.us = state.us;
    shown.them = state.them;
    shown.fire = onFire(state);
  };

  // ---------- The people ----------
  const colourRival = () => {
    them.person.recolour(rival.jersey, darken(rival.jersey, 0.6));
  };

  const setKids = (move: KidMove) => {
    for (const kid of kids) {
      kid.move = move;
      kid.since = gameTime + Math.random() * 0.25;
    }
  };

  const faceEachOther = () => {
    const holder = ballers[state.ball];
    const other = ballers[state.ball === 'us' ? 'them' : 'us'];
    holder.face(RIM_GROUND);
    other.face(holder.root.position);
  };

  /** Puts a player at a place (the scripts and resets move them with this). */
  const place = (who: Who, p: Vec) => {
    spot[who] = { ...p };
    ballers[who].setPos(p);
  };

  /** The ball in a player's hand, dribbling if that is what they do. */
  const handBall = (who: Who, delta: number) => {
    const baller = ballers[who];
    baller.handPosition(point);
    const dribbling = idle[who].move === 'dribble' || idle[who].move === 'run-dribble';
    const y = dribbling ? dribbleHeight(idle[who].t) : point.y;
    ball.setVisible(true);
    ball.place({ x: point.x, y, z: point.z });
    if (dribbling) ball.spin(delta, 3);
    if (onFire(state) && who === 'us' && state.ball === 'us') {
      effects.flame({ x: point.x, y, z: point.z });
    }
  };

  // ---------- Asking ----------
  const spokenFact = (f: Fact) => f.spokenStatement ?? f.statement;

  /** Takes the next fact and puts its question and answers up. */
  const takeFact = () => {
    fact = feed.take();
    options = answerOptions(session.topic, fact, 4);
    chosen = -1;
    hud.setOptions(options);
    hud.setQuestion(fact.prompt);
    // A long prompt may need to drop below the scorebug; then the view fits the new band.
    if (hud.settleQuestion()) layout(true);
    return fact;
  };

  /** The question, the answers and the shot clock. The question is read; then the clock runs. */
  const ask = () => {
    if (state.over || phase === 'done') return;
    pending = [];
    stopSpeaking();
    hud.hideBanner();
    const thisTurn = ++turn;
    const asked = takeFact();
    clockTotal = session.timerSecondsFor(asked);
    answerTime = 0;
    speechDone = false;
    phase = 'ask';
    ballFromScript = false;
    current = null;
    playEnded = false;
    const ft = state.freeThrow;
    ballers.us.holding = false;
    ballers.them.holding = false;
    if (ft) {
      const shooter = ballers[state.ball];
      idle[state.ball] = { move: 'stand', t: 0 };
      idle[state.ball === 'us' ? 'them' : 'us'] = { move: 'stand', t: 0 };
      shooter.holding = true;
    } else {
      idle[state.ball] = { move: 'dribble', t: 0 };
      idle[state.ball === 'us' ? 'them' : 'us'] = { move: 'guard', t: 0 };
    }
    hud.hideQuestion(false);
    hud.shotClock.show(String(Math.ceil(clockTotal)), false);
    lastTick = Math.ceil(clockTotal);
    refresh();
    readQuestion(thisTurn);
  };

  const readQuestion = (thisTurn: number) => {
    if (!fact) return;
    const token = ++speechToken;
    speak(fact.spokenPrompt ?? fact.prompt, () => {
      if (token !== speechToken || turn !== thisTurn || phase !== 'ask') return;
      speechDone = true;
    });
  };

  const updateAsk = (delta: number) => {
    if (phase !== 'ask') return;
    if (speechDone) answerTime += delta;
    const remaining = clockTotal - (speechDone ? answerTime : 0);
    const seconds = Math.max(Math.ceil(remaining), 0);
    if (seconds < lastTick && seconds > 0 && seconds <= 3) sfx.tick();
    lastTick = seconds;
    hud.shotClock.show(String(seconds), seconds <= 3 && speechDone);
    if (speechDone && remaining <= 0) timeUp();
  };

  // ---------- Answering ----------
  const rnd = Math.random;

  /** Speaks lines one after the other; `done` runs after the last (unless a newer turn started). */
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

  /** The player picks an answer, while the question is read or the clock runs. */
  const select = (index: number) => {
    if (phase !== 'ask' || !fact) return;
    if (options[index] === undefined) return;
    try {
      unlockAudio();
      stopSpeaking();
    } catch {
      // Audio trouble must never stop the shot.
    }
    speechToken++;
    // A tap before the question has been read out counts as no time used at all.
    const used = speechDone ? answerTime : 0;
    const right = options[index] === fact.answer;
    chosen = index;
    hud.lock();
    hud.buttons[index].classList.add('chosen');
    hud.shotClock.hide();
    answered(right, used, false);
  };

  /** The shot clock runs out. */
  const timeUp = () => {
    if (phase !== 'ask' || !fact) return;
    chosen = -1;
    hud.lock();
    hud.shotClock.show('0', true);
    after(0.9, () => hud.shotClock.hide());
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
    const forced = forcedPlay();
    let input: PlayInput;
    let side: Side = 'us';
    let points = 0;
    let shot: Shot | undefined;
    let fireStarts = false;
    let title: string;
    let lines: string[];
    let reboundKept = false;
    keepBall = false;
    theirFreeThrow = false;

    if (state.ball === 'us' && state.freeThrow) {
      state = ourFreeThrow(state, right);
      input = { kind: 'free-throw', shooter: 'us', made: right };
      points = 1;
      title = right ? `SWISH! ${pointsText(1)}` : 'Rims out!';
      lines = right ? [FREE_THROW_MADE_SPEECH] : [FREE_THROW_MISSED_SPEECH, spokenFact(f)];
    } else if (state.ball === 'us') {
      if (right) {
        const ask = forced?.kind === 'shot' ? forced : null;
        shot = ask ? ask.shot : shotFor(used, rnd());
        const andOne = ask ? ask.andOne : isAndOne(shot, rnd());
        const result = ourBasket(state, shot, andOne);
        state = result.state;
        points = result.points;
        fireStarts = result.fireStarted;
        input = { kind: 'make', shooter: 'us', shot, andOne };
        title = `${SHOT_LABEL[shot]} ${pointsText(points)}`;
        lines = [SHOT_SPEECH[shot]];
        if (fireStarts) lines.push(ON_FIRE_SPEECH);
        if (andOne) lines.push(AND_ONE_SPEECH);
      } else if (timedOut) {
        state = ourViolation(state);
        shown.fire = false;
        input = { kind: 'violation' };
        title = 'SHOT CLOCK VIOLATION!';
        lines = [VIOLATION_SPEECH, spokenFact(f)];
      } else {
        const result = ourMiss(state, forced?.kind === 'rebound' ? 0 : rnd());
        state = result.state;
        shown.fire = false;
        input = { kind: 'miss', shooter: 'us', rebound: result.rebound ? 'us' : 'them' };
        title = 'CLANK!';
        lines = [
          MISS_SPEECH,
          spokenFact(f),
          result.rebound ? OFFENSIVE_REBOUND_SPEECH : THEIR_BALL_SPEECH,
        ];
        reboundKept = result.rebound;
      }
    } else if (right) {
      const stop = forced?.kind === 'stop' ? forced.stop : stopFor(used);
      input =
        stop === 'block'
          ? { kind: 'block' }
          : stop === 'steal'
            ? { kind: 'steal' }
            : { kind: 'miss', shooter: 'them', rebound: 'us' };
      title = STOP_LABEL[stop];
      lines = [STOP_SPEECH[stop]];
    } else {
      let score: RivalScore;
      if (forced?.kind === 'them') {
        score =
          forced.shot === 'two'
            ? rivalScoreFor(0, rnd())
            : forced.shot === 'three'
              ? rivalScoreFor(0.8, 0)
              : rivalScoreFor(0.97, 0);
      } else {
        score = rivalScoreFor(rnd(), rnd());
      }
      state = theirBasket(state, score);
      side = 'them';
      shot = score.shot;
      // An and-one: the layup scores 2 and the free throw 1.
      points = score.andOne ? 2 : score.points;
      theirFreeThrow = score.andOne;
      input = { kind: 'make', shooter: 'them', shot: score.shot, andOne: score.andOne };
      title = `${rival.name} ${pointsText(score.points)}`;
      lines = [theirScoreSpeech(score), spokenFact(f)];
    }
    keepBall = reboundKept;
    saveProgress();
    refresh();

    // The banner, the marks and the speech, at the answer.
    hud.mark(chosen, options.indexOf(f.answer), right);
    hud.showBanner(title, f.statement, right ? 'good' : 'miss', 'aside', cardSide());

    // The play.
    const script = planPlay(input, input.kind === 'free-throw' ? 0 : angle, rnd);
    const focus = pushPoint(script);
    current = { input, script, side, points, shot, fireStarts, eventIndex: 0, focus };
    playClock = 0;
    playEnded = false;
    phase = 'play';
    ballFromScript = true;
    if (right && !callInPanel(viewW, viewH)) after(0.25, () => hud.hideQuestion(true));
    if (timedOut) sfx.alarm();
    if (input.kind === 'violation') setKids('groan');

    if (!right) {
      // The green answer pulses at once. Nothing moves on by itself: the game waits for a tap on
      // it, however long that takes, and `proceedAfterMiss` finishes the play first.
      resultDone = null;
      tapFlow.arm(hud.buttons, options.indexOf(f.answer), hud.avoid);
      sayLines(lines, thisTurn, () => {
        if (phase === 'play' || phase === 'result') tapFlow.readFinished();
      });
      return;
    }
    let spoken = false;
    const next = () => {
      if (spoken && playEnded && !replaying && turn === thisTurn && phase === 'result') {
        proceed();
      }
    };
    resultDone = next;
    sayLines(lines, thisTurn, () => {
      spoken = true;
      next();
    });
  };

  /** The camera pushes in on this point during slow motion. */
  const pushPoint = (script: PlayScript): Vec => {
    const block = script.events.find((e) => e.type === 'block');
    if (block)
      return ballAt(script, block.t, (who) => scriptHand(script, who, block.t, vec()), vec());
    return { ...RIM };
  };

  // ---------- Plays ----------
  const onPlayEvent = (e: PlayEvent, quiet: boolean) => {
    const play = current;
    if (!play) return;
    const script = play.script;
    switch (e.type) {
      case 'rim':
        if (!quiet) sfx.bump();
        break;
      case 'board':
        if (!quiet) sfx.glove();
        break;
      case 'net':
        court.swish();
        if (!quiet) effects.sparkle({ x: RIM.x, y: RIM.y - 0.1, z: RIM.z });
        if (play.shot === 'dunk') court.dunkWobble();
        break;
      case 'score': {
        const side = play.input.kind === 'free-throw' ? play.input.shooter : play.side;
        shown[side] += play.points;
        if (side === 'us' && play.fireStarts) shown.fire = true;
        refresh();
        hud.flashPoints(side);
        const at = toScreen(RIM);
        hud.pop(pointsText(play.points), at.x, at.y - 30, side === 'us' ? 'good' : 'bad');
        if (!quiet) {
          if (side === 'them') sfx.miss();
          else if (play.input.kind === 'free-throw') sfx.chime();
          else if (play.shot === 'three' || play.shot === 'dunk') sfx.bigCheer();
          else sfx.cheer();
        }
        setKids(side === 'us' ? 'cheer' : 'groan');
        break;
      }
      case 'block':
        if (!quiet) sfx.bigCheer();
        setKids('cheer');
        break;
      case 'steal':
        if (!quiet) sfx.whoosh();
        setKids('cheer');
        break;
      case 'rebound':
        if (play.input.kind === 'miss' && play.input.shooter === 'us') {
          const at = toScreen(RIM);
          hud.pop(
            play.input.rebound === 'us' ? 'Offensive rebound!' : 'Their ball',
            at.x,
            at.y + 40,
            play.input.rebound === 'us' ? 'good' : 'plain',
          );
        } else if (play.input.kind === 'miss' && play.input.shooter === 'them') {
          setKids('cheer');
        }
        break;
      case 'contact':
        if (!quiet) sfx.bump();
        break;
      case 'land': {
        const who = e.who ?? 'us';
        const p = actorAt(script.actors[who], e.t).pos;
        if (!quiet) effects.dust({ x: p.x, y: 0.1, z: p.z }, 6);
        break;
      }
      case 'bounce': {
        if (!quiet) {
          const p = ballAt(script, e.t, (who) => scriptHand(script, who, e.t, vec()), vec());
          effects.dust({ x: p.x, y: 0.1, z: p.z }, 3);
        }
        break;
      }
      default:
        break;
    }
  };

  const slowWeight = (t: number, w: { t0: number; t1: number }) =>
    smooth((t - (w.t0 - SLOW_EASE)) / SLOW_EASE) * (1 - smooth((t - w.t1) / SLOW_EASE));

  const updatePlay = (delta: number) => {
    const play = current;
    if (!play || (phase !== 'play' && phase !== 'result')) return;
    const { script } = play;
    // Slow motion stretches the play clock; the speech and sounds are not slowed.
    const scale = script.slowMo
      ? 1 + (SLOW_MO_SCALE - 1) * slowWeight(playClock, script.slowMo)
      : 1;
    const inWindow =
      !!script.slowMo &&
      phase === 'play' &&
      playClock < script.slowMo.t1 + 0.02 &&
      playClock > script.slowMo.t0 - SLOW_EASE;
    push = easeToward(push, inWindow ? 1 : 0, inWindow ? 12 : 5, delta);
    playClock += delta * scale;
    while (
      phase === 'play' &&
      play.eventIndex < script.events.length &&
      script.events[play.eventIndex].t <= playClock
    ) {
      onPlayEvent(script.events[play.eventIndex++], false);
    }
    if (phase === 'play' && playClock >= script.duration) endPlay();
  };

  /** The script is over (or skipped): the result waits for the speech. */
  const endPlay = () => {
    const play = current;
    if (!play || phase !== 'play') return;
    phase = 'result';
    playEnded = true;
    scriptEndedAt = gameTime;
    resultDone?.();
  };

  /** Jumps to the end of the play: everyone snaps to their last place, the score counts. */
  const skipPlay = () => {
    const play = current;
    if (!play || phase !== 'play') return;
    while (play.eventIndex < play.script.events.length) {
      const e = play.script.events[play.eventIndex++];
      if (e.type === 'score' || e.type === 'net') onPlayEvent(e, true);
    }
    playClock = play.script.duration;
    push = 0;
    endPlay();
  };

  const updateActors = (delta: number) => {
    const play = current;
    if (play && (phase === 'play' || phase === 'result')) {
      const t = Math.min(playClock, 1e9);
      const segs = play.script.ball;
      const seg =
        segs.find((s) => Math.min(t, play.script.duration) < s.t1) ?? segs[segs.length - 1];
      for (const who of ['us', 'them'] as const) {
        const a = actorAt(play.script.actors[who], t);
        place(who, a.pos);
        ballers[who].face(a.face);
        ballers[who].holding = seg.kind === 'held' && seg.who === who;
        ballers[who].play(a.move, a.moveT, delta);
      }
      return;
    }
    for (const who of ['us', 'them'] as const) {
      idle[who].t += delta;
      ballers[who].play(idle[who].move, idle[who].t, delta);
    }
    if (phase === 'ask') faceEachOther();
  };

  const updateBall = (delta: number) => {
    const play = current;
    if (ballFromScript && play && (phase === 'play' || phase === 'result')) {
      const t = Math.min(playClock, play.script.duration);
      const p = ballAt(
        play.script,
        t,
        (who) => {
          ballers[who].handPosition(point);
          return { x: point.x, y: point.y, z: point.z };
        },
        vec(),
      );
      const seg =
        play.script.ball.find((s) => t < s.t1) ?? play.script.ball[play.script.ball.length - 1];
      ball.setVisible(true);
      ball.place(p);
      if (seg.kind !== 'held') {
        ball.spin(delta, seg.kind === 'rim-roll' ? 4 : 9);
        if (onFire(state) && play.side === 'us' && phase === 'play') effects.flame(p);
      }
      return;
    }
    if (phase === 'preview' || phase === 'done') {
      ball.setVisible(false);
      return;
    }
    handBall(state.ball, delta);
  };

  // ---------- The flow ----------
  /** Where the two players stand for a spot. */
  const targets = (a: number, ft: boolean): Record<Who, Vec> => {
    const holder = state.ball;
    const other: Who = holder === 'us' ? 'them' : 'us';
    return ft
      ? ({ [holder]: FT_SPOT, [other]: FT_DEFENDER } as Record<Who, Vec>)
      : ({ [holder]: spotPos(a, OFFENSE_R), [other]: guardSpot(a) } as Record<Who, Vec>);
  };

  const newAngle = () => {
    const choices = SPOT_ANGLES.filter((a) => a !== lastAngle);
    return choices[Math.floor(rnd() * choices.length)];
  };

  /** The players jog to their places and the camera eases to the view; then the question. */
  const move = (a: number, ft: boolean, seconds: number, then: () => void) => {
    pending = [];
    tapFlow.disarm();
    stopSpeaking();
    hud.hideBanner();
    hud.hideQuestion(true);
    hud.shotClock.hide();
    current = null;
    ballFromScript = false;
    playEnded = false;
    const thisTurn = ++turn;
    angle = a;
    const goalSpots = targets(a, ft);
    const start = { us: { ...spot.us }, them: { ...spot.them } };
    const holder = state.ball;
    idle[holder] = { move: 'run-dribble', t: 0 };
    idle[holder === 'us' ? 'them' : 'us'] = { move: 'run', t: 0 };
    ballers.us.holding = false;
    ballers.them.holding = false;
    const kind: ViewKind =
      holder === 'us' ? (ft ? 'ft-us' : 'offense') : ft ? 'ft-them' : 'defense';
    goTo(kind, a, seconds);
    phase = 'reset';
    refresh();
    const startedAt = gameTime;
    movement = (now) => {
      const k = MathUtils.clamp((now - startedAt) / seconds, 0, 1);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      for (const who of ['us', 'them'] as const) {
        const p = lerpVec(start[who], goalSpots[who], e);
        place(who, p);
        ballers[who].face(goalSpots[who]);
      }
    };
    after(seconds, () => {
      if (turn !== thisTurn) return;
      movement = null;
      for (const who of ['us', 'them'] as const) place(who, goalSpots[who]);
      faceEachOther();
      then();
    });
  };

  /** A new spot (never the same twice in a row), then the question. */
  const startReset = () => {
    const a = newAngle();
    lastAngle = a;
    move(a, false, RESET_SECONDS, ask);
  };

  /** The free throw: the shooter walks to the line, then the question (ours) or the shot (theirs). */
  const startFtSetup = (shooter: Side) => {
    // The shooter has the ball (ours in our turn, theirs in theirs), so `move` knows who walks to the line.
    move(0, true, FT_SETUP, shooter === 'us' ? ask : startTheirFreeThrow);
  };

  /** The rival shoots their free throw (it always goes in): no question. */
  const startTheirFreeThrow = () => {
    const thisTurn = turn;
    const input: PlayInput = { kind: 'free-throw', shooter: 'them', made: true };
    const script = planPlay(input, 0, rnd);
    current = {
      input,
      script,
      side: 'them',
      points: 1,
      fireStarts: false,
      eventIndex: 0,
      focus: { ...RIM },
    };
    playClock = 0;
    playEnded = false;
    ballFromScript = true;
    phase = 'play';
    theirFreeThrow = false;
    keepBall = false;
    ballers.them.holding = true;
    let spoken = false;
    resultDone = () => {
      if (spoken && playEnded && turn === thisTurn && phase === 'result') proceed();
    };
    sayLines([], thisTurn, () => {
      spoken = true;
      resultDone?.();
    });
  };

  /** After a result: the free throw, the same turn again, or the next turn. */
  const proceed = () => {
    tapFlow.disarm();
    stopSpeaking();
    pending = [];
    hud.hideBanner();
    resultDone = null;
    syncShown();
    if (state.freeThrow) {
      startFtSetup('us');
      return;
    }
    if (theirFreeThrow) {
      startFtSetup('them');
      return;
    }
    if (keepBall) {
      keepBall = false;
      startReset();
      return;
    }
    const result = endTurn(state);
    state = result.state;
    syncShown();
    refresh();
    if (result.end === 'final') {
      finishGame();
    } else if (result.end === 'halftime') {
      announce(
        'Halftime',
        scoreLine(rival, state.us, state.them),
        'info',
        [HALFTIME_SPEECH],
        startReset,
        ANNOUNCE_FOR,
        true,
      );
    } else if (result.end === 'overtime') {
      announce(
        'Overtime!',
        `Tied ${state.us}–${state.them}`,
        'info',
        [OVERTIME_SPEECH],
        startReset,
        ANNOUNCE_FOR,
        false,
      );
    } else {
      startReset();
    }
  };

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
    buzzer = false,
  ) => {
    phase = 'announce';
    tapFlow.disarm();
    const token = ++announceToken;
    const startedAt = gameTime;
    stopSpeaking();
    hud.hideQuestion(true);
    hud.shotClock.hide();
    hud.showBanner(title, detail, kind);
    if (buzzer) sfx.alarm();
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
      if (gameTime - startedAt >= SKIP_BANNER_AFTER) go();
    };
  };

  /** The game is won or lost: the buzzer, the banner, then the results. */
  const finishGame = () => {
    pending = [];
    turn++;
    tapFlow.disarm();
    syncShown();
    refresh();
    const won = state.winner === 'us';
    phase = 'announce';
    hud.hideQuestion(true);
    hud.shotClock.hide();
    sfx.alarm();
    after(0.9, () => (won ? sfx.bigCheer() : sfx.miss()));
    setKids(won ? 'cheer' : 'groan');
    hud.showBanner(
      won ? 'You win!' : `${rival.name} wins!`,
      scoreLine(rival, state.us, state.them),
      won ? 'good' : 'miss',
    );
    speak(won ? YOU_WIN_SPEECH : rivalWinsSpeech(rival));
    const token = ++announceToken;
    after(FINAL_FOR, () => {
      if (token === announceToken) finishRun();
    });
  };

  const finishRun = () => {
    phase = 'done';
    hud.hideBanner();
    hud.hideQuestion(true);
    const stars = starsFor(feed.correct, feed.answered);
    session.recordStars(stars);
    session.recordScore(state.us);
    const newHighScore = state.us > bestAtStart;
    refresh();
    showResults({
      topicId: session.topic.id,
      correct: feed.correct,
      total: feed.answered,
      stars,
      newBest: false,
      missed: feed.missed(),
      playerName: session.player?.name,
      score: state.us,
      outcome: outcomeText(rival, state.us, state.them),
      highScore: session.highScore(),
      newHighScore,
      playAgainLabel: 'Play again 🏀',
      onPlayAgain: () => startRun(false),
    });
  };

  // ---------- Run flow ----------
  const startRun = (withPreview: boolean) => {
    pending = [];
    turn++;
    announceToken++;
    skipAnnounce = null;
    speechToken++;
    tapFlow.disarm();
    replaying = 0;
    resultDone = null;
    movement = null;
    current = null;
    keepBall = false;
    theirFreeThrow = false;
    stopSpeaking();
    feed = createFactFeed(() => session.chooseFacts());
    state = devGame();
    rival = pickRival(rnd());
    usAbbr = ourAbbr(session.player?.name, rival);
    colourRival();
    bestAtStart = session.highScore();
    fact = undefined;
    options = [];
    syncShown();
    lastAngle = null;
    // The first spot: everyone is put there, and the camera snaps to the view.
    angle = newAngle();
    lastAngle = angle;
    const first = targets(angle, false);
    place('us', first.us);
    place('them', first.them);
    idle[state.ball] = { move: 'dribble', t: 0 };
    idle[state.ball === 'us' ? 'them' : 'us'] = { move: 'guard', t: 0 };
    faceEachOther();
    goTo(state.ball === 'us' ? 'offense' : 'defense', angle, 0);
    hud.hideQuestion(true);
    hud.shotClock.hide();
    hud.hideBanner();
    refresh();
    if (!withPreview) {
      startIntro();
      return;
    }
    phase = 'preview';
    showPreview({ topic: session.topic, facts: feed.peek(10), onDone: startIntro });
  };

  /** "Buzzer Beater! You vs Rocket Raccoon", then the first spot. Nothing is spoken. */
  const startIntro = () => {
    phase = 'intro';
    const token = ++announceToken;
    const startedAt = gameTime;
    hud.showBanner('Buzzer Beater!', `You vs ${rival.emoji} ${rival.name}`, 'info');
    let done = false;
    const go = () => {
      if (done || token !== announceToken) return;
      done = true;
      skipAnnounce = null;
      hud.hideBanner();
      startReset();
    };
    after(INTRO_FOR, go);
    skipAnnounce = () => {
      if (gameTime - startedAt >= 0.2) go();
    };
  };

  // ---------- Input ----------
  /** A tap while a right answer's result is showing skips ahead. A miss waits for the green answer. */
  const skip = () => {
    if (tapFlow.armed) return;
    if (phase === 'result' && gameTime - scriptEndedAt >= SKIP_BANNER_AFTER) proceed();
    else if (phase === 'play' && playClock >= PLAY_FAST_FORWARD_AFTER) skipPlay();
    else if (phase === 'announce' || phase === 'intro') skipAnnounce?.();
  };
  /** The player tapped the green answer after a miss: the play ends where it would have, then on. */
  const proceedAfterMiss = () => {
    // The reading is cut off; its lines must not go on into the next beat.
    speechToken++;
    if (phase === 'play') skipPlay();
    proceed();
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
  const unpress = hud.buttons.map((button, i) => {
    // A touch press doesn't count as a user gesture for iOS audio; the release does.
    button.addEventListener('pointerup', unlockAudio);
    return onPress(button, () => onAnswer(i));
  });
  hud.hear.addEventListener('click', () => {
    unlockAudio();
    if (fact && hud.callInPanel()) {
      // The call has taken the question's place: the button says the fact again.
      const current = fact;
      const thisTurn = turn;
      replaying++;
      speechToken++;
      speak(spokenFact(current), () => {
        replaying--;
        if (turn === thisTurn) resultDone?.();
      });
    } else if (fact) {
      const token = ++speechToken;
      const thisTurn = turn;
      speak(fact.spokenPrompt ?? fact.prompt, () => {
        if (token !== speechToken || turn !== thisTurn || phase !== 'ask') return;
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
  ctx.onUpdate((delta) => {
    layout();
    gameTime += delta;
    tapFlow.update(delta);
    const due = pending.filter((p) => p.at <= gameTime);
    if (due.length) {
      pending = pending.filter((p) => p.at > gameTime);
      due.forEach((p) => p.fn());
    }
    movement?.(gameTime);
    if (moveT < 1) moveT = Math.min(1, moveT + delta / Math.max(moveDur, 1e-3));

    updateAsk(delta);
    updatePlay(delta);
    updateActors(delta);
    updateBall(delta);

    for (const kid of kids) {
      let t = gameTime - kid.since;
      let moveNow = kid.move;
      if (moveNow !== 'sit' && t >= 1.2) {
        kid.move = 'sit';
        moveNow = 'sit';
      }
      if (t < 0) moveNow = 'sit';
      t = moveNow === 'sit' ? gameTime + kid.phase : t;
      kid.baller.play(moveNow, Math.max(t, 0), delta);
    }

    court.update(delta);
    effects.update(delta);
    applyCamera();

    // The shot clock sits just above the backboard (it only moves while it is showing).
    const p = point.set(CLOCK_SPOT.x, CLOCK_SPOT.y, CLOCK_SPOT.z).project(camera);
    hud.shotClock.place(((p.x + 1) / 2) * viewW, ((1 - p.y) / 2) * viewH, liveBand, [
      pad(hud.bugRect()),
    ]);
  });

  layout();
  refresh();
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
    court.dispose();
    ctx.dispose();
  });
}

const session = startGameSession(GAME_ID);
if (session) run(session);
else location.replace(menuUrl());
