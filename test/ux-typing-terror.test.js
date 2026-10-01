import test from 'node:test';import assert from 'node:assert/strict';
import { TypingTerror,TYPING } from '../server/minigames/ux/055-typing-terror.js';
const party=()=>({room:{isBot:()=>false,nameOf:p=>`P${p}`,colorOf:()=>''},msg(){},ev(){}});
test('typing: odd-length words and fixed 5.5-second window',()=>{const g=new TypingTerror(party(),[1,2]);g.setup();g.time=6.1;g.tick(0);assert.equal(g.word.length,1);assert.equal(g.deadline,11.6);g.command(1,{c:'type',text:g.word.toUpperCase()});g.time=11.6;g.tick(0);assert.equal(g.heroes.get(1).alive,true);assert.equal(g.heroes.get(2).alive,false);g.time=g.next;g.tick(0);assert.equal(g.word.length,3);assert.equal(TYPING.pool.length,23);});
test('typing: any wrong submission kills immediately; same deadline ties',()=>{const g=new TypingTerror(party(),[1,2,3]);g.setup();g.command(1,{c:'type',text:'hello'});assert.equal(g.heroes.get(1).alive,false);g.time=6.1;g.tick(0);g.time=g.deadline;g.tick(0);assert.deepEqual(g.deathGroups(),[[1],[2,3]]);});
