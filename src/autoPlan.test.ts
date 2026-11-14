import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyze,demoData,type SourceData} from './domain.ts';
import {defaultWheat} from './evapotranspiration.ts';
import {compareAutomaticPlans,type PlanYear} from './plantingPlan.ts';

function fixture():PlanYear[]{return [2022,2023,2024].map(year=>({year,sources:[-14,0,14].map(()=>{const d=demoData(`${year}-04-01`,135);return {...d,kind:'nasa',days:d.days.map(w=>({...w,min:10,max:25,temp:18,rain:0,et0:4}))} as SourceData})}));}
test('automatic planner ranks explicit frost exposure and applies exact representative schedule',()=>{
 const years=fixture();years.forEach(y=>{y.sources[0].days[0].min=-2;y.sources[2].days[0].max=40;});
 const options={efficiency:.6,initialStorage:.65,irrigationEvents:[]};
 const plans=compareAutomaticPlans(years,'2027-04-01','loam',defaultWheat,options),best=plans[0];
 assert.equal(best.shift,0);assert.equal(best.years.length,3);
 const replay=analyze(best.replay.source,best.date,'wheat','loam',0,{...options,wheat:defaultWheat,irrigationEvents:best.replay.events});
 assert.ok(Math.abs(replay.reduce((s,r)=>s+r.grossIrrigation,0)-best.replay.water)<1e-9);
 assert.ok(Math.abs(replay.reduce((s,r)=>s+r.unmet,0)-best.replay.unmet)<1e-9);
 assert.ok(best.median.unmet<=best.baseline.unmet);
});
test('automatic planner refuses missing years, demo sources and missing FAO inputs',()=>{
 assert.throws(()=>compareAutomaticPlans(fixture().slice(0,2),'2027-04-01','loam',defaultWheat,{}),/Three complete/);
 const demo=fixture();demo[0].sources[0].kind='demo';assert.throws(()=>compareAutomaticPlans(demo,'2027-04-01','loam',defaultWheat,{}),/Incomplete real-data/);
 const missing=fixture();missing[2].sources[2].days[134].et0=null;assert.throws(()=>compareAutomaticPlans(missing,'2027-04-01','loam',defaultWheat,{}),/Incomplete real-data/);
});
