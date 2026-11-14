import {useState} from 'react';
import {addDays,validDate,type IrrigationEvent,type Lang} from './domain';
interface Props {duration:number;events:IrrigationEvent[];onChange:(events:IrrigationEvent[])=>void;planting:string;area:number;lang:Lang}
export default function IrrigationSchedule({duration,events,onChange,planting,area,lang}:Props){
 const t=(a:string,b:string)=>lang==='ru'?a:b;
 const [date,setDate]=useState(planting),[dose,setDose]=useState('20');
 const end=validDate(planting)?addDays(planting,duration-1):'';
 const valid=validDate(date)&&Number.isFinite(+dose)&&+dose>0&&+dose<=200;
 return <section id="irrigation-experiment" className="v2-panel schedule-panel"><div className="panel-heading"><h2>{t('Календарь полива','Irrigation calendar')}</h2><span>{events.length} {t('событий','events')}</span></div><p>{t('Укажите воду на входе в поле. Эффективность метода и доступный недельный объём учитываются в расчёте. Без событий дополнительного полива нет.','Enter water at the field inlet. Method efficiency and weekly supply limits are included in calculations. No events means no additional irrigation.')}</p>
 <div className="schedule-inputs"><label>{t('Дата полива','Irrigation date')}<input type="date" value={date} onChange={e=>setDate(e.target.value)} onInput={e=>setDate(e.currentTarget.value)}/></label><label>{t('Доза, мм','Dose, mm')}<input type="number" min="0.1" max="200" step="0.1" value={dose} onChange={e=>setDose(e.target.value)}/></label><span>{(+dose*area*10).toFixed(0)} m³</span><button className="primary" disabled={!valid||events.length>=500} onClick={()=>onChange([...events,{date,mm:+dose}].sort((a,b)=>a.date.localeCompare(b.date)))}>{t('Добавить полив','Add irrigation')}</button></div>
 <p className="inline-note">{t('1 мм на 1 га = 10 м³. Повторные записи одной даты складываются.','1 mm over 1 ha = 10 m³. Multiple entries on the same date are added.')}</p>
 {events.some(e=>e.date<planting||e.date>end)&&<p className="water-alert">{t('Есть события за пределами заданного цикла: они сохранены, но не входят в этот расчёт.','Some events are outside the selected cycle: saved, but excluded from this calculation.')}</p>}
 <div className="schedule-list">{events.length===0?<p>{t('Полив пока не запланирован.','No irrigation scheduled yet.')}</p>:events.map((e,i)=><div key={i}><time>{e.date}</time><b>{e.mm} mm</b><span>{(e.mm*area*10).toFixed(0)} m³</span><button aria-label={`${t('Удалить полив','Remove irrigation')} ${e.date} ${i+1}`} onClick={()=>onChange(events.filter((_,n)=>n!==i))}>×</button></div>)}</div>
 </section>;
}
