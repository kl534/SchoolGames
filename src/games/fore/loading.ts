/**
 * The loading screen: plain HTML in `index.html` (so it shows while the scripts download) that
 * covers the game while every hole is built and every shader compiled, then fades away.
 */
export interface Loading {
  /** Fills the bar to `fraction` (0..1). */
  progress(fraction: number): void;
  /** Fades the screen out and removes it. */
  done(): void;
}

export function takeLoading(): Loading {
  const screen = document.getElementById('fg-loading');
  const fill = screen?.querySelector<HTMLElement>('.fg-loading-fill');
  return {
    progress(fraction) {
      const pct = Math.round(Math.min(Math.max(fraction, 0), 1) * 100);
      if (fill) fill.style.width = `${Math.max(pct, 4)}%`;
      screen?.setAttribute('aria-valuenow', String(pct));
    },
    done() {
      if (!screen) return;
      screen.classList.add('fg-loading-done');
      setTimeout(() => screen.remove(), 400);
    },
  };
}

/** Lets the browser paint (and the bar move) between slow steps. */
export const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
