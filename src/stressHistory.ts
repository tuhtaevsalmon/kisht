import type {SeasonRow} from './riskEvents.ts';

// Summarise only elapsed days; later rainfall must not erase past unmet demand.
export function stressHistory(rows:SeasonRow[], day:number){
 const elapsed=rows.slice(0,Math.max(0,Math.min(rows.length,Math.floor(day)+1)));
 let unmet=0,demand=0,limitedDays=0,currentStreak=0;
 for(const r of elapsed){
  unmet+=r.unmet; demand+=r.demand;
  if(r.unmet>1e-6){limitedDays++;currentStreak++}else currentStreak=0;
 }
 return {unmet,demand,limitedDays,currentStreak,coverage:demand>0?Math.max(0,Math.min(1,1-unmet/demand)):1};
}
