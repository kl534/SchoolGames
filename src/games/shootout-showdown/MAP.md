# Shootout Showdown map

A real hockey shootout against a named rival: a coin toss, three different shooters a side (centre #19, wing #9, defence #4) taking turns, an early finish when a side cannot catch up, then sudden death with full rounds. One question is one shot: a right answer scores for us or stops their shot. A fast right answer gives a flashier shot (`flashy`, `solid`, `plain`). One shootout is one run.

## Files

- `main.ts`: the game loop, learning loop, intro, shot playback, camera and wiring of everything below
- `rules.ts`: pure shootout state (`newShootout`, `nextShot`, `shootoutDecided`, `step`, `coinToss`), the fixed calls and banner words (`SHOT_CALL`, `shotBanner`, `shooterBanner`), `outcomeText`
- `dev.ts`: dev query hooks (`forcedFirst`, `forcedBand`, `autoAnswer`, `freezeAt`, `devShootout`, `hasDevShots`)
- `voice.ts`: every spoken line that is not a fact (`VOICE_LINES`)

The rink, people, scorebug, camera and the shot animation come from `src/shared/hockey/` (see `src/games/slap-shot/MAP.md` for the list): `shootout.ts` (`shootoutFormation`, `shootoutShot`), `band.ts` (`bandFor`), `teams.ts`, `hud.ts` and `hud.css`.

## Dev hooks

- `?first=us|them`: who shoots first, instead of the coin toss.
- `?shots=110-101`: our results, a dash, their results (`1` goal, `0` miss). The counts must fit the order or they are ignored.
- `?band=flashy|solid|plain`: the style of every shot.
- `?auto=right|wrong`: answer the first question 0.3 s after its reading ends (and skip the intro and the shooter banner).
- `?at=1.7`: freeze the first shot at that script time; the HUD stays.
- Examples: `npm run shots -- "shootout-showdown?shots=101-101&first=us" --start` (sudden death), `"shootout-showdown?first=them&auto=wrong&at=2.1"` (their goal)

## Where changes go

- Rules, order of shooters, rounds and the words on screen: `rules.ts` (then `voice.ts` and `npm run voice` for spoken lines).
- What a shot looks like for each speed: `src/shared/hockey/shootout.ts`; the times that pick the speed: `src/shared/hockey/band.ts`.
- Stars and score saving, the intro and the order of announcements: `main.ts`.
- A new rival: `src/shared/hockey/teams.ts` (then `npm run voice`).

## Tests

- `tests/shootout-showdown.test.ts`
- `tests/hockey-shared.test.ts` (the shared shootout shot and formation)
