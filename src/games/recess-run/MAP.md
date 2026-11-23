# Recess Race map

The game is called Recess Race; its folder and id stay `recess-run` (saved high scores and links use the id).

A sports-day sprint for typing. Ten painted lanes on the school blacktop, the player in lane 5 and nine cartoon kid rivals, seen from behind and above. A block of 8 keys from the player's typing level sits under the HUD; every right key pushes the runner on, and the runner's speed is the player's live typing speed against the heat's pace (heat 1 is 5 words a minute, +1 each heat; typing at the pace runs 100 m in 45 s, up to 2.5 times faster). A wrong key stumbles for half a second (speed x0.3, the rate x0.85); five wrong in a row is a face-plant for 2 s (stars, "SPLAT!", keys ignored), then half the rate. The rivals run at fixed speeds (0.76 to 1.24 of the pace, each wobbling by 8%), so a heat always takes them about 45 s. Finish 1st to 3rd to go on (a podium, a victory dance for 1st, then the next heat from the space bar or the Race button); 4th or lower ends the run ("You came 6th - out!", then the results). Points: 1 per right key and a heat's place bonus (300, 200, 100 x heat), all times level x level (the gold badge). It is the fourth game of the Typing path (`"section": "typing"` in `game.json`).

The course, key stats, lesson, keyboard picture, level picker and test-out are `src/shared/typing/` (read its `MAP.md`); progress made here counts in the other typing games and the other way round. Level-ups come mid-race as a pop and a chime; the new level's lesson shows after that heat's podium.

Voice rule (owner): only the lesson's finger explanations are spoken, by the lesson itself. Nothing in this folder calls `speak()` except to hand it to `showKeyLesson`: the countdown, the places, the podium and the results are text and sound effects only. `voice.ts` is `TYPING_VOICE_LINES` and nothing else.

CSS prefix: `rr-` (the shared typing styles own `tb-`, `tk-`, `tx-`, `tl-`, `tp-`, `tt-`).

## Files

- `main.ts`: wiring and flow: `startTypingSession`, the start screen (`openPicker`, `showTestOut`, the lesson), the phases (`start`, `marks`, `racing`, `finished`, `podium`, `out`, `results`), the field (the player and nine rivals, rebuilt every heat with shuffled lanes), the countdown, each frame's race (rivals by `rivalSpeed`, the player by typing speed, crossing the line, the jog after it), `onKey` (right, wrong, the stride, blocks, level-ups), the podium and its card, the camera (chase, then podium, with the picture slid so the feet sit 70% down the clear band), `showResults` and the "needs a keyboard" note
- `rules.ts`: pure: the heat pace (`heatWpm`, `RACE_SPEED`), the rivals (`RIVAL_FACTORS`, `rivalSpeed`, `shuffleLanes`, `RIVAL_NAME_POOL` and `pickRivalNames`: nine different names from the pool, new every heat), the player's speed (`nextRate`, `liveRate`, `targetSpeed`, `easeSpeed`), the HUD's steady words a minute (`sustainedWpm` over the last `WPM_WINDOW` = 10 s, eased by `easeWpm`; the runner itself uses the quicker key-to-key rate), mistakes (`Stride`, `onMiss`, `stepStride`, `strideSpeedFactor`), places (`placeOf`, `heatOver`, `goesOn`, `ordinal`), points, the speed levels' streak (`speedBlockPasses`, `speedStreak`), the run's stats and the results line (`RunStats`, `resultsText`)
- `layout.ts`: pure: lanes (`LANE_W`, `laneX`), the camera for a screen's shape (`cameraFor`), the podium and where everyone stands on it (`PODIUM_Z`, `podiumSpot`, `backRowSpot`, `PODIUM_CAMERA`)
- `person.ts`: the jointed cartoon person (copied from Type Brawl's, trimmed to the kid, a cap and a numbered bib on the chest and back): `createPerson`, `Pose`, `runPose`, `createAnimator`, `mixPose`
- `runners.ts`: the looks (`playerLook` gold shirt, `rivalLook` one shirt each), the poses (`crouchPose`, `stumblePose`, `facePlantPose`, `headDownPose`, `clapPose`, `wavePose`, the dances from `src/shared/dances`) and `createRunner` (person, animator and mode)
- `track.ts`: the blacktop with lane lines, numbers, start and chequered finish lines, red posts and tape, the podium and the playground (fence, swings, slide, climbing frame, hopscotch, hoop, trees, the school)
- `crowd.ts`: the instanced cut-out crowd along both fences and its bobbing
- `effects.ts`: the stars over a face-planted head and the two halves of the tape that fall
- `hud.ts`: the DOM: the panel (heat and goal, place, your words a minute, score with the gold badge, best), the race bar, the block's slot, the big centre texts, the "YOU" label, the SPLAT word, pops and the podium card
- `dev.ts`: `devOptions()` / `parseDev` (below)
- `voice.ts`: `VOICE_LINES`: the lesson's finger explanations and nothing else
- `index.html`, `game.json`, `thumbnail.svg`: the page (styles of the HUD, race bar, block panel, keyboard strip, big texts, podium card and the note), the manifest and the menu picture

## Dev hooks

- `?level=<1-40>`: play that level (open in memory; the keys of the levels before it count as learned). `?start=1`: skip the picker and the lesson. `?lesson=1`: show the level's lesson. `?spk=<s>`: seconds per key to start with.
- `?heat=<n>`: start at heat n. `?block=<text>`: every block is this text (`%20` is a space). `?typed=<n>`, `?wrong=1`: the first block starts n keys in / holds the red flash.
- `?count=1|2|3`: hold the countdown on "On your marks" / "Get set" / "GO!". `?freeze=1`: the race starts at once and nobody moves (keys still work).
- `?at=<0-100>`: the player starts that many metres on and each rival at `at x factor` (to 99). `?wpm=<n>`: the player's rate starts at n/12 keys a second.
- `?stumble=1`, `?faceplant=1`: the player holds that state (stars and SPLAT! for the face-plant).
- `?podium=<1-3>`: skip the race, the player finishes in that place and the podium plays; `?win=dance` (with 1) holds the dance for ever, `?dance=<id>` picks it (shared), `?card=1` shows the card at once. `?out=<4-10>`: the same for the out ending (use `--wait 1500`, the results come after 2.5 s).
- `?keys=<text>`: at GO these keys (12 at most) are typed, 0.15 s apart. `?levelup=1`: the first block passes the level.
- With any hook nothing is saved.
- Examples: `npm run shots -- "recess-run?start=1&level=1&count=1" "recess-run?start=1&level=1&freeze=1&at=40&block=fjfj%20jfjf&typed=3" "recess-run?start=1&level=1&podium=2&card=1"`

## Where changes go

- Speeds, pace, mistakes, places, points: `rules.ts` (the numbers are all there). Lanes, camera and podium spots: `layout.ts`.
- What a heat shows and does, the keys, level-ups, the podium, the results: `main.ts`.
- The look of the world or the kids: `track.ts`, `crowd.ts`, `person.ts`, `runners.ts`.
- Blocks and key stats: `src/shared/typing/blocks.ts` and `progress.ts`.

## Tests

`tests/recess-run.test.ts` (dev hooks, the pace, the rivals' speeds, the typing-to-speed maths and the 100 m invariant, mistakes, places, points, the speed streak, the results text, the camera, voice lines and that only the lesson speaks), `tests/menu-choices.test.ts` (the Typing choice), `tests/typing.test.ts` and `tests/typing-screens.test.ts` (the shared typing code).
