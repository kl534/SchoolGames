/** The cat picker shown before every run: ten cards and a Go button. */
import { CAT_IDS, CAT_LOOKS, catFaceSvg, type CatId } from './looks';

export interface CatPicker {
  dispose(): void;
}

export function showCatPicker(options: {
  /** The cat that starts selected (the last one chosen). */
  current: CatId;
  onGo: (cat: CatId) => void;
}): CatPicker {
  const root = document.createElement('div');
  root.className = 'cd-picker';
  const title = document.createElement('h1');
  title.className = 'cd-picker-title';
  title.textContent = 'Pick your cat';
  root.appendChild(title);
  const cards = document.createElement('div');
  cards.className = 'cd-cards';
  cards.setAttribute('role', 'radiogroup');
  cards.setAttribute('aria-label', 'Pick your cat');
  root.appendChild(cards);

  let selected: CatId = options.current;
  const buttons = new Map<CatId, HTMLButtonElement>();
  const paint = () => {
    for (const [id, button] of buttons) {
      button.classList.toggle('selected', id === selected);
      button.setAttribute('aria-checked', String(id === selected));
    }
  };
  for (const id of CAT_IDS) {
    const look = CAT_LOOKS[id];
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'cd-card';
    card.setAttribute('role', 'radio');
    const face = document.createElement('span');
    face.className = 'cd-card-face';
    face.innerHTML = catFaceSvg(look);
    const name = document.createElement('span');
    name.textContent = look.name;
    card.append(face, name);
    card.addEventListener('click', () => {
      selected = id;
      paint();
    });
    buttons.set(id, card);
    cards.appendChild(card);
  }
  const go = document.createElement('button');
  go.type = 'button';
  go.className = 'cd-go';
  go.textContent = 'Go!';
  go.addEventListener('click', () => {
    root.remove();
    options.onGo(selected);
  });
  root.appendChild(go);
  paint();
  document.body.appendChild(root);
  return { dispose: () => root.remove() };
}
