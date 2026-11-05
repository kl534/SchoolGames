/** The account screens that come with mail and Google: sheet, delete, link pages, Google button. */
import { ApiError } from '../shared/sync/api';
import { changePassword, confirmEmail, deleteAccount, resetPassword } from '../shared/sync/engine';
import {
  confirmsEmail,
  errorText,
  newPasswordProblem,
  passwordErrorText,
  type LinkAction,
} from '../shared/sync/messages';
import type { AccountInfo } from '../shared/sync/protocol';
import { el, errorLine, field, textButton, trapFocus } from './dom';

const code = (e: unknown): string => (e instanceof ApiError ? e.code : 'network');

export const DELETE_TEXT =
  "This deletes the account and everyone's progress in the cloud. Players stay on this device.";

type SheetView = 'menu' | 'password' | 'delete';

export interface SheetOptions {
  email: string;
  info: AccountInfo | null;
  /** The dev preview: nothing is sent anywhere. */
  dev: boolean;
  view?: SheetView;
  close: () => void;
  /** Called after the account was deleted. */
  deleted: () => void;
}

/** The "Account" sheet: change password and delete account, in a dialog. */
export function accountDialog(options: SheetOptions): HTMLElement {
  const { email, info, dev } = options;
  const backdrop = el('div', 'dialog-backdrop');
  const dialog = el('div', 'dialog');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  const title = el('h2');
  title.id = 'account-title';
  dialog.setAttribute('aria-labelledby', title.id);
  backdrop.appendChild(dialog);
  trapFocus(dialog, options.close);

  const show = (view: SheetView) => {
    dialog.replaceChildren(title);
    if (view === 'menu') drawMenu();
    else if (view === 'password') drawPassword();
    else drawDelete();
    const first = dialog.querySelector<HTMLElement>('input, button');
    first?.focus();
  };

  const drawMenu = () => {
    title.textContent = 'Account';
    const buttons = [
      textButton('Change password', () => show('password')),
      textButton('Delete account…', () => show('delete')),
      textButton('Close', options.close),
    ];
    dialog.append(el('p', 'account-sheet-email', email), ...buttons);
  };

  const drawPassword = () => {
    title.textContent = 'Change password';
    const form = el('form', 'dialog-form');
    const hasPassword = info?.hasPassword ?? true;
    const current = field('password', 'Current password', 'current-password');
    const next = field('password', 'New password', 'new-password');
    next.minLength = 8;
    const repeat = field('password', 'New password again', 'new-password');
    const submit = el('button', 'primary', 'Change password');
    submit.type = 'submit';
    if (hasPassword) form.appendChild(current);
    form.append(next, repeat);
    const message = el('div');
    form.append(
      message,
      submit,
      textButton('Cancel', () => show('menu')),
    );
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const problem = newPasswordProblem(next.value, repeat.value);
      if (problem) {
        message.replaceChildren(errorLine(problem));
        return;
      }
      if (dev) return;
      submit.disabled = true;
      submit.textContent = 'Please wait…';
      changePassword(hasPassword ? current.value : '', next.value)
        .then(() => {
          dialog.replaceChildren(
            title,
            el('p', undefined, 'Password changed. Other devices were signed out.'),
            textButton('Close', options.close),
          );
          dialog.querySelector('button')?.focus();
        })
        .catch((err: unknown) => {
          message.replaceChildren(errorLine(passwordErrorText(code(err))));
          submit.disabled = false;
          submit.textContent = 'Change password';
        });
    });
    dialog.appendChild(form);
  };

  const drawDelete = () => {
    title.textContent = 'Delete account?';
    const form = el('form', 'dialog-form');
    const typed = field('email', 'Email', 'off');
    typed.setAttribute('aria-label', 'Type your email to confirm');
    const submit = el('button', 'danger', 'Delete account');
    submit.type = 'submit';
    submit.disabled = true;
    typed.addEventListener('input', () => {
      submit.disabled = !confirmsEmail(typed.value, email);
    });
    const message = el('div');
    form.append(
      el('p', undefined, DELETE_TEXT),
      el('p', 'account-sheet-email', `Type ${email} to confirm.`),
      typed,
      message,
      submit,
      textButton('Cancel', () => show('menu')),
    );
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (dev || !confirmsEmail(typed.value, email)) return;
      submit.disabled = true;
      submit.textContent = 'Please wait…';
      deleteAccount(typed.value.trim())
        .then(options.deleted)
        .catch((err: unknown) => {
          message.replaceChildren(errorLine(errorText(code(err))));
          submit.disabled = false;
          submit.textContent = 'Delete account';
        });
    });
    dialog.appendChild(form);
  };

  show(options.view ?? 'menu');
  return backdrop;
}

// ---------- Mailed links: ?verify=<token> and ?reset=<token> ----------

/** The page a mailed link opens (or its dev preview, which sends nothing). */
export function renderLinkPage(
  root: HTMLElement,
  action: LinkAction,
  backUrl: string,
  dev = false,
): void {
  const header = el('header');
  const top = el('div', 'header-top');
  const back = el('a', 'back-link', '← Back');
  back.href = backUrl;
  top.append(back, el('span', 'spacer'));
  const heading = el(
    'h1',
    undefined,
    action.kind === 'verify' ? 'Confirm your email' : 'New password',
  );
  header.append(top, heading);
  const body = el('main', 'link-page');
  root.replaceChildren(header, body);

  if (action.kind === 'verify') {
    if (dev) {
      body.appendChild(el('p', 'link-result ok', 'Email confirmed ✓'));
      return;
    }
    body.appendChild(el('p', 'link-result', 'Confirming…'));
    confirmEmail(action.token)
      .then(() => body.replaceChildren(el('p', 'link-result ok', 'Email confirmed ✓')))
      .catch((err: unknown) =>
        body.replaceChildren(
          el(
            'p',
            'link-result',
            code(err) === 'invalid' ? 'That link has expired' : errorText(code(err)),
          ),
        ),
      );
    return;
  }

  const form = el('form', 'new-player account-form');
  const next = field('password', 'New password', 'new-password');
  next.minLength = 8;
  const repeat = field('password', 'New password again', 'new-password');
  const message = el('div');
  const submit = el('button', 'primary', 'Save password');
  submit.type = 'submit';
  form.append(
    el('p', 'account-note', 'Choose a new password. Use at least 8 characters.'),
    next,
    repeat,
    message,
    submit,
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const problem = newPasswordProblem(next.value, repeat.value);
    if (problem) {
      message.replaceChildren(errorLine(problem));
      return;
    }
    if (dev) return;
    submit.disabled = true;
    submit.textContent = 'Please wait…';
    resetPassword(action.token, next.value)
      .then(() =>
        body.replaceChildren(
          el('p', 'link-result ok', 'Password changed. Sign in with the new password.'),
        ),
      )
      .catch((err: unknown) => {
        if (code(err) === 'invalid') {
          body.replaceChildren(el('p', 'link-result', 'That link has expired'));
          return;
        }
        message.replaceChildren(errorLine(errorText(code(err))));
        submit.disabled = false;
        submit.textContent = 'Save password';
      });
  });
  body.appendChild(form);
  next.focus();
}

// ---------- Google button ----------

interface GoogleId {
  initialize(config: { client_id: string; callback: (r: { credential: string }) => void }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
}

let gsi: Promise<GoogleId> | null = null;

/** Loads Google's sign-in script the first time it is needed. */
function loadGoogle(): Promise<GoogleId> {
  gsi ??= new Promise<GoogleId>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      const g = (window as unknown as { google?: { accounts?: { id?: GoogleId } } }).google;
      if (g?.accounts?.id) resolve(g.accounts.id);
      else reject(new Error('google'));
    };
    script.onerror = () => reject(new Error('google'));
    document.head.appendChild(script);
  });
  gsi.catch(() => {
    gsi = null;
  });
  return gsi;
}

/**
 * Google's own button. It leaves its place empty when the script cannot load (offline), and shows a
 * plain stand-in in the dev preview.
 */
export function googleButton(
  clientId: string,
  onCredential: (credential: string) => void,
  dev = false,
): HTMLElement {
  const wrap = el('div', 'google-button');
  if (dev) {
    wrap.appendChild(el('span', 'google-stand-in', 'Continue with Google'));
    return wrap;
  }
  loadGoogle()
    .then((id) => {
      id.initialize({ client_id: clientId, callback: (r) => onCredential(r.credential) });
      id.renderButton(wrap, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'continue_with',
        width: Math.min(280, Math.max(200, wrap.parentElement?.clientWidth ?? 280)),
      });
    })
    .catch(() => wrap.remove());
  return wrap;
}
