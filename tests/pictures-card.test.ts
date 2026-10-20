// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/shared/audio', () => ({
  preloadSpeech: vi.fn(),
  speak: vi.fn(),
  stopSpeaking: vi.fn(),
}));

import { preloadSpeech, speak } from '../src/shared/audio';
import { createMissPicture } from '../src/shared/pictures';
import { readTurn, TURNS_KEY } from '../src/shared/pictures/ways';
import { seededRandom } from '../src/shared/random';
import { memoryStore } from '../src/shared/storage';
import { mathFact } from '../src/shared/topics/math';

afterEach(() => {
  document.body.replaceChildren();
  vi.mocked(speak).mockReset();
});

const options = () => ({ random: seededRandom(5), store: memoryStore() });

describe('createMissPicture', () => {
  it('is null for a fact without a picture and for multiply and divide (M1)', () => {
    expect(
      createMissPicture({ id: 'w', prompt: 'p', answer: 'a', statement: 's' }, options()),
    ).toBeNull();
    expect(createMissPicture(mathFact('multiply', 7, 3), options())).toBeNull();
    expect(createMissPicture(mathFact('divide', 12, 3), options())).toBeNull();
  });

  it('shows the next way each time and keeps the turn per operation on the device', () => {
    const store = memoryStore();
    const fact = mathFact('add', 8, 5);
    const look = () => createMissPicture(fact, { random: seededRandom(5), store })!.card.element;
    const first = look().innerHTML;
    expect(readTurn('add', store)).toBe(1);
    const second = look().innerHTML;
    expect(second).not.toBe(first);
    expect(look().innerHTML).not.toBe(second);
    expect(readTurn('add', store)).toBe(3);
    // Back to the first way.
    expect(look().innerHTML).toBe(first);
    expect(readTurn('subtract', store)).toBe(0);
    createMissPicture(mathFact('subtract', 13, 5), { random: seededRandom(5), store });
    expect(readTurn('subtract', store)).toBe(1);
    expect(readTurn('add', store)).toBe(1);
  });

  it('starts from the first way when the saved turns are broken', () => {
    const store = memoryStore();
    store.setItem(TURNS_KEY, '{nope');
    expect(readTurn('add', store)).toBe(0);
    store.setItem(TURNS_KEY, JSON.stringify({ add: 'two', subtract: -3 }));
    expect(readTurn('add', store)).toBe(0);
    expect(readTurn('subtract', store)).toBe(0);
    expect(createMissPicture(mathFact('add', 8, 5), { store })).not.toBeNull();
  });

  it('loads the count clips, labels the card with the fact and counts when started', () => {
    const picture = createMissPicture(mathFact('add', 8, 5), options())!;
    expect(preloadSpeech).toHaveBeenLastCalledWith(['8.', '9.', '10.', '11.', '12.', '13.']);
    const card = picture.card.element;
    expect(card.className).toBe('sg-pic-card');
    expect(card.getAttribute('aria-label')).toBe('8 + 5 = 13');
    expect(card.querySelector('.sg-pic-eq')!.textContent).toBe('8 + 5 = ?');
    expect(card.querySelector<HTMLElement>('.sg-pic-count')!.hidden).toBe(true);

    const done = vi.fn();
    picture.start(done);
    for (let i = 0; i < 20; i++) picture.update(0.05);
    expect(speak).toHaveBeenCalledWith('8.', expect.any(Function));
    expect(card.querySelector('.sg-pic-count')!.textContent).toBe('8');
    picture.stop();
    expect(done).not.toHaveBeenCalled();
  });

  it('ends on the whole fact with the answer picked out', () => {
    const picture = createMissPicture(mathFact('add', 8, 5), options())!;
    vi.mocked(speak).mockImplementation((_text, onEnd) => onEnd?.());
    const done = vi.fn();
    picture.start(done);
    for (let i = 0; i < 200; i++) picture.update(0.05);
    expect(done).toHaveBeenCalledTimes(1);
    const eq = picture.card.element.querySelector('.sg-pic-eq')!;
    expect(eq.textContent).toBe('8 + 5 = 13');
    expect(eq.querySelector('.sg-pic-answer')!.textContent).toBe('13');
    expect(picture.card.element.querySelector('.sg-pic-count')!.textContent).toBe('13');
  });

  it('sizes the stage to the room it is given', () => {
    const picture = createMissPicture(mathFact('add', 8, 5), options())!;
    picture.card.fit(374, 380);
    const stage = picture.card.element.querySelector<SVGElement>('.sg-pic-stage')!;
    // 480 wide at most 1.3 times, held by the width: (374 - 24) / 480 < 1.3.
    expect(stage.style.width).toBe('350px');
    picture.card.fit(300, 110);
    expect(parseInt(stage.style.height)).toBeLessThan(110);
  });
});
