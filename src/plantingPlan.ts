import {addDays,analogStart,analyze,validDate,type CropId,type IrrigationEvent,type SoilId,type SourceData,type WaterOptions} from './domain.ts';
import {parseLiveNASA} from './liveData.ts';
import {seasonLength} from './season.ts';
import type {CropProfile} from './evapotranspiration.ts';

export interface SearchRange {start:string;end:string}
export interface PlanYear {year:number;sources:SourceData[];dates?:string[];baseline?:SourceData}
export interface PlanMetrics {water:number;unmet:number;waterDays:number;heat:number;frost:number;complete:boolean}
export interface PlanReplay extends PlanMetrics {year:number;source:SourceData;events:IrrigationEvent[];days:number}
export interface PlantingPlan {date:string;shift:number;years:PlanReplay[];median:Omit<PlanMetrics,'complete'>;completeYears:number;replay:PlanReplay;baseline:Omit<PlanMetrics,'complete'>}
const historicalYears=[2022,2023,2024];
const historicalStart=(date:string,planting:string,year:number)=>analogStart(date,year+Number(date.slice(0,4))-Number(planting.slice(0,4)));
const dayDifference=(a:string,b:string)=>Math.round((Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/86400000);
function validPlanningDate(date:string){return validDate(date)&&date>='2001-01-01'&&date<='2100-12-31'}

/** Weekly samples plus both exact endpoints; a sample grid, not a continuous optimum. */
export function candidateDates(range:SearchRange):string[]{
 if(!range||!validPlanningDate(range.start)||!validPlanningDate(range.end)||range.start>range.end||range.start.slice(0,4)!==range.end.slice(0,4)||dayDifference(range.end,range.start)>120)throw Error('Choose a valid search range of at most 120 days within one year');
 const dates:string[]=[];
 for(let date=range.start;date<=range.end;date=addDays(date,7))dates.push(date);
 if(dates.at(-1)!==range.end)dates.push(range.end);
 return dates;
}
export function seasonRange(planting:string,season:'spring'|'summer'|'autumn'):SearchRange{
 if(!validPlanningDate(planting))throw Error('Invalid planting date');
 const ranges={spring:['03-01','05-31'],summer:['06-01','08-31'],autumn:['09-01','11-30']} as const;
 if(!(season in ranges))throw Error('Invalid season');
 const year=planting.slice(0,4),[start,end]=ranges[season];return {start:`${year}-${start}`,end:`${year}-${end}`};
}
function searchDates(planting:string,range?:SearchRange){
 if(!validPlanningDate(planting))throw Error('Invalid planting date');
 if(range&&range.start.slice(0,4)!==planting.slice(0,4))throw Error('Search range must use the planting year');
 const dates=range?candidateDates(range):[-14,0,14].map(shift=>addDays(planting,shift));
 if(dates.some(date=>!validPlanningDate(date)))throw Error('Search dates are outside the supported range');
 return dates;
}
export const median=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)]};
function metrics(rows:ReturnType<typeof analyze>):PlanMetrics{return {water:rows.reduce((s,r)=>s+r.grossIrrigation,0),unmet:rows.reduce((s,r)=>s+r.unmet,0),waterDays:rows.filter(r=>r.waterRisk).length,heat:rows.filter(r=>r.heat).length,frost:rows.filter(r=>r.frost).length,complete:rows[0]?.developmentMode!=='thermal'||rows.at(-1)?.cycleComplete===true};}
function medians(values:PlanMetrics[]):Omit<PlanMetrics,'complete'>{return {water:median(values.map(v=>v.water)),unmet:median(values.map(v=>v.unmet)),waterDays:median(values.map(v=>v.waterDays)),heat:median(values.map(v=>v.heat)),frost:median(values.map(v=>v.frost))};}

export async function loadPlanYears(lat:number,lon:number,planting:string,profile:CropProfile,signal:AbortSignal,range?:SearchRange,crop:CropId='wheat'):Promise<PlanYear[]>{
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>85||Math.abs(lon)>180)throw Error('Invalid field coordinates');
 const duration=seasonLength(crop,profile),dates=searchDates(planting,range);
 signal.throwIfAborted();
 return Promise.all(historicalYears.map(async year=>{
  // Map every proposed date independently: leap days must not shift later month/day samples.
  const starts=dates.map(date=>historicalStart(date,planting,year)),baselineStart=analogStart(planting,year);
  const requested=[...starts,baselineStart].sort(),start=requested[0],end=addDays(requested.at(-1)!,duration-1);
  const url=`https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,T2M_MIN,T2M_MAX,PRECTOTCORR,ALLSKY_SFC_SW_DWN,T2MDEW,WS2M,PS&community=AG&latitude=${lat.toFixed(6)}&longitude=${lon.toFixed(6)}&start=${start.replaceAll('-','')}&end=${end.replaceAll('-','')}&format=JSON`;
  const response=await fetch(url,{signal});if(!response.ok)throw Error(`NASA ${year}: HTTP ${response.status}`);
  const payload=await response.json(),fetchedAt=new Date().toISOString();signal.throwIfAborted();
  const source=(from:string):SourceData=>({days:parseLiveNASA(payload,from,duration),kind:'nasa',start:from,end:addDays(from,duration-1),url,fetchedAt});
  const sources=starts.map(source),baseline=starts.includes(baselineStart)?sources[starts.indexOf(baselineStart)]:source(baselineStart);
  return {year,sources,dates:[...dates],baseline};
 }));
}

function requireSource(source:SourceData|undefined,start:string,expected:number){
 if(!source||source.kind!=='nasa'||source.start!==start||source.end!==addDays(start,expected-1)||source.days.length!==expected||source.days.some((d,i)=>d.date!==addDays(start,i)||typeof d.et0!=='number'||!Number.isFinite(d.et0)||d.et0<0))throw Error('Incomplete real-data comparison or mismatched source dates');
}
/** A declared comparison rule, not a calibrated yield or profit optimisation. */
export function compareAutomaticPlans(years:PlanYear[],planting:string,soil:SoilId,profile:CropProfile,options:WaterOptions,range?:SearchRange,crop:CropId='wheat'):PlantingPlan[]{
 const dates=searchDates(planting,range),expected=seasonLength(crop,profile);
 if(years.length!==3||new Set(years.map(y=>y.year)).size!==3||historicalYears.some(year=>!years.some(y=>y.year===year))||years.some(y=>y.sources.length!==dates.length))throw Error('Three complete historical years are required');
 for(const year of years){
  if((range&&!year.dates)||year.dates&&(year.dates.length!==dates.length||year.dates.some((date,i)=>date!==dates[i])))throw Error('Mismatched candidate dates');
  year.sources.forEach((source,index)=>requireSource(source,historicalStart(dates[index],planting,year.year),expected));
  requireSource(year.baseline??(!range?year.sources[1]:undefined),analogStart(planting,year.year),expected);
 }
 const waterOpts={...options,wheat:profile,profile,automaticIrrigation:false as const,irrigationEvents:options.irrigationEvents??[]};
 const baseline=medians(years.map(y=>metrics(analyze(y.baseline??y.sources[1],planting,crop,soil,0,waterOpts))));
 const candidates=dates.map((date,index)=>{
  const shift=dayDifference(date,planting);
  const replays=years.map(({year,sources})=>{
   const source=sources[index],rows=analyze(source,date,crop,soil,0,{...options,wheat:profile,profile,automaticIrrigation:true,irrigationEvents:[]});
   return {...metrics(rows),year,source,days:rows.length,events:rows.filter(r=>r.grossIrrigation>0).map(r=>({date:r.date,mm:r.grossIrrigation}))};
  });
  const summary=medians(replays);
  const replay=[...replays].sort((a,b)=>Math.abs(a.water-summary.water)-Math.abs(b.water-summary.water)||a.year-b.year)[0];
  return {date,shift,years:replays,median:summary,completeYears:replays.filter(y=>y.complete).length,replay,baseline};
 });
 return candidates.sort((a,b)=>b.completeYears-a.completeYears||a.median.frost-b.median.frost||a.median.heat-b.median.heat||a.median.unmet-b.median.unmet||Math.abs(a.shift)-Math.abs(b.shift)||a.shift-b.shift);
}
