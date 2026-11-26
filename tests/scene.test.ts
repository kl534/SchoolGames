// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const render = vi.fn();
let loop: ((time: number) => void) | null = null;

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class FakeRenderer {
    domElement = document.createElement('canvas');
    render = render;
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    dispose = vi.fn();
    setAnimationLoop(fn: ((time: number) => void) | null) {
      loop = fn;
    }
  }
  return { ...actual, WebGLRenderer: FakeRenderer };
});

import { createScene } from '../src/shared/scene';

describe('createScene setRender', () => {
  beforeEach(() => {
    render.mockClear();
    loop = null;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
  });

  it('renders the scene by default, calls the hook instead when set, and goes back on null', () => {
    const ctx = createScene(document.createElement('div'));
    ctx.start();
    loop?.(16);
    expect(render).toHaveBeenCalledTimes(1);

    const hook = vi.fn();
    ctx.setRender(hook);
    loop?.(32);
    expect(hook).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledTimes(1);

    ctx.setRender(null);
    loop?.(48);
    expect(render).toHaveBeenCalledTimes(2);
    ctx.dispose();
  });
});
