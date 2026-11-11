/**
 * Dev-only lab for the results screen (not part of the build). Query: `moved=<n>`, `learned=<n>`
 * and `solid=<n>` (the step report, each 0 by default), `stars=<0..3>` (default 3).
 */
import { showResults } from '../results';
import { mathFact } from '../topics/math';

const params = new URLSearchParams(location.search);
const count = (name: string) => Math.max(0, Number(params.get(name)) || 0);
const stars = params.has('stars') ? Math.min(3, Math.max(0, Number(params.get('stars')))) : 3;

showResults({
  topicId: 'times-7',
  correct: 7,
  total: 10,
  stars,
  newBest: false,
  missed: [mathFact('multiply', 6, 7), mathFact('multiply', 8, 7), mathFact('multiply', 9, 7)],
  playerName: 'Shots',
  steps: { movedUp: count('moved'), learned: count('learned'), solid: count('solid') },
  onPlayAgain: () => {},
});
