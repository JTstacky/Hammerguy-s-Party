// Helpers that scatter decorative doodads (trees, rocks, torches) around a
// minigame's playfield, the way WC3 maps framed their arenas.
import { rand } from '../../engine/server/sim.js';

// A forest edge round a rectangle: an uneven front row, a thicker row behind
// it, and the odd bush or rock in front, like a WC3 treeline rather than a
// hedge. Corners are rounded off.
export function treesAroundRect(hw, hh, density = 0.45, margin = 2.5) {
  const props = [];
  const step = 1 / density;
  const edge = (x, y, nx, ny) => {
    const m = margin + rand(-0.6, 1.4);
    props.push({ t: 'tree', x: x + nx * m + rand(-0.5, 0.5) * Math.abs(ny), y: y + ny * m + rand(-0.5, 0.5) * Math.abs(nx), s: rand(0.75, 1.35) });
    if (Math.random() < 0.8) props.push({ t: 'tree', x: x + nx * (m + rand(2, 3.5)) + rand(-1, 1) * Math.abs(ny), y: y + ny * (m + rand(2, 3.5)) + rand(-1, 1) * Math.abs(nx), s: rand(1, 1.5) });
    const r = Math.random();
    if (r < 0.22) props.push({ t: 'bush', x: x + nx * (m - rand(1, 1.8)), y: y + ny * (m - rand(1, 1.8)), s: rand(0.6, 1) });
    else if (r < 0.3) props.push({ t: 'rock', x: x + nx * (m - rand(0.8, 1.6)), y: y + ny * (m - rand(0.8, 1.6)), s: rand(0.35, 0.6) });
  };
  for (let x = -hw + 1; x <= hw - 1; x += step) {
    edge(x, -hh, 0, -1);
    edge(x, hh, 0, 1);
  }
  for (let y = -hh + 1; y <= hh - 1; y += step) {
    edge(-hw, y, -1, 0);
    edge(hw, y, 1, 0);
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 2) * (Math.PI / 2);
      const m = margin + rand(0, 1.5);
      props.push({ t: 'tree', x: sx * (hw + Math.cos(a) * m), y: sy * (hh + Math.sin(a) * m), s: rand(0.9, 1.4) });
    }
  }
  return props;
}

export function ringOf(type, radius, count, s = 1) {
  const props = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    props.push({ t: type, x: Math.cos(a) * radius, y: Math.sin(a) * radius, s });
  }
  return props;
}

export function treesAroundCircle(r, count = 40) {
  const props = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rand(-0.06, 0.06);
    const rr = r + rand(2, 5);
    props.push({ t: 'tree', x: Math.cos(a) * rr, y: Math.sin(a) * rr, s: rand(0.8, 1.4) });
    if (Math.random() < 0.6) {
      const b = a + rand(-0.05, 0.05);
      const r2 = rr + rand(2.5, 4);
      props.push({ t: 'tree', x: Math.cos(b) * r2, y: Math.sin(b) * r2, s: rand(1, 1.5) });
    }
    if (Math.random() < 0.2) props.push({ t: 'bush', x: Math.cos(a) * (r + rand(0.8, 1.6)), y: Math.sin(a) * (r + rand(0.8, 1.6)), s: rand(0.6, 0.95) });
  }
  return props;
}
