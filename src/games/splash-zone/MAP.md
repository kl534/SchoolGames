# Splash Zone map

A jet-ski trick game seen from a chase camera: each answer sends the ski off a launcher (a wave, a kicker ramp or a mega ramp, by the player's streak tier) and the trick either comes off or goes spectacularly wrong. The clock is the distance to the launcher. Three jet skis, endless run. Each world (Lagoon, Harbour City, Iceberg Bay, Volcano Island, then round again) has seven normal turns and then its own Mega Stunt: three questions through checkpoint buoy gates, then one long course (Whale of a Time, Harbour Havoc, Penguin Parade, Geyser Blast) that clears as many elements as were right and wipes out on the next. After the Mega a blue wave wipes the screen and the next world appears with its name. Shark Reef comes in the next commit.

## Files

- `main.ts`: the game loop, learning loop, trick playback, respawn, coins, camera and wiring of everything below
- `rules.ts`: pure scoring, tiers, jet skis, approach and turbo maths, coin trails, spoken lines, worlds and the Mega count (`TRICK_IDS`, `tierFor`, `nextTrick`, `hitPoints`, `approach`, `coinSide`, `WORLD_ORDER`, `nextWorld`, `startsMega`, `NORMALS_PER_WORLD`, `MegaId`, `Passed`, `MEGA_BONUS`)
- `layout.ts`: camera poses and screen fitting (`playBand`, `bandShift`, `fovFor`, `chasePose`, `stuntPose`, `stuntDistance`, `blendCam`); the stunt camera is a 70-degree three-quarter side view, its distance set per trick from `trickFraming` (and, in a Mega course, per element from `megaFramingAt`: it frames the element being ridden, looks towards its middle via `megaLookBias`, and keeps the next element in frame)
- `anim.ts`: the animation toolkit (`track`, `prog`, `arc`, `swell`), the `Frame` type, launcher geometry (`LAUNCHERS`, `surfaceY`) and the shared run-up/arc/landing (`launch`, `clearDef`)
- `tricks.ts`: the ten tricks and ten wipeouts as one registry and sampler, plus the lifeguard respawn (`trickFrame`, `trickEvents`, `trickRate`, `TRICK_SPECS`, `respawnFrame`)
- `tricks-t1.ts`: tier 1 off the wave: Wave Hop, Spray Spin, Superman, Tail Stand
- `tricks-t2.ts`: tier 2 off the kicker: Backflip, Barrel Roll, Helicopter
- `tricks-t3.ts`: tier 3 off the mega ramp: Double Backflip, Submarine, Corkscrew 720
- `mega/mega.ts`: the Mega courses as authored animations and the frame lookup (`MEGA_SPECS`, `megaFrame`, `megaEvents`, `megaRate`, `megaFramingAt`, `megaLookBias`, `megaSegments`)
- `mega/anim.ts`: pure helpers for the course animations: routes, heading, flip easing (`route`, `flipEase`, `slopeAt`)
- `mega/whale-of-a-time.ts`: Lagoon Mega: palm sandbar island, whale bounce, spout and triple backflip (`WHALE_OF_A_TIME`, `SANDBAR`, `WHALE`, `SPOUT`)
- `mega/harbour-havoc.ts`: Harbour City Mega: ferry leap, pier railing grind, drawbridge and fireworks (`HARBOUR_HAVOC`, `FERRY`, `PIER`, `BRIDGE`, `leafAngle`)
- `mega/penguin-parade.ts`: Iceberg Bay Mega: penguin floe hop, iceberg chute, ice arch spin and the ice cube wipeout (`PENGUIN_PARADE`, `FLOE`, `BERG`, `ARCH`, `BUMP`, `SKID`, `FREEZE`)
- `mega/geyser-blast.ts`: Volcano Island Mega: lava-rock arch leap, weaving coconut-boulders, steam geyser double corkscrew and the soot, bonk and parachute wipeouts (`GEYSER_BLAST`, `LAVA`, `BOULDERS`, `GEYSER`, `SOOT`, `BONK`, `CHUTE`)
- `mega/props-kit.ts`: what the course props are built from (`MegaBuilt`, `profile`)
- `mega/whale-of-a-time-props.ts`: Whale of a Time meshes (`buildWhaleProps`, `tailAngle`, `spoutLevel`)
- `mega/harbour-havoc-props.ts`: Harbour Havoc meshes (`buildHarbourHavocProps`)
- `mega/penguin-parade-props.ts`: Penguin Parade meshes: penguins, floe, iceberg, snow bank, arch, the ice cube (`buildPenguinParadeProps`)
- `mega/geyser-blast-props.ts`: Geyser Blast meshes: lava arch with soot puffs, falling coconut-boulders, the steam jet and the seaweed parachute (`buildGeyserBlastProps`, `geyserLevel`)
- `mega/mega-props.ts`: the Mega courses and the checkpoint buoy gates as three.js objects (`createMegaCoursePool`, `createGate`)
- `jetski.ts`: the jet ski and the lifeguard's rescue boat (`createJetSki`, `createRescueBoat`)
- `rider.ts`: the kid rider's rig, life vest, faces (happy, scared, dizzy, soaked, sooty) and poses (`createRider`, `POSES`)
- `critters.ts`: the dolphin and the seaweed and fish gag props (`createDolphin`, `createSeaweed`, `createFish`)
- `launchers.ts`: the wave, kicker and mega ramp meshes (`createLauncherPool`)
- `water.ts`: the heaving water plane and the V-shaped foam wake (`createWater`)
- `world.ts`: sky dome, fog, sun and the scenery recycled along the course; one set of islands, boats, a landmark and far strips per world (`createWorld`, `PALETTES`, `WorldTheme`)
- `scenery.ts`: the scenery shapes: `part`/`merge` helpers and the geometry of Iceberg Bay, Volcano Island and Shark Reef
- `effects.ts`: spray, splashes, bubbles, drips, confetti, fireworks as one pooled `Points` (`createEffects`, `MAX_PARTICLES`)
- `hud.ts`: question panel, wake strip, jet skis, score, tier meter, Mega pips, banner, comic words, the wave wipe and the world title (`createHud`)
- `kit.ts`: prop-building helpers that remember what to dispose (`Kit`, `ribbon`)
- `dev.ts`: dev query hooks (`parseDev`, `devOptions`, `Lab`)
- `voice.ts`: every spoken line that is not a fact (`VOICE_LINES`)

## Dev hooks

- `?tricks=backflip,submarine`: tricks come in this order and repeat; the launcher, tier and points follow each trick's tier.
- `?streak=6`: start the run with this streak (0 to 20). `?skis=1`: start with 1 to 3 jet skis.
- `?lab=<trickId>:<clear|fail>`: trick lab, loops one animation with its camera swing and the HUD hidden except the comic word. `?lab=respawn` loops the lifeguard boat.
- `&at=<seconds>` freezes the lab at that time (effects and props included).
- `?lab=<megaId>:<0-3>`: the same lab for a Mega course (`whale-of-a-time`, `harbour-havoc`, `penguin-parade`, `geyser-blast`) with that many questions right: it clears that many elements and wipes out on the next (3 = the finale). `&at=` freezes it. Times to look at: whale-of-a-time:3 finale at `at=9`, :0 palm tangle `at=2.8`, :2 fizzle `at=8.6`; harbour-havoc:3 finale `at=9.7`, :0 lifeboat `at=3.7`, :1 crab pots `at=5.7`, :2 bridge drop `at=9`; penguin-parade:3 finale `at=9.2`, :0 penguin bump `at=1.95`, :1 snow bank `at=6`, :2 ice cube `at=9.8`; geyser-blast:3 finale `at=9.8`, :0 soot `at=2.1`, :1 boulder bonk `at=5.6`, :2 parachute `at=10.5`.
- `?world=<lagoon|harbour|iceberg|volcano>`: start the run in that world. `?mega=1`: the first turn is this world's Mega Stunt (banner, three gate questions, the course, then the wipe and the next world).
- Example: `npm run shots -- "splash-zone?lab=backflip:clear&at=1.3" "splash-zone?lab=submarine:fail&at=3.5" "splash-zone?lab=respawn&at=0.9" --sizes 844x390`

## Where changes go

- A new trick: a clear and a fail `Def` in the right `tricks-t*.ts`, `TrickId`, `TRICK_IDS`, `TRICK_TIER` and `TRICK_NAMES` in `rules.ts`, the registry and `FLOOR_Y` in `tricks.ts`.
- Scoring, tiers, jet skis or approach timing: `rules.ts`.
- A new Mega course: a `MegaSpec` (three elements, each a clear and a fail `Def`, a `cue` and a `floorY`) in `mega/<id>.ts`, its meshes in `mega/<id>-props.ts`, then `MegaId`, `MEGA_IDS` and `WORLD_MEGA` in `rules.ts` and the registries in `mega/mega.ts` and `mega/mega-props.ts`.
- A new world: `WorldId`, `WORLD_ORDER`, `WORLD_NAMES` in `rules.ts` and `PALETTES` plus its scenery in `world.ts`.
- A new effect or particle kind: `effects.ts` (and `EVENT` types in `anim.ts` for a trick to fire it).
- Rider poses or the vest: `rider.ts`. Ski or boat look: `jetski.ts`.
- Camera and screen fitting: `layout.ts` (a trick that needs a different view: its framing comes from `trickFraming` in `tricks.ts`). A new state that is hard to reach: extend `parseDev` in `dev.ts` and its test.

## Tests

- `tests/splash-zone.test.ts` (rules, layout probe, dev hooks, voice)
- `tests/splash-zone-tricks.test.ts` (all 20 animations and the respawn)
- `tests/splash-zone-mega.test.ts` (worlds, every Mega course with 0 to 3 right, the course props and gates, the stunt camera over every course and screen size)
