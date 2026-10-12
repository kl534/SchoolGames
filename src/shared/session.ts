import { createProgressStore, recordAnswer, recordBest, type Player } from './progress';
import { chooseRoundFacts, KICKS_PER_ROUND } from './round';
import { getTopic, type Fact, type Topic } from './topics';

export const MAX_TIMER_SECONDS = 60;

export interface GameParams {
  topicId: string | null;
  /** Seconds per turn; 0 means no clock. */
  timerSeconds: number;
}

/** Reads `?topic=<id>&timer=<seconds>` from a game page URL. */
export function parseGameParams(search: string): GameParams {
  const params = new URLSearchParams(search);
  const timer = Number(params.get('timer'));
  return {
    topicId: params.get('topic'),
    timerSeconds:
      Number.isFinite(timer) && timer > 0 ? Math.min(Math.round(timer), MAX_TIMER_SECONDS) : 0,
  };
}

/** Link to a game page for a topic. */
export function gameUrl(href: string, topicId: string, timerSeconds = 0): string {
  const params = new URLSearchParams({ topic: topicId });
  if (timerSeconds > 0) params.set('timer', String(timerSeconds));
  return `${href}?${params}`;
}

export interface GameSession {
  gameId: string;
  topic: Topic;
  timerSeconds: number;
  /** Null when nobody picked a player; nothing is saved then. */
  player: Player | null;
  /** Facts for a new round, weighted toward the player's weak spots. */
  chooseFacts(count?: number): Fact[];
  /** Saves one answer to the player's fact history. */
  recordAnswer(fact: Fact, correct: boolean): void;
  /** Saves the round's stars; true when it's a new best. */
  recordStars(stars: number): boolean;
}

/** Sets up a game page from its URL. Returns null when the topic is missing or unknown. */
export function startGameSession(
  gameId: string,
  search: string = location.search,
): GameSession | null {
  const params = parseGameParams(search);
  const topic = getTopic(params.topicId);
  if (!topic) return null;

  const store = createProgressStore();
  const player = store.currentPlayer();
  const progress = player ? store.load(player.id) : { facts: {}, best: {} };
  const save = () => player && store.save(player.id, progress);

  return {
    gameId,
    topic,
    timerSeconds: params.timerSeconds,
    player,
    chooseFacts: (count = KICKS_PER_ROUND) =>
      chooseRoundFacts(topic.facts, progress.facts[topic.id], count),
    recordAnswer(fact, correct) {
      recordAnswer(progress, topic.id, fact.id, correct);
      save();
    },
    recordStars(stars) {
      const isBest = recordBest(progress, topic.id, gameId, stars);
      save();
      return isBest;
    },
  };
}
