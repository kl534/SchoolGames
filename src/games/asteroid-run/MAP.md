# Asteroid Run map

A 3D space shooter: fly a ship down a chase-camera corridor and lock on to the asteroid that holds the right answer; every 8th target is a boss.

## Files

- `main.ts`: the whole game loop, learning loop, HUD and input wiring
- `rules.ts`: pure scoring, streaks, shields, boss rules, spoken lines (`hitPoints`, `SHIELDS`, `BOSS_EVERY`, `approachZ`)
- `layout.ts`: where the ship, camera and spawn depths are (`SHIP_Z`, `SPAWN_Z`, `CAM_BACK`)
- `asteroid.ts`: one answer asteroid and the boss (`createAsteroid`, `NORMAL_RADIUS`, `BOSS_RADIUS`)
- `rocks.ts`: procedural rock and crack geometry with noise (`rockGeometry`, `crackGeometry`, `fbm3`)
- `obstacles.ts`: the pooled bonus crystals (`createObstacles`, `CRYSTAL_RADIUS`, `SHIP_RADIUS`)
- `ship.ts`: the player's ship mesh and its banking and thrusters (`createShip`)
- `backdrop.ts`: nebula, stars and fog (`buildBackdrop`, `FOG_COLOR`)
- `effects.ts`: explosions, sparks and other particles (`createEffects`)
- `voice.ts`: every spoken line that is not a fact (`VOICE_LINES`)

## Dev hooks

None.

## Where changes go

- Scoring, shields, boss timing or speed: `rules.ts` (with a test in `tests/asteroid-run.test.ts`).
- A new thing the ship can hit or collect: a builder in `obstacles.ts`, spawned from `main.ts`.
- Camera or spawn distances: `layout.ts`.
- A new spoken line: a pure function in `rules.ts`, listed in `voice.ts`, then `npm run voice`.
- Look of rocks, ship or sky: `rocks.ts` / `asteroid.ts`, `ship.ts`, `backdrop.ts`.

## Tests

- `tests/asteroid-run.test.ts`
- `tests/tap-to-continue.test.ts` (checks the tap-to-continue flow in `main.ts`)
