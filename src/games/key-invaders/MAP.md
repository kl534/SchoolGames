# Key Invaders map

A Space Invaders typing game: a formation of 3 rows × 6 columns of glowing voxel invaders marches side to side and steps down towards four bunkers. The lowest living invader of each column carries a short chunk of keys from the player's typing level, ending in a space (`fj␣`, later words like `cat␣`). The first key keeps every invader that starts with it in play (each shows its typed keys; the laser cannon and the yellow square aim at the lowest, then nearest one); each next key drops the ones that no longer fit; each right key zaps a bolt and chips cubes off the aimed one; the closing space bar blasts it. A key that fits none buzzes and the lock stays. When the formation reaches the bunkers the player loses one of 3 cannons. Waves are endless and faster each time; a mystery UFO with a long chunk crosses the top once per wave. Points are multiplied by level × level (the gold `×49` badge) and by a streak multiplier (×2 from 5 perfect kills in a row, ×3 from 10, ×4 from 20).

It is the second game of the Typing path (`"section": "typing"` in `game.json`), so the menu lists it only when Typing is chosen. The course, key stats, lesson, keyboard picture, level picker and test-out are `src/shared/typing/` (read its `MAP.md`); progress made here counts in Type Rider and the other way round. The full design is in the doc `docs/key-invaders.md` of the main checkout (not committed).

Voice rule (owner): only the lesson's finger explanations are spoken, by the lesson itself. Nothing in this folder calls `speak()` except to hand it to `showKeyLesson`: waves, level-ups, the test-out and the results are text and sound effects only.

## Files

- `main.ts`: wiring and flow: `startTypingSession`, the start screen (`showLevelPicker`, `showTestOut`, the lesson), the phases (`start`, `entering`, `marching`, `cleared`, `hit`, `over`), a target per front invader and the UFO, the keys (`onTypingKey`: lock-on and narrowing through `aim`, right, wrong, kill), the march and bombs, the cannon, waves and their pace, level-ups (pop and chime at once, the lesson after the wave), the HUD row, the keyboard strip, the "needs a keyboard" note and `showResults`
- `rules.ts`: pure: `planChunk`, `lockTarget`, `aimKey` (the narrowing key step), `aimWithout`, `streakMultiplier`, `killPoints`, `waveBonus`, `waveSlack`, `waveBudget`, `stepSeconds`, `ufoSeconds`, the march (`nextStep`, `recoil`), the speed levels' groups (`speedGroupPasses`), the run's stats and the results line
- `layout.ts`: pure: the field, grid, bunker and cannon numbers, `fieldRect` (where the 3D field is drawn between the HUD and the keyboard), `cameraDistance`, `bunkerCellAt`, `chipCount`
- `invaders.ts`: the voxel sprites (`SPRITES`, two frames each) and `createInvader`, `createBunker`, `createCannon`, `createOutline`: one `InstancedMesh` of cubes each
- `effects.ts`: pooled bolt, beam, explosion cubes, bombs and the camera shake
- `scene3d.ts`: `createKeyScene`: starfield pass, the field in its rectangle under the tilted camera, `project` (world to pixels)
- `labels.ts`: the DOM labels of keys under the invaders and the pops of text; pure `staggerLabels` and `labelFontPx`
- `dev.ts`: `devOptions()` / `parseDev` (below)
- `voice.ts`: `VOICE_LINES`: the lesson's finger explanations (`TYPING_VOICE_LINES`) and nothing else
- `index.html`, `game.json`, `thumbnail.svg`: the page (styles of the keyboard strip, HUD, labels, pops and the note), the manifest and the menu picture

## Dev hooks

- `?level=<1-40>`: play that level (open in memory; the keys of the levels before it count as learned).
- `?start=1`: skip the picker and the lesson (play again still shows the picker). `?lesson=1`: show the level's lesson even if it was seen.
- `?chunk=<text>`: every invader's chunk is this text (`%20` is a space); the closing space is added.
- `?lock=<1-6>`: the front invader of that column starts locked; `?typed=<n>`: with it, n keys done. `?wrong=1`: holds the red flash on the locked label.
- `?spk=<seconds>`: seconds per key to start with. `?wave=<n>`: start at wave n and its pace. `?lives=<1-3>`: start with that many cannons.
- `?drop=<0-23>`: the first wave starts n drops down. `?left=<1-18>`: the first wave starts with only n invaders (bottom rows first, left to right).
- `?ufo=1`: the UFO is up from the start (in the middle of the lane while frozen).
- `?freeze=1`: the march, bombs, UFO and particles hold still; keys still work.
- `?levelup=1`: the first kill passes the level (its lesson shows after the wave).
- `?keys=<text>`: once the first wave marches, these keys (at most 12, `%20` is a space) are typed in order; works with `freeze=1`. `?keys=f` shows every invader starting with F in play.
- With any hook nothing is saved.
- Examples: `npm run shots -- "key-invaders?start=1&level=1&freeze=1" "key-invaders?start=1&level=1&freeze=1&keys=f" "key-invaders?start=1&level=12&freeze=1&ufo=1&lock=3&typed=2" "key-invaders?start=1&level=3&lives=1&drop=23"`

## Where changes go

- Chunk lengths, points, pace and the march: `rules.ts` and `layout.ts` (tested in `tests/key-invaders.test.ts`, including the pace invariant).
- Levels, lessons, key stats, the clock's seconds per key: `src/shared/typing/`.
- What a wave does, the keys, kills, hits, the start screen and the results: `main.ts`.
- Shapes and colours: `invaders.ts`; the camera and the two render passes: `scene3d.ts`; the HUD, labels and pops styles: `index.html`.

## Tests

`tests/key-invaders.test.ts` (dev hooks, chunks, lock-on, points, pace, the march, fieldRect, labels, voice lines and that only the lesson speaks), `tests/typing-screens.test.ts` (the lesson and picker line options), `tests/menu-choices.test.ts` (the Typing choice).
