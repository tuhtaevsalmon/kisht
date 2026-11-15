import {useEffect,useRef,useState,type FormEvent} from 'react';
import {ArrowUp,Check,ImagePlus,LoaderCircle,MessageCircle,Square,X} from 'lucide-react';
import {cropLabels,type Lang} from './domain';
import {parseAssistantResponse,type AssistantContext,type AssistantProposal} from './assistant';
import './chat-assistant.css';

interface Props {lang:Lang;context:AssistantContext;contextKey:string;onProposal:(proposal:AssistantProposal,contextKey:string)=>Promise<void>|void;onClose?:()=>void}
type Photo={mimeType:'image/jpeg';data:string;preview:string};
type Entry={id:number;role:'user'|'assistant';text:string;hadPhoto?:boolean;proposal?:AssistantProposal|null;contextKey?:string;provider?:string;model?:string;switched?:boolean};
type Service={configured:boolean;providers:string[];maxImageBytes:number};
const imageTypes=['image/jpeg','image/png','image/webp'];

async function preparePhoto(file:File):Promise<Photo>{
 if(!imageTypes.includes(file.type))throw Error('image_type');
 if(file.size>15000000)throw Error('image_size');
 const url=URL.createObjectURL(file),picture=new Image();
 try{
  picture.src=url;await picture.decode();
  if(!picture.naturalWidth||!picture.naturalHeight||picture.naturalWidth*picture.naturalHeight>60000000)throw Error('image_size');
  const scale=Math.min(1,1280/Math.max(picture.naturalWidth,picture.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(picture.naturalWidth*scale));canvas.height=Math.max(1,Math.round(picture.naturalHeight*scale));
  const drawing=canvas.getContext('2d');if(!drawing)throw Error('image_decode');
  drawing.fillStyle='#fff';drawing.fillRect(0,0,canvas.width,canvas.height);drawing.drawImage(picture,0,0,canvas.width,canvas.height);
  const preview=canvas.toDataURL('image/jpeg',.82),data=preview.split(',')[1];
  if(!data||data.length*3/4>3000000)throw Error('image_size');
  return {mimeType:'image/jpeg',data,preview};
 }finally{URL.revokeObjectURL(url)}
}

function recentMessages(entries:Entry[],question:string){
 const chosen:Array<{role:'user'|'assistant';text:string}>=[];let remaining=10000-question.length;
 for(let i=entries.length-1;i>=0&&chosen.length<11;i--){const e=entries[i];if(e.text.length>remaining)break;chosen.unshift({role:e.role,text:e.text});remaining-=e.text.length;}
 while(chosen[0]?.role==='assistant')chosen.shift();
 return [...chosen,{role:'user' as const,text:question}];
}

export default function ChatAssistant({lang,context,contextKey,onProposal,onClose}:Props){
 const t=(ru:string,en:string)=>lang==='ru'?ru:en;
 const field=context.field&&typeof context.field==='object'?context.field as {selected?:boolean;pointCount?:number;areaHa?:number|null;cropLabel?:string}:null;
 const fieldStatus=field?.selected?t(`Участок сохранён${field.areaHa?` · ${Number(field.areaHa).toFixed(2)} га`:''}${field.cropLabel?` · ${field.cropLabel}`:''}`,`Field saved${field.areaHa?` · ${Number(field.areaHa).toFixed(2)} ha`:''}${field.cropLabel?` · ${field.cropLabel}`:''}`):(field?.pointCount??0)>0?t('Контур не сохранён — замкните границы на карте','Boundary not saved — close the outline on the map'):t('Участок пока не обведён — общие ответы всё равно доступны','No field outlined yet — general answers still work');
 const [open,setOpen]=useState(false),[entries,setEntries]=useState<Entry[]>([]),[draft,setDraft]=useState(''),[photo,setPhoto]=useState<Photo|null>(null);
 const [service,setService]=useState<Service|null>(null),[serviceError,setServiceError]=useState(false),[statusAttempt,setStatusAttempt]=useState(0);
 const [pending,setPending]=useState<{text:string;hadPhoto:boolean}|null>(null),[photoBusy,setPhotoBusy]=useState(false),[error,setError]=useState<string|null>(null),[applying,setApplying]=useState<number|null>(null),[applied,setApplied]=useState<number[]>([]);
 const launcher=useRef<HTMLButtonElement>(null),composer=useRef<HTMLTextAreaElement>(null),fileInput=useRef<HTMLInputElement>(null),bottom=useRef<HTMLDivElement>(null),request=useRef<AbortController|null>(null),photoRequest=useRef(0),sequence=useRef(0);
 const busy=pending!==null;
 useEffect(()=>()=>{request.current?.abort();photoRequest.current++},[]);
 useEffect(()=>{
  if(!open)return;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);let active=true;
  setServiceError(false);
  void fetch('/api/chat',{signal:controller.signal,headers:{Accept:'application/json'}}).then(async response=>{
   if(!response.ok)throw Error('status');const result=await response.json();
   if(typeof result.configured!=='boolean'||!Array.isArray(result.providers)||!result.providers.every((v:unknown)=>typeof v==='string'))throw Error('status');
   if(active)setService({configured:result.configured,providers:result.providers,maxImageBytes:typeof result.maxImageBytes==='number'?result.maxImageBytes:3000000});
  }).catch(()=>{if(active){setService(null);setServiceError(true)}}).finally(()=>clearTimeout(timeout));
  return()=>{active=false;controller.abort();clearTimeout(timeout)};
 },[open,statusAttempt]);
 useEffect(()=>{if(open){composer.current?.focus();bottom.current?.scrollIntoView({block:'nearest',behavior:'smooth'})}},[open]);
 useEffect(()=>{if(open)bottom.current?.scrollIntoView({block:'nearest',behavior:'smooth'})},[entries.length,busy,open]);
 function close(){setOpen(false);onClose?.();launcher.current?.focus()}
 function errorText(code:string){
   if(code==='field_required')return t('Сначала обведите и сохраните участок на карте. Затем можно будет сравнить сроки по NASA.','Outline and save your field on the map first. Then you can compare sowing dates with NASA.');
  if(code==='not_configured')return t('Помощник ещё не подключён. Владелец проекта должен добавить ключ API на сервере.','The assistant is not connected yet. The project owner needs to add the server API key.');
  if(code==='refused')return t('Модель не смогла ответить на этот запрос. Уточните вопрос или попробуйте другое фото.','The model could not answer this request. Rephrase your question or try another photo.');
  if(code==='rate_limited'||code==='unavailable')return t('Доступные модели сейчас не ответили. Вопрос и фото сохранены здесь — попробуйте немного позже.','The available models could not respond. Your question and photo are still here; try again shortly.');
  if(code==='too_large'||code==='image_size')return t('Фото слишком большое. Выберите JPEG, PNG или WebP до 15 МБ.','The photo is too large. Choose a JPEG, PNG or WebP up to 15 MB.');
  if(code==='image_type'||code==='image_decode')return t('Не удалось открыть фото. Выберите JPEG, PNG или WebP.','This photo could not be opened. Choose JPEG, PNG or WebP.');
  if(code==='forbidden')return t('Нет доступа к помощнику. Откройте сайт через свой аккаунт.','The assistant is not accessible. Open the site with your account.');
  if(code==='invalid_response')return t('Ответ не прошёл проверку. Параметры поля не изменены. Можно повторить вопрос.','The response did not pass validation. Your field inputs are unchanged. You can retry the question.');
  if(code==='stale_context')return t('Условия поля изменились. Задайте вопрос ещё раз для текущего участка.','Field inputs have changed. Ask again using the current field.');
  return t('Ответ не получен. Проверьте соединение и повторите — вопрос и фото остались здесь.','No response received. Check your connection and retry; your question and photo are still here.');
 }
 async function selectPhoto(file:File|undefined){
  if(!file)return;const token=++photoRequest.current;setPhotoBusy(true);setError(null);
  try{const prepared=await preparePhoto(file);if(token===photoRequest.current)setPhoto(prepared)}catch(err){if(token===photoRequest.current)setError(err instanceof Error?err.message:'image_decode')}finally{if(token===photoRequest.current)setPhotoBusy(false)}
 }
 async function send(event?:FormEvent){
  event?.preventDefault();if(request.current||photoBusy||!service?.configured||(!draft.trim()&&!photo))return;
  const question=draft.trim()||t('Помоги разобраться с этим фото почвы. Что видно и что нужно уточнить?','Help me understand this soil photo. What is visible and what should I check?');
  const capturedKey=contextKey,attached=photo,controller=new AbortController();request.current=controller;setError(null);setPending({text:question,hadPhoto:!!attached});
  const timeout=setTimeout(()=>controller.abort(),85000);
  try{
   const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({lang,messages:recentMessages(entries,question),context,...(attached?{image:{mimeType:attached.mimeType,data:attached.data}}:{})}),signal:controller.signal});
   const raw=await response.json();if(!response.ok)throw Error(typeof raw.error?.code==='string'?raw.error.code:typeof raw.code==='string'?raw.code:response.status===429?'rate_limited':'unavailable');
   let result;try{result=parseAssistantResponse(raw)}catch{throw Error('invalid_response')}
   if(request.current!==controller||controller.signal.aborted)return;
   const userEntry:Entry={id:++sequence.current,role:'user',text:question,hadPhoto:!!attached};
   const answerEntry:Entry={id:++sequence.current,role:'assistant',text:result.answer,proposal:result.proposal,contextKey:capturedKey,provider:result.provider,model:result.model,switched:result.switched};
   setEntries(previous=>[...previous,userEntry,answerEntry].slice(-24));setDraft('');
  }catch(err){if(request.current===controller)setError(controller.signal.aborted?'unavailable':err instanceof Error?err.message:'unavailable')}
  finally{clearTimeout(timeout);if(request.current===controller){request.current=null;setPending(null)}}
 }
 function stop(){request.current?.abort();request.current=null;setPending(null);setError(null);composer.current?.focus()}
 async function apply(entry:Entry){
  if(!entry.proposal||!entry.contextKey||entry.contextKey!==contextKey||applying!==null)return;
  setApplying(entry.id);setError(null);
  try{await onProposal(entry.proposal,entry.contextKey);setApplied(ids=>[...ids,entry.id]);close()}catch(err){const code=err instanceof Error?err.message:'';setError(code==='stale_context'||code==='field_required'?code:'invalid_response')}finally{setApplying(null)}
 }
 function proposalView(entry:Entry){
  const p=entry.proposal;if(!p)return null;const stale=entry.contextKey!==contextKey,isApplied=applied.includes(entry.id);
  const date=(value:string)=>new Date(value+'T12:00:00Z').toLocaleDateString(lang==='ru'?'ru-RU':'en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
  const soils={unknown:t('Не знаю','Unknown'),loam:t('Суглинок','Loam'),sand:t('Песчаная','Sandy'),clay:t('Глинистая','Clay')};
  const methods={surface:t('По бороздам','Furrow'),sprinkler:t('Дождевание','Sprinkler'),drip:t('Капельный','Drip')};
  const crops=cropLabels;
  return <div className="assistant-proposal"><strong>{p.kind==='search'?t('Проверить период посева','Check a sowing period'):t('Предложенные условия','Suggested inputs')}</strong><dl>{p.kind==='search'?<div><dt>{t('Даты','Dates')}</dt><dd>{date(p.start)} — {date(p.end)}</dd></div>:<>{p.crop&&<div><dt>{t('Культура','Crop')}</dt><dd>{crops[p.crop][lang==='ru'?'ru':'en']}</dd></div>}{p.planting&&<div><dt>{t('Посев','Sowing')}</dt><dd>{date(p.planting)}</dd></div>}{p.soil&&<div><dt>{t('Почва · предположение','Soil · assumption')}</dt><dd>{soils[p.soil]}</dd></div>}{p.method&&<div><dt>{t('Полив','Irrigation')}</dt><dd>{methods[p.method]}</dd></div>}{p.weeklyWaterM3!==undefined&&<div><dt>{t('Доступная вода','Available water')}</dt><dd>{p.weeklyWaterM3.toLocaleString(lang==='ru'?'ru-RU':'en-GB')} {t('м³/неделю','m³/week')}</dd></div>}</>}</dl><p>{p.reason}</p><small>{p.kind==='search'?t('Kisht сравнит даты по NASA и рассчитает полив.','Kisht will compare NASA dates and calculate irrigation.'):t('Подставим эти значения. Затем можно проверить их в симуляции.','Apply these inputs, then test them in the simulation.')}</small><button type="button" className="primary" disabled={busy||applying!==null||stale||isApplied} onClick={()=>void apply(entry)}>{applying===entry.id?<LoaderCircle size={15} className="spin"/>:isApplied?<Check size={15}/>:null}{isApplied?t('Применено','Applied'):applying===entry.id?t('Применяем…','Applying…'):p.kind==='search'?t('Проверить по NASA','Check with NASA'):t('Подставить в условия','Use these inputs')}</button>{stale&&!isApplied&&<small className="assistant-stale">{t('Условия изменились. Получите новое предложение.','Inputs changed. Request a new proposal.')}</small>}</div>;
 }
 const suggestions=[t('В какой сезон лучше сеять пшеницу и сколько нужно воды?','Which season is better for sowing wheat and how much water is needed?'),t('Чем отличаются кукуруза и картофель для моего участка?','How do maize and potato differ for my plot?'),t('Как определить тип моей почвы?','How can I identify my soil type?')];
 return <><button ref={launcher} type="button" className={'assistant-launcher'+(open?' is-open':'')} aria-expanded={open} aria-controls="kisht-assistant" onClick={()=>setOpen(value=>!value)}>{busy?<LoaderCircle size={19} className="spin"/>:<MessageCircle size={19}/>}<span>{t('Помощник','Assistant')}</span></button>{open&&<section id="kisht-assistant" className="assistant-drawer" role="dialog" aria-modal="false" aria-labelledby="assistant-title" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();close()}}}>
  <header className="assistant-header"><div><span className="assistant-mark"><MessageCircle size={19}/></span><div><h2 id="assistant-title">{t('Помощник Кишт','Kisht assistant')}</h2><p>{t('Вопрос → план → проверка на поле','Question → plan → field simulation')}</p></div></div><button type="button" className="assistant-icon" aria-label={t('Закрыть помощника','Close assistant')} onClick={close}><X size={20}/></button></header>
  <div className="assistant-conversation" aria-busy={busy}>
   {!entries.length&&<div className="assistant-welcome"><h3>{t('Спросите о посеве или поле','Ask about sowing or your field')}</h3><p>{t('Общие вопросы отвечу сразу. Для сравнения дат на вашем участке нужен сохранённый контур — тогда подключим NASA.','General questions get an immediate answer. Comparing dates on your plot needs a saved outline — then NASA can be used.')}</p><p className="assistant-field-status">{fieldStatus}</p><div className="assistant-suggestions">{suggestions.map(question=><button type="button" key={question} disabled={busy} onClick={()=>{setDraft(question);composer.current?.focus()}}>{question}</button>)}</div><small>{t('По фото почвы — предварительные признаки и уточняющие вопросы, без определения точного состава.','Soil photos provide preliminary clues and follow-up questions, not a measured composition.')}</small></div>}
   {entries.map(entry=><article className={`assistant-message ${entry.role}`} key={entry.id}><span className="assistant-speaker">{entry.role==='user'?t('Вы','You'):t('Кишт · ИИ','Kisht · AI')}</span>{entry.hadPhoto&&<span className="assistant-photo-tag"><ImagePlus size={13}/>{t('Фото приложено','Photo attached')}</span>}<p className="assistant-answer">{entry.text}</p>{entry.role==='assistant'&&<>{entry.switched&&<small className="assistant-fallback">{t('Ответила резервная модель','A fallback model answered')} · {entry.provider}</small>}{proposalView(entry)}</>}</article>)}
   {pending&&<><article className="assistant-message user"><span className="assistant-speaker">{t('Вы','You')}</span>{pending.hadPhoto&&<span className="assistant-photo-tag"><ImagePlus size={13}/>{t('Фото приложено','Photo attached')}</span>}<p className="assistant-answer">{pending.text}</p></article><p className="assistant-thinking" role="status"><LoaderCircle size={16} className="spin"/>{t('Разбираем вопрос и данные…','Reviewing your question and data…')}</p></>}
   <div ref={bottom}/>
  </div>
  <div className="assistant-compose-area">
   {serviceError?<div className="assistant-service" role="status"><span>{t('Не удалось проверить подключение.','Could not check the connection.')}</span><button type="button" onClick={()=>setStatusAttempt(n=>n+1)}>{t('Повторить','Retry')}</button></div>:!service?<p className="assistant-service" role="status">{t('Проверяем подключение…','Checking connection…')}</p>:!service.configured?<p className="assistant-service" role="status">{t('ИИ пока не подключён. Нужен серверный ключ API; симуляция работает независимо.','AI is not connected yet. A server API key is needed; the simulation works independently.')}</p>:null}
   {error&&<div className="assistant-error" role="alert"><p>{errorText(error)}</p><button type="button" className="assistant-icon" aria-label={t('Закрыть сообщение','Dismiss message')} onClick={()=>setError(null)}><X size={15}/></button></div>}
   {photo&&<div className="assistant-photo"><img src={photo.preview} alt={t('Фото для анализа','Photo to analyse')}/><div><b>{t('Фото для помощника','Photo for the assistant')}</b><small>{t('Используется в следующих вопросах, пока не уберёте.','Used in follow-up questions until removed.')}</small></div><button type="button" className="assistant-icon" disabled={busy||photoBusy} aria-label={t('Убрать фото','Remove photo')} onClick={()=>setPhoto(null)}><X size={17}/></button></div>}
   <form onSubmit={send} className="assistant-form"><label className="assistant-sr-only" htmlFor="assistant-question">{t('Вопрос помощнику','Question for the assistant')}</label><textarea id="assistant-question" ref={composer} value={draft} disabled={busy} maxLength={3000} rows={3} placeholder={t('Спросите о посеве, воде или почве…','Ask about sowing, water or soil…')} onChange={event=>setDraft(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void send()}}}/><div className="assistant-compose-actions"><input ref={fileInput} type="file" className="assistant-sr-only" tabIndex={-1} accept="image/jpeg,image/png,image/webp" capture="environment" aria-label={t('Прикрепить фото почвы','Attach a soil photo')} onChange={event=>{void selectPhoto(event.target.files?.[0]);event.target.value=''}}/><button type="button" className="assistant-attach" disabled={busy||photoBusy} onClick={()=>fileInput.current?.click()}>{photoBusy?<LoaderCircle size={17} className="spin"/>:<ImagePlus size={17}/>} {t('Фото','Photo')}</button><span>{draft.length>2700?`${draft.length}/3000`:t('Enter — отправить','Enter to send')}</span>{busy?<button type="button" className="assistant-send" aria-label={t('Остановить ответ','Stop response')} onClick={stop}><Square size={16}/></button>:<button type="submit" className="assistant-send" disabled={!service?.configured||serviceError||photoBusy||(!draft.trim()&&!photo)} aria-label={t('Отправить вопрос','Send question')}><ArrowUp size={20}/></button>}</div></form>
   <p className="assistant-disclosure">{t('При отправке текст, фото и данные выбранного поля передаются','Sending shares your text, photo and selected field data with')} {service?.providers.length?service.providers.join(' / '):t('подключённому ИИ','the connected AI')}. {t('Предложения применяются только по вашей кнопке.','Suggestions are applied only when you choose.')}</p>
  </div>
 </section>}</>;
}
