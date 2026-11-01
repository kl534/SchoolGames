import './style.css';
import { discoverGames, type GameEntry } from './games';
import {
  AVATARS,
  MAX_NAME_LENGTH,
  createProgressStore,
  type Player,
  type PlayerProgress,
} from '../shared/progress';
import { getPath, PATHS, pathForLevelTopic, type LevelPath } from '../shared/levels';
import { gameUrl } from '../shared/session';
import { topicMenuUrl, topicsUrl } from '../shared/ui';
import { ApiError } from '../shared/sync/api';
import { clearNotice, getAccount, getNotice } from '../shared/sync/account';
import { devSyncState, syncEnabled, syncUrl } from '../shared/sync/config';
import {
  fetchAccountInfo,
  fetchConfig,
  requestReset,
  resendVerification,
  signIn,
  signInWithGoogle,
  signOut,
  signUp,
  syncFailed,
  syncNow,
} from '../shared/sync/engine';
import { errorText, linkAction } from '../shared/sync/messages';
import type { AccountInfo, ServerConfig } from '../shared/sync/protocol';
import { accountDialog, googleButton, renderLinkPage } from './account-extras';
import {
  PATH_EMOJI,
  choiceInfo,
  currentChoice,
  isChoice,
  pathChoiceInfo,
  pickerSections,
  recentChoices,
  rememberChoice,
} from './choices';
import { el, errorLine, field, textButton } from './dom';

const store = createProgressStore();
const base = import.meta.env.BASE_URL;

function link(href: string, className: string, text?: string): HTMLAnchorElement {
  const a = el('a', className, text);
  a.href = href;
  return a;
}

function starsText(stars: number | undefined): string {
  return stars === undefined ? '' : '★'.repeat(stars) + '☆'.repeat(3 - stars);
}

function playerChip(player: Player): HTMLElement {
  const chip = link(`${base}?players`, 'player-chip');
  chip.setAttribute('aria-label', `Playing as ${player.name}. Switch player`);
  chip.append(el('span', 'avatar', player.avatar), el('span', undefined, player.name));
  chip.append(el('span', 'switch', 'Switch'));
  return chip;
}

function header(
  title: string | null,
  subtitle: string | null,
  player: Player | null,
  back?: HTMLElement,
) {
  const h = el('header');
  const top = el('div', 'header-top');
  if (back) top.appendChild(back);
  top.appendChild(el('span', 'spacer'));
  if (player) top.appendChild(playerChip(player));
  h.appendChild(top);
  if (title) h.appendChild(el('h1', undefined, title));
  if (subtitle) h.appendChild(el('p', undefined, subtitle));
  return h;
}

function masteryBar(mastered: number, total: number): HTMLElement {
  const wrap = el('div', 'mastery');
  const bar = el('div', 'mastery-bar');
  const fill = el('div', 'mastery-fill');
  fill.style.width = `${total ? (mastered / total) * 100 : 0}%`;
  bar.appendChild(fill);
  wrap.append(bar, el('span', undefined, `${mastered} / ${total} facts learned`));
  return wrap;
}

// ---------- Account (sync) ----------

type SyncStatus = 'synced' | 'syncing' | 'offline';
let syncStatus: SyncStatus = 'synced';

const STATUS_TEXT: Record<SyncStatus, string> = {
  synced: 'Synced',
  syncing: 'Syncing…',
  offline: 'Will sync when online',
};

const PRIVACY_NOTE =
  'For a parent or teacher. Kids only need a first name and a buddy; we keep those and their progress, nothing else.';

const DEMO_EMAIL = 'demo@example.com';

function setSyncStatus(root: HTMLElement, status: SyncStatus): void {
  syncStatus = status;
  const node = root.querySelector('.account-status');
  if (node) node.textContent = `☁ ${STATUS_TEXT[status]}`;
}

/** The "Sign out of ...?" dialog. Focus stays on its buttons; Escape cancels. */
function signOutDialog(
  email: string,
  names: string[],
  unsynced: boolean,
  choose: (removeLocal: boolean) => void,
  cancel: () => void,
): HTMLElement {
  const backdrop = el('div', 'dialog-backdrop');
  const dialog = el('div', 'dialog');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  const title = el('h2', undefined, `Sign out of ${email}?`);
  title.id = 'sign-out-title';
  dialog.setAttribute('aria-labelledby', title.id);
  dialog.append(
    title,
    el('p', undefined, `Players on this account: ${names.join(', ') || 'none'}`),
  );
  if (unsynced) {
    dialog.appendChild(
      el('p', 'error', 'Some progress has not synced yet. Removing the players now will lose it.'),
    );
  }
  const buttons = [
    textButton('Keep players on this device', () => choose(false)),
    textButton('Remove them from this device', () => choose(true)),
    textButton('Cancel', cancel),
  ];
  dialog.append(...buttons);
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    } else if (e.key === 'Tab') {
      const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = (i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
      e.preventDefault();
      buttons[next].focus();
    }
  });
  backdrop.appendChild(dialog);
  queueMicrotask(() => buttons[0].focus());
  return backdrop;
}

/** The account row under the player grid: sign in, the sign-in panel, or the signed-in row. */
function accountSection(root: HTMLElement, dev: string | null, shownPlayers: () => Player[]) {
  const wrap = el('div', 'account');
  const params = new URLSearchParams(location.search);
  const account = dev
    ? dev === 'in' || dev === 'signout' || dev === 'account' || dev === 'delete'
      ? { email: DEMO_EMAIL }
      : null
    : getAccount();
  let panel: 'none' | 'signin' | 'signup' | 'forgot' =
    dev === 'signin' || dev === 'error' ? 'signin' : dev === 'signup' ? 'signup' : 'none';
  let error: string | null = dev === 'error' ? 'bad_credentials' : null;
  let dialog: HTMLElement | null = null;
  let emailValue = '';
  let devDialog = dev === 'signout';
  let devSheet: 'menu' | 'delete' | null =
    params.get('sheet') === 'off'
      ? null
      : dev === 'account'
        ? 'menu'
        : dev === 'delete'
          ? 'delete'
          : null;
  let notice = false;
  let forgotSent = false;
  let config: ServerConfig | null = null;
  let info: AccountInfo | null = null;
  let extrasHost: HTMLElement | null = null;
  if (!dev && getNotice() === 'signed-out') {
    notice = true;
    clearNotice();
  }
  if (dev) {
    // `&mail=1` and `&google=1` preview the parts that depend on what the service offers.
    config = {
      emailEnabled: params.get('mail') === '1' || dev === 'account' || dev === 'delete',
      googleClientId: params.get('google') === '1' ? 'dev-client-id' : null,
    };
    if (dev === 'account' || dev === 'delete') {
      info = { email: DEMO_EMAIL, emailVerified: false, hasPassword: true };
    }
  }

  const draw = () => {
    wrap.replaceChildren();
    if (account) drawSignedIn();
    else if (panel === 'none') drawSignedOut();
    else if (panel === 'forgot') drawForgot();
    else drawPanel();
  };

  const drawSignedOut = () => {
    if (notice) {
      wrap.appendChild(
        el('p', 'account-notice', 'You were signed out. Sign in again to keep syncing.'),
      );
    }
    const open = textButton('☁ Sign in to sync across devices', () => {
      panel = 'signin';
      draw();
      wrap.querySelector('input')?.focus();
    });
    open.classList.add('account-open');
    wrap.appendChild(open);
  };

  const finishSignIn = (work: Promise<void>, fail: (message: string) => void) => {
    work
      .then(() => {
        location.href = `${base}?players`;
      })
      .catch((err: unknown) => fail(err instanceof ApiError ? err.code : 'network'));
  };

  /** Google's button and "Forgot password?", which exist only when the service offers them. */
  const drawExtras = () => {
    if (!extrasHost) return;
    extrasHost.replaceChildren();
    if (config?.googleClientId) {
      const google = googleButton(
        config.googleClientId,
        (credential) =>
          finishSignIn(signInWithGoogle(credential), (code) => {
            error = code;
            draw();
          }),
        Boolean(dev),
      );
      extrasHost.appendChild(google);
    }
    if (config?.emailEnabled && panel === 'signin') {
      extrasHost.appendChild(
        textButton('Forgot password?', () => {
          emailValue = (wrap.querySelector('input[type=email]') as HTMLInputElement).value;
          panel = 'forgot';
          forgotSent = false;
          error = null;
          draw();
        }),
      );
    }
  };

  const drawPanel = () => {
    const creating = panel === 'signup';
    const form = el('form', 'new-player account-form');
    const tabs = el('div', 'account-tabs');
    for (const [id, label] of [
      ['signin', 'Sign in'],
      ['signup', 'Create account'],
    ] as const) {
      const tab = el('button', 'account-tab', label);
      tab.type = 'button';
      tab.setAttribute('aria-pressed', String(panel === id));
      tab.addEventListener('click', () => {
        emailValue = (form.querySelector('input[type=email]') as HTMLInputElement).value;
        panel = id;
        error = null;
        draw();
      });
      tabs.appendChild(tab);
    }
    const email = field('email', 'Email', 'username');
    email.value = emailValue;
    const password = field('password', 'Password', creating ? 'new-password' : 'current-password');
    if (creating) password.minLength = 8;
    const submit = el('button', 'primary', creating ? 'Create account' : 'Sign in');
    submit.type = 'submit';
    const cancel = textButton('Cancel', () => {
      panel = 'none';
      error = null;
      draw();
    });
    extrasHost = el('div', 'account-extras');
    form.append(tabs, email, password);
    if (creating) form.appendChild(el('p', 'account-note', PRIVACY_NOTE));
    if (error) form.appendChild(errorLine(errorText(error)));
    form.append(submit, extrasHost, cancel);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submit.disabled = true;
      submit.textContent = 'Please wait…';
      emailValue = email.value;
      finishSignIn((creating ? signUp : signIn)(email.value.trim(), password.value), (code) => {
        error = code;
        draw();
      });
    });
    wrap.appendChild(form);
    drawExtras();
  };

  const drawForgot = () => {
    const form = el('form', 'new-player account-form');
    form.appendChild(el('h2', undefined, 'Forgot password?'));
    const back = textButton('Back to sign in', () => {
      panel = 'signin';
      draw();
    });
    if (forgotSent) {
      form.append(
        el(
          'p',
          'account-note',
          'If that email has an account, a link to choose a new password is on its way.',
        ),
        back,
      );
      wrap.appendChild(form);
      return;
    }
    const email = field('email', 'Email', 'username');
    email.value = emailValue;
    const submit = el('button', 'primary', 'Send link');
    submit.type = 'submit';
    form.append(el('p', 'account-note', 'We will email a link to choose a new password.'), email);
    if (error) form.appendChild(errorLine(errorText(error)));
    form.append(submit, back);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      emailValue = email.value;
      if (dev) {
        forgotSent = true;
        draw();
        return;
      }
      submit.disabled = true;
      submit.textContent = 'Please wait…';
      requestReset(email.value.trim())
        .then(() => {
          forgotSent = true;
          error = null;
          draw();
        })
        .catch((err: unknown) => {
          error = err instanceof ApiError ? err.code : 'network';
          draw();
        });
    });
    wrap.appendChild(form);
  };

  /** "Confirm your email" with a Resend button, while the service has mail and the email is not confirmed. */
  const verifyLine = (): HTMLElement | null => {
    if (!config?.emailEnabled || !info || info.emailVerified) return null;
    const line = el('div', 'account-verify');
    const text = el('span', undefined, 'Confirm your email — we sent a link');
    const resend = textButton('Resend', () => {
      if (dev) return;
      resend.disabled = true;
      resend.textContent = 'Sending…';
      resendVerification()
        .then(() => {
          text.textContent = 'Sent again. Check your inbox.';
          resend.remove();
        })
        .catch((err: unknown) => {
          text.textContent = errorText(err instanceof ApiError ? err.code : 'network');
          resend.disabled = false;
          resend.textContent = 'Resend';
        });
    });
    line.append(text, resend);
    return line;
  };

  const drawSignedIn = () => {
    if (!account) return;
    const row = el('div', 'account-row');
    const infoLine = el('div', 'account-info');
    infoLine.append(
      el('span', 'account-status', `☁ ${STATUS_TEXT[dev ? 'synced' : syncStatus]}`),
      el('span', 'account-sep', '·'),
    );
    const email = el('span', 'account-email', account.email);
    email.title = account.email;
    infoLine.appendChild(email);
    const sync = textButton('Sync now', () => {
      if (dev) return;
      setSyncStatus(root, 'syncing');
      void syncNow().then(() => {
        syncStatus = syncFailed() ? 'offline' : 'synced';
        renderPlayers(root);
      });
    });
    const manage = textButton('Account', () => showSheet('menu'));
    const out = textButton('Sign out', () => {
      if (dev) {
        showDialog(false);
        return;
      }
      out.disabled = true;
      void syncNow().then(() => {
        if (!getAccount()) {
          renderPlayers(root);
          return;
        }
        showDialog(createProgressStore().pending().dirty.length > 0);
      });
    });
    row.appendChild(infoLine);
    const verify = verifyLine();
    if (verify) row.appendChild(verify);
    row.append(sync, manage, out);
    wrap.appendChild(row);
    if (devDialog) {
      devDialog = false;
      showDialog(false);
    }
    if (devSheet) {
      const view = devSheet;
      devSheet = null;
      showSheet(view);
    }
  };

  const closeDialog = () => {
    dialog?.remove();
    dialog = null;
    draw();
  };

  const showSheet = (view: 'menu' | 'delete') => {
    dialog?.remove();
    dialog = accountDialog({
      email: account?.email ?? '',
      info,
      dev: Boolean(dev),
      view,
      close: closeDialog,
      deleted: () => {
        location.href = `${base}?players`;
      },
    });
    wrap.appendChild(dialog);
  };

  const showDialog = (unsynced: boolean) => {
    const names = shownPlayers()
      .filter((p) => p.account || dev)
      .map((p) => p.name);
    dialog = signOutDialog(
      account?.email ?? '',
      names,
      unsynced,
      (removeLocal) => {
        if (dev) {
          closeDialog();
          return;
        }
        void signOut({ removeLocal }).then(() => {
          location.href = `${base}?players`;
        });
      },
      closeDialog,
    );
    wrap.appendChild(dialog);
  };

  draw();

  if (!dev && syncUrl()) {
    // What the service offers, and whether the email is confirmed. Redraw only when nothing is
    // open, so a typed password or an open dialog is never lost.
    void fetchConfig().then((c) => {
      config = c;
      if (!account && panel !== 'none') drawExtras();
      else if (!dialog) draw();
    });
    if (account) {
      void fetchAccountInfo().then((i) => {
        info = i;
        if (!dialog) draw();
      });
    }
  }
  return wrap;
}

// ---------- Player picker ----------

function renderPlayers(root: HTMLElement): void {
  const players = store.listPlayers();
  const current = store.currentPlayer();
  let managing = false;
  const sync = syncEnabled();
  const dev = sync ? devSyncState() : null;
  const signedInPreview =
    dev === 'in' || dev === 'signout' || dev === 'account' || dev === 'delete';
  /** The players to show; the dev preview of a signed-in picker adds two in-memory ones. */
  const shown = (): Player[] => {
    const list = store.listPlayers();
    if (!signedInPreview) return list;
    const extra: Player[] = [
      { id: 'dev-ava', name: 'Ava', avatar: '🐼' },
      { id: 'dev-ben', name: 'Ben', avatar: '🐯' },
    ];
    return list.length <= 1 ? [...list, ...extra] : list;
  };

  const grid = el('main', 'grid players');
  const form = el('form', 'new-player');
  form.hidden = players.length > 0;

  const draw = () => {
    grid.replaceChildren();
    for (const player of shown()) {
      const card = el('button', 'player-card');
      card.type = 'button';
      if (player.id === current?.id) card.classList.add('current');
      card.append(el('span', 'avatar', player.avatar), el('span', 'name', player.name));
      if (sync && (player.account || signedInPreview)) {
        const cloud = el('span', 'cloud', '☁');
        cloud.setAttribute('aria-hidden', 'true');
        card.appendChild(cloud);
      }
      if (managing) {
        card.classList.add('removing');
        card.append(el('span', 'remove', 'Remove'));
        card.setAttribute('aria-label', `Remove ${player.name}`);
        card.addEventListener('click', () => {
          const question = player.account
            ? `Remove ${player.name} from every device and the account?`
            : `Remove ${player.name} and all their progress?`;
          if (confirm(question)) {
            store.removePlayer(player.id);
            draw();
          }
        });
      } else {
        card.addEventListener('click', () => {
          store.setCurrentPlayer(player.id);
          location.href = base;
        });
      }
      grid.appendChild(card);
    }
    const add = el('button', 'player-card add');
    add.type = 'button';
    add.append(el('span', 'avatar', '＋'), el('span', 'name', 'New player'));
    add.addEventListener('click', () => {
      form.hidden = false;
      form.querySelector('input')?.focus();
    });
    if (!managing) grid.appendChild(add);
  };

  // New player form
  const name = el('input');
  name.type = 'text';
  name.required = true;
  name.maxLength = MAX_NAME_LENGTH;
  name.placeholder = 'Your name';
  name.autocomplete = 'off';
  name.setAttribute('aria-label', 'Your name');
  const avatars = el('fieldset', 'avatars');
  avatars.appendChild(el('legend', undefined, 'Pick a buddy'));
  AVATARS.forEach((avatar, i) => {
    const label = el('label');
    const input = el('input');
    input.type = 'radio';
    input.name = 'avatar';
    input.value = avatar;
    input.checked = i === 0;
    label.append(input, el('span', undefined, avatar));
    avatars.appendChild(label);
  });
  const save = el('button', 'primary', "Let's go!");
  save.type = 'submit';
  form.append(el('h2', undefined, 'New player'), name, avatars, save);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!name.value.trim()) return;
    const avatar = (form.querySelector('input[name=avatar]:checked') as HTMLInputElement).value;
    const player = store.addPlayer(name.value, avatar);
    store.setCurrentPlayer(player.id);
    location.href = base;
  });

  const tools = el('div', 'tools');
  if (players.length > 0) {
    const manage = el('button', 'text-button', 'Remove a player');
    manage.type = 'button';
    manage.addEventListener('click', () => {
      managing = !managing;
      manage.textContent = managing ? 'Done' : 'Remove a player';
      draw();
    });
    tools.appendChild(manage);
  }

  draw();
  const back = current ? link(base, 'back-link', '← Back') : undefined;
  root.replaceChildren(
    header("Who's playing?", 'Tap your name to start', null, back),
    form,
    grid,
    tools,
    ...(sync ? [accountSection(root, dev, shown)] : []),
  );
  if (!form.hidden) name.focus();
}

// ---------- Picker ----------

/** Saves the choice, then goes back home; the picker's history entry is replaced. */
function pickChoice(player: Player, id: string): void {
  const progress = store.load(player.id);
  rememberChoice(progress, id);
  store.save(player.id, progress);
  location.replace(base);
}

/** An `<a>` to the choice's menu URL that also saves it and goes home when tapped. */
function choiceLink(player: Player, id: string, className: string, current: string) {
  const a = link(topicMenuUrl(id), className);
  if (id === current) {
    a.classList.add('current');
    a.setAttribute('aria-current', 'true');
  }
  a.addEventListener('click', (e) => {
    e.preventDefault();
    pickChoice(player, id);
  });
  return a;
}

function renderPicker(
  root: HTMLElement,
  player: Player,
  progress: PlayerProgress,
  path?: LevelPath,
): void {
  const current = currentChoice(progress);
  const sections = pickerSections();

  const chips = el('nav', 'jump-chips');
  chips.setAttribute('aria-label', 'Jump to');
  for (const section of sections) {
    const chip = el('button', 'jump-chip', section.subject);
    chip.type = 'button';
    chip.addEventListener('click', () =>
      document
        .getElementById(`pick-${section.anchor}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
    chips.appendChild(chip);
  }

  const main = el('main', 'picker');

  const recent = recentChoices(progress);
  if (recent.length > 0) {
    const section = el('section');
    section.appendChild(el('h2', 'subject', 'Recently played'));
    const row = el('div', 'recent-row');
    for (const id of recent) {
      const info = choiceInfo(progress, id);
      const chip = choiceLink(player, id, 'recent-chip', current);
      const emoji = info.kind === 'path' ? PATH_EMOJI[pathForLevelTopic(id)!.id] : '';
      chip.textContent = emoji ? `${emoji} ${info.short}` : info.short;
      row.appendChild(chip);
    }
    section.appendChild(row);
    main.appendChild(section);
  }

  const levels = el('section');
  levels.append(
    el('h2', 'subject', 'My Level'),
    el('p', 'hint', 'Games mix facts from your level. New facts open as you learn.'),
  );
  const pathGrid = el('div', 'pick-grid paths');
  for (const p of PATHS) {
    const info = pathChoiceInfo(progress, p);
    const row = choiceLink(player, p.levelTopicId, 'pick-row path-row', current);
    row.append(
      el('span', 'path-emoji', PATH_EMOJI[p.id]),
      el('h3', undefined, p.title),
      el('p', undefined, info.subtitle),
      masteryBar(info.mastered, info.total),
    );
    pathGrid.appendChild(row);
  }
  levels.appendChild(pathGrid);
  main.appendChild(levels);

  const topics = el('section');
  topics.append(el('h2', 'subject', 'One topic'), el('p', 'hint', 'Practice just this one.'));
  for (const section of sections) {
    const sec = el('section', 'pick-section');
    sec.id = `pick-${section.anchor}`;
    sec.appendChild(el('h3', 'pick-subject', section.subject));
    if (section.tiles) {
      sec.appendChild(el('p', 'tile-label', section.tiles.label));
      const tiles = el('div', 'tiles');
      for (const { n, topic } of section.tiles.tiles) {
        const info = choiceInfo(progress, topic.id);
        const tile = choiceLink(player, topic.id, 'tile', current);
        tile.setAttribute(
          'aria-label',
          `${topic.title}, ${info.mastered} of ${info.total} learned`,
        );
        const done = info.total > 0 && info.mastered >= info.total;
        tile.append(el('span', 'tile-n', String(n)));
        if (done) tile.appendChild(el('span', 'tile-done', '✓'));
        const bar = el('span', 'tile-bar');
        const fill = el('span', 'tile-fill');
        fill.style.width = `${info.total ? (info.mastered / info.total) * 100 : 0}%`;
        bar.appendChild(fill);
        tile.appendChild(bar);
        tiles.appendChild(tile);
      }
      sec.appendChild(tiles);
    }
    if (section.rows.length > 0) {
      const grid = el('div', 'pick-grid');
      for (const topic of section.rows) {
        const info = choiceInfo(progress, topic.id);
        const row = choiceLink(player, topic.id, 'pick-row', current);
        row.append(
          el('h3', undefined, topic.title),
          el('p', undefined, topic.description),
          masteryBar(info.mastered, info.total),
        );
        grid.appendChild(row);
      }
      sec.appendChild(grid);
    }
    topics.appendChild(sec);
  }
  main.appendChild(topics);

  root.replaceChildren(
    header('What do you want to practice?', null, player, link(base, 'back-link', '← Back')),
    chips,
    main,
  );

  // Open on the chosen path's first subject, or else on the current choice.
  if (path) {
    const first = pickerSections(path.topics)[0];
    document.getElementById(`pick-${first?.anchor}`)?.scrollIntoView({ block: 'start' });
  } else if (!pathForLevelTopic(current)) {
    root.querySelector('.pick-row.current, .tile.current')?.scrollIntoView({ block: 'center' });
  }
}

// ---------- Games ----------

function gameCard(
  game: GameEntry,
  stars: number | undefined,
  highScore: number | undefined,
): HTMLAnchorElement {
  const card = link(game.href, 'card');
  const thumb = el('div', 'thumb');
  if (game.thumbnailUrl) {
    const img = el('img');
    img.src = game.thumbnailUrl;
    img.alt = '';
    img.loading = 'lazy';
    thumb.appendChild(img);
  } else {
    thumb.textContent = game.title.charAt(0).toUpperCase();
    thumb.setAttribute('aria-hidden', 'true');
  }
  const body = el('div', 'body');
  body.append(el('h3', undefined, game.title), el('p', undefined, game.description));
  if (game.scoring === 'score') {
    // Games scored in points show their high score, once there is one, instead of stars.
    if (highScore !== undefined) {
      body.appendChild(el('p', 'best score', `High score: ${highScore.toLocaleString()}`));
    }
  } else if (stars !== undefined) {
    const best = el('p', 'best', `Best: ${starsText(stars)}`);
    best.setAttribute('aria-label', `Best: ${stars} of 3 stars`);
    body.appendChild(best);
  }
  card.append(thumb, body);
  return card;
}

// ---------- Home ----------

function renderHome(
  root: HTMLElement,
  player: Player,
  progress: PlayerProgress,
  choiceId: string,
): void {
  const info = choiceInfo(progress, choiceId);
  const games = discoverGames();

  const grid = el('main', 'grid');
  for (const game of games) {
    const card = gameCard(
      game,
      progress.best[choiceId]?.[game.id],
      progress.highScores[choiceId]?.[game.id],
    );
    card.href = gameUrl(game.href, choiceId);
    grid.appendChild(card);
  }
  if (games.length === 0) grid.appendChild(el('p', undefined, 'No games yet.'));

  const card = link(topicsUrl(), 'choice-card');
  card.setAttribute('aria-label', `Practicing ${info.title}. Change`);
  const top = el('div', 'choice-top');
  top.append(el('h1', undefined, info.title), el('span', 'change-pill', 'Change ▸'));
  card.append(
    el('span', 'choice-label', 'PRACTICING'),
    top,
    el('p', 'choice-sub', info.subtitle),
    masteryBar(info.mastered, info.total),
  );

  root.replaceChildren(header(null, null, player), card, el('h2', 'subject', 'Pick a game'), grid);
}

function render(root: HTMLElement): void {
  const params = new URLSearchParams(location.search);
  const back = `${base}?players`;
  // Links from mail: confirm the email, or choose a new password.
  const mailed = syncEnabled() ? linkAction(location.search) : null;
  if (mailed) {
    renderLinkPage(root, mailed, back);
    return;
  }
  const dev = syncEnabled() ? devSyncState() : null;
  if (dev === 'verify' || dev === 'reset') {
    renderLinkPage(root, { kind: dev, token: 'dev' }, back, true);
    return;
  }
  const player = store.currentPlayer();
  if (!player || params.has('players')) {
    renderPlayers(root);
    return;
  }
  const progress = store.load(player.id);
  // `?path=` is an old link to a path; `?topic=` is where "Other games" and the picker land.
  const wanted = getPath(params.get('path'))?.levelTopicId ?? params.get('topic');
  if (isChoice(wanted)) {
    rememberChoice(progress, wanted);
    store.save(player.id, progress);
    history.replaceState(null, '', base);
    renderHome(root, player, progress, wanted);
  } else if (params.has('topics')) {
    renderPicker(root, player, progress, getPath(params.get('topics')));
  } else {
    renderHome(root, player, progress, currentChoice(progress));
  }
}

/** Pulls from the account when signed in, and redraws if something changed. Never blocks drawing. */
function pullAccount(root: HTMLElement): void {
  if (!syncUrl() || !getAccount()) return;
  setSyncStatus(root, 'syncing');
  void syncNow().then((changed) => {
    syncStatus = syncFailed() ? 'offline' : 'synced';
    if (changed) render(root);
    else setSyncStatus(root, syncStatus);
  });
}

const root = document.getElementById('app');
if (root) {
  render(root);
  pullAccount(root);
  // Coming back from a game via the browser's back button can restore a stale page.
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    render(root);
    pullAccount(root);
  });
}
