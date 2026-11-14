import type {WheatProfile} from './evapotranspiration.ts';
// Linear root growth is a scenario assumption, not measured phenology.
export function rootDepthAt(day:number,p:WheatProfile){
 const start=p.initialRootDepth??Math.min(.2,p.rootDepth);
 const progress=Math.max(0,Math.min(1,day/(p.stages[0]+p.stages[1])));
 return start+(p.rootDepth-start)*progress;
}
// FAO-56 equations 83, 84 and the ETc adjustment to depletion fraction p.
// Single Kc approximation: Ks also scales soil evaporation; no dual-Kc partition.
export function rootStress(storage:number,taw:number,demand:number,baseP=.55){
 const p=Math.min(.8,Math.max(.1,baseP+.04*(5-demand)));
 const raw=p*taw,depletion=Math.max(0,taw-storage);
 const ks=depletion<=raw?1:Math.max(0,Math.min(1,storage/((1-p)*taw)));
 return {p,raw,depletion,ks,stressThreshold:(1-p)*taw};
}
