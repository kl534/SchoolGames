import { describe, expect, it } from 'vitest';
import { runs } from './helpers/full';
import { seededRandom } from '../src/shared/random';
import { answerOptions, validateTopic } from '../src/shared/topics';
import {
  ANTONYM_TOPICS,
  antonymFact,
  SYNONYM_TOPICS,
  synonymFact,
  VOCAB_GRADES,
  VOCABULARY_TOPICS,
  type VocabRow,
} from '../src/shared/topics/vocabulary';

const POS = ['noun', 'verb', 'adj', 'adv'];
const HETERONYMS = new Set(
  `close live lives read lead tear wind wound minute present object content record project produce
  permit subject conduct contract desert refuse reject separate moderate estimate perfect upset use
  excuse house number does dove bow row bass sow`.split(/\s+/),
);
const rowOf = (word: string): VocabRow => {
  for (const g of VOCAB_GRADES) {
    const row = g.rows.find((r) => r[0] === word);
    if (row) return row;
  }
  throw new Error(`no row ${word}`);
};

describe('vocabulary data', () => {
  for (const grade of VOCAB_GRADES) {
    describe(grade.title, () => {
      it('has 300 rows, at least 150 with antonyms', () => {
        expect(grade.rows).toHaveLength(300);
        expect(grade.rows.filter((r) => r[3].length > 0).length).toBeGreaterThanOrEqual(150);
      });
      it('has well-formed rows', () => {
        for (const [word, pos, syns, ants] of grade.rows) {
          expect(word).toMatch(/^[a-z]+(-[a-z]+)*$/);
          expect(POS).toContain(pos);
          expect(syns.length, word).toBeGreaterThan(0);
          expect(syns, word).not.toContain(word);
          expect(ants, word).not.toContain(word);
          for (const a of ants) expect(syns, word).not.toContain(a);
        }
      });
      it('has no heteronym as head word or answer', () => {
        for (const [word, , syns, ants] of grade.rows) {
          for (const w of [word, syns[0], ants[0]]) {
            if (w !== undefined) expect(HETERONYMS.has(w), `${word}: ${w}`).toBe(false);
          }
        }
      });
    });
  }

  it('has unique head words across all grades', () => {
    const heads = VOCAB_GRADES.flatMap((g) => g.rows.map((r) => r[0]));
    expect(new Set(heads).size).toBe(heads.length);
  });
});

describe('vocabulary facts', () => {
  const happy = rowOf('happy');

  it('builds the happy facts', () => {
    expect(synonymFact(happy)).toEqual({
      id: 'syn-happy',
      prompt: 'Synonym of HAPPY',
      answer: 'glad',
      statement: 'Glad is a synonym of happy.',
      spokenPrompt: 'What is a synonym of happy?',
      wrongLines: { sad: 'Sad is an antonym of happy.' },
    });
    expect(antonymFact(happy)).toEqual({
      id: 'ant-happy',
      prompt: 'Antonym of HAPPY',
      answer: 'sad',
      statement: 'Sad is an antonym of happy.',
      spokenPrompt: 'What is an antonym of happy?',
      wrongLines: { glad: 'Glad is a synonym of happy.' },
    });
  });

  it('leaves out the antonym and the wrong line when a word has no opposite', () => {
    const jump = rowOf('jump');
    expect(antonymFact(jump)).toBeUndefined();
    expect(synonymFact(jump).wrongLines).toBeUndefined();
  });

  it('makes each wrong line equal to the sibling statement', () => {
    for (const grade of VOCAB_GRADES) {
      for (const row of grade.rows) {
        const syn = synonymFact(row);
        const ant = antonymFact(row);
        if (!ant) continue;
        expect(Object.values(syn.wrongLines!)).toEqual([ant.statement]);
        expect(Object.values(ant.wrongLines!)).toEqual([syn.statement]);
      }
    }
  });

  it('capitalises the answer in the statement', () => {
    expect(synonymFact(rowOf('famous')).statement).toBe('Well-known is a synonym of famous.');
  });
});

describe('vocabulary topics', () => {
  it('lists synonym topics then antonym topics', () => {
    expect(VOCABULARY_TOPICS.map((t) => t.id)).toEqual([
      'synonyms-grade-2',
      'synonyms-grade-3',
      'synonyms-grade-4',
      'synonyms-grade-5',
      'synonyms-grade-6',
      'synonyms-grade-7',
      'synonyms-grade-8',
      'synonyms-grade-9',
      'synonyms-grade-10',
      'synonyms-grade-11',
      'synonyms-grade-12',
      'synonyms-college',
      'antonyms-grade-2',
      'antonyms-grade-3',
      'antonyms-grade-4',
      'antonyms-grade-5',
      'antonyms-grade-6',
      'antonyms-grade-7',
      'antonyms-grade-8',
      'antonyms-grade-9',
      'antonyms-grade-10',
      'antonyms-grade-11',
      'antonyms-grade-12',
      'antonyms-college',
    ]);
    expect(SYNONYM_TOPICS.every((t) => t.subject === 'Synonyms')).toBe(true);
    expect(ANTONYM_TOPICS.every((t) => t.subject === 'Antonyms')).toBe(true);
    expect(SYNONYM_TOPICS[0].title).toBe('Grade 2 synonyms');
  });

  it('holds the right facts and validates', () => {
    VOCAB_GRADES.forEach((grade, g) => {
      expect(SYNONYM_TOPICS[g].facts).toHaveLength(300);
      expect(ANTONYM_TOPICS[g].facts).toHaveLength(grade.rows.filter((r) => r[3].length).length);
    });
    for (const topic of VOCABULARY_TOPICS) {
      expect(new Set(topic.facts.map((f) => f.id)).size).toBe(topic.facts.length);
      expect(validateTopic(topic)).toEqual([]);
    }
  });
});

describe('vocabulary distractors', () => {
  it('gives four distinct plausible options for every fact', () => {
    const seeds = runs(20, 2);
    VOCAB_GRADES.forEach((grade, g) => {
      const answersOfPos = new Map<string, Set<string>>();
      for (const row of grade.rows) {
        const set = answersOfPos.get(row[1]) ?? new Set<string>();
        set.add(row[2][0]);
        if (row[3][0]) set.add(row[3][0]);
        answersOfPos.set(row[1], set);
      }
      // A part of speech with under four answers in a grade (Grades 9 and 11 have one adverb) borrows the
      // same part of speech from the other grades.
      for (const [pos, set] of answersOfPos) {
        if (set.size >= 4) continue;
        for (const other of VOCAB_GRADES) {
          for (const row of other.rows) {
            if (row[1] !== pos) continue;
            set.add(row[2][0]);
            if (row[3][0]) set.add(row[3][0]);
          }
        }
      }
      for (const topic of [SYNONYM_TOPICS[g], ANTONYM_TOPICS[g]]) {
        const isSyn = topic.subject === 'Synonyms';
        for (const fact of topic.facts) {
          const head = fact.id.slice(4);
          const row = grade.rows.find((r) => r[0] === head)!;
          const sameKind = new Set(isSyn ? row[2] : row[3]);
          const trap = isSyn ? row[3][0] : row[2][0];
          for (let seed = 0; seed < seeds; seed++) {
            const options = answerOptions(topic, fact, 4, seededRandom(seed * 7919 + 1));
            expect(new Set(options).size, fact.id).toBe(4);
            expect(options, fact.id).toContain(fact.answer);
            for (const o of options) {
              if (o === fact.answer) continue;
              expect(sameKind.has(o), `${fact.id}: ${o}`).toBe(false);
              expect(o, fact.id).not.toBe(head);
              expect(answersOfPos.get(row[1])?.has(o), `${fact.id}: ${o}`).toBe(true);
            }
            // The trap is in unless a near word of the answer or head blocks it (rare).
            if (trap && row[3].length && !options.includes(trap)) {
              const near = [...row[2], ...row[3], head];
              expect(near.includes(trap) || sameKind.has(trap), `${fact.id}: trap ${trap}`).toBe(
                true,
              );
            }
          }
        }
      }
    });
  }, 60_000);

  it('keeps near words out and the trap in', () => {
    const big = SYNONYM_TOPICS[0].facts.find((f) => f.id === 'syn-big')!;
    const happy = ANTONYM_TOPICS[0].facts.find((f) => f.id === 'ant-happy')!;
    for (let seed = 0; seed < 200; seed++) {
      const a = answerOptions(SYNONYM_TOPICS[0], big, 4, seededRandom(seed));
      expect(a).toContain('small');
      for (const w of ['huge', 'giant', 'enormous', 'gigantic', 'immense', 'massive']) {
        expect(a).not.toContain(w);
      }
      const b = answerOptions(ANTONYM_TOPICS[0], happy, 4, seededRandom(seed));
      expect(b).toContain('glad');
      for (const w of ['unhappy', 'gloomy', 'miserable', 'sorrowful', 'glum']) {
        expect(b).not.toContain(w);
      }
    }
  });
});
