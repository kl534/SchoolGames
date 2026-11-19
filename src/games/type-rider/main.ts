import { sfx, speak, unlockAudio } from '../../shared/audio';
import { createRide, type Ride, type RideDriver, type RideTurn } from '../../shared/jetski/ride';
import { showResults } from '../../shared/results';
import { starsFor } from '../../shared/round';
import { createBlockView } from '../../shared/typing/block';
import { planBlock } from '../../shared/typing/blocks';
import { TYPING_LEVELS, levelOf, multiplier, skillOf } from '../../shared/typing/course';
import { createKeyboard } from '../../shared/typing/keyboard';
import { onTypingKey } from '../../shared/typing/keys';
import { showKeyLesson } from '../../shared/typing/lesson';
import { showLevelPicker, type LevelPicker } from '../../shared/typing/picker';
import {
  HISTORY,
  SPEED_STREAK,
  TYPING_LEVEL_ID,
  clockFor,
  levelPassed,
  levelUp,
  nextSpk,
  openLevel,
  recordPress,
  skillLearned,
} from '../../shared/typing/progress';
import { startTypingSession, type TypingSession } from '../../shared/typing/session';
import { showTestOut } from '../../shared/typing/testout';
import { devOptions } from './dev';
import {
  blockKeys,
  blockOutcome,
  emptyStats,
  resultsText,
  speedStreak,
  type BlockResult,
} from './rules';

const GAME_ID = 'type-rider';

/** Seconds a block waits before its clock starts (the ski gets a moment to line up). */
const READ_SECONDS = 0.5;

const clamp = (n: number, low: number, high: number): number => Math.min(Math.max(n, low), high);

/**
 * Type Rider is the typing game on the shared jet-ski ride: each turn shows a short block of keys
 * in the top panel and the player types it on a real keyboard before the ski reaches the
 * launcher. This file is the ride's driver (blocks, keys, the keyboard strip, level-ups, the start
 * screen and the results). Only the lesson speaks; nothing else here reads aloud.
 */
function run(session: TypingSession): void {
  const container = document.getElementById('game');
  if (!container) throw new Error('Missing #game container');

  const dev = devOptions();
  /** With any dev hook nothing is saved. */
  const hooked = dev?.hooked ?? false;
  const typing = session.typing;
  const save = () => {
    if (!hooked) session.save();
  };

  if (dev?.level) {
    // The level is open in memory, with the keys of the levels before it learned.
    openLevel(typing, dev.level);
    typing.level = dev.level;
    for (const level of TYPING_LEVELS) {
      if (level.n >= dev.level) break;
      for (const skill of level.skills) typing.keys[skill] = '1'.repeat(HISTORY);
    }
  }
  if (dev?.spk) typing.spk = dev.spk;
  typing.level = clamp(typing.level, 1, typing.open);

  // ---------- The ride's pieces: the block, the keyboard strip ----------
  const block = createBlockView();
  const keyboard = createKeyboard({ hands: false });
  keyboard.element.classList.add('tr-kb');
  keyboard.element.dataset.hidden = '';
  document.body.appendChild(keyboard.element);
  const showKeyboard = (shown: boolean) => {
    if (shown) delete keyboard.element.dataset.hidden;
    else keyboard.element.dataset.hidden = '';
  };

  const note = document.createElement('div');
  note.className = 'tr-note';
  note.hidden = true;
  const noteTitle = document.createElement('strong');
  noteTitle.textContent = 'Type Rider needs a keyboard ⌨️';
  note.append(noteTitle, 'Plug one in or open it, then press the space bar.');
  document.body.appendChild(note);

  // ---------- State ----------
  /** The level being played (the picker's choice; the next one after a level-up and a world). */
  let playLevel = typing.level;
  /** A level that opened in this world: its lesson shows at the next one. */
  let pendingLevel: number | null = null;
  let stats = emptyStats();
  let opened: number[] = [];
  /** Blocks in a row at the goal speed, on a speed level. */
  let speedRun = 0;
  let levelupUsed = false;
  let firstBlock = true;
  /** A block is up and takes keys. */
  let blockOn = false;
  /** The turn has settled (a key that started it is over). */
  let blockReady = false;
  /** Positions of the block typed wrong at least once. */
  const wrongAt = new Set<number>();
  let firstKeyAt: number | null = null;
  /** Ticks up for each turn and cut-off, so a late callback can tell it is stale. */
  let token = 0;
  let picker: LevelPicker | null = null;

  const speedLevel = () => levelOf(playLevel).kind === 'speed';

  /** Skills a char needs: a capital needs its letter and its Shift. */
  const skillsOf = (char: string): string[] =>
    char !== char.toLowerCase() && /[A-Z]/.test(char)
      ? [char.toLowerCase(), skillOf(char)]
      : [skillOf(char)];
  const learned = (char: string) => skillsOf(char).every((skill) => skillLearned(typing, skill));

  /** Lights the next key unless it is learned; the whole strip fades when every key of the block is. */
  const paintKeyboard = () => {
    const next = block.current;
    keyboard.light(next !== null && !learned(next) ? next : null);
    keyboard.setFaint([...block.text].every(learned));
  };

  // ---------- Level up ----------
  const pop = (text: string, y: number, kind: 'good' | 'plain') =>
    ride.hud.pop(text, { x: window.innerWidth / 2, y: window.innerHeight * y }, kind);

  /** After a block on the open level: does the level pass? Opens the next one. */
  const checkLevelUp = (result: BlockResult) => {
    if (playLevel !== typing.open) return;
    let passed: boolean;
    if (speedLevel()) {
      speedRun = speedStreak(speedRun, playLevel, result);
      passed = speedRun >= SPEED_STREAK;
    } else {
      passed = levelPassed(typing, playLevel);
    }
    if (dev?.levelup && !levelupUsed) {
      levelupUsed = true;
      passed = true;
    }
    if (!passed) return;
    const next = levelUp(typing);
    if (next === null) return;
    speedRun = 0;
    opened.push(next);
    pendingLevel = next;
    pop(`Level ${next} opened!`, 0.3, 'plain');
    sfx.chime();
  };

  // ---------- A block ----------
  const finishBlock = () => {
    blockOn = false;
    const keys = block.text.length;
    const mistakes = wrongAt.size;
    const seconds = firstKeyAt === null ? 0 : (performance.now() - firstKeyAt) / 1000;
    const result: BlockResult = { keys, mistakes, seconds };
    const outcome = blockOutcome(mistakes);
    stats.keys += keys;
    stats.right += keys - mistakes;
    stats.fastKeys += keys;
    stats.fastSeconds += seconds;
    if (!speedLevel())
      typing.spk = nextSpk(typing.spk, outcome === 'perfect' ? 'perfect' : 'mistakes');
    if (outcome === 'perfect') pop('Perfect!', 0.36, 'good');
    checkLevelUp(result);
    save();
    ride.answer(true, { resetStreak: mistakes > 0 });
  };

  const onKey = (char: string) => {
    if (ride.paused || !blockOn || !blockReady || ride.phase !== 'riding') return;
    const expected = block.current;
    if (expected === null) return;
    firstKeyAt ??= performance.now();
    if (char === expected) {
      if (!wrongAt.has(block.position)) recordPress(typing, expected, true);
      keyboard.flash(char, 'right');
      sfx.key();
      block.advance();
      if (block.current === null) finishBlock();
      else paintKeyboard();
    } else {
      if (!wrongAt.has(block.position)) {
        wrongAt.add(block.position);
        recordPress(typing, expected, false);
      }
      keyboard.flash(char, 'wrong');
      sfx.wrongKey();
      block.wrong();
    }
  };

  // ---------- The start screen and the lessons ----------
  /** Shows the level's lesson (once, or always with `force`), then `next`. */
  const lessonThen = (level: number, force: boolean, next: () => void) => {
    if (!force && typing.lessons.includes(level)) {
      next();
      return;
    }
    const done = () => {
      if (!typing.lessons.includes(level)) typing.lessons.push(level);
      save();
      next();
    };
    showKeyLesson({
      level,
      onDone: done,
      onSkip: done,
      speak,
      paused: () => ride.paused,
    });
  };

  /** The start screen: pick a level, test out of a locked one, see a lesson again, press the space bar. */
  const openPicker = (begin: () => void) => {
    picker?.dispose();
    const mine: LevelPicker = showLevelPicker({
      typing,
      selected: typing.level,
      onPick(n) {
        typing.level = n;
        save();
      },
      onTestOut(n) {
        mine.dispose();
        showTestOut({
          level: n,
          onDone(passed) {
            if (passed) {
              openLevel(typing, n);
              typing.level = n;
              save();
            }
            openPicker(begin);
          },
        });
      },
      onLesson(n) {
        mine.dispose();
        lessonThen(n, true, () => openPicker(begin));
      },
      onStart() {
        mine.dispose();
        lessonThen(typing.level, dev?.lesson ?? false, begin);
      },
    });
    picker = mine;
  };

  /** Everything before a run: the picker and the lesson (or neither with `start=1`), then `go()`. */
  const showStart = (go: () => void) => {
    showKeyboard(false);
    const begin = () => {
      playLevel = clamp(typing.level, 1, typing.open);
      typing.level = playLevel;
      pendingLevel = null;
      stats = emptyStats();
      opened = [];
      speedRun = 0;
      save();
      ride.setMultiplier(multiplier(playLevel));
      showKeyboard(true);
      go();
    };
    if (!dev?.start) openPicker(begin);
    else if (dev.lesson) lessonThen(typing.level, true, begin);
    else begin();
  };

  // ---------- The ride's driver ----------
  const driver: RideDriver = {
    intro(go) {
      // The ride is made once this returns: the start screen waits a tick for it.
      setTimeout(() => showStart(go), 0);
    },

    beginTurn(turn: RideTurn) {
      const mine = ++token;
      const { hud } = ride;
      const text =
        dev?.block ??
        planBlock({
          level: playLevel,
          length: blockKeys(playLevel, turn.target, turn.tier),
          random: Math.random,
          history: typing.keys,
        });
      const seconds = dev?.clock ?? clockFor(playLevel, text.length, typing.spk);
      hud.problemText.replaceChildren(block.element);
      hud.setTopVisible(true, 0);
      // After the panel shows, so the row can shrink to fit it.
      block.set(text);
      wrongAt.clear();
      firstKeyAt = null;
      blockReady = false;
      blockOn = true;
      if (firstBlock) {
        firstBlock = false;
        for (let i = 0; i < (dev?.typed ?? 0) && block.position < text.length - 1; i++) {
          block.advance();
        }
        if (dev?.wrong) block.wrong(true);
      }
      paintKeyboard();
      ride.setClock(seconds);
      // A key that started this turn (the space bar of a lesson) must not count as its first.
      setTimeout(() => {
        if (token === mine) blockReady = true;
      }, 0);
      ride.after(READ_SECONDS, () => {
        if (token !== mine || ride.phase !== 'riding') return;
        ride.startClock(seconds);
      });
    },

    timeUp() {
      blockOn = false;
      const done = block.position;
      let wrong = 0;
      for (const i of wrongAt) if (i < done) wrong++;
      stats.keys += done;
      stats.right += done - wrong;
      if (!speedLevel()) typing.spk = nextSpk(typing.spk, 'timeout');
      speedRun = 0;
      save();
    },

    afterMiss: () => ({ detail: '', wait: false }),

    ending: () => ({ detail: '', wait: false }),

    finish(score, again) {
      blockOn = false;
      showKeyboard(false);
      const speedNow = stats.fastSeconds > 0 ? stats.fastKeys / 5 / (stats.fastSeconds / 60) : 0;
      typing.bestWpm = Math.max(typing.bestWpm, Math.round(speedNow));
      const before = session.highScore();
      const newHighScore = hooked ? score > before : session.recordScore(score);
      save();
      ride.hud.setScore(score, Math.max(before, score));
      if (newHighScore) sfx.goal();
      showResults({
        topicId: TYPING_LEVEL_ID,
        correct: stats.right,
        total: stats.keys,
        stars: starsFor(stats.right, stats.keys),
        newBest: false,
        missed: [],
        playerName: session.player?.name,
        score,
        highScore: Math.max(before, score),
        newHighScore,
        outcome: resultsText(stats, opened),
        playAgainLabel: 'Ride again 🌊',
        onPlayAgain: () => showStart(again),
      });
    },

    betweenWorlds(resume) {
      if (pendingLevel === null) {
        resume();
        return;
      }
      // A level opened in this world: its lesson (or speed card) shows, then the run goes on.
      playLevel = pendingLevel;
      pendingLevel = null;
      typing.level = playLevel;
      ride.setMultiplier(multiplier(playLevel));
      save();
      lessonThen(playLevel, true, resume);
    },

    cancel() {
      token++;
      blockOn = false;
    },

    dispose() {
      stopKeys();
      window.removeEventListener('keydown', onAnyKey, true);
      window.removeEventListener('pointerdown', onPointer);
      picker?.dispose();
      keyboard.dispose();
      block.dispose();
      note.remove();
    },
  };

  // ---------- Keys, and the note for a player with no keyboard ----------
  let sawKey = false;
  let noteTimer: ReturnType<typeof setTimeout> | undefined;
  const onAnyKey = () => {
    if (!sawKey) {
      sawKey = true;
      try {
        unlockAudio();
      } catch {
        // Audio trouble must never stop the ride.
      }
    }
    note.hidden = true;
  };
  const onPointer = () => {
    if (sawKey) return;
    note.hidden = false;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => (note.hidden = true), 4000);
  };
  window.addEventListener('keydown', onAnyKey, true);
  window.addEventListener('pointerdown', onPointer);
  const stopKeys = onTypingKey((char) => onKey(char), { onCaps: (on) => keyboard.setCaps(on) });

  const ride: Ride = createRide(container, {
    avatar: session.player?.avatar ?? '⭐',
    driver,
    dev,
    highScore: () => session.highScore(),
    answers: false,
    // The keyboard strip's height, and the gap and safe area under it.
    bottomInset: () =>
      Math.max(0, window.innerHeight - keyboard.element.getBoundingClientRect().top),
  });
}

run(startTypingSession(GAME_ID));
