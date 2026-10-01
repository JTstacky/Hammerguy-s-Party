// Plug-in points so each minigame can bring its own visuals without editing
// the shared renderer (world.js). A game's client file (client/views/<id>.js)
// registers what it needs at import time:
//
//   registerView('spider', {
//     make(e, world, v)            -> THREE.Object3D   (v is the view record; stash parts on v.parts)
//     update(v, a, b, k, dt, world)                    (a/b: bracketing snapshots of the entity, k: blend;
//                                                       v.x / v.z / v.f are already interpolated;
//                                                       position and rotation are set before update runs,
//                                                       so it may simply overwrite them)
//     remove(v, world)                                 (optional clean-up)
//     bake: true | 'flat'                              (optional: merge the model's static meshes per
//                                                       material with bakeModel; everything update()
//                                                       moves must then be referenced from the model's
//                                                       userData, as for skins. Use it for units that
//                                                       come in numbers. 'flat' folds each part into one
//                                                       vertex-coloured mesh, for crowds.)
//   })
//   registerSkin('sheep', (color) => group)   hero looks: a Group with userData.body
//                                              (optional userData.legL/legR/staff are animated;
//                                              optional userData.tick(dt, v, snap, world) runs every frame;
//                                              static parts are merged per material, so anything a skin
//                                              moves must be referenced from userData)
//   world.cameraFx.add(fn)                     fn(camera, dt, world) after the camera is placed each
//                                              frame (camera noise, sway); delete it in remove()
//   registerEvent('web', (e, world) => {...})  one-shot effects for a game's event kinds
//   registerTheme('cave', { sky, fog, sun, hemi, sunI }, groundLayers)
//                                              groundLayers as in world.js GROUNDS (see terrain.js)
//   registerMapBuilder('ratmaze', (map, world) => {...})
//                                              called by setMap when map.build includes the name;
//                                              add meshes to world.mapGroup
export const VIEWS = new Map();
export const SKINS = new Map();
export const EVENTS = new Map();
export const THEMES_EXTRA = new Map();
export const MAP_BUILDERS = new Map();

export const registerView = (kind, def) => VIEWS.set(kind, def);
export const registerSkin = (name, fn) => SKINS.set(name, fn);
export const registerEvent = (kind, fn) => EVENTS.set(kind, fn);
export const registerTheme = (name, theme, ground) => THEMES_EXTRA.set(name, { theme, ground });
export const registerMapBuilder = (name, fn) => MAP_BUILDERS.set(name, fn);
