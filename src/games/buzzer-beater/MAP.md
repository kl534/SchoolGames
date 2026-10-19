# Buzzer Beater map

One-on-one basketball against a rival: answers become shots, dunks, blocks and steals on offence and defence, over two halves and overtime.

## Files

- `main.ts`: the game loop, learning loop, play playback and wiring of everything below
- `rules.ts`: pure game state, shot and stop choice by answer speed, scoring, periods (`shotFor`, `stopFor`, `newGame`, `ourBasket`, `rivalScoreFor`)
- `plays.ts`: each play as a script of actor paths, ball segments and events (`PlayScript`, `PlayEvent`, `SLOW_MO_SCALE`)
- `rivals.ts`: the rival players and the lines about them (`RIVALS`, `pickRival`, `scoreLine`, `outcomeText`)
- `geometry.ts`: court, rim, board and ball measurements (`RIM`, `THREE_RADIUS`, `FT_SPOT`, `FENCE`)
- `layout.ts`: HUD layout choice and the play band (`hudLayout`, `playBand`, `rectsOverlap`)
- `court.ts`: court, hoop and crowd meshes (`buildCourt`)
- `ball.ts`: the ball mesh (`createBall`)
- `person.ts`: the jointed person rig for the players (`createPerson`, `Pose`, `neutralPose`)
- `players.ts`: the two ballers and the kids on the bench with their moves (`createBaller`, `KidMove`)
- `hud.ts`: scoreboard, banners and the question panel (`createHud`, `BannerKind`)
- `effects.ts`: sparkles, flames and other particles (`createEffects`)
- `dev.ts`: dev query hooks (`forcedPlay`, `devGame`)
- `voice.ts`: every spoken line that is not a fact (`VOICE_LINES`)

## Dev hooks

- `?play=<name>`: force that play when the answer allows it: `three`, `dunk`, `jumper`, `layup`, `and-one`, `rebound`, `block`, `steal`, `forced-miss`, `them-two`, `them-three`, `them-and-one`.
- `?start=half2` or `?start=ot`: start in that period.
- `?score=12-10`: starting points (us-them).
- `?fire=1`: start with the streak at 3 (on fire).
- Example: `npm run shots -- "buzzer-beater?play=dunk&start=half2" --start`

## Where changes go

- A new kind of shot or stop: type and choice in `rules.ts`, the animation in `plays.ts`, a hook in `dev.ts`.
- Timings that decide shot type: constants at the top of `rules.ts`.
- A new rival or rival line: `rivals.ts` (then `voice.ts` and `npm run voice`).
- Court look: `court.ts`; player look or moves: `players.ts` and `person.ts`.
- Screen fit on phones: `layout.ts`.

## Tests

- `tests/buzzer-beater.test.ts`
