import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultProfiles} from './evapotranspiration.ts';
import {simulatedCrops} from './domain.ts';
import {fieldWater,suggestCrop,weekAction} from './fieldGuide.ts';

test('field water scales inlet demand by method losses and field area',()=>{
 const water=fieldWater('wheat',defaultProfiles.wheat,0.7,.6,.65);
 assert.equal(water.days,135);
 assert.equal(water.needMm,3.6);
 assert.equal(water.heat,30);
 assert.ok(Math.abs(water.inletMm-6)<1e-9);
 assert.ok(Math.abs(water.dailyM3-6*0.7*10)<1e-9);
 assert.ok(Math.abs(water.weeklyM3-water.dailyM3*7)<1e-9);
 assert.ok(Math.abs(water.seasonM3-water.dailyM3*135)<1e-9);
 assert.ok(Math.abs(water.reserveMm-110*1*.65)<1e-9);
});

test('a crop suggestion keeps the current crop when its week already fits',()=>{
 assert.equal(suggestCrop(null,1,1,simulatedCrops,'wheat'),null);
 assert.deepEqual(suggestCrop(10000,1,1,simulatedCrops,'wheat'),{crop:'wheat',fits:true});
 assert.deepEqual(suggestCrop(300,1,1,simulatedCrops,'rice'),{crop:'potato',fits:true});
 assert.deepEqual(suggestCrop(10,1,1,simulatedCrops,'rice'),{crop:'barley',fits:false});
});

test('the seven-day note postpones irrigation covered by forecast rain',()=>{
 const days=[{date:'2026-11-16',max:22,rain:0},{date:'2026-11-17',max:24,rain:12},{date:'2026-11-18',max:23,rain:0}];
 const action=weekAction(days,'wheat',defaultProfiles.wheat,'loam',.65,[{date:'2026-11-17',mm:20}]);
 assert.equal(action.kind,'postpone');
 if(action.kind==='postpone'){assert.equal(action.date,'2026-11-17');assert.equal(action.rain,12);assert.equal(action.scheduled,20);}
});

test('a hot day with a low reserve asks for water the day before',()=>{
 const profile={...defaultProfiles.tomato,availableWater:20,rootDepth:.2,depletionFraction:.4 as const};
 const days=[{date:'2026-11-16',max:24,rain:0},{date:'2026-11-17',max:36,rain:0}];
 const action=weekAction(days,'tomato',profile,'clay',.1,[]);
 assert.equal(action.kind,'before-heat');
 if(action.kind==='before-heat'){assert.equal(action.irrigateOn,'2026-11-16');assert.equal(action.hotDate,'2026-11-17');assert.equal(action.hotMax,36);}
 const first=weekAction([{date:'2026-11-16',max:36,rain:0}],'tomato',profile,'clay',.1,[]);
 assert.equal(first.kind,'before-heat');
 if(first.kind==='before-heat')assert.equal(first.irrigateOn,'2026-11-16');
 const watered=weekAction(days,'tomato',profile,'clay',.1,[{date:'2026-11-16',mm:20}]);
 assert.notEqual(watered.kind,'before-heat');
 const rainy=weekAction([{date:'2026-11-16',max:36,rain:40}],'tomato',profile,'clay',.1,[]);
 assert.notEqual(rainy.kind,'before-heat');
});
