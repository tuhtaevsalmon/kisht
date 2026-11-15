import {addDays,type IrrigationEvent} from './domain.ts';

export interface CalendarCell {date:string;inSeason:boolean}
export interface SeasonMonth {key:string;cells:(CalendarCell|null)[]}

export function seasonMonths(start:string,end:string):SeasonMonth[]{
 if(end<start)return [];
 const months:SeasonMonth[]=[];
 let cursor=start.slice(0,8)+'01';
 const last=end.slice(0,7);
 while(cursor.slice(0,7)<=last){
  const month=cursor.slice(0,7);
  const cells:(CalendarCell|null)[]=[];
  const lead=(new Date(cursor+'T12:00:00Z').getUTCDay()+6)%7;
  for(let i=0;i<lead;i++)cells.push(null);
  let day=cursor;
  while(day.slice(0,7)===month){
   cells.push({date:day,inSeason:day>=start&&day<=end});
   day=addDays(day,1);
  }
  while(cells.length%7)cells.push(null);
  months.push({key:month,cells});
  cursor=day;
 }
 return months;
}

export function stageIndex(offset:number,stages:readonly number[]){
 let cursor=0;
 for(let i=0;i<stages.length;i++){cursor+=stages[i];if(offset<cursor)return i;}
 return Math.max(0,stages.length-1);
}

export function stageStarts(stages:readonly number[]){
 const starts=new Set<number>();
 let cursor=0;
 for(const days of stages){starts.add(cursor);cursor+=days;}
 return starts;
}

/** A day that already has water is cleared. An empty day receives one dose. */
export function toggleDay(events:readonly IrrigationEvent[],date:string,mm:number,limit=500):IrrigationEvent[]{
 if(events.some(event=>event.date===date))return events.filter(event=>event.date!==date);
 if(!Number.isFinite(mm)||mm<=0||mm>200||events.length>=limit)return events as IrrigationEvent[];
 return [...events,{date,mm}].sort((a,b)=>a.date.localeCompare(b.date)||a.mm-b.mm);
}
