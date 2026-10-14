import { PerspectiveCamera, Vector3 } from 'three';
import { BOARD, BURST_RADIUS, FIREWORKS_CENTRE, type Vec } from './flight';

export interface HomeView {
  cam: Vec;
  look: Vec;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * The batting view: behind and above home plate, looking out at the pitcher. On a wide screen
 * there is little height to spare, so the camera comes down a little: people then take up more of
 * the picture and the ground less.
 */
export function homeView(aspect: number): HomeView {
  const wide = clamp((aspect - 0.9) / 0.9, 0, 1);
  return {
    cam: { x: 0.4, y: lerp(4.7, 3.5, wide), z: lerp(11.8, 11, wide) },
    look: { x: 0, y: lerp(1.3, 1.5, wide), z: -8 },
  };
}

/** What the view must hold: the pitcher's cap down to the umpire's feet. */
const TOP_POINT = { x: 0, y: 3.0, z: -8.2 };
const BOTTOM_POINT = { x: 1.3, y: 0, z: 3.6 };
/** On a wide screen the answers sit low and hide the umpire's legs, so his waist will do. */
const BOTTOM_POINT_WIDE = { x: 1.3, y: 0.9, z: 3.4 };
/** Distance from the camera to the mound, where the sideways room is measured. */
const MOUND_DISTANCE = 20;

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

export interface PlayBand {
  /** Screen rows (px from the top) the question and score leave clear, and the answers leave clear. */
  top: number;
  bottom: number;
}

/**
 * How the HUD is arranged for a screen size. Mirrors the media queries in style.css:
 * - `stacked`: a narrow phone held upright; the scorebug and question stack up the top and the
 *   four answers wrap into two rows.
 * - `compact`: a short landscape phone; a smaller scorebug, question and answers, so that the
 *   field keeps most of the screen.
 * - `standard`: everything else.
 */
export type HudLayout = 'stacked' | 'compact' | 'standard';

export function hudLayout(width: number, height: number): HudLayout {
  const aspect = width / Math.max(height, 1);
  if (width <= 640 && aspect <= 1.2) return 'stacked';
  if (height <= 380 && aspect >= 1.2) return 'compact';
  return 'standard';
}

/**
 * The part of the screen between the question at the top and the answers along the bottom, in
 * CSS pixels, from the HUD's layout. `layout()` in main.ts measures the real thing; this is the
 * same thing worked out, for tests and for before there is anything to measure.
 */
export function playBand(width: number, height: number): PlayBand {
  const layout = hudLayout(width, height);
  if (layout === 'stacked') return { top: 248, bottom: height - (width <= 560 ? 158 : 92) };
  if (layout === 'compact') return { top: 76, bottom: height - 72 };
  return { top: height >= 700 ? 115 : 104, bottom: height - (height <= 460 ? 84 : 92) };
}

/**
 * Whether the umpire's call goes in the question panel rather than on a card beside the plate.
 * A wide, roomy screen has space at the side of the field for a card; on a tall, narrow or short
 * one any card would sit on the pitcher or the plate.
 */
export function callInPanel(width: number, height: number): boolean {
  return width <= 640 || width <= height * 1.2 || hudLayout(width, height) === 'compact';
}

/** Where the scorebug ends when it can't be measured (it sits under the Menu button). */
const BUG_BOTTOM: Record<HudLayout, number> = { stacked: 143, standard: 143, compact: 120 };
/** Space kept between the scorebug and a view of the field. */
const BAND_GAP = 8;
/** Space left at the bottom while a hit plays, where the answers were. */
const BAND_FOOT = 12;

/**
 * The part of the screen that stays clear while a hit is in flight. The question and the answers
 * are hidden then, so only the scorebug is in the way: the view may use everything below it.
 * `bugBottom` is the scorebug's measured bottom edge (px from the top), when it is known.
 */
export function hitBand(
  width: number,
  height: number,
  bugBottom: number = BUG_BOTTOM[hudLayout(width, height)],
): PlayBand {
  return { top: bugBottom + BAND_GAP, bottom: height - BAND_FOOT };
}

/** Pixels to slide the picture so the middle of the screen's view lands in the middle of a band. */
export function centreShift(height: number, band: PlayBand): number {
  return height / 2 - (band.top + band.bottom) / 2;
}

export interface ViewFit {
  /** Vertical field of view in degrees. */
  fov: number;
  /** Pixels to slide the picture up (negative to slide down) so the action sits in the band. */
  shift: number;
}

const probe = new PerspectiveCamera();
/** The widest field of view the game will use. */
const MAX_FOV = 100;

/** Screen row of a point for the resting view at a given fov and aspect. */
function rowAt(fov: number, aspect: number, height: number, p: Vec): number {
  const { cam, look } = homeView(aspect);
  probe.fov = fov;
  probe.aspect = aspect;
  probe.near = 0.3;
  probe.far = 500;
  probe.updateProjectionMatrix();
  probe.position.set(cam.x, cam.y, cam.z);
  probe.lookAt(look.x, look.y, look.z);
  probe.updateMatrixWorld();
  const v = new Vector3(p.x, p.y, p.z).project(probe);
  return ((1 - v.y) / 2) * height;
}

/**
 * Field of view and vertical shift for a screen: wide enough that the pitcher and the plate fit
 * between the question and the answers, and that there is room either side of the mound (the
 * infielders too, on a wide screen).
 */
export function fitView(
  width: number,
  height: number,
  band: PlayBand = playBand(width, height),
): ViewFit {
  const w = Math.max(width, 1);
  const h = Math.max(height, 1);
  const aspect = w / h;
  const room = Math.max(band.bottom - band.top, 60) * 0.94;
  const bottomPoint = aspect > 1.2 ? BOTTOM_POINT_WIDE : BOTTOM_POINT;
  // Narrowest field of view that fits the pitcher-to-plate span in the band.
  let fov = 30;
  while (fov < 88) {
    const span = rowAt(fov, aspect, h, bottomPoint) - rowAt(fov, aspect, h, TOP_POINT);
    if (span <= room) break;
    fov += 1;
  }
  // And wide enough to show some field either side of the mound.
  const need = aspect < 0.9 ? 4.2 : aspect < 1.4 ? 7 : 9;
  const tanV = need / (MOUND_DISTANCE * aspect);
  fov = clamp(Math.max(fov, (2 * Math.atan(tanV) * 180) / Math.PI), 30, 88);
  const mid = (rowAt(fov, aspect, h, bottomPoint) + rowAt(fov, aspect, h, TOP_POINT)) / 2;
  return { fov, shift: mid - (band.top + band.bottom) / 2 };
}

/**
 * Where the camera wants to be, and what it looks at, to follow a ball at `ball`. The camera
 * stays back near home (tilting and panning rather than chasing), and holds the usual view until
 * the ball has left the infield, so the swing and the first flight are seen from behind the plate.
 */
export function followGoal(ball: Vec, cam: Vec, look: Vec, home: HomeView): void {
  const lead = clamp(Math.abs(ball.z) / 12, 0, 1);
  const height = clamp(ball.y, 0, 15);
  cam.x = home.cam.x + ball.x * 0.1 * lead;
  cam.y = home.cam.y + 2.2 * lead + height * 0.14;
  cam.z = home.cam.z + ball.z * 0.08 * lead;
  look.x = home.look.x + (ball.x * 0.9 - home.look.x) * lead;
  look.y = home.look.y + (clamp(ball.y * 0.8, 1.2, 32) - home.look.y) * lead;
  look.z = home.look.z + (ball.z - home.look.z) * lead;
}

/** What the camera aims at to watch the fireworks, passed to `followGoal` like a ball position. */
export function fireworksAim(): Vec {
  return { x: FIREWORKS_CENTRE.x, y: FIREWORKS_CENTRE.y + 8, z: FIREWORKS_CENTRE.z };
}

/** The points a home run's closing shot must keep in view: the scoreboard and the burst. */
export function fireworksPoints(): Vec[] {
  const board = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sy) => ({
      x: BOARD.x + (sx * BOARD.width) / 2,
      y: BOARD.y + (sy * BOARD.height) / 2,
      z: BOARD.z,
    })),
  );
  const burst = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sy) => ({
      x: FIREWORKS_CENTRE.x + sx * BURST_RADIUS,
      y: FIREWORKS_CENTRE.y + sy * BURST_RADIUS,
      z: FIREWORKS_CENTRE.z,
    })),
  );
  return [...board, ...burst];
}

/** Screen position (px, before any view offset) of a point seen from the camera. */
export function project(
  p: Vec,
  cam: Vec,
  look: Vec,
  fov: number,
  width: number,
  height: number,
): { x: number; y: number } {
  probe.fov = fov;
  probe.aspect = width / Math.max(height, 1);
  probe.near = 0.3;
  probe.far = 600;
  probe.updateProjectionMatrix();
  probe.position.set(cam.x, cam.y, cam.z);
  probe.lookAt(look.x, look.y, look.z);
  probe.updateMatrixWorld();
  const v = new Vector3(p.x, p.y, p.z).project(probe);
  return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height };
}

/** The field of view and shift for a home run's closing shot of the scoreboard and fireworks. */
export function fireworksFit(
  width: number,
  height: number,
  fitFov: number,
  band: PlayBand,
): ViewFit {
  const home = homeView(width / Math.max(height, 1));
  const cam: Vec = { x: 0, y: 0, z: 0 };
  const look: Vec = { x: 0, y: 0, z: 0 };
  followGoal(fireworksAim(), cam, look, home);
  const points = fireworksPoints();
  const room = (band.bottom - band.top) * 0.96;
  const side = width * 0.03;
  let fov = fitFov;
  for (;;) {
    const at = points.map((p) => project(p, cam, look, fov, width, height));
    const top = Math.min(...at.map((a) => a.y));
    const bottom = Math.max(...at.map((a) => a.y));
    const left = Math.min(...at.map((a) => a.x));
    const right = Math.max(...at.map((a) => a.x));
    if ((bottom - top <= room && left >= side && right <= width - side) || fov >= MAX_FOV) {
      return { fov, shift: (top + bottom) / 2 - (band.top + band.bottom) / 2 };
    }
    fov += 1;
  }
}

interface BoardBox {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** The scoreboard's screen box for a camera, after the view shift for a band. */
function boardBox(
  cam: Vec,
  look: Vec,
  fov: number,
  width: number,
  height: number,
  band: PlayBand,
): BoardBox {
  const lift = (band.top + band.bottom) / 2 - height / 2;
  const box = { top: Infinity, bottom: -Infinity, left: Infinity, right: -Infinity };
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const corner = {
        x: BOARD.x + (sx * BOARD.width) / 2,
        y: BOARD.y + (sy * BOARD.height) / 2,
        z: BOARD.z,
      };
      const p = project(corner, cam, look, fov, width, height);
      box.top = Math.min(box.top, p.y + lift);
      box.bottom = Math.max(box.bottom, p.y + lift);
      box.left = Math.min(box.left, p.x);
      box.right = Math.max(box.right, p.x);
    }
  }
  return box;
}

/** Lowest the camera is allowed to aim while it keeps the scoreboard out of the way. */
const MIN_LOOK_Y = -10;
/** How far above the top of the screen the scoreboard goes when it is tilted out of the picture. */
const GONE_MARGIN = 24;
/** Room kept between the ball and the edges of the band when choosing which way to tilt. */
const BALL_MARGIN = 28;

/**
 * Nudges where the camera looks so that the scoreboard is never half hidden behind the scorebug
 * and the buttons: it ends up wholly inside the band, or wholly off the top of the screen. It
 * prefers whichever keeps the ball in the band, and the smaller tilt of the two. (A board cut
 * by the side of the screen is not counted as inside: it goes off the top instead.)
 */
export function keepBoardClear(
  ball: Vec,
  cam: Vec,
  look: Vec,
  fov: number,
  width: number,
  height: number,
  band: PlayBand,
): void {
  const at = (y: number) => boardBox(cam, { x: look.x, y, z: look.z }, fov, width, height, band);
  const clearOfBand = (r: BoardBox) => r.top >= band.top;
  // Wholly in the band (and not cut by the side of the screen), or wholly out of the picture.
  const inside = (r: BoardBox) => clearOfBand(r) && r.left >= 0 && r.right <= width;
  const gone = (r: BoardBox) => r.bottom <= -GONE_MARGIN || r.right <= 0 || r.left >= width;
  const original = at(look.y);
  if (inside(original) || gone(original)) return;
  const lift = (band.top + band.bottom) / 2 - height / 2;
  const ballOk = (y: number) => {
    const row = project(ball, cam, { x: look.x, y, z: look.z }, fov, width, height).y + lift;
    return row >= band.top + BALL_MARGIN && row <= band.bottom - BALL_MARGIN;
  };
  // Highest aim, from `look.y` down to the floor, at which the board is gone off the top.
  const tiltDown = (): number | null => {
    if (!gone(at(MIN_LOOK_Y))) return null;
    let lo = MIN_LOOK_Y;
    let hi = look.y;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (gone(at(mid))) lo = mid;
      else hi = mid;
    }
    return lo;
  };
  // Lowest aim, from `look.y` upwards, at which the board is back in the band.
  const tiltUp = (test: (r: BoardBox) => boolean): number | null => {
    let lo = look.y;
    let hi = look.y + 40;
    if (!test(at(hi))) return null;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (test(at(mid))) hi = mid;
      else lo = mid;
    }
    return hi;
  };
  let options = [tiltDown(), tiltUp(inside)].filter((y): y is number => y !== null);
  // The board can be cut by the side of the screen whatever the tilt (the camera is looking
  // well off to one side): then settle for it being clear of the scorebug.
  if (!options.length) options = [tiltUp(clearOfBand)].filter((y): y is number => y !== null);
  const good = options.filter(ballOk);
  const pool = good.length ? good : options;
  if (!pool.length) return;
  look.y = pool.reduce((best, y) => (Math.abs(y - look.y) < Math.abs(best - look.y) ? y : best));
}
