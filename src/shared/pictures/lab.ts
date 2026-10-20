/**
 * Dev-only lab for the miss pictures (not part of the build). Query:
 * `fact=<add|sub|mul|div>:<a>:<b>`, `way=<Way>`, `at=<seconds>` (freeze there), `answers=row|grid`,
 * `green=0..3`. Without `at` it plays and loops. It speaks nothing: every count ends at once.
 */
import { seededRandom } from '../random';
import { createTapMarks } from '../tapmarks';
import { mathFact } from '../topics/math';
import { createPictureCard } from './card';
import { HOPPERS, pickCritters } from './critters';
import { buildPicture } from './plan';
import { createPicturePlayer } from './player';
import { pickWay, WAY_KIND, WAYS, type Way } from './ways';

const params = new URLSearchParams(location.search);
const KINDS = { add: 'add', sub: 'subtract', mul: 'multiply', div: 'divide' } as const;
const [op, aText, bText] = (params.get('fact') ?? 'add:8:5').split(':');
const kind = KINDS[op as keyof typeof KINDS] ?? 'add';
const fact = mathFact(kind, Number(aText), Number(bText));
const visual = fact.visual!;
const requested = params.get('way');
const way: Way =
  requested && Object.hasOwn(WAY_KIND, requested)
    ? (requested as Way)
    : (pickWay(visual, 0)?.way ?? WAYS[kind][0]);
const at = params.has('at') ? Number(params.get('at')) : null;
const green = Math.min(Math.max(Number(params.get('green') ?? 2) || 0, 0), 3);

document.getElementById('bar')!.textContent = fact.prompt;
const answers = document.getElementById('answers')!;
if (params.get('answers') === 'grid') answers.classList.add('grid');
const answer = Number(fact.answer);
const values = [answer - 2, answer + 1, answer + 2, answer - 1].filter((n) => n > 0);
values.splice(green, 0, answer);
const buttons = values.slice(0, 4).map((value) => {
  const button = document.createElement('button');
  button.textContent = String(value);
  answers.appendChild(button);
  return button;
});

const random = seededRandom(7);
const looks = { critters: pickCritters(10, random), hopper: HOPPERS[0] };
const picture = buildPicture(visual, way, looks);
const marks = createTapMarks();

let player = createPicturePlayer(picture, (_, onEnd) => onEnd());
let card = createPictureCard(picture, player, fact);
let frozen = false;

function begin(): void {
  marks.clear();
  player = createPicturePlayer(picture, (_, onEnd) => onEnd());
  card = createPictureCard(picture, player, fact);
  marks.show(buttons, green, [document.getElementById('bar')!], undefined, card);
  frozen = false;
  player.start(() => {
    if (at === null) setTimeout(begin, 1500);
  });
}

begin();
const FRAME = 1 / 60;
if (at !== null) {
  // Step to the asked second, then hold.
  for (let t = 0; t < at; t += FRAME) {
    player.update(FRAME);
    card.render();
  }
  frozen = true;
}
let last = performance.now();
const tick = (now: number) => {
  const delta = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (!frozen) {
    player.update(delta);
    card.render();
  }
  marks.update();
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
