import type { Level, LevelFact } from './levels';
import {
  ANTONYM_TOPICS,
  SYNONYM_TOPICS,
  VOCAB_GRADES,
  WORDS_PER_SET,
  setsOf,
} from './topics/vocabulary';

/** Vocabulary levels: each grade's words in sets of 50, both kinds mixed. Only how many are open is saved: append grades, never reorder. */
export const VOCABULARY_LEVELS: Level[] = VOCAB_GRADES.flatMap((grade, g) => {
  const synTopic = SYNONYM_TOPICS[g];
  const antTopic = ANTONYM_TOPICS[g];
  const syn = new Map(synTopic.facts.map((f) => [f.id, f]));
  const ant = new Map(antTopic.facts.map((f) => [f.id, f]));
  return Array.from({ length: setsOf(grade) }, (_, s): Level => {
    const facts: LevelFact[] = [];
    for (const row of grade.rows.slice(s * WORDS_PER_SET, (s + 1) * WORDS_PER_SET)) {
      const a = syn.get(`syn-${row[0]}`);
      if (a) facts.push({ topic: synTopic, fact: a });
      const b = ant.get(`ant-${row[0]}`);
      if (b) facts.push({ topic: antTopic, fact: b });
    }
    return { title: `${grade.title} · Set ${s + 1}`, facts };
  });
});
