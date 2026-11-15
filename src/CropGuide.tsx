import {useState} from 'react';
import {CircleAlert} from 'lucide-react';
import {cropLabels,simulatedCrops,type IrrigationEvent,type Lang,type SoilId} from './domain';
import type {CropProfile,SimulatedCrop} from './evapotranspiration';
import {stageNames} from './WheatSettings';
import {fieldWater,suggestCrop,type ForecastSlice} from './fieldGuide';
import './field-guide.css';

function num(n:number){return n>=100?n.toFixed(0):n>=10?n.toFixed(1):n.toFixed(1)}

export function WeekNote({lang,crop,profile,days}:{lang:Lang;crop:SimulatedCrop;profile:CropProfile;soil:SoilId;storagePercent:number;events:IrrigationEvent[];days:ForecastSlice[]}){
 const t=(ru:string,en:string)=>lang==='ru'?ru:en;
 const totalRain=days.reduce((sum,day)=>sum+day.rain,0);
 const hot=days.filter(day=>day.max>fieldWater(crop,profile,1,1,0).heat);
 return <div className="week-action"><p>{t(`Прогноз: ${totalRain.toFixed(1)} мм осадков за ${days.length} дней. Дней выше температурного порога модели: ${hot.length}.`,`Forecast: ${totalRain.toFixed(1)} mm of precipitation over ${days.length} days. Days above the model heat threshold: ${hot.length}.`)}</p><p>{t('Перед поливом измерьте влажность корневого слоя и проверьте стадию культуры. Начальный запас воды в сценарии не является влажностью поля сегодня; по нему нельзя назначать или отменять полив на ближайшую неделю.','Before irrigating, measure root-zone moisture and check the crop stage. The scenario’s initial water reserve is not today’s field moisture and cannot justify scheduling or cancelling irrigation this week.')}</p></div>;
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
