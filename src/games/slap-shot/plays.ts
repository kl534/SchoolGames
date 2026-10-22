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
  BLADE_AHEAD,
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

export const MAX_STEP_SECONDS = 7.6;
export const MAX_SAVE_SECONDS = 6.0;
export const MAX_GOAL_SECONDS = 9.6;
/** How long their rush into our end takes, by the zone their puck starts in. */
export const RUSH_SECONDS: Record<Zone, number> = { 'our-end': 0, neutral: 2.0, 'their-end': 4.0 };

/** Which of a play's two build-ups. */
export type Variant = 'a' | 'b';

/**
 * A Slap Shot play: the script plus `moment`, the script time of the thing the play is named after
 * (the goal, save, steal, hit or pass). The call and the banner wait for it.
 */
export type SlapPlay = PlayScript & { moment: number };

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

// ---------- Writing plays ----------

const flat = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * A pass from whoever has the puck to `to`. It leaves at `t0` at about `mps` metres a second and
 * the time it arrives is returned.
 */
function pass(
  b: Builder,
  to: ActorId,
  t0: number,
  mps = 14,
  kind: 'slide' | 'air' = 'slide',
  apex = 0,
): number {
  const from = b.holder;
  if (from) b.act(from, Math.max(t0 - 0.05, 0.02), 'pass');
  const origin = from ? b.blade(from, t0) : ground(0, 0);
  let t1 = t0 + 0.4;
  for (let i = 0; i < 4; i++) t1 = t0 + Math.max(0.25, flat(origin, b.blade(to, t1)) / mps);
  b.sendTo(to, t0, t1, kind, apex);
  return t1;
}

/** A pass that reaches `to` at `t1`, leaving as late as it can. Returns when it leaves. */
function passArriving(b: Builder, to: ActorId, t1: number, mps = 14): number {
  const from = b.holder;
  let t0 = t1 - 0.5;
  for (let i = 0; i < 4; i++) {
    const origin = from ? b.blade(from, t0) : ground(0, 0);
    t0 = t1 - Math.max(0.25, flat(origin, b.blade(to, t1)) / mps);
  }
  if (from) b.act(from, Math.max(t0 - 0.05, 0.02), 'pass');
  b.sendTo(to, t0, t1);
  return t0;
}

/** A pass the thief cuts off: it leaves at `t0` and the thief takes it from the lane at `t1`. */
function intercepted(
  b: Builder,
  thief: ActorId,
  aimAt: ActorId,
  t0: number,
  t1: number,
  frac = 0.55,
): void {
  const from = b.holder;
  if (!from) return;
  b.act(from, Math.max(t0 - 0.05, 0.02), 'pass');
  const lane = lerpVecXZ(b.blade(from, t0), b.pos(aimAt, t1), frac);
  b.path(thief, [t1, lane.x, lane.z]);
  b.sendTo(thief, t0, t1);
  b.event(t1, 'steal', thief);
}

/**
 * Puts a shooter at `from`, looking at `to`, so the shot arrives at `arrive`. Returns the time the
 * stick meets the puck; the caller sends the puck with `b.shoot(contact, to, arrive)` once it has
 * written the passes that come first.
 */
function aimShot(
  b: Builder,
  who: ActorId,
  move: 'wrist' | 'slap',
  from: Vec,
  to: Vec,
  arrive: number,
  mps = 22,
): number {
  const wind = move === 'slap' ? SLAP_CONTACT : WRIST_CONTACT;
  const len = flat(from, to) || 1;
  const release = ground(
    from.x + ((to.x - from.x) / len) * BLADE_AHEAD,
    from.z + ((to.z - from.z) / len) * BLADE_AHEAD,
  );
  const contact = arrive - Math.max(0.1, flat(release, to) / mps);
  const act = contact - wind;
  b.path(who, [act, from.x, from.z, move], [arrive, from.x, from.z]);
  b.look(who, act, ground(to.x, to.z));
  return contact;
}

/** Where a shooter stands so that his blade is on a puck at `at`, shooting at `to`. */
function standBehind(at: Vec, to: Vec): Vec {
  const len = flat(at, to) || 1;
  return ground(
    at.x - ((to.x - at.x) / len) * BLADE_AHEAD,
    at.z - ((to.z - at.z) / len) * BLADE_AHEAD,
  );
}

const done = (script: PlayScript, moment: number): SlapPlay => ({ ...script, moment });

/** The time of the first `goal` or `save` event of a shootout shot. */
function firstResult(script: PlayScript): number {
  return script.events.find((e) => e.type === 'goal' || e.type === 'save')?.t ?? script.duration;
}

export function planPlay(
  kind: PlayKind,
  before: Puck,
  after: Puck,
  random: () => number,
  variant?: Variant,
): SlapPlay {
  const sgn = random() < 0.5 ? -1 : 1;
  if (
    kind === 'so-goal' ||
    kind === 'so-saved' ||
    kind === 'so-stopped' ||
    kind === 'so-goal-against'
  ) {
    const script = shootoutShot(kind, 'C', 'solid', sgn);
    return done(script, firstResult(script));
  }
  const v: Variant = variant ?? (random() < 0.5 ? 'a' : 'b');
  const S = formation(before);
  const E = formation(after);
  switch (kind) {
    case 'faceoff-win':
    case 'faceoff-loss':
      return faceoffPlay(kind === 'faceoff-win' ? 'us' : 'them', S, E, v);
    case 'stretch-pass':
      return stretchPass(S, E, v);
    case 'tape-to-tape':
      return tapeToTape(S, E, v);
    case 'skate-out':
      return skateOut(S, E, v);
    case 'spin-o-rama':
    case 'toe-drag':
      return getPastDefender(kind, S, E, v);
    case 'give-and-go':
      return giveAndGo(S, E, v);
    case 'dump-and-chase':
      return dumpAndChase(S, E, v);
    case 'picked-off':
      return pickedOff(S, E, v);
    case 'save':
      return saveShot(S, E, v);
    case 'one-timer':
    case 'wrist-shot':
    case 'rebound-goal':
      return ourGoal(kind, S, v, sgn);
    case 'steal-score':
    case 'breakaway-against':
    case 'counter-rush':
      return goalAgainstFromOurPuck(kind, S, v, sgn);
    case 'body-check':
    case 'poke-check':
    case 'intercept':
    case 'shot-block':
    case 'goalie-save':
    case 'they-score-wrister':
    case 'they-score-deke':
      return theirPuckPlay(kind, before, E, v, sgn);
    default:
      throw new Error(`no play for ${kind}`);
  }
}

// ---------- Faceoffs ----------

function faceoffPlay(winner: Side, S: Formation, E: Formation, v: Variant): SlapPlay {
  const b = new Builder(3.6, S, E.spots);
  const w = CREW[winner];
  for (const id of ['uC', 'tC'] as const) {
    const p = S.spots[id].pos;
    // They stand over the dot until the drop, crouch for the draw, then get going.
    b.path(id, [1.4, p.x, p.z, 'faceoff'], [1.9, p.x, p.z]);
  }
  const dot = vec(S.puck.x, PUCK_H, S.puck.z);
  const hand = vec(dot.x, 1.1, dot.z);
  b.still(1.35, hand);
  b.segs.push({ kind: 'air', t0: 1.35, t1: 1.5, a: hand, b: dot, apex: 0 });
  b.event(1.5, 'drop');
  // The cursor starts after the drop.
  b.skipTo(1.5);
  b.still(1.55, dot);
  const mid = (id: ActorId, k: number) => lerpVec(S.spots[id].pos, E.spots[id].pos, k);
  let moment: number;
  if (v === 'a') {
    // The draw goes back to the winner's defenceman, who carries it and gives it to the centre.
    const m = mid(w.D, 0.5);
    b.path(w.D, [2.7, m.x, m.z]);
    moment = 1.9;
    b.sendTo(w.D, 1.55, moment);
    pass(b, w.C, 2.7, 14);
  } else {
    // The centre taps it forward to the winger, who curls and gives it back.
    const m = mid(w.W, 0.6);
    b.path(w.W, [2.8, m.x, m.z]);
    moment = 1.9;
    b.sendTo(w.W, 1.55, moment);
    pass(b, w.C, 2.9, 14);
  }
  b.finishPuck(E.carrier);
  return done(b.build(), moment);
}

// ---------- Our advances ----------

function stretchPass(S: Formation, E: Formation, v: Variant): SlapPlay {
  const b = new Builder(4.5, S, E.spots);
  b.path('uW', [1.2, -12, 9.5], [3.4, -3, 9.5]);
  if (v === 'a') {
    // uC wheels behind our net while uW breaks up the far boards.
    b.look('uC', 0, ground(-23, 4.5));
    b.path('uC', [0.8, -23, 4.5], [1.4, -28.4, 0.8], [2.0, -25, -4.5]);
    b.path('uD', [2.0, -17, -5]);
  } else {
    // uC gives it to uD behind the net, uD skates up and returns it.
    b.path('uD', [0.7, -25, -3], [2.0, -15, -4]);
    b.path('uC', [2.2, -10, 0]);
    pass(b, 'uD', 0.1, 18);
    pass(b, 'uC', 1.7, 18);
  }
  const moment = pass(b, 'uW', 2.7, 30, 'air', 0.25);
  pass(b, 'uC', moment + 0.5, 25);
  b.finishPuck(E.carrier);
  return done(b.build(), moment);
}

function tapeToTape(S: Formation, E: Formation, v: Variant): SlapPlay {
  const b = new Builder(4.5, S, E.spots);
  if (v === 'a') {
    // A quick give and take with uW, then the pass up the ice.
    b.path('uW', [0.9, -12.5, 3.5], [1.7, -10, 3], [3.2, -2, 7]);
    pass(b, 'uW', 0.5, 14);
    pass(b, 'uC', 1.3, 14);
  } else {
    // uD passes up to uC, who sends it along the boards.
    b.path('uD', [0.6, -24, -2], [2.0, -14, -4]);
    b.path('uW', [1.5, -9, 9], [3.2, -2, 9.5]);
    pass(b, 'uD', 0.1, 16);
    pass(b, 'uC', 0.8, 16);
  }
  const moment = pass(b, 'uW', 2.6, 16);
  pass(b, 'uC', moment + 0.4, 20);
  b.finishPuck(E.carrier);
  return done(b.build(), moment);
}

function skateOut(S: Formation, E: Formation, v: Variant): SlapPlay {
  const b = new Builder(4.5, S, E.spots);
  let moment: number;
  if (v === 'a') {
    // Behind our net, then up the boards past the forecheck.
    b.look('uC', 0, ground(-28.4, 0.8));
    b.path('uC', [1.1, -28.4, 0.8], [2.0, -24.5, -6], [3.6, -7.6, -4]);
    b.path('tC', [1.8, -22, -3]);
    moment = 3.6;
  } else {
    // A fake pass to uD, then a cut to the middle.
    b.path('uC', [1.0, -19.5, 3, 'pass'], [2.2, -12.5, -1], [3.4, -7.6, -1]);
    b.path('uD', [1.0, -22, -6], [2.5, -15, -6]);
    b.path('tC', [1.5, -18, 0], [2.8, -12, -2]);
    moment = 3.4;
  }
  b.finishPuck(E.carrier);
  return done(b.build(), moment);
}

/** Spin-o-rama and toe drag: uC beats a defender at their blue line. */
function getPastDefender(
  kind: 'spin-o-rama' | 'toe-drag',
  S: Formation,
  E: Formation,
  v: Variant,
): SlapPlay {
  const b = new Builder(4.5, S, E.spots);
  const spin = kind === 'spin-o-rama';
  const move = spin ? 'spin' : 'deke';
  const victim: ActorId = v === 'a' ? 'tD' : 'tC';
  if (v === 'a') {
    b.path('uC', [1.3, 4, 3], [2.6, 8, -0.5, move], [3.2, 10, 0.5]);
    b.path('uW', [1.5, 6, 9], [3.0, 14, 9]);
  } else if (spin) {
    // uC drops it to uD and gets it back.
    b.path('uD', [0.8, -4, -3], [2.0, 2, -3.5]);
    b.path('uC', [1.6, 2.5, 0], [2.6, 8, -0.5, move], [3.2, 10, 0.5]);
    b.path('uW', [1.5, 6, 9], [3.0, 14, 9]);
    pass(b, 'uD', 0.4, 14);
    pass(b, 'uC', 1.1, 14);
  } else {
    // uW carries, passes to uC.
    b.path('uW', [0.7, 3.5, 5.5], [1.5, 5, 6]);
    b.path('uC', [1.6, 3, 0], [2.6, 7.5, -0.2, move], [3.2, 10.5, 0.8]);
    pass(b, 'uW', 0.2, 14);
    pass(b, 'uC', 1.0, 14);
  }
  b.path(victim, [2.4, 10.5, -1.2, 'check'], [3.2, 12.5, -3.8]);
  b.finishPuck(E.carrier);
  return done(b.build(), 3.2);
}

function giveAndGo(S: Formation, E: Formation, v: Variant): SlapPlay {
  const b = new Builder(4.5, S, E.spots);
  const partner: ActorId = v === 'a' ? 'uW' : 'uD';
  b.path('tD', [2.2, 9.5, -1.5, 'check'], [3.2, 11, -5]);
  if (v === 'a') {
    // uC and uW cross: uW cuts to the middle.
    b.path('uC', [1.2, 3.5, 4.5], [2.8, 9, -3], [3.4, 11.5, -2]);
    b.path('uW', [1.9, 5, 0.5], [2.6, 7, 0.3]);
    pass(b, partner, 1.5, 14);
  } else {
    // The same with uD, joining from the point.
    b.path('uC', [1.2, 3, 3.5], [2.9, 9, -2.5], [3.5, 11, -1.5]);
    b.path('uD', [1.8, 2, -3.5], [2.6, 5, -3.8]);
    pass(b, partner, 1.3, 14);
  }
  const moment = pass(b, 'uC', 2.6, 14);
  b.finishPuck(E.carrier);
  return done(b.build(), moment);
}

function dumpAndChase(S: Formation, E: Formation, v: Variant): SlapPlay {
  const b = new Builder(4.5, S, E.spots);
  b.path('uW', [1.5, 6, 9], [3.4, 22.5, 9.5]);
  b.path('tD', [2.4, 12, 3], [3.4, 19, 6]);
  if (v === 'a') {
    // uC carries to the red line and dumps it in.
    b.path('uC', [1.7, 5, 0], [3.0, 11, 0]);
    b.act('uC', 1.85, 'pass');
    b.send('slide', 1.9, 3.4, vec(23, PUCK_H, 10));
  } else {
    // uD dumps it in from our side of the red line.
    b.path('uD', [0.7, -5, -3.5], [1.6, -2, -3]);
    b.path('uC', [1.0, 5, 0]);
    pass(b, 'uD', 0.2, 14);
    b.act('uD', 1.55, 'pass');
    b.send('slide', 1.6, 3.4, vec(23, PUCK_H, 10));
  }
  // uW races tD to the corner and wins the puck.
  b.event(3.4, 'steal', 'uW');
  b.held('uW', 3.41);
  pass(b, 'uC', 3.7, 25);
  b.finishPuck(E.carrier);
  return done(b.build(), 3.4);
}

function pickedOff(S: Formation, E: Formation, v: Variant): SlapPlay {
  const b = new Builder(4.5, S, E.spots);
  const X = S.spots.uC.pos.x;
  if (v === 'a') {
    // uC passes toward uW and tW steps into the lane.
    b.path('uC', [1.6, X + 3.5, 0.5], [2.7, X + 4.5, 0.5]);
    b.path('uW', [1.0, X + 5, 6], [3.0, X + 8, 6]);
    intercepted(b, 'tW', 'uW', 2.6, 3.0, 0.6);
    pass(b, 'tC', 3.4, 25);
  } else {
    // uC passes back toward uD and tC steps into the lane.
    b.path('uC', [1.6, X + 3, 0], [2.7, X + 4, 0]);
    b.path('uD', [1.5, X - 3, -5]);
    intercepted(b, 'tC', 'uD', 2.6, 3.0, 0.5);
  }
  b.finishPuck(E.carrier);
  return done(b.build(), 3.0);
}

// ---------- Our shots ----------

function saveShot(S: Formation, E: Formation, v: Variant): SlapPlay {
  const b = new Builder(6.0, S, E.spots);
  const SAVE = 4.0;
  const to = vec(25.4, 0.9, 0.35);
  let contact: number;
  let aimed = to;
  if (v === 'a') {
    // uC and uW work it around the zone, then uC shoots.
    b.path('uW', [0.9, 20, 8.5], [2.0, 18, 9]);
    b.path('uC', [1.0, 15.5, 1.5], [2.2, 17, -3]);
    contact = aimShot(b, 'uC', 'wrist', ground(19.5, -1.5), to, SAVE);
    pass(b, 'uW', 0.3, 14);
    pass(b, 'uC', 1.5, 14);
  } else {
    // uD shoots from the point.
    b.path('uD', [0.9, 12, -5]);
    b.path('uC', [1.5, 16, 2]);
    b.path('uW', [2.0, 19, 9], [3.5, 21, 3]);
    aimed = vec(25.4, 0.5, -0.3);
    contact = aimShot(b, 'uD', 'slap', ground(14, -1), aimed, SAVE);
    pass(b, 'uD', 0.4, 14);
  }
  b.shoot(contact, aimed, SAVE);
  b.act('tG', SAVE - 0.3, v === 'a' ? 'glove-save' : 'pad-save');
  b.event(SAVE, 'save', 'tG');
  b.held('tG', SAVE + 0.8);
  b.act('tG', SAVE + 0.15, 'cover');
  b.send('slide', SAVE + 0.8, SAVE + 1.3, vec(E.puck.x, PUCK_H, E.puck.z));
  b.still(6.0);
  return done(b.build(), SAVE);
}

function ourGoal(
  kind: 'one-timer' | 'wrist-shot' | 'rebound-goal',
  S: Formation,
  v: Variant,
  sgn: number,
): SlapPlay {
  const b = new Builder(8.4, S, celebration('us'));
  const GOAL = 6.4;
  const net = (z: number, y: number) => netPoint('us', z, y);
  b.path('tG', [GOAL - 0.5, 25.6, -0.9 * sgn]);
  if (kind === 'one-timer') {
    const target = net(sgn * 0.7, 1.05);
    const slot = ground(19.5, -1.5);
    const contact = aimShot(b, 'uC', 'slap', slot, target, GOAL);
    if (v === 'a') {
      // A cycle: down low, back to the point, along the line, to the half-wall, across to uC.
      b.look('uC', 0, ground(22, -5));
      b.path('uC', [0.9, 22, -5], [3.0, 20, -3.5]);
      b.path('uD', [1.7, 12, -5], [3.0, 12.5, 3]);
      b.path('uW', [1.5, 20, 9], [3.7, 19.5, 10], [4.8, 21, 9.5]);
      pass(b, 'uD', 1.0, 14);
      pass(b, 'uW', 3.1, 14);
    } else {
      // uW carries behind the net and centres it.
      b.path('uC', [1.8, 15.5, 3.5], [4.0, 18.5, 3.5]);
      b.path(
        'uW',
        [1.0, 22, 6],
        [2.3, 25.5, 4.5],
        [3.4, 28.4, 0],
        [4.5, 25.5, -4.5],
        [5.4, 23.5, -6],
      );
      b.path('uD', [3.0, 12, -6], [5.0, 13, 2]);
      pass(b, 'uW', 0.3, 14);
    }
    passArriving(b, 'uC', contact - 0.03, 15);
    b.shoot(contact, target, GOAL);
    b.act('tG', GOAL - 0.3, 'beaten');
    scoreAt(b, 'us', GOAL, target);
    return done(b.build(), GOAL);
  }
  if (kind === 'wrist-shot') {
    const target = net(sgn * 0.6, 1.05);
    const spot = v === 'a' ? ground(20.5, 0.5) : ground(21, 0.2);
    const contact = aimShot(b, 'uC', 'wrist', spot, target, GOAL);
    if (v === 'a') {
      // uC works the half-wall, drops it to uD, gets it back and walks in.
      b.path('uC', [1.5, 18, 9], [3.8, 18.5, 8]);
      b.path('uD', [2.3, 14.5, 3], [3.4, 14, 3.5]);
      b.path('uW', [1.5, 22, 3.5], [4.0, 22.5, -3]);
      pass(b, 'uD', 1.8, 14);
      pass(b, 'uC', 3.2, 14);
    } else {
      // uW passes from the corner, uC dekes tC and shoots.
      b.path('uW', [0.9, 23, 8], [2.2, 25.2, 9.3]);
      b.path('uC', [1.5, 18, 3], [3.2, 20, 2], [3.5, 20.2, 1.6, 'deke'], [4.3, 21, 0.5]);
      b.path('tC', [3.7, 20.8, 0.6, 'check'], [4.6, 22.5, 4]);
      pass(b, 'uW', 0.3, 14);
      pass(b, 'uC', 2.5, 14);
    }
    b.shoot(contact, target, GOAL);
    b.act('tG', GOAL - 0.3, 'beaten');
    scoreAt(b, 'us', GOAL, target);
    return done(b.build(), GOAL);
  }
  // Rebound goal: a shot, a pad save and a rebound that uW buries.
  const SAVE = 5.7;
  const first = vec(25.7, 0.15, 0.25);
  const rest = vec(23.2, PUCK_H, sgn * 2.4);
  const target = net(sgn * 0.3, 0.12);
  const shooter: ActorId = v === 'a' ? 'uD' : 'uC';
  const from = v === 'a' ? ground(13.5, -1.5) : ground(19.5, 4.5);
  const contact1 = aimShot(b, shooter, 'slap', from, first, SAVE);
  const stand = standBehind(rest, target);
  const contact2 = aimShot(b, 'uW', 'wrist', stand, target, GOAL, 18);
  if (v === 'a') {
    // A cycle: uC to uW in the corner, uW to uD at the point, uD shoots.
    b.path('uW', [1.0, 23, 8], [2.0, 24, 9.5], [4.2, 23.5, sgn * 5]);
    b.path('uD', [3.1, 12.5, 3]);
    b.path('uC', [2.5, 20, -2], [4.0, 21, 1]);
    pass(b, 'uW', 0.3, 14);
    pass(b, 'uD', 2.2, 14);
  } else {
    // uC takes it from uW and shoots from the circle.
    b.path('uW', [1.0, 23, 8], [2.0, 24, 9.5], [4.2, 23.5, sgn * 5]);
    b.path('uC', [1.2, 15, 5], [2.7, 19.5, 4.5], [3.7, 18, 6]);
    pass(b, 'uW', 0.3, 14);
    pass(b, 'uC', 2.0, 14);
  }
  b.shoot(contact1, first, SAVE);
  b.act('tG', SAVE - 0.55, 'pad-save');
  b.event(SAVE, 'save', 'tG');
  b.send('slide', SAVE, SAVE + 0.35, rest);
  b.shoot(contact2, target, GOAL);
  b.act('tG', GOAL - 0.3, 'beaten');
  scoreAt(b, 'us', GOAL, target);
  return done(b.build(), GOAL);
}

// ---------- Goals against, from our puck ----------

function goalAgainstFromOurPuck(
  kind: 'steal-score' | 'breakaway-against' | 'counter-rush',
  S: Formation,
  v: Variant,
  sgn: number,
): SlapPlay {
  const end = celebration('them');
  const target = netPoint('them', sgn * 0.6, 1.05);
  if (kind === 'steal-score') {
    const b = new Builder(8.4, S, end);
    const GOAL = 6.4;
    const contact = aimShot(b, 'tC', 'wrist', ground(-22.5, 0.8), target, GOAL);
    b.path('uG', [GOAL - 0.5, -25.6, 0.3]);
    if (v === 'a') {
      // uC carries behind our net; tC forechecks and pokes it away.
      b.look('uC', 0, ground(-23, 4.5));
      b.path('uC', [0.9, -23, 4.5], [1.7, -28.4, 0.5], [2.9, -24, -3]);
      b.path('tC', [1.5, -21, -2], [3.0, -24, -2.5, 'poke'], [4.4, -19, -5]);
      b.event(3.0, 'steal', 'tC');
      b.sendTo('tC', 3.0, 3.3);
    } else {
      // uD's pass to uC is cut off by tW, who finds tC.
      b.path('uD', [0.8, -24, -4.5], [1.6, -22, -5]);
      b.path('uC', [1.0, -15, 3], [3.2, -14, 1]);
      b.path('tC', [4.0, -19, -2.5]);
      pass(b, 'uD', 0.3, 14);
      intercepted(b, 'tW', 'uC', 2.6, 3.0, 0.5);
      pass(b, 'tC', 3.4, 14);
    }
    b.shoot(contact, target, GOAL);
    b.act('uG', GOAL - 0.3, 'beaten');
    scoreAt(b, 'them', GOAL, target);
    return done(b.build(), GOAL);
  }
  if (kind === 'breakaway-against') {
    const b = new Builder(8.4, S, end);
    const GOAL = 6.4;
    const contact = aimShot(b, 'tC', 'wrist', ground(-22.5, 0.5), target, GOAL);
    b.path('uG', [GOAL - 0.5, -25.6, 0.5]);
    if (v === 'a') {
      // tC pokes it off uC's stick and is gone.
      b.path('uC', [2.4, 4, 0]);
      const lost = b.pos('uC', 2.4);
      b.path('tC', [2.4, lost.x + 0.9, lost.z - 0.4, 'poke']);
      b.event(2.4, 'steal', 'tC');
      b.sendTo('tC', 2.4, 2.65);
    } else {
      // uC's pass is picked off by tW, who springs tC.
      b.path('uC', [1.5, 2, 1]);
      b.path('uW', [1.0, 5, 6], [2.4, 7, 5]);
      b.path('tC', [3.3, -5, -1.5]);
      intercepted(b, 'tW', 'uW', 2.0, 2.4, 0.5);
      pass(b, 'tC', 2.7, 14);
    }
    b.shoot(contact, target, GOAL);
    b.act('uG', GOAL - 0.3, 'beaten');
    scoreAt(b, 'them', GOAL, target);
    return done(b.build(), GOAL);
  }
  // Counter-rush: we shoot and are saved, then they go the other way.
  const b = new Builder(9.6, S, end);
  const SAVE = 2.5;
  const GOAL = 7.6;
  const shot = vec(25.4, 0.9, 0.3);
  const c1 = aimShot(b, 'uC', 'wrist', ground(19.5, -1.5), shot, SAVE);
  b.path('uW', [0.9, 20, 8.5], [2.0, 19, 9]);
  pass(b, 'uW', 0.2, 14);
  pass(b, 'uC', 1.0, 14);
  b.shoot(c1, shot, SAVE);
  b.act('tG', SAVE - 0.3, 'glove-save');
  b.event(SAVE, 'save', 'tG');
  b.held('tG', 3.0);
  b.act('tG', SAVE + 0.15, 'cover');
  b.act('tG', 3.0, 'pass');
  const shooter: ActorId = v === 'a' ? 'tC' : 'tW';
  const spot = v === 'a' ? ground(-19.5, 0.8) : ground(-19.5, 3.5);
  const c2 = aimShot(b, shooter, 'wrist', spot, target, GOAL);
  b.path('tC', [3.8, 8, -2], [5.4, -8, -1.2]);
  b.path('tW', [3.0, 12, 5], [5.4, -6, 6]);
  b.path('uD', [5.5, -14, -1]);
  b.sendTo('tC', 3.0, 3.8, 'air', 0.5);
  if (v === 'b') {
    // tC passes across to tW, who scores.
    b.path('tC', [6.4, -13, -1.5]);
    pass(b, 'tW', 6.4, 14);
  }
  b.shoot(c2, target, GOAL);
  b.act('uG', GOAL - 0.3, 'beaten');
  scoreAt(b, 'them', GOAL, target);
  return done(b.build(), GOAL);
}

// ---------- Their puck ----------

/** Their puck in any zone: they rush into our end if need be, then we stop them or they score. */
function theirPuckPlay(
  kind: StopPlay | 'they-score-wrister' | 'they-score-deke',
  before: Puck,
  E: Formation,
  v: Variant,
  sgn: number,
): SlapPlay {
  const S = formation(before);
  const zone = before.kind === 'held' ? before.zone : 'our-end';
  const rush = RUSH_SECONDS[zone];
  const R = formation({ kind: 'held', side: 'them', zone: 'our-end' });
  const goal = kind === 'they-score-wrister' || kind === 'they-score-deke';
  const duration = goal ? 8.4 : 3.6 + rush;
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
    const tt = T(2.2);
    const carrier: ActorId = v === 'a' ? 'tC' : 'tW';
    const taker: ActorId = hit ? (v === 'a' ? 'uC' : 'uD') : v === 'a' ? 'uC' : 'uW';
    if (v === 'a') {
      b.path('tC', [T(1.1), -17, 3], [tt, -18.5, 3.8]);
      b.path('uC', [T(1.1), -21.5, 2.5]);
    } else {
      b.path('tW', [T(1.2), -20, 8], [tt, -20, 5.5]);
      b.path('uD', [T(1.2), -24, 2]);
      if (!hit) b.path('uW', [T(1.2), -23.5, 7]);
      pass(b, 'tW', T(0.5), 14);
    }
    const at = b.pos(carrier, tt);
    const reach = hit ? 0.9 : 1.3;
    b.path(taker, [tt, at.x - reach, at.z + 0.3]);
    b.act(taker, tt, hit ? 'check' : 'poke');
    if (hit) {
      b.act(carrier, tt, 'hit-fall');
      b.event(tt, 'check', taker);
    } else {
      b.event(tt, 'steal', taker);
    }
    b.sendTo(taker, tt, tt + (hit ? 0.55 : 0.42));
    b.finishPuck(E.carrier);
    return done(b.build(), tt);
  }
  if (kind === 'intercept') {
    const M = T(2.0);
    if (v === 'a') {
      // tC passes toward tW and uC steps into the lane.
      b.path('tC', [T(1.0), -16, -2]);
      b.path('tW', [T(1.0), -20, 8], [M, -21, 9]);
      const lane = lerpVecXZ(b.blade('tC', T(1.5)), b.pos('tW', M), 0.7);
      b.path('uC', [M, lane.x, lane.z]);
      b.act('tC', T(1.45), 'pass');
      b.sendTo('uC', T(1.5), M);
      b.event(M, 'steal', 'uC');
    } else {
      // tD passes up to tC and uW cuts it off.
      b.path('tD', [T(0.9), -12, -3]);
      b.path('tC', [T(1.0), -18, -2]);
      pass(b, 'tD', T(0.3), 14);
      intercepted(b, 'uW', 'tC', T(1.6), M, 0.6);
    }
    b.finishPuck(E.carrier);
    return done(b.build(), M);
  }
  if (kind === 'shot-block') {
    const M = T(2.4);
    if (v === 'a') {
      // tC to tD at the point; tD slaps it and uD blocks.
      const block = vec(X - 4.5, 0.5, -1.4);
      const contact = aimShot(b, 'tD', 'slap', ground(-11, -3), block, M);
      b.path('uD', [M, block.x, block.z, 'block']);
      pass(b, 'tD', T(0.6), 14);
      b.shoot(contact, block, M);
    } else {
      // tW shoots from the circle and uC blocks.
      const block = vec(-21.4, 0.5, 3.0);
      const contact = aimShot(b, 'tW', 'wrist', ground(-16.5, 6.5), block, M);
      b.path('uC', [M, block.x, block.z, 'block']);
      pass(b, 'tW', T(0.5), 14);
      b.shoot(contact, block, M);
    }
    const blocker: ActorId = v === 'a' ? 'uD' : 'uC';
    b.event(M, 'check', blocker);
    b.send('slide', M, M + 0.1, vec(b.pos(blocker, M).x - 0.1, PUCK_H, b.pos(blocker, M).z + 0.4));
    b.sendTo(blocker, M + 0.1, M + 0.35);
    b.finishPuck(E.carrier);
    return done(b.build(), M);
  }
  if (kind === 'goalie-save') {
    const M = T(2.2);
    const shot = v === 'a' ? vec(-25.4, 0.9, 0.3) : vec(-25.4, 0.2, 0.8);
    const shooter: ActorId = v === 'a' ? 'tC' : 'tW';
    const spot = v === 'a' ? ground(-19.5, 1.5) : ground(-18, 6.5);
    const contact = aimShot(b, shooter, 'wrist', spot, shot, M);
    if (v === 'a') {
      b.path('tC', [T(0.9), -15, -3]);
    } else {
      pass(b, 'tW', T(0.4), 14);
    }
    b.shoot(contact, shot, M);
    b.act('uG', M - 0.3, v === 'a' ? 'glove-save' : 'pad-save');
    b.event(M, 'save', 'uG');
    b.act('uG', M + 0.15, 'cover');
    b.held('uG', T(2.7));
    b.path('uD', [T(2.9), -23, -3]);
    b.sendTo('uD', T(2.7), T(3.0));
    b.finishPuck(E.carrier);
    return done(b.build(), M);
  }
  // Their goals: the shot lands at 6.4 whatever the rush.
  const GOAL = 6.4;
  if (kind === 'they-score-wrister') {
    const target = netPoint('them', sgn * 0.6, 1.05);
    const contact = aimShot(b, 'tC', 'wrist', ground(-20.5, 2.5), target, GOAL);
    const act = contact - WRIST_CONTACT;
    const win = act - rush;
    if (v === 'a') {
      // After the rush, tC carries in and shoots.
      b.path('tC', [rush + 0.5 * win, -19, -4.5]);
      b.path('uW', [rush + 0.5 * win, -21, 8]);
    } else {
      // tW passes to tC in the slot.
      const q1 = rush + 0.1 * win;
      const q2 = Math.max(q1 + 0.8, rush + 0.5 * win);
      b.path('tC', [q1 + 0.4, -17.5, -2]);
      b.path('tW', [q1 + 0.6, -21, 8.5]);
      pass(b, 'tW', q1, 14);
      pass(b, 'tC', q2, 14);
    }
    b.shoot(contact, target, GOAL);
    b.path('uG', [contact, -25.6, 0.6 * sgn]);
    b.act('uG', GOAL - 0.3, 'beaten');
    scoreAt(b, 'them', GOAL, target);
    return done(b.build(), GOAL);
  }
  const low = netPoint('them', 0.2, 0.15);
  const shooter: ActorId = v === 'a' ? 'tC' : 'tW';
  const spot = ground(-23.5, 0.3);
  const contact = aimShot(b, shooter, 'wrist', spot, low, GOAL);
  const dk = contact - WRIST_CONTACT - 1.0;
  const w = rush + 0.5 * (dk - rush);
  if (v === 'a') {
    // tC dekes around uD and goes low.
    if (dk - rush > 2) b.path('tC', [w, -19, -4.5]);
    b.path('tC', [dk, -21.5, 2.8, 'deke']);
  } else {
    // tW gets a pass, dekes and goes low.
    b.path('tW', [dk, -21.5, 3.5, 'deke']);
    pass(b, 'tW', rush + 0.15, 14);
  }
  b.path('uD', [dk - 0.2, -22.4, 1.0, 'check']);
  b.path('uG', [dk, -25.6, 1.0], [contact, -25.6, -0.2]);
  b.shoot(contact, low, GOAL);
  b.act('uG', GOAL - 0.3, 'beaten');
  scoreAt(b, 'them', GOAL, low);
  return done(b.build(), GOAL);
}
