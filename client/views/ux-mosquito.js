import { registerSkin,registerView } from '../../engine/client/render/registry.js';
import { beast,person } from './ux2-common.js';
import { bakeModel } from '../../engine/client/render/batch.js';
registerSkin('uxmosquito',c=>beast(c,'mosquito'));
registerView('uxogre',{make(){const g=bakeModel(person('#b69b3d','doom'));g.scale.setScalar(2.4);return g;}});
