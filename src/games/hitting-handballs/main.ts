import './style.css';
import { MathUtils, Vector3 } from 'three';
import { fillAnswers, lockAnswers, markAnswers, pressAnswers } from '../../shared/answers';
import { sfx, speak, stopSpeaking, unlockAudio } from '../../shared/audio';
import { createFactFeed, type FactFeed } from '../../shared/feed';
import { showPreview } from '../../shared/preview';
import { showResults } from '../../shared/results';
import { createScene } from '../../shared/scene';
import { startGameSession, type GameSession } from '../../shared/session';
import { createTapFlow } from '../../shared/tapflow';
import { createTimers } from '../../shared/timers';
import { answerOptions, promptSpeech, type Fact } from '../../shared/topics';
import { createBackButton, createMuteButton, createPauseOverlay, menuUrl } from '../../shared/ui';
import { hideFactMap, showFactMap } from '../../shared/maps';
import { createBall } from './ball';
import { buildCourt } from './court';
import {
  autoAnswer,
  devPair,
  devRung,
  devScore,
  devServe,
  devRun,
  devStreak,
  forcedWhiff,
  freezeAt,
  skipVs,
} from './dev';
import { createShake, createWords } from './effects';
import { createScoreboard } from './hud';
import { createKid, HOME, PAIR_LOOKS, US_LOOKS, type Kid } from './kids';
import { CAM_FOV, CAM_Y, fitCamera, LOOK_X, LOOK_Y, playBand, type PlayBand } from './layout';
import {
  bonk,
  BONK_TOTAL,
  dive,
  DIVE_TOTAL,
  smash,
  SMASH_CONTACT,
  SMASH_TOTAL,
  swing,
  SWING_CONTACT,
  SWING_TOTAL,
  whiffSpin,
  WHIFF_TOTAL,
} from './moves';
import {
  CHAMPION_RUNG,
  CHAMPION_SPEECH,
  COOKING_BANNER,
  COOKING_SPEECH,
  coinToss,
  isCooking,
  isMatchPoint,
  matchStars,
  MATCH_POINT_SPEECH,
  newMatch,
  nextRun,
  nextRung,
  outcomeText,
  PAIRS,
  pairFor,
  pickTarget,
  PLAY_BALL_SPEECH,
  rungLabel,
  scoreCall,
  SO_CLOSE_SPEECH,
  step,
  TEAMMATE_NAME,
  WE_WIN_SPEECH,
  WORDS,
  type HitResult,
  type Match,
  type Side,
} from './rules';
import {
  ballAt,
  BALL_R,
  bonkShot,
  contacts,
  contactSpot,
  holdTime,
  pastShot,
  planShot,
  ROLL_OFF,
  SERVE_WINDUP,
  serveBounce,
  timeAtX,
  WALL_Y_RANGE,
  WINNER_WALL_Y,
  type Shot,
  type Vec,
} from './shots';
import { showVs } from './vs';

const GAME_ID = 'hitting-handballs';

/** Longest "Play ball!" banner, in seconds. */
const PLAY_BALL_FOR = 1.5;
/** Seconds the "WE SERVE" banner shows. */
const SERVE_BANNER_FOR = 1;
/** Seconds the "TOO SLOW!" banner shows. */
const TOO_SLOW_FOR = 1;
/** Seconds from the last line of a win until the results. */
const WIN_RESULTS_AFTER = 1.5;
/** Seconds from the end of a loss until the results. */
const LOSS_RESULTS_AFTER = 2.5;
/** Seconds between the call and the next serve. */
const POINT_GAP = 0.6;
/** The longest a spoken line is waited for before play moves on. */
const SPEECH_CAP = 3.5;
/** Share of whiffs that are a head bonk instead of a spin. */
const BONK_SHARE = 0.25;

type Phase =
  'vs' | 'preview' | 'playball' | 'rally' | 'asking' | 'hit' | 'tap' | 'point' | 'ending' | 'done';

/** The ball in the air: a position over time, with sounds and swings pinned to moments. */
interface Flight {
  pos: (t: number) => Vec;
  duration: number;
  t: number;
  /** Stop here and wait (the ball is held next to our kid). */
  holdAt: number | null;
  held: boolean;
  onHold?: () => void;
  events: { at: number; fn: () => void; fired: boolean }[];
  onEnd?: () => void;
}

/** The shot that has come to our kid and waits for the answer. */
interface Incoming {
  kid: Kid;
  flight: Flight;
  /** Where our kid hits it. */
  to: Vec;
}

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
  const auto = autoAnswer();

  // ---------- Scene ----------
  const ctx = createScene(container, { fov: CAM_FOV, near: 0.5, far: 100 });
  const { scene, camera } = ctx;
  ctx.renderer.setClearColor(0x9fdcff);
  const court = buildCourt();
  const ball = createBall();
  const shake = createShake();
  scene.add(court.object, ball.object);
  ball.setVisible(false);

  // ---------- HUD ----------
  const scoreboard = createScoreboard();
  const hud = el('div', 'hb-hud', document.body);
  const problem = el('div', 'hb-problem', hud);
  problem.setAttribute('aria-live', 'polite');
  const problemText = el('span', 'hb-problem-text', problem);
  const hear = el('button', 'hb-hear', problem);
  hear.type = 'button';
  hear.textContent = '🔊';
  hear.setAttribute('aria-label', 'Hear the question');
  const clockBar = el('div', 'hb-clock', hud);
  const clockFill = el('div', 'hb-clock-fill', clockBar);
  el('div', 'hb-clock-label', clockBar).textContent = WORDS.smash;
  const answers = el('div', 'hb-answers', document.body);
  const buttons = Array.from({ length: 4 }, () => {
    const button = el('button', 'hb-answer', answers);
    button.type = 'button';
    return button;
  });
  const banner = el('div', 'hb-banner', document.body);
  banner.setAttribute('role', 'status');
  banner.hidden = true;
  const words = createWords();
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
  let phase: Phase = 'vs';
  let feed: FactFeed = createFactFeed(() => session.chooseFacts());
  let fact: Fact | undefined;
  let options: string[] = [];
  let match: Match = newMatch(0, 'us');
  /** Points in a row we have won. */
  let usRun = 0;
  /** The ladder place this match began at. */
  let rung = 0;
  let lastPair: number | undefined;
  let usKids: Kid[] = [];
  let themKids: Kid[] = [];
  /** Which kid of each team the ball has gone to lately. */
  const targets: Record<Side, (0 | 1)[]> = { us: [], them: [] };
  let flight: Flight | null = null;
  let holdClock = 0;
  let incoming: Incoming | null = null;
  /** Ticks up for each question, point and match, so late callbacks can tell they are stale. */
  let turn = 0;
  let clockRunning = false;
  let clockTotal = 1;
  let clockLeft = 1;
  let lastTick = 0;
  let autoUsed = false;
  /** Dev: seconds left until the scene is frozen (after the first answer), and the freeze itself. */
  let freezeLeft: number | null = null;
  let freezeUsed = false;
  let frozen = false;
  let vs: { dispose(): void } | null = null;
  let preview: { dispose(): void } | null = null;

  // Delayed actions run on game time so pausing freezes them too.
  const timers = createTimers();
  const after = timers.after;

  // ---------- Camera ----------
  let viewW = 0;
  let viewH = 0;
  let camDistance = 0;
  let camShift = 0;
  let wantDistance = 0;
  let wantShift = 0;
  let refit = true;
  /** The band measured while the question was last shown, so the camera stays put between them. */
  let bandCache: PlayBand | null = null;

  /** The clear space between the scoreboard and question and the answers, as the HUD lays out. */
  const measureBand = (): PlayBand => {
    const base = playBand(viewW, viewH);
    if (!hud.hidden && !answers.hidden && !scoreboard.root.hidden) {
      const top = hud.getBoundingClientRect().bottom + 8;
      const bottom = answers.getBoundingClientRect().top - 8;
      if (bottom - top > 60) bandCache = { top, bottom };
    }
    return bandCache ?? base;
  };

  const layout = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w !== viewW || h !== viewH) {
      viewW = w;
      viewH = h;
      bandCache = null;
      refit = true;
    }
    if (!refit) return;
    refit = false;
    const fit = fitCamera(w, h, measureBand(), CAM_FOV);
    const first = camDistance === 0;
    wantDistance = fit.distance;
    wantShift = fit.shift;
    if (first) {
      camDistance = wantDistance;
      camShift = wantShift;
    }
    camera.aspect = w / Math.max(h, 1);
    camera.fov = CAM_FOV;
  };

  const point = new Vector3();
  /** The screen spot of a world point, kept inside the clear band. */
  const toScreen = (world: Vec) => {
    const band = measureBand();
    const p = point.set(world.x, world.y, world.z).project(camera);
    return {
      x: MathUtils.clamp(((p.x + 1) / 2) * viewW, 70, viewW - 70),
      y: MathUtils.clamp(((1 - p.y) / 2) * viewH, band.top + 24, band.bottom - 24),
    };
  };

  // ---------- HUD helpers ----------
  /** The scoreboard shows during a match; the question and answers only while one is up. */
  const showHud = (boardOn: boolean, questionOn: boolean) => {
    scoreboard.setVisible(boardOn);
    hud.hidden = !questionOn;
    answers.hidden = !questionOn;
    buttons.forEach((b, i) => (b.hidden = options[i] === undefined));
    refit = true;
  };

  /** `top` puts the banner under the scoreboard instead of the middle. */
  const showBanner = (text: string, bad = false, top = false) => {
    banner.textContent = text;
    banner.className = bad ? 'hb-banner bad' : 'hb-banner';
    banner.hidden = false;
    const band = measureBand();
    const half = banner.offsetHeight / 2;
    const middle = (band.top + band.bottom) / 2;
    banner.style.top = `${top ? band.top + half + 4 : Math.min(Math.max(middle, band.top + half), band.bottom - half)}px`;
  };

  const setClock = (fraction: number) => {
    const f = MathUtils.clamp(fraction, 0, 1);
    clockFill.style.transform = `scaleX(${f})`;
    clockBar.classList.toggle('urgent', f < 0.4);
  };

  /** A comic word at a world spot. A frozen dev shot keeps it. */
  const popWord = (text: string, at: Vec) => {
    words.pop(text, toScreen(at), freezeAt() !== null);
  };

  /** Says a line, then moves on; it also moves on after `cap` seconds if the voice never ends. */
  const sayThen = (text: string, next: () => void, cap = SPEECH_CAP) => {
    const thisTurn = turn;
    let done = false;
    const go = () => {
      if (done || turn !== thisTurn) return;
      done = true;
      next();
    };
    speak(text, go);
    after(cap, go);
  };

  // ---------- The ball in flight ----------
  const newFlight = (duration: number, pos: (t: number) => Vec): Flight => ({
    pos,
    duration,
    t: 0,
    holdAt: null,
    held: false,
    events: [],
  });

  /** How fast the ball is moving at the flight's current time (looking just behind it). */
  const velocityOf = (f: Flight): Vec => {
    const t = Math.min(f.t, f.duration);
    const dt = 0.02;
    const a = f.pos(Math.max(t - dt, 0));
    const b = f.pos(t);
    const span = Math.max(t - Math.max(t - dt, 0), 1e-6);
    return { x: (b.x - a.x) / span, y: (b.y - a.y) / span, z: (b.z - a.z) / span };
  };

  const pin = (f: Flight, at: number, fn: () => void) => {
    f.events.push({ at, fn, fired: false });
  };

  const fly = (f: Flight) => {
    flight = f;
    ball.setVisible(true);
    ball.setSpin(7);
    ball.setPosition(f.pos(0));
  };

  const stepFlight = (dt: number) => {
    const f = flight;
    if (!f) return;
    if (!f.held) {
      f.t += dt;
      if (f.holdAt !== null && f.t >= f.holdAt) {
        f.t = f.holdAt;
        f.held = true;
        ball.setSpin(16);
      }
    }
    const at = f.pos(Math.min(f.t, f.duration));
    if (f.held) {
      holdClock += dt;
      at.y += Math.sin(holdClock * 6) * 0.015;
    }
    ball.setPosition(at);
    for (const e of f.events) {
      if (!e.fired && f.t >= e.at) {
        e.fired = true;
        e.fn();
        if (flight !== f) return;
      }
    }
    if (f.held && f.onHold) {
      const hold = f.onHold;
      f.onHold = undefined;
      hold();
      return;
    }
    if (!f.held && f.t >= f.duration) {
      flight = null;
      f.onEnd?.();
    }
  };

  /** A missed ball runs on off the right side, then is gone. */
  const rollOff = (from: Vec, onGone: () => void) => {
    const f = newFlight(ROLL_OFF, (t) => ({ x: from.x + t * 3, y: BALL_R, z: from.z }));
    f.onEnd = () => {
      ball.setVisible(false);
      onGone();
    };
    fly(f);
    ball.setSpin(12);
  };

  const randomWallY = () => WALL_Y_RANGE[0] + Math.random() * (WALL_Y_RANGE[1] - WALL_Y_RANGE[0]);

  const nextTarget = (side: Side): 0 | 1 => {
    const kid = pickTarget(Math.random(), targets[side]);
    targets[side].push(kid);
    if (targets[side].length > 4) targets[side].shift();
    return kid;
  };

  // ---------- Sending the ball ----------
  interface Send {
    from: Vec;
    receiver: Kid;
    kind?: 'normal' | 'smash';
    wallY?: number;
    /** The receiver (a rival) misses: dives, and the ball runs past. `late` dives after the ball. */
    miss?: { late: boolean; onGone: () => void };
    /** A serve: the ball is bounced once first, and this kid swings. */
    server?: Kid;
  }

  /** The ball flies from `from` to `receiver`: wall, bounce, kid. A rival returns it; our kid holds it. */
  const send = (o: Send) => {
    const rival = themKids.includes(o.receiver);
    const spot = contactSpot(o.receiver.home.x, Math.random());
    const to = o.receiver.contactPoint(spot);
    const shot: Shot = planShot(
      o.kind ?? 'normal',
      o.from,
      to,
      o.wallY ?? randomWallY(),
      o.miss !== undefined,
    );
    o.receiver.walkTo(spot);
    const lead = o.server ? SERVE_WINDUP : 0;
    const f = newFlight(lead + shot.duration, (t) => {
      if (t >= lead) return ballAt(shot, t - lead);
      // The serve: the ball is bounced off the court and comes back up to the hand.
      return serveBounce(o.from, t, lead);
    });
    const server = o.server;
    if (server) {
      pin(f, Math.max(lead - SWING_CONTACT, 0), () => server.play(swing, SWING_TOTAL));
      pin(f, lead / 2, () => sfx.bump());
      pin(f, lead, () => sfx.slap(0.8));
    }
    // The sounds of the first few contacts; the little hops of a ball running off are quiet.
    for (const c of contacts(shot).slice(0, 4)) {
      pin(f, lead + c.t, () => (c.what === 'wall' ? sfx.thud() : sfx.bump()));
    }

    if (!rival) {
      f.holdAt = lead + holdTime(shot);
      f.onHold = () => ask({ kid: o.receiver, flight: f, to });
    } else if (o.miss) {
      const miss = o.miss;
      const crossing = timeAtX(shot, spot - 0.2) ?? shot.duration;
      pin(f, lead + Math.max(crossing - (miss.late ? 0 : 0.2), 0), () =>
        o.receiver.play(dive, DIVE_TOTAL),
      );
      f.onEnd = () => rollOff(ballAt(shot, shot.duration), miss.onGone);
    } else {
      pin(f, f.duration - SWING_CONTACT, () => o.receiver.play(swing, SWING_TOTAL));
      f.onEnd = () => {
        sfx.slap(0.8);
        send({ from: to, receiver: usKids[nextTarget('us')] });
      };
    }
    fly(f);
    return f;
  };

  // ---------- Match flow ----------
  const dressKids = (pairIndex: number, crowned: boolean) => {
    [...usKids, ...themKids].forEach((k) => k.dispose());
    const looks = PAIR_LOOKS[PAIRS[pairIndex].id];
    usKids = US_LOOKS.map((look, i) => createKid(HOME.us[i], look));
    themKids = looks.map((look, i) => createKid(HOME.them[i], look));
    for (const k of [...usKids, ...themKids]) scene.add(k.object);
    if (crowned) usKids.forEach((k) => k.setCrowned(true));
  };

  const startMatch = () => {
    tapFlow.disarm();
    timers.clear();
    turn++;
    stopSpeaking();
    words.clear();
    shake.clear();
    vs?.dispose();
    preview?.dispose();
    vs = preview = null;
    flight = null;
    incoming = null;
    frozen = false;
    freezeUsed = false;
    freezeLeft = null;
    autoUsed = false;
    clockRunning = false;
    banner.hidden = true;
    fact = undefined;
    options = [];
    targets.us.length = targets.them.length = 0;
    ball.setVisible(false);

    rung = devRung() ?? session.ladderRung();
    const index = devPair() ?? pairFor(rung, Math.random(), lastPair);
    const pair = PAIRS[index];
    match = newMatch(index, devServe() ?? coinToss(Math.random()));
    usRun = devRun() ?? 0;
    const score = devScore();
    if (score) match = { ...match, us: score.us, them: score.them };
    const streak = auto === 'winner' ? pair.streakToWin - 1 : devStreak(pair.streakToWin);
    if (streak) match = { ...match, streak };
    feed = createFactFeed(() => session.chooseFacts());

    dressKids(index, rung === CHAMPION_RUNG);
    scoreboard.setup({
      ourName: `YOU & ${TEAMMATE_NAME.toUpperCase()}`,
      pairName: pair.name,
      rungText: rungLabel(rung, index),
      streakToWin: pair.streakToWin,
      us: match.us,
      them: match.them,
      server: match.server,
    });
    scoreboard.setPips(match.streak);
    showHud(false, false);

    const toPreview = () => {
      phase = 'preview';
      showHud(false, false);
      preview = showPreview({
        topic: session.topic,
        facts: feed.peek(10),
        onDone: playBall,
      });
    };
    if (auto) {
      showHud(true, false);
      startPoint();
      return;
    }
    if (skipVs()) {
      toPreview();
      return;
    }
    phase = 'vs';
    speak(pair.intro);
    vs = showVs({
      rung,
      pair: index,
      onPlay: () => {
        unlockAudio();
        toPreview();
      },
    });
  };

  /** "Play ball!", who serves, then the first point. */
  const playBall = () => {
    const thisTurn = ++turn;
    phase = 'playball';
    showHud(true, false);
    showBanner('PLAY BALL!');
    let moved = false;
    const go = () => {
      if (moved || turn !== thisTurn || phase !== 'playball') return;
      moved = true;
      showBanner(match.server === 'us' ? 'WE SERVE' : 'THEY SERVE');
      after(SERVE_BANNER_FOR, () => {
        if (turn !== thisTurn) return;
        banner.hidden = true;
        startPoint();
      });
    };
    speak(PLAY_BALL_SPEECH, go);
    after(PLAY_BALL_FOR, go);
  };

  /** Everybody to their spots, then the server serves. */
  const startPoint = () => {
    turn++;
    phase = 'rally';
    incoming = null;
    banner.hidden = true;
    tapFlow.disarm();
    for (const k of [...usKids, ...themKids]) {
      k.placeAt(k.home.x);
      k.setMode('ready');
    }
    scoreboard.setServer(match.server);
    showHud(true, false);
    const serving = match.server === 'us';
    const server = (serving ? usKids : themKids)[Math.random() < 0.5 ? 0 : 1];
    const from = server.contactPoint(server.x);
    if (serving) {
      send({ from, receiver: themKids[nextTarget('them')], server });
    } else {
      send({ from, receiver: usKids[nextTarget('us')], server });
    }
  };

  /** The shot has come to our kid: the ball hangs in the air and the question appears. */
  const ask = (shotIn: Incoming) => {
    incoming = shotIn;
    tapFlow.disarm();
    stopSpeaking();
    banner.hidden = true;
    const next = feed.take();
    fact = next;
    const thisTurn = ++turn;
    options = answerOptions(session.topic, next, buttons.length);
    fillAnswers(buttons, options, 'hb-answer');
    problemText.textContent = next.prompt;
    showFactMap(next);
    phase = 'asking';
    clockRunning = false;
    setClock(1);
    showHud(true, true);
    speak(promptSpeech(next), () => {
      if (turn !== thisTurn || phase !== 'asking') return;
      clockTotal = session.timerSecondsFor(next);
      clockLeft = clockTotal;
      lastTick = Math.ceil(clockLeft);
      clockRunning = true;
    });
  };

  const onAnswer = (index: number, forcedSeconds?: number) => {
    // After a miss only the green answer moves on; any other answer is ignored.
    if (tapFlow.armed) {
      if (tapFlow.tap(index)) afterGreenTap();
      return;
    }
    if (phase !== 'asking' || !fact || options[index] === undefined) return;
    try {
      unlockAudio();
      stopSpeaking();
    } catch {
      // Audio trouble must never stop the answer.
    }
    const seconds = forcedSeconds ?? (clockRunning ? clockTotal - clockLeft : 0);
    judge(index, options[index] === fact.answer, seconds);
  };

  /** Plays out one answer: the kid hits (or misses) and the ball goes on. */
  const judge = (index: number, right: boolean, seconds: number) => {
    const current = fact;
    const shotIn = incoming;
    if (!current || !shotIn) return;
    phase = 'hit';
    clockRunning = false;
    lockAnswers(buttons);
    if (right) markAnswers(buttons, index, index, true);
    else if (index >= 0) buttons[index].classList.add('wrong');
    if (right) feed.recordHit(current);
    else feed.recordMiss(current);
    hideFactMap();
    session.recordAnswer(current, right);
    const out = step(match, right, seconds);
    match = out.match;
    usRun = nextRun(usRun, out.point);
    const freeze = freezeAt();
    if (freeze !== null && !freezeUsed) {
      freezeUsed = true;
      freezeLeft = freeze;
    }
    const thisTurn = ++turn;
    const { kid, flight: f, to } = shotIn;
    incoming = null;

    if (out.result === 'whiff') {
      whiff(kid, f, index, current);
      return;
    }
    scoreboard.setPips(match.streak);
    const strong = out.result === 'smash';
    const contact = strong ? SMASH_CONTACT : SWING_CONTACT;
    // The ball goes on to our kid's hand; the swing is timed to meet it.
    f.held = false;
    f.holdAt = null;
    pin(f, Math.max(f.t, f.duration - contact), () =>
      strong ? kid.play(smash, SMASH_TOTAL) : kid.play(swing, SWING_TOTAL),
    );
    f.onEnd = () => {
      if (turn !== thisTurn) return;
      hitBack(out.result, to);
    };
  };

  /** Our kid's hand meets the ball. */
  const hitBack = (result: HitResult, from: Vec) => {
    const rival = themKids[nextTarget('them')];
    if (result === 'return') {
      sfx.slap(0.8);
      phase = 'rally';
      send({ from, receiver: rival });
      return;
    }
    const strong = result === 'smash';
    sfx.slap(strong ? 1 : 0.8);
    if (strong) shake.start(0.15, 0.04);
    popWord(strong ? WORDS.smash : WORDS.winner, { x: from.x, y: from.y + 0.4, z: from.z });
    const thisTurn = turn;
    send({
      from,
      receiver: rival,
      kind: strong ? 'smash' : 'normal',
      wallY: strong ? undefined : WINNER_WALL_Y,
      miss: {
        late: !strong,
        onGone: () => {
          if (turn === thisTurn) pointScored();
        },
      },
    });
  };

  /** A wrong answer or a time-out: the ball gets past (or bonks the head) and the green answer waits. */
  const whiff = (kid: Kid, f: Flight, index: number, current: Fact) => {
    const thisTurn = turn;
    const held = f.pos(Math.min(f.t, f.duration));
    const bonked = (forcedWhiff() ?? (Math.random() < BONK_SHARE ? 'bonk' : 'spin')) === 'bonk';
    let pending = 2;
    const part = () => {
      if (turn !== thisTurn || --pending > 0) return;
      phase = 'tap';
      showHud(true, true);
      buttons[options.indexOf(current.answer)]?.classList.add('right');
      tapFlow.reveal(buttons, options, current, {
        chosen: index >= 0 ? options[index] : undefined,
        avoid: [scoreboard.root, hud],
        problem: current.prompt,
      });
    };
    const head = kid.bodyPoint(0.93);
    if (bonked) {
      const shot = bonkShot(held, { x: kid.x - 0.05, y: head.y, z: head.z }, kid.x - 0.35);
      const g = newFlight(shot.duration, (t) => ballAt(shot, t));
      pin(g, shot.segments[0].duration, () => {
        sfx.boing();
        sfx.aww();
        court.kids.slump(1.5);
        popWord(WORDS.bonk, { x: kid.x, y: head.y + 0.25, z: head.z });
        kid.play(bonk, BONK_TOTAL, part);
      });
      g.onEnd = () => {
        ball.setVisible(false);
        part();
      };
      fly(g);
    } else {
      const shot = pastShot(held, velocityOf(f));
      const g = newFlight(shot.duration, (t) => ballAt(shot, t));
      pin(g, 0.4, () => {
        sfx.aww();
        court.kids.slump(1.5);
        popWord(WORDS.whiff, { x: kid.x, y: head.y + 0.3, z: head.z });
      });
      g.onEnd = () => rollOff(ballAt(shot, shot.duration), part);
      kid.play(whiffSpin, WHIFF_TOTAL, part);
      fly(g);
    }
  };

  /** Time ran out: counts as a wrong answer with no wrong button. */
  const timeUp = () => {
    if (!incoming) return;
    showBanner('TOO SLOW!', true);
    after(TOO_SLOW_FOR, () => {
      if (banner.textContent === 'TOO SLOW!') banner.hidden = true;
    });
    judge(-1, false, clockTotal);
  };

  /** The tap on the green answer: the point goes on (or the match ends). */
  const afterGreenTap = () => {
    banner.hidden = true;
    pointScored();
  };

  /** A point has been won (by `match.server`, the side that scored). */
  const pointScored = () => {
    const thisTurn = ++turn;
    phase = 'point';
    clockRunning = false;
    showHud(true, false);
    scoreboard.setScore(match.us, match.them);
    scoreboard.setServer(match.server);
    scoreboard.setPips(0);
    for (const k of [...usKids, ...themKids]) k.walkTo(k.home.x);
    if (match.server === 'us') {
      sfx.cheer();
      court.kids.cheer(1.2);
    }
    if (match.winner) {
      ending(match.winner === 'us');
      return;
    }
    const call = scoreCall(match.us, match.them);
    const next = () => after(POINT_GAP, () => turn === thisTurn && startPoint());
    const matchPoint = () => {
      if (!isMatchPoint(match.us, match.them)) {
        next();
        return;
      }
      showBanner('MATCH POINT!', false, true);
      sayThen(MATCH_POINT_SPEECH, next);
    };
    const cooking = () => {
      if (!isCooking(usRun)) {
        matchPoint();
        return;
      }
      showBanner(COOKING_BANNER, false, true);
      sayThen(COOKING_SPEECH, matchPoint);
    };
    if (call) sayThen(call, cooking);
    else cooking();
  };

  /** The bell, then the win or the loss. */
  const ending = (won: boolean) => {
    const thisTurn = ++turn;
    phase = 'ending';
    showHud(true, false);
    sfx.bell();
    if (won) {
      showBanner('WE WIN!', false, true);
      sfx.bigCheer();
      court.kids.cheer(3);
      usKids.forEach((k) => k.setMode('cheer'));
      const toResults = () => after(WIN_RESULTS_AFTER, () => turn === thisTurn && results(true));
      sayThen(WE_WIN_SPEECH, () => {
        if (rung === CHAMPION_RUNG - 1) {
          // Beating the Legends: crowns drop onto both our heads.
          usKids.forEach((k) => k.setCrowned(true, true));
          sayThen(CHAMPION_SPEECH, toResults);
        } else {
          toResults();
        }
      });
    } else {
      showBanner('SO CLOSE!', true, true);
      themKids.forEach((k) => k.setMode('dance'));
      speak(SO_CLOSE_SPEECH);
      after(LOSS_RESULTS_AFTER, () => turn === thisTurn && results(false));
    }
  };

  const results = (won: boolean) => {
    phase = 'done';
    tapFlow.disarm();
    words.clear();
    showHud(false, false);
    banner.hidden = true;
    const pair = PAIRS[match.pair];
    session.recordLadderRung(nextRung(rung, won));
    const stars = matchStars(won, match.us, match.them);
    const newBest = session.recordStars(stars);
    lastPair = match.pair;
    hideFactMap();
    showResults({
      topicId: session.topic.id,
      correct: feed.correct,
      total: feed.answered,
      stars,
      newBest,
      missed: feed.missed(),
      playerName: session.player?.name,
      outcome: outcomeText(rung, pair, won, match.us, match.them),
      playAgainLabel: 'Play again ✋',
      onPlayAgain: startMatch,
    });
  };

  // ---------- Input ----------
  const unpress = pressAnswers(buttons, (index) => onAnswer(index));
  hear.addEventListener('click', () => {
    unlockAudio();
    if (fact && phase === 'asking') speak(promptSpeech(fact));
  });

  // Keys 1-4 pick the answers from left to right.
  const onKey = (e: KeyboardEvent) => {
    if (pause.isPaused) return;
    const index = Number(e.key) - 1;
    if (index >= 0 && index < buttons.length) onAnswer(index);
  };
  window.addEventListener('keydown', onKey);

  // ---------- Loop ----------
  ctx.onUpdate((delta, elapsed) => {
    layout();
    let dt = frozen ? 0 : delta;
    if (!frozen && freezeLeft !== null) {
      if (dt >= freezeLeft) {
        dt = freezeLeft;
        freezeLeft = null;
        frozen = true;
      } else {
        freezeLeft -= dt;
      }
    }
    tapFlow.update(dt);
    timers.update(dt);

    // The question clock runs once the question has been read out.
    if (phase === 'asking' && clockRunning && !frozen) {
      clockLeft -= dt;
      setClock(clockLeft / clockTotal);
      const seconds = Math.ceil(clockLeft);
      if (seconds < lastTick && seconds > 0 && seconds <= 3) sfx.tick();
      lastTick = seconds;
      if (clockLeft <= 0) timeUp();
      // Dev: answer the first question a little after its reading ends.
      else if (auto && !autoUsed && clockTotal - clockLeft >= 0.3 && fact) {
        autoUsed = true;
        const right = options.indexOf(fact.answer);
        const wrong = options.findIndex((o) => o !== fact?.answer);
        const quick = auto === 'smash' || auto === 'wrong';
        onAnswer(auto === 'wrong' ? wrong : right, quick ? undefined : 99);
      }
    }
    // The clock is gold with SMASH! while an answer would be a smash.
    clockBar.classList.toggle(
      'smash',
      phase === 'asking' &&
        (clockRunning ? clockTotal - clockLeft : 0) < PAIRS[match.pair].smashUnder,
    );

    stepFlight(dt);
    for (const k of [...usKids, ...themKids]) k.update(dt, elapsed);
    court.update(delta, elapsed);
    ball.update(dt);

    // Fixed camera, eased to its fit, with a little shake.
    const ease = 1 - Math.exp(-8 * delta);
    camDistance += (wantDistance - camDistance) * ease;
    camShift += (wantShift - camShift) * ease;
    const jolt = shake.update(dt);
    camera.position.set(LOOK_X + jolt.x, CAM_Y + jolt.y, camDistance);
    camera.lookAt(LOOK_X + jolt.x, LOOK_Y + jolt.y, 0);
    camera.setViewOffset(viewW, viewH, 0, -camShift, viewW, viewH);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  });

  layout();
  showHud(false, false);
  ctx.start();
  startMatch();

  window.addEventListener('pagehide', () => {
    stopSpeaking();
    window.removeEventListener('keydown', onKey);
    unpress();
    tapFlow.dispose();
    pause.dispose();
    mute.dispose();
    words.clear();
    vs?.dispose();
    preview?.dispose();
    ctx.dispose();
  });
}

const session = startGameSession(GAME_ID);
if (session) run(session);
else location.replace(menuUrl());
