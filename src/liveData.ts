import {addDays,analogStart,parseNASA,validDate,type Daily,type Point,type SourceData} from './domain.ts';
import {validDuration} from './season.ts';
import {parseTerrain,terrainKey,type Terrain} from './terrain.ts';

export interface LocationRequest {lat:number;lon:number;signal?:AbortSignal}
export interface NASARequest extends LocationRequest {planting:string;year:number;duration:number}
export interface ForecastData {days:Daily[];fetchedAt:string;url:string}

function requireLocation(lat:number,lon:number){
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>85||Math.abs(lon)>180)throw Error('Invalid field coordinates');
}

/** A real-data run must never silently fall back to the illustrative demand model. */
export function parseLiveNASA(payload:any,start:string,duration:number):Daily[]{
 if(!validDate(start)||!validDuration(duration))throw Error('Invalid NASA date window');
 const units=payload?.parameters;
 for(const name of ['T2M','T2M_MIN','T2M_MAX']){
  if(units?.[name]?.units!=='C')throw Error(`NASA temperature units are missing or unsupported: ${name}`);
 }
 if(units?.PRECTOTCORR?.units!=='mm/day')throw Error('NASA precipitation units are missing or unsupported');
 let days:Daily[];
 try{days=parseNASA(payload,start,duration)}catch{throw Error('NASA returned an incomplete or invalid daily series');}
 if(days.some(d=>d.temp<d.min||d.temp>d.max||d.min>d.max))throw Error('NASA daily temperature values are inconsistent');
 if(days.some(d=>typeof d.et0!=='number'||!Number.isFinite(d.et0)||d.et0<0)){
  throw Error('NASA FAO-56 inputs are incomplete or unsupported; no illustrative fallback is used');
 }
 return days;
}

export async function loadNASA({lat,lon,planting,year,duration,signal}:NASARequest):Promise<SourceData>{
 requireLocation(lat,lon);
 if(!validDate(planting)||!Number.isInteger(year)||year<1981||year>2100||!validDuration(duration))throw Error('Invalid NASA season request');
 signal?.throwIfAborted();
 const start=analogStart(planting,year),end=addDays(start,duration-1);
 const url=`https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,T2M_MIN,T2M_MAX,PRECTOTCORR,ALLSKY_SFC_SW_DWN,T2MDEW,WS2M,PS&community=AG&longitude=${lon.toFixed(6)}&latitude=${lat.toFixed(6)}&start=${start.replaceAll('-','')}&end=${end.replaceAll('-','')}&format=JSON`;
 const response=await fetch(url,{signal});
 if(!response.ok)throw Error(`NASA POWER request failed (${response.status})`);
 const days=parseLiveNASA(await response.json(),start,duration);
 signal?.throwIfAborted();
 // This timestamp records this retrieval. No old cache is relabelled as newly fetched.
 return {days,start,end,url,fetchedAt:new Date().toISOString(),kind:'nasa'};
}

/** Strict chronological seven-day forecast, kept separate from historical scenarios. */
export function parseLiveForecast(payload:any):Daily[]{
 const d=payload?.daily,units=payload?.daily_units;
 if(units?.temperature_2m_min!=='°C'||units?.temperature_2m_max!=='°C'||units?.precipitation_sum!=='mm')throw Error('Forecast units are missing or unsupported');
 if(!Array.isArray(d?.time)||d.time.length!==7||
  !['temperature_2m_min','temperature_2m_max','precipitation_sum'].every(k=>Array.isArray(d[k])&&d[k].length===7)){
  throw Error('The weather service did not return a complete seven-day forecast');
 }
 return d.time.map((date:unknown,i:number)=>{
  if(typeof date!=='string'||!validDate(date)||(i>0&&date!==addDays(d.time[0],i)))throw Error('Forecast dates are missing, duplicated or out of order');
  const min=d.temperature_2m_min[i],max=d.temperature_2m_max[i],rain=d.precipitation_sum[i];
  if(![min,max,rain].every(x=>typeof x==='number'&&Number.isFinite(x))||min>max||min< -80||max>65||rain<0)throw Error('Forecast contains missing or invalid measurements');
  return {date,min,max,temp:(min+max)/2,rain,solar:null};
 });
}

export async function loadForecast({lat,lon,signal}:LocationRequest):Promise<ForecastData>{
 requireLocation(lat,lon);signal?.throwIfAborted();
 const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(6)}&longitude=${lon.toFixed(6)}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&temperature_unit=celsius&precipitation_unit=mm&timezone=Asia%2FDushanbe&forecast_days=7`;
 const response=await fetch(url,{signal});
 if(!response.ok)throw Error(`Weather forecast request failed (${response.status})`);
 const days=parseLiveForecast(await response.json());signal?.throwIfAborted();
 return {days,url,fetchedAt:new Date().toISOString()};
}

export async function loadTerrain(plot:Point[],signal?:AbortSignal):Promise<Terrain>{
 const key=terrainKey(plot);signal?.throwIfAborted();
 const response=await fetch('/api/terrain?bounds='+encodeURIComponent(key),{signal});
 if(!response.ok)throw Error(`SRTM terrain request failed (${response.status})`);
 const terrain=parseTerrain(await response.json(),key);
 if(terrain.resolution!==30||typeof terrain.source!=='string'||!terrain.source.includes('SRTM')||typeof terrain.fetchedAt!=='string'||!Number.isFinite(Date.parse(terrain.fetchedAt))){
  throw Error('SRTM source metadata is incomplete');
 }
 signal?.throwIfAborted();return terrain;
}
