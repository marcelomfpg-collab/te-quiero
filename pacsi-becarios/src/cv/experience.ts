import { normalize } from '../lib/text';

const MONTHS: Record<string, number> = {
  ene: 1, enero: 1, jan: 1,
  feb: 2, febrero: 2,
  mar: 3, marzo: 3,
  abr: 4, abril: 4, apr: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6,
  jul: 7, julio: 7,
  ago: 8, agosto: 8, aug: 8,
  set: 9, sep: 9, sept: 9, setiembre: 9, septiembre: 9,
  oct: 10, octubre: 10,
  nov: 11, noviembre: 11,
  dic: 12, diciembre: 12, dec: 12,
};

const MONTH_NAMES = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
/** Una fecha: "ene 2024", "enero de 2024", "01/2024", "2024-01", "2024". */
const DATE = `(?:(?:${MONTH_NAMES})\\.?\\s*(?:de[l]?\\s+)?\\d{4}|\\d{1,2}\\s*[/.-]\\s*\\d{4}|\\d{4}\\s*[/.-]\\s*\\d{1,2}|\\d{4})`;
const PRESENT = '(?:actualidad|presente|la\\s+fecha|actual|hoy|a\\s+la\\s+fecha)';
const RANGE = new RegExp(`(${DATE})\\s*(?:-|–|—|a|al|hasta|>)\\s*(${DATE}|${PRESENT})`, 'gi');

interface YearMonth {
  y: number;
  m: number;
  /** false cuando solo se conoce el año. */
  exactMonth: boolean;
}

function parsePoint(raw: string, today: string): YearMonth | null {
  const v = normalize(raw).replace(/\s+/g, ' ').trim();
  if (new RegExp(`^${PRESENT}$`).test(v)) {
    const [y, m] = today.split('-').map(Number);
    return { y: y!, m: m!, exactMonth: true };
  }
  const named = v.match(new RegExp(`^(${MONTH_NAMES})\\.?\\s*(?:de[l]?\\s+)?(\\d{4})$`));
  if (named) return { y: Number(named[2]), m: MONTHS[named[1]!]!, exactMonth: true };
  const mmYyyy = v.match(/^(\d{1,2})\s*[/.-]\s*(\d{4})$/);
  if (mmYyyy) return { y: Number(mmYyyy[2]), m: Number(mmYyyy[1]), exactMonth: true };
  const yyyyMm = v.match(/^(\d{4})\s*[/.-]\s*(\d{1,2})$/);
  if (yyyyMm) return { y: Number(yyyyMm[1]), m: Number(yyyyMm[2]), exactMonth: true };
  const year = v.match(/^(\d{4})$/);
  if (year) return { y: Number(year[1]), m: 1, exactMonth: false };
  return null;
}

export interface ExperienceResult {
  months: number;
  /** Rangos encontrados, para mostrar de dónde salió el cálculo. */
  ranges: string[];
  /** true si algún rango solo tenía años (cálculo aproximado). */
  approximate: boolean;
}

/**
 * Suma los meses de los periodos de trabajo ("Ene 2024 – Jun 2024 = 6 meses").
 * Los periodos que se superponen se cuentan una sola vez.
 */
export function sumExperience(text: string, today: string): ExperienceResult {
  const intervals: [number, number][] = [];
  const ranges: string[] = [];
  let approximate = false;
  const todayIndex = (() => {
    const [y, m] = today.split('-').map(Number);
    return y! * 12 + m! - 1;
  })();

  for (const match of normalize(text).matchAll(RANGE)) {
    const start = parsePoint(match[1]!, today);
    const end = parsePoint(match[2]!, today);
    if (!start || !end) continue;
    if (start.m < 1 || start.m > 12 || end.m < 1 || end.m > 12) continue;
    if (start.y < 1990 || end.y > 2100) continue;
    // Solo años ("2022 - 2023"): se toma de enero a diciembre del año final, marcado como aproximado.
    const endMonth = end.exactMonth ? end.m : 12;
    const a = start.y * 12 + start.m - 1;
    const b = Math.min(end.y * 12 + endMonth - 1, todayIndex);
    if (b < a || b - a > 12 * 15) continue;
    if (!start.exactMonth || !end.exactMonth) approximate = true;
    intervals.push([a, b]);
    ranges.push(match[0].trim());
  }

  intervals.sort((x, y) => x[0] - y[0]);
  let months = 0;
  let current: [number, number] | null = null;
  for (const iv of intervals) {
    if (current && iv[0] <= current[1] + 1) current[1] = Math.max(current[1], iv[1]);
    else {
      if (current) months += current[1] - current[0] + 1;
      current = [...iv];
    }
  }
  if (current) months += current[1] - current[0] + 1;
  return { months, ranges, approximate };
}
