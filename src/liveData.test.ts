import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addDays} from './domain.ts';
import {parseLiveNASA,parseLiveForecast} from './liveData.ts';

// Provider-shaped test fixtures only; never loaded by the application.
function nasaFixture(){
 const values:Record<string,number>={T2M:20,T2M_MIN:12,T2M_MAX:28,PRECTOTCORR:0,ALLSKY_SFC_SW_DWN:20,T2MDEW:9,WS2M:2,PS:95};
 const units:Record<string,string>={T2M:'C',T2M_MIN:'C',T2M_MAX:'C',PRECTOTCORR:'mm/day',ALLSKY_SFC_SW_DWN:'MJ/m^2/day',T2MDEW:'C',WS2M:'m/s',PS:'kPa'};
 return {geometry:{coordinates:[68.55,38.53,500]},parameters:Object.fromEntries(Object.entries(units).map(([k,v])=>[k,{units:v}])),properties:{parameter:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{'20240401':v,'20240402':v}]))}};
}
function forecastFixture(){return {daily_units:{temperature_2m_min:'°C',temperature_2m_max:'°C',precipitation_sum:'mm'},daily:{time:Array.from({length:7},(_,i)=>addDays('2026-11-14',i)),temperature_2m_min:Array(7).fill(4),temperature_2m_max:Array(7).fill(14),precipitation_sum:Array(7).fill(0)}};}

test('real NASA gate accepts measured zero rain but rejects incomplete FAO input',()=>{
 const p=nasaFixture();const days=parseLiveNASA(p,'2024-04-01',2);
 assert.equal(days.length,2);assert.equal(days[0].rain,0);assert.ok(days.every(d=>typeof d.et0==='number'&&d.et0>0));
 p.properties.parameter.WS2M['20240402']=-999;
 assert.throws(()=>parseLiveNASA(p,'2024-04-01',2),/no illustrative fallback/);
});
test('real NASA gate rejects wrong units, missing final dates and inconsistent temperatures',()=>{
 const units=nasaFixture();units.parameters.PS.units='Pa';assert.throws(()=>parseLiveNASA(units,'2024-04-01',2),/no illustrative fallback/);
 const rain=nasaFixture();rain.parameters.PRECTOTCORR.units='inches';assert.throws(()=>parseLiveNASA(rain,'2024-04-01',2),/units/);
 const missing=nasaFixture();delete (missing.properties.parameter.T2M as Record<string,number>)['20240402'];assert.throws(()=>parseLiveNASA(missing,'2024-04-01',2),/incomplete/);
 const temp=nasaFixture();temp.properties.parameter.T2M['20240401']=40;assert.throws(()=>parseLiveNASA(temp,'2024-04-01',2),/inconsistent/);
});
test('forecast gate accepts seven consecutive days and genuine zero rain',()=>{
 const days=parseLiveForecast(forecastFixture());assert.equal(days.length,7);assert.equal(days[6].date,'2026-11-20');assert.ok(days.every(d=>d.rain===0));
});
test('forecast gate rejects nulls, duplicate dates, truncated arrays and mismatched units',()=>{
 const empty=forecastFixture();(empty.daily.precipitation_sum as unknown[])[3]=null;assert.throws(()=>parseLiveForecast(empty),/missing or invalid/);
 const duplicate=forecastFixture();duplicate.daily.time[4]=duplicate.daily.time[3];assert.throws(()=>parseLiveForecast(duplicate),/dates/);
 const short=forecastFixture();short.daily.temperature_2m_max.pop();assert.throws(()=>parseLiveForecast(short),/complete seven-day/);
 const units=forecastFixture();units.daily_units.temperature_2m_min='°F';assert.throws(()=>parseLiveForecast(units),/units/);
});
