import './style.css';
import {
  CanvasTexture,
  CircleGeometry,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { Body, Material, Sphere, Vec3, World } from 'cannon-es';
import { sfx, speak, stopSpeaking, unlockAudio } from '../../shared/audio';
import { onPress } from '../../shared/input';
import { showLesson } from '../../shared/lesson';
import { showResults } from '../../shared/results';
import { createRound, starsFor, type Round } from '../../shared/round';
import { createScene } from '../../shared/scene';
import { startGameSession, type GameSession } from '../../shared/session';
import { answerOptions, type Fact } from '../../shared/topics';
import { createBackButton, createMuteButton, createPauseOverlay, menuUrl } from '../../shared/ui';
import { buildField, buildGoalBodies, GOAL_HEIGHT, GOAL_WIDTH } from './field';
import { createGoalie } from './goalie';

const GAME_ID = 'penalty-kick';

const GRAVITY = 9.82;
const BALL_RADIUS = 0.2;
const GOALIE_Z = 0.5;
/** Saves happen when the ball's centre reaches this z, just in front of the keeper. */
const CONTACT_Z = GOALIE_Z + 0.35;
const CAMERA_Y = 1.6;
const CAMERA_Z = 11;
const LOOK_Y = 1.5;
const KICK_TIME = 0.75;
const REACTION_TIME = 0.12;

/** Answer targets in the goal corners, in the order top-left, top-right, bottom-left, bottom-right. */
const TARGET_X = GOAL_WIDTH / 2 - 0.85;
const CORNERS = [
  new Vector3(-TARGET_X, GOAL_HEIGHT - 0.65, 0),
  new Vector3(TARGET_X, GOAL_HEIGHT - 0.65, 0),
  new Vector3(-TARGET_X, 0.6, 0),
  new Vector3(TARGET_X, 0.6, 0),
];
/** How far behind the goal line a scoring shot is aimed. */
const NET_AIM_Z = -0.6;

const ANSWER_HEIGHT = 64;
const ANSWER_GAP = 12;
/** Seconds a result stays up before a tap can skip to the next question. */
const SKIP_AFTER = 0.6;

type Phase = 'lesson' | 'aiming' | 'shot' | 'result' | 'done';

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

function ballTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  if (g) {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#1b1b1b';
    for (const [row, y] of [12, 64, 116].entries()) {
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.arc(((i + (row % 2) * 0.5) * 256) / 5, y, row === 1 ? 14 : 18, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function run(session: GameSession): void {
  const container = document.getElementById('game');
  if (!container) throw new Error('Missing #game container');

  // ---------- Scene ----------
  const ctx = createScene(container, { fov: 50 });
  const { scene, camera } = ctx;
  ctx.renderer.setClearColor(0x8fd3ff);
  buildField(scene);

  const goalie = createGoalie(GOALIE_Z);
  scene.add(goalie.object);

  const ball = new Mesh(
    new SphereGeometry(BALL_RADIUS, 32, 20),
    new MeshStandardMaterial({ map: ballTexture(), roughness: 0.5 }),
  );
  scene.add(ball);
  const shadow = new Mesh(
    new CircleGeometry(BALL_RADIUS, 24),
    new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);
  const spot = new Mesh(new CircleGeometry(0.12, 20), new MeshBasicMaterial({ color: 0xffffff }));
  spot.rotation.x = -Math.PI / 2;
  scene.add(spot);

  const world = new World({ gravity: new Vec3(0, -GRAVITY, 0) });
  const ballMaterial = new Material('ball');
  buildGoalBodies(world, ballMaterial);
  const ballBody = new Body({
    mass: 0.43,
    shape: new Sphere(BALL_RADIUS),
    material: ballMaterial,
    angularDamping: 0.3,
  });
  world.addBody(ballBody);

  // ---------- HUD ----------
  const hud = el('div', 'pk-hud', document.body);
  const problem = el('div', 'pk-problem', hud);
  problem.setAttribute('aria-live', 'polite');
  const problemText = el('span', 'pk-problem-text', problem);
  const hear = el('button', 'pk-hear', problem);
  hear.type = 'button';
  hear.textContent = '🔊';
  hear.setAttribute('aria-label', 'Hear the question');
  const clockBar = el('div', 'pk-clock', hud);
  const clockFill = el('div', 'pk-clock-fill', clockBar);
  const kicksBar = el('div', 'pk-kicks', document.body);
  kicksBar.setAttribute('aria-hidden', 'true');
  const answers = CORNERS.map(() => {
    const button = el('button', 'pk-answer', document.body);
    button.type = 'button';
    return button;
  });
  const banner = el('div', 'pk-banner', document.body);
  banner.setAttribute('role', 'status');
  const bannerTitle = el('div', 'pk-banner-title', banner);
  const bannerDetail = el('div', 'pk-banner-detail', banner);
  banner.hidden = true;

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
  let phase: Phase = 'lesson';
  let round: Round = createRound([]);
  let fact: Fact | undefined;
  let options: string[] = [];
  let chosen = -1;
  let turn = 0;
  let save = false;
  let timedOut = false;
  /** The keeper has caught the ball and is holding it. */
  let caught = false;
  const held = new Vector3();
  let clockLeft = 0;
  /** Seconds this question started with, for the ring's fill. */
  let clockTotal = 1;
  let clockRunning = false;
  let lastTick = 0;
  let ballSpotZ = 7;
  /** Game time at which the current result was shown. */
  let resultAt = 0;

  // Delayed actions run on game time so pausing freezes them too.
  let gameTime = 0;
  let pending: { at: number; fn: () => void }[] = [];
  const after = (seconds: number, fn: () => void) => pending.push({ at: gameTime + seconds, fn });

  /**
   * Dims the answers while a kick plays out. They are not `disabled`, so a tap in that window
   * still reaches `onAnswerTap` instead of being swallowed.
   */
  const lockAnswers = () => answers.forEach((b) => b.setAttribute('aria-disabled', 'true'));

  const setPlayVisible = (visible: boolean) => {
    hud.hidden = !visible;
    kicksBar.hidden = !visible;
    answers.forEach((b, i) => (b.hidden = !visible || options[i] === undefined));
    if (!visible) banner.hidden = true;
  };

  // ---------- Layout ----------
  let viewW = 0;
  let viewH = 0;

  const toScreen = (point: Vector3) => {
    const p = point.clone().project(camera);
    return { x: ((p.x + 1) / 2) * viewW, y: ((1 - p.y) / 2) * viewH };
  };

  /** Pins answer buttons over the goal corners without overlapping each other or the HUD. */
  const positionAnswers = () => {
    if (!viewW) return;
    const pts = CORNERS.map(toScreen);
    const need = ANSWER_HEIGHT + ANSWER_GAP;
    const minY = hud.hidden ? 80 : hud.getBoundingClientRect().bottom + ANSWER_HEIGHT / 2 + 8;
    const maxY = viewH - 48 - ANSWER_HEIGHT / 2;
    for (const [top, bottom] of [
      [pts[0], pts[2]],
      [pts[1], pts[3]],
    ]) {
      if (bottom.y - top.y < need) {
        const mid = (top.y + bottom.y) / 2;
        top.y = mid - need / 2;
        bottom.y = mid + need / 2;
      }
      top.y = Math.max(top.y, minY);
      bottom.y = Math.min(Math.max(bottom.y, top.y + need), maxY);
    }
    answers.forEach((button, i) => {
      const w = button.offsetWidth || 88;
      const x = MathUtils.clamp(pts[i].x, w / 2 + 8, viewW - w / 2 - 8);
      button.style.transform = `translate(${x - w / 2}px, ${pts[i].y - ANSWER_HEIGHT / 2}px)`;
    });
  };

  const placeBall = () => {
    ballBody.velocity.setZero();
    ballBody.angularVelocity.setZero();
    ballBody.quaternion.set(0, 0, 0, 1);
    ballBody.position.set(0, BALL_RADIUS, ballSpotZ);
    ballBody.linearDamping = 0.5;
    caught = false;
  };

  /** Fits the goal to the screen and keeps the ball in view, for any aspect ratio. */
  const layout = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === viewW && h === viewH) return;
    viewW = w;
    viewH = h;
    const aspect = w / Math.max(h, 1);
    const halfHeight = Math.max(2.9, 3.8 / aspect);
    const halfFov = Math.atan(halfHeight / CAMERA_Z);
    camera.fov = MathUtils.radToDeg(halfFov * 2);
    camera.aspect = aspect;
    camera.position.set(0, CAMERA_Y, CAMERA_Z);
    camera.lookAt(0, LOOK_Y, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const ballDistance = Math.max(3.2, (CAMERA_Y - BALL_RADIUS) / Math.tan(halfFov - 0.08));
    ballSpotZ = CAMERA_Z - ballDistance;
    spot.position.set(0, 0.006, ballSpotZ);
    if (phase !== 'shot' && phase !== 'result') placeBall();
    positionAnswers();
  };

  // ---------- HUD helpers ----------
  const renderKicks = () => {
    const dots = Array.from({ length: round.length }, (_, i) => {
      const dot = document.createElement('span');
      const result = round.results[i];
      dot.className = `pk-kick${result === true ? ' goal' : result === false ? ' miss' : ''}`;
      if (i === round.played && phase === 'aiming') dot.classList.add('current');
      return dot;
    });
    kicksBar.replaceChildren(...dots);
  };

  const setClock = (fraction: number) => {
    const f = MathUtils.clamp(fraction, 0, 1);
    clockFill.style.transform = `scaleX(${f})`;
    clockBar.classList.toggle('urgent', f < 0.4);
  };

  const showBanner = (title: string, detail: string, kind: 'goal' | 'miss') => {
    bannerTitle.textContent = title;
    bannerDetail.textContent = detail;
    bannerDetail.hidden = !detail;
    banner.className = `pk-banner ${kind}`;
    banner.hidden = false;
  };

  // ---------- Round flow ----------
  const startRound = () => {
    const facts = session.chooseFacts();
    round = createRound(facts);
    phase = 'lesson';
    options = [];
    setPlayVisible(false);
    placeBall();
    goalie.reset();
    showLesson({
      topic: session.topic,
      facts,
      onDone: () => {
        setPlayVisible(true);
        startTurn();
      },
    });
  };

  const startTurn = () => {
    pending = [];
    fact = round.current();
    if (!fact) {
      finishRound();
      return;
    }
    const current = fact;
    const thisTurn = ++turn;
    options = answerOptions(session.topic, current, CORNERS.length);
    chosen = -1;
    answers.forEach((button, i) => {
      const text = options[i];
      button.hidden = text === undefined;
      button.textContent = text ?? '';
      button.setAttribute('aria-label', `Answer ${text ?? ''}`);
      button.removeAttribute('aria-disabled');
      button.className = 'pk-answer';
    });
    problemText.textContent = current.prompt;
    banner.hidden = true;
    phase = 'aiming';
    renderKicks();
    placeBall();
    goalie.reset();

    clockRunning = false;
    setClock(1);
    positionAnswers();

    // The shot clock starts once the question has been read out.
    speak(current.spokenPrompt ?? current.prompt, () => {
      if (turn !== thisTurn || phase !== 'aiming') return;
      clockTotal = session.timerSecondsFor(current);
      clockLeft = clockTotal;
      lastTick = Math.ceil(clockLeft);
      clockRunning = true;
    });
  };

  /** Launch velocity to reach `target` after `time` s, and where and when it meets the keeper. */
  const trajectory = (target: Vector3, time: number) => {
    const p0 = ballBody.position;
    const v = new Vec3(
      (target.x - p0.x) / time,
      (target.y - p0.y) / time + 0.5 * GRAVITY * time,
      (target.z - p0.z) / time,
    );
    const tc = (time * (p0.z - CONTACT_Z)) / (p0.z - target.z);
    const contact = new Vector3(
      p0.x + v.x * tc,
      p0.y + v.y * tc - 0.5 * GRAVITY * tc * tc,
      CONTACT_Z,
    );
    return { v, tc, contact };
  };

  /** Launches the ball so it reaches `target` after `time` seconds; the keeper reacts. */
  const kick = (target: Vector3, time: number, saved: boolean) => {
    // Lift the ball off the grass first: friction on the spinning ball would bend the
    // shot away from the path the keeper is diving for.
    ballBody.position.y += 0.02;
    const { v, tc, contact } = trajectory(target, time);
    ballBody.linearDamping = 0;
    ballBody.velocity.copy(v);
    ballBody.angularVelocity.set(-v.z * 2, 0, v.x);
    ballBody.wakeUp();
    sfx.kick();
    save = saved;

    const diveTime = tc - REACTION_TIME;
    if (saved) {
      // Gloves arrive behind the ball exactly as it gets there.
      goalie.diveTo(contact, diveTime, { delay: REACTION_TIME, hold: timedOut });
    } else {
      // Guess wrong: dive for a corner on the other side.
      const decoys = CORNERS.filter((c) => Math.sign(c.x) !== Math.sign(contact.x || 1));
      const decoy = decoys[Math.floor(Math.random() * decoys.length)];
      const fake = trajectory(new Vector3(decoy.x, decoy.y, NET_AIM_Z), time).contact;
      goalie.diveTo(fake, diveTime + 0.05, { delay: REACTION_TIME });
    }
  };

  const shoot = (index: number) => {
    if (phase !== 'aiming' || !fact || options[index] === undefined) return;
    try {
      unlockAudio();
      stopSpeaking();
    } catch {
      // Audio trouble must never stop the shot.
    }
    phase = 'shot';
    clockRunning = false;
    chosen = index;
    timedOut = false;
    lockAnswers();
    answers[index].classList.add('chosen');
    renderKicks();
    const correct = options[index] === fact.answer;
    const corner = CORNERS[index];
    kick(new Vector3(corner.x, corner.y, NET_AIM_Z), KICK_TIME, !correct);
  };

  const timeUp = () => {
    phase = 'shot';
    clockRunning = false;
    timedOut = true;
    lockAnswers();
    renderKicks();
    // A weak roll straight at the keeper.
    kick(new Vector3(0, BALL_RADIUS + 0.1, GOALIE_Z), 1.1, true);
  };

  const resolve = (goal: boolean) => {
    if (!fact) return;
    const current = fact;
    phase = 'result';
    resultAt = gameTime;
    round.record(goal);
    session.recordAnswer(current, goal);
    renderKicks();
    const correctIndex = options.indexOf(current.answer);
    answers[correctIndex]?.classList.add('right');

    if (goal) {
      showBanner('GOAL!', '', 'goal');
      sfx.goal();
      ballBody.linearDamping = 0.6;
      after(1.8, () => phase === 'result' && startTurn());
      return;
    }

    if (chosen >= 0) answers[chosen].classList.add('wrong');
    showBanner(timedOut ? "Time's up!" : 'Saved!', current.statement, 'miss');
    sfx.miss();
    // Move on once the correct fact has been read out and shown for a bit.
    const thisTurn = turn;
    let spoken = false;
    let shown = false;
    const next = () => {
      if (spoken && shown && turn === thisTurn && phase === 'result') startTurn();
    };
    after(0.6, () =>
      speak(current.spokenStatement ?? current.statement, () => {
        spoken = true;
        next();
      }),
    );
    after(2.6, () => {
      shown = true;
      next();
    });
  };

  const finishRound = () => {
    phase = 'done';
    setPlayVisible(false);
    placeBall();
    goalie.reset();
    const stars = starsFor(round.correct, round.length);
    const newBest = session.recordStars(stars);
    if (stars === 3) sfx.goal();
    speak(`You scored ${round.correct} out of ${round.length}!`);
    showResults({
      topicId: session.topic.id,
      correct: round.correct,
      total: round.length,
      stars,
      newBest,
      missed: round.missed(),
      playerName: session.player?.name,
      onPlayAgain: startRound,
    });
  };

  // ---------- Input ----------
  /** A tap while a result is showing skips ahead, so it never feels ignored. */
  const onAnswerTap = (index: number) => {
    if (phase === 'aiming') shoot(index);
    else if (phase === 'result' && gameTime - resultAt >= SKIP_AFTER) {
      stopSpeaking();
      startTurn();
    }
  };
  answers.forEach((button, i) => {
    onPress(button, () => onAnswerTap(i));
    // A touch press doesn't count as a user gesture for iOS audio; the release does.
    button.addEventListener('pointerup', unlockAudio);
  });
  hear.addEventListener('click', () => {
    unlockAudio();
    if (fact) speak(fact.spokenPrompt ?? fact.prompt);
  });
  // Keys 1-4 pick top-left, top-right, bottom-left, bottom-right.
  const onKey = (e: KeyboardEvent) => {
    const index = Number(e.key) - 1;
    if (!pause.isPaused && index >= 0 && index < CORNERS.length) shoot(index);
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

    if (phase === 'aiming' && clockRunning) {
      clockLeft -= delta;
      setClock(clockLeft / clockTotal);
      const seconds = Math.ceil(clockLeft);
      if (seconds < lastTick && seconds > 0 && seconds <= 3) sfx.tick();
      lastTick = seconds;
      if (clockLeft <= 0) timeUp();
    }

    goalie.update(delta, elapsed);
    world.step(1 / 60, delta, 5);

    if (phase === 'shot') {
      const { position, velocity } = ballBody;
      if (save && position.z <= CONTACT_Z) {
        // Put the ball back where it met the gloves, then catch it or parry it away.
        const back = (CONTACT_Z - position.z) / Math.min(velocity.z, -1e-3);
        position.vadd(velocity.scale(back), position);
        if (timedOut) {
          caught = true;
        } else {
          velocity.set(velocity.x * 0.2 + (Math.random() - 0.5) * 2, 2.5 + Math.random(), 4);
          ballBody.linearDamping = 0.3;
        }
        resolve(false);
      } else if (!save && position.z < -0.25) {
        resolve(true);
      }
    }
    if (caught) {
      goalie.ballPosition(held);
      ballBody.position.set(held.x, held.y, held.z);
      ballBody.velocity.setZero();
      ballBody.angularVelocity.setZero();
    }

    ball.position.set(ballBody.position.x, ballBody.position.y, ballBody.position.z);
    ball.quaternion.set(
      ballBody.quaternion.x,
      ballBody.quaternion.y,
      ballBody.quaternion.z,
      ballBody.quaternion.w,
    );
    const height = Math.max(ballBody.position.y - BALL_RADIUS, 0);
    shadow.position.set(ballBody.position.x, 0.008, ballBody.position.z);
    shadow.scale.setScalar(Math.max(0.4, 1 - height * 0.25));
  });

  layout();
  setPlayVisible(false);
  ctx.start();
  startRound();

  window.addEventListener('pagehide', () => {
    stopSpeaking();
    window.removeEventListener('keydown', onKey);
    pause.dispose();
    mute.dispose();
    ctx.dispose();
  });
}

const session = startGameSession(GAME_ID);
if (session) run(session);
else location.replace(menuUrl());
