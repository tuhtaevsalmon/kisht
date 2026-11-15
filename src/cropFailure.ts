import {cropParams,type CropId} from './domain.ts';

export type FailureCause='drought'|'cold'|'heat';

/**
 * Air minimum at or below this line stops growth for the rest of the scenario.
 * A stated rule for the picture, not a measured killing temperature of a cultivar.
 */
export const killingMinimum:Record<CropId,number>={
 wheat:-6,barley:-6,cabbage:-5,alfalfa:-6,
 onion:-3,carrot:-3,legume:-2,
 potato:0,corn:0,rice:0,cotton:0,sunflower:0,tomato:0,cucumber:0,
};
/** Consecutive days of severe water shortage required before growth stops. */
export const droughtRun=5;
/** Consecutive days this far above the heat signal before growth stops. */
export const heatRun=5;
export const heatAbove=8;

export interface FateInput{
 min:number;max:number;demand:number;actual:number;
 storage:number;stressThreshold:number;developmentProgress:number;
}
export interface FateDay{
 dead:boolean;cause:FailureCause|null;diedIndex:number|null;growth:number;
 killingMinimum:number;heatLine:number;
}

function severeDrought(row:FateInput){
 return row.demand>0.4&&row.actual<row.demand*0.5&&row.storage<row.stressThreshold;
}

/** Freeze visual growth once a stated critical run is crossed. Earlier days stay unchanged. */
export function cropFailure<T extends FateInput>(rows:T[],crop:CropId):FateDay[]{
 const kill=killingMinimum[crop],heatLine=cropParams[crop].heat+heatAbove;
 let cause:FailureCause|null=null,diedIndex:number|null=null,dry=0,hot=0;
 return rows.map((row,i)=>{
  if(cause===null){
   dry=severeDrought(row)?dry+1:0;
   hot=row.max>=heatLine?hot+1:0;
   if(row.min<=kill){cause='cold';diedIndex=i;}
   else if(i>=10&&dry>=droughtRun){cause='drought';diedIndex=i;}
   else if(hot>=heatRun){cause='heat';diedIndex=i;}
  }
  const dead=diedIndex!==null&&i>=diedIndex;
  return {dead,cause:dead?cause:null,diedIndex:dead?diedIndex:null,growth:dead?rows[diedIndex!].developmentProgress:row.developmentProgress,killingMinimum:kill,heatLine};
 });
}
