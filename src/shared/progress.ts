import { deviceStore, readJson, writeJson, type KeyValueStore } from './storage';

export interface Player {
  id: string;
  name: string;
  avatar: string;
}

export interface FactStat {
  correct: number;
  wrong: number;
  /** Correct answers in a row; reset by a wrong answer. */
  streak: number;
  /** Timestamp (ms) of the last answer. */
  lastSeen: number;
}

export interface PlayerProgress {
  /** topicId -> factId -> stats */
  facts: Record<string, Record<string, FactStat>>;
  /** topicId -> gameId -> best stars (0-3) */
  best: Record<string, Record<string, number>>;
}

export const AVATARS = ['🦊', '🐼', '🐯', '🐸', '🐙', '🦄', '🐶', '🐱', '🐵', '🦁', '🐧', '🐢'];
export const MAX_NAME_LENGTH = 20;
/** After a miss, a fact needs this many correct answers in a row to count as learned again. */
export const MASTERED_STREAK = 2;

export function emptyProgress(): PlayerProgress {
  return { facts: {}, best: {} };
}

/** Learned: right every time so far, or right enough times in a row since the last miss. */
export function isMastered(stat: FactStat | undefined): boolean {
  if (!stat) return false;
  return stat.wrong === 0 ? stat.correct > 0 : stat.streak >= MASTERED_STREAK;
}

/**
 * How likely a fact is to be picked for the next round. Unseen and often-missed
 * facts come up more; mastered facts still appear now and then.
 */
export function factWeight(stat: FactStat | undefined): number {
  if (!stat) return 2;
  const ratio = (1 + 2 * stat.wrong) / (1 + stat.correct);
  const mastery = isMastered(stat) ? 0.5 : 1;
  return Math.min(Math.max(ratio * mastery, 0.2), 6);
}

export function recordAnswer(
  progress: PlayerProgress,
  topicId: string,
  factId: string,
  correct: boolean,
  now: number = Date.now(),
): FactStat {
  const topic = (progress.facts[topicId] ??= {});
  const stat = (topic[factId] ??= { correct: 0, wrong: 0, streak: 0, lastSeen: 0 });
  if (correct) {
    stat.correct++;
    stat.streak++;
  } else {
    stat.wrong++;
    stat.streak = 0;
  }
  stat.lastSeen = now;
  return stat;
}

/** Stores the stars if they beat the previous best; returns true for a new best. */
export function recordBest(
  progress: PlayerProgress,
  topicId: string,
  gameId: string,
  stars: number,
): boolean {
  const topic = (progress.best[topicId] ??= {});
  if (stars <= (topic[gameId] ?? -1)) return false;
  topic[gameId] = stars;
  return true;
}

export function countMastered(
  progress: PlayerProgress,
  topicId: string,
  factIds: string[],
): number {
  const stats = progress.facts[topicId] ?? {};
  return factIds.filter((id) => isMastered(stats[id])).length;
}

const PLAYERS_KEY = 'sg:players';
const CURRENT_KEY = 'sg:current-player';
const progressKey = (playerId: string) => `sg:progress:${playerId}`;

export interface ProgressStore {
  listPlayers(): Player[];
  addPlayer(name: string, avatar: string): Player;
  removePlayer(id: string): void;
  currentPlayer(): Player | null;
  setCurrentPlayer(id: string | null): void;
  load(playerId: string): PlayerProgress;
  save(playerId: string, progress: PlayerProgress): void;
}

/** Players and their progress, kept on this device only. */
export function createProgressStore(store: KeyValueStore = deviceStore()): ProgressStore {
  const listPlayers = () => readJson<Player[]>(store, PLAYERS_KEY, []);

  return {
    listPlayers,
    addPlayer(name, avatar) {
      const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
      if (!trimmed) throw new Error('Player name is required');
      const player: Player = {
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
        name: trimmed,
        avatar: AVATARS.includes(avatar) ? avatar : AVATARS[0],
      };
      writeJson(store, PLAYERS_KEY, [...listPlayers(), player]);
      return player;
    },
    removePlayer(id) {
      writeJson(
        store,
        PLAYERS_KEY,
        listPlayers().filter((p) => p.id !== id),
      );
      store.removeItem(progressKey(id));
      if (store.getItem(CURRENT_KEY) === id) store.removeItem(CURRENT_KEY);
    },
    currentPlayer() {
      const id = store.getItem(CURRENT_KEY);
      return listPlayers().find((p) => p.id === id) ?? null;
    },
    setCurrentPlayer(id) {
      if (id === null) store.removeItem(CURRENT_KEY);
      else store.setItem(CURRENT_KEY, id);
    },
    load(playerId) {
      const data = readJson<Partial<PlayerProgress>>(store, progressKey(playerId), {});
      return { facts: data.facts ?? {}, best: data.best ?? {} };
    },
    save(playerId, progress) {
      writeJson(store, progressKey(playerId), progress);
    },
  };
}

/** Device-wide preferences such as mute and the shot clock. */
export function getSetting(key: string, store: KeyValueStore = deviceStore()): string | null {
  return store.getItem(`sg:setting:${key}`);
}

export function setSetting(key: string, value: string, store: KeyValueStore = deviceStore()): void {
  try {
    store.setItem(`sg:setting:${key}`, value);
  } catch {
    // Ignore: the preference just won't persist.
  }
}
