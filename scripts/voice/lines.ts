/**
 * Collects every line the games speak and writes `src/shared/voice-lines.json`
 * ({ "<key>": "<text>" }). Run with `npm run voice:lines`; `generate.py` records the clips.
 */
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { KICKS_PER_ROUND, scoreSpeech } from '../../src/shared/round';
import { TAP_SPEECH } from '../../src/shared/tapgate';
import { TOPICS } from '../../src/shared/topics';
import { normalizeSpeech, voiceKey } from '../../src/shared/voice';

const root = resolve(import.meta.dirname, '../..');
const gamesDir = resolve(root, 'src/games');
export const LINES_FILE = resolve(root, 'src/shared/voice-lines.json');

/** Lines spoken by every game: round scores and the reminder to tap the green answer. */
function sharedLines(): string[] {
  const lines: string[] = [TAP_SPEECH];
  for (let total = 1; total <= KICKS_PER_ROUND; total++) {
    for (let correct = 0; correct <= total; correct++) lines.push(scoreSpeech(correct, total));
  }
  return lines;
}

/** Every fact's prompt and statement, as the games pass them to `speak`. */
function factLines(): string[] {
  return TOPICS.flatMap((topic) =>
    topic.facts.flatMap((fact) => [
      fact.spokenPrompt ?? fact.prompt,
      fact.spokenStatement ?? fact.statement,
    ]),
  );
}

/** `VOICE_LINES` of each `src/games/<id>/voice.ts`. */
async function gameLines(): Promise<string[]> {
  const lines: string[] = [];
  for (const entry of readdirSync(gamesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = resolve(gamesDir, entry.name, 'voice.ts');
    if (!existsSync(file)) continue;
    const module = (await import(pathToFileURL(file).href)) as { VOICE_LINES: string[] };
    lines.push(...module.VOICE_LINES);
  }
  return lines;
}

/** All distinct spoken lines, normalized and sorted. */
export async function collectVoiceLines(): Promise<string[]> {
  const all = [...factLines(), ...sharedLines(), ...(await gameLines())];
  return [...new Set(all.map(normalizeSpeech).filter(Boolean))].sort();
}

/** The `{ key: text }` map written to `voice-lines.json`, sorted by key. */
export async function voiceLinesByKey(): Promise<Record<string, string>> {
  const byKey = new Map<string, string>();
  for (const text of await collectVoiceLines()) {
    const key = voiceKey(text);
    const other = byKey.get(key);
    if (other !== undefined) throw new Error(`Voice key ${key} collides: "${other}" and "${text}"`);
    byKey.set(key, text);
  }
  return Object.fromEntries([...byKey].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const lines = await voiceLinesByKey();
  writeFileSync(LINES_FILE, `${JSON.stringify(lines, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(lines).length} lines to src/shared/voice-lines.json`);
}
