const memory=new Map();
export async function terrainResponse(request){
 const url=new URL(request.url),parts=(url.searchParams.get('bounds')||'').split(',');
 const b=parts.map(Number),[south,west,north,east]=b;
 if(request.method!=='GET')return Response.json({error:'GET required'},{status:405});
 if(parts.length!==4||parts.some(p=>!p.trim())||b.some(v=>!Number.isFinite(v))||south< -56||north>60||west< -180||east>180||north<=south||east<=west||north-south>2||east-west>2)return Response.json({error:'Invalid bounds'},{status:400});
 const key=b.map(v=>v.toFixed(6)).join(',');
 const cached=memory.get(key);if(cached&&Date.now()-cached.time<86400000)return Response.json(cached.value);
 const locations=[];for(let z=0;z<7;z++)for(let x=0;x<7;x++)locations.push(`${(north-(north-south)*z/6).toFixed(6)},${(west+(east-west)*x/6).toFixed(6)}`);
 const upstream='https://api.opentopodata.org/v1/srtm30m?interpolation=bilinear&locations='+encodeURIComponent(locations.join('|'));
 try{
  const r=await fetch(upstream,{signal:AbortSignal.timeout(20000),cf:{cacheTtl:86400,cacheEverything:true}});
  if(!r.ok)return Response.json({error:'Elevation service unavailable'},{status:503});
  const j=await r.json();
  if(j.status!=='OK'||!Array.isArray(j.results)||j.results.length!==49||j.results.some(v=>v.dataset!=='srtm30m'||typeof v.elevation!=='number'||!Number.isFinite(v.elevation)||v.elevation< -500||v.elevation>9000))return Response.json({error:'Incomplete SRTM coverage'},{status:422});
  const value={bounds:b,size:7,elevations:j.results.map(v=>v.elevation),source:'SRTM v3 / Open Topo Data',resolution:30,fetchedAt:new Date().toISOString(),url:upstream};
  if(memory.size>=64)memory.delete(memory.keys().next().value);memory.set(key,{time:Date.now(),value});
  return Response.json(value,{headers:{'Cache-Control':'private, max-age=86400'}});
 }catch{return Response.json({error:'Elevation request timed out or failed'},{status:503})}
}
