import {cropParams,soilIntake,type IrrigationEvent,type SoilId} from './domain.ts';
import {rootStress} from './rootZone.ts';
import type {CropProfile,SimulatedCrop} from './evapotranspiration.ts';

export interface ForecastSlice {date:string;max:number;rain:number}
export interface FieldWater {
 days:number;needMm:number;heat:number;inletMm:number;
 dailyM3:number;weeklyM3:number;seasonM3:number;
 capacityMm:number;reserveMm:number;reserveDays:number;
}
export function fieldWater(crop:SimulatedCrop,profile:CropProfile,areaHa:number,efficiency:number,storageFraction:number):FieldWater{
 const days=profile.stages.reduce((sum,n)=>sum+n,0);
 const needMm=cropParams[crop].need;
 const inletMm=efficiency>0?needMm/efficiency:needMm;
 const area=Math.max(0,areaHa);
 const m3=(mm:number)=>mm*area*10;
 const capacityMm=profile.availableWater*profile.rootDepth;
 const reserveMm=capacityMm*Math.min(1,Math.max(0,storageFraction));
 return {days,needMm,heat:cropParams[crop].heat,inletMm,dailyM3:m3(inletMm),weeklyM3:m3(inletMm*7),seasonM3:m3(inletMm*days),capacityMm,reserveMm,reserveDays:needMm>0?reserveMm/needMm:0};
}

/** Keep the current crop when its typical week fits. Otherwise the largest week that fits, or the smallest need if none do. */
export function suggestCrop(limitM3:number|null,areaHa:number,efficiency:number,crops:readonly SimulatedCrop[],current:SimulatedCrop):{crop:SimulatedCrop;fits:boolean}|null{
 if(limitM3===null||!(areaHa>0)||!(efficiency>0)||!crops.length)return null;
 const ranked=crops.map((crop,index)=>({crop,index,weekly:cropParams[crop].need/efficiency*7*areaHa*10}));
 const currentWeek=ranked.find(item=>item.crop===current);
 if(currentWeek&&currentWeek.weekly<=limitM3+1e-6)return {crop:current,fits:true};
 const fits=ranked.filter(item=>item.weekly<=limitM3+1e-6).sort((a,b)=>b.weekly-a.weekly||a.index-b.index);
 if(fits.length)return {crop:fits[0].crop,fits:true};
 return {crop:[...ranked].sort((a,b)=>a.weekly-b.weekly||a.index-b.index)[0].crop,fits:false};
}

export type WeekAction=
 |{kind:'postpone';date:string;rain:number;need:number;scheduled:number;reserveDays:number}
 |{kind:'before-heat';irrigateOn:string;hotDate:string;hotMax:number;storage:number;threshold:number;need:number;reserveDays:number}
 |{kind:'covered';reserveDays:number;need:number;rainMm:number}
 |{kind:'short';reserveDays:number;need:number;rainMm:number;coveredDays:number};

export function weekAction(days:ForecastSlice[],crop:SimulatedCrop,profile:CropProfile,soil:SoilId,storageFraction:number,events:readonly IrrigationEvent[]):WeekAction{
 const need=cropParams[crop].need,heat=cropParams[crop].heat,intake=soilIntake[soil];
 const capacity=Math.max(0,profile.availableWater*profile.rootDepth);
 const reserve=capacity*Math.min(1,Math.max(0,storageFraction));
 const reserveDays=need>0?reserve/need:0;
 const threshold=capacity>0?rootStress(reserve,capacity,need,profile.depletionFraction??.55).stressThreshold:0;
 const scheduledOn=(date:string)=>events.filter(event=>event.date===date).reduce((sum,event)=>sum+event.mm,0);
 let storage=reserve,postpone:Extract<WeekAction,{kind:'postpone'}>|null=null,before:Extract<WeekAction,{kind:'before-heat'}>|null=null,coveredDays=0;
 days.forEach((day,index)=>{
  const scheduled=scheduledOn(day.date);
  if(!postpone&&scheduled>0&&day.rain+1e-9>=need)postpone={kind:'postpone',date:day.date,rain:day.rain,need,scheduled,reserveDays};
  const morning=Math.min(capacity,storage+Math.min(Math.max(0,day.rain),intake));
  const irrigateOn=index>0?days[index-1].date:day.date;
  if(!before&&day.max>heat&&morning+1e-9<threshold&&scheduledOn(irrigateOn)<=0)before={kind:'before-heat',irrigateOn,hotDate:day.date,hotMax:day.max,storage:morning,threshold,need,reserveDays};
  if(morning+1e-9>=need)coveredDays++;
  storage=Math.max(0,morning-need);
 });
 const rainMm=days.reduce((sum,day)=>sum+day.rain,0);
 if(postpone)return postpone;
 if(before)return before;
 if(reserveDays>=days.length)return {kind:'covered',reserveDays,need,rainMm};
 return {kind:'short',reserveDays,need,rainMm,coveredDays};
}
