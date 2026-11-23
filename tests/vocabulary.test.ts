import { describe, expect, it } from 'vitest';
import { runs } from './helpers/full';
import { seededRandom } from '../src/shared/random';
import { answerOptions, validateTopic } from '../src/shared/topics';
import {
  ANTONYM_TOPICS,
  antonymFact,
  exampleParts,
  isFormOf,
  SYNONYM_TOPICS,
  synonymFact,
  setsOf,
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
/** Rows each grade has. Grow a grade by appending rows in fifties and raising its number here. */
const WORDS: Record<string, number> = {
  '2': 400,
  '3': 400,
  '4': 500,
  '5': 500,
  '6': 500,
  '7': 500,
  '8': 500,
  '9': 500,
  '10': 500,
  '11': 300,
  '12': 300,
  college: 300,
};
/** FNV-1a, to pin the first 300 head words of each grade as they were on main. */
const fnv1a = (text: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
};
const OLD_HEAD_HASHES: Record<string, string> = {
  '2': '09b5477e',
  '3': 'a40ee917',
  '4': '74c9a633',
  '5': '1d71b204',
  '6': '7766350c',
  '7': 'e57cc567',
  '8': '03081b85',
  '9': '3202f21f',
  '10': 'e28d058b',
  '11': 'b5d6ac8d',
  '12': 'fa86d22f',
  college: 'f1ae55a7',
};
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
      it('has the right number of rows, in whole sets, at least half with antonyms', () => {
        expect(grade.rows).toHaveLength(WORDS[grade.id]);
        expect(grade.rows.length % 50).toBe(0);
        const withAntonyms = (rows: readonly VocabRow[]) =>
          rows.filter((r) => r[3].length > 0).length;
        expect(withAntonyms(grade.rows)).toBeGreaterThanOrEqual(grade.rows.length / 2);
        const added = grade.rows.slice(300);
        expect(withAntonyms(added)).toBeGreaterThanOrEqual(added.length / 2);
      });
      it('still starts with the same 300 head words as before it grew', () => {
        const heads = grade.rows.slice(0, 300).map((r) => r[0]);
        expect(fnv1a(heads.join(','))).toBe(OLD_HEAD_HASHES[grade.id]);
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

  it('counts the sets of a grade', () => {
    expect(setsOf(VOCAB_GRADES[0])).toBe(WORDS['2'] / 50);
    expect(setsOf(VOCAB_GRADES[2])).toBe(WORDS['4'] / 50);
  });

  it('has unique head words across all grades', () => {
    const heads = VOCAB_GRADES.flatMap((g) => g.rows.map((r) => r[0]));
    expect(new Set(heads).size).toBe(heads.length);
  });
});

describe('vocabulary facts', () => {
  const happy = rowOf('happy');
  const happyMeaning = VOCAB_GRADES[0].meanings.happy;
  const meaningOf = (relation: 'Synonym' | 'Antonym') => ({
    word: 'happy',
    partOfSpeech: 'adjective',
    definition: happyMeaning[0],
    example: happyMeaning[1],
    relation,
  });

  it('has no meaning key when none is given', () => {
    expect('meaning' in synonymFact(happy)).toBe(false);
    expect('meaning' in antonymFact(happy)!).toBe(false);
  });

  it('builds the happy facts', () => {
    expect(synonymFact(happy, happyMeaning)).toEqual({
      id: 'syn-happy',
      prompt: 'Synonym of HAPPY',
      answer: 'glad',
      statement: 'Glad is a synonym of happy.',
      spokenPrompt: 'What is a synonym of happy?',
      wrongLines: { sad: 'Sad is an antonym of happy.' },
      meaning: meaningOf('Synonym'),
    });
    expect(antonymFact(happy, happyMeaning)).toEqual({
      id: 'ant-happy',
      prompt: 'Antonym of HAPPY',
      answer: 'sad',
      statement: 'Sad is an antonym of happy.',
      spokenPrompt: 'What is an antonym of happy?',
      wrongLines: { glad: 'Glad is a synonym of happy.' },
      meaning: meaningOf('Antonym'),
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
      expect(SYNONYM_TOPICS[g].facts).toHaveLength(grade.rows.length);
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

describe('word meanings', () => {
  const headOf = (id: string): string => id.slice(id.indexOf('-') + 1);
  const wordsOf = (text: string): string[] => text.toLowerCase().match(/[a-z']+/g) ?? [];

  for (const grade of VOCAB_GRADES) {
    describe(grade.title, () => {
      const meanings = grade.meanings;
      it('has an entry for every head word, in order, and no others', () => {
        expect(Object.keys(meanings)).toEqual(grade.rows.map((r) => r[0]));
      });
      it('has definitions that follow the rules', () => {
        for (const [word, [definition]] of Object.entries(meanings)) {
          expect(definition.length, word).toBeLessThanOrEqual(60);
          expect(definition, word).toMatch(/^[a-z]/);
          expect(definition, word).not.toMatch(/[.!?]$/);
          expect(wordsOf(definition), word).not.toContain(word);
        }
      });
      it('has examples that follow the rules', () => {
        for (const [word, [, example]] of Object.entries(meanings)) {
          expect(example.length, word).toBeLessThanOrEqual(90);
          expect(example, word).toMatch(/^\*?[A-Z]/);
          expect(example, word).toMatch(/[.!?]$/);
          const count = example.replace(/\*/g, '').split(/\s+/).length;
          expect(count, word).toBeGreaterThanOrEqual(5);
          expect(count, word).toBeLessThanOrEqual(15);
          const [, span] = exampleParts(example);
          expect(isFormOf(span, word), `${word}: ${span}`).toBe(true);
        }
      });
      it('gives every fact its meaning, and no definition is just the answer', () => {
        const topics = VOCABULARY_TOPICS.filter((t) =>
          t.id.endsWith(grade.id === 'college' ? 'college' : `grade-${grade.id}`),
        );
        expect(topics).toHaveLength(2);
        for (const topic of topics) {
          for (const fact of topic.facts) {
            expect(fact.meaning, fact.id).toBeDefined();
            expect(fact.meaning!.word, fact.id).toBe(headOf(fact.id));
            expect(fact.meaning!.definition, fact.id).not.toBe(fact.answer);
          }
        }
      });
    });
  }
});

describe('exampleParts', () => {
  it('splits an example at its word', () => {
    expect(exampleParts('She was *happy* to see her best friend.')).toEqual([
      'She was ',
      'happy',
      ' to see her best friend.',
    ]);
  });
  it('throws without exactly one span', () => {
    expect(() => exampleParts('No span here.')).toThrow();
    expect(() => exampleParts('*Two* spans *here*.')).toThrow();
  });
});

describe('isFormOf', () => {
  it.each([
    ['happy', 'happy', true],
    ['happier', 'happy', true],
    ['hurried', 'hurry', true],
    ['admiring', 'admire', true],
    ['stopped', 'stop', true],
    ['ran', 'run', false],
    ['unhappy', 'happy', false],
  ])('%s of %s is %s', (span, word, expected) => {
    expect(isFormOf(span, word)).toBe(expected);
  });
});
