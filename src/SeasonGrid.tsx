import {addDays,type IrrigationEvent,type Lang} from './domain';
import {stageNames} from './WheatSettings';
import {seasonMonths,stageIndex,stageStarts} from './seasonCalendar';
import './season-calendar.css';

export interface DayRisk {date:string;water:boolean;heat:boolean;frost:boolean}

export function SeasonCalendar({lang,planting,duration,stages,events,area,forecastDates,risks,onDay}:{lang:Lang;planting:string;duration:number;stages:readonly number[];events:IrrigationEvent[];area:number;forecastDates:readonly string[];risks:readonly DayRisk[]|null;onDay:(date:string)=>void}){
 const t=(ru:string,en:string)=>lang==='ru'?ru:en;
 const locale=lang==='ru'?'ru-RU':'en-GB';
 const end=addDays(planting,Math.max(0,duration-1));
 const months=seasonMonths(planting,end);
 const starts=stageStarts(stages);
 const doses=new Map<string,number>();
 for(const event of events)doses.set(event.date,(doses.get(event.date)??0)+event.mm);
 const risk=new Map(risks?.map(day=>[day.date,day])??[]);
 const forecast=new Set(forecastDates);
 const weekday=(index:number)=>new Intl.DateTimeFormat(locale,{weekday:'short',timeZone:'UTC'}).format(new Date(Date.UTC(2024,0,1+index)));
 const monthName=(key:string)=>new Intl.DateTimeFormat(locale,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(key+'-01T12:00:00Z'));
 return <div className="season-calendar">
  <div className="season-months">{months.map(month=><section key={month.key}><h3>{monthName(month.key)}</h3><div className="season-weekdays">{Array.from({length:7},(_,index)=><span key={index}>{weekday(index)}</span>)}</div><div className="season-grid">{month.cells.map((cell,index)=>{
   if(!cell)return <span key={index}/>;
   if(!cell.inSeason)return <span key={cell.date} className="season-outside">{Number(cell.date.slice(8))}</span>;
   const offset=Math.round((Date.parse(cell.date+'T12:00:00Z')-Date.parse(planting+'T12:00:00Z'))/86400000);
   const stage=stageIndex(offset,stages);
   const dose=doses.get(cell.date)??0;
   const mark=risk.get(cell.date);
   const volume=area>0?(dose*area*10).toFixed(0):'';
   const flags=[cell.date===planting?t('посев','sowing'):'',dose?`${dose} ${t('мм','mm')}${volume?`, ${volume} ${t('м³','m³')}`:''}`:'',mark?.water?t('риск воды','water risk'):'',mark?.heat?t('жара','heat'):'',mark?.frost?t('заморозок','frost'):'',forecast.has(cell.date)?t('прогноз','forecast'):''].filter(Boolean).join(', ');
   return <button key={cell.date} type="button" className="season-day" data-stage={stage} data-sow={cell.date===planting||undefined} data-boundary={starts.has(offset)||undefined} data-irrigated={dose>0||undefined} data-forecast={forecast.has(cell.date)||undefined} aria-pressed={dose>0} aria-label={`${cell.date}, ${stageNames[stage][lang==='ru'?0:1]}${flags?`, ${flags}`:''}`} onClick={()=>onDay(cell.date)}><b>{Number(cell.date.slice(8))}</b>{dose>0&&<small>{dose} {t('мм','mm')}</small>}{(mark?.water||mark?.heat||mark?.frost)&&<span className="season-risks">{mark.water&&<i data-kind="water"/>}{mark.heat&&<i data-kind="heat"/>}{mark.frost&&<i data-kind="frost"/>}</span>}</button>;
  })}</div></section>)}</div>
  <ul className="season-legend">
   <li data-sow>{t('Посев','Sowing')}</li>
   <li data-irrigated>{t('Полив','Irrigation')}</li>
   {stages.map((_,index)=><li key={index} data-stage={index}>{stageNames[index][lang==='ru'?0:1]}</li>)}
   <li data-forecast>{t('День прогноза внутри сезона','Forecast day inside the season')}</li>
   <li>{t('Точки: вода, жара, заморозок из загруженного сценария.','Dots: water, heat and frost from the loaded scenario.')}</li>
  </ul>
  {!risks&&<p>{t('Точки риска появятся после загрузки симуляции.','Risk dots appear after the simulation is loaded.')}</p>}
 </div>;
}
