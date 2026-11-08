# Splash Zone map

A jet-ski trick game seen from a chase camera: each answer sends the ski off a launcher (a wave, a kicker ramp or a mega ramp, by the player's streak tier) and the trick either comes off or goes spectacularly wrong. The clock is the distance to the launcher. Three jet skis, endless run. The Lagoon is the only world so far; Mega Stunts and the other worlds come in later PRs.

## Files

- `main.ts`: the game loop, learning loop, trick playback, respawn, coins, camera and wiring of everything below
- `rules.ts`: pure scoring, tiers, jet skis, approach and turbo maths, coin trails, spoken lines (`TRICK_IDS`, `tierFor`, `nextTrick`, `hitPoints`, `approach`, `coinSide`)
- `layout.ts`: camera poses and screen fitting (`playBand`, `bandShift`, `fovFor`, `chasePose`, `stuntPose`, `blendCam`, `riseFor`)
- `anim.ts`: the animation toolkit (`track`, `prog`, `arc`, `swell`), the `Frame` type, launcher geometry (`LAUNCHERS`, `surfaceY`) and the shared run-up/arc/landing (`launch`, `clearDef`)
- `tricks.ts`: the ten tricks and ten wipeouts as one registry and sampler, plus the lifeguard respawn (`trickFrame`, `trickEvents`, `trickRate`, `TRICK_SPECS`, `respawnFrame`)
- `tricks-t1.ts`: tier 1 off the wave: Wave Hop, Spray Spin, Superman, Tail Stand
- `tricks-t2.ts`: tier 2 off the kicker: Backflip, Barrel Roll, Helicopter
- `tricks-t3.ts`: tier 3 off the mega ramp: Double Backflip, Submarine, Corkscrew 720
- `jetski.ts`: the jet ski and the lifeguard's rescue boat (`createJetSki`, `createRescueBoat`)
- `rider.ts`: the kid rider's rig, life vest and poses (`createRider`, `POSES`)
- `critters.ts`: the dolphin and the seaweed and fish gag props (`createDolphin`, `createSeaweed`, `createFish`)
- `launchers.ts`: the wave, kicker and mega ramp meshes (`createLauncherPool`)
- `water.ts`: the heaving water plane and the V-shaped foam wake (`createWater`)
- `world.ts`: sky dome, fog, sun and the scenery recycled along the course; the Lagoon (`createWorld`, `PALETTES`)
- `effects.ts`: spray, splashes, bubbles, drips, confetti, fireworks as one pooled `Points` (`createEffects`, `MAX_PARTICLES`)
- `hud.ts`: question panel, wake strip, jet skis, score, tier meter, banner and comic words (`createHud`)
- `kit.ts`: prop-building helpers that remember what to dispose (`Kit`, `ribbon`)
- `dev.ts`: dev query hooks (`parseDev`, `devOptions`, `Lab`)
- `voice.ts`: every spoken line that is not a fact (`VOICE_LINES`)

## Dev hooks

- `?tricks=backflip,submarine`: tricks come in this order and repeat; the launcher, tier and points follow each trick's tier.
- `?streak=6`: start the run with this streak (0 to 20). `?skis=1`: start with 1 to 3 jet skis.
- `?lab=<trickId>:<clear|fail>`: trick lab, loops one animation with its camera swing and the HUD hidden except the comic word. `?lab=respawn` loops the lifeguard boat.
- `&at=<seconds>` freezes the lab at that time (effects and props included).
- Example: `npm run shots -- "splash-zone?lab=backflip:clear&at=1.3" "splash-zone?lab=submarine:fail&at=3.5" "splash-zone?lab=respawn&at=0.9" --sizes 844x390`

## Where changes go

- A new trick: a clear and a fail `Def` in the right `tricks-t*.ts`, `TrickId`, `TRICK_IDS`, `TRICK_TIER` and `TRICK_NAMES` in `rules.ts`, the registry and `FLOOR_Y` in `tricks.ts`.
- Scoring, tiers, jet skis or approach timing: `rules.ts`.
- A new effect or particle kind: `effects.ts` (and `EVENT` types in `anim.ts` for a trick to fire it).
- Rider poses or the vest: `rider.ts`. Ski or boat look: `jetski.ts`.
- Camera and screen fitting: `layout.ts`. A new state that is hard to reach: extend `parseDev` in `dev.ts` and its test.

## Tests

- `tests/splash-zone.test.ts` (rules, layout probe, dev hooks, voice)
- `tests/splash-zone-tricks.test.ts` (all 20 animations and the respawn)
