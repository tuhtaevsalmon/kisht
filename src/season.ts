import {defaultProfiles,defaultWheat,validCropProfile,type CropProfile} from './evapotranspiration.ts';

function simulated(crop:string){return Object.prototype.hasOwnProperty.call(defaultProfiles,crop)}
export function validDuration(days:number){return Number.isInteger(days)&&days>=1&&days<=365}
export function seasonLength(crop:string,profile?:CropProfile,otherDays=120){
 profile=profile??(simulated(crop)?defaultProfiles[crop as keyof typeof defaultProfiles]:defaultWheat);
 if(!validCropProfile(profile)||!validDuration(otherDays))throw Error('Invalid season profile');
 return simulated(crop)?(profile.thermal?.horizonDays??profile.stages.reduce((a,b)=>a+b,0)):otherDays;
}
