import { describe, expect, it } from 'vitest';
import { planPlay } from '../src/games/slap-shot/plays';
import { inNet } from '../src/shared/hockey/geometry';
import {
  ACTORS,
  SKATERS,
  actorAt,
  isGoalie,
  puckAt,
  type PlayScript,
} from '../src/shared/hockey/script';
import { shootoutFormation, shootoutShot, type ShootoutKind } from '../src/shared/hockey/shootout';
import type { Band } from '../src/shared/hockey/band';
import type { Role } from '../src/shared/hockey/teams';
import oldScripts from './hockey-shared-old-shootout.json';

const KINDS: ShootoutKind[] = ['so-goal', 'so-saved', 'so-stopped', 'so-goal-against'];
const BANDS: Band[] = ['flashy', 'solid', 'plain'];
const ROLES: Role[] = ['C', 'W', 'D'];
const SIGNS = [-1, 1];

function checkShot(script: PlayScript, kind: ShootoutKind) {
  expect(script.duration).toBe(2.8);
  // The puck covers 0..duration with no gaps.
  let t = 0;
  for (const seg of script.puck) {
    expect(seg.t0).toBeCloseTo(t, 4);
    expect(seg.t1).toBeGreaterThanOrEqual(seg.t0);
    t = seg.t1;
  }
  expect(t).toBeCloseTo(script.duration, 4);
  for (const id of ACTORS) {
    const keys = script.actors[id];
    expect(keys[0].t).toBe(0);
    expect(keys[keys.length - 1].t).toBeCloseTo(script.duration, 6);
    for (let i = 1; i < keys.length; i++) expect(keys[i].t).toBeGreaterThan(keys[i - 1].t);
    for (let s = 0; s <= 40; s++) {
      const p = actorAt(keys, (s / 40) * script.duration).pos;
      expect(Math.abs(p.x)).toBeLessThanOrEqual(29);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(12.5);
    }
  }
  // The puck is where it should be on both sides of every change of segment.
  for (let i = 1; i < script.puck.length; i++) {
    // A save ends with the puck on the goalie's chest, a deliberate step.
    const next = script.puck[i];
    if (next.kind === 'held' && isGoalie(next.who)) continue;
    const at = next.t0;
    const before = puckAt(script, at - 1e-6);
    const after = puckAt(script, at + 1e-6);
    expect(Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z)).toBeLessThan(
      0.05,
    );
  }
  for (let s = 0; s <= 80; s++) {
    const p = puckAt(script, (s / 80) * script.duration);
    expect(Math.abs(p.x)).toBeLessThanOrEqual(29);
    expect(Math.abs(p.z)).toBeLessThanOrEqual(12.5);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
  }
  for (const e of script.events) {
    expect(e.t).toBeGreaterThanOrEqual(0);
    expect(e.t).toBeLessThanOrEqual(script.duration);
  }
  for (let i = 1; i < script.events.length; i++) {
    expect(script.events[i].t).toBeGreaterThanOrEqual(script.events[i - 1].t);
  }
  const goals = script.events.filter((e) => e.type === 'goal');
  const saves = script.events.filter((e) => e.type === 'save');
  if (kind === 'so-goal' || kind === 'so-goal-against') {
    const who = kind === 'so-goal' ? 'us' : 'them';
    expect(goals).toHaveLength(1);
    expect(saves).toHaveLength(0);
    expect(script.goal).toBe(who);
    expect(inNet(puckAt(script, goals[0].t + 0.3), who)).toBe(true);
    expect(inNet(puckAt(script, script.duration), who)).toBe(true);
  } else {
    expect(goals).toHaveLength(0);
    expect(script.goal).toBeNull();
    expect(saves).toHaveLength(1);
    expect(saves[0].t).toBe(2.15);
  }
  const shots = script.events.filter((e) => e.type === 'shot');
  expect(shots).toHaveLength(1);
}

describe('shootoutShot', () => {
  for (const kind of KINDS) {
    for (const band of BANDS) {
      for (const role of ROLES) {
        it(`${kind} ${band} ${role}: a well-formed script`, () => {
          for (const sgn of SIGNS) checkShot(shootoutShot(kind, role, band, sgn), kind);
        });
      }
    }
  }

  it('lets the named shooter take the shot', () => {
    for (const role of ROLES) {
      const us = shootoutShot('so-goal', role, 'solid', 1);
      expect(us.events.find((e) => e.type === 'shot')?.who).toBe(`u${role}`);
      const them = shootoutShot('so-stopped', role, 'plain', -1);
      expect(them.events.find((e) => e.type === 'shot')?.who).toBe(`t${role}`);
    }
  });

  it('plays the style of the band', () => {
    const moves = (band: Band) =>
      shootoutShot('so-goal', 'C', band, 1).actors.uC.map((k) => k.move);
    expect(moves('flashy')).toContain('spin');
    expect(moves('flashy')).not.toContain('deke');
    expect(moves('solid')).toContain('deke');
    expect(moves('plain')).not.toContain('deke');
    expect(moves('plain')).not.toContain('spin');
    const save = (band: Band) =>
      shootoutShot('so-saved', 'C', band, 1).actors.tG.map((k) => k.move);
    expect(save('plain')).toContain('pad-save');
    expect(save('solid')).toContain('glove-save');
    expect(save('flashy')).toContain('glove-save');
  });

  it('keeps the old Slap Shot shootout exactly (solid, centre, as captured before the move)', () => {
    const kinds = Object.keys(oldScripts).map((k) => k.split('|')[0]);
    expect(new Set(kinds).size).toBe(4);
    for (const [key, old] of Object.entries(oldScripts)) {
      const [kind, sgn] = key.split('|');
      const now = shootoutShot(kind as ShootoutKind, 'C', 'solid', Number(sgn));
      expect(JSON.parse(JSON.stringify(now))).toEqual(old);
      // Slap Shot's planPlay goes through it.
      const puck = { kind: 'faceoff', zone: 'neutral' } as const;
      const plan = planPlay(kind as ShootoutKind, puck, puck, () => (sgn === '-1' ? 0.25 : 0.75));
      expect(JSON.parse(JSON.stringify(plan))).toEqual(old);
    }
  });
});

describe('shootoutFormation', () => {
  for (const side of ['us', 'them'] as const) {
    for (const role of ROLES) {
      it(`${side} ${role}: skaters 0.8 m apart, the shooter at the centre dot`, () => {
        const f = shootoutFormation(side, role);
        for (const a of SKATERS) {
          for (const b of SKATERS) {
            if (a >= b) continue;
            const d = Math.hypot(
              f.spots[a].pos.x - f.spots[b].pos.x,
              f.spots[a].pos.z - f.spots[b].pos.z,
            );
            expect(d).toBeGreaterThanOrEqual(0.8);
          }
        }
        const id = `${side === 'us' ? 'u' : 't'}${role}` as keyof typeof f.spots;
        expect(f.carrier).toBe(id);
        expect(f.spots[id].pos).toMatchObject({ x: 0, z: 0 });
        expect(f.spots[id].face.x).toBeCloseTo(side === 'us' ? 6 : -6);
      });
    }
  }

  it('defaults to the centre and puts the other roles by the bench', () => {
    expect(shootoutFormation('us').carrier).toBe('uC');
    const f = shootoutFormation('us', 'W');
    expect(f.spots.uC.pos).toMatchObject({ x: -4, z: 12 });
    expect(f.spots.uD.pos).toMatchObject({ x: 0, z: 12 });
    expect(shootoutFormation('them', 'D').spots.tC.pos).toMatchObject({ x: 2, z: -12 });
  });
});
