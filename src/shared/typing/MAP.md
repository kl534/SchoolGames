# Typing map (`src/shared/typing/`)

What a typing game (Type Rider, `src/games/type-rider/`, added later) is built from: the course of 40 levels (28 of keys, two at a time, then 12 of speed), what the player has learned on each key, the lesson that opens a level, the keyboard picture, the level picker and the test-out. Real keyboards only, US QWERTY. The pure files (`course`, `keyboard-layout`, `lines`, `words`, `blocks`, `progress`) import no DOM.

Voice rule: only the lesson's finger explanations are spoken (`HOME_ROW_LINE`, `HOME_REST_LINE` and the 71 `lessonLine`s, listed in `TYPING_VOICE_LINES`). Every other line (`YOUR_TURN`, `MIX_LINE`, `READY_LINE`, the multiplier and speed lines, the test-out lines) is on-screen text and must never be passed to `speak()`. `scripts/voice/lines.ts` adds `TYPING_VOICE_LINES` to the shared lines; a game's `voice.ts` may list them too.

## Files

- `course.ts`: the levels and what each can type (`TYPING_LEVELS`, `levelOf`, `skillOf`, `knownChars`, `freshChars`, `charsOfSkill`, `multiplier`, `TOTAL_SKILLS`, `SHIFT_LEVEL`)
- `keyboard-layout.ts`: fingers, finger colours, key geometry of the US keyboard (15 units wide) and the timing of a reach (`fingerOf`, `baseOf`, `needsShift`, `shiftFor`, `HOME`, `FINGER_COLORS`, `KEYS`, `keyFor`, `shiftKeyFor`, `reachPhase`)
- `lines.ts`: the lesson's lines and the fixed on-screen lines (`lessonLine`, `TYPING_VOICE_LINES`, `multiplierLine`, `speedLine`, `YOUR_TURN`, `MIX_LINE`, `READY_LINE`, `NEW_KEYS`, `TEST_PASS`, `TEST_FAIL`)
- `words.ts`: the list of common kid words blocks are made of (`WORDS`)
- `blocks.ts`: the blocks of keys to type (`planBlock`, `wordsFor`, `BLOCK_KEYS`, `TEST_KEYS`, `FRESH_SHARE`, `MAX_GROUP`, `WORDS_FROM`)
- `progress.ts`: the first-try history of each key, the open level, seconds per key and the clock (`TypingProgress`, `recordPress`, `skillLearned`, `levelPassed`, `learnedCount`, `nextSpk`, `clockFor`, `wpm`, `openLevel`, `levelUp`, `normalizeTyping`, `TYPING_LEVEL_ID`)
- `session.ts`: `startTypingSession(gameId)`: the player, their typing progress, `save()`, `highScore()` and `recordScore()` under `TYPING_LEVEL_ID`
- `keys.ts`: `onTypingKey(handler)`: one `keydown` listener for single-char keys (ignores repeats and Ctrl, Alt, Meta; cancels the keys it handles; reports Caps Lock)
- `keyboard.ts`: the keyboard picture, with or without two hands whose fingers reach for the lit key (`createKeyboard`: `light`, `flash`, `setFaint`, `reach`, `pulse`, `setCaps`)
- `block.ts`: the row of keys to type: done green, the current one yellow, wrong flashes red (`createBlockView`)
- `lesson.ts`: the lesson that opens a level: home row (level 1), then show, try and mix for each new key, then the ready card; a speed level gets a 2.5 s card (`showKeyLesson`, `lessonSteps`)
- `picker.ts`: the start screen with the 40 level chips and the test-out question (`showLevelPicker`)
- `testout.ts`: one block of 30 keys with no clock to open a locked level (`showTestOut`, `testPassed`)
- `dom.ts`: small DOM helpers (`el`, `button`, `overlay`)
- `typing.css`: styles of all the typing screens (prefixes `tk` keyboard, `tb` block, `tx` shared, `tl` lesson, `tp` picker, `tt` test-out)
- `lab.html`, `lab.ts`: the dev lab page (below), not part of the build

## Lab

`npm run shots -- "/src/shared/typing/lab.html?view=<view>&…"`. It speaks nothing.

- `view=lesson&level=<1-40>&skill=<skill>&step=home|show|try|mix|done&at=<seconds>&typed=<keys>`: that step of the lesson, held still `at` seconds in (`typed` keys of its block done). Without `step` the lesson plays and waits on its first line. `skill` is a char or `shift-left`/`shift-right`.
- `view=keyboard&next=<char>&faint=1&reach=<seconds>&caps=1`: the keyboard with `next` lit (`F` lights the right Shift too); `reach` adds the hands `reach` seconds into the reach loop; `faint=1` fades it; `caps=1` shows the Caps Lock pill.
- `view=block&text=<keys>&typed=<n>&wrong=1`: the block view with `n` keys done; `wrong=1` holds the red flash.
- `view=picker&open=<1-40>&selected=<1-40>`: the level picker.
- `view=testout&level=<n>&typed=<n>`: the test-out for a level.
- `view=speed&level=<29-40>`: the speed card.
- `seed=<n>` fixes the random blocks.
