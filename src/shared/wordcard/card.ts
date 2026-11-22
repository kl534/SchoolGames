import './wordcard.css';
import type { TapCard } from '../tapmarks';
import { exampleParts } from '../topics/vocabulary';
import type { FactMeaning } from '../topics';

export const WORD_CARD_MAX_WIDTH = 380;
const MIN_WIDTH = 220;
/** Font scales to try, biggest first. */
export const FIT_SCALES = [1, 0.9, 0.8, 0.7, 0.62];

const part = (tag: string, className: string, text = ''): HTMLElement => {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
};

/** The card for one word fact: `answer` is the green answer (the synonym or antonym). */
export function createWordCardElement(meaning: FactMeaning, answer: string): TapCard {
  const card = part('div', 'sg-wc-card');
  card.setAttribute('role', 'note');

  const head = part('div', 'sg-wc-head');
  const pos = part('span', 'sg-wc-pos', `· ${meaning.partOfSpeech}`);
  head.append(part('span', 'sg-wc-word', meaning.word.toUpperCase()), pos);

  const def = part('div', 'sg-wc-def', meaning.definition);

  const [before, word, after] = exampleParts(meaning.example);
  const example = part('div', 'sg-wc-example');
  example.append(`“${before}`, part('b', 'sg-wc-mark', word), `${after}”`);

  const answerLine = part('div', 'sg-wc-answer');
  answerLine.append(part('span', 'sg-wc-rel', `${meaning.relation}:`), ' ', part('b', '', answer));

  card.append(head, def, example, answerLine);

  const fitsAt = (scale: number, maxHeight: number): boolean => {
    card.style.setProperty('--sg-wc-scale', String(scale));
    return card.offsetHeight <= maxHeight;
  };
  const tryScales = (maxHeight: number): boolean =>
    FIT_SCALES.some((scale) => fitsAt(scale, maxHeight));

  return {
    element: card,
    fit(maxWidth, maxHeight) {
      const width = Math.min(Math.max(maxWidth, MIN_WIDTH), WORD_CARD_MAX_WIDTH);
      card.style.width = `${width}px`;
      answerLine.style.display = '';
      pos.style.display = '';
      if (tryScales(maxHeight)) return;
      answerLine.style.display = 'none';
      if (tryScales(maxHeight)) return;
      pos.style.display = 'none';
      if (!tryScales(maxHeight)) card.style.setProperty('--sg-wc-scale', String(FIT_SCALES.at(-1)));
    },
  };
}
