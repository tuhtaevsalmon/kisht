import {addDays,analyze,type IrrigationEvent,type SoilId,type SourceData,type WaterOptions} from './domain.ts';
import {parseLiveNASA} from './liveData.ts';
import {windowDates} from './climate.ts';
import {seasonLength} from './season.ts';
import type {WheatProfile} from './evapotranspiration.ts';

export interface PlanYear {year:number;sources:SourceData[]}
export interface PlanMetrics {water:number;unmet:number;waterDays:number;heat:number;frost:number;complete:boolean}
export interface PlanReplay extends PlanMetrics {year:number;source:SourceData;events:IrrigationEvent[];days:number}
export interface PlantingPlan {date:string;shift:number;years:PlanReplay[];median:Omit<PlanMetrics,'complete'>;completeYears:number;replay:PlanReplay;baseline:Omit<PlanMetrics,'complete'>}
export const median=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)]};
function metrics(rows:ReturnType<typeof analyze>):PlanMetrics{return {water:rows.reduce((s,r)=>s+r.grossIrrigation,0),unmet:rows.reduce((s,r)=>s+r.unmet,0),waterDays:rows.filter(r=>r.waterRisk).length,heat:rows.filter(r=>r.heat).length,frost:rows.filter(r=>r.frost).length,complete:rows[0]?.developmentMode!=='thermal'||rows.at(-1)?.cycleComplete===true};}
function medians(values:PlanMetrics[]):Omit<PlanMetrics,'complete'>{return {water:median(values.map(v=>v.water)),unmet:median(values.map(v=>v.unmet)),waterDays:median(values.map(v=>v.waterDays)),heat:median(values.map(v=>v.heat)),frost:median(values.map(v=>v.frost))};}

export async function loadPlanYears(lat:number,lon:number,planting:string,wheat:WheatProfile,signal:AbortSignal):Promise<PlanYear[]>{
 const duration=seasonLength('wheat',wheat);
 return Promise.all([2022,2023,2024].map(async year=>{
  const window=windowDates(planting,year,duration);
  const url=`https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,T2M_MIN,T2M_MAX,PRECTOTCORR,ALLSKY_SFC_SW_DWN,T2MDEW,WS2M,PS&community=AG&latitude=${lat.toFixed(6)}&longitude=${lon.toFixed(6)}&start=${window.start.replaceAll('-','')}&end=${window.end.replaceAll('-','')}&format=JSON`;
  const response=await fetch(url,{signal});if(!response.ok)throw Error(`NASA ${year}: HTTP ${response.status}`);
  const payload=await response.json(),fetchedAt=new Date().toISOString();signal.throwIfAborted();
  const sources=window.starts.map(start=>({days:parseLiveNASA(payload,start,duration),kind:'nasa' as const,start,end:addDays(start,duration-1),url,fetchedAt}));
  return {year,sources};
 }));
}

/** A declared comparison rule, not a calibrated yield or profit optimisation. */
export function compareAutomaticPlans(years:PlanYear[],planting:string,soil:SoilId,wheat:WheatProfile,options:WaterOptions):PlantingPlan[]{
 if(years.length!==3||new Set(years.map(y=>y.year)).size!==3||years.some(y=>y.sources.length!==3))throw Error('Three complete historical years are required');
 const expected=seasonLength('wheat',wheat);
 for(const year of years)for(const source of year.sources){
  if(source.kind!=='nasa'||source.days.length!==expected||source.days.some(d=>typeof d.et0!=='number'||!Number.isFinite(d.et0)))throw Error('Incomplete real-data comparison');
 }
 const baseline=medians(years.map(y=>metrics(analyze(y.sources[1],planting,'wheat',soil,0,{...options,wheat,automaticIrrigation:false,irrigationEvents:options.irrigationEvents??[]}))));
 const candidates=[-14,0,14].map((shift,index)=>{
  const date=addDays(planting,shift);
  const replays=years.map(({year,sources})=>{
   const source=sources[index],rows=analyze(source,date,'wheat',soil,0,{...options,wheat,automaticIrrigation:true,irrigationEvents:[]});
   return {...metrics(rows),year,source,days:rows.length,events:rows.filter(r=>r.grossIrrigation>0).map(r=>({date:r.date,mm:r.grossIrrigation}))};
  });
  const summary=medians(replays);
  const replay=[...replays].sort((a,b)=>Math.abs(a.water-summary.water)-Math.abs(b.water-summary.water)||a.year-b.year)[0];
  return {date,shift,years:replays,median:summary,completeYears:replays.filter(y=>y.complete).length,replay,baseline};
 });
 return candidates.sort((a,b)=>b.completeYears-a.completeYears||a.median.frost-b.median.frost||a.median.heat-b.median.heat||a.median.unmet-b.median.unmet||Math.abs(a.shift)-Math.abs(b.shift)||a.shift-b.shift);
}
