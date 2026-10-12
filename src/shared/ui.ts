/** URL of the game menu (site root under the configured base path). */
export function menuUrl(): string {
  return import.meta.env.BASE_URL;
}

const BUTTON_STYLE = [
  'min-width:48px',
  'min-height:48px',
  'padding:0 18px',
  'border:0',
  'border-radius:24px',
  'background:rgba(15,18,32,0.8)',
  'color:#fff',
  'font:600 16px system-ui,sans-serif',
  'cursor:pointer',
  'touch-action:manipulation',
].join(';');

function makeButton(label: string, ariaLabel?: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (ariaLabel) button.setAttribute('aria-label', ariaLabel);
  button.style.cssText = BUTTON_STYLE;
  return button;
}

/** Fixed top-left link back to the game menu. */
export function createBackButton(container: HTMLElement = document.body): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = menuUrl();
  link.textContent = '← Menu';
  link.setAttribute('aria-label', 'Back to game menu');
  link.style.cssText = `${BUTTON_STYLE};position:fixed;top:max(12px,env(safe-area-inset-top));left:max(12px,env(safe-area-inset-left));display:inline-flex;align-items:center;text-decoration:none;z-index:20`;
  container.appendChild(link);
  return link;
}

export interface PauseOverlay {
  show(): void;
  hide(): void;
  readonly isPaused: boolean;
  dispose(): void;
}

export interface PauseOverlayOptions {
  onPause?: () => void;
  onResume?: () => void;
  container?: HTMLElement;
}

/** Pause button (top-right) and a modal overlay with Resume / Menu actions. */
export function createPauseOverlay(options: PauseOverlayOptions = {}): PauseOverlay {
  const container = options.container ?? document.body;
  let paused = false;

  const pauseButton = makeButton('⏸', 'Pause');
  pauseButton.style.cssText +=
    ';position:fixed;top:max(12px,env(safe-area-inset-top));right:max(12px,env(safe-area-inset-right));z-index:20';

  const overlay = document.createElement('div');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Game paused');
  overlay.hidden = true;
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:30;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:rgba(15,18,32,0.85);color:#fff;font-family:system-ui,sans-serif';

  const heading = document.createElement('h2');
  heading.textContent = 'Paused';
  heading.style.cssText = 'margin:0 0 8px;font-size:32px';
  const resume = makeButton('Resume');
  const menu = document.createElement('a');
  menu.href = menuUrl();
  menu.textContent = 'Back to menu';
  menu.style.cssText = `${BUTTON_STYLE};display:inline-flex;align-items:center;text-decoration:none`;
  overlay.append(heading, resume, menu);

  const set = (value: boolean) => {
    if (paused === value) return;
    paused = value;
    overlay.hidden = !value;
    if (value) {
      resume.focus();
      options.onPause?.();
    } else {
      pauseButton.focus();
      options.onResume?.();
    }
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') set(!paused);
  };

  pauseButton.addEventListener('click', () => set(true));
  resume.addEventListener('click', () => set(false));
  window.addEventListener('keydown', onKey);
  container.append(pauseButton, overlay);

  return {
    show: () => set(true),
    hide: () => set(false),
    get isPaused() {
      return paused;
    },
    dispose() {
      window.removeEventListener('keydown', onKey);
      pauseButton.remove();
      overlay.remove();
    },
  };
}
