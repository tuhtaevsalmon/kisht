import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyze,demoData,addDays,analogStart,type SourceData} from './domain.ts';
import {defaultCorn,defaultPotato,defaultWheat} from './evapotranspiration.ts';
import {seasonLength} from './season.ts';
import {compareAutomaticPlans,candidateDates,seasonRange,loadPlanYears,type SearchRange,type PlanYear} from './plantingPlan.ts';

function source(start:string,duration=135):SourceData{const d=demoData(start,duration);return {...d,kind:'nasa',days:d.days.map(w=>({...w,min:10,max:25,temp:18,rain:0,et0:4}))};}
function fixture(planting='2027-04-01',range?:SearchRange):PlanYear[]{
 const dates=range?candidateDates(range):[-14,0,14].map(shift=>addDays(planting,shift));
 return [2022,2023,2024].map(year=>({year,dates,sources:dates.map(date=>source(analogStart(date,year+Number(date.slice(0,4))-Number(planting.slice(0,4))))),baseline:source(analogStart(planting,year))}));
}
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
 const negative=fixture();negative[2].sources[2].days[134].et0=-1;assert.throws(()=>compareAutomaticPlans(negative,'2027-04-01','loam',defaultWheat,{}),/Incomplete real-data/);
 const wrongDate=fixture();wrongDate[0].sources[0].days[1].date=wrongDate[0].sources[0].days[0].date;assert.throws(()=>compareAutomaticPlans(wrongDate,'2027-04-01','loam',defaultWheat,{}),/mismatched source dates/);
});
test('season search samples weekly within bounds and includes an unaligned end date',()=>{
 assert.deepEqual(candidateDates({start:'2028-06-01',end:'2028-06-17'}),['2028-06-01','2028-06-08','2028-06-15','2028-06-17']);
 assert.deepEqual(candidateDates({start:'2028-06-01',end:'2028-06-01'}),['2028-06-01']);
 assert.deepEqual(seasonRange('2028-04-01','summer'),{start:'2028-06-01',end:'2028-08-31'});
 assert.deepEqual(candidateDates({start:'2028-02-22',end:'2028-03-01'}),['2028-02-22','2028-02-29','2028-03-01']);
 for(const range of [{start:'2028-12-25',end:'2029-01-01'},{start:'2028-08-01',end:'2028-07-01'},{start:'2028-01-01',end:'2028-06-01'},{start:'2027-02-29',end:'2027-03-01'}])assert.throws(()=>candidateDates(range));
});
test('summer plan keeps baseline outside search and replays dated irrigation with water limits',()=>{
 const planting='2028-04-01',range=seasonRange(planting,'summer'),years=fixture(planting,range);
 // Candidate weather is independently different from the original April sowing.
 years.forEach(y=>y.sources.forEach(s=>s.days.forEach(d=>d.rain=1)));
 const options={efficiency:.6,initialStorage:.2,weeklyLimit:10,irrigationEvents:[{date:planting,mm:8}]};
 const plans=compareAutomaticPlans(years,planting,'sand',defaultWheat,options,range),best=plans[0];
 assert.equal(plans.length,candidateDates(range).length);
 assert.ok(plans.every(p=>p.date>=range.start&&p.date<=range.end));
 assert.equal(best.baseline.water,8);
 assert.ok(best.median.unmet>0); // constrained water cannot magically meet demand
 const replay=analyze(best.replay.source,best.date,'wheat','sand',0,{...options,wheat:defaultWheat,irrigationEvents:best.replay.events});
 assert.ok(Math.abs(replay.reduce((s,r)=>s+r.grossIrrigation,0)-best.replay.water)<1e-9);
 assert.ok(Math.abs(replay.reduce((s,r)=>s+r.unmet,0)-best.replay.unmet)<1e-9);
 for(let start=0;start<replay.length;start+=7)assert.ok(replay.slice(start,start+7).reduce((sum,r)=>sum+r.grossIrrigation,0)<=10+1e-9);
 const mismatched=fixture(planting,range);mismatched[1].dates![1]='2028-06-09';assert.throws(()=>compareAutomaticPlans(mismatched,planting,'loam',defaultWheat,options,range),/candidate dates/);
 const noBaseline=fixture(planting,range);delete noBaseline[0].baseline;assert.throws(()=>compareAutomaticPlans(noBaseline,planting,'loam',defaultWheat,options,range),/Incomplete real-data/);
});
test('weekly search maps leap-day samples independently and baseline mapping crosses New Year correctly',()=>{
 const planting='2028-04-01',range={start:'2028-02-22',end:'2028-03-01'},years=fixture(planting,range);
 const plans=compareAutomaticPlans(years,planting,'loam',defaultWheat,{},range);
 const leap=plans.find(p=>p.date==='2028-02-29')!;
 assert.equal(leap.years.find(y=>y.year===2023)!.source.start,'2023-02-28');
 assert.equal(plans.find(p=>p.date==='2028-03-01')!.years.find(y=>y.year===2023)!.source.start,'2023-03-01');
 const january=compareAutomaticPlans(fixture('2028-01-05'),'2028-01-05','loam',defaultWheat,{});
 assert.equal(january.find(p=>p.shift===-14)!.years.find(y=>y.year===2023)!.source.start,'2022-12-22');
});

test('corn and potato recommendations replay every stage of their complete crop cycle',()=>{
 const planting='2028-05-01',range={start:planting,end:planting};
 const options={initialStorage:.3,efficiency:.6,weeklyLimit:12};
 for(const [crop,profile] of [['corn',defaultCorn],['potato',defaultPotato]] as const){
  const duration=seasonLength(crop,profile);
  const years=[2022,2023,2024].map(year=>{
   const data=source(analogStart(planting,year),duration);
   return {year,dates:[planting],sources:[data],baseline:data};
  });
  const best=compareAutomaticPlans(years,planting,'loam',profile,options,range,crop)[0];
  const rows=analyze(best.replay.source,best.date,crop,'loam',0,{...options,profile,irrigationEvents:best.replay.events});
  assert.equal(best.completeYears,3);
  assert.equal(rows.length,duration);
  assert.deepEqual([0,1,2,3].map(stage=>rows.filter(r=>r.stage===stage).length),profile.stages);
  assert.equal(rows.at(-1)!.date,addDays(planting,duration-1));
  assert.ok(Math.abs(rows.reduce((s,r)=>s+r.grossIrrigation,0)-best.replay.water)<1e-9);
  assert.ok(Math.abs(rows.reduce((s,r)=>s+r.unmet,0)-best.replay.unmet)<1e-9);
  assert.ok(best.replay.events.length>0);
  for(let i=0;i<rows.length;i+=7)assert.ok(rows.slice(i,i+7).reduce((s,r)=>s+r.grossIrrigation,0)<=12+1e-9);
 }
});
