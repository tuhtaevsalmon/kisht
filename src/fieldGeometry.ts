import {type Point,validPolygon} from './domain.ts';
export type XY=[number,number];
export function normalizeField(plot:Point[]):XY[]{if(!validPolygon(plot))return [[-3,-2], [3,-2],[3,2],[-3,2]];const lat=(Math.min(...plot.map(p=>p[0]))+Math.max(...plot.map(p=>p[0])))/2,lon=plot.reduce((s,p)=>s+p[1],0)/plot.length;const p:XY[]=plot.map(v=>[(v[1]-lon)*Math.cos(lat*Math.PI/180),-(v[0]-lat)]);const xs=p.map(v=>v[0]),zs=p.map(v=>v[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs),scale=6/Math.max(maxX-minX,maxZ-minZ);return p.map(v=>[(v[0]-(maxX+minX)/2)*scale,(v[1]-(maxZ+minZ)/2)*scale]);}
export function inside(x:number,z:number,p:XY[]){let yes=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
/** A large field keeps the same frame, so its plants stand a little taller and closer together. */
export function cropStand(hectares:number){
 const span=Math.max(0,Math.min(1,(hectares-.8)/4));
 return {stepX:.5-span*.14,stepZ:.42-span*.12,scale:1+span*.18};
}
export function plantingPositions(p:XY[],stepX=.5,stepZ=.42):XY[]{const result:XY[]=[];for(let x=-2.85;x<3;x+=stepX)for(let z=-2.85;z<3;z+=stepZ)if(inside(x,z,p)&&inside(x+.13,z,p)&&inside(x-.13,z,p)&&inside(x,z+.13,p)&&inside(x,z-.13,p))result.push([x,z]);return result;}
/** Visual plant lean from the ground slope. The terrain mesh stays at real scale; the lean is only a bit stronger so a hillside reads in the scene. */
export function groundTilt(east:number,west:number,north:number,south:number,step=.45){
 const hx=east-west,hz=north-south,horiz=Math.hypot(hx,hz);
 const shown=Math.min(horiz/(2*step)*7,.75);
 if(horiz<1e-8)return {x:0,y:1,z:0};
 return {x:-hx/horiz*shown,y:1,z:-hz/horiz*shown};
}
