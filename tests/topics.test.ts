import { describe, expect, it } from 'vitest';
import { seededRandom } from '../src/shared/random';
import {
  answerOptions,
  getTopic,
  groupBySubject,
  listTopic,
  missSpeech,
  statementParts,
  statementSpeech,
  TOPICS,
  validateTopic,
} from '../src/shared/topics';
import {
  capitalDistractors,
  DIVISION_REGION,
  STATE_CAPITALS,
  stateCapitals,
} from '../src/shared/topics/capitals';
import { runs } from './helpers/full';
import {
  mathFact,
  MATH_TOPICS,
  missingDistractors,
  missingFact,
  missingTwin,
  numericDistractors,
} from '../src/shared/topics/math';

describe('built-in topics', () => {
  it('have unique ids', () => {
    const ids = TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(TOPICS.map((t) => [t.id, t] as const))('%s is valid', (_id, topic) => {
    expect(validateTopic(topic)).toEqual([]);
  });

  it.each(TOPICS.map((t) => [t.id, t] as const))(
    '%s gives four distinct options containing the answer for every fact',
    (_id, topic) => {
      const random = seededRandom(1);
      for (const fact of topic.facts) {
        const options = answerOptions(topic, fact, 4, random);
        expect(options).toHaveLength(4);
        expect(new Set(options).size).toBe(4);
        expect(options).toContain(fact.answer);
      }
    },
  );

  it('addition 1-10 uses both addends from 1 to 10', () => {
    const topic = getTopic('addition-1-10')!;
    expect(topic.facts).toHaveLength(100);
    expect(topic.facts.map((f) => f.answer).map(Number)).toContain(20);
    expect(topic.facts.find((f) => f.id === '7+8')?.statement).toBe('7 + 8 = 15');
  });

  it('subtraction 1-10 mirrors the addition facts', () => {
    const topic = getTopic('subtraction-1-10')!;
    expect(topic.facts).toHaveLength(100);
    const answers = topic.facts.map((f) => Number(f.answer));
    expect(Math.min(...answers)).toBe(1);
    expect(Math.max(...answers)).toBe(10);
    expect(topic.facts.find((f) => f.id === '15-8')?.answer).toBe('7');
  });

  it('addition 11-16 holds every pair up to 16 with a number over 10', () => {
    const big = getTopic('addition-11-16')!;
    const base = getTopic('addition-1-10')!;
    expect(big.facts).toHaveLength(156);
    for (const { visual } of big.facts) {
      expect(Math.min(visual!.a, visual!.b)).toBeGreaterThanOrEqual(1);
      expect(Math.max(visual!.a, visual!.b)).toBeLessThanOrEqual(16);
      expect(Math.max(visual!.a, visual!.b)).toBeGreaterThanOrEqual(11);
    }
    const pairs = [...base.facts, ...big.facts].map((f) => `${f.visual!.a},${f.visual!.b}`);
    expect(pairs).toHaveLength(256);
    expect(new Set(pairs).size).toBe(256);
    const three = big.facts.find((f) => f.id === '3+12')!;
    expect(three.answer).toBe('15');
    expect(three.statement).toBe('3 + 12 = 15');
    expect(big.facts.find((f) => f.id === '16+16')?.answer).toBe('32');
    const answers = big.facts.map((f) => Number(f.answer));
    expect(Math.min(...answers)).toBe(12);
    expect(Math.max(...answers)).toBe(32);
  });

  it('subtraction 11-16 mirrors addition 11-16', () => {
    const big = getTopic('subtraction-11-16')!;
    const base = getTopic('subtraction-1-10')!;
    expect(big.facts).toHaveLength(156);
    const fact = big.facts.find((f) => f.id === '27-12')!;
    expect(fact.answer).toBe('15');
    expect(fact.statement).toBe('27 − 12 = 15');
    expect(big.facts.find((f) => f.id === '32-16')?.answer).toBe('16');
    for (const f of big.facts) {
      expect(f.visual!.a).toBeLessThanOrEqual(32);
      expect(Number(f.answer)).toBeGreaterThanOrEqual(1);
      expect(Number(f.answer)).toBeLessThanOrEqual(16);
    }
    const pairs = [...base.facts, ...big.facts].map((f) => `${f.visual!.b},${Number(f.answer)}`);
    expect(pairs).toHaveLength(256);
    expect(new Set(pairs).size).toBe(256);
  });

  it('lists the up-to-10 tables, one 11-16 card, then the two Missing numbers cards', () => {
    const ids = (subject: string) => TOPICS.filter((t) => t.subject === subject).map((t) => t.id);
    expect(ids('Multiplication')).toEqual([
      ...Array.from({ length: 10 }, (_, i) => `times-${i + 1}`),
      'multiplication-11-16',
      'multiplication-missing-1-10',
      'multiplication-missing-11-16',
    ]);
    expect(ids('Division')).toEqual([
      ...Array.from({ length: 10 }, (_, i) => `divide-by-${i + 1}`),
      'division-11-16',
      'division-missing-1-10',
      'division-missing-11-16',
    ]);
    expect(getTopic('times-11')).toBeUndefined();
    expect(getTopic('times-16')).toBeUndefined();
    expect(getTopic('divide-by-12')).toBeUndefined();
  });

  it('has times tables 1 to 10, each running from 1 × n to 10 × n', () => {
    for (let n = 1; n <= 10; n++) {
      const topic = getTopic(`times-${n}`)!;
      expect(topic.facts.map((f) => f.answer)).toEqual(
        Array.from({ length: 10 }, (_, i) => String((i + 1) * n)),
      );
      expect(topic.facts.map((f) => f.id)).toEqual(
        Array.from({ length: 10 }, (_, i) => `${i + 1}x${n}`),
      );
    }
  });

  it('has divisors 1 to 10, mirroring the times tables', () => {
    for (let n = 1; n <= 10; n++) {
      const topic = getTopic(`divide-by-${n}`)!;
      expect(topic.facts.map((f) => f.answer)).toEqual(
        Array.from({ length: 10 }, (_, i) => String(i + 1)),
      );
      expect(topic.facts.map((f) => f.id)).toEqual(
        Array.from({ length: 10 }, (_, i) => `${(i + 1) * n}/${n}`),
      );
      expect(topic.facts[1].statement).toBe(`${2 * n} ÷ ${n} = 2`);
    }
  });

  it('multiplication 11-16 holds every product with a number over 10', () => {
    const big = getTopic('multiplication-11-16')!;
    const small = Array.from({ length: 10 }, (_, i) => getTopic(`times-${i + 1}`)!);
    expect(big.facts).toHaveLength(156);
    for (const { visual } of big.facts) {
      expect(visual!.kind).toBe('multiply');
      expect(Math.max(visual!.a, visual!.b)).toBeGreaterThanOrEqual(11);
      expect(Math.max(visual!.a, visual!.b)).toBeLessThanOrEqual(16);
      expect(Math.min(visual!.a, visual!.b)).toBeGreaterThanOrEqual(1);
    }
    expect(big.facts.find((f) => f.id === '12x7')?.statement).toBe('12 × 7 = 84');
    expect(big.facts.find((f) => f.id === '7x12')?.statement).toBe('7 × 12 = 84');
    expect(big.facts.find((f) => f.id === '16x16')?.statement).toBe('16 × 16 = 256');
    expect(big.facts.find((f) => f.id === '3x7')).toBeUndefined();
    const pairs = [...small, big]
      .flatMap((t) => t.facts)
      .map((f) => `${f.visual!.a},${f.visual!.b}`);
    expect(pairs).toHaveLength(256);
    expect(new Set(pairs).size).toBe(256);
  });

  it('division 11-16 mirrors multiplication 11-16', () => {
    const big = getTopic('division-11-16')!;
    const small = Array.from({ length: 10 }, (_, i) => getTopic(`divide-by-${i + 1}`)!);
    expect(big.facts).toHaveLength(156);
    for (const { visual, answer } of big.facts) {
      expect(visual!.kind).toBe('divide');
      expect(Math.max(Number(answer), visual!.b)).toBeGreaterThanOrEqual(11);
      expect(Math.max(Number(answer), visual!.b)).toBeLessThanOrEqual(16);
    }
    const fact = big.facts.find((f) => f.id === '84/7')!;
    expect(fact.answer).toBe('12');
    expect(fact.statement).toBe('84 ÷ 7 = 12');
    expect(big.facts.find((f) => f.id === '182/14')).toBeDefined();
    expect(big.facts.find((f) => f.id === '256/16')?.answer).toBe('16');
    expect(big.facts.find((f) => f.id === '70/7')).toBeUndefined();
    const pairs = [...small, big].flatMap((t) => t.facts).map((f) => `${f.answer},${f.visual!.b}`);
    expect(pairs).toHaveLength(256);
    expect(new Set(pairs).size).toBe(256);
  });

  it('keeps every times and divide fact id, each in exactly one topic', () => {
    const topicsOf = (id: string) => TOPICS.filter((t) => t.facts.some((f) => f.id === id));
    for (let n = 1; n <= 16; n++) {
      for (let table = 1; table <= 16; table++) {
        expect(topicsOf(`${n}x${table}`)).toHaveLength(1);
        expect(topicsOf(`${n * table}/${table}`)).toHaveLength(1);
      }
    }
    const timesIds = TOPICS.filter(
      (t) => t.subject === 'Multiplication' && !t.id.includes('missing'),
    ).flatMap((t) => t.facts.map((f) => f.id));
    const divideIds = TOPICS.filter(
      (t) => t.subject === 'Division' && !t.id.includes('missing'),
    ).flatMap((t) => t.facts.map((f) => f.id));
    expect(timesIds).toHaveLength(256);
    expect(divideIds).toHaveLength(256);
  });

  it('groups by subject in order', () => {
    expect(groupBySubject().map((g) => g.subject)).toEqual([
      'Addition',
      'Subtraction',
      'Multiplication',
      'Division',
      'Social Studies',
    ]);
    const ids = (subject: string) =>
      groupBySubject()
        .find((g) => g.subject === subject)!
        .topics.map((t) => t.id);
    expect(ids('Addition')).toEqual([
      'addition-1-10',
      'addition-11-16',
      'addition-missing-1-10',
      'addition-missing-11-16',
    ]);
    expect(ids('Subtraction')).toEqual([
      'subtraction-1-10',
      'subtraction-11-16',
      'subtraction-missing-1-10',
      'subtraction-missing-11-16',
    ]);
    expect(ids('Multiplication')).toHaveLength(13);
    expect(ids('Multiplication').slice(-3)).toEqual([
      'multiplication-11-16',
      'multiplication-missing-1-10',
      'multiplication-missing-11-16',
    ]);
    expect(ids('Division')).toHaveLength(13);
    expect(ids('Division').slice(-3)).toEqual([
      'division-11-16',
      'division-missing-1-10',
      'division-missing-11-16',
    ]);
    for (const subject of ['Addition', 'Subtraction', 'Multiplication', 'Division']) {
      const group = groupBySubject().find((g) => g.subject === subject)!;
      expect(group.topics.slice(-2).map((t) => t.title)).toEqual([
        'Missing numbers 1–10',
        'Missing numbers 11–16',
      ]);
    }
  });

  it('returns undefined for unknown topics', () => {
    expect(getTopic('nope')).toBeUndefined();
    expect(getTopic(null)).toBeUndefined();
  });
});

describe('mathFact', () => {
  it('builds prompt, statement and speech', () => {
    expect(mathFact('multiply', 3, 4)).toMatchObject({
      id: '3x4',
      prompt: '3 × 4 = ?',
      answer: '12',
      statement: '3 × 4 = 12',
      spokenPrompt: '3 times 4.',
      spokenStatement: '3 times 4 equals 12.',
    });
  });
});

describe('mathFact divide', () => {
  it('builds prompt, statement and speech', () => {
    expect(mathFact('divide', 12, 3)).toMatchObject({
      id: '12/3',
      prompt: '12 ÷ 3 = ?',
      answer: '4',
      statement: '12 ÷ 3 = 4',
      spokenPrompt: '12 divided by 3.',
      spokenStatement: '12 divided by 3 equals 4.',
    });
  });
});

describe('numericDistractors', () => {
  it('never returns the answer or values below min, and fills up to count', () => {
    const result = numericDistractors(1, [1, 0, -1, 2], 3, seededRandom(4), 1);
    expect(result).toHaveLength(3);
    expect(result).not.toContain('1');
    expect(result.map(Number).every((n) => n >= 1)).toBe(true);
    expect(new Set(result).size).toBe(3);
  });
});

describe('listTopic', () => {
  const words = listTopic(
    { id: 'sight-words', title: 'Sight words', subject: 'Reading', description: 'Words.' },
    [
      { prompt: '🔊', answer: 'the', spokenPrompt: 'the' },
      { prompt: '🔊', answer: 'said', spokenPrompt: 'said' },
      { prompt: '🔊', answer: 'was', spokenPrompt: 'was' },
      { prompt: '🔊', answer: 'they', spokenPrompt: 'they' },
    ],
  );

  it('is valid and uses answers as ids', () => {
    expect(validateTopic(words)).toEqual([]);
    expect(words.facts.map((f) => f.id)).toEqual(['the', 'said', 'was', 'they']);
  });

  it('takes wrong answers from the other words', () => {
    const options = answerOptions(words, words.facts[0], 4, seededRandom(2));
    expect([...options].sort()).toEqual(['said', 'the', 'they', 'was']);
  });

  it('returns fewer options when the list is short', () => {
    const tiny = listTopic({ id: 'tiny', title: 'T', subject: 'S', description: 'D' }, [
      { prompt: 'a?', answer: 'a' },
      { prompt: 'b?', answer: 'b' },
    ]);
    expect(answerOptions(tiny, tiny.facts[0], 4)).toHaveLength(2);
  });
});

describe('validateTopic', () => {
  it('reports duplicate fact ids and bad topic ids', () => {
    const bad = listTopic({ id: 'Bad Id', title: 'T', subject: 'S', description: 'D' }, [
      { prompt: 'x', answer: 'a' },
      { prompt: 'y', answer: 'a' },
    ]);
    const errors = validateTopic(bad);
    expect(errors.some((e) => e.includes('kebab-case'))).toBe(true);
    expect(errors.some((e) => e.includes('duplicate fact id'))).toBe(true);
    expect(errors.some((e) => e.includes('two different answers'))).toBe(true);
  });
});

describe('state capitals', () => {
  const fact = (id: string) => stateCapitals.facts.find((f) => f.id === id)!;

  it('has the 50 states, alphabetical, with kebab-case ids', () => {
    expect(stateCapitals.facts).toHaveLength(50);
    const ids = stateCapitals.facts.map((f) => f.id);
    expect(new Set(ids).size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
    const states = STATE_CAPITALS.map((row) => row.state);
    expect(states).toEqual([...states].sort());
    expect(fact('new-york').answer).toBe('Albany');
    expect(fact('south-dakota').prompt).toBe('South Dakota');
  });

  it('has the Census division sizes', () => {
    const counts: Record<string, number> = {};
    for (const row of STATE_CAPITALS) counts[row.division] = (counts[row.division] ?? 0) + 1;
    expect(counts).toEqual({
      'new-england': 6,
      'middle-atlantic': 3,
      'east-north-central': 5,
      'west-north-central': 7,
      'south-atlantic': 8,
      'east-south-central': 4,
      'west-south-central': 4,
      mountain: 8,
      pacific: 5,
    });
    expect(Object.keys(DIVISION_REGION)).toHaveLength(9);
  });

  it('builds the fact for Ohio', () => {
    expect(fact('ohio')).toEqual({
      id: 'ohio',
      prompt: 'Ohio',
      answer: 'Columbus',
      statement: 'Ohio: Columbus',
      spokenPrompt: 'What is the capital of Ohio?',
      spokenStatement: 'The capital of Ohio is Columbus.',
    });
    expect(fact('ohio').visual).toBeUndefined();
  });

  it('says a few names differently', () => {
    expect(fact('washington').prompt).toBe('Washington');
    expect(fact('washington').spokenPrompt).toBe('What is the capital of Washington State?');
    expect(fact('washington').spokenStatement).toBe('The capital of Washington State is Olympia.');
    expect(fact('south-dakota').answer).toBe('Pierre');
    expect(fact('south-dakota').spokenStatement).toMatch(/is Peer\.$/);
    expect(fact('missouri').wrongLines).toEqual({
      'St. Louis': 'Saint Louis is a big city, but the capital is Jefferson City.',
    });
  });

  it("gives 16 states a trap city that is nobody's capital", () => {
    expect(stateCapitals.facts.filter((f) => f.wrongLines)).toHaveLength(16);
    const capitals = new Set(STATE_CAPITALS.map((row) => row.capital));
    for (const row of STATE_CAPITALS) {
      if (row.trap) expect(capitals.has(row.trap.city)).toBe(false);
    }
  });

  it('picks wrong answers from the trap, then the division, then the region', () => {
    const rows = new Map(STATE_CAPITALS.map((row) => [row.state, row]));
    for (let seed = 0; seed < runs(200, 20); seed++) {
      for (const f of stateCapitals.facts) {
        const row = rows.get(f.prompt)!;
        const picks = capitalDistractors(f, 3, seededRandom(seed));
        expect(picks).toHaveLength(3);
        expect(new Set(picks).size).toBe(3);
        expect(picks).not.toContain(f.answer);
        if (row.trap) expect(picks).toContain(row.trap.city);
        const sameDivision = new Set(
          STATE_CAPITALS.filter((o) => o !== row && o.division === row.division).map(
            (o) => o.capital,
          ),
        );
        const wanted = Math.min(3 - (row.trap ? 1 : 0), sameDivision.size);
        expect(picks.filter((p) => sameDivision.has(p))).toHaveLength(wanted);
      }
    }
    expect(capitalDistractors({ ...fact('ohio'), id: 'nope' }, 3, seededRandom(1))).toEqual([]);
  });

  it('puts New York City first for New York, then nearby capitals', () => {
    const picks = capitalDistractors(fact('new-york'), 3, seededRandom(4));
    expect(picks[0]).toBe('New York City');
    expect(picks.slice(1).sort()).toEqual(['Harrisburg', 'Trenton']);
    const more = capitalDistractors(fact('new-york'), 4, seededRandom(4));
    const fourth = STATE_CAPITALS.find((r) => r.capital === more[3])!;
    expect(DIVISION_REGION[fourth.division]).toBe('northeast');
  });

  it('is the last menu group, Social Studies', () => {
    expect(groupBySubject().at(-1)).toEqual({ subject: 'Social Studies', topics: [stateCapitals] });
  });
});

describe('missSpeech', () => {
  const illinois = stateCapitals.facts.find((f) => f.id === 'illinois')!;
  const statement = statementSpeech(illinois);

  it('reads the line for the trap city, then the statement', () => {
    expect(missSpeech(illinois, 'Chicago')).toEqual([
      'Chicago is a big city, but the capital is Springfield.',
      statement,
    ]);
  });

  it('reads just the statement otherwise', () => {
    expect(missSpeech(illinois, 'Lansing')).toEqual([statement]);
    expect(missSpeech(illinois, undefined)).toEqual([statement]);
    expect(missSpeech(illinois)).toEqual([statement]);
    expect(missSpeech(illinois, 'constructor')).toEqual([statement]);
    const sum = mathFact('add', 2, 2);
    expect(missSpeech(sum, '5')).toEqual([statementSpeech(sum)]);
  });
});

const MISSING_IDS = [
  ['addition-missing-1-10', 'Addition', 200],
  ['addition-missing-11-16', 'Addition', 312],
  ['subtraction-missing-1-10', 'Subtraction', 200],
  ['subtraction-missing-11-16', 'Subtraction', 312],
  ['multiplication-missing-1-10', 'Multiplication', 200],
  ['multiplication-missing-11-16', 'Multiplication', 312],
  ['division-missing-1-10', 'Division', 200],
  ['division-missing-11-16', 'Division', 312],
] as const;
const missingTopics = MISSING_IDS.map(([id]) => getTopic(id)!);
const missingFacts = missingTopics.flatMap((t) => t.facts.map((fact) => ({ topic: t, fact })));
const plainFacts = MATH_TOPICS.filter((t) => !t.id.includes('missing')).flatMap((t) => t.facts);

/** The statement's result for a visual, to check it against the shown equation. */
const compute = (kind: string, a: number, b: number) =>
  kind === 'add' ? a + b : kind === 'subtract' ? a - b : kind === 'divide' ? a / b : a * b;

describe('missing-number topics', () => {
  it.each(MISSING_IDS)('%s has the subject and size', (id, subject, size) => {
    const topic = getTopic(id)!;
    expect(topic.subject).toBe(subject);
    expect(topic.facts).toHaveLength(size);
  });

  it('adds 2,048 facts, each plain fact twice', () => {
    expect(missingFacts).toHaveLength(2048);
    expect(plainFacts).toHaveLength(1024);
  });

  it('lists all middle twins first, then all first twins', () => {
    for (const topic of missingTopics) {
      const half = topic.facts.length / 2;
      expect(topic.facts.slice(0, half).every((f) => f.visual!.blank === 'b')).toBe(true);
      expect(topic.facts.slice(half).every((f) => f.visual!.blank === 'a')).toBe(true);
    }
  });

  it('gives the table rows for missingFact', () => {
    const row = (plain: ReturnType<typeof mathFact>, blank: 'middle' | 'first') => {
      const f = missingFact(plain, blank);
      return [
        f.prompt,
        f.answer,
        f.statement,
        f.spokenPrompt,
        f.spokenStatement,
        JSON.stringify(f.visual),
        f.id,
      ];
    };
    const add = mathFact('add', 6, 6);
    expect(row(add, 'middle')).toEqual([
      '6 + ? = 12',
      '6',
      '6 + 6 = 12',
      '6 plus what equals 12?',
      '6 plus 6 equals 12.',
      '{"kind":"add","a":6,"b":6,"blank":"b"}',
      '6+_=12',
    ]);
    expect(row(add, 'first')).toEqual([
      '? + 6 = 12',
      '6',
      '6 + 6 = 12',
      'What plus 6 equals 12?',
      '6 plus 6 equals 12.',
      '{"kind":"add","a":6,"b":6,"blank":"a"}',
      '_+6=12',
    ]);
    const sub = mathFact('subtract', 9, 5);
    expect(row(sub, 'middle')).toEqual([
      '9 − ? = 4',
      '5',
      '9 − 5 = 4',
      '9 minus what equals 4?',
      '9 minus 5 equals 4.',
      '{"kind":"subtract","a":9,"b":5,"blank":"b"}',
      '9-_=4',
    ]);
    expect(row(sub, 'first')).toEqual([
      '? − 5 = 4',
      '9',
      '9 − 5 = 4',
      'What minus 5 equals 4?',
      '9 minus 5 equals 4.',
      '{"kind":"subtract","a":9,"b":5,"blank":"a"}',
      '_-5=4',
    ]);
    const mul = mathFact('multiply', 7, 3);
    expect(row(mul, 'middle')).toEqual([
      '3 × ? = 21',
      '7',
      '3 × 7 = 21',
      '3 times what equals 21?',
      '3 times 7 equals 21.',
      '{"kind":"multiply","a":3,"b":7,"blank":"b"}',
      '3x_=21',
    ]);
    expect(row(mul, 'first')).toEqual([
      '? × 3 = 21',
      '7',
      '7 × 3 = 21',
      'What times 3 equals 21?',
      '7 times 3 equals 21.',
      '{"kind":"multiply","a":7,"b":3,"blank":"a"}',
      '_x3=21',
    ]);
    const div = mathFact('divide', 21, 3);
    expect(row(div, 'middle')).toEqual([
      '21 ÷ ? = 3',
      '7',
      '21 ÷ 7 = 3',
      '21 divided by what equals 3?',
      '21 divided by 7 equals 3.',
      '{"kind":"divide","a":21,"b":7,"blank":"b"}',
      '21/_=3',
    ]);
    expect(row(div, 'first')).toEqual([
      '? ÷ 3 = 7',
      '21',
      '21 ÷ 3 = 7',
      'What divided by 3 equals 7?',
      '21 divided by 3 equals 7.',
      '{"kind":"divide","a":21,"b":3,"blank":"a"}',
      '_/3=7',
    ]);
  });

  it('throws for a fact without a visual', () => {
    expect(() =>
      missingFact({ id: 'x', prompt: 'p', answer: 'a', statement: 's' }, 'middle'),
    ).toThrow();
  });

  it('shows an equation that matches its statement, prompt and answer', () => {
    for (const { fact } of missingFacts) {
      const { kind, a, b, blank } = fact.visual!;
      expect(['a', 'b']).toContain(blank);
      expect(fact.statement.endsWith(`= ${compute(kind, a, b)}`)).toBe(true);
      const parts = statementParts(fact)!;
      expect(parts.before + '?' + parts.after).toBe(fact.prompt);
      expect(parts.answer).toBe(fact.answer);
      expect(String(blank === 'a' ? a : b)).toBe(fact.answer);
    }
  });

  it('reads only statements that are plain facts, so those clips exist', () => {
    const plain = new Set(plainFacts.map((f) => f.spokenStatement));
    for (const { fact } of missingFacts) expect(plain.has(fact.spokenStatement)).toBe(true);
  });

  it('keeps the table visible in × and ÷ middle blanks, so the answers vary', () => {
    const times3 = missingTwin(getTopic('times-3')!.facts[0], 'middle').topic;
    expect(times3.id).toBe('multiplication-missing-1-10');
    const middle = getTopic('times-3')!.facts.map((f) => missingTwin(f, 'middle').fact);
    expect(middle.map((f) => f.answer)).toEqual(
      Array.from({ length: 10 }, (_, i) => String(i + 1)),
    );
    for (const f of middle) expect(f.prompt.startsWith('3 × ?')).toBe(true);
    const divide = getTopic('divide-by-3')!.facts.map((f) => missingTwin(f, 'middle').fact);
    expect(divide.map((f) => f.answer)).toEqual(
      Array.from({ length: 10 }, (_, i) => String(i + 1)),
    );
    expect(divide.every((f) => f.prompt.endsWith('÷ ? = 3'))).toBe(true);
  });

  it('returns the very Fact objects held by the missing topics', () => {
    for (const fact of plainFacts) {
      for (const blank of ['middle', 'first'] as const) {
        const twin = missingTwin(fact, blank);
        expect(twin.topic.facts).toContain(twin.fact);
      }
    }
    expect(() => missingTwin(missingFacts[0].fact, 'middle')).toThrow();
  });

  it('gives three distinct wrong numbers of at least 1, never the answer', () => {
    for (let seed = 0; seed < runs(5, 1); seed++) {
      const random = seededRandom(seed);
      for (const { topic, fact } of missingFacts) {
        const wrong = missingDistractors(fact, 3, random);
        expect(new Set(wrong).size).toBe(3);
        for (const w of wrong) {
          expect(Number.isInteger(Number(w))).toBe(true);
          expect(Number(w)).toBeGreaterThanOrEqual(1);
          expect(w).not.toBe(fact.answer);
        }
        const options = answerOptions(topic, fact, 4, random);
        expect(new Set(options).size).toBe(4);
      }
    }
  }, 30_000);

  it('offers the total or the sum of the shown numbers on 6 + ? = 12', () => {
    const fact = missingFact(mathFact('add', 6, 6), 'middle');
    const seen = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      for (const w of missingDistractors(fact, 3, seededRandom(seed))) seen.add(w);
    }
    expect(seen.has('12') || seen.has('18')).toBe(true);
    let every = 0;
    for (let seed = 0; seed < 30; seed++) {
      const wrong = missingDistractors(fact, 3, seededRandom(seed));
      if (wrong.includes('12') || wrong.includes('18')) every++;
    }
    expect(every).toBeGreaterThan(0);
  });
});

describe('statementParts', () => {
  it('splits a middle blank on its second operand', () => {
    const fact = missingFact(mathFact('add', 6, 6), 'middle');
    expect(statementParts(fact)).toEqual({ before: '6 + ', answer: '6', after: ' = 12' });
    const div = missingFact(mathFact('divide', 21, 3), 'middle');
    expect(statementParts(div)).toEqual({ before: '21 ÷ ', answer: '7', after: ' = 3' });
  });

  it('splits a first blank on its first operand', () => {
    const fact = missingFact(mathFact('subtract', 9, 5), 'first');
    expect(statementParts(fact)).toEqual({ before: '', answer: '9', after: ' − 5 = 4' });
  });

  it('splits a plain fact after the last "= "', () => {
    expect(statementParts(mathFact('add', 7, 8))).toEqual({
      before: '7 + 8 = ',
      answer: '15',
      after: '',
    });
  });

  it('is null for a statement with no "= " and no blank', () => {
    expect(statementParts({ statement: 'said' })).toBeNull();
  });

  it('keeps the whole statement', () => {
    for (const fact of [...plainFacts.slice(0, 50), ...missingFacts.map((m) => m.fact)]) {
      const parts = statementParts(fact)!;
      expect(parts.before + parts.answer + parts.after).toBe(fact.statement);
    }
  });
});
