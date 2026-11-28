import { readFileSync } from 'node:fs';
import { Mesh, Vector3, type Object3D, type SkinnedMesh } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { runs } from './helpers/full';
import { NO_ASSETS, type PeopleAssets } from '../src/games/fore/assets';
import { createCaddie } from '../src/games/fore/caddie';
import { HOLES } from '../src/games/fore/course';
import {
  ARC_HALF,
  CLAP_SECONDS,
  ROPE_R,
  arcCentre,
  clapAmount,
  galleryLayout,
  shouldClap,
} from '../src/games/fore/gallery';
import { createGolfer } from '../src/games/fore/golfer';
import { FALLBACK_LOOK, type Look } from '../src/games/fore/ground';
import { buildHole } from '../src/games/fore/hole';
import { GFX_SETTINGS } from '../src/games/fore/quality';
import { placeScenery } from '../src/games/fore/scenery';
import { SWING_TIMING } from '../src/games/fore/swing';

/** The pictures cannot be decoded in Node, so the loader gets a stand-in for them. */
async function parse(file: string): Promise<GLTF> {
  const g = globalThis as unknown as Record<string, unknown>;
  g.self ??= globalThis;
  g.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} });
  const bytes = readFileSync(`public/fore/people/${file}`);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return new Promise((res, rej) => loader.parse(buffer, '', res, rej));
}

let people: PeopleAssets;
beforeAll(async () => {
  const [golfer, caddie, hair] = await Promise.all([
    parse('golfer.glb'),
    parse('caddie.glb'),
    parse('hair.glb'),
  ]);
  people = { golfer, caddie, hair, weave: null as never };
});

const world = (o: Object3D) => o.getWorldPosition(new Vector3());

describe('the golfer with the model', () => {
  it('is the rig when no model is given or loaded', () => {
    const g = createGolfer();
    expect(g.skin).toBeNull();
    g.setModel(null);
    expect(g.skin).toBeNull();
    let rigShown = false;
    g.person.root.traverse((o) => {
      if ((o as Mesh).isMesh && o.name !== 'blob' && o.visible) rigShown = true;
    });
    expect(rigShown).toBe(true);
  });

  it('hides the rig and takes it back when the model goes', () => {
    const g = createGolfer();
    g.setModel(people);
    expect(g.skin).not.toBeNull();
    let rigShown = 0;
    g.person.root.traverse((o) => {
      if (
        (o as Mesh).isMesh &&
        o.name !== 'blob' &&
        o.visible &&
        !g.skin!.root.getObjectById(o.id)
      ) {
        rigShown++;
      }
    });
    expect(rigShown).toBe(0);
    g.setModel(null);
    let back = false;
    g.person.root.traverse((o) => {
      if ((o as Mesh).isMesh && o.name !== 'blob' && o.visible) back = true;
    });
    expect(back).toBe(true);
  });

  it('keeps both palms on the club through the whole swing, whatever the club', () => {
    const g = createGolfer();
    g.root.position.set(3, 0, 5);
    g.root.rotation.y = 0.7;
    g.setModel(people);
    const palm = new Vector3();
    const hand = new Vector3();
    const step = runs(0.03, 0.08);
    for (const [id, carry, kind] of [
      ['driver', 240, 'full'],
      ['iron5', 150, 'full'],
      ['wedge', 70, 'half'],
      ['putter', 8, 'putt'],
    ] as const) {
      g.setClub({ id, carry });
      const seconds = SWING_TIMING[kind].seconds;
      for (let t = 0; t <= seconds + 0.4; t += step) {
        g.play('swing', Math.min(t, seconds), step);
        for (const side of ['L', 'R'] as const) {
          g.skin!.palm(side, palm);
          g.person.handWorld(side, hand).add(g.skin!.clubShift);
          expect(palm.distanceTo(hand), `${id} ${side} at ${t.toFixed(2)}`).toBeLessThan(0.045);
        }
      }
    }
  });

  it('keeps its arm and leg bones the same length while it swings', () => {
    const g = createGolfer();
    g.setModel(people);
    const bone = (n: string) => g.skin!.root.getObjectByName(n)!;
    const length = (a: string, b: string) => world(bone(a)).distanceTo(world(bone(b)));
    g.play('address', 0, 0.1);
    const rest = {
      upper: length('upperarm_l', 'lowerarm_l'),
      fore: length('lowerarm_l', 'hand_l'),
      thigh: length('thigh_r', 'calf_r'),
      shin: length('calf_r', 'foot_r'),
    };
    for (let t = 0; t <= 1.2; t += 0.1) {
      g.play('swing', t, 0.1);
      expect(length('upperarm_l', 'lowerarm_l')).toBeCloseTo(rest.upper, 3);
      expect(length('lowerarm_l', 'hand_l')).toBeCloseTo(rest.fore, 3);
      expect(length('thigh_r', 'calf_r')).toBeCloseTo(rest.thigh, 3);
      expect(length('calf_r', 'foot_r')).toBeCloseTo(rest.shin, 3);
    }
  });

  it('keeps its feet on the rig’s and never lifts above 3 cm of them or sinks under the grass', () => {
    const g = createGolfer();
    g.setModel(people);
    const foot = new Vector3();
    for (let t = 0; t <= 1.2; t += 0.1) {
      g.play('swing', t, 0.1);
      for (const side of ['L', 'R'] as const) {
        const rig = g.person.legs[side].ankle.getWorldPosition(new Vector3());
        foot.copy(world(g.skin!.root.getObjectByName(`foot_${side.toLowerCase()}`)!));
        expect(Math.hypot(foot.x - rig.x, foot.z - rig.z)).toBeLessThan(0.1);
        expect(foot.y).toBeGreaterThan(0.02);
      }
    }
  });

  it('dresses the model, 2 yd tall with the cap on', () => {
    const g = createGolfer();
    g.setModel(people);
    g.play('address', 0, 0.1);
    let top = 0;
    g.skin!.root.traverse((o) => {
      if (!(o as Mesh).isMesh || !o.visible) return;
      const m = o as Mesh;
      m.geometry.computeBoundingBox();
      top = Math.max(top, m.geometry.boundingBox!.max.y);
    });
    expect(top).toBeGreaterThan(0.1);
    expect(g.skin!.root.scale.x).toBeGreaterThan(0.9);
    expect(g.skin!.root.scale.x).toBeLessThan(1.2);
  });
});

describe('the caddie with the model', () => {
  it('reaches its hands to the rig through idle, a cheer and a groan', () => {
    const c = createCaddie();
    c.setModel(people);
    expect(c.skin).not.toBeNull();
    const hand = new Vector3();
    const palm = new Vector3();
    for (const move of ['idle', 'cheer', 'groan'] as const) {
      c.react(move);
      for (let i = 0; i < 16; i++) {
        c.update(0.05);
        for (const side of ['L', 'R'] as const) {
          c.skin!.palm(side, palm);
          c.person.handWorld(side, hand);
          expect(palm.distanceTo(hand), `${move} ${side}`).toBeLessThan(0.07);
        }
      }
    }
  });

  it("wears the golfer's (male) body, with its own bib weights, while the golfer keeps his glove", () => {
    const g = createGolfer();
    g.setModel(people);
    const c = createCaddie();
    c.setModel(people);
    // The body is the biggest skinned mesh.
    const body = (root: Object3D): SkinnedMesh => {
      const meshes: SkinnedMesh[] = [];
      root.traverse((o) => {
        if ((o as SkinnedMesh).isSkinnedMesh) meshes.push(o as SkinnedMesh);
      });
      const size = (m: SkinnedMesh) => m.geometry.getAttribute('position').count;
      return meshes.reduce((a, b) => (size(b) > size(a) ? b : a));
    };
    const male = body(people.golfer.scene).geometry.getAttribute('position').count;
    const female = body(people.caddie.scene).geometry.getAttribute('position').count;
    const golferBody = body(g.skin!.root).geometry;
    const caddieBody = body(c.skin!.root).geometry;
    expect(caddieBody.getAttribute('position').count).toBe(male);
    expect(male).not.toBe(female);
    expect(caddieBody).not.toBe(golferBody);
    const accentSum = (geometry: typeof golferBody) => {
      const region = geometry.getAttribute('aRegion');
      let sum = 0;
      for (let i = 0; i < region.count; i++) sum += region.getW(i);
      return sum;
    };
    // Each copy carries its own accent: the bib on the caddie, the glove on the golfer.
    expect(Math.abs(accentSum(caddieBody) - accentSum(golferBody))).toBeGreaterThan(100);
  });

  it('keeps both feet down while it cheers', () => {
    const c = createCaddie();
    c.setModel(people);
    c.react('cheer');
    for (let i = 0; i < 12; i++) {
      c.update(0.05);
      for (const n of ['foot_l', 'foot_r']) {
        expect(world(c.skin!.root.getObjectByName(n)!).y).toBeGreaterThan(0.02);
      }
    }
  });
});

describe('the gallery', () => {
  it('stands outside the rope, off the hazards, facing the pin, on the side away from the path', () => {
    for (const h of HOLES) {
      const side = placeScenery(h).groveSide;
      const { stakes, spots } = galleryLayout(h, side, 24);
      expect(spots.length).toBeGreaterThan(14);
      expect(spots.length).toBeLessThanOrEqual(24);
      expect(Math.sign(Math.sin(arcCentre(side)))).toBe(-side);
      for (const s of spots) {
        const r = Math.hypot(s.x - h.pin.x, s.z - h.pin.z);
        expect(r).toBeGreaterThanOrEqual(ROPE_R + 2 - 1e-6);
        expect(r).toBeLessThanOrEqual(ROPE_R + 5 + 1e-6);
        expect(s.height).toBeGreaterThanOrEqual(1.75);
        expect(s.height).toBeLessThanOrEqual(2);
        for (const hz of h.hazards) {
          expect(
            ((s.x - hz.at.x) / hz.at.rx) ** 2 + ((s.z - hz.at.z) / hz.at.rz) ** 2,
          ).toBeGreaterThan(1);
        }
        const toPin = Math.atan2(h.pin.x - s.x, h.pin.z - s.z);
        expect(Math.cos(s.yaw - toPin)).toBeGreaterThan(0.999);
      }
      // Stakes every 3 yd along the rope's arc.
      for (let i = 1; i < stakes.length; i++) {
        const d = Math.hypot(stakes[i].x - stakes[i - 1].x, stakes[i].z - stakes[i - 1].z);
        expect(d).toBeGreaterThan(2.4);
        expect(d).toBeLessThan(3.2);
      }
      const arc = (2 * ARC_HALF * Math.PI) / 180;
      expect(arc * ROPE_R).toBeGreaterThan(40);
    }
  });

  it('is deterministic, and every spectator is at least 28 yd from the pin', () => {
    const h = HOLES[3];
    expect(galleryLayout(h, 1, 24)).toEqual(galleryLayout(h, 1, 24));
    for (const s of galleryLayout(h, -1, 24).spots) {
      expect(Math.hypot(s.x - h.pin.x, s.z - h.pin.z)).toBeGreaterThanOrEqual(28);
    }
  });

  it('claps for a holed ball or one resting within 2 yd of the pin, for 1.5 s', () => {
    const pin = { x: 0, z: 300 };
    expect(shouldClap({ kind: 'holed', land: pin }, pin)).toBe(true);
    const rest = (x: number, z: number) =>
      ({ kind: 'rest', land: pin, at: { x, z }, surface: 'green' }) as const;
    expect(shouldClap(rest(1.5, 300), pin)).toBe(true);
    expect(shouldClap(rest(2.5, 300), pin)).toBe(false);
    expect(shouldClap({ kind: 'water', land: pin, splash: pin, drop: pin }, pin)).toBe(false);
    expect(clapAmount(-0.1)).toBe(0);
    expect(clapAmount(0.8)).toBe(1);
    expect(clapAmount(CLAP_SECONDS + 0.01)).toBe(0);
    expect(clapAmount(0.05)).toBeGreaterThan(0);
    expect(clapAmount(0.05)).toBeLessThan(1);
  });

  it('is built behind each green on the tiers that have it, and disposed', () => {
    const look = (gfx: 'low' | 'medium' | 'high'): Look => ({
      ...FALLBACK_LOOK,
      settings: GFX_SETTINGS[gfx],
      assets: { ...NO_ASSETS, people },
    });
    const none = buildHole(HOLES[0], look('low'));
    expect(none.gallery).toBeNull();
    none.dispose();
    for (const gfx of ['medium', 'high'] as const) {
      const hole = buildHole(HOLES[runs(3, 0)], look(gfx));
      expect(hole.gallery).not.toBeNull();
      expect(hole.gallery!.stats.spectators).toBeGreaterThan(GFX_SETTINGS[gfx].gallery * 0.6);
      expect(hole.gallery!.stats.spectators).toBeLessThanOrEqual(GFX_SETTINGS[gfx].gallery);
      // Seen only close to the green.
      hole.gallery!.update(0, new Vector3(0, 2, 0));
      expect(hole.gallery!.object.visible).toBe(false);
      hole.gallery!.update(
        0,
        new Vector3(HOLES[runs(3, 0)].pin.x, 2, HOLES[runs(3, 0)].pin.z - 60),
      );
      expect(hole.gallery!.object.visible).toBe(true);
      hole.gallery!.clap(0);
      hole.gallery!.update(
        0.7,
        new Vector3(HOLES[runs(3, 0)].pin.x, 2, HOLES[runs(3, 0)].pin.z - 60),
      );
      hole.dispose();
    }
  });
});
