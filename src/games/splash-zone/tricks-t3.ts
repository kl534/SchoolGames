/**
 * Tier 3 tricks, off the mega ramp: Double Backflip, Submarine and Corkscrew 720, each with the
 * version where it goes wrong. All three slow right down at their big moment. Every builder
 * returns a `Def` (see `anim.ts`).
 */
import {
  OUT_SPEED,
  OUT_TIME,
  TAU,
  airU,
  arc,
  basePitch,
  clamp01,
  clearDef,
  launch,
  lerp,
  prog,
  seatAtTime,
  setFree,
  surfacePitch,
  surfaceY,
  track,
  trail,
  type Def,
  type Frame,
  type PoseName,
} from './anim';
import type { TrickDefs } from './tricks-t1';

const FLOAT_Y = -0.3;

// ---------- Double Backflip ----------

const doubleBackflipClear = clearDef({
  launcher: 'mega-ramp',
  air: 2.4,
  peak: 5.0,
  word: 'DOUBLE BACKFLIP!',
  pitch: (u) => 2 * TAU * prog(u, 0.06, 0.9, 'io'),
  slow: true,
  pose: (t, L) => {
    const u = airU(L, t);
    if (t <= L.tLip) return 'ride';
    if (u < 0.12) return 'fistPump';
    if (u < 0.85) return 'tuck';
    return t < L.tLand + 0.6 ? 'armsUp' : 'ride';
  },
});

const doubleBackflipFail: Def = (() => {
  const lipD = 10;
  const lipY = 4.2;
  const lip = launch('mega-ramp', 1, 0);
  const up = 1.2;
  const stall = 0.4;
  const drop = 0.75;
  const tUp = lip.tLip + up;
  const tStall = tUp + stall;
  const hit = tStall + drop;
  const peakY = lipY + 5.0;
  const stallD = lipD + 12;
  const sinkY = track([
    [hit, 0],
    [hit + 0.3, -0.7, 'o'],
    [hit + 1.0, 0.1],
  ]);
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= lip.tLip) {
      const d = (lipD * Math.max(t, 0)) / lip.tLip;
      k.d = d;
      k.y = surfaceY('mega-ramp', d);
      k.pitch = surfacePitch('mega-ramp', d) * prog(t, 0, 0.25);
      k.wet = true;
      return;
    }
    k.wet = t >= hit;
    if (t <= tUp) {
      const v = (t - lip.tLip) / up;
      k.d = lerp(lipD, stallD, v);
      k.y = lerp(lipY, peakY, 1 - (1 - v) ** 2);
      k.pitch = lip.lipAngle * (1 - prog(v, 0, 0.4)) + Math.PI * prog(v, 0.05, 1, 'io');
    } else if (t <= tStall) {
      const v = (t - tUp) / stall;
      k.d = stallD + 1.0 * prog(v, 0, 1, 'o');
      k.y = peakY + 0.12 * Math.sin(v * Math.PI * 3);
      k.pitch = Math.PI + 0.06 * Math.sin(v * TAU * 2);
    } else if (t <= hit) {
      const v = (t - tStall) / drop;
      k.d = stallD + 1.0 + 0.8 * v;
      k.y = lerp(peakY, 0, v * v);
      k.pitch = Math.PI;
    } else {
      k.d = stallD + 1.8;
      k.y = sinkY(t);
      k.pitch = Math.PI;
    }
  };
  const s0 = seatAtTime(skiAt, hit);
  const popAt = hit + 0.7;
  const end = popAt + 1.3;
  const riderAt = (t: number, f: Frame) => {
    if (t > tUp - 0.2 && t < hit) {
      f.rider.pose = 'flail';
      f.rider.face = 'scared';
    } else if (t > lip.tLip + 0.15 && t < tUp - 0.2) {
      f.rider.pose = 'tuck';
    }
    if (t < hit) return;
    const sink = prog(t, hit, hit + 0.3, 'o');
    const rise = prog(t, popAt, popAt + 0.5, 'o');
    setFree(
      f,
      s0.d,
      t < popAt ? lerp(s0.y, -1.3, sink) : lerp(-1.3, FLOAT_Y, rise),
      1.4 * rise,
      lerp(Math.PI, TAU, rise),
      0,
      0,
      t < popAt ? 'flail' : 'float',
      t < popAt ? 'scared' : 'soaked',
    );
  };
  return {
    duration: end,
    word: 'KA-BLOOSH!',
    slow: [tUp + stall / 2],
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (ski) => [
      [lip.tLip - 0.2, 'sfx:whoosh', lipD - 2, lipY],
      [lip.tLip, 'spray', lipD, lipY],
      [lip.tLip, 'sfx:boing', lipD, lipY],
      [tStall, 'sfx:slideWhistle', ski(tStall).d, peakY],
      [hit, 'bigSplash', ski(hit).d, 0.3],
      [hit, 'bigSplash', ski(hit).d, 0.3, 0.8],
      [hit, 'sfx:splash', ski(hit).d, 0],
      [hit, 'groan', ski(hit).d, 1],
      [hit + 0.05, 'word', ski(hit).d, 4],
      [popAt, 'splash', s0.d, 0, 1.4],
      [popAt + 0.2, 'drips', s0.d, 0.6, 1.4],
    ],
  };
})();

// ---------- Submarine ----------

const SUB_DEPTH = -1.6;
const SUB_ENTRY_D = 20;
const SUB_EXIT_D = 34;
const DIVE_PITCH = -0.7;

/** The shallow dive off the lip to the water: shared by the clear and the wipeout. */
function subDive(t: number, f: Frame, tLip: number, tEntry: number): boolean {
  const k = f.ski;
  if (t <= tLip) {
    const d = (10 * Math.max(t, 0)) / tLip;
    k.d = d;
    k.y = surfaceY('mega-ramp', d);
    k.pitch = surfacePitch('mega-ramp', d) * prog(t, 0, 0.25);
    return true;
  }
  if (t < tEntry) {
    const v = (t - tLip) / (tEntry - tLip);
    k.d = lerp(10, SUB_ENTRY_D, v);
    k.y = arc(4.2, 0, 4.7, v);
    k.pitch = lerp((32 * Math.PI) / 180, DIVE_PITCH, prog(v, 0, 1, 'io'));
    k.wet = false;
    return true;
  }
  return false;
}

const submarineClear: Def = (() => {
  const tLip = 10 / 12;
  const tEntry = tLip + 0.833;
  const under = 1.0;
  const tExit = tEntry + under;
  const fly = 1.4;
  const tLand = tExit + fly;
  const landD = SUB_EXIT_D + 13 * fly;
  const end = tLand + OUT_TIME;
  const arcPitch = track([
    [0, 0.7],
    [0.5, 0, 'o'],
    [0.85, -0.25],
    [1, 0],
  ]);
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    k.wet = true;
    if (subDive(t, f, tLip, tEntry)) return;
    if (t < tExit) {
      const w = (t - tEntry) / under;
      k.d = lerp(SUB_ENTRY_D, SUB_EXIT_D, w);
      k.y = SUB_DEPTH * Math.sin(Math.PI * w);
      k.pitch = lerp(DIVE_PITCH, 0.7, prog(w, 0, 1, 'io'));
    } else if (t < tLand) {
      const v = (t - tExit) / fly;
      k.d = lerp(SUB_EXIT_D, landD, v);
      k.y = arc(0, 0, 3.5, v);
      k.pitch = arcPitch(v);
      k.wet = false;
    } else {
      k.d = landD + OUT_SPEED * (t - tLand);
      k.y = 0;
      k.pitch = 0;
    }
  };
  const dolphinAt = (t: number, f: Frame) => {
    const v = clamp01((t - tExit) / fly);
    const dolphins = f.dolphins;
    const sides = [-3.4, 3.4];
    const lead = [1.15, 1.0];
    const delay = [0, 0.12];
    dolphins.forEach((dolphin, i) => {
      const w = (v - delay[i]) * lead[i];
      dolphin.visible = t > tExit && w > 0 && w < 1;
      dolphin.phase = clamp01(w);
      dolphin.d = lerp(SUB_EXIT_D, landD, v) + (i === 0 ? 2 : -1);
      dolphin.s = sides[i];
      dolphin.y = arc(-0.6, -0.6, 2.6, clamp01(w));
    });
  };
  return {
    duration: end,
    length: landD + OUT_SPEED * OUT_TIME,
    word: 'SUBMARINE!',
    slow: [tExit],
    at: (t, f) => {
      skiAt(t, f);
      dolphinAt(t, f);
      let pose: PoseName = 'ride';
      if (t > tLip && t < tEntry) pose = 'tuck';
      else if (t >= tExit && t < tLand + 0.4) pose = 'armsUp';
      f.rider.pose = pose;
      f.rider.face = t >= tEntry && t < tExit ? 'scared' : 'happy';
    },
    events: (ski) => [
      [tLip - 0.2, 'sfx:whoosh', 8, 4],
      [tLip, 'spray', 10, 4.2],
      [tLip, 'sfx:boing', 10, 4.2],
      [tEntry, 'bigSplash', SUB_ENTRY_D, 0.2],
      [tEntry, 'sfx:splash', SUB_ENTRY_D, 0],
      ...trail(tEntry + 0.1, tExit - 0.1, 0.12, 'bubbles', ski, 0.3),
      [tExit, 'bigSplash', SUB_EXIT_D, 0.3],
      [tExit, 'sfx:whoosh', SUB_EXIT_D, 0.5],
      [tExit, 'sfx:splash', SUB_EXIT_D, 0],
      [tExit + 0.2, 'drips', SUB_EXIT_D + 2, 1],
      [tExit + 0.5, 'word', ski(tExit + 0.5).d, 5],
      [tLand, 'splash', landD, 0],
      [tLand, 'sfx:splash', landD, 0],
      [tLand + 0.2, 'cheer', landD + 2, 1],
      [tLand + 0.2, 'confetti', landD + 3, 1.5],
    ],
  };
})();

const submarineFail: Def = (() => {
  const tLip = 10 / 12;
  const tEntry = tLip + 0.833;
  const under = 1.2;
  const tPop = tEntry + under;
  const bob = 0.8;
  const sinkY = track([
    [tEntry, 0],
    [tEntry + 0.6, -1.8, 'o'],
    [tPop, -1.8, 'l'],
    [tPop + bob, 0.1, 'o'],
  ]);
  const tilt = track([
    [tEntry, DIVE_PITCH],
    [tEntry + 0.6, -1.2, 'o'],
    [tPop, -1.2, 'l'],
    [tPop + bob, -Math.PI, 'o'],
  ]);
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    k.wet = true;
    if (subDive(t, f, tLip, tEntry)) return;
    k.d = SUB_ENTRY_D + 5 * prog(t, tEntry, tPop, 'o');
    k.y = sinkY(t);
    k.pitch = tilt(t);
    k.wet = t > tPop + 0.4;
  };
  const s0 = seatAtTime(skiAt, tEntry);
  const popUp = 0.45;
  const end = tPop + popUp + 1.0;
  const riderAt = (t: number, f: Frame) => {
    if (t > tLip + 0.15 && t < tEntry) f.rider.pose = 'tuck';
    if (t < tEntry) return;
    const sink = prog(t, tEntry, tEntry + 0.5, 'io');
    const rise = prog(t, tPop, tPop + popUp, 'o');
    const popped = t >= tPop;
    setFree(
      f,
      s0.d + 3 * prog(t, tEntry, tPop, 'o'),
      popped ? lerp(-1.5, FLOAT_Y, rise) : lerp(s0.y, -1.5, sink),
      1.2 * rise,
      lerp(s0.pitch, 0, sink),
      0,
      0,
      popped ? 'float' : 'flail',
      popped ? 'soaked' : 'scared',
    );
    f.rider.props.seaweed = f.rider.props.fish = t >= tPop + 0.05;
  };
  return {
    duration: end,
    word: 'BLUB BLUB!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (ski, rider) => [
      [tLip - 0.2, 'sfx:whoosh', 8, 4],
      [tLip, 'spray', 10, 4.2],
      [tLip, 'sfx:boing', 10, 4.2],
      [tEntry, 'bigSplash', SUB_ENTRY_D, 0.2],
      [tEntry, 'sfx:splash', SUB_ENTRY_D, 0],
      [tEntry, 'groan', SUB_ENTRY_D, 1],
      [tEntry + 0.5, 'word', SUB_ENTRY_D + 1, 2],
      ...trail(tEntry + 0.1, tPop - 0.1, 0.1, 'bubbles', ski, 0.2),
      ...trail(tEntry + 0.5, tPop - 0.1, 0.15, 'bubbles', rider, 0.4),
      [tPop + 0.05, 'splash', rider(tPop + 0.1).d, 0, rider(tPop + 0.1).s],
      [tPop + 0.05, 'sfx:boing', rider(tPop + 0.1).d, 0, rider(tPop + 0.1).s],
      [tPop + 0.15, 'drips', rider(tPop + 0.2).d, 0.6, rider(tPop + 0.2).s],
      [tPop + 0.4, 'splash', ski(tPop + 0.4).d, 0],
      [tPop + 0.4, 'sfx:splash', ski(tPop + 0.4).d, 0],
    ],
  };
})();

// ---------- Corkscrew 720 ----------

const corkscrewClear = clearDef({
  launcher: 'mega-ramp',
  air: 2.4,
  peak: 4.6,
  word: 'CORKSCREW 720!',
  roll: (u) => 2 * TAU * prog(u, 0.08, 0.88, 'io'),
  yaw: (u) => 0.15 * Math.sin(2 * TAU * u) * Math.sin(Math.PI * u),
  side: (u) => 2 * Math.sin(TAU * u),
  slow: true,
  pose: (t, L) => {
    if (t <= L.tLip) return 'ride';
    if (t > L.tLand - 0.5 && t < L.tLand + 0.4) return 'armsUp';
    return airU(L, t) < 0.8 ? 'tuck' : 'ride';
  },
});

const corkscrewFail: Def = (() => {
  const L = launch('mega-ramp', 1.6, 3.4);
  const hit = L.tLand;
  const nose = -Math.PI / 2;
  const tPop = hit + 2.0;
  const yaw = track([
    [hit, 0],
    [tPop + 0.9, TAU, 'l'],
  ]);
  const sinkY = track([
    [hit, 0],
    [hit + 0.3, -1.0, 'o'],
    [tPop, -1.0, 'l'],
    [tPop + 0.9, 0.1, 'o'],
  ]);
  const tilt = track([
    [hit, nose],
    [tPop, nose, 'l'],
    [tPop + 0.9, -Math.PI, 'o'],
  ]);
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    const u = airU(L, t);
    if (t < hit) {
      // The same spiral as the clear, but nose-first into the water.
      const d = t <= L.tLip ? (10 * Math.max(t, 0)) / L.tLip : lerp(L.lipD, L.land, u);
      k.d = d;
      k.y = t <= L.tLip ? surfaceY('mega-ramp', d) : arc(L.lipY, 0, L.lipY + L.peak, u);
      k.pitch = basePitch(L, t) + nose * prog(u, 0.3, 1.0, 'io');
      k.roll = TAU * prog(u, 0.08, 0.9, 'io');
      k.wet = t <= L.tLip;
      return;
    }
    k.d = L.land + 0.8 * prog(t, hit, hit + 0.4, 'o');
    k.y = sinkY(t);
    k.pitch = tilt(t);
    k.roll = TAU * (t < hit + 0.4 ? 1 : 1);
    k.yaw = yaw(t);
    k.wet = t > tPop + 0.5;
  };
  const s0 = seatAtTime(skiAt, hit);
  const popUp = 0.5;
  const end = tPop + popUp + 0.7;
  const riderAt = (t: number, f: Frame) => {
    if (t > L.tLip + 0.15 && t < hit) f.rider.pose = 'tuck';
    if (t < hit) return;
    const sink = prog(t, hit, hit + 0.5, 'io');
    const rise = prog(t, tPop, tPop + popUp, 'o');
    const popped = t >= tPop;
    setFree(
      f,
      s0.d + 1.5 * sink,
      popped ? lerp(-1.6, FLOAT_Y, rise) : lerp(s0.y, -1.6, sink),
      1.5 * rise,
      lerp(s0.pitch, 0, sink),
      0,
      0,
      popped ? 'float' : 'flail',
      popped ? 'soaked' : 'scared',
    );
  };
  return {
    duration: end,
    word: 'GLUG!',
    slow: [hit],
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (ski, rider) => [
      [L.tLip - 0.2, 'sfx:whoosh', L.lipD - 2, L.lipY],
      [L.tLip, 'spray', L.lipD, L.lipY],
      [L.tLip, 'sfx:boing', L.lipD, L.lipY],
      [L.tLip + 1.0, 'sfx:slideWhistle', ski(L.tLip + 1.0).d, ski(L.tLip + 1.0).y],
      [hit, 'bigSplash', L.land, 0.3],
      [hit, 'sfx:splash', L.land, 0],
      [hit, 'groan', L.land, 1],
      [hit + 0.1, 'word', L.land, 3],
      ...trail(hit + 0.4, tPop - 0.1, 0.2, 'bubbles', rider, 0.3),
      [tPop, 'bigSplash', rider(tPop + 0.1).d, 0.3, rider(tPop + 0.1).s],
      [tPop, 'sfx:splash', rider(tPop + 0.1).d, 0, rider(tPop + 0.1).s],
      [tPop + 0.2, 'drips', rider(tPop + 0.2).d, 0.8, rider(tPop + 0.2).s],
      [tPop + 0.5, 'splash', ski(tPop + 0.5).d, 0],
    ],
  };
})();

export const DOUBLE_BACKFLIP: TrickDefs = { clear: doubleBackflipClear, fail: doubleBackflipFail };
export const SUBMARINE: TrickDefs = { clear: submarineClear, fail: submarineFail };
export const CORKSCREW: TrickDefs = { clear: corkscrewClear, fail: corkscrewFail };
