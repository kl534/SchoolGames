import './pictures.css';
import type { TapCard } from '../tapmarks';
import { statementParts, type Fact } from '../topics';
import { clamp, type Pose, type Picture, type Sprite } from './plan';
import type { PicturePlayer } from './player';
import { FINALE } from './player';

export interface PictureCard extends TapCard {
  /** Draws the player's current state; call once per frame. */
  render(): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const INTRO_STAGGER = 0.03;
const INTRO_MAX_DELAY = 0.15;
const INTRO_TIME = 0.2;
const CONFETTI_COLORS = ['#ff7a59', '#ffd23f', '#5cf2b0', '#5cc8ff', '#c792ff'];
const CONFETTI_BITS = 16;
/** Padding of the card, both sides. */
const CARD_PAD = 24;
const MAX_SCALE = 1.3;

const svgEl = <K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] => {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
};

const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/** The drawing of one sprite, centred on (0, 0). */
function drawSprite(sprite: Sprite): SVGElement {
  switch (sprite.type) {
    case 'critter': {
      const node = svgEl('text', {
        'font-size': sprite.size,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
      });
      node.textContent = sprite.emoji;
      return node;
    }
    case 'text': {
      const node = svgEl('text', {
        'font-size': sprite.size,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        fill: sprite.color ?? '#fff',
        'font-weight': 700,
      });
      node.textContent = sprite.text;
      return node;
    }
    case 'line':
      return svgEl('line', {
        x1: 0,
        y1: 0,
        x2: sprite.dx,
        y2: sprite.dy,
        stroke: sprite.color ?? '#fff',
        'stroke-width': sprite.width,
        'stroke-linecap': 'round',
        ...(sprite.dashed ? { 'stroke-dasharray': '5 5' } : {}),
      });
    case 'dot':
      return svgEl('circle', { r: sprite.r, fill: sprite.color });
    case 'ring':
      return svgEl('circle', {
        r: sprite.r,
        fill: 'none',
        stroke: sprite.color,
        'stroke-width': 3,
      });
    case 'rect':
      return svgEl('rect', {
        x: -sprite.w / 2,
        y: -sprite.h / 2,
        width: sprite.w,
        height: sprite.h,
        rx: sprite.radius ?? 0,
        fill: sprite.fill,
        ...(sprite.stroke ? { stroke: sprite.stroke, 'stroke-width': 1.5 } : {}),
      });
    case 'plate':
      return svgEl('ellipse', {
        rx: sprite.rx,
        ry: sprite.ry,
        fill: 'rgba(255,255,255,0.85)',
        stroke: 'rgba(255,255,255,0.4)',
        'stroke-width': 2,
      });
    case 'cross': {
      const r = sprite.size / 2;
      const g = svgEl('g', { stroke: '#ff4d4d', 'stroke-width': 5, 'stroke-linecap': 'round' });
      g.append(
        svgEl('line', { x1: -r, y1: -r, x2: r, y2: r }),
        svgEl('line', { x1: r, y1: -r, x2: -r, y2: r }),
      );
      return g;
    }
  }
}

/** The card above the green answer: the animated scene, the latest count and the equation. */
export function createPictureCard(
  picture: Picture,
  player: PicturePlayer,
  fact: Pick<Fact, 'prompt' | 'statement' | 'visual'>,
): PictureCard {
  const calm = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  const element = document.createElement('div');
  element.className = 'sg-pic-card';
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', fact.statement);

  const stage = svgEl('svg', { viewBox: `0 0 ${picture.width} ${picture.height}` });
  stage.setAttribute('class', 'sg-pic-stage');
  const groups = picture.sprites.map((sprite) => {
    const group = svgEl('g');
    group.appendChild(drawSprite(sprite));
    stage.appendChild(group);
    return group;
  });
  const confetti = svgEl('g');
  const bits = Array.from({ length: CONFETTI_BITS }, (_, i) => {
    const bit = svgEl('rect', {
      width: 7,
      height: 4,
      fill: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      opacity: 0,
    });
    confetti.appendChild(bit);
    return bit;
  });
  stage.appendChild(confetti);

  const count = document.createElement('div');
  count.className = 'sg-pic-count';
  count.hidden = true;
  const eq = document.createElement('div');
  eq.className = 'sg-pic-eq';
  eq.setAttribute('aria-hidden', 'true');
  element.append(stage, count, eq);

  const phase = picture.sprites.map((_, i) => ((i * 2.399) % 6.283) + 0.1);
  const lastTransform: string[] = [];
  const lastOpacity: string[] = [];
  let lastCount: number | null = null;
  let lastEq = '';
  let finaleAt = -1;

  const setEq = () => {
    const s = player.state;
    const final = s.phase === 'finale' || s.phase === 'done';
    const key = final ? `final:${fact.statement}` : (s.caption ?? fact.prompt);
    if (key === lastEq) return;
    lastEq = key;
    if (!final) {
      eq.textContent = s.caption ?? fact.prompt;
      return;
    }
    const parts = statementParts(fact);
    eq.textContent = '';
    if (!parts) {
      eq.textContent = fact.statement;
      return;
    }
    const answer = document.createElement('span');
    answer.className = 'sg-pic-answer';
    answer.textContent = parts.answer;
    eq.append(parts.before, answer, parts.after);
  };

  const place = (i: number, pose: Pose, t: number) => {
    const sprite = picture.sprites[i];
    const delay = Math.min(i * INTRO_STAGGER, INTRO_MAX_DELAY);
    const k = clamp((t - delay) / INTRO_TIME, 0, 1);
    const { x } = pose;
    let { y, scale, rotate, opacity } = pose;
    if (!calm) {
      scale *= k < 1 ? easeOutBack(k) : 1;
      opacity *= Math.min(1, k * 2);
      if (sprite.type === 'critter' && opacity > 0.05) {
        rotate += 6 * Math.sin(2 * Math.PI * 1.2 * t + phase[i]);
        y += 1.5 * Math.sin(2 * Math.PI * 1.2 * t + phase[i] * 2);
      }
    } else if (k < 1) opacity *= k;
    const transform = `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rotate.toFixed(2)}) scale(${Math.max(scale, 0).toFixed(3)})`;
    if (transform !== lastTransform[i]) {
      lastTransform[i] = transform;
      groups[i].setAttribute('transform', transform);
    }
    const o = opacity.toFixed(3);
    if (o !== lastOpacity[i]) {
      lastOpacity[i] = o;
      groups[i].setAttribute('opacity', o);
    }
  };

  const renderConfetti = () => {
    const s = player.state;
    if (s.phase === 'finale' && finaleAt < 0) finaleAt = s.t;
    const age = finaleAt < 0 ? -1 : s.t - finaleAt;
    const live = !calm && s.phase === 'finale' && age >= 0 && age < FINALE;
    bits.forEach((bit, i) => {
      if (!live) {
        if (bit.getAttribute('opacity') !== '0') bit.setAttribute('opacity', '0');
        return;
      }
      const angle = (i / CONFETTI_BITS) * Math.PI * 2 + 0.4;
      const speed = 70 + ((i * 37) % 60);
      const x = picture.width - 34 + Math.cos(angle) * speed * age;
      const y = 30 + Math.sin(angle) * speed * age - 40 * age + 260 * age * age;
      bit.setAttribute(
        'transform',
        `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(age * 540 + i * 40) % 360})`,
      );
      bit.setAttribute('opacity', String(clamp(1 - age / FINALE, 0, 1).toFixed(2)));
    });
  };

  const render = () => {
    const s = player.state;
    const poses = picture.at(s.done, s.p, calm);
    for (let i = 0; i < poses.length; i++) place(i, poses[i], s.t);
    if (s.count !== lastCount) {
      lastCount = s.count;
      count.hidden = s.count === null;
      count.textContent = s.count === null ? '' : String(s.count);
      count.classList.remove('sg-pic-pop');
      void count.offsetWidth;
      count.classList.add('sg-pic-pop');
    }
    setEq();
    renderConfetti();
  };

  render();

  return {
    element,
    render,
    fit(maxWidth, maxHeight) {
      const eqHeight = eq.offsetHeight || 28;
      const scale = clamp(
        Math.min(
          (maxWidth - CARD_PAD) / picture.width,
          (maxHeight - CARD_PAD - eqHeight) / picture.height,
          MAX_SCALE,
        ),
        0.2,
        MAX_SCALE,
      );
      const width = Math.round(picture.width * scale);
      stage.style.width = `${width}px`;
      stage.style.height = `${Math.round(picture.height * scale)}px`;
      element.style.width = `${Math.max(width + CARD_PAD, 150)}px`;
    },
  };
}
