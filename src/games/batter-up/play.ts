/**
 * Runs a planned play on the real people: the fielders act, the runners run the bases and the ball
 * goes where the script puts it. Both halves of the game use it.
 */
import { Vector3 } from 'three';
import type { Actor, Batter } from './characters';
import type { FielderAction, PlayEvent, PlayScript, RunnerScript } from './choreo';
import { POSITIONS as POSITIONS_ALL } from './defense';
import { arcPosition, groundBallPosition, type Vec } from './flight';
import type { Position } from './rules';

export type BallKind = 'batted' | 'held' | 'throw' | 'roll';

export interface PlayHost {
  actor(position: Position): Actor;
  /** The figure for the runner who started on a base (0 is the batter at the plate). */
  runner(from: number): Batter | null;
  /** Puts the ball somewhere: a batted ball and a throw are drawn so they can be followed. */
  ball(p: Vec, kind: BallKind, delta: number): void;
  hideBall(): void;
  /** A runner has scored and finished celebrating; take the figure away. */
  scored(from: number): void;
  /** A runner (or the batter) is out and leaves the field. */
  retired(from: number): void;
  /** The catcher takes his mask off and throws it. */
  maskOff?(): void;
}

export interface PlayRunner {
  start(script: PlayScript, onEvent: (e: PlayEvent) => void, onEnd: () => void): void;
  /** Game time in seconds, so pausing freezes it. */
  update(delta: number): void;
  /** Everyone to where they finish, the ball away, events not yet fired firing now in order. */
  settle(): void;
  readonly active: boolean;
  readonly time: number;
  ballPosition(out: Vec): Vec;
}

const scratch = new Vector3();
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);

export function createPlayRunner(host: PlayHost): PlayRunner {
  let script: PlayScript | null = null;
  let onEvent: (e: PlayEvent) => void = () => {};
  let onEnd: () => void = () => {};
  let time = 0;
  let nextEvent = 0;
  let nextAction: Record<string, number> = {};
  let nextRunner = 0;
  let timers: { at: number; fn: () => void }[] = [];
  /** Runners waiting on a bag (or halfway) until it is time to go. */
  let waiting: { until: number; go: () => void }[] = [];
  const ballAt: Vec = { x: 0, y: 0, z: 0 };
  let started: { script: RunnerScript; batter: Batter; sliding: boolean }[] = [];
  let actions: Record<string, FielderAction[]> = {};

  const later = (at: number, fn: () => void) => timers.push({ at, fn });

  const startRunner = (r: RunnerScript) => {
    const figure = host.runner(r.from);
    if (!figure) return;
    const entry = { script: r, batter: figure, sliding: false };
    started.push(entry);
    const finished = () => {
      if (r.finish === 'score') {
        later(time + (r.slides ? 0.45 : 0), () => figure.cheer());
        later(time + (r.slides ? 0.45 : 0) + 0.7, () => host.scored(r.from));
      } else if (r.finish === 'out') {
        figure.slump();
        later(time + 0.5, () => host.retired(r.from));
      } else if (r.finish === 'slide') {
        later(time + 0.5, () => figure.runnerStance());
      } else {
        figure.runnerStance();
        figure.mover.face({ x: 0, y: 0, z: -8 });
      }
    };
    const go = () => {
      figure.runnerStance();
      figure.mover.runTo(r.route, r.speed, finished, r.slides ? { slowEnd: 2.5 } : undefined);
    };
    figure.runnerStance();
    if (r.holdAt) {
      const hold = r.holdAt;
      figure.mover.runTo([hold.p], r.speed, () => {
        figure.lead();
        waiting.push({ until: hold.until, go });
      });
    } else {
      go();
    }
  };

  const placeBall = (delta: number) => {
    if (!script) return;
    const leg = script.legs.find((l) => time >= l.start && time <= l.end) ?? script.legs.at(-1);
    if (!leg) return;
    switch (leg.kind) {
      case 'batted': {
        const t = Math.min(time - leg.start, leg.ball.end);
        leg.ball.position(t, ballAt);
        if (leg.ball.overWall && t > leg.ball.airTime) {
          host.hideBall();
          return;
        }
        host.ball(ballAt, 'batted', delta);
        return;
      }
      case 'held': {
        const hand = host.actor(leg.by).mover.person.handWorld(leg.hand, scratch);
        ballAt.x = hand.x;
        ballAt.y = hand.y + 0.05;
        ballAt.z = hand.z;
        host.ball(ballAt, 'held', delta);
        return;
      }
      case 'throw': {
        const s = (time - leg.start) / Math.max(leg.end - leg.start, 1e-6);
        arcPosition(leg.from, leg.to, s, leg.lift, ballAt);
        host.ball(ballAt, 'throw', delta);
        return;
      }
      case 'roll': {
        const s = (time - leg.start) / Math.max(leg.end - leg.start, 1e-6);
        groundBallPosition(leg.from, leg.to, s, ballAt);
        host.ball(ballAt, 'roll', delta);
        return;
      }
    }
  };

  const runner: PlayRunner = {
    get active() {
      return script !== null;
    },
    get time() {
      return time;
    },
    ballPosition(out) {
      out.x = ballAt.x;
      out.y = ballAt.y;
      out.z = ballAt.z;
      return out;
    },
    start(next, handleEvent, handleEnd) {
      script = next;
      onEvent = handleEvent;
      onEnd = handleEnd;
      time = 0;
      nextEvent = 0;
      nextRunner = 0;
      timers = [];
      waiting = [];
      started = [];
      nextAction = {};
      actions = {};
      for (const p of POSITIONS_ALL) {
        actions[p] = [...next.fielders[p]].sort((a, b) => a.at - b.at);
        nextAction[p] = 0;
      }
      runner.update(0);
    },
    update(delta) {
      if (!script) return;
      time += delta;
      const current = script;
      // Fielders act on cue.
      for (const p of POSITIONS_ALL) {
        const list = actions[p];
        while (nextAction[p] < list.length && list[nextAction[p]].at <= time) {
          const a = list[nextAction[p]++];
          const actor = host.actor(p);
          if (a.do === 'run') actor.run(a.to, a.speed, a.face);
          else if (a.do === 'pose') {
            actor.act(a.pose, { toward: a.toward, side: a.side });
            if (a.pose === 'mask-off') host.maskOff?.();
          } else actor.faceTo(a.point);
        }
      }
      // Runners leave on cue.
      const order = [...current.runners].sort((a, b) => a.leaveAt - b.leaveAt);
      while (nextRunner < order.length && order[nextRunner].leaveAt <= time) {
        startRunner(order[nextRunner++]);
      }
      for (const w of [...waiting]) {
        if (time >= w.until) {
          waiting = waiting.filter((x) => x !== w);
          w.go();
        }
      }
      // Sliders go down a couple of units before the bag.
      for (const s of started) {
        if (s.sliding || !s.script.slides) continue;
        const end = s.script.route[s.script.route.length - 1];
        const pos = s.batter.person.root.position;
        if (dist({ x: pos.x, y: 0, z: pos.z }, end) <= 2.4 && s.batter.mover.moving) {
          s.sliding = true;
          s.batter.slide();
        }
      }
      // Timers and events.
      for (const t of timers.filter((x) => x.at <= time)) t.fn();
      timers = timers.filter((x) => x.at > time);
      while (nextEvent < current.events.length && current.events[nextEvent].at <= time) {
        onEvent(current.events[nextEvent++]);
      }
      placeBall(delta);
      if (time >= current.duration && script === current) {
        onEnd();
        // The caller settles the play when it ends; make sure nobody is left behind.
        if (script === current) runner.settle();
      }
    },
    settle() {
      if (!script) return;
      const current = script;
      script = null;
      // Events that have not happened yet happen now, in order.
      while (nextEvent < current.events.length) onEvent(current.events[nextEvent++]);
      // Runners to where they finish, the scorers gone.
      for (const r of current.runners) {
        const figure = host.runner(r.from);
        if (!figure) continue;
        figure.mover.halt();
        const end = r.route[r.route.length - 1];
        if (end) figure.mover.place(end.x, end.z);
        if (r.finish === 'score') host.scored(r.from);
        else if (r.finish === 'out') host.retired(r.from);
        else figure.runnerStance();
      }
      // Fielders to the end of their last run, ready.
      for (const p of POSITIONS_ALL) {
        const actor = host.actor(p);
        const runs = current.fielders[p].filter((a) => a.do === 'run');
        const last = runs.at(-1);
        actor.mover.halt();
        if (last && last.do === 'run') {
          actor.mover.place(last.to.x, last.to.z);
        }
        actor.actions.stop();
      }
      host.hideBall();
      timers = [];
      waiting = [];
      started = [];
    },
  };
  return runner;
}
