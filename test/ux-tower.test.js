import test from 'node:test';import assert from 'node:assert/strict';
import { TowerAttack,TOWERS,BUILDER } from '../server/minigames/ux/057-tower.js';import { game } from './ux2-common.js';
test('tower: builder and tower timings',()=>{const g=game(TowerAttack);assert.equal(g.heroes.get(1).hp,25);assert.equal(g.heroes.get(1).speed,190/54);assert.deepEqual(Object.values(TOWERS).map(t=>[t.build,t.life]),[[6,26],[14,34],[11,31]]);assert.equal(BUILDER.shieldCd,20);});
test('tower: builder death removes structures',()=>{const g=game(TowerAttack);const u=g.heroes.get(1);g.build(1,u,'arrow',u.x,u.y);assert.equal(g.towers.length,1);g.eliminate(1);assert.equal(g.towers[0].alive,false);});
test('tower: magic cannot damage a shielded builder',()=>{const g=game(TowerAttack);const u=g.heroes.get(1);g.shield.set(1,10);const t={owner:2,type:'magic',x:u.x,y:u.y,cd:0};g.fire(t,u);assert.equal(u.hp,25);});
test('tower: clicking your tower issues Stop and removes it',()=>{const g=game(TowerAttack);const u=g.heroes.get(1);g.build(1,u,'arrow',u.x,u.y);g.time=4;g.command(1,{c:'move',x:u.x,y:u.y});assert.equal(g.towers[0].alive,false);});
