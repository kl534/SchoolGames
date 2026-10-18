# Strike Zone: a ten-pin bowling game — design

Status: agreed with the owner on 2026-10-17. Implement exactly this. Anything marked **(default)**
was not discussed explicitly and may be adjusted if it plays or looks badly; say so in the summary.

Read `CLAUDE.md` first. This is a **new game**. Everything lives in `src/games/strike-zone/`,
`tests/strike-zone.test.ts` and `tests/strike-zone-physics.test.ts`; the voice clips go in
`public/voice/` and `src/shared/voice-lines.json`. The only change in `src/shared/` is two new sound
effects in `src/shared/audio.ts` (section 7.3). Games never import from each other. The reference
is **Buzzer Beater** (`src/games/buzzer-beater/`): its fact feed and learning loop, `person.ts`,
`createAnimator`, the kids' `sit`/`cheer`/`groan` poses in `players.ts`, `hudLayout`, `fitView`
and `project` in `layout.ts`, the banner, the `after()` game-time scheduler, the `turn` and
`speechToken` guards against stale callbacks, and the pause wiring. **Copy** what you need into
`src/games/strike-zone/` and use the CSS prefix `sz-`. Do not import from Buzzer Beater.

A feasibility prototype of the physics in section 5 was run while designing (cannon-es, the shapes,
masses and materials below): pins stand still on their own, a ball centred in the gutter touches
nothing, single pins fall even when the ball passes 16 cm off centre (corner pins included), and a
full-rack throw takes about 1 s of CPU in Node (about 1,000 steps). The prototype had ball–pin
friction 0.12, which kicked the ball up off the lane at the first pin, so it flew over the back row:
only about 1 pocket throw in 12 was a strike. That was a physics fault, not realism. With ball–pin
friction 0 the ball stays on the lane and plows through (the full-rack test's nine aims give 7
strikes). Strikes are still not tuned for: don't change a material to move that rate.

## 1. What changes, in one paragraph

A new game, **Strike Zone**: real ten-pin bowling on a classic maple lane, scored like the real
thing (10 frames, strikes and spares, a bonus ball in the 10th, max 300). For each ball the kid
first **aims**: they drag along the bottom of the screen to slide the bowler across the approach,
and drag above that to swing a long yellow aim arrow. A dotted line and a ring show where the ball
will cross the pins, and the HUD's pin diagram shows the ball's path over the standing pins. Small
◀ ▶ buttons nudge either by one board. Then they tap **Bowl!**, the question is read aloud, and
the clock starts once the reading ends. A **right answer under 1 second** rolls the ball exactly
down the aimed line. A slower right answer drifts left or right at random: the drift grows with the
share of the clock used, and never goes past 10 cm at the pins, so a ball aimed dead at a single
pin still knocks it down. A **wrong answer or a timeout** is a gutter ball: the bowler slips and the
ball plops into the gutter at the foul line. Then the right fact is shown and read. The pins are real
cannon-es rigid bodies with real masses and no tuning for the strike rate, so strikes are earned and spares are common.
The camera follows the ball down the lane and then settles on a low pin cam for the crash. An
announcer calls every ball ("Strike!", "Seven pins!", "Gutter ball."). Strikes, spares and gutter
balls cut to three friends on the bench cheering or groaning. Strikes, doubles, turkeys and splits
also get a cartoon on an "alley screen" card, and strikes get confetti. A 10-frame scorecard runs
across the top. At the end a Game Over moment shows the big scorecard, then the results screen
shows the bowling score as the score (with the high score) and stars for the share of answers right.

## 2. Decisions from the interview

| Topic         | Decision                                                                                                                                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name / id     | **Strike Zone**, `strike-zone`, scored by points (`"scoring": "score"`).                                                                                                                                              |
| Length        | **10 frames, real rules and real scoring** (12–21 balls; one question per ball).                                                                                                                                      |
| Opponent      | **Solo.** The scorecard shows your high score for this topic ("Best 142") to chase.                                                                                                                                   |
| Throw flow    | **Aim → tap Bowl! → question read → clock starts → tap an answer → throw.** The aim stays where it was for the next ball.                                                                                             |
| Aim controls  | **Bowler + aim arrow.** Drag the bottom strip to slide the bowler; drag above to swing the arrow. **◀ ▶ nudge buttons** (one board each) for both.                                                                    |
| Guide         | **Arrow + faint dotted line to the pins + a ring** where the ball will cross the head-pin row.                                                                                                                        |
| Small pins    | The **HUD pin diagram also draws the ball's path** (a ball-wide band) over the standing pins, larger in portrait.                                                                                                     |
| Curve         | **Straight ball only.**                                                                                                                                                                                               |
| Ball speed    | **Fixed 9 m/s** (about 2 s to the pins).                                                                                                                                                                              |
| Right answer  | Under 1 s: **exactly on the aimed line.** Slower: **drift = 10 cm × (t − 1) / (T − 1)**, capped at 10 cm, left or right at random, where T is the fact's clock (15/10/5 s).                                           |
| Wrong/timeout | **Gutter ball, dropped at release:** the bowler slips and the ball plops into the nearer gutter at the line and rolls down it. The fact is shown and read.                                                            |
| Physics       | **cannon-es, real masses (6.4 kg ball, 1.5 kg pins), not tuned for the strike rate.** Ball–pin friction is 0 (see 5.3); don't tune for strikes.                                                                       |
| Venue         | **Classic alley:** maple lane with dots and arrows, gutters, a lit pin deck under a printed masking panel, neighbouring lanes, warm lights.                                                                           |
| Camera        | Aim: behind the bowler, fitted to the screen. Throw: **follow the ball, then a low pin cam** for the crash. A tap fast-forwards to the count.                                                                         |
| Throw anim    | **Quick 3-step approach, 0.9 s.**                                                                                                                                                                                     |
| Extras        | **Big moments** (STRIKE / DOUBLE / TURKEY / N IN A ROW / PERFECT GAME / SPARE / SPLIT on an alley-screen card with a cartoon; confetti on strikes). **Pin diagram in the HUD.** **Friends cheering** (reaction shot). |
| Friends       | **A 1.3 s reaction shot of three friends on the bench**, only after a strike, a spare or a gutter ball. Cheer or groan. A tap skips it.                                                                               |
| Announcer     | **Calls and pin counts** for every ball, all fixed and recorded. The fact is read after a wrong answer. No score lines.                                                                                               |
| Results       | **Bowling score large, with the high score; stars from the share right** (`starsFor`). A Game Over moment with the big scorecard comes first.                                                                         |
| Delivery      | **One PR**, branch `strike-zone`.                                                                                                                                                                                     |

## 3. Rules and numbers (pure)

Three pure modules: `geometry.ts` (lane sizes and pin spots), `aim.ts` (the aim, the drift, the
throw path) and `rules.ts` (scoring, calls, spoken lines). None of them imports three.js, cannon-es
or the DOM. Every random choice takes its number as an argument (`0 ≤ r < 1`) so it can be tested.

### 3.1 `geometry.ts`

Units are metres; y is up. The foul line is at `z = 0`, the lane runs towards **−z**, and the
bowler stands at +z. Seen from behind the bowler, +x is to the right. Pin 1 is the head pin, 2 and
3 are behind it (2 on the left), then 4 5 6, then 7 8 9 10 (7 far left, 10 far right).

```ts
export interface Vec {
  x: number;
  y: number;
  z: number;
}

export const LANE_WIDTH = 1.0541; // 41.5 in
export const LANE_HALF = LANE_WIDTH / 2; // 0.52705
export const BOARDS = 39;
export const BOARD_W = LANE_WIDTH / BOARDS; // 0.02703
export const FOUL_Z = 0;
/** The head pin's centre: 60 ft from the foul line. */
export const HEAD_Z = -18.288;
/** Pins in a row are 12 in apart; rows are 12·sin 60° apart. */
export const PIN_GAP = 0.3048;
export const ROW_GAP = 0.26397;
/** Back edge of the pin deck, then the pit, then the back cushion. */
export const DECK_BACK_Z = HEAD_Z - 3 * ROW_GAP - 0.07; // ≈ −19.150
export const PIT_BACK_Z = DECK_BACK_Z - 1.0;
export const GUTTER_W = 0.235;
export const GUTTER_DEPTH = 0.048;
/** Centre line of each gutter channel (±). */
export const GUTTER_X = LANE_HALF + GUTTER_W / 2; // 0.6445
/** Inner face of the side kickback walls at the pin deck (±). */
export const KICKBACK_X = LANE_HALF + GUTTER_W; // 0.76205

export const BALL_R = 0.108; // 8.5 in ball
export const BALL_MASS = 6.4;
export const BALL_SPEED = 9;
export const PIN_H = 0.381;
export const PIN_MASS = 1.5;
/** A pin's centre of mass above its base; the physics body's origin is here. */
export const PIN_COM_Y = 0.15;

/** Where the ball is let go (just past the foul line), the lane arrows, and the lane dots. */
export const RELEASE_Z = -0.3;
export const ARROW_Z = -4.572; // 15 ft
export const DOTS_Z = -2.134; // 7 ft
/** The bowler stands here while aiming; the 3-step approach ends at SLIDE_Z. */
export const BOWLER_Z = 2.0;
export const SLIDE_Z = 0.35;

/** Furthest the ball's centre may be from the middle of the lane on a right answer. */
export const AIM_LIMIT = LANE_HALF - BALL_R - 0.004; // ≈ 0.415

export type PinId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export const PIN_IDS: readonly PinId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
/** Row (0 = head pin … 3 = back row) and column (in half-gaps: −3 … 3) of each pin. */
export const PIN_GRID: Record<PinId, { row: number; col: number }> = {
  1: { row: 0, col: 0 },
  2: { row: 1, col: -1 },
  3: { row: 1, col: 1 },
  4: { row: 2, col: -2 },
  5: { row: 2, col: 0 },
  6: { row: 2, col: 2 },
  7: { row: 3, col: -3 },
  8: { row: 3, col: -1 },
  9: { row: 3, col: 1 },
  10: { row: 3, col: 3 },
};
/** The centre of a pin's spot on the deck: x = col · PIN_GAP / 2, z = HEAD_Z − row · ROW_GAP. */
export function pinSpot(id: PinId): { x: number; z: number };
```

### 3.2 `aim.ts`

The aim is a straight line on the lane. It's stored as the ball's x at release and the x where the
ball's centre crosses the head-pin row.

```ts
export interface Aim {
  /** The ball's x at release (the bowler stands so the ball is here). */
  startX: number;
  /** Where the ball's centre crosses z = HEAD_Z. */
  headX: number;
}

/** First ball of a game: 5 boards right of centre, into the 1–3 pocket. */
export const DEFAULT_AIM: Aim = { startX: 0.135, headX: 0.07 }; // (default)

/** x of the aimed line at depth z (it carries on straight past the head pin). */
export function lineX(aim: Aim, z: number): number;
//   startX + (headX − startX) · (z − RELEASE_Z) / (HEAD_Z − RELEASE_Z)

/**
 * Keeps the whole line on the lane: clamps startX to ±AIM_LIMIT, then moves headX the least it
 * takes so that lineX at DECK_BACK_Z is also within ±AIM_LIMIT. (A straight line between two
 * points inside the limit stays inside it, so a right answer can never roll into the gutter.)
 */
export function clampAim(aim: Aim): Aim;

/** Slides the bowler by dx, keeping the angle (both ends move by dx), then clampAim. */
export function moveBowler(aim: Aim, dx: number): Aim;

/** Swings the arrow: headX moves by dx and startX stays, then clampAim. */
export function swingArrow(aim: Aim, dx: number): Aim;

/** Where the arrow's tip is: lineX(aim, ARROW_Z). */
export function arrowTipX(aim: Aim): number;

/** The aim whose line runs from `startX` through the centre of a pin's spot (then clamped). */
export function aimThrough(startX: number, pin: PinId): Aim;

/** Most a right answer can drift: the line's offset at the head-pin row. */
export const MAX_DRIFT = 0.1;
/** Answers faster than this go exactly where aimed. */
export const PERFECT_UNDER_SECONDS = 1;

/**
 * How far a right answer drifts at the head-pin row:
 *   seconds < 1          → 0
 *   otherwise            → MAX_DRIFT · clamp01((seconds − 1) / (clockSeconds − 1))
 * If clockSeconds ≤ 1, any answer of 1 s or more drifts MAX_DRIFT.
 */
export function driftFor(seconds: number, clockSeconds: number): number;

/** Which way a drift goes: −1 (left) when random < 0.5, else +1. */
export function driftSide(random: number): -1 | 1;

/** The line actually thrown: headX moved by side · drift, then clampAim. */
export function thrownAim(aim: Aim, drift: number, side: -1 | 1): Aim;

export interface ThrowPath {
  startX: number;
  /** Unit direction on the lane (dirZ < 0) and speed. */
  dirX: number;
  dirZ: number;
  speed: number;
}
/** The ball's launch along the line, at BALL_SPEED. */
export function throwPath(aim: Aim): ThrowPath;

/** The gutter a wrong answer goes into: the side of startX; random < 0.5 → left when |startX| < 0.01. */
export function gutterSide(aim: Aim, random: number): -1 | 1;

/** Screen drag to lane distance (default): one board per this many CSS px. */
export const MOVE_PX_PER_BOARD = 8;
export const SWING_PX_PER_BOARD = 6;
```

Clamping keeps the drift within 10 cm too: it can only pull the line back towards the middle, so
`|thrownAim(...).headX − aim.headX| ≤ MAX_DRIFT` always holds.

### 3.3 `rules.ts`: scoring

Rolls are the pins knocked down by each ball, in order.

```ts
export const FRAMES = 10;
export const PINS = 10;
export type Rolls = readonly number[];

export interface Position {
  /** 1 … 10. */
  frame: number;
  /** 1, 2, or 3 (only in the 10th). */
  ball: number;
  /** Pins standing for this ball. */
  standing: number;
  /** True when this ball is on a fresh rack of 10 (rack all pins). */
  fullRack: boolean;
  over: boolean;
}

/** Where the game stands after these rolls. Throws if `rolls` is not a valid game so far. */
export function position(rolls: Rolls): Position;
/** Whether `rolls` is a valid game so far: every roll 0 … standing, no rolls after the end. */
export function isValidRolls(rolls: Rolls): boolean;
/** The rolls grouped by frame (the 10th may have up to 3). */
export function frameRolls(rolls: Rolls): number[][];
/**
 * The marks in each frame's boxes. Frames 1–9 have 2 boxes, the 10th has 3. A strike is 'X',
 * a spare '/', a zero '-', other rolls their digit, and unbowled boxes ''. A strike in frames
 * 1–9 is ['X', ''] (default). In the 10th each fresh-rack 10 is 'X'.
 * Example: [10, 7, 3, 9, 0] → [['X',''], ['7','/'], ['9','-'], ['',''], …].
 */
export function frameMarks(rolls: Rolls): string[][];
/** Running total after each frame, or null where it isn't known yet (bonus balls to come). */
export function runningTotals(rolls: Rolls): (number | null)[]; // always length 10
/** The total of the frames known so far; the final score once `position(rolls).over`. */
export function totalScore(rolls: Rolls): number;
/** Strikes (10s on a fresh rack) and spares in the game, for the results line. */
export function countMarks(rolls: Rolls): { strikes: number; spares: number };
/** Strikes in a row ending with the last roll (0 if the last roll wasn't a strike). */
export function strikeStreak(rolls: Rolls): number;
```

Rules (the standard ones):

| Situation                                        | Next ball                                  |
| ------------------------------------------------ | ------------------------------------------ |
| Frames 1–9, ball 1 is a strike                   | next frame, ball 1, full rack              |
| Frames 1–9, ball 1 not a strike                  | same frame, ball 2, the pins left standing |
| Frames 1–9, after ball 2                         | next frame, ball 1, full rack              |
| 10th, ball 1 strike                              | ball 2, full rack                          |
| 10th, ball 1 not a strike                        | ball 2, the pins left                      |
| 10th, ball 2 after a ball-1 strike, and a strike | ball 3, full rack                          |
| 10th, ball 2 after a ball-1 strike, not a strike | ball 3, the pins left                      |
| 10th, balls 1+2 a spare                          | ball 3, full rack                          |
| 10th, balls 1+2 open                             | game over                                  |
| 10th, after ball 3                               | game over                                  |

Scoring: a strike frame is 10 plus the next two rolls; a spare frame is 10 plus the next roll; an
open frame is its pins. The 10th frame is the sum of its balls.

### 3.4 `rules.ts`: splits

```ts
/**
 * A split (USBC): the head pin is down, at least two pins stand, and they don't all connect.
 * Two standing pins connect when |Δcol| ≤ 1 (diagonal neighbours, or the same column such as
 * 2–8), or when both are in the back row with |Δcol| = 2 (7–8, 8–9, 9–10).
 */
export function isSplit(standing: readonly PinId[]): boolean;
```

| Standing                                                                                         | Split? |
| ------------------------------------------------------------------------------------------------ | ------ |
| 7-10, 4-6, 7-9, 8-10, 3-10, 2-7, 5-7, 5-10, 4-5, 5-6, 2-10, 3-7, 4-9, 6-8, 4-7-10, 6-7-10, 4-5-6 | yes    |
| 7-8, 9-10, 2-8, 3-9, 2-4-7, 5-8-9, 2-4-5-8, any single pin, anything with pin 1 standing         | no     |

### 3.5 `rules.ts`: calls and spoken lines (all fixed, all recorded)

```ts
export type Call =
  | { kind: 'strike'; streak: number } // strikeStreak after this ball, 1 … 12
  | { kind: 'spare'; fromSplit: boolean } // fromSplit: the ball before left a split
  | { kind: 'split'; pins: number } // a first ball on a fresh rack that leaves a split
  | { kind: 'count'; pins: number } // 1 … 9 pins, nothing special
  | { kind: 'missed' } // a right answer that hit no pins (only possible on a spare ball)
  | { kind: 'gutter' }; // a wrong answer or timeout

/**
 * The call for a ball. `before` is the rolls before it, `pins` what it knocked down, `standingAfter`
 * the pins left, `gutter` whether it was a wrong answer or timeout, and `splitBefore` whether the
 * ball before (same rack) left a split.
 *   gutter                                    → gutter
 *   fresh rack and pins = 10                  → strike (streak = strikeStreak([...before, 10]))
 *   not a fresh rack and pins = standing      → spare (fromSplit = splitBefore)
 *   fresh rack and isSplit(standingAfter)     → split
 *   pins = 0                                  → missed
 *   otherwise                                 → count
 */
export function callFor(
  before: Rolls,
  pins: number,
  standingAfter: readonly PinId[],
  gutter: boolean,
  splitBefore: boolean,
): Call;

/** What the announcer says for a call, in order. */
export function callSpeech(call: Call): string[];
//  strike, streak 1        → ['Strike!']
//  strike, streak 2        → ['Double!']
//  strike, streak 3        → ['Turkey!']
//  strike, streak 4 … 11   → [`${WORDS[streak]} strikes in a row!`]  (Four … Eleven)
//  strike, streak 12       → ['A perfect game!']
//  spare                   → fromSplit ? ['You picked up the split!'] : ['Spare!']
//  split                   → [PIN_COUNT_SPEECH[pins], 'Split!']
//  count                   → [PIN_COUNT_SPEECH[pins]]
//  missed                  → ['No pins that time.']
//  gutter                  → ['Gutter ball.']

export const PIN_COUNT_SPEECH: Record<number, string> = {
  1: 'One pin.',
  2: 'Two pins.',
  3: 'Three pins.',
  4: 'Four pins.',
  5: 'Five pins.',
  6: 'Six pins.',
  7: 'Seven pins!',
  8: 'Eight pins!',
  9: 'Nine pins!',
};
export const LAST_FRAME_SPEECH = 'Last frame!';
export const GAME_OVER_SPEECH = 'Game over!';
export const NEW_HIGH_SCORE_SPEECH = 'New high score!';

/** Every line callSpeech can return, for voice.ts. */
export function allCallLines(): string[];
```

### 3.6 `rules.ts`: on-screen words (free-form, not spoken)

```ts
/** The alley-screen title for a big moment, or null for a call shown as a small pill. */
export function bigTitle(call: Call): string | null;
//  strike 1 'STRIKE!', 2 'DOUBLE!', 3 'TURKEY!', 4…11 `${streak} IN A ROW!`, 12 'PERFECT GAME!'
//  spare 'SPARE!' (fromSplit: 'SPLIT PICKED UP!'), split 'SPLIT!', others null
/** The small pill: count `${pins} PINS` ('1 PIN'), missed 'NO PINS', gutter 'GUTTER BALL', split `${pins} PINS`. */
export function pillText(call: Call): string | null;
/** Results line: "3 strikes and 4 spares!", "1 strike!", "2 spares!", or "No strikes or spares this time." */
export function outcomeText(rolls: Rolls): string;
```

## 4. Flow

Phases in `main.ts`:
`'preview' | 'aim' | 'ask' | 'throw' | 'roll' | 'gutter' | 'result' | 'reset' | 'over' | 'done'`.

1. **Page load.** `const session = startGameSession('strike-zone')`; if null,
   `location.replace(menuUrl())`. Build the scene, physics, HUD, back, mute and pause buttons.
   `feed = createFactFeed(() => session.chooseFacts())`, `rolls = []`, `aim = DEFAULT_AIM`,
   `bestAtStart = session.highScore()`, rack all 10 pins.
2. **Preview.** `showPreview({ topic: session.topic, facts: feed.peek(10), onDone: startAim })`.
   "Play again" skips the preview (as in Buzzer Beater).
3. **Aim** (no time limit). The bowler holds the ball at `BOWLER_Z`, with the ball at
   `aim.startX`. Showing: the arrow, the dotted line, the ring, the pin diagram with the path band,
   the nudge buttons and the **Bowl!** button. Drags and nudges change `aim` (section 6.2). On the
   game's first ball, two hints show: `↔ Drag to move` over the bowler strip and `↔ Drag to aim`
   by the arrow. They go away after the first drag or nudge of each kind, or on the first Bowl!
   **(default)**. When the 10th frame starts (its ball 1), show the pill `10TH FRAME` for 1.4 s and
   speak `LAST_FRAME_SPEECH`.
4. **Bowl!** (button, Enter or Space) → `unlockAudio()`, then **Ask**.
5. **Ask.** As in Buzzer Beater's `ask()`: `fact = feed.take()`,
   `options = answerOptions(session.topic, fact, 4)`, show the question and answers, hide the aim
   controls and the Bowl! button (the arrow, line, ring and band stay), and ease the camera to the
   aim view fitted for the ask band (0.35 s). Read `fact.spokenPrompt ?? fact.prompt`.
   `clockTotal = session.timerSecondsFor(fact)`; the clock bar starts once the reading ends, and the
   answer time is counted from that moment. A tap before the reading ends counts as 0 s.
   `sfx.tick()` plays as the remaining whole seconds change to 3, 2 and 1.
6. **Answer.** Lock the answers; mark the chosen one, and the right one green. A right answer:
   `feed.recordHit(fact)`, `session.recordAnswer(fact, true)`. A wrong answer or timeout:
   `feed.recordMiss(fact)`, `session.recordAnswer(fact, false)`. Hide the question and answers
   0.5 s later **(default)**.
   - Right → `drift = driftFor(used, clockTotal)`, `side = driftSide(Math.random())`,
     `thrown = thrownAim(aim, drift, side)` → **Throw**. (`aim` itself is not changed: the next
     ball starts from the kid's own aim, not the drifted one.)
   - Wrong or timeout → **Gutter**.
7. **Throw** (0.9 s, section 5.4). At 0.9 s: `physics.launch(throwPath(thrown))`,
   `sfx.roll(2.0)` → **Roll**.
8. **Roll.** `physics.step(delta)` every frame; the meshes copy the bodies. The camera follows, then
   cuts to the pin cam (section 5.6). Play `sfx.pins()` once, the first time the ball comes within
   0.25 m of a standing pin. A tap 0.3 s or more after release fast-forwards (section 5.3). When
   `physics.settled()`: `standingAfter = physics.standing()` (only pins that stood before this ball
   can be in it), `pins = standingBefore.length − standingAfter.length`, then **Result**.
9. **Gutter** (wrong or timeout, section 5.5). The ball drops into the gutter at 0.7 s with
   `sfx.bump()`, then rolls down it with `sfx.roll(1.5)`. At the drop: `pins = 0`,
   `standingAfter = standingBefore`, then **Result**, with the camera still on the aim view.
10. **Result.** `call = callFor(rolls, pins, standingAfter, gutter, splitBefore)`, then
    `rolls = [...rolls, pins]`. Update the scorecard (flash the frame) and the pin diagram.
    - Show `bigTitle(call)` on the alley-screen card (1.8 s) if there is one, or else
      `pillText(call)` as a pill (1.6 s). After a gutter ball, also show a banner with
      `GUTTER BALL` and `fact.statement`, kind `'miss'`, which stays until the next Bowl!.
    - Speak `callSpeech(call)` one line after another (Buzzer Beater's `sayLines`). After a gutter
      ball, then speak `fact.spokenStatement ?? fact.statement`.
    - Sounds: strike or spare `sfx.cheer()`; turkey and up, or a perfect game, `sfx.bigCheer()`;
      gutter `sfx.miss()`. Confetti for every strike (section 7.2).
    - **Reaction shot** after a strike, a spare or a gutter ball: `PIN_HOLD = 1.2` s after the
      result (0.9 s after a gutter drop), cut to the friends' view for `REACTION_FOR = 1.3` s, with
      the friends doing `cheer` (strike or spare) or `groan` (gutter). Other calls skip it.
    - The phase ends when all of these are true: the speech is done; `PIN_HOLD` (and the reaction
      shot, if any) is over; and after a gutter ball, `REVEAL_FOR = 2.4` s have passed since the
      answer. Then **Reset**.
    - A tap skips ahead (stops the speech, goes to **Reset**) once `SKIP_AFTER = 0.6` s have passed
      since the result, but after a gutter ball not before `REVEAL_FOR` from the answer.
11. **Reset** (`RESET_FOR = 0.6` s). `p = position(rolls)`. If `p.over` → **Over**. Otherwise, from
    the friends' shot cut to the aim view; from the pin cam ease back over 0.6 s. At the start of
    the reset: if `p.fullRack`, `physics.rack(PIN_IDS)` and play the drop-in (section 5.2), and
    `splitBefore = false`; else `physics.rack(standingAfter)` (the standing pins go back upright on
    their own spots), and `splitBefore = call.kind === 'split'`. Put the ball back in the bowler's
    hands at `aim.startX`. Then **Aim**.
12. **Over.** Hide the controls and the pin diagram. Show the scorecard large in the middle of the
    screen, with a banner `GAME OVER` / `Final score ${total}`, kind `'info'`. If
    `total > bestAtStart && total > 0`, speak `NEW_HIGH_SCORE_SPEECH` and play `sfx.bigCheer()`;
    else speak `GAME_OVER_SPEECH` and play `sfx.cheer()`. After `FINAL_FOR = 3.0` s (a tap skips
    after 0.6 s) → **Done**.
13. **Done.** `stars = starsFor(feed.correct, feed.answered)`, `session.recordStars(stars)`,
    `session.recordScore(total)`, then

    ```ts
    showResults({
      topicId: session.topic.id,
      correct: feed.correct,
      total: feed.answered,
      stars,
      newBest: false,
      missed: feed.missed(),
      playerName: session.player?.name,
      score: total,
      outcome: outcomeText(rolls),
      highScore: session.highScore(),
      newHighScore: total > bestAtStart && total > 0,
      playAgainLabel: 'Play again 🎳',
      onPlayAgain: () => startGame(false),
    });
    ```

    `startGame(false)` resets everything (new feed, `rolls = []`, `aim = DEFAULT_AIM`, a full rack,
    `bestAtStart = session.highScore()`) and goes straight to **Aim**.

Stale callbacks: use a `turn` counter (bumped on every Bowl!) and a `speechToken`, as in Buzzer
Beater, so late speech or `after()` callbacks from an earlier ball do nothing. Delayed actions run on
game time (`after()`), so pausing freezes them. Pause (`createPauseOverlay`) stops the loop
(`ctx.stop()`) and the speech; the physics only steps inside the loop, so it pauses too. On
`pagehide`: `stopSpeaking()`, remove the key and pointer listeners, `pause.dispose()`,
`mute.dispose()`, `ctx.dispose()`.

## 5. The alley, the physics and the throw

### 5.1 The alley (`alley.ts`, three.js)

- **Lane:** a box from x −LANE_HALF…LANE_HALF, top at y = 0, from z = FOUL_Z to DECK_BACK_Z. Its
  material is a `CanvasTexture` (512 × 4096, repeated along z) of 39 maple boards, alternating
  `0xd9a86c` / `0xd2a064` with thin darker seams, and a glossy finish (roughness 0.25). The pin deck
  (the last 1.0 m) is a little lighter, `0xe6c08a`.
- **Markings:** a black foul line (0.02 deep) at z = 0. Seven dark-red `0x7a1f1f` arrows (flat
  triangles 0.05 wide and 0.15 long, pointing −z) at `ARROW_Z`, on boards 5, 10, 15, 20, 25, 30 and
  35 counted from the right. Ten small dots at `DOTS_Z` on boards 3, 5, 8, 11, 14 and their mirrors
  **(default)**.
- **Approach:** lighter maple `0xe2b77e` from z = 0 to z = +4.6, with the same board texture.
- **Gutters:** half-pipes (an open half-cylinder, radius GUTTER_W / 2, dipping GUTTER_DEPTH below
  the lane) along both sides, `0x2b2f36`, from the foul line to the pit.
- **Capping** between lanes: dark `0x3a3f48` strips 0.15 wide. **Kickbacks:** dark vertical boards
  0.6 tall at ±KICKBACK_X beside the deck.
- **Neighbouring lanes:** two on each side, centred at x = ±1.77 and ±3.54, each with its own
  gutters and a full decorative rack of pins (meshes only, no physics; they never fall).
- **Masking panel:** a printed panel across all lanes in front of the pinsetter, from y = 0.95 to
  2.4, at z = HEAD_Z − 0.3, facing +z. A `CanvasTexture` in navy `0x1c2f6b` with coloured stars
  and stripes, and "STRIKE ZONE" in big letters over the middle lane. It must not hide any pin
  from the aim camera or the pin cam (check by eye). Behind and below it: black.
- **Pit:** black, from DECK_BACK_Z to PIT_BACK_Z, with a black curtain at PIT_BACK_Z.
- **Room:** a dark carpet floor `0x2a2238` beside the approach, and dark walls. Behind the approach
  on the left, an orange `0xe5702a` bench (2.0 × 0.45 × 0.5) centred at (−2.6, 0, 4.2), facing −z,
  for the friends.
- **Lights:** `HemisphereLight(0xfff4e0, 0x3a2a20, 0.9)`, a warm `DirectionalLight` (0.8) from
  (2, 8, 6), and a `PointLight(0xffffff, 1.2, 6)` at (0, 1.4, HEAD_Z + 0.6) so the pins glow.
  No shadow maps; a soft dark blob under the ball **(default)**.

**Pins** (`pins.ts`): a `LatheGeometry` (24 segments) from this profile of (radius, height)
points: (0, 0), (0.026, 0), (0.040, 0.03), (0.056, 0.08), (0.0605, 0.114), (0.055, 0.17),
(0.040, 0.22), (0.026, 0.255), (0.0228, 0.27), (0.028, 0.30), (0.032, 0.33), (0.030, 0.355),
(0.020, 0.372), (0, 0.381). Use white `0xf7f5ef` (roughness 0.35), with two red `0xd62828` bands at
the neck (thin open cylinders at y 0.262 and 0.282). The mesh sits in a group offset by
−PIN_COM_Y, so the group's origin matches the physics body.

**Ball** (`ball.ts`): `SphereGeometry(BALL_R, 32, 24)`, glossy (roughness 0.18), with a
`CanvasTexture` of blue `0x2a5fd1` and lighter `0x6fa0ff` swirls, plus three dark finger holes
**(default)**.

### 5.2 Racking pins

`physics.rack(ids)` puts each listed pin upright on its spot, still and asleep, and takes the rest
out of the world (and hides their meshes). On a fresh rack the meshes drop in: they start 0.5 m up
and ease down over 0.45 s (drawing only; the bodies are already in place). A standing pin that was
knocked off its spot but stayed up goes back on its own spot **(default)**, so the 3D view and the
pin diagram always agree.

### 5.3 Physics (`physics.ts`, cannon-es only, no three.js)

```ts
export interface BodyPose {
  x: number;
  y: number;
  z: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
}

export interface Physics {
  /** Stands these pins on their spots, still and asleep; the others leave the world. */
  rack(ids: readonly PinId[]): void;
  /** Starts a throw down this path (section 5.3). */
  launch(path: ThrowPath): void;
  /** Advances by `delta` seconds in FIXED_STEP steps, at most `maxSteps` of them. */
  step(delta: number, maxSteps?: number): void;
  /** Seconds simulated since `launch`. */
  readonly time: number;
  /** When the ball first came within 0.25 m of a standing pin (or crossed HEAD_Z + 0.25), else null. */
  readonly contactAt: number | null;
  /** True once the throw has played out (rules below). */
  settled(): boolean;
  /** The racked pins standing now: tilted under 25° from upright and still on the deck. */
  standing(): PinId[];
  ball(): BodyPose;
  pin(id: PinId): BodyPose | null;
}
export function createPhysics(): Physics;
/** A whole throw with nothing drawn; returns the pins left standing. For tests. */
export function simulateThrow(rack: readonly PinId[], path: ThrowPath): PinId[];

export const FIXED_STEP = 1 / 200;
export const MAX_SUBSTEPS = 6;
/** Steps per frame while fast-forwarding after a tap. */
export const FAST_STEPS = 40;
export const SETTLE_MIN = 1.5;
export const SETTLE_MAX = 4.0;
/** With nothing moving this long after contact, a clean miss settles early. */
export const QUIET_SETTLE = 0.6;
export const DOWN_TILT_DEG = 25;
```

**World:** gravity (0, −9.81, 0), `allowSleep = true`, `solver.iterations = 20`, default
broadphase.

**Static bodies** (all boxes):

| Body          | Where                                                                        | Material |
| ------------- | ---------------------------------------------------------------------------- | -------- |
| lane + deck   | x ±LANE_HALF, top at y 0, z +0.3 … DECK_BACK_Z                               | `lane`   |
| gutter floors | x LANE_HALF … KICKBACK_X (both sides), top at y −GUTTER_DEPTH, same z        | `lane`   |
| kickbacks     | 0.04 thick at x ±(KICKBACK_X + 0.02), y 0 … 0.6, z HEAD_Z + 0.5 … PIT_BACK_Z | `wall`   |
| pit floor     | x ±1.0, top at y −0.25, z DECK_BACK_Z … PIT_BACK_Z                           | `wall`   |
| back cushion  | x ±1.0, y −0.3 … 0.7, 0.1 thick at PIT_BACK_Z                                | `wall`   |

**Pins:** each a `Body({ mass: PIN_MASS, linearDamping: 0.05, angularDamping: 0.1 })` with its
origin at the centre of mass (PIN_COM_Y above the base) and three shapes, offset from the origin:

| Shape                                | Offset y          |
| ------------------------------------ | ----------------- |
| `Cylinder(0.0605, 0.035, 0.114, 12)` | 0.057 − PIN_COM_Y |
| `Cylinder(0.023, 0.0605, 0.14, 12)`  | 0.184 − PIN_COM_Y |
| `Sphere(0.032)`                      | 0.33 − PIN_COM_Y  |

`sleepSpeedLimit = 0.05`, `sleepTimeLimit = 0.3`. Racked pins start with `sleep()`.

**Ball:** `Body({ mass: BALL_MASS, shape: Sphere(BALL_R), linearDamping: 0.01, angularDamping:
0.01 })`, `allowSleep = false`. It is out of the world until `launch`.

**Contact materials** (friction, restitution): ball–lane (0.04, 0), pin–lane (0.3, 0.25),
pin–pin (0.25, 0.5), ball–pin (0, 0.5), pin–wall (0.2, 0.45), ball–wall (0.2, 0.3). These are
the prototype's values except ball–pin friction, which is 0: with any (0.12 in the prototype), cannon-es
kicks the ball up off the lane at the first pin and it sails over the back row. Change them only if pins misbehave physically (jitter, sinking, flying
off), never to change how often strikes happen, and say so.

**Launch:** the ball goes to (startX, BALL_R, RELEASE_Z) with velocity
`(dirX, 0, dirZ) · speed`, rolling: angular velocity `(vz / BALL_R, 0, −vx / BALL_R)`.
**Rails:** after every step (`world.addEventListener('postStep', …)`), while the ball's z >
HEAD_Z + 0.6, set its x to the line's x at its z, y to BALL_R, and its velocity back to the launch
velocity. So the ball arrives exactly on the line, and only the pins are free physics. After that
it is free.

**Settled** when the ball has passed the pins or stopped (z < DECK_BACK_Z, or speed < 0.2), and:

- `contactAt` is set, at least SETTLE_MIN has passed since it, and every pin moves slower than
  0.04 m/s and spins slower than 0.25 rad/s; or
- SETTLE_MAX has passed since `contactAt`; or
- QUIET_SETTLE has passed since `contactAt` and every pin is still asleep (a clean miss on a spare).

If `contactAt` never gets set (a spare ball that misses everything), set it when the ball crosses
HEAD_Z.

**Standing:** a racked pin whose up axis is tilted less than DOWN_TILT_DEG from vertical, with
|x| < LANE_HALF + 0.01, z > DECK_BACK_Z and y > 0.05.

**Fast-forward:** after a tap during **Roll**, each frame steps `FAST_STEPS` fixed steps (about 8×
real time), until settled. Cut the camera to the pin cam at once.

### 5.4 The bowler and the throw (`bowler.ts`)

Copy Buzzer Beater's `person.ts` as is (`createPerson`, `Pose`, `limb`, `createAnimator`, the easing
helpers, `runPose`). Bowler style: shirt `0x2a9d8f`, pants `0x2b2d42`, `hat: 'none'` **(default)**,
scale `PERSON_SCALE`. The bowler faces −z (`root.rotation.y = π`), so their right hand is on the +x
side. The root sits at `x = aim.startX − BOWLER_HAND_X` (`BOWLER_HAND_X = 0.26`; adjust so the right
hand is over startX at release) **(default)**.

| Move     | Pose / timing                                                                                                                                                                                                                     |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hold`   | aiming: upright at BOWLER_Z, ball in both hands at the chest (arms raise 0.9, bend 1.2), a slow ±0.02 sway                                                                                                                        |
| `throw`  | 0.9 s, 3 steps from BOWLER_Z to SLIDE_Z (`runPose`, eased). Right arm: push-away (raise 0.5) by 0.2 s, back-swing (raise −1.3) at 0.55 s, forward to raise 0.2 at 0.9 s. Lean 0.55 and lift −0.25 at the slide, left leg forward. |
| `follow` | after 0.9 s: right arm up to raise 1.6 over 0.35 s and hold, still leaning                                                                                                                                                        |
| `slip`   | wrong answer, 1.2 s: the first 0.45 s like `throw`; then roll 0.3 towards the gutter side, lean −0.3, arms flail (raise 1.2 ± 0.4 at 6 Hz, out 0.8); back up by 1.2 s, then `slump` (head down, shoulders drop)                   |

The ball is in the right hand (`handWorld('R')`) until 0.75 s, then eases to (startX, BALL_R,
RELEASE_Z) by 0.9 s, where `launch` takes over. Between balls (while the camera is on the pins or
the friends), the bowler snaps back to `hold` at BOWLER_Z.

### 5.5 The gutter ball (scripted, no physics)

`side = gutterSide(aim, Math.random())`. The ball leaves the hand at 0.5 s and arcs (0.25 s,
0.15 m high) to (side · GUTTER_X, BALL_R − GUTTER_DEPTH, 0.1). At 0.7 s it lands (`sfx.bump()`) and
then rolls down the gutter's centre at 4 m/s (spinning) until z < DECK_BACK_Z − 0.4, where it is
hidden. It never touches the pins. The camera stays on the aim view.

### 5.6 Camera views (`views.ts`)

Copy `project` and `fitView` from Buzzer Beater's `layout.ts`, but with `MIN_FOV = 8` (the aim
view is a long lens). Views are cached per screen size and band, as in Buzzer Beater.

| View      | Camera position                                                                  | Fitted to (key points)                                                                                                                                                                                                                    |
| --------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aim`     | (0, 3.4, 12) **(default)**                                                       | the back-row pin tops (±0.46, PIN_H, HEAD_Z − 3·ROW_GAP); the deck front corners (±0.6, 0, HEAD_Z + 0.2); the ball at both limits (±AIM_LIMIT, 0, BOWLER_Z); the bowler's head at both limits (±AIM_LIMIT − BOWLER_HAND_X, 1.5, BOWLER_Z) |
| `follow`  | ball + (−0.4·ballX, 0.85, 2.6), looking at (0.6·ballX, 0.15, ball.z − 6), fov 50 | (not fitted)                                                                                                                                                                                                                              |
| `pins`    | (−0.9, 0.62, HEAD_Z + 1.5) **(default)**                                         | all 10 spots' tops and bases; the kickback corners (±KICKBACK_X, 0, DECK_BACK_Z) and (±KICKBACK_X, 0.5, HEAD_Z + 0.2)                                                                                                                     |
| `friends` | (−2.6, 1.15, 1.7)                                                                | the bench ends (−3.6 / −1.6, 0, 4.2) and the friends' heads standing (y 1.5)                                                                                                                                                              |

The aim view's key points don't depend on the aim, so the picture stays still while the kid drags.
It is fitted twice: to the **aim band** (between the scorecard and the nudge row) and to the **ask
band** (between the question panel and the answers). Ask eases between them in 0.35 s.

Throw timeline: from release, ease aim → follow over 0.5 s. When the ball's z < HEAD_Z + 6, ease
follow → pins over 0.7 s, and hold there until the result. Reset eases pins → aim over 0.6 s. The
friends' view is a hard cut in and out.

### 5.7 The friends (`friends.ts`)

Three kids made with `createPerson`, root scale 0.75 (relative to PERSON_SCALE), sitting on the
bench at x −3.2, −2.6 and −2.0, facing −z. Shirts `0xe63946`, `0x2a9d8f`, `0xffd166`, with varied
skin and hair **(default)**. Copy Buzzer Beater's `sit`, `cheer` and `groan` pose builders (the
`KidMove` cases in its `players.ts`). They `sit` all the time except during a reaction shot, and
each starts with a random 0–0.25 s delay.

## 6. Screen layout (touch first)

Copy `hudLayout` from Buzzer Beater: `'stacked'` (aspect ≤ 1.2), `'compact'` (height ≤ 380 and
aspect ≥ 1.2), `'standard'` otherwise. The shared Menu button sits top-left, and mute and pause
top-right; all are 48 px tall at top 12.

### 6.1 Where things are

| Element                      | stacked (390×844, 1024×1366)                                                                                                | compact (844×390)                                                                       | standard (1024×768, 1366×1024)                     |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Scorecard `.sz-card`         | top 70, left/right 12, full width; 10th frame 1.5× wide; "Best 142" pill under its right end                                | top 12, centred between the Menu and the mute button, width ≤ 572; Best as an 11th cell | top 12, centred, width ≤ 640; Best as an 11th cell |
| Pin diagram `.sz-pins`       | right 12, just under the card, 132 × 112 + caption; **hidden during Ask**                                                   | right 12, top 72, 112 × 96 + caption                                                    | right 12, top 72, 132 × 112 + caption              |
| Nudge row                    | 52 px buttons; `◀ Move ▶` at left, `◀ Aim ▶` at right; 10 px above Bowl!                                                    | same row as Bowl!: `◀ Move ▶` left, Bowl! centre, `◀ Aim ▶` right                       | same row as Bowl!                                  |
| Bowl! `.sz-bowl`             | bottom max(16 px, safe area), centred, 64 tall, min-width 200, 26 px bold, orange `#ff7a1a`                                 | bottom 12, 56 tall                                                                      | bottom 16, 68 tall                                 |
| Question `.sz-q` + clock bar | top = card bottom + 8, full width, 30 px bold, 🔊 hear button (48 px) at its right; 10 px clock bar inside along the bottom | top 70, centred, width ≤ 520                                                            | top 76, centred, width ≤ 560                       |
| Answers `.sz-answers`        | ≤ 560 wide: 2 × 2 grid, 64 px tall; wider: 4 across, 72 px                                                                  | 4 across, 56 px                                                                         | 4 across, 72 px, width ≤ 760                       |
| Alley screen `.sz-screen`    | middle of the play band, 86% width, ≤ 360 × 200                                                                             | middle, ≤ 320 × 180                                                                     | middle, ≤ 360 × 200                                |
| Pill `.sz-pill`              | top of the play band + 12, centred                                                                                          | same                                                                                    | same                                               |
| Banner `.sz-banner`          | above the nudge row (aim) or above the answers (ask), centred, ≤ 92% width                                                  | same                                                                                    | same                                               |

In stacked, the 3D pins sit at the top middle of the band and the diagram at the right, so they
don't overlap. Check this at 390×844, and if they do overlap, move the diagram down under the far
end of the lane **(default)**. All buttons are at least 48 × 48 px, use `onPress`, and also take a
`pointerup` → `unlockAudio` (as Penalty Kick does).

### 6.2 Aim input

`createPointerInput(renderer.domElement, …)`, only in **Aim**:

- `onDragStart`: project the ball (startX, 0, BOWLER_Z) and the arrow tip (`arrowTipX`, 0,
  ARROW_Z) to the screen. A press below the midpoint of their screen ys is a **move** drag; a press
  above it is a **swing** drag.
- `onDrag`: move → `aim = moveBowler(aim, (dx / MOVE_PX_PER_BOARD) · BOARD_W)`; swing →
  `aim = swingArrow(aim, (dx / SWING_PX_PER_BOARD) · BOARD_W)`.
- Nudge buttons: `moveBowler` / `swingArrow` by ±BOARD_W per press.
- Keys **(default)**: ← → move the bowler; Shift + ← → (or A / D) swing the arrow; Enter or Space
  bowls; 1–4 answer during Ask.
- In **Roll** a tap (`onTap`) fast-forwards; in **Result** and **Over** a tap skips ahead (section 4).

### 6.3 The aim drawings (3D, drawn just above the lane)

- **Arrow:** yellow `0xffd166`, opacity 0.95: a 0.06-wide shaft from (startX, RELEASE_Z) to the tip
  at ARROW_Z, and a 0.16 × 0.25 triangle head at the tip.
- **Dotted line:** white dots of radius 0.035, opacity 0.55, every 0.6 m from the tip to HEAD_Z + 0.4.
- **Ring:** a white ring with outer radius BALL_R and inner 0.085, opacity 0.8, flat at
  (lineX(aim, HEAD_Z + 0.35), HEAD_Z + 0.35). It shows the ball's width just in front of the pins.

They show during Aim and Ask, and hide from the answer on.

## 7. HUD and voice

### 7.1 Scorecard and pin diagram (`hud.ts`)

- **Scorecard:** a CSS grid with 9 equal frames and the 10th 1.5× wide (plus a Best cell in
  landscape). Each frame has a marks row (2 boxes, or 3 in the 10th, from `frameMarks`) and a total
  row (`runningTotals`, blank for null). Background `rgba(12,18,40,0.82)`, white text, marks 15 px
  (13 px when stacked and ≤ 400 wide), totals 15 px bold, tabular numbers. The current frame has a
  yellow `#ffd166` border. A frame flashes (scale pulse, 0.35 s) when its marks change.
  `aria-label` = `Score ${totalScore}`. Best shows `session.highScore()`; hide it when that is 0.
- **Pin diagram:** an inline SVG, viewBox x −0.62…0.62 and z DECK_BACK_Z − 0.02…HEAD_Z + 0.25,
  drawn with the head pin at the **bottom** and the back row at the top (the bowler's view). Standing
  pins are white circles (r 0.075) with a red dot; down pins are faint outlines. During Aim and Ask,
  a yellow `rgba(255,209,102,0.55)` band 2·BALL_R wide follows `lineX(aim, z)` over the whole
  diagram, with a thin centre line. A caption under it reads `FRAME 4 · BALL 2`. `aria-label` lists
  the standing pins, e.g. `Pins standing: 7, 10`.

### 7.2 Banners, pills, alley screen, confetti

- **Banner** (copied from Buzzer Beater; kinds `'miss' | 'info' | 'good'`): used for
  `GUTTER BALL` + the statement and for `GAME OVER`.
- **Pill:** short white text on a dark rounded pill, 22 px bold. It fades in, holds and fades out
  over 1.6 s.
- **Alley screen:** a "monitor" card (dark navy with a 4 px glowing border) holding the title in
  44 px heavy yellow, plus a CSS emoji cartoon, all 1.8 s:

  | Call                    | Cartoon                                             |
  | ----------------------- | --------------------------------------------------- |
  | strike (1)              | 🎳 shakes, then 💥 bursts in over it                |
  | double (2)              | two 💥 bursts, one after the other                  |
  | turkey, 4–11 in a row   | 🦃 struts across from left to right                 |
  | perfect game            | 🏆 rises, with 🎉 either side                       |
  | spare / split picked up | a big "/" draws itself (stroke animation) beside 🎳 |
  | split                   | two 🎳 slide apart                                  |

- **Confetti** on every strike: 40 absolutely positioned DOM pieces (8 × 14 px, colours
  `#ff595e #ffca3a #8ac926 #1982c4 #6a4c93`), falling with a CSS animation over 1.8 s, then removed.
- `@media (prefers-reduced-motion: reduce)`: no confetti, no cartoon movement, no frame pulse.

### 7.3 Sounds (the shared change)

Add to `sfx` in `src/shared/audio.ts`, written like the others:

```ts
/** A bowling ball rumbling down the lane: low noise held for `seconds`, then fading. */
roll: (seconds: number) => play(...),
/** Pins crashing: a burst of short wooden clacks over a low thump. */
pins: () => play(...),
```

`roll`: white noise through a lowpass at 180 Hz, gain ramping 0.001 → 0.35 over 0.15 s, held, then
→ 0.001 over the last 0.3 s. `pins`: 14 bandpass noise clacks of 0.04–0.08 s, each at a random
1,800–3,600 Hz, spread over 0.35 s, plus `tone('sine', 180, 70, t, 0.25, 0.7)`. Also used: `tick`,
`bump`, `cheer`, `bigCheer`, `miss`.

### 7.4 Voice

`src/games/strike-zone/voice.ts`:

```ts
import { allCallLines, GAME_OVER_SPEECH, LAST_FRAME_SPEECH, NEW_HIGH_SCORE_SPEECH } from './rules';

export const VOICE_LINES: string[] = [
  ...allCallLines(),
  LAST_FRAME_SPEECH,
  GAME_OVER_SPEECH,
  NEW_HIGH_SCORE_SPEECH,
];
```

That gives 29 lines: Strike!, Double!, Turkey!, Four … Eleven strikes in a row!, A perfect game!,
Spare!, You picked up the split!, Split!, One pin. … Nine pins!, No pins that time., Gutter ball.,
Last frame!, Game over!, New high score!. Then run `npm run voice` and commit the clips and
`src/shared/voice-lines.json`.

### 7.5 Dev hooks (`dev.ts`, dev builds only)

They compile away in production (`import.meta.env.DEV`), as in Buzzer Beater.

- `?rolls=10,7,3,9,0` starts mid-game with those rolls, if `isValidRolls`. If the next ball is
  not on a fresh rack, rack only the first `standing` pins in id order.
- `?leave=7,10` starts at frame 1, ball 2, with only those pins standing (the first roll is
  10 − count). For checking spares and splits by eye.
- `?drift=max` forces every right answer to drift MAX_DRIFT (side still random); `?drift=0` forces
  no drift.
- `?friends=1` plays the reaction shot after every ball.

## 8. Files

| File                                                | Change                                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/games/strike-zone/game.json`                   | **New.** id, title, description, thumbnail, tags `["sports","3d"]`, scoring `score`         |
| `src/games/strike-zone/index.html`                  | **New.** Copy Penalty Kick's; `<title>Strike Zone</title>`                                  |
| `src/games/strike-zone/thumbnail.svg`               | **New.** 16:9: a lane in perspective, pins at the far end, a blue ball, a yellow arrow      |
| `src/games/strike-zone/style.css`                   | **New.** `sz-` HUD styles and media queries (section 6)                                     |
| `src/games/strike-zone/geometry.ts`                 | **New.** Pure (3.1)                                                                         |
| `src/games/strike-zone/aim.ts`                      | **New.** Pure (3.2)                                                                         |
| `src/games/strike-zone/rules.ts`                    | **New.** Pure (3.3–3.6)                                                                     |
| `src/games/strike-zone/physics.ts`                  | **New.** cannon-es only (5.3)                                                               |
| `src/games/strike-zone/alley.ts`                    | **New.** Lane, room, lights, aim drawings (5.1, 6.3)                                        |
| `src/games/strike-zone/pins.ts`                     | **New.** Pin meshes, racking and drop-in drawing (5.1, 5.2)                                 |
| `src/games/strike-zone/ball.ts`                     | **New.** Ball mesh and blob (5.1)                                                           |
| `src/games/strike-zone/person.ts`                   | **New.** Copied from Buzzer Beater                                                          |
| `src/games/strike-zone/bowler.ts`                   | **New.** Bowler moves (5.4) and the gutter ball script (5.5)                                |
| `src/games/strike-zone/friends.ts`                  | **New.** The three friends (5.7)                                                            |
| `src/games/strike-zone/views.ts`                    | **New.** `project`, `fitView`, `hudLayout`, the views (5.6)                                 |
| `src/games/strike-zone/hud.ts`                      | **New.** Scorecard, pin diagram, question, answers, banner, pill, screen, confetti, buttons |
| `src/games/strike-zone/dev.ts`                      | **New.** Dev hooks (7.5)                                                                    |
| `src/games/strike-zone/voice.ts`                    | **New.** (7.4)                                                                              |
| `src/games/strike-zone/main.ts`                     | **New.** The flow (section 4)                                                               |
| `src/shared/audio.ts`                               | `sfx.roll`, `sfx.pins` (7.3)                                                                |
| `tests/strike-zone.test.ts`                         | **New.** Rules, aim, splits, calls, lines (section 9)                                       |
| `tests/strike-zone-physics.test.ts`                 | **New.** Physics (section 9)                                                                |
| `public/voice/*.mp3`, `src/shared/voice-lines.json` | New clips from `npm run voice`                                                              |

game.json description: `"Aim, answer fast, and knock 'em down — quick answers roll right on target!"`.

## 9. Tests

`tests/strike-zone.test.ts` (pure, fast):

- **Scoring**, known games: 12 strikes → 300, `frameMarks` 10th `['X','X','X']`; 20 zeros → 0;
  21 rolls of 5 → 150; `[9,0]` × 10 → 90; `[10,7,3,9,0,10,0,8,8,2,0,6,10,10,10,8,1]` → 167
  (the classic example); a 10th of `[7,3,10]` adds 20 to the 9th frame's total; running totals are null
  after a strike until two more rolls exist.
- **position**: every row of the table in 3.3, including all four 10th-frame cases; `isValidRolls`
  rejects 11 pins, `[7,4]`, and rolls after the end.
- **Random games** (1,000, seeded with `seededRandom`): keep rolling `floor(r · (standing + 1))`
  until `position().over`. Check 11 ≤ balls ≤ 21, 0 ≤ total ≤ 300, running totals never fall, and
  `frameMarks` only uses `X / - 1–9` and ''.
- **isSplit**: every row of the table in 3.4.
- **callFor / callSpeech**: each kind; streaks 1, 2, 3, 4, 11, 12; split pickup; gutter wins over
  everything; `missed` only off a fresh rack. `allCallLines()` holds every line `callSpeech` can
  return for every call (enumerate them) and has no duplicates.
- **outcomeText**: the four shapes, singular and plural.
- **driftFor**: 0 below 1 s, `MAX_DRIFT` at the clock's end and past it, halfway at
  (1 + T) / 2 for T ∈ {5, 10, 15}, never decreasing, never above MAX_DRIFT; clock ≤ 1.
- **Aim** (1,000 random aims, drags and drifts): `clampAim` keeps `|lineX|` ≤ AIM_LIMIT at
  RELEASE_Z and DECK_BACK_Z; `moveBowler` keeps the slope unless it clamps; `swingArrow` keeps
  startX; `|thrownAim(a, d, s).headX − a.headX| ≤ MAX_DRIFT`; `throwPath` is a unit direction with
  dirZ < 0; `aimThrough(x, p)` passes through the pin's spot unless clamped.
- **Voice**: every `VOICE_LINES` entry is in `voice-lines.json` (the shared voice test covers
  this; just run it).

`tests/strike-zone-physics.test.ts` (cannon-es in Node; give these tests a 120 s timeout):

- **Pins stand still:** rack all 10, step 5 s with no ball → all 10 still standing.
- **The single-pin promise** (the owner's key requirement): for every pin, from
  startX ∈ {−AIM_LIMIT, −0.2, 0, 0.2, AIM_LIMIT}, with `aim = aimThrough(startX, pin)` and both drift
  sides at MAX_DRIFT, `simulateThrow([pin], throwPath(thrownAim(aim, MAX_DRIFT, side)))` leaves
  nothing standing (100 throws). If any fail, lower `MAX_DRIFT` in 0.01 steps (not below 0.08) until
  all pass, and report it. (With ball–pin friction 0 it ended at 0.10; 0.11 left the 10 grazed.)
- **Dead on:** the same 50 aims with no drift → the pin falls.
- **Full rack:** 9 aims (startX ∈ {−0.2, 0.1, 0.35} × headX ∈ {0.04, 0.07, 0.1}): each knocks down
  at least 3 pins, the standing pins are a subset of the rack, and the same throw twice gives the
  same pins. Log the number of strikes and put it in the PR (about 7 in 9 with friction 0).
- **Spare ball miss settles early:** rack `[7]`, throw down the right edge → 7 still standing, and
  `settled()` within SETTLE_MIN + 0.1 s of the ball reaching HEAD_Z.
- **Rails:** at the moment the rails end, the ball's x equals `lineX` within 1 mm.

Nothing becomes obsolete.

## 10. Definition of done

1. `npm run lint`, `npm run format`, `npm test` and `npm run build` all pass. Tests need Node 22
   (see `.nvmrc`).
2. Run it in headless Chromium at 390×844, 844×390, 1024×768 and 1366×1024, and check these from
   screenshots. Drive answers by reading the question and clicking the right button.
   - **Aim:** the bowler, the ball, the arrow, the dotted line and the ring, and all 10 pins with
     the masking panel above them, are clear of the scorecard, the pin diagram and the controls. At
     390×844 the 3D pin triangle is at least 60 px wide. The pin diagram's band moves when you drag
     (check before and after a drag in each zone, and after a nudge of each kind).
   - **Ask:** the question, the clock bar and the 4 answers, with the pins still in view above the
     answers.
   - **Roll:** the follow view part-way down the lane, then the pin cam during the crash.
   - **Result:** a count pill (e.g. `7 PINS`), and the scorecard updated.
   - **Strike:** the alley screen with `STRIKE!` and the confetti, then the friends cheering. Use
     `?leave=` or play until one happens; if none happens in a few tries, use `?rolls=` with nine
     frames played and keep trying in the 10th.
   - **Spare:** `?leave=7` → aim with the diagram band over the 7 → `SPARE!` and the friends.
   - **Split:** `?leave=7,10` shows a split on the diagram; also reach a real split call if one
     comes up.
   - **Gutter:** a wrong answer → the bowler slips, the ball is in the gutter, the `GUTTER BALL`
     banner with the statement, then the friends groaning.
   - **10th frame:** `?rolls=` with nine frames played → the `10TH FRAME` pill, a 3rd ball after a
     strike or spare, and the 3-box 10th frame filled in.
   - **Over and results:** the big scorecard and `GAME OVER`, then the results screen with the
     score, the high score, the outcome line and the stars.
   - **`?drift=max`** with `?leave=10`: a slow right answer aimed at the 10 still knocks it down.
3. Timing: from Bowl! to the next Aim, a right non-strike ball takes about 6–8 s plus the answer
   time. Taps fast-forward the roll and skip the result. After a skipped result nothing is left
   hanging (no stray speech, banner or camera move), and the next ball starts normally. Pause during
   Roll freezes the pins and resumes cleanly.
4. Commit in small steps in the repo's style, push, and open the PR.

## 11. Risks

- **Physics cost on old tablets:** a full rack is about 1 ms a step; 6 substeps a frame is the cap,
  so a slow device shows slow motion rather than dropping steps. If a step takes longer than
  2 ms in Chromium, lower `solver.iterations` to 12 and say so.
- **Pins jittering or creeping when asleep:** they start asleep; a ball contact wakes them. If a
  standing pin drifts between balls, it's respotted anyway (5.2).
- **The masking panel hiding pins** in some aspect: it's in the key-point fit only indirectly, so
  check by eye at every size and lower the panel's bottom edge to 1.1 if needed.
- **Strikes are not tuned for.** Ball–pin friction is 0 only because any friction launches the ball
  off the lane; the PR reports the full-rack test's strike count so the owner can decide later.
