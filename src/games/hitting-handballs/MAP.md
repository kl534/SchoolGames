# Hitting Handballs map

2-on-2 playground wall ball, seen side-on. The solid blue school wall (with an 8-inch plate along its foot that good shots hit above) stands at the left edge of the screen and the asphalt court runs to the right. You and your teammate Sam (blue shirts, nearer the camera) play a rival pair (further back). Every ball that comes to our side freezes in the air next to the kid who will hit it, and a question appears. A right answer in under the pair's `smashUnder` seconds is a SMASH (the rivals can't return it, our point). A slower right answer is returned, unless it is the pair's `streakToWin`-th right answer in a row this rally, which is a WINNER (our point). A wrong answer or a time-out is a comic whiff (spin or head bonk) and their point. Rally scoring, first to 11, win by 2, and the point winner serves. There are 5 rival pairs on a ladder per topic; a win climbs a rung, a loss drops one, and beating the 5th makes you Recess Champions for good (then every match is a rematch against a random pair). Every third point in a row we win (3, 6, 9…) gets a "You're cooking!" call and banner after the score call (`isCooking`, `nextRun`). A school bell rings at the end of every match.

## Files

- `main.ts`: the flow (VS card, preview, "Play ball!", serves, questions, hits, whiffs, points, ending, results), the ball's flights, the question clock, camera and wiring
- `rules.ts`: pure match and ladder rules (`judgeHit`, `step`, `matchWinner`, `isMatchPoint`, `nextRun`, `isCooking`, `scoreCall`, `allScoreCalls`, `pickTarget`, `nextRung`, `pairFor`, `matchStars`), the five `PAIRS`, `outcomeText`, the fixed spoken lines
- `shots.ts`: the ball's flight as pure physics: every shot is real projectile segments under one `GRAVITY`, with bounces off the court (`FLOOR_BOUNCE`, `FLOOR_KEEP`) and the wall (`WALL_BOUNCE`); `planShot` fits the launch speed (`SHOT_SPEEDS`) so the ball bounces, hits the wall and meets the receiver's hand. Also `ballAt`, `velocityAt`, `contacts`, `pastShot`, `bonkShot`, `serveBounce`, `holdTime`, `timeAtX`, `contactSpot` and the court numbers (`WALL_X`, `PLATE_HEIGHT`, `HOLD_U`, `PAST`)
- `moves.ts`: every kid move as pure keyframes (`swing`, `smash`, `whiffSpin`, `bonk`, `dive`, `cheer`, `dance`, `slump`, `runFrame`) and their timings
- `layout.ts`: camera fit for the court (side-on, centred on `LOOK_X`), using a subject box (`fitCamera`, `playBand`)
- `person.ts`: the jointed kid rig, copied from En Garde and extended with sunglasses
- `kids.ts`: a kid from the rig (`createKid`), the looks of ours and of each pair (`US_LOOKS`, `PAIR_LOOKS`), the home spots (`HOME`)
- `court.ts`: asphalt and lines, the solid blue wall and its plate, fence, school, tree and the four watching kids (`buildCourt`)
- `ball.ts`: the ball mesh with spin and a shadow
- `effects.ts`: dizzy stars, the camera shake and the DOM comic words (`createWords`)
- `hud.ts`: the chalkboard scoreboard (`createScoreboard`)
- `vs.ts`: the VS card with the ladder (`showVs`, class `hb-vs`, not `sg-overlay`)
- `dev.ts`: dev query hooks
- `voice.ts`: every spoken line that is not a fact (`VOICE_LINES`: the 126 score calls, five intros and six fixed lines)

The ladder rung is saved per topic and game with `session.ladderRung()` and `session.recordLadderRung()` (see `src/shared/session.ts`). The only shared change is `sfx.bell` in `src/shared/audio.ts`.

## Dev hooks

- `?rung=0..5`: the ladder place, instead of the saved one (results still save normally).
- `?pair=1..5`: play that pair.
- `?score=<us>-<them>`: the starting score, ignored if the match would already be over.
- `?serve=us|them`: who serves first (else a coin toss).
- `?streak=<n>`: the starting rally streak (below the pair's `streakToWin`).
- `?run=<n>`: points in a row we have already won, e.g. `?run=2&auto=smash` for the cooking call.
- `?vs=skip`: skip the VS card.
- `?auto=smash|return|winner|wrong`: answer the first question 0.3 s after its reading ends; skips the VS card, the preview and "Play ball!". `smash` judges at 0.3 s, `return` judges at 99 s, `winner` sets the streak to `streakToWin - 1` and judges at 99 s.
- `?whiff=spin|bonk`: every whiff is that kind.
- `?at=<s>`: freeze the scene `s` seconds after the first answer; the HUD stays and comic words stay up.
- Examples: `npm run shots -- "hitting-handballs?rung=5&pair=5"` (the crowned VS card), `"hitting-handballs?auto=smash&at=0.35"`, `"hitting-handballs?auto=wrong&whiff=bonk&at=0.7"`, `"hitting-handballs?score=10-9&auto=smash&at=3"` (WE WIN), `"hitting-handballs?score=11-11&serve=them&vs=skip" --start`.

## Where changes go

- Rules, pairs, ladder, the words on screen: `rules.ts` (then `voice.ts` and `npm run voice` for spoken lines).
- How the ball flies and its timing: `shots.ts` (bounciness and speeds are the constants at the top); how a kid swings, spins or dives: `moves.ts`, then `kids.ts` for how a frame becomes a pose.
- A pair's costume: `PAIR_LOOKS` in `kids.ts`; a new hat or accessory: `person.ts`.
- The wall, court and the watching kids: `court.ts`.
- The scoreboard and the question pill: `hud.ts` and `style.css`; the VS card: `vs.ts`.
- Camera framing on phones or tablets: `layout.ts` (keep `playBand` in step with `style.css`).

## Tests

- `tests/hitting-handballs.test.ts`
- `tests/session.test.ts` and `tests/progress.test.ts` (the saved ladder rung)
