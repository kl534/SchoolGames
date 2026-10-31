import type { Fact, Topic } from './topics';

/** `?facts=<id>,<id>` in a dev build: these facts of the topic open every round, in this order. */
export function devFacts(topic: Topic, search: string = globalThis.location?.search ?? ''): Fact[] {
  if (!import.meta.env.DEV) return [];
  const ids = new URLSearchParams(search).get('facts')?.split(',') ?? [];
  const found: Fact[] = [];
  for (const id of ids) {
    const fact = topic.facts.find((f) => f.id === id);
    if (fact && !found.includes(fact)) found.push(fact);
  }
  return found;
}
