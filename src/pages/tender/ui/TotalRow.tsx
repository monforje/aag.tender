import { cx } from '@/shared/lib/cx';
import {
  cellMark, money, type Bid, type CompareMetricId, type RowFacts,
} from '@/entities/comparison';
import { tableCell } from '@/shared/ui/Table';
import s from './TenderCompare.module.css';

/**
 * Строка итога сравнения: подытог раздела или итог всей таблицы.
 *
 * КОГДА:  закрывает каждый раздел в виде «По разделам» и весь срез внизу
 *         таблицы (<TenderCompare>).
 * НЕ ДЛЯ: итога карточки подрядчика (сумма КП живёт на <ContractorCard>) —
 *         здесь сводка ПО СТРОКАМ таблицы.
 *
 * UX:     ПОДЫТОГ УЗЛА СООТВЕТСТВУЕТ СЕЛЕКТУ (модель ячейки §4): Σ стоимостей
 *         либо Σ потенциалов — иначе строка итога спорила бы с числами над ней.
 *         Считается по ВСЕМ позициям узла: фильтр меняет состав видимых строк,
 *         но не суммы — одно число на итог, второе «по фильтру» из модели
 *         вынесено (решение владельца 22.08.2026). Подытог раздела и итог
 *         таблицы считают одинаково — два итого на одном экране спорить не
 *         имеют права. Просто «Итого»: раздел назван строкой выше — повторять
 *         его имя значит заставить прочитать его дважды.
 * A11Y:   пустой счёт читается тире, а не нулём — ноль означал бы согласие.
 *
 * @example
 * <TotalRow label="Итого" rows={groupRows} bids={bids} metric={view.mainMetric} />
 */
export function TotalRow({ label, rows, bids, metric }: {
  label: string;
  /** Все позиции узла (или всей сметы) — независимо от активных фильтров. */
  rows: RowFacts[];
  bids: Bid[];
  metric: CompareMetricId;
}) {
  return (
    <tr className={s.totalRow}>
      {/* Подпись занимает ТОЛЬКО колонку-якорь, а не colSpan={4} на весь левый
          блок. Липкая первая ячейка (<Table stickyCol>) застывает во всю свою
          ширину: на четырёх колонках она накрывала 533px вместо 270 и
          прокрученной строкой съедала итог первого подрядчика. Пустые
          колонки объёма добираются отдельным colSpan={3}. */}
      <th scope="row" className={s.totalLabel}>{label}</th>
      <td colSpan={3} />
      {bids.map((bid) => {
        const sum = rows.reduce(
          (acc, r) => acc + cellValue(bid.contractor, r, metric),
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

/** Значение одной пары работа × подрядчик в деньгах выбранного режима:
 *  стоимость — расценка × общий объём; потенциал — заявленный запас за
 *  единицу × объём (источника запаса нет — вклада в Σ потенциалов нет). */
function cellValue(contractor: Bid['contractor'], row: RowFacts, metric: CompareMetricId): number {
  if (metric === 'potential') {
    return (cellMark(contractor, row.position.id).potential ?? 0) * row.position.qty;
  }
  return (contractor.prices[row.position.id] ?? 0) * row.position.qty;
}
