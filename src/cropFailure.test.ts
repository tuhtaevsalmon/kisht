import test from 'node:test';
import assert from 'node:assert/strict';
import {cropFailure,type FateInput} from './cropFailure.ts';

function day(partial:Partial<FateInput>={}):FateInput{
 return {min:12,max:24,demand:4,actual:4,storage:40,stressThreshold:20,developmentProgress:0.5,...partial};
}

test('a short dry spell does not stop growth',()=>{
 const rows=Array.from({length:16},(_,i)=>day({developmentProgress:i/20,actual:i>=12?1:4,storage:i>=12?10:40}));
 const fate=cropFailure(rows,'wheat');
 assert.equal(fate.filter(d=>d.dead).length,0);
 assert.equal(fate[15].growth,rows[15].developmentProgress);
});

test('five severe water days after establishment stop growth and keep that size',()=>{
 const rows=Array.from({length:20},(_,i)=>day({
  developmentProgress:(i+1)/20,
  actual:i>=10?1:4,
  storage:i>=10?10:40,
 }));
 const fate=cropFailure(rows,'wheat');
 assert.equal(fate[13].dead,false);
 assert.equal(fate[14].dead,true);
 assert.equal(fate[14].cause,'drought');
 assert.equal(fate[14].diedIndex,14);
 assert.equal(fate[19].growth,rows[14].developmentProgress);
 assert.equal(fate[19].cause,'drought');
 assert.notEqual(fate[19].growth,rows[19].developmentProgress);
});

test('wheat survives a light frost and stops on the model cold line',()=>{
 const light=cropFailure([day({min:-1,developmentProgress:.2})],'wheat');
 assert.equal(light[0].dead,false);
 const hard=cropFailure([day({min:-6,developmentProgress:.2}),day({min:10,developmentProgress:.4})],'wheat');
 assert.equal(hard[0].cause,'cold');
 assert.equal(hard[1].dead,true);
 assert.equal(hard[1].growth,.2);
});

test('a tender crop stops on the first night at or below 0 °C',()=>{
 const fate=cropFailure([day({min:-0.1,developmentProgress:.1}),day({developmentProgress:.3})],'tomato');
 assert.equal(fate[0].cause,'cold');
 assert.equal(fate[1].growth,.1);
});

test('heat stops growth only after five days well above the heat signal',()=>{
 const warm=Array.from({length:6},(_,i)=>day({max:36,developmentProgress:i/10}));
 assert.equal(cropFailure(warm,'wheat').every(d=>!d.dead),true);
 const hot=Array.from({length:6},(_,i)=>day({max:38,developmentProgress:i/10}));
 const fate=cropFailure(hot,'wheat');
 assert.equal(fate[3].dead,false);
 assert.equal(fate[4].cause,'heat');
 assert.equal(fate[5].growth,hot[4].developmentProgress);
});
