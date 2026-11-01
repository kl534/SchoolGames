import { factWeight, isMastered, type FactStat, type PlayerProgress } from './progress';
import { shuffle, weightedSample, type Random } from './random';
import { answerOptions, type Fact, type Topic } from './topics';
import { SOCIAL_STUDIES_LEVELS } from './levels-social';
import { MATH_TOPICS, missingTwin, type Blank } from './topics/math';
import { SOCIAL_STUDIES_TOPICS } from './topics/social-studies';

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
/** The number a times-table or division fact is "n times" of: 7 in 7 × 3 and in 21 ÷ 3. */
const multiplierOf = (fact: Fact) =>
  fact.visual?.kind === 'divide' ? Number(fact.answer) : (fact.visual?.a ?? 0);
const multiplierAbove10 = (fact: Fact) => multiplierOf(fact) > 10;

/** The biggest of the two numbers a sum or take-away is made of: 12 in 7 + 12 and in 19 − 7. */
const biggestNumber = (fact: Fact): number => {
  const visual = fact.visual;
  if (!visual) return 0;
  return visual.kind === 'subtract'
    ? Math.max(visual.b, visual.a - visual.b)
    : Math.max(visual.a, visual.b);
};
/** Facts of a topic whose biggest number is from `from` to `to`. */
const biggest = (from: number, to: number) => (fact: Fact) =>
  biggestNumber(fact) >= from && biggestNumber(fact) <= to;

type TableKind = 'times' | 'divide';
/** The up-to-10 tables are topics `times-N` / `divide-by-N`; everything above 10 is one topic per subject. */
const SMALL_PREFIX: Record<TableKind, string> = { times: 'times-', divide: 'divide-by-' };
const BIG_TOPIC: Record<TableKind, string> = {
  times: 'multiplication-11-16',
  divide: 'division-11-16',
};
/** The table a times or divide fact belongs to: 3 in 7 × 3 and in 21 ÷ 3. */
const tableOf = (fact: Fact) => fact.visual?.b ?? 0;

/** Facts of these tables up to × 10, table by table (levels 13 to 28). */
const tableFacts = (kind: TableKind, numbers: number[]) =>
  factsOf(tables(SMALL_PREFIX[kind], numbers));
/** The same tables from × 11 to × 16, table by table (levels 55 to 66). */
const stretchFacts = (kind: TableKind, numbers: number[]) =>
  numbers.flatMap((n) =>
    factsOf([BIG_TOPIC[kind]], (f) => tableOf(f) === n && multiplierAbove10(f)),
  );
/** Every fact of these tables, × 1 to × 16, table by table (levels 73 to 84; the tables are 11 to 16). */
const bigTableFacts = (kind: TableKind, numbers: number[]) =>
  numbers.flatMap((n) => factsOf([BIG_TOPIC[kind]], (f) => tableOf(f) === n));

const sums10: Level = { title: 'Sums to 10', facts: factsOf(['addition-1-10'], answerAtMost10) };
const takeAway10: Level = {
  title: 'Take-away within 10',
  facts: factsOf(['subtraction-1-10'], startsAtMost10),
};
const sums20: Level = {
  title: 'Sums to 20',
  facts: factsOf(['addition-1-10'], (f) => !answerAtMost10(f)),
};
const takeAway20: Level = {
  title: 'Take-away within 20',
  facts: factsOf(['subtraction-1-10'], (f) => !startsAtMost10(f)),
};
const times1: Level = { title: '× 1, 2, 5, 10', facts: tableFacts('times', [1, 2, 5, 10]) };
const divide1: Level = { title: '÷ 1, 2, 5, 10', facts: tableFacts('divide', [1, 2, 5, 10]) };
const times3: Level = { title: '× 3, 4', facts: tableFacts('times', [3, 4]) };
const divide3: Level = { title: '÷ 3, 4', facts: tableFacts('divide', [3, 4]) };
const times6: Level = { title: '× 6, 7', facts: tableFacts('times', [6, 7]) };
const divide6: Level = { title: '÷ 6, 7', facts: tableFacts('divide', [6, 7]) };
const times8: Level = { title: '× 8, 9', facts: tableFacts('times', [8, 9]) };
const divide8: Level = { title: '÷ 8, 9', facts: tableFacts('divide', [8, 9]) };
// Addition and subtraction with numbers up to 16: after the tables up to 10, before the 11s.
const sums24: Level = {
  title: 'Sums to 24',
  facts: factsOf(['addition-11-16'], biggest(11, 12)),
};
const takeAway24: Level = {
  title: 'Take-away within 24',
  facts: factsOf(['subtraction-11-16'], biggest(11, 12)),
};
const sums28: Level = {
  title: 'Sums to 28',
  facts: factsOf(['addition-11-16'], biggest(13, 14)),
};
const takeAway28: Level = {
  title: 'Take-away within 28',
  facts: factsOf(['subtraction-11-16'], biggest(13, 14)),
};
const sums32: Level = {
  title: 'Sums to 32',
  facts: factsOf(['addition-11-16'], biggest(15, 16)),
};
const takeAway32: Level = {
  title: 'Take-away within 32',
  facts: factsOf(['subtraction-11-16'], biggest(15, 16)),
};
// The 11 to 16 times of the tables up to 10 (11 × 3 up to 16 × 3), then the tables 11 to 16.
const stretchTimes1: Level = {
  title: '× up to 16: 1, 2, 5, 10',
  facts: stretchFacts('times', [1, 2, 5, 10]),
};
const stretchDivide1: Level = {
  title: '÷ up to 16: 1, 2, 5, 10',
  facts: stretchFacts('divide', [1, 2, 5, 10]),
};
const stretchTimes3: Level = { title: '× up to 16: 3, 4', facts: stretchFacts('times', [3, 4]) };
const stretchDivide3: Level = { title: '÷ up to 16: 3, 4', facts: stretchFacts('divide', [3, 4]) };
const stretchTimes6: Level = {
  title: '× up to 16: 6, 7, 8, 9',
  facts: stretchFacts('times', [6, 7, 8, 9]),
};
const stretchDivide6: Level = {
  title: '÷ up to 16: 6, 7, 8, 9',
  facts: stretchFacts('divide', [6, 7, 8, 9]),
};
const bigLevels = [11, 13, 15].map((from) => ({
  times: { title: `× ${from}, ${from + 1}`, facts: bigTableFacts('times', [from, from + 1]) },
  divide: { title: `÷ ${from}, ${from + 1}`, facts: bigTableFacts('divide', [from, from + 1]) },
}));

/** The missing-number twins of a plain level's facts, in the same order. */
const twins = (plain: Level, blank: Blank, shape: string): Level => ({
  title: `${plain.title}: ${shape}`,
  facts: plain.facts.map(({ fact }) => missingTwin(fact, blank)),
});

/**
 * Easiest first, in sections. Each section runs a plain pair (add or take away, times or divide),
 * the middle-blank twins of that pair (`4 + ? = 9`), and ends with the first-blank twins of all its
 * levels (`? + 5 = 9`), the hardest kind. 90 levels in all: the 30 plain levels, then 60 twins.
 * Only how many are open is saved (see `OLD_LEVEL_SPOTS`), so change titles freely but not the order.
 */
export const LEVELS: Level[] = [
  // Up to 20: levels 1 to 12.
  sums10,
  takeAway10,
  twins(sums10, 'middle', '4 + ? = 9'),
  twins(takeAway10, 'middle', '9 − ? = 4'),
  sums20,
  takeAway20,
  twins(sums20, 'middle', '8 + ? = 15'),
  twins(takeAway20, 'middle', '15 − ? = 8'),
  twins(sums10, 'first', '? + 5 = 9'),
  twins(takeAway10, 'first', '? − 5 = 4'),
  twins(sums20, 'first', '? + 7 = 15'),
  twins(takeAway20, 'first', '? − 7 = 8'),
  // Tables up to 10: levels 13 to 36.
  times1,
  divide1,
  twins(times1, 'middle', '5 × ? = 30'),
  twins(divide1, 'middle', '30 ÷ ? = 5'),
  times3,
  divide3,
  twins(times3, 'middle', '4 × ? = 28'),
  twins(divide3, 'middle', '28 ÷ ? = 4'),
  times6,
  divide6,
  twins(times6, 'middle', '6 × ? = 48'),
  twins(divide6, 'middle', '48 ÷ ? = 6'),
  times8,
  divide8,
  twins(times8, 'middle', '9 × ? = 63'),
  twins(divide8, 'middle', '63 ÷ ? = 9'),
  twins(times1, 'first', '? × 5 = 30'),
  twins(divide1, 'first', '? ÷ 5 = 6'),
  twins(times3, 'first', '? × 4 = 28'),
  twins(divide3, 'first', '? ÷ 4 = 7'),
  twins(times6, 'first', '? × 6 = 48'),
  twins(divide6, 'first', '? ÷ 6 = 8'),
  twins(times8, 'first', '? × 9 = 63'),
  twins(divide8, 'first', '? ÷ 9 = 7'),
  // Sums and take-aways up to 32: levels 37 to 54.
  sums24,
  takeAway24,
  twins(sums24, 'middle', '9 + ? = 21'),
  twins(takeAway24, 'middle', '21 − ? = 12'),
  sums28,
  takeAway28,
  twins(sums28, 'middle', '6 + ? = 19'),
  twins(takeAway28, 'middle', '19 − ? = 13'),
  sums32,
  takeAway32,
  twins(sums32, 'middle', '8 + ? = 23'),
  twins(takeAway32, 'middle', '23 − ? = 15'),
  twins(sums24, 'first', '? + 12 = 21'),
  twins(takeAway24, 'first', '? − 9 = 12'),
  twins(sums28, 'first', '? + 13 = 19'),
  twins(takeAway28, 'first', '? − 6 = 13'),
  twins(sums32, 'first', '? + 15 = 23'),
  twins(takeAway32, 'first', '? − 8 = 15'),
  // The 11 to 16 times of the tables up to 10: levels 55 to 72.
  stretchTimes1,
  stretchDivide1,
  twins(stretchTimes1, 'middle', '5 × ? = 60'),
  twins(stretchDivide1, 'middle', '60 ÷ ? = 5'),
  stretchTimes3,
  stretchDivide3,
  twins(stretchTimes3, 'middle', '3 × ? = 42'),
  twins(stretchDivide3, 'middle', '42 ÷ ? = 3'),
  stretchTimes6,
  stretchDivide6,
  twins(stretchTimes6, 'middle', '7 × ? = 91'),
  twins(stretchDivide6, 'middle', '91 ÷ ? = 7'),
  twins(stretchTimes1, 'first', '? × 5 = 60'),
  twins(stretchDivide1, 'first', '? ÷ 5 = 12'),
  twins(stretchTimes3, 'first', '? × 3 = 42'),
  twins(stretchDivide3, 'first', '? ÷ 3 = 14'),
  twins(stretchTimes6, 'first', '? × 7 = 91'),
  twins(stretchDivide6, 'first', '? ÷ 7 = 13'),
  // The tables 11 to 16: levels 73 to 90.
  bigLevels[0].times,
  bigLevels[0].divide,
  twins(bigLevels[0].times, 'middle', '12 × ? = 84'),
  twins(bigLevels[0].divide, 'middle', '84 ÷ ? = 12'),
  bigLevels[1].times,
  bigLevels[1].divide,
  twins(bigLevels[1].times, 'middle', '13 × ? = 52'),
  twins(bigLevels[1].divide, 'middle', '52 ÷ ? = 13'),
  bigLevels[2].times,
  bigLevels[2].divide,
  twins(bigLevels[2].times, 'middle', '15 × ? = 90'),
  twins(bigLevels[2].divide, 'middle', '90 ÷ ? = 15'),
  twins(bigLevels[0].times, 'first', '? × 12 = 84'),
  twins(bigLevels[0].divide, 'first', '? ÷ 12 = 7'),
  twins(bigLevels[1].times, 'first', '? × 13 = 52'),
  twins(bigLevels[1].divide, 'first', '? ÷ 13 = 4'),
  twins(bigLevels[2].times, 'first', '? × 15 = 90'),
  twins(bigLevels[2].divide, 'first', '? ÷ 15 = 6'),
];

export type PathId = 'math' | 'social-studies';

export interface LevelPath {
  /** Used in menu URLs (`?path=`, `?topics=`) and as the key of `pathLevelsOpen`. */
  id: PathId;
  /** Tab label: 'Math', 'Social Studies'. */
  title: string;
  /** Pseudo topic id games get as `?topic=`; stars and high scores are saved under it. Not in `TOPICS`. */
  levelTopicId: string;
  /** The topics the path's facts come from; the mastery bar and "Practice one topic" use these. */
  topics: Topic[];
  levels: Level[];
}

/** Pseudo topic id: Social Studies stars and high scores are saved under it. Not in `TOPICS`. */
export const SOCIAL_STUDIES_LEVEL_ID = 'social-studies-level';

export const MATH_PATH: LevelPath = {
  id: 'math',
  title: 'Math',
  levelTopicId: MY_LEVEL_ID,
  topics: MATH_TOPICS,
  levels: LEVELS,
};
export const SOCIAL_STUDIES_PATH: LevelPath = {
  id: 'social-studies',
  title: 'Social Studies',
  levelTopicId: SOCIAL_STUDIES_LEVEL_ID,
  topics: SOCIAL_STUDIES_TOPICS,
  levels: SOCIAL_STUDIES_LEVELS,
};
/** Tab order. */
export const PATHS: LevelPath[] = [MATH_PATH, SOCIAL_STUDIES_PATH];

export function getPath(id: string | null | undefined): LevelPath | undefined {
  return PATHS.find((p) => p.id === id);
}

export function pathForLevelTopic(topicId: string | null | undefined): LevelPath | undefined {
  return PATHS.find((p) => p.levelTopicId === topicId);
}

export function pathOfTopic(topicId: string): LevelPath | undefined {
  return PATHS.find((p) => p.topics.some((t) => t.id === topicId));
}

/** Every fact of the path's levels once, in first-seen level order. */
export function pathFacts(path: LevelPath): LevelFact[] {
  const seen = new Set<Fact>();
  const out: LevelFact[] = [];
  for (const level of path.levels) {
    for (const lf of level.facts) {
      if (seen.has(lf.fact)) continue;
      seen.add(lf.fact);
      out.push(lf);
    }
  }
  return out;
}

const topicByFact = new Map<Fact, Topic>(
  PATHS.flatMap((path) =>
    path.levels.flatMap((level) => level.facts.map(({ topic, fact }) => [fact, topic] as const)),
  ),
);

/** The real topic a level fact belongs to; its stats are saved under that topic's id. */
export function topicOfFact(fact: Fact): Topic {
  const topic = topicByFact.get(fact);
  if (!topic) throw new Error(`Fact ${fact.id} is not in any level`);
  return topic;
}

/** The saved open-level count of a path: `levelsOpen` for math, `pathLevelsOpen[path.id]` for the others. */
export function savedLevelsOpen(progress: PlayerProgress, path: LevelPath): number | undefined {
  return path.id === 'math' ? progress.levelsOpen : progress.pathLevelsOpen?.[path.id];
}

export function setLevelsOpen(progress: PlayerProgress, path: LevelPath, open: number): void {
  if (path.id === 'math') progress.levelsOpen = open;
  else progress.pathLevelsOpen = { ...progress.pathLevelsOpen, [path.id]: open };
}

/** True once enough of the level's facts were answered right the last time they came up. */
export function levelPassed(level: Level, stats: PlayerProgress['facts']): boolean {
  const right = level.facts.filter(({ topic, fact }) => {
    const stat = stats[topic.id]?.[fact.id];
    return stat !== undefined && stat.streak >= 1;
  }).length;
  return right / level.facts.length >= UNLOCK_SHARE;
}

/** How many levels are open (1 to the path's level count). Opening is sticky: it never goes back down. */
export function levelsOpen(progress: PlayerProgress, path: LevelPath = MATH_PATH): number {
  const { levels } = path;
  let open = Math.min(Math.max(1, Math.floor(savedLevelsOpen(progress, path) ?? 1)), levels.length);
  while (open < levels.length && levelPassed(levels[open - 1], progress.facts)) open++;
  return open;
}

/** Not learned yet. A miss always un-learns a fact, so it comes back here too. */
export function needsWork(stat: FactStat | undefined): boolean {
  return !isMastered(stat);
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
  path: LevelPath = MATH_PATH,
): Fact[] {
  const stat = ({ topic, fact }: LevelFact) => progress.facts[topic.id]?.[fact.id];
  const openLevels = new Set(
    path.levels.slice(0, levelsOpen(progress, path)).flatMap((l) => l.facts),
  );
  const open = pathFacts(path).filter((lf) => openLevels.has(lf));
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

/** 'Level 5 of 90: Sums to 20' */
export function levelLabel(open: number, path: LevelPath = MATH_PATH): string {
  return `Level ${open} of ${path.levels.length}: ${path.levels[open - 1].title}`;
}

/**
 * A topic standing in for My Level: all the level facts, a description that follows the player's
 * current level, and wrong answers taken from each fact's own topic.
 */
export function myLevelTopic(getLabel: () => string, path: LevelPath = MATH_PATH): Topic {
  return {
    id: path.levelTopicId,
    title: 'My Level',
    subject: 'My Level',
    get description() {
      return getLabel();
    },
    facts: pathFacts(path).map((lf) => lf.fact),
    distractors: (fact, count, random) =>
      answerOptions(topicOfFact(fact), fact, count + 1, random).filter((a) => a !== fact.answer),
  };
}
