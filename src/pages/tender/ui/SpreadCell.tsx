import { cx } from '@/shared/lib/cx';
import { plural } from '@/shared/lib/plural';
import { decimal, type CompareThresholds, type RowFacts } from '@/entities/comparison';
import type { CellPopupBind } from '@/shared/ui/CellPopup';
import { tableCell } from '@/shared/ui/Table';
import { spreadSummary } from '../model/compareFormat';
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
 *         СОДЕРЖИМОЕ РАЗБОРА СОБИРАЕТ `spreadSummary()` (model/compareFormat):
 *         шесть величин — края диапазона, кто на них стоит, сопоставимость,
 *         ставки — считались прямо в разметке, то есть в самом горячем месте
 *         экрана и без единой возможности их проверить. Компонент рисует
 *         процент, линейку степени и отдаёт готовую начинку попапу.
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

  return (
    <td
      className={cx(tableCell.numeric, tier.cell, s.spreadCell)}
      aria-label={`Разброс ${decimal(spread)} ${plural(Math.round(spread), 'процент', 'процента', 'процентов')} — ${word}`}
      {...bind(spreadSummary({ row, thresholds, nameOf }))}
    >
      {decimal(spread)} %
      <span className={cx(s.spreadMark, tier.mark)} aria-hidden="true">
        <SpreadMark />
      </span>
    </td>
  );
}
