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
  /**
   * Right answers in a row that each came at least `LEARN_SPACING_MS` after the one before;
   * reset by a wrong answer. Missing in progress saved before it existed.
   */
  learnStreak?: number;
  /** Timestamp (ms) of the last right answer that added to `learnStreak`. */
  learnedAt?: number;
}

export interface PlayerProgress {
  /** topicId -> factId -> stats */
  facts: Record<string, Record<string, FactStat>>;
  /** topicId -> gameId -> best stars (0-3) */
  best: Record<string, Record<string, number>>;
  /** topicId -> gameId -> high score, for games that score in points instead of stars. */
  highScores: Record<string, Record<string, number>>;
  /** How many My Level levels the player has opened; it never goes down. */
  levelsOpen?: number;
}

export const AVATARS = ['🦊', '🐼', '🐯', '🐸', '🐙', '🦄', '🐶', '🐱', '🐵', '🦁', '🐧', '🐢'];
export const MAX_NAME_LENGTH = 20;
/** A fact counts as learned once its `learnStreak` reaches this. */
export const LEARN_STREAK = 3;
/** Right answers closer together than this (6 hours) add to `learnStreak` only once. */
export const LEARN_SPACING_MS = 6 * 60 * 60 * 1000;

/**
 * Seconds to answer a fact, indexed by its current streak; longer streaks get less time.
 * The last entry applies to every streak beyond the list.
 */
export const TIMER_SECONDS_BY_STREAK = [15, 10, 5];

export function emptyProgress(): PlayerProgress {
  return { facts: {}, best: {}, highScores: {} };
}

/** Learned: `LEARN_STREAK` right answers in a row, each at least 6 hours after the one before. */
export function isMastered(stat: FactStat | undefined): boolean {
  return (stat?.learnStreak ?? 0) >= LEARN_STREAK;
}

/** Seconds the player gets to answer a fact: 15 when new or just missed, then 10, then 5. */
export function timerSecondsFor(stat: FactStat | undefined): number {
  const last = TIMER_SECONDS_BY_STREAK.length - 1;
  return TIMER_SECONDS_BY_STREAK[Math.min(stat?.streak ?? 0, last)];
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

/**
 * Saves one answer. A right `retry` (the fact asked again soon after a miss, its answer just
 * shown) proves nothing, so it only updates `lastSeen`; a wrong retry counts like any miss.
 */
export function recordAnswer(
  progress: PlayerProgress,
  topicId: string,
  factId: string,
  correct: boolean,
  now: number = Date.now(),
  retry = false,
): FactStat {
  const topic = (progress.facts[topicId] ??= {});
  const stat = (topic[factId] ??= { correct: 0, wrong: 0, streak: 0, lastSeen: 0 });
  if (correct && !retry) {
    stat.correct++;
    stat.streak++;
    if (stat.learnedAt === undefined || now - stat.learnedAt >= LEARN_SPACING_MS) {
      stat.learnStreak = (stat.learnStreak ?? 0) + 1;
      stat.learnedAt = now;
    }
  } else if (!correct) {
    stat.wrong++;
    stat.streak = 0;
    stat.learnStreak = 0;
    delete stat.learnedAt;
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

/** Stores the score if it is above zero and beats the previous high score; true for a new one. */
export function recordHighScore(
  progress: PlayerProgress,
  topicId: string,
  gameId: string,
  score: number,
): boolean {
  if (score <= 0 || score <= (progress.highScores[topicId]?.[gameId] ?? 0)) return false;
  (progress.highScores[topicId] ??= {})[gameId] = score;
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

/** Topics that hold the times and divide facts with a number above 10 (see `migrateAboveTenTables`). */
const BIG_TIMES_TOPIC = 'multiplication-11-16';
const BIG_DIVIDE_TOPIC = 'division-11-16';
/** The small tables stop here; a fact with a bigger number moved to the topics above. */
const SMALL_TABLE_LIMIT = 10;

/**
 * Brings progress saved before the above-10 times and divide facts got their own topics up to
 * date: copies those facts' stats, and the stars and high scores of the tables 11 to 16, to
 * `multiplication-11-16` and `division-11-16`. Copies only (the old entries stay), never
 * overwrites what the new topic already has, so running it again changes nothing. Returns true
 * when it changed something.
 */
export function migrateAboveTenTables(progress: PlayerProgress): boolean {
  let changed = false;

  const tableOfTopic = (topicId: string) => {
    const times = /^times-(\d+)$/.exec(topicId);
    if (times) return { big: BIG_TIMES_TOPIC, table: Number(times[1]), times: true };
    const divide = /^divide-by-(\d+)$/.exec(topicId);
    if (divide) return { big: BIG_DIVIDE_TOPIC, table: Number(divide[1]), times: false };
    return null;
  };

  for (const [topicId, stats] of Object.entries(progress.facts)) {
    const old = tableOfTopic(topicId);
    if (!old) continue;
    for (const [factId, stat] of Object.entries(stats)) {
      const parts = (old.times ? /^(\d+)x(\d+)$/ : /^(\d+)\/(\d+)$/).exec(factId);
      if (!parts || Number(parts[2]) !== old.table) continue;
      const first = Number(parts[1]);
      if (!old.times && first % old.table !== 0) continue;
      const n = old.times ? first : first / old.table;
      if (n <= SMALL_TABLE_LIMIT && old.table <= SMALL_TABLE_LIMIT) continue;
      const target = (progress.facts[old.big] ??= {});
      if (target[factId] === undefined) {
        target[factId] = { ...stat };
        changed = true;
      }
    }
  }

  for (const records of [progress.best, progress.highScores]) {
    for (const [topicId, games] of Object.entries(records)) {
      const old = tableOfTopic(topicId);
      if (!old || old.table <= SMALL_TABLE_LIMIT) continue;
      for (const [gameId, value] of Object.entries(games)) {
        if (value > (records[old.big]?.[gameId] ?? 0)) {
          (records[old.big] ??= {})[gameId] = value;
          changed = true;
        }
      }
    }
  }
  return changed;
}

/** Games whose id changed: old id -> new id. */
const RENAMED_GAMES: Record<string, string> = { 'fairway-golf': 'fore' };

/**
 * Copies the stars and high scores saved under a game's old id to its new id. Copies only (the
 * old entries stay) and keeps the better value, so running it again changes nothing. Returns true
 * when it changed something.
 */
export function migrateRenamedGames(progress: PlayerProgress): boolean {
  let changed = false;
  for (const records of [progress.best, progress.highScores]) {
    for (const games of Object.values(records)) {
      for (const [oldId, newId] of Object.entries(RENAMED_GAMES)) {
        const value = games[oldId];
        if (value !== undefined && value > (games[newId] ?? 0)) {
          games[newId] = value;
          changed = true;
        }
      }
    }
  }
  return changed;
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
      // Progress saved before high scores existed has no `highScores`; before My Level, no `levelsOpen`.
      const progress: PlayerProgress = {
        facts: data.facts ?? {},
        best: data.best ?? {},
        highScores: data.highScores ?? {},
      };
      if (typeof data.levelsOpen === 'number') progress.levelsOpen = data.levelsOpen;
      migrateAboveTenTables(progress);
      migrateRenamedGames(progress);
      return progress;
    },
    save(playerId, progress) {
      writeJson(store, progressKey(playerId), progress);
    },
  };
}

/** Device-wide preferences such as mute. */
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
