/**
 * Tier 1 tricks, off the rolling wave: Wave Hop, Spray Spin, Superman and Tail Stand, each with
 * the version where it goes wrong. Every builder returns a `Def` (see `anim.ts`).
 */
import {
  OUT_SPEED,
  OUT_TIME,
  SKI_HALF,
  TAU,
  airU,
  arc,
  basePitch,
  clearDef,
  createFrame,
  hoverOf,
  flight,
  launch,
  lerp,
  prog,
  seatAtTime,
  setFree,
  smooth,
  track,
  trail,
  type Def,
  type Ev,
  type Frame,
  type PoseName,
} from './anim';

export interface TrickDefs {
  clear: Def;
  fail: Def;
}

/** Hips float this high in the water when the rider bobs about chest deep. */
const FLOAT_Y = -0.3;
/** Hips lie this high when flat on the surface. */
const FLAT_Y = -0.05;

// ---------- Wave Hop ----------

const waveHopClear = clearDef({
  launcher: 'wave',
  air: 1.0,
  peak: 1.5,
  word: 'WAVE HOP!',
  pitch: (u) => 0.3 * Math.sin(TAU * u),
});

const waveHopFail: Def = (() => {
  const L = launch('wave', 0.75, 1.0, 14);
  const hit = L.tLand;
  const out = { d: 0, y: 0 };
  const dive = track([
    [hit, -0.87],
    [hit + 0.25, -1.15, 'o'],
    [hit + 1.3, 0, 'io'],
  ]);
  const sink = track([
    [hit, 0],
    [hit + 0.25, -0.5, 'o'],
    [hit + 1.0, 0],
  ]);
  const skid = track([
    [hit, L.land],
    [hit + 0.4, L.land + 1.2, 'o'],
  ]);
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    flight(L, t, out);
    if (t < hit) {
      k.d = out.d;
      k.y = out.y;
      k.pitch = t <= L.tLip ? basePitch(L, t) : -0.87 * prog(t, L.tLip, hit, 'q');
      k.wet = t <= L.tLip;
    } else {
      k.d = skid(t);
      k.y = sink(t);
      k.pitch = dive(t);
      k.wet = true;
    }
  };
  const s0 = seatAtTime(skiAt, hit);
  const flightTime = 0.9;
  const splat = hit + flightTime;
  const popAt = splat + 0.5;
  const end = popAt + 1.3;
  const riderAt = (t: number, f: Frame) => {
    if (t < hit) return;
    const u = Math.min((t - hit) / flightTime, 1);
    if (t < splat) {
      const pose: PoseName = u < 0.2 ? 'flail' : u < 0.85 ? 'tuck' : 'float';
      setFree(
        f,
        lerp(s0.d, 20, u),
        arc(s0.y, FLAT_Y, s0.y + 1.8, u),
        0,
        lerp(s0.pitch, -2.5 * Math.PI, prog(u, 0, 1)),
        0,
        0,
        pose,
        'scared',
      );
      return;
    }
    const up = prog(t, popAt, popAt + 0.5, 'o');
    setFree(
      f,
      20,
      lerp(FLAT_Y, FLOAT_Y, up),
      0,
      lerp(-2.5 * Math.PI, -2 * Math.PI, up),
      0,
      0,
      'float',
      'soaked',
    );
  };
  return {
    duration: end,
    word: 'SPLOOSH!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (ski, rider) => [
      [L.tLip - 0.2, 'sfx:whoosh', L.lipD - 2, L.lipY],
      [L.tLip, 'spray', L.lipD, L.lipY],
      [hit, 'bigSplash', L.land, 0.3],
      [hit, 'sfx:splash', L.land, 0],
      [hit, 'groan', L.land, 1],
      [hit + 0.1, 'word', L.land, 3.2],
      [hit + 0.35, 'sfx:slideWhistle', rider(hit + 0.35).d, rider(hit + 0.35).y],
      [splat, 'splash', 20, 0],
      [splat, 'sfx:splat', 20, 0],
      [splat, 'sfx:splash', 20, 0],
      [popAt + 0.2, 'drips', 20, 0.6],
      ...trail(hit + 0.1, hit + 0.6, 0.15, 'drips', ski, 0.5),
    ],
  };
})();

// ---------- Spray Spin ----------

const spraySpinClear = clearDef({
  launcher: 'wave',
  air: 0.8,
  peak: 0.6,
  word: 'SPRAY SPIN!',
  yaw: (u) => TAU * prog(u, 0, 1, 'io'),
  pose: (t, L) => (t > L.tLip && t < L.tLand ? 'wave' : 'ride'),
  extra: (L) => [
    [L.tLip + 0.25, 'spray', L.lipD + 2.5, 1.2],
    [L.tLip + 0.4, 'spray', L.lipD + 4.5, 1.0],
    [L.tLip + 0.55, 'spray', L.lipD + 6.5, 0.8],
  ],
});

const SPIN_SEGMENTS = [
  { dur: 0.5, h: 1.5 },
  { dur: 0.4, h: 0.8 },
  { dur: 0.3, h: 0.35 },
];
const SKIP_TIME = SPIN_SEGMENTS.reduce((sum, seg) => sum + seg.dur, 0);

const spraySpinFail: Def = (() => {
  const L = launch('wave', 0.8, 0.6);
  const yaw = track([
    [L.tLip, 0],
    [L.tLip + 0.8, TAU, 'l'],
    [L.tLip + 1.9, 3 * TAU, 'q'],
  ]);
  const drift = track([
    [L.tLand, L.land],
    [L.tLand + 1.1, L.land + 3, 'o'],
  ]);
  const out = { d: 0, y: 0 };
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    flight(L, t, out);
    k.d = t >= L.tLand ? drift(t) : out.d;
    k.y =
      t >= L.tLand
        ? 0.12 * Math.abs(Math.sin((t - L.tLand) * 5)) * (t < L.tLand + 1.1 ? 1 : 0)
        : out.y;
    k.pitch = basePitch(L, t);
    k.yaw = yaw(t);
    k.wet = !(t > L.tLip && t < L.tLand);
  };
  // The rider is flung when the ski has turned twice.
  const fling = L.tLip + 1.12;
  const s0 = seatAtTime(skiAt, fling);
  const stoneEnd = fling + SKIP_TIME;
  const end = stoneEnd + 1.5;
  const side = 8;
  const riderAt = (t: number, f: Frame) => {
    if (t < fling) {
      if (t > L.tLip) f.rider.pose = 'flail';
      if (t > L.tLip) f.rider.face = 'scared';
      return;
    }
    if (t < stoneEnd) {
      const tau = t - fling;
      const k = tau / SKIP_TIME;
      let seg = 0;
      let start = 0;
      while (seg < SPIN_SEGMENTS.length - 1 && tau >= start + SPIN_SEGMENTS[seg].dur) {
        start += SPIN_SEGMENTS[seg].dur;
        seg++;
      }
      const v = Math.min((tau - start) / SPIN_SEGMENTS[seg].dur, 1);
      const h = SPIN_SEGMENTS[seg].h;
      const y = seg === 0 ? arc(s0.y, FLAT_Y, s0.y + h, v) : arc(FLAT_Y, FLAT_Y, FLAT_Y + h, v);
      setFree(
        f,
        lerp(s0.d, s0.d + 5, k),
        y,
        lerp(0, side, prog(k, 0, 1, 'l')),
        0,
        0.25 * Math.sin(k * 9),
        2 * TAU * k,
        'frisbee',
        'scared',
      );
      return;
    }
    const up = prog(t, stoneEnd + 0.3, stoneEnd + 0.9, 'o');
    setFree(f, s0.d + 5, lerp(FLAT_Y, FLOAT_Y, up), side, 0, 0, 0, 'float', 'soaked');
  };
  const skipAt = (n: number) => {
    let at = fling;
    for (let i = 0; i <= n; i++) at += SPIN_SEGMENTS[i].dur;
    return at;
  };
  return {
    duration: end,
    word: 'SKIP SKIP SPLASH!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (ski, rider) => [
      [L.tLip - 0.2, 'sfx:whoosh', L.lipD - 2, L.lipY],
      [L.tLip, 'spray', L.lipD, L.lipY],
      ...trail(L.tLip + 0.3, fling, 0.2, 'spray', ski, 0.4),
      [L.tLand, 'splash', L.land, 0],
      [fling, 'groan', s0.d, s0.y],
      [fling, 'sfx:slideWhistle', s0.d, s0.y],
      [fling + 0.1, 'word', s0.d + 1, 3, 3],
      ...SPIN_SEGMENTS.flatMap((_, i): Ev[] => {
        const at = skipAt(i);
        const p = rider(Math.min(at, end));
        return [
          [at, 'splash', p.d, 0, p.s],
          [at, 'sfx:splash', p.d, 0, p.s],
        ];
      }),
      [stoneEnd + 0.6, 'drips', s0.d + 5, 0.6, side],
    ],
  };
})();

// ---------- Superman ----------

/** How far the rider flies out behind the bars and up off the seat at full stretch. */
const FLY_BACK = 0.75;
const FLY_UP = 0.8;

/** 0 on the seat, 1 flying out flat: eased out after take-off and back in before the landing. */
const flyAmount = (t: number, from: number, to: number) =>
  smooth((t - from) / 0.3) * (1 - smooth((t - (to - 0.3)) / 0.3));

/** The rider flying out flat behind the ski, holding the bars, `w` of the way (0 = seated). */
function flyOut(f: Frame, w: number): void {
  if (w <= 0.001) return;
  const p = hoverOf(f.ski, FLY_BACK * w, FLY_UP * w);
  setFree(f, p.d, p.y, p.s, f.ski.pitch, f.ski.roll, f.ski.yaw, 'superman', 'happy');
}

const supermanClear = clearDef({
  launcher: 'wave',
  air: 1.2,
  peak: 1.6,
  word: 'SUPERMAN!',
  pitch: (u) => 0.25 * Math.sin(TAU * u),
  pose: () => 'ride',
  rider: (t, L, f) => flyOut(f, flyAmount(t, L.tLip + 0.1, L.tLand)),
});

const supermanFail: Def = (() => {
  const L = launch('wave', 1.2, 1.6);
  const out = { d: 0, y: 0 };
  const drift = track([
    [L.tLand, L.land],
    [L.tLand + 1.3, L.land + 3, 'o'],
  ]);
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    flight(L, t, out);
    k.d = t >= L.tLand ? drift(t) : out.d;
    k.y = t >= L.tLand ? 0 : out.y;
    k.pitch = basePitch(L, t) + 0.25 * Math.sin(TAU * airU(L, t));
    k.wet = !(t > L.tLip && t < L.tLand);
  };
  const letGo = L.tLip + 0.6;
  const hoverFrame = createFrame();
  const flyW = (time: number) => flyAmount(time, L.tLip + 0.1, L.tLand + 9);
  skiAt(letGo, hoverFrame);
  const s0 = {
    ...hoverOf(hoverFrame.ski, FLY_BACK * flyW(letGo), FLY_UP * flyW(letGo)),
    pitch: hoverFrame.ski.pitch,
  };
  const flop = L.tLand + 0.45;
  const popAt = flop + 0.5;
  const end = popAt + 1.5;
  const farD = L.land + 6;
  const riderAt = (t: number, f: Frame) => {
    if (t < letGo) {
      flyOut(f, flyW(t));
      return;
    }
    if (t < flop) {
      const u = (t - letGo) / (flop - letGo);
      setFree(
        f,
        lerp(s0.d, farD, u),
        arc(s0.y, FLAT_Y, s0.y + 0.1, u),
        0,
        0,
        0,
        0,
        'superman',
        'scared',
      );
      return;
    }
    const up = prog(t, popAt, popAt + 0.5, 'o');
    setFree(
      f,
      farD,
      lerp(FLAT_Y, FLOAT_Y, up),
      0,
      0,
      0,
      0,
      t < popAt ? 'superman' : 'float',
      'soaked',
    );
  };
  return {
    duration: end,
    word: 'SPLAT!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (ski, rider) => [
      [L.tLip - 0.2, 'sfx:whoosh', L.lipD - 2, L.lipY],
      [L.tLip, 'spray', L.lipD, L.lipY],
      [letGo, 'sfx:slideWhistle', s0.d, s0.y],
      [L.tLand, 'splash', L.land, 0, 0],
      [L.tLand, 'sfx:splash', L.land, 0, 0],
      ...trail(letGo, flop - 0.1, 0.25, 'drips', rider),
      [flop, 'bigSplash', farD, 0.2],
      [flop, 'sfx:splat', farD, 0],
      [flop, 'sfx:splash', farD, 0],
      [flop, 'groan', farD, 1],
      [flop + 0.1, 'word', farD, 3],
      [popAt + 0.2, 'drips', farD, 0.6],
      [L.tLand + 0.8, 'splash', ski(L.tLand + 0.8).d, 0],
    ],
  };
})();

// ---------- Tail Stand ----------

const TAIL_PITCH = (75 * Math.PI) / 180;
const SLIDE_SPEED = 11;
const TAIL_RAMP = 0.35;

/** The ski pivoting on its tail: the tail's spot and the ski's pitch give the middle's spot. */
function onTail(f: Frame, tailD: number, tailY: number, pitch: number, floorY = -Infinity): void {
  const k = f.ski;
  k.d = tailD + SKI_HALF * Math.cos(pitch);
  k.y = Math.max(tailY + SKI_HALF * Math.sin(pitch), floorY);
  k.pitch = pitch;
  k.wet = false;
}

const tailStandClear: Def = (() => {
  const L = launch('wave', 0.4, 0);
  const hold = L.tLip + TAIL_RAMP;
  const slideEnd = hold + 2.0;
  const dropEnd = slideEnd + 0.45;
  const tailD = (t: number) => L.lipD - SKI_HALF + SLIDE_SPEED * (t - L.tLip);
  const tailY = (t: number) => L.lipY * (1 - prog(t, L.tLip, hold, 'o'));
  const pitch = (t: number) => {
    const wobble = 0.04 * Math.sin(8 * (t - hold)) * (t > hold && t < slideEnd ? 1 : 0);
    return TAIL_PITCH * (prog(t, L.tLip, hold, 'q') - prog(t, slideEnd, dropEnd, 'io')) + wobble;
  };
  const endD = tailD(dropEnd) + SKI_HALF;
  const out = { d: 0, y: 0 };
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= L.tLip) {
      flight(L, t, out);
      k.d = out.d;
      k.y = out.y;
      k.pitch = basePitch(L, t);
      k.wet = true;
    } else if (t <= dropEnd) {
      onTail(f, tailD(t), tailY(t), pitch(t));
      k.wet = t > slideEnd + 0.3;
    } else {
      k.d = endD + OUT_SPEED * (t - dropEnd);
      k.y = 0;
      k.pitch = 0;
      k.wet = true;
    }
  };
  const riderAt = (t: number, f: Frame) => {
    const w = smooth((t - L.tLip) / TAIL_RAMP) * (1 - smooth((t - slideEnd) / 0.45));
    if (w <= 0.001) return;
    const k = f.ski;
    const standD = tailD(Math.min(t, dropEnd)) + 0.15;
    const standY = tailY(Math.min(t, dropEnd)) + 0.75;
    const seat = seatAtTime(skiAt, t);
    setFree(
      f,
      lerp(seat.d, standD, w),
      lerp(seat.y, standY, w),
      0,
      lerp(k.pitch, 0.12, w),
      0,
      0,
      w > 0.5 ? 'stand' : 'ride',
      'happy',
    );
  };
  return {
    duration: dropEnd + OUT_TIME,
    length: endD + OUT_SPEED * OUT_TIME,
    word: 'TAIL STAND!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (ski) => [
      [L.tLip - 0.2, 'sfx:whoosh', L.lipD - 2, L.lipY],
      [L.tLip, 'spray', L.lipD, L.lipY],
      [hold, 'sfx:boing', ski(hold).d, 1],
      ...trail(hold, slideEnd, 0.2, 'spray', (t) => ({ ...ski(t), y: 0.1 }), 0),
      [hold + 0.8, 'word', ski(hold + 0.8).d, 3.6, 0],
      [dropEnd, 'splash', ski(dropEnd).d, 0],
      [dropEnd, 'sfx:splash', ski(dropEnd).d, 0],
      [dropEnd + 0.2, 'cheer', ski(dropEnd).d + 2, 1],
    ],
  };
})();

const tailStandFail: Def = (() => {
  const L = launch('wave', 0.4, 0);
  const hold = L.tLip + TAIL_RAMP;
  const over = L.tLip + 1.4;
  const flipEnd = L.tLip + 1.9;
  const tailD = (t: number) => L.lipD - SKI_HALF + 8 * prog(t, L.tLip, flipEnd, 'o');
  const tailY = (t: number) => L.lipY * (1 - prog(t, L.tLip, hold, 'o'));
  const pitch = track([
    [L.tLip, 0],
    [hold, TAIL_PITCH, 'q'],
    [L.tLip + 0.9, TAIL_PITCH, 'l'],
    [over, (110 * Math.PI) / 180, 'io'],
    [flipEnd, Math.PI, 'i'],
  ]);
  const out = { d: 0, y: 0 };
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= L.tLip) {
      flight(L, t, out);
      k.d = out.d;
      k.y = out.y;
      k.pitch = basePitch(L, t);
      k.wet = true;
    } else {
      onTail(f, tailD(Math.min(t, flipEnd)), tailY(t), pitch(Math.min(t, flipEnd)), 0.2);
      k.wet = t >= flipEnd;
    }
  };
  const fall = L.tLip + 1.3;
  const buried = flipEnd + 0.2;
  const popAt = flipEnd + 0.7;
  const end = popAt + 1.1;
  const riderAt = (t: number, f: Frame) => {
    const stand = smooth((t - L.tLip) / TAIL_RAMP);
    if (t <= L.tLip) return;
    if (t < fall) {
      const seat = seatAtTime(skiAt, t);
      setFree(
        f,
        lerp(seat.d, tailD(t) + 0.15, stand),
        lerp(seat.y, tailY(t) + 0.75, stand),
        0,
        lerp(seat.pitch, 0.12, stand),
        0,
        0,
        stand > 0.5 ? 'stand' : 'ride',
        'happy',
      );
      return;
    }
    const back = prog(t, fall, fall + 0.5, 'q');
    const sink = prog(t, fall + 0.4, buried, 'io');
    const rise = prog(t, popAt, popAt + 0.5, 'o');
    const startD = tailD(fall) + 0.15;
    const startY = tailY(fall) + 0.75;
    const d = lerp(startD, tailD(Math.min(t, flipEnd)) - 1.5, back);
    const y = t < popAt ? lerp(lerp(startY, -0.25, back), -1.0, sink) : lerp(-1.0, FLOAT_Y, rise);
    const pitch = lerp(0.12, Math.PI / 2, back) * (1 - rise);
    setFree(
      f,
      d,
      y,
      1.3 * rise,
      pitch,
      0,
      0,
      t < popAt ? 'flail' : 'float',
      t < popAt ? 'scared' : 'dizzy',
    );
  };
  return {
    duration: end,
    word: 'BONK!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (ski) => [
      [L.tLip - 0.2, 'sfx:whoosh', L.lipD - 2, L.lipY],
      [L.tLip, 'spray', L.lipD, L.lipY],
      ...trail(hold, fall, 0.2, 'spray', (t) => ({ ...ski(t), y: 0.1 }), 0),
      [fall, 'sfx:slideWhistle', ski(fall).d, 2],
      [flipEnd, 'bigSplash', ski(flipEnd).d, 0.3],
      [flipEnd, 'sfx:splash', ski(flipEnd).d, 0],
      [flipEnd, 'sfx:bump', ski(flipEnd).d, 0.3],
      [flipEnd, 'groan', ski(flipEnd).d, 1],
      [flipEnd + 0.05, 'word', ski(flipEnd).d, 3],
      [popAt, 'splash', ski(popAt).d, 0, 1.3],
      [popAt + 0.1, 'stars', ski(popAt).d, 1.2, 1.3],
    ],
  };
})();

export const WAVE_HOP: TrickDefs = { clear: waveHopClear, fail: waveHopFail };
export const SPRAY_SPIN: TrickDefs = { clear: spraySpinClear, fail: spraySpinFail };
export const SUPERMAN: TrickDefs = { clear: supermanClear, fail: supermanFail };
export const TAIL_STAND: TrickDefs = { clear: tailStandClear, fail: tailStandFail };
