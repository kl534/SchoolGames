// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  fillAnswers,
  fittedFontSize,
  lockAnswers,
  markAnswers,
  pressAnswers,
} from '../src/shared/answers';
import { createTimers } from '../src/shared/timers';
import { promptSpeech, statementSpeech } from '../src/shared/topics';

const makeButtons = () => Array.from({ length: 4 }, () => document.createElement('button'));

describe('answers', () => {
  it('fills the buttons and hides the ones without an option', () => {
    const buttons = makeButtons();
    buttons[0].classList.add('wrong');
    buttons[0].setAttribute('aria-disabled', 'true');
    fillAnswers(buttons, ['said', 'sed', 'sad'], 'x-answer');
    expect(buttons.map((b) => b.textContent)).toEqual(['said', 'sed', 'sad', '']);
    expect(buttons.map((b) => b.hidden)).toEqual([false, false, false, true]);
    expect(buttons[0].className).toBe('x-answer');
    expect(buttons[0].hasAttribute('aria-disabled')).toBe(false);
    expect(buttons[1].getAttribute('aria-label')).toBe('Answer sed');
    fillAnswers(buttons, ['1', '2', '3', '4'], 'x-answer', true);
    expect(buttons.every((b) => b.getAttribute('aria-disabled') === 'true')).toBe(true);
  });

  it('locks and marks', () => {
    const buttons = makeButtons();
    lockAnswers(buttons);
    expect(buttons.every((b) => b.getAttribute('aria-disabled') === 'true')).toBe(true);
    markAnswers(buttons, 1, 3, false);
    expect(buttons[3].classList.contains('right')).toBe(true);
    expect(buttons[1].classList.contains('wrong')).toBe(true);
    markAnswers(buttons, 2, 2, true);
    expect(buttons[2].classList.contains('chosen')).toBe(true);
    // Time ran out: nothing was chosen.
    const fresh = makeButtons();
    markAnswers(fresh, -1, 0, false);
    expect(fresh.filter((b) => b.className).length).toBe(1);
  });

  it('presses call back with the index until unbound', () => {
    const buttons = makeButtons();
    const onAnswer = vi.fn();
    const unbind = pressAnswers(buttons, onAnswer);
    buttons[2].dispatchEvent(new MouseEvent('click', { detail: 0 }));
    expect(onAnswer).toHaveBeenCalledWith(2);
    unbind();
    buttons[2].dispatchEvent(new MouseEvent('click', { detail: 0 }));
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });

  it('reads the spoken forms when a fact has them', () => {
    const fact = { id: 'a', prompt: '3 × 4 = ?', answer: '12', statement: '3 × 4 = 12' };
    expect(promptSpeech(fact)).toBe('3 × 4 = ?');
    expect(statementSpeech({ ...fact, spokenStatement: '3 times 4 is 12' })).toBe(
      '3 times 4 is 12',
    );
  });
});

describe('timers', () => {
  it('run on game time, once, and keep timers added while running', () => {
    const timers = createTimers();
    const order: string[] = [];
    timers.after(1, () => {
      order.push('a');
      timers.after(0.5, () => order.push('b'));
    });
    timers.update(0.9);
    expect(order).toEqual([]);
    timers.update(0.1);
    expect(order).toEqual(['a']);
    timers.update(0.5);
    timers.update(5);
    expect(order).toEqual(['a', 'b']);
  });

  it('clear drops what has not run, even from inside a timer', () => {
    const timers = createTimers();
    const ran = vi.fn();
    timers.after(1, () => timers.clear());
    timers.after(2, ran);
    timers.update(1);
    timers.update(5);
    expect(ran).not.toHaveBeenCalled();
  });
});

describe('fittedFontSize', () => {
  it('is null when the text fits or nothing can be measured', () => {
    expect(fittedFontSize(40, 200, 150)).toBeNull();
    expect(fittedFontSize(40, 0, 100)).toBeNull();
  });

  it('shrinks by the ratio with a margin, down to the floor', () => {
    expect(fittedFontSize(40, 160, 200)).toBe(31.3);
    expect(fittedFontSize(40, 100, 400)).toBe(20);
    expect(fittedFontSize(40, 100, 400, 0.6)).toBe(24);
  });
});

describe('fillAnswers fits long text', () => {
  it('leaves the font size alone when nothing can be measured (jsdom) and does not throw', () => {
    const buttons = makeButtons();
    fillAnswers(buttons, ['Jefferson City', 'Lincoln', 'Topeka', 'St. Louis'], 'x-answer');
    expect(buttons.map((b) => b.style.fontSize)).toEqual(['', '', '', '']);
    expect(buttons[0].textContent).toBe('Jefferson City');
  });
});
