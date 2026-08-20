import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { cx } from '@/shared/lib/cx';
import { isoLocal, isoToDmy, parseDmy, startOfMonth } from '@/shared/lib/date';
import { Icon } from '@/shared/ui/Icon';
import s from './RangeCalendar.module.css';

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
/* Только месяц: год приписываем сами. Формат {month,year} у ru-локали даёт
   «август 2026 г.» — этот хвост «г.» в шапке месяца лишний. */
const MONTH_NAME = new Intl.DateTimeFormat('ru-RU', { month: 'long' });
/* Короткое имя — для списка месяцев: у shadcn formatMonthDropdown берёт
   {month:'short'} ровно затем, чтобы подпись влезала в ширину месяца. */
const MONTH_SHORT = new Intl.DateTimeFormat('ru-RU', { month: 'short' });
const MONTHS = Array.from({ length: 12 }, (_, m) => MONTH_SHORT.format(new Date(2000, m, 1)));

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
 *  Шесть строк всегда: иначе высота панели скачет при листании и всё, что
 *  ниже, прыгает под курсором. */
function weeks(view: Date): Date[][] {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7)); // getDay(): вс=0, а неделя с пн
  return Array.from({ length: 6 }, (_, week) => Array.from({ length: 7 }, (_, day) => {
    const d = new Date(start);
    d.setDate(start.getDate() + week * 7 + day);
    return d;
  }));
}

/**
 * Календарь диапазона: две границы, каждая правится отдельно — руками или мышью.
 *
 * КОГДА:  период задают в фильтре, отчёте, форме. Значения в ГГГГ-ММ-ДД: их
 *         можно сравнивать как строки (см. shared/lib/date).
 * НЕ ДЛЯ: одиночной даты — там хватит нативного <input type="date"> с его
 *         бесплатной клавиатурой и локалью.
 *
 * UX:     ГРАНИЦЫ НЕЗАВИСИМЫ. Клик правит ТУ границу, за которую взялись
 *         (курсор в поле «с» или «по»), вторая остаётся на месте. Обычная
 *         модель «первый клик — начало, второй — конец» ломается на самом
 *         частом действии: подвинуть у готового периода только конец нельзя,
 *         клик стирает его и начинает диапазон заново. Быстрый путь при этом
 *         сохранён — поставив начало, когда конца ещё нет, очередь сама
 *         переходит к концу, и обычный выбор остаётся в два клика.
 *         Перевёрнутую пару компонент МЕНЯЕТ МЕСТАМИ, а не стирает: и при
 *         клике, и при ручном вводе. Это опечатка в порядке, а не просьба
 *         начать заново.
 *         Какую границу правит клик, показывает РАСКЛАДКА, а не подпись: поле
 *         «от» стоит над левым календарём, «до» — над правым, по их ширине, и
 *         активное подсвечено рамкой. Пояснение словами («клик задаёт конец»)
 *         было ещё одной строкой текста ровно про то, что и так видно.
 *         ДВА МЕСЯЦА, И КАЖДЫЙ ЛИСТАЕТСЯ ОТДЕЛЬНО. У shadcn (и у
 *         react-day-picker под ним) пара связана: стрелка двигает оба окна, и
 *         расстояние между ними навсегда равно единице — «март и декабрь» так
 *         не показать. Здесь у каждого окна свои стрелки и свои списки месяца
 *         и года, поэтому до произвольной даты два клика, а не двадцать девять
 *         нажатий на стрелку.
 *         СПИСКИ — нативные <select> с нулевой прозрачностью поверх своей
 *         подписи (приём shadcn, captionLayout="dropdown"): открывает и рисует
 *         их браузер, значит клавиатура, поиск набором и мобильное колесо
 *         достаются даром.
 *         ДАТУ МОЖНО НАБРАТЬ. Знаешь дату — не листай: до марта прошлого года
 *         иначе семнадцать нажатий на стрелку. Несуществующая дата (31.02)
 *         отбрасывается, поле возвращается к прежнему значению — фильтр молча
 *         не сдвигается (разбор — parseDmy в shared/lib/date).
 * A11Y:   поля — настоящие <input> с подписями, то есть весь выбор доступен с
 *         клавиатуры и без сетки вообще. Сетка — настоящая <table> с <th>
 *         дней недели; дни несут aria-pressed на краях, стрелки листают месяц,
 *         а ←↑→↓ переводят фокус по дням: кнопки идут подряд, поэтому ±1 это
 *         соседний день, ±7 — та же неделя.
 *
 * @example
 * <RangeCalendar from={from} to={to}
 *   onChange={(from, to) => setFilters({ ...filters, from, to })} />
 */
export function RangeCalendar({ from, to, onChange }: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  /** Два НЕЗАВИСИМЫХ окна. У shadcn пара листается связанно, и расстояние
   *  между месяцами навсегда равно единице — «март и декабрь» так не показать. */
  const [views, setViews] = useState<[Date, Date]>(() => {
    const first = startOfMonth(from || isoLocal(new Date()));
    return [first, new Date(first.getFullYear(), first.getMonth() + 1, 1)];
  });
  const [hover, setHover] = useState('');
  /** Что НАБРАНО в поле, пока не подтверждено. Отдельно от значения: иначе
   *  первый же стёртый символ отправлял бы в фильтр обрубок даты. */
  const [draft, setDraft] = useState<Record<string, string>>({});
  /** КАКУЮ границу поставит следующий клик. Переключается тем, что человек
   *  ставит курсор в нужное поле. */
  const [edge, setEdge] = useState<'from' | 'to'>('from');
  const gridRef = useRef<HTMLDivElement>(null);

  const today = isoLocal(new Date());
  /* Полоса, которую тянет курсор: подвижен тот край, за который взялись,
     второй стоит на месте. Тёмные пилюли остаются на настоящих значениях —
     под курсором ходит только заливка. */
  /* Тернарник, а не `hover && (…)`: при пустом hover тот возвращает ПУСТУЮ
     СТРОКУ, а `??` подставляет запасное значение только вместо null/undefined —
     полоса считалась от разобранной строки, то есть от undefined, и не
     появлялась вовсе. */
  const ghost = hover
    ? (edge === 'to'
      ? (from && hover > from ? [from, hover] : null)
      : (to && hover < to ? [hover, to] : null))
    : null;
  const [lo, hi] = ghost ?? [from, to];

  /* Окна следуют за началом периода, только если оно уехало из виду ОБОИХ:
     иначе клик по второму месяцу утаскивал бы сетку из-под руки. */
  useEffect(() => {
    if (!from) return;
    const target = startOfMonth(from);
    const visible = views.some((m) => m.getFullYear() === target.getFullYear()
      && m.getMonth() === target.getMonth());
    if (!visible) setViews([target, new Date(target.getFullYear(), target.getMonth() + 1, 1)]);
  }, [from]); // eslint-disable-line react-hooks/exhaustive-deps

  const setView = (index: number, date: Date) => setViews(
    (prev) => (index === 0 ? [date, prev[1]] : [prev[0], date]),
  );

  const pick = (iso: string) => {
    const [a, b] = edge === 'from' ? [iso, to] : [from, iso];
    onChange(...(a && b && a > b ? [b, a] as const : [a, b] as const));
    if (edge === 'from' && !b) setEdge('to');
  };

  /** Подтверждение набранного. Пустое поле снимает границу; неразобранное
   *  возвращается к прежнему значению, а не обнуляет фильтр молча. */
  const commit = (key: 'from' | 'to') => {
    const text = draft[key];
    setDraft({});
    if (text === undefined) return;
    if (!text.trim()) return onChange(key === 'from' ? '' : from, key === 'from' ? to : '');
    const iso = parseDmy(text);
    if (!iso) return;
    const [a, b] = key === 'from' ? [iso, to] : [from, iso];
    onChange(...(a && b && a > b ? [b, a] as const : [a, b] as const));
  };

  /** Стрелки водят фокус по дням. Кнопки идут строго подряд по датам, поэтому
   *  ±1 это соседний день, ±7 — та же неделя, и переход между месяцами
   *  получается сам собой. */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!step || !gridRef.current) return;
    const days = [...gridRef.current.querySelectorAll<HTMLButtonElement>('button[data-day]')];
    const at = days.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    e.preventDefault();
    days[Math.min(Math.max(at + step, 0), days.length - 1)]?.focus();
  };

  /** Поле — оно же переключатель очереди: поставил курсор в «по» — значит
   *  правишь конец, и клик по сетке правит именно его. */
  const field = (key: 'from' | 'to', label: string, value: string) => (
    <label className={cx(s.field, edge === key && s.isActive)}>
      <span className={s.fieldLabel}>{label}</span>
      <input
        className={s.fieldInput}
        type="text"
        inputMode="numeric"
        placeholder="ДД.ММ.ГГГГ"
        aria-label={key === 'from' ? 'Начало периода' : 'Конец периода'}
        value={draft[key] ?? (value ? isoToDmy(value) : '')}
        onFocus={() => setEdge(key)}
        onChange={(e) => setDraft({ [key]: e.target.value })}
        onBlur={() => commit(key)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(key); } }}
      />
    </label>
  );

  return (
    <div className={s.rc}>
      <div className={s.fields}>
        {field('from', 'от', from)}
        <span className={s.fieldsDash} aria-hidden="true">—</span>
        {field('to', 'до', to)}
      </div>

      <div className={s.months} ref={gridRef} onKeyDown={onKeyDown}>
        {views.map((month, index) => (
          <div key={index} className={cx(s.month, index === 1 && s.monthSecond)}>
            {/* Своя навигация у каждого окна: стрелки двигают ТОЛЬКО его,
                списки уводят сразу в нужный месяц и год. */}
            <div className={s.monthCaption}>
              <button
                type="button"
                className={cx(s.nav, s.navPrev)}
                aria-label={`Предыдущий месяц, ${MONTH_NAME.format(month)}`}
                onClick={() => setView(index, new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              >
                <Icon name="chevronDown" />
              </button>

              <div className={s.dropdowns}>
                <span className={s.dropdownRoot}>
                  <select
                    className={s.dropdown}
                    aria-label="Месяц"
                    value={month.getMonth()}
                    onChange={(e) => setView(index, new Date(month.getFullYear(), Number(e.target.value), 1))}
                  >
                    {MONTHS.map((name, m) => <option key={name} value={m}>{name}</option>)}
                  </select>
                  <span className={s.captionLabel} aria-hidden="true">
                    {MONTHS[month.getMonth()]}
                    <Icon name="chevronDown" className={s.captionChevron} />
                  </span>
                </span>

                <span className={s.dropdownRoot}>
                  <select
                    className={s.dropdown}
                    aria-label="Год"
                    value={month.getFullYear()}
                    onChange={(e) => setView(index, new Date(Number(e.target.value), month.getMonth(), 1))}
                  >
                    {yearOptions(month.getFullYear()).map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <span className={s.captionLabel} aria-hidden="true">
                    {month.getFullYear()}
                    <Icon name="chevronDown" className={s.captionChevron} />
                  </span>
                </span>
              </div>

              <button
                type="button"
                className={cx(s.nav, s.navNext)}
                aria-label={`Следующий месяц, ${MONTH_NAME.format(month)}`}
                onClick={() => setView(index, new Date(month.getFullYear(), month.getMonth() + 1, 1))}
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
              <tbody onMouseLeave={() => setHover('')}>
                {weeks(month).map((week) => (
                  <tr key={isoLocal(week[0])} className={s.week}>
                    {week.map((date) => {
                      const iso = isoLocal(date);
                      const isStart = iso === from;
                      const isEnd = iso === to;
                      const middle = Boolean(lo && hi && iso > lo && iso < hi);
                      /* Полоса на ячейке рисуется только тогда, когда с этой
                         стороны есть к чему примыкать: у одиночной даты
                         подпирать пилюлю нечем и не нужно. */
                      const bandStart = iso === lo && Boolean(hi) && lo !== hi;
                      const bandEnd = iso === hi && Boolean(lo) && lo !== hi;
                      return (
                        <td
                          key={iso}
                          className={cx(
                            s.day,
                            middle && s.dayMiddle,
                            bandStart && s.dayStart,
                            bandEnd && s.dayEnd,
                          )}
                        >
                          <button
                            type="button"
                            data-day={iso}
                            aria-pressed={isStart || isEnd}
                            className={cx(
                              s.dayBtn,
                              date.getMonth() !== month.getMonth() && s.dayBtnOutside,
                              iso === today && s.dayBtnToday,
                              middle && s.dayBtnMiddle,
                              (isStart || isEnd) && s.dayBtnEdge,
                            )}
                            onMouseEnter={() => setHover(iso)}
                            onClick={() => pick(iso)}
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
          </div>
        ))}
      </div>
    </div>
  );
}
