import {
  createProgressStore,
  recordAnswer,
  recordBest,
  recordHighScore,
  timerSecondsFor,
  type Player,
} from './progress';
import { chooseRoundFacts, KICKS_PER_ROUND } from './round';
import { getTopic, type Fact, type Topic } from './topics';

export interface GameParams {
  topicId: string | null;
}

/** Reads `?topic=<id>` from a game page URL. */
export function parseGameParams(search: string): GameParams {
  return { topicId: new URLSearchParams(search).get('topic') };
}

/** Link to a game page for a topic. */
export function gameUrl(href: string, topicId: string): string {
  return `${href}?${new URLSearchParams({ topic: topicId })}`;
}

export interface GameSession {
  gameId: string;
  topic: Topic;
  /** Null when nobody picked a player; nothing is saved then. */
  player: Player | null;
  /** Facts for a new round, weighted toward the player's weak spots. */
  chooseFacts(count?: number): Fact[];
  /** Seconds to answer this fact now, from its current streak; 15 when nobody is playing. */
  timerSecondsFor(fact: Fact): number;
  /** Saves one answer to the player's fact history. */
  recordAnswer(fact: Fact, correct: boolean): void;
  /** Saves the round's stars; true when it's a new best. */
  recordStars(stars: number): boolean;
  /** The player's high score for this topic and game; 0 when there isn't one yet. */
  highScore(): number;
  /** Saves a run's score; true when it beats the high score (and is above zero). */
  recordScore(score: number): boolean;
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
  const progress = player ? store.load(player.id) : { facts: {}, best: {}, highScores: {} };
  const save = () => player && store.save(player.id, progress);

  return {
    gameId,
    topic,
    player,
    chooseFacts: (count = KICKS_PER_ROUND) =>
      chooseRoundFacts(topic.facts, progress.facts[topic.id], count),
    timerSecondsFor: (fact) =>
      timerSecondsFor(player ? progress.facts[topic.id]?.[fact.id] : undefined),
    recordAnswer(fact, correct) {
      recordAnswer(progress, topic.id, fact.id, correct);
      save();
    },
    recordStars(stars) {
      const isBest = recordBest(progress, topic.id, gameId, stars);
      save();
      return isBest;
    },
    highScore: () => progress.highScores[topic.id]?.[gameId] ?? 0,
    recordScore(score) {
      const isBest = recordHighScore(progress, topic.id, gameId, score);
      save();
      return isBest;
    },
  };
}
