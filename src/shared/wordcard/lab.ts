/**
 * Dev-only lab for the word card (not part of the build). Query:
 * `word=<head word>` (default happy), `kind=synonym|antonym`, `answers=row|grid`, `green=0..3`,
 * `view=all&grade=<id>` shows every card of a grade in a scrolling grid at `fit(380, 380)`.
 */
import { seededRandom } from '../random';
import { createTapMarks } from '../tapmarks';
import { antonymFact, synonymFact, vocabDistractors, VOCAB_GRADES } from '../topics/vocabulary';
import type { Fact } from '../topics';
import { createWordCardElement } from './card';

const params = new URLSearchParams(location.search);
const kind = params.get('kind') === 'antonym' ? 'antonym' : 'synonym';

function factOf(word: string, which: string, gradeId?: string): Fact | undefined {
  for (const grade of VOCAB_GRADES) {
    if (gradeId && grade.id !== gradeId) continue;
    const row = grade.rows.find((r) => r[0] === word);
    if (!row) continue;
    const meaning = grade.meanings?.[word];
    return which === 'antonym' ? antonymFact(row, meaning) : synonymFact(row, meaning);
  }
  return undefined;
}

if (params.get('view') === 'all') {
  document.body.classList.add('all');
  const grade = VOCAB_GRADES.find((g) => g.id === (params.get('grade') ?? '2')) ?? VOCAB_GRADES[0];
  const grid = document.getElementById('grid')!;
  for (const row of grade.rows) {
    const fact = factOf(row[0], kind, grade.id) ?? factOf(row[0], 'synonym', grade.id);
    if (!fact?.meaning) continue;
    const { element, fit } = createWordCardElement(fact.meaning, fact.answer);
    grid.appendChild(element);
    fit(380, 380);
  }
} else {
  const fact = factOf(params.get('word') ?? 'happy', kind) ?? factOf('happy', 'synonym')!;
  const green = Math.min(Math.max(Number(params.get('green') ?? 2) || 0, 0), 3);
  const bar = document.getElementById('bar')!;
  bar.textContent = fact.prompt;
  const answers = document.getElementById('answers')!;
  if (params.get('answers') === 'grid') answers.classList.add('grid');
  const wrong = vocabDistractors(fact, 3, seededRandom(7));
  const texts = [...wrong];
  texts.splice(green, 0, fact.answer);
  const buttons = texts.map((text) => {
    const button = document.createElement('button');
    button.textContent = text;
    answers.appendChild(button);
    return button;
  });
  const marks = createTapMarks();
  marks.show(buttons, green, [bar], undefined, createWordCardElement(fact.meaning!, fact.answer));
  const tick = () => {
    marks.update();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
