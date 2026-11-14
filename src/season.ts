import {defaultWheat,validWheat,type WheatProfile} from './evapotranspiration.ts';
export function validDuration(days:number){return Number.isInteger(days)&&days>=1&&days<=365}
export function seasonLength(crop:string,wheat:WheatProfile=defaultWheat,otherDays=120){
 if(!validWheat(wheat)||!validDuration(otherDays))throw Error('Invalid season profile');
 return crop==='wheat'?wheat.stages.reduce((a,b)=>a+b,0):otherDays;
}
