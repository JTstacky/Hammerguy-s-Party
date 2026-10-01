// The cursed green peon keeps the stock worker silhouette and gains the
// visible curse glow around the head from the original.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin } from '../../engine/client/render/registry.js';
import { peon } from './peon.js';

registerSkin('uxsickpeon', (color) => {
  const g = peon(color, { hide: '#85a765', kiltColor: '#665c54' });
  const aura = M.mesh(new THREE.TorusGeometry(0.23, 0.022, 6, 24).rotateX(Math.PI / 2), M.glowMat('#8dee58'), 0.22, 2.05, 0);
  g.add(aura);
  return g;
});
