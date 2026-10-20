# Slap Shot map

A full 3-on-3 hockey game against a named rival over three 20:00 periods, overtime and a shootout. Every question is one small step of play: the puck is in one of three zones and one team has it.

## Files

- `main.ts`: the game loop, learning loop, play playback, periods, camera and wiring of everything below
- `rules.ts`: pure game state and the ladder (`step`, `shootoutStep`, `shootoutDecided`, `bandFor`), the clock, periods, the fixed calls and banner words (`PLAY_CALL`, `PLAY_LABEL`)
- `teams.ts`: our team and the six rivals, and the lines about them (`US`, `RIVALS`, `pickRival`, `theirGoalSpeech`, `rivalWinsSpeech`, `outcomeText`)
- `geometry.ts`: rink, net and puck measurements and vector helpers (`ZONE_X`, `GOAL_LINE_X`, `inNet`)
- `plays.ts`: pure formations (`formation`, `shootoutFormation`) and each play as a script of actor paths, puck segments and events (`planPlay`, `actorAt`, `puckAt`)
- `layout.ts`: HUD layout choice, the play band, and the camera follow (`hudLayout`, `playBand`, `cameraTarget`, `fovFor`)
- `rink.ts`: ice, lines, boards, glass, crowd, nets and the goal lamps (`buildRink`)
- `person.ts`: the jointed person rig, with helmet, skates, stick and number (`createPerson`, `Pose`)
- `skaters.ts`: the skaters and goalies with their moves (`createSkater`, `createGoalie`)
- `puck.ts`: the puck mesh (`createPuck`)
- `effects.ts`: ice spray and sparkles (`createEffects`)
- `hud.ts`: scorebug with zone strip, question panel, answer clock ring and banner (`createHud`)
- `dev.ts`: dev query hooks (`forcedPlay`, `devGame`, `autoAnswer`, `freezeAt`)
- `voice.ts`: every spoken line that is not a fact (`VOICE_LINES`)

## Dev hooks

- `?play=<PlayKind>`: use that play when the answer allows it (for example `one-timer`, `spin-o-rama`, `body-check`, `they-score-deke`, `so-goal`).
- `?puck=faceoff-neutral|us-our-end|us-neutral|us-their-end|them-their-end|them-neutral|them-our-end`: the starting puck.
- `?start=p2|p3|ot|so`: start in that period; `?score=2-1` and `?clock=40` set the goals (us-them) and the seconds left.
- `?auto=right|wrong`: answer the first question 0.3 s after its reading ends (and skip the intro), so a play runs without taps.
- `?at=1.1`: freeze the first play at that script time; the HUD stays.
- Example: `npm run shots -- "slap-shot?puck=us-their-end&auto=right&play=one-timer&at=1.6" --start`

## Where changes go

- A new play: type and ladder row in `rules.ts` (with its call and label), the animation in `plays.ts`, a move in `skaters.ts` if it needs one, then `voice.ts` and `npm run voice`.
- Times that decide the band of a play: `FLASHY_UNDER_SECONDS` and `SOLID_UNDER_SECONDS` in `rules.ts`.
- A new rival: `teams.ts` (then `npm run voice`).
- Rink look: `rink.ts`; skater look or moves: `person.ts` and `skaters.ts`.
- Screen fit on phones: `layout.ts` and `style.css`.

## Tests

- `tests/slap-shot.test.ts`
