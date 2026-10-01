import test from 'node:test';import assert from 'node:assert/strict';
import { MosquitoSwarm,MOSQUITO } from '../server/minigames/ux/060-mosquito.js';import { game } from './ux2-common.js';
test('mosquito: drain, bite and ogre numbers',()=>{const g=game(MosquitoSwarm);assert.equal(g.heroes.get(1).hp,1000);assert.equal(MOSQUITO.drain,25);assert.equal(MOSQUITO.biteHeal,20);assert.equal(MOSQUITO.ogreDamage,200);assert.equal(MosquitoSwarm.timer,false);});
test('mosquito: bite heals and assigns ogre aggro',()=>{const g=game(MosquitoSwarm);const u=g.heroes.get(1);u.hp=900;g.attackHit(1,u,g.ogre);assert.equal(u.hp,920);assert.equal(g.ogre.aggro,1);});
test('mosquito: one drain tick removes 25 HP',()=>{const g=game(MosquitoSwarm);g.time=4;g.tick(1);assert.equal(g.heroes.get(1).hp,975);});
