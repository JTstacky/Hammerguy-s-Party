// Which controls to use. Settings → Controls stores a choice per browser:
//   'auto'  (default) touch controls on any touchscreen — phones, tablets and
//           touchscreen laptops/desktops (which report a mouse as their main
//           pointer, so they also need the "any touch" check);
//   'touch' always the phone layout (joystick, tap to act), even with a mouse;
//   'mouse' always the Warcraft III mouse-and-keyboard controls.
// `?touch=1` / `?touch=0` in the URL overrides it for the browser session.
// Phones (touch as the main pointer) also get the lighter renderer.

export const CONTROLS_KEY = 'tenggames-controls';

const mq = (q) => typeof matchMedia === 'function' && matchMedia(q).matches;

function choice() {
  try {
    const q = new URLSearchParams(location.search).get('touch');
    if (q != null) sessionStorage.setItem('force-touch', q);
    const f = sessionStorage.getItem('force-touch');
    if (f != null) return f === '0' ? 'mouse' : 'touch';
    const v = localStorage.getItem(CONTROLS_KEY);
    return v === 'touch' || v === 'mouse' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export const PHONE = mq('(pointer: coarse)');
export const TOUCHSCREEN = PHONE || mq('(any-pointer: coarse)') || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
export const CONTROLS = choice();
export const IS_TOUCH = CONTROLS === 'touch' || (CONTROLS === 'auto' && TOUCHSCREEN);

// Lighter rendering on phones: lower resolution, smaller shadow map, fewer
// particles and no dynamic point lights.
export const LITE = PHONE;
export const FX_DENSITY = LITE ? 0.6 : 1;

// Saves a new choice; returns whether the page must reload to apply it.
export function setControls(value) {
  try {
    localStorage.setItem(CONTROLS_KEY, value);
    sessionStorage.removeItem('force-touch');
  } catch {}
  return (value === 'touch' || (value === 'auto' && TOUCHSCREEN)) !== IS_TOUCH;
}
