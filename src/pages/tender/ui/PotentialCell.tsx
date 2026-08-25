import { cx } from '@/shared/lib/cx';
import { decimal, money, moneyCompact, type RowFacts } from '@/entities/comparison';
import type { CellPopupBind } from '@/shared/ui/CellPopup';
import { tableCell } from '@/shared/ui/Table';
import s from './TenderCompare.module.css';

/**
 * Ячейка условного столбца «Потенциал» — строчный запас торга числом.
 *
 * КОГДА:  пятая колонка левой зоны, по галочке «Потенциал» (§1.6,
 *         `potential.md`). Сортировка «По потенциалу» включает эту галочку и
 *         не выключает её ни одна: канон прямо запрещает упорядочивать по
 *         числу, которого нет на экране.
 * НЕ ДЛЯ: потенциала В ЯЧЕЙКЕ подрядчика (там он основной показатель по
 *         селекту, см. BidCell) и суммы запаса по тендеру (шкала в меню
 *         показателя, см. CompareToolbar).
 *
 * UX:     ЧИСЛО — МАКСИМУМ ПО СТРОКЕ, а не сумма: запас заявляют РАЗНЫЕ
 *         подрядчики на одну и ту же работу, и сложить их значило бы обещать
 *         скидку, которую никто не даст. Разбор по наведению отвечает на
 *         следующий вопрос — «за счёт кого он собран и сколько из этого
 *         типично»: перечень поимённо плюс медиана строки как ориентир
 *         реального, а не заявленного.
 *         Запаса нет — прочерк, а не ноль: ноль означал бы «торговаться
 *         не о чем», хотя на деле никто просто не заявлял.
 * A11Y:   число читается текстом; таблички поимённо живут в попапе, который
 *         раскрывается и фокусом.
 *
 * @example
 * <PotentialCell row={row} bind={popup.bind} nameOf={nameOf} sorted />
 */
export function PotentialCell({ row, bind, nameOf, sorted }: {
  row: RowFacts;
  bind: CellPopupBind;
  nameOf: (contractorId: string) => string;
  /** Таблица отсортирована по этому столбцу — ячейка держит тихую заливку
   *  колонки-носителя порядка (стрелка ↓ стоит в заголовке). */
  sorted?: boolean;
}) {
  const { position } = row;

  if (position.removed || !row.maxPot) {
    return (
      <td className={cx(tableCell.numeric, tableCell.muted, sorted && s.colSorted)}>
        <span className={s.dash}>—</span>
      </td>
    );
  }

  return (
    <td
      className={cx(tableCell.numeric, s.potCell, sorted && s.colSorted)}
      {...bind({
        tone: 'info',
        title: `Потенциал строки — ${money(row.maxPot)}`,
        fields: [
          {
            label: 'максимум',
            value: `${nameOf(row.pots[0].contractorId)} · ${money(row.pots[0].value)}`,
            tone: true,
          },
          {
            label: 'типично',
            value: row.median === null
              ? '—'
              : `медиана строки ${money(row.median * position.qty)}`,
          },
          ...row.pots.slice(1, 4).map((p) => ({
            label: nameOf(p.contractorId),
            value: `+${money(p.value)}`,
          })),
        ],
        note: row.pots.length === 1
          ? 'Запас заявил один участник — торг идёт с ним.'
          : `Запас заявили ${row.pots.length} участника: показан максимум, а не сумма — уступит кто-то один.`,
      })}
    >
      {moneyCompact(row.maxPot)}
      <span className={tableCell.sub}>{decimal(row.pots.length)} из {row.bids.length}</span>
    </td>
  );
}
