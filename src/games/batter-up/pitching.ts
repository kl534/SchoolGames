/**
 * The bottom half of an inning: we pitch. The question is read while the pitcher stands set, then
 * the clock runs. A right answer is a pop fly, a ground out or a strike by how fast it came; a
 * wrong one (or none) is a hit for the rival. The plays are quick and simple, seen from behind
 * the mound.
 */
import { Vector3 } from 'three';
import { sfx, speak, stopSpeaking, unlockAudio } from '../../shared/audio';
import type { Fact } from '../../shared/topics';
import type { Ball, Batter, Catcher, Fielder, Pitcher, Prop, Umpire } from './characters';
import type { Effects } from './effects';
import {
  arcPosition,
  BALL_RADIUS,
  CONTACT,
  FIELD_SPEED,
  fieldAngle,
  fieldPoint,
  FIRST_BASE,
  GLOVE,
  GLOVE_TIME,
  GROUND_BALL_TIME,
  groundBallPosition,
  INFIELD_PLAYS,
  INFIELD_SPEED,
  MISS_POINT,
  pickChasers,
  planHit,
  POP_FLY_LIFT,
  POP_FLY_TIME,
  RUN_SPEED,
  THROW_TIME,
  wallRadius,
  ZIP_TIME,
  type HitPlan,
  type InfielderId,
  type Vec,
} from './flight';
import type { Hud } from './hud';
import {
  applyFieldOut,
  applyHit,
  applyStrike,
  cpuHitFor,
  cpuHitSpeech,
  GROUND_OUT_SPEECH,
  hitWord,
  pitchOutcomeFor,
  pitchStrikeCall,
  POP_OUT_SPEECH,
  type GameState,
  type Hit,
  type Move,
} from './rules';
import { rivalHitTitle, type Team } from './teams';

/** Seconds a result stays up before a tap can skip to the next pitch. */
export const SKIP_AFTER = 0.6;
/** Least seconds the correct fact stays up after a miss. */
export const REVEAL_FOR = 2.4;
/** Seconds the call on a good pitch stays up. */
const CALL_FOR = 1.0;
/** The rival's runners run this many times as fast as ours, so the half moves along. */
const RIVAL_RUN_BOOST = 2;
/** The rival's hits fly this many times as fast as the ones we hit. */
const PLAY_SPEED = 1.5;
/** The shortest a rival's hit plays for, and when a tap can skip the rest of it. */
const HIT_FOR = 2;
/** How often the rival swings and misses a strike, rather than letting it go by. */
const SWING_AND_MISS = 0.4;
const INFIELDERS: InfielderId[] = ['SS', '2B', '3B'];

/** What the rival's at-bat comes to on this pitch. */
type Call =
  { kind: 'strike' } | { kind: 'popout' } | { kind: 'groundout' } | { kind: 'hit'; hit: Hit };

/** What the pitching needs from the game: the people and the ball, and the game's own state. */
export interface PitchingHost {
  hud: Hud;
  pitcher: Pitcher;
  catcher: Catcher;
  umpire: Umpire;
  ball: Ball;
  effects: Effects;
  fielders: Fielder[];
  /** What the scorebug shows; it lags the real state while a play is still happening. */
  shown: { runs: number; strikes: number; outs: number };
  rival(): Team;
  /** The rival's batter at the plate. */
  batter(): Batter;
  state(): GameState;
  /** Takes a new state (and saves the progress it makes). */
  commit(next: GameState): void;
  /** Puts the next question up and returns it, with the seconds its clock runs. */
  ask(): { fact: Fact; options: string[]; seconds: number };
  /** Records an answer with the feed and the session. */
  answered(fact: Fact, correct: boolean): void;
  /** Sends the batter and the runners round the bases; returns the seconds that takes. */
  runBases(moves: Move[], runs: number, speed: number): number;
  /** Puts anybody still running where they were going. */
  settleRunners(): void;
  /** The batter at the plate walks off. */
  sendOff(): void;
  addProp(prop: Prop): void;
  putBall(p: Vec): void;
  toScreen(world: Vec): { x: number; y: number };
  refresh(): void;
  /** Game time, in seconds. */
  now(): number;
  after(seconds: number, fn: () => void): void;
  clearTimers(): void;
  /** The play is over; `batterGone` says the next batter must step up. */
  playOver(batterGone: boolean): void;
}

export interface Pitching {
  /** The next pitch: the question and the pitcher set. */
  begin(): void;
  update(delta: number): void;
  /** An answer button (or key): answers the question, or skips ahead during a result. */
  press(index: number): void;
  /** The hear button: reads the question again, or the fact during a call. */
  hear(): void;
  /** A tap on the field: skips ahead during a result. */
  skip(): void;
  /** Forgets the pitch in hand, for a new game. */
  reset(): void;
}

interface Leg {
  to: Vec;
  seconds: number;
  /** How far the ball rises above the straight line; a ground ball hops instead. */
  lift?: number;
  ground?: boolean;
  onEnd?: () => void;
}

export function createPitching(host: PitchingHost): Pitching {
  const { hud, pitcher, catcher, umpire, ball, effects, fielders, shown } = host;
  type Phase = 'idle' | 'set' | 'live' | 'delivery' | 'play';
  let phase: Phase = 'idle';
  /** Ticks up for each pitch, so late callbacks can tell they are stale. */
  let turn = 0;
  let fact: Fact | undefined;
  let options: string[] = [];
  let chosen = -1;
  let total = 10;
  let elapsed = 0;
  let lastTick = 0;
  let speechToken = 0;
  /** Replays of the fact the player asked for during a call; the next pitch waits for them. */
  let replaying = 0;
  let resultAt = 0;
  let resultDone: (() => void) | null = null;
  let ending: (() => void) | null = null;

  const handPoint = new Vector3();
  const here: Vec = { ...GLOVE };
  const scratch: Vec = { x: 0, y: 0, z: 0 };
  let flight: { from: Vec; legs: Leg[]; t: number } | null = null;
  let plan: HitPlan | null = null;
  let planT = 0;
  let landed = false;
  let held: Fielder | null = null;

  const put = (p: Vec) => {
    here.x = p.x;
    here.y = p.y;
    here.z = p.z;
    host.putBall(p);
  };

  const fly = (legs: Leg[], from: Vec = here) => {
    flight = { from: { ...from }, legs, t: 0 };
  };

  // ---------- The question ----------
  const readQuestion = () => {
    if (!fact) return;
    const token = ++speechToken;
    const thisTurn = turn;
    speak(fact.spokenPrompt ?? fact.prompt, () => {
      if (token !== speechToken || turn !== thisTurn || phase !== 'set') return;
      // The clock starts once the question has been read.
      phase = 'live';
      elapsed = 0;
      lastTick = Math.ceil(total);
    });
  };

  const begin = () => {
    host.clearTimers();
    stopSpeaking();
    hud.hideBanner();
    turn++;
    ({ fact, options, seconds: total } = host.ask());
    chosen = -1;
    elapsed = 0;
    replaying = 0;
    resultDone = null;
    ending = null;
    flight = null;
    plan = null;
    held = null;
    hud.setClock(1);
    hud.hideQuestion(false);
    ball.setVisible(false);
    ball.setGlow(false);
    umpire.reset();
    host.batter().ready();
    pitcher.reset();
    phase = 'set';
    readQuestion();
  };

  // ---------- Answering ----------
  const press = (index: number) => {
    if (phase !== 'set' && phase !== 'live') {
      skip();
      return;
    }
    if (!fact || options[index] === undefined) return;
    try {
      unlockAudio();
      stopSpeaking();
    } catch {
      // Audio trouble must never stop the pitch.
    }
    speechToken++;
    // An answer before the clock has started counts as no time used at all.
    const used = phase === 'live' ? elapsed : 0;
    const correct = options[index] === fact.answer;
    chosen = index;
    hud.lock();
    hud.buttons[index].classList.add('chosen');
    host.answered(fact, correct);
    deliver(correct ? { kind: pitchOutcomeFor(used) } : rivalHit());
  };

  const rivalHit = (): Call => ({ kind: 'hit', hit: cpuHitFor(Math.random()) });

  /** The clock ran out: the pitch is a gift. */
  const timeUp = () => {
    if (!fact) return;
    chosen = -1;
    hud.lock();
    hud.setClock(0);
    host.answered(fact, false);
    deliver(rivalHit());
  };

  /** The pitcher throws, and the ball zips to the plate. */
  const deliver = (call: Call) => {
    phase = 'delivery';
    const thisTurn = turn;
    pitcher.release(() => {
      if (turn !== thisTurn || phase !== 'delivery') return;
      pitcher.handPosition(handPoint);
      put(handPoint);
      ball.setVisible(true);
      ball.setGlow(false);
      sfx.whoosh();
      const batter = host.batter();
      const swings = call.kind !== 'strike' || Math.random() < SWING_AND_MISS;
      if (swings) batter.swing();
      if (call.kind === 'strike') {
        // Past the bat, or past a batter who lets it go.
        const legs: Leg[] = swings
          ? [
              { to: MISS_POINT, seconds: ZIP_TIME },
              { to: GLOVE, seconds: GLOVE_TIME },
            ]
          : [{ to: GLOVE, seconds: ZIP_TIME + GLOVE_TIME }];
        legs[legs.length - 1].onEnd = () => strike();
        fly(legs);
      } else {
        fly([{ to: CONTACT, seconds: ZIP_TIME, onEnd: () => contact(call) }]);
      }
    });
  };

  // ---------- Results ----------
  /**
   * A call is up: it is over when the play, the speech and the time to read it are all done.
   * `mark` says each is; a tap (or all three) ends it.
   */
  const startResult = (batterGone: boolean) => {
    phase = 'play';
    resultAt = host.now();
    const thisTurn = turn;
    const flags = { play: false, speech: false, hold: false };
    const check = () => {
      if (
        turn === thisTurn &&
        phase === 'play' &&
        !replaying &&
        Object.values(flags).every(Boolean)
      ) {
        finish(batterGone);
      }
    };
    resultDone = check;
    ending = () => finish(batterGone);
    return (what: keyof typeof flags) => {
      flags[what] = true;
      check();
    };
  };

  /** The call is made: on to the next pitch, or the next batter. */
  const finish = (batterGone: boolean) => {
    if (phase !== 'play') return;
    phase = 'idle';
    stopSpeaking();
    host.clearTimers();
    hud.hideBanner();
    flight = null;
    plan = null;
    held = null;
    resultDone = null;
    ending = null;
    ball.setVisible(false);
    ball.setGlow(false);
    umpire.reset();
    shown.outs = host.state().outs;
    host.settleRunners();
    fielders.forEach((f) => f.goHome(7));
    if (batterGone) host.sendOff();
    host.playOver(batterGone);
  };

  /** Where a call shows on the picture, above the plate. */
  const callAt = () => host.toScreen({ x: 0, y: 2.6, z: 0.05 });

  /** A good pitch: the call pops up over the plate and is said; the right answer lights up. */
  const callGood = (
    text: string,
    spoken: string,
    mark: (what: 'play' | 'speech' | 'hold') => void,
  ) => {
    hud.markHit(chosen);
    const at = callAt();
    hud.pop(text, at.x, at.y, 'good');
    speak(spoken, () => mark('speech'));
    host.after(CALL_FOR, () => mark('hold'));
  };

  /** The ball is in the catcher's mitt and the umpire makes the call. */
  const strike = () => {
    if (!fact) return;
    put(GLOVE);
    sfx.glove();
    catcher.pop();
    effects.pop(GLOVE);
    const before = host.state();
    const outcome = applyStrike(before);
    host.commit(outcome.state);
    const call = pitchStrikeCall(before.strikes + 1);
    shown.strikes = call.out ? 3 : outcome.state.strikes;
    shown.outs = outcome.state.outs;
    host.refresh();
    umpire.callStrike(call.out);
    if (call.out) host.batter().slump();
    const mark = startResult(call.out);
    callGood(call.title, call.spoken, mark);
    mark('play');
  };

  /** The bat meets the ball. */
  const contact = (call: Call) => {
    if (call.kind === 'strike') return;
    sfx.bat();
    effects.crack(CONTACT);
    const batter = host.batter();
    const dropped = batter.dropBat();
    if (dropped) host.addProp(dropped);
    if (call.kind === 'hit') rivalHits(call.hit);
    else if (call.kind === 'popout') popOut();
    else groundOut();
  };

  /** A wrong answer: the rival hits it. The right answer and why are shown. */
  const rivalHits = (hit: Hit) => {
    if (!fact) return;
    const current = fact;
    const outcome = applyHit(host.state(), hit);
    host.commit(outcome.state);
    host.refresh();
    hud.mark(chosen, options.indexOf(current.answer), false);
    hud.showBanner(rivalHitTitle(host.rival(), hitWord(hit)), current.statement, 'miss', 'aside');
    sfx.miss();
    const mark = startResult(true);
    // The hit is called, then the fact is read out, and shown for a while.
    const thisTurn = turn;
    speak(cpuHitSpeech(hit), () => {
      if (turn !== thisTurn || phase !== 'play') return;
      speak(current.spokenStatement ?? current.statement, () => mark('speech'));
    });
    host.after(REVEAL_FOR, () => mark('hold'));

    // The ball flies off towards the field (and the camera); one fielder jogs after it.
    plan = planHit(hit, Math.random() < 0.5 ? -1 : 1, Math.random(), Math.random());
    planT = 0;
    landed = false;
    const target =
      hit === 'homer'
        ? fieldPoint(fieldAngle(plan.landing), wallRadius(fieldAngle(plan.landing)) - 1.8)
        : plan.stop;
    const candidates = fielders.map((f) => ({
      f,
      x: f.mover.person.root.position.x,
      z: f.mover.person.root.position.z,
    }));
    const [near] = pickChasers(candidates, plan.landing, 1);
    near?.f.chase({ ...target }, FIELD_SPEED, hit === 'homer' ? 'watch' : 'scoop');
    const runTime = host.runBases(outcome.moves, outcome.runs, RUN_SPEED * RIVAL_RUN_BOOST);
    const play = Math.max(plan.duration / PLAY_SPEED + 0.3, runTime + 0.4, HIT_FOR);
    host.after(play, () => mark('play'));
  };

  /** A fielder is the one to make the play. */
  const pickInfielder = (): { id: InfielderId; fielder: Fielder } => {
    const id = INFIELDERS[Math.floor(Math.random() * INFIELDERS.length)];
    return { id, fielder: fielders.find((f) => f.id === id)! };
  };

  /** The batter starts for first, and is stopped short when the out is made. */
  const runToFirst = () => {
    const batter = host.batter();
    host.after(0.15, () => {
      batter.runnerStance();
      batter.mover.runTo([FIRST_BASE], RUN_SPEED * 0.85);
    });
  };

  /** The out is made: the call, the scorebug, and the batter pulls up, beaten. */
  const outMade = (mark: (what: 'play' | 'speech' | 'hold') => void, spoken: string) => {
    shown.outs = host.state().outs;
    host.refresh();
    const batter = host.batter();
    batter.mover.halt();
    batter.slump();
    callGood('Out!', spoken, mark);
    mark('play');
  };

  /** Under 25% of the clock: a high pop-up that an infielder settles under and catches. */
  const popOut = () => {
    host.commit(applyFieldOut(host.state()).state);
    hud.markHit(chosen);
    const { id, fielder } = pickInfielder();
    const spot = INFIELD_PLAYS[id].pop;
    const catchAt: Vec = { x: spot.x, y: 1.5, z: spot.z };
    fielder.chase({ ...spot }, INFIELD_SPEED, 'ready');
    const mark = startResult(true);
    runToFirst();
    fly(
      [
        {
          to: catchAt,
          seconds: POP_FLY_TIME,
          lift: POP_FLY_LIFT,
          onEnd: () => {
            held = fielder;
            sfx.glove();
            outMade(mark, POP_OUT_SPEECH);
          },
        },
      ],
      CONTACT,
    );
  };

  /** Under 50%: a grounder to an infielder, who throws to first. */
  const groundOut = () => {
    host.commit(applyFieldOut(host.state()).state);
    hud.markHit(chosen);
    const { id, fielder } = pickInfielder();
    const spot = INFIELD_PLAYS[id].ground;
    fielder.chase({ ...spot }, INFIELD_SPEED, 'scoop');
    const mark = startResult(true);
    runToFirst();
    fly(
      [
        {
          to: { x: spot.x, y: BALL_RADIUS, z: spot.z },
          seconds: GROUND_BALL_TIME,
          ground: true,
          onEnd: () => {
            held = fielder;
            sfx.glove();
            fielder.mover.face(FIRST_BASE);
            host.after(0.15, () => {
              fielder.mover.person.handWorld('L', handPoint);
              held = null;
              fly(
                [
                  {
                    to: { x: FIRST_BASE.x, y: 1.2, z: FIRST_BASE.z },
                    seconds: THROW_TIME,
                    lift: 0.8,
                    onEnd: () => {
                      sfx.glove();
                      outMade(mark, GROUND_OUT_SPEECH);
                    },
                  },
                ],
                handPoint,
              );
            });
          },
        },
      ],
      CONTACT,
    );
  };

  // ---------- Frame ----------
  const update = (delta: number) => {
    if (phase === 'live') {
      elapsed += delta;
      const u = elapsed / total;
      hud.setClock(1 - u);
      const seconds = Math.ceil(total - elapsed);
      if (seconds < lastTick && seconds > 0 && seconds <= 3) sfx.tick();
      lastTick = seconds;
      if (elapsed >= total) timeUp();
    }
    if (flight) {
      const leg = flight.legs[0];
      if (!leg) {
        flight = null;
      } else {
        flight.t += delta;
        const s = flight.t / leg.seconds;
        if (leg.ground) groundBallPosition(flight.from, leg.to, s, scratch);
        else arcPosition(flight.from, leg.to, s, leg.lift ?? 0, scratch);
        put(scratch);
        ball.spin(delta, 30);
        effects.trail(here);
        if (s >= 1) {
          flight.legs.shift();
          flight.from = { ...leg.to };
          flight.t = 0;
          if (!flight.legs.length) flight = null;
          leg.onEnd?.();
        }
      }
    }
    if (held) {
      held.mover.person.handWorld('L', handPoint);
      put({ x: handPoint.x, y: handPoint.y + 0.05, z: handPoint.z });
    }
    if (plan) {
      planT += delta * PLAY_SPEED;
      const gone = plan.overWall && planT > plan.airTime;
      if (gone) {
        ball.setVisible(false);
      } else {
        put(plan.position(planT, scratch));
        ball.spin(delta, 18);
        ball.setGlow(true);
        if (planT < plan.airTime) effects.trail(here);
      }
      if (!landed && planT >= plan.airTime) {
        landed = true;
        if (!plan.overWall) effects.dust({ x: plan.landing.x, y: 0.1, z: plan.landing.z }, 7);
      }
    }
  };

  // ---------- Input ----------
  const skip = () => {
    if (phase === 'play' && host.now() - resultAt >= SKIP_AFTER) ending?.();
  };

  const hear = () => {
    if (!fact) return;
    const current = fact;
    const thisTurn = turn;
    if (phase === 'play' && hud.callInPanel()) {
      // The call has taken the question's place: the button says the fact again.
      replaying++;
      speechToken++;
      speak(current.spokenStatement ?? current.statement, () => {
        replaying--;
        if (turn === thisTurn) resultDone?.();
      });
    } else if (phase === 'set') {
      readQuestion();
    } else if (phase === 'live') {
      speak(current.spokenPrompt ?? current.prompt);
    }
  };

  const reset = () => {
    turn++;
    speechToken++;
    phase = 'idle';
    flight = null;
    plan = null;
    held = null;
    resultDone = null;
    ending = null;
    replaying = 0;
  };

  return { begin, update, press, hear, skip, reset };
}
