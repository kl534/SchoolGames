# Fore! map

Nine holes of real golf: each shot is one question. A club is picked from the distance, a ring shows where a perfect shot lands, a quick right answer flies to the ring, a slow one hooks or slices, a wrong one is a duff. Scored in strokes against par with a seven-stroke cap and an announcer. The ball flight is analytic (no physics engine). Trees on four holes stop a low ball, and a caddie reacts beside the golfer.

## Files

- `main.ts`: the game loop, learning loop, aiming input and wiring of everything below
- `course.ts`: the nine holes, hazards and what is under a point (`HOLES`, `Hole`, `surfaceAt`, `centreX`, `FAIRWAY_HALF`, `GREEN_R`)
- `shot.ts`: clubs, the planned shot, how it was struck and where the ball ends (`clubFor`, `planShot`, `resolveShot`, `finishShot`, `treeHit`, `pathAt`, `TREE_HEIGHT`, `Plan`, `Outcome`, `Result`)
- `rules.ts`: pure golf scoring, the stored score and the announcer's lines (`afterShot`, `holeScore`, `holeOver`, `nameFor`, `storedFor`, `shotCall`, `holeCall`, `holeIntro`, `allCallLines`, `reactionFor`)
- `voice.ts`: every spoken line that is not a fact (`VOICE_LINES`)
- `hole.ts`: one hole as lit meshes: textured rough, striped fairway, green with fringe and apron, bunkers with lip and rim, ponds with shore, reeds and ripples, cart path, tee with furniture, 150 and 100 yd markers, trees, bushes, rocks, flowers, hills, true-size cup with its flash ring, and flag (`buildHole`, `CUP_VISUAL_R`, `SKY`)
- `scenery.ts`: pure, seeded placement of the scenery trees, bushes, rocks and flowers and of the cart path for a hole (`placeScenery`, `cartPath`, `LINE_CLEAR`); gameplay trees stay in `course.ts`
- `trees.ts`: pine, oak and birch geometry (merged, vertex coloured) drawn as instances with blob shadows (`buildTreeLayer`, `treeBounds`, `treeScale`)
- `ground.ts`: the shared grass, stripe, green and sand textures (`DataTexture`s) and flat geometry helpers (`groundTextures`, `ribbon`, `ellipseRing`, `strip`)
- `sky.ts`: the sky dome, drifting clouds and birds, and the three hills behind each hole (`createSky`, `buildHills`)
- `swing.ts`: pure swing numbers: the kind of swing for a club, its timing and the body and arm angles over time (`swingKind`, `timingFor`, `SWING_TIMING`, `swingFrame`)
- `golfer.ts`: the right-handed golfer: stands side-on to the ball, holds the club in both hands (arm solver), swings per `swing.ts`, cheers and groans (`createGolfer`, `createClub`, `REACH`)
- `caddie.ts`: the caddie with the bag, who idles, cheers or groans for 1.3 s (`createCaddie`, `REACTION_SECONDS`)
- `person.ts`: the jointed person rig the golfer uses (`createPerson`, `Pose`, `neutralPose`; a 2 yd cartoon grown-up with a big round face, short neck, chunky limbs, pelvis, hips, slide and heel-raise)
- `ball.ts`: the true-size ball with its tee peg, shadow, splash, one-second shot trail, ring and halo aids and impact puff, and the flight path (`createBall`, `flightPoint`, `flightSeconds`)
- `guide.ts`: the landing ring and the dotted aim line (`createGuide`, `ringRadius`)
- `views.ts`: the camera views and screen fitting (`aimView`, `followView`, `landView`, `introView` (the tee-to-green flyover), `fitView`)
- `hud.ts`: scorecard strip, hole map, chips, controls, question, answers, banner and pill (`createHud`, `windChip`)
- `dev.ts`: dev query hooks (`devStart`, `devHoleState`, `devAim`, `devSide`, `devQuality`, `devHolesOk`, `devSkipIntro`, `devSwing`, `devClubPlan`, `devCam`, `devIntroAt`, `devShadows`)

## Dev hooks

- `?hole=N`: start at hole N (1 to 9) with the card filled in as if the earlier holes were par (no intro).
- `?lie=green|sand|rough|tee|water`: start that hole with the ball in that lie near the pin (12 yd on the green, 20 yd otherwise). `sand` uses the hole's first bunker if it has one, else a bunker lie 20 yd out; `water` stands 100 yd short of the first pond with the ring aimed at it (red).
- `?lie=tree`: on a hole with trees, start on the fairway with the ring aimed so a perfect shot flies low through the first tree it can.
- `?intro=1`: keep the hole intro (the flyover) even when `hole`, `lie` or `strokes` would skip it.
- `?strokes=N`: preset the strokes already taken on the hole (up to 6) to check the cap.
- `?side=-1|1|0`: force the wobble and duff side (0 or absent is random).
- `?quality=perfect|wobbly|duff`: force the next shot's quality, whatever the answer.
- `?holes=ok`: play every hole instantly and show the results.
- `?swing=<seconds>`: freeze the golfer that many seconds into the swing for the club in play (also stops the game's own swing).
- `?club=driver|iron3|iron5|iron7|wedge|sand|putter`: force the club (on the green only `putter`; `?carry=N` sets its carry, e.g. a wedge at 30 for the half swing).
- `?cam=face|dtl|front`: camera 5 yd from the golfer at chest height: across the line at his front, behind the ball along the line, or from the target side.
- `?introAt=<0..1>`: freeze the hole flyover at that progress (needs no `intro=1`).
- `?shadows=off`: no real shadow map; the round blob shows under the golfer and caddie again.
- Example: `npm run shots -- "fore?hole=2&lie=sand" --start`

## Where changes go

- Hole layouts, hazards or par: `course.ts` (the voice intro lines follow; run `npm run voice`).
- Clubs, carries, how a slow or wrong answer ruins a shot: `shot.ts` (`MAX_SIDE`, `DUFF_FRACTION`, `PERFECT_UNDER`).
- Scoring, names and announcer calls: `rules.ts`, and add the lines to `allCallLines` so `voice.ts` stays complete.
- Trees, ground colours, hills or sky: `trees.ts`, `ground.ts`, `hole.ts`, `sky.ts`; where scenery stands: `scenery.ts` (keep trees 62 yd off the line).
- A new camera shot or screen fit: `views.ts`; HUD layout is in `hud.ts` and `style.css`.
- A new state that is hard to reach: add a query hook in `dev.ts`.

## Tests

- `tests/fore.test.ts`
- `tests/fore-scenery.test.ts`: scenery placement rules, gameplay trees unchanged, draw budget, dispose
- `tests/fore-swing.test.ts`: handedness, sizes, the grip, address, impact, top and finish of the swing
