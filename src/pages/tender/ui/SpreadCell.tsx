import { cx } from '@/shared/lib/cx';
import {
  decimal, money, type CompareThresholds, type RowFacts,
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
 * UX:     ТРИ СТЕПЕНИ — ОДНА ЛИНЕЙКА В ТРЁХ ТОНАХ (§1.8, решение владельца
 *         25.08.2026): low → success, noticeable → warning, high → danger.
 *         Прежний вид ставил знак ТОЛЬКО на высоком, а «заметный» нёс тихую
 *         заливку без единого символа — степень нельзя было прочитать, не
 *         сравнив проценты соседних строк глазами. Словесных подписей при
 *         этом нет (правило «слов в ячейках нет»), но процент остаётся
 *         текстом: цвет не единственный носитель.
 *         РАЗБОР ДИАПАЗОНА — НА ВСЕЙ ЯЧЕЙКЕ, а не на знаке: вопрос «насколько
 *         разошлись и кто крайний» задают самому числу. Показывает MIN /
 *         медиану / MAX поимённо и число сопоставимых цен — то, ради чего
 *         специалист и решает, верить ли проценту.
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
  const fair = row.bids.filter((b) => !b.anomaly).length;

  return (
    <td
      className={cx(tableCell.numeric, tier.cell, s.spreadCell)}
      aria-label={`Разброс ${decimal(spread)} процентов — ${word}`}
      {...bind({
        tone: spreadTag === 'high' ? 'danger' : spreadTag === 'noticeable' ? 'warning' : 'success',
        title: `Разброс ${decimal(spread)} % — ${word}`,
        fields: [
          {
            label: 'MIN',
            value: `${money(min * position.qty)} · ${nameOf(minAt.contractorId)}`,
          },
          {
            label: 'медиана',
            value: row.median === null ? '—' : money(row.median * position.qty),
          },
          {
            label: 'MAX',
            value: `${money(max * position.qty)} · ${nameOf(maxAt.contractorId)}`,
          },
          { label: 'сопоставимо', value: `${fair} из ${row.bids.length}` },
        ],
        meter: {
          label: 'на шкале тендера',
          value: `${decimal(spread)} %`,
          fraction: Math.min(spread / thresholds.spreadHigh, 1),
        },
        note: spreadTag === 'high'
          ? `Цены КП расходятся на ${decimal(thresholds.spreadHigh)} % и больше — сверяйте состав объёма, прежде чем сравнивать итоги.`
          : undefined,
      })}
    >
      {decimal(spread)} %
      <span className={cx(s.spreadMark, tier.mark)} aria-hidden="true">
        <SpreadMark />
      </span>
      {/* Микрошкала ОБЩАЯ для всех строк (высокий ярус = вся длина) —
          сравнивать бары между строками можно только на одной шкале. */}
      <span className={s.spreadBar} aria-hidden="true">
        <i style={{ width: `${Math.min((spread / thresholds.spreadHigh) * 100, 100)}%` }} />
      </span>
    </td>
  );
}
