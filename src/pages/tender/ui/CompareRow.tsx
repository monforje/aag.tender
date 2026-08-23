import { cx } from '@/shared/lib/cx';
import {
  decimal, money, type Bid, type CompareThresholds, type CompareView, type RowFacts,
} from '@/entities/comparison';
import type { CellPopupBind } from '@/shared/ui/CellPopup';
import { tableCell } from '@/shared/ui/Table';
import { BidCell } from './BidCell';
import { KeyMark } from './assets';
import { SpreadCell } from './SpreadCell';
import s from './TenderCompare.module.css';

/**
 * Строка позиции в таблице сравнения: имя (+ключ, снятие), объём
 * (+корректировка), единица, разброс и ячейки КП с пометками.
 *
 * КОГДА:  и в виде «По разделам», и в плоских видах «По весу»/«По потенциалу»
 *         — строку собирает <TenderCompare>.
 * НЕ ДЛЯ: строки реестра тендеров (см. TenderRegistryPage) и шапки колонки
 *         (см. ContractorCard).
 *
 * UX:     Колонка-якорь держит единый левый край всех строк: ключ стоит В
 *         ПРАВОЙ части имени. Снятая позиция остаётся строкой DOM — это
 *         история сметы: название зачёркнуто, капсула «снята» рядом.
 *         Корректировка объёма — парой значений: старое зачёркнуто третичным,
 *         новое рядом; молчаливая подмена врала бы истории сметы.
 *         Доля веса живёт там, где по ней и отсортировано (вид «По весу»),
 *         шкала общая для всех строк (Σ веса = 100 %), иначе бары несравнимы.
 *         focused — подсветка «текущей строки» из панели «Анализа» (рецепт 2
 *         каталога): тот же канал, что и у прочих текущих состояний, — фон
 *         ступенью выше hover, без цвета и жирности.
 * A11Y:   у ключа нет видимой подписи — имя даёт aria-label; нативная
 *         подсказка (title) не ставится, чтобы не спорить с попапом, который
 *         объясняет ту же пометку подробнее.
 *
 * @example
 * <CompareRow row={row} view={view} bids={bids} sumWeight={facts.sumWeight}
 *             bind={popup.bind} focused={focusRowId === row.position.id} />
 */
export function CompareRow({ row, view, thresholds, bids, sumWeight, bind, focused, noteFor, flashCells }: {
  row: RowFacts;
  view: CompareView;
  /** Пороги тендера: метки разброса и аномальность делят их с фильтрами. */
  thresholds: CompareThresholds;
  bids: Bid[];
  sumWeight: number;
  bind: CellPopupBind;
  /** Подсвечена карточкой «Анализа»; клик по таблице снимает (<TenderCompare>). */
  focused: boolean;
  /** Комментарии разбора по ячейкам: `${contractorId}:${positionId}` → фраза.
   *  Пусто до запуска анализа (Р4). */
  noteFor?: (contractorId: string, positionId: string) => string | undefined;
  /** Ячейки с обводкой перехода: ключи тех же пар. Живут ~5 секунд. */
  flashCells?: ReadonlySet<string>;
}) {
  const { position } = row;
  const removed = position.removed === true;
  const share = sumWeight ? (row.weight / sumWeight) * 100 : 0;
  const noteOf = (contractorId: string) => noteFor?.(contractorId, position.id);
  const flashOf = (contractorId: string) => !!flashCells?.has(`${contractorId}:${position.id}`);

  return (
    <tr
      data-row-id={position.id}
      className={cx(removed && s.rowRemoved, focused && s.rowFocused)}
    >
      {/* Колонка-якорь: title обязателен — ширина задана контрактом, длинное
          название уходит в многоточие, и прочитать его целиком должно чем. */}
      <td className={tableCell.strong} title={position.title}>
        {removed ? <s>{position.title}</s> : position.title}

        {/* Ключ — в ПРАВОЙ части имени: левый край всех строк остаётся единым.
            Без title: нативная подсказка спорила бы с попапом; словарь пометки
            живёт в легенде, комментарий разбора приходит в попап после запуска. */}
        {!removed && position.key ? (
          <button
            type="button"
            className={s.keyMark}
            aria-label="Ключевая позиция"
            {...bind({
              tone: 'warning',
              title: 'Ключевая позиция',
              fields: [{ label: 'Вес строки', value: money(row.weight) }],
            })}
          >
            <KeyMark />
          </button>
        ) : null}

        {removed ? <span className={s.chip}>снята</span> : null}
        {removed ? <span className={tableCell.sub}>позиция снята из сметы</span> : null}

        {/* Доля веса живёт там, где по ней и отсортировано, — иначе шум. Шкала
            общая для всех строк (Σ веса = 100 %), иначе бары несравнимы. */}
        {view.rowView === 'weight' && !removed ? (
          <span className={tableCell.sub}>
            <span className={s.share} aria-hidden="true"><i style={{ width: `${share}%` }} /></span>
            {decimal(share)} % веса среза
          </span>
        ) : null}
      </td>

      {/* Корректировка объёма — парой значений: старое зачёркнуто третичным,
          новое рядом. Молчаливая подмена врала бы историю сметы. */}
      <td className={tableCell.numeric}>
        {removed ? (
          <span className={s.dash}>—</span>
        ) : position.qtyOrig ? (
          <span title="Объём скорректирован после публикации сметы">
            <s>{decimal(position.qtyOrig)}</s> → {decimal(position.qty)}
          </span>
        ) : (
          decimal(position.qty)
        )}
      </td>
      <td className={tableCell.muted}>{removed ? '—' : position.unit}</td>

      <SpreadCell row={row} bind={bind} thresholds={thresholds} />

      {bids.map((bid) => (
        <BidCell
          key={bid.contractor.id}
          row={row}
          contractor={bid.contractor}
          view={view}
          thresholds={thresholds}
          bind={bind}
          note={noteOf(bid.contractor.id)}
          flash={flashOf(bid.contractor.id)}
        />
      ))}
    </tr>
  );
}
