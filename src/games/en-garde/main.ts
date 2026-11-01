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
import { autoAnswer, devPokes, devRival, devRung, forcedPoke, freezeAt, skipVs } from './dev';
import { createEffects, createWords } from './effects';
import { createFighter, RIVAL_LOOKS, US_LOOK, type Fighter } from './fighters';
import { createHealthBars } from './hud';
import { CAM_FOV, CAM_Y, fitCamera, LOOK_Y, playBand, type PlayBand } from './layout';
import {
  CONTACT_T,
  finishFrame,
  FINISH_AIM,
  FINISH_LAUNCH,
  FINISH_SPLAT,
  HIP_STAND,
  NEXT_GAP,
  pokeFrame,
  POKE_AIM,
  POKE_TOTAL,
  restFrame,
} from './moves';
import { buildParty } from './party';
import {
  boutStars,
  CHAMPION_RUNG,
  CHAMPION_SPEECH,
  EN_GARDE_SPEECH,
  FINISH_WORD,
  newBout,
  nextRung,
  outcomeText,
  pickCall,
  pickPoke,
  POKE_WORD,
  rivalFor,
  RIVALS,
  rungLabel,
  SO_CLOSE_SPEECH,
  step,
  VICTORY_SPEECH,
  type Bout,
  type PokeKind,
} from './rules';
import { showVs } from './vs';

const GAME_ID = 'en-garde';

/** Longest "En garde!" banner, in seconds. */
const EN_GARDE_FOR = 1.5;
/** Seconds the "TOO SLOW!" banner shows. */
const TOO_SLOW_FOR = 1;
/** Seconds from the last line of a win until the results. */
const WIN_RESULTS_AFTER = 1.5;
/** Seconds from the tap after a loss until the results. */
const LOSS_RESULTS_AFTER = 2.5;
/** How high on a fighter each poke lands, as a fraction of their height. */
const POKE_HEIGHT: Record<PokeKind, number> = { belly: 0.5, head: 1.0, nose: 0.9, bottom: 0.35 };
/** The sound each kind of reaction adds to the squeak. */
const POKE_EXTRA: Partial<Record<PokeKind, () => void>> = {
  head: () => sfx.boing(),
  nose: () => sfx.honk(),
  bottom: () => sfx.boing(),
};

type Phase =
  'vs' | 'preview' | 'engarde' | 'asking' | 'poke' | 'tap' | 'finish' | 'ending' | 'done';

interface Move {
  kind: 'poke' | 'finish';
  poke: PokeKind;
  attacker: Fighter;
  victim: Fighter;
  t: number;
  contacted: boolean;
  launched: boolean;
  splatted: boolean;
  onContact: () => void;
  onLaunch?: () => void;
  onSplat?: () => void;
  onEnd?: () => void;
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
  const effects = createEffects();
  const party = buildParty(effects);
  const you = createFighter('us', US_LOOK);
  const rival = createFighter('them', RIVAL_LOOKS.pip);
  scene.add(party.object, you.object, rival.object, effects.object);

  // ---------- HUD ----------
  const bars = createHealthBars();
  const hud = el('div', 'eg-hud', document.body);
  const problem = el('div', 'eg-problem', hud);
  problem.setAttribute('aria-live', 'polite');
  const problemText = el('span', 'eg-problem-text', problem);
  const hear = el('button', 'eg-hear', problem);
  hear.type = 'button';
  hear.textContent = '🔊';
  hear.setAttribute('aria-label', 'Hear the question');
  const clockBar = el('div', 'eg-clock', hud);
  const clockFill = el('div', 'eg-clock-fill', clockBar);
  const answers = el('div', 'eg-answers', document.body);
  const buttons = Array.from({ length: 4 }, () => {
    const button = el('button', 'eg-answer', answers);
    button.type = 'button';
    return button;
  });
  const banner = el('div', 'eg-banner', document.body);
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
  let bout: Bout = newBout(0);
  /** The ladder place this bout began at. */
  let rung = 0;
  let lastRival: number | undefined;
  let lastPoke: PokeKind | undefined;
  let lastCall: string | undefined;
  let tauntCount = 0;
  /** Ticks up for each question and bout, so late callbacks can tell they are stale. */
  let turn = 0;
  let move: Move | null = null;
  /** Dev: the first move is held at `?at=` and time stands still. */
  let frozen = false;
  let freezeUsed = false;
  let frozenAt = 0;
  let autoUsed = false;
  let clockRunning = false;
  let clockTotal = 1;
  let clockLeft = 1;
  let lastTick = 0;
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

  /** The clear space between the question (and bars) and the answers, as the HUD really lays out. */
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
      x: MathUtils.clamp(((p.x + 1) / 2) * viewW, 70, viewW - 70),
      y: MathUtils.clamp(((1 - p.y) / 2) * viewH, band.top + 24, band.bottom - 24),
    };
  };

  // ---------- HUD helpers ----------
  /** The bars show during a bout; the question and answers only while a question is up. */
  const showHud = (barsOn: boolean, questionOn: boolean) => {
    bars.setVisible(barsOn);
    hud.hidden = !questionOn;
    answers.hidden = !questionOn;
    buttons.forEach((b, i) => (b.hidden = options[i] === undefined));
    refit = true;
  };

  /** `top` puts the banner under the bars instead of the middle, so the cake stays clear. */
  const showBanner = (text: string, bad = false, top = false) => {
    banner.textContent = text;
    banner.className = bad ? 'eg-banner bad' : 'eg-banner';
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

  /** A comic word at the point of a poke on a fighter. */
  const popWord = (text: string, victim: Fighter, kind: PokeKind | null) => {
    const spot = victim.bodyPoint(kind ? POKE_HEIGHT[kind] : 0.6);
    // A frozen dev shot keeps the word, unless the move has gone on to where it would be gone.
    const hold = frozen && (kind !== null || frozenAt < 1.2);
    words.pop(text, toScreen({ x: spot.x, y: spot.y + 0.15, z: 0.6 }), hold);
  };

  // ---------- Moves ----------
  const rest = () => {
    you.setFrame(restFrame());
    rival.setFrame(restFrame());
  };

  const startMove = (m: Omit<Move, 't' | 'contacted' | 'launched' | 'splatted'>) => {
    move = { ...m, t: 0, contacted: false, launched: false, splatted: false };
    // Dev: jump to the time of `?at=` in the first move; a poke that has finished carries on.
    const at = freezeAt();
    if (at !== null && !freezeUsed) {
      freezeUsed = true;
      if (m.kind === 'finish') {
        frozen = true;
        frozenAt = at;
        move.t = at;
      } else if (at < POKE_TOTAL) {
        frozen = true;
        frozenAt = at;
        move.t = at;
      } else {
        move.t = POKE_TOTAL;
      }
    }
  };

  /** Advances the move in progress, plays the frames and fires its events in order. */
  const updateMove = (delta: number) => {
    const m = move;
    if (!m) return;
    m.t += delta;
    const t = m.t;
    if (m.kind === 'poke') {
      const f = pokeFrame(m.poke, t);
      m.attacker.setFrame(f.attacker, POKE_AIM[m.poke]);
      m.victim.setFrame(f.victim, 0);
    } else {
      const f = finishFrame(t, m.victim.stanceX);
      m.attacker.setFrame(f.attacker, FINISH_AIM);
      const u = MathUtils.clamp((t - FINISH_LAUNCH) / (FINISH_SPLAT - FINISH_LAUNCH), 0, 1);
      const pos = { ...f.victimPos };
      // From the hip of a smaller or taller fighter into the common arc.
      pos.y += (m.victim.hipHeight() - HIP_STAND) * (1 - u);
      m.victim.setFrame(f.victim, 0, t >= FINISH_LAUNCH ? pos : undefined);
    }
    if (!m.contacted && t >= CONTACT_T) {
      m.contacted = true;
      m.onContact();
    }
    if (m.kind === 'finish') {
      if (!m.launched && t >= FINISH_LAUNCH) {
        m.launched = true;
        m.onLaunch?.();
      }
      if (!m.splatted && t >= FINISH_SPLAT) {
        m.splatted = true;
        m.victim.setMode('kick');
        m.onSplat?.();
      }
    } else if (t >= POKE_TOTAL) {
      move = null;
      rest();
      m.onEnd?.();
    }
  };

  // ---------- Bout flow ----------
  const startBout = () => {
    tapFlow.disarm();
    timers.clear();
    turn++;
    stopSpeaking();
    words.clear();
    effects.clear();
    party.cake.reset();
    vs?.dispose();
    preview?.dispose();
    vs = preview = null;
    move = null;
    frozen = false;
    autoUsed = false;
    clockRunning = false;
    tauntCount = 0;
    banner.hidden = true;
    fact = undefined;
    options = [];

    rung = devRung() ?? session.ladderRung();
    const index = devRival() ?? rivalFor(rung, Math.random(), lastRival);
    const foe = RIVALS[index];
    bout = newBout(index);
    const start = devPokes(bout.pokesToWin);
    if (start) bout = { ...bout, landed: start.landed, taken: start.taken };
    feed = createFactFeed(() => session.chooseFacts());

    rival.setLook(RIVAL_LOOKS[foe.id]);
    you.setLook(US_LOOK);
    you.setCrowned(rung === CHAMPION_RUNG);
    you.setMode('idle');
    rival.setMode('idle');
    rest();
    bars.setup({
      playerName: session.player?.name ?? 'You',
      rivalName: foe.name,
      rungText: rungLabel(rung, index),
      rivalSegments: bout.pokesToWin,
      ourLeft: 3 - bout.taken,
      rivalLeft: bout.pokesToWin - bout.landed,
    });
    showHud(false, false);

    const toPreview = () => {
      phase = 'preview';
      showHud(false, false);
      preview = showPreview({
        topic: session.topic,
        facts: feed.peek(10),
        onDone: beginFight,
      });
    };
    if (auto) {
      beginFight();
      return;
    }
    if (skipVs()) {
      toPreview();
      return;
    }
    phase = 'vs';
    speak(foe.intro);
    vs = showVs({
      rung,
      rival: index,
      onFight: () => {
        unlockAudio();
        toPreview();
      },
    });
  };

  /** "En garde!", then the first question. */
  const beginFight = () => {
    const thisTurn = ++turn;
    if (auto) {
      nextTurn();
      return;
    }
    phase = 'engarde';
    showHud(true, false);
    showBanner('EN GARDE!');
    const go = () => {
      if (turn !== thisTurn || phase !== 'engarde') return;
      nextTurn();
    };
    speak(EN_GARDE_SPEECH, go);
    after(EN_GARDE_FOR, go);
  };

  /** Shows the next question and reads it out; the clock starts when the reading ends. */
  const nextTurn = () => {
    tapFlow.disarm();
    timers.clear();
    stopSpeaking();
    banner.hidden = true;
    const next = feed.take();
    fact = next;
    const thisTurn = ++turn;
    options = answerOptions(session.topic, next, buttons.length);
    fillAnswers(buttons, options, 'eg-answer');
    problemText.textContent = next.prompt;
    problem.classList.remove('wrong');
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

  const onAnswer = (index: number) => {
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
    if (options[index] === fact.answer) right(index);
    else miss(index);
  };

  /** A right answer: we poke the rival, or land the finishing poke. */
  const right = (index: number) => {
    if (!fact) return;
    phase = 'poke';
    clockRunning = false;
    lockAnswers(buttons);
    markAnswers(buttons, index, index, true);
    feed.recordHit(fact);
    session.recordAnswer(fact, true);
    bout = step(bout, true);
    if (bout.winner === 'us') {
      victory();
      return;
    }
    const kind = forcedPoke() ?? pickPoke(Math.random(), lastPoke);
    lastPoke = kind;
    startMove({
      kind: 'poke',
      poke: kind,
      attacker: you,
      victim: rival,
      onContact: () => {
        bars.lose('them');
        you.hit();
        sfx.squeak();
        POKE_EXTRA[kind]?.();
        popWord(POKE_WORD[kind], rival, kind);
        lastCall = pickCall(Math.random(), lastCall);
        speak(lastCall);
        party.kids.cheer(1);
      },
    });
    const thisTurn = turn;
    after(NEXT_GAP, () => {
      if (turn === thisTurn) nextTurn();
    });
  };

  /** A wrong answer (`index` -1 after a time-out): the rival pokes us, then the green answer waits. */
  const miss = (index: number) => {
    const current = fact;
    if (!current) return;
    phase = 'poke';
    clockRunning = false;
    lockAnswers(buttons);
    if (index >= 0) buttons[index].classList.add('wrong');
    feed.recordMiss(current);
    session.recordAnswer(current, false);
    bout = step(bout, false);
    const lost = bout.winner === 'them';
    const thisTurn = turn;
    const foe = RIVALS[bout.rival];
    const taunt = foe.taunts[tauntCount++ % 2];
    let moveDone = false;
    let tauntDone = false;
    const ready = () => {
      if (!moveDone || !tauntDone || turn !== thisTurn) return;
      phase = 'tap';
      showHud(true, true);
      buttons[options.indexOf(current.answer)]?.classList.add('right');
      tapFlow.reveal(buttons, options, current, {
        chosen: index >= 0 ? options[index] : undefined,
        avoid: [bars.root, hud],
        problem: current.prompt,
      });
    };
    const sayTaunt = () =>
      speak(taunt, () => {
        tauntDone = true;
        ready();
      });

    if (lost) {
      phase = 'finish';
      startMove({
        kind: 'finish',
        poke: 'belly',
        attacker: rival,
        victim: you,
        onContact: () => {
          // The finisher has the screen to itself until the tap flow needs the answers.
          showHud(true, false);
          bars.lose('us');
          rival.hit();
          sfx.squeak();
          sayTaunt();
        },
        onLaunch: () => sfx.slideWhistle(),
        onSplat: () => {
          sfx.splat();
          party.cake.splat();
          party.kids.slump(2.5);
          moveDone = true;
          phase = 'finish';
          ready();
        },
      });
      sfx.whoosh();
      return;
    }

    const kind = forcedPoke() ?? pickPoke(Math.random(), lastPoke);
    lastPoke = kind;
    startMove({
      kind: 'poke',
      poke: kind,
      attacker: rival,
      victim: you,
      onContact: () => {
        bars.lose('us');
        rival.hit();
        sfx.squeak();
        POKE_EXTRA[kind]?.();
        popWord(POKE_WORD[kind], you, kind);
        sayTaunt();
        party.kids.slump(1);
      },
      onEnd: () => {
        moveDone = true;
        ready();
      },
    });
  };

  /** Time ran out: counts as a wrong answer with no wrong button. */
  const timeUp = () => {
    showBanner('TOO SLOW!', true);
    const thisTurn = turn;
    after(TOO_SLOW_FOR, () => {
      if (turn === thisTurn) banner.hidden = true;
    });
    miss(-1);
  };

  /** The tap on the green answer: the next question, or the end of a lost bout. */
  const afterGreenTap = () => {
    if (bout.winner !== 'them') {
      nextTurn();
      return;
    }
    const thisTurn = ++turn;
    phase = 'ending';
    showHud(true, false);
    showBanner('SO CLOSE!', true, true);
    sfx.aww();
    rival.setMode('dance');
    speak(SO_CLOSE_SPEECH);
    after(LOSS_RESULTS_AFTER, () => {
      if (turn === thisTurn) results(false);
    });
  };

  /** The final poke: the rival is launched into the cake. */
  const victory = () => {
    const thisTurn = ++turn;
    phase = 'finish';
    startMove({
      kind: 'finish',
      poke: 'belly',
      attacker: you,
      victim: rival,
      onContact: () => {
        showHud(true, false);
        bars.lose('them');
        you.hit();
        sfx.squeak();
        popWord(FINISH_WORD, rival, null);
      },
      onLaunch: () => sfx.slideWhistle(),
      onSplat: () => {
        sfx.splat();
        party.cake.splat();
        effects.confetti();
        sfx.bigCheer();
        party.kids.cheer(2.5);
        you.setMode('victory');
        showBanner('VICTORY!', false, true);
        const toResults = () => after(WIN_RESULTS_AFTER, () => turn === thisTurn && results(true));
        speak(VICTORY_SPEECH, () => {
          if (turn !== thisTurn) return;
          if (rung === CHAMPION_RUNG - 1) {
            // Beating the champion: the crown drops onto our head.
            you.setCrowned(true, true);
            speak(CHAMPION_SPEECH, toResults);
          } else {
            toResults();
          }
        });
      },
    });
    sfx.whoosh();
  };

  const results = (won: boolean) => {
    phase = 'done';
    tapFlow.disarm();
    words.clear();
    showHud(false, false);
    banner.hidden = true;
    const foe = RIVALS[bout.rival];
    session.recordLadderRung(nextRung(rung, won));
    const stars = boutStars(won, bout.taken, bout.landed);
    const newBest = session.recordStars(stars);
    lastRival = bout.rival;
    showResults({
      topicId: session.topic.id,
      correct: feed.correct,
      total: feed.answered,
      stars,
      newBest,
      missed: feed.missed(),
      playerName: session.player?.name,
      outcome: outcomeText(rung, foe, won, bout.landed, bout.taken),
      playAgainLabel: 'Fight again 🎈',
      onPlayAgain: startBout,
    });
  };

  // ---------- Input ----------
  const unpress = pressAnswers(buttons, onAnswer);
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
    const dt = frozen ? 0 : delta;
    tapFlow.update(dt);
    timers.update(dt);

    // The question clock runs once the question has been read out.
    if (phase === 'asking' && clockRunning && !frozen) {
      clockLeft -= delta;
      setClock(clockLeft / clockTotal);
      const seconds = Math.ceil(clockLeft);
      if (seconds < lastTick && seconds > 0 && seconds <= 3) sfx.tick();
      lastTick = seconds;
      if (clockLeft <= 0) timeUp();
      // Dev: answer the first question a little after its reading ends.
      if (auto && !autoUsed && clockTotal - clockLeft >= 0.3 && fact) {
        autoUsed = true;
        const right = options.indexOf(fact.answer);
        const wrong = options.findIndex((o) => o !== fact?.answer);
        onAnswer(auto === 'right' ? right : wrong);
      }
    }

    updateMove(dt);
    you.update(dt, elapsed);
    rival.update(dt, elapsed);
    party.update(delta, elapsed);
    effects.update(delta);

    // Fixed camera, eased to its fit.
    const ease = 1 - Math.exp(-8 * delta);
    camDistance += (wantDistance - camDistance) * ease;
    camShift += (wantShift - camShift) * ease;
    camera.position.set(0, CAM_Y, camDistance);
    camera.lookAt(0, LOOK_Y, 0);
    camera.setViewOffset(viewW, viewH, 0, -camShift, viewW, viewH);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  });

  layout();
  showHud(false, false);
  ctx.start();
  startBout();

  window.addEventListener('pagehide', () => {
    stopSpeaking();
    window.removeEventListener('keydown', onKey);
    unpress();
    tapFlow.dispose();
    pause.dispose();
    mute.dispose();
    words.clear();
    effects.clear();
    vs?.dispose();
    preview?.dispose();
    ctx.dispose();
  });
}

const session = startGameSession(GAME_ID);
if (session) run(session);
else location.replace(menuUrl());
