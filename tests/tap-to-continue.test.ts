import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const gamesDir = resolve(import.meta.dirname, '../src/games');

/** The games that wait for a tap on the green answer after a miss, so far. */
const CONVERTED = ['penalty-kick', 'grape-gobble', 'asteroid-run', 'zombie-blast', 'crash-course'];

function sources(id: string): Record<string, string> {
  const dir = resolve(gamesDir, id);
  return Object.fromEntries(
    readdirSync(dir)
      .filter((name) => name.endsWith('.ts'))
      .map((name) => [name, readFileSync(resolve(dir, name), 'utf8')]),
  );
}

describe('tap to continue', () => {
  it.each(CONVERTED)('%s uses the shared tap flow', (id) => {
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

  it.each(CONVERTED)('%s no longer times out or skips a miss', (id) => {
    const main = sources(id)['main.ts'];
    expect(main).not.toContain('SKIP_AFTER');
    expect(main).not.toContain('REVEAL_FOR');
  });
});
