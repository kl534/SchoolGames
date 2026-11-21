import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Fog,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type Scene,
} from 'three';
import { seededRandom, type Random } from '../../shared/random';
import type { StageId, StagePalette } from './rules';

/**
 * The far scenery of a stage (painted on canvases, hung on planes that follow the camera):
 * sky objects, clouds, mountains and skylines that scroll slower than the street because they are
 * far away, plus small moving things (petals, gulls, searchlights) and the fog that fades them.
 * Also the tiling ground textures of each stage.
 */

type Painter = (g: CanvasRenderingContext2D, w: number, h: number, random: Random) => void;

interface LayerDef {
  /** Depth behind the lane (positive). */
  depth: number;
  /** World y of the layer's bottom and its height. */
  y: number;
  height: number;
  /** World units one texture period covers; 0 means the texture is not repeated. */
  tile: number;
  /** Texture drift per second (in periods) and the share of the camera's motion the layer keeps up with. */
  drift?: number;
  follow?: number;
  paint: Painter;
  seed: number;
  /** Texture pixel size. */
  size?: [number, number];
}

const clampWorld = 6.4;
const CAMERA_D = 14;

function canvasOf(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return [canvas, canvas.getContext('2d')];
}

function textureOf(canvas: HTMLCanvasElement, repeat: boolean): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  if (repeat) texture.wrapS = RepeatWrapping;
  return texture;
}

/** Fills `draw` at x and one period to the left so the picture tiles. */
function wrapped(w: number, width: number, draw: (x: number) => void): void {
  draw(w);
  if (w + width > 1024) draw(w - 1024);
  if (w - width < 0) draw(w + 1024);
}

// ---------- painters ----------

function clouds(color: string, shade: string, count: number): Painter {
  return (g, w, h, random) => {
    for (let i = 0; i < count; i++) {
      const cx = random() * w;
      const cy = h * (0.2 + random() * 0.6);
      const size = 40 + random() * 70;
      for (let b = 0; b < 6; b++) {
        const bx = cx + (b - 2.5) * size * 0.45 + random() * 10;
        const by = cy + (random() - 0.5) * size * 0.2;
        const r = size * (0.35 + random() * 0.3);
        for (const offset of [-w, 0, w]) {
          const grad = g.createRadialGradient(bx + offset, by, 1, bx + offset, by, r);
          grad.addColorStop(0, color);
          grad.addColorStop(0.7, shade);
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = grad;
          g.fillRect(bx + offset - r, by - r, r * 2, r * 2);
        }
      }
    }
  };
}

interface SkylineStyle {
  fill: string;
  edge?: string;
  window?: string;
  /** Share of window cells that are lit. */
  lit?: number;
  minH: number;
  maxH: number;
  minW: number;
  maxW: number;
  /** 'spire' adds an antenna or a tower, 'pagoda' tiered roofs, 'crane' harbour cranes. */
  decor?: 'spire' | 'pagoda' | 'crane' | 'ship' | 'pine' | 'jungle';
}

function skyline(style: SkylineStyle): Painter {
  return (g, w, h, random) => {
    let x = 0;
    while (x < w) {
      const bw = style.minW + random() * (style.maxW - style.minW);
      const bh = h * (style.minH + random() * (style.maxH - style.minH));
      const top = h - bh;
      const pick = random();
      wrapped(x, bw, (dx) => {
        g.fillStyle = style.fill;
        if (style.decor === 'pagoda' && pick < 0.45) {
          // A tiered pagoda: stacked boxes each with a wide curved roof.
          const tiers = 3 + Math.floor(random() * 2);
          const tierH = bh / (tiers + 0.5);
          for (let t = 0; t < tiers; t++) {
            const ty = h - (t + 1) * tierH;
            const tw = bw * (1 - t * 0.17);
            const cx = dx + bw / 2;
            g.fillRect(cx - tw * 0.36, ty, tw * 0.72, tierH);
            g.beginPath();
            g.moveTo(cx - tw * 0.62, ty + tierH * 0.28);
            g.quadraticCurveTo(cx - tw * 0.3, ty + tierH * 0.1, cx, ty - tierH * 0.18);
            g.quadraticCurveTo(cx + tw * 0.3, ty + tierH * 0.1, cx + tw * 0.62, ty + tierH * 0.28);
            g.lineTo(cx + tw * 0.4, ty + tierH * 0.34);
            g.lineTo(cx - tw * 0.4, ty + tierH * 0.34);
            g.fill();
          }
          g.fillRect(dx + bw / 2 - 1.5, h - bh - tierH * 0.9, 3, tierH * 0.8);
          return;
        }
        if (style.decor === 'crane' && pick < 0.35) {
          // A harbour gantry crane: two legs, a long jib and a hanging cable.
          const leg = bh * 0.9;
          g.fillRect(dx, h - leg, 5, leg);
          g.fillRect(dx + bw * 0.5, h - leg, 5, leg);
          g.fillRect(dx - bw * 0.4, h - leg - 8, bw * 1.9, 9);
          g.fillRect(dx - bw * 0.4 + 6, h - leg - 8, 3, leg * 0.35);
          g.fillRect(dx + bw * 0.9, h - leg, 3, leg * 0.25);
          return;
        }
        if (style.decor === 'pine' || style.decor === 'jungle') {
          // A fir (stacked triangles) or a tall jungle tree (trunk and a round crown).
          const cx = dx + bw / 2;
          if (style.decor === 'pine') {
            for (let t = 0; t < 4; t++) {
              const ty = h - bh + t * bh * 0.2;
              const tw = bw * (0.35 + t * 0.2);
              g.beginPath();
              g.moveTo(cx, ty);
              g.lineTo(cx + tw, ty + bh * 0.3);
              g.lineTo(cx - tw, ty + bh * 0.3);
              g.fill();
            }
            g.fillRect(cx - 2, h - bh * 0.1, 4, bh * 0.1);
          } else {
            g.fillRect(cx - 2.5, h - bh * 0.7, 5, bh * 0.7);
            g.beginPath();
            g.ellipse(cx, h - bh * 0.72, bw * 0.62, bh * 0.28, 0, 0, Math.PI * 2);
            g.fill();
            g.beginPath();
            g.ellipse(cx - bw * 0.3, h - bh * 0.58, bw * 0.4, bh * 0.18, 0, 0, Math.PI * 2);
            g.fill();
          }
          return;
        }
        if (style.decor === 'ship' && pick < 0.3) {
          // A ship at anchor: hull, bridge and funnel.
          g.beginPath();
          g.moveTo(dx - bw * 0.2, h - bh * 0.4);
          g.lineTo(dx + bw * 1.2, h - bh * 0.4);
          g.lineTo(dx + bw * 1.0, h - bh * 0.1);
          g.lineTo(dx, h - bh * 0.1);
          g.fill();
          g.fillRect(dx + bw * 0.1, h - bh * 0.75, bw * 0.5, bh * 0.35);
          g.fillRect(dx + bw * 0.28, h - bh * 0.95, bw * 0.12, bh * 0.22);
          return;
        }
        g.fillRect(dx, top, bw, bh);
        if (style.edge) {
          g.fillStyle = style.edge;
          g.fillRect(dx, top, bw, 2);
        }
        if (style.decor === 'spire' && pick < 0.3) {
          g.fillStyle = style.fill;
          g.fillRect(dx + bw / 2 - 1, top - bh * 0.25, 2.5, bh * 0.25);
        }
        if (style.window) {
          const cell = 9;
          for (let wy = top + 8; wy < h - 6; wy += cell) {
            for (let wx = dx + 4; wx < dx + bw - 6; wx += cell) {
              if (random() < (style.lit ?? 0.3)) {
                g.fillStyle = style.window;
                g.fillRect(wx, wy, 4, 5);
              }
            }
          }
        }
      });
      x += bw + random() * 6;
    }
  };
}

/** A ridge of hills or mountains; the cycles are whole so it tiles. */
function ridge(
  color: string,
  cycles: [number, number, number],
  amp: number,
  peak?: boolean,
): Painter {
  return (g, w, h) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) {
      const t = (x / w) * Math.PI * 2;
      const n =
        Math.sin(t * cycles[0] + 1) * 0.5 +
        Math.sin(t * cycles[1] + 2) * 0.3 +
        Math.sin(t * cycles[2] + 4) * 0.2;
      g.lineTo(x, h - amp * (0.55 + n * 0.45));
    }
    g.lineTo(w, h);
    g.fill();
    if (peak) {
      // A snow-capped cone, like Mount Fuji, sitting in the ridge.
      const cx = w * 0.3;
      const base = h * 0.98;
      const top = h - amp * 1.55;
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(cx - amp * 1.7, base);
      g.quadraticCurveTo(cx - amp * 0.5, top + amp * 0.35, cx - amp * 0.18, top);
      g.lineTo(cx + amp * 0.18, top);
      g.quadraticCurveTo(cx + amp * 0.5, top + amp * 0.35, cx + amp * 1.7, base);
      g.fill();
      g.fillStyle = 'rgba(255,240,235,0.9)';
      g.beginPath();
      g.moveTo(cx - amp * 0.18, top);
      g.lineTo(cx + amp * 0.18, top);
      g.lineTo(cx + amp * 0.34, top + amp * 0.3);
      g.lineTo(cx + amp * 0.16, top + amp * 0.22);
      g.lineTo(cx, top + amp * 0.34);
      g.lineTo(cx - amp * 0.16, top + amp * 0.2);
      g.lineTo(cx - amp * 0.34, top + amp * 0.3);
      g.fill();
    }
  };
}

/** Sun or moon with a glow, on a clear (transparent) sky. */
function orb(options: {
  x: number;
  y: number;
  radius: number;
  core: string;
  glow: string;
  stars?: number;
  crescent?: string;
  rays?: boolean;
}): Painter {
  return (g, w, h, random) => {
    for (let i = 0; i < (options.stars ?? 0); i++) {
      const sx = random() * w;
      const sy = random() * h * 0.8;
      g.fillStyle = `rgba(255,255,255,${0.35 + random() * 0.65})`;
      const s = random() < 0.1 ? 3 : 1.6;
      g.fillRect(sx, sy, s, s);
    }
    const cx = options.x * w;
    const cy = options.y * h;
    const halo = g.createRadialGradient(cx, cy, options.radius * 0.5, cx, cy, options.radius * 4.5);
    halo.addColorStop(0, options.glow);
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = halo;
    g.fillRect(
      cx - options.radius * 5,
      cy - options.radius * 5,
      options.radius * 10,
      options.radius * 10,
    );
    g.fillStyle = options.core;
    g.beginPath();
    g.arc(cx, cy, options.radius, 0, Math.PI * 2);
    g.fill();
    if (options.crescent) {
      g.fillStyle = options.crescent;
      g.beginPath();
      g.arc(
        cx + options.radius * 0.45,
        cy - options.radius * 0.1,
        options.radius * 0.92,
        0,
        Math.PI * 2,
      );
      g.fill();
    }
  };
}

// ---------- the six stages ----------

interface StageLook {
  layers: LayerDef[];
  fog: [string, number, number];
}

function lookFor(id: StageId): StageLook {
  switch (id) {
    case 'street':
      return {
        fog: ['#cfe6fb', 28, 120],
        layers: [
          {
            depth: 90,
            y: -30,
            height: 130,
            tile: 0,
            seed: 1,
            size: [512, 512],
            paint: orb({
              x: 0.7,
              y: 0.37,
              radius: 26,
              core: '#fffbe6',
              glow: 'rgba(255,248,200,0.8)',
            }),
          },
          {
            depth: 80,
            y: 20,
            height: 40,
            tile: 160,
            drift: 0.004,
            seed: 2,
            paint: clouds('rgba(255,255,255,0.95)', 'rgba(255,255,255,0.55)', 7),
          },
          {
            depth: 52,
            y: -2,
            height: 36,
            tile: 140,
            seed: 3,
            paint: skyline({
              fill: '#aac3de',
              minH: 0.4,
              maxH: 0.95,
              minW: 36,
              maxW: 70,
              decor: 'spire',
            }),
          },
          {
            depth: 28,
            y: -1,
            height: 20,
            tile: 100,
            seed: 4,
            paint: skyline({
              fill: '#6f87aa',
              window: '#d8e8ff',
              lit: 0.25,
              minH: 0.45,
              maxH: 0.95,
              minW: 42,
              maxW: 80,
            }),
          },
        ],
      };
    case 'docks':
      return {
        fog: ['#ffc58a', 26, 115],
        layers: [
          {
            depth: 90,
            y: -30,
            height: 130,
            tile: 0,
            seed: 11,
            size: [512, 512],
            paint: orb({
              x: 0.38,
              y: 0.4,
              radius: 38,
              core: '#fff0b8',
              glow: 'rgba(255,170,70,0.85)',
            }),
          },
          {
            depth: 80,
            y: 18,
            height: 36,
            tile: 160,
            drift: 0.006,
            seed: 12,
            paint: clouds('rgba(255,205,150,0.95)', 'rgba(255,150,110,0.5)', 6),
          },
          {
            depth: 50,
            y: -1,
            height: 24,
            tile: 150,
            seed: 13,
            paint: skyline({
              fill: '#c68a6a',
              minH: 0.45,
              maxH: 1,
              minW: 28,
              maxW: 56,
              decor: 'ship',
            }),
          },
          {
            depth: 30,
            y: -1,
            height: 20,
            tile: 110,
            seed: 14,
            paint: skyline({
              fill: '#7b4f3d',
              window: '#ffd27a',
              lit: 0.2,
              minH: 0.55,
              maxH: 1,
              minW: 30,
              maxW: 56,
              decor: 'crane',
            }),
          },
        ],
      };
    case 'dojo':
      return {
        fog: ['#a46a78', 26, 110],
        layers: [
          {
            depth: 90,
            y: -30,
            height: 130,
            tile: 0,
            seed: 21,
            size: [512, 512],
            paint: orb({
              x: 0.3,
              y: 0.36,
              radius: 34,
              core: '#fff4dc',
              glow: 'rgba(255,214,180,0.75)',
              stars: 70,
            }),
          },
          {
            depth: 80,
            y: 16,
            height: 34,
            tile: 160,
            drift: 0.003,
            seed: 22,
            paint: clouds('rgba(255,170,160,0.7)', 'rgba(120,70,120,0.4)', 5),
          },
          {
            depth: 66,
            y: -2,
            height: 40,
            tile: 220,
            seed: 23,
            paint: ridge('#5a3a6a', [2, 5, 9], 28, true),
          },
          {
            depth: 44,
            y: -2,
            height: 26,
            tile: 160,
            seed: 24,
            paint: ridge('#3c2650', [3, 7, 11], 16),
          },
          {
            depth: 28,
            y: -1,
            height: 20,
            tile: 100,
            seed: 25,
            paint: skyline({
              fill: '#2a1a3c',
              window: '#ffcf70',
              lit: 0.4,
              minH: 0.5,
              maxH: 1,
              minW: 44,
              maxW: 80,
              decor: 'pagoda',
            }),
          },
        ],
      };
    case 'jungle':
      return {
        fog: ['#a9dfae', 24, 105],
        layers: [
          {
            depth: 90,
            y: -30,
            height: 130,
            tile: 0,
            seed: 41,
            size: [512, 512],
            paint: orb({
              x: 0.6,
              y: 0.37,
              radius: 28,
              core: '#fffbd0',
              glow: 'rgba(255,245,160,0.8)',
            }),
          },
          {
            depth: 80,
            y: 16,
            height: 36,
            tile: 160,
            drift: 0.004,
            seed: 42,
            paint: clouds('rgba(235,255,225,0.9)', 'rgba(200,240,210,0.45)', 6),
          },
          {
            depth: 62,
            y: -2,
            height: 36,
            tile: 200,
            seed: 43,
            paint: ridge('#6fae8c', [2, 5, 8], 24),
          },
          {
            depth: 44,
            y: -2,
            height: 30,
            tile: 140,
            seed: 44,
            paint: skyline({
              fill: '#3f8a5c',
              minH: 0.5,
              maxH: 1,
              minW: 30,
              maxW: 54,
              decor: 'jungle',
            }),
          },
          {
            depth: 26,
            y: -1,
            height: 22,
            tile: 100,
            seed: 45,
            paint: skyline({
              fill: '#255a3a',
              minH: 0.55,
              maxH: 1,
              minW: 30,
              maxW: 60,
              decor: 'jungle',
            }),
          },
        ],
      };
    case 'snow':
      return {
        fog: ['#d6e6f6', 26, 110],
        layers: [
          {
            depth: 90,
            y: -30,
            height: 130,
            tile: 0,
            seed: 51,
            size: [512, 512],
            paint: orb({
              x: 0.28,
              y: 0.39,
              radius: 20,
              core: '#fffaf0',
              glow: 'rgba(255,235,225,0.8)',
            }),
          },
          {
            depth: 80,
            y: 18,
            height: 34,
            tile: 160,
            drift: 0.004,
            seed: 52,
            paint: clouds('rgba(255,255,255,0.95)', 'rgba(230,240,255,0.5)', 6),
          },
          {
            depth: 64,
            y: -2,
            height: 44,
            tile: 220,
            seed: 53,
            paint: ridge('#dce8f6', [2, 4, 9], 34, true),
          },
          {
            depth: 44,
            y: -2,
            height: 28,
            tile: 160,
            seed: 54,
            paint: ridge('#9db8d8', [3, 6, 10], 18),
          },
          {
            depth: 26,
            y: -1,
            height: 20,
            tile: 100,
            seed: 55,
            paint: skyline({
              fill: '#35566e',
              minH: 0.55,
              maxH: 1,
              minW: 26,
              maxW: 50,
              decor: 'pine',
            }),
          },
        ],
      };
    default:
      return {
        fog: ['#2a3166', 24, 105],
        layers: [
          {
            depth: 90,
            y: -30,
            height: 130,
            tile: 0,
            seed: 31,
            size: [512, 512],
            paint: orb({
              x: 0.68,
              y: 0.35,
              radius: 22,
              core: '#f4f6ff',
              glow: 'rgba(170,190,255,0.55)',
              stars: 150,
              crescent: '#0b1030',
            }),
          },
          {
            depth: 78,
            y: 16,
            height: 30,
            tile: 160,
            drift: 0.003,
            seed: 32,
            paint: clouds('rgba(120,130,200,0.35)', 'rgba(70,80,150,0.2)', 5),
          },
          {
            depth: 54,
            y: -2,
            height: 40,
            tile: 150,
            seed: 33,
            paint: skyline({
              fill: '#1b2252',
              window: '#ffe9a0',
              lit: 0.3,
              minH: 0.4,
              maxH: 1,
              minW: 30,
              maxW: 58,
              decor: 'spire',
            }),
          },
          {
            depth: 32,
            y: -1,
            height: 26,
            tile: 110,
            seed: 34,
            paint: skyline({
              fill: '#10163a',
              edge: '#3a4a90',
              window: '#8fe3ff',
              lit: 0.35,
              minH: 0.4,
              maxH: 1,
              minW: 34,
              maxW: 64,
              decor: 'spire',
            }),
          },
        ],
      };
  }
}

// ---------- ground textures ----------

/** A tiling texture for the lane (`kind: 'lane'`) or the strip behind it (`'strip'`) of a stage. */
export function groundTexture(
  id: StageId,
  kind: 'lane' | 'strip',
  pal: StagePalette,
): CanvasTexture {
  const [canvas, g] = canvasOf(256, 256);
  const random = seededRandom(id.length * 31 + (kind === 'lane' ? 1 : 2));
  if (g) {
    const base = kind === 'lane' ? pal.ground : pal.walk;
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    const dark = 'rgba(0,0,0,0.22)';
    const light = 'rgba(255,255,255,0.14)';
    const speckle = (count: number) => {
      for (let i = 0; i < count; i++) {
        g.fillStyle = random() < 0.5 ? dark : light;
        g.fillRect(random() * 256, random() * 256, 2, 2);
      }
    };
    if (id === 'street') {
      speckle(900);
      if (kind === 'lane') {
        g.strokeStyle = 'rgba(0,0,0,0.3)';
        g.lineWidth = 2;
        for (let c = 0; c < 3; c++) {
          g.beginPath();
          let x = random() * 256;
          let y = random() * 256;
          g.moveTo(x, y);
          for (let s = 0; s < 5; s++) {
            x += (random() - 0.3) * 34;
            y += (random() - 0.5) * 34;
            g.lineTo(x, y);
          }
          g.stroke();
        }
      } else {
        // Paving slabs.
        g.strokeStyle = 'rgba(0,0,0,0.28)';
        g.lineWidth = 3;
        for (let i = 0; i <= 256; i += 64) {
          g.beginPath();
          g.moveTo(i, 0);
          g.lineTo(i, 256);
          g.moveTo(0, i);
          g.lineTo(256, i);
          g.stroke();
        }
      }
    } else if (id === 'docks') {
      if (kind === 'lane') {
        // Boards laid across the lane, each a slightly different brown, with nails.
        for (let b = 0; b < 8; b++) {
          const shade = random() * 0.3 - 0.15;
          g.fillStyle = shade > 0 ? `rgba(255,220,170,${shade})` : `rgba(30,15,0,${-shade})`;
          g.fillRect(b * 32, 0, 32, 256);
          g.fillStyle = 'rgba(30,15,0,0.55)';
          g.fillRect(b * 32, 0, 2.5, 256);
          for (let n = 0; n < 2; n++) {
            g.fillStyle = 'rgba(40,30,20,0.7)';
            g.fillRect(b * 32 + 6, 20 + n * 200, 3, 3);
            g.fillRect(b * 32 + 24, 20 + n * 200, 3, 3);
          }
          g.strokeStyle = 'rgba(40,20,0,0.18)';
          g.lineWidth = 1;
          for (let k = 0; k < 4; k++) {
            const gy = random() * 256;
            g.beginPath();
            g.moveTo(b * 32 + 4, gy);
            g.lineTo(b * 32 + 28, gy + (random() - 0.5) * 8);
            g.stroke();
          }
        }
      } else {
        // Water: a deep blue with pale wavelets.
        const grad = g.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, '#2c7da0');
        grad.addColorStop(1, '#3b97b8');
        g.fillStyle = grad;
        g.fillRect(0, 0, 256, 256);
        g.strokeStyle = 'rgba(255,240,210,0.5)';
        g.lineWidth = 2;
        for (let i = 0; i < 26; i++) {
          const wx = random() * 256;
          const wy = random() * 256;
          for (const o of [-256, 0, 256]) {
            g.beginPath();
            g.moveTo(wx + o, wy);
            g.quadraticCurveTo(wx + o + 10, wy - 4, wx + o + 20, wy);
            g.quadraticCurveTo(wx + o + 30, wy + 4, wx + o + 40, wy);
            g.stroke();
          }
        }
      }
    } else if (id === 'dojo') {
      if (kind === 'lane') {
        // Tatami mats: pale straw rectangles with dark cloth borders.
        g.fillStyle = '#c9b574';
        g.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 700; i++) {
          g.fillStyle = random() < 0.5 ? 'rgba(80,60,10,0.12)' : 'rgba(255,255,220,0.15)';
          g.fillRect(random() * 256, random() * 256, 8, 1);
        }
        g.strokeStyle = '#3d4a2c';
        g.lineWidth = 6;
        g.strokeRect(0, 0, 128, 256);
        g.strokeRect(128, 0, 128, 128);
        g.strokeRect(128, 128, 128, 128);
      } else {
        // Polished wooden veranda boards running along the lane.
        for (let b = 0; b < 4; b++) {
          const shade = random() * 0.2 - 0.1;
          g.fillStyle = shade > 0 ? `rgba(255,220,160,${shade})` : `rgba(40,20,0,${-shade})`;
          g.fillRect(0, b * 64, 256, 64);
          g.fillStyle = 'rgba(40,20,0,0.5)';
          g.fillRect(0, b * 64, 256, 3);
        }
        g.fillStyle = 'rgba(40,20,0,0.5)';
        g.fillRect(100, 0, 3, 128);
        g.fillRect(190, 128, 3, 128);
      }
    } else if (id === 'jungle') {
      speckle(1100);
      if (kind === 'lane') {
        // Worn flagstones with moss in the joints and a few fallen leaves.
        g.strokeStyle = 'rgba(30,50,20,0.55)';
        g.lineWidth = 4;
        for (let i = 0; i <= 256; i += 85) {
          g.beginPath();
          g.moveTo(i, 0);
          g.lineTo(i + 10, 256);
          g.moveTo(0, i);
          g.lineTo(256, i + 12);
          g.stroke();
        }
        for (let i = 0; i < 14; i++) {
          g.fillStyle = random() < 0.5 ? 'rgba(70,130,50,0.45)' : 'rgba(190,150,50,0.4)';
          g.beginPath();
          g.ellipse(random() * 256, random() * 256, 7, 3, random() * 3, 0, Math.PI * 2);
          g.fill();
        }
      } else {
        // Thick grass and ferns.
        for (let i = 0; i < 260; i++) {
          g.strokeStyle = random() < 0.5 ? '#3f8a3f' : '#1f5a2a';
          g.lineWidth = 2;
          const gx = random() * 256;
          const gy = random() * 256;
          g.beginPath();
          g.moveTo(gx, gy);
          g.lineTo(gx + (random() - 0.5) * 8, gy - 8 - random() * 8);
          g.stroke();
        }
      }
    } else if (id === 'snow') {
      if (kind === 'lane') {
        // Packed snow with soft blue shadows, footprints and a ski track.
        for (let i = 0; i < 24; i++) {
          g.fillStyle = 'rgba(150,185,225,0.28)';
          g.beginPath();
          g.ellipse(
            random() * 256,
            random() * 256,
            26 + random() * 26,
            6 + random() * 5,
            0,
            0,
            6.3,
          );
          g.fill();
        }
        g.strokeStyle = 'rgba(120,160,205,0.35)';
        g.lineWidth = 3;
        for (const y of [90, 100]) {
          g.beginPath();
          g.moveTo(0, y);
          g.bezierCurveTo(80, y - 14, 170, y + 14, 256, y);
          g.stroke();
        }
        for (let i = 0; i < 8; i++) {
          g.fillStyle = 'rgba(130,165,210,0.4)';
          g.beginPath();
          g.ellipse(20 + i * 30, 180 + (i % 2) * 14, 6, 3.5, 0, 0, 6.3);
          g.fill();
        }
        speckle(500);
      } else {
        // Ice with white cracks.
        g.strokeStyle = 'rgba(255,255,255,0.7)';
        g.lineWidth = 2;
        for (let i = 0; i < 7; i++) {
          g.beginPath();
          let x = random() * 256;
          let y = random() * 256;
          g.moveTo(x, y);
          for (let k = 0; k < 4; k++) {
            x += (random() - 0.5) * 60;
            y += (random() - 0.5) * 60;
            g.lineTo(x, y);
          }
          g.stroke();
        }
      }
    } else {
      speckle(700);
      g.strokeStyle = kind === 'lane' ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.3)';
      g.lineWidth = 3;
      const step = kind === 'lane' ? 128 : 64;
      for (let i = 0; i <= 256; i += step) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i, 256);
        g.moveTo(0, i);
        g.lineTo(256, i);
        g.stroke();
      }
      if (kind === 'lane') {
        // Puddles that catch the neon.
        for (let p = 0; p < 2; p++) {
          g.fillStyle = 'rgba(120,150,230,0.25)';
          g.beginPath();
          g.ellipse(40 + p * 130, 70 + p * 100, 30, 9, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  }
  const texture = textureOf(canvas, true);
  texture.wrapT = RepeatWrapping;
  return texture;
}

// ---------- the backdrop ----------

export interface Backdrop {
  readonly object: Group;
  /** `cameraX` follows the camera; `seconds` drives the slow drift (clouds, water, petals). */
  update(cameraX: number, seconds: number): void;
  dispose(): void;
}

export function createBackdrop(scene: Scene, id: StageId): Backdrop {
  const look = lookFor(id);
  const object = new Group();
  scene.fog = new Fog(new Color(look.fog[0]), look.fog[1], look.fog[2]);

  const owned: { dispose(): void }[] = [];
  const flat = new PlaneGeometry(1, 1);
  owned.push(flat);

  interface Layer {
    mesh: Mesh;
    texture: CanvasTexture;
    def: LayerDef;
  }
  const layers: Layer[] = [];

  for (const def of look.layers) {
    const [w, h] = def.size ?? [1024, 256];
    const [canvas, g] = canvasOf(w, h);
    if (g) def.paint(g, w, h, seededRandom(def.seed));
    const texture = textureOf(canvas, def.tile > 0);
    const span = (2 * clampWorld * (CAMERA_D + def.depth)) / CAMERA_D + 6;
    const width = def.tile > 0 ? span : span * 1.25;
    texture.repeat.set(def.tile > 0 ? width / def.tile : 1, 1);
    const material = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    const mesh = new Mesh(flat, material);
    mesh.scale.set(width, def.height, 1);
    mesh.position.set(0, def.y + def.height / 2, -def.depth);
    mesh.renderOrder = -10;
    object.add(mesh);
    owned.push(material, texture);
    layers.push({ mesh, texture, def });
  }

  // Little moving things.
  let petals: Points | undefined;
  let driftDir = 1;
  const petalBase: { x: number; y: number; z: number; speed: number; sway: number }[] = [];
  // Cherry petals fall in the dojo, snow falls on the peak, fireflies rise in the jungle.
  const drifter = {
    dojo: { color: 0xffb7d0, size: 0.14, count: 70, dir: 1 },
    snow: { color: 0xffffff, size: 0.12, count: 140, dir: 1.6 },
    jungle: { color: 0xfff08a, size: 0.1, count: 60, dir: -0.5 },
  }[id as 'dojo' | 'snow' | 'jungle'];
  if (drifter) {
    driftDir = drifter.dir;
    const count = drifter.count;
    const positions = new Float32Array(count * 3);
    const random = seededRandom(77);
    for (let i = 0; i < count; i++) {
      petalBase.push({
        x: random() * 30,
        y: random() * 9,
        z: -3 + random() * 7,
        speed: 0.35 + random() * 0.4,
        sway: random() * 6.28,
      });
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    const material = new PointsMaterial({
      color: drifter.color,
      size: drifter.size,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    petals = new Points(geometry, material);
    petals.frustumCulled = false;
    object.add(petals);
    owned.push(geometry, material);
  }

  const gulls: Group[] = [];
  const gullMaterial = new MeshBasicMaterial({ color: 0x40302a, side: DoubleSide });
  const gullWing = new PlaneGeometry(0.5, 0.09);
  if (id === 'docks') {
    owned.push(gullMaterial, gullWing);
    for (let i = 0; i < 4; i++) {
      const gull = new Group();
      for (const side of [-1, 1]) {
        const pivot = new Group();
        const wing = new Mesh(gullWing, gullMaterial);
        wing.position.x = side * 0.25;
        pivot.add(wing);
        gull.add(pivot);
      }
      gulls.push(gull);
      object.add(gull);
    }
  }

  const beams: Mesh[] = [];
  if (id === 'rooftop') {
    const [canvas, g] = canvasOf(64, 256);
    if (g) {
      const grad = g.createLinearGradient(0, 256, 0, 0);
      grad.addColorStop(0, 'rgba(200,230,255,0.55)');
      grad.addColorStop(1, 'rgba(200,230,255,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(26, 256);
      g.lineTo(38, 256);
      g.lineTo(64, 0);
      g.lineTo(0, 0);
      g.fill();
    }
    const texture = textureOf(canvas, false);
    const material = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    });
    owned.push(texture, material);
    for (let i = 0; i < 2; i++) {
      const beam = new Mesh(flat, material);
      beam.scale.set(10, 44, 1);
      beam.renderOrder = -9;
      beams.push(beam);
      object.add(beam);
    }
  }

  return {
    object,
    update(cameraX, seconds) {
      for (const { mesh, texture, def } of layers) {
        mesh.position.x = cameraX;
        if (def.tile > 0) {
          texture.offset.x = (cameraX * (def.follow ?? 1)) / def.tile + seconds * (def.drift ?? 0);
        }
      }
      if (petals) {
        const attr = petals.geometry.getAttribute('position') as BufferAttribute;
        petalBase.forEach((p, i) => {
          const y = (((p.y - seconds * p.speed * driftDir) % 9) + 9) % 9;
          const x =
            (((p.x + seconds * 0.5 + Math.sin(seconds * 0.8 + p.sway) * 0.6) % 30) + 30) % 30;
          attr.setXYZ(i, cameraX - 15 + x, y + 0.1, p.z);
        });
        attr.needsUpdate = true;
      }
      gulls.forEach((gull, i) => {
        const period = 24 + i * 5;
        const t = ((seconds + i * 7) % period) / period;
        gull.position.set(
          cameraX - 14 + t * 28,
          6 + i * 1.7 + Math.sin(seconds + i) * 0.3,
          -18 - i * 3,
        );
        const flap = Math.sin(seconds * 6 + i * 2) * 0.5;
        gull.children.forEach((pivot, k) => {
          pivot.rotation.z = (k === 0 ? 1 : -1) * flap;
        });
      });
      beams.forEach((beam, i) => {
        const swing = Math.sin(seconds * 0.35 + i * 2.4) * 0.5;
        // The beam's foot is at its bottom edge, far behind the lane.
        const angle = swing + (i === 0 ? 0.35 : -0.35);
        beam.rotation.z = -angle;
        const foot = cameraX + (i === 0 ? -7 : 8);
        beam.position.set(foot + Math.sin(angle) * 22, -2 + Math.cos(angle) * 22, -34 - i * 4);
      });
    },
    dispose() {
      object.removeFromParent();
      for (const o of owned) o.dispose();
      scene.fog = null;
    },
  };
}
