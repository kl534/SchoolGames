import {
  PATHS,
  getPath,
  levelLabel,
  levelsOpen,
  pathForLevelTopic,
  type LevelPath,
  type PathId,
} from '../shared/levels';
import { TOPICS, getTopic, groupBySubject, type Fact, type Topic } from '../shared/topics';
import {
  STEP_NAMES,
  countSteps,
  learnStep,
  readyAt,
  isWaiting,
  type LearnStep,
  type PlayerProgress,
  type StepCounts,
} from '../shared/progress';

/** How many choice ids `progress.recent` keeps (the current one + 3 shown as "Recently played"). */
export const RECENT_MAX = 4;
/** How many "Recently played" chips the picker shows. */
export const RECENT_SHOWN = 3;

export const PATH_EMOJI: Record<PathId, string> = { math: '🔢', 'social-studies': '🌎' };

/** Topics matching a pattern become number tiles; `n` is the first capture group. */
const TILE_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /^times-(\d+)$/, label: 'Times tables' },
  { pattern: /^divide-by-(\d+)$/, label: 'Divide by' },
];

/** True for a path's level topic id or a topic id in TOPICS. */
export function isChoice(id: string | null | undefined): id is string {
  return Boolean(id) && (pathForLevelTopic(id) !== undefined || getTopic(id) !== undefined);
}

/** The first valid id in `recent`; else the path saved in the old `homePath`; else 'my-level'. */
export function currentChoice(progress: PlayerProgress): string {
  const recent = (progress.recent ?? []).find(isChoice);
  if (recent) return recent;
  return (getPath(progress.homePath) ?? PATHS[0]).levelTopicId;
}

/**
 * Moves `id` to the front of `progress.recent` (no duplicates, at most RECENT_MAX, invalid ids
 * dropped). If `recent` has no valid id yet, it is first seeded with `currentChoice(progress)`, so
 * the choice the player was on (e.g. the default My Level · Math) becomes a "Recently played" chip.
 * For a path id also sets `progress.homePath = path.id`. Throws on a non-choice id.
 */
export function rememberChoice(progress: PlayerProgress, id: string): void {
  if (!isChoice(id)) throw new Error(`Not a choice: ${id}`);
  const seeded = (progress.recent ?? []).some(isChoice)
    ? (progress.recent ?? [])
    : [currentChoice(progress)];
  const rest = seeded.filter((r) => r !== id && isChoice(r));
  progress.recent = [id, ...rest].slice(0, RECENT_MAX);
  const path = pathForLevelTopic(id);
  if (path) progress.homePath = path.id;
}

/** Valid `recent` ids other than the current choice, at most RECENT_SHOWN, newest first. */
export function recentChoices(progress: PlayerProgress): string[] {
  const current = currentChoice(progress);
  return (progress.recent ?? [])
    .filter((id) => isChoice(id) && id !== current)
    .slice(0, RECENT_SHOWN);
}

export interface ChoiceInfo {
  id: string;
  kind: 'path' | 'topic';
  /** 'My Level · Math', 'My Level · Social Studies', or the topic title ('7 times table'). */
  title: string;
  /** Short name for chips: the path title ('Math') or the topic title. */
  short: string;
  /** Path: levelLabel(levelsOpen(progress, path), path). Topic: topic.description. */
  subtitle: string;
  /** Learned facts; the same as `steps[3]`. */
  mastered: number;
  /** Facts per step: [new, started, almost, learned]. */
  steps: StepCounts;
  total: number;
}

function topicSteps(progress: PlayerProgress, topic: Topic): StepCounts {
  return countSteps(
    progress,
    topic.id,
    topic.facts.map((f) => f.id),
  );
}

/** '12 / 40 learned · 5 almost · 8 started'; the almost/started parts only when above 0. */
export function masteryText(steps: StepCounts, total: number): string {
  const parts = [`${steps[3]} / ${total} learned`];
  if (steps[2] > 0) parts.push(`${steps[2]} almost`);
  if (steps[1] > 0) parts.push(`${steps[1]} started`);
  return parts.join(' · ');
}

/** '7 times table, 3 of 10 learned, 2 almost, 3 started' (zero parts left out, as above). */
export function masteryLabel(title: string, steps: StepCounts, total: number): string {
  const parts = [title, `${steps[3]} of ${total} learned`];
  if (steps[2] > 0) parts.push(`${steps[2]} almost`);
  if (steps[1] > 0) parts.push(`${steps[1]} started`);
  return parts.join(', ');
}

/** '🕒 9:40 pm', or '🕒 tomorrow 1:15 am' when readyAt is on a later local day than now. */
export function readyLabel(readyAt: number, now: number): string {
  const at = new Date(readyAt);
  const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  const later = at.toDateString() !== new Date(now).toDateString();
  return `🕒 ${later ? 'tomorrow ' : ''}${time}`;
}

export function pathChoiceInfo(progress: PlayerProgress, path: LevelPath): ChoiceInfo {
  const steps = path.topics.reduce<StepCounts>(
    (sum, t) => {
      const counts = topicSteps(progress, t);
      return [sum[0] + counts[0], sum[1] + counts[1], sum[2] + counts[2], sum[3] + counts[3]];
    },
    [0, 0, 0, 0],
  );
  return {
    id: path.levelTopicId,
    kind: 'path',
    title: `My Level · ${path.title}`,
    short: path.title,
    subtitle: levelLabel(levelsOpen(progress, path), path),
    mastered: steps[3],
    steps,
    total: path.topics.reduce((sum, t) => sum + t.facts.length, 0),
  };
}

export function choiceInfo(progress: PlayerProgress, id: string): ChoiceInfo {
  const path = pathForLevelTopic(id);
  if (path) return pathChoiceInfo(progress, path);
  const topic = getTopic(id);
  if (!topic) throw new Error(`Not a choice: ${id}`);
  const steps = topicSteps(progress, topic);
  return {
    id,
    kind: 'topic',
    title: topic.title,
    short: topic.title,
    subtitle: topic.description,
    mastered: steps[3],
    steps,
    total: topic.facts.length,
  };
}

export interface TileGroup {
  /** 'Times tables' or 'Divide by'. */
  label: string;
  /** In number order 1..10; `n` is the tile's text. */
  tiles: { n: number; topic: Topic }[];
}
export interface PickerSection {
  subject: string;
  /** 'addition', 'social-studies': lowercase kebab of the subject, used as the element id `pick-<anchor>`. */
  anchor: string;
  tiles?: TileGroup;
  /** Every other topic of the subject, in TOPICS order. */
  rows: Topic[];
}

/** groupBySubject(topics), with topics matching TILE_PATTERNS pulled into `tiles`. */
export function pickerSections(topics: Topic[] = TOPICS): PickerSection[] {
  return groupBySubject(topics).map(({ subject, topics: list }) => {
    const section: PickerSection = {
      subject,
      anchor: subject
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
      rows: [],
    };
    for (const topic of list) {
      const hit = TILE_PATTERNS.map((t) => ({ t, m: t.pattern.exec(topic.id) })).find((x) => x.m);
      if (!hit?.m || (section.tiles && section.tiles.label !== hit.t.label)) {
        section.rows.push(topic);
        continue;
      }
      section.tiles ??= { label: hit.t.label, tiles: [] };
      section.tiles.tiles.push({ n: Number(hit.m[1]), topic });
    }
    section.tiles?.tiles.sort((a, b) => a.n - b.n);
    return section;
  });
}

export interface FactListItem {
  fact: Fact;
  step: LearnStep;
  /** Set only while waiting at `now`. */
  readyAt: number | null;
}
export interface FactListSection {
  heading: string;
  /** Set for a topic's step groups. */
  step?: LearnStep;
  items: FactListItem[];
}

/** The order a topic's step groups are listed in. */
const STEP_ORDER: LearnStep[] = [3, 2, 1, 0];

/**
 * The fact list page's sections for a choice. A topic: its facts grouped by step (Learned, Almost,
 * Started, New; empty groups left out). A path: its open levels newest first, each fact under the
 * earliest level that has it.
 */
export function factListSections(
  progress: PlayerProgress,
  choiceId: string,
  now: number,
): FactListSection[] {
  const item = (fact: Fact, topicId: string): FactListItem => {
    const stat = progress.facts[topicId]?.[fact.id];
    return {
      fact,
      step: learnStep(stat),
      readyAt: isWaiting(stat, now) ? readyAt(stat) : null,
    };
  };
  const path = pathForLevelTopic(choiceId);
  if (path) {
    const seen = new Set<Fact>();
    const sections: FactListSection[] = [];
    path.levels.slice(0, levelsOpen(progress, path)).forEach((level, i) => {
      const items: FactListItem[] = [];
      for (const { topic, fact } of level.facts) {
        if (seen.has(fact)) continue;
        seen.add(fact);
        items.push(item(fact, topic.id));
      }
      if (items.length > 0) sections.push({ heading: levelLabel(i + 1, path), items });
    });
    return sections.reverse();
  }
  const topic = getTopic(choiceId);
  if (!topic) throw new Error(`Not a choice: ${choiceId}`);
  const all = topic.facts.map((fact) => item(fact, topic.id));
  return STEP_ORDER.map((step) => ({
    heading: STEP_NAMES[step],
    step,
    items: all.filter((i) => i.step === step),
  })).filter((section) => section.items.length > 0);
}
