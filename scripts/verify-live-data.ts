// Opt-in integration audit: calls public providers, never substitutes fixtures.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {loadNASA,loadForecast} from '../src/liveData.ts';
import {analyze,capacity,simulatedCrops} from '../src/domain.ts';
import {defaultProfiles} from '../src/evapotranspiration.ts';
import {seasonLength} from '../src/season.ts';
import {loadPlanYears,compareAutomaticPlans} from '../src/plantingPlan.ts';
import {terrainResponse} from '../worker/terrain.js';

const signal=AbortSignal.timeout(120000);
const report:any={checkedAt:new Date().toISOString(),location:{lat:38.53,lon:68.55},checks:[]};
async function check(name:string,run:()=>Promise<unknown>){
 try{report.checks.push({name,status:'passed',result:await run()});console.log(name+': passed');}
 catch(e){report.checks.push({name,status:'failed',error:String(e)});console.log(name+': failed '+String(e));process.exitCode=1;}
}
await check('NASA source values and all crop water balances',async()=>{
 const source=await loadNASA({...report.location,planting:'2027-04-01',year:2024,duration:180,signal});
 const raw=await (await fetch(source.url,{signal})).json();
 for(const d of source.days){const k=d.date.replaceAll('-','');assert.equal(d.rain,raw.properties.parameter.PRECTOTCORR[k]);assert.equal(d.min,raw.properties.parameter.T2M_MIN[k]);assert.equal(d.max,raw.properties.parameter.T2M_MAX[k]);}
 let tested=0,maxResidual=0;
 for(const crop of simulatedCrops)for(const soil of ['sand','loam','clay'] as const)for(const efficiency of [.6,.75,.9]){
  const profile={...defaultProfiles[crop],availableWater:capacity[soil]};
  const n=seasonLength(crop,profile),input={...source,days:source.days.slice(0,n)};
  const rows=analyze(input,'2027-04-01',crop,soil,0,{profile,efficiency,initialStorage:.65,weeklyLimit:25,automaticIrrigation:true});
  assert.equal(rows.length,n);
  let weekly=0;
  for(const [i,r] of rows.entries()){
   assert.equal(r.demandModel,'fao56');
   assert.ok(r.storage>=0&&r.storage<=r.storageCapacity+1e-8);
   assert.ok(r.actual<=r.demand+1e-8);
   const residual=Math.abs(r.previousStorage+r.rootAccessWater+r.rain+r.grossIrrigation-r.rainRunoff-r.applicationLoss-r.drain-r.actual-r.storage);
   maxResidual=Math.max(maxResidual,residual);assert.ok(residual<1e-8);
   if(i%7===0)weekly=0;weekly+=r.grossIrrigation;assert.ok(weekly<=25+1e-8);
  }
  tested++;
 }
 return {url:source.url,days:source.days.length,scenarios:tested,maxResidualMm:maxResidual};
});
await check('Current seven-day forecast',async()=>{
 const f=await loadForecast({...report.location,signal});
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dushanbe',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 assert.equal(f.days[0].date,today);return {url:f.url,start:f.days[0].date,end:f.days.at(-1)!.date};
});
await check('SRTM live elevation grid',async()=>{
 const r=await terrainResponse(new Request('http://localhost/api/terrain?bounds=38.530000,68.550000,38.531000,68.551000'));
 assert.equal(r.status,200);const t=await r.json();assert.equal(t.elevations.length,49);
 return {source:t.source,url:t.url,min:Math.min(...t.elevations),max:Math.max(...t.elevations)};
});
await check('Three-year recommendation and exact replay',async()=>{
 const profile=defaultProfiles.wheat,planting='2027-04-01';
 const years=await loadPlanYears(38.53,68.55,planting,profile,signal);
 const options={initialStorage:.65,efficiency:.6,weeklyLimit:25,irrigationEvents:[]};
 const best=compareAutomaticPlans(years,planting,'loam',profile,options)[0];
 const replay=analyze(best.replay.source,best.date,'wheat','loam',0,{...options,profile,irrigationEvents:best.replay.events});
 assert.ok(Math.abs(replay.reduce((s,r)=>s+r.unmet,0)-best.replay.unmet)<1e-8);
 assert.ok(Math.abs(replay.reduce((s,r)=>s+r.grossIrrigation,0)-best.replay.water)<1e-8);
 return {years:years.map(y=>y.year),candidateDate:best.date,replayYear:best.replay.year,waterMm:best.replay.water,unmetMm:best.replay.unmet,urls:years.map(y=>y.sources[0].url)};
});
writeFileSync('LIVE_DATA_AUDIT.json',JSON.stringify(report,null,2)+'\n');
