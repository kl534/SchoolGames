import './style.css';
import { MathUtils, Vector3 } from 'three';
import { sfx, speak, stopSpeaking, unlockAudio } from '../../shared/audio';
import { createFactFeed, type FactFeed } from '../../shared/feed';
import { onPress } from '../../shared/input';
import { showPreview } from '../../shared/preview';
import { showResults } from '../../shared/results';
import { starsFor } from '../../shared/round';
import { createScene } from '../../shared/scene';
import { startGameSession, type GameSession } from '../../shared/session';
import { answerOptions, type Fact } from '../../shared/topics';
import { createBackButton, createMuteButton, createPauseOverlay, menuUrl } from '../../shared/ui';
import { devFrame, devRoundSeconds, forcedGag } from './dev';
import { createEffects } from './effects';
import { gagFrame, HEAD_REST, type Cue } from './gags';
import { createKid } from './kid';
import { createKitchen } from './kitchen';
import { CAM_FOV, CAM_Y, fitCamera, LOOK_Y, playBand, type PlayBand } from './layout';
import {
  ateLine,
  BUNCH_SIZE,
  bunchAfterTake,
  clockText,
  isUrgent,
  milestoneLine,
  pickGag,
  secondsLeft,
  TAP_GUARD,
  type Gag,
} from './rules';

const GAME_ID = 'grape-gobble';

/** Seconds each step of the 3, 2, 1, Eat! lasts. */
const COUNT_STEP = 0.75;
/** Seconds the "Eat!" word stays up. */
const EAT_WORD = 0.5;
/** Seconds after a miss before the right answer is read out. */
const READ_AFTER = 0.5;
/** Seconds the "Time's up!" banner shows before the results. */
const ENDING_FOR = 1.8;
/** Seconds the tapped answer flashes green after a right answer. */
const FLASH_FOR = 0.18;
/** Where the words of a gag appear, relative to the kid's head, in turn. */
const POP_SPOTS: [number, number][] = [
  [0, -50],
  [80, 0],
  [-80, 0],
  [0, 50],
];

type Phase = 'preview' | 'countdown' | 'asking' | 'gag' | 'ending' | 'done';

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
  const frameView = devFrame();
  const roundSeconds = devRoundSeconds();

  // ---------- Scene ----------
  const ctx = createScene(container, { fov: CAM_FOV, near: 0.5, far: 100 });
  const { scene, camera } = ctx;
  ctx.renderer.setClearColor(0xfff0d2);
  const kitchen = createKitchen();
  const kid = createKid();
  const effects = createEffects();
  scene.add(kitchen.object, kid.object, effects.object);

  // ---------- HUD ----------
  const hud = el('div', 'gg-hud', document.body);
  const problem = el('div', 'gg-problem', hud);
  problem.setAttribute('aria-live', 'polite');
  const problemText = el('span', 'gg-problem-text', problem);
  const hear = el('button', 'gg-hear', problem);
  hear.type = 'button';
  hear.textContent = '🔊';
  hear.setAttribute('aria-label', 'Hear the question');
  const clockBar = el('div', 'gg-clock', hud);
  const clockFill = el('div', 'gg-clock-fill', clockBar);
  const timeBadge = el('div', 'gg-time', document.body);
  timeBadge.setAttribute('role', 'timer');
  el('span', 'gg-time-icon', timeBadge).textContent = '⏱';
  const timeValue = el('span', 'gg-time-value', timeBadge);
  const scorePanel = el('div', 'gg-score', document.body);
  const scoreRow = el('div', 'gg-score-row', scorePanel);
  el('span', 'gg-score-icon', scoreRow).textContent = '🍇';
  const scoreValue = el('span', 'gg-score-value', scoreRow);
  const bestText = el('div', 'gg-best', scorePanel);
  const answers = el('div', 'gg-answers', document.body);
  const buttons = Array.from({ length: 4 }, () => {
    const button = el('button', 'gg-answer', answers);
    button.type = 'button';
    return button;
  });
  const banner = el('div', 'gg-banner', document.body);
  banner.setAttribute('role', 'status');
  const bannerTitle = el('div', 'gg-banner-title', banner);
  const bannerDetail = el('div', 'gg-banner-detail', banner);
  banner.hidden = true;
  const count = el('div', 'gg-count', document.body);
  count.setAttribute('aria-live', 'assertive');
  count.hidden = true;

  const flash = el('div', 'gg-flash', document.body);

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
  let grapes = 0;
  let bunch = BUNCH_SIZE;
  let lastGag: Gag | null = null;
  let roundTime = 0;
  let askedAt = 0;
  let lastSecond = Math.ceil(roundSeconds);
  /** Ticks up for each question and round, so late callbacks can tell they are stale. */
  let turn = 0;
  let shake = 0;
  let popIndex = 0;
  /** Game time at which the "Eat!" word goes away. */
  let countHideAt = Infinity;

  // Delayed actions run on game time so pausing freezes them too.
  let gameTime = 0;
  let pending: { at: number; fn: () => void }[] = [];
  const after = (seconds: number, fn: () => void) => pending.push({ at: gameTime + seconds, fn });

  // ---------- Camera ----------
  let viewW = 0;
  let viewH = 0;
  let camDistance = 0;
  let camShift = 0;
  let wantDistance = 0;
  let wantShift = 0;
  let refit = true;

  /** The clear space between the question (and its badges) and the answers, as the HUD really lays out. */
  const measureBand = (): PlayBand => {
    const base = playBand(viewW, viewH);
    if (hud.hidden || answers.hidden) return base;
    const top = hud.getBoundingClientRect().bottom + 8;
    const bottom = answers.getBoundingClientRect().top - 8;
    return bottom - top > 60 ? { top, bottom } : base;
  };

  const layout = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w !== viewW || h !== viewH) {
      viewW = w;
      viewH = h;
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
  const toScreen = (world: { x: number; y: number; z: number }) => {
    const band = measureBand();
    const p = point.set(world.x, world.y, world.z).project(camera);
    return {
      x: MathUtils.clamp(((p.x + 1) / 2) * viewW, 60, viewW - 60),
      y: MathUtils.clamp(((1 - p.y) / 2) * viewH, band.top + 20, band.bottom - 20),
    };
  };

  // ---------- HUD helpers ----------
  const setHudVisible = (visible: boolean) => {
    hud.hidden = !visible;
    answers.hidden = !visible;
    buttons.forEach((b, i) => (b.hidden = options[i] === undefined));
    if (!visible) banner.hidden = true;
    refit = true;
  };

  const setBadgesVisible = (visible: boolean) => {
    timeBadge.hidden = !visible;
    scorePanel.hidden = !visible;
  };

  /** Restarts a CSS animation on an overlay. */
  const replay = (node: HTMLElement) => {
    node.classList.remove('on');
    void node.offsetWidth;
    node.classList.add('on');
  };

  const renderScore = () => {
    scoreValue.textContent = grapes.toLocaleString();
    bestText.textContent = `Best ${session.highScore().toLocaleString()}`;
  };

  const renderClock = (left: number) => {
    timeValue.textContent = clockText(left);
    clockFill.style.transform = `scaleX(${MathUtils.clamp(left / roundSeconds, 0, 1)})`;
    const urgent = isUrgent(left);
    clockBar.classList.toggle('urgent', urgent);
    timeBadge.classList.toggle('urgent', urgent);
  };

  /** Floats a short message up from a spot on the screen. */
  const pop = (text: string, at: { x: number; y: number }, kind: 'good' | 'bad' | 'plain') => {
    const node = el('div', `gg-pop ${kind}`, document.body);
    node.textContent = text;
    node.style.left = `${at.x}px`;
    node.style.top = `${at.y}px`;
    node.addEventListener('animationend', () => node.remove());
    setTimeout(() => node.remove(), 1600);
  };

  /** A big ✓ or ✗ over the tapped button. Its own element, so it outlives the button swap. */
  const badge = (kind: 'right' | 'wrong', button: HTMLElement) => {
    const rect = button.getBoundingClientRect();
    const node = el('div', `gg-badge ${kind}`, document.body);
    el('span', 'gg-badge-mark', node).textContent = kind === 'right' ? '✓' : '✗';
    if (kind === 'right') el('span', 'gg-badge-plus', node).textContent = '+1 🍇';
    node.style.left = `${rect.left + rect.width / 2}px`;
    node.style.top = `${rect.top + rect.height / 2}px`;
    node.addEventListener('animationend', () => node.remove());
    setTimeout(() => node.remove(), 1200);
  };

  /** A colour flash round the screen edges. */
  const edgeFlash = (kind: 'right' | 'wrong') => {
    flash.className = `gg-flash ${kind}`;
    replay(flash);
  };

  /** Centres the banner in the clear band. */
  const showBanner = (title: string, detail: string) => {
    bannerTitle.textContent = title;
    bannerDetail.textContent = detail;
    bannerDetail.hidden = !detail;
    banner.hidden = false;
    const band = measureBand();
    const half = banner.offsetHeight / 2;
    banner.style.top = `${Math.min(Math.max((band.top + band.bottom) / 2, band.top + half), band.bottom - half)}px`;
  };

  // ---------- Run flow ----------
  const startRun = (withPreview: boolean) => {
    pending = [];
    turn++;
    stopSpeaking();
    feed = createFactFeed(() => session.chooseFacts());
    grapes = 0;
    bunch = BUNCH_SIZE;
    lastGag = null;
    roundTime = 0;
    lastSecond = Math.ceil(roundSeconds);
    fact = undefined;
    options = [];
    kid.rest();
    effects.clear();
    kitchen.setBunch(bunch);
    kitchen.setPlate(0);
    renderScore();
    renderClock(roundSeconds);
    setHudVisible(false);
    count.hidden = true;
    countHideAt = Infinity;
    if (!withPreview) {
      startCountdown();
      return;
    }
    phase = 'preview';
    setBadgesVisible(false);
    showPreview({ topic: session.topic, facts: feed.peek(10), onDone: startCountdown });
  };

  /** 3, 2, 1, Eat! and the round begins. */
  const startCountdown = () => {
    phase = 'countdown';
    setBadgesVisible(true);
    renderClock(roundSeconds);
    const steps = ['3', '2', '1', 'Eat!'];
    steps.forEach((text, i) => {
      after(i * COUNT_STEP, () => {
        count.textContent = text;
        count.hidden = false;
        replay(count);
        if (i < 3) {
          sfx.tick();
          return;
        }
        sfx.goal();
        roundTime = 0;
        askQuestion();
        // Not an `after`: the first question may be answered (clearing `pending`) before it runs out.
        countHideAt = gameTime + EAT_WORD;
      });
    });
  };

  /** Shows the next question with its four answers and reads it out. No time limit. */
  const askQuestion = () => {
    pending = [];
    stopSpeaking();
    banner.hidden = true;
    const next = feed.take();
    fact = next;
    turn++;
    options = answerOptions(session.topic, next, buttons.length);
    buttons.forEach((button, i) => {
      const text = options[i];
      button.textContent = text ?? '';
      button.setAttribute('aria-label', `Answer ${text ?? ''}`);
      button.removeAttribute('aria-disabled');
      button.className = 'gg-answer';
    });
    problemText.textContent = next.prompt;
    problem.classList.remove('statement', 'wrong');
    answers.classList.remove('shake');
    phase = 'asking';
    askedAt = gameTime;
    setHudVisible(true);
    speak(next.spokenPrompt ?? next.prompt);
  };

  const onAnswer = (index: number) => {
    if (phase !== 'asking' || !fact || options[index] === undefined) return;
    if (gameTime - askedAt < TAP_GUARD) return;
    try {
      unlockAudio();
      stopSpeaking();
    } catch {
      // Audio trouble must never stop the answer.
    }
    if (options[index] === fact.answer) right(index);
    else wrong(index);
  };

  /** A right answer: the kid eats a grape and the next question shows at once. */
  const right = (index: number) => {
    if (!fact) return;
    feed.recordHit(fact);
    session.recordAnswer(fact, true);
    grapes++;
    bunch = bunchAfterTake(bunch);
    kitchen.setBunch(bunch);
    const eaten = grapes;
    kid.eat(() => {
      sfx.glove();
      kitchen.setPlate(eaten);
    });
    renderScore();
    replay(scoreValue);
    const milestone = milestoneLine(grapes);
    // Every right answer chimes; the 10th, 20th ... grape cheers instead.
    if (milestone) sfx.cheer();
    else sfx.chime();
    badge('right', buttons[index]);
    edgeFlash('right');
    if (milestone) {
      pop(milestone, toScreen({ x: HEAD_REST.x, y: HEAD_REST.y + 0.2, z: HEAD_REST.z }), 'good');
    }
    askQuestion();
    buttons[index].classList.add('right');
    after(FLASH_FOR, () => buttons[index]?.classList.remove('right'));
  };

  const onCue = (cue: Cue) => {
    if (cue.sfx) (sfx[cue.sfx] as () => void)();
    if (cue.pop) {
      // Words from one gag land a little apart so they never sit on top of each other.
      const spot = toScreen(HEAD_REST);
      const [dx, dy] = POP_SPOTS[popIndex++ % POP_SPOTS.length];
      pop(cue.pop, { x: spot.x + dx, y: spot.y + dy }, 'plain');
      if (cue.pop === 'Bonk!' || cue.pop === 'Splat!' || cue.pop === 'Squirt!') shake = 1;
    }
    if (cue.burst) effects.burst(cue.burst.kind, cue.burst.at);
  };

  /** A wrong answer: one of the gags. The answers stay locked for all of it. */
  const wrong = (index: number) => {
    if (!fact) return;
    const current = fact;
    feed.recordMiss(current);
    session.recordAnswer(current, false);
    const gag = forcedGag() ?? pickGag(lastGag, Math.random());
    lastGag = gag;
    popIndex = 0;
    phase = 'gag';
    pending = [];
    const thisTurn = ++turn;
    buttons.forEach((button, i) => {
      button.setAttribute('aria-disabled', 'true');
      if (i === index) button.classList.add('wrong');
      else if (options[i] === current.answer) button.classList.add('right');
      else button.classList.add('gone');
    });
    buttons[options.indexOf(current.answer)]?.classList.add('right', 'reveal');
    problemText.textContent = `✗ ${current.statement}`;
    problem.classList.add('statement', 'wrong');
    // At the instant of the tap, so a wrong answer never looks like eating.
    sfx.miss();
    badge('wrong', buttons[index]);
    edgeFlash('wrong');
    answers.classList.remove('shake');
    void answers.offsetWidth;
    answers.classList.add('shake');
    refit = true;
    after(READ_AFTER, () => speak(current.spokenStatement ?? current.statement));
    kid.playGag(gag, onCue, () => {
      if (turn !== thisTurn || phase !== 'gag') return;
      stopSpeaking();
      askQuestion();
    });
  };

  /** The clock is out: the buzzer, the kid freezes, then the results. */
  const endRound = () => {
    pending = [];
    turn++;
    stopSpeaking();
    phase = 'ending';
    kid.freeze();
    effects.clear();
    setHudVisible(false);
    renderClock(0);
    sfx.alarm();
    showBanner("Time's up!", ateLine(grapes));
    after(ENDING_FOR, finishRun);
  };

  const finishRun = () => {
    phase = 'done';
    setHudVisible(false);
    count.hidden = true;
    const stars = starsFor(feed.correct, feed.answered);
    session.recordStars(stars);
    const newHighScore = session.recordScore(grapes);
    renderScore();
    if (newHighScore) sfx.goal();
    showResults({
      topicId: session.topic.id,
      correct: feed.correct,
      total: feed.answered,
      stars,
      newBest: false,
      missed: feed.missed(),
      playerName: session.player?.name,
      score: grapes,
      highScore: session.highScore(),
      newHighScore,
      outcome: ateLine(grapes),
      playAgainLabel: 'Eat more 🍇',
      onPlayAgain: () => startRun(false),
    });
  };

  // ---------- Input ----------
  const unpress = buttons.map((button, i) => {
    // A touch press doesn't count as a user gesture for iOS audio; the release does.
    button.addEventListener('pointerup', unlockAudio);
    return onPress(button, () => onAnswer(i));
  });
  hear.addEventListener('click', () => {
    unlockAudio();
    if (fact && phase === 'asking') speak(fact.spokenPrompt ?? fact.prompt);
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

    gameTime += delta;
    const due = pending.filter((p) => p.at <= gameTime);
    if (due.length) {
      pending = pending.filter((p) => p.at > gameTime);
      due.forEach((p) => p.fn());
    }

    if (gameTime >= countHideAt) {
      count.hidden = true;
      countHideAt = Infinity;
    }

    // --- The round clock: always running while a question or a gag is on ---
    if (phase === 'asking' || phase === 'gag') {
      roundTime += delta;
      const left = secondsLeft(roundTime, roundSeconds);
      renderClock(left);
      const second = Math.ceil(left);
      if (second < lastSecond && isUrgent(left)) {
        sfx.tick();
        replay(timeBadge);
      }
      lastSecond = second;
      if (left <= 0) endRound();
    }

    kid.update(delta, elapsed);
    kitchen.update(elapsed);
    effects.update(delta);

    // --- Fixed camera, eased to its fit, with a little shake on the big gags ---
    const ease = 1 - Math.exp(-8 * delta);
    camDistance += (wantDistance - camDistance) * ease;
    camShift += (wantShift - camShift) * ease;
    shake = Math.max(0, shake - 3.5 * delta);
    camera.position.set(
      Math.sin(elapsed * 61) * shake * 0.05,
      CAM_Y + Math.sin(elapsed * 73 + 1) * shake * 0.05,
      camDistance,
    );
    camera.lookAt(0, LOOK_Y, 0);
    camera.setViewOffset(viewW, viewH, 0, -camShift, viewW, viewH);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  });

  layout();
  setHudVisible(false);
  renderScore();
  renderClock(roundSeconds);
  ctx.start();
  if (frameView) {
    // Dev view of one frame of one gag: no preview, no round, no HUD.
    setBadgesVisible(false);
    kid.setFrame(gagFrame(frameView.gag, frameView.t));
  } else {
    startRun(true);
  }

  window.addEventListener('pagehide', () => {
    stopSpeaking();
    window.removeEventListener('keydown', onKey);
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
