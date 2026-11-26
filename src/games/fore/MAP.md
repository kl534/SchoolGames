# Fore! map

Nine holes of real golf: each shot is one question. The player puts a ring where the ball should land, anywhere in the club's reach (drag on the 3D view or the corner map, tap the corner map for a big map, or nudge with the arrows); the shortest club that reaches is picked and swung softer. The ring starts each shot on a smart suggestion. The ball lands in the ring and then rolls on (a dotted tail shows where it should stop). A right answer always lands inside the ring (faster is nearer the middle); a wrong one or a time-out lands 15 to 30 % of the distance away in a random direction. There is no wind or slope. Scored in strokes against par with a seven-stroke cap and an announcer. The ball flight is analytic (no physics engine). Trees on four holes stop a low ball, and a caddie reacts beside the golfer.

## Files

- `main.ts`: the game loop, learning loop, ring placing input (finger on the picture, maps, arrows) and wiring of everything below
- `course.ts`: the nine holes, hazards and what is under a point (`HOLES`, `Hole`, `surfaceAt`, `centreX`, `FAIRWAY_HALF`, `GREEN_R`); no wind or slope
- `shot.ts`: clubs by landing distance, the limits on the ring (`reachFor`, `clubFor`, `clampTarget`, `ringRadius`), the planned shot, how it was struck (`resolveShot`: right lands inside the ring, wrong 15 to 30 % off), the roll and where the ball ends (`rollFrom`, `finishShot`, `predictRest`, `treeHit`, `pathAt`), the smart starting spot (`suggestTarget`) and `Plan`, `Outcome`, `Result`
- `rules.ts`: pure golf scoring, the stored score and the announcer's lines (`afterShot`, `holeScore`, `holeOver`, `nameFor`, `storedFor`, `shotCall`, `holeCall`, `holeIntro`, `allCallLines`, `reactionFor`)
- `voice.ts`: every spoken line that is not a fact (`VOICE_LINES`)
- `hole.ts`: one hole as lit (standard material) meshes for a given `Look`: rolling rough with mounds, mown fairway, crosshatched green with fringe and apron, sunken bunkers with a grass lip, ponds with a mud bank and reflecting water, reeds and ripples, cart path, tee with furniture, 150 and 100 yd markers, trees and bushes (leaf cards), rocks (noisy icosahedra with the sand maps), half as many small flowers, tufts, props, hills, true-size cup with its white liner and flash ring, and flag; every base stands on `groundY` (`buildHole`, `CUP_VISUAL_R`, `SKY`)
- `scenery.ts`: pure, seeded placement of the scenery trees, bushes, rocks and flowers and of the cart path for a hole, the woods line (`sceneryWoods`: two staggered rows 100 to 170 yd off the line and behind the green, drawn with a third of the cards) and where the clubhouses stand and the 30 yd they keep clear (`placeScenery`, `cartPath`, `LINE_CLEAR`, `clubhouseSite`, `CLUBHOUSE_CLEAR`); gameplay trees stay in `course.ts`
- `trees-grow.ts`: pure, seeded tree shapes: trunk and branch segments plus leaf cards for oak, birch and pine (three variants each, the card count a parameter), and the bush (the oak crown at a quarter size) (`growTree`, `growBush`, `TREE_BOUNDS`, `BUSH_BOUNDS`, `cardAxes`)
- `trees.ts`: turns the shapes into bark geometry (tapered 7-sided cylinders, bark picture) and leaf-card geometry (soft crown-outward normals, leaf picture with alpha, a sway in the vertex shader), one instanced mesh per species, variant and part, plus the bushes; they cast and receive real shadows on the tiers that have them, blob decals on low; a plain blob texture stands in for a leaf picture that did not load (`buildTreeLayer`, `barkGeometry`, `leafGeometry`, `treeBounds`, `treeScale`)
- `grass.ts`: the close blades round the ball (bent triangles on the rough within 22 yd, regrown each shot), the tufts of tall fescue in the far rough, their pure placements and the shared sway shader hook (`bladeSpots`, `tuftSpots`, `createBlades`, `buildTufts`, `swayMaterial`)
- `props.ts`: the clubhouse and two carts on holes 1 and 9, the yardage sign on every tee (canvas picture) and the sprinkler heads (`buildProps`)
- `ground.ts`: the `Look` a hole is dressed with (tier settings, loaded pictures, shadow map, sun), the lit-material helpers for the cascaded shadow map (`litMaterial`, `litTree`), the photo turf and sand materials with world-space macro noise and mown stripes (`turfMaterial`, `sandMaterial`, `cutOut`), the rough grid with hazard cut-outs, dish and bank geometry (`roughGeometry`, `dish`, `profileRing`) and the old procedural `DataTexture`s that stand in when a picture is missing (`groundTextures`, `ribbon`, `ellipseRing`, `strip`)
- `quality.ts`: pure: the three picture tiers and their settings (`GFX_SETTINGS`), the device rules that pick one and step it down (`pickGfx`, `adaptGfx`), and the readings of the sky picture (`brightestDirection`, `horizonRow`, `sunSetup`)
- `terrain.ts`: pure: the visual ground height, flat in play, mounds in the rough, dished bunkers and sunk ponds (`groundY`, `moundY`, `FLAT_HALF`, `RISE_TO`, `MOUND_MAX`, `BUNKER_DEPTH`, `POND_DEPTH`)
- `assets.ts`: loads the HDR sky, the dome picture, the grass, sand, water, bark and leaf pictures from `public/fore/`; any that fails is null and its user falls back to the procedural look (`loadForeAssets`, `NO_ASSETS`)
- `post.ts`: the effects chain for medium and high: multisampled half-float target, ambient occlusion (high), bloom, depth of field (high, eased in only while wanted) and the tone-map output (`createPost`)
- `sky.ts`: the photo sky dome (turned to match the environment's sun; the picture only says where the clouds are, the sky itself is a graded clear blue) or a plain gradient, the birds, and the three hills behind each hole (`createSky`, `buildHills`)
- `swing.ts`: pure swing numbers: the kind of swing for a club, its timing and the body and arm angles over time (`swingKind`, `timingFor`, `SWING_TIMING`, `swingFrame`)
- `golfer.ts`: the right-handed golfer: stands side-on to the ball, holds the club in both hands (arm solver), swings per `swing.ts`, cheers and groans (`createGolfer`, `createClub`, `REACH`)
- `caddie.ts`: the caddie with the bag, who idles, cheers or groans for 1.3 s (`createCaddie`, `REACTION_SECONDS`)
- `person.ts`: the jointed person rig the golfer uses (`createPerson`, `Pose`, `neutralPose`; a 2 yd cartoon grown-up with a big round face, short neck, chunky limbs, pelvis, hips, slide and heel-raise)
- `ball.ts`: the true-size dimpled ball (it spins as it rolls) with its tee peg, shadow, splash, the red-orange tracer (a `Line2` that grows along the flight, holds 1 s after landing, fades in 0.5 s; none for putts), ring and halo aids and impact puff, and the flight path (`createBall`, `flightPoint`, `flightSeconds`)
- `travel.ts`: how a struck ball gets to where `finishShot` says it rests: the flight to where it touches down, hops that get lower and an evenly slowing roll on to the rest point (a holed ball runs to the pin), and a putt that slows to a stop; scoring is unaffected (`createTravel`, `Travel`)
- `guide.ts`: the landing ring with its soft glow, the dotted line to it (red when it would hit a tree) and the dotted tail and hollow dot where the ball should stop; all ride the ground height (`createGuide`, `ringColour`)
- `views.ts`: the camera views and screen fitting (`aimView`, `placeView` (the higher view held while a finger places the ring), `followView`, `landView`, `introView` (the tee-to-green flyover), `fitView`)
- `hud.ts`: scorecard strip, the draggable corner map, the big map (tap the corner map; drag or tap to place the ring), chips, controls (◀ ▶ aim, ▲ ▼ distance, Swing!), question, answers, banner and pill (`createHud`, `bigMapWorld`, `bigMapSpan`, `cornerMapWorld`)
- `dev.ts`: dev query hooks (`devStart`, `devHoleState`, `devTarget`, `devScatter`, `devBigMap`, `devPlace`, `devQuality`, `devHolesOk`, `devSkipIntro`, `devSwing`, `devClubPlan`, `devCam`, `devIntroAt`, `devShadows`, `devGfx`)

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
- `?gfx=low|medium|high`: force the picture quality tier (and stop it adapting or being saved). Headless browsers run on a software renderer that would pick `low`, so every `npm run shots` of Fore! passes it (add `--serial` for `gfx=high`: four software-rendered high pages at once starve each other and the screenshots time out).
- Example: `npm run shots -- "fore?hole=2&lie=sand" --start`

## Where changes go

- Hole layouts, hazards or par: `course.ts` (the voice intro lines follow; run `npm run voice`).
- Clubs, reach, ring size, how a slow or wrong answer misses, the roll, the starting suggestion: `shot.ts` (`DEAD_CENTRE_SHARE`, `MISS_MIN`, `MISS_MAX`, `ROLL_SHARE`, `SURFACE_ROLL`, `ringRadius`).
- Scoring, names and announcer calls: `rules.ts`, and add the lines to `allCallLines` so `voice.ts` stays complete.
- Trees, ground colours, hills or sky: `trees-grow.ts` (shapes), `trees.ts`, `grass.ts`, `props.ts`, `ground.ts`, `hole.ts`, `sky.ts`; where scenery stands: `scenery.ts` (keep trees 62 yd off the line). Anything with a height stands on `groundY` (`terrain.ts`); the play area (62 yd off the line) must stay exactly flat.
- What a tier draws (shadows, post passes, water, counts): `GFX_SETTINGS` in `quality.ts`. The pictures under `public/fore/` come from `npm run fore-assets` (`scripts/fore-assets/main.ts`) and are all listed in `public/fore/CREDITS.md` (the test checks that and the 15 MB budget).
- A new camera shot or screen fit: `views.ts`; HUD layout is in `hud.ts` and `style.css`.
- A new state that is hard to reach: add a query hook in `dev.ts`.

## Tests

- `tests/fore.test.ts`
- `tests/fore-scenery.test.ts`: scenery placement rules, gameplay trees unchanged, draw budget per tier, dispose, bases on `groundY`, the `public/fore` asset list and size
- `tests/fore-trees.test.ts`: `growTree` (deterministic, exact card count, inside the bounds), bark and leaf geometry, the tree layer, blade and tuft placement
- `tests/fore-quality.test.ts`: tier rules and settings, the sky readings and the sun's direction
- `tests/fore-terrain.test.ts`: `groundY` is flat in play, dished in hazards, continuous and deterministic
- `tests/fore-swing.test.ts`: handedness, sizes, the grip, address, impact, top and finish of the swing
