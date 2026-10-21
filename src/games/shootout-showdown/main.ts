import '../../shared/hockey/hud.css';
import { pressAnswers } from '../../shared/answers';
import { preloadSpeech, sfx, speak, stopSpeaking, unlockAudio } from '../../shared/audio';
import { createFactFeed, type FactFeed } from '../../shared/feed';
import { createPointerInput } from '../../shared/input';
import { showPreview } from '../../shared/preview';
import { showResults } from '../../shared/results';
import { starsFor } from '../../shared/round';
import { createScene } from '../../shared/scene';
import { startGameSession, type GameSession } from '../../shared/session';
import { createTapFlow } from '../../shared/tapflow';
import { createTimers } from '../../shared/timers';
import { answerOptions, promptSpeech, type Fact } from '../../shared/topics';
import { createBackButton, createMuteButton, createPauseOverlay, menuUrl } from '../../shared/ui';
import { autoAnswer, devShootout, forcedBand, forcedFirst, freezeAt, hasDevShots } from './dev';
import { createEffects } from '../../shared/hockey/effects';
import { vec, type Vec } from '../../shared/hockey/geometry';
import { createHud } from '../../shared/hockey/hud';
import {
  cameraTarget,
  centreShift,
  fovFor,
  CAMERA_EASE,
  type PlayBand,
} from '../../shared/hockey/layout';
import {
  ACTORS,
  actorAt,
  bladePos,
  GOALIE_AHEAD,
  isGoalie,
  puckAt,
  puckSegAt,
  type ActorId,
  type Formation,
  type PlayEvent,
  type PlayScript,
} from '../../shared/hockey/script';
import { shootoutFormation, shootoutShot } from '../../shared/hockey/shootout';
import { createPuck } from '../../shared/hockey/puck';
import { buildRink } from '../../shared/hockey/rink';
import { bandFor } from '../../shared/hockey/band';
import {
  COIN_TOSS_BANNER,
  COIN_TOSS_SPEECH,
  FIRST_US_SPEECH,
  ROUNDS,
  SHOOTOUT_SPEECH,
  SHOT_CALL,
  SUDDEN_DEATH_BANNER,
  SUDDEN_DEATH_SPEECH,
  YOU_WIN_SPEECH,
  coinToss,
  dotsOf,
  firstBanner,
  firstThemSpeech,
  newShootout,
  nextShot,
  outcomeText,
  roundText,
  shooterBanner,
  shooterSpeech,
  shotBanner,
  step,
  type Role,
  type ShootoutPlay,
  type State,
  type StepResult,
} from './rules';
import { createGoalie, createSkater, type Skater } from '../../shared/hockey/skaters';
import {
  pickRival,
  rivalWinsSpeech,
  RIVALS,
  theirGoalSpeech,
  US,
  type Team,
} from '../../shared/hockey/teams';

const GAME_ID = 'shootout-showdown';

/** Seconds a result banner stays up, and a goal's. */
const BANNER_FOR = 1.2;
const GOAL_BANNER_FOR = 2;
/** The pause after a shot and its call before the next step. */
const NEXT_GAP = 0.2;
/** The two halves of the fade to the next shooter. */
const FADE_HALF = 0.15;
/** Seconds each announcement stays up at least, and the end of the shootout's. */
const ANNOUNCE_FOR = 1.2;
const FINAL_FOR = 2.2;
/** The lamp blinks for this long after our goal. */
const LAMP_FOR = 2;
/** A finished shootout always saves its stars; a quit one only with this many answers. */
const MIN_ANSWERS_FOR_STARS = 6;

type Phase = 'preview' | 'intro' | 'ask' | 'play' | 'announce' | 'done';

/** The shot that is running or has just run. */
interface Playing {
  script: PlayScript;
  kind: ShootoutPlay;
  result: StepResult;
  eventIndex: number;
  /** The play has run to its end. */
  ended: boolean;
}

function run(session: GameSession): void {
  const container = document.getElementById('game');
  if (!container) throw new Error('Missing #game container');

  // ---------- Scene ----------
  const ctx = createScene(container, { fov: 60, near: 0.3, far: 400 });
  const { scene, camera } = ctx;
  const rink = buildRink(scene);
  const effects = createEffects();
  scene.add(effects.object);
  const puck = createPuck();
  scene.add(puck.object);

  const skaters = {} as Record<ActorId, Skater>;
  const roleOf = (id: ActorId) => id[1] as Role | 'G';
  const dress = (id: ActorId, team: Team) => {
    skaters[id]?.root.removeFromParent();
    const role = roleOf(id);
    skaters[id] = role === 'G' ? createGoalie(team) : createSkater(team, role);
    scene.add(skaters[id].root);
  };
  for (const id of ACTORS) dress(id, id[0] === 'u' ? US : RIVALS[0]);

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
  const fade = document.createElement('div');
  fade.className = 'ss-fade';
  document.body.appendChild(fade);

  // ---------- State ----------
  let phase: Phase = 'preview';
  let feed: FactFeed = createFactFeed(() => session.chooseFacts());
  let state: State = newShootout('us');
  let rival: Team = RIVALS[0];
  let bestAtStart = session.highScore();
  /** What the scorebug shows; it lags the real state while a shot is still happening. */
  const shown = { us: 0, them: 0, round: 'R1', shots: 0 };
  let fact: Fact | undefined;
  let options: string[] = [];
  let chosen = -1;
  /** Ticks up for each question and announcement, so late callbacks can tell they are stale. */
  let turn = 0;
  let speechToken = 0;
  let speechDone = false;
  /** Seconds since the question finished being read. */
  let answerTime = 0;
  let clockTotal = 10;
  let lastTick = 0;
  let play: Playing | null = null;
  let playClock = 0;
  let callSpoken = false;
  let tapped = false;
  let nextQueued = false;
  let answeredRight = true;
  let autoUsed = false;
  let frozen = false;
  let formationNow: Formation = shootoutFormation('us', 'C');
  let idleClock = 0;
  let skipAnnounce: (() => void) | null = null;
  let announceToken = 0;
  let gameTime = 0;
  const timers = createTimers();
  const after = timers.after;
  const rnd = Math.random;

  // ---------- Layout and the camera ----------
  let viewW = 0;
  let viewH = 0;
  let liveBand: PlayBand = { top: 0, bottom: 0 };
  const camPos = vec(-6, 7.5, 0);
  const camLook = vec(5, 0, 0);
  let snapCamera = true;

  const layout = (force = false) => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!force && w === viewW && h === viewH) return;
    viewW = w;
    viewH = h;
    const measured = hud.measureBand();
    liveBand = { top: measured.top + 8, bottom: measured.bottom - 8 };
    camera.aspect = w / Math.max(h, 1);
  };

  const applyCamera = (focus: Vec, delta: number) => {
    const target = cameraTarget(focus);
    const k = snapCamera ? 1 : 1 - Math.exp(-CAMERA_EASE * delta);
    snapCamera = false;
    for (const key of ['x', 'y', 'z'] as const) {
      camPos[key] += (target.pos[key] - camPos[key]) * k;
      camLook[key] += (target.look[key] - camLook[key]) * k;
    }
    camera.fov = fovFor(viewW / Math.max(viewH, 1));
    camera.setViewOffset(viewW, viewH, 0, centreShift(viewH, liveBand), viewW, viewH);
    camera.updateProjectionMatrix();
    camera.position.set(camPos.x, camPos.y, camPos.z);
    camera.lookAt(camLook.x, camLook.y, camLook.z);
    camera.updateMatrixWorld();
    effects.setScale(
      (viewH * ctx.renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360)),
    );
  };

  /**
   * Where a banner goes: in the upper part of the band between the question and the answers, so
   * it stays off the net (when we score) and off the skaters near the camera.
   */
  const bandMiddle = () => liveBand.top + (liveBand.bottom - liveBand.top) * 0.3;

  // ---------- Saving and the scorebug ----------
  /**
   * Saves how the run stands: the goals as the high score, and the stars once there are enough
   * answers. Both are "best so far" records, so saving them again never takes anything away.
   */
  const saveProgress = () => {
    session.recordScore(state.us);
    if (feed.answered >= MIN_ANSWERS_FOR_STARS) {
      session.recordStars(starsFor(feed.correct, feed.answered));
    }
  };

  const refresh = () => {
    const all = dotsOf({ ...state, shots: state.shots.slice(0, shown.shots) });
    hud.renderBug({
      us: US,
      them: rival,
      usGoals: shown.us,
      themGoals: shown.them,
      period: 'SO',
      clock: shown.round,
      shots: all,
    });
  };

  /** The round on the scorebug: of the shot being taken, or of the last one when it is over. */
  const roundNow = () =>
    roundText(nextShot(state.over ? { ...state, shots: state.shots.slice(0, -1) } : state));

  const syncShown = () => {
    shown.us = state.us;
    shown.them = state.them;
    shown.round = roundNow();
    shown.shots = state.shots.length;
    refresh();
  };

  // ---------- Formations ----------
  const idleFormation = (): Formation => {
    const ns = nextShot(state);
    return shootoutFormation(ns.side, ns.role);
  };

  /** Everyone to the formation for the puck now, without any walking. */
  const setIdle = () => {
    formationNow = idleFormation();
    play = null;
    for (const id of ACTORS) skaters[id].snap();
    snapCamera = true;
  };

  /** A short fade out and in, with `swap` called at the darkest moment. */
  const cut = (swap: () => void, then: () => void) => {
    fade.classList.add('on');
    after(FADE_HALF, () => {
      swap();
      fade.classList.remove('on');
      after(FADE_HALF, then);
    });
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

  /** The question, the answers and the answer clock. The question is read; then the clock runs. */
  const ask = () => {
    if (state.over || phase === 'done') return;
    timers.clear();
    tapFlow.disarm();
    stopSpeaking();
    hud.hideBanner();
    hud.restoreQuestion();
    const thisTurn = ++turn;
    fact = feed.take();
    options = answerOptions(session.topic, fact, 4);
    chosen = -1;
    hud.setOptions(options);
    hud.setQuestion(fact.prompt);
    clockTotal = session.timerSecondsFor(fact);
    answerTime = 0;
    speechDone = false;
    play = null;
    phase = 'ask';
    formationNow = idleFormation();
    syncShown();
    hud.hideQuestion(false);
    hud.setClock({ left: clockTotal, total: clockTotal });
    lastTick = Math.ceil(clockTotal);
    readQuestion(thisTurn);
  };

  const updateAsk = (delta: number) => {
    if (phase !== 'ask') return;
    if (speechDone) answerTime += delta;
    const remaining = clockTotal - (speechDone ? answerTime : 0);
    const seconds = Math.max(Math.ceil(remaining), 0);
    if (seconds < lastTick && seconds > 0 && seconds <= 3) sfx.tick();
    lastTick = seconds;
    hud.setClock({ left: remaining, total: clockTotal });
    if (speechDone && remaining <= 0) {
      timeUp();
      return;
    }
    // Dev: answer the first question a little after its reading ends.
    const auto = autoAnswer();
    if (auto && !autoUsed && speechDone && answerTime >= 0.3 && fact) {
      autoUsed = true;
      const right = options.indexOf(fact.answer);
      const wrong = options.findIndex((o) => o !== fact?.answer);
      select(auto === 'right' ? right : wrong, 0.3);
    }
  };

  // ---------- Answering ----------
  /** The player picks an answer, while the question is read or the clock runs. */
  const select = (index: number, usedOverride?: number) => {
    if (phase !== 'ask' || !fact) return;
    if (options[index] === undefined) return;
    try {
      unlockAudio();
      stopSpeaking();
    } catch {
      // Audio trouble must never stop the play.
    }
    speechToken++;
    // A tap before the question has been read out counts as no time used at all.
    const used = usedOverride ?? (speechDone ? answerTime : 0);
    chosen = index;
    hud.lock();
    hud.buttons[index].classList.add('chosen');
    hud.setClock(null);
    answered(options[index] === fact.answer, used);
  };

  /** The answer clock runs out. */
  const timeUp = () => {
    if (phase !== 'ask' || !fact) return;
    chosen = -1;
    hud.lock();
    hud.setClock(null);
    sfx.alarm();
    answered(false, clockTotal);
  };

  const answered = (right: boolean, used: number) => {
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
    const next = nextShot(state);
    const result = step(state, right);
    state = result.state;
    saveProgress();
    hud.mark(chosen, options.indexOf(f.answer), right);

    // A right answer picks the style by its speed; a wrong one or a timeout is always solid.
    const band = forcedBand() ?? (right ? bandFor(used) : 'solid');
    const script = shootoutShot(result.play, next.role, band, rnd() < 0.5 ? -1 : 1);
    play = { script, kind: result.play, result, eventIndex: 0, ended: false };
    playClock = 0;
    phase = 'play';
    callSpoken = false;
    tapped = false;
    nextQueued = false;
    answeredRight = right;

    const kind = result.play;
    const title = shotBanner(kind, rival);
    // A goal's banner comes with the goal; a save's with the shot.
    if (!result.goal) {
      hud.showBanner(title, right ? 'good' : 'miss', bandMiddle());
      after(BANNER_FOR, () => hud.hideBanner());
    }
    const line = kind === 'so-goal-against' ? theirGoalSpeech(rival) : SHOT_CALL[kind];

    if (right) {
      // The question and answers get out of the way of the play.
      after(0.25, () => hud.hideQuestion(true));
      const token = ++speechToken;
      speak(line, () => {
        if (token !== speechToken || turn !== thisTurn) return;
        callSpoken = true;
        maybeNext();
      });
    } else {
      // The fact goes in the question panel; the play runs at once and the next question
      // waits for the green tap and the end of the play.
      hud.showCall(title, f.statement);
      tapFlow.reveal(hud.buttons, options, f, {
        avoid: hud.avoid,
        problem: f.prompt,
        lead: line,
      });
    }

    // Dev: freeze the first play at a script time.
    const at = freezeAt();
    if (at !== null && !frozen) {
      frozen = true;
      if (right) hud.hideQuestion(true);
      fastForward(Math.min(at, script.duration));
    }
  };

  // ---------- Shots ----------
  /** Dev: runs the play in small steps up to a script time, so everything is where it would be. */
  const fastForward = (to: number) => {
    const current = play;
    if (!current) return;
    const dt = 1 / 60;
    while (playClock < to - 1e-9) {
      playClock = Math.min(playClock + dt, to);
      while (
        current.eventIndex < current.script.events.length &&
        current.script.events[current.eventIndex].t <= playClock
      ) {
        onPlayEvent(current.script.events[current.eventIndex++], true);
      }
      updateActors(dt);
    }
  };

  const onPlayEvent = (e: PlayEvent, quiet: boolean) => {
    const current = play;
    if (!current) return;
    const script = current.script;
    switch (e.type) {
      case 'shot':
        if (!quiet) sfx.slap();
        break;
      case 'save':
        shown.shots = state.shots.length;
        refresh();
        if (!quiet) {
          sfx.glove();
          if (e.who === 'uG') sfx.cheer();
        }
        break;
      case 'goal': {
        const side = script.goal;
        if (!side) break;
        shown[side]++;
        shown.shots = state.shots.length;
        refresh();
        hud.flashGoals(side);
        hud.showBanner(
          shotBanner(current.kind, rival),
          side === 'us' ? 'good' : 'miss',
          bandMiddle(),
        );
        after(GOAL_BANNER_FOR, () => hud.hideBanner());
        effects.sparkle(puckAt(script, e.t));
        if (side === 'us') {
          if (!quiet) {
            sfx.horn();
            sfx.bigCheer();
          }
          rink.setLamp('us', true);
          after(LAMP_FOR, () => rink.setLamp('us', false));
        } else if (!quiet) {
          sfx.aww();
          rink.setLamp('them', false);
        }
        break;
      }
      default:
        break;
    }
  };

  const updatePlay = (delta: number) => {
    const current = play;
    if (!current || phase !== 'play' || current.ended) return;
    playClock += delta;
    const { script } = current;
    while (
      current.eventIndex < script.events.length &&
      script.events[current.eventIndex].t <= playClock
    ) {
      onPlayEvent(script.events[current.eventIndex++], false);
    }
    // Ice spray where a skater stops hard or is checked into: handled by the check events above.
    if (playClock >= script.duration) {
      current.ended = true;
      maybeNext();
    }
  };

  /** The next question comes once the play has ended and the call has been said (or tapped). */
  const maybeNext = () => {
    const current = play;
    if (!current || !current.ended || nextQueued || phase !== 'play') return;
    if (answeredRight ? !callSpoken : !tapped) return;
    nextQueued = true;
    after(NEXT_GAP, afterPlay);
  };

  /** The play and its call are done: the next question, or a period break, or the end. */
  const afterPlay = () => {
    const current = play;
    if (!current) return;
    tapFlow.disarm();
    stopSpeaking();
    hud.hideBanner();
    hud.restoreQuestion();
    // Every shot goes back to the formation of the next shooter.
    cut(
      () => {
        formationNow = idleFormation();
        play = null;
        for (const id of ACTORS) skaters[id].snap();
        snapCamera = true;
        syncShown();
      },
      () => {
        rink.setLamp('us', false);
        if (state.over) finishGame();
        else beforeShot();
      },
    );
  };

  // ---------- Announcements and the end ----------
  /**
   * Puts a banner up and says some lines, then calls `then`: once the lines are said and the
   * banner has been up for `hold` seconds, or when a tap skips it.
   */
  const announce = (
    title: string,
    lines: string[],
    then: () => void,
    hold = ANNOUNCE_FOR,
    detail?: string,
  ) => {
    phase = 'announce';
    tapFlow.disarm();
    const token = ++announceToken;
    const startedAt = gameTime;
    stopSpeaking();
    hud.hideQuestion(true);
    hud.setClock(null);
    hud.showBanner(title, 'info', bandMiddle(), detail);
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
      if (gameTime - startedAt >= 0.6) go();
    };
  };

  /** The shooter's banner and name, then the question (after "Sudden death!" for round 4). */
  const beforeShot = () => {
    if (autoAnswer() && !autoUsed) {
      ask();
      return;
    }
    const ns = nextShot(state);
    formationNow = idleFormation();
    const team = ns.side === 'us' ? US : rival;
    const banner = shooterBanner(team, ns);
    const shooter = () =>
      announce(banner.title, [shooterSpeech(team, ns.role)], ask, ANNOUNCE_FOR, banner.detail);
    if (state.shots.length === 2 * ROUNDS) {
      announce(SUDDEN_DEATH_BANNER, [SUDDEN_DEATH_SPEECH], shooter);
    } else {
      shooter();
    }
  };

  /** The game is won or lost: the banner and the line, then the results. */
  const finishGame = () => {
    timers.clear();
    turn++;
    tapFlow.disarm();
    syncShown();
    const won = state.winner === 'us';
    phase = 'announce';
    hud.hideQuestion(true);
    hud.setClock(null);
    sfx.alarm();
    after(0.9, () => (won ? sfx.bigCheer() : sfx.aww()));
    hud.showBanner(won ? 'YOU WIN!' : `${rival.abbr} WIN`, won ? 'good' : 'miss', bandMiddle());
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
      playAgainLabel: 'Play again 🏒',
      onPlayAgain: () => startRun(false),
    });
  };

  // ---------- Run flow ----------
  const startRun = (withPreview: boolean) => {
    timers.clear();
    turn++;
    announceToken++;
    skipAnnounce = null;
    speechToken++;
    tapFlow.disarm();
    stopSpeaking();
    feed = createFactFeed(() => session.chooseFacts());
    rival = pickRival(rnd());
    state = devShootout(forcedFirst() ?? coinToss(rnd()));
    for (const id of ACTORS) if (id[0] === 't') dress(id, rival);
    bestAtStart = session.highScore();
    fact = undefined;
    options = [];
    rink.setLamp('us', false);
    rink.setLamp('them', false);
    setIdle();
    syncShown();
    hud.hideQuestion(true);
    hud.setClock(null);
    hud.hideBanner();
    // The calls and names are read straight away, so load them now.
    preloadSpeech([
      ...Object.values(SHOT_CALL),
      SHOOTOUT_SPEECH,
      COIN_TOSS_SPEECH,
      FIRST_US_SPEECH,
      SUDDEN_DEATH_SPEECH,
      firstThemSpeech(rival),
      theirGoalSpeech(rival),
      rivalWinsSpeech(rival),
      YOU_WIN_SPEECH,
      ...(['C', 'W', 'D'] as const).flatMap((role) => [
        shooterSpeech(US, role),
        shooterSpeech(rival, role),
      ]),
    ]);
    if (!withPreview) {
      startIntro();
      return;
    }
    phase = 'preview';
    showPreview({ topic: session.topic, facts: feed.peek(10), onDone: startIntro });
  };

  /** "Shootout!", the coin toss and who shoots first, then the first shooter. */
  const startIntro = () => {
    autoUsed = false;
    if (autoAnswer()) {
      ask();
      return;
    }
    if (hasDevShots()) {
      beforeShot();
      return;
    }
    announce('SHOOTOUT', [SHOOTOUT_SPEECH], () => {
      announce(COIN_TOSS_BANNER, [COIN_TOSS_SPEECH], () =>
        announce(
          firstBanner(state.first, rival),
          [state.first === 'us' ? FIRST_US_SPEECH : firstThemSpeech(rival)],
          beforeShot,
        ),
      );
      sfx.whoosh();
    });
  };

  // ---------- Input ----------
  /** The player tapped the green answer after a miss: the next question once the play is over. */
  const onTapped = () => {
    speechToken++;
    tapped = true;
    maybeNext();
  };
  const onAnswer = (index: number) => {
    if (tapFlow.armed) {
      // After a miss only the green answer moves on; any other answer is ignored.
      if (tapFlow.tap(index)) onTapped();
      return;
    }
    if (phase === 'ask') select(index);
  };
  const unpress = pressAnswers(hud.buttons, onAnswer);
  hud.hear.addEventListener('click', () => {
    unlockAudio();
    if (!fact) return;
    if (phase === 'ask') {
      const token = ++speechToken;
      const thisTurn = turn;
      speak(promptSpeech(fact), () => {
        if (token !== speechToken || turn !== thisTurn || phase !== 'ask') return;
        speechDone = true;
      });
    }
  });
  const stopPointer = createPointerInput(ctx.renderer.domElement, {
    onDragStart: () => unlockAudio(),
    onTap: () => skipAnnounce?.(),
  });
  // Keys 1-4 pick the answers from left to right.
  const onKey = (e: KeyboardEvent) => {
    if (pause.isPaused) return;
    const index = Number(e.key) - 1;
    if (index >= 0 && index < hud.buttons.length) onAnswer(index);
  };
  window.addEventListener('keydown', onKey);

  // ---------- Drawing ----------
  const focus = vec();
  const updateActors = (delta: number) => {
    const current = play;
    if (current && (phase === 'play' || phase === 'announce' || current.ended)) {
      const script = current.script;
      const seg = puckSegAt(script, playClock);
      for (const id of ACTORS) {
        const a = actorAt(script.actors[id], playClock);
        skaters[id].place(a.pos, a.face, delta);
        skaters[id].update(a.move, a.moveT, delta, seg.kind === 'held' && seg.who === id);
      }
      puck.setVisible(true);
      puckAt(script, playClock, focus);
      puck.place(focus);
      if (seg.kind !== 'held' && seg.kind !== 'still') puck.spin(delta, 25);
      return;
    }
    idleClock += delta;
    for (const id of ACTORS) {
      const spot = formationNow.spots[id];
      const carrying = formationNow.carrier === id;
      skaters[id].place(spot.pos, spot.face, delta);
      skaters[id].update(
        isGoalie(id) ? 'ready' : carrying ? 'carry' : 'glide',
        idleClock,
        delta,
        carrying,
      );
    }
    puck.setVisible(phase !== 'preview');
    const carrier = formationNow.carrier;
    if (carrier) {
      const spot = formationNow.spots[carrier];
      bladePos(
        spot.pos,
        spot.face,
        'carry',
        idleClock,
        isGoalie(carrier) ? GOALIE_AHEAD : undefined,
        focus,
      );
    } else {
      focus.x = formationNow.puck.x;
      focus.y = formationNow.puck.y;
      focus.z = formationNow.puck.z;
    }
    puck.place(focus);
  };

  ctx.onUpdate((delta) => {
    layout();
    if (!frozen) {
      gameTime += delta;
      tapFlow.update(delta);
      timers.update(delta);
      updateAsk(delta);
      updatePlay(delta);
    }
    updateActors(frozen ? 0 : delta);
    if (frozen) snapCamera = true;
    rink.update(delta, camPos.x);
    effects.update(delta);
    applyCamera(focus, delta);
  });

  layout();
  refresh();
  ctx.start();
  startRun(true);

  window.addEventListener('pagehide', () => {
    saveProgress();
    stopSpeaking();
    window.removeEventListener('keydown', onKey);
    stopPointer();
    tapFlow.dispose();
    unpress();
    pause.dispose();
    mute.dispose();
    effects.clear();
    rink.dispose();
    fade.remove();
    ctx.dispose();
  });
}

const session = startGameSession(GAME_ID);
if (session) run(session);
else location.replace(menuUrl());
