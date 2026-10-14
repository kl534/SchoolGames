import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** A source node that records what happened to it. */
class FakeSource {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  connect(node: unknown) {
    return node;
  }
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
}

const sources: FakeSource[] = [];
const contexts: FakeAudioContext[] = [];

class FakeAudioContext {
  state = 'running';
  constructor() {
    contexts.push(this);
  }
  destination = {};
  decodeAudioData = vi.fn(async () => ({ duration: 0.5 }));
  createBufferSource() {
    const source = new FakeSource();
    sources.push(source);
    return source;
  }
  resume = vi.fn(async () => {});
}

const spoken: string[] = [];
const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

beforeEach(() => {
  vi.resetModules();
  sources.length = 0;
  contexts.length = 0;
  spoken.length = 0;
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('SpeechSynthesisUtterance', class {});
  vi.stubGlobal('speechSynthesis', {
    cancel: () => {},
    getVoices: () => [],
    addEventListener: () => {},
    speak: (u: { text?: string }) => spoken.push(String(u)),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('speak', () => {
  it('plays a recorded clip and calls onEnd once when it ends', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })),
    );
    const { speak } = await import('../src/shared/audio');
    const onEnd = vi.fn();
    speak('5 plus 4.', onEnd);
    await flush();
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/voice\/[0-9a-z]+\.mp3$/));
    expect(sources[0]?.started).toBe(true);
    expect(spoken).toHaveLength(0);
    expect(onEnd).not.toHaveBeenCalled();
    sources[0]?.onended?.();
    sources[0]?.onended?.();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('uses the browser voice when the clip fails to load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false })),
    );
    const { speak } = await import('../src/shared/audio');
    speak('5 plus 4.');
    await flush();
    expect(sources).toHaveLength(0);
    expect(spoken).toHaveLength(1);
  });

  it('uses the browser voice for a line without a clip', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { speak } = await import('../src/shared/audio');
    speak('A line nobody recorded');
    await flush();
    expect(fetch).not.toHaveBeenCalled();
    expect(spoken).toHaveLength(1);
  });

  it('ends an interrupted clip without playing it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })),
    );
    const { speak, stopSpeaking } = await import('../src/shared/audio');
    const onEnd = vi.fn();
    speak('5 plus 4.', onEnd);
    stopSpeaking();
    await flush();
    expect(sources).toHaveLength(0);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});

describe('unlockAudio', () => {
  it('resumes audio that Safari has interrupted', async () => {
    const { unlockAudio } = await import('../src/shared/audio');
    unlockAudio();
    const [ctx] = contexts;
    if (!ctx) throw new Error('no AudioContext');
    ctx.state = 'interrupted';
    unlockAudio();
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it('wakes the browser voice on the first tap only', async () => {
    const { unlockAudio } = await import('../src/shared/audio');
    unlockAudio();
    unlockAudio();
    unlockAudio();
    expect(spoken).toHaveLength(1);
  });

  it('leaves the iOS audio session alone', async () => {
    const audioSession = { type: 'auto' };
    vi.stubGlobal('navigator', { audioSession });
    const { unlockAudio } = await import('../src/shared/audio');
    unlockAudio();
    expect(audioSession.type).toBe('auto');
  });
});
