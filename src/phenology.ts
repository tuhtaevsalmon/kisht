export interface ThermalProfile {
 base:number; upper:number; stages:[number,number,number,number]; horizonDays:number;
}
// Explicit sensitivity-example inputs, NOT calibrated spring-wheat cultivar values.
export const exampleThermal:ThermalProfile={base:0,upper:30,stages:[400,500,1200,600],horizonDays:180};
export function validThermal(p:ThermalProfile){
 return !!p&&Number.isFinite(p.base)&&Number.isFinite(p.upper)&&p.base>=-5&&p.upper<=45&&p.upper>p.base&&
 Array.isArray(p.stages)&&p.stages.length===4&&p.stages.every(x=>Number.isFinite(x)&&x>=1&&x<=5000)&&
 Number.isInteger(p.horizonDays)&&p.horizonDays>=1&&p.horizonDays<=365;
}
// FAO AquaCrop reference manual §3.3, Method 1: clamp the daily mean.
export function growingDegreeDays(min:number,max:number,p:ThermalProfile){
 if(!validThermal(p)||!Number.isFinite(min)||!Number.isFinite(max)||min>max)throw Error('Invalid thermal-time inputs');
 return Math.max(0,Math.min(p.upper,(min+max)/2)-p.base);
}
// Map each GDD interval to the corresponding FAO Kc/root-development interval.
// This coupling is a scenario approximation, not the complete AquaCrop model.
export function equivalentDevelopmentDay(gdd:number,p:ThermalProfile,days:readonly number[]){
 let thermalStart=0,dayStart=0;
 for(let i=0;i<4;i++){
  if(gdd<thermalStart+p.stages[i])return dayStart+Math.max(0,gdd-thermalStart)/p.stages[i]*days[i];
  thermalStart+=p.stages[i];dayStart+=days[i];
 }
 return dayStart;
}
