import {lazy,Suspense,useEffect,useMemo,useState} from 'react';
import {Play,Pause,RotateCcw,FlaskConical,Droplets} from 'lucide-react';
import {analyze,demoData,type Lang,type Point} from './domain';
import {defaultWheat} from './evapotranspiration';
import {stageNames} from './WheatSettings';
import RiskTimeline from './RiskTimeline';
import './jury-demo.css';

const Field=lazy(()=>import('./Field'));
const plot:Point[]=[[38.531,68.549],[38.531,68.551],[38.5298,68.551],[38.5298,68.549]];
const planting='2024-04-01';

// Isolated, repeatable presentation fixture. No requests or farmer-state writes.
export default function JuryDemo({lang}:{lang:Lang}){
 const t=(ru:string,en:string)=>lang==='ru'?ru:en;
 const scenarios=useMemo(()=>{
  const source={...demoData(planting,135),fetchedAt:'2024-04-01T00:00:00Z'};
  const shared={wheat:defaultWheat,initialStorage:.65,efficiency:.9,irrigationEvents:[]};
  return [analyze(source,planting,'wheat','loam',0,shared),analyze(source,planting,'wheat','loam',0,{...shared,automaticIrrigation:true})];
 },[]);
 const initialDay=Math.max(0,scenarios[0].findIndex(r=>r.unmet>r.demand*.25&&r.developmentProgress>.2));
 const [scenario,setScenario]=useState(0),[day,setDay]=useState(initialDay),[playing,setPlaying]=useState(false);
 const rows=scenarios[scenario],row=rows[day],coverage=row.demand>0?row.actual/row.demand:1;
 useEffect(()=>{
  if(!playing)return;
  const timer=setInterval(()=>setDay(d=>Math.min(rows.length-1,d+1)),450);
  return()=>clearInterval(timer);
 },[playing,rows.length]);
 useEffect(()=>{if(day===rows.length-1)setPlaying(false)},[day,rows.length]);
 const date=new Intl.DateTimeFormat(lang==='ru'?'ru-RU':'en-GB',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(row.date+'T12:00:00Z'));
 return <section className="jury-demo">
  <div className="jury-demo-banner" role="note"><FlaskConical size={21}/><div><b>{t('ДЕМО ДЛЯ ЖЮРИ · СИНТЕТИЧЕСКАЯ ПОГОДА','JURY DEMO · SYNTHETIC WEATHER')}</b><span>{t('Готовый учебный сценарий. Это не наблюдения NASA и не прогноз. Ваш участок и настройки не меняются.','A ready-to-present teaching scenario. This is not NASA observations or a forecast. Your field and settings are unchanged.')}</span></div></div>
  <div className="jury-demo-intro"><span className="eyebrow">{t('ОДНО ПОЛЕ · ДВА РЕШЕНИЯ','ONE FIELD · TWO DECISIONS')}</span><h2>{t('Что меняется, когда появляется полив?','What changes when irrigation is available?')}</h2><p>{t('Пшеница, условный участок в Гиссаре, 135 дней. Переключите решение: погода, почва и выбранный день остаются одинаковыми.','Wheat, an illustrative field in Hisor, 135 days. Switch the decision: weather, soil and the selected day stay the same.')}</p></div>
  <div className="jury-scenarios" role="group" aria-label={t('Сравнить сценарии','Compare scenarios')}>
   {scenarios.map((rs,i)=><button key={i} className={scenario===i?'selected':''} aria-pressed={scenario===i} onClick={()=>{setScenario(i);setPlaying(false)}}><span className="jury-scenario-name">{i?t('С модельным поливом','With model-scheduled irrigation'):t('Без дополнительного полива','Without additional irrigation')}</span><span className="jury-scenario-metrics"><span><b>{rs.filter(r=>r.waterRisk).length}</b><small>{t('дней водного риска','water-risk days')}</small></span><span><b>{rs.reduce((n,r)=>n+r.unmet,0).toFixed(0)} mm</b><small>{t('дефицит за цикл','cycle unmet demand')}</small></span><span><b>{rs.reduce((n,r)=>n+r.grossIrrigation,0).toFixed(0)} mm</b><small>{t('подано поливом','irrigation delivered')}</small></span></span></button>)}
  </div>
  <div className="jury-demonstration">
   <section className="jury-scene">
    <div className="jury-scene-heading"><div><span className="eyebrow">{t('ДЕНЬ','DAY')} {day+1} / {rows.length}</span><h3>{date}</h3><span>{stageNames[row.stage??0][lang==='ru'?0:1]}</span></div><span className="jury-demo-stamp">DEMO</span></div>
    <div className="jury-canvas"><Suspense fallback={<p>{t('Загружаем 3D…','Loading 3D…')}</p>}><Field irrigationMethod="drip" plot={plot} crop="wheat" growth={row.developmentProgress} moisture={row.moisture} rootFraction={row.rootDepth===null?undefined:row.rootDepth/defaultWheat.rootDepth} watering={row.grossIrrigation>0} raining={row.rain>0} waterStress={Math.max(0,1-coverage)} stress={row.waterRisk||row.heat||row.frost} frost={row.frost} cut={false}/></Suspense></div>
    <div className="jury-playback"><div><button className="primary" onClick={()=>{if(day===rows.length-1)setDay(0);setPlaying(p=>!p)}}>{playing?<Pause size={16}/>:<Play size={16}/>} {playing?t('Пауза','Pause'):t('Проиграть сезон','Play season')}</button><button aria-label={t('Вернуться к началу демонстрации','Reset demonstration')} onClick={()=>{setDay(initialDay);setScenario(0);setPlaying(false)}}><RotateCcw size={17}/></button><span>{t('День','Day')} {day+1}</span></div><input aria-label={t('День демонстрационного сезона','Demonstration season day')} type="range" min="0" max={rows.length-1} value={day} onChange={e=>{setDay(+e.target.value);setPlaying(false)}}/><RiskTimeline rows={rows} day={day} lang={lang}/></div>
   </section>
   <aside className="jury-explanation"><span className="eyebrow">{t('ПРИЧИНА → РЕШЕНИЕ → РЕЗУЛЬТАТ','CAUSE → DECISION → RESULT')}</span><h3>{row.unmet>.01?t('Воды не хватает для потребления','Water supply limits uptake'):row.waterRisk?t('Запас воды приближается к пределу','Water storage needs attention'):t('Сегодня потребность в воде покрыта','Today’s water demand is met')}</h3><p>{row.unmet>.01?t('Доступной влаги мало: модель ограничивает потребление. Переключите вариант полива и сравните этот же день.','Available moisture is low: the model limits uptake. Switch the irrigation scenario and compare this same day.'):row.waterRisk?t('Текущая потребность покрыта, но запас ниже порога. Нужно смотреть и на следующие дни.','Current demand is met, but storage is below the threshold. The following days matter too.'):t('В этом расчёте влаги достаточно для текущей потребности. Жара или холод оцениваются отдельно.','In this calculation, moisture covers current demand. Heat and frost are assessed separately.')}</p><div className="jury-water"><Droplets size={20}/><strong>{Math.round(coverage*100)}%</strong><span>{t('потребности в воде покрыто','of water demand met')}</span><meter min="0" max="1" value={coverage}/></div><dl><div><dt>{t('Потребление / потребность','Uptake / demand')}</dt><dd>{row.actual.toFixed(1)} / {row.demand.toFixed(1)} mm</dd></div><div><dt>{t('Запас воды к вечеру','Closing water storage')}</dt><dd>{row.storage.toFixed(1)} mm</dd></div><div><dt>{t('Полив сегодня','Today’s irrigation')}</dt><dd>{row.grossIrrigation.toFixed(1)} mm</dd></div><div><dt>{t('Дождь сегодня','Today’s rain')}</dt><dd>{row.rain.toFixed(1)} mm</dd></div></dl>{row.heat&&<p className="jury-heat">{t('Жара остаётся в обоих вариантах: полив не меняет температуру воздуха.','Heat remains in both scenarios: irrigation does not change air temperature.')}</p>}<p className="jury-method-note">{t('Учебная модель: рост по календарю, водный баланс и сигналы риска. Наклон листьев обозначает ограничение водой. Это не расчёт гибели или урожая.','Teaching model: calendar development, water balance and risk signals. Leaf droop illustrates water limitation. This does not calculate mortality or yield.')}</p></aside>
  </div>
  <p className="jury-demo-footer">{t('В основной вкладке используются загруженные реальные источники. Здесь синтетический набор нужен только для воспроизводимого показа без интернета. Модельный полив заранее знает дождь каждого дня — это сравнение сценариев, а не оперативное назначение полива.','The main workflow uses retrieved real data sources. This synthetic fixture is only for a repeatable offline presentation. Model-scheduled irrigation knows each day’s rain in advance: this is scenario comparison, not an operational irrigation prescription.')}</p>
 </section>;
}
