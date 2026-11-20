# Type Rider map

Splash Zone's jet ski with a keyboard instead of four answers: the top panel shows a short block of keys ("fj jf") and the player types it on a real keyboard before the ski reaches the launcher to land the trick. A perfect block builds the streak; a block with mistakes still lands but resets it; a time-out is a wipeout. Three jet skis, endless run, every world ends in a Mega Stunt (three gate blocks, then the course). The course has 40 levels (28 of keys, two at a time, then 12 of speed); points are multiplied by level × level and a gold "x49" badge by the score says so. It is the game of the Typing path (`"section": "typing"` in `game.json`), so the menu lists it only when Typing is chosen.

The ride (ski, camera, tricks, worlds, HUD) is `src/shared/jetski/` (read its `MAP.md`); the course, key stats, lesson, keyboard picture, level picker and test-out are `src/shared/typing/` (read its `MAP.md`). This game is the typing driver of the ride.

Voice rule (owner): only the lesson's finger explanations are spoken, by the lesson itself. Nothing in this folder calls `speak()` except to hand it to `showKeyLesson`: blocks, level-ups, the test-out and the results are text and sound effects only.

## Files

- `main.ts`: the typing driver of the ride (`createRide` with a `RideDriver`, `answers: false`, `bottomInset` = the keyboard strip): `startTypingSession`, the start screen (`showLevelPicker`, `showTestOut`, "Show me the keys again", the lesson before a level's first ride), a block per turn (`planBlock` into the HUD's prompt panel, the clock from `clockFor` starting 0.5 s later), the keys (`onTypingKey`: right advances, wrong buzzes and counts that key wrong), the keyboard strip (the next key lit while its skill is not learned, faint when every key of the block is), level-ups (pop, chime, and the lesson or speed card at the next world through `betweenWorlds`), the "needs a keyboard" note for a tap before any key, and `showResults`
- `rules.ts`: pure: `blockKeys`, `blockTarget`, `blockOutcome`, the speed levels' streak (`speedBlockPasses`, `speedStreak`), the run's stats and the results line (`RunStats`, `runWpm`, `resultsText`)
- `dev.ts`: `devOptions()` / `parseDev`: the ride's dev hooks plus this game's (below)
- `voice.ts`: `VOICE_LINES`: the lesson's finger explanations (`TYPING_VOICE_LINES`) and nothing else
- `index.html`, `game.json`, `thumbnail.svg`: the page (with the styles of the keyboard strip and the note), the manifest and the menu picture

## Dev hooks

The ride's hooks (`tricks`, `streak`, `skis`, `lab`, `at`, `world`, `mega`, `cycles`), listed in `src/shared/jetski/MAP.md`, and:

- `?level=<1-40>`: play that level (open in memory; the keys of the levels before it count as learned, so only its new keys light up).
- `?start=1`: skip the picker and the lesson. `?lesson=1`: show the level's lesson even if it was seen (works with `start=1`).
- `?block=<text>`: every block is this text (`%20` is a space). `?typed=<n>`: the first block starts n keys in. `?wrong=1`: the first block holds the red flash on its current key.
- `?spk=<seconds>`: seconds per key to start with. `?clock=<seconds>`: every block's clock.
- `?levelup=1`: the first block passes the level (the next level's lesson shows after this world's Mega Stunt).
- With any hook nothing is saved.
- Examples: `npm run shots -- "type-rider?level=3" "type-rider?start=1&level=7&block=rfrj%20ur&typed=2" "type-rider?start=1&skis=1&clock=0.3"`

## Where changes go

- Blocks and their lengths: `src/shared/typing/blocks.ts` and `rules.ts` (`blockKeys`). Clock and key stats: `src/shared/typing/progress.ts`.
- What a turn shows, the keys, the level-up, the start screen, the results: `main.ts`.
- Anything about the ski, tricks, scoring, worlds, Mega Stunts or the HUD: `src/shared/jetski/`.

## Tests

`tests/type-rider.test.ts` (dev hooks, blocks, outcomes, the speed streak, the results text, voice lines and that only the lesson speaks), `tests/menu-choices.test.ts` (the Typing choice), `tests/typing.test.ts` and `tests/typing-screens.test.ts` (the shared typing code).
