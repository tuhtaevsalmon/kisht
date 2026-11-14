import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyze,demoData,parseNASA,addDays} from './domain.ts';
import {referenceET,defaultWheat,wheatKc,wheatStage} from './evapotranspiration.ts';
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
