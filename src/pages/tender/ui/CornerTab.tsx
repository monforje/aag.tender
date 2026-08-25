import { useRef, useState, type ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import { Icon } from '@/shared/ui/Icon';
import type { ColumnMarks, MarkKind } from '../model/compareFormat';
import { AnomalyGlyph, CorrectionMark } from './assets';
import s from './TenderCompare.module.css';

/** Сколько ждать после ухода курсора, мс. Мост между кнопкой и панелью: чтобы
 *  дойти до строк, курсор пересекает зазор, и мгновенное закрытие делало бы
 *  панель недостижимой. Число то же, что у моста <CellPopup>. */
const HIDE_DELAY = 120;

/**
 * Пометки колонки подрядчика: кнопка в подвале карточки и перечень под ней.
 * Каждая строка перечня — ПОДСВЕТКА своих ячеек в таблице.
 *
 * КОГДА:  подвал <ContractorCard>, первым элементом строки статуса.
 * НЕ ДЛЯ: пометок ОДНОЙ ячейки (их объясняет попап таблицы) и досье
 *         подрядчика (см. DossierModal — там реквизиты, а не разметка цен).
 *
 * UX:     ПЕРЕЧЕНЬ, А НЕ РОССЫПЬ КАПСУЛ. Строка — «глиф · название · число»,
 *         кегль 13px, тот же, что у названий позиций: слот глифа держит
 *         ширину и у пометок без значка, поэтому названия стоят одной левой
 *         линией, а числа одним столбиком. Капсулы разной длины не давали ни
 *         того, ни другого, и пять пометок читались облаком.
 *         ВСЯ СТРОКА — КНОПКА, а не подпись со счётчиком (24.08.2026): число
 *         в панели отвечает «сколько», но следующий вопрос всегда «где», и
 *         раньше ответ на него был только у корректировок. Клик подсвечивает
 *         ВСЕ такие ячейки колонки и прокручивает к первой; повторный — к
 *         следующей из подсвеченных: обход делается одной точкой, без списка
 *         (25.08.2026).
 *         ОТКРЫВАЕТСЯ НАВЕДЕНИЕМ И ФОКУСОМ, закрывается уходом с задержкой:
 *         это СПРАВКА о колонке, а не действие над ней, и требовать клик ради
 *         «посмотреть» здесь незачем. Клик всё же обрабатывается — для тача,
 *         где наведения не бывает.
 *         ПАНЕЛЬ — ОБЫЧНЫЙ БЛОК В КАРТОЧКЕ, а не <Popover>: тот открывается
 *         через showModal(), то есть с подложкой и захватом фокуса, и на
 *         наведении это была бы модалка, мигающая при каждом проходе курсора
 *         по шапке. Карточка стоит в липкой шапке (z-index 5), панель растёт
 *         ВНИЗ, поверх строк — обрезать её нечем.
 *         ПУСТО — ГОВОРИТСЯ СЛОВАМИ: пустая панель читалась бы сбоем.
 * A11Y:   кнопка с aria-expanded, цель 26×26 (минимум WCAG 2.2). Нативного
 *         title у неё НЕТ: подсказку рисует ОС, приезжает она с задержкой и
 *         спорит с собственной панелью, которая открывается тем же
 *         наведением и говорит больше. Имя кнопки даёт aria-label. У каждой
 *         строки перечня своё имя с подрядчиком, пометкой и числом — списком
 *         кнопок её и обходят. Панель раскрыта и по :focus-within, поэтому в
 *         неё можно войти табом.
 *
 * @example
 * <CornerTab name={contractor.name} marks={marks} onGoToMark={goTo} />
 */
export function CornerTab({ name, marks, onGoToMark }: {
  /** Имя подрядчика — уходит в доступные имена кнопки и строк перечня. */
  name: string;
  marks: ColumnMarks;
  /** Подсветить все ячейки колонки с этой пометкой и прийти к первой. */
  onGoToMark: (kind: MarkKind) => void;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const show = () => { window.clearTimeout(timer.current); setOpen(true); };
  const hide = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), HIDE_DELAY);
  };

  const row = (kind: MarkKind, label: string, glyph?: ReactNode) => (marks[kind] ? (
    <button
      type="button"
      className={s.mark}
      aria-label={`${name}: ${label} — ${marks[kind]}. Подсветить все такие ячейки`}
      onClick={() => onGoToMark(kind)}
    >
      <span className={s.markGlyph}>{glyph}</span>
      <span className={s.markLabel}>{label}</span>
      <b className={s.markCount}>{marks[kind]}</b>
    </button>
  ) : null);

  return (
    <span
      className={s.corner}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <button
        type="button"
        className={cx(s.cardAct, s.cornerTab, open && s.isOn)}
        aria-expanded={open}
        aria-label={`Пометки колонки «${name}»`}
        onClick={() => setOpen((on) => !on)}
      >
        {/* НЕ `checklistMin` (правка владельца 25.08.2026): чеклист обещает
            список дел с галочками, а под кнопкой лежит перечень ПРИЗНАКОВ
            колонки — отмечать в нём нечего. Лист с пометками говорит ровно
            то, что есть. */}
        <Icon name="notes" />
      </button>

      <span className={cx(s.cornerPanel, open && s.isOn)} role="group" aria-label={`Пометки: ${name}`}>
        {marks.any ? (
          <>
            {/* У минимума глифа нет — он сам штамп, тот же, что в углу ячейки;
                в слот глифа он и встаёт. */}
            {row('min', 'лучшая цена', <b className={s.markStamp}>МИН</b>)}
            {row('anomaly', 'аномалия', <AnomalyGlyph />)}
            {row('correction', 'иной объём', <CorrectionMark />)}
            {/* «Нет цены» и «отказ» рисует не значок, а сама ячейка — пустой
                слот честнее выдуманного глифа и держит ту же левую линию. */}
            {row('missing', 'нет цены')}
            {row('declined', 'отказ')}
          </>
        ) : (
          <span className={s.cornerEmpty}>Пометок в колонке нет</span>
        )}
      </span>
    </span>
  );
}
