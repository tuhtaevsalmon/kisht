import {defaultWheat,validCropProfile,type CropProfile} from './evapotranspiration.ts';

function simulated(crop:string){return crop==='wheat'||crop==='corn'||crop==='potato'}
export function validDuration(days:number){return Number.isInteger(days)&&days>=1&&days<=365}
export function seasonLength(crop:string,profile:CropProfile=defaultWheat,otherDays=120){
 if(!validCropProfile(profile)||!validDuration(otherDays))throw Error('Invalid season profile');
 return simulated(crop)?(profile.thermal?.horizonDays??profile.stages.reduce((a,b)=>a+b,0)):otherDays;
}
