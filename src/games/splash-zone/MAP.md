# Splash Zone map

A jet-ski trick game seen from a chase camera: each answer sends the ski off a launcher (a wave, a kicker ramp or a mega ramp, by the player's streak tier) and the trick either comes off or goes spectacularly wrong. The clock is the distance to the launcher. Three jet skis, endless run; every world has seven normal turns and then a Mega Stunt (three questions through checkpoint buoy gates, then one long course).

The ride itself (the ski, camera, tricks, worlds, Mega courses, HUD) lives in `src/shared/jetski/`: read `src/shared/jetski/MAP.md` for it. This game is the quiz that drives it.

## Files

- `main.ts`: the quiz driver of the ride (`createRide` with a `RideDriver`): the learning loop (`startGameSession`, the fact feed, `answerOptions`, `pressAnswers`, number keys, the 🔊 button), the preview, `showFactMap`/`hideFactMap`, `tapFlow.reveal` after a miss and at the end, and `showResults`
- `dev.ts`: `devOptions()`: the ride's dev hooks (`parseRideDev` in `src/shared/jetski/dev.ts`) on this page
- `voice.ts`: every spoken line that is not a fact (`VOICE_LINES`)

## Dev hooks

The ride's hooks (`tricks`, `streak`, `skis`, `lab`, `at`, `world`, `mega`), listed in `src/shared/jetski/MAP.md`.

- Example: `npm run shots -- "splash-zone?lab=backflip:clear&at=1.3" "splash-zone?lab=submarine:fail&at=3.5" "splash-zone?lab=respawn&at=0.9" --sizes 844x390`

## Where changes go

- What a turn asks, how an answer is read, what a miss shows, the results: `main.ts`.
- Anything about the ski, tricks, scoring, worlds, Mega Stunts or the HUD: `src/shared/jetski/` (see its MAP).

## Tests

The ride's tests keep their names: `tests/splash-zone.test.ts`, `tests/splash-zone-tricks.test.ts`, `tests/splash-zone-mega.test.ts`.
