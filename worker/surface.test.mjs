import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeElements,overpassQuery,queryBox,surfaceResponse,validPlot} from './surface.js';

const field=[[38.5,68.7],[38.5,68.704],[38.503,68.704],[38.503,68.7]];

test('surface endpoint rejects a bad plot before calling the map',async()=>{
 assert.equal(validPlot([[38,68],[38.1,68]]),false);
 assert.equal(queryBox([[0,0],[0,1],[1,1],[1,0]]),null);
 assert.equal((await surfaceResponse(new Request('https://site.test/api/surface'))).status,405);
 assert.equal((await surfaceResponse(new Request('https://site.test/api/surface',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'}))).status,400);
 assert.equal((await surfaceResponse(new Request('https://site.test/api/surface',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plot:field.slice(0,2)})}))).status,400);
 assert.match(overpassQuery(queryBox(field)),/\["building"\]/);
});

test('surface endpoint returns mapped geometry and skips inner rings',async()=>{
 const original=globalThis.fetch;
 const elements=[{tags:{building:'house'},geometry:[{lat:38.5,lon:68.7},{lat:38.5,lon:68.701},{lat:38.501,lon:68.701},{lat:38.5,lon:68.7}]},{type:'relation',tags:{landuse:'residential'},members:[{role:'outer',geometry:[{lat:38.5,lon:68.7},{lat:38.503,lon:68.704}]},{role:'inner',geometry:[{lat:38.501,lon:68.701},{lat:38.502,lon:68.702}]}]}];
 try{
  globalThis.fetch=async()=>Response.json({elements});
  const response=await surfaceResponse(new Request('https://site.test/api/surface',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plot:field})}));
  assert.equal(response.status,200);
  const features=(await response.json()).features;
  assert.equal(features.length,2);
  assert.equal(features[0].tags.building,'house');
  assert.deepEqual(features[0].geometry[0],[38.5,68.7]);
  assert.equal(features[1].tags.landuse,'residential');
 }finally{globalThis.fetch=original}
 assert.equal(normalizeElements([{lat:1,lon:2,tags:{aeroway:'runway'}}])[0].geometry.length,1);
});

test('surface endpoint reports when every map service fails',async()=>{
 const original=globalThis.fetch;
 try{globalThis.fetch=async()=>Response.json({error:'down'},{status:429});
  assert.equal((await surfaceResponse(new Request('https://site.test/api/surface',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plot:field})}))).status,503);
 }finally{globalThis.fetch=original}
});
