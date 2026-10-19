# Batter Up map

Baseball over six innings: answer fast to hit when batting and to pitch when fielding; every play is planned and acted out by the whole team.

## Files

- `main.ts`: the game loop, learning loop, batting half and wiring of everything below
- `rules.ts`: pure game state, hits, outs, base running, calls and spoken lines (`hitFor`, `advance`, `applyHit`, `newGame`, `HIT_KINDS`)
- `pitching.ts`: the bottom half, where we pitch (`createPitching`, `PitchingHost`)
- `choreo.ts`: the script of a play: runs, throws and ball (`planPlay`, `checkScript`, `roundRoute`)
- `defense.ts`: who fields, relays, covers and backs up, from the textbook (`REACTION`, `POSITIONS`, `baseSpot`)
- `batted.ts`: batted-ball paths for every hit and out kind (`planBatted`, `isFair`, `BattedKind`)
- `flight.ts`: ball paths and field measurements (`BASE_SPOTS`, `MOUND`, `POSITION_SPOTS`, `groundHeight`)
- `play.ts`: runs a planned play on the real people (`createPlayRunner`, `PlayHost`)
- `actions.ts`: fielding actions such as scoop, throw, catch and dive (`createActions`, `Actions`)
- `mover.ts`: running and stride maths for people (`createMover`, `yawTo`, `lunge`)
- `person.ts`: the jointed person rig (`createPerson`, `Pose`, `PERSON_SCALE`)
- `characters.ts`: ball, pitcher, catcher, umpire and the batter (`createBall`, `createPitcher`, `createCatcher`, `SWING_CONTACT`)
- `teams.ts`: rival teams, colours and team lines (`TEAMS`, `pickRival`, `coloursOf`, `ourAbbr`)
- `field.ts`: ballpark, scoreboard and sky (`buildField`, `boardDotCentres`)
- `layout.ts`: camera views and HUD layout (`homeView`, `wideView`, `moundView`, `hudLayout`, `playBand`)
- `hud.ts`: scoreboard, bases, banners and the question panel (`createHud`, `BannerKind`)
- `effects.ts`: fireworks and other particles (`createEffects`, `fireworkColour`)
- `dev.ts`: dev query hooks (`forcedPlay`, `devStart`)
- `voice.ts`: every spoken line that is not a fact (`VOICE_LINES`)

## Dev hooks

- `?play=<kind>`: force every ball in play to that kind. Hits: `single-liner`, `single-grounder`, `single-bloop`, `single-chopper`, `double-gap`, `double-line`, `double-wall`, `triple-corner`, `triple-gap`, `homer-liner`, `homer-moonshot`, `homer-scraper`. Outs: `pop`, `foul-pop`, `fly`, `liner`, `diving`, `ground`, `double-play`, `force-second`.
- `?start=top|bottom&bases=101&outs=1`: begin in that half with runners on first, second, third (three digits) and 1 or 2 outs.
- Example: `npm run shots -- "batter-up?play=double-play&start=bottom&bases=110&outs=1" --start --wait 6000` (the "Play ball!" banner covers the first 2.5 s)

## Where changes go

- A new kind of hit or out: type and weights in `rules.ts`, path in `batted.ts`, fielder script in `choreo.ts` and `defense.ts`, hook name in `dev.ts`.
- Who covers or relays a ball: `defense.ts`.
- A new fielder action or pose: `actions.ts` (and `person.ts` if a limb needs it).
- Innings, mercy rule or base running: `rules.ts`.
- Camera or screen fit: `layout.ts`.
- Team names, colours or lines: `teams.ts`, then `voice.ts` and `npm run voice`.

## Tests

- `tests/batter-up.test.ts`
- `tests/voice.test.ts` (inning, lead and final speech lines)
