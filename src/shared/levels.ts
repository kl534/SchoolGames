import { factWeight, isMastered, type FactStat, type PlayerProgress } from './progress';
import { shuffle, weightedSample, type Random } from './random';
import { answerOptions, type Fact, type Topic } from './topics';
import { MATH_TOPICS } from './topics/math';

/** Pseudo topic id: My Level stars and high scores are saved under it. It is not in `TOPICS`. */
export const MY_LEVEL_ID = 'my-level';
/** The next level opens once this share of the newest open level was answered right last time. */
export const UNLOCK_SHARE = 0.8;
/** About this share of the picks are learned facts coming back for review. */
export const REVIEW_SHARE = 0.1;

export interface LevelFact {
  topic: Topic;
  fact: Fact;
}

export interface Level {
  title: string;
  facts: LevelFact[];
}

const topicsById = new Map(MATH_TOPICS.map((t) => [t.id, t]));

/** Every fact of the topics with these ids that passes `keep`, in topic order. */
function factsOf(ids: string[], keep: (fact: Fact) => boolean = () => true): LevelFact[] {
  return ids.flatMap((id) => {
    const topic = topicsById.get(id);
    if (!topic) throw new Error(`Unknown topic ${id}`);
    return topic.facts.filter(keep).map((fact) => ({ topic, fact }));
  });
}

const tables = (prefix: string, numbers: number[]) => numbers.map((n) => `${prefix}${n}`);
const answerAtMost10 = (fact: Fact) => Number(fact.answer) <= 10;
const startsAtMost10 = (fact: Fact) => (fact.visual?.a ?? 0) <= 10;
/**
 * The number a times-table or division fact is "n times" of: 7 in 7 × 3 and in 21 ÷ 3.
 * Tables once stopped at 10, so levels 5 to 12 keep only these facts to stay as they were.
 */
const multiplierOf = (fact: Fact) =>
  fact.visual?.kind === 'divide' ? Number(fact.answer) : (fact.visual?.a ?? 0);
const multiplierAtMost10 = (fact: Fact) => multiplierOf(fact) <= 10;
const multiplierAbove10 = (fact: Fact) => !multiplierAtMost10(fact);

/** Tables with these numbers, as they were up to × 10: the facts that make up the older levels. */
const tableFacts = (prefix: string, numbers: number[]) =>
  factsOf(tables(prefix, numbers), multiplierAtMost10);
/** The same tables stretched past × 10, up to × 16. */
const stretchFacts = (prefix: string, numbers: number[]) =>
  factsOf(tables(prefix, numbers), multiplierAbove10);

/** Easiest first. Only how many are open is saved, so titles and order can change. */
export const LEVELS: Level[] = [
  { title: 'Sums to 10', facts: factsOf(['addition-1-10'], answerAtMost10) },
  { title: 'Take-away within 10', facts: factsOf(['subtraction-1-10'], startsAtMost10) },
  { title: 'Sums to 20', facts: factsOf(['addition-1-10'], (f) => !answerAtMost10(f)) },
  {
    title: 'Take-away within 20',
    facts: factsOf(['subtraction-1-10'], (f) => !startsAtMost10(f)),
  },
  { title: '× 1, 2, 5, 10', facts: tableFacts('times-', [1, 2, 5, 10]) },
  { title: '÷ 1, 2, 5, 10', facts: tableFacts('divide-by-', [1, 2, 5, 10]) },
  { title: '× 3, 4', facts: tableFacts('times-', [3, 4]) },
  { title: '÷ 3, 4', facts: tableFacts('divide-by-', [3, 4]) },
  { title: '× 6, 7', facts: tableFacts('times-', [6, 7]) },
  { title: '÷ 6, 7', facts: tableFacts('divide-by-', [6, 7]) },
  { title: '× 8, 9', facts: tableFacts('times-', [8, 9]) },
  { title: '÷ 8, 9', facts: tableFacts('divide-by-', [8, 9]) },
  // The 11 to 16 times of the old tables (11 × 3 up to 16 × 3), then the new tables 11 to 16.
  { title: '× up to 16: 1, 2, 5, 10', facts: stretchFacts('times-', [1, 2, 5, 10]) },
  { title: '÷ up to 16: 1, 2, 5, 10', facts: stretchFacts('divide-by-', [1, 2, 5, 10]) },
  { title: '× up to 16: 3, 4', facts: stretchFacts('times-', [3, 4]) },
  { title: '÷ up to 16: 3, 4', facts: stretchFacts('divide-by-', [3, 4]) },
  { title: '× up to 16: 6, 7, 8, 9', facts: stretchFacts('times-', [6, 7, 8, 9]) },
  { title: '÷ up to 16: 6, 7, 8, 9', facts: stretchFacts('divide-by-', [6, 7, 8, 9]) },
  ...[11, 13, 15].flatMap((from) => [
    { title: `× ${from}, ${from + 1}`, facts: factsOf(tables('times-', [from, from + 1])) },
    {
      title: `÷ ${from}, ${from + 1}`,
      facts: factsOf(tables('divide-by-', [from, from + 1])),
    },
  ]),
];

const topicByFact = new Map<Fact, Topic>(
  LEVELS.flatMap((level) => level.facts.map(({ topic, fact }) => [fact, topic] as const)),
);

/** The real topic a My Level fact belongs to; its stats are saved under that topic's id. */
export function topicOfFact(fact: Fact): Topic {
  const topic = topicByFact.get(fact);
  if (!topic) throw new Error(`Fact ${fact.id} is not in any level`);
  return topic;
}

/** True once enough of the level's facts were answered right the last time they came up. */
export function levelPassed(level: Level, stats: PlayerProgress['facts']): boolean {
  const right = level.facts.filter(({ topic, fact }) => {
    const stat = stats[topic.id]?.[fact.id];
    return stat !== undefined && stat.streak >= 1;
  }).length;
  return right / level.facts.length >= UNLOCK_SHARE;
}

/** How many levels are open (1 to `LEVELS.length`). Opening is sticky: it never goes back down. */
export function levelsOpen(progress: PlayerProgress): number {
  let open = Math.min(Math.max(1, Math.floor(progress.levelsOpen ?? 1)), LEVELS.length);
  while (open < LEVELS.length && levelPassed(LEVELS[open - 1], progress.facts)) open++;
  return open;
}

/** Not learned yet, or learned but missed the last time it came up. */
export function needsWork(stat: FactStat | undefined): boolean {
  return !isMastered(stat) || stat?.streak === 0;
}

/**
 * Picks the facts for a My Level round from every open level. Facts that need work fill most
 * slots, weighted toward the ones missed; about `REVIEW_SHARE` of the slots are learned facts
 * coming back. Repeats facts when the pool is small, like `chooseRoundFacts`.
 */
export function chooseLevelFacts(
  progress: PlayerProgress,
  count: number,
  random: Random = Math.random,
): Fact[] {
  const stat = ({ topic, fact }: LevelFact) => progress.facts[topic.id]?.[fact.id];
  const open = LEVELS.slice(0, levelsOpen(progress)).flatMap((level) => level.facts);
  const work = open.filter((lf) => needsWork(stat(lf)));
  const review = open.filter((lf) => !needsWork(stat(lf)));

  // When everything open is learned, every slot is a review, so the pool never runs dry.
  let reviewSlots = 0;
  for (let i = 0; i < count; i++) {
    if (review.length > 0 && (work.length === 0 || random() < REVIEW_SHARE)) reviewSlots++;
  }

  const fill = (pool: LevelFact[], slots: number): Fact[] => {
    const picked: LevelFact[] = [];
    while (picked.length < slots && pool.length > 0) {
      picked.push(
        ...weightedSample(pool, (lf) => factWeight(stat(lf)), slots - picked.length, random),
      );
    }
    return picked.map((lf) => lf.fact);
  };
  return shuffle([...fill(work, count - reviewSlots), ...fill(review, reviewSlots)], random);
}

/** 'Level 3 of 12: Sums to 20' */
export function levelLabel(open: number): string {
  return `Level ${open} of ${LEVELS.length}: ${LEVELS[open - 1].title}`;
}

/**
 * A topic standing in for My Level: all the level facts, a description that follows the player's
 * current level, and wrong answers taken from each fact's own topic.
 */
export function myLevelTopic(getLabel: () => string): Topic {
  return {
    id: MY_LEVEL_ID,
    title: 'My Level',
    subject: 'My Level',
    get description() {
      return getLabel();
    },
    facts: LEVELS.flatMap((level) => level.facts.map(({ fact }) => fact)),
    distractors: (fact, count, random) =>
      answerOptions(topicOfFact(fact), fact, count + 1, random).filter((a) => a !== fact.answer),
  };
}
