import test from 'node:test';import assert from 'node:assert/strict';
import { TornadoNaga,TORNADO } from '../server/minigames/ux/053-tornado-naga.js';import { wc3 } from '../engine/server/sim.js';
const party=()=>({room:{isBot:()=>false,nameOf:p=>`P${p}`,colorOf:()=>''},msg(){},ev(){}});
test('tornado: Naga speed 370, kill disc 100, spawn every 5 to cap 50',()=>{const g=new TornadoNaga(party(),[1,2]);g.setup();assert.equal(g.heroes.get(1).speed,wc3(370));assert.equal(TORNADO.kill,wc3(100));assert.equal(TORNADO.spawnEvery,5);assert.equal(TORNADO.cap,50);assert.equal(g.murguls.length,15);});
test('tornado: touching centre kills simultaneously',()=>{const g=new TornadoNaga(party(),[1,2]);g.setup();g.time=4;const t=g.tornados[0];t.vx=t.vy=0;for(const u of g.heroes.values()){u.x=u.y=0;}g.tick(1/30);assert.equal(g.alive.length,0);assert.deepEqual(g.deathGroups(),[[1,2]]);});
