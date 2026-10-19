# Grape Gobble map

A 60-second kitchen round: answer fast to feed a kid grapes; a wrong answer plays a slapstick gag with the grapes.

## Files

- `main.ts`: the round loop, learning loop, HUD and cue playback
- `rules.ts`: pure round clock, gags and spoken lines (`ROUND_SECONDS`, `GAGS`, `GAG_SECONDS`, `clockText`)
- `layout.ts`: camera fit for the kitchen, using a subject box (`fitCamera`, `playBand`)
- `gags.ts`: every gag as keyframed `KidFrame`s and sound cues (`gagFrame`, `GAG_CUES`, `restFrame`)
- `ik.ts`: two-bone arm solver and `Vec3` helpers (`solveArm`, `vec3`)
- `kid.ts`: the kid mesh posed from a `KidFrame` (`createKid`)
- `kitchen.ts`: table, bowl, plate and grape meshes (`createKitchen`, `createGrapeMesh`, `BOWL_POS`)
- `effects.ts`: juice, dust and star bursts (`createEffects`)
- `dev.ts`: dev query hooks (`forcedGag`, `devRoundSeconds`, `devFrame`)

## Dev hooks

- `?gag=<name>`: every wrong answer plays that gag (`forehead`, `under-table`, `dog`, `face-splat`, `air-chomp`, `cheek`, `hair`, `juice`).
- `?time=<seconds>`: round length, 1 to 600.
- `?frame=<gag>:<seconds>`: shows that one frame of a gag, HUD hidden, no preview or round.
- Example: `npm run shots -- grape-gobble?frame=forehead:1`

## Where changes go

- A new gag: add its name to `GAGS` and `GAG_SECONDS` in `rules.ts`, its frames and cues in `gags.ts`.
- A new pose part or kid mesh change: `kid.ts` (and `KidFrame` in `gags.ts`).
- Round length, milestones or plate size: `rules.ts`.
- Table, plate or grape look: `kitchen.ts`.
- Camera framing on phones or tablets: `layout.ts`.

## Tests

- `tests/grape-gobble.test.ts`
- `tests/tap-to-continue.test.ts` (checks the tap-to-continue flow in `main.ts`)
