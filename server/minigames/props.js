// Helpers that scatter decorative doodads (trees, rocks, torches) around a
// minigame's playfield, the way WC3 maps framed their arenas.
import { rand } from '../../engine/server/sim.js';

export function treesAroundRect(hw, hh, density = 0.45, margin = 2.5) {
  const props = [];
  const step = 1 / density;
  for (let x = -hw - margin; x <= hw + margin; x += step) {
    props.push({ t: 'tree', x: x + rand(-0.6, 0.6), y: -hh - margin + rand(-0.8, 0.8), s: rand(0.8, 1.3) });
    props.push({ t: 'tree', x: x + rand(-0.6, 0.6), y: hh + margin + rand(-0.8, 0.8), s: rand(0.8, 1.3) });
  }
  for (let y = -hh; y <= hh; y += step) {
    props.push({ t: 'tree', x: -hw - margin + rand(-0.8, 0.8), y: y + rand(-0.6, 0.6), s: rand(0.8, 1.3) });
    props.push({ t: 'tree', x: hw + margin + rand(-0.8, 0.8), y: y + rand(-0.6, 0.6), s: rand(0.8, 1.3) });
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
    const a = (i / count) * Math.PI * 2 + rand(-0.05, 0.05);
    const rr = r + rand(2, 5);
    props.push({ t: 'tree', x: Math.cos(a) * rr, y: Math.sin(a) * rr, s: rand(0.8, 1.4) });
  }
  return props;
}
