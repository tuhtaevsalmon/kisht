import {useEffect,useRef,useState} from 'react';
import {CircleHelp,X} from 'lucide-react';
import type {Lang} from './domain';
import './farmer-guide.css';
export default function FarmerGuide({lang}:{lang:Lang}){
 const t=(a:string,b:string)=>lang==='ru'?a:b;
 const dialog=useRef<HTMLDialogElement>(null);
 const [open,setOpen]=useState(false);
 useEffect(()=>{const node=dialog.current;if(!node)return;if(open&&!node.open)node.showModal();if(!open&&node.open)node.close();},[open]);
 const steps=lang==='ru'
  ?['Обведите поле на карте и сохраните границы. Площадь посчитается сама. Дом, дорога и вода в участок не сохранятся.','Выберите культуру, дату посева, почву, если знаете, и способ полива. Напишите, сколько воды можете дать за неделю.','В «Моём календаре полива» клик по дню ставит дозу из поля ниже. Повторный клик снимает этот день.','Нажмите «Загрузить данные». Придут погода NASA за выбранный год, высоты поля и прогноз на семь дней.','Во вкладке «Симуляция» смотрите день за днём: хватает ли воды, где жара и заморозок. Это расчёт, не обещание урожая.','В «Рекомендациях» сравните сроки и культуры. Смена культуры очищает календарь полива.']
  :['Outline the field on the map and save the boundary. The area is calculated for you. A house, road or water is not saved as the field.','Choose the crop, sowing date, soil if you know it, and the irrigation method. Enter how much water you can supply in a week.','In My irrigation schedule, a click applies the dose below. A second click clears that day.','Press Load data. NASA weather for the chosen year, field elevations and a seven-day forecast arrive.','On Simulation, follow each day for water, heat and frost. This is a calculation, not a yield promise.','On Recommendations, compare dates and crops. Changing the crop clears the irrigation calendar.'];
 return <>
  <button className="guide-open" onClick={()=>setOpen(true)}><CircleHelp size={16}/>{t('Инструкция','Guide')}</button>
  <dialog ref={dialog} className="farmer-guide" aria-labelledby="farmer-guide-title" onClose={()=>setOpen(false)} onClick={e=>{if(e.target===dialog.current)setOpen(false)}}>
   <article>
    <header><h2 id="farmer-guide-title">{t('Как пользоваться Киштом','How to use Kisht')}</h2><button aria-label={t('Закрыть инструкцию','Close the guide')} onClick={()=>setOpen(false)}><X size={16}/></button></header>
    <ol>{steps.map(step=><li key={step}>{step}</li>)}</ol>
    <div className="guide-split">
     <section><h3>{t('Из измерений','From measurements')}</h3><ul>
      <li>{t('Погода NASA POWER за выбранный прошлый год, поставленная на даты вашего посева.','NASA POWER weather from the chosen past year, placed on your sowing dates.')}</li>
      <li>{t('Высоты поля NASA SRTM.','NASA SRTM field elevations.')}</li>
      <li>{t('Прогноз Open-Meteo на ближайшие семь дней.','The Open-Meteo forecast for the next seven days.')}</li>
      <li>{t('Границы и площадь, которые вы сохранили.','The boundary and area you saved.')}</li>
     </ul></section>
     <section><h3>{t('Считает модель','Calculated by the model')}</h3><ul>
      <li>{t('Запас воды, потребность культуры, полив и дни риска.','Water storage, crop demand, irrigation and risk days.')}</li>
      <li>{t('Кубометры на карточке культуры — типичная потребность, не урожай.','Cubic metres on the crop card are typical demand, not yield.')}</li>
      <li>{t('Почва «Не знаю» считается суглинком.','Unknown soil is treated as loam.')}</li>
      <li>{t('«Демо симуляция» — учебный пример. Это не ваше поле и не NASA.','Demo simulation is a teaching example. It is not your field and not NASA.')}</li>
     </ul></section>
    </div>
   </article>
  </dialog>
 </>;
}
