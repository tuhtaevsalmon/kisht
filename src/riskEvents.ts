import {type analyze} from './domain.ts';
export type SeasonRow=ReturnType<typeof analyze>[number];
export type RiskKind='waterRisk'|'heat'|'frost';
export interface RiskPeriod {start:number;end:number;days:number}
export function riskPeriods(rows:SeasonRow[],kind:RiskKind):RiskPeriod[]{const result:RiskPeriod[]=[];rows.forEach((r,i)=>{if(!r[kind])return;const last=result.at(-1);if(last&&last.end===i-1){last.end=i;last.days++}else result.push({start:i,end:i,days:1})});return result;}
