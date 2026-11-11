/**
 * Tier 2 tricks, off the kicker ramp: Backflip, Barrel Roll, Helicopter, Sugar Spin and Tail Whip, each with the version
 * where it goes wrong. Every builder returns a `Def` (see `anim.ts`).
 */
import {
  TAU,
  airU,
  arc,
  basePitch,
  clearDef,
  flight,
  launch,
  lerp,
  prog,
  seatAtTime,
  setFree,
  track,
  trail,
  type Def,
  type Frame,
  type Launch,
  type PoseName,
} from './anim';
import type { TrickDefs } from './tricks-t1';

const FLOAT_Y = -0.3;
const FLAT_Y = -0.05;

/** Tucked in the middle of the air, arms up for the landing, then riding on. */
const flipPose =
  (from = 0.15, to = 0.8) =>
  (t: number, L: Launch): PoseName => {
    const u = airU(L, t);
    if (t <= L.tLip) return 'ride';
    if (u < from) return 'fistPump';
    if (u < to) return 'tuck';
    return t < L.tLand + 0.6 ? 'armsUp' : 'ride';
  };

// ---------- Backflip ----------

const backflipClear = clearDef({
  launcher: 'kicker',
  air: 1.6,
  peak: 2.8,
  word: 'BACKFLIP!',
  pitch: (u) => TAU * prog(u, 0.08, 0.88, 'io'),
  pose: flipPose(),
});

const backflipFail: Def = (() => {
  const L = launch('kicker', 1.6, 2.8);
  const hit = L.tLand;
  const out = { d: 0, y: 0 };
  const spin = 1.45 * TAU;
  const flat = 3 * Math.PI;
  const drift = track([
    [hit, L.land],
    [hit + 1.2, L.land + 2.5, 'o'],
  ]);
  const bob = track([
    [hit, 0],
    [hit + 0.2, -0.25, 'o'],
    [hit + 0.8, 0.12],
  ]);
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    flight(L, t, out);
    const u = airU(L, t);
    if (t < hit) {
      k.d = out.d;
      k.y = out.y;
      k.pitch = basePitch(L, t) + spin * prog(u, 0.08, 0.92, 'io');
      k.wet = t <= L.tLip;
    } else {
      k.d = drift(t);
      k.y = bob(t);
      k.pitch = lerp(spin, flat, prog(t, hit, hit + 0.4, 'o'));
      k.wet = true;
    }
  };
  const s0 = seatAtTime(skiAt, hit);
  const slap = 0.35;
  const sitUp = hit + 0.9;
  const end = sitUp + 1.2;
  const riderAt = (t: number, f: Frame) => {
    if (t < hit) {
      if (t > L.tLip + 0.2) f.rider.pose = 'tuck';
      return;
    }
    const u = prog(t, hit, hit + slap, 'o');
    const up = prog(t, sitUp, sitUp + 0.5, 'o');
    setFree(
      f,
      lerp(s0.d, L.land + 1.5, u),
      lerp(lerp(s0.y, FLAT_Y, u), FLOAT_Y, up),
      2.2 * u,
      lerp(s0.pitch, 2.5 * Math.PI, u) + (TAU - 2.5 * Math.PI) * up,
      0,
      0,
      'float',
      t < sitUp ? 'scared' : 'soaked',
    );
  };
  return {
    duration: end,
    word: 'SLAP!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (ski, rider) => [
      [L.tLip - 0.2, 'sfx:whoosh', L.lipD - 2, L.lipY],
      [L.tLip, 'spray', L.lipD, L.lipY],
      [L.tLip, 'sfx:boing', L.lipD, L.lipY],
      [L.tLip + 1.2, 'sfx:slideWhistle', L.land - 4, 3],
      [hit, 'bigSplash', L.land, 0.3, -1.2],
      [hit, 'bigSplash', L.land, 0.3, 1.2],
      [hit, 'sfx:splat', L.land, 0],
      [hit, 'sfx:splash', L.land, 0],
      [hit, 'groan', L.land, 1],
      [hit + 0.05, 'word', L.land, 3],
      ...trail(hit + 0.05, sitUp - 0.1, 0.12, 'bubbles', rider, 0.3),
      ...trail(hit + 0.3, hit + 1.0, 0.2, 'bubbles', ski, 0.3),
      [sitUp + 0.2, 'drips', L.land + 1.5, 0.6, 2.2],
    ],
  };
})();

// ---------- Barrel Roll ----------

const barrelRollClear = clearDef({
  launcher: 'kicker',
  air: 1.6,
  peak: 2.8,
  word: 'BARREL ROLL!',
  roll: (u) => TAU * prog(u, 0.1, 0.85, 'io'),
  pose: (t, L) => {
    const u = airU(L, t);
    if (t <= L.tLip) return 'ride';
    if (u < 0.85) return 'armsUp';
    return t < L.tLand + 0.5 ? 'fistPump' : 'ride';
  },
});

const barrelRollFail: Def = (() => {
  const L = launch('kicker', 1.6, 2.8);
  const hit = L.tLand;
  const out = { d: 0, y: 0 };
  const roll = track([
    [L.tLip + 0.16, 0],
    [L.tLip + 1.36, TAU, 'io'],
    [hit, TAU, 'l'],
    [hit + 1.0, 3 * TAU, 'o'],
  ]);
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    flight(L, t, out);
    k.pitch = basePitch(L, t);
    k.roll = roll(t);
    if (t < hit) {
      k.d = out.d;
      k.y = out.y;
      k.wet = t <= L.tLip;
    } else {
      const tau = t - hit;
      k.d = L.land + 2.2 * prog(tau, 0, 1.0, 'o');
      k.s = 3 * prog(tau, 0, 1.0, 'o');
      k.y = 0.35 * Math.abs(Math.sin(tau * 6)) * (1 - prog(tau, 0, 1.0, 'l'));
      k.wet = true;
    }
  };
  // The rider drops out when the ski is upside down: roll π is half way through the turn.
  const drop = L.tLip + 0.16 + 0.6;
  const s0 = seatAtTime(skiAt, drop);
  const fallTime = 0.9;
  const enter = drop + fallTime;
  const popAt = enter + 0.6;
  const end = Math.max(hit + 1.2, popAt + 0.9);
  const riderAt = (t: number, f: Frame) => {
    if (t < drop) {
      if (t > L.tLip + 0.3) f.rider.pose = 'armsUp';
      return;
    }
    if (t < enter) {
      const u = (t - drop) / fallTime;
      setFree(
        f,
        lerp(s0.d, s0.d + 3.5, prog(u, 0, 1, 'q')),
        arc(s0.y, -0.2, s0.y + 0.02, u),
        0,
        0,
        Math.PI,
        0,
        'flail',
        'scared',
      );
      return;
    }
    const sink = prog(t, enter, enter + 0.3, 'o');
    const up = prog(t, popAt, popAt + 0.5, 'o');
    setFree(
      f,
      s0.d + 3.5,
      t < popAt ? lerp(-0.2, -0.9, sink) : lerp(-0.9, FLOAT_Y, up),
      0.8 * up,
      0,
      lerp(Math.PI, TAU, up),
      0,
      t < popAt ? 'flail' : 'float',
      t < popAt ? 'scared' : 'soaked',
    );
  };
  return {
    duration: end,
    word: 'KER-SPLASH!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (ski) => [
      [L.tLip - 0.2, 'sfx:whoosh', L.lipD - 2, L.lipY],
      [L.tLip, 'spray', L.lipD, L.lipY],
      [L.tLip, 'sfx:boing', L.lipD, L.lipY],
      [drop, 'sfx:slideWhistle', s0.d, s0.y],
      [hit, 'splash', L.land, 0],
      [hit, 'sfx:bump', L.land, 0.3],
      [hit + 0.5, 'sfx:bump', ski(hit + 0.5).d, 0.3, ski(hit + 0.5).s],
      [enter, 'bigSplash', s0.d + 3.5, 0.2],
      [enter, 'sfx:splash', s0.d + 3.5, 0],
      [enter, 'groan', s0.d + 3.5, 1],
      [enter + 0.05, 'word', s0.d + 3.5, 3],
      [popAt + 0.2, 'drips', s0.d + 3.5, 0.6, 0.8],
      ...trail(hit + 0.1, hit + 0.9, 0.3, 'splash', ski),
    ],
  };
})();

// ---------- Helicopter ----------

const helicopterClear = clearDef({
  launcher: 'kicker',
  air: 1.6,
  peak: 2.6,
  word: 'HELICOPTER!',
  yaw: (u) => 2 * TAU * prog(u, 0.1, 0.9, 'io'),
  pose: (t, L) => {
    if (t <= L.tLip) return 'ride';
    return t < L.tLand + 0.4 ? 'armsUp' : 'ride';
  },
});

const helicopterFail: Def = (() => {
  const L = launch('kicker', 1.6, 2.6);
  const hit = L.tLand;
  const out = { d: 0, y: 0 };
  const yawEnd = 3 * Math.PI;
  const drift = track([
    [hit, L.land],
    [hit + 1.2, L.land + 2.5, 'o'],
  ]);
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    flight(L, t, out);
    const u = airU(L, t);
    k.pitch = basePitch(L, t);
    k.yaw = yawEnd * prog(u, 0.1, 0.9, 'io');
    if (t < hit) {
      k.d = out.d;
      k.y = out.y;
      k.wet = t <= L.tLip;
    } else {
      k.d = drift(t);
      k.y = 0;
      k.wet = true;
    }
  };
  // The rider flies off after 1.2 turns (2.4π of the ski's 3π).
  const fling = L.tLip + 1.011;
  const s0 = seatAtTime(skiAt, fling);
  const fallTime = 0.8;
  const skims = [
    { dur: 0.35, h: 0.6 },
    { dur: 0.3, h: 0.25 },
  ];
  const skim1 = fling + fallTime;
  const skim2 = skim1 + skims[0].dur;
  const plop = skim2 + skims[1].dur;
  const flightTime = plop - fling;
  const farD = s0.d + 9;
  const side = 10;
  const popAt = plop + 0.3;
  const end = popAt + 1.0;
  const riderAt = (t: number, f: Frame) => {
    if (t < fling) {
      if (t > L.tLip + 0.3) f.rider.pose = 'flail';
      if (t > L.tLip + 0.3) f.rider.face = 'scared';
      return;
    }
    if (t < plop) {
      const tau = t - fling;
      const k = tau / flightTime;
      let y: number;
      if (tau < fallTime) y = arc(s0.y, FLAT_Y, s0.y + 0.3, tau / fallTime);
      else if (t < skim2) y = arc(FLAT_Y, FLAT_Y, FLAT_Y + skims[0].h, (t - skim1) / skims[0].dur);
      else y = arc(FLAT_Y, FLAT_Y, FLAT_Y + skims[1].h, (t - skim2) / skims[1].dur);
      setFree(
        f,
        lerp(s0.d, farD, k),
        y,
        lerp(s0.s, side, k),
        0,
        0.15 * Math.sin(k * 8),
        lerp(s0.yaw, 2 * TAU, prog(k, 0, 1, 'o')),
        'frisbee',
        'scared',
      );
      return;
    }
    const up = prog(t, popAt, popAt + 0.6, 'o');
    setFree(f, farD, lerp(FLAT_Y, FLOAT_Y, up), side, 0, 0, 2 * TAU, 'float', 'soaked');
  };
  return {
    duration: end,
    word: 'WHEEEE!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: () => [
      [L.tLip - 0.2, 'sfx:whoosh', L.lipD - 2, L.lipY],
      [L.tLip, 'spray', L.lipD, L.lipY],
      [L.tLip, 'sfx:boing', L.lipD, L.lipY],
      [fling, 'groan', s0.d, s0.y],
      [fling, 'sfx:slideWhistle', s0.d, s0.y, s0.s],
      [fling + 0.1, 'word', s0.d + 1, 3.4, 3],
      [hit, 'splash', L.land, 0],
      [hit, 'sfx:splash', L.land, 0],
      [
        skim1,
        'splash',
        lerp(s0.d, farD, (skim1 - fling) / flightTime),
        0,
        lerp(s0.s, side, (skim1 - fling) / flightTime),
      ],
      [skim1, 'sfx:splash', farD, 0, side],
      [
        skim2,
        'splash',
        lerp(s0.d, farD, (skim2 - fling) / flightTime),
        0,
        lerp(s0.s, side, (skim2 - fling) / flightTime),
      ],
      [skim2, 'sfx:splash', farD, 0, side],
      [plop, 'bigSplash', farD, 0.2, side],
      [plop, 'sfx:splat', farD, 0, side],
      [popAt + 0.2, 'drips', farD, 0.6, side],
    ],
  };
})();

export const BACKFLIP: TrickDefs = { clear: backflipClear, fail: backflipFail };
export const BARREL_ROLL: TrickDefs = { clear: barrelRollClear, fail: barrelRollFail };
export const HELICOPTER: TrickDefs = { clear: helicopterClear, fail: helicopterFail };

// ---------- Sugar Spin ----------

const sugarSpinClear = clearDef({
  launcher: 'kicker',
  air: 1.7,
  peak: 2.8,
  word: 'SUGAR SPIN!',
  yaw: (u) => TAU * prog(u, 0.1, 0.9, 'io'),
  pose: (t, L) => {
    if (t <= L.tLip) return 'ride';
    return t < L.tLand + 0.4 ? 'fistPump' : 'ride';
  },
  // The rainbow sprinkle ribbon from the lip to the landing, and a burst where it comes down.
  extra: (L, ski) => [
    ...trail(L.tLip, L.tLand, 0.08, 'confetti', ski),
    [L.tLand, 'confetti', L.land, 1],
    [L.tLand + 0.05, 'confetti', L.land + 1, 1.5],
  ],
});

const sugarSpinFail: Def = (() => {
  const L = launch('kicker', 1.7, 2.8);
  const hit = L.tLand;
  const out = { d: 0, y: 0 };
  const sideways = Math.PI / 2;
  const drift = track([
    [hit, L.land],
    [hit + 1.0, L.land + 2.0, 'o'],
  ]);
  const bob = track([
    [hit, 0],
    [hit + 0.2, -0.25, 'o'],
    [hit + 0.8, 0.1],
  ]);
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    flight(L, t, out);
    const u = airU(L, t);
    k.pitch = basePitch(L, t);
    // The spin stalls half way round and the ski comes down sideways.
    k.yaw = lerp(Math.PI * prog(u, 0.1, 0.5, 'o'), sideways, prog(u, 0.5, 1, 'io'));
    if (t < hit) {
      k.d = out.d;
      k.y = out.y;
      k.wet = t <= L.tLip;
    } else {
      k.d = drift(t);
      k.y = bob(t);
      k.wet = true;
    }
  };
  const s0 = seatAtTime(skiAt, hit);
  const slap = 0.4;
  const sitUp = hit + 0.9;
  const end = sitUp + 1.2;
  const riderAt = (t: number, f: Frame) => {
    if (t < hit) {
      if (t > L.tLip + 0.2) f.rider.pose = 'flail';
      return;
    }
    const u = prog(t, hit, hit + slap, 'o');
    const up = prog(t, sitUp, sitUp + 0.5, 'o');
    setFree(
      f,
      lerp(s0.d, L.land + 1.5, u),
      lerp(lerp(s0.y, FLAT_Y, u), FLOAT_Y, up),
      1.8 * u,
      0,
      lerp(0, Math.PI, up),
      0,
      t < sitUp ? 'flail' : 'float',
      t < sitUp ? 'scared' : 'soaked',
    );
  };
  return {
    duration: end,
    word: 'STICKY LANDING!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (ski, rider) => [
      [L.tLip - 0.2, 'sfx:whoosh', L.lipD - 2, L.lipY],
      [L.tLip, 'spray', L.lipD, L.lipY],
      [L.tLip, 'sfx:boing', L.lipD, L.lipY],
      ...trail(L.tLip, L.tLip + 0.5, 0.08, 'confetti', ski),
      [hit, 'splash', L.land, 0],
      [hit, 'bigSplash', L.land, 0.3, 1.0],
      [hit, 'sfx:splash', L.land, 0],
      [hit, 'groan', L.land, 1],
      [hit + 0.05, 'word', L.land, 3],
      ...trail(hit + 0.1, sitUp - 0.1, 0.15, 'bubbles', rider, 0.3),
      [sitUp + 0.2, 'drips', L.land + 1.5, 0.6, 1.8],
    ],
  };
})();

export const SUGAR_SPIN: TrickDefs = { clear: sugarSpinClear, fail: sugarSpinFail };

// ---------- Tail Whip ----------

/** Where the dino tail stands (sideways of the line the ski flies) and how high its base sits. */
const TAIL_SIDE = 1.5;
const TAIL_BASE = 0.2;

const tailWhipClear = (() => {
  const L = launch('kicker', 1.7, 2.6);
  const swat = L.tLip + 0.15 * L.air;
  const at = { d: 0, y: 0 };
  flight(L, swat, at);
  const tailD = at.d;
  const rise = track([
    [L.tLip - 0.45, 0],
    [L.tLip - 0.05, 1, 'o'],
    [swat + 0.45, 1],
    [swat + 0.9, 0, 'i'],
  ]);
  const swing = track([
    [L.tLip - 0.45, -1],
    [swat - 0.1, -1],
    [swat + 0.2, 1, 'o'],
    [swat + 0.9, 0.6],
  ]);
  const def = clearDef({
    launcher: 'kicker',
    air: 1.7,
    peak: 2.6,
    word: 'TAIL WHIP!',
    yaw: (u) => TAU * prog(u, 0.15, 0.85, 'io'),
    pose: (t, L2) => {
      if (t <= L2.tLip) return 'ride';
      return t < L2.tLand + 0.4 ? 'fistPump' : 'ride';
    },
    extra: () => [
      [swat, 'spray', tailD, 2.6, TAIL_SIDE],
      [swat, 'sfx:whoosh', tailD, 2.6, TAIL_SIDE],
      [swat + 0.9, 'splash', tailD, 0, TAIL_SIDE],
      [L.tLand + 0.05, 'confetti', L.land, 1],
    ],
  });
  const base = def.at;
  return {
    ...def,
    at: (t: number, f: Frame) => {
      base(t, f);
      const tl = f.tail;
      tl.d = tailD;
      tl.s = TAIL_SIDE;
      tl.y = TAIL_BASE;
      tl.rise = rise(t);
      tl.swing = swing(t);
      tl.visible = tl.rise > 0.001;
    },
  };
})();

const tailWhipFail: Def = (() => {
  const L = launch('kicker', 1.7, 2.6);
  const hit = L.tLand;
  const late = L.tLip + 0.55 * L.air;
  const out = { d: 0, y: 0 };
  flight(L, late, out);
  const tailD = out.d;
  const drift = track([
    [hit, L.land],
    [hit + 1.0, L.land + 2.0, 'o'],
  ]);
  const bob = track([
    [hit, 0],
    [hit + 0.2, -0.25, 'o'],
    [hit + 0.8, 0.1],
  ]);
  const rise = track([
    [late - 0.4, 0],
    [late + 0.1, 1, 'o'],
    [late + 0.5, 1],
    [late + 0.9, 0, 'i'],
  ]);
  const swing = track([
    [late - 0.4, -1],
    [late + 0.1, -1],
    [late + 0.4, 1, 'o'],
  ]);
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    flight(L, t, out);
    const u = airU(L, t);
    k.pitch = basePitch(L, t);
    // The swat comes too late: the ski is tipped over sideways and lands upside down.
    k.roll = Math.PI * prog(u, 0.55, 1, 'io');
    if (t < hit) {
      k.d = out.d;
      k.y = out.y;
      k.wet = t <= L.tLip;
    } else {
      k.d = drift(t);
      k.y = bob(t);
      k.wet = true;
    }
  };
  const s0 = seatAtTime(skiAt, hit);
  const slap = 0.4;
  const sitUp = hit + 0.9;
  const end = sitUp + 1.2;
  const riderAt = (t: number, f: Frame) => {
    if (t < hit) {
      if (t > L.tLip + 0.2) {
        f.rider.pose = 'flail';
        f.rider.face = 'scared';
      }
      return;
    }
    const u = prog(t, hit, hit + slap, 'o');
    const up = prog(t, sitUp, sitUp + 0.5, 'o');
    setFree(
      f,
      lerp(s0.d, L.land + 1.5, u),
      lerp(lerp(s0.y, FLAT_Y, u), FLOAT_Y, up),
      -1.8 * u,
      0,
      lerp(0, Math.PI, up),
      0,
      t < sitUp ? 'flail' : 'float',
      t < sitUp ? 'scared' : 'soaked',
    );
  };
  return {
    duration: end,
    word: 'WHIFF!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
      const tl = f.tail;
      tl.d = tailD;
      tl.s = TAIL_SIDE;
      tl.y = TAIL_BASE;
      tl.rise = rise(t);
      tl.swing = swing(t);
      tl.visible = tl.rise > 0.001;
    },
    events: (ski, rider) => [
      [L.tLip - 0.2, 'sfx:whoosh', L.lipD - 2, L.lipY],
      [L.tLip, 'spray', L.lipD, L.lipY],
      [L.tLip, 'sfx:boing', L.lipD, L.lipY],
      [late + 0.3, 'spray', tailD, 1.5, TAIL_SIDE],
      [late + 0.3, 'sfx:whoosh', tailD, 1.5, TAIL_SIDE],
      [late + 0.7, 'word', ski(late + 0.7).d, ski(late + 0.7).y + 1.6, 0],
      [hit, 'splash', L.land, 0],
      [hit, 'bigSplash', L.land, 0.3],
      [hit, 'sfx:splash', L.land, 0],
      [hit, 'groan', L.land, 1],
      ...trail(hit + 0.1, sitUp - 0.1, 0.15, 'bubbles', rider, 0.3),
      [sitUp + 0.2, 'drips', L.land + 1.5, 0.6, -1.8],
    ],
  };
})();

export const TAIL_WHIP: TrickDefs = { clear: tailWhipClear, fail: tailWhipFail };
