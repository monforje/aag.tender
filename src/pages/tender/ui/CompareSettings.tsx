import {
  cloneElement, isValidElement, useEffect, useId, useRef, useState,
  type ReactElement, type ReactNode,
} from 'react';
import { cx } from '@/shared/lib/cx';
import { toggle } from '@/shared/lib/toggle';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import { NumberInput } from '@/shared/ui/NumberInput';
import { Popover } from '@/shared/ui/Popover';
import { Tabs } from '@/shared/ui/Tabs';
import {
  clampThresholds, decimal, predicateCount, PREDICATES, SYSTEM_THRESHOLDS,
  type CompareThresholds, type PredicateId, type RowFacts,
} from '@/entities/comparison';
import { plural } from '@/shared/lib/plural';
import { AnomalyGlyph, CoinMark, KeyMark, MedMark, SpreadMark } from './assets';
import s from './CompareSettings.module.css';

/* Глиф предиката — ТОТ ЖЕ маркер, что красит ячейки таблицы: один смысл —
   один глиф везде. Переехал сюда вместе со списком фильтров из полосы. */
const PREDICATE_GLYPH: Record<PredicateId, ReactElement> = {
  key: <KeyMark />,
  spread: <SpreadMark />,
  anomaly: <AnomalyGlyph />,
  pot: <CoinMark />,
  med: <MedMark />,
};

const TABS = [
  { id: 'params', label: 'Параметры' },
  { id: 'filters', label: 'Фильтры' },
] as const;

/** Пороговые поля с фиксированным смыслом — рендерятся общим циклом; особые
 *  строки (коэффициент с подсказкой, доля ключевых с превью) — ниже. */
const PLAIN_ROWS = [
  {
    key: 'spreadNoticeable',
    label: 'Разброс «заметный»',
    hint: 'Строка помечается как заметно расходящаяся.',
    min: 0,
    max: 100,
  },
  {
    key: 'spreadHigh',
    label: 'Разброс «высокий»',
    hint: 'Строка получает тег и попадает в фильтр «Высокий разброс».',
    min: 1,
    max: 100,
  },
] as const;

/**
 * Окно настроек сравнения: пороги аналитики ТЕНДЕРА (решение владельца
 * 22.08.2026 — личных и организационных дефолтов нет).
 *
 * КОГДА:  из кнопки `⚙` полосы сравнения (<CompareToolbar>).
 * НЕ ДЛЯ: показа отклонения и ставки (галочки спутников живут прямо на
 *         полосе), вида строк и фильтров (отдельные контролы), полоски
 *         распределения и способа подсветки минимума (место не назначено —
 *         открытый вопрос владельца).
 *
 * UX:     ПОВЕРХНОСТЬ — <Popover>, а не <Modal>: порог применяется сразу и
 *         каскадом перекрашивает таблицу, специалист обязан ВИДЕТЬ эффект,
 *         крутя ручку; модальное окно накрыло бы то, на что он смотрит.
 *         Каждая строка несёт пояснение, что порог меняет: настройка без
 *         объяснения последствия заставляет крутить наугад. У коэффициента
 *         аномалии подсказка ОБЯЗАТЕЛЬНА (единственный порог-коэффициент):
 *         текст цитирует metrics.md §9 — формулу, разбор на числах, «почему
 *         коэффициент», смысл маркера и границы применения; канон метрики
 *         один, интерфейс его цитирует, а не пересказывает. Доля ключевых
 *         показывает живое превью состава на текущем срезе.
 * A11Y:   числовые поля связаны с подписью через <Field>; подсказка k —
 *         кнопка с aria-expanded, текст в потоке панели (не hover-only).
 *
 * @example
 * <CompareSettings thresholds={thresholds} onChange={handleThresholds}
 *                  allRows={facts.rows} />
 */
export function CompareSettings({ thresholds, onChange, allRows, filters, onFilters }: {
  thresholds: CompareThresholds;
  /** Зажатое значение приходят наружу: хранит страницу. */
  onChange: (thresholds: CompareThresholds) => void;
  /** Все строки среза БЕЗ фильтров — база превью состава ключевых И счётчиков
   *  предикатов: число на невыбранном пункте иначе бесполезно (показывало бы
   *  «после всего остального»). */
  allRows: RowFacts[];
  /** Активные предикаты и их правка — вкладка «Фильтры». */
  filters: PredicateId[];
  onFilters: (filters: PredicateId[]) => void;
}) {
  const [at, setAt] = useState<DOMRect | null>(null);
  const [tab, setTab] = useState<string>(TABS[0].id);

  const patch = (part: Partial<CompareThresholds>) =>
    onChange(clampThresholds({ ...thresholds, ...part }));

  return (
    /* Корень несёт --pop-width: её читает <Popover>, а ширина по умолчанию
       (232px) тесна для четырёх полей с пояснениями — без моста контент
       обрезается краем диалога (тот же приём, что у легенды). */
    <div className={s.root}>
      {/* Одна кнопка на оба среза: пороги и фильтры. Число активных
          предикатов обязано быть НА НЕЙ — фильтры уехали внутрь окна, и без
          значка «что-то отфильтровано» перестало бы читаться с полосы вовсе.
          Заливка в покое (active) — второй канал к значку, для чёрно-белого
          и для тех, кто значок не заметил. */}
      <IconButton
        variant="topbar"
        icon="settings"
        label={filters.length
          ? `Параметры анализа · фильтров: ${filters.length}`
          : 'Параметры анализа'}
        title="Пороги аналитики и фильтры этого тендера"
        aria-haspopup="dialog"
        aria-expanded={at !== null}
        active={filters.length > 0}
        badge={filters.length ? <span className={s.btnBadge}>{filters.length}</span> : null}
        className={s.gear}
        /* Вкладка сбрасывается на ОТКРЫТИИ, а не на закрытии, хотя по смыслу
           это одно и то же. Причина техническая: закрытие приходит событием
           `close` у <dialog>, а оно срабатывает не во всякой среде — на
           программный close() в headless-браузере не пришло ни разу. Здесь же
           обработчик наш и выполняется всегда.

           Зачем вообще сбрасывать: <Popover> меряет высоту ОДИН раз при
           открытии и по замеру решает, откидываться ли вверх. Вкладки разной
           высоты (429px против 266px), и панель, открывшаяся на короткой,
           после переключения на длинную вылезала бы за нижний край экрана на
           невысоком окне. Открываясь всегда на длинной, она меряет худший
           случай и помещается в обоих. */
        onClick={(e) => {
          setTab(TABS[0].id);
          setAt(e.currentTarget.getBoundingClientRect());
        }}
      />
      <Popover anchor={at} onClose={() => setAt(null)} label="Параметры анализа">
        <div className={s.body}>
          {/* Вкладки — два среза одного окна: «чем считаем» и «что
              показываем». Раньше фильтры жили отдельной кнопкой полосы; на
              полосе из шести контролов седьмой уже не читался, а по смыслу
              это та же настройка взгляда на таблицу.

              ВИДИМОГО ЗАГОЛОВКА НАД НИМИ НЕТ: вкладки называют содержимое
              сами, а «Параметры анализа» третьей строкой сверху повторяло бы
              и их, и подпись кнопки, из которой окно открыли. Для скринридера
              имя осталось — оно на самом <Popover> (проп label). */}
          <Tabs
            aria-label="Разделы параметров"
            items={TABS.map((t) => ({ id: t.id, label: t.label }))}
            value={tab}
            onChange={setTab}
            className={s.tabs}
          />

          {tab === 'params' ? (
            <>
              {PLAIN_ROWS.map((row) => (
                <Setting key={row.key} label={row.label} description={row.hint}>
                  <NumberInput
                    min={row.min}
                    max={row.max}
                    unit="%"
                    value={thresholds[row.key]}
                    onChange={(value) => patch({ [row.key]: value })}
                  />
                </Setting>
              ))}

              {/* Коэффициент аномалии: единственный порог-КОЭФФИЦИЕНТ, без
                  разбора читается произвольным числом — подсказка обязательна. */}
              <Setting
                label="Коэффициент аномалии"
                description="Множитель, с которым отклонение считается аномальным."
                hint={<KHint />}
              >
                <NumberInput
                  min={1}
                  max={10}
                  step={0.5}
                  unit="×"
                  value={thresholds.anomalyK}
                  onChange={(anomalyK) => patch({ anomalyK })}
                />
              </Setting>

              <Setting
                label="Доля ключевых работ"
                description={`Состав ключевых и линия отсечки в виде «По весу». Превью на срезе: при ${decimal(thresholds.keyShare)} % — ${keysAt(allRows, thresholds.keyShare)}, при 90 % — ${keysAt(allRows, 90)}.`}
              >
                <NumberInput
                  min={1}
                  max={100}
                  unit="%"
                  value={thresholds.keyShare}
                  onChange={(keyShare) => patch({ keyShare })}
                />
              </Setting>

              {/* Сброс — во всю ширину внизу: он относится ко ВСЕМ четырём
                  порогам сразу, а кнопка в углу читалась бы как действие
                  последней строки. */}
              <Button
                variant="secondary"
                className={s.reset}
                onClick={() => onChange({ ...SYSTEM_THRESHOLDS })}
              >
                Вернуть системные значения
              </Button>
            </>
          ) : (
            <>
              <div className={s.predicates}>
                {PREDICATES.map((predicate) => {
                  const count = predicateCount(predicate.id, allRows);
                  const on = filters.includes(predicate.id);
                  return (
                    <button
                      key={predicate.id}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      className={cx(s.predicate, !count && s.predicateEmpty)}
                      onClick={() => onFilters(toggle(filters, predicate.id))}
                    >
                      <span className={s.predicateGlyph}>{PREDICATE_GLYPH[predicate.id]}</span>
                      <span className={s.predicateLabel}>{predicate.label}</span>
                      {/* Сколько строк пропустит ЭТОТ предикат на ВСЕХ данных:
                          число «после всех остальных» на невыбранном пункте
                          бесполезно. */}
                      <span className={s.predicateCount}>{count}</span>
                      <span className={s.predicateCheck} aria-hidden="true">
                        <Icon name="checkCircle" />
                      </span>
                    </button>
                  );
                })}
              </div>

              <Button
                variant="secondary"
                className={s.reset}
                disabled={!filters.length}
                onClick={() => onFilters([])}
              >
                Сбросить фильтры
              </Button>
            </>
          )}
        </div>
      </Popover>
    </div>
  );
}

/** Сколько строк наберёт накопительная доля веса до порога — тот же счёт,
    что ставит производные ключевые в analyzeComparison ([R4]). */
function keysAt(rows: RowFacts[], share: number): string {
  const sumWeight = rows.reduce((acc, r) => acc + r.weight, 0);
  if (sumWeight <= 0) return plural(0, 'работа', 'работы', 'работ');
  let acc = 0;
  let n = 0;
  for (const row of [...rows].sort((a, b) => b.weight - a.weight)) {
    if (row.weight <= 0) break;
    acc += row.weight;
    n += 1;
    if ((acc / sumWeight) * 100 >= share) break;
  }
  return `${n} ${plural(n, 'работа', 'работы', 'работ')}`;
}

/**
 * Строка окна настроек: подпись с пояснением слева, контрол справа.
 *
 * КОГДА:  панель параметров, где у каждой настройки есть последствие, которое
 *         надо назвать словами. Настройка без объяснения последствия
 *         заставляет крутить ручку наугад.
 * НЕ ДЛЯ: формы ввода — там подпись стоит НАД полем (см. <Field>): в форме
 *         читают сверху вниз одним столбцом, а здесь глаз идёт слева направо
 *         «что настраиваю → чему равно», и колонка значений выстраивается по
 *         правому краю сама.
 *
 * UX:     разделитель между строками, а не воздух: настроек четыре, они
 *         однородные, и полоса даёт им ритм списка, не утяжеляя панель
 *         рамками. У последней строки его нет — снизу и так край панели.
 * A11Y:   подпись — настоящий <label for>, пояснение уходит в
 *         aria-describedby. Оба id проставляются клонированием контрола: он
 *         единственный ребёнок, и требовать их от каждого места вызова —
 *         значит однажды забыть (тот же приём, что у <Tooltip>).
 */
function Setting({ label, description, hint, children }: {
  label: string;
  description: ReactNode;
  /** Кнопка «?» рядом с подписью — только там, где смысл настройки не
   *  умещается в пояснение (у нас это коэффициент аномалии). */
  hint?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  const descId = `${id}-desc`;

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string; 'aria-describedby'?: string }>, {
      id, 'aria-describedby': descId,
    })
    : children;

  return (
    <div className={s.setting}>
      <div className={s.settingInfo}>
        {/* Кнопка «?» стоит РЯДОМ с <label>, а не внутри него, хотя выглядит
            частью подписи. Внутри она давала две беды сразу: весь текст
            подсказки уходил в доступное имя поля (скринридер читал цитату
            канона вместо «Коэффициент аномалии»), а клик по кнопке считался
            кликом по подписи и переводил фокус в поле. */}
        <div className={s.settingLabelRow}>
          <label className={s.settingLabel} htmlFor={id}>{label}</label>
          {hint}
        </div>
        <p id={descId} className={s.settingDescription}>{description}</p>
      </div>
      {control}
    </div>
  );
}

/* Тайминги NN/g, те же, что у <CellPopup>: показ через 350мс после остановки
   курсора — проход по панели не хлопает подсказкой; сокрытие через 500мс —
   этого хватает, чтобы довести курсор с кнопки на сам слой. */
const SHOW_DELAY = 350;
const HIDE_DELAY = 500;

/**
 * Кнопка «?» у коэффициента k и слой разбора при ней.
 *
 * КОГДА:  только здесь. k — единственный порог-КОЭФФИЦИЕНТ в окне, и без
 *         разбора он читается произвольным числом; подсказка обязательна.
 * НЕ ДЛЯ: коротких расшифровок контрола (см. <Tooltip> — там ровно текст) и
 *         пояснений к остальным трём порогам: у них смысл назван в `hint`
 *         самого <Field>, второй слой там был бы шумом.
 *
 * UX:     ОТКРЫВАЕТСЯ ПО НАВЕДЕНИЮ — текст читают один раз, и клик за него
 *         был лишним жестом. Клик оставлен для тача, где наведения нет вовсе,
 *         и работает как переключатель.
 *         СЛОЙ, А НЕ РАСКРЫТИЕ В ПОТОКЕ. <Popover> меряет свою высоту ровно
 *         один раз — при открытии — и по замеру решает, откидываться ли
 *         вверх; выросший позже контент он не перемеряет, и пять абзацев
 *         увели бы низ панели вместе с кнопкой «Вернуть системные значения»
 *         за нижний край экрана.
 *         ИКОНКА ВСЕГДА «?», крестика нет. Крестик на кнопке подсказки внутри
 *         окна настроек читается как «закрыть окно», а закрывать подсказку
 *         есть чем и без него — см. A11Y.
 * A11Y:   WCAG 1.4.13 целиком: dismissible — Escape гасит СНАЧАЛА подсказку и
 *         только вторым нажатием окно (иначе один Escape уносит оба, и
 *         человек теряет место); hoverable — мост курсора кнопка → слой живёт
 *         HIDE_DELAY, и сам слой держит подсказку открытой, пока по нему
 *         водят; persistent — автоскрытия по таймеру нет, слой висит, пока
 *         его не увели курсором, фокусом или Escape. Фокус с клавиатуры
 *         открывает ту же подсказку, кнопка несёт aria-expanded и
 *         aria-describedby на слой.
 */
function KHint() {
  const [open, setOpen] = useState(false);
  const showTimer = useRef<number | undefined>(undefined);
  const hideTimer = useRef<number | undefined>(undefined);
  const id = useId();

  useEffect(() => () => {
    window.clearTimeout(showTimer.current);
    window.clearTimeout(hideTimer.current);
  }, []);

  const cancelTimers = () => {
    window.clearTimeout(showTimer.current);
    window.clearTimeout(hideTimer.current);
  };
  /* Наведение — с задержкой; фокус и клик — немедленно: там намерение уже
     выражено, ждать нечего. */
  const openSoon = () => { cancelTimers(); showTimer.current = window.setTimeout(() => setOpen(true), SHOW_DELAY); };
  const closeSoon = () => { cancelTimers(); hideTimer.current = window.setTimeout(() => setOpen(false), HIDE_DELAY); };
  const openNow = () => { cancelTimers(); setOpen(true); };
  const closeNow = () => { cancelTimers(); setOpen(false); };

  return (
    <span
      className={s.kHint}
      onMouseEnter={openSoon}
      onMouseLeave={closeSoon}
      /* Escape гасит подсказку и НЕ доходит до <dialog>: preventDefault
         снимает штатное закрытие окна, stopPropagation — всплытие. Пока
         подсказки нет, оба не вызываются, и Escape закрывает окно как обычно. */
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || !open) return;
        e.preventDefault();
        e.stopPropagation();
        closeNow();
      }}
      /* Фокус ушёл и с кнопки, и со слоя — гасим. */
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) closeNow(); }}
    >
      <button
        type="button"
        className={s.kHelpToggle}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        aria-label="Что такое коэффициент аномалии"
        onFocus={openNow}
        onClick={() => (open ? closeNow() : openNow())}
      >
        <Icon name="questionCircle" />
      </button>
      {open ? <KHelp id={id} /> : null}
    </span>
  );
}

/** Подсказка у порога аномалии — ЦИТАТА канона метрики (`metrics.md` §9):
    формула, причина коэффициентности, разбор на числах, смысловая граница и
    границы применения. Своей терминологии здесь не заводим. */
function KHelp({ id }: { id: string }) {
  return (
    <div id={id} role="tooltip" className={s.kHelp}>
      <p className={s.kFormula}>dᵢ = |стоимостьᵢ / медиана − 1|;<br />
        аномалия, если dᵢ ≥ k × median(dᵢ остальных)</p>
      <p><b>Почему коэффициент.</b> Нормальный разброс у работ разный: где все
        укладываются в 3 %, выброс на 15 % — сигнал; где гуляют на 40 % —
        обычное дело. Метрика меряется относительно того, как расходятся
        остальные в этой же строке.</p>
      <p><b>Что даёт k.</b> Меньше — метятся и умеренные выбросы, больше —
        только грубые. Стартовое значение — гипотеза, калибруется на реальных
        торгах.</p>
      <p><b>Граница смысла.</b> Маркер означает «проверить», а не «ошибка»:
        особые условия сигнал не снимают, но сопровождают его пояснением.</p>
      <p><b>Когда не считается.</b> Меньше трёх цен, нулевая медиана строки или
        нулевой разброс отклонений остальных (тогда любая ненулевая dᵢ —
        аномалия).</p>
      <p className={s.kSource}>Источник: metrics.md §9</p>
    </div>
  );
}
