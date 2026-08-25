import { cx } from '@/shared/lib/cx';
import { plural } from '@/shared/lib/plural';
import {
  anomalyRatio, decimal, money, spreadPoints,
  type CompareThresholds, type RowFacts,
} from '@/entities/comparison';
import type { CellPopupBind } from '@/shared/ui/CellPopup';
import { tableCell } from '@/shared/ui/Table';
import { SpreadMark } from './assets';
import s from './TenderCompare.module.css';

/** Ярус → пара классов: мягкая заливка ячейки и тон линейки. Таблицей, а не
    склейкой строк: собранное из строки имя класса не проверяется ничем. */
const TIER = {
  none: { cell: s.spreadNone, mark: s.spLow },
  noticeable: { cell: s.spreadNoticeable, mark: s.spNot },
  high: { cell: s.spreadHigh, mark: s.spHigh },
} as const;

/**
 * Ячейка «Разброс» строки сравнения: процент, линейка степени и разбор
 * диапазона по наведению.
 *
 * КОГДА:  четвёртая колонка строки <CompareRow>.
 * НЕ ДЛЯ: ячеек КП (см. BidCell) — разброс считается по СТРОКЕ, а не по
 *         предложению подрядчика.
 *
 * UX:     ПОЛОСКИ В САМОМ СТОЛБЦЕ НЕТ (правка владельца 25.08.2026, §3).
 *         Микрошкала стояла под процентом и нормировалась порогом тендера;
 *         на 90 пикселях колонки она давала три-четыре различимых положения,
 *         то есть повторяла словесную градацию грубее, чем та, и при этом
 *         поднимала строку. Приоритет отдан числу и градации: процент читают
 *         точно, тон линейки отвечает «насколько это много». ФОРМА ряда —
 *         вопрос отдельный и редкий, и ей место в разборе, где под неё есть
 *         ширина (полоска распределения последней строкой попапа).
 *         ТРИ СТЕПЕНИ — ОДНА ЛИНЕЙКА В ТРЁХ ТОНАХ (§1.8, решение владельца
 *         25.08.2026): low → success, noticeable → warning, high → danger.
 *         Прежний вид ставил знак ТОЛЬКО на высоком, а «заметный» нёс тихую
 *         заливку без единого символа — степень нельзя было прочитать, не
 *         сравнив проценты соседних строк глазами. Словесных подписей при
 *         этом нет (правило «слов в ячейках нет»), но процент остаётся
 *         текстом: цвет не единственный носитель.
 *         РАЗБОР ДИАПАЗОНА — НА ВСЕЙ ЯЧЕЙКЕ, а не на знаке: вопрос «насколько
 *         разошлись и кто крайний» задают самому числу. Показывает MIN /
 *         медиану / MAX поимённо И СО СТАВКОЙ (правка §3: «705 ₽/м²» рядом со
 *         стоимостью — единственный способ сравнить края, когда объём у
 *         поставщиков разный), число сопоставимых цен, поимённый разбор
 *         аномалий коэффициентом k и полоску распределения последней строкой.
 *         Меньше двух расценок — прочерк, а не ноль: ноль означал бы согласие.
 * A11Y:   линейка aria-hidden, степень названа словом в aria-label ячейки —
 *         тон для скринридера не существует. Число читается текстом.
 *
 * @example
 * <SpreadCell row={row} bind={popup.bind} thresholds={thresholds} nameOf={nameOf} />
 */
export function SpreadCell({ row, bind, thresholds, nameOf }: {
  row: RowFacts;
  bind: CellPopupBind;
  /** Пороги тендера: ярус, нормировка шкалы и текст причины делят одни
      значения с фильтром «Высокий разброс». */
  thresholds: CompareThresholds;
  /** Имя подрядчика по id — для поимённых краёв диапазона. Функцией, а не
   *  списком: <CompareRow> мемоизирован, и стабильный колбэк дешевле массива. */
  nameOf: (contractorId: string) => string;
}) {
  const { position, spread, spreadTag } = row;

  if (position.removed || spread === null || spreadTag === null) {
    return (
      <td className={cx(tableCell.numeric, tableCell.muted)}>
        <span className={s.dash}>—</span>
        {/* Причина отсутствия — не «разброс 0 %», а «сравнивать не с чем»
            (§1.5, хвост сортировки по разбросу читает то же правило). */}
        {!position.removed && row.bids.length === 1 ? (
          <span className={tableCell.sub}>одно КП</span>
        ) : null}
      </td>
    );
  }

  const tier = TIER[spreadTag];
  const word = spreadTag === 'high' ? 'высокий'
    : spreadTag === 'noticeable' ? 'заметный' : 'низкий';

  const prices = row.bids.map((b) => b.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const minAt = row.bids.find((b) => b.price === min)!;
  const maxAt = row.bids.find((b) => b.price === max)!;
  const fair = row.bids.filter((b) => !b.anomaly);

  /* СТОИМОСТЬ И СТАВКА ОДНОЙ СТРОКОЙ. Края диапазона сравнивают по деньгам,
     но объём у корректировок бывает свой, и «1 692 000 ₽» без «705 ₽/м²»
     не отвечает, дешевле ли предложение на самом деле. */
  const pair = (price: number) => `${money(price * position.qty)} · ${money(price)}/${position.unit}`;

  /* ПОЛОСКА — ГОТОВЫЕ ТОЧКИ ИЗ МОДЕЛИ (`spreadPoints`): нормировка, слияние
     близких и порядок считаются там и проверяются `comparison.check.ts`.
     Здесь остаются только слова — имена подрядчиков за точкой. */
  const points = spreadPoints(row);

  return (
    <td
      className={cx(tableCell.numeric, tier.cell, s.spreadCell)}
      aria-label={`Разброс ${decimal(spread)} ${plural(Math.round(spread), 'процент', 'процента', 'процентов')} — ${word}`}
      {...bind({
        tone: spreadTag === 'high' ? 'danger' : spreadTag === 'noticeable' ? 'warning' : 'success',
        title: `Разброс ${decimal(spread)} % — ${word}`,
        width: 420,
        fields: [
          { label: 'MIN', value: `${pair(min)} · ${nameOf(minAt.contractorId)}` },
          {
            label: 'медиана',
            value: row.median === null ? '—' : pair(row.median),
          },
          { label: 'MAX', value: `${pair(max)} · ${nameOf(maxAt.contractorId)}` },
          {
            label: 'сопоставимо',
            value: `${fair.length} ${plural(fair.length, 'цена', 'цены', 'цен')} из ${row.bids.length}`,
          },
          /* АНОМАЛИИ — ПОИМЁННО И С КОЭФФИЦИЕНТОМ. Строка «сопоставимо 5 из 6»
             называет ЧИСЛО выброшенных, но не отвечает, кто и насколько
             выбился, — а именно это решает, спорить с ценой или принять её.
             k считается моделью (`anomalyRatio`), формулировка выводится из
             знака: «выше»/«ниже» медианы, а не заранее написанное слово. */
          ...row.bids.filter((b) => b.anomaly).map((b) => {
            const k = anomalyRatio(b.price, row.median);
            return {
              span: true as const,
              label: '',
              value: k === null
                ? `аномалия: ${nameOf(b.contractorId)}`
                : `аномалия: ${nameOf(b.contractorId)} ${k >= 1 ? 'выше' : 'ниже'} медианы в k = ${decimal(k >= 1 ? k : 1 / k)} раза`,
            };
          }),
        ],
        /* ПОЛОСКА ПОСЛЕДНЕЙ СТРОКОЙ (§3): показывает ФОРМУ ряда, не масштаб.
           Меньше двух сопоставимых цен — полоски нет вовсе: одна точка
           показывает не форму, а её отсутствие. */
        strip: points.length >= 2 ? {
          min: 'MIN',
          max: 'MAX',
          points: points.map((p) => ({
            at: p.at,
            n: p.n,
            title: p.ids.map(nameOf).join(', '),
          })),
        } : undefined,
        note: spreadTag === 'high'
          ? `Цены КП расходятся на ${decimal(thresholds.spreadHigh)} % и больше — сверяйте состав объёма, прежде чем сравнивать итоги.`
          : undefined,
      })}
    >
      {decimal(spread)} %
      <span className={cx(s.spreadMark, tier.mark)} aria-hidden="true">
        <SpreadMark />
      </span>
    </td>
  );
}
