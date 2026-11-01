import {
  PATHS,
  getPath,
  levelLabel,
  levelsOpen,
  pathForLevelTopic,
  type LevelPath,
  type PathId,
} from '../shared/levels';
import { TOPICS, getTopic, groupBySubject, type Topic } from '../shared/topics';
import { countMastered, type PlayerProgress } from '../shared/progress';

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
  mastered: number;
  total: number;
}

function topicMastered(progress: PlayerProgress, topic: Topic): number {
  return countMastered(
    progress,
    topic.id,
    topic.facts.map((f) => f.id),
  );
}

export function pathChoiceInfo(progress: PlayerProgress, path: LevelPath): ChoiceInfo {
  return {
    id: path.levelTopicId,
    kind: 'path',
    title: `My Level · ${path.title}`,
    short: path.title,
    subtitle: levelLabel(levelsOpen(progress, path), path),
    mastered: path.topics.reduce((sum, t) => sum + topicMastered(progress, t), 0),
    total: path.topics.reduce((sum, t) => sum + t.facts.length, 0),
  };
}

export function choiceInfo(progress: PlayerProgress, id: string): ChoiceInfo {
  const path = pathForLevelTopic(id);
  if (path) return pathChoiceInfo(progress, path);
  const topic = getTopic(id);
  if (!topic) throw new Error(`Not a choice: ${id}`);
  return {
    id,
    kind: 'topic',
    title: topic.title,
    short: topic.title,
    subtitle: topic.description,
    mastered: topicMastered(progress, topic),
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
