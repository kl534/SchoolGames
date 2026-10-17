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
import { planBatted, type BattedBall } from './batted';
import { forcedPlay } from './dev';
import {
  arcPosition,
  BASE_SPOTS,
  CONTACT,
  FIELD_SPEED,
  fieldPoint,
  FIRST_BASE,
  GLOVE,
  GLOVE_TIME,
  groundBallPosition,
  INFIELD_SPEED,
  MISS_POINT,
  pickChasers,
  POSITION_SPOTS,
  RUN_SPEED,
  THROW_TIME,
  wallRadius,
  ZIP_TIME,
  type Vec,
} from './flight';
import type { Hud } from './hud';
import {
  applyHit,
  applyOut,
  applyStrike,
  cpuHitFor,
  cpuHitSpeech,
  hitKindWord,
  hitOfKind,
  outPopText,
  outSpeech,
  pickHitKind,
  pickOut,
  pitchOutcomeFor,
  pitchStrikeCall,
  type GameState,
  type Hit,
  type HitKind,
  type Move,
  type OutCall,
  type OutKind,
  type Position,
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

/** What the rival's at-bat comes to on this pitch. */
type Call =
  | { kind: 'strike' }
  | { kind: 'popout'; seconds: number; forced?: OutKind }
  | { kind: 'groundout'; seconds: number; forced?: OutKind }
  | { kind: 'hit'; hit: Hit; forced?: HitKind };

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
  runBases(moves: Move[], runs: number, speed: number, retired?: number[]): number;
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
  let plan: BattedBall | null = null;
  let planT = 0;
  /** How fast the path plays, and what happens when it ends (an out is made, or a ball caught). */
  let planSpeed = 1;
  let planEnded: (() => void) | null = null;
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
    planEnded = null;
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
    deliver(correct ? goodPitch(used) : rivalHit());
  };

  /** A right answer: an out by how fast it came, or the kind of out the dev address forces. */
  const goodPitch = (used: number): Call => {
    const forced = forcedPlay().out;
    if (forced) {
      const air = ['pop', 'foul-pop', 'fly', 'liner', 'diving'].includes(forced);
      return { kind: air ? 'popout' : 'groundout', seconds: used, forced };
    }
    return { kind: pitchOutcomeFor(used), seconds: used } as Call;
  };

  const rivalHit = (): Call => {
    const forced = forcedPlay().hit;
    return { kind: 'hit', hit: forced ? hitOfKind(forced) : cpuHitFor(Math.random()), forced };
  };

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
  const startResult = (batterGone: boolean, sendOff = batterGone) => {
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
        finish(batterGone, sendOff);
      }
    };
    resultDone = check;
    ending = () => finish(batterGone, sendOff);
    return (what: keyof typeof flags) => {
      flags[what] = true;
      check();
    };
  };

  /** The call is made: on to the next pitch, or the next batter. */
  const finish = (batterGone: boolean, sendOff: boolean) => {
    if (phase !== 'play') return;
    phase = 'idle';
    stopSpeaking();
    host.clearTimers();
    hud.hideBanner();
    flight = null;
    plan = null;
    planEnded = null;
    held = null;
    resultDone = null;
    ending = null;
    ball.setVisible(false);
    ball.setGlow(false);
    umpire.reset();
    shown.outs = host.state().outs;
    host.settleRunners();
    fielders.forEach((f) => f.goHome(7));
    if (sendOff) host.sendOff();
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
    if (call.kind === 'hit') rivalHits(call);
    else outPlay(call);
  };

  const rolls = () => ({ side: Math.random(), a: Math.random(), b: Math.random() });

  /** A wrong answer: the rival hits it. The right answer and why are shown. */
  const rivalHits = (call: Extract<Call, { kind: 'hit' }>) => {
    if (!fact) return;
    const current = fact;
    const kind = call.forced ?? pickHitKind(call.hit, Math.random());
    const hit = hitOfKind(kind);
    plan = planBatted(kind, rolls());
    const outcome = applyHit(host.state(), hit, { kind, zone: plan.zone });
    host.commit(outcome.state);
    host.refresh();
    hud.mark(chosen, options.indexOf(current.answer), false);
    hud.showBanner(
      rivalHitTitle(host.rival(), hitKindWord(kind)),
      current.statement,
      'miss',
      'aside',
    );
    sfx.miss();
    const mark = startResult(true, false);
    // The hit is called, then the fact is read out, and shown for a while.
    const thisTurn = turn;
    speak(cpuHitSpeech(hit), () => {
      if (turn !== thisTurn || phase !== 'play') return;
      speak(current.spokenStatement ?? current.statement, () => mark('speech'));
    });
    host.after(REVEAL_FOR, () => mark('hold'));

    // The ball flies off towards the field (and the camera); one fielder jogs after it.
    planT = 0;
    planSpeed = PLAY_SPEED;
    planEnded = null;
    landed = false;
    const deep = plan.theta;
    const target = hit === 'homer' ? fieldPoint(deep, wallRadius(deep) - 1.8) : plan.rest;
    const candidates = fielders.map((f) => ({
      f,
      x: f.mover.person.root.position.x,
      z: f.mover.person.root.position.z,
    }));
    const [near] = pickChasers(candidates, plan.firstTouch.p, 1);
    near?.f.chase({ ...target }, FIELD_SPEED, hit === 'homer' ? 'watch' : 'scoop');
    const runTime = host.runBases(outcome.moves, outcome.runs, RUN_SPEED * RIVAL_RUN_BOOST);
    const play = Math.max(plan.end / PLAY_SPEED + 0.3, runTime + 0.4, HIT_FOR);
    host.after(play, () => mark('play'));
  };

  /** The fielder who plays a ball; the pitcher and catcher stand in for by an infielder here. */
  const fielderFor = (position: Position, ball: BattedBall): Fielder => {
    const id =
      position === 'P' ? 'SS' : position === 'C' ? (ball.rest.x < 0 ? '3B' : '1B') : position;
    return fielders.find((f) => f.id === id)!;
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
  const outMade = (
    mark: (what: 'play' | 'speech' | 'hold') => void,
    text: string,
    spoken: string,
    batterOut: boolean,
  ) => {
    shown.outs = host.state().outs;
    host.refresh();
    if (batterOut) {
      const batter = host.batter();
      batter.mover.halt();
      batter.slump();
    }
    callGood(text, spoken, mark);
    mark('play');
  };

  /** A forced kind of out, or one the rules pick for this answer. */
  const chooseOut = (call: Extract<Call, { kind: 'popout' | 'groundout' }>): OutCall => {
    const outcome = call.kind;
    for (let i = 0; i < 400; i++) {
      const pick = pickOut(outcome, call.seconds, host.state(), Math.random);
      if (!call.forced || pick.kind === call.forced) return pick;
    }
    // Not possible in this game state (a double play with nobody on): make one up.
    const kind = call.forced ?? 'ground';
    const chain = kind === 'double-play' ? '6-4-3' : kind === 'force-second' ? '6-4' : '6-3';
    const air = kind === 'fly' || kind === 'diving';
    const fielder: Position = kind === 'foul-pop' ? 'C' : air ? 'CF' : 'SS';
    return { kind, fielder, zone: air ? 'CF' : 'LC', chain };
  };

  /** A right answer in time: the rival's batter is out, one way or another. */
  const outPlay = (call: Extract<Call, { kind: 'popout' | 'groundout' }>) => {
    const picked = chooseOut(call);
    const path = planBatted(picked.kind, rolls(), POSITION_SPOTS[picked.fielder]);
    // Where the ball really comes down is the zone that counts for the runners.
    const out: OutCall = { ...picked, zone: path.zone };
    const result = applyOut(host.state(), out);
    host.commit(result.state);
    hud.markHit(chosen);
    const fielder = fielderFor(out.fielder, path);
    const spoken = outSpeech(out, result.sacFly);
    const text = outPopText(out, result.sacFly);
    const batterOut = result.retired.includes(0);
    const mark = startResult(true, batterOut);
    const sendRunners = () => {
      if (result.moves.length || result.retired.some((r) => r > 0)) {
        host.runBases(result.moves, result.runs, RUN_SPEED * RIVAL_RUN_BOOST, result.retired);
      }
    };
    plan = path;
    planT = 0;
    planSpeed = 1;
    landed = true;
    if (batterOut) runToFirst();
    const air = path.firstTouch.what === 'air-catch';
    if (air) {
      const under = path.firstTouch.p;
      fielder.chase({ x: under.x, y: 0, z: under.z }, INFIELD_SPEED, 'ready');
      planEnded = () => {
        held = fielder;
        sfx.glove();
        sendRunners();
        outMade(mark, text, spoken, batterOut);
      };
      return;
    }
    // A grounder: the fielder gets to it, and throws to first (or to second on a force).
    fielder.chase({ ...path.rest }, INFIELD_SPEED, 'scoop');
    sendRunners();
    const base = out.kind === 'force-second' ? BASE_SPOTS[2] : FIRST_BASE;
    planEnded = () => {
      held = fielder;
      sfx.glove();
      fielder.mover.face(base);
      host.after(0.15, () => {
        fielder.mover.person.handWorld('L', handPoint);
        held = null;
        fly(
          [
            {
              to: { x: base.x, y: 1.2, z: base.z },
              seconds: THROW_TIME,
              lift: 0.8,
              onEnd: () => {
                sfx.glove();
                outMade(mark, text, spoken, batterOut);
              },
            },
          ],
          handPoint,
        );
      });
    };
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
      planT += delta * planSpeed;
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
        if (!plan.overWall) {
          effects.dust({ x: plan.firstTouch.p.x, y: 0.1, z: plan.firstTouch.p.z }, 7);
        }
      }
      if (planEnded && planT >= plan.end) {
        const done = planEnded;
        planEnded = null;
        plan = null;
        ball.setGlow(false);
        done();
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
    planEnded = null;
    held = null;
    resultDone = null;
    ending = null;
    replaying = 0;
  };

  return { begin, update, press, hear, skip, reset };
}
