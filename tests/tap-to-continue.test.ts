import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const gamesDir = resolve(import.meta.dirname, '../src/games');

/**
 * Every game: each one has answer buttons, so each waits for a tap on the green answer after a
 * miss. A new game fails here until it uses the shared tap flow.
 */
const GAMES = readdirSync(gamesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

function sources(id: string): Record<string, string> {
  const dir = resolve(gamesDir, id);
  return Object.fromEntries(
    readdirSync(dir)
      .filter((name) => name.endsWith('.ts'))
      .map((name) => [name, readFileSync(resolve(dir, name), 'utf8')]),
  );
}

describe('tap to continue', () => {
  it('lists the games', () => {
    // A listing that came back empty would make every check below pass for nothing.
    expect(GAMES.length).toBeGreaterThanOrEqual(8);
    expect(GAMES).toEqual(expect.arrayContaining(['batter-up', 'buzzer-beater', 'strike-zone']));
  });

  it.each(GAMES)('%s uses the shared tap flow', (id) => {
    const files = sources(id);
    const all = Object.values(files);
    expect(
      all.some((text) => text.includes('createTapFlow(')),
      'a file calls createTapFlow(',
    ).toBe(true);
    expect(
      all.some((text) => text.includes('tapFlow.dispose()')),
      'a file disposes the flow',
    ).toBe(true);
    expect(files['main.ts']).toContain('tapFlow.update(');
    expect(files['main.ts']).toContain('tapFlow.disarm(');
  });

  it.each(GAMES)('%s no longer times out or skips a miss', (id) => {
    const main = sources(id)['main.ts'];
    expect(main).not.toContain('SKIP_AFTER');
    expect(main).not.toContain('REVEAL_FOR');
  });
});
