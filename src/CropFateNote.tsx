import type {CropId,Lang} from './domain';
import type {SeasonRow} from './riskEvents';
import type {FateDay} from './cropFailure';

export default function CropFateNote({row,fate,lang,crop}:{row:SeasonRow;fate:FateDay;lang:Lang;crop:CropId}){
 const t=(ru:string,en:string)=>lang==='ru'?ru:en;
 const date=new Intl.DateTimeFormat(lang==='ru'?'ru-RU':'en-GB',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(row.date+'T12:00:00Z'));
 const mm=t('мм','mm');
 const cause=fate.cause==='cold'
  ? t(`минимум воздуха ${row.min.toFixed(1)} °C, линия модели для этой культуры ${fate.killingMinimum} °C`,`an air minimum of ${row.min.toFixed(1)} °C, at the model line of ${fate.killingMinimum} °C for this crop`)
  : fate.cause==='heat'
  ? t(`пять дней подряд максимум был не ниже ${fate.heatLine} °C, на ${8} °C выше сигнала жары`,`five days in a row the maximum stayed at or above ${fate.heatLine} °C, 8 °C past the heat signal`)
  : t(`пять дней подряд потребление было меньше половины потребности (${row.actual.toFixed(1)} из ${row.demand.toFixed(1)} ${mm} в день остановки), запас ${row.storage.toFixed(1)} ${mm} ниже порога`,`for five days uptake stayed under half of demand (${row.actual.toFixed(1)} of ${row.demand.toFixed(1)} ${mm} on the day growth stopped) and storage was ${row.storage.toFixed(1)} ${mm}, below the threshold`);
 const how=fate.cause==='cold'
  ? t('В день холода надземная часть останавливается и дальше показана погибшей, того же размера. Новые листья не появляются.','On the cold day the canopy stops and stays shown as dead, at that same size. No further leaves appear.')
  : t('Листья больше не растут и полегают. Дальше по сезону поле остаётся таким, каким было в день остановки.','The leaves stop growing and lodge. For the rest of the season the field stays as it was on the day growth stopped.');
 const action=fate.cause==='cold'
  ? t('Посейте в другой срок, чтобы этот холод не попал на сезон. Полив такую температуру не убирает.','Sow in a different season so this cold does not fall on the crop. Irrigation does not remove that temperature.')
  : fate.cause==='heat'
  ? t('Сдвиньте срок посева. Полив может пополнить запас воды, но не снимает эту жару.','Move the sowing date. Irrigation can refill water storage, but it does not remove this heat.')
  : t('Поливайте так, чтобы запас не держался ниже порога пять дней подряд. Сравните календарь полива и недельный лимит до этой даты. Полив после остановки рост в модели не возвращает.','Irrigate so storage does not stay below the threshold for five days in a row. Compare the irrigation calendar and the weekly limit before this date. Irrigation after the stop does not restart growth in the model.');
 return <article className="crop-fate"><h3>{t('Рост остановился','Growth stopped')}</h3><p>{t(`${date}: культура в этой модели дальше не растёт. Причина — ${cause}.`,`${date}: this crop grows no further in the model. The cause is ${cause}.`)}</p><p>{how}</p><p className="day-risk-action">{action}</p><small>{t('Это правило сценария, не измеренная гибель сорта и не прогноз урожая.','This is a scenario rule, not a measured cultivar death and not a yield forecast.')}</small></article>;
}
