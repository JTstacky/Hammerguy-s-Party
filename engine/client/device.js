// Phones and tablets get touch controls and a lighter renderer.
// ?touch=1 forces touch mode (for testing on a desktop), ?touch=0 turns it off.
const q = new URLSearchParams(location.search).get('touch');

export const IS_TOUCH = q != null ? q !== '0' : matchMedia('(pointer: coarse)').matches;

// Lighter rendering on touch devices: lower resolution, smaller shadow map,
// fewer particles and no dynamic point lights.
export const LITE = IS_TOUCH;
export const FX_DENSITY = LITE ? 0.6 : 1;
