// Shared stubs for the batch-B Uther Party port tests (not a test file itself).
export const party = (bots = false) => ({ room: { isBot: () => bots, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });
export const dt = 1 / 30;
export function run(g, secs) {
  const end = g.time + secs;
  while (g.time < end - 1e-9) {
    g.time += dt;
    g.tick(dt);
  }
}
export const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
