/** Срез реестра: форма набора фильтров, счётчики для кнопок и само
 *  применение. Своих данных не держит — строки приходят аргументом, потому
 *  что их источник (мок сегодня, ответ сервера завтра) фильтру безразличен. */

import { dmyToIso } from '@/shared/lib/date';
import type { Facet } from '@/shared/ui/FacetFilter';
import type { StatusId, TenderRow } from './tender';

export interface Filters {
  /** Четыре списка из окна «Фильтры» — мультивыбор: в реестре нормально
   *  смотреть два портфеля сразу, а одиночный выбор заставлял бы открывать
   *  меню столько раз, сколько значений нужно сравнить. */
  portfolio: string[];
  project: string[];
  kind: string[];
  owner: string[];
  statuses: StatusId[];
  /** Границы периода в формате <input type="date"> (ГГГГ-ММ-ДД), не ДД.ММ.ГГГГ. */
  from: string;
  to: string;
  q: string;
}

/** Ключи, которые живут в окне «Фильтры». Одним списком, чтобы окно, счётчик
 *  и сброс не разъехались: добавили колонку — правится одно место. */
const PANEL_KEYS = ['portfolio', 'project', 'kind', 'owner'] as const;
type PanelKey = (typeof PANEL_KEYS)[number];

const PANEL_TITLE: Record<PanelKey, string> = {
  portfolio: 'Портфель', project: 'Проект', kind: 'Вид работ', owner: 'Ответственный',
};

export const EMPTY_FILTERS: Filters = {
  portfolio: [], project: [], kind: [], owner: [], statuses: [], from: '', to: '', q: '',
};

/** Критерии окна «Фильтры» для универсального <FacetFilter>: значения
 *  выводятся ИЗ СТРОК, а не пишутся руками, поэтому в меню не может появиться
 *  пункт, который ничего не найдёт, и не может пропасть значение, которое в
 *  данных есть.
 *
 *  ФУНКЦИЯ, А НЕ КОНСТАНТА, и это не стилистика. Константа считалась бы один
 *  раз при загрузке модуля — по строкам, которых на тот момент ещё нет: с
 *  ответом сервера меню фильтров осталось бы пустым навсегда, молча и без
 *  единой ошибки. Аргумент — те же строки, что показывает таблица. */
export const facetsOf = (rows: TenderRow[]): Facet[] => PANEL_KEYS.map((key) => ({
  key,
  title: PANEL_TITLE[key],
  options: [...new Set(rows.map((row) => row[key]))],
}));

/** Сколько групп окна «Фильтры» задействовано — цифра на кнопке. */
export function panelCount(f: Filters): number {
  return PANEL_KEYS.filter((key) => f[key].length > 0).length;
}

/** Сколько фильтров активно всего — цифра у «Сбросить всё». Период считается
 *  одним фильтром, даже если заполнены обе границы. */
export function activeCount(f: Filters): number {
  return panelCount(f)
    + (f.statuses.length ? 1 : 0)
    + (f.from || f.to ? 1 : 0)
    + (f.q.trim() ? 1 : 0);
}

/** Пересечение всех условий: пустой список фильтром не является.
 *
 *  ПЕРИОД ОТБИРАЕТ ПО ПЕРЕСЕЧЕНИЮ, а не по вложенности. Раньше условие было
 *  «начало ≥ от И окончание ≤ до», то есть тендер обязан был уложиться в окно
 *  ЦЕЛИКОМ. На данных, где тендер идёт месяцами, окно «последние 30 дней» не
 *  вмещало ни одного — и пустая таблица читалась как ограничение фильтра, хотя
 *  никакого ограничения нет. Спрашивают всегда «что шло в этот период», а это
 *  пересечение отрезков: тендер попадает в выборку, если он закончился не
 *  раньше начала окна и начался не позже его конца. */
export function applyFilters(rows: TenderRow[], f: Filters): TenderRow[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter((row) => (
    (!f.portfolio.length || f.portfolio.includes(row.portfolio))
    && (!f.project.length || f.project.includes(row.project))
    && (!f.kind.length || f.kind.includes(row.kind))
    && (!f.owner.length || f.owner.includes(row.owner))
    && (!f.statuses.length || f.statuses.includes(row.status))
    && (!f.from || dmyToIso(row.end) >= f.from)
    && (!f.to || dmyToIso(row.start) <= f.to)
    && (!q || `${row.id} ${row.title}`.toLowerCase().includes(q))
  ));
}
