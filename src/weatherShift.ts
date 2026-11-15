export interface SeasonTotals { rain: number; hotDays: number; days: number }
export interface YearWeather extends SeasonTotals { year: number }
export interface YearPairShift { rainEarly: number; rainLate: number; hotEarly: number; hotLate: number }

/** Rain and hot days inside one sowing window. Hot days use the same threshold as the simulation. */
export function seasonTotals(days: { rain: number; max: number }[], heat: number): SeasonTotals {
  if (!Number.isFinite(heat)) throw Error('Invalid heat threshold');
  const rain = days.reduce((sum, day) => sum + day.rain, 0);
  return { rain: Math.round(rain * 10) / 10, hotDays: days.filter(day => day.max > heat).length, days: days.length };
}

/** 2023–2024 against 2020–2021. Missing any of those four years means there is no pair to show. */
export function yearPairShift(rows: YearWeather[]): YearPairShift | null {
  const at = (year: number) => rows.find(row => row.year === year);
  const early = [at(2020), at(2021)];
  const late = [at(2023), at(2024)];
  if (early.some(row => !row) || late.some(row => !row)) return null;
  const avg = (group: YearWeather[], key: 'rain' | 'hotDays') => group.reduce((sum, row) => sum + row[key], 0) / group.length;
  const round = (value: number) => Math.round(value * 10) / 10;
  return {
    rainEarly: round(avg(early as YearWeather[], 'rain')),
    rainLate: round(avg(late as YearWeather[], 'rain')),
    hotEarly: round(avg(early as YearWeather[], 'hotDays')),
    hotLate: round(avg(late as YearWeather[], 'hotDays')),
  };
}
