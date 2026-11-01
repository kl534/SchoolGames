import type { FactStat, PlayerProgress } from '../progress';

type Nested = Record<string, Record<string, number>>;

/** The fact stat to keep: the newer answer wins whole (counts are not summed). */
function pickStat(a: FactStat, b: FactStat): FactStat {
  if (a.lastSeen !== b.lastSeen) return a.lastSeen > b.lastSeen ? a : b;
  return b.correct + b.wrong > a.correct + a.wrong ? b : a;
}

function maxNested(a: Nested | undefined, b: Nested | undefined): Nested {
  const out: Nested = {};
  for (const source of [a ?? {}, b ?? {}]) {
    for (const [topic, games] of Object.entries(source)) {
      const target = (out[topic] ??= {});
      for (const [game, value] of Object.entries(games)) {
        target[game] = Math.max(target[game] ?? -Infinity, value);
      }
    }
  }
  return out;
}

function maxFlat(
  a: Record<string, number> | undefined,
  b: Record<string, number> | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const source of [a ?? {}, b ?? {}]) {
    for (const [key, value] of Object.entries(source)) {
      out[key] = Math.max(out[key] ?? -Infinity, value);
    }
  }
  return out;
}

function maxOptional(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.max(a, b);
}

/**
 * Merges two devices' progress for one player. Both inputs are already normalized and are not
 * changed. Facts: the newer stat wins whole. Scores, stars and open levels: the larger value.
 * Fields that can go down (`ladders`, `homePath`, `recent`): from the side saved last.
 */
export function mergeProgress(a: PlayerProgress, b: PlayerProgress): PlayerProgress {
  const facts: PlayerProgress['facts'] = {};
  for (const topic of new Set([...Object.keys(a.facts), ...Object.keys(b.facts)])) {
    const left = a.facts[topic] ?? {};
    const right = b.facts[topic] ?? {};
    const merged: Record<string, FactStat> = {};
    for (const id of new Set([...Object.keys(left), ...Object.keys(right)])) {
      const l = left[id];
      const r = right[id];
      merged[id] = { ...(l && r ? pickStat(l, r) : (l ?? r)) };
    }
    facts[topic] = merged;
  }

  const out: PlayerProgress = {
    facts,
    best: maxNested(a.best, b.best),
    highScores: maxNested(a.highScores, b.highScores),
  };

  const levelsOpen = maxOptional(a.levelsOpen, b.levelsOpen);
  if (levelsOpen !== undefined) out.levelsOpen = levelsOpen;
  const levelsVersion = maxOptional(a.levelsVersion, b.levelsVersion);
  if (levelsVersion !== undefined) out.levelsVersion = levelsVersion;
  if (a.pathLevelsOpen || b.pathLevelsOpen) {
    out.pathLevelsOpen = maxFlat(a.pathLevelsOpen, b.pathLevelsOpen);
  }

  // The side saved last settles the fields that can go down; if it lacks one, use the other's.
  const [first, second] = (b.savedAt ?? 0) > (a.savedAt ?? 0) ? [b, a] : [a, b];
  const ladders = first.ladders ?? second.ladders;
  if (ladders) out.ladders = structuredClone(ladders);
  const homePath = first.homePath ?? second.homePath;
  if (homePath !== undefined) out.homePath = homePath;
  const recent = first.recent ?? second.recent;
  if (recent) out.recent = [...recent];

  const savedAt = maxOptional(a.savedAt, b.savedAt);
  if (savedAt !== undefined) out.savedAt = savedAt;
  return out;
}
