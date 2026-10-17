import { describe, expect, it } from 'vitest';
import { AVATARS, createProgressStore, recordAnswer } from '../src/shared/progress';
import { LEVELS, MY_LEVEL_ID } from '../src/shared/levels';
import { gameUrl, parseGameParams, startGameSession } from '../src/shared/session';
import { answerOptions, TOPICS } from '../src/shared/topics';

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

describe('high score', () => {
  const topic = TOPICS[0];
  const search = `?topic=${topic.id}`;

  it('starts at zero, and only a better score counts as a new one', () => {
    const store = createProgressStore();
    store.setCurrentPlayer(store.addPlayer('Scorer', AVATARS[0]).id);
    const session = startGameSession('score-game', search);
    if (!session) throw new Error('topic not found');
    expect(session.highScore()).toBe(0);
    expect(session.recordScore(0)).toBe(false);
    expect(session.recordScore(500)).toBe(true);
    expect(session.recordScore(300)).toBe(false);
    expect(session.highScore()).toBe(500);
  });

  it('is saved for the player and found by the next session', () => {
    const store = createProgressStore();
    store.setCurrentPlayer(store.addPlayer('Saver', AVATARS[1]).id);
    startGameSession('score-game', search)?.recordScore(1200);
    expect(startGameSession('score-game', search)?.highScore()).toBe(1200);
    // Another game keeps its own score.
    expect(startGameSession('other-game', search)?.highScore()).toBe(0);
  });

  it('counts for a guest while the page is open, but is not saved', () => {
    createProgressStore().setCurrentPlayer(null);
    const session = startGameSession('score-game', search);
    if (!session) throw new Error('topic not found');
    expect(session.player).toBeNull();
    expect(session.recordScore(700)).toBe(true);
    expect(session.highScore()).toBe(700);
    expect(session.recordScore(600)).toBe(false);
    expect(startGameSession('score-game', search)?.highScore()).toBe(0);
  });
});

describe('My Level session', () => {
  const search = `?topic=${MY_LEVEL_ID}`;

  const start = (name: string | null) => {
    const store = createProgressStore();
    if (name) store.setCurrentPlayer(store.addPlayer(name, AVATARS[0]).id);
    else store.setCurrentPlayer(null);
    const session = startGameSession('level-game', search);
    if (!session) throw new Error('My Level not found');
    return session;
  };

  it('starts, and only a real topic or my-level does', () => {
    expect(start('Leveler').topic.id).toBe(MY_LEVEL_ID);
    expect(startGameSession('level-game', '?topic=nope')).toBeNull();
  });

  it('describes the current level', () => {
    expect(start('Describer').topic.description).toBe('Level 1 of 30: Sums to 10');
  });

  it("saves answers under the fact's own topic and the level count with them", () => {
    const session = start('Answerer');
    const [fact] = session.chooseFacts();
    session.recordAnswer(fact, true);
    const store = createProgressStore();
    const saved = store.load(store.currentPlayer()!.id);
    expect(saved.facts['addition-1-10'][fact.id].correct).toBe(1);
    expect(saved.facts[MY_LEVEL_ID]).toBeUndefined();
    expect(saved.levelsOpen).toBe(1);
    expect(session.timerSecondsFor(fact)).toBe(10);
  });

  it('saves the 11 to 16 facts under their own topics and keeps them across sessions', () => {
    start('Big tables');
    const store = createProgressStore();
    const id = store.currentPlayer()!.id;
    const progress = store.load(id);
    // A player who has already finished the old levels gets everything open.
    for (const { topic, fact } of LEVELS.flatMap((l) => l.facts)) {
      recordAnswer(progress, topic.id, fact.id, true);
    }
    store.save(id, progress);
    const session = startGameSession('level-game', search)!;
    const bigTimes = session.topic.facts.find((f) => f.id === '12x15')!;
    const bigDivide = session.topic.facts.find((f) => f.id === '176/11')!;
    session.recordAnswer(bigTimes, false);
    session.recordAnswer(bigDivide, true);
    const saved = store.load(id);
    expect(saved.facts['times-15']['12x15']).toMatchObject({ correct: 1, wrong: 1, streak: 0 });
    expect(saved.facts['divide-by-11']['176/11']).toMatchObject({ correct: 2, streak: 2 });
    expect(saved.facts[MY_LEVEL_ID]).toBeUndefined();
    expect(saved.levelsOpen).toBe(LEVELS.length);
  });

  it('keeps stars and high scores under my-level', () => {
    const session = start('Scorer2');
    expect(session.recordStars(2)).toBe(true);
    expect(session.recordScore(900)).toBe(true);
    const store = createProgressStore();
    const saved = store.load(store.currentPlayer()!.id);
    expect(saved.best[MY_LEVEL_ID]).toEqual({ 'level-game': 2 });
    expect(saved.highScores[MY_LEVEL_ID]).toEqual({ 'level-game': 900 });
    expect(startGameSession('level-game', search)?.highScore()).toBe(900);
  });

  it('gives four distinct answers including the right one for every kind of fact', () => {
    const session = start('Chooser');
    for (const fact of session.topic.facts) {
      const options = answerOptions(session.topic, fact, 4);
      expect(options).toHaveLength(4);
      expect(new Set(options).size).toBe(4);
      expect(options).toContain(fact.answer);
    }
  });

  it('works without a player, in memory only', () => {
    const session = start(null);
    expect(session.player).toBeNull();
    const [fact] = session.chooseFacts();
    session.recordAnswer(fact, true);
    expect(session.timerSecondsFor(fact)).toBe(15);
    expect(session.chooseFacts(10)).toHaveLength(10);
  });
});
