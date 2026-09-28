// Client-side prediction: the client's forecast of its own hammerguy must
// match where the host really puts it, at several network latencies,
// including walking into the arena's edge and ordering during a cast.
import test from 'node:test';
import assert from 'node:assert/strict';

let clock = 0; // seconds; the predictor reads performance.now()
Object.defineProperty(globalThis, 'performance', { value: { now: () => clock * 1000 }, configurable: true });

const { KingOfTheHill } = await import('../server/minigames/koth.js');
const { Predictor } = await import('../engine/client/predict.js');
const { TICK_RATE } = await import('../engine/shared/constants.js');

const STEP = 1 / TICK_RATE;
// Includes a walk past the arena's edge (radius 12) and a joystick steer.
const ORDERS = [[0.3, { c: 'move', x: 6, y: 0 }], [0.9, { c: 'move', x: 0, y: 6 }], [1.3, { c: 'steer', x: -3, y: 7 }], [1.6, { c: 'move', x: 20, y: 0 }], [3.4, { c: 'stop' }], [3.6, { c: 'move', x: -4, y: 2 }]];
const party = { room: { isBot: () => false, nameOf: () => '', colorOf: () => '#fff' }, msg() {}, ev() {}, hasBomb: () => false };

function run(lat, { cast = false } = {}) {
  clock = 0;
  const g = new KingOfTheHill(party, [1, 2]);
  g.setup();
  g.moveT = 1e9;
  const me = g.heroes.get(1);
  Object.assign(me, { x: 0, y: 0 });
  Object.assign(g.heroes.get(2), { x: -9, y: -7 });
  if (cast) {
    // A targeted spell with a cast point: orders given during it wait.
    g.shove = null;
    g.spell = { castPoint: 0.5, cd: 0, cast() {} };
  }
  const orders = cast ? [...ORDERS.slice(0, 2), [1.0, { c: 'cast', x: -6, y: -2 }], [1.1, { c: 'move', x: 4, y: 4 }], ...ORDERS.slice(3)] : ORDERS;
  const pred = new Predictor();
  const toServer = [], toClient = [], truth = {}, errs = [];
  let tick = 0, offset = null, sq = [-1, null];
  for (let f = 0; f < 300; f++) {
    const tNext = (f + 1) / 60;
    while ((tick + 1) * STEP <= tNext) {
      clock = (tick + 1) * STEP;
      while (toServer.length && toServer[0].at <= clock) {
        const { m } = toServer.shift();
        sq = [m.q, tick + 1]; // as Party.command records it
        g.command(1, m);
      }
      g.tick(STEP);
      truth[++tick] = [me.x, me.y];
      if (tick % 2 === 0) toClient.push({ at: clock + lat, s: JSON.parse(JSON.stringify({ tk: tick, me: { pr: g.predictState(1, ...sq) } })) });
    }
    clock = tNext;
    for (const [t, m] of orders) if (Math.abs(t - clock) < 1 / 120) toServer.push({ at: clock + lat, m: pred.order({ t: 'cmd', ...m }) });
    while (toClient.length && toClient[0].at <= clock) {
      const { s } = toClient.shift();
      const sample = clock - s.tk * STEP;
      offset = offset == null ? sample : Math.min(offset, sample);
      pred.snapshot(s);
    }
    if (offset == null) continue;
    const o = pred.frame(clock - offset, 1 / 60);
    // Compared, once the host has got there, with where it put the hero at
    // the moment the prediction is for.
    if (o) errs.push([(clock - offset + pred.ahead) / STEP, o.x - pred.err.x, o.y - pred.err.y]);
  }
  assert.ok(Math.hypot(me.x, me.y) < 12, 'the host kept the hero in the arena');
  // The host's position at that moment, between its two ticks.
  const at = (k) => {
    const a = truth[Math.floor(k)], b = truth[Math.ceil(k)];
    const w = k - Math.floor(k);
    return a && b ? [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w] : null;
  };
  return errs.filter(([k]) => at(k)).map(([k, x, y]) => Math.hypot(at(k)[0] - x, at(k)[1] - y)).sort((a, b) => a - b);
}

for (const lat of [0.001, 0.05, 0.12]) {
  for (const cast of [false, true]) {
    test(`prediction tracks the host at ${lat * 1000} ms one-way latency${cast ? ', with a cast' : ''}`, () => {
      const e = run(lat, { cast });
      assert.ok(e.length > 250, `samples ${e.length}`);
      assert.ok(e[e.length >> 1] < 0.06, `median ${e[e.length >> 1]}`);
      assert.ok(e[Math.floor(e.length * 0.95)] < 0.3, `p95 ${e[Math.floor(e.length * 0.95)]}`);
    });
  }
}
