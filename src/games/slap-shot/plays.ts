/**
 * Formations and plays as scripts: where the eight players are over time, where the puck is and
 * what happens when. The rules decide the outcome; this only animates it. Pure: no three.js and no
 * DOM.
 */
import {
  END_DOT_X,
  END_DOT_Z,
  PUCK_H,
  ZONE_X,
  clamp,
  lerpVec,
  vec,
  type Vec,
} from '../../shared/hockey/geometry';
import {
  ACTORS,
  Builder,
  CREW,
  WRIST_CONTACT,
  SLAP_CONTACT,
  celebration,
  goalieSpots,
  ground,
  lerpVecXZ,
  netPoint,
  scoreAt,
  type ActorId,
  type Formation,
  type Move,
  type PlayScript,
  type Spot,
} from '../../shared/hockey/script';
import { shootoutShot } from '../../shared/hockey/shootout';
import {
  isOurGoal,
  isTheirGoal,
  type PlayKind,
  type Puck,
  type Side,
  type StopPlay,
  type Zone,
} from './rules';

export const MAX_STEP_SECONDS = 1.8;
export const MAX_SAVE_SECONDS = 2.0;
export const MAX_GOAL_SECONDS = 3.2;
/** How long their rush into our end takes, when their puck starts in another zone. */
export const RUSH_SECONDS = 0.6;

/** The longest a play of this kind may run. */
export function maxSeconds(kind: PlayKind): number {
  if (isOurGoal(kind) || isTheirGoal(kind) || kind === 'so-saved' || kind === 'so-stopped') {
    return MAX_GOAL_SECONDS;
  }
  return kind === 'save' ? MAX_SAVE_SECONDS : MAX_STEP_SECONDS;
}

const SKATER_X = 24;
const SKATER_Z = 11;
const clampSkater = (x: number, z: number): Vec =>
  ground(clamp(x, -SKATER_X, SKATER_X), clamp(z, -SKATER_Z, SKATER_Z));

/** The faceoff dot for a zone: the centre dot, or an end-zone dot. */
export function dotOf(zone: Zone): Vec {
  if (zone === 'neutral') return ground(0, 0);
  return ground(zone === 'our-end' ? -END_DOT_X : END_DOT_X, END_DOT_Z);
}

/** Where everybody stands for a puck. */
export function formation(puck: Puck): Formation {
  if (puck.kind === 'faceoff') {
    const dot = dotOf(puck.zone);
    const fx = dot.x;
    const fz = dot.z;
    const at = (x: number, z: number, lookX: number): Spot => ({
      pos: clampSkater(x, z),
      face: ground(lookX, fz),
    });
    return {
      carrier: null,
      puck: vec(fx, PUCK_H, fz),
      spots: {
        uC: at(fx - 0.7, fz, fx),
        tC: at(fx + 0.7, fz, fx),
        uW: at(fx - 1.2, fz + 5, fx + 3),
        tW: at(fx + 1.2, fz - 5, fx - 3),
        uD: at(fx - 5, fz - 3, fx + 3),
        tD: at(fx + 5, fz + 3, fx - 3),
        ...goalieSpots(fz),
      },
    };
  }
  const attacker = puck.side;
  const dir = attacker === 'us' ? 1 : -1;
  const X = ZONE_X[puck.zone];
  const a = attacker === 'us' ? 'u' : 't';
  const d = attacker === 'us' ? 't' : 'u';
  const carrierPos = clampSkater(X, 0);
  const lookAhead = (p: Vec): Vec => ground(p.x + 6 * dir, p.z);
  const attack = (p: Vec): Spot => ({ pos: p, face: lookAhead(p) });
  const defend = (p: Vec): Spot => ({ pos: p, face: carrierPos });
  return {
    carrier: `${a}C` as ActorId,
    puck: vec(carrierPos.x + 0.9 * dir, PUCK_H, carrierPos.z),
    spots: {
      [`${a}C`]: attack(carrierPos),
      [`${a}W`]: attack(clampSkater(X + 3 * dir, 7)),
      [`${a}D`]: attack(clampSkater(X - 6 * dir, -4)),
      [`${d}C`]: defend(clampSkater(X + 3 * dir, -1.5)),
      [`${d}W`]: defend(clampSkater(X + 5 * dir, 5)),
      [`${d}D`]: defend(clampSkater(X + 9 * dir, -2)),
      ...goalieSpots(carrierPos.z),
    } as Record<ActorId, Spot>,
  };
}

export function planPlay(
  kind: PlayKind,
  before: Puck,
  after: Puck,
  random: () => number,
): PlayScript {
  const sgn = random() < 0.5 ? -1 : 1;
  const S = formation(before);
  const E = formation(after);
  const mk = (duration: number, end: Record<ActorId, Spot & { move?: Move }> = E.spots) =>
    new Builder(duration, S, end);

  switch (kind) {
    case 'faceoff-win':
    case 'faceoff-loss':
      return faceoffPlay(kind === 'faceoff-win' ? 'us' : 'them', S, E);
    case 'stretch-pass': {
      const b = mk(1.5);
      b.path('uW', [0.95, -4.5, 6]);
      b.act('uC', 0.35, 'pass');
      b.sendTo('uW', 0.4, 0.95, 'air', 0.25);
      b.finishPuck(E.carrier);
      return b.build();
    }
    case 'tape-to-tape': {
      const b = mk(1.5);
      b.act('uC', 0.15, 'pass');
      b.sendTo('uW', 0.2, 0.6);
      b.finishPuck(E.carrier);
      return b.build();
    }
    case 'skate-out': {
      const b = mk(1.5);
      b.path('uC', [0.5, -13, -7], [1.0, -5, -9]);
      b.finishPuck(E.carrier);
      return b.build();
    }
    case 'spin-o-rama': {
      const b = mk(1.5);
      b.path('uC', [0.45, 5, -0.5, 'spin'], [1.05, 12, 1.5]);
      b.path('tD', [0.5, 6.8, -1.0], [1.0, 8.5, -3]);
      b.finishPuck(E.carrier);
      return b.build();
    }
    case 'toe-drag': {
      const b = mk(1.5);
      b.path('uC', [0.5, 5.5, -0.2, 'deke'], [1.1, 12, 0.8]);
      b.path('tD', [0.65, 7.5, -1.2, 'check'], [1.1, 8.5, -3.2]);
      b.finishPuck(E.carrier);
      return b.build();
    }
    case 'give-and-go':
      return giveAndGo('us', S, E);
    case 'dump-and-chase': {
      const b = mk(1.5);
      b.act('uC', 0.35, 'pass');
      b.send('slide', 0.5, 1.15, vec(23, PUCK_H, 10));
      b.path('uW', [1.15, 22.5, 9.5]);
      b.path('tD', [1.2, 18, 6]);
      b.event(1.15, 'steal', 'uW');
      b.held('uW', 1.16);
      b.finishPuck(E.carrier);
      return b.build();
    }
    case 'one-timer': {
      const b = mk(2.8, celebration('us'));
      b.path('uC', [1.0, 19, -3]);
      b.path('uW', [0.5, 20.5, 5.5], [1.0, 21, 4]);
      b.path('tG', [1.4, 25.6, -0.9]);
      b.act('uC', 0.1, 'pass');
      b.sendTo('uW', 0.15, 0.5);
      b.act('uW', 0.9, 'pass');
      b.sendTo('uC', 1.0, 1.45);
      b.act('uC', 1.15, 'slap');
      b.shoot(1.15 + SLAP_CONTACT, netPoint('us', sgn * 0.7, 1.05), 1.82);
      b.act('tG', 1.5, 'beaten');
      scoreAt(b, 'us', 1.82, netPoint('us', sgn * 0.7, 1.05));
      return b.build();
    }
    case 'wrist-shot': {
      const b = mk(2.8, celebration('us'));
      b.path('uC', [0.8, 19, -1]);
      b.path('tG', [1.2, 25.6, -0.4]);
      b.act('uC', 1.0, 'wrist');
      b.shoot(1.0 + WRIST_CONTACT, netPoint('us', sgn * 0.6, 1.05), 1.55);
      b.act('tG', 1.4, 'beaten');
      scoreAt(b, 'us', 1.55, netPoint('us', sgn * 0.6, 1.05));
      return b.build();
    }
    case 'rebound-goal': {
      const b = mk(2.8, celebration('us'));
      b.path('uD', [0.5, 14, -6]);
      b.path('uW', [1.4, 23.2, sgn * 3.6]);
      b.act('uC', 0.05, 'pass');
      b.sendTo('uD', 0.1, 0.5);
      b.act('uD', 0.5, 'slap');
      b.shoot(0.5 + SLAP_CONTACT, vec(25.7, 0.15, 0.25), 1.35);
      b.act('tG', 1.15, 'pad-save');
      b.event(1.35, 'save', 'tG');
      b.send('slide', 1.35, 1.7, vec(23.2, PUCK_H, sgn * 2.4));
      b.still(1.8);
      b.act('uW', 1.6, 'wrist');
      b.shoot(1.6 + WRIST_CONTACT, netPoint('us', sgn * 0.3, 0.12), 2.05);
      b.act('tG', 1.9, 'beaten');
      scoreAt(b, 'us', 2.05, netPoint('us', sgn * 0.3, 0.12));
      return b.build();
    }
    case 'picked-off': {
      const b = mk(1.5);
      b.act('uC', 0.15, 'pass');
      const lane = lerpVecXZ(b.pos('uC', 0.2), b.pos('uW', 0.75), 0.5);
      b.path('tW', [0.75, lane.x, lane.z]);
      b.sendTo('tW', 0.2, 0.75);
      b.event(0.75, 'steal', 'tW');
      b.finishPuck(E.carrier);
      return b.build();
    }
    case 'save': {
      const b = mk(2.0);
      b.act('uC', 0.15, 'wrist');
      b.shoot(0.15 + WRIST_CONTACT, vec(25.4, 0.9, 0.35), 0.8);
      b.act('tG', 0.5, 'glove-save');
      b.event(0.8, 'save', 'tG');
      b.held('tG', 1.5);
      b.act('tG', 0.95, 'cover');
      b.send('slide', 1.5, 1.9, vec(E.puck.x, PUCK_H, E.puck.z));
      b.still(2.0);
      return b.build();
    }
    case 'steal-score':
    case 'breakaway-against':
    case 'counter-rush':
      return goalAgainstFromOurPuck(kind, S, E, sgn);
    case 'body-check':
    case 'poke-check':
    case 'intercept':
    case 'shot-block':
    case 'goalie-save':
    case 'they-score-wrister':
    case 'they-score-deke':
      return theirPuckPlay(kind, before, E, sgn);
    case 'so-goal':
    case 'so-saved':
    case 'so-stopped':
    case 'so-goal-against':
      return shootoutShot(kind, 'C', 'solid', sgn);
  }
}

function faceoffPlay(winner: Side, S: Formation, E: Formation): PlayScript {
  const b = new Builder(1.2, S, E.spots);
  const w = CREW[winner];
  b.act('uC', 0.3, 'faceoff');
  b.act('tC', 0.3, 'faceoff');
  const dot = vec(S.puck.x, PUCK_H, S.puck.z);
  b.segs.push({ kind: 'air', t0: 0, t1: 0.15, a: vec(dot.x, 1.1, dot.z), b: dot, apex: 0 });
  b.event(0.15, 'drop');
  // The cursor starts after the drop.
  b.skipTo(0.15);
  b.still(0.35, dot);
  b.sendTo(w.D, 0.35, 0.8);
  b.finishPuck(E.carrier);
  return b.build();
}

function giveAndGo(side: Side, S: Formation, E: Formation): PlayScript {
  const b = new Builder(1.5, S, E.spots);
  const c = CREW[side];
  const c0 = S.spots[c.C].pos;
  const c1 = E.spots[c.C].pos;
  const mid = lerpVec(c0, c1, 0.6);
  b.path(c.C, [0.9, mid.x, clamp(mid.z - 2.5 * (side === 'us' ? 1 : -1), -9, 9)]);
  b.act(c.C, 0.2, 'pass');
  b.sendTo(c.W, 0.25, 0.55);
  b.finishPuck(E.carrier);
  return b.build();
}

function goalAgainstFromOurPuck(
  kind: 'steal-score' | 'breakaway-against' | 'counter-rush',
  S: Formation,
  _E: Formation,
  sgn: number,
): PlayScript {
  const end = celebration('them');
  const target = netPoint('them', sgn * 0.6, 1.05);
  if (kind === 'steal-score') {
    const b = new Builder(2.8, S, end);
    b.path('uC', [0.5, -16.5, 0.3]);
    b.path('tC', [0.5, -15.5, -0.6, 'poke'], [1.5, -22.5, 0.8]);
    b.event(0.5, 'steal', 'tC');
    b.sendTo('tC', 0.5, 0.7);
    b.path('uG', [1.5, -25.6, 0.3]);
    b.act('tC', 1.55, 'wrist');
    b.shoot(1.55 + WRIST_CONTACT, target, 2.05);
    b.act('uG', 1.95, 'beaten');
    scoreAt(b, 'them', 2.05, target);
    return b.build();
  }
  if (kind === 'breakaway-against') {
    const b = new Builder(2.8, S, end);
    const lost = b.pos('uC', 0.35);
    b.path('tC', [0.35, lost.x + 0.9, lost.z - 0.4, 'poke'], [1.85, -22.5, 0.5]);
    b.event(0.35, 'steal', 'tC');
    b.sendTo('tC', 0.35, 0.55);
    b.act('tC', 1.85, 'wrist');
    b.shoot(1.85 + WRIST_CONTACT, target, 2.35);
    b.act('uG', 2.2, 'beaten');
    scoreAt(b, 'them', 2.35, target);
    return b.build();
  }
  const b = new Builder(3.2, S, end);
  b.path('tC', [0.8, 10, -2], [1.5, -8, -1], [2.4, -20.5, 0.5]);
  b.act('uC', 0.1, 'wrist');
  b.shoot(0.1 + WRIST_CONTACT, vec(25.4, 0.9, 0.3), 0.75);
  b.act('tG', 0.45, 'glove-save');
  b.event(0.75, 'save', 'tG');
  b.held('tG', 1.0);
  b.act('tG', 0.8, 'cover');
  b.act('tG', 1.0, 'pass');
  b.send('air', 1.0, 1.5, b.blade('tC', 1.5), 0.5);
  b.event(1.0, 'pass', 'tG');
  b.held('tC', 1.5 + 1e-6);
  b.act('tC', 2.4, 'wrist');
  b.shoot(2.4 + WRIST_CONTACT, target, 2.85);
  b.act('uG', 2.7, 'beaten');
  scoreAt(b, 'them', 2.85, target);
  return b.build();
}

/** Their puck in any zone: they rush into our end if need be, then we stop them or they score. */
function theirPuckPlay(
  kind: StopPlay | 'they-score-wrister' | 'they-score-deke',
  before: Puck,
  E: Formation,
  sgn: number,
): PlayScript {
  const S = formation(before);
  const zone = before.kind === 'held' ? before.zone : 'our-end';
  const rush = zone === 'our-end' ? 0 : RUSH_SECONDS;
  const R = formation({ kind: 'held', side: 'them', zone: 'our-end' });
  const goal = kind === 'they-score-wrister' || kind === 'they-score-deke';
  const duration = goal ? 2.8 : 1.2 + rush;
  const b = new Builder(duration, S, goal ? celebration('them') : E.spots);
  const T = (t: number) => rush + t;
  if (rush > 0) {
    for (const id of ACTORS) {
      const p = R.spots[id].pos;
      b.path(id, [rush, p.x, p.z]);
      b.look(id, rush, R.spots[id].face);
    }
  }
  const X = ZONE_X['our-end'];
  if (kind === 'body-check' || kind === 'poke-check') {
    const hit = kind === 'body-check';
    const tt = T(hit ? 0.22 : 0.3);
    const tc = b.pos('tC', tt);
    const reach = hit ? 0.9 : 1.3;
    b.path('uC', [tt, tc.x - reach, tc.z + 0.3]);
    b.act('uC', tt, hit ? 'check' : 'poke');
    if (hit) {
      b.act('tC', tt, 'hit-fall');
      b.event(tt, 'check', 'uC');
    } else {
      b.event(tt, 'steal', 'uC');
    }
    b.sendTo('uC', tt, T(hit ? 0.75 : 0.72));
    b.finishPuck(E.carrier);
    return b.build();
  }
  if (kind === 'intercept') {
    b.act('tC', T(0.05), 'pass');
    const lane = lerpVecXZ(b.pos('tC', T(0.1)), b.pos('tW', T(0.5)), 0.5);
    b.path('uC', [T(0.5), lane.x, lane.z]);
    b.sendTo('uC', T(0.1), T(0.5));
    b.event(T(0.5), 'steal', 'uC');
    b.finishPuck(E.carrier);
    return b.build();
  }
  if (kind === 'shot-block') {
    b.act('tC', T(0.05), 'pass');
    b.sendTo('tD', T(0.1), T(0.4));
    b.path('uD', [T(0.65), X - 4.5, -1.4, 'block']);
    b.act('tD', T(0.25), 'slap');
    b.shoot(T(0.25) + SLAP_CONTACT, vec(X - 4.5, 0.5, -1.4), T(0.85), 0);
    b.event(T(0.85), 'check', 'uD');
    b.send('slide', T(0.85), T(0.95), vec(X - 4.6, PUCK_H, -1.0));
    b.finishPuck(E.carrier);
    return b.build();
  }
  if (kind === 'goalie-save') {
    b.act('tC', T(0.1), 'wrist');
    b.shoot(T(0.1) + WRIST_CONTACT, vec(-25.4, 0.9, 0.3), T(0.7));
    b.act('uG', T(0.4), 'glove-save');
    b.event(T(0.7), 'save', 'uG');
    b.held('uG', T(0.85));
    b.sendTo('uD', T(0.85), T(1.05));
    b.finishPuck(E.carrier);
    return b.build();
  }
  // Their goals.
  const target = netPoint('them', sgn * 0.6, 1.05);
  if (kind === 'they-score-wrister') {
    b.path('tC', [T(0.9), -20.5, 2.5]);
    b.act('tC', T(0.85), 'wrist');
    b.path('uG', [T(0.9), -25.6, 0.6]);
    b.shoot(T(0.85) + WRIST_CONTACT, target, T(1.45));
    b.act('uG', T(1.3), 'beaten');
    scoreAt(b, 'them', T(1.45), target);
    return b.build();
  }
  const low = netPoint('them', 0.2, 0.15);
  b.path('tC', [T(0.7), -22.5, 3, 'deke'], [T(1.3), -25.5, -0.5]);
  b.path('uG', [T(0.7), -25.6, 1.0], [T(1.3), -25.6, -0.2]);
  b.act('tC', T(1.35), 'wrist');
  b.shoot(T(1.35) + WRIST_CONTACT, low, T(1.8));
  b.act('uG', T(1.5), 'beaten');
  scoreAt(b, 'them', T(1.8), low);
  return b.build();
}
