// FAO-56 equations 6, 11, 13, 21, 23–25, 37–40. Daily soil heat flux G=0.
export interface WeatherET {date:string;min:number;max:number;dew:number;wind:number;pressure:number;solarMJ:number;latitude:number;elevation:number}
export const vaporPressure=(temp:number)=>.6108*Math.exp(17.27*temp/(temp+237.3));
export function referenceET(w:WeatherET):number|null{
 if(![w.min,w.max,w.dew,w.wind,w.pressure,w.solarMJ,w.latitude,w.elevation].every(Number.isFinite)||w.min> w.max||w.min< -80||w.max>65||w.dew< -100||w.dew>w.max+1||w.wind<0||w.wind>75||w.pressure<30||w.pressure>110||w.solarMJ<0||w.solarMJ>50||Math.abs(w.latitude)>60||w.elevation< -500||w.elevation>9000)return null;
 const timestamp=Date.parse(w.date+'T12:00:00Z');if(!Number.isFinite(timestamp))return null;
 const year=new Date(timestamp).getUTCFullYear(),j=Math.floor((timestamp-Date.UTC(year,0,1))/86400000)+1;
 const phi=w.latitude*Math.PI/180,dr=1+.033*Math.cos(2*Math.PI*j/365),decl=.409*Math.sin(2*Math.PI*j/365-1.39),sunset=Math.acos(Math.max(-1,Math.min(1,-Math.tan(phi)*Math.tan(decl))));
 const ra=24*60/Math.PI*.0820*dr*(sunset*Math.sin(phi)*Math.sin(decl)+Math.cos(phi)*Math.cos(decl)*Math.sin(sunset));
 const rso=(.75+2e-5*w.elevation)*ra;if(rso<=0)return null;
 const temp=(w.min+w.max)/2,es=(vaporPressure(w.min)+vaporPressure(w.max))/2,ea=Math.min(es,vaporPressure(w.dew));
 const delta=4098*vaporPressure(temp)/(temp+237.3)**2,gamma=.000665*w.pressure;
 // Bound cloudiness for a daily estimate; avoid negative longwave on very dark days.
 const cloud= Math.max(.05,1.35*Math.min(1,w.solarMJ/rso)-.35);
 const rnl=4.903e-9*((w.max+273.16)**4+(w.min+273.16)**4)/2*Math.max(0,.34-.14*Math.sqrt(ea))*cloud;
 const rn=.77*w.solarMJ-rnl;
 const et=(.408*delta*rn+gamma*900/(temp+273)*w.wind*(es-ea))/(delta+gamma*(1+.34*w.wind));
 return Number.isFinite(et)?Math.max(0,et):null;
}
export interface WheatProfile {stages:[number,number,number,number];kc:[number,number,number];rootDepth:number;availableWater:number}
// FAO-56 Table 11 March/April 35–45° latitude example; not locally calibrated.
export const defaultWheat:WheatProfile={stages:[20,25,60,30],kc:[.3,1.15,.3],rootDepth:1,availableWater:110};
export function validWheat(p:WheatProfile){return p&&Array.isArray(p.stages)&&p.stages.length===4&&p.stages.every(n=>Number.isInteger(n)&&n>=1&&n<=180)&&p.stages.reduce((s,n)=>s+n,0)<=365&&Array.isArray(p.kc)&&p.kc.length===3&&p.kc.every(n=>Number.isFinite(n)&&n>=.1&&n<=2)&&Number.isFinite(p.rootDepth)&&p.rootDepth>=.1&&p.rootDepth<=2&&Number.isFinite(p.availableWater)&&p.availableWater>=20&&p.availableWater<=250}
export function wheatStage(day:number,p:WheatProfile){let end=0;for(let stage=0;stage<4;stage++){end+=p.stages[stage];if(day<end)return stage}return 4}
export function wheatKc(day:number,p:WheatProfile){const [a,b,c,d]=p.stages,[ini,mid,end]=p.kc;if(day<a)return ini;if(day<a+b)return ini+(mid-ini)*(day-a)/b;if(day<a+b+c)return mid;if(day<a+b+c+d)return mid+(end-mid)*(day-a-b-c)/d;return 0}
