import {test} from 'node:test';
import assert from 'node:assert/strict';
import {simulate} from './model.ts';
const weather={temp:29,rain:0,label:'test',source:'demo' as const};
test('water remains within soil capacity in dry and wet extremes',()=>{for(const water of [0,45]){const r=simulate('corn','sand',water,{...weather,rain:water?6:0});assert.equal(r.days.length,121);for(const d of r.days){assert.ok(d.moisture>=0&&d.moisture<=1);assert.ok(Number.isFinite(d.water));}}});
test('more irrigation cannot increase water deficit under identical conditions',()=>{assert.ok(simulate('corn','loam',40,weather).stress<simulate('corn','loam',0,weather).stress)});
