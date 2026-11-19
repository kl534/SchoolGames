/**
 * Sets up a typing game page: the player and their typing progress, saved under the Typing path's
 * id. Typing games have no topic and no facts, so they use this instead of `startGameSession`.
 */
import { createProgressStore, emptyProgress, recordHighScore } from '../progress';
import { scheduleSync } from '../sync/engine';
import { emptyTyping, TYPING_LEVEL_ID, type TypingProgress } from './progress';
import type { Player } from '../progress';

export interface TypingSession {
  gameId: string;
  /** Null when nobody picked a player; the game still plays but nothing is saved. */
  player: Player | null;
  /** The player's typing progress; change it and call `save()`. */
  typing: TypingProgress;
  save(): void;
  /** The player's high score for this game; 0 when there isn't one yet. */
  highScore(): number;
  /** Saves a run's score; true when it beats the high score (and is above zero). */
  recordScore(score: number): boolean;
}

export function startTypingSession(gameId: string): TypingSession {
  const store = createProgressStore();
  const player = store.currentPlayer();
  const progress = player ? store.load(player.id) : emptyProgress();
  const typing = (progress.typing ??= emptyTyping());
  const save = () => {
    if (!player) return;
    store.save(player.id, progress);
    scheduleSync();
  };
  return {
    gameId,
    player,
    typing,
    save,
    highScore: () => progress.highScores[TYPING_LEVEL_ID]?.[gameId] ?? 0,
    recordScore(score) {
      const isBest = recordHighScore(progress, TYPING_LEVEL_ID, gameId, score);
      save();
      return isBest;
    },
  };
}
