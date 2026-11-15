import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seasonTotals, yearPairShift } from './weatherShift.ts';
import { rotationIndicators, soilSequenceIndex } from './rotation.ts';
import { rotationDates } from './rotation.ts';

test('season totals count rain and days above the crop heat threshold', () => {
  const totals = seasonTotals([{ rain: 1.26, max: 29 }, { rain: 0, max: 30 }, { rain: 4, max: 28.9 }], 29);
  assert.deepEqual(totals, { rain: 5.3, hotDays: 1, days: 3 });
});

test('year pair compares 2023–2024 with 2020–2021 only when all four years exist', () => {
  const row = (year: number, rain: number, hotDays: number) => ({ year, rain, hotDays, days: 110 });
  assert.equal(yearPairShift([row(2020, 10, 1), row(2021, 20, 3), row(2022, 99, 99), row(2023, 30, 5)]), null);
  assert.deepEqual(yearPairShift([row(2020, 10, 1), row(2021, 20, 3), row(2022, 99, 99), row(2023, 30, 5), row(2024, 40, 7)]), {
    rainEarly: 15, rainLate: 35, hotEarly: 2, hotLate: 6,
  });
});

test('alfalfa counts as a legume season and the soil index does not invent nitrogen', () => {
  const dates = rotationDates('2027-04-01');
  const alfalfa = rotationIndicators(['alfalfa', 'wheat', 'alfalfa'], 'unknown', dates, [100, 135, 100]);
  assert.equal(alfalfa.legumeSeasons, 2);
  assert.equal(alfalfa.familyRepeats, 0);
  const mixed = rotationIndicators(['wheat', 'corn', 'legume'], 'wheat', dates, [135, 120, 120]);
  assert.equal(mixed.legumeSeasons, 1);
  assert.deepEqual(soilSequenceIndex(mixed), { score: 64, extraGap: 116, gapPenalty: 11, legumeCredit: 15, repeatPenalty: 40 });
});
