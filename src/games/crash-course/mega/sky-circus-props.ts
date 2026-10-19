/**
 * The props of the Sky Circus: a striped human cannon that fires the bike over a haystack, three
 * big balloons over a hay pit (they squash, pop and bob) and a Ferris wheel whose gondola carries
 * the bike up and launches it. Bright painted primitives like obstacles.ts; everything is built
 * once and only moved.
 */
import {
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { ribbon, ribbonMaterial, smooth, type Kit } from '../kit';
import { TAU } from '../stunts';
import { bump } from './anim';
import {
  BALLOON_PIT,
  BALLOON_R,
  BALLOON_SIT,
  BALLOON_X,
  BALLOON_Y,
  CANDY,
  CANNON,
  CANNON_MOUTH,
  ferrisPivot,
  ferrisSurface,
  ferrisTilt,
  ferrisTurn,
  FERRIS,
  FERRIS_RAMP,
  HAY_TOP,
  SKY_CIRCUS,
} from './sky-circus';
import type { MegaBuilt } from './triple-loop-props';

const RED = 0xe8403a;
const WHITE = 0xf6f6f6;
const GOLD = 0xffcf33;
const BLUE = 0x1e66d6;
const YELLOW = 0xffd43b;
const PINK = 0xff8fc7;

/** A lit material that shows both faces, for open tubes. */
function twoSided(kit: Kit, color: number): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color, roughness: 0.5, side: DoubleSide });
  kit.materials.push(m);
  return m;
}

const [CLEAR_1, CLEAR_2, CLEAR_3] = SKY_CIRCUS.elements.map((e) => e.clear.beats);
const [CRASH_1, CRASH_2] = SKY_CIRCUS.elements.map((e) => e.crash.beats);

/** A haystack mound with straws sticking out. */
function haystack(kit: Kit, parent: Group, x: number): void {
  const light = kit.lit(0xe9c45a, 1);
  const dark = kit.lit(0xc79a35, 1);
  const mound = kit.mesh(new SphereGeometry(1, 16, 12), light, parent, x, 0.1, 0);
  mound.scale.set(2.0, 1.25, 1.4);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU;
    const straw = kit.box(0.05, 0.7, 0.05, i % 2 ? dark : light, parent);
    straw.position.set(
      x + Math.cos(a) * (0.7 + (0.9 * ((i * 7) % 5)) / 5),
      1.2 + ((i * 3) % 4) * 0.08,
      ((i * 5) % 7) / 7 - 0.5,
    );
    straw.rotation.z = Math.cos(a) * 0.6;
  }
}

/** A striped pole with a pennant, for the big-top feeling. */
function pole(kit: Kit, parent: Group, x: number, z: number, h: number): void {
  for (let i = 0; i < 8; i++) {
    kit.box(
      0.2,
      h / 8,
      0.2,
      i % 2 ? kit.lit(WHITE, 0.5) : kit.lit(RED, 0.5),
      parent,
      x,
      ((i + 0.5) * h) / 8,
      z,
    );
  }
  kit.mesh(new SphereGeometry(0.22, 12, 8), kit.lit(GOLD, 0.3), parent, x, h + 0.1, z);
  const flag = kit.box(1.0, 0.5, 0.05, kit.lit(RED, 0.5), parent, x + 0.55, h - 0.3, z);
  flag.rotation.z = -0.15;
}

// ---------- Element 1: the Human Cannon ----------

function buildCannon(kit: Kit): MegaBuilt {
  const group = new Group();
  const red = twoSided(kit, RED);
  const white = twoSided(kit, WHITE);
  const gold = kit.lit(GOLD, 0.3);
  const barrel = new Group();
  group.add(barrel);
  const stripes = 8;
  for (let i = 0; i < stripes; i++) {
    const ring = kit.mesh(
      new CylinderGeometry(
        CANNON.radius,
        CANNON.radius,
        CANNON.length / stripes + 0.01,
        28,
        1,
        true,
      ),
      i % 2 ? white : red,
      barrel,
      ((i + 0.5) * CANNON.length) / stripes,
      0,
      0,
    );
    ring.rotation.z = -Math.PI / 2;
  }
  for (const x of [0, CANNON.length]) {
    const rim = kit.mesh(new TorusGeometry(CANNON.radius, 0.15, 8, 32), gold, barrel, x, 0, 0);
    rim.rotation.y = Math.PI / 2;
  }
  // The dark inside of the muzzle shows when the bike is not there.
  const inside = kit.mesh(
    new CylinderGeometry(CANNON.radius - 0.05, CANNON.radius - 0.05, 0.05, 24),
    kit.basic(0x2a1c1c),
    barrel,
    0.3,
    0,
    0,
  );
  inside.rotation.z = -Math.PI / 2;
  // The muzzle flash.
  const flash = kit.mesh(
    new SphereGeometry(0.9, 14, 10),
    kit.basic(0xffb02e),
    barrel,
    CANNON.length + 0.5,
    0,
    0.1,
  );
  flash.visible = false;
  // Wheels and a wooden frame under it.
  const wood = kit.lit(0xc98a4a, 0.8);
  const dark = kit.lit(0x3b3030, 0.7);
  for (const z of [-1.0, 1.0]) {
    for (const x of [4.7, 6.8]) {
      const wheel = kit.mesh(new CylinderGeometry(0.55, 0.55, 0.22, 18), wood, group, x, 0.55, z);
      wheel.rotation.x = Math.PI / 2;
      kit.mesh(new CylinderGeometry(0.15, 0.15, 0.26, 10), dark, group, x, 0.55, z).rotation.x =
        Math.PI / 2;
    }
  }
  kit.box(2.6, 0.18, 0.18, dark, group, 5.75, 0.55, -1.0);
  kit.box(2.6, 0.18, 0.18, dark, group, 5.75, 0.55, 1.0);
  haystack(kit, group, 12.8);
  pole(kit, group, 18.5, -1.8, 5.0);

  const place = (recoil: number, jolt: number, flashSize: number) => {
    barrel.position.set(
      CANNON_MOUTH.x - Math.cos(CANNON.angle) * recoil,
      CANNON_MOUTH.y - Math.sin(CANNON.angle) * recoil,
      0,
    );
    barrel.rotation.z = CANNON.angle + jolt;
    flash.visible = flashSize > 0.05;
    flash.scale.setScalar(Math.max(flashSize, 0.01));
  };
  place(0, 0, 0);
  return {
    group,
    update(outcome, t) {
      const fire = outcome === 'clear' ? CLEAR_1.fire : CRASH_1.fire;
      const kick = t >= fire ? bump(t, fire + 0.05, 0.3) : 0;
      const flare = t >= fire ? bump(t, fire + 0.05, 0.2) * 1.8 : 0;
      // The charge shakes it before it fires.
      const shake = t < fire && t > 0.5 ? 0.012 * Math.sin(t * 60) : 0;
      const jolt =
        outcome === 'crash'
          ? 0.06 * Math.sin((t - CRASH_1.fall) * 30) * bump(t, CRASH_1.fall + 0.1, 0.4)
          : 0;
      place(0.5 * kick, shake + jolt, flare);
    },
    ambient() {},
    reset() {
      place(0, 0, 0);
    },
  };
}

// ---------- Element 2: Balloon Hop ----------

function buildBalloons(kit: Kit): MegaBuilt {
  const group = new Group();
  const [pitFrom, pitTo] = BALLOON_PIT;
  const width = pitTo - pitFrom;
  const mid = (pitFrom + pitTo) / 2;
  // The pit: a back wall, a floor and a big pile of hay.
  kit.box(width, 14, 0.2, kit.lit(0x6a5a78, 1), group, mid, -7.5, -3.0);
  kit.box(width, 0.4, 4.2, kit.lit(0x8a6a3a, 1), group, mid, -2.8, -0.9);
  const hay = kit.lit(0xe9c45a, 1);
  const hayDark = kit.lit(0xc79a35, 1);
  const pile = kit.mesh(new SphereGeometry(1, 20, 12), hay, group, mid, -2.6, -0.6);
  pile.scale.set(width / 2 - 0.2, HAY_TOP + 2.6, 1.9);
  for (let i = 0; i < 30; i++) {
    const x = pitFrom + 1 + ((i * 37) % 100) * 0.1;
    const y = HAY_TOP - 0.25 - ((i * 13) % 5) * 0.05;
    const straw = kit.box(
      0.05,
      0.7,
      0.05,
      i % 2 ? hayDark : hay,
      group,
      x,
      y,
      0.3 + ((i * 7) % 5) * 0.1,
    );
    straw.rotation.z = ((i % 5) - 2) * 0.4;
  }
  // The big top: poles either side of the pit with a string of pennants between them.
  pole(kit, group, pitFrom - 0.6, -2.2, 5.6);
  pole(kit, group, pitTo + 0.6, -2.2, 5.6);
  const colors = [RED, YELLOW, BLUE, 0x39c46a];
  const flags = 14;
  for (let i = 0; i < flags; i++) {
    const u = (i + 0.5) / flags;
    const x = pitFrom - 0.6 + u * (width + 1.2);
    const sag = 0.6 * Math.sin(Math.PI * u);
    const f = kit.mesh(
      new ConeGeometry(0.28, 0.6, 3),
      kit.lit(colors[i % 4], 0.6),
      group,
      x,
      5.3 - sag,
      -2.2,
    );
    f.rotation.z = Math.PI;
  }

  // The balloons, each with a knot and a string tied to a sandbag in the pit.
  const colorOf = [RED, YELLOW, BLUE];
  interface Balloon {
    root: Group;
    body: Mesh;
    rag: Mesh;
  }
  const balloons: Balloon[] = BALLOON_X.map((x, k) => {
    const root = new Group();
    root.position.set(x, BALLOON_Y, 0);
    group.add(root);
    const mat = kit.lit(colorOf[k], 0.3);
    const body = kit.mesh(new SphereGeometry(BALLOON_R, 20, 14), mat, root);
    body.scale.set(1, 1.18, 1);
    // A shine.
    kit.mesh(
      new SphereGeometry(0.28, 10, 8),
      kit.basic(0xffffff, 0.55),
      root,
      -0.5,
      0.65,
      BALLOON_R * 0.85,
    );
    kit.mesh(new ConeGeometry(0.18, 0.3, 8), mat, root, 0, -BALLOON_R * 1.18 - 0.1, 0).rotation.z =
      Math.PI;
    // The limp rag that is left when it pops.
    const rag = kit.mesh(new SphereGeometry(0.45, 10, 8), mat, root, 0, -BALLOON_R * 1.18 - 0.6, 0);
    rag.scale.set(1, 0.35, 0.5);
    rag.visible = false;
    kit.box(
      0.03,
      BALLOON_Y + 2.6 - HAY_TOP - 1.5,
      0.03,
      kit.lit(0x333333, 1),
      group,
      x,
      (BALLOON_Y - BALLOON_R * 1.3 + HAY_TOP + 0.4) / 2,
      -0.25,
    );
    kit.box(0.5, 0.4, 0.4, kit.lit(0x7a5a2a, 1), group, x, HAY_TOP + 0.05, -0.25);
    return { root, body, rag };
  });

  // What the rider wears after the crash: a popped balloon on a string.
  const wear = new Group();
  const wearMat = kit.lit(colorOf[1], 0.3);
  kit.mesh(new SphereGeometry(0.4, 10, 8), wearMat, wear, 0, 0.7, 0).scale.set(1, 0.4, 0.5);
  kit.box(0.03, 0.7, 0.03, kit.lit(0x333333, 1), wear, 0, 0.35, 0);
  wear.position.set(BALLOON_SIT.x, BALLOON_SIT.y + 1.0, 0.2);
  wear.visible = false;
  group.add(wear);

  let playing = false;
  const rest = (k: number) => {
    const b = balloons[k];
    b.root.position.y = BALLOON_Y;
    b.body.scale.set(1, 1.18, 1);
    b.body.visible = true;
    b.rag.visible = false;
  };
  const show = (k: number, dip: number, wobble: number) => {
    const b = balloons[k];
    b.root.position.y = BALLOON_Y - 0.3 * dip + 0.04 * wobble;
    b.body.scale.set(1 + 0.12 * dip, 1.18 * (1 - 0.22 * dip) + 0.02 * wobble, 1 + 0.12 * dip);
  };
  return {
    group,
    update(outcome, t) {
      playing = true;
      const beats = outcome === 'clear' ? CLEAR_2 : CRASH_2;
      const hits = [beats.b1, beats.b2, beats.b3];
      for (let k = 0; k < 3; k++) {
        rest(k);
        const a = hits[k];
        if (outcome === 'crash' && k >= 1) {
          if (k === 1) {
            const popped = t >= CRASH_2.pop;
            balloons[k].body.visible = !popped;
            balloons[k].rag.visible = popped;
            if (!popped) balloons[k].root.position.y = BALLOON_Y + 0.05 * Math.sin(t * 6);
          }
          continue;
        }
        if (t < a) continue;
        const dip = bump(t, a + 0.07, 0.1);
        const wobble = Math.sin((t - a) * 18) * Math.exp(-(t - a) * 3.5);
        show(k, dip, wobble);
      }
      wear.visible = outcome === 'crash' && t >= CRASH_2.sit;
    },
    ambient(time) {
      if (playing) return;
      for (let k = 0; k < 3; k++) {
        balloons[k].root.position.y = BALLOON_Y + 0.12 * Math.sin(time * 1.5 + k * 1.7);
      }
    },
    reset() {
      playing = false;
      for (let k = 0; k < 3; k++) rest(k);
      wear.visible = false;
    },
  };
}

// ---------- Element 3: the Ferris wheel ----------

function buildFerris(kit: Kit): MegaBuilt {
  const group = new Group();
  const steel = kit.lit(0xdfe6f2, 0.4);
  const frame = kit.lit(0x8791a8, 0.5);
  const rib = ribbonMaterial(kit);
  // The ramp onto the loading platform.
  kit.mesh(
    ribbon(ferrisSurface, FERRIS_RAMP.from, FERRIS_RAMP.end, 0.4, 0, 1.5, RED, WHITE),
    rib,
    group,
  );
  // A landing pad for the finale.
  kit.box(6, 0.08, 3.0, kit.lit(0xffd43b, 0.6), group, CANDY.x + 3.2, 0.04, -0.3);
  for (let i = 0; i < 6; i++) {
    kit.box(
      0.5,
      0.09,
      3.02,
      i % 2 ? kit.lit(RED, 0.6) : kit.lit(WHITE, 0.6),
      group,
      CANDY.x + 0.75 + i,
      0.045,
      -0.3,
    );
  }

  // The wheel: two rims, spokes and a hub, turning together.
  const wheel = new Group();
  wheel.position.set(FERRIS.cx, FERRIS.cy, -1.0);
  group.add(wheel);
  for (const z of [-0.35, 0.35]) {
    kit.mesh(new TorusGeometry(FERRIS.r, 0.1, 8, 64), steel, wheel, 0, 0, z);
  }
  const bulbCount = 24;
  const bulbOff = kit.basic(0x4d566e);
  const bulbOn = kit.basic(0xffe066);
  const bulbFlash = kit.basic(0xff4fa0);
  const bulbs: Mesh[] = [];
  for (let i = 0; i < bulbCount; i++) {
    const a = (i / bulbCount) * TAU;
    bulbs.push(
      kit.mesh(
        new SphereGeometry(0.13, 8, 6),
        bulbOff,
        wheel,
        Math.cos(a) * (FERRIS.r + 0.15),
        Math.sin(a) * (FERRIS.r + 0.15),
        0.42,
      ),
    );
  }
  for (let i = 0; i < FERRIS.gondolas; i++) {
    const spoke = kit.box(FERRIS.r * 2, 0.07, 0.08, steel, wheel);
    spoke.rotation.z = (i / FERRIS.gondolas) * Math.PI;
  }
  kit.mesh(new SphereGeometry(0.4, 14, 10), kit.lit(GOLD, 0.3), wheel, 0, 0, 0.1);
  // The A-frame legs behind.
  for (const side of [-1, 1]) {
    const dx = side * 2.4;
    const len = Math.hypot(dx, FERRIS.cy);
    const leg = kit.box(0.28, len, 0.28, frame, group, FERRIS.cx + dx / 2, FERRIS.cy / 2, -1.5);
    leg.rotation.z = Math.atan2(dx, FERRIS.cy) * -1;
    kit.box(1.0, 0.2, 0.9, frame, group, FERRIS.cx + dx, 0.1, -1.5);
  }

  // Gondolas: they hang upright from the rim whatever the wheel does.
  const cabinColors = [RED, YELLOW, BLUE, 0x39c46a, 0xff8a1f, 0xb06af0, PINK, 0x2ec4c4];
  const gondolas: Group[] = [];
  const cabins: Group[] = [];
  for (let i = 0; i < FERRIS.gondolas; i++) {
    const pivot = new Group();
    const cabin = new Group();
    pivot.add(cabin);
    group.add(pivot);
    const color = kit.lit(cabinColors[i], 0.4);
    const loading = i === 0;
    const w = loading ? 2.6 : 1.7;
    // An open tray: floor, back wall and low rails, so the bike shows inside.
    kit.box(w, 0.16, 1.6, color, cabin, 0, -FERRIS.drop - 0.42 - 0.08, 0);
    kit.box(w, 0.8, 0.1, color, cabin, 0, -FERRIS.drop - 0.1, -0.75);
    for (const s of [-1, 1])
      kit.box(0.1, 0.5, 1.6, color, cabin, (s * (w - 0.1)) / 2, -FERRIS.drop - 0.2, 0);
    if (!loading) kit.box(w + 0.3, 0.12, 1.8, kit.lit(WHITE, 0.5), cabin, 0, FERRIS.drop + 0.15, 0);
    // The hangers up to the pivot.
    for (const s of [-1, 1]) {
      const h = kit.box(
        0.05,
        0.9,
        0.05,
        steel,
        cabin,
        s * (w / 2 - 0.2),
        -FERRIS.drop + 0.2,
        -0.75,
      );
      h.rotation.z = s * 0.05;
    }
    gondolas.push(pivot);
    cabins.push(cabin);
  }

  let playing = false;
  let flashing = false;
  const pose = (theta: number, tilt: number) => {
    wheel.rotation.z = theta;
    for (let i = 0; i < FERRIS.gondolas; i++) {
      const p = ferrisPivot(theta, i);
      gondolas[i].position.set(p.x, p.y, -0.1);
      cabins[i].rotation.z = i === 0 ? tilt : 0;
    }
  };
  pose(0, 0);
  const lightBulbs = (time: number) => {
    bulbs.forEach((bulb, i) => {
      if (flashing) bulb.material = (i + Math.floor(time * 7)) % 2 === 0 ? bulbFlash : bulbOn;
      else bulb.material = (i + Math.floor(time * 5)) % 4 === 0 ? bulbOn : bulbOff;
    });
  };
  let clock = 0;
  return {
    group,
    update(outcome, t) {
      playing = true;
      const turn = ferrisTurn(outcome, t);
      pose(turn, ferrisTilt(outcome, t));
      flashing = outcome === 'clear' && t >= CLEAR_3.tip;
      lightBulbs(clock);
    },
    ambient(time) {
      clock = time;
      if (!playing) pose(0.04 * Math.sin(time * 0.8), 0);
      lightBulbs(time);
    },
    reset() {
      playing = false;
      flashing = false;
      pose(0, 0);
    },
  };
}

// ---------- The cotton candy pile (the crash) ----------

/** The pile the gondola flings the bike into: it puffs up when the bike lands. */
function candyPile(
  kit: Kit,
  parent: Group,
): { update(t: number, landAt: number): void; hide(): void } {
  const pile = new Group();
  pile.position.set(CANDY.x, 0, -0.1);
  parent.add(pile);
  const colors = [PINK, 0xaee3ff, 0xffffff, PINK];
  const puffs: Mesh[] = [];
  const spots = [
    [-1.5, 0.5, 0.9],
    [-0.6, 0.7, 1.1],
    [0.4, 0.9, 1.2],
    [1.4, 0.6, 1.0],
    [2.0, 0.45, 0.8],
    [-0.1, 1.4, 0.8],
    [0.8, 1.2, 0.7],
  ];
  spots.forEach(([x, y, r], i) => {
    puffs.push(
      kit.mesh(
        new SphereGeometry(r, 14, 10),
        kit.lit(colors[i % 4], 1),
        pile,
        x,
        y,
        ((i * 3) % 4) * 0.2 - 0.3,
      ),
    );
  });
  const stick = kit.box(0.16, 1.5, 0.16, kit.lit(0xe8d9b0, 1), pile, 2.3, 0.8, -0.8);
  stick.rotation.z = -0.2;
  pile.visible = false;
  return {
    update(t, landAt) {
      pile.visible = true;
      const grow = smooth((t - (landAt - 0.5)) / 0.4);
      pile.scale.set(grow, grow, grow);
      const dent = bump(t, landAt + 0.05, 0.2);
      puffs.forEach((p) => p.scale.setScalar(1 - 0.1 * dent));
    },
    hide() {
      pile.visible = false;
    },
  };
}

function buildFerrisWithCandy(kit: Kit): MegaBuilt {
  const ferris = buildFerris(kit);
  const candy = candyPile(kit, ferris.group);
  return {
    group: ferris.group,
    update(outcome, t) {
      ferris.update(outcome, t);
      if (outcome === 'crash') candy.update(t, SKY_CIRCUS.elements[2].crash.beats.land);
      else candy.hide();
    },
    ambient: ferris.ambient,
    reset() {
      ferris.reset();
      candy.hide();
    },
  };
}

/** The three elements of the Sky Circus, in order. */
export function buildSkyCircusProps(kit: Kit): [MegaBuilt, MegaBuilt, MegaBuilt] {
  return [buildCannon(kit), buildBalloons(kit), buildFerrisWithCandy(kit)];
}
