import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import { isoLocal } from '@/shared/lib/date';
import { Icon } from '@/shared/ui/Icon';
import { Popover } from '@/shared/ui/Popover';
import s from './Calendar.module.css';

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
/* Только месяц: год приписываем сами. Формат {month,year} у ru-локали даёт
   «август 2026 г.» — этот хвост «г.» в шапке месяца лишний. */
const MONTH_NAME = new Intl.DateTimeFormat('ru-RU', { month: 'long' });
/* ПОЛНЫЕ имена, а не {month:'short'} как у shadcn. Короткие в ru-локали дают
   «янв.», «авг.», «сент.» — разной длины и с точкой на конце; в шапке это
   читается как обрубок, и именно это делало её похожей на форму из нулевых.
   Место под полное имя есть: панель 248px, а самое длинное — «сентябрь». */
const MONTHS = Array.from(
  { length: 12 },
  (_, m) => MONTH_NAME.format(new Date(2000, m, 1)),
);

/** Годы для списка: десятилетие в обе стороны плюс сам показанный год, если он
 *  вне этого окна — иначе <select> остался бы без текущего значения и показал
 *  бы пустоту. */
function yearOptions(year: number): number[] {
  const now = new Date().getFullYear();
  const lo = Math.min(now - 10, year);
  const hi = Math.max(now + 10, year);
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

/** Шесть недель по семь дней, от понедельника, с хвостами соседних месяцев.
 *  Шесть строк ВСЕГДА: иначе высота панели скачет при листании и всё, что
 *  ниже, прыгает под курсором. */
export function weeks(view: Date): Date[][] {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7)); // getDay(): вс=0, а неделя с пн
  return Array.from({ length: 6 }, (_, week) => Array.from({ length: 7 }, (_, day) => {
    const d = new Date(start);
    d.setDate(start.getDate() + week * 7 + day);
    return d;
  }));
}

/** Состояние одного дня глазами потребителя.
 *
 *  ФОН КНОПКИ ЗАДАЁТСЯ ФЛАГАМИ, А НЕ КЛАССОМ СНАРУЖИ, и это не вкусовщина:
 *  правила `.day-btn--today` и «выбранный день» — оба одиночные классы, то
 *  есть одной специфичности. Приехал бы класс из чужого модуля — спор решал бы
 *  ПОРЯДОК ФАЙЛОВ В БАНДЛЕ, а не порядок в cx(). Поэтому все фоны кнопки
 *  объявлены в одном файле подряд, где порядок виден глазами.
 *
 *  Классом снаружи приходит только подложка ЯЧЕЙКИ (td): там потребитель
 *  единственный хозяин, спорить не с кем. */
export interface DayState {
  /** Классы на ЯЧЕЙКЕ — на ней рисуют полосу диапазона. */
  td?: string;
  /** Выбранный день: тёмная пилюля и aria-pressed. */
  selected?: boolean;
  /** Кнопка без собственного фона — чтобы сквозь неё была видна подложка
   *  ячейки (середина диапазона). Гасит в том числе заливку «сегодня». */
  plain?: boolean;
}

/**
 * Один месяц: шапка с листалкой и сетка дней. Геометрия — shadcn/ui <Calendar>.
 *
 * КОГДА:  любой выбор даты мышью. Из него собраны <DatePicker> (одна дата) и
 *         <RangeCalendar> (период) — оба берут ЭТУ сетку, а не свою копию.
 * НЕ ДЛЯ: самостоятельного показа в интерфейсе: это деталь, у неё нет ни
 *         поповера, ни значения. Ставить прямо на страницу — брать
 *         <DatePicker>. И не для ВВОДА даты с клавиатуры: поле рядом с
 *         сеткой — забота потребителя, здесь только сетка.
 *
 * UX:     шесть строк недель всегда, даже когда месяц укладывается в пять:
 *         иначе панель меняет высоту при листании и содержимое под ней
 *         прыгает под курсором. Дни соседних месяцев показываются и остаются
 *         кликабельными (showOutsideDays у shadcn), но приглушены.
 *         Месяц и год — НАТИВНЫЕ <select> с нулевой прозрачностью поверх
 *         своей подписи (приём shadcn captionLayout="dropdown"): список
 *         открывает браузер, поэтому клавиатура, поиск набором и мобильное
 *         колесо достаются даром. Без них до марта позапрошлого года нужно
 *         двадцать девять нажатий на стрелку.
 * A11Y:   настоящая <table> с <th> дней недели. ←↑→↓ водят фокус по дням:
 *         кнопки идут строго подряд по датам, поэтому ±1 — соседний день,
 *         ±7 — та же неделя, и переход через границу месяца получается сам.
 *         Выбранные дни несут aria-pressed: что считать выбранным, знает
 *         потребитель (DayState.selected), а как это выглядит — сетка.
 *
 * @example
 * <CalendarMonth month={view} onMonth={setView} onPick={setValue}
 *   dayState={(iso) => ({ selected: iso === value })} />
 */
export function CalendarMonth({
  month, onMonth, onPick, dayState, onHoverDay, onLeave, footer, className,
}: {
  month: Date;
  onMonth: (next: Date) => void;
  onPick: (iso: string) => void;
  dayState?: (iso: string, date: Date) => DayState | undefined;
  onHoverDay?: (iso: string) => void;
  onLeave?: () => void;
  /** Довесок под сеткой — например «Сегодня». Своего у месяца нет. */
  footer?: ReactNode;
  className?: string;
}) {
  const today = isoLocal(new Date());

  /** Стрелки водят фокус по дням. Работает на всём месяце, а не на сетке:
   *  так же ловятся нажатия, когда фокус пришёл с кнопки листания. */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!step) return;
    const days = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-day]')];
    const at = days.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    e.preventDefault();
    days[Math.min(Math.max(at + step, 0), days.length - 1)]?.focus();
  };

  const shift = (by: number) => onMonth(new Date(month.getFullYear(), month.getMonth() + by, 1));

  return (
    <div className={cx(s.month, className)} onKeyDown={onKeyDown}>
      <div className={s.monthCaption}>
        <button
          type="button"
          className={cx(s.nav, s.navPrev)}
          aria-label={`Предыдущий месяц, ${MONTH_NAME.format(month)}`}
          onClick={() => shift(-1)}
        >
          <Icon name="chevronDown" />
        </button>

        <div className={s.dropdowns}>
          <CaptionSelect
            label="Месяц"
            value={month.getMonth()}
            options={MONTHS.map((name, m) => ({ value: m, label: name }))}
            onChange={(m) => onMonth(new Date(month.getFullYear(), m, 1))}
          />
          <CaptionSelect
            label="Год"
            value={month.getFullYear()}
            options={yearOptions(month.getFullYear()).map((y) => ({ value: y, label: String(y) }))}
            onChange={(y) => onMonth(new Date(y, month.getMonth(), 1))}
            /* СЕТКОЙ, а не списком. Годов двадцать один, и колонкой они
               требовали прокрутки: чтобы увидеть соседнее десятилетие, надо
               было крутить — при том что вся задача «ткнуть в нужный год»
               решается одним взглядом, если десятилетие видно целиком.
               Месяцам сетка не нужна: двенадцать имён разной длины в колонке
               читаются как список, а в клетках — как таблица без смысла. */
            columns={3}
          />
        </div>

        <button
          type="button"
          className={cx(s.nav, s.navNext)}
          aria-label={`Следующий месяц, ${MONTH_NAME.format(month)}`}
          onClick={() => shift(1)}
        >
          <Icon name="chevronDown" />
        </button>
      </div>

      <table className={s.monthGrid}>
        <thead>
          <tr className={s.weekdays}>
            {WEEKDAYS.map((w) => <th key={w} scope="col" className={s.weekday}>{w}</th>)}
          </tr>
        </thead>
        <tbody onMouseLeave={onLeave}>
          {weeks(month).map((week) => (
            <tr key={isoLocal(week[0])} className={s.week}>
              {week.map((date) => {
                const iso = isoLocal(date);
                const state = dayState?.(iso, date);
                return (
                  <td key={iso} className={cx(s.day, state?.td)}>
                    <button
                      type="button"
                      data-day={iso}
                      aria-pressed={state?.selected}
                      className={cx(
                        s.dayBtn,
                        date.getMonth() !== month.getMonth() && s.dayBtnOutside,
                        iso === today && s.dayBtnToday,
                        state?.plain && s.dayBtnPlain,
                        state?.selected && s.dayBtnSelected,
                      )}
                      onMouseEnter={onHoverDay ? () => onHoverDay(iso) : undefined}
                      onClick={() => onPick(iso)}
                    >
                      {date.getDate()}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {footer}
    </div>
  );
}

/** Выбор месяца или года в шапке.
 *
 *  ЗДЕСЬ БЫЛ НАТИВНЫЙ <select> — приём shadcn captionLayout="dropdown":
 *  прозрачный <select> поверх своей подписи. Он давал даром клавиатуру, поиск
 *  набором и мобильное колесо, но у него есть неустранимое: РАСКРЫТЫЙ СПИСОК
 *  РИСУЕТ ОПЕРАЦИОННАЯ СИСТЕМА. Внутри аккуратной панели открывалось системное
 *  меню чужой эпохи, и никаким CSS это не лечится — стилизовать <option>
 *  браузеры не дают. Поэтому список теперь наш.
 *
 *  Панель — <Popover>, а не своя коробка: у него верхний слой, Escape, клик
 *  мимо и возврат фокуса уже от платформы (правило CLAUDE.md — выпадашка это
 *  нативный <dialog>). Список внутри обязан выходить за пределы календаря, и
 *  обрезка родителем к z-index отношения не имеет.
 *
 *  Что потеряли вместе с <select> и чем закрыли: поиск набором — ничем (у
 *  двенадцати месяцев он не нужен); клавиатуру — ←↑→↓ и Enter ниже; мобильное
 *  колесо — списком с прокруткой, у которого выбранный пункт подкручен в
 *  видимую часть при открытии. */
function CaptionSelect<T extends number>({ label, value, options, onChange, columns = 1 }: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  /** 1 — колонка (месяцы), больше — сетка (годы). Ширину панели задаёт он же:
   *  отдельным числом она жила бы рядом с раскладкой, но не вместе с ней. */
  columns?: number;
}) {
  const [at, setAt] = useState<DOMRect | null>(null);
  const list = useRef<HTMLDivElement>(null);

  /* Выбранный пункт — в видимую часть, до отрисовки: год может быть двадцатым
     в списке, и открывать его прокрученным в начало значит показывать не то,
     что выбрано. */
  useLayoutEffect(() => {
    if (!at) return;
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' });
  }, [at]);

  /** Стрелки водят фокус по пунктам, Enter выбирает. Escape и клик мимо — у
   *  <Popover> от платформы, дублировать их здесь нечем и незачем.
   *
   *  Шаг вверх-вниз равен ЧИСЛУ КОЛОНОК, а не единице: в сетке лет под «2026»
   *  лежит «2029», и стрелка вниз обязана вести туда, куда показывает. В
   *  колонке columns=1, и та же формула даёт обычный шаг. */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = {
      ArrowUp: -columns, ArrowDown: columns,
      ArrowLeft: -1, ArrowRight: 1,
      Home: -Infinity, End: Infinity,
    }[e.key];
    if (step === undefined) return;
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role=option]')];
    const now = items.indexOf(document.activeElement as HTMLElement);
    e.preventDefault();
    const next = step === -Infinity ? 0
      : step === Infinity ? items.length - 1
        : Math.min(Math.max((now < 0 ? 0 : now) + step, 0), items.length - 1);
    items[next]?.focus();
  };

  return (
    <>
      <button
        type="button"
        className={s.captionSelect}
        aria-haspopup="listbox"
        aria-expanded={Boolean(at)}
        aria-label={label}
        onClick={(e) => setAt(at ? null : e.currentTarget.getBoundingClientRect())}
      >
        {options.find((o) => o.value === value)?.label}
        <Icon name="chevronDown" className={s.captionChevron} />
      </button>

      {/* Ширина панели приходит КЛАССОМ, а не переменной на списке внутри:
          --pop-width читает сам <dialog>, а кастомные свойства наследуются
          вниз по DOM — с потомка родителю их не передать. Замер до правки:
          панель годов вставала в 150px вместо 188. */}
      <Popover
        anchor={at}
        onClose={() => setAt(null)}
        label={label}
        className={cx(s.captionPop, columns > 1 && s.captionPopGrid)}
      >
        <div
          className={cx(s.optionList, columns > 1 && s.optionListGrid)}
          ref={list}
          role="listbox"
          aria-label={label}
          style={{ '--option-columns': columns } as React.CSSProperties}
          onKeyDown={onKeyDown}
        >
          {options.map((o) => (
            <div
              key={o.value}
              role="option"
              tabIndex={-1}
              aria-selected={o.value === value}
              className={s.option}
              onClick={() => { onChange(o.value); setAt(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(o.value); setAt(null); } }}
            >
              {o.label}
            </div>
          ))}
        </div>
      </Popover>
    </>
  );
}
