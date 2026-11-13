import {test} from 'node:test';
import assert from 'node:assert/strict';
import {terrainResponse} from './terrain.js';
test('terrain endpoint rejects invalid and unbounded input before fetching',async()=>{
 for(const bounds of ['','38,68,37,69','0,0,80,90','38,68,NaN,69','38,,39,69'])assert.equal((await terrainResponse(new Request('https://site.test/api/terrain?bounds='+bounds))).status,400);
 assert.equal((await terrainResponse(new Request('https://site.test/api/terrain',{method:'POST'}))).status,405);
});
test('terrain endpoint rejects missing heights and caches only complete SRTM grids',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{globalThis.fetch=async()=>{calls++;return Response.json({status:'OK',results:Array.from({length:49},()=>({dataset:'srtm30m',elevation:calls===1?null:811}))})};
 const request=new Request('https://site.test/api/terrain?bounds=38.5,68.5,38.501,68.501');
 assert.equal((await terrainResponse(request)).status,422);
 const response=await terrainResponse(request);assert.equal(response.status,200);assert.equal((await response.json()).elevations.length,49);
 assert.equal((await terrainResponse(request)).status,200);assert.equal(calls,2);
 }finally{globalThis.fetch=original}
});
