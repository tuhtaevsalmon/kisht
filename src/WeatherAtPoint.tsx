import { useRef, useState } from 'react';
import { Satellite } from 'lucide-react';
import { cropLabels, cropParams, type CropId, type Lang } from './domain';
import { loadNASA } from './liveData';
import { seasonTotals, yearPairShift, type YearWeather } from './weatherShift';

interface Props { lat: number; lon: number; planting: string; crop: CropId; duration: number; lang: Lang }
const YEARS = [2020, 2021, 2022, 2023, 2024];

export default function WeatherShift({ lat, lon, planting, crop, duration, lang }: Props) {
  const t = (ru: string, en: string) => lang === 'ru' ? ru : en;
  const heat = cropParams[crop].heat;
  const [rows, setRows] = useState<YearWeather[]>([]);
  const [missed, setMissed] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<{ year: number; url: string }[]>([]);
  const request = useRef<AbortController | null>(null);
  const shift = yearPairShift(rows);
  const name = cropLabels[crop][lang === 'ru' ? 'ru' : 'en'];

  async function load() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setRows([]);
    setMissed([]);
    setLinks([]);
    const got: YearWeather[] = [];
    const bad: number[] = [];
    const sources: { year: number; url: string }[] = [];
    for (const year of YEARS) {
      if (controller.signal.aborted) break;
      try {
        const source = await loadNASA({ lat, lon, planting, year, duration, signal: controller.signal });
        got.push({ year, ...seasonTotals(source.days, heat) });
        sources.push({ year, url: source.url });
      } catch {
        if (!controller.signal.aborted) bad.push(year);
      }
      if (request.current === controller) {
        setRows([...got]);
        setMissed([...bad]);
        setLinks([...sources]);
      }
    }
    if (request.current === controller) setBusy(false);
  }

  return <section className="v2-panel weather-shift">
    <div className="panel-heading"><h2><Satellite size={20} />{t('Погода на этой точке, 2020–2024', 'Weather at this point, 2020–2024')}</h2><span>NASA POWER</span></div>
    <p>{t(`Одно и то же окно посева ${name}: сумма дождя и дни, когда максимум выше порога модели ${heat} °C. Пять сезонов на координате участка — не климатическая норма и не прогноз следующего года.`, `The same ${name} sowing window: rainfall total and days when the maximum exceeds the model threshold of ${heat} °C. Five seasons at the field coordinate are not a climate normal and not a forecast of next year.`)}</p>
    <button className="primary" disabled={busy} onClick={load}>{busy ? t('Загружаем годы NASA…', 'Loading NASA years…') : t('Показать пять лет', 'Show five years')}</button>
    {missed.length > 0 && <p className="inline-note" role="status">{t('Эти годы не вошли: ряд неполный. Пропуски не заполнялись.', 'These years were left out because the series was incomplete. Gaps were not filled in.')} {missed.join(', ')}.</p>}
    {rows.length > 0 && <div className="climate-table-wrap"><table className="climate-table"><thead><tr><th>{t('Год', 'Year')}</th><th>{t('Дождь за окно, мм', 'Rain in the window, mm')}</th><th>{t('Жарких дней', 'Hot days')}</th></tr></thead><tbody>{rows.map(row => <tr key={row.year}><td><b>{row.year}</b></td><td>{row.rain.toFixed(1)}</td><td>{row.hotDays}</td></tr>)}</tbody></table></div>}
    {shift && <p className="climate-conclusion">{t('2023–2024 против 2020–2021 на этой точке.', '2023–2024 compared with 2020–2021 at this point.')} {t('Дождь', 'Rain')}: <b>{shift.rainEarly.toFixed(1)} → {shift.rainLate.toFixed(1)} {t('мм', 'mm')}</b>. {t('Жаркие дни', 'Hot days')}: <b>{shift.hotEarly.toFixed(1)} → {shift.hotLate.toFixed(1)}</b>. {t('Это четыре сезона, а не доказанный многолетний тренд.', 'These are four seasons, not a demonstrated long-term trend.')}</p>}
    {!shift && rows.length > 0 && !busy && <p className="inline-note">{t('Сравнение 2020–2021 с 2023–2024 появится, когда все четыре года загрузятся целиком.', 'The 2020–2021 and 2023–2024 comparison appears once all four years load completely.')}</p>}
    {links.length > 0 && <p>{links.map(link => <a key={link.year} href={link.url} target="_blank" rel="noreferrer">NASA POWER {link.year} ↗</a>)} </p>}
  </section>;
}
