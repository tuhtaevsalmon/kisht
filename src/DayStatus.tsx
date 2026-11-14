import {Droplets,Snowflake,Sun,CheckCircle2} from 'lucide-react';
import {stressHistory} from './stressHistory';
import {cropParams,type CropId,type Lang} from './domain';
import type {SeasonRow} from './riskEvents';
import './day-status.css';

interface Props {row:SeasonRow;rows:SeasonRow[];day:number;lang:Lang;onPlan:()=>void;crop?:CropId}
export default function DayStatus({row:r,rows,day,lang,onPlan,crop='wheat'}:Props){
 const t=(a:string,b:string)=>lang==='ru'?a:b;
 const history=stressHistory(rows,day),ratio=r.demand>0?Math.max(0,Math.min(1,r.actual/r.demand)):1;
 const heatThreshold=cropParams[crop].heat;
 const count=Number(r.waterRisk)+Number(r.frost)+Number(r.heat);
 const date=new Intl.DateTimeFormat(lang==='ru'?'ru-RU':'en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(r.date+'T12:00:00Z'));
 const mm=t('мм','mm');
 return <aside className="day-status selected-day-risks">
  <span className="eyebrow">{t('РИСКИ ВЫБРАННОГО ДНЯ','SELECTED-DAY RISKS')}</span><h2>{date}</h2>
  <p className="day-risk-count">{count?t(`Сигналов риска: ${count}. Причины ниже.`,`${count} risk signal${count===1?'':'s'}. Causes below.`):t('Три отслеживаемых сигнала риска не выявлены.','None of the three tracked risk signals detected.')}</p>
  <div className="day-risk-list">
   {r.waterRisk&&<article className="day-risk water"><h3><Droplets size={18}/>{r.unmet>1e-6?t('Не хватает доступной воды','Available water is limiting uptake'):t('Низкий запас воды','Low water reserve')}</h3>
    <p>{r.unmet>1e-6?t(`Потребность ${r.demand.toFixed(1)} ${mm}, потребление ${r.actual.toFixed(1)} ${mm}. Не покрыто ${r.unmet.toFixed(1)} ${mm}.`,`Demand is ${r.demand.toFixed(1)} ${mm}, uptake ${r.actual.toFixed(1)} ${mm}. Unmet: ${r.unmet.toFixed(1)} ${mm}.`):t(`Сегодня потребность покрыта, но запас к вечеру ${r.storage.toFixed(1)} ${mm} — ниже порога ${r.stressThreshold.toFixed(1)} ${mm}.`,`Today's demand is met, but closing storage of ${r.storage.toFixed(1)} ${mm} is below the ${r.stressThreshold.toFixed(1)} ${mm} threshold.`)}</p>
    {r.unmet>1e-6&&<small>{t('Запас к вечеру','Closing storage')}: {r.storage.toFixed(1)} / {r.storageCapacity.toFixed(1)} {mm}.</small>}
    <p className="day-risk-action">{t('Проверьте влажность в корневом слое и сравните план полива.','Check root-zone moisture and compare the irrigation plan.')}</p>
   </article>}
   {r.frost&&<article className="day-risk frost"><h3><Snowflake size={18}/>{t('Риск заморозка','Frost risk')}</h3><p>{t(`Минимум воздуха ${r.min.toFixed(1)} °C — ниже 0 °C. Повреждение зависит от сорта, стадии и длительности холода.`,`Air minimum ${r.min.toFixed(1)} °C is below 0 °C. Damage depends on cultivar, stage and cold duration.`)}</p><p className="day-risk-action">{t('Сверьте ближайший прогноз и чувствительность сорта. Этот сигнал не означает, что посев погиб.','Check the near-term forecast and cultivar sensitivity. This signal does not mean the crop has died.')}</p></article>}
   {r.heat&&<article className="day-risk heat"><h3><Sun size={18}/>{t('Риск жары','Heat risk')}</h3><p>{t(`Максимум ${r.max.toFixed(1)} °C — выше порога модели ${heatThreshold} °C на ${(r.max-heatThreshold).toFixed(1)} °C.`,`Maximum ${r.max.toFixed(1)} °C exceeds the model's ${heatThreshold} °C threshold by ${(r.max-heatThreshold).toFixed(1)} °C.`)}</p><p className="day-risk-action">{t('Сравните другой срок посева. Полив может снять нехватку воды, но не устраняет жару.','Compare another sowing date. Irrigation can ease water shortage but does not remove heat.')}</p></article>}
   {!count&&<div className="day-no-risk"><CheckCircle2 size={19}/><p>{t('Проверьте следующие дни сезона. Отсутствие этих сигналов не подтверждает здоровье или урожайность.','Review the following days. Absence of these signals does not establish crop health or yield.')}</p></div>}
  </div>
  <div className="water-gauge"><label>{t('Потребность в воде покрыта','Water demand met')}<b>{r.demand>0?`${Math.round(ratio*100)}%`:'—'}</b></label><meter min="0" max="1" value={ratio}/><small>{r.actual.toFixed(1)} / {r.demand.toFixed(1)} {mm}</small></div>
  <button className="primary" onClick={onPlan}>{t('Сравнить дату и полив','Compare sowing & irrigation')}</button>
  <details className="day-risk-details"><summary>{t('Показатели и история дефицита','Measurements & deficit history')}</summary><dl><div><dt>{t('Запас к вечеру','Closing storage')}</dt><dd>{r.storage.toFixed(1)} / {r.storageCapacity.toFixed(1)} {mm}</dd></div><div><dt>{t('Дождь / полив','Rain / irrigation')}</dt><dd>{r.rain.toFixed(1)} / {r.grossIrrigation.toFixed(1)} {mm}</dd></div><div><dt>{t('Температура','Temperature')}</dt><dd>{r.min.toFixed(1)}…{r.max.toFixed(1)} °C</dd></div></dl><p><b>{history.unmet.toFixed(1)} {mm}</b> {t('непокрытой потребности с посева по этот день','unmet demand since sowing through this day')}. {t('Дней с ограниченным потреблением','Days with limited uptake')}: <b>{history.limitedDays}</b>{history.currentStreak>1&&<> · {t('подряд сейчас','consecutive now')}: <b>{history.currentStreak}</b></>}.</p><small>{t('Полив не отменяет прошлый дефицит. Это не процент потери урожая. Исходный день погоды NASA:','Irrigation cannot erase past unmet demand. This is not a yield-loss percentage. NASA source weather day:')} {r.sourceDate}.</small><p className="inline-note">{t('Наклон листьев показывает ограничение водой, светлая окраска — сигнал холода. Болезни, питание и сортовые повреждения не рассчитаны.','Leaf droop illustrates water limitation; pale colour flags cold. Diseases, nutrition and cultivar-specific damage are not modelled.')}</p></details>
 </aside>;
}
