# Fore! map

Nine holes of real golf: each shot is one question. The player puts a ring where the ball should land, anywhere in the club's reach (drag on the 3D view or the corner map, tap the corner map for a big map, or nudge with the arrows); the shortest club that reaches is picked and swung softer. The ring starts each shot on a smart suggestion. The ball lands in the ring and then rolls on (a dotted tail shows where it should stop). A right answer always lands inside the ring (faster is nearer the middle); a wrong answer or a time-out off the green is a duff (the ball skips 3 to 10 yd, within 15 degrees of the aim line, "Duffed it."); on the green it is a mis-hit putt that stops 20 to 40 % of the way and is never holed. There is no wind or slope. Scored in strokes against par with a seven-stroke cap and an announcer. The ball flight is analytic (no physics engine). Trees on four holes stop a low ball, and a caddie reacts beside the golfer.

## Files

- `main.ts`: the game loop, learning loop, ring placing input (finger on the picture, maps, arrows) and wiring of everything below; `warmUp` waits for the pictures, builds all nine holes once (kept, only one shown; a quality step down builds them again as they are reached) and compiles every shader behind the loading screen, so play never stalls
- `loading.ts`: the loading screen (plain HTML in `index.html`, so it shows while the scripts download): its bar and fade (`takeLoading`, `nextFrame`)
- `course.ts`: the nine holes, hazards and what is under a point (`HOLES`, `Hole`, `surfaceAt`, `centreX`, `FAIRWAY_HALF`, `GREEN_R`); no wind or slope
- `shot.ts`: clubs by landing distance, the limits on the ring (`reachFor`, `clubFor`, `clampTarget`, `ringRadius`), the planned shot, how it was struck (`resolveShot`: right lands inside the ring, wrong is a duff of 3 to 10 yd or a putt short by 20 to 40 %, never within `PIN_CLEAR` of the pin; `DUFF_*`, `PUTT_MISS_*`, `duffAngleFor`), the roll and where the ball ends (`rollFrom` (a duff does not roll on), `finishShot`, `predictRest`, `treeHit`, `pathAt`), the smart starting spot (`suggestTarget`) and `Plan`, `Outcome`, `Result`
- `rules.ts`: pure golf scoring (`toParLabel`, `toParTone` for the Total cell), the stored score and the announcer's lines (`afterShot`, `holeScore`, `holeOver`, `nameFor`, `storedFor`, `shotCall`, `holeCall`, `holeIntro`, `allCallLines`, `reactionFor`)
- `voice.ts`: every spoken line that is not a fact (`VOICE_LINES`)
- `hole.ts`: one hole as lit (standard material) meshes for a given `Look`: rolling rough with mounds, mown fairway, crosshatched green with fringe and apron, sunken bunkers with a grass lip, ponds with a mud bank and reflecting water, reeds and ripples, grey concrete cart path, tee with furniture, 150 and 100 yd markers, trees and bushes (leaf cards), rocks (noisy icosahedra with the sand maps), half as many small flowers, tufts, props, hills, true-size cup with its white liner and flash ring, flag and the gallery behind the green; every base stands on `groundY` (`buildHole`, `CUP_VISUAL_R`, `SKY`)
- `scenery.ts`: pure, seeded placement of the scenery trees, bushes, rocks and flowers and of the cart path for a hole, the woods line (`sceneryWoods`: two staggered rows 100 to 170 yd off the line and behind the green, drawn with a third of the cards) and where the clubhouses stand and the 30 yd they keep clear (`placeScenery`, `cartPath`, `LINE_CLEAR`, `clubhouseSite`, `CLUBHOUSE_CLEAR`); gameplay trees stay in `course.ts`
- `trees-grow.ts`: pure, seeded tree shapes: trunk and branch segments plus leaf cards for oak, birch and pine (three variants each, the card count a parameter), and the bush (the oak crown at a quarter size) (`growTree`, `growBush`, `TREE_BOUNDS`, `BUSH_BOUNDS`, `cardAxes`)
- `trees.ts`: turns the shapes into bark geometry (tapered 7-sided cylinders, bark picture) and leaf-card geometry (soft crown-outward normals, leaf picture with alpha, a sway in the vertex shader), one instanced mesh per species, variant and part, plus the bushes; they cast and receive real shadows on the tiers that have them, blob decals on low; a plain blob texture stands in for a leaf picture that did not load (`buildTreeLayer`, `barkGeometry`, `leafGeometry`, `treeBounds`, `treeScale`)
- `grass.ts`: the close blades round the ball (bent triangles on the rough within 22 yd, regrown each shot), the tufts of tall fescue in the far rough, their pure placements and the shared sway shader hook (`bladeSpots`, `tuftSpots`, `createBlades`, `buildTufts`, `swayMaterial`)
- `props.ts`: the clubhouse and two carts on holes 1 and 9, the yardage sign on every tee (canvas picture) and the sprinkler heads (`buildProps`)
- `ground.ts`: the `Look` a hole is dressed with (tier settings, loaded pictures, shadow map, sun), the lit-material helpers for the cascaded shadow map (`litMaterial`, `litTree`, `useCascadedLightChunk`: every tier uses the cascaded map's lights chunk so the colours match), the photo turf and sand materials with world-space macro noise and mown stripes (`turfMaterial`, `sandMaterial`, `cutOut`), the rough grid with hazard cut-outs, dish and bank geometry (`roughGeometry`, `dish`, `profileRing`) and the old procedural `DataTexture`s that stand in when a picture is missing (`groundTextures`, `ribbon`, `ellipseRing`, `strip`)
- `quality.ts`: pure: the three picture tiers and their settings (`GFX_SETTINGS`), the device rules that pick one and step it down (`pickGfx`, `adaptGfx`), and the readings of the sky picture (`brightestDirection`, `horizonRow`, `sunSetup`)
- `terrain.ts`: pure: the visual ground height, flat in play, mounds in the rough, dished bunkers and sunk ponds (`groundY`, `moundY`, `FLAT_HALF`, `RISE_TO`, `MOUND_MAX`, `BUNKER_DEPTH`, `POND_DEPTH`)
- `assets.ts`: loads the HDR sky, the dome picture, the grass, sand, water, bark and leaf pictures and the people (`people/golfer.glb` (the male body: golfer, caddie, men in the gallery), `caddie.glb` (the female body: women in the gallery), `hair.glb`, `fabric_normal.webp`) from `public/fore/`; any that fails is null and its user falls back to the procedural look (`loadForeAssets`, `NO_ASSETS`)
- `post.ts`: the effects chain for medium and high: multisampled half-float target, ambient occlusion (high), bloom, depth of field (high, eased in only while wanted) and the tone-map output (`createPost`)
- `sky.ts`: the photo sky dome (turned to match the environment's sun; the picture only says where the clouds are, the sky itself is a graded clear blue) or a plain gradient, the birds, and the three hills behind each hole (`createSky`, `buildHills`)
- `swing.ts`: pure swing numbers: the kind of swing for a club, its timing and the body and arm angles over time (`swingKind`, `timingFor`, `SWING_TIMING`, `swingFrame`)
- `golfer.ts`: the right-handed golfer: stands side-on to the ball, holds the club in both hands (arm solver), swings per `swing.ts`, cheers and groans; `setModel` puts the realistic body on the rig and moves the club with its hands (`createGolfer`, `createClub`, `REACH`)
- `caddie.ts`: the caddie with the bag, who idles, cheers or groans for 1.3 s; `setModel` as the golfer's, on the same male body in a plain green polo (no bib) and charcoal trousers (`createCaddie`, `REACTION_SECONDS`)
- `person.ts`: the jointed person rig that drives the golfer and the caddie, and is what shows if the models did not load (`createPerson`, `Pose`, `neutralPose`; a 2 yd cartoon grown-up with a big round face, short neck, chunky limbs, pelvis, hips, slide and heel-raise, `legs` joints)
- `retarget.ts`: pure maths on three's math types: the two-bone solver with a pole and the rest offset between a rig joint and a model bone (`twoBoneIK`, `restOffset`)
- `slim.ts`: slims a Quaternius superhero body once per loaded model, vertices and bones together in the bind pose (chest and spine 0.88, shoulders 0.85 in x, arms 0.8 and thighs 0.85 across the bone, arms 1.15 times longer for the rig's reach), then re-binds the skeleton (`slimBody`, `SLIM`, `bonesOf`)
- `clothes.ts`: per-vertex shirt, trousers, shoes and accent (glove or bib) weights from the bones that skin each vertex, and the material that paints them in flat colours with the cloth weave, roughness to suit and the cloth pushed out of the skin (`regionAttribute`, `clothMaterial`, `CLOTH_PUSH`)
- `skin.ts`: the realistic people: dresses a body (cap, hair, outfit; a body worn with both accents, glove and bib, gets a second copy so each keeps its own weights), hides the rig and every frame copies the rig's pelvis, chest, neck, head and feet onto the model with rest offsets and reaches its hands and ankles to the rig's with `twoBoneIK` (a shoulder may slide a few centimetres, and the club moves to where the palms are when the finish is out of reach); also the spectators that sway and clap (`createSkinnedPerson`, `createSpectator`, `GOLFER_OUTFIT`, `CADDIE_OUTFIT`)
- `gallery.ts`: the rope on white stakes and the crowd behind each green on the side away from the cart path, drawn within 150 yd of the green and clapping for 1.5 s when a ball is holed or rests within 2 yd of the pin; pure seeded layout and clap rules (`galleryLayout`, `shouldClap`, `clapAmount`, `buildGallery`)
- `ball.ts`: the true-size dimpled ball (it spins as it rolls) with its tee peg, shadow, splash, the red-orange tracer (a `Line2` that grows along the flight, holds 1 s after landing, fades in 0.5 s; none for putts), ring and halo aids and impact puff, and the flight path (`createBall`, `flightPoint`, `flightSeconds`)
- `travel.ts`: how a struck ball gets to where `finishShot` says it rests: the flight to where it touches down, hops that get lower and an evenly slowing roll on to the rest point (a holed ball runs to the pin), a putt that slows to a stop, and a duff (a low skip, one 0.08 yd hop, an even slowdown); scoring is unaffected (`createTravel`, `Travel`)
- `guide.ts`: the landing ring with its soft glow, the dotted line to it (red when it would hit a tree) and the dotted tail and hollow dot where the ball should stop; all ride the ground height (`createGuide`, `ringColour`)
- `views.ts`: the camera views and screen fitting (`aimView`, `placeView` (the higher view held while a finger places the ring), `followView`, `landView`, `introView` (the tee-to-green flyover), `fitView`)
- `hud.ts`: scorecard strip (nine holes and a Total cell: strokes against par over the holes finished, `Tot` under 420 px wide), the draggable corner map, the big map (tap the corner map; drag or tap to place the ring), chips, controls (◀ ▶ aim, ▲ ▼ distance, Swing!), question, answers, banner and pill (`createHud`, `bigMapWorld`, `bigMapSpan`, `cornerMapWorld`)
- `dev.ts`: dev query hooks (`devStart`, `devCard`, `devHoleState`, `devTarget`, `devScatter`, `devBigMap`, `devPlace`, `devQuality`, `devHolesOk`, `devCard`, `devSkipIntro`, `devSwing`, `devClubPlan`, `devCam`, `devIntroAt`, `devShadows`, `devGfx`, `devClap`)

## Dev hooks

- `?hole=N`: start at hole N (1 to 9) with the card filled in as if the earlier holes were par (no intro).
- `?card=<n>`: with `hole`, fill the earlier holes so the Total cell reads that many over par (`-4` under, `3` over).
- `?lie=green|sand|rough|tee|water`: start that hole with the ball in that lie near the pin (12 yd on the green, 20 yd otherwise). `sand` uses the hole's first bunker if it has one, else a bunker lie 20 yd out; `water` stands 100 yd short of the first pond with the ring on its centre (red).
- `?lie=tree`: on a hole with trees, start on the fairway with the ring placed so a perfect shot flies low through the first tree it can.
- `?intro=1`: keep the hole intro (the flyover) even when `hole`, `lie` or `strokes` would skip it.
- `?strokes=N`: preset the strokes already taken on the hole (up to 6) to check the cap.
- `?target=<yd>,<deg>`: put the first shot's ring that far out and that many degrees from the line to the pin (+ is right on screen), clamped to the limits.
- `?scatter=<deg>`: the direction a slow right answer lands off the ring (0 straight on, 90 right on screen) and a duff's side angle (clamped to +-15); absent is random.
- `?quality=perfect|close|miss|duff`: force the next shot's quality, whatever the answer (`close` is a right answer at 60 % of the clock; `miss` and `duff` are a wrong answer: a duff off the green, a mis-hit putt on it).
- `?bigmap=1`: open the big map once the aim view is up.
- `?place=1`: hold the higher "place" camera view, as if a finger were down on the picture.
- `?holes=ok`: play every hole instantly and show the results.
- `?swing=<seconds>`: freeze the golfer that many seconds into the swing for the club in play (also stops the game's own swing).
- `?club=driver|iron3|iron5|iron7|wedge|sand|putter`: force the club (on the green only `putter`; `?carry=N` sets its carry, e.g. a wedge at 30 for the half swing).
- `?cam=face|dtl|front`: camera 5 yd from the golfer at chest height: across the line at his front, behind the ball along the line, or from the target side. `?cam=crowd` (medium and high) stands inside the rope 9 yd from the gallery; add `?clap=1` to hold the clapping.
- `?introAt=<0..1>`: freeze the hole flyover at that progress (needs no `intro=1`).
- `?shadows=off`: no real shadow map; the round blob shows under the golfer and caddie again.
- `?gfx=low|medium|high`: force the picture quality tier (and stop it adapting or being saved). Headless browsers run on a software renderer that would pick `low`, so every `npm run shots` of Fore! passes it (add `--serial` for `gfx=high`: four software-rendered high pages at once starve each other and the screenshots time out).
- Example: `npm run shots -- "fore?hole=2&lie=sand" --start`

## Where changes go

- Hole layouts, hazards or par: `course.ts` (the voice intro lines follow; run `npm run voice`).
- Clubs, reach, ring size, how a slow or wrong answer misses, the roll, the starting suggestion: `shot.ts` (`DEAD_CENTRE_SHARE`, `DUFF_MIN`, `DUFF_MAX`, `PUTT_MISS_MIN`, `ROLL_SHARE`, `SURFACE_ROLL`, `ringRadius`).
- Scoring, names and announcer calls: `rules.ts`, and add the lines to `allCallLines` so `voice.ts` stays complete.
- Trees, ground colours, hills or sky: `trees-grow.ts` (shapes), `trees.ts`, `grass.ts`, `props.ts`, `ground.ts`, `hole.ts`, `sky.ts`; where scenery stands: `scenery.ts` (keep trees 62 yd off the line). People: the models and hair come from `npm run fore-assets -- people` (`scripts/fore-assets/people.ts`, which needs the owner's unzipped Quaternius pack in `assets-src/quaternius/`, never committed); the clothes, slimming and grip are in `slim.ts`, `clothes.ts` and `skin.ts`. Anything with a height stands on `groundY` (`terrain.ts`); the play area (62 yd off the line) must stay exactly flat.
- What a tier draws (shadows, post passes, water, counts): `GFX_SETTINGS` in `quality.ts`. The pictures under `public/fore/` come from `npm run fore-assets` (`scripts/fore-assets/main.ts`) and are all listed in `public/fore/CREDITS.md` (the test checks that and the 15 MB budget).
- A new camera shot or screen fit: `views.ts`; HUD layout is in `hud.ts` and `style.css`.
- A new state that is hard to reach: add a query hook in `dev.ts`.

## Tests

- `tests/fore.test.ts`
- `tests/fore-scenery.test.ts`: scenery placement rules, gameplay trees unchanged, draw budget per tier, dispose, bases on `groundY`, the `public/fore` asset list and size
- `tests/fore-trees.test.ts`: `growTree` (deterministic, exact card count, inside the bounds), bark and leaf geometry, the tree layer, blade and tuft placement
- `tests/fore-quality.test.ts`: tier rules and settings, the sky readings and the sun's direction
- `tests/fore-terrain.test.ts`: `groundY` is flat in play, dished in hazards, continuous and deterministic
- `tests/fore-retarget.test.ts`: the two-bone solver and the rest offsets
- `tests/fore-people.test.ts`: the real golfer and caddie models (parsed in Node): palms on the club through every swing, bone lengths kept, feet down, the rig back when no model; the gallery layout, clapping rules and build
- `tests/fore-swing.test.ts`: handedness, sizes, the grip, address, impact, top and finish of the swing
