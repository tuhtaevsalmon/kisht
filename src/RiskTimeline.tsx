import type {Lang} from './domain';
import type {SeasonRow,RiskKind} from './riskEvents';

export default function RiskTimeline({rows,day,lang}:{rows:SeasonRow[];day:number;lang:Lang}){
 const tracks:[RiskKind,string,string][]=[['waterRisk','Вода','Water'],['heat','Жара','Heat'],['frost','Холод','Frost']];
 const count=Math.max(1,rows.length);
 return <div className="risk-tracks" role="group" aria-label={lang==='ru'?'Риски за сезон: вода, жара и холод. Выбирайте день ползунком выше.':'Season risks: water, heat and frost. Choose a day with the slider above.'}>
  {tracks.map(([kind,ru,en])=><div className="risk-track" key={kind}><span>{lang==='ru'?ru:en}</span><svg viewBox={`0 0 ${count} 10`} preserveAspectRatio="none" aria-hidden="true"><rect width={count} height="10" fill="#e7ecdf"/>{rows.map((r,i)=>r[kind]?<rect key={i} x={i} width="1" height="10" className={kind}/>:null)}<rect x={Math.min(day,count-1)} width="1" height="10" fill="#14291c" stroke="white" strokeWidth=".3"/></svg><small>{rows.filter(r=>r[kind]).length} {lang==='ru'?'дн.':'d'}</small></div>)}
 </div>;
}
