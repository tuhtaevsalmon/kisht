import {lazy,Suspense,useEffect,useMemo,useState} from 'react';
import {Play,Pause,RotateCcw,FlaskConical,Layers} from 'lucide-react';
import {analyze,cropLabels,demoData,simulatedCrops,type Lang,type Point} from './domain';
import {defaultProfiles,type SimulatedCrop} from './evapotranspiration';
import {seasonLength} from './season';
import {stageNames} from './WheatSettings';
import RiskTimeline from './RiskTimeline';
import DayStatus,{DayMeasurements} from './DayStatus';
import {cropFailure} from './cropFailure';
import RootZonePanel from './RootZonePanel';
import type {SeasonRow} from './riskEvents';
import './jury-demo.css';

const Field=lazy(()=>import('./Field'));
const plot:Point[]=[[38.531,68.549],[38.531,68.551],[38.5298,68.551],[38.5298,68.549]];
const planting='2024-04-01';

function demoDay(rows:SeasonRow[]){
 const stress=rows.findIndex(row=>row.unmet>row.demand*.25&&row.developmentProgress>.2);
 if(stress>=0)return stress;
 const risk=rows.findIndex(row=>row.waterRisk||row.heat||row.frost);
 return Math.max(0,risk);
}

// Isolated, repeatable presentation fixture. No requests or farmer-state writes.
export default function JuryDemo({lang}:{lang:Lang}){
 const t=(ru:string,en:string)=>lang==='ru'?ru:en;
 const [crop,setCrop]=useState<SimulatedCrop>('wheat');
 const profile=defaultProfiles[crop],duration=seasonLength(crop,profile);
 const scenarios=useMemo(()=>{
  const source={...demoData(planting,duration),fetchedAt:'2024-04-01T00:00:00Z'};
  const shared={profile,wheat:profile,initialStorage:.65,efficiency:.9,irrigationEvents:[] as []};
  return [analyze(source,planting,crop,'loam',0,shared),analyze(source,planting,crop,'loam',0,{...shared,automaticIrrigation:true})];
 },[crop,duration,profile]);
 const [scenario,setScenario]=useState(0),[day,setDay]=useState(()=>demoDay(scenarios[0])),[playing,setPlaying]=useState(false),[cut,setCut]=useState(false),[showRootData,setShowRootData]=useState(false);
 const rows=scenarios[scenario],dayIndex=Math.min(day,rows.length-1),row=rows[dayIndex],fateDays=useMemo(()=>cropFailure(rows,crop),[rows,crop]),todayFate=fateDays[dayIndex],shown=todayFate?.dead&&todayFate.diedIndex!==null?rows[todayFate.diedIndex]:row,coverage=row.demand>0?row.actual/row.demand:1;
 useEffect(()=>{setDay(demoDay(scenarios[0]))},[crop]);
 useEffect(()=>{
  if(!playing)return;
  const timer=setInterval(()=>setDay(current=>Math.min(rows.length-1,current+1)),450);
  return()=>clearInterval(timer);
 },[playing,rows.length]);
 useEffect(()=>{if(dayIndex===rows.length-1)setPlaying(false)},[dayIndex,rows.length]);
 const date=new Intl.DateTimeFormat(lang==='ru'?'ru-RU':'en-GB',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(row.date+'T12:00:00Z'));
 const cropName=cropLabels[crop][lang==='ru'?'ru':'en'];
 return <section className="jury-demo">
  <div className="jury-demo-banner" role="note"><FlaskConical size={21}/><div><b>{t('СИНТЕТИЧЕСКАЯ ПОГОДА','SYNTHETIC WEATHER')}</b><span>{t('Готовый учебный сценарий. Это не наблюдения NASA и не прогноз. Ваш участок и настройки не меняются.','A ready-to-present teaching scenario. This is not NASA observations or a forecast. Your field and settings are unchanged.')}</span></div></div>
  <div className="jury-demo-intro"><span className="eyebrow">{t('ОДНО ПОЛЕ · ДВА РЕШЕНИЯ','ONE FIELD · TWO DECISIONS')}</span><h2>{t('Что меняется, когда появляется полив?','What changes when irrigation is available?')}</h2><label className="jury-crop">{t('Культура','Crop')}<select value={crop} onChange={e=>{setCrop(e.target.value as SimulatedCrop);setPlaying(false)}}>{simulatedCrops.map(id=><option key={id} value={id}>{cropLabels[id][lang==='ru'?'ru':'en']}</option>)}</select></label><p>{t(`${cropName}, условный участок в Гиссаре, ${duration} дней. Выберите культуру и решение: погода и выбранный день остаются одинаковыми.`,`${cropName}, an illustrative field in Hisor, ${duration} days. Choose the crop and the decision: weather and the selected day stay the same.`)}</p></div>
  <div className="jury-scenarios" role="group" aria-label={t('Сравнить сценарии','Compare scenarios')}>
   {scenarios.map((rs,i)=><button key={i} className={scenario===i?'selected':''} aria-pressed={scenario===i} onClick={()=>{setScenario(i);setPlaying(false)}}><span className="jury-scenario-name">{i?t('С модельным поливом','With model-scheduled irrigation'):t('Без дополнительного полива','Without additional irrigation')}</span><span className="jury-scenario-metrics"><span><b>{rs.filter(r=>r.waterRisk).length}</b><small>{t('дней водного риска','water-risk days')}</small></span><span><b>{rs.reduce((n,r)=>n+r.unmet,0).toFixed(0)} mm</b><small>{t('дефицит за цикл','cycle unmet demand')}</small></span><span><b>{rs.reduce((n,r)=>n+r.grossIrrigation,0).toFixed(0)} mm</b><small>{t('подано поливом','irrigation delivered')}</small></span></span><small className="jury-scenario-risks">{t('Жара','Heat')}: {rs.filter(r=>r.heat).length} · {t('холод','frost')}: {rs.filter(r=>r.frost).length}</small></button>)}
  </div>
  <div className="jury-demonstration">
   <section className="jury-scene">
    <div className="jury-scene-heading"><div><span className="eyebrow">{t('ДЕНЬ','DAY')} {dayIndex+1} / {rows.length}</span><h3>{date}</h3><span>{stageNames[row.stage??0][lang==='ru'?0:1]}</span></div><div className="scene-tools"><button className={cut?'active':''} aria-pressed={cut} onClick={()=>setCut(value=>{if(!value)setShowRootData(true);return !value})}><Layers size={16}/>{t('Корни','Roots')}</button><button className={showRootData?'active':''} aria-pressed={showRootData} onClick={()=>setShowRootData(value=>!value)}>{t('Данные','Data')}</button><span className="jury-demo-stamp">DEMO</span></div></div>
    <div className="jury-canvas"><Suspense fallback={<p>{t('Загружаем 3D…','Loading 3D…')}</p>}><Field irrigationMethod="drip" plot={plot} crop={crop} growth={shown.developmentProgress} moisture={row.moisture} rootFraction={shown.rootDepth===null?undefined:shown.rootDepth/profile.rootDepth} watering={row.grossIrrigation>0} raining={row.rain>0} waterStress={Math.max(0,1-coverage)} stress={row.waterRisk||row.heat||row.frost} frost={row.frost} dead={!!todayFate?.dead} cut={cut}/></Suspense></div>
    {showRootData&&<div className="scene-data"><span>{t('Дождь','Rain')}: {row.rain.toFixed(1)} mm</span><span>{t('Полив','Irrigation')}: {row.grossIrrigation.toFixed(1)} mm</span><span>{row.min.toFixed(1)}…{row.max.toFixed(1)} °C</span></div>}
    <div className="jury-playback"><div><button className="primary" onClick={()=>{if(dayIndex===rows.length-1)setDay(0);setPlaying(current=>!current)}}>{playing?<Pause size={16}/>:<Play size={16}/>} {playing?t('Пауза','Pause'):t('Проиграть сезон','Play season')}</button><button aria-label={t('Вернуться к началу демонстрации','Reset demonstration')} onClick={()=>{setPlaying(false);setScenario(0);if(crop==='wheat')setDay(demoDay(scenarios[0]));else setCrop('wheat')}}><RotateCcw size={17}/></button><span>{t('День','Day')} {dayIndex+1}</span></div><input aria-label={t('День демонстрационного сезона','Demonstration season day')} type="range" min="0" max={rows.length-1} value={dayIndex} onChange={e=>{setDay(+e.target.value);setPlaying(false)}}/><RiskTimeline rows={rows} day={dayIndex} lang={lang}/></div>
   </section>
   <div className="jury-side"><DayStatus row={row} rows={rows} day={dayIndex} lang={lang} crop={crop} showMeasurements={false} fate={todayFate}/><p className="jury-method-note">{t('Учебная модель: рост по календарю, водный баланс и три сигнала риска. Наклон листьев обозначает ограничение водой. Если нехватка воды, холод или жара пересекают линию сценария, рост останавливается. Это не измеренная гибель сорта и не урожай.','Teaching model: calendar development, water balance and three risk signals. Leaf droop illustrates water limitation. If water shortage, cold or heat crosses the scenario line, growth stops. This is not a measured cultivar death and not a yield.')}</p></div>
  </div>
  <DayMeasurements row={row} rows={rows} day={dayIndex} lang={lang}/>
  {showRootData&&<RootZonePanel row={row} lang={lang}/>}
  <p className="jury-demo-footer">{t('В основной вкладке используются загруженные реальные источники. Здесь синтетический набор нужен только для воспроизводимого показа без интернета. Модельный полив заранее знает дождь каждого дня — это сравнение сценариев, а не оперативное назначение полива.','The main workflow uses retrieved real data sources. This synthetic fixture is only for a repeatable offline presentation. Model-scheduled irrigation knows each day’s rain in advance: this is scenario comparison, not an operational irrigation prescription.')}</p>
 </section>;
}
