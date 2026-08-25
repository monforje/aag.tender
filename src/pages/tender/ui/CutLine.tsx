import { cx } from '@/shared/lib/cx';
import { decimal } from '@/entities/comparison';
import { Icon } from '@/shared/ui/Icon';
import { plural } from '@/shared/lib/plural';
import s from './TenderCompare.module.css';

/**
 * Линия отсечки набора и сворачиваемый хвост под ней (§1.3, `rows.md` §2,
 * `sorting.md` §3).
 *
 * КОГДА:  в плоских видах — «По весу» (порог ключевых) и «По разбросу»
 *         (порог высокого). Ровно две строки таблицы: сама линия с подписью
 *         охвата и полоса-переключатель хвоста.
 * НЕ ДЛЯ: вида «По разделам» — там границу проводят секции; и не для
 *         подытогов (см. TotalRow).
 *
 * UX:     ЛИНИЯ ПРЕВРАЩАЕТ АБСТРАКТНЫЙ ПОРОГ В ВИДИМУЮ ГРАНИЦУ «здесь
 *         кончается то, чем торгуются». Без неё пресет «Обзор → вес»
 *         показывает 65 равноправных строк, и ключевую долю специалист
 *         выделяет пальцем по экрану. НОВЫХ ПОРОГОВ НЕТ: линия стоит там же,
 *         где фильтр «Ключевые» и где превью состава в окне параметров —
 *         три места, одно число.
 *         ПОДПИСЬ НАЗЫВАЕТ ФАКТИЧЕСКИЙ ОХВАТ («3 позиции · 95 % стоимости»),
 *         а не порог: набор собирается ДО первого пересечения порога и почти
 *         всегда чуть больше него. Сказать «80 %» там, где лежит 95, значит
 *         соврать в ту единственную цифру, ради которой линию и читают.
 *         ХВОСТ РАСКРЫВАЕТСЯ МГНОВЕННО — каталог состояний запрещает
 *         анимировать раскрытие дерева; движется только шеврон (рецепт 11,
 *         поворот глифа на месте). Нумерация в хвосте ПРОДОЛЖАЕТСЯ: это те же
 *         строки той же сметы, а не второй список.
 * A11Y:   полоса хвоста — кнопка с aria-expanded и именем, называющим объём
 *         скрытого; линия — строка-подпись, из обхода не выпадает.
 *
 * @example
 * <CutLine label="линия ключевых" rows={9} share={95} span={5} />
 * <TailRow open={open} count={56} share={19} span={5} onToggle={…} />
 */
export function CutLine({ label, rows, share, span }: {
  label: string;
  rows: number;
  share: number;
  /** Сколько колонок накрыть: левый блок + все КП. */
  span: number;
}) {
  return (
    <tr className={s.cutLine}>
      <td colSpan={span}>
        <span className={s.cutCap}>
          {label} · {rows} {plural(rows, 'позиция', 'позиции', 'позиций')} · {decimal(share)} % стоимости
        </span>
      </td>
    </tr>
  );
}

export function TailRow({ open, count, share, span, onToggle, reason }: {
  open: boolean;
  count: number;
  /** Доля стоимости хвоста. Не задана — хвост собран не по весу (сортировка
   *  по разбросу), и доля к нему отношения не имеет. */
  share?: number;
  span: number;
  onToggle: () => void;
  /** Причина, по которой строки в хвосте, — для группы «без разброса»
   *  (§1.5): отсутствие значения это не «значение 0». */
  reason?: string;
}) {
  return (
    <tr className={s.tailRow}>
      <td colSpan={span}>
        <button
          type="button"
          className={s.tailToggle}
          aria-expanded={open}
          onClick={onToggle}
        >
          <span className={cx(s.tailChev, open && s.isOn)} aria-hidden="true">
            <Icon name="chevronDown" />
          </span>
          {reason ?? `остальные ${count} ${plural(count, 'позиция', 'позиции', 'позиций')}`}
          {share !== undefined ? ` · ${decimal(share)} % стоимости` : null}
        </button>
      </td>
    </tr>
  );
}
