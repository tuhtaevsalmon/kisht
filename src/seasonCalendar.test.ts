import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seasonMonths,stageIndex,stageStarts,toggleDay} from './seasonCalendar.ts';

test('a season grid keeps December and January aligned to Monday',()=>{
 const months=seasonMonths('2027-12-15','2028-01-03');
 assert.deepEqual(months.map(month=>month.key),['2027-12','2028-01']);
 const december=months[0].cells;
 assert.equal(december[0],null);
 assert.equal(december[2]?.date,'2027-12-01');
 assert.equal(december.find(cell=>cell?.date==='2027-12-14')?.inSeason,false);
 assert.equal(december.find(cell=>cell?.date==='2027-12-15')?.inSeason,true);
 assert.equal(months[1].cells.find(cell=>cell?.date==='2028-01-03')?.inSeason,true);
 assert.equal(months[1].cells.find(cell=>cell?.date==='2028-01-04')?.inSeason,false);
 assert.ok(months.every(month=>month.cells.length%7===0));
});

test('stage marks follow the entered stage lengths',()=>{
 const stages=[30,30,60,30];
 assert.equal(stageIndex(0,stages),0);
 assert.equal(stageIndex(30,stages),1);
 assert.equal(stageIndex(149,stages),3);
 assert.deepEqual([...stageStarts(stages)],[0,30,60,120]);
});

test('a calendar click adds one dose and a second click clears that day',()=>{
 const added=toggleDay([{date:'2027-12-22',mm:20}],'2027-12-16',15);
 assert.deepEqual(added,[{date:'2027-12-16',mm:15},{date:'2027-12-22',mm:20}]);
 const doubled=toggleDay([{date:'2027-12-16',mm:10},{date:'2027-12-16',mm:5}],'2027-12-16',20);
 assert.deepEqual(doubled,[]);
 const empty: {date:string;mm:number}[]=[];
 assert.equal(toggleDay(empty,'2027-12-16',0),empty);
 assert.equal(toggleDay(empty,'2027-12-16',20,0),empty);
});
