/** Предикаты среза таблицы: что именно прячет каждый пункт фильтра и сколько
 *  строк он пропустит. Считают по готовым `RowFacts` (`calc.ts`) — своей
 *  арифметики у фильтра нет, иначе пункт меню и сама таблица разошлись бы в
 *  том, что считать «высоким разбросом». */

import type { RowFacts } from './calc';
import { POTENTIAL_MIN } from './thresholds';

/* ═══════════════════ ПРЕДИКАТЫ ФИЛЬТРОВ ═══════════════════ */

/** СОСТАВ ЗАКРЫТ — ЧЕТЫРЕ ПУНКТА (`filters.md` §3). Пятый, «Дороже медианы
 *  строки», убран 25.08.2026 по решению владельца: канон его не знает, а
 *  «есть, но нигде не описано» третьим состоянием не бывает — либо правится
 *  канон, либо уходит пункт.
 *
 *  Потеря невелика и это проверялось: «дороже медианы» отвечал на тот же
 *  вопрос, что суффикс отклонения по галочке, только грубее — тот показывает
 *  процент у КАЖДОЙ ячейки, а фильтр лишь прятал строки, где такая ячейка
 *  есть хоть одна. Порог ±DEV_TOLERANCE ушёл вместе с ним: других читателей
 *  у него не было. */
export type PredicateId = 'key' | 'spread' | 'anomaly' | 'pot';

export const PREDICATES: ReadonlyArray<{ id: PredicateId; label: string }> = [
  { id: 'key', label: 'Ключевые позиции' },
  { id: 'spread', label: 'Высокий разброс' },
  { id: 'pot', label: 'Есть потенциал' },
  { id: 'anomaly', label: 'Аномальные цены' },
];

/** Пропускает ли строку предикат. Комбинируются по И, порядок не важен,
 *  пустой набор показывает всё. */
export function predicatePasses(id: PredicateId, facts: RowFacts): boolean {
  switch (id) {
    case 'key': return facts.position.key === true || facts.keyDerived;
    case 'spread': return facts.spreadTag === 'high';
    case 'anomaly': return facts.anomaly;
    case 'pot': return facts.maxPot >= POTENTIAL_MIN;
  }
}

/** Строки, проходящие ВСЕ активные предикаты (И). */
export const filterRows = (rows: RowFacts[], filters: PredicateId[]): RowFacts[] =>
  rows.filter((row) => filters.every((id) => predicatePasses(id, row)));

/** Счётчик предиката: сколько строк он пропустит на ВСЕХ данных — число на
 *  невыбранном пункте иначе бесполезно (показывает «после всего остального»). */
export const predicateCount = (id: PredicateId, rows: RowFacts[]): number =>
  rows.filter((row) => predicatePasses(id, row)).length;

/** Незнакомый предикат из URL или из чужого пресета отбрасывается, а не
 *  роняет экран (§3.5): состав закрыт, и всё, чего в нём нет, — мусор.
 *  Дубликаты схлопываются: два одинаковых фильтра это один фильтр, а на
 *  счётчике полосы они дали бы «Фильтры: 2» при одном действующем. */
export const sanitizeFilters = (raw: readonly string[]): PredicateId[] => {
  const known = new Set(PREDICATES.map((p) => p.id as string));
  return [...new Set(raw.filter((id) => known.has(id)))] as PredicateId[];
};
