# Strike Zone map

Ten-pin bowling: answer a question, aim, and throw a physics ball (cannon-es) at ten pins; ten frames with real scoring and an announcer.

## Files

- `main.ts`: the game loop, learning loop, aiming input and wiring of everything below
- `rules.ts`: pure ten-pin scoring, splits, announcer calls and spoken lines (`position`, `runningTotals`, `callFor`, `allCallLines`)
- `aim.ts`: the aim line, drift and throw path (`Aim`, `lineX`, `aimThrough`, `MAX_DRIFT`)
- `geometry.ts`: lane, pin and gutter measurements (`LANE_WIDTH`, `HEAD_Z`, `PIN_IDS`)
- `physics.ts`: the pins and ball as rigid bodies, settling and fast-forward (`Physics`, `FIXED_STEP`, `SETTLE_MAX`)
- `views.ts`: camera views, screen fitting and HUD layout choice (`fitView`, `hudLayout`, `AIM_CAM`, `PINS_CAM`)
- `alley.ts`: lane, gutters, walls and aim marks as meshes (`buildAlley`, `LANE_PITCH`)
- `pins.ts`: pin meshes and the rack drop (`createPins`, `DROP_SECONDS`)
- `ball.ts`: the ball mesh (`createBall`)
- `bowler.ts`: the bowler figure and his throw, follow-through and slip (`Bowler`, `THROW_SECONDS`, `SLIP_SECONDS`)
- `person.ts`: the jointed person rig the bowler and friends use (`createPerson`, `Pose`, `neutralPose`)
- `friends.ts`: the three friends on the bench who cheer or groan (`createFriends`, `FriendMove`)
- `hud.ts`: scorecard, banners, big call screens and pin count (`createHud`, `BannerKind`, `ScreenKind`)
- `dev.ts`: dev query hooks (`devStart`, `devDrift`, `devFriends`)
- `voice.ts`: every spoken line that is not a fact (`VOICE_LINES`)

## Dev hooks

- `?rolls=10,7,3,9,0`: start mid-game with those rolls, if they are a valid game so far.
- `?leave=7,10`: start at frame 1, ball 2 with only those pins standing (spares and splits).
- `?drift=max` or `?drift=0`: every right answer drifts the most, or not at all.
- `?friends=1`: play the friends' reaction shot after every ball.
- Example: `npm run shots -- "strike-zone?leave=7,10" --start`

## Where changes go

- Scoring, splits or announcer calls: `rules.ts`, and add the lines to `allCallLines` so `voice.ts` stays complete.
- Ball or pin feel: `physics.ts` (slow physics cases are in `tests/strike-zone-physics.test.ts`).
- How hard aiming is: `aim.ts` (`MAX_DRIFT`, `clampAim`).
- A new camera shot or screen fit: `views.ts`.
- A new reaction or character: `friends.ts`, `bowler.ts` and `person.ts`.
- A new state that is hard to reach: add a query hook in `dev.ts`.

## Tests

- `tests/strike-zone.test.ts`
- `tests/strike-zone-physics.test.ts` (slow; full counts only with `npm run test:all`)
