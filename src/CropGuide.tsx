import {useState} from 'react';
import {CircleAlert} from 'lucide-react';
import {cropLabels,simulatedCrops,type IrrigationEvent,type Lang,type SoilId} from './domain';
import type {CropProfile,SimulatedCrop} from './evapotranspiration';
import {stageNames} from './WheatSettings';
import {fieldWater,suggestCrop,weekAction,type ForecastSlice} from './fieldGuide';
import './field-guide.css';

function weekday(date:string,lang:Lang){
 return new Intl.DateTimeFormat(lang==='ru'?'ru-RU':'en-GB',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
}
function num(n:number){return n>=100?n.toFixed(0):n>=10?n.toFixed(1):n.toFixed(1)}

export function WeekNote({lang,crop,profile,soil,storagePercent,events,days}:{lang:Lang;crop:SimulatedCrop;profile:CropProfile;soil:SoilId;storagePercent:number;events:IrrigationEvent[];days:ForecastSlice[]}){
 const t=(ru:string,en:string)=>lang==='ru'?ru:en;
 const action=weekAction(days,crop,profile,soil,storagePercent/100,events);
 const name=cropLabels[crop][lang==='ru'?'ru':'en'];
 const calendarOutside=events.length>0&&!events.some(event=>days.some(day=>day.date===event.date));
 const text=action.kind==='postpone'
  ?t(`${weekday(action.date,lang)} ожидается ${action.rain.toFixed(1)} мм дождя, ${name} в модели потребляет около ${action.need.toFixed(1)} мм в день. В календаре на эту дату уже ${action.scheduled.toFixed(0)} мм полива — его можно отложить и сверить влажность.`,`${weekday(action.date,lang)}: ${action.rain.toFixed(1)} mm of rain is forecast, and ${name} uses about ${action.need.toFixed(1)} mm/day in the model. The calendar already has ${action.scheduled.toFixed(0)} mm that day — it can be postponed while you check moisture.`)
  :action.kind==='before-heat'
  ?action.irrigateOn===action.hotDate
  ?t(`Первый день прогноза, ${weekday(action.hotDate,lang)}, уже жаркий: максимум ${action.hotMax.toFixed(0)} °C. Запас к утру, с дождём этого дня, около ${action.storage.toFixed(0)} мм — ниже порога модели ${action.threshold.toFixed(0)} мм. Полив лучше поставить на этот день.`,`The first forecast day, ${weekday(action.hotDate,lang)}, is already hot: maximum ${action.hotMax.toFixed(0)} °C. Storage that morning, including that day’s rain, is about ${action.storage.toFixed(0)} mm, below the model threshold of ${action.threshold.toFixed(0)} mm. Irrigation fits better on that day.`)
  :t(`Перед ${weekday(action.hotDate,lang)} максимум ${action.hotMax.toFixed(0)} °C, а запас к утру, с дождём этого дня, около ${action.storage.toFixed(0)} мм — ниже порога модели ${action.threshold.toFixed(0)} мм. Полив лучше поставить ${weekday(action.irrigateOn,lang)}.`,`Before ${weekday(action.hotDate,lang)} the maximum is ${action.hotMax.toFixed(0)} °C, and storage that morning, including that day’s rain, is about ${action.storage.toFixed(0)} mm, below the model threshold of ${action.threshold.toFixed(0)} mm. Irrigation fits better on ${weekday(action.irrigateOn,lang)}.`)
  :action.kind==='covered'
  ?t(`Запас, который вы указали, около ${action.reserveDays.toFixed(0)} дней потребности ${name} (${action.need.toFixed(1)} мм/день). За семь дней прогноз даёт ${action.rainMm.toFixed(0)} мм дождя. Это оценка от вашего процента запаса, не датчик в поле.`,`The storage you entered covers about ${action.reserveDays.toFixed(0)} days of ${name} demand (${action.need.toFixed(1)} mm/day). The seven-day forecast has ${action.rainMm.toFixed(0)} mm of rain. This starts from your storage percentage, not a field sensor.`)
  :t(`Этого запаса хватает примерно на ${Math.max(0,action.reserveDays).toFixed(1)} дней при ${action.need.toFixed(1)} мм/день. Прогноз добавляет ${action.rainMm.toFixed(0)} мм за неделю — проверьте полив на дни без дождя.`,`This reserve covers about ${Math.max(0,action.reserveDays).toFixed(1)} days at ${action.need.toFixed(1)} mm/day. The forecast adds ${action.rainMm.toFixed(0)} mm over the week — check irrigation on the dry days.`);
 return <div className="week-action"><p>{text}</p>{calendarOutside&&<p>{t('Записи календаря полива стоят на датах сезона и не попадают в эти 7 дней, поэтому прогноз их не переносит.','Irrigation dates belong to the season and do not fall in these 7 days, so the forecast does not move them.')}</p>}</div>;
}

export function CropFacts({lang,crop,profile,area,efficiency,storagePercent,waterLimit,onChoose}:{lang:Lang;crop:SimulatedCrop;profile:CropProfile;area:number;efficiency:number;storagePercent:number;waterLimit:string;onChoose:(crop:SimulatedCrop)=>void}){
 const t=(ru:string,en:string)=>lang==='ru'?ru:en;
 const brief=fieldWater(crop,profile,area,efficiency,storagePercent/100);
 const limit=waterLimit!==''&&Number.isFinite(+waterLimit)?+waterLimit:null;
 const pick=suggestCrop(limit,area,efficiency,simulatedCrops,crop);
 const pickName=pick?cropLabels[pick.crop][lang==='ru'?'ru':'en']:null;
 const name=cropLabels[crop][lang==='ru'?'ru':'en'];
 const areaLabel=area>0?`${area.toFixed(2)} ${t('га','ha')}`:t('1 га, участок ещё не обведён','1 ha until a field is outlined');
 const shown=area>0?brief:fieldWater(crop,profile,1,efficiency,storagePercent/100);
 return <section className="crop-facts">
  <h3>{name}</h3>
  <p>{t(`Цикл ${brief.days} дней: ${profile.stages.map((n,i)=>`${stageNames[i][lang==='ru'?0:1]} ${n}`).join(' · ')}. Жара в модели — максимум выше ${brief.heat} °C. Ориентир потребления ${brief.needMm.toFixed(1)} мм/день; на входе поля, с потерями выбранного способа, около ${brief.inletMm.toFixed(1)} мм/день. Корень до ${profile.rootDepth.toFixed(2)} м. Коэффициенты Kc ${profile.kc.map(n=>n.toFixed(2)).join(' / ')}.`,`A ${brief.days}-day cycle: ${profile.stages.map((n,i)=>`${stageNames[i][1]} ${n}`).join(' · ')}. The model heat signal is a maximum above ${brief.heat} °C. Typical use is ${brief.needMm.toFixed(1)} mm/day; at the field inlet, after the selected method’s losses, about ${brief.inletMm.toFixed(1)} mm/day. Roots to ${profile.rootDepth.toFixed(2)} m. Kc ${profile.kc.map(n=>n.toFixed(2)).join(' / ')}.`)}</p>
  <div className="crop-fact-metrics">
   <article><small>{t('В день на участке','Per day on the field')}</small><b>{num(shown.dailyM3)} {t('м³','m³')}</b></article>
   <article><small>{t('В неделю','Per week')}</small><b>{num(shown.weeklyM3)} {t('м³','m³')}</b></article>
   <article><small>{t('За цикл, если каждый день типичный','Over the cycle if every day is typical')}</small><b>{num(shown.seasonM3)} {t('м³','m³')}</b></article>
  </div>
  <p>{t(`Цифры для ${areaLabel}. Это ориентир по типичной потребности, не сумма FAO за загруженный сезон и не урожай. Запас ${storagePercent}% полного слоя — около ${brief.reserveMm.toFixed(0)} мм, примерно ${brief.reserveDays.toFixed(0)} дней без дождя.`,`Figures for ${areaLabel}. This is the typical demand, not the FAO total of a loaded season and not a yield. ${storagePercent}% of the full layer is about ${brief.reserveMm.toFixed(0)} mm, roughly ${brief.reserveDays.toFixed(0)} days without rain.`)}</p>
  {limit!==null&&area>0&&<p>{t(`Ваш недельный объём ${num(limit)} м³. Этой культуре на входе нужно около ${num(brief.weeklyM3)} м³/нед.`,`Your weekly supply is ${num(limit)} m³. This crop needs about ${num(brief.weeklyM3)} m³/week at the inlet.`)}</p>}
  {pick&&pick.crop!==crop&&<button className="primary" type="button" onClick={()=>onChoose(pick.crop)}>{pick.fits?t(`Выбрать ${pickName} — её неделя помещается в ваш объём`,`Choose ${pickName} — its week fits your supply`):t(`Выбрать ${pickName} — ей нужно меньше воды, но объёма всё равно не хватает`,`Choose ${pickName} — it needs less water, and the supply is still short`)}</button>}
  {pick&&pick.crop!==crop&&<p>{t('Смена культуры очищает календарь полива.','Changing the crop clears the irrigation calendar.')}</p>}
  {pick?.crop===crop&&limit!==null&&area>0&&<p>{t('По этому недельному объёму эта культура уже помещается.','This crop already fits this weekly supply.')}</p>}
  {(limit===null||!(area>0))&&<p>{t('Укажите участок и сколько воды доступно в неделю — тогда можно сравнить культуры по объёму.','Outline the field and enter weekly water to compare crops by volume.')}</p>}
 </section>;
}

export function CropChoice({lang,crop,onCrop,profile,area,efficiency,storagePercent,waterLimit}:{lang:Lang;crop:SimulatedCrop;onCrop:(crop:SimulatedCrop)=>void;profile:CropProfile;area:number;efficiency:number;storagePercent:number;waterLimit:string}){
 const t=(ru:string,en:string)=>lang==='ru'?ru:en;
 const [open,setOpen]=useState(false);
 const brief=fieldWater(crop,profile,area>0?area:1,efficiency,storagePercent/100);
 return <>
  <div className="crop-choice">
   <label>{t('Культура','Crop')}<select value={crop} onChange={e=>onCrop(e.target.value as SimulatedCrop)}>{simulatedCrops.map(id=><option key={id} value={id}>{cropLabels[id][lang==='ru'?'ru':'en']}</option>)}</select></label>
   <button type="button" className="crop-info" aria-expanded={open} aria-label={t('Данные выбранной культуры','Details for the selected crop')} onClick={()=>setOpen(value=>!value)}><CircleAlert size={18}/></button>
  </div>
  <p className="crop-teaser">{t(`${brief.days} дней · около ${brief.needMm.toFixed(1)} мм/день · жара выше ${brief.heat} °C`,`${brief.days} days · about ${brief.needMm.toFixed(1)} mm/day · heat above ${brief.heat} °C`)}</p>
  {open&&<CropFacts lang={lang} crop={crop} profile={profile} area={area} efficiency={efficiency} storagePercent={storagePercent} waterLimit={waterLimit} onChoose={next=>{onCrop(next);setOpen(true)}}/>}
 </>;
}
