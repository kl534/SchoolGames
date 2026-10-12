/** Returns a number in [0, 1), like Math.random. Injected so game logic is testable. */
export type Random = () => number;

/** Deterministic generator (mulberry32) for tests and reproducible rounds. */
export function seededRandom(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns a shuffled copy (Fisher-Yates). */
export function shuffle<T>(items: readonly T[], random: Random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Picks up to `count` distinct items, each draw proportional to its weight. */
export function weightedSample<T>(
  items: readonly T[],
  weight: (item: T) => number,
  count: number,
  random: Random = Math.random,
): T[] {
  const pool = items.map((item) => ({ item, weight: Math.max(weight(item), 0) }));
  const picked: T[] = [];
  while (picked.length < count && pool.length > 0) {
    const total = pool.reduce((sum, p) => sum + p.weight, 0);
    let index: number;
    if (total > 0) {
      let r = random() * total;
      index = pool.findIndex((p) => (r -= p.weight) < 0);
      if (index === -1) index = pool.length - 1;
    } else {
      index = Math.floor(random() * pool.length);
    }
    picked.push(pool[index].item);
    pool.splice(index, 1);
  }
  return picked;
}
