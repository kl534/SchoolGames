/**
 * Painted canvas textures for the places: material grain (wood, fabric, foliage, metal, stone),
 * floor and wall patterns, outdoor backdrops and soft gradients. Everything is drawn greyscale or
 * lightly tinted so the material colour multiplies it, and every painter tiles seamlessly
 * (shapes near an edge are drawn again on the other side). Pure canvas code: no three.js.
 */
import type { BackdropKind, FloorPattern, WallPattern } from './places';

export type Ctx = CanvasRenderingContext2D;
export type GrainKind = 'wood' | 'fabric' | 'foliage' | 'metal' | 'stone';
/** A small repeatable random generator (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const grey = (v: number, a = 1) => {
  const c = Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `rgba(${c},${c},${c},${a})`;
};
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Runs `draw` at the nine wrapped offsets, so what crosses an edge appears on the other side. */
function tiled(g: Ctx, size: number, draw: () => void, w = size, h = size) {
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      g.save();
      g.translate(ox * w, oy * h);
      draw();
      g.restore();
    }
  }
}

function fill(g: Ctx, w: number, h: number, v: number) {
  g.fillStyle = grey(v);
  g.fillRect(0, 0, w, h);
}

function speckle(
  g: Ctx,
  w: number,
  h: number,
  n: number,
  rand: () => number,
  lo: number,
  hi: number,
) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = grey(lo + rand() * (hi - lo), 0.5);
    const s = 1 + rand() * 1.6;
    g.fillRect(rand() * w, rand() * h, s, s);
  }
}

// ---------------------------------------------------------------------------------------------
// Material grain (256 x 256)
// ---------------------------------------------------------------------------------------------

export const GRAIN_SIZE = 256;

export function paintGrain(g: Ctx, kind: GrainKind): void {
  const S = GRAIN_SIZE;
  const rand = rng(kind.length * 977 + kind.charCodeAt(0));
  switch (kind) {
    case 'wood': {
      fill(g, S, S, 0.93);
      // Wavy grain lines; the wave period divides the tile so the ends meet.
      for (let i = 0; i < 22; i++) {
        const y0 = (i / 22) * S + rand() * 4;
        const amp = 2 + rand() * 4;
        const k = 1 + Math.floor(rand() * 2);
        const ph = rand() * 6.28;
        g.strokeStyle = grey(0.62 + rand() * 0.22, 0.55);
        g.lineWidth = 1 + rand() * 1.6;
        g.beginPath();
        for (let x = 0; x <= S; x += 4) {
          const y = y0 + Math.sin((x / S) * Math.PI * 2 * k + ph) * amp;
          if (x === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      }
      // Two knots with rings.
      for (const [kx, ky] of [
        [70, 90],
        [190, 200],
      ]) {
        for (let r = 14; r > 2; r -= 3) {
          g.strokeStyle = grey(0.45 + (14 - r) * 0.012, 0.7);
          g.lineWidth = 1.4;
          g.beginPath();
          g.ellipse(kx, ky, r * 1.7, r * 0.8, 0, 0, Math.PI * 2);
          g.stroke();
        }
      }
      break;
    }
    case 'fabric': {
      fill(g, S, S, 0.92);
      for (let i = 0; i < S; i += 4) {
        g.fillStyle = grey(0.78, 0.5);
        g.fillRect(i, 0, 1.5, S);
        g.fillStyle = grey(0.84, 0.5);
        g.fillRect(0, i, S, 1.5);
      }
      speckle(g, S, S, 2600, rand, 0.7, 1);
      break;
    }
    case 'foliage': {
      fill(g, S, S, 0.62);
      for (let i = 0; i < 90; i++) {
        const x = rand() * S;
        const y = rand() * S;
        const r = 10 + rand() * 14;
        tiled(g, S, () => {
          const f = g.createRadialGradient(x, y - r * 0.4, 1, x, y, r);
          f.addColorStop(0, grey(0.98));
          f.addColorStop(0.7, grey(0.74));
          f.addColorStop(1, grey(0.48));
          g.fillStyle = f;
          g.beginPath();
          g.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2);
          g.fill();
        });
      }
      break;
    }
    case 'metal': {
      fill(g, S, S, 0.86);
      for (let i = 0; i < 160; i++) {
        const y = rand() * S;
        const x = rand() * S;
        const len = 40 + rand() * 160;
        g.fillStyle = grey(rand() < 0.5 ? 1 : 0.55, 0.12 + rand() * 0.16);
        tiled(g, S, () => g.fillRect(x, y, len, 1 + rand() * 1.5));
      }
      break;
    }
    case 'stone': {
      fill(g, S, S, 0.86);
      for (let i = 0; i < 46; i++) {
        const x = rand() * S;
        const y = rand() * S;
        const r = 14 + rand() * 30;
        const dark = rand() < 0.6;
        tiled(g, S, () => {
          const f = g.createRadialGradient(x, y, 1, x, y, r);
          f.addColorStop(0, grey(dark ? 0.55 : 1, 0.32));
          f.addColorStop(1, grey(dark ? 0.55 : 1, 0));
          g.fillStyle = f;
          g.fillRect(x - r, y - r, r * 2, r * 2);
        });
      }
      speckle(g, S, S, 1800, rand, 0.4, 1);
      break;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Floors (512 x 512, one tile of the texture is 3 x 3 units)
// ---------------------------------------------------------------------------------------------

export const FLOOR_SIZE = 512;
export const FLOOR_UNITS = 3;

export function paintFloor(g: Ctx, pattern: FloorPattern): void {
  const S = FLOOR_SIZE;
  const rand = rng(pattern.length * 131 + pattern.charCodeAt(0) * 7);
  switch (pattern) {
    case 'tiles': {
      // Tiles of 1.5 units (2 x 2), a slightly different tone each, with grout.
      const n = 2;
      const t = S / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          g.fillStyle = grey(0.9 + rand() * 0.1);
          g.fillRect(i * t, j * t, t, t);
          const f = g.createLinearGradient(i * t, j * t, i * t + t, j * t + t);
          f.addColorStop(0, grey(1, 0.18));
          f.addColorStop(1, grey(0.5, 0.1));
          g.fillStyle = f;
          g.fillRect(i * t, j * t, t, t);
        }
      }
      g.fillStyle = grey(0.62);
      for (let i = 0; i < n; i++) {
        g.fillRect(i * t - 3, 0, 6, S);
        g.fillRect(0, i * t - 3, S, 6);
      }
      g.fillRect(S - 3, 0, 3, S);
      g.fillRect(0, S - 3, S, 3);
      speckle(g, S, S, 900, rand, 0.7, 1);
      break;
    }
    case 'planks': {
      // Six boards across the tile (0.5 units each), joints staggered, grain along them.
      fill(g, S, S, 0.93);
      const rows = 6;
      const h = S / rows;
      for (let r = 0; r < rows; r++) {
        const y = r * h;
        g.fillStyle = grey(0.86 + rand() * 0.14);
        g.fillRect(0, y, S, h);
        for (let i = 0; i < 7; i++) {
          const gy = y + 4 + rand() * (h - 8);
          const k = 1 + Math.floor(rand() * 2);
          const ph = rand() * 6.28;
          g.strokeStyle = grey(0.6 + rand() * 0.2, 0.45);
          g.lineWidth = 1 + rand();
          g.beginPath();
          for (let x = 0; x <= S; x += 8) {
            const yy = gy + Math.sin((x / S) * Math.PI * 2 * k + ph) * 2;
            if (x === 0) g.moveTo(x, yy);
            else g.lineTo(x, yy);
          }
          g.stroke();
        }
        g.fillStyle = grey(0.45, 0.9);
        g.fillRect(0, y, S, 3);
        const jx = ((r * 0.37) % 1) * S;
        g.fillRect(jx, y, 3, h);
      }
      break;
    }
    case 'carpet': {
      fill(g, S, S, 0.9);
      for (let i = 0; i < 9000; i++) {
        g.fillStyle = grey(0.62 + rand() * 0.38, 0.55);
        g.fillRect(rand() * S, rand() * S, 2, 2);
      }
      break;
    }
    case 'grass': {
      fill(g, S, S, 0.82);
      for (let i = 0; i < 26; i++) {
        const x = rand() * S;
        const y = rand() * S;
        const r = 30 + rand() * 40;
        tiled(g, S, () => {
          const f = g.createRadialGradient(x, y, 1, x, y, r);
          f.addColorStop(0, grey(rand() < 0.5 ? 1 : 0.6, 0.22));
          f.addColorStop(1, grey(0.8, 0));
          g.fillStyle = f;
          g.fillRect(x - r, y - r, r * 2, r * 2);
        });
      }
      for (let i = 0; i < 1500; i++) {
        const x = rand() * S;
        const y = rand() * S;
        const len = 8 + rand() * 10;
        const a = -Math.PI / 2 + (rand() - 0.5) * 0.9;
        g.strokeStyle = grey(0.55 + rand() * 0.45, 0.5);
        g.lineWidth = 1.5;
        tiled(g, S, () => {
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
          g.stroke();
        });
      }
      break;
    }
    case 'pavement': {
      // Slabs of 1.5 x 1.5 units with cracks and stains.
      fill(g, S, S, 0.9);
      const t = S / 2;
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          g.fillStyle = grey(0.86 + rand() * 0.12);
          g.fillRect(i * t, j * t, t, t);
        }
      }
      for (let i = 0; i < 18; i++) {
        const x = rand() * S;
        const y = rand() * S;
        const r = 20 + rand() * 40;
        tiled(g, S, () => {
          const f = g.createRadialGradient(x, y, 1, x, y, r);
          f.addColorStop(0, grey(0.5, 0.18));
          f.addColorStop(1, grey(0.5, 0));
          g.fillStyle = f;
          g.fillRect(x - r, y - r, r * 2, r * 2);
        });
      }
      g.fillStyle = grey(0.5);
      for (let i = 0; i < 2; i++) {
        g.fillRect(i * t - 2.5, 0, 5, S);
        g.fillRect(0, i * t - 2.5, S, 5);
      }
      g.fillRect(S - 2.5, 0, 2.5, S);
      g.fillRect(0, S - 2.5, S, 2.5);
      g.strokeStyle = grey(0.4, 0.8);
      g.lineWidth = 1.4;
      for (let c = 0; c < 4; c++) {
        let x = 40 + rand() * (S - 80);
        let y = 40 + rand() * (S - 80);
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          x += (rand() - 0.5) * 26;
          y += (rand() - 0.3) * 20;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      break;
    }
    case 'roof': {
      // Rows of shingles (0.5 units tall) with scalloped bottoms, staggered.
      fill(g, S, S, 0.8);
      const rows = 6;
      const h = S / rows;
      const w = S / 4;
      for (let r = 0; r < rows; r++) {
        const off = r % 2 ? w / 2 : 0;
        for (let i = -1; i < 5; i++) {
          const x = i * w + off;
          g.fillStyle = grey(0.78 + rand() * 0.22);
          g.beginPath();
          g.moveTo(x, r * h);
          g.lineTo(x + w, r * h);
          g.lineTo(x + w, r * h + h * 0.78);
          g.quadraticCurveTo(x + w / 2, r * h + h * 1.05, x, r * h + h * 0.78);
          g.closePath();
          g.fill();
          g.strokeStyle = grey(0.4, 0.8);
          g.lineWidth = 2.5;
          g.stroke();
        }
      }
      speckle(g, S, S, 1400, rand, 0.4, 0.9);
      break;
    }
    case 'sand': {
      fill(g, S, S, 0.93);
      for (let i = 0; i < 7; i++) {
        const y0 = (i / 7) * S + rand() * 8;
        const ph = rand() * 6.28;
        g.strokeStyle = grey(0.72, 0.45);
        g.lineWidth = 2.5;
        g.beginPath();
        for (let x = 0; x <= S; x += 6) {
          const y = y0 + Math.sin((x / S) * Math.PI * 4 + ph) * 5;
          if (x === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
        g.strokeStyle = grey(1, 0.5);
        g.lineWidth = 1.5;
        g.beginPath();
        for (let x = 0; x <= S; x += 6) {
          const y = y0 + 5 + Math.sin((x / S) * Math.PI * 4 + ph) * 5;
          if (x === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      }
      speckle(g, S, S, 4500, rand, 0.55, 1);
      break;
    }
    case 'snow': {
      fill(g, S, S, 0.96);
      for (let i = 0; i < 22; i++) {
        const x = rand() * S;
        const y = rand() * S;
        const r = 30 + rand() * 50;
        tiled(g, S, () => {
          const f = g.createRadialGradient(x, y, 1, x, y, r);
          f.addColorStop(0, 'rgba(150,170,205,0.13)');
          f.addColorStop(1, 'rgba(150,170,205,0)');
          g.fillStyle = f;
          g.fillRect(x - r, y - r, r * 2, r * 2);
        });
      }
      for (let i = 0; i < 2600; i++) {
        g.fillStyle = rand() < 0.5 ? 'rgba(150,170,205,0.5)' : 'rgba(255,255,255,0.8)';
        g.fillRect(rand() * S, rand() * S, 2, 2);
      }
      break;
    }
    case 'metal': {
      // Plates of 1.5 x 1.5 units with seams, rivets and light scratches.
      const t = S / 2;
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          const f = g.createLinearGradient(i * t, j * t, i * t + t, j * t + t);
          f.addColorStop(0, grey(0.98));
          f.addColorStop(1, grey(0.8));
          g.fillStyle = f;
          g.fillRect(i * t, j * t, t, t);
        }
      }
      for (let i = 0; i < 90; i++) {
        g.fillStyle = grey(rand() < 0.5 ? 1 : 0.5, 0.12);
        tiled(g, S, () => g.fillRect(rand() * S, rand() * S, 30 + rand() * 90, 1.2));
      }
      g.fillStyle = grey(0.35);
      for (let i = 0; i < 2; i++) {
        g.fillRect(i * t - 2.5, 0, 5, S);
        g.fillRect(0, i * t - 2.5, S, 5);
      }
      g.fillRect(S - 2.5, 0, 2.5, S);
      g.fillRect(0, S - 2.5, S, 2.5);
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          for (const [dx, dy] of [
            [16, 16],
            [t - 16, 16],
            [16, t - 16],
            [t - 16, t - 16],
          ]) {
            const x = i * t + dx;
            const y = j * t + dy;
            g.fillStyle = grey(0.45);
            g.beginPath();
            g.arc(x + 1, y + 1, 5, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = grey(0.95);
            g.beginPath();
            g.arc(x, y, 4.5, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Walls (512 x 512, one tile of the texture is 3 x 3 units)
// ---------------------------------------------------------------------------------------------

export const WALL_SIZE = 512;
export const WALL_UNITS = 3;

export function paintWall(g: Ctx, pattern: WallPattern): void {
  const S = WALL_SIZE;
  const rand = rng(pattern.length * 53 + 5);
  fill(g, S, S, 0.97);
  switch (pattern) {
    case 'stripes': {
      // Six vertical bands in the tile (0.5 units each), alternate ones darker.
      for (let i = 0; i < 6; i += 2) {
        g.fillStyle = grey(0.86);
        g.fillRect((i * S) / 6, 0, S / 6, S);
      }
      g.fillStyle = grey(0.78, 0.6);
      for (let i = 0; i < 6; i++) g.fillRect((i * S) / 6, 0, 2, S);
      break;
    }
    case 'dots': {
      g.fillStyle = grey(0.82);
      const n = 4;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const x = ((i + (j % 2 ? 0.75 : 0.25)) * S) / n;
          const y = ((j + 0.5) * S) / n;
          g.beginPath();
          g.arc(x, y, 12, 0, Math.PI * 2);
          g.fill();
        }
      }
      break;
    }
    case 'tiles': {
      const n = 2;
      const t = S / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          g.fillStyle = grey(0.93 + rand() * 0.07);
          g.fillRect(i * t, j * t, t, t);
          const f = g.createLinearGradient(i * t, j * t, i * t + t, j * t + t);
          f.addColorStop(0, grey(1, 0.3));
          f.addColorStop(0.5, grey(1, 0));
          f.addColorStop(1, grey(0.5, 0.12));
          g.fillStyle = f;
          g.fillRect(i * t, j * t, t, t);
        }
      }
      g.fillStyle = grey(0.7);
      for (let i = 0; i < n; i++) {
        g.fillRect(i * t - 2.5, 0, 5, S);
        g.fillRect(0, i * t - 2.5, S, 5);
      }
      g.fillRect(S - 2.5, 0, 2.5, S);
      g.fillRect(0, S - 2.5, S, 2.5);
      break;
    }
    case 'panels': {
      // Panels of 1.5 x 3 units with a bevelled frame and four bolts.
      const w = S / 2;
      for (let i = 0; i < 2; i++) {
        g.fillStyle = grey(0.86);
        g.fillRect(i * w + 8, 8, w - 16, S - 16);
        g.fillStyle = grey(1, 0.5);
        g.fillRect(i * w + 8, 8, w - 16, 4);
        g.fillStyle = grey(0.6, 0.5);
        g.fillRect(i * w + 8, S - 12, w - 16, 4);
        for (const [dx, dy] of [
          [22, 22],
          [w - 22, 22],
          [22, S - 22],
          [w - 22, S - 22],
        ]) {
          g.fillStyle = grey(0.55);
          g.beginPath();
          g.arc(i * w + dx, dy, 4, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.fillStyle = grey(0.62);
      for (let i = 0; i < 2; i++) g.fillRect(i * w - 3, 0, 6, S);
      g.fillRect(S - 3, 0, 3, S);
      break;
    }
    case 'wainscot': {
      // Plain plaster with a faint trowel texture (the dado panel is a separate prop).
      for (let i = 0; i < 24; i++) {
        const x = rand() * S;
        const y = rand() * S;
        const r = 40 + rand() * 60;
        tiled(g, S, () => {
          const f = g.createRadialGradient(x, y, 1, x, y, r);
          f.addColorStop(0, grey(rand() < 0.5 ? 0.88 : 1, 0.25));
          f.addColorStop(1, grey(1, 0));
          g.fillStyle = f;
          g.fillRect(x - r, y - r, r * 2, r * 2);
        });
      }
      speckle(g, S, S, 1500, rand, 0.8, 1);
      break;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Backdrops (1024 x 256 silhouettes that tile sideways)
// ---------------------------------------------------------------------------------------------

export const BACKDROP_W = 1024;
export const BACKDROP_H = 256;

/** A closed polygon along the bottom whose heights repeat at the edge. */
function ridge(g: Ctx, color: string, height: (x: number) => number) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, BACKDROP_H);
  for (let x = 0; x <= BACKDROP_W; x += 4) g.lineTo(x, BACKDROP_H - height(x));
  g.lineTo(BACKDROP_W, BACKDROP_H);
  g.closePath();
  g.fill();
}

const TAU = Math.PI * 2;
/** Smooth periodic wave over the strip with a whole number of cycles. */
const wave = (x: number, cycles: number, ph: number) =>
  Math.sin((x / BACKDROP_W) * TAU * cycles + ph);

export function paintBackdrop(g: Ctx, kind: BackdropKind, color: number): void {
  const W = BACKDROP_W;
  const H = BACKDROP_H;
  const c = hex(color);
  const rand = rng(kind.length * 311 + (color & 0xffff));
  g.clearRect(0, 0, W, H);
  switch (kind) {
    case 'hills':
    case 'mesas':
    case 'dunes':
    case 'mountains': {
      if (kind === 'hills') {
        ridge(g, c, (x) => 70 + wave(x, 3, 0.4) * 34 + wave(x, 7, 1.7) * 14);
      } else if (kind === 'dunes') {
        ridge(g, c, (x) => 44 + wave(x, 3, 1) * 26 + wave(x, 6, 0.2) * 9);
      } else if (kind === 'mountains') {
        const high = (x: number) => 100 + Math.abs(wave(x, 4, 0.3)) * 90 + wave(x, 11, 2) * 10;
        ridge(g, c, high);
        // Snow caps on the highest parts.
        g.fillStyle = 'rgba(255,255,255,0.75)';
        for (let x = 0; x < W; x += 4) {
          const h = high(x);
          if (h > 150) g.fillRect(x, H - h, 4, Math.min(26, (h - 150) * 0.9 + 6));
        }
      } else {
        // Flat-topped mesas.
        g.fillStyle = c;
        const spots = [60, 250, 470, 700, 880];
        spots.forEach((x, i) => {
          const w = 120 + (i % 3) * 40;
          const h = 90 + ((i * 37) % 50);
          tiled(
            g,
            W,
            () => {
              g.beginPath();
              g.moveTo(x - w / 2 - 22, H);
              g.lineTo(x - w / 2, H - h);
              g.lineTo(x + w / 2, H - h);
              g.lineTo(x + w / 2 + 22, H);
              g.closePath();
              g.fill();
            },
            W,
            0,
          );
        });
        ridge(g, c, (x) => 26 + wave(x, 5, 0.6) * 8);
      }
      break;
    }
    case 'treeline':
    case 'pines':
    case 'canopy': {
      ridge(g, c, () => 18);
      const n = kind === 'canopy' ? 26 : kind === 'pines' ? 34 : 30;
      for (let i = 0; i < n; i++) {
        const x = (i / n) * W + rand() * 8;
        const h = 60 + rand() * 50;
        const r = 18 + rand() * 12;
        tiled(
          g,
          W,
          () => {
            g.fillStyle = c;
            g.beginPath();
            if (kind === 'pines') {
              g.moveTo(x, H - 18 - h);
              g.lineTo(x + r, H - 14);
              g.lineTo(x - r, H - 14);
            } else if (kind === 'canopy') {
              g.ellipse(x, H - 18 - h * 0.7, r * 1.7, h * 0.55, 0, 0, TAU);
            } else {
              g.rect(x - 3, H - 18 - h * 0.5, 6, h * 0.5);
              g.moveTo(x + r, H - 18 - h * 0.6);
              g.ellipse(x, H - 18 - h * 0.65, r, r * 1.2, 0, 0, TAU);
            }
            g.fill();
          },
          W,
          0,
        );
      }
      break;
    }
    case 'skyline':
    case 'cranes': {
      g.fillStyle = c;
      if (kind === 'skyline') {
        let x = 0;
        while (x < W) {
          const w = 40 + Math.floor(rand() * 50);
          const h = 60 + Math.floor(rand() * 150);
          const width = x + w > W ? W - x : w;
          g.fillRect(x, H - h, width, h);
          if (rand() < 0.35) g.fillRect(x + width / 2 - 2, H - h - 22, 4, 22);
          x += w + Math.floor(rand() * 8);
        }
        // Lit windows.
        g.fillStyle = 'rgba(255,240,190,0.28)';
        for (let i = 0; i < 90; i++) {
          g.fillRect(rand() * W, H - 20 - rand() * 120, 5, 7);
        }
      } else {
        ridge(g, c, () => 14);
        // Cranes: a mast, a jib and a hook line, plus a few boxy blocks.
        for (let i = 0; i < 3; i++) {
          const x = 100 + i * 340 + rand() * 30;
          const h = 150 + rand() * 60;
          g.strokeStyle = c;
          g.lineWidth = 6;
          g.beginPath();
          g.moveTo(x, H);
          g.lineTo(x, H - h);
          g.stroke();
          g.lineWidth = 5;
          g.beginPath();
          g.moveTo(x - 40, H - h + 8);
          g.lineTo(x + 100, H - h + 8);
          g.stroke();
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(x + 84, H - h + 8);
          g.lineTo(x + 84, H - h + 52);
          g.stroke();
          g.fillRect(x - 12, H - h - 6, 24, 14);
        }
        for (let i = 0; i < 5; i++) g.fillRect(i * 210 + rand() * 40, H - 60 - rand() * 40, 70, 80);
      }
      break;
    }
    case 'sea':
    case 'island': {
      if (kind === 'sea') {
        g.fillStyle = c;
        g.fillRect(0, H - 34, W, 34);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        for (let i = 0; i < 40; i++)
          g.fillRect(rand() * W, H - 4 - rand() * 28, 20 + rand() * 30, 2);
      } else {
        ridge(g, c, (x) => 26 + Math.max(0, wave(x, 2, 0.5)) * 55);
        // A couple of palms on the island.
        g.strokeStyle = c;
        for (const px of [W * 0.16, W * 0.66]) {
          g.lineWidth = 4;
          g.beginPath();
          g.moveTo(px, H - 60);
          g.lineTo(px + 6, H - 110);
          g.stroke();
          for (let k = -2; k <= 2; k++) {
            g.lineWidth = 3;
            g.beginPath();
            g.moveTo(px + 6, H - 110);
            g.quadraticCurveTo(px + 6 + k * 14, H - 128, px + 6 + k * 26, H - 104);
            g.stroke();
          }
        }
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Gradients
// ---------------------------------------------------------------------------------------------

/** A vertical black-to-white ramp used as an alpha map: white (opaque) at the bottom or the top. */
export function paintFade(g: Ctx, size: number, opaqueAtBottom: boolean): void {
  const f = g.createLinearGradient(0, 0, 0, size);
  f.addColorStop(0, opaqueAtBottom ? '#000' : '#fff');
  f.addColorStop(1, opaqueAtBottom ? '#fff' : '#000');
  g.fillStyle = f;
  g.fillRect(0, 0, 4, size);
}
