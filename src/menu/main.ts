import './style.css';
import { discoverGames, type GameEntry } from './games';

function createCard(game: GameEntry): HTMLAnchorElement {
  const card = document.createElement('a');
  card.className = 'card';
  card.href = game.href;

  const thumb = document.createElement('div');
  thumb.className = 'thumb';
  if (game.thumbnailUrl) {
    const img = document.createElement('img');
    img.src = game.thumbnailUrl;
    img.alt = '';
    img.loading = 'lazy';
    thumb.appendChild(img);
  } else {
    thumb.textContent = game.title.charAt(0).toUpperCase();
    thumb.setAttribute('aria-hidden', 'true');
  }

  const body = document.createElement('div');
  body.className = 'body';
  const title = document.createElement('h2');
  title.textContent = game.title;
  const description = document.createElement('p');
  description.textContent = game.description;
  body.append(title, description);

  if (game.tags?.length) {
    const tags = document.createElement('ul');
    tags.className = 'tags';
    for (const tag of game.tags) {
      const li = document.createElement('li');
      li.textContent = tag;
      tags.appendChild(li);
    }
    body.appendChild(tags);
  }

  card.append(thumb, body);
  return card;
}

function render(root: HTMLElement): void {
  const header = document.createElement('header');
  const h1 = document.createElement('h1');
  h1.textContent = 'School Games';
  const sub = document.createElement('p');
  sub.textContent = 'Pick a game to play';
  header.append(h1, sub);

  const grid = document.createElement('main');
  grid.className = 'grid';
  const games = discoverGames();
  if (games.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No games yet.';
    grid.appendChild(empty);
  }
  games.forEach((game) => grid.appendChild(createCard(game)));

  root.replaceChildren(header, grid);
}

const root = document.getElementById('app');
if (root) render(root);
