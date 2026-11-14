import {addDays,analogStart,type CropId} from './domain.ts';
export type RotationPlan=[CropId,CropId,CropId];
export function rotationCandidates(base:RotationPlan):RotationPlan[]{
 const second:RotationPlan=[...base];second[1]=base[1]==='legume'?'wheat':'legume';
 const third:RotationPlan=[base[0],base[1]==='corn'?'wheat':'corn',base[2]==='legume'?'wheat':'legume'];
 return [[...base],second,third];
}
export function rotationDates(planting:string){return [0,1,2].map(n=>analogStart(planting,Number(planting.slice(0,4))+n))}
export function rotationIndicators(seq:RotationPlan,previous:CropId|'unknown',dates:string[],lengths:number[]){
 const family=(c:CropId)=>c==='legume'?'legume':'cereal';
 const history=[previous,...seq];let repeats=0,familyRepeats=0;
 for(let i=1;i<history.length;i++){const prev=history[i-1];if(prev==='unknown')continue;if(prev===history[i])repeats++;if(family(prev as CropId)===family(history[i] as CropId))familyRepeats++;}
 const gaps=dates.slice(0,-1).map((date,i)=>Math.max(0,Math.round((Date.parse(dates[i+1])-Date.parse(addDays(date,lengths[i])))/86400000)));
 return {repeats,familyRepeats,legumeSeasons:seq.filter(c=>c==='legume').length,gaps};
}
