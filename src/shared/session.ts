import { preloadSpeech } from './audio';
import {
  createProgressStore,
  emptyProgress,
  recordAnswer,
  recordBest,
  recordHighScore,
  timerSecondsFor,
  type Player,
} from './progress';
import {
  chooseLevelFacts,
  levelLabel,
  levelsOpen,
  MY_LEVEL_ID,
  myLevelTopic,
  topicOfFact,
} from './levels';
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

/**
 * Sets up a game page from its URL. Returns null when the topic is missing or unknown.
 * `?topic=my-level` is mixed practice: facts come from every open level, answers are saved under
 * each fact's own topic, and stars and high scores under `my-level`.
 */
export function startGameSession(
  gameId: string,
  search: string = location.search,
): GameSession | null {
  const params = parseGameParams(search);
  const isMyLevel = params.topicId === MY_LEVEL_ID;
  const realTopic = isMyLevel ? undefined : getTopic(params.topicId);
  if (!isMyLevel && !realTopic) return null;

  const store = createProgressStore();
  const player = store.currentPlayer();
  const progress = player ? store.load(player.id) : emptyProgress();
  const save = () => player && store.save(player.id, progress);
  const topic = realTopic ?? myLevelTopic(() => levelLabel(levelsOpen(progress)));
  /** Where a fact's answers are saved: its own topic, which for My Level is not `topic`. */
  const statTopicId = (fact: Fact) => (isMyLevel ? topicOfFact(fact).id : topic.id);

  return {
    gameId,
    topic,
    player,
    // My Level reads the live progress, so a refill picks up levels opened since the last one.
    chooseFacts(count = KICKS_PER_ROUND) {
      const facts = isMyLevel
        ? chooseLevelFacts(progress, count)
        : chooseRoundFacts(topic.facts, progress.facts[topic.id], count);
      // Fetch the round's voice clips now, while the preview is up.
      preloadSpeech(
        facts.flatMap((f) => [f.spokenPrompt ?? f.prompt, f.spokenStatement ?? f.statement]),
      );
      return facts;
    },
    timerSecondsFor: (fact) =>
      timerSecondsFor(player ? progress.facts[statTopicId(fact)]?.[fact.id] : undefined),
    recordAnswer(fact, correct) {
      recordAnswer(progress, statTopicId(fact), fact.id, correct);
      if (isMyLevel) progress.levelsOpen = levelsOpen(progress);
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
