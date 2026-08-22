import { cx } from '@/shared/lib/cx';
import { money, type Bid, type RowFacts } from '@/entities/tender';
import { tableCell } from '@/shared/ui/Table';
import s from './TenderCompare.module.css';

/**
 * Строка итога сравнения: и подытог раздела, и итог по срезу.
 *
 * КОГДА:  закрывает каждый раздел в виде «По разделам» и весь срез внизу
 *         таблицы (<TenderCompare>).
 * НЕ ДЛЯ: итога карточки подрядчика (сумма КП живёт на <ContractorCard>) и
 *         «Итого» сметы вне среза — здесь считается ТОЛЬКО видимое.
 *
 * UX:     один счёт из переданных строк, то есть видимых: визуальная
 *         фильтрация с неизменным итогом — это враньё в подытоге (§0 аудита).
 *         Подытог раздела и итог среза обязаны считать одинаково — два итогоа
 *         на одном экране спорить не имеют права. Просто «Итого»: раздел назван
 *         строкой выше — повторять его имя значит заставить прочитать его
 *         дважды.
 * A11Y:   пустой счёт читается тире, а не нулём — ноль означал бы согласие.
 *
 * @example
 * <TotalRow label="Итого" rows={rows} bids={bids} />
 */
export function TotalRow({ label, rows, bids }: {
  label: string;
  /** Строки, ВОШЕДШИЕ в срез после фильтров; суммы складываются только из них. */
  rows: RowFacts[];
  bids: Bid[];
}) {
  return (
    <tr className={s.totalRow}>
      <td colSpan={4} className={s.totalLabel}>{label}</td>
      {bids.map((bid) => {
        const sum = rows.reduce(
          (acc, r) => acc + (bid.contractor.prices[r.position.id] ?? 0) * r.position.qty,
          0,
        );
        return (
          <td key={bid.contractor.id} className={cx(tableCell.numeric, tableCell.roomy, s.totalValue)}>
            {sum ? money(sum) : '—'}
          </td>
        );
      })}
    </tr>
  );
}
