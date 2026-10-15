import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectVoiceLines, voiceLinesByKey } from '../scripts/voice/lines';
import { finalSpeech, inningSpeech, leadSpeech } from '../src/games/batter-up/rules';
import voiceLines from '../src/shared/voice-lines.json';
import { scoreSpeech } from '../src/shared/round';
import { normalizeSpeech, voiceKey } from '../src/shared/voice';

describe('voiceKey', () => {
  it('is deterministic', () => {
    expect(voiceKey('5 plus 4.')).toBe(voiceKey('5 plus 4.'));
    expect(voiceKey('5 plus 4.')).toBe('yp5jfvrpk7');
    expect(voiceKey('5 plus 4.')).not.toBe(voiceKey('5 plus 5.'));
  });

  it('ignores extra whitespace', () => {
    expect(normalizeSpeech('  5  plus\n4. ')).toBe('5 plus 4.');
    expect(voiceKey('  5  plus\n4. ')).toBe(voiceKey('5 plus 4.'));
  });
});

describe('collectVoiceLines', () => {
  it('has the fact, game and score lines', async () => {
    const lines = await collectVoiceLines();
    for (const line of [
      '5 plus 4.',
      '5 plus 4 equals 9.',
      'Play ball!',
      'The zombies got your brains!',
      'Ship destroyed!',
      'New high score!',
      'Great flying!',
      'You scored 7 out of 10!',
      'Three outs!',
      "Top of the 3rd. You're up to bat!",
      'Today you play the Toledo Mud Hens!',
      'You scored 1 run!',
    ]) {
      expect(lines).toContain(line);
    }
  });

  it('has no duplicates and no key collisions', async () => {
    const lines = await collectVoiceLines();
    expect(new Set(lines).size).toBe(lines.length);
    await expect(voiceLinesByKey()).resolves.toBeDefined();
  });
});

describe('recorded clips', () => {
  it('voice-lines.json matches the lines the games speak (run `npm run voice`)', async () => {
    expect(voiceLines, 'Run `npm run voice` to update the list and the clips').toEqual(
      await voiceLinesByKey(),
    );
  });

  it('has a clip for every line (run `npm run voice`)', () => {
    const missing = Object.keys(voiceLines).filter(
      (key) => !existsSync(resolve(import.meta.dirname, `../public/voice/${key}.mp3`)),
    );
    expect(missing, 'Missing clips: run `npm run voice`').toEqual([]);
  });
});

describe('spoken score lines', () => {
  it('builds the round score', () => {
    expect(scoreSpeech(7, 10)).toBe('You scored 7 out of 10!');
  });

  it('builds the batter-up end lines', () => {
    expect(finalSpeech(1)).toBe('You scored 1 run!');
    expect(finalSpeech(0)).toBe('You scored 0 runs!');
    // A score too big to have a clip is called by a fixed line.
    expect(finalSpeech(30)).toBe('You scored 30 runs!');
    expect(finalSpeech(31)).toBe('You scored more than 30 runs!');
    expect(leadSpeech(2)).toBe('You lead by 2!');
    expect(inningSpeech(1, 'bottom')).toBe('Bottom of the 1st. Time to pitch!');
  });
});
