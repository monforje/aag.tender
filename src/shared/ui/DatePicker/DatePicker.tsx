import { useEffect, useRef, useState } from 'react';
import { cx } from '@/shared/lib/cx';
import { isoLocal, isoToDmy, startOfMonth } from '@/shared/lib/date';
import { CalendarMonth } from '@/shared/ui/Calendar';
import s from './DatePicker.module.css';

/**
 * Выбор ОДНОЙ даты: кнопка со значением, под ней календарь в поповере.
 *
 * КОГДА:  дату задают в форме, карточке, фильтре по одному дню. Значение — в
 *         ГГГГ-ММ-ДД: такие строки сравниваются как строки (shared/lib/date).
 * НЕ ДЛЯ: периода — см. <RangeCalendar>: там две независимые границы, поля
 *         ввода и два месяца сразу. И не для ПОКАЗА даты без права её менять:
 *         неизменяемой дате хватит текста, а кнопка обещает диалог.
 *
 * UX:     раскладка shadcn/ui Date Picker: <Button variant="outline"> с датой
 *         и глифом календаря, под ним <Popover> с <Calendar>. Отличие одно и
 *         намеренное — ГЛИФ СТОИТ СРАЗУ ЗА ДАТОЙ, а не прижат к дальнему краю.
 *         У shadcn кнопка фиксированной ширины (w-[240px]) и глиф стоит
 *         слева; растянутая на всю колонку кнопка уносит его от значения на
 *         пол-экрана, и связь «этот значок открывает этот календарь»
 *         теряется. Поэтому ширина у кнопки по содержимому.
 *
 *         Нативный <input type="date"> проиграл ему в двух вещах: его попап
 *         рисует браузер (в интерфейс не вписывается и не настраивается), а
 *         формат показа берётся из локали БРАУЗЕРА — на en-US тот же день
 *         выглядит как 07/15/2026. Здесь формат наш, ДД.ММ.ГГГГ, всегда.
 *
 *         Выбор дня ЗАКРЫВАЕТ поповер: у одиночной даты после клика делать в
 *         календаре нечего (в отличие от периода, где ждут вторую границу).
 *         Escape закрывает без выбора, клик мимо — тоже.
 * A11Y:   кнопка несёт aria-haspopup и aria-expanded, поэтому читается как
 *         то, что раскроется, а не как ссылка. Пустое значение озвучивается
 *         подписью-плейсхолдером, а не тишиной. Фокус после закрытия
 *         возвращается на кнопку — иначе он улетает в начало страницы.
 *
 * @example
 * <DatePicker value={iso} onChange={setIso} label="Срок сбора КП" />
 */
export function DatePicker({ value, onChange, label, placeholder = 'Выберите дату', className }: {
  /** ГГГГ-ММ-ДД либо пусто. */
  value: string;
  onChange: (next: string) => void;
  /** Подпись для скринридера: видимая подпись живёт снаружи, у поля. */
  label: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  /** Показанный месяц. Открывается на месяце значения, а пустое поле — на
   *  текущем: листать из января 1970 никто не должен. */
  const [view, setView] = useState(() => startOfMonth(value || isoLocal(new Date())));
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  /* Значение могло смениться снаружи (другой тендер, сброс фильтра), пока
     поповер закрыт: месяц обязан переехать за ним, иначе откроется не там. */
  useEffect(() => { if (value) setView(startOfMonth(value)); }, [value]);

  /* Клик мимо и Escape. Подписка живёт только пока открыто — постоянный
     слушатель на document ради закрытого меню не нужен (тот же приём, что в
     useDropdownGroup). */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (iso: string) => {
    onChange(iso);
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div className={cx(s.dp, className)} ref={root}>
      <button
        type="button"
        ref={trigger}
        className={cx('inline-edit', s.trigger, !value && s.triggerEmpty)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={value ? `${label}: ${isoToDmy(value)}` : label}
        onClick={() => setOpen((v) => !v)}
      >
        {value ? isoToDmy(value) : placeholder}
      </button>

      {open ? (
        <div className={s.popover} role="dialog" aria-label={label}>
          <CalendarMonth
            month={view}
            onMonth={setView}
            onPick={pick}
            dayState={(iso) => ({ selected: iso === value })}
          />
        </div>
      ) : null}
    </div>
  );
}
