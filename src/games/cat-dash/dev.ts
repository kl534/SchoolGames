/**
 * Dev-only hooks for checking every state by eye. They compile away in production builds.
 *
 * - `?cat=<CatId>` skips the picker with that cat. `?lives=1|2|3` starts with that many lives.
 * - `?place=<PlaceId>` starts in that place. `?places=a,b` the places come in this order, then repeat.
 * - `?obstacle=<id>` every obstacle is that one (its place is used).
 * - `?lab=<obstacle>:<clear|fail>:<0|1>` the move lab: loops that one move with the HUD hidden
 *   except the comic word. `&at=<seconds>` freezes it there (prop and effects included).
 * - `?door=<PlaceId>&at=<0..2.4>` the doorway into that place frozen at that time (0 door in view,
 *   1.2 iris closed, 1.55 open again with the new place, 2.4 banner).
 */
import { CAT_IDS, type CatId } from './looks';
import { OBSTACLE_IDS, PLACE_IDS, type ObstacleId, type PlaceId } from './places';
import { LIVES, type Outcome, type Variant } from './rules';

export interface LabMove {
  obstacle: ObstacleId;
  outcome: Outcome;
  variant: Variant;
}

export interface DevOptions {
  cat: CatId | null;
  lives: number | null;
  place: PlaceId | null;
  places: PlaceId[];
  obstacle: ObstacleId | null;
  lab: LabMove | null;
  door: PlaceId | null;
  at: number | null;
}

const isPlace = (name: string): name is PlaceId => (PLACE_IDS as readonly string[]).includes(name);
const isObstacle = (name: string): name is ObstacleId =>
  (OBSTACLE_IDS as readonly string[]).includes(name);
const isCat = (name: string): name is CatId => (CAT_IDS as readonly string[]).includes(name);

/** Reads the dev hooks from a query string; anything malformed is ignored. */
export function parseDev(search: string): DevOptions {
  const q = new URLSearchParams(search);
  const cat = q.get('cat') ?? '';
  const lives = Number(q.get('lives'));
  const place = q.get('place') ?? '';
  const obstacle = q.get('obstacle') ?? '';
  const door = q.get('door') ?? '';
  let lab: LabMove | null = null;
  const [id, outcome, variant] = (q.get('lab') ?? '').split(':');
  if (
    isObstacle(id ?? '') &&
    (outcome === 'clear' || outcome === 'fail') &&
    (variant === '0' || variant === '1')
  ) {
    lab = { obstacle: id as ObstacleId, outcome, variant: Number(variant) as Variant };
  }
  const at = q.has('at') ? Number(q.get('at')) : Number.NaN;
  return {
    cat: isCat(cat) ? cat : null,
    lives: Number.isInteger(lives) && lives >= 1 && lives <= LIVES ? lives : null,
    place: isPlace(place) ? place : null,
    places: (q.get('places') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(isPlace),
    obstacle: isObstacle(obstacle) ? obstacle : null,
    lab,
    door: isPlace(door) ? door : null,
    at: Number.isFinite(at) ? at : null,
  };
}

/** The dev hooks of this page, or null in a production build. */
export function devOptions(): DevOptions | null {
  return import.meta.env.DEV ? parseDev(location.search) : null;
}
