import {lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {Sprout,MapPin,Play,Pause,Layers,ArrowRight,Check,LoaderCircle,AlertTriangle} from 'lucide-react';
import {analyze,areaHa,center,cropLabels,isSimulatedCrop,simulatedCrops,validPolygon,validDate,validEvents,type Lang,type Point,type SoilId,type IrrigationEvent,type SourceData} from './domain';
import {defaultProfiles,validCropProfile,type CropProfile,type SimulatedCrop} from './evapotranspiration';
import {seasonLength} from './season';
import {terrainKey,type Terrain} from './terrain';
import {loadNASA,loadForecast,loadTerrain,type ForecastData} from './liveData';
import {stageNames} from './WheatSettings';
import IrrigationSchedule from './IrrigationSchedule';
import DayStatus from './DayStatus';
import RiskTimeline from './RiskTimeline';
import StageSummary from './StageSummary';
import DailyExplanation from './DailyExplanation';
import RootZonePanel from './RootZonePanel';
import DemandPanel from './DemandPanel';
import {requireCurrentProposal,type AssistantContext,type AssistantProposal} from './assistant';
import type {SearchRange} from './plantingPlan';
import './workflow.css';
const PlotMap=lazy(()=>import('./PlotMap'));
const Field=lazy(()=>import('./Field'));
const JuryDemo=lazy(()=>import('./JuryDemo'));
const AutoPlan=lazy(()=>import('./AutoPlan'));
const ChatAssistant=lazy(()=>import('./ChatAssistant'));
type Tab='setup'|'analysis'|'plans'|'jury';
type Status='idle'|'loading'|'ready'|'error';
const initialState=()=>{try{return JSON.parse(localStorage.getItem('kisht-field-v2')||'{}')||{}}catch{return {}}};
const defaultDate=()=>`${new Date().getFullYear()+1}-04-01`;
export default function App(){
 const initial=useMemo(initialState,[]);
 const [lang,setLang]=useState<Lang>(initial.langChosen&&initial.lang==='ru'?'ru':'en'),[tab,setTab]=useState<Tab>('setup');
 const [plot,setPlot]=useState<Point[]>(validPolygon(initial.plot)?initial.plot:[]);
 const [planting,setPlanting]=useState(validDate(initial.planting??'')?initial.planting:defaultDate());
 const [soil,setSoil]=useState<SoilId>(['loam','clay','sand','unknown'].includes(initial.soil)?initial.soil:'unknown');
 const [method,setMethod]=useState<'surface'|'sprinkler'|'drip'>(['surface','sprinkler','drip'].includes(initial.method)?initial.method:'surface');
 const [initialStorage,setInitialStorage]=useState(Number.isFinite(initial.initialStorage)&&initial.initialStorage>=0&&initial.initialStorage<=100?initial.initialStorage:65);
 const [waterLimit,setWaterLimit]=useState<string>(typeof initial.waterLimit==='string'&&Number.isFinite(+initial.waterLimit)&&+initial.waterLimit>=0?initial.waterLimit:'');
 const initialCrop=isSimulatedCrop(initial.crop)?initial.crop as SimulatedCrop:'wheat';
 const [crop,setCrop]=useState<SimulatedCrop>(initialCrop);
 // Live workspace supports FAO-56 crops only. No illustrative crop fallback in the main path.
 const [wheat,setWheat]=useState<CropProfile>(validCropProfile(initial.wheat)?{...initial.wheat,thermal:undefined}:{...defaultProfiles[initialCrop]});
 const [events,setEvents]=useState<IrrigationEvent[]>(validEvents(initial.events)?initial.events:[]);
 const [year,setYear]=useState([2020,2021,2022,2023,2024].includes(initial.year)?initial.year:2024),[day,setDay]=useState(0),[playing,setPlaying]=useState(false),[cut,setCut]=useState(false);
 const [loaded,setLoaded]=useState<{key:string;data:SourceData;origin:'manual'|'plan'}|null>(null);
 const [forecast,setForecast]=useState<{key:string;data:ForecastData}|null>(null);
 const [terrainData,setTerrainData]=useState<{key:string;data:Terrain}|null>(null);
 const [status,setStatus]=useState<Record<'nasa'|'forecast'|'terrain',Status>>({nasa:'idle',forecast:'idle',terrain:'idle'});
 const [loading,setLoading]=useState(false);const request=useRef<AbortController|null>(null),supplementalRequest=useRef<AbortController|null>(null);
 const [assistantSearch,setAssistantSearch]=useState<{range:SearchRange;revision:number}|null>(null);
 const [assistantRun,setAssistantRun]=useState(false);
 const [assistantUndo,setAssistantUndo]=useState<{planting:string;crop:SimulatedCrop;soil:SoilId;method:typeof method;waterLimit:string;wheat:CropProfile;events:IrrigationEvent[];year:number}|null>(null);
 const t=(a:string,b:string)=>lang==='ru'?a:b;
 const coord=plot.length?center(plot):[38.53,68.55],area=validPolygon(plot)?areaHa(plot):0;
 const duration=seasonLength(crop,wheat),locationKey=`${coord[0].toFixed(6)}:${coord[1].toFixed(6)}`;
 const key=`${locationKey}:${planting}:${year}:${duration}:${crop}`;
 const usable=validPolygon(plot)&&validDate(planting)&&planting>='2001-01-01'&&planting<='2100-12-31';
 const data=loaded?.key===key&&loaded.data.kind==='nasa'?loaded.data:null;
 const weather=forecast?.key===locationKey?forecast.data:null;
 const terrain=validPolygon(plot)&&terrainData?.key===terrainKey(plot)?terrainData.data:undefined;
 const efficiency=method==='drip'?.9:method==='sprinkler'?.75:.6;
 const options=useMemo(()=>({wheat,profile:wheat,irrigationEvents:events,efficiency,initialStorage:initialStorage/100,weeklyLimit:waterLimit!==''&&area>0?Number(waterLimit)/(area*10):undefined}),[wheat,events,efficiency,initialStorage,waterLimit,area]);
 const rows=useMemo(()=>data?analyze(data,planting,crop,soil,0,options):[],[data,planting,crop,soil,options]);
 const selected=Math.min(day,Math.max(0,rows.length-1)),current=rows[selected];
 const riskStarts=useMemo(()=>rows.flatMap((r,i)=>(['waterRisk','heat','frost'] as const).some(k=>r[k]&&(i===0||!rows[i-1][k]))?[i]:[]),[rows]);
 const nextRisk=riskStarts.find(i=>i>selected)??riskStarts[0];
 const fieldSelected=validPolygon(plot);
 const assistantKey=JSON.stringify({plot,planting,crop,soil,method,waterLimit,initialStorage,wheat,events,year});
 const assistantContext:AssistantContext={
  localDate:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dushanbe',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),
  field:{selected:fieldSelected,pointCount:plot.length,boundarySaved:fieldSelected,region:'Tajikistan',coordinates:fieldSelected?{latitude:coord[0],longitude:coord[1]}:null,areaHa:area||null,crop,cropLabel:cropLabels[crop][lang],planting,soil,soilIsAssumption:true,method,weeklyWaterM3:waterLimit===''?null:Number(waterLimit),initialStoragePercent:initialStorage,stageDays:wheat.stages,durationDays:duration,irrigationEvents:events.slice(0,50),irrigationEventCount:events.length},
  historicalWeather:data?{provider:'NASA POWER',historicalYear:year,start:data.start,end:data.end,retrievedAt:data.fetchedAt,url:data.url,seasonRainMm:rows.reduce((s,r)=>s+r.rain,0),seasonIrrigationMm:rows.reduce((s,r)=>s+r.grossIrrigation,0),unmetDemandMm:rows.reduce((s,r)=>s+r.unmet,0),waterRiskDays:rows.filter(r=>r.waterRisk).length,heatDays:rows.filter(r=>r.heat).length,frostDays:rows.filter(r=>r.frost).length}:null,
  forecast:weather?{provider:'Open-Meteo',retrievedAt:weather.fetchedAt,url:weather.url,days:weather.days.map(r=>({date:r.date,minC:r.min,maxC:r.max,rainMm:r.rain}))}:null,
  selectedDay:current?{scenarioDate:current.date,sourceDate:current.sourceDate,stage:current.stage,minC:current.min,maxC:current.max,demandMm:current.demand,uptakeMm:current.actual,unmetMm:current.unmet,storageMm:current.storage,waterRisk:current.waterRisk,heat:current.heat,frost:current.frost}:null,
  capabilities:{supportedSimulationCrops:simulatedCrops,searchYears:[2022,2023,2024],searchStepDays:7,searchMaxSpanDays:120,seasonIsHistorical:true,yieldAndMortalityModelled:false,photoSoilIsTentative:true}
 };
 const fmt=(date:string)=>new Intl.DateTimeFormat(lang==='ru'?'ru-RU':'en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
 const cropName=cropLabels[crop][lang==='ru'?'ru':'en'];
 function changeCrop(next:SimulatedCrop){
  if(next===crop)return;
  const soilWater=({loam:110,sand:60,clay:145,unknown:110})[soil];
  setCrop(next);setWheat({...defaultProfiles[next],availableWater:soilWater,thermal:undefined});setEvents([]);setDay(0);setPlaying(false);
 }
 useEffect(()=>{document.documentElement.lang=lang;document.title=lang==='en'?'Kisht — your field lab':'Кишт — лаборатория поля';try{localStorage.setItem('kisht-field-v2',JSON.stringify({lang,langChosen:true,plot,planting,crop,soil,method,initialStorage,waterLimit,wheat,events,year}))}catch{}},[lang,plot,planting,crop,soil,method,initialStorage,waterLimit,wheat,events,year]);
 useEffect(()=>{request.current?.abort();request.current=null;supplementalRequest.current?.abort();supplementalRequest.current=null;setLoading(false);setStatus({nasa:'idle',forecast:'idle',terrain:'idle'});setPlaying(false);setDay(0)},[key,JSON.stringify(plot)]);
 useEffect(()=>()=>{request.current?.abort();supplementalRequest.current?.abort()},[]);
 useEffect(()=>{window.scrollTo({top:0,behavior:'instant'});setPlaying(false)},[tab]);
 useEffect(()=>{if(!playing)return;const timer=setInterval(()=>setDay(d=>{if(d>=rows.length-1){setPlaying(false);return d}return d+1}),350);return()=>clearInterval(timer)},[playing,rows.length]);
 async function load(){
  if(!usable)return;request.current?.abort();supplementalRequest.current?.abort();supplementalRequest.current=null;const c=new AbortController();request.current=c;
  setLoading(true);setPlaying(false);setDay(0);setLoaded(null);setForecast(null);setTerrainData(null);
  setStatus({nasa:'loading',forecast:'loading',terrain:'loading'});setTab('analysis');
  const timer=setTimeout(()=>c.abort(),60000);const fresh=()=>request.current===c;
  const run=async(name:'nasa'|'forecast'|'terrain',work:()=>Promise<void>)=>{try{await work();if(fresh())setStatus(s=>({...s,[name]:'ready'}))}catch{if(fresh())setStatus(s=>({...s,[name]:'error'}))}};
  await Promise.allSettled([
   run('nasa',async()=>{const result=await loadNASA({lat:coord[0],lon:coord[1],planting,year,duration,signal:c.signal});if(fresh())setLoaded({key,data:result,origin:'manual'})}),
   run('forecast',async()=>{const result=await loadForecast({lat:coord[0],lon:coord[1],signal:c.signal});if(fresh())setForecast({key:locationKey,data:result})}),
   run('terrain',async()=>{const result=await loadTerrain(plot,c.signal);if(fresh())setTerrainData({key:terrainKey(plot),data:result})})
  ]);clearTimeout(timer);if(fresh()){request.current=null;setLoading(false)}
 }
 // The next render contains all proposed inputs before starting the existing real-data loader.
 useEffect(()=>{if(!assistantRun)return;setAssistantRun(false);if(usable)void load();else setTab('setup')},[assistantRun]);
 function acceptAssistantProposal(proposal:AssistantProposal,requestKey:string){
  let p:AssistantProposal;
  try{p=requireCurrentProposal(proposal,requestKey,assistantKey,planting)}catch{throw Error('stale_context')}
  if(p.kind==='search'){
   if(!usable)throw Error('field_required');
   setAssistantSearch(s=>({range:{start:p.start,end:p.end},revision:(s?.revision??0)+1}));setTab('plans');return;
  }
  setAssistantUndo({planting,crop,soil,method,waterLimit,wheat,events,year});
  if(p.crop!==undefined&&isSimulatedCrop(p.crop)){
   const next=p.crop;const soilWater=({loam:110,sand:60,clay:145,unknown:110})[p.soil??soil];
   setCrop(next);setWheat({...defaultProfiles[next],availableWater:soilWater,thermal:undefined});setEvents([]);
  }
  if(p.planting!==undefined){
   if(p.planting!==planting)setEvents([]);
   setPlanting(p.planting);
  }
  if(p.soil!==undefined){const nextSoil=p.soil;setSoil(nextSoil);setWheat(w=>({...w,availableWater:({loam:110,sand:60,clay:145,unknown:110})[nextSoil]}))}
  if(p.method!==undefined)setMethod(p.method);
  if(p.weeklyWaterM3!==undefined)setWaterLimit(String(p.weeklyWaterM3));
  setAssistantRun(true);setPlaying(false);
 }
 function undoAssistant(){
  if(!assistantUndo)return;
  setPlanting(assistantUndo.planting);setCrop(assistantUndo.crop);setSoil(assistantUndo.soil);setMethod(assistantUndo.method);setWaterLimit(assistantUndo.waterLimit);setWheat(assistantUndo.wheat);setEvents(assistantUndo.events);setYear(assistantUndo.year);setAssistantUndo(null);setAssistantRun(true);
 }
 // A plan can be applied directly from Recommendations before a manual data load.
 useEffect(()=>{
  if(!data||loaded?.origin!=='plan'||(terrain&&weather))return;
  const c=new AbortController();supplementalRequest.current=c;
  const ownsRequest=()=>supplementalRequest.current===c;
  const timer=setTimeout(()=>c.abort(),35000);
  if(!terrain){
   setStatus(s=>({...s,terrain:'loading'}));
   void loadTerrain(plot,c.signal).then(result=>{if(ownsRequest()&&!c.signal.aborted){setTerrainData({key:terrainKey(plot),data:result});setStatus(s=>({...s,terrain:'ready'}))}}).catch(()=>{if(ownsRequest())setStatus(s=>({...s,terrain:'error'}))});
  }
  if(!weather){
   setStatus(s=>({...s,forecast:'loading'}));
   void loadForecast({lat:coord[0],lon:coord[1],signal:c.signal}).then(result=>{if(ownsRequest()&&!c.signal.aborted){setForecast({key:locationKey,data:result});setStatus(s=>({...s,forecast:'ready'}))}}).catch(()=>{if(ownsRequest())setStatus(s=>({...s,forecast:'error'}))});
  }
  return()=>{if(ownsRequest())supplementalRequest.current=null;clearTimeout(timer);c.abort()};
 },[data,loaded?.origin,locationKey,JSON.stringify(plot)]);
 function applyPlan(date:string,next:IrrigationEvent[],source:SourceData,sourceYear:number){
  if(source.kind!=='nasa'||source.days.some(d=>!Number.isFinite(d.et0)))return;
  request.current?.abort();request.current=null;supplementalRequest.current?.abort();supplementalRequest.current=null;setLoading(false);setPlanting(date);setEvents(next);setYear(sourceYear);
  setLoaded({key:`${locationKey}:${date}:${sourceYear}:${duration}:${crop}`,data:source,origin:'plan'});setDay(0);setPlaying(false);setTab('analysis');
 }
 const sourceStatus=(name:'nasa'|'forecast'|'terrain')=>name==='nasa'&&data||name==='forecast'&&weather||name==='terrain'&&terrain?'ready':status[name];
 return <div className="v2-app focused-app"><header className="v2-header"><a className="v2-brand" href="#" onClick={e=>{e.preventDefault();setTab('setup')}}><Sprout/>{t('Кишт','Kisht')}</a><nav aria-label={t('Разделы','Sections')}>{(['setup','analysis','plans','jury'] as Tab[]).map((v,i)=><button key={v} className={tab===v?'active':''} onClick={()=>setTab(v)}>{i<3&&<span>0{i+1}</span>}{({setup:t('Мой участок','My field'),analysis:t('Симуляция','Simulation'),plans:t('Рекомендации','Recommendations'),jury:t('Демо симуляция','Demo simulation')})[v]}</button>)}</nav><button className="language" aria-label={lang==='en'?'Language: English':'Язык: русский'} onClick={()=>setLang(lang==='en'?'ru':'en')}>{lang==='en'?'EN':'RU'}</button></header>
 <main className="v2-main">
 {assistantUndo&&tab!=='jury'&&<div className="assistant-applied" role="status"><span>{t('Параметры из чата применены как условия сценария.','Chat inputs applied as scenario assumptions.')}</span><button onClick={undoAssistant}>{t('Вернуть предыдущие условия','Restore previous inputs')}</button></div>}
 {tab==='jury'?<Suspense fallback={<p>{t('Открываем демонстрацию…','Opening demonstration…')}</p>}><JuryDemo lang={lang}/></Suspense>:<>
 <div className="v2-title"><div><span className="eyebrow">TAJIKISTAN · NASA POWER + SRTM</span><h1>{tab==='setup'?t('Ваше поле. Ваш план.','Your field. Your plan.'):tab==='analysis'?t('Что происходит с посевом?','What is happening to your crop?'):t('Когда сеять и сколько поливать?','When to sow and how much to irrigate?')}</h1><p>{tab==='setup'?t('Обведите участок, укажите дату и условия. Всё остальное загрузим одной кнопкой.','Outline your field, choose the date and conditions. One button loads the data.'):tab==='plans'?t('Сравним сроки на реальной погоде прошлых лет и соберём план для симуляции.','Compare planting dates using past weather and build a plan for simulation.'):t('Погода из NASA. Состояние растений — результат модели с вашими условиями.','Weather from NASA. Crop conditions are model estimates using your inputs.')}</p></div></div>
 {tab==='setup'&&<><div className="field-setup"><section className="v2-panel"><h2><MapPin size={20}/> {t('1. Обведите свой участок','1. Outline your field')}</h2><Suspense fallback={<p>{t('Загружаем карту…','Loading map…')}</p>}><PlotMap lang={lang} value={plot} onChange={setPlot}/></Suspense>{area>0&&<p className="saved-plot"><Check size={17}/>{area.toFixed(2)} {t('га · границы сохранены','ha · boundary saved')}</p>}</section>
 <section className="v2-panel field-inputs"><h2>{t('2. Условия посева','2. Sowing conditions')}</h2>
 <label>{t('Культура','Crop')}<select value={crop} onChange={e=>changeCrop(e.target.value as SimulatedCrop)}>{simulatedCrops.map(id=><option key={id} value={id}>{cropLabels[id][lang==='ru'?'ru':'en']}</option>)}</select></label>
 <div className="crop-supported"><Sprout/><div><b>{cropName}</b><small>{t('Профиль FAO-56 · не местный сорт. Параметры можно уточнить ниже.','FAO-56 profile · not a local cultivar. Refine parameters below if needed.')}</small></div></div>
 <label>{t('Когда вы хотите посеять','Your proposed sowing date')}<input type="date" min="2001-01-01" max="2100-12-31" value={planting} onChange={e=>setPlanting(e.target.value)}/></label>
 <label>{t('Почва','Soil')}<select value={soil} onChange={e=>{const v=e.target.value as SoilId;setSoil(v);setWheat(p=>({...p,availableWater:({loam:110,sand:60,clay:145,unknown:110})[v]}))}}>{(['unknown','loam','sand','clay'] as SoilId[]).map(s=><option key={s} value={s}>{({unknown:t('Не знаю','Unknown'),loam:t('Суглинок','Loam'),sand:t('Песчаная','Sandy'),clay:t('Глинистая','Clay')})[s]}</option>)}</select></label>
 <label>{t('Способ полива','Irrigation method')}<select value={method} onChange={e=>setMethod(e.target.value as typeof method)}><option value="surface">{t('По бороздам','Furrow')}</option><option value="sprinkler">{t('Дождевание','Sprinkler')}</option><option value="drip">{t('Капельный','Drip')}</option></select></label>
 <label>{t('Доступно воды, м³ в неделю','Available water, m³ per week')}<input type="number" min="0" value={waterLimit} placeholder={t('Неизвестно','Unknown')} onChange={e=>{if(e.target.value===''||+e.target.value>=0)setWaterLimit(e.target.value)}}/></label>
 <details className="input-assumptions"><summary>{t('Уточнить почву и параметры культуры','Refine soil and crop parameters')}</summary><p>{t('Это допущения модели, не измерения NASA. При неизвестной почве используем суглинок.','These are model assumptions, not NASA measurements. Unknown soil uses loam.')}</p><label>{t('Начальный запас доступной воды, %','Initial available-water storage, %')}<input type="number" min="0" max="100" value={initialStorage} onChange={e=>{const v=+e.target.value;if(v>=0&&v<=100)setInitialStorage(v)}}/></label><label>{t('Доступная вода почвы, мм/м','Soil available water, mm/m')}<input type="number" min="20" max="250" value={wheat.availableWater} onChange={e=>{const p={...wheat,availableWater:+e.target.value};if(validCropProfile(p))setWheat(p)}}/></label>{wheat.stages.map((n,i)=><label key={i}>{stageNames[i][lang==='ru'?0:1]} · {t('дней','days')}<input type="number" min="1" max="180" value={n} onChange={e=>{const stages=[...wheat.stages] as CropProfile['stages'];stages[i]=+e.target.value;const p={...wheat,stages};if(validCropProfile(p))setWheat(p)}}/></label>)}<label>{t('Год погоды для вашего сценария','Weather year for your scenario')}<select value={year} onChange={e=>setYear(+e.target.value)}>{[2024,2023,2022,2021,2020].map(y=><option key={y}>{y}</option>)}</select></label></details></section></div>
 <details className="v2-panel"><summary>{t('Мой календарь полива','My irrigation schedule')} · {events.length}</summary><IrrigationSchedule duration={duration} events={events} planting={planting} area={area} onChange={setEvents} lang={lang}/></details>
 <section className="start-run"><div><h2>{t('3. Получите результат','3. Get your results')}</h2><p>{t(`Загрузим ${duration} дней NASA за ${year} год, высоты участка и ближайший прогноз. Пропуски не заменяем демоданными.`,`Load ${duration} NASA days from ${year}, field elevations and the upcoming forecast. Missing data is never replaced with a demo.`)}</p><small>{t('Сервисам передаются координаты участка для получения погоды и высот.','Field coordinates are sent to the weather and elevation services.')}</small></div><button className="primary" disabled={!usable||loading} onClick={load}>{t('Загрузить данные и открыть симуляцию','Load data & open simulation')}<ArrowRight size={18}/></button></section></>}
 {tab!=='setup'&&<><div className="field-summary"><span><MapPin size={15}/>{area>0?`${area.toFixed(2)} ${t('га','ha')} · ${coord[0].toFixed(4)}, ${coord[1].toFixed(4)}`:t('Сначала выберите участок','Select a field first')}</span><span>{cropName} · {validDate(planting)?fmt(planting):'—'}</span><button onClick={()=>setTab('setup')}>{t('Изменить условия','Edit inputs')}</button></div>
 {!usable?<section className="v2-panel"><p>{t('Выберите участок и дату, чтобы начать.','Select a field and date to begin.')}</p><button className="primary" onClick={()=>setTab('setup')}>{t('Выбрать участок','Choose field')}</button></section>:<>
 {tab==='plans'&&<Suspense fallback={<p>{t('Открываем анализ…','Opening analysis…')}</p>}><AutoPlan key={assistantSearch?.revision??0} initialRange={assistantSearch?.range.start.slice(0,4)===planting.slice(0,4)?assistantSearch?.range:undefined} lat={coord[0]} lon={coord[1]} planting={planting} soil={soil} crop={crop} wheat={wheat} options={options} lang={lang} area={area} onApply={applyPlan}/></Suspense>}
 {tab==='analysis'&&<><div className="source-progress" aria-live="polite">{(['nasa','terrain','forecast'] as const).map(name=>{const s=sourceStatus(name);return <div key={name} data-status={s}>{s==='ready'?<Check size={16}/>:s==='loading'?<LoaderCircle size={16} className="spin"/>:<AlertTriangle size={16}/>}<span>{name==='nasa'?'NASA POWER':name==='terrain'?'SRTM':t('Прогноз на 7 дней','7-day forecast')}<small>{s==='ready'?t('Данные получены','Data received'):s==='loading'?t('Загружаем…','Loading…'):s==='error'?t('Недоступно — без подмены','Unavailable — no fallback'):t('Ещё не загружено','Not loaded')}</small></span></div>})}</div>
 {!loading&&(!data||!terrain||!weather)&&<div className="source-retry"><p>{t('Для отсутствующих источников результат не выдумывается. Можно повторить загрузку.','Missing sources are not filled with invented results. You can retry loading.')}</p><button className="primary" onClick={load}>{t('Загрузить данные','Load data')}</button></div>}
 {current&&<><div className="run-context"><b>{t(`Погода NASA ${year} → сценарий вашего посева`,`NASA ${year} weather → your sowing scenario`)}</b><span>{t('Это исторический сценарий, не прогноз всего будущего сезона.','Historical scenario, not a forecast of the entire future season.')}</span></div><div className="analysis-grid"><section className="v2-scene"><div className="scene-heading"><div><span className="eyebrow">{t('ДЕНЬ','DAY')} {selected+1} / {rows.length}</span><h2>{fmt(current.date)}</h2><p>{stageNames[current.stage??0][lang==='ru'?0:1]}</p></div><button className={cut?'active':''} onClick={()=>setCut(!cut)}><Layers size={16}/>{t('Корни','Roots')}</button></div>
 <div className="v2-canvas">{terrain?<Suspense fallback={<p>3D…</p>}><Field terrain={terrain} plot={plot} growth={current.developmentProgress} crop={crop} moisture={current.moisture} watering={current.grossIrrigation>0} raining={current.rain>0} cut={cut} stress={current.waterRisk} frost={current.frost} waterStress={current.demand>0?1-current.actual/current.demand:0} rootFraction={current.rootDepth===null?undefined:current.rootDepth/wheat.rootDepth} irrigationMethod={method} windSpeed={current.wind??0}/></Suspense>:<div className="terrain-missing"><Layers size={32}/><h3>{t('Ожидаем настоящий рельеф','Waiting for real terrain')}</h3><p>{t('3D участка появится после получения высот SRTM. Расчёты погоды и воды доступны справа.','Your 3D field appears once SRTM elevations arrive. Weather and water calculations are available alongside.')}</p></div>}{terrain&&<div className="scene-risk-label">{current.waterRisk||current.heat||current.frost?<><AlertTriangle size={15}/>{[current.waterRisk?(current.unmet>1e-6?t('Нехватка воды','Water shortage'):t('Низкий запас воды','Low water reserve')):null,current.heat?t('Жара','Heat'):null,current.frost?t('Заморозок','Frost'):null].filter(Boolean).join(' · ')}</>:<><Check size={15}/>{t('Сигналы риска не выявлены','No tracked risk signals')}</>}</div>}</div>
 <div className="scene-data"><span>{t('Дождь','Rain')}: {current.rain.toFixed(1)} mm</span><span>{t('Полив','Irrigation')}: {current.grossIrrigation.toFixed(1)} mm</span><span>{current.min.toFixed(1)}…{current.max.toFixed(1)} °C</span></div>
 <div className="calendar-timeline"><div><button className="primary" onClick={()=>{if(selected===rows.length-1)setDay(0);setPlaying(!playing)}}>{playing?<Pause size={16}/>:<Play size={16}/>} {playing?t('Пауза','Pause'):t('Проиграть сезон','Play season')}</button>{nextRisk!==undefined&&<button onClick={()=>{setDay(nextRisk);setPlaying(false)}}>{t('Следующий риск','Next risk')} · {fmt(rows[nextRisk].date)}</button>}</div><input aria-label={t('День сезона','Season day')} type="range" min="0" max={rows.length-1} value={selected} onChange={e=>{setDay(+e.target.value);setPlaying(false)}}/><RiskTimeline rows={rows} day={selected} lang={lang}/></div><small className="scene-footnote">{t('SRTM: реальные высоты, масштаб ×1. Растения и полив — визуализация расчёта, не спутниковое изображение посева.','SRTM: real elevations, scale ×1. Plants and irrigation visualise the model, not satellite imagery of the crop.')}</small></section><DayStatus rows={rows} row={current} day={selected} lang={lang} crop={crop} onPlan={()=>setTab('plans')}/></div>
 {cut&&<RootZonePanel row={current} lang={lang}/>}<StageSummary rows={rows} crop={crop} lang={lang} onDay={n=>{setDay(n);setPlaying(false)}}/><details className="v2-panel calculation-details"><summary>{t('Почему получился такой результат? Расчёт и источники','Why this result? Calculations and sources')}</summary><DailyExplanation row={current} lang={lang}/><DemandPanel row={current} profile={wheat} crop={crop} lang={lang}/><p>{t('Сорт, почва и начальная влажность требуют проверки на поле. Не рассчитываются болезни, питание, гибель и урожайность.','Cultivar, soil and initial moisture need field validation. Disease, nutrients, mortality and yield are not calculated.')}</p><a href={data!.url} target="_blank" rel="noreferrer">NASA POWER · JSON ↗</a><p>{data!.start} — {data!.end} · {t('Получено','Retrieved')}: {new Date(data!.fetchedAt).toLocaleString()}</p>{terrain&&<a href={terrain.url} target="_blank" rel="noreferrer">NASA SRTM · JSON ↗</a>}</details></>}
 {weather&&<section className="v2-panel forecast-panel"><h2>{t('Ближайшая погода — реальные даты','Upcoming weather — actual dates')}</h2><p>{t('Этот прогноз помогает ближайшим действиям. Он не подменяет погоду всего сезона.','Use this forecast for near-term decisions. It does not replace the full-season historical scenario.')}</p><div className="forecast-days">{weather.days.map(d=><div key={d.date}><small>{fmt(d.date)}</small><b>{d.min.toFixed(0)}…{d.max.toFixed(0)} °C</b><span>{d.rain.toFixed(1)} mm</span></div>)}</div><small><a href={weather.url} target="_blank" rel="noreferrer">Open-Meteo · CC BY 4.0 ↗</a></small></section>}</>}
 </>}</>}
 </>}
 <footer className="v2-footer"><span>{t('Кишт','Kisht')}</span><span>{t('Данные → причины → решение','Data → causes → decisions')}</span><span>RU / EN</span></footer></main><div hidden={tab==='jury'}><Suspense fallback={null}><ChatAssistant lang={lang} context={assistantContext} contextKey={assistantKey} onProposal={acceptAssistantProposal}/></Suspense></div></div>;
}
