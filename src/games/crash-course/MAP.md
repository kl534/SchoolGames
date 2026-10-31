# Crash Course map

A stunt-bike side view: each answer sends the bike at an obstacle (10 kinds, each with a clear and a crash version) and every 8th is a Mega Stunt course of three big elements.

## Files

- `main.ts`: the game loop, learning loop, stunt playback and wiring of everything below
- `rules.ts`: pure scoring, bikes, speed, obstacle and Mega choice, approach and nitro maths, spoken lines (`OBSTACLE_KINDS`, `MEGA_IDS`, `hitPoints`, `nextKind`, `approach`)
- `layout.ts`: side-view screen fitting (`fitView`, `playBand`, `FOV`)
- `stunts.ts`: the 40 obstacle stunts as keyframed animations plus the shared animation toolkit (`SPECS`, `track`, `ride`, `createFrame`)
- `obstacles.ts`: the ten obstacles as meshes posed by `update(outcome, variant, t)` (`createObstacle`, `createObstaclePool`)
- `kit.ts`: prop-building helpers that remember what to dispose (`Kit`, `ribbon`, `smooth`, `lerp`)
- `bike.ts`: the stunt bike and the parachute (`createBike`, `createParachute`)
- `rider.ts`: the kid rider's rig and poses (`createRider`, `runPose`, `mixPose`, `neutralPose`)
- `world.ts`: fairground sky, hills, crowd and road (`createWorld`, `Mood`, `ROAD_Z_FRONT`)
- `effects.ts`: dust, sparks, flames, confetti, fireworks as one pooled `Points` (`createEffects`, `MAX_PARTICLES`)
- `hud.ts`: question panel, road strip, bikes, banner and comic words (`createHud`, `GOAL_ICONS`)
- `dev.ts`: dev query hooks (`parseDev`, `devOptions`, `LabStunt`, `LabMega`)
- `voice.ts`: every spoken line that is not a fact (`VOICE_LINES`)
- `mega/mega.ts`: the Mega courses as authored animations and the frame lookup (`megaFrame`, `MEGA_SPECS`, `megaLength`)
- `mega/mega-obstacles.ts`: Mega courses and checkpoint gates as three.js objects (`createMegaCoursePool`, `createGate`)
- `mega/anim.ts`: pure helpers for Mega animations: routes, heading, easing (`route`, `heading`, `flipEase`, `pchip`, `windowDef`)
- `mega/triple-loop.ts`: Mega 1, three shrinking loops (`TRIPLE_LOOP`, `LOOPS`, `HOOP_GAP`)
- `mega/triple-loop-props.ts`: Triple Loop meshes (`buildTripleLoopProps`)
- `mega/sky-circus.ts`: Mega 2, one flight: human cannon onto three balloons into the Ferris wheel (`CANNON`, `BALLOON_X`, `FERRIS`, `OFFSETS`)
- `mega/sky-circus-props.ts`: Sky Circus meshes (`buildSkyCircusProps`)
- `mega/volcano-rush.ts`: Mega 3, lava leap, boulders and volcano (`LAVA_FROM`, `leapSurface`, `HILL`)
- `mega/volcano-rush-props.ts`: Volcano Rush meshes (`buildVolcanoRushProps`)
- `mega/inferno-drop.ts`: Mega 4, scaffold ramp, three flaming rings and foam pit (`RINGS`, `RAMP_TOP`, `CUSHION`)
- `mega/inferno-drop-props.ts`: Inferno Drop meshes (`buildInfernoDropProps`)

## Dev hooks

- `?kinds=loop,ramp`: obstacles come in this order and repeat (`loop`, `ramp`, `ring`, `crates`, `bridge`, `seesaw`, `coaster`, `halfpipe`, `penguins`, `wrecker`).
- `?megas=triple-loop,...`: Mega courses come in this order (`triple-loop`, `sky-circus`, `volcano-rush`, `inferno-drop`).
- `?mega=1`: the first obstacle is a Mega Stunt. `?bikes=1`: start with 1 to 3 bikes.
- `?lab=<kind>:<clear|crash>:<0|1>`: stunt lab, loops one stunt with the HUD hidden. `?lab=<megaId>:<0-3>`: the same for a Mega course with that many questions right.
- `&at=<seconds>` freezes the stunt at that time; `&nitro=1` shows a nitro run-up.
- Example: `npm run shots -- "crash-course?lab=loop:clear:0&at=1" "crash-course?lab=inferno-drop:3&at=4"`

## Where changes go

- A new obstacle: a builder in `obstacles.ts`, `OBSTACLE_KINDS` in `rules.ts`, a stunt per outcome and variant in `stunts.ts` (`SPECS`), then the goal icon in `hud.ts`.
- A new Mega course: `MegaId`/`MEGA_IDS` in `rules.ts`, `mega/<id>.ts` and `mega/<id>-props.ts`, registered in `mega/mega.ts` and `mega/mega-obstacles.ts`.
- Scoring, speed, bikes or approach timing: `rules.ts`.
- A new effect or particle kind: `effects.ts`.
- Rider poses or bike look: `rider.ts`, `bike.ts`.
- A new state that is hard to reach: extend `parseDev` in `dev.ts` and its test.

## Tests

- `tests/crash-course.test.ts`
- `tests/crash-course-stunts.test.ts` (all 40 stunts)
- `tests/crash-course-mega.test.ts` (Mega courses)
- `tests/tap-to-continue.test.ts` (tap-to-continue flow in `main.ts`)
