# Zombie Blast map

A lane defence game: four answer lanes, zombies shamble towards a barricade, and you throw a bomb into the lane with the right answer; bosses come every few waves.

## Files

- `main.ts`: the game loop, learning loop, HUD, input and wave flow
- `rules.ts`: pure waves, spawning, scoring, streaks, bomb arcs, spoken lines (`createWaveSpawner`, `hitPoints`, `walkSpeed`, `BRAINS`)
- `layout.ts`: lane, barricade and camera positions (`LANES`, `BARRICADE_Z`, `SPAWN_Z`, `CAMERA`)
- `zombie.ts`: the zombie figure, its looks, armour and animations (`ZOMBIE_LOOKS`, `ARMOUR_ORDER`, `BRUTE_LOOK`)
- `horde.ts`: the pool of zombie slots, walking and lying on the grass (`createHorde`, `SlotState`)
- `thrower.ts`: the kid behind the fence who throws (`createThrower`, `RELEASE_TIME`)
- `bomb.ts`: the thrown bomb mesh (`createBomb`, `BOMB_RADIUS`)
- `field.ts`: sky, ground and the breakable barricade (`buildField`, `barricade`)
- `effects.ts`: blasts, smoke and other particles (`createEffects`)
- `voice.ts`: every spoken line that is not a fact (`VOICE_LINES`)

## Dev hooks

None.

## Where changes go

- Wave size, speed, lives or score: `rules.ts`.
- A new zombie look or armour piece: `zombie.ts`, then `horde.ts` if the pool needs it.
- Lane count or camera: `layout.ts` (and the lane picking in `rules.ts`).
- Barricade damage or look: `field.ts`.
- A new spoken line: a pure function in `rules.ts`, listed in `voice.ts`, then `npm run voice`.

## Tests

- `tests/zombie-blast.test.ts`
- `tests/tap-to-continue.test.ts` (checks the tap-to-continue flow in `main.ts`)
