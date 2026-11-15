import {terrainHeight,terrainDirections,type Terrain} from './terrain';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {OrbitControls,ContactShadows} from '@react-three/drei';
import {memo,useRef,useMemo,useEffect,useLayoutEffect} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {type Crop} from './model';
import {type Point} from './domain';
import {normalizeField,plantingPositions,inside,type XY} from './fieldGeometry';

const ORBIT_TARGET:[number,number,number]=[0,.22,0];
/** Continuous growth is shown by instance scale; rebuild mesh only on coarse morphological steps. */
function geometryStep(progress:number,waterStress:number){
 return (progress<.2?0:progress<.48?1:progress<.72?2:3)*2+(waterStress>.45?1:0);
}
function geometryProgress(step:number){return [0.12,0.12,0.35,0.35,0.6,0.6,0.85,0.85][step]??0.7}
function geometryStress(step:number){return step%2?0.7:0.15}

export interface FieldProps {
 waterStress?:number;rootFraction?:number;showFlow?:boolean;terrain?:Terrain;
 growth:number;crop:Crop;moisture:number;watering:boolean;raining:boolean;
 cut:boolean;stress:boolean;plot?:Point[];frost?:boolean;
 irrigationMethod?:'surface'|'sprinkler'|'drip';windSpeed?:number;
}
type Props=FieldProps;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const noise=(n:number)=>{const a=Math.sin(n*127.1+311.7)*43758.5453;return a-Math.floor(a)};
function emptyGeometry(){
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute([],3));
 return g;
}
function combine(parts:THREE.BufferGeometry[]){
 if(!parts.length)return emptyGeometry();
 const flat=parts.map(p=>{const g=p.index?p.toNonIndexed():p.clone();g.deleteAttribute('uv');return g});
 const g=mergeGeometries(flat,false);parts.forEach(p=>p.dispose());flat.forEach(p=>p.dispose());
 return g??emptyGeometry();
}
function stemBetween(a:THREE.Vector3,b:THREE.Vector3,r:number){
 const d=b.clone().sub(a),g=new THREE.CylinderGeometry(r*.7,r,d.length(),5);
 g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));
 g.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);return g;
}
// Tapered, curved blades with a central ridge: schematic morphology, not measured biomass.
function blade(length:number,width:number,bend:number){
 const v:number[]=[],idx:number[]=[];
 for(let i=0;i<=10;i++){
  const t=i/10,w=width*Math.pow(Math.sin(Math.PI*t),.65),y=length*(t*.7-bend*t*t),z=length*t*.75;
  v.push(-w,y,z,0,y+w*.22,z,w,y,z);
  if(i<10){const k=i*3;idx.push(k,k+3,k+1,k+1,k+3,k+4,k+1,k+4,k+2,k+2,k+4,k+5)}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
function sphere(sx:number,sy:number,sz:number,x:number,y:number,z:number){
 const g=new THREE.SphereGeometry(1,6,5);g.scale(sx,sy,sz);g.translate(x,y,z);return g;
}
function plantGeometry(crop:Crop,progress:number,waterStress:number){
 const stems:THREE.BufferGeometry[]=[],leaves:THREE.BufferGeometry[]=[],ears:THREE.BufferGeometry[]=[],awns:THREE.BufferGeometry[]=[];
 if(crop==='onion'){
  ears.push(sphere(.07,.05,.07,0,.03,0));
  for(let j=0;j<5;j++){const a=j/5*Math.PI*2;stems.push(stemBetween(new THREE.Vector3(Math.cos(a)*.02,.04,Math.sin(a)*.02),new THREE.Vector3(Math.cos(a)*.05,.42,Math.sin(a)*.05),.006))}
  return [combine(stems),combine(leaves),combine(ears),combine(awns)];
 }
 if(crop==='sunflower'){
  stems.push(stemBetween(new THREE.Vector3(0,0,0),new THREE.Vector3(0,1.15,0),.02));
  for(let j=0;j<4;j++){const leaf=blade(.42,.12,.25+waterStress*.4);leaf.rotateY(j*1.6);leaf.translate(0,.35+j*.16,0);leaves.push(leaf)}
  if(progress>.48){
   const disk=new THREE.CylinderGeometry(.15,.15,.045,10);disk.rotateX(1.15);disk.translate(0,1.22,.05);ears.push(disk);
   for(let j=0;j<8;j++){const a=j/8*Math.PI*2;awns.push(sphere(.04,.1,.02,Math.cos(a)*.18,1.22,Math.sin(a)*.1))}
  }
  return [combine(stems),combine(leaves),combine(ears),combine(awns)];
 }
 if(crop==='cabbage'){
  for(let j=0;j<6;j++){const leaf=blade(.3,.15,.6);leaf.rotateY(j);leaf.translate(0,.04,0);leaves.push(leaf)}
  ears.push(sphere(.17,.14,.17,0,.16,0));
  return [combine(stems),combine(leaves),combine(ears),combine(awns)];
 }
 const bush=crop==='legume'||crop==='potato'||crop==='alfalfa'||crop==='tomato'||crop==='cucumber'||crop==='cotton';
 const tillers=crop==='wheat'||crop==='barley'?3:crop==='rice'?5:1;
 for(let k=0;k<tillers;k++){
  const angle=k*2.4,offset=k===0?0:.045,x=Math.cos(angle)*offset,z=Math.sin(angle)*offset;
  const h=crop==='corn'?1.35:crop==='cotton'?.72:crop==='barley'?.68:crop==='rice'?.58:crop==='carrot'?.28:bush?(crop==='cucumber'?.22:crop==='alfalfa'?.36:crop==='tomato'?.52:crop==='potato'?.48:.56):(k===0?.85:.72);
  stems.push(stemBetween(new THREE.Vector3(x,0,z),new THREE.Vector3(x,h,z),crop==='corn'?.019:crop==='carrot'?.005:.008));
  const count=progress<.2?2:crop==='corn'?7:crop==='carrot'?8:bush?6:crop==='rice'?3:4;
  for(let j=0;j<count;j++){
   const leaf=blade(crop==='corn'?.55:crop==='carrot'?.16:bush?.23:.32,crop==='corn'?.055:crop==='carrot'?.04:bush?.09:.018,.32+waterStress*.75);
   leaf.rotateY(j*2.4+angle);leaf.translate(x,h*(.15+j*.1),z);leaves.push(leaf);
  }
  if(progress>.48){
   if(crop==='wheat'){
    stems.push(stemBetween(new THREE.Vector3(x,h,z),new THREE.Vector3(x,h+.19,z),.005));
    for(let j=0;j<7;j++)for(const side of [-1,1]){
     const grain=new THREE.SphereGeometry(1,5,4);grain.scale(.024,.038,.017);grain.rotateZ(side*-.35);grain.translate(x+side*.017,h+.025*j,z);ears.push(grain);
     awns.push(stemBetween(new THREE.Vector3(x+side*.025,h+.025*j,z),new THREE.Vector3(x+side*.07,h+.025*j+.11,z+.01),.0013));
    }
   }else if(crop==='barley'){
    stems.push(stemBetween(new THREE.Vector3(x,h,z),new THREE.Vector3(x+.1,h+.08,z),.004));
    for(let j=0;j<6;j++)ears.push(sphere(.018,.03,.012,x+.02+j*.016,h+.12-j*.02,z));
   }else if(crop==='rice'){
    stems.push(stemBetween(new THREE.Vector3(x,h,z),new THREE.Vector3(x+.07,h+.06,z),.003));
    for(let j=0;j<5;j++)ears.push(sphere(.01,.018,.008,x+j*.014,h+.08-j*.012,z));
   }else if(crop==='corn'){
    const cob=new THREE.SphereGeometry(1,7,6);cob.scale(.065,.19,.065);cob.rotateZ(-.22);cob.translate(.07,.74,0);ears.push(cob);
    for(let j=0;j<5;j++)awns.push(stemBetween(new THREE.Vector3(0,h,0),new THREE.Vector3((j-2)*.04,h+.18-Math.abs(j-2)*.03,.015),.004));
   }else if(crop==='potato'){
    for(let j=0;j<4;j++)ears.push(sphere(.04,.028,.032,j%2?.08:-.08,.04+j*.02,j>1?.07:-.05));
   }else if(crop==='cotton'){
    for(let j=0;j<3;j++)ears.push(sphere(.045,.05,.045,j===1?0:j?-.1:.1,.28+j*.1,j===1?.08:0));
   }else if(crop==='tomato'){
    for(let j=0;j<3;j++)ears.push(sphere(.05,.048,.05,j===1?0:j?.12:-.1,.22+j*.08,j===1?.06:0));
   }else if(crop==='cucumber'){
    ears.push(sphere(.035,.1,.035,.12,.08,.04));ears.push(sphere(.032,.09,.032,-.1,.07,-.05));
   }else if(crop==='alfalfa'){
    for(let j=0;j<4;j++)ears.push(sphere(.02,.025,.02,(j%2?.06:-.05),.3+j*.04,j>1?.04:-.03));
   }else if(crop==='carrot'){
    ears.push(sphere(.025,.04,.025,0,.02,0));
   }else{
    for(let j=0;j<3;j++){const pod=new THREE.SphereGeometry(1,6,5);pod.scale(.025,.09,.02);pod.rotateZ(.3);pod.translate(j%2?.09:-.09,.3+j*.08,.06);ears.push(pod)}
   }
  }
 }
 return [combine(stems),combine(leaves),combine(ears),combine(awns)];
}
const PLANT_COLORS:Record<Crop,{leaf:string;fruit:string}>={
 wheat:{leaf:'#657c37',fruit:'#c6a45a'},barley:{leaf:'#7a8a45',fruit:'#c2a15a'},rice:{leaf:'#6d9148',fruit:'#e4dcb0'},
 corn:{leaf:'#5c7a32',fruit:'#e0c15a'},potato:{leaf:'#3f7440',fruit:'#c4a574'},cotton:{leaf:'#3f6b42',fruit:'#f7f4ea'},
 sunflower:{leaf:'#4f7a34',fruit:'#e0a322'},tomato:{leaf:'#2f6a38',fruit:'#c4452d'},onion:{leaf:'#7ea15a',fruit:'#e6d2a2'},
 carrot:{leaf:'#3f7a42',fruit:'#e06a22'},cabbage:{leaf:'#4e8f58',fruit:'#d5e7c4'},cucumber:{leaf:'#2e6a3c',fruit:'#4f9a45'},
 alfalfa:{leaf:'#3d7a4a',fruit:'#7a5ea8'},legume:{leaf:'#3f7440',fruit:'#8aaa62'},
};
function Crops({positions,terrain,growth,crop,waterStress,frost,windSpeed,clip}:{positions:XY[];terrain?:Terrain;growth:number;crop:Crop;waterStress:number;frost:boolean;windSpeed:number;clip:THREE.Plane[]}){
 const meshes=useRef<(THREE.InstancedMesh|null)[]>([]),age=clamp((growth-.035)/.965);
 const step=geometryStep(growth,waterStress);
 const geometry=useMemo(()=>plantGeometry(crop,geometryProgress(step),geometryStress(step)),[crop,step]);
 const wave=useMemo(()=>({time:{value:0},wind:{value:0}}),[]);
 const growthBucket=Math.round(clamp(growth)*8)/8,stressBucket=Math.round(clamp(waterStress)*4)/4;
 const colors=useMemo(()=>{
  const green=new THREE.Color(PLANT_COLORS[crop].leaf),gold=new THREE.Color(PLANT_COLORS[crop].fruit);
  green.lerp(gold,crop==='wheat'||crop==='barley'||crop==='rice'?clamp((growthBucket-.68)/.3):0);green.lerp(new THREE.Color('#a78b48'),stressBucket*.22);
  if(frost)green.lerp(new THREE.Color('#a5b8b5'),.65);
  return [green.clone().multiplyScalar(.9),green,gold,gold.clone().multiplyScalar(.9)];
 },[crop,growthBucket,stressBucket,frost]);
 const materials=useMemo(()=>colors.map(color=>{
  const m=new THREE.MeshStandardMaterial({color,roughness:.9,side:THREE.DoubleSide,clippingPlanes:clip,clipShadows:true});
  m.onBeforeCompile=shader=>{
   shader.uniforms.uCropTime=wave.time;shader.uniforms.uCropWind=wave.wind;
   shader.vertexShader='uniform float uCropTime;\nuniform float uCropWind;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    #ifdef USE_INSTANCING
     float phase=instanceMatrix[3].x*1.3+instanceMatrix[3].z*.8;
     transformed.x+=sin(uCropTime*1.5+phase)*uCropWind*pow(max(position.y,0.0),1.7);
     transformed.z+=cos(uCropTime*.9+phase)*uCropWind*.35*max(position.y,0.0);
    #endif`);
  };m.customProgramCacheKey=()=> 'kisht-crop-wind-v1';return m;
 }),[colors,wave,clip]);
 useEffect(()=>()=>geometry.forEach(g=>g.dispose()),[geometry]);
 useEffect(()=>()=>materials.forEach(m=>m.dispose()),[materials]);
 useLayoutEffect(()=>{
  const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),color=new THREE.Color();
  const lean=Math.min(.12,waterStress*.10);
  for(let k=0;k<4;k++){
   const mesh=meshes.current[k];if(!mesh)continue;
   positions.forEach(([x,z],i)=>{
    q.setFromEuler(new THREE.Euler(lean,noise(i+2)*Math.PI*2,lean));
    const h=Math.max(.025,age)*(.9+noise(i)*.2);
    matrix.compose(new THREE.Vector3(x,terrainHeight(terrain,x,z)+.018,z),q,new THREE.Vector3(Math.max(.15,Math.sqrt(age)),h,Math.max(.15,Math.sqrt(age))));
    mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,color.setRGB(1,1,1).multiplyScalar(.9+noise(i+9)*.15));
   });mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();
  }
 },[positions,terrain,age,waterStress,geometry]);
 useFrame(({clock})=>{wave.time.value=clock.elapsedTime;wave.wind.value=Math.min(15,Math.max(0,windSpeed))*.004});
 return <>{geometry.map((g,k)=>(g.attributes.position?.count??0)>0?<instancedMesh key={k} ref={r=>{meshes.current[k]=r}} args={[g,materials[k],positions.length]} castShadow receiveShadow visible={age>0}/>:null)}</>;
}
function soilTexture(){
 const size=128,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const n=noise(x+y*size),fine=135+n*70+Math.sin(x*.3)*3,i=(y*size+x)*4;
  data[i]=fine;data[i+1]=fine*.86;data[i+2]=fine*.65;data[i+3]=255;
 }
 const texture=new THREE.DataTexture(data,size,size);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(5,5);texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function FieldWater({positions,polygon,terrain,watering,raining,method,clip}:{positions:XY[];polygon:XY[];terrain?:Terrain;watering:boolean;raining:boolean;method:Props['irrigationMethod'];clip:THREE.Plane[]}){
 const drops=useRef<THREE.Points>(null);
 const points=useMemo(()=>{
  const g=new THREE.BufferGeometry(),v=new Float32Array(positions.length*3*3);
  positions.forEach(([x,z],i)=>{for(let j=0;j<3;j++){const k=(i*3+j)*3;v[k]=x+(noise(k)-.5)*.12;v[k+1]=terrainHeight(terrain,x,z)+.12+noise(k+1)*2.1;v[k+2]=z+(noise(k+2)-.5)*.12}});
  g.setAttribute('position',new THREE.BufferAttribute(v,3));return g;
 },[positions,terrain]);
 const floors=useMemo(()=>{const a=points.attributes.position;return Float32Array.from({length:a.count},(_,i)=>terrainHeight(terrain,a.getX(i),a.getZ(i))+.02)},[points,terrain]);
 const rowGeometry=useMemo(()=>{
  const parts:THREE.BufferGeometry[]=[],wet:THREE.BufferGeometry[]=[];
  positions.forEach(([x,z],i)=>{
   const next=positions[i+1];if(!next||Math.abs(next[0]-x)>.01||next[1]-z>.44)return;
   if(![.25,.5,.75].every(t=>inside(x,z+(next[1]-z)*t,polygon)&&inside(x+.13,z+(next[1]-z)*t,polygon)))return;
   for(let j=0;j<4;j++){
    const a=z+(next[1]-z)*j/4,b=z+(next[1]-z)*(j+1)/4;
    parts.push(stemBetween(new THREE.Vector3(x,terrainHeight(terrain,x,a)+.012,a),new THREE.Vector3(x,terrainHeight(terrain,x,b)+.012,b),.007));
    wet.push(stemBetween(new THREE.Vector3(x+.10,terrainHeight(terrain,x+.10,a)+.005,a),new THREE.Vector3(x+.10,terrainHeight(terrain,x+.10,b)+.005,b),.025));
   }
  });return [combine(parts),combine(wet)];
 },[positions,polygon,terrain]);
 useEffect(()=>()=>points.dispose(),[points]);
 useEffect(()=>()=>rowGeometry.forEach(g=>g.dispose()),[rowGeometry]);
 useFrame((_,delta)=>{
  if(!drops.current||(!raining&&!(watering&&method==='sprinkler')))return;
  const a=points.attributes.position as THREE.BufferAttribute;
  for(let i=0;i<a.count;i++){const floor=floors[i],y=a.getY(i)-delta*(raining?2.8:1.1);a.setY(i,y<floor?floor+(raining?2.2:1):y)}a.needsUpdate=true;
 });
 return <>
  {method==='drip'&&(rowGeometry[0].attributes.position?.count??0)>0&&<mesh geometry={rowGeometry[0]}><meshStandardMaterial color="#28332b" roughness={.85} clippingPlanes={clip} clipShadows/></mesh>}
  {watering&&method==='surface'&&(rowGeometry[1].attributes.position?.count??0)>0&&<mesh geometry={rowGeometry[1]}><meshPhysicalMaterial color="#85a9a6" transparent opacity={.7} roughness={.17} metalness={.15} clippingPlanes={clip} clipShadows/></mesh>}
  {watering&&method==='drip'&&positions.map(([x,z],i)=><mesh key={i} position={[x,terrainHeight(terrain,x,z)+.014,z]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.065,9]}/><meshStandardMaterial color="#3e4d3a" transparent opacity={.7} clippingPlanes={clip} clipShadows/></mesh>)}
  <points ref={drops} geometry={points} visible={raining||(watering&&method==='sprinkler')} frustumCulled={false}><pointsMaterial color="#b4d7df" size={raining?.027:.018} transparent opacity={.65} depthWrite={false}/></points>
 </>;
}
/** Open the camera-facing side of the soil so roots hang in the earth wall, not through the canopy. */
function soilCut(polygon:XY[]){
 const dx=1/Math.SQRT2,dz=1/Math.SQRT2;let near=-Infinity,far=Infinity;
 for(const [x,z] of polygon){const p=x*dx+z*dz;near=Math.max(near,p);far=Math.min(far,p)}
 const at=far+(near-far)*.62;
 return {dx,dz,at,plane:new THREE.Plane(new THREE.Vector3(-dx,0,-dz),at)};
}
function SoilProfile({polygon,terrain,fraction,crop}:{polygon:XY[];terrain?:Terrain;fraction:number;crop:Crop}){
 const geometry=useMemo(()=>{
  const cut=soilCut(polygon),alongX=-cut.dz,alongZ=cut.dx,depth=Math.min(.56,.14+.44*fraction);
  const wall:number[]=[],roots:THREE.BufferGeometry[]=[];
  const samples:{t:number;x:number;z:number;y:number}[]=[];
  for(let t=-3.2;t<=3.21;t+=.32){
   const x=alongX*t+cut.dx*cut.at,z=alongZ*t+cut.dz*cut.at;
   if(inside(x,z,polygon))samples.push({t,x,z,y:terrainHeight(terrain,x,z)});
  }
  const place=(t:number,y:number,out:number)=>new THREE.Vector3(alongX*t+cut.dx*(cut.at+out),y,alongZ*t+cut.dz*(cut.at+out));
  for(let i=0;i<samples.length-1;i++){
   const a=samples[i],b=samples[i+1];if(b.t-a.t>.4)continue;
   const topA=place(a.t,a.y,.02),topB=place(b.t,b.y,.02),botA=place(a.t,a.y-.64,.02),botB=place(b.t,b.y-.64,.02);
   wall.push(...topA.toArray(),...botA.toArray(),...topB.toArray(),...topB.toArray(),...botA.toArray(),...botB.toArray());
  }
  for(const sample of samples){
   const crown=place(sample.t,sample.y-.03,.045);
   const tap=crop==='carrot'||crop==='cotton'||crop==='sunflower'||crop==='alfalfa'||crop==='tomato';
   const count=tap?1:crop==='potato'?3:5;
   for(let k=0;k<count;k++){
    const spread=(k-(count-1)/2)*(tap?.02:.07);
    const tip=place(sample.t+spread,sample.y-.03-depth*(tap?1:.75),.07);
    roots.push(stemBetween(crown,tip,crop==='carrot'?.018:crop==='potato'?.012:.008));
    if(crop==='potato'&&k===1){const tuber=sphere(.045,.03,.035,0,0,0);tuber.translate(tip.x,tip.y+.08,tip.z);roots.push(tuber)}
    for(let j=1;j<=3;j++){
     const origin=crown.clone().lerp(tip,j/4);
     const side=place(sample.t+spread+(j%2?.08:-.08),origin.y-.05,.08);
     roots.push(stemBetween(origin,side,.0035));
    }
   }
  }
  const face=new THREE.BufferGeometry();face.setAttribute('position',new THREE.Float32BufferAttribute(wall,3));face.computeVertexNormals();
  return {face,roots:combine(roots)};
 },[polygon,terrain,fraction,crop]);
 useEffect(()=>()=>{geometry.face.dispose();geometry.roots.dispose()},[geometry]);
 const color=crop==='carrot'?'#e07a2f':crop==='potato'?'#e4d3ae':'#f0e2c6';
 return <>
  {(geometry.face.attributes.position?.count??0)>0&&<mesh geometry={geometry.face}><meshStandardMaterial color="#6a4e34" roughness={1} side={THREE.DoubleSide}/></mesh>}
  {(geometry.roots.attributes.position?.count??0)>0&&<mesh geometry={geometry.roots}><meshStandardMaterial color={color} roughness={1}/></mesh>}
 </>;
}
/** Fit orthographic zoom to canvas size, but do not fight a zoom the user already changed. */
function Fit(){
 const {camera,size}=useThree();
 const baseline=useRef<{w:number;h:number;zoom:number}|null>(null);
 useLayoutEffect(()=>{
  if(!(camera instanceof THREE.OrthographicCamera)||size.width<32||size.height<32)return;
  const next=Math.min(size.width/9,size.height/6.4);
  const prev=baseline.current;
  const userMoved=!!prev&&Math.abs(camera.zoom-prev.zoom)>.5;
  const sizeChanged=!prev||Math.abs(size.width-prev.w)>8||Math.abs(size.height-prev.h)>8;
  if(!prev||(sizeChanged&&!userMoved)){
   camera.zoom=next;camera.updateProjectionMatrix();
   baseline.current={w:size.width,h:size.height,zoom:next};
  }else if(sizeChanged)baseline.current={w:size.width,h:size.height,zoom:camera.zoom};
 },[size.width,size.height,camera]);
 return null;
}
function Scene({waterStress=0,rootFraction,growth,crop,moisture,watering,raining,cut,plot=[],frost=false,terrain,showFlow=false,irrigationMethod='surface',windSpeed=0}:Props){
 const polygon=useMemo(()=>normalizeField(plot),[plot]),positions=useMemo(()=>plantingPositions(polygon),[polygon]);
 const texture=useMemo(soilTexture,[]);useEffect(()=>()=>texture.dispose(),[texture]);
 const shape=useMemo(()=>{const s=new THREE.Shape();polygon.forEach(([x,z],i)=>{const next=polygon[(i+1)%polygon.length];if(i===0)s.moveTo(x,-z);for(let k=1;k<=8;k++)s.lineTo(x+(next[0]-x)*k/8,-z-(next[1]-z)*k/8)});s.closePath();return s},[polygon]);
 const geo=useMemo(()=>{const g=new THREE.ExtrudeGeometry(shape,{depth:.65,bevelEnabled:false});const a=g.attributes.position;for(let i=0;i<a.count;i++)a.setZ(i,a.getZ(i)+terrainHeight(terrain,a.getX(i),-a.getY(i)));g.computeVertexNormals();return g},[shape,terrain]);
 const surface=useMemo(()=>{
  const base=new THREE.ShapeGeometry(shape),flat=base.toNonIndexed();base.dispose();let points=Array.from(flat.attributes.position.array);flat.dispose();
  for(let level=0;level<3;level++){const next:number[]=[];for(let i=0;i<points.length;i+=9){const a=points.slice(i,i+3),b=points.slice(i+3,i+6),c=points.slice(i+6,i+9),ab=a.map((v,k)=>(v+b[k])/2),bc=b.map((v,k)=>(v+c[k])/2),ca=c.map((v,k)=>(v+a[k])/2);next.push(...a,...ab,...ca,...ab,...b,...bc,...ca,...bc,...c,...ab,...bc,...ca)}points=next}
  const uv:number[]=[];for(let i=0;i<points.length;i+=3){uv.push(points[i]/6+.5,points[i+1]/6+.5);points[i+2]=terrainHeight(terrain,points[i],-points[i+1])}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
 },[shape,terrain]);
 useEffect(()=>()=>{geo.dispose();surface.dispose()},[geo,surface]);
 const moistureKey=Math.round(clamp(moisture)*12);
 const ground=useMemo(()=>new THREE.Color('#9b8058').lerp(new THREE.Color('#55482e'),moistureKey/12),[moistureKey]);
 const arrows=useMemo(()=>{if(!terrain||!showFlow)return [];return terrainDirections(terrain,plot).map(d=>{const y=terrainHeight(terrain,d.x,d.z)+.12;return new THREE.ArrowHelper(new THREE.Vector3(d.dx,0,d.dz),new THREE.Vector3(d.x,y,d.z),.35,0x167dba,.12,.08)})},[terrain,plot,showFlow]);
 useEffect(()=>()=>arrows.forEach(a=>a.dispose()),[arrows]);
 const clipPlane=useMemo(()=>soilCut(polygon).plane,[polygon]);
 const clip=useMemo(()=>cut?[clipPlane]:[],[cut,clipPlane]);
 return <><color attach="background" args={['#e9eddf']}/><Fit/><ambientLight intensity={.75}/><hemisphereLight args={['#edf5fa','#756347',1.1]}/><directionalLight position={[-3,7,5]} color="#fff3d7" intensity={2.1} castShadow shadow-mapSize={[1024,1024]} shadow-bias={-.0003} shadow-normalBias={.025} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6}/>{arrows.map((a,i)=><primitive key={i} object={a}/>)}
  <mesh geometry={geo} position={[0,-.65,0]} rotation={[-Math.PI/2,0,0]} receiveShadow castShadow><meshStandardMaterial color="#806544" map={texture} roughness={1} clippingPlanes={clip} clipShadows/></mesh>
  <mesh geometry={surface} rotation={[-Math.PI/2,0,0]} receiveShadow><meshStandardMaterial color={ground} map={texture} bumpMap={texture} bumpScale={.028} roughness={.98} side={THREE.DoubleSide} clippingPlanes={clip} clipShadows/></mesh>
  <Crops positions={positions} terrain={terrain} crop={crop} growth={clamp(growth)} waterStress={clamp(waterStress)} frost={frost} windSpeed={windSpeed} clip={clip}/>
  {cut&&<SoilProfile polygon={polygon} terrain={terrain} crop={crop} fraction={rootFraction??Math.max(.1,growth)}/>}
  <FieldWater terrain={terrain} positions={positions} polygon={polygon} watering={watering} raining={raining} method={irrigationMethod} clip={clip}/>
  <ContactShadows frames={1} resolution={128} position={[0,-.68,0]} opacity={.3} scale={14} blur={2.5} far={5}/>
  <OrbitControls makeDefault target={ORBIT_TARGET} minZoom={20} maxZoom={180} minPolarAngle={.35} maxPolarAngle={1.35} enablePan={false} enableDamping dampingFactor={.08} rotateSpeed={.7} zoomSpeed={.9}/>
 </>;
}
function Field(props:Props){
 return <Canvas orthographic shadows dpr={[1,1.5]} camera={{position:[7,5.5,8],zoom:45}} style={{touchAction:'none'}} gl={{antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:false,localClippingEnabled:true}}>
  <Scene {...props}/>
 </Canvas>;
}
export default memo(Field);
