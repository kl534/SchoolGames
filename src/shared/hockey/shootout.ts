/**
 * One shootout shot as a script: the shooter alone at the centre dot, the others by their bench,
 * a deke (or spin, or nothing) and a shot. The answer speed (`band`) picks the style. Pure: no
 * three.js and no DOM.
 */
import type { Band } from './band';
import { PUCK_H, vec, type Side } from './geometry';
import {
  WRIST_CONTACT,
  Builder,
  CREW,
  celebration,
  goalieSpots,
  ground,
  netPoint,
  other,
  scoreAt,
  type ActorId,
  type Formation,
  type PlayScript,
  type Spot,
} from './script';
import type { Role } from './teams';

export type ShootoutKind = 'so-goal' | 'so-saved' | 'so-stopped' | 'so-goal-against';

const ROLES: readonly Role[] = ['C', 'W', 'D'];

/**
 * The shooter alone at the centre dot, everybody else by the benches. Each role has its own bench
 * spot (C, W, D from the left), so the shooter's spot stays empty.
 */
export function shootoutFormation(shooter: Side, role: Role = 'C'): Formation {
  const dir = shooter === 'us' ? 1 : -1;
  const at = (x: number, z: number, look: number): Spot => ({
    pos: ground(x, z),
    face: ground(x + look, z),
  });
  const spots = { ...goalieSpots(0) } as Record<ActorId, Spot>;
  ROLES.forEach((r, i) => {
    spots[CREW.us[r]] = at(-4 + 2 * i, 12, 3);
    spots[CREW.them[r]] = at(2 + 2 * i, -12, -3);
  });
  const shooterId = CREW[shooter][role];
  spots[shooterId] = at(0, 0, 6 * dir);
  return { spots, carrier: shooterId, puck: vec(0.9 * dir, PUCK_H, 0) };
}

/**
 * One shootout shot. `sgn` (-1 or 1) picks the side of the net. Solid with role C is the shot
 * Slap Shot has always had.
 */
export function shootoutShot(kind: ShootoutKind, role: Role, band: Band, sgn: number): PlayScript {
  const shooter: Side = kind === 'so-goal' || kind === 'so-saved' ? 'us' : 'them';
  const scores = kind === 'so-goal' || kind === 'so-goal-against';
  const S = shootoutFormation(shooter, role);
  const dir = shooter === 'us' ? 1 : -1;
  const crew = CREW[shooter];
  const me = crew[role];
  const g = CREW[other(shooter)];
  const end = scores ? celebration(shooter) : { ...S.spots };
  const b = new Builder(2.8, S, end);
  if (band === 'plain') {
    b.path(me, [1.4, 18 * dir, 0.2 * sgn]);
    b.act(me, 1.4, 'wrist');
  } else if (band === 'flashy') {
    b.path(me, [1.1, ((16 * 1.1) / 1.2) * dir, 0, 'spin'], [1.7, 21.5 * dir, 0.4 * sgn]);
    b.act(me, 1.7, 'wrist');
  } else {
    b.path(me, [1.2, 16 * dir, 0], [1.7, 21.5 * dir, 0.4 * sgn]);
    b.act(me, 1.2, 'deke');
    b.act(me, 1.7, 'wrist');
  }
  const dive = band === 'flashy' && !scores ? 1.1 : 0.9;
  b.path(g.G, [1.2, 25.6 * dir, 0], [1.6, 25.6 * dir, -dive * sgn]);
  const shotAt = (band === 'plain' ? 1.4 : 1.7) + WRIST_CONTACT;
  if (scores) {
    const target = netPoint(shooter, 0.5 * sgn, band === 'plain' ? 0.2 : 0.35);
    b.shoot(shotAt, target, 2.15);
    b.act(g.G, 1.9, 'beaten');
    scoreAt(b, shooter, 2.15, target);
  } else {
    b.shoot(shotAt, vec(25.4 * dir, 0.5, -0.5 * sgn), 2.15);
    b.act(g.G, 1.9, band === 'plain' ? 'pad-save' : 'glove-save');
    b.event(2.15, 'save', g.G);
    b.held(g.G, 2.8);
    b.act(g.G, 2.3, 'cover');
    b.act(me, 2.3, 'slump');
  }
  return b.build();
}
