# Splash Zone map

A jet-ski trick game seen from a chase camera: each answer sends the ski off a launcher (a wave, a kicker ramp or a mega ramp, by the player's streak tier) and the trick either comes off or goes spectacularly wrong. The clock is the distance to the launcher. Three jet skis, endless run. Each world (Lagoon, Dino Lagoon, Harbour City, Iceberg Bay, Volcano Island, Shark Reef, Candy Cove, then round again) has seven normal turns and then its own Mega Stunt: three questions through checkpoint buoy gates, then one long course (Whale of a Time, Raptor Rapids, Harbour Havoc, Penguin Parade, Geyser Blast, Jaws-Some Jump, Sweet Tooth Rush) that clears as many elements as were right and wipes out on the next. After the Mega a blue wave wipes the screen and the next world appears with its name.

## Files

- `main.ts`: the game loop, learning loop, trick playback, respawn, coins, camera and wiring of everything below
- `rules.ts`: pure scoring, tiers, jet skis, approach and turbo maths, coin trails, spoken lines, worlds and the Mega count (`TRICK_IDS`, `tierFor`, `nextTrick`, `hitPoints`, `approach`, `coinSide`, `WORLD_ORDER`, `nextWorld`, `startsMega`, `NORMALS_PER_WORLD`, `MegaId`, `Passed`, `MEGA_BONUS`)
- `layout.ts`: camera poses and screen fitting (`playBand`, `bandShift`, `fovFor`, `chasePose`, `stuntPose`, `stuntDistance`, `blendCam`); the stunt camera is a 70-degree three-quarter side view, its distance set per trick from `trickFraming` (and, in a Mega course, per element from `megaFramingAt`: it frames the element being ridden, looks towards its middle via `megaLookBias`, and keeps the next element in frame)
- `anim.ts`: the animation toolkit (`track`, `prog`, `arc`, `swell`), the `Frame` type, launcher geometry (`LAUNCHERS`, `surfaceY`) and the shared run-up/arc/landing (`launch`, `clearDef`)
- `tricks.ts`: the fourteen tricks and fourteen wipeouts as one registry and sampler, plus the lifeguard respawn (`trickFrame`, `trickEvents`, `trickRate`, `TRICK_SPECS`, `respawnFrame`)
- `tricks-t1.ts`: tier 1 off the wave: Wave Hop, Spray Spin, Superman, Tail Stand
- `tricks-t2.ts`: tier 2 off the kicker: Backflip, Barrel Roll, Helicopter, Sugar Spin (a yaw spin with a confetti ribbon; fails sideways), Tail Whip (a dino tail swats the ski into a yaw spin, `Frame.tail`; fails when the swat is late and the ski lands upside down)
- `tricks-t3.ts`: tier 3 off the mega ramp: Double Backflip, Submarine, Corkscrew 720, Cotton Candy Cloud (bounces twice on a candy-floss cloud, `Frame.cloud`; fails when the cloud melts), Egg Hatch (lands on a giant egg that cracks, a baby dino kicks the ski into a backflip, `Frame.egg`; fails when the shell closes round the ski)
- `mega/mega.ts`: the Mega courses as authored animations and the frame lookup (`MEGA_SPECS`, `megaFrame`, `megaEvents`, `megaRate`, `megaFramingAt`, `megaLookBias`, `megaSegments`)
- `mega/anim.ts`: pure helpers for the course animations: routes, heading, flip easing (`route`, `flipEase`, `slopeAt`)
- `mega/whale-of-a-time.ts`: Lagoon Mega: palm sandbar island, whale bounce, spout and triple backflip (`WHALE_OF_A_TIME`, `SANDBAR`, `WHALE`, `SPOUT`)
- `mega/raptor-rapids.ts`: Dino Lagoon Mega: Brachiosaurus neck slide, Stegosaurus plate hop, T. rex jaw jump and the sneeze, bonk and chomp wipeouts (`RAPTOR_RAPIDS`, `NECK`, `STEGO`, `REX`, `neckY`, `stegoRampY`, `rexRampY`)
- `mega/harbour-havoc.ts`: Harbour City Mega: ferry leap, pier railing grind, drawbridge and fireworks (`HARBOUR_HAVOC`, `FERRY`, `PIER`, `BRIDGE`, `leafAngle`)
- `mega/penguin-parade.ts`: Iceberg Bay Mega: penguin floe hop, iceberg chute, ice arch spin and the ice cube wipeout (`PENGUIN_PARADE`, `FLOE`, `BERG`, `ARCH`, `BUMP`, `SKID`, `FREEZE`)
- `mega/geyser-blast.ts`: Volcano Island Mega: lava-rock arch leap, weaving coconut-boulders, steam geyser double corkscrew and the soot, bonk and parachute wipeouts (`GEYSER_BLAST`, `LAVA`, `BOULDERS`, `GEYSER`, `SOOT`, `BONK`, `CHUTE`)
- `mega/jaws-some-jump.ts`: Shark Reef Mega: the sunglasses shark jump and fetch, the giant wave's curl and tumble, the pirate ship's plank, sail holes and double backflip (`JAWS_SOME_JUMP`, `SHARK`, `FETCH`, `WAVE`, `TUMBLE`, `SHIP`, `TANGLE`, `sharkPose`, `sharkMouth`, `waveLevel`)
- `mega/sweet-tooth-rush.ts`: Candy Cove Mega: gummy bear belly boing, donut hole dash, sundae double backflip and the belly flop, glazed and meltdown wipeouts (`SWEET_TOOTH_RUSH`, `BEAR`, `DONUT`, `SUNDAE`, `FLOP`, `GLAZE`, `MELT`, `bellySquash`)
- `mega/props-kit.ts`: what the course props are built from (`MegaBuilt`, `profile`)
- `mega/whale-of-a-time-props.ts`: Whale of a Time meshes (`buildWhaleProps`, `tailAngle`, `spoutLevel`)
- `mega/raptor-rapids-props.ts`: Raptor Rapids meshes: the bowing, sneezing Brachiosaurus, the Stegosaurus with dipping plates, the T. rex with snapping jaws (`buildRaptorRapidsProps`)
- `mega/harbour-havoc-props.ts`: Harbour Havoc meshes (`buildHarbourHavocProps`)
- `mega/penguin-parade-props.ts`: Penguin Parade meshes: penguins, floe, iceberg, snow bank, arch, the ice cube (`buildPenguinParadeProps`)
- `mega/geyser-blast-props.ts`: Geyser Blast meshes: lava arch with soot puffs, falling coconut-boulders, the steam jet and the seaweed parachute (`buildGeyserBlastProps`, `geyserLevel`)
- `mega/jaws-some-jump-props.ts`: Jaws-Some Jump meshes: the shark, the translucent wave, the pirate ship with holed sails and crew, the sail bundle (`buildJawsSomeJumpProps`)
- `mega/sweet-tooth-rush-props.ts`: Sweet Tooth Rush meshes: the squashing gummy bear, the sprinkled donut, the waffle-cone ramp, glass sundae, cherry and cream splash (`buildSweetToothRushProps`)
- `mega/mega-props.ts`: the Mega courses and the checkpoint buoy gates as three.js objects (`createMegaCoursePool`, `createGate`)
- `jetski.ts`: the jet ski and the lifeguard's rescue boat (`createJetSki`, `createRescueBoat`)
- `rider.ts`: the kid rider's rig, life vest, faces (happy, scared, dizzy, soaked, sooty) and poses (`createRider`, `POSES`)
- `critters.ts`: the dolphin, the cotton candy cloud, the dino tail and egg and the seaweed and fish gag props (`createDolphin`, `createCloud`, `createTail`, `createEgg`, `createSeaweed`, `createFish`)
- `launchers.ts`: the wave, kicker and mega ramp meshes (`createLauncherPool`)
- `water.ts`: the heaving water plane and the V-shaped foam wake (`createWater`)
- `world.ts`: sky dome, fog, sun and the scenery recycled along the course; one set of islands, boats, a landmark and far strips per world (`createWorld`, `PALETTES`, `WorldTheme`)
- `scenery.ts`: the scenery shapes: `part`/`merge` helpers and the geometry of Iceberg Bay, Volcano Island, Shark Reef, Candy Cove and Dino Lagoon
- `effects.ts`: spray, splashes, bubbles, drips, confetti, fireworks as one pooled `Points` (`createEffects`, `MAX_PARTICLES`)
- `hud.ts`: question panel, wake strip, jet skis, score, tier meter, Mega pips, banner, comic words, the wave wipe and the world title (`createHud`)
- `kit.ts`: prop-building helpers that remember what to dispose (`Kit`, `ribbon`)
- `dev.ts`: dev query hooks (`parseDev`, `devOptions`, `Lab`)
- `voice.ts`: every spoken line that is not a fact (`VOICE_LINES`)

## Dev hooks

- `?tricks=backflip,submarine`: tricks come in this order and repeat; the launcher, tier and points follow each trick's tier.
- `?streak=6`: start the run with this streak (0 to 20). `?skis=1`: start with 1 to 3 jet skis.
- `?lab=<trickId>:<clear|fail>`: trick lab, loops one animation with its camera swing and the HUD hidden except the comic word. `?lab=respawn` loops the lifeguard boat.
- Tricks to look at: tail-whip:clear `at=0.78` (the swat), tail-whip:fail `at=2.1` (upside down); egg-hatch:clear `at=2.65` (baby dino and flip), egg-hatch:fail `at=2.5` (shell shut).
- `&at=<seconds>` freezes the lab at that time (effects and props included).
- `?lab=<megaId>:<0-3>`: the same lab for a Mega course (`whale-of-a-time`, `raptor-rapids`, `harbour-havoc`, `penguin-parade`, `geyser-blast`, `jaws-some-jump`, `sweet-tooth-rush`) with that many questions right: it clears that many elements and wipes out on the next (3 = the finale). `&at=` freezes it. Times to look at: whale-of-a-time:3 finale at `at=9`, :0 palm tangle `at=2.8`, :2 fizzle `at=8.6`; raptor-rapids:3 finale over the jaws `at=10.0`, neck slide `at=2.0`, :0 sneeze `at=2.0`, :1 plate bonk `at=5.0`, :2 chomp `at=9.4`; harbour-havoc:3 finale `at=9.7`, :0 lifeboat `at=3.7`, :1 crab pots `at=5.7`, :2 bridge drop `at=9`; penguin-parade:3 finale `at=9.2`, :0 penguin bump `at=1.95`, :1 snow bank `at=6`, :2 ice cube `at=9.8`; geyser-blast:3 finale `at=9.8`, :0 soot `at=2.1`, :1 boulder bonk `at=5.6`, :2 parachute `at=10.5`; jaws-some-jump:3 finale `at=9.5`, :0 shark fetch `at=1.7`, :1 wave tumble `at=5.4`, :2 tangled sails `at=8.7`; sweet-tooth-rush:3 bear boing `at=1.5`, donut `at=5.5`, sundae over the glass `at=9.6`, :0 belly flop `at=2.0`, :1 glazed `at=5.9`, :2 meltdown `at=10.3`.
- `?world=<lagoon|dino|harbour|iceberg|volcano|reef|candy>`: start the run in that world. `?mega=1`: the first turn is this world's Mega Stunt (banner, three gate questions, the course, then the wipe and the next world).
- Example: `npm run shots -- "splash-zone?lab=backflip:clear&at=1.3" "splash-zone?lab=submarine:fail&at=3.5" "splash-zone?lab=respawn&at=0.9" --sizes 844x390`

## Where changes go

- A new trick: a clear and a fail `Def` in the right `tricks-t*.ts`, `TrickId`, `TRICK_IDS`, `TRICK_TIER` and `TRICK_NAMES` in `rules.ts`, the registry and `FLOOR_Y` in `tricks.ts`.
- Scoring, tiers, jet skis or approach timing: `rules.ts`.
- A new Mega course: a `MegaSpec` (three elements, each a clear and a fail `Def`, a `cue` and a `floorY`) in `mega/<id>.ts`, its meshes in `mega/<id>-props.ts`, then `MegaId`, `MEGA_IDS` and `WORLD_MEGA` in `rules.ts`, the registries in `mega/mega.ts` and `mega/mega-props.ts` and the wake strip icon in `launcherIcon` (`hud.ts`). `main.ts` runs a course's `ambient` only while it waits ahead of the ski (`courseHeld`): once a stunt (or a lab frame) has posed the props, `update` is the only thing that moves them, so idle motion during a stunt (sway, bob, flag) goes in `update` too, from the stunt time.
- A new world: `WorldId`, `WORLD_ORDER`, `WORLD_NAMES` in `rules.ts`, `PALETTES` and a `case` in `world.ts` (its islands, boats, landmark and far strips) with the shapes in `scenery.ts`.
- A new effect or particle kind: `effects.ts` (and `EVENT` types in `anim.ts` for a trick to fire it).
- Rider poses or the vest: `rider.ts`. Ski or boat look: `jetski.ts`.
- Camera and screen fitting: `layout.ts` (a trick that needs a different view: its framing comes from `trickFraming` in `tricks.ts`). A new state that is hard to reach: extend `parseDev` in `dev.ts` and its test.

## Tests

- `tests/splash-zone.test.ts` (rules, layout probe, dev hooks, voice)
- `tests/splash-zone-tricks.test.ts` (all 28 animations and the respawn)
- `tests/splash-zone-mega.test.ts` (worlds, every Mega course with 0 to 3 right, the course props and gates, the stunt camera over every course and screen size)
