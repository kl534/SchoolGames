import { describe, expect, it } from 'vitest';
import { AVATARS, createProgressStore } from '../src/shared/progress';
import { gameUrl, parseGameParams, startGameSession } from '../src/shared/session';
import { TOPICS } from '../src/shared/topics';

describe('parseGameParams', () => {
  it('reads the topic', () => {
    expect(parseGameParams('?topic=times-3')).toEqual({ topicId: 'times-3' });
    expect(parseGameParams('').topicId).toBeNull();
  });
});

describe('gameUrl', () => {
  it('adds the topic', () => {
    expect(gameUrl('/g/index.html', 'addition-1-10')).toBe('/g/index.html?topic=addition-1-10');
  });

  it('round-trips through parseGameParams', () => {
    const url = gameUrl('/g/', 'subtraction-1-10');
    expect(parseGameParams(url.slice(url.indexOf('?')))).toEqual({
      topicId: 'subtraction-1-10',
    });
  });
});

describe('timerSecondsFor', () => {
  const topic = TOPICS[0];
  const search = `?topic=${topic.id}`;
  const fact = topic.facts[0];

  const startAs = (name: string | null) => {
    if (name) {
      const store = createProgressStore();
      store.setCurrentPlayer(store.addPlayer(name, AVATARS[0]).id);
    }
    const session = startGameSession('test', search);
    if (!session) throw new Error('topic not found');
    return session;
  };

  it('shortens as the fact is answered correctly in a row', () => {
    const session = startAs('Timer');
    expect(session.timerSecondsFor(fact)).toBe(15);
    session.recordAnswer(fact, true);
    expect(session.timerSecondsFor(fact)).toBe(10);
    session.recordAnswer(fact, true);
    expect(session.timerSecondsFor(fact)).toBe(5);
  });

  it('goes back to 15 seconds after a wrong answer', () => {
    const session = startAs('Timer2');
    session.recordAnswer(fact, true);
    session.recordAnswer(fact, true);
    session.recordAnswer(fact, false);
    expect(session.timerSecondsFor(fact)).toBe(15);
  });

  it('is always 15 seconds without a player', () => {
    createProgressStore().setCurrentPlayer(null);
    const session = startAs(null);
    expect(session.player).toBeNull();
    session.recordAnswer(fact, true);
    session.recordAnswer(fact, true);
    expect(session.timerSecondsFor(fact)).toBe(15);
  });
});
