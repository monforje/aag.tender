/** Предикаты среза таблицы: что именно прячет каждый пункт фильтра и сколько
 *  строк он пропустит. Считают по готовым `RowFacts` (`calc.ts`) — своей
 *  арифметики у фильтра нет, иначе пункт меню и сама таблица разошлись бы в
 *  том, что считать «высоким разбросом». */

import { deviationPct, type RowFacts } from './calc';
import { DEV_TOLERANCE, POTENTIAL_MIN } from './thresholds';

/* ═══════════════════ ПРЕДИКАТЫ ФИЛЬТРОВ ═══════════════════ */

export type PredicateId = 'key' | 'spread' | 'anomaly' | 'pot' | 'med';

export const PREDICATES: ReadonlyArray<{ id: PredicateId; label: string }> = [
  { id: 'key', label: 'Ключевые' },
  { id: 'spread', label: 'Высокий разброс' },
  { id: 'anomaly', label: 'Аномалии' },
  { id: 'pot', label: 'Есть потенциал' },
  { id: 'med', label: 'Дороже медианы строки' },
];

/** Пропускает ли строку предикат. Комбинируются по И, порядок не важен,
 *  пустой набор показывает всё. Порог «дороже медианы» ТОТ ЖЕ, что ставит
 *  бейдж ячейки (±DEV_TOLERANCE): один смысл — один порог ([R4]). */
export function predicatePasses(id: PredicateId, facts: RowFacts): boolean {
  switch (id) {
    case 'key': return facts.position.key === true || facts.keyDerived;
    case 'spread': return facts.spreadTag === 'high';
    case 'anomaly': return facts.anomaly;
    case 'pot': return facts.maxPot >= POTENTIAL_MIN;
    case 'med': return facts.median !== null && facts.bids.some(
      (b) => deviationPct(b.price, facts.median!) > DEV_TOLERANCE,
    );
  }
}

/** Строки, проходящие ВСЕ активные предикаты (И). */
export const filterRows = (rows: RowFacts[], filters: PredicateId[]): RowFacts[] =>
  rows.filter((row) => filters.every((id) => predicatePasses(id, row)));

/** Счётчик предиката: сколько строк он пропустит на ВСЕХ данных — число на
 *  невыбранном пункте иначе бесполезно (показывает «после всего остального»). */
export const predicateCount = (id: PredicateId, rows: RowFacts[]): number =>
  rows.filter((row) => predicatePasses(id, row)).length;
