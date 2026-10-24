# Fore! map

Nine holes of real golf: each shot is one question. A club is picked from the distance, a ring shows where a perfect shot lands, a quick right answer flies to the ring, a slow one hooks or slices, a wrong one is a duff. Scored in strokes against par with a seven-stroke cap and an announcer. The ball flight is analytic (no physics engine). Trees on four holes stop a low ball, and a caddie reacts beside the golfer.

## Files

- `main.ts`: the game loop, learning loop, aiming input and wiring of everything below
- `course.ts`: the nine holes, hazards and what is under a point (`HOLES`, `Hole`, `surfaceAt`, `centreX`, `FAIRWAY_HALF`, `GREEN_R`)
- `shot.ts`: clubs, the planned shot, how it was struck and where the ball ends (`clubFor`, `planShot`, `resolveShot`, `finishShot`, `treeHit`, `pathAt`, `TREE_HEIGHT`, `Plan`, `Outcome`, `Result`)
- `rules.ts`: pure golf scoring, the stored score and the announcer's lines (`afterShot`, `holeScore`, `holeOver`, `nameFor`, `storedFor`, `shotCall`, `holeCall`, `holeIntro`, `allCallLines`, `reactionFor`)
- `voice.ts`: every spoken line that is not a fact (`VOICE_LINES`)
- `hole.ts`: the ground, fairway, green, hazards, trees, 150 and 100 yd markers, tee and flag as meshes (`buildHole`)
- `golfer.ts`: the golfer and the swing, cheer and groan poses (`createGolfer`, `SWING_SECONDS`, `IMPACT_AT`)
- `caddie.ts`: the caddie with the bag, who idles, cheers or groans for 1.3 s (`createCaddie`, `REACTION_SECONDS`)
- `person.ts`: the jointed person rig the golfer uses (`createPerson`, `Pose`, `neutralPose`)
- `ball.ts`: the ball with its shadow, splash and one-second shot trail, and the flight path (`createBall`, `flightPoint`, `flightSeconds`)
- `guide.ts`: the landing ring and the dotted aim line (`createGuide`, `ringRadius`)
- `views.ts`: the camera views and screen fitting (`aimView`, `followView`, `landView`, `introView` (the tee-to-green flyover), `fitView`)
- `hud.ts`: scorecard strip, hole map, chips, controls, question, answers, banner and pill (`createHud`, `windChip`)
- `dev.ts`: dev query hooks (`devStart`, `devHoleState`, `devAim`, `devSide`, `devQuality`, `devHolesOk`, `devSkipIntro`)

## Dev hooks

- `?hole=N`: start at hole N (1 to 9) with the card filled in as if the earlier holes were par (no intro).
- `?lie=green|sand|rough|tee|water`: start that hole with the ball in that lie near the pin (12 yd on the green, 20 yd otherwise). `sand` uses the hole's first bunker if it has one, else a bunker lie 20 yd out; `water` stands 100 yd short of the first pond with the ring aimed at it (red).
- `?lie=tree`: on a hole with trees, start on the fairway with the ring aimed so a perfect shot flies low through the first tree it can.
- `?intro=1`: keep the hole intro (the flyover) even when `hole`, `lie` or `strokes` would skip it.
- `?strokes=N`: preset the strokes already taken on the hole (up to 6) to check the cap.
- `?side=-1|1|0`: force the wobble and duff side (0 or absent is random).
- `?quality=perfect|wobbly|duff`: force the next shot's quality, whatever the answer.
- `?holes=ok`: play every hole instantly and show the results.
- Example: `npm run shots -- "fairway-golf?hole=2&lie=sand" --start`

## Where changes go

- Hole layouts, hazards or par: `course.ts` (the voice intro lines follow; run `npm run voice`).
- Clubs, carries, how a slow or wrong answer ruins a shot: `shot.ts` (`MAX_SIDE`, `DUFF_FRACTION`, `PERFECT_UNDER`).
- Scoring, names and announcer calls: `rules.ts`, and add the lines to `allCallLines` so `voice.ts` stays complete.
- A new camera shot or screen fit: `views.ts`; HUD layout is in `hud.ts` and `style.css`.
- A new state that is hard to reach: add a query hook in `dev.ts`.

## Tests

- `tests/fairway-golf.test.ts`
