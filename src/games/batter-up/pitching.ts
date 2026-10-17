/**
 * The bottom half of an inning: we pitch. The question is read while the pitcher stands set, then
 * the clock runs. A right answer is a pop fly, a ground out or a strike by how fast it came; a
 * wrong one (or none) is a hit for the rival. A ball in play is a planned play on the field, seen
 * from a camera that swoops up to a high wide shot behind the plate.
 */
import { Vector3 } from 'three';
import { sfx, speak, stopSpeaking, unlockAudio } from '../../shared/audio';
import type { Fact } from '../../shared/topics';
import type { Ball, Batter, Catcher, Pitcher, Prop, Umpire } from './characters';
import type { Effects } from './effects';
import { planBatted, type BattedBall } from './batted';
import { planPlay, type PlayEvent, type PlayScript } from './choreo';
import { forcedPlay } from './dev';
import { CONTACT, GLOVE, GLOVE_TIME, MISS_POINT, ZIP_TIME, arcPosition, type Vec } from './flight';
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
  /**
   * Starts a play on the field (the camera swoops up to watch it). `extra` hears every event of
   * it; `onEnd` runs when it is done.
   */
  startPlay(
    script: PlayScript,
    batted: BattedBall,
    moves: Move[],
    retired: number[],
    extra: ((e: PlayEvent) => void) | undefined,
    onEnd: () => void,
  ): void;
  /** Settles a play that is over (or skipped): everybody to where they finish, camera back. */
  endPlay(): void;
  /** The pitcher lets go: runners edge off their bags. */
  pitchReleased(): void;
  /** The pitch was not put in play: runners are back at their leads. */
  resetLeads(): void;
  /** Where every fielder stands and where each runner stands now. */
  snapshot(): { spots: Record<Position, Vec>; leads: (Vec | null)[] };
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
  const { hud, pitcher, catcher, umpire, ball, effects, shown } = host;
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
  /** A play on the field is running (so it must be settled when the result is over). */
  let played = false;

  const handPoint = new Vector3();
  const here: Vec = { ...GLOVE };
  const scratch: Vec = { x: 0, y: 0, z: 0 };
  let flight: { from: Vec; legs: Leg[]; t: number } | null = null;

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
    played = false;
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
      host.pitchReleased();
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
    resultDone = null;
    ending = null;
    ball.setVisible(false);
    ball.setGlow(false);
    umpire.reset();
    shown.outs = host.state().outs;
    if (played) host.endPlay();
    played = false;
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
    host.resetLeads();
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
    const path = planBatted(kind, rolls());
    const before = host.state();
    const outcome = applyHit(before, hit, { kind, zone: path.zone });
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
    const { spots, leads } = host.snapshot();
    const script = planPlay({
      ball: path,
      moves: outcome.moves,
      retired: [],
      bases: before.bases,
      outs: before.outs,
      call: kind,
      spots,
      leads,
      runs: outcome.runs,
    });
    played = true;
    host.startPlay(script, path, outcome.moves, [], undefined, () => mark('play'));
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
    const { spots, leads } = host.snapshot();
    const path = planBatted(picked.kind, rolls(), spots[picked.fielder]);
    // Where the ball really comes down is the zone that counts for the runners.
    const out: OutCall = { ...picked, zone: path.zone };
    const before = host.state();
    const result = applyOut(before, out);
    host.commit(result.state);
    hud.markHit(chosen);
    const spoken = outSpeech(out, result.sacFly);
    const text = outPopText(out, result.sacFly);
    const batterOut = result.retired.includes(0);
    // The batter who is out leaves by himself (the play sends him off); a forced one runs on.
    const mark = startResult(true, false);
    const script = planPlay({
      ball: path,
      moves: result.moves,
      retired: result.retired,
      bases: before.bases,
      outs: before.outs,
      call: out,
      spots,
      leads,
      runs: result.runs,
    });
    let called = false;
    const outsInPlay = result.retired.length;
    let seen = 0;
    played = true;
    void batterOut;
    host.startPlay(
      script,
      path,
      result.moves,
      result.retired,
      (e) => {
        if (e.type !== 'out') return;
        seen++;
        // The call comes with the last out of the play: "Double play!" after both.
        if (seen >= outsInPlay && !called) {
          called = true;
          callGood(text, spoken, mark);
        }
      },
      () => mark('play'),
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
        arcPosition(flight.from, leg.to, s, leg.lift ?? 0, scratch);
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
    played = false;
    resultDone = null;
    ending = null;
    replaying = 0;
  };

  return { begin, update, press, hear, skip, reset };
}
