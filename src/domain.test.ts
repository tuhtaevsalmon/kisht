import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addDays,analogStart,validDate,validPolygon,areaHa,analyze,demoData,parseNASA} from './domain.ts';
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
import {terrainKey,parseTerrain,terrainHeight,terrainFrame} from './terrain.ts';
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
