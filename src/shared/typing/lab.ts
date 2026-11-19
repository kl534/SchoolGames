/**
 * Dev-only lab for the typing screens (not part of the build). Query:
 * `view=lesson&level=<1-40>&skill=<skill>&step=home|show|try|mix|done&at=<seconds>&typed=<keys>`
 * (holds still at that moment; without `step` the lesson plays, silent),
 * `view=keyboard&next=<char>&faint=1&reach=<seconds>` (with `reach` the hands show too),
 * `view=block&text=<keys>&typed=<n>&wrong=1`, `view=picker&open=<1-40>&selected=<1-40>`,
 * `view=testout&level=<n>&typed=<n>`, `view=speed&level=<29-40>`.
 */
import { seededRandom } from '../random';
import { createBlockView } from './block';
import { LEVEL_COUNT } from './course';
import { createKeyboard } from './keyboard';
import { showKeyLesson, type LessonLab } from './lesson';
import { showLevelPicker } from './picker';
import { emptyTyping } from './progress';
import { showTestOut } from './testout';

const params = new URLSearchParams(location.search);
const number = (key: string, fallback: number): number => {
  const value = Number(params.get(key));
  return params.has(key) && Number.isFinite(value) ? value : fallback;
};
const level = Math.min(Math.max(Math.round(number('level', 7)), 1), LEVEL_COUNT);
const view = params.get('view') ?? 'lesson';
const stage = document.getElementById('stage')!;
const random = seededRandom(number('seed', 4));
const noop = () => undefined;

if (view === 'lesson' || view === 'speed') {
  const step = params.get('step') as LessonLab['step'] | null;
  const lab: LessonLab | undefined = step
    ? {
        step,
        skill: params.get('skill') ?? undefined,
        at: number('at', 0),
        typed: number('typed', 0),
      }
    : undefined;
  showKeyLesson({
    level: view === 'speed' ? Math.max(level, 29) : level,
    onDone: noop,
    onSkip: noop,
    // The lab speaks nothing; a line never ends, so a playing lesson waits on its first line.
    speak: noop,
    random,
    lab: view === 'speed' ? { step: 'home' } : lab,
  });
} else if (view === 'keyboard') {
  const reach = params.has('reach');
  const box = document.createElement('div');
  box.className = 'box';
  stage.appendChild(box);
  const keyboard = createKeyboard({ hands: reach });
  box.appendChild(keyboard.element);
  const next = params.get('next');
  keyboard.light(next);
  keyboard.setFaint(params.get('faint') === '1');
  if (reach) keyboard.reach(next, number('reach', 0));
  if (params.get('caps') === '1') keyboard.setCaps(true);
} else if (view === 'block') {
  const box = document.createElement('div');
  box.className = 'box';
  stage.appendChild(box);
  const block = createBlockView();
  box.appendChild(block.element);
  block.set(params.get('text') ?? 'fjj jf');
  for (let i = 0; i < number('typed', 0); i++) block.advance();
  block.fit();
  if (params.get('wrong') === '1') block.wrong(true);
} else if (view === 'picker') {
  const typing = { ...emptyTyping(), open: Math.min(Math.max(number('open', 1), 1), LEVEL_COUNT) };
  const selected = Math.min(number('selected', typing.open), typing.open);
  showLevelPicker({
    typing,
    selected,
    onPick: noop,
    onTestOut: noop,
    onLesson: noop,
    onStart: noop,
  });
} else if (view === 'testout') {
  showTestOut({ level, onDone: noop, random, typed: number('typed', 0) });
}
