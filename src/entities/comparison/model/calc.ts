/** СЧЁТ сравнения: итоги по КП, ранжир, разброс и производные числа строки.
 *  Формы данных — в `contract.ts`, пороги — в `thresholds.ts`; здесь только
 *  арифметика над ними, и вся она чистая (одни аргументы на входе — одно
 *  число на выходе), поэтому проверяется `comparison.check.ts` без DOM.
 *
 *  ПРОИЗВОДНОЕ СЧИТАЕТСЯ ОДНИМ ПРОХОДОМ `analyzeComparison()` и только здесь:
 *  таблица, фильтры, счётчики и попап читают одни и те же числа. */

import type { Tone } from '@/shared/ui/Badge';
import { POTENTIAL_MIN, type CompareThresholds } from './thresholds';
import {
  cellMark, hasAnomaly,
  type ComparePosition, type Contractor, type PositionGroup,
} from './contract';

/** Итог по одному подрядчику — всё, что показывает его карточка в шапке. */
export interface Bid {
  contractor: Contractor;
  /** Сколько позиций сметы закрыто расценкой. Не показывается цифрой — уходит
   *  в подпись шкалы для скринридера; на экране заполненность одна, `percent`,
   *  иначе два близких, но разных числа рядом читались бы как ошибка. */
  filled: number;
  /** Заполненность КП, 0…100 — из contractor.fill. */
  percent: number;
  /** Итог по ЗАКРЫТЫМ позициям. У неполного КП он заведомо занижен — поэтому
   *  ранг такого предложения и опущен в конец (см. rankBids). */
  sum: number;
  /** Место по итогу, с 1. */
  rank: number;
  /** Цвет колонки по месту: лучшее — зелёное, худшее — красное, всё между —
   *  янтарное. Тон, а не «зелёный»: цвет один раз назван в токенах. */
  tone: Tone;
  /** Подпись места. Цвет колонки — это wash в несколько процентов, и он не
   *  имеет права быть единственным носителем ранга: подпись читается и в
   *  чёрно-белом, и скринридером. */
  rankLabel: string;
}

/** Итог по позициям — одна функция и для группы, и для всего КП. */
export function sumOf(contractor: Contractor, positions: ComparePosition[]): number {
  return positions.reduce((acc, p) => acc + (contractor.prices[p.id] ?? 0) * p.qty, 0);
}

/** Итог подрядчика по разделу сметы — строка «Итого · Материалы». */
export function groupSum(group: PositionGroup, contractor: Contractor): number {
  return sumOf(contractor, group.positions);
}

/** Итоги по всем подрядчикам, УЖЕ отранжированные.
 *
 *  ПОРЯДОК СОРТИРОВКИ — ДВУХКЛЮЧЕВОЙ, и первый ключ важнее второго:
 *  сначала полнота КП, и только потом сумма. Иначе побеждал бы тот, кто
 *  просто не заполнил часть сметы: его итог меньше не потому, что дешевле,
 *  а потому, что там нечего складывать. Неполное предложение уходит вниз
 *  всегда, каким бы дешёвым ни выглядело.
 *
 *  Ранг — ПОДСКАЗКА, а не вердикт: сроки, гарантии и опыт в цифрах здесь не
 *  участвуют. Ровно поэтому цвет колонки можно перекрасить руками — базовый
 *  расчёт даёт первое приближение, решение остаётся за человеком. */
export function rankBids(contractors: Contractor[], positions: ComparePosition[]): Bid[] {
  const scored = contractors.map((contractor) => ({
    contractor,
    filled: positions.filter((p) => contractor.prices[p.id] !== undefined).length,
    percent: contractor.fill,
    sum: sumOf(contractor, positions),
  }));

  scored.sort((a, b) => (
    Number(a.percent < 100) - Number(b.percent < 100) || a.sum - b.sum
  ));

  const last = scored.length;
  return scored.map((bid, i) => {
    const rank = i + 1;
    return {
      ...bid,
      rank,
      tone: rank === 1 ? 'success' : rank === last ? 'danger' : 'warning',
      rankLabel: rank === 1 ? 'Лучшее предложение' : `${rank}-е место`,
    };
  });
}

/** Разброс цен по позиции — на сколько процентов самое дорогое предложение
 *  дороже самого дешёвого.
 *
 *  Считается от МИНИМУМА, а не от среднего: вопрос, который задают строке, —
 *  «насколько я переплачу, если возьму не самого дешёвого». Меньше двух
 *  расценок — сравнивать не с чем, и это null, а не 0: ноль означал бы
 *  «все предложили одинаково».  */
export function spread(position: ComparePosition, contractors: Contractor[]): number | null {
  const prices = contractors
    .map((c) => c.prices[position.id])
    .filter((p): p is number => p !== undefined);
  if (prices.length < 2) return null;
  const min = Math.min(...prices);
  return ((Math.max(...prices) - min) / min) * 100;
}

/* ═══════════════════ ПРОИЗВОДНЫЕ ЧИСЛА СТРОКИ ═══════════════════ */

export interface RowFacts {
  position: ComparePosition;
  /** Закрытые расценки в порядке колонок — ВКЛЮЧАЯ аномальные: разброс
   *  считается по всем ценам, минимум ищет обходной путь мимо них.
   *  `anomaly` — ОБЪЕДИНЁННЫЙ флаг ячейки: внешний вердикт из `marks`
   *  или результат формулы k (метки разброса и минимума живут отдельными
   *  полями строки, аномальность — свойство ячейки). */
  bids: Array<{ contractorId: string; price: number; anomaly: boolean }>;
  median: number | null;
  /** Разброс от минимума, %; меньше двух расценок — null, не ноль. */
  spread: number | null;
  /** Метка разброса ВЫВЕДЕНА из процента порогом, а не принята полем. */
  spreadTag: 'none' | 'noticeable' | 'high' | null;
  /** Подрядчик с лучшей НЕаномальной ценой; нет конкуренции — null. */
  bestId: string | null;
  /** Есть ли в строке аномальная расценка — подъём ячейковой пометки на
   *  строку для фильтра и счётчика: у строки нет своей аномалии, есть чужие. */
  anomaly: boolean;
  /** Отказ и пробел данных — разные состояния и разные счётчики: отказ это
   *  решение подрядчика, отсутствие расценки — дыра в КП (§4 слой 3). */
  declined: boolean;
  missing: boolean;
  /** Максимум заявленного потенциала по строке, ₽ ПО СТРОКЕ (за единицу ×
   *  общий объём): сортировка «По потенциалу» и фильтр читают его. */
  maxPot: number;
  /** Вес строки — сумма по самому дорогому предложению: «во сколько обойдётся
   *  в худшем случае», оценка риска, а не факта. У снятой строки вес 0. */
  weight: number;
  /** Строка попала в ключевые ПРАВИЛОМ «топ по весу до накопительной доли
   *  keyShare» — независимо от ручной пометки `position.key`. */
  keyDerived: boolean;
}

/** Медиана — по всем закрытым расценкам, включая аномальные: она описывает
 *  строку, а не судит её. */
export const medianOf = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Отклонение цены от медианы строки, % со знаком.
 *
 *  ЗАМЕНА, А НЕ РЕШЕНИЕ: настоящая база отклонения — внешняя эталонная цена
 *  строки (сметная / прошлая закупка), которой в контракте пока нет, и из цен
 *  КП её вывести нельзя — это доказано обратным счётом по демо-датасету
 *  (§2.2 аудита). До появления поля медиана годится показать режим и ни для
 *  чего больше. */
export const deviationPct = (price: number, median: number): number =>
  ((price - median) / median) * 100;

export interface ComparisonFacts {
  rows: RowFacts[];
  byId: Map<string, RowFacts>;
  /** Σ веса среза: база доли веса. Сумма долей даёт ровно 100 % — в отличие
   *  от сломанного «% среза» демо, делившего вес на чужой итог подрядчика. */
  sumWeight: number;
}

/** Формула аномалии metrics.md §9: ячейка помечается, если её отклонение от
 *  медианы превышает k × медиану отклонений ОСТАЛЬНЫХ — выброс ищется
 *  относительно того, как расходятся другие участники этой же строки.
 *  Минимум три расценки; при нулевой медиане и при нулевой медиане отклонений
 *  остальных действуют правила канона. Возвращает флаг НА КАЖДУЮ цену (в
 *  порядке входа). */
function deriveAnomalies(prices: number[], k: number): boolean[] {
  const flags = prices.map(() => false);
  if (prices.length < 3) return flags;
  const median = medianOf(prices);
  if (median === null || median === 0) return flags;
  const devs = prices.map((p) => Math.abs(p / median - 1));
  devs.forEach((d, i) => {
    const others = devs.filter((_, j) => j !== i);
    const medOthers = medianOf(others)!;
    flags[i] = medOthers === 0 ? d > 0 : d >= k * medOthers;
  });
  return flags;
}

export function analyzeComparison(
  groups: PositionGroup[],
  contractors: Contractor[],
  thresholds: CompareThresholds,
): ComparisonFacts {
  const byContractor = new Map(contractors.map((c) => [c.id, c]));
  const rows: RowFacts[] = groups.flatMap((group) => group.positions.map((position) => {
    const closed = contractors
      .filter((c) => c.prices[position.id] !== undefined)
      .map((c) => ({ contractorId: c.id, price: c.prices[position.id] }));

    const prices = closed.map((b) => b.price);
    const min = Math.min(...prices);
    const spreadPct = prices.length > 1 ? ((Math.max(...prices) - min) / min) * 100 : null;

    /* Аномальность ячейки: внешний вердикт ИЛИ формула k. Оба источника
       сходятся в одном флаге — таблица, фильтр и попап не спорят. */
    const derived = deriveAnomalies(prices, thresholds.anomalyK);
    const bids = closed.map((b, i) => ({
      contractorId: b.contractorId,
      price: b.price,
      anomaly: derived[i]
        || hasAnomaly(cellMark(byContractor.get(b.contractorId)!, position.id)),
    }));

    /* Минимум — лучшая НЕаномальная цена при живой конкуренции. */
    const fair = bids.filter((b) => !b.anomaly);
    const bestId = fair.length && prices.length > 1
      ? fair.reduce((best, b) => (b.price < best.price ? b : best)).contractorId
      : null;

    return {
      position,
      bids,
      median: medianOf(prices),
      spread: spreadPct,
      spreadTag: spreadPct === null ? null
        : spreadPct >= thresholds.spreadHigh ? 'high'
          : spreadPct >= thresholds.spreadNoticeable ? 'noticeable' : 'none',
      bestId,
      anomaly: bids.some((b) => b.anomaly),
      declined: contractors.some((c) => cellMark(c, position.id).declined === true),
      missing: !position.removed
        && contractors.some((c) => c.prices[position.id] === undefined && cellMark(c, position.id).declined !== true),
      maxPot: Math.max(0, ...contractors.map(
        (c) => (cellMark(c, position.id).potential ?? 0) * position.qty,
      )),
      weight: position.removed || !prices.length ? 0 : Math.max(...prices) * position.qty,
      keyDerived: false,
    };
  }));

  /* Ключевые по правилу «топ по весу»: минимальное число самых тяжёлых строк,
     чья накопительная доля достигает keyShare; строка отсечки включается
     (metrics.md §8). Снятые и неоценённые строки веса не имеют — в набор не
     попадают. Ручные пометки `position.key` добавляются ПОВЕРХ этого. */
  const sumWeight = rows.reduce((acc, r) => acc + r.weight, 0);
  if (sumWeight > 0) {
    let acc = 0;
    for (const row of [...rows].sort((a, b) => b.weight - a.weight)) {
      if (row.weight <= 0) break;
      acc += row.weight;
      row.keyDerived = true;
      if ((acc / sumWeight) * 100 >= thresholds.keyShare) break;
    }
  }

  return { rows, byId: new Map(rows.map((r) => [r.position.id, r])), sumWeight };
}

/* ═══════════════════ ИТОГИ УРОВНЯ ТЕНДЕРА ═══════════════════ */

export interface MetricTotals {
  /** Итог ЛУЧШЕГО КП по закрытым позициям — «текущая стоимость» тендера.
   *  Ни одного предложения — null: тире, а не ноль (ноль означал бы согласие). */
  best: number | null;
  /** Σ заявленного запаса по строкам торга — «потенциал стоимости». */
  potential: number;
}

/** Пара «стоимость → потенциал» одним проходом. Читатели — меню основного
 *  показателя и его шкала соотношения.
 *
 *  ФОРМУЛА ПОТЕНЦИАЛА ТА ЖЕ, что у точек торгов разбора (`analysis.ts`):
 *  строки с запасом от POTENTIAL_MIN и живой конкуренцией (две закрытые
 *  расценки). Две реализации одной величины разъехались бы при первой правке
 *  порога, поэтому отбор живёт здесь, а не у каждого читателя свой. */
export function metricTotals(rows: RowFacts[], bids: Bid[]): MetricTotals {
  return {
    best: bids[0]?.sum ?? null,
    potential: rows.reduce(
      (acc, r) => acc + (r.maxPot >= POTENTIAL_MIN && r.bids.length >= 2 ? r.maxPot : 0),
      0,
    ),
  };
}
