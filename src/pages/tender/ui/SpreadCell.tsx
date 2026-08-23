import { cx } from '@/shared/lib/cx';
import { decimal, type CompareThresholds, type RowFacts } from '@/entities/tender';
import type { CellPopupBind } from '@/shared/ui/CellPopup';
import { tableCell } from '@/shared/ui/Table';
import { SpreadMark } from './assets';
import s from './TenderCompare.module.css';

/** Заливка микрошкалы разброса — тон её яруса ([R8]: никаких мёртвых классов,
    три яруса — три правила). */
const SPREAD_TONE = {
  none: s.spreadNone,
  noticeable: s.spreadNoticeable,
  high: s.spreadHigh,
} as const;

/**
 * Ячейка «Разброс» строки сравнения: процент по трёхярусной шкале, микрошкала
 * и маркер высокого разброса.
 *
 * КОГДА:  четвёртая колонка строки <CompareRow>.
 * НЕ ДЛЯ: ячеек КП (см. BidCell) — разброс считается по СТРОКЕ, а не по
 *         предложению подрядчика.
 *
 * UX:     меньше двух расценок — прочерк, а не ноль: ноль означал бы согласие.
 *         У единственного КП подпись говорит, почему числа нет. Метка выведена
 *         из процента ПОРОГОМ ТЕНДЕРА (metrics.md §7); маркер ставится только
 *         на «высоком» — тот же порог, что у фильтра ([R4]).
 *         Микрошкала ОБЩАЯ для всех строк (высокий ярус = вся длина) —
 *         сравнивать бары между строками можно только на одной шкале; шкала
 *         едет вместе с порогом, иначе после правки настройки бар врал бы.
 * A11Y:   маркер — кнопка со своим именем; шкала aria-hidden, само число
 *         читается текстом.
 *
 * @example
 * <SpreadCell row={row} bind={popup.bind} thresholds={thresholds} />
 */
export function SpreadCell({ row, bind, thresholds }: {
  row: RowFacts;
  bind: CellPopupBind;
  /** Пороги тендера: метка яруса, нормировка шкалы и текст причины делят
      одни значения с фильтром «Высокий разброс». */
  thresholds: CompareThresholds;
}) {
  const { position, spread, spreadTag } = row;

  /* Меньше двух расценок — прочерк, а не ноль: ноль означал бы согласие. У
     единственного КП подпись говорит, почему числа нет. */
  if (position.removed || spread === null || spreadTag === null) {
    return (
      <td className={cx(tableCell.numeric, tableCell.muted)}>
        <span className={s.dash}>—</span>
        {!position.removed && row.bids.length === 1 ? (
          <span className={tableCell.sub}>одно КП</span>
        ) : null}
      </td>
    );
  }

  const hot = spreadTag === 'high'
    ? (
      <button
        type="button"
        className={s.spreadMark}
        aria-label="Высокий разброс"
        {...bind({
          tone: 'danger',
          title: 'Высокий разброс',
          fields: [{ label: 'Разброс строки', value: `${decimal(spread)} %`, tone: true }],
          note: `Цены КП расходятся на ${decimal(thresholds.spreadHigh)} % и больше — сверяйте состав объёма, прежде чем сравнивать итоги.`,
        })}
      >
        <SpreadMark />
      </button>
    )
    : null;

  return (
    <td className={cx(tableCell.numeric, SPREAD_TONE[spreadTag])}>
      {decimal(spread)} %
      {hot}
      {/* Микрошкала ОБЩАЯ для всех строк (высокий ярус = вся длина) —
          сравнивать бары между строками можно только на одной шкале. */}
      <span className={s.spreadBar} aria-hidden="true">
        <i style={{ width: `${Math.min((spread / thresholds.spreadHigh) * 100, 100)}%` }} />
      </span>
    </td>
  );
}
