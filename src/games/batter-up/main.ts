import './style.css';
import { MathUtils, Vector3, type Object3D } from 'three';
import { sfx, speak, stopSpeaking, unlockAudio } from '../../shared/audio';
import { createFactFeed, type FactFeed } from '../../shared/feed';
import { createPointerInput, onPress } from '../../shared/input';
import { showLesson } from '../../shared/lesson';
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
  type Fielder,
  type FielderId,
  type Prop,
} from './characters';
import { createEffects, fireworkColour } from './effects';
import { buildField } from './field';
import {
  BASE_SIDE,
  BASE_SPOTS,
  CHASERS,
  CONTACT,
  dashPosition,
  fieldAngle,
  fieldPoint,
  GLOVE,
  GLOVE_TIME,
  pickChasers,
  pitchPosition,
  planHit,
  RELEASE,
  wallRadius,
  ZIP_TIME,
  type HitPlan,
  type Vec,
} from './flight';
import { createHud } from './hud';
import {
  centreShift,
  fireworksAim,
  fireworksFit,
  fitView,
  followGoal,
  hitBand,
  homeView,
  keepBoardClear,
  type HomeView,
  type ViewFit,
} from './layout';
import {
  applyHit,
  applyStrike,
  clockFraction,
  easeToward,
  hitFor,
  hitLabel,
  hitSpeech,
  MAX_BATTERS,
  newGame,
  runsText,
  strikeCall,
  type GameState,
  type Hit,
  type Move,
} from './rules';

const GAME_ID = 'batter-up';

/** Seconds a result stays up before a tap can skip to the next pitch. */
const SKIP_AFTER = 0.6;
/** Least seconds the correct fact stays up after a miss. */
const REVEAL_FOR = 2.4;
/** The pitcher winds up at least this long, however quickly the question is read. */
const MIN_WIND = 0.9;
/** Seconds into a hit before a tap can skip the rest of it. */
const HIT_SKIP_AFTER = 1.4;
/** How fast base runners run, and fielders run after the ball (units per second). */
const RUN_SPEED = 12;
const FIELD_SPEED = 9;
/** The ball goes just over the bat when the answer was wrong. */
const MISS_POINT: Vec = { x: 0.05, y: CONTACT.y + 0.42, z: CONTACT.z };

type Phase =
  | 'lesson'
  | 'intro'
  | 'windup'
  | 'release'
  | 'pitch'
  | 'swing'
  | 'result'
  | 'hit'
  | 'ending'
  | 'done';

type CamMode = 'home' | 'follow';

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
  const outfield: FielderId[] = ['LF', 'CF', 'RF'];
  const fielders: Fielder[] = (Object.keys(FIELDER_SPOTS) as FielderId[]).map((id, i) =>
    createFielder(id, i),
  );
  fielders.forEach((f) => scene.add(f.mover.person.root));

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
  let phase: Phase = 'lesson';
  let feed: FactFeed = createFactFeed(() => session.chooseFacts());
  let state: GameState = newGame();
  /** What the scorebug shows; it lags the real state while a play is still happening. */
  const shown = { runs: 0, strikes: 0, batter: 1, outs: 0 };
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
  let plan: HitPlan | null = null;
  let hitT = 0;
  let landed = false;
  let held: Fielder | null = null;
  let chasers: Fielder[] = [];
  let fireworksFrom = Infinity;
  /** Seconds the batter and runners need to finish running the bases. */
  let runTime = 0;
  /** The batter at the plate was just struck out. */
  let struckOut = false;

  // The camera.
  let camMode: CamMode = 'home';
  let home: HomeView = homeView(0.5);
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
    const band = hitBand(viewW, viewH, hud.bugBottom());
    hitFrame = {
      band,
      shift: centreShift(viewH, band),
      fireworks: fireworksFit(viewW, viewH, fit.fov, band),
    };
  };

  const layout = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === viewW && h === viewH) return;
    viewW = w;
    viewH = h;
    fit = fitView(w, h);
    home = homeView(w / Math.max(h, 1));
    camera.aspect = w / Math.max(h, 1);
    viewFov = fit.fov;
    viewShift = fit.shift;
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

  // ---------- HUD helpers ----------
  const refresh = () => {
    hud.renderBug({
      runs: shown.runs,
      best: Math.max(session.highScore(), 0),
      outs: shown.outs,
      strikes: shown.strikes,
      batter: shown.batter,
      batters: MAX_BATTERS,
      bases: state.bases,
    });
    field.setBoard({
      runs: shown.runs,
      outs: shown.outs,
      strikes: shown.strikes,
      batter: shown.batter,
      batters: MAX_BATTERS,
    });
  };

  // ---------- The ball ----------
  const putBall = (p: Vec) => {
    ballPos.x = p.x;
    ballPos.y = p.y;
    ballPos.z = p.z;
    // Far from the camera the ball is drawn bigger, so it can still be followed.
    const far = camera.position.distanceTo(point.set(p.x, p.y, p.z));
    ball.place(ballPos, MathUtils.clamp(far / 20, 1, 3));
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

  // ---------- Pitching ----------
  /** Starts a new pitch: the question, the answers, and the pitcher winding up as it is read. */
  const nextPitch = () => {
    if (state.over) return;
    pending = [];
    stopSpeaking();
    hud.hideBanner();
    const thisTurn = ++turn;
    fact = feed.take();
    options = answerOptions(session.topic, fact, 4);
    chosen = -1;
    flightTotal = session.timerSecondsFor(fact);
    elapsed = 0;
    speechDone = false;
    dash = null;
    hud.setOptions(options);
    hud.setQuestion(fact.prompt);
    hud.setClock(1);
    hud.hideQuestion(false);
    ball.setVisible(false);
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
    // A tap before the pitch is thrown counts as no time used at all.
    const used = phase === 'pitch' ? elapsed : 0;
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
      const hit = hitFor(clockFraction(used, flightTotal));
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
      if (spoken && shownLongEnough && turn === thisTurn && phase === 'result') advance();
    };
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
      leaving.push(batter);
      const gone = batter;
      gone.mover.runTo([{ x: -6, y: 0, z: 4.5 }], 3.2);
      later(1.8, () => retire(gone.person.root));
      if (state.over) {
        endGame();
        return;
      }
      stepUp();
    }
    nextPitch();
  };

  /** The next batter walks to the plate. */
  const stepUp = () => {
    batter = createBatter();
    batter.setLook(state.batter - 1);
    spawn(batter.person.root);
    shown.batter = state.batter;
    shown.strikes = state.strikes;
    shown.outs = state.outs;
    refresh();
  };

  // ---------- Hits ----------
  /** The bat meets the ball. */
  const contact = (hit: Hit) => {
    sfx.bat();
    measureHit();
    effects.crack(CONTACT);
    const outcome = applyHit(state, hit);
    state = outcome.state;
    refresh();
    hud.markHit(chosen);
    // The question gives way to the view of the field.
    after(0.25, () => hud.hideQuestion(true));
    hud.showBanner(hitLabel(hit), runsText(outcome.runs), 'hit', 'top');
    speak(hitSpeech(hit));
    after(0.35, hit === 'homer' ? sfx.bigCheer : sfx.cheer);

    // The ball's flight.
    const side = Math.random() < 0.5 ? -1 : 1;
    plan = planHit(hit, side, Math.random(), Math.random());
    hitT = 0;
    landed = false;
    held = null;
    fireworksFrom = hit === 'homer' ? plan.airTime * 0.78 : Infinity;
    phase = 'hit';
    camMode = 'follow';
    dash = null;
    sendFielders(hit, plan);
    runBases(outcome.moves);
    const dropped = batter.dropBat();
    if (dropped) {
      props.push(dropped);
      spawn(dropped.object);
    }
    resultAt = gameTime;
  };

  /** The outfielders nearest the ball chase it; on a home run they only watch it go. */
  const sendFielders = (hit: Hit, hitPlan: HitPlan) => {
    const deep = fieldAngle(hitPlan.landing);
    const target: Vec = hit === 'homer' ? fieldPoint(deep, wallRadius(deep) - 1.8) : hitPlan.stop;
    const candidates = fielders
      .filter((f) => outfield.includes(f.id))
      .map((f) => ({ f, x: f.mover.person.root.position.x, z: f.mover.person.root.position.z }));
    chasers = pickChasers(candidates, hitPlan.landing, CHASERS[hit]).map((c) => c.f);
    chasers.forEach((f, i) => {
      const spot: Vec = {
        x: target.x + (i ? (target.x > 0 ? -2 : 2) : 0),
        y: 0,
        z: target.z + (i ? 1.8 : 0),
      };
      f.chase(spot, FIELD_SPEED, hit === 'homer' ? 'watch' : 'scoop');
    });
    // Everyone else turns to watch the ball go.
    fielders
      .filter((f) => !chasers.includes(f))
      .forEach((f) => f.mover.face(hit === 'homer' ? hitPlan.landing : hitPlan.stop));
  };

  /** The batter and every runner advance together, running the bases. */
  const runBases = (moves: Move[]) => {
    const next: (Batter | null)[] = [null, null, null];
    running = [];
    const old = batter;
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
            shown.runs++;
            refresh();
            hud.flashRuns();
            sfx.chime();
            runner.cheer();
            const at = toScreen(BASE_SPOTS[0]);
            hud.pop('+1', at.x, at.y - 30, 'good');
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
        runner.mover.runTo(route, RUN_SPEED, entry.arrive);
      });
    }
    onBase = next;
    // A new batter steps up once the play is over.
    const longest = moves.reduce((m, mv) => Math.max(m, (mv.to - mv.from) * BASE_SIDE), 0);
    runTime = 0.2 + longest / RUN_SPEED;
  };
  /** The play is over: back to the batting view and the next batter. */
  const endPlay = () => {
    if (phase !== 'hit') return;
    // Anybody still running gets where they were going.
    for (const r of running) {
      if (r.done) continue;
      r.batter.mover.halt();
      r.batter.mover.place(r.final.x, r.final.z);
      r.arrive();
    }
    running = [];
    shown.runs = state.runs;
    refresh();
    plan = null;
    held = null;
    camMode = 'home';
    ball.setVisible(false);
    stopSpeaking();
    hud.hideBanner();
    effects.onBurst = null;
    fielders.forEach((f) => f.goHome(7));
    pending = [];
    if (state.over) {
      endGame();
      return;
    }
    stepUp();
    after(0.7, nextPitch);
  };

  const updateHit = (delta: number) => {
    if (!plan) return;
    hitT += delta;
    const p = plan.position(hitT, ballPos);
    if (held) {
      held.mover.person.handWorld('L', handPoint);
      putBall({ x: handPoint.x, y: handPoint.y + 0.05, z: handPoint.z });
    } else if (!(plan.overWall && hitT > plan.airTime)) {
      putBall(p);
      ball.spin(delta, 18);
      if (hitT < plan.airTime) {
        // Far away the trail grows so the ball can still be followed.
        const far = camera.position.distanceTo(point.set(ballPos.x, ballPos.y, ballPos.z));
        effects.trail(ballPos, Math.max(0.5, far * 0.025));
      }
    } else {
      ball.setVisible(false);
    }
    if (!landed && hitT >= plan.airTime) {
      landed = true;
      if (!plan.overWall) {
        effects.dust({ x: plan.landing.x, y: 0.1, z: plan.landing.z }, 7);
      }
    }
    // A fielder who gets to the ball once it has stopped scoops it up.
    if (!held && !plan.overWall && hitT >= plan.duration - 0.1) {
      const taker = chasers.find((f) => {
        const pos = f.mover.person.root.position;
        return Math.hypot(pos.x - plan!.stop.x, pos.z - plan!.stop.z) < 3 && !f.mover.moving;
      });
      if (taker) {
        held = taker;
        sfx.glove();
      }
    }
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
    const camEnd = plan.overWall ? plan.airTime + 1.4 : plan.duration + 0.5;
    if (camMode === 'follow' && hitT > camEnd) camMode = 'home';
    const end = Math.max(plan.duration + 0.9, runTime + 0.6, plan.overWall ? 4.2 : 2.6);
    if (hitT >= end) endPlay();
  };

  // ---------- Ending ----------
  const endGame = () => {
    phase = 'ending';
    pending = [];
    turn++;
    hud.hideQuestion(true);
    const threeOuts = state.outs >= 3;
    const title = threeOuts ? 'Three outs!' : "That's the inning!";
    const detail = `${state.runs} ${state.runs === 1 ? 'run' : 'runs'} scored`;
    hud.showBanner(title, detail, 'info');
    const thisTurn = turn;
    let spoken = false;
    let shownLongEnough = false;
    const next = () => {
      if (spoken && shownLongEnough && turn === thisTurn && phase === 'ending') finishRun();
    };
    speak(`${title} ${detail}.`, () => {
      spoken = true;
      next();
    });
    after(REVEAL_FOR, () => {
      shownLongEnough = true;
      next();
    });
  };

  const finishRun = () => {
    phase = 'done';
    hud.hideBanner();
    hud.hideQuestion(true);
    camMode = 'home';
    const runs = state.runs;
    const stars = starsFor(feed.correct, feed.answered);
    session.recordStars(stars);
    const newHighScore = session.recordScore(runs);
    refresh();
    if (newHighScore) sfx.cheer();
    speak(`You scored ${runs} ${runs === 1 ? 'run' : 'runs'}!`);
    showResults({
      topicId: session.topic.id,
      correct: feed.correct,
      total: feed.answered,
      stars,
      newBest: false,
      missed: feed.missed(),
      playerName: session.player?.name,
      score: runs,
      highScore: session.highScore(),
      newHighScore,
      playAgainLabel: 'Play ball ⚾',
      onPlayAgain: () => startRun(false),
    });
  };

  // ---------- Run flow ----------
  const startRun = (withLesson: boolean) => {
    pending = [];
    scenery = [];
    turn++;
    speechToken++;
    struckOut = false;
    stopSpeaking();
    feed = createFactFeed(() => session.chooseFacts());
    state = newGame();
    shown.runs = shown.strikes = shown.outs = 0;
    shown.batter = 1;
    fact = undefined;
    options = [];
    plan = null;
    held = null;
    dash = null;
    chasers = [];
    camMode = 'home';
    effects.clear();
    effects.onBurst = null;
    ball.setVisible(false);
    // Clear the bases and bring on the first batter.
    [...spawned].forEach(retire);
    props = [];
    onBase = [null, null, null];
    running = [];
    leaving = [];
    batter = createBatter();
    batter.setLook(0);
    spawn(batter.person.root);
    fielders.forEach((f) => {
      f.mover.halt();
      f.mover.place(f.home.x, f.home.z);
      f.setMode('ready');
      f.mover.face({ x: 0, y: 0, z: 0 });
    });
    pitcher.reset();
    umpire.reset();
    refresh();
    hud.hideQuestion(true);
    hud.hideBanner();
    if (!withLesson) {
      startIntro();
      return;
    }
    phase = 'lesson';
    showLesson({ topic: session.topic, facts: feed.peek(10), onDone: startIntro });
  };

  /** "Play ball!" and then the first pitch. */
  const startIntro = () => {
    phase = 'intro';
    hud.showBanner('Play ball!', '', 'info');
    speak('Play ball!');
    sfx.cheer();
    after(1.6, () => {
      if (phase === 'intro') nextPitch();
    });
  };

  // ---------- Input ----------
  /** A tap while a result is showing skips ahead, so it never feels ignored. */
  const skip = () => {
    if (phase === 'result' && gameTime - resultAt >= SKIP_AFTER) advance();
    else if (phase === 'hit' && hitT >= HIT_SKIP_AFTER) endPlay();
  };
  const onAnswer = (index: number) => {
    if (phase === 'windup' || phase === 'release' || phase === 'pitch') select(index);
    else skip();
  };
  const unpress = hud.buttons.map((button, i) => {
    // A touch press doesn't count as a user gesture for iOS audio; the release does.
    button.addEventListener('pointerup', unlockAudio);
    return onPress(button, () => onAnswer(i));
  });
  hud.hear.addEventListener('click', () => {
    unlockAudio();
    if (fact) {
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
  const runTimers = (list: { at: number; fn: () => void }[]) => {
    const due = list.filter((p) => p.at <= gameTime);
    if (!due.length) return list;
    due.forEach((p) => p.fn());
    return list.filter((p) => !due.includes(p));
  };

  ctx.onUpdate((delta, time) => {
    layout();
    gameTime += delta;
    pending = runTimers(pending);
    scenery = runTimers(scenery);

    // --- The people ---
    pitcher.update(delta, time);
    catcher.update(delta, time);
    umpire.update(delta, time);
    const figures = new Set<Batter>([batter, ...running.map((r) => r.batter), ...leaving]);
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
    if (phase === 'hit') updateHit(delta);
    if (phase === 'result' || phase === 'swing') {
      // The ball stays in the mitt.
      if (!dash && phase === 'result') ball.place(GLOVE);
    }
    effects.update(delta);

    // --- The camera: behind the plate, or following the ball ---
    let goalFov = fit.fov;
    let goalShift = fit.shift;
    if (camMode === 'follow' && plan) {
      // Once the fireworks are up, the shot is of the scoreboard and the bursts.
      const closing = fireworksFrom === Infinity && plan.overWall && hitT >= plan.airTime * 0.78;
      followGoal(closing ? fireworksAim() : ballPos, goalPos, goalLook, home);
      if (closing) {
        goalFov = hitFrame.fireworks.fov;
        goalShift = hitFrame.fireworks.shift;
      } else {
        goalShift = hitFrame.shift;
        keepBoardClear(ballPos, goalPos, goalLook, fit.fov, viewW, viewH, hitFrame.band);
      }
    } else {
      Object.assign(goalPos, home.cam);
      Object.assign(goalLook, home.look);
    }
    const follow = camMode === 'follow';
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
