import './style.css';
import { discoverGames, type GameEntry } from './games';
import {
  AVATARS,
  MAX_NAME_LENGTH,
  countMastered,
  createProgressStore,
  type Player,
  type PlayerProgress,
} from '../shared/progress';
import { gameUrl } from '../shared/session';
import { getTopic, groupBySubject, type Topic } from '../shared/topics';

const store = createProgressStore();
const base = import.meta.env.BASE_URL;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

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

function header(title: string, subtitle: string, player: Player | null, back?: HTMLElement) {
  const h = el('header');
  const top = el('div', 'header-top');
  if (back) top.appendChild(back);
  top.appendChild(el('span', 'spacer'));
  if (player) top.appendChild(playerChip(player));
  h.append(top, el('h1', undefined, title), el('p', undefined, subtitle));
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

// ---------- Player picker ----------

function renderPlayers(root: HTMLElement): void {
  const players = store.listPlayers();
  const current = store.currentPlayer();
  let managing = false;

  const grid = el('main', 'grid players');
  const form = el('form', 'new-player');
  form.hidden = players.length > 0;

  const draw = () => {
    grid.replaceChildren();
    for (const player of store.listPlayers()) {
      const card = el('button', 'player-card');
      card.type = 'button';
      if (player.id === current?.id) card.classList.add('current');
      card.append(el('span', 'avatar', player.avatar), el('span', 'name', player.name));
      if (managing) {
        card.classList.add('removing');
        card.append(el('span', 'remove', 'Remove'));
        card.setAttribute('aria-label', `Remove ${player.name}`);
        card.addEventListener('click', () => {
          if (confirm(`Remove ${player.name} and all their progress?`)) {
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
  const back = current ? link(base, 'back-link', '← Topics') : undefined;
  root.replaceChildren(
    header("Who's playing?", 'Tap your name to start', null, back),
    form,
    grid,
    tools,
  );
  if (!form.hidden) name.focus();
}

// ---------- Topic list ----------

function renderTopics(root: HTMLElement, player: Player, progress: PlayerProgress): void {
  const main = el('main', 'subjects');
  for (const group of groupBySubject()) {
    const section = el('section');
    section.appendChild(el('h2', 'subject', group.subject));
    const grid = el('div', 'grid');
    for (const topic of group.topics) {
      const card = link(`${base}?${new URLSearchParams({ topic: topic.id })}`, 'card topic-card');
      const body = el('div', 'body');
      body.append(el('h3', undefined, topic.title), el('p', undefined, topic.description));
      const ids = topic.facts.map((f) => f.id);
      body.appendChild(masteryBar(countMastered(progress, topic.id, ids), ids.length));
      card.appendChild(body);
      grid.appendChild(card);
    }
    section.appendChild(grid);
    main.appendChild(section);
  }
  root.replaceChildren(header('School Games', 'What do you want to practise?', player), main);
}

// ---------- Games for one topic ----------

function gameCard(game: GameEntry, stars: number | undefined): HTMLAnchorElement {
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
  if (stars !== undefined) {
    const best = el('p', 'best', `Best: ${starsText(stars)}`);
    best.setAttribute('aria-label', `Best: ${stars} of 3 stars`);
    body.appendChild(best);
  }
  card.append(thumb, body);
  return card;
}

function renderTopic(
  root: HTMLElement,
  topic: Topic,
  player: Player,
  progress: PlayerProgress,
): void {
  const games = discoverGames();

  const grid = el('main', 'grid');
  const cards = games.map((game) => {
    const card = gameCard(game, progress.best[topic.id]?.[game.id]);
    grid.appendChild(card);
    return { game, card };
  });
  for (const { game, card } of cards) card.href = gameUrl(game.href, topic.id);
  if (games.length === 0) grid.appendChild(el('p', undefined, 'No games yet.'));

  const ids = topic.facts.map((f) => f.id);
  const intro = el('div', 'topic-intro');
  intro.append(masteryBar(countMastered(progress, topic.id, ids), ids.length));

  root.replaceChildren(
    header(topic.title, 'Pick a game', player, link(base, 'back-link', '← Topics')),
    intro,
    el('h2', 'subject', 'Games'),
    grid,
  );
}

function render(root: HTMLElement): void {
  const params = new URLSearchParams(location.search);
  const player = store.currentPlayer();
  if (!player || params.has('players')) {
    renderPlayers(root);
    return;
  }
  const progress = store.load(player.id);
  const topic = getTopic(params.get('topic'));
  if (topic) renderTopic(root, topic, player, progress);
  else renderTopics(root, player, progress);
}

const root = document.getElementById('app');
if (root) {
  render(root);
  // Coming back from a game via the browser's back button can restore a stale page.
  window.addEventListener('pageshow', (e) => e.persisted && render(root));
}
