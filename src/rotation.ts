import {addDays,analogStart,type CropId} from './domain.ts';
export type RotationPlan=[CropId,CropId,CropId];
export function rotationCandidates(base:RotationPlan):RotationPlan[]{
 const second:RotationPlan=[...base];second[1]=base[1]==='legume'?'wheat':'legume';
 const third:RotationPlan=[base[0],base[1]==='corn'?'wheat':'corn',base[2]==='legume'?'wheat':'legume'];
 return [[...base],second,third];
}
export function rotationDates(planting:string){return [0,1,2].map(n=>analogStart(planting,Number(planting.slice(0,4))+n))}
export function rotationIndicators(seq:RotationPlan,previous:CropId|'unknown',dates:string[],lengths:number[]){
 const family=(c:CropId)=>c==='legume'||c==='alfalfa'?'legume':c==='potato'||c==='carrot'||c==='onion'?'root':c==='tomato'||c==='cucumber'||c==='cabbage'?'vegetable':c==='sunflower'||c==='cotton'?'broadleaf':'cereal';
 const history=[previous,...seq];let repeats=0,familyRepeats=0;
 for(let i=1;i<history.length;i++){const prev=history[i-1];if(prev==='unknown')continue;if(prev===history[i])repeats++;if(family(prev as CropId)===family(history[i] as CropId))familyRepeats++;}
 const gaps=dates.slice(0,-1).map((date,i)=>Math.max(0,Math.round((Date.parse(dates[i+1])-Date.parse(addDays(date,lengths[i])))/86400000)));
 return {repeats,familyRepeats,legumeSeasons:seq.filter(c=>c==='legume'||c==='alfalfa').length,gaps};
}
/** A sequence comparison. It does not measure organic matter or nitrogen. */
export function soilSequenceIndex(stats:{familyRepeats:number;legumeSeasons:number;gaps:number[]}){
 const extraGap=stats.gaps.reduce((sum,gap)=>sum+Math.max(0,gap-180),0);
 const gapPenalty=Math.floor(extraGap/10);
 const legumeCredit=Math.min(3,stats.legumeSeasons)*15;
 const repeatPenalty=stats.familyRepeats*20;
 const score=Math.max(0,Math.min(100,100-repeatPenalty+legumeCredit-gapPenalty));
 return {score,extraGap,gapPenalty,legumeCredit,repeatPenalty};
}
export type FarmerPriority='water'|'soil'|'cover';
export interface PlanRank {soilScore:number;extraGap:number;totalGap:number;waterRiskDays?:number;unmetMm?:number;irrigationMm?:number}
/** Orders plans for the selected farmer priority. Equal plans keep their original order. Water order waits until every plan has a weather comparison. */
export function rankPlans<T extends PlanRank>(plans:T[],priority:FarmerPriority):T[]{
 const waiting=priority==='water'&&plans.some(plan=>plan.waterRiskDays===undefined);
 const key=(plan:T)=>waiting?[0]:priority==='soil'?[-plan.soilScore]:priority==='cover'?[plan.extraGap,plan.totalGap]:[plan.waterRiskDays??0,plan.unmetMm??0,plan.irrigationMm??0];
 return plans.map((plan,index)=>({plan,index,key:key(plan)})).sort((a,b)=>{
  for(let i=0;i<Math.max(a.key.length,b.key.length);i++){const diff=(a.key[i]??0)-(b.key[i]??0);if(diff)return diff}
  return a.index-b.index;
 }).map(item=>item.plan);
}
