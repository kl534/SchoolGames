// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { showPreview, uniqueFacts } from '../src/shared/preview';
import { TOPICS } from '../src/shared/topics';
import { mathFact } from '../src/shared/topics/math';

const topic = TOPICS[0];

afterEach(() => {
  document.body.replaceChildren();
});

describe('showPreview', () => {
  it('shows the topic, up to 10 unique facts with their answers, and a Start button', () => {
    const facts = topic.facts.slice(0, 12);
    showPreview({ topic, facts: [...facts, facts[0]], onDone: () => {} });
    const chips = [...document.querySelectorAll('.sg-chip')];
    expect(chips.map((c) => c.textContent)).toEqual(facts.slice(0, 10).map((f) => f.statement));
    expect(chips[0].textContent).toBe('1 + 1 = 2');
    expect(document.querySelector('h1')?.textContent).toBe(topic.title);
    expect(document.body.textContent).toContain('Coming up');
    expect(document.body.textContent).toContain(topic.description);
    expect(document.querySelector('.sg-btn-primary')?.textContent).toBe('Start game ▶');
  });

  it('calls onDone once and removes itself when Start is tapped', () => {
    const onDone = vi.fn();
    showPreview({ topic, facts: topic.facts.slice(0, 3), onDone });
    const start = document.querySelector<HTMLButtonElement>('.sg-btn-primary')!;
    start.click();
    start.click();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.sg-overlay')).toBeNull();
  });

  it('does not start the game when a fact is tapped', () => {
    const onDone = vi.fn();
    showPreview({ topic, facts: topic.facts.slice(0, 3), onDone });
    document.querySelector<HTMLButtonElement>('.sg-chip')!.click();
    expect(onDone).not.toHaveBeenCalled();
    expect(document.querySelector('.sg-overlay')).not.toBeNull();
  });

  it('can be disposed without calling onDone', () => {
    const onDone = vi.fn();
    showPreview({ topic, facts: topic.facts.slice(0, 3), onDone }).dispose();
    expect(document.querySelector('.sg-overlay')).toBeNull();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('goes straight on when there are no facts', async () => {
    const onDone = vi.fn();
    showPreview({ topic, facts: [], onDone });
    await Promise.resolve();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.sg-overlay')).toBeNull();
  });
});

describe('uniqueFacts', () => {
  it('keeps the first of each fact, in order', () => {
    const a = mathFact('add', 1, 2);
    const b = mathFact('add', 2, 3);
    expect(uniqueFacts([a, b, a, b, a])).toEqual([a, b]);
  });
});
