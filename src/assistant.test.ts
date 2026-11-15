import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAssistantResponse,parseAssistantProposal,requireCurrentProposal} from './assistant.ts';
test('assistant accepts bounded inputs including a zero water limit, never a model-generated weather or irrigation source',()=>{
 assert.deepEqual(parseAssistantProposal({kind:'inputs',weeklyWaterM3:0,reason:'No supply'}),{kind:'inputs',weeklyWaterM3:0,reason:'No supply'});
 assert.deepEqual(parseAssistantProposal({kind:'inputs',crop:'potato',reason:'Switch crop'}),{kind:'inputs',crop:'potato',reason:'Switch crop'});
 assert.deepEqual(parseAssistantProposal({kind:'inputs',crop:'corn',planting:'2028-04-15',reason:'Maize date'}),{kind:'inputs',crop:'corn',planting:'2028-04-15',reason:'Maize date'});
 for(const extra of [{crop:'legume'},{source:{kind:'nasa'}},{irrigationEvents:[{date:'2028-04-01',mm:30}]},{soil:'chernozem'},{weeklyWaterM3:-1},{planting:'2028-02-30'}])assert.throws(()=>parseAssistantProposal({kind:'inputs',reason:'test',...extra}));
});
test('assistant search validates dates, year, bounded range and stale field context before any application',()=>{
 const p={kind:'search',start:'2028-06-01',end:'2028-08-31',reason:'Compare summer dates'};
 assert.equal(requireCurrentProposal(p,'field-a','field-a','2028-04-01').kind,'search');
 assert.throws(()=>requireCurrentProposal(p,'field-a','field-b','2028-04-01'));
 assert.throws(()=>requireCurrentProposal(p,'a','a','2029-04-01'));
 assert.throws(()=>parseAssistantProposal({...p,end:'2028-12-31'}));
 assert.throws(()=>parseAssistantProposal({...p,end:'2029-01-01'}));
});
test('assistant response validation requires a real answer and transparent provider information',()=>{
 const response={answer:'Compare the historical scenarios.',proposal:null,provider:'Gemini',model:'test-model',switched:false};
 assert.deepEqual(parseAssistantResponse(response),response);
 assert.throws(()=>parseAssistantResponse({...response,answer:''}));
 assert.throws(()=>parseAssistantResponse({...response,model:null}));
});
