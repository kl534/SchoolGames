import { describe, expect, it } from 'vitest';
import { AVATARS, createProgressStore, recordAnswer } from '../src/shared/progress';
import { LEVELS, MY_LEVEL_ID, SOCIAL_STUDIES_LEVEL_ID } from '../src/shared/levels';
import { devFacts } from '../src/shared/devfacts';
import { gameUrl, parseGameParams, startGameSession } from '../src/shared/session';
import { answerOptions, getTopic, TOPICS } from '../src/shared/topics';
import { SOCIAL_STUDIES_LEVELS } from '../src/shared/levels-social';

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

  it('does not count a right answer to a fact that comes back after a miss', () => {
    const session = startAs('Retry');
    session.recordAnswer(fact, false);
    session.recordAnswer(fact, true);
    expect(session.timerSecondsFor(fact)).toBe(15);
    // The next right answer counts again.
    session.recordAnswer(fact, true);
    expect(session.timerSecondsFor(fact)).toBe(10);
    const store = createProgressStore();
    const saved = store.load(store.currentPlayer()!.id);
    expect(saved.facts[topic.id][fact.id]).toMatchObject({ correct: 1, wrong: 1, streak: 1 });
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

describe('ladder rung', () => {
  const topic = TOPICS[0];
  const search = `?topic=${topic.id}`;

  it('is 0 by default, saved, and read back by a new session', () => {
    const store = createProgressStore();
    store.setCurrentPlayer(store.addPlayer('Climber', AVATARS[0]).id);
    const session = startGameSession('ladder-game', search);
    if (!session) throw new Error('topic not found');
    expect(session.ladderRung()).toBe(0);
    session.recordLadderRung(3);
    expect(session.ladderRung()).toBe(3);
    session.recordLadderRung(2);
    expect(startGameSession('ladder-game', search)?.ladderRung()).toBe(2);
    // Another game and another topic keep their own rung.
    expect(startGameSession('other-game', search)?.ladderRung()).toBe(0);
    expect(startGameSession('ladder-game', `?topic=${TOPICS[1].id}`)?.ladderRung()).toBe(0);
  });

  it('is saved for My Level under my-level', () => {
    const store = createProgressStore();
    const player = store.addPlayer('Leveller', AVATARS[0]);
    store.setCurrentPlayer(player.id);
    startGameSession('ladder-game', `?topic=${MY_LEVEL_ID}`)?.recordLadderRung(4);
    expect(store.load(player.id).ladders).toEqual({ [MY_LEVEL_ID]: { 'ladder-game': 4 } });
  });

  it('writes nothing without a player, but the climb still works in memory', () => {
    const store = createProgressStore();
    store.setCurrentPlayer(null);
    const session = startGameSession('ladder-game', search);
    if (!session) throw new Error('topic not found');
    session.recordLadderRung(2);
    expect(session.ladderRung()).toBe(2);
    expect(startGameSession('ladder-game', search)?.ladderRung()).toBe(0);
  });
});

describe('progress saved before the 11 to 16 cards', () => {
  it('carries the old stats over, so the timer follows the carried streak', () => {
    const store = createProgressStore();
    const player = store.addPlayer('Old timer', AVATARS[0]);
    store.setCurrentPlayer(player.id);
    store.save(player.id, {
      facts: { 'times-15': { '12x15': { correct: 3, wrong: 0, streak: 3, lastSeen: 1 } } },
      best: {},
      highScores: {},
      levelsOpen: 25,
    });
    const session = startGameSession('test', '?topic=multiplication-11-16');
    if (!session) throw new Error('topic not found');
    const fact = session.topic.facts.find((f) => f.id === '12x15')!;
    expect(session.timerSecondsFor(fact)).toBe(5);
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
    expect(start('Describer').topic.description).toBe('Level 1 of 90: Sums to 10');
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
    expect(saved.facts['multiplication-11-16']['12x15']).toMatchObject({
      correct: 1,
      wrong: 1,
      streak: 0,
    });
    expect(saved.facts['division-11-16']['176/11']).toMatchObject({ correct: 2, streak: 2 });
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

describe('Social Studies level session', () => {
  const search = `?topic=${SOCIAL_STUDIES_LEVEL_ID}`;

  const start = (name: string) => {
    const store = createProgressStore();
    store.setCurrentPlayer(store.addPlayer(name, AVATARS[0]).id);
    const session = startGameSession('level-game', search);
    if (!session) throw new Error('Social Studies level not found');
    return session;
  };
  const saved = () => {
    const store = createProgressStore();
    return store.load(store.currentPlayer()!.id);
  };

  it('starts at level 1', () => {
    const session = start('Social starter');
    expect(session.topic.id).toBe(SOCIAL_STUDIES_LEVEL_ID);
    expect(session.topic.description).toBe('Level 1 of 5: The Northeast');
  });

  it("saves answers under the fact's own topic and the social level count only", () => {
    const session = start('Social answerer');
    const [fact] = session.chooseFacts();
    session.recordAnswer(fact, true);
    const data = saved();
    expect(data.facts['state-capitals'][fact.id].correct).toBe(1);
    expect(data.facts[SOCIAL_STUDIES_LEVEL_ID]).toBeUndefined();
    expect(data.pathLevelsOpen).toEqual({ 'social-studies': 1 });
    expect(data.levelsOpen).toBeUndefined();
  });

  it('keeps stars and high scores under social-studies-level', () => {
    const session = start('Social scorer');
    expect(session.recordStars(3)).toBe(true);
    expect(session.recordScore(500)).toBe(true);
    const data = saved();
    expect(data.best[SOCIAL_STUDIES_LEVEL_ID]).toEqual({ 'level-game': 3 });
    expect(data.highScores[SOCIAL_STUDIES_LEVEL_ID]).toEqual({ 'level-game': 500 });
    expect(data.best[MY_LEVEL_ID]).toBeUndefined();
    expect(data.highScores[MY_LEVEL_ID]).toBeUndefined();
  });

  it('counts capitals learned through topic practice', () => {
    const store = createProgressStore();
    store.setCurrentPlayer(store.addPlayer('Capital learner', AVATARS[0]).id);
    const practice = startGameSession('level-game', '?topic=state-capitals');
    if (!practice) throw new Error('State capitals not found');
    for (const { fact } of SOCIAL_STUDIES_LEVELS[0].facts.slice(0, 8)) {
      practice.recordAnswer(fact, true);
    }
    expect(startGameSession('level-game', search)?.topic.description).toBe(
      'Level 2 of 5: The Midwest',
    );
  });
});

describe('forced dev facts', () => {
  const capitals = getTopic('state-capitals')!;
  const byId = (id: string) => capitals.facts.find((f) => f.id === id)!;

  it('reads ?facts= ids of the topic in order and drops unknown ones', () => {
    expect(devFacts(capitals, '?facts=ohio,nope,texas')).toEqual([byId('ohio'), byId('texas')]);
    expect(devFacts(capitals, '?topic=state-capitals&facts=texas,texas')).toEqual([byId('texas')]);
    expect(devFacts(capitals, '?facts=')).toEqual([]);
    expect(devFacts(capitals, '?topic=state-capitals')).toEqual([]);
  });

  it('opens the round with them and keeps the count', () => {
    const search = '?topic=state-capitals&facts=missouri,new-york';
    const session = startGameSession('forced', search)!;
    for (const count of [10, 2, 1]) {
      const facts = session.chooseFacts(count);
      expect(facts).toHaveLength(count);
      expect(facts.slice(0, 2).map((f) => f.id)).toEqual(['missouri', 'new-york'].slice(0, count));
      expect(new Set(facts.map((f) => f.id)).size).toBe(count);
    }
    const plain = startGameSession('plain', '?topic=state-capitals')!.chooseFacts(10);
    expect(plain).toHaveLength(10);
  });
});
