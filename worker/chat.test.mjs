import test from 'node:test';
import assert from 'node:assert/strict';
import {chatResponse,validateChatOutput} from './chat.js';

const env={GEMINI_API_KEY:'test-secret',GEMINI_MODELS:'gemini-primary,gemini-backup'};
const body={lang:'ru',messages:[{role:'user',text:'Когда проверить посев?'}],context:{field:{selected:true,crop:'spring wheat',planting:'2028-04-01'}}};
function request(value=body,options={}){
 return new Request('https://kisht.test/api/chat',{method:options.method||'POST',headers:{'content-type':'application/json',...(options.headers||{})},body:options.method==='GET'?undefined:JSON.stringify(value)});
}
function geminiReply(result,status=200){
 return Response.json(status===200?{candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(result)}]}}]}:{error:{status}}, {status});
}
const answer={answer:'Сравните исторические сценарии.',proposal:{kind:'search',start:'2028-04-01',end:'2028-04-30',reason:'Проверка по NASA'}};

test('status exposes capabilities without credentials and unconfigured chat stays independent',async()=>{
 const status=await chatResponse(request(undefined,{method:'GET'}),env);
 assert.equal(status.status,200);
 const value=await status.json();
 assert.deepEqual(value,{configured:true,providers:['Gemini'],maxImageBytes:3000000});
 assert.equal(JSON.stringify(value).includes('test-secret'),false);
 const missing=await chatResponse(request(),{});
 assert.equal(missing.status,503);
 assert.equal((await missing.json()).error.code,'not_configured');
});

test('quota exhaustion switches immediately to the next model without losing the answer',async()=>{
 const urls=[];
 const response=await chatResponse(request(),env,{fetch:async(url,init)=>{
  urls.push(url);
  assert.equal(init.headers['x-goog-api-key'],'test-secret');
  return urls.length===1?geminiReply({},429):geminiReply(answer);
 },sleep:async()=>assert.fail('quota errors must not be retried')});
 assert.equal(response.status,200);
 assert.equal(urls.length,2);
 assert.match(urls[0],/gemini-primary/);assert.match(urls[1],/gemini-backup/);
 assert.deepEqual(await response.json(),{...answer,provider:'Gemini',model:'gemini-backup',switched:true});
});

test('a transient failure gets one bounded retry on the same model',async()=>{
 let calls=0;
 const response=await chatResponse(request(),{GEMINI_API_KEY:'secret',GEMINI_MODELS:'gemini-primary'},{fetch:async()=>++calls===1?geminiReply({},500):geminiReply(answer),sleep:async()=>{}});
 assert.equal(response.status,200);assert.equal(calls,2);
 assert.equal((await response.json()).switched,false);
});

test('an independent OpenRouter fallback receives the same photo and preserves provider transparency',async()=>{
 const jpeg=Buffer.from([0xff,0xd8,0xff,0xe0,1,2,3]).toString('base64');
 const input={...body,image:{mimeType:'image/jpeg',data:jpeg}};
 let sent;
 const response=await chatResponse(request(input),{GEMINI_API_KEY:'secret',GEMINI_MODELS:'gemini-primary',OPENROUTER_API_KEY:'other-secret',OPENROUTER_MODEL:'vendor/vision-model'},{fetch:async(url,init)=>{
  if(url.includes('googleapis'))return geminiReply({},429);
  sent={url,init};return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({answer:'Видны только признаки поверхности.',proposal:null})}}]});
 }});
 assert.equal(response.status,200);
 const value=await response.json();assert.equal(value.provider,'OpenRouter');assert.equal(value.switched,true);
 assert.equal(sent.url,'https://openrouter.ai/api/v1/chat/completions');
 assert.equal(sent.init.headers.Authorization,'Bearer other-secret');
 const payload=JSON.parse(sent.init.body);assert.equal(payload.model,'vendor/vision-model');
 assert.equal(payload.messages.at(-1).content.at(-1).image_url.url,`data:image/jpeg;base64,${jpeg}`);
});

test('safety refusals and malformed output are never bypassed or applied',async()=>{
 let calls=0;
 const refusal=await chatResponse(request(),env,{fetch:async()=>{calls++;return Response.json({promptFeedback:{blockReason:'SAFETY'}})}});
 assert.equal(refusal.status,422);assert.equal(calls,1);
 assert.equal((await refusal.json()).error.code,'refused');
 assert.throws(()=>validateChatOutput({answer:'bad',proposal:{kind:'inputs',soil:'chernozem',reason:'invented'}}),/invalid_response/);
 assert.throws(()=>validateChatOutput({answer:'bad',proposal:{kind:'inputs',irrigationEvents:[],reason:'invented'}}),/invalid_response/);
 assert.deepEqual(validateChatOutput({answer:' Допущение. ',proposal:{kind:'inputs',weeklyWaterM3:0,reason:'Нулевой лимит'}}),{answer:'Допущение.',proposal:{kind:'inputs',weeklyWaterM3:0,reason:'Нулевой лимит'}});
});

test('request validation rejects cross-site calls, fake images and oversized context before any provider request',async()=>{
 let calls=0;const fetcher=async()=>{calls++;return geminiReply(answer)};
 const crossSite=await chatResponse(request(body,{headers:{origin:'https://attacker.test'}}),env,{fetch:fetcher});
 assert.equal(crossSite.status,403);
 const fakeImage=await chatResponse(request({...body,image:{mimeType:'image/jpeg',data:Buffer.from('not an image').toString('base64')}}),env,{fetch:fetcher});
 assert.equal(fakeImage.status,400);
 const hugeContext=await chatResponse(request({...body,context:{text:'x'.repeat(25000)}}),env,{fetch:fetcher});
 assert.equal(hugeContext.status,400);
 assert.equal(calls,0);
});

test('when every provider is quota-limited the client receives a retryable explicit error',async()=>{
 const response=await chatResponse(request(),env,{fetch:async()=>geminiReply({},429),sleep:async()=>assert.fail('no quota retry')});
 assert.equal(response.status,429);
 assert.equal((await response.json()).error.code,'rate_limited');
});

test('all backups retain a time budget even when every earlier model hangs',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout','Date'],now:0});
 const urls=[];
 const pending=chatResponse(request(),{GEMINI_API_KEY:'secret',GEMINI_MODELS:'gemini-one,gemini-two,gemini-three',OPENROUTER_API_KEY:'backup-secret',OPENROUTER_MODEL:'vendor/vision'}, {
  fetch:async(url,init)=>{
   urls.push(url);
   if(url.includes('openrouter'))return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(answer)}}]});
   return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Error('attempt timed out')),{once:true}));
  },
 });
 await new Promise(setImmediate);
 assert.equal(urls.length,1);
 for(let i=0;i<3;i++){t.mock.timers.tick(15500);await new Promise(setImmediate);}
 const response=await pending;
 assert.equal(response.status,200);
 assert.equal(urls.length,4);
 assert.equal((await response.json()).provider,'OpenRouter');
 assert.equal(Date.now(),46500);
});

test('a search action cannot target an absent field or a different planting year',async()=>{
 for(const field of [{selected:false,planting:'2028-04-01'},{selected:true,planting:'2029-04-01'}]){
  const response=await chatResponse(request({...body,context:{field}}),env,{fetch:async()=>geminiReply(answer)});
  const value=await response.json();
  assert.equal(response.status,200);
  assert.equal(value.answer,answer.answer);
  assert.equal(value.proposal,null);
 }
});

test('server and client accept the same supported proposal limits',async()=>{
 const {parseAssistantResponse}=await import('../src/assistant.ts');
 const result={answer:'x'.repeat(12000),proposal:{kind:'inputs',crop:'potato',weeklyWaterM3:10000000,reason:'user supply limit'}};
 const server=validateChatOutput(result);
 assert.doesNotThrow(()=>parseAssistantResponse({...server,provider:'OpenRouter',model:'vendor/'+'a'.repeat(140),switched:true}));
 assert.throws(()=>validateChatOutput({...result,answer:'x'.repeat(12001)}));
 assert.throws(()=>validateChatOutput({...result,proposal:{...result.proposal,weeklyWaterM3:10000001}}));
});

test('malformed output never becomes an action or leaks upstream error contents',async()=>{
 let calls=0;
 const response=await chatResponse(request(),env,{fetch:async()=>{
  calls++;
  return geminiReply({answer:'test-secret',proposal:{kind:'inputs',soil:['loam'],reason:'invalid'}});
 }});
 assert.equal(response.status,503);
 assert.equal(calls,2);
 const result=await response.text();
 assert.equal(result.includes('test-secret'),false);
 assert.equal(JSON.parse(result).error.code,'invalid_response');
});
