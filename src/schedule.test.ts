import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyze,demoData,parseNASA,addDays} from './domain.ts';
import {referenceET,defaultWheat,wheatKc,wheatStage} from './evapotranspiration.ts';
import {seasonLength} from './season.ts';
import {windowDates,parseYear} from './climate.ts';
import {rootDepthAt,rootStress} from './rootZone.ts';
import {rotationCandidates,rotationDates,rotationIndicators,type RotationPlan} from './rotation.ts';
test('rotation keeps current plan, creates distinct alternatives and counts family continuity',()=>{
 for(const crop of ['wheat','corn','legume'] as const){const base:RotationPlan=[crop,crop,crop],plans=rotationCandidates(base);assert.deepEqual(plans[0],base);assert.equal(new Set(plans.map(p=>p.join(','))).size,3);}
 const dates=rotationDates('2028-02-29');assert.deepEqual(dates,['2028-02-29','2029-02-28','2030-02-28']);
 const stats=rotationIndicators(['wheat','corn','legume'],'wheat',rotationDates('2027-04-01'),[135,120,120]);
 assert.equal(stats.repeats,1);assert.equal(stats.familyRepeats,2);assert.equal(stats.legumeSeasons,1);assert.deepEqual(stats.gaps,[231,245]);
});
test('root growth is bounded and accessible water is transferred once, not created by irrigation',()=>{
 assert.equal(rootDepthAt(0,defaultWheat),.2);assert.equal(rootDepthAt(45,defaultWheat),1);assert.equal(rootDepthAt(134,defaultWheat),1);
 const d=demoData('2024-04-01',135);d.days=d.days.map(r=>({...r,rain:0}));
 const rows=analyze(d,'2027-04-01','wheat','loam',0,{initialStorage:.5,irrigationEvents:[]});
 const access=rows.reduce((s,r)=>s+r.rootAccessWater,0);
 assert.ok(Math.abs(access-44)<1e-9);
 assert.ok(Math.abs(rows[0].previousStorage+access-rows.reduce((s,r)=>s+r.actual+r.drain,0)-rows.at(-1)!.storage)<1e-9);
 for(let i=1;i<rows.length;i++){assert.equal(rows[i].previousStorage,rows[i-1].storage);assert.ok(Math.abs(rows[i].opening-rows[i].previousStorage-rows[i].rootAccessWater)<1e-9);}
 const dry=analyze(d,'2027-04-01','wheat','loam',0,{initialStorage:0,irrigationEvents:[]});assert.ok(dry.every(r=>r.storage===0&&r.rootAccessWater===0&&r.actual===0));
});
test('FAO Ks is one above RAW, decreases before wilting and responds to rain',()=>{
 assert.equal(rootStress(60,100,5,.55).ks,1);
 assert.ok(Math.abs(rootStress(22.5,100,5,.55).ks-.5)<1e-9);
 assert.equal(rootStress(0,100,5,.55).ks,0);
 const data=demoData('2024-04-01',3);data.days=data.days.map((r,i)=>({...r,rain:i===1?50:0,et0:5}));
 const rows=analyze(data,'2027-04-01','wheat','loam',0,{initialStorage:.05,irrigationEvents:[]});
 assert.ok(rows[0].ks<1&&rows[0].storage>0&&rows[0].actual<rows[0].demand);
 assert.equal(rows[1].ks,1);assert.equal(rows[1].actual,rows[1].demand);
});
test('full wheat cycle includes late-stage days, final irrigation and year boundaries',()=>{
 const duration=seasonLength('wheat');assert.equal(duration,135);
 const start='2027-11-01',end=addDays(start,duration-1);
 const data=demoData('2024-11-01',duration);
 const rows=analyze(data,start,'wheat','loam',0,{irrigationEvents:[{date:end,mm:20}]});
 assert.equal(rows.length,135);assert.equal(rows.at(-1)!.date,end);assert.equal(rows.at(-1)!.stage,3);assert.equal(rows.at(-1)!.grossIrrigation,20);
 assert.deepEqual([0,1,2,3].map(stage=>rows.filter(r=>r.stage===stage).length),defaultWheat.stages);
 const w=windowDates(start,2024,duration);assert.equal(w.end,addDays('2024-11-01',148));
 assert.equal(seasonLength('corn',defaultWheat,160),160);
 assert.throws(()=>demoData(start,366));assert.throws(()=>parseNASA({},start,0));
});
test('NASA full-cycle parsing rejects a missing final day in comparison windows',()=>{
 const duration=135,start='2024-03-18',parameter:any={};
 for(const name of ['T2M','T2M_MIN','T2M_MAX','PRECTOTCORR','ALLSKY_SFC_SW_DWN'])parameter[name]=Object.fromEntries(Array.from({length:duration+28},(_,i)=>[addDays(start,i).replaceAll('-',''),10]));
 const payload={properties:{parameter}};
 const sample=parseYear(payload,'2027-04-01',2024,'test','test',duration);
 assert.deepEqual(sample.sources.map(s=>s.days.length),[135,135,135]);
 delete parameter.T2M[addDays(start,duration+27).replaceAll('-','')];
 assert.throws(()=>parseYear(payload,'2027-04-01',2024,'test','test',duration));
});
test('FAO-56 worked example 18 gives approximately 3.88 mm/day',()=>{
 const ea=1.409,log=Math.log(ea/.6108),dew=237.3*log/(17.27-log);
 const et=referenceET({date:'2023-07-06',min:12.3,max:21.5,dew,wind:2.078,pressure:100.1,solarMJ:22.07,latitude:50.8,elevation:100});
 assert.ok(et!==null&&Math.abs(et-3.88)<.04,`${et}`);
});
test('dated irrigation adds duplicate events, respects block caps and preserves mass',()=>{
 const rows=analyze(demoData('2024-04-01'),'2027-04-01','wheat','loam',0,{weeklyLimit:25,efficiency:.6,irrigationEvents:[{date:'2027-04-02',mm:20},{date:'2027-04-02',mm:10},{date:'2027-04-03',mm:8},{date:'2027-04-08',mm:12}]});
 assert.equal(rows[0].grossIrrigation,0);assert.equal(rows[1].requestedIrrigation,30);assert.equal(rows[1].grossIrrigation,25);assert.equal(rows[2].grossIrrigation,0);assert.equal(rows[7].grossIrrigation,12);
 for(const r of rows)assert.ok(Math.abs(r.opening+r.effectiveRain+r.netIrrigation-r.actual-r.drain-r.storage)<1e-9);
});
test('recommended calendar replays the identical water balance',()=>{
 const data=demoData('2024-04-01'),options={efficiency:.75,weeklyLimit:35};
 const auto=analyze(data,'2027-04-01','wheat','loam',0,{...options,automaticIrrigation:true});
 const replay=analyze(data,'2027-04-01','wheat','loam',0,{...options,irrigationEvents:auto.filter(r=>r.grossIrrigation>0).map(r=>({date:r.date,mm:r.grossIrrigation}))});
 assert.ok(auto.some(r=>r.grossIrrigation>0));assert.deepEqual(replay.map(r=>r.storage),auto.map(r=>r.storage));
 assert.throws(()=>analyze(data,'2027-04-01','wheat','loam',0,{irrigationEvents:[{date:'bad',mm:20}]}));
});
test('NASA radiation units convert consistently and incomplete ET inputs trigger explicit whole-season fallback',()=>{
 const parameters:any={T2M:{units:'C'},T2M_MIN:{units:'C'},T2M_MAX:{units:'C'},PRECTOTCORR:{units:'mm/day'},ALLSKY_SFC_SW_DWN:{units:'MJ/m^2/day'},T2MDEW:{units:'C'},WS2M:{units:'m/s'},PS:{units:'kPa'}};
 const parameter:any={};const values:any={T2M:20,T2M_MIN:12,T2M_MAX:28,PRECTOTCORR:1,ALLSKY_SFC_SW_DWN:18,T2MDEW:8,WS2M:2,PS:90};
 for(const [name,value] of Object.entries(values))parameter[name]=Object.fromEntries(Array.from({length:120},(_,i)=>[addDays('2024-04-01',i).replaceAll('-',''),value]));
 const payload={parameters,properties:{parameter},geometry:{coordinates:[68.55,38.53,800]}};
 const mj=parseNASA(payload,'2024-04-01');parameters.ALLSKY_SFC_SW_DWN.units='kW-hr/m^2/day';for(const key in parameter.ALLSKY_SFC_SW_DWN)parameter.ALLSKY_SFC_SW_DWN[key]=5;
 const kwh=parseNASA(payload,'2024-04-01');assert.deepEqual(mj,kwh);
 const source={...demoData('2024-04-01'),days:mj};assert.ok(analyze(source,'2027-04-01','wheat','loam',0).every(r=>r.demandModel==='fao56'));
 delete parameter.WS2M['20240402'];const incomplete=parseNASA(payload,'2024-04-01');assert.equal(incomplete[1].et0,null);assert.ok(analyze({...source,days:incomplete},'2027-04-01','wheat','loam',0).every(r=>r.demandModel==='illustrative'));
 assert.equal(wheatStage(20,defaultWheat),1);assert.equal(wheatKc(45,defaultWheat),1.15);assert.equal(wheatKc(135,defaultWheat),0);
});
