# Fore! map

Nine holes of real golf: each shot is one question. The player puts a ring where the ball should land, anywhere in the club's reach (drag on the 3D view or the corner map, tap the corner map for a big map, or nudge with the arrows); the shortest club that reaches is picked and swung softer. The ring starts each shot on a smart suggestion. The ball lands in the ring and then rolls on (a dotted tail shows where it should stop). A right answer always lands inside the ring (faster is nearer the middle); a wrong one or a time-out lands 15 to 30 % of the distance away in a random direction. There is no wind or slope. Scored in strokes against par with a seven-stroke cap and an announcer. The ball flight is analytic (no physics engine). Trees on four holes stop a low ball, and a caddie reacts beside the golfer.

## Files

- `main.ts`: the game loop, learning loop, ring placing input (finger on the picture, maps, arrows) and wiring of everything below
- `course.ts`: the nine holes, hazards and what is under a point (`HOLES`, `Hole`, `surfaceAt`, `centreX`, `FAIRWAY_HALF`, `GREEN_R`); no wind or slope
- `shot.ts`: clubs by landing distance, the limits on the ring (`reachFor`, `clubFor`, `clampTarget`, `ringRadius`), the planned shot, how it was struck (`resolveShot`: right lands inside the ring, wrong 15 to 30 % off), the roll and where the ball ends (`rollFrom`, `finishShot`, `predictRest`, `treeHit`, `pathAt`), the smart starting spot (`suggestTarget`) and `Plan`, `Outcome`, `Result`
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
- `ball.ts`: the true-size dimpled ball (it spins as it rolls) with its tee peg, shadow, splash, one-second shot trail, ring and halo aids and impact puff, and the flight path (`createBall`, `flightPoint`, `flightSeconds`)
- `travel.ts`: how a struck ball gets to where `finishShot` says it rests: the flight to where it touches down, hops that get lower and an evenly slowing roll on to the rest point (a holed ball runs to the pin), and a putt that slows to a stop; scoring is unaffected (`createTravel`, `Travel`)
- `guide.ts`: the landing ring, the dotted line to it (red when it would hit a tree) and the dotted tail and hollow dot where the ball should stop (`createGuide`, `ringColour`)
- `views.ts`: the camera views and screen fitting (`aimView`, `placeView` (the higher view held while a finger places the ring), `followView`, `landView`, `introView` (the tee-to-green flyover), `fitView`)
- `hud.ts`: scorecard strip, the draggable corner map, the big map (tap the corner map; drag or tap to place the ring), chips, controls (◀ ▶ aim, ▲ ▼ distance, Swing!), question, answers, banner and pill (`createHud`, `bigMapWorld`, `bigMapSpan`, `cornerMapWorld`)
- `dev.ts`: dev query hooks (`devStart`, `devHoleState`, `devTarget`, `devScatter`, `devBigMap`, `devPlace`, `devQuality`, `devHolesOk`, `devSkipIntro`, `devSwing`, `devClubPlan`, `devCam`, `devIntroAt`, `devShadows`)

## Dev hooks

- `?hole=N`: start at hole N (1 to 9) with the card filled in as if the earlier holes were par (no intro).
- `?lie=green|sand|rough|tee|water`: start that hole with the ball in that lie near the pin (12 yd on the green, 20 yd otherwise). `sand` uses the hole's first bunker if it has one, else a bunker lie 20 yd out; `water` stands 100 yd short of the first pond with the ring on its centre (red).
- `?lie=tree`: on a hole with trees, start on the fairway with the ring placed so a perfect shot flies low through the first tree it can.
- `?intro=1`: keep the hole intro (the flyover) even when `hole`, `lie` or `strokes` would skip it.
- `?strokes=N`: preset the strokes already taken on the hole (up to 6) to check the cap.
- `?target=<yd>,<deg>`: put the first shot's ring that far out and that many degrees from the line to the pin (+ is right on screen), clamped to the limits.
- `?scatter=<deg>`: the direction a miss or a slow right answer lands off the ring (0 straight on, 90 right on screen); absent is random.
- `?quality=perfect|close|miss`: force the next shot's quality, whatever the answer (`close` is a right answer at 60 % of the clock).
- `?bigmap=1`: open the big map once the aim view is up.
- `?place=1`: hold the higher "place" camera view, as if a finger were down on the picture.
- `?holes=ok`: play every hole instantly and show the results.
- `?swing=<seconds>`: freeze the golfer that many seconds into the swing for the club in play (also stops the game's own swing).
- `?club=driver|iron3|iron5|iron7|wedge|sand|putter`: force the club (on the green only `putter`; `?carry=N` sets its carry, e.g. a wedge at 30 for the half swing).
- `?cam=face|dtl|front`: camera 5 yd from the golfer at chest height: across the line at his front, behind the ball along the line, or from the target side.
- `?introAt=<0..1>`: freeze the hole flyover at that progress (needs no `intro=1`).
- `?shadows=off`: no real shadow map; the round blob shows under the golfer and caddie again.
- Example: `npm run shots -- "fore?hole=2&lie=sand" --start`

## Where changes go

- Hole layouts, hazards or par: `course.ts` (the voice intro lines follow; run `npm run voice`).
- Clubs, reach, ring size, how a slow or wrong answer misses, the roll, the starting suggestion: `shot.ts` (`DEAD_CENTRE_SHARE`, `MISS_MIN`, `MISS_MAX`, `ROLL_SHARE`, `SURFACE_ROLL`, `ringRadius`).
- Scoring, names and announcer calls: `rules.ts`, and add the lines to `allCallLines` so `voice.ts` stays complete.
- Trees, ground colours, hills or sky: `trees.ts`, `ground.ts`, `hole.ts`, `sky.ts`; where scenery stands: `scenery.ts` (keep trees 62 yd off the line).
- A new camera shot or screen fit: `views.ts`; HUD layout is in `hud.ts` and `style.css`.
- A new state that is hard to reach: add a query hook in `dev.ts`.

## Tests

- `tests/fore.test.ts`
- `tests/fore-scenery.test.ts`: scenery placement rules, gameplay trees unchanged, draw budget, dispose
- `tests/fore-swing.test.ts`: handedness, sizes, the grip, address, impact, top and finish of the swing
