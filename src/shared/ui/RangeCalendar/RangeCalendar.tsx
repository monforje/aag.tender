import { useEffect, useState } from 'react';
import { cx } from '@/shared/lib/cx';
import { isoLocal, isoToDmy, parseDmy, startOfMonth } from '@/shared/lib/date';
import { CalendarMonth } from '@/shared/ui/Calendar';
import s from './RangeCalendar.module.css';

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

      <div className={s.months}>
        {views.map((month, index) => (
          <CalendarMonth
            key={index}
            className={cx(index === 1 && s.monthSecond)}
            month={month}
            onMonth={(next) => setView(index, next)}
            onPick={pick}
            onHoverDay={setHover}
            onLeave={() => setHover('')}
            /* Что считать полосой, знает только диапазон: подложка ячейки —
               его класс, а пилюля и «без фона» — флаги общей сетки. Так все
               фоны кнопки остаются в одном файле и не спорят за
               специфичность. */
            dayState={(iso) => {
              const middle = Boolean(lo && hi && iso > lo && iso < hi);
              /* Полоса на ячейке рисуется только тогда, когда с этой стороны
                 есть к чему примыкать: у одиночной даты подпирать пилюлю
                 нечем и не нужно. */
              const bandStart = iso === lo && Boolean(hi) && lo !== hi;
              const bandEnd = iso === hi && Boolean(lo) && lo !== hi;
              return {
                td: cx(middle && s.dayMiddle, bandStart && s.dayStart, bandEnd && s.dayEnd),
                selected: iso === from || iso === to,
                plain: middle,
              };
            }}
          />
        ))}
      </div>
    </div>
  );
}
