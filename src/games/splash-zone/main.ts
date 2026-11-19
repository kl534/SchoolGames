import { pressAnswers } from '../../shared/answers';
import { sfx, speak, stopSpeaking, unlockAudio } from '../../shared/audio';
import { createFactFeed, type FactFeed } from '../../shared/feed';
import { createRide, type Ride, type RideDriver } from '../../shared/jetski/ride';
import {
  GREAT_RIDING_SPEECH,
  NEW_HIGH_SCORE_SPEECH,
  OUT_OF_SKIS_SPEECH,
} from '../../shared/jetski/rules';
import { hideFactMap, showFactMap } from '../../shared/maps';
import { showPreview } from '../../shared/preview';
import { showResults } from '../../shared/results';
import { starsFor } from '../../shared/round';
import { startGameSession, type GameSession } from '../../shared/session';
import { createTapFlow } from '../../shared/tapflow';
import { answerOptions, promptSpeech, type Fact } from '../../shared/topics';
import { menuUrl } from '../../shared/ui';
import { devOptions } from './dev';

const GAME_ID = 'splash-zone';

/**
 * Splash Zone is the quiz on the shared jet-ski ride: each turn asks a fact and the player taps one
 * of four answers; this file is the ride's driver (facts, answers, the reveal after a miss, the
 * results). The ski, the camera, the tricks, the worlds and the Mega Stunts are in the ride.
 */
function run(session: GameSession): void {
  const container = document.getElementById('game');
  if (!container) throw new Error('Missing #game container');

  let feed: FactFeed = createFactFeed(() => session.chooseFacts());
  let fact: Fact | undefined;
  let options: string[] = [];
  let chosen = -1;
  /** The turn has been answered or has timed out. */
  let answered = false;
  /** The turn rides to a checkpoint gate: once answered the ride goes on and the prompt is gone. */
  let gateTurn = false;
  /** Ticks up for each turn and cut-off, so a late callback can tell it is stale. */
  let token = 0;
  const tapFlow = createTapFlow();

  const driver: RideDriver = {
    intro(go) {
      showPreview({ topic: session.topic, facts: feed.peek(10), onDone: go });
    },

    beginTurn({ target }) {
      const thisToken = ++token;
      fact = feed.take();
      const current = fact;
      const { hud } = ride;
      options = answerOptions(session.topic, current, hud.buttons.length);
      chosen = -1;
      answered = false;
      gateTurn = target === 'gate';
      hud.setAnswers(options);
      hud.problemText.textContent = current.prompt;
      showFactMap(current);
      const seconds = Math.max(session.timerSecondsFor(current), 1);
      ride.setClock(seconds);
      hud.setTopVisible(true, options.length);
      // The clock starts once the question has been read out, as long as this turn is current.
      speak(promptSpeech(current), () => {
        if (token !== thisToken || ride.phase !== 'riding') return;
        ride.startClock(seconds);
      });
    },

    timeUp() {
      if (!fact) return;
      const current = fact;
      chosen = -1;
      answered = true;
      ride.hud.lockAnswers();
      feed.recordMiss(current);
      hideFactMap();
      session.recordAnswer(current, false);
      ride.hud.buttons[options.indexOf(current.answer)]?.classList.add('right');
    },

    afterMiss() {
      const current = fact;
      if (!current) return { detail: '', wait: false };
      const { hud } = ride;
      tapFlow.reveal(hud.buttons, options, current, {
        avoid: [hud.top, hud.banner],
        problem: current.prompt,
        chosen: options[chosen],
        delay: 0.6,
      });
      return { detail: current.statement, wait: true };
    },

    ending() {
      const last = fact;
      // No fact to wait on: the ride says it and shows the end.
      if (!last) return { detail: '', wait: false, say: OUT_OF_SKIS_SPEECH };
      // The question and answers stay up: the player taps the green one before the results appear.
      const { hud } = ride;
      tapFlow.reveal(hud.buttons, options, last, {
        avoid: [hud.top, hud.banner],
        problem: last.prompt,
        lead: OUT_OF_SKIS_SPEECH,
        chosen: options[chosen],
      });
      return { detail: last.statement, wait: true };
    },

    finish(score, again) {
      hideFactMap();
      const stars = starsFor(feed.correct, feed.answered);
      session.recordStars(stars);
      const newHighScore = session.recordScore(score);
      ride.hud.setScore(score, Math.max(session.highScore(), 0));
      if (newHighScore) sfx.goal();
      speak(newHighScore ? NEW_HIGH_SCORE_SPEECH : GREAT_RIDING_SPEECH);
      showResults({
        topicId: session.topic.id,
        steps: session.takeStepReport(),
        correct: feed.correct,
        total: feed.answered,
        stars,
        newBest: false,
        missed: feed.missed(),
        playerName: session.player?.name,
        score,
        highScore: session.highScore(),
        newHighScore,
        playAgainLabel: 'Ride again 🌊',
        onPlayAgain: () => {
          feed = createFactFeed(() => session.chooseFacts());
          fact = undefined;
          options = [];
          again();
        },
      });
    },

    cancel() {
      token++;
      tapFlow.disarm();
    },

    frame(delta) {
      tapFlow.update(delta);
    },

    dispose() {
      window.removeEventListener('keydown', onKey);
      tapFlow.dispose();
      unpress();
    },
  };

  const ride: Ride = createRide(container, {
    avatar: session.player?.avatar ?? '⭐',
    driver,
    dev: devOptions(),
    highScore: () => session.highScore(),
    answers: true,
  });
  const { buttons } = ride.hud;

  /** The player picks an answer. */
  const select = (index: number) => {
    if (ride.phase !== 'riding' || !fact || answered || options[index] === undefined) return;
    try {
      unlockAudio();
      stopSpeaking();
    } catch {
      // Audio trouble must never stop the ride.
    }
    const current = fact;
    chosen = index;
    answered = true;
    ride.hud.lockAnswers();
    const correct = options[index] === current.answer;
    buttons[index].classList.add('chosen');
    hideFactMap();
    if (correct) {
      feed.recordHit(current);
      session.recordAnswer(current, true);
      buttons.forEach((b, i) => b.classList.add(i === index ? 'right' : 'gone'));
    } else {
      feed.recordMiss(current);
      session.recordAnswer(current, false);
      buttons[index].classList.add('wrong');
      buttons[options.indexOf(current.answer)]?.classList.add('right');
    }
    ride.answer(correct);
  };

  /** A tap on an answer: it picks one, or goes on from a reveal, or fast-forwards a trick. */
  const onAnswer = (index: number) => {
    if (tapFlow.armed) {
      if (tapFlow.tap(index)) ride.proceed();
      return;
    }
    if (ride.phase === 'riding') select(index);
    else ride.skip();
  };
  const unpress = pressAnswers(buttons, onAnswer);
  ride.hud.hear?.addEventListener('click', () => {
    unlockAudio();
    // Once a gate's question is answered it is gone, until a miss shows it again.
    const gone = gateTurn && answered && !['result', 'ending', 'done'].includes(ride.phase);
    if (fact && !gone) speak(promptSpeech(fact));
  });
  const onKey = (e: KeyboardEvent) => {
    if (ride.paused) return;
    const index = Number(e.key) - 1;
    if (index >= 0 && index < buttons.length) onAnswer(index);
  };
  window.addEventListener('keydown', onKey);
}

const session = startGameSession(GAME_ID);
if (session) run(session);
else location.replace(menuUrl());
