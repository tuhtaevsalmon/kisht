import {defaultCorn,defaultPotato,defaultProfiles,defaultWheat,validCropProfile} from './evapotranspiration.ts';
import {seasonLength} from './season.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addDays,analogStart,cropParams,simulatedCrops,validDate,validPolygon,areaHa,analyze,demoData,parseNASA} from './domain.ts';
test('dates cross year and leap boundaries without timezone shifts',()=>{assert.equal(addDays('2024-02-28',1),'2024-02-29');assert.equal(addDays('2024-12-31',1),'2025-01-01');assert.equal(analogStart('2024-02-29',2023),'2023-02-28');assert.equal(validDate('2025-02-29'),false)});
test('field accepts a simple contour and rejects crossed boundaries',()=>{const p:[[number,number],[number,number],[number,number],[number,number]]=[[38,68],[38,68.001],[38.001,68.001],[38.001,68]];assert.ok(validPolygon(p));assert.ok(areaHa(p)>.8&&areaHa(p)<1.1);assert.equal(validPolygon([p[0],p[2],p[1],p[3]]),false);assert.equal(validPolygon([p[0],p[1]]),false)});
test('season maps 120 source days onto the chosen planting date and respects water bounds',()=>{const d=demoData('2024-04-01');const r=analyze(d,'2027-11-10','corn','sand',0);assert.equal(r.length,120);assert.equal(r[0].date,'2027-11-10');assert.equal(r[0].sourceDate,'2024-04-01');assert.equal(r[119].date,addDays('2027-11-10',119));assert.ok(r.every(x=>x.moisture>=0&&x.moisture<=1));const wet=analyze(d,'2027-11-10','corn','sand',45);assert.ok(wet.filter(x=>x.waterRisk).length<r.filter(x=>x.waterRisk).length);assert.deepEqual(wet.map(x=>x.heat),r.map(x=>x.heat))});
test('NASA missing and sentinel values never become dry days',()=>{assert.throws(()=>parseNASA({},'2024-04-01'));const p:any={};for(const k of ['T2M','T2M_MIN','T2M_MAX','PRECTOTCORR','ALLSKY_SFC_SW_DWN']){p[k]={};for(let i=0;i<120;i++)p[k][addDays('2024-04-01',i).replaceAll('-','')]=10;}assert.equal(parseNASA({properties:{parameter:p}},'2024-04-01').length,120);p.PRECTOTCORR['20240403']=-999;assert.throws(()=>parseNASA({properties:{parameter:p}},'2024-04-01'));});
import {normalizeField,plantingPositions,inside} from './fieldGeometry.ts';
test('3D planting stays inside concave field boundary',()=>{const p=normalizeField([[38,68],[38,68.002],[38.001,68.002],[38.001,68.001],[38.002,68.001],[38.002,68]]);const plants=plantingPositions(p);assert.ok(plants.length>0);assert.ok(plants.every(([x,z])=>inside(x,z,p)));assert.equal(p.length,6);assert.ok(p.every(v=>v.every(n=>Number.isFinite(n)&&Math.abs(n)<=3.00001)));});
import {windowDates,spread,compareDates} from './climate.ts';
test('date comparison keeps winter offsets in the same historical season',()=>{const w=windowDates('2027-01-05',2024);assert.equal(w.start,'2023-12-22');assert.equal(w.starts[1],'2024-01-05');assert.equal(w.starts[2],'2024-01-19');assert.equal(spread([]),null);assert.deepEqual(spread([9,1,3,5]),{min:1,max:9,median:4});});
test('comparison uses all supplied years equally and does not invent missing years',()=>{const sources=[demoData('2024-03-18'),demoData('2024-04-01'),demoData('2024-04-15')];const results=compareDates([{year:2024,sources}],'2027-04-01','wheat','loam',18);assert.ok(results.every(r=>r.years.length===1));assert.equal(results[0].date,'2027-03-18');assert.equal(results[2].date,'2027-04-15');assert.equal(results[0].heat?.min,results[0].heat?.max);});
import {riskPeriods} from './riskEvents.ts';
import {terrainKey,parseTerrain,terrainHeight,terrainFrame,terrainDirections} from './terrain.ts';
test('downhill directions follow a plane and flat terrain invents no flow',()=>{
 const plot:[[number,number],[number,number],[number,number],[number,number]]=[[38,68],[38,68.001],[38.001,68.001],[38.001,68]];
 const terrain={size:7,bounds:[38,68,38.001,68.001],elevations:Array.from({length:49},(_,i)=>800+i%7),url:'',source:'test',resolution:30,fetchedAt:''};
 const directions=terrainDirections(terrain,plot);assert.ok(directions.length>0);assert.ok(directions.every(d=>d.dx<0&&Math.abs(d.dz)<1e-9&&d.slope>0));
 assert.equal(terrainDirections({...terrain,elevations:Array(49).fill(800)},plot).length,0);
});
test('rain runoff conserves water and does not subtract irrigation losses twice',()=>{
 const data=demoData('2024-04-01');const rows=analyze(data,'2027-04-01','wheat','sand',21,{efficiency:.6,rainRunoffFraction:.4});
 for(const r of rows){assert.ok(Math.abs(r.opening+r.rain+r.grossIrrigation-r.applicationLoss-r.rainRunoff-r.drain-r.actual-r.storage)<1e-9);assert.equal(r.rainRunoff,r.rain*.4);assert.equal(r.effectiveRain,r.rain-r.rainRunoff);assert.ok(Math.abs(r.netIrrigation-1.8)<1e-9)}
 const all=analyze(data,'2027-04-01','wheat','sand',0,{rainRunoffFraction:1,initialStorage:0});assert.ok(all.every(r=>r.effectiveRain===0&&r.storage===0));
 assert.throws(()=>analyze(data,'2027-04-01','wheat','sand',0,{rainRunoffFraction:1.01}));
 const storm=demoData('2024-04-01',2);storm.days=storm.days.map((d,i)=>({...d,rain:i===0?6:40}));
 const clay=analyze(storm,'2027-04-01','wheat','clay',0,{irrigationEvents:[],initialStorage:.5});
 assert.equal(clay[0].effectiveRain,6);assert.equal(clay[0].rainRunoff,0);assert.equal(clay[0].infiltrationCap,8);
 assert.equal(clay[1].effectiveRain,8);assert.equal(clay[1].rainRunoff,32);
 const sand=analyze(storm,'2027-04-01','wheat','sand',0,{irrigationEvents:[]});
 assert.equal(sand[1].effectiveRain,40);assert.equal(sand[1].rainRunoff,0);
 const forced=analyze(storm,'2027-04-01','wheat','clay',0,{irrigationEvents:[],rainRunoffFraction:0});
 assert.ok(forced.every(r=>r.effectiveRain===r.rain&&r.infiltrationCap===null));
 for(const r of clay)assert.ok(Math.abs(r.opening+r.effectiveRain+r.netIrrigation-r.actual-r.drain-r.storage)<1e-9);
});
test('terrain interpolation preserves geographic orientation and real vertical scale',()=>{
 const plot:[[number,number],[number,number],[number,number],[number,number]]=[[38,68],[38,68.001],[38.001,68.001],[38.001,68]];
 const key=terrainKey(plot),bounds=key.split(',').map(Number);
 const elevations=Array.from({length:49},(_,i)=>800+Math.floor(i/7)*2+i%7);
 const terrain=parseTerrain({size:7,bounds,elevations,url:'https://api.opentopodata.org/v1/srtm30m?test',source:'SRTM',resolution:30,fetchedAt:'2026-11-13T00:00:00Z'},key);
 const f=terrainFrame(terrain),x=f.width*f.scale/2,z=f.depth*f.scale/2;
 assert.equal(terrainHeight(terrain,-x,-z),0);
 assert.ok(Math.abs(terrainHeight(terrain,x,z)-18*f.scale)<1e-9);
 assert.ok(Math.abs(terrainHeight(terrain,0,0)-9*f.scale)<1e-9);
 assert.throws(()=>parseTerrain({...terrain,elevations:[null,...elevations.slice(1)]},key));
 assert.throws(()=>parseTerrain(terrain,'38,68,39,69'));
});
test('risk periods group contiguous events without bridging safe days',()=>{const rows=analyze(demoData('2024-04-01'),'2027-04-01','wheat','loam',18).slice(0,7).map((r,i)=>({...r,heat:[0,1,4,6].includes(i)}));assert.deepEqual(riskPeriods(rows,'heat'),[{start:0,end:1,days:2},{start:4,end:4,days:1},{start:6,end:6,days:1}]);assert.deepEqual(riskPeriods([], 'heat'),[]);});
test('water ledger conserves mass with delivery losses, rain and overflow',()=>{
 const rows=analyze(demoData('2024-04-01'),'2027-04-01','wheat','sand',45,{efficiency:.6,initialStorage:1,weeklyLimit:21});
 for(const r of rows){assert.ok(Math.abs(r.opening+r.rain+r.grossIrrigation-r.applicationLoss-r.drain-r.actual-r.storage)<1e-9);assert.ok(Math.abs(r.grossIrrigation-3)<1e-9);assert.ok(Math.abs(r.netIrrigation-1.8)<1e-9)}
 assert.ok(rows.some(r=>r.drain>0));
});
test('zero available water means no irrigation and no artificial moisture recovery',()=>{
 const data=demoData('2024-04-01');data.days=data.days.map(d=>({...d,rain:0}));
 const rows=analyze(data,'2027-04-01','corn','sand',45,{efficiency:.9,initialStorage:0,weeklyLimit:0});
 assert.ok(rows.every(r=>r.grossIrrigation===0&&r.netIrrigation===0&&r.storage===0&&r.unmet===r.demand));
 assert.throws(()=>analyze(data,'2027-04-01','corn','sand',18,{efficiency:0}));
});
test('date comparison applies the same irrigation constraints as the field',()=>{
 const sources=[demoData('2024-03-18'),demoData('2024-04-01'),demoData('2024-04-15')];
 const options={efficiency:.6,weeklyLimit:0,initialStorage:0};
 const compared=compareDates([{year:2024,sources}],'2027-04-01','wheat','loam',45,options);
 assert.equal(compared[1].water!.median,analyze(sources[1],'2027-04-01','wheat','loam',45,options).filter(r=>r.waterRisk).length);
});

import {stressHistory} from './stressHistory.ts';
test('elapsed water stress survives rewatering and excludes future deficits',()=>{
 const source=demoData('2024-04-01',4);
 source.days=source.days.map((d,i)=>({...d,rain:i===2?200:0}));
 const rows=analyze(source,'2027-04-01','corn','sand',0,{initialStorage:0,irrigationEvents:[]});
 const dry=stressHistory(rows,1),rewatered=stressHistory(rows,2);
 assert.equal(dry.limitedDays,2);assert.equal(dry.currentStreak,2);
 assert.equal(rewatered.currentStreak,0);assert.equal(rewatered.limitedDays,2);
 assert.ok(Math.abs(rewatered.unmet-dry.unmet)<1e-9);
 assert.equal(stressHistory(rows,0).limitedDays,1);
 assert.equal(stressHistory(rows,-1).unmet,0);
 assert.ok(rewatered.coverage>=0&&rewatered.coverage<=1);
});

import {exampleThermal,growingDegreeDays,validThermal} from './phenology.ts';
test('thermal clock clamps daily mean and rejects inverted thresholds',()=>{
 assert.equal(growingDegreeDays(-8,-2,exampleThermal),0);
 assert.equal(growingDegreeDays(10,20,exampleThermal),15);
 assert.equal(growingDegreeDays(40,50,exampleThermal),30);
 assert.equal(validThermal({...exampleThermal,base:30,upper:0}),false);
 assert.equal(validThermal({...exampleThermal,horizonDays:366}),false);
});
test('thermal development delays cold crops and never declares data-end maturity',()=>{
 const source=demoData('2024-04-01',30);
 const profile={...defaultWheat,thermal:{...exampleThermal,stages:[50,50,50,50] as [number,number,number,number]}};
 const cold={...source,days:source.days.map(d=>({...d,min:-4,max:0,temp:-2,et0:2}))};
 const coldRows=analyze(cold,'2027-04-01','wheat','loam',0,{wheat:profile,irrigationEvents:[]});
 assert.equal(coldRows.length,30);assert.ok(coldRows.every(r=>r.developmentProgress===0&&r.stage===0&&!r.cycleComplete));
 assert.ok(coldRows.every(r=>r.rootDepth===profile.initialRootDepth));
 const warm={...source,days:source.days.map(d=>({...d,min:5,max:15,temp:10,et0:2}))};
 const rows=analyze(warm,'2027-04-01','wheat','loam',0,{wheat:profile,automaticIrrigation:true});
 assert.equal(rows.length,20);assert.equal(rows.at(-1)!.gddTotal,200);assert.equal(rows.at(-1)!.cycleComplete,true);
 assert.equal(rows.at(-1)!.developmentProgress,1);assert.equal(rows.at(-1)!.grossIrrigation,0);
 assert.ok(rows.some(r=>r.stage===1));assert.ok(rows.some(r=>r.stage===2));
 for(const r of rows)assert.ok(Math.abs(r.previousStorage+r.rootAccessWater+r.effectiveRain+r.netIrrigation-r.actual-r.drain-r.storage)<1e-9);
 const events=rows.filter(r=>r.grossIrrigation>0).map(r=>({date:r.date,mm:r.grossIrrigation}));
 const replay=analyze(warm,'2027-04-01','wheat','loam',0,{wheat:profile,irrigationEvents:events});
 assert.deepEqual(replay.map(r=>[r.storage,r.stage,r.developmentProgress]),rows.map(r=>[r.storage,r.stage,r.developmentProgress]));
});
test('corn and potato use FAO-56 profiles with their own season length and heat thresholds',()=>{
 assert.equal(seasonLength('corn',defaultCorn),140);
 assert.equal(seasonLength('potato',defaultPotato),110);
 const withEt0=(planting:string,days:number)=>{
  const source=demoData(planting,days);
  source.days=source.days.map(d=>({...d,et0:3,dew:8,wind:2,pressure:90}));
  return source;
 };
 const corn=analyze(withEt0('2024-04-01',140),'2027-04-01','corn','loam',0,{wheat:defaultCorn,profile:defaultCorn,irrigationEvents:[]});
 assert.equal(corn.length,140);
 assert.equal(corn[0].demandModel,'fao56');
 assert.equal(corn[0].kc,defaultCorn.kc[0]);
 assert.ok(corn.some(r=>r.stage===2&&Math.abs(r.kc!-defaultCorn.kc[1])<1e-9));
 assert.equal(corn[0].heat,false);
 const hot={...withEt0('2024-04-01',110),days:withEt0('2024-04-01',110).days.map(d=>({...d,max:35}))};
 const potato=analyze(hot,'2027-04-01','potato','loam',0,{wheat:defaultPotato,profile:defaultPotato,irrigationEvents:[]});
 assert.equal(potato.length,110);
 assert.equal(potato[0].demandModel,'fao56');
 assert.ok(potato.every(r=>r.heat));
 assert.ok(potato[50].rootDepth!==null&&potato[50].rootDepth!<=defaultPotato.rootDepth);
});
test('each simulated crop keeps its own profile, water need and heat threshold',()=>{
 assert.equal(simulatedCrops.length,13);
 for(const crop of simulatedCrops){
  const profile=defaultProfiles[crop];
  assert.equal(validCropProfile(profile),true);
  assert.equal(seasonLength(crop,profile),profile.stages.reduce((a,b)=>a+b,0));
  assert.ok(cropParams[crop].need>=3);
  assert.ok(cropParams[crop].heat>=28&&cropParams[crop].heat<=40);
 }
});
