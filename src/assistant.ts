import {validDate,type CropId,type SoilId} from './domain.ts';
import {candidateDates} from './plantingPlan.ts';

export type AssistantContext=Record<string,unknown>;
export type AssistantCrop=Extract<CropId,'wheat'|'corn'|'potato'>;
export type AssistantProposal=
 | {kind:'search';start:string;end:string;reason:string}
 | {kind:'inputs';planting?:string;crop?:AssistantCrop;soil?:SoilId;method?:'surface'|'sprinkler'|'drip';weeklyWaterM3?:number;reason:string};
export interface AssistantResponse {answer:string;proposal:AssistantProposal|null;provider:string;model:string;switched:boolean}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const date=(v:unknown):v is string=>typeof v==='string'&&validDate(v)&&v>='2001-01-01'&&v<='2100-12-31';
const crops=['wheat','corn','potato'] as const;

/** Model output is a proposed input, never a trusted weather source or irrigation schedule. */
export function parseAssistantProposal(value:unknown):AssistantProposal|null{
 if(value===null||value===undefined)return null;
 if(!object(value)||!text(value.reason,1500))throw Error('Invalid assistant proposal');
 const allowed=value.kind==='search'?['kind','start','end','reason']:['kind','planting','crop','soil','method','weeklyWaterM3','reason'];
 if(Object.keys(value).some(k=>!allowed.includes(k)))throw Error('Unsupported assistant input');
 if(value.kind==='search'){
  if(!date(value.start)||!date(value.end))throw Error('Invalid search dates');
  candidateDates({start:value.start,end:value.end});
  return {kind:'search',start:value.start,end:value.end,reason:value.reason};
 }
 if(value.kind!=='inputs')throw Error('Unsupported assistant action');
 if(value.planting!==undefined&&!date(value.planting))throw Error('Invalid sowing date');
 if(value.crop!==undefined&&!crops.includes(value.crop as AssistantCrop))throw Error('Unsupported crop');
 if(value.soil!==undefined&&!['unknown','loam','sand','clay'].includes(String(value.soil)))throw Error('Unsupported soil');
 if(value.method!==undefined&&!['surface','sprinkler','drip'].includes(String(value.method)))throw Error('Unsupported irrigation method');
 if(value.weeklyWaterM3!==undefined&&(typeof value.weeklyWaterM3!=='number'||!Number.isFinite(value.weeklyWaterM3)||value.weeklyWaterM3<0||value.weeklyWaterM3>1e8))throw Error('Invalid water limit');
 if(['planting','crop','soil','method','weeklyWaterM3'].every(k=>value[k]===undefined))throw Error('Empty assistant proposal');
 return value as AssistantProposal;
}
export function parseAssistantResponse(value:unknown):AssistantResponse{
 if(!object(value)||!text(value.answer,12000)||!text(value.provider,100)||!text(value.model,160)||typeof value.switched!=='boolean')throw Error('Invalid assistant response');
 return {answer:value.answer,proposal:parseAssistantProposal(value.proposal),provider:value.provider,model:value.model,switched:value.switched};
}

export function requireCurrentProposal(proposal:unknown,requestKey:string,currentKey:string,planting:string){
 if(requestKey!==currentKey)throw Error('Field inputs changed; ask the assistant again.');
 const parsed=parseAssistantProposal(proposal);
 if(!parsed)throw Error('Missing proposal');
 if(parsed.kind==='search'&&parsed.start.slice(0,4)!==planting.slice(0,4))throw Error('Search must use the selected sowing year.');
 return parsed;
}
