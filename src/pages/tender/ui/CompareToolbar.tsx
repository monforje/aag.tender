import type { ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import {
  Dropdown, DropdownGroup, MenuItem, useDropdownSlot,
} from '@/shared/ui/Dropdown';
import { Icon } from '@/shared/ui/Icon';
import { Segmented } from '@/shared/ui/Segmented';
import { Switch } from '@/shared/ui/Switch';
import {
  METRIC_LABEL, PRESET_LABEL, ROW_VIEW_LABEL, SATELLITE_LABEL, SORT_VIEWS,
  moneyCompact,
  type CompareMetricId, type CompareThresholds, type CompareView,
  type MetricTotals, type PresetId, type RowFacts, type SatelliteId,
} from '@/entities/comparison';
import { CompareLegend } from './CompareLegend';
import { CompareFilters, CompareSettings } from './CompareSettings';
import s from './CompareToolbar.module.css';

const METRICS = Object.keys(METRIC_LABEL) as CompareMetricId[];
const SATELLITES = Object.keys(SATELLITE_LABEL) as SatelliteId[];

/** Спутник → его поле в виде, и обратно. ДВЕ ТАБЛИЦЫ вместо цепочки
 *  тернарников: четыре галочки уже не читаются в одну строку, а забытая
 *  ветка молча оставила бы контрол мёртвым — кликается, а ничего не
 *  происходит. Типы при этом ловят пропущенный ключ на месте. */
const SATELLITE_STATE: Record<SatelliteId, (v: CompareView) => boolean> = {
  deviation: (v) => v.showDeviation,
  dynamics: (v) => v.showDynamics,
  rate: (v) => v.showRate,
  potential: (v) => v.showPotential,
};
/** Подпись дефолтного порядка на триггере: пунктом меню он не является, но
 *  назвать себя контрол обязан. */
const ROW_VIEW_DEFAULT = ROW_VIEW_LABEL.sections;

const SATELLITE_PATCH: Record<SatelliteId, (on: boolean) => Partial<CompareView>> = {
  deviation: (on) => ({ showDeviation: on }),
  dynamics: (on) => ({ showDynamics: on }),
  rate: (on) => ({ showRate: on }),
  potential: (on) => ({ showPotential: on }),
};

interface ToolbarProps {
  view: CompareView;
  /** Пороги тендера — их читают счётчики фильтров и легенда, меняет окно настроек. */
  thresholds: CompareThresholds;
  onThresholds?: (thresholds: CompareThresholds) => void;
  /** Все строки среза БЕЗ фильтров: счётчик пункта показывает, сколько строк
   *  пропустит ЭТОТ предикат на всех данных (§4 аудита). */
  allRows: RowFacts[];
  /** Пара «стоимость → потенциал» уровня тендера: числа в меню показателя и
   *  его шкала соотношения. Считает `metricTotals` — та же формула, что у
   *  точек торгов разбора. */
  totals: MetricTotals;
  modified: boolean;
  /** Подкраска колонок по ранжиру: тумблер живёт в окне параметров, состояние
   *  — у <TenderCompare> (эргономика чтения, не ось среза). */
  rankTint: boolean;
  onRankTint: (on: boolean) => void;
  /** Развёрнутые названия позиций — второй тумблер оформления там же и по той
   *  же причине: читается это состояние, а не считается. */
  wideTitle: boolean;
  onWideTitle: (on: boolean) => void;
  /** Строки «Показано» под фильтром (§1.1) — третий тумблер оформления там же
   *  и по той же причине: сводка среза это эргономика чтения, а не нарезка
   *  данных, и чип «Изменён» на неё подниматься не должен. */
  shownRows: boolean;
  onShownRows: (on: boolean) => void;
  /** Вид перестроен переходом «анализ → таблица»: чип с ВОЗВРАТОМ полного
   *  пользовательского вида (05 §7). Старый «Изменён · Сброс» при этом молчит:
   *  два чипа про один уход от базы — забор. */
  analysisApplied?: boolean;
  onRestoreView?: () => void;
  onPreset: (preset: PresetId) => void;
  /** Ручное движение по одной из осей состояния — пресет не сбрасывается,
   *  но поднимает флаг «изменён». */
  onPatch: (patch: Partial<Omit<CompareView, 'preset'>>) => void;
  /** Сколько строк видно и сколько всего — счётчик скрытых (§3.4). Канон
   *  требует ЗАМЕТНОСТИ: «скрыто 128» говорит сильнее, чем «5 из 133». */
  visible: number;
  total: number;
  /** Есть ли предыдущий раунд: без него «Динамика» видна и НЕАКТИВНА с
   *  объяснением — считать изменение не от чего (`satellites.md` §2). */
  hasPrevRound: boolean;
}

/**
 * Полоса управления сравнением КП: пресеты и ТРИ секции модели — основной
 * показатель (селект), спутники (свитчи), пороги (окно `⚙`) — плюс вид строк
 * и предикаты (модель ячейки §2).
 *
 * КОГДА:  над таблицей сравнения — секции независимы: переключение одной не
 *         сбрасывает другие; пресет связывает их именованной комбинацией.
 * НЕ ДЛЯ: полосы реестра (см. RegistryFilters — там поиск и фасеты по полям).
 *
 * UX:     ЕДИНСТВЕННЫЙ кнопочный элемент полосы — сегмент пресетов: их ровно
 *         три, они взаимоисключающие и переключаются часто. Всё остальное —
 *         тихие триггеры «подпись · значение · шеврон»; нативный <select>
 *         запрещён. СПУТНИКИ — <Switch> с подписью: настройка вида,
 *         применяющаяся сразу; галочки НЕ зависят от селекта основного —
 *         описывают стоимость, а она в ячейке есть всегда. Активные
 *         предикаты НЕ выносятся чипами в полосу — список виден в поповере,
 *         на полосе живёт одно число.
 * A11Y:   клавиатура меню — от <Dropdown> (стрелки, Home/End, Escape с
 *         возвратом фокуса на триггер); мультивыбор сериями —
 *         closeOnSelect={false}; у свитчей подпись видима и aria-label.
 */
export function CompareToolbar({
  view, thresholds, onThresholds, allRows, totals, modified, rankTint, onRankTint, wideTitle, onWideTitle,
  shownRows, onShownRows,
  analysisApplied, onRestoreView, onPreset, onPatch,
  visible, total, hasPrevRound,
}: ToolbarProps) {
  const hidden = total - visible;
  return (
    <DropdownGroup>
      <div className={s.bar}>
        {/* Пресет — режим прочтения среза; отмеченная опция наливается своим
            тоном (деньги — success, риск — danger), иконки называют режим до
            чтения подписи. */}
        <Segmented
          label="Пресет"
          value={view.preset}
          onChange={onPreset}
          options={[
            { id: 'overview', label: PRESET_LABEL.overview, tone: 'neutral', icon: 'layers' },
            { id: 'bidding', label: PRESET_LABEL.bidding, tone: 'success', icon: 'graphUp' },
            { id: 'anomalies', label: PRESET_LABEL.anomalies, tone: 'danger', icon: 'flag' },
          ]}
        />

        <span className={s.sep} />

        {/* Секция 1: основной показатель. Подпись «Показано» — единая
            формулировка режима из модели (§5): её дублирует caption таблицы.
            Пункты меню несут СВОЁ число уровня тендера, под ними — шкала
            соотношения «сколько запаса сидит в лучшей цене». */}
        <QuietSelect
          slot="compare-metric"
          icon="graphUp"
          name="Основной показатель"
          value={view.mainMetric}
          options={METRICS.map((id) => ({
            id,
            label: METRIC_LABEL[id],
            hint: id === 'cost'
              ? (totals.best ? moneyCompact(totals.best) : '—')
              : (totals.potential ? `+${moneyCompact(totals.potential)}` : '—'),
          }))}
          onPick={(mainMetric) => onPatch({ mainMetric })}
          footer={<MetricRatio totals={totals} />}
        />

        {/* Секция 2: спутники стоимости. ЧЕТЫРЕ ЧИПА СВЕРНУТЫ В ОДИН ТИХИЙ
            СЕЛЕКТ (правка владельца 25.08.2026): развёрнутым рядом они
            занимали 443px из 927 доступных — почти половину полосы, — и
            именно они переносили её на вторую строку. Переносящаяся полоса
            хуже свёрнутого списка: на второй строке контролы меняют место от
            появления любого чипа, то есть прыгают ровно тогда, когда по ним
            и кликают.
            Состояние с полосы при этом НЕ ПРОПАЛО: число включённых стоит на
            самом триггере — тот же приём, что у «Фильтров» рядом. */}
        <SatelliteSelect
          view={view}
          hasPrevRound={hasPrevRound}
          onPatch={onPatch}
        />

        {/* КОНТРОЛ «СОРТИРОВКА» (§1.5). Имя контрола — часть контракта:
            «Строки» обещало ВИД, а он меняет ПОРЯДОК. «По разделам» из пунктов
            убрано — это исходное состояние, а не выбор: в него СБРАСЫВАЮТ
            крестиком, и крестик появляется ровно тогда, когда есть что
            сбрасывать. Сброс не трогает ни фильтры, ни галочку «Потенциал»
            (`sorting.md` §9): три разные оси, три разных решения. */}
        <QuietSelect
          slot="compare-rows"
          icon="list"
          name="Сортировка строк"
          value={view.rowView}
          options={SORT_VIEWS.map((id) => ({ id, label: ROW_VIEW_LABEL[id] }))}
          onPick={(rowView) => onPatch({
            rowView,
            /* СОРТИРОВКА «ПО ПОТЕНЦИАЛУ» ВКЛЮЧАЕТ СТОЛБЕЦ И НЕ ВЫКЛЮЧАЕТ ЕГО
               НИ ОДНА (`sorting.md` §4): порядок по числу, которого нет на
               экране, канон запрещает прямо. */
            ...(rowView === 'potential' ? { showPotential: true } : {}),
          })}
        />

        <div className={s.tail}>
        {/* ПРАВЫЙ БЛОК одним узлом, а не распоркой с тремя соседями. Полоса
            переносится (flex-wrap), и на перенесённой строке распорка остаётся
            на первой — тогда чип снова толкал бы легенду и фильтры, просто
            строкой ниже. Своим блоком с margin-inline-start:auto они прижаты к
            правому краю ЛЮБОЙ строки, на которую попали, а чип растёт влево
            внутрь свободного места. Проверено на 1600 и на 1280 (там полоса
            уже в две строки): ни один контрол не двигается.

            Д.2: любое ручное движение поднимает чип. Единственное его действие —
            повторное применение текущего пресета, то есть возврат к базе.
            Чип «Вид изменён анализом» сильнее: он восстанавливает ВЕСЬ вид
            пользователя до перехода и пока он висит, этот — спрятан.

            СТОИТ ЗА РАСПОРКОЙ, а не у сегмента пресетов, и это не вкусовщина.
            Чип появляется и исчезает по ходу работы; у сегмента он толкал
            вправо ВСЮ левую половину полосы — селект, свитчи, ⚙ и «Строки»
            прыгали ровно в тот момент, когда по ним и кликают. За распоркой
            ширину отдаёт она (flex:1), а легенда и «Фильтры» прижаты к
            правому краю и не двигаются: двигать становится нечего.

            ГЛИФЫ РАЗНЫЕ, потому что смыслы разные: restart — «вернуть в
            исходное» (база пресета), history — «вернуться к прошлому
            состоянию» (вид пользователя до разбора).

            ПОДПИСЬ — ОДНО СЛОВО «СБРОС» (правка владельца 25.08.2026).
            «Изменён · Сброс» занимало 128px, и вместе со счётчиком скрытых
            (75) правый блок переставал влезать в остаток полосы — она
            переносилась ровно тогда, когда пользователь работает с фильтром,
            то есть в самый неудачный момент. Состояние «изменён» при этом не
            потеряно: чип есть ТОЛЬКО в этом состоянии, его наличие и есть
            сообщение, а полная формулировка живёт в aria-label и title. */}
        {analysisApplied && onRestoreView ? (
          <button
            type="button"
            className={s.modchip}
            title="Разбор перестроил таблицу — вернуть ваш вид целиком"
            onClick={onRestoreView}
          >
            <Icon name="history" className={s.modchipIcon} />
            Вернуть мой вид
          </button>
        ) : modified ? (
          <button
            type="button"
            className={s.modchip}
            aria-label={`Вид изменён — сбросить к базе пресета «${PRESET_LABEL[view.preset]}»`}
            title={`Состояние ушло от базы пресета «${PRESET_LABEL[view.preset]}» — показатель, слои, сортировка и фильтры вернутся к исходной нарезке`}
            onClick={() => onPreset(view.preset)}
          >
            <Icon name="restart" className={s.modchipIcon} />
            Сброс
          </button>
        ) : null}

        {/* Порядок правого блока — «sets · legend · filters» (решение
            владельца 24.08.2026): настройки ВИДА (`⚙`), справка и ФИЛЬТРЫ.
            Предикаты среза вернули отдельной кнопкой-глифом: это
            бизнес-логика, всегда на виду, а не настройка вида — в одну
            панель с порогами их схлопывать нельзя. */}
        {/* СЧЁТЧИК СКРЫТЫХ СТРОК (§3.4, `filters.md` §4). Разность вычислима и
            из caption, но канон формулирует ЗАМЕТНОСТЬ как требование:
            «скрыто 128» говорит сильнее, чем «5 из 133», потому что называет
            то, чего пользователь НЕ ВИДИТ. Чип появляется только под
            фильтром — без него скрывать нечего. */}
        {hidden > 0 ? (
          <span
            className={s.hiddenChip}
            title={`Видно ${visible} из ${total} позиций · скрыто фильтрами ${hidden}`}
          >
            скрыто {hidden}
          </span>
        ) : null}

        {onThresholds ? (
          <CompareSettings
            thresholds={thresholds}
            onChange={onThresholds}
            allRows={allRows}
            rankTint={rankTint}
            onRankTint={onRankTint}
            wideTitle={wideTitle}
            onWideTitle={onWideTitle}
            shownRows={shownRows}
            onShownRows={onShownRows}
          />
        ) : null}
        <CompareLegend thresholds={thresholds} />
        <CompareFilters
          allRows={allRows}
          filters={view.filters}
          onFilters={(filters) => onPatch({ filters })}
        />
        </div>
      </div>
    </DropdownGroup>
  );
}

/** Тихий триггер одиночного выбора: глиф, значение medium, шеврон. Одиночный
 *  выбор закрывает меню — выбрал и ушёл. Каретка вращается на открытости
 *  (рецепт 11: поворот глифа на месте, второй канал) — aria-expanded приходит
 *  от <Dropdown> на кнопку триггера.
 *
 *  ПОДПИСИ-КАПА НА ПОЛОСЕ БОЛЬШЕ НЕТ (правка владельца 25.08.2026). «Показано:»
 *  и «Сортировка:» стоили 141px из 927 — при том что оба слова повторяли то,
 *  что и так видно: значение «Стоимость» рядом с глифом графика не спутать ни
 *  с чем, а «По разделам» рядом с глифом списка — тем более. Имя контрола не
 *  потерялось: оно ушло в `aria-label` и `title`, то есть осталось доступным
 *  обоим каналам — и скринридеру, и курсору. Полоса же перестала переноситься.
 *
 *  КРЕСТИКА СБРОСА ЗДЕСЬ ТОЖЕ НЕТ (та же правка): сброс сортировки —
 *  частный случай возврата к базе пресета, и живёт он в чипе «Изменён · Сброс»
 *  вместе со всеми остальными осями. Два разных сброса рядом заставляли
 *  выбирать, каким из них пользоваться. */
function QuietSelect<T extends string>({ slot, name, icon, value, options, onPick, footer }: {
  slot: string;
  /** Имя контрола: доступное имя кнопки и нативная подсказка. Видимой подписи
   *  у триггера нет — её место занимает само значение. */
  name: string;
  icon: 'list' | 'graphUp';
  value: T;
  options: ReadonlyArray<{ id: T; label: string; hint?: string }>;
  onPick: (value: T) => void;
  /** Небольшой информационный блок под пунктами: не действие, из клавиатурного
   *  обхода меню выпадает штатно — он и так обходит только пункты. */
  footer?: ReactNode;
}) {
  const control = useDropdownSlot(slot);
  const current = options.find((o) => o.id === value);
  const shown = current?.label ?? ROW_VIEW_DEFAULT;

  return (
    <Dropdown {...control} menuAlign="left" menu={(
      <>
        {options.map((option) => (
          <MenuItem
            key={option.id}
            checked={option.id === value}
            hint={option.hint}
            onSelect={() => onPick(option.id)}
          >
            {option.label}
          </MenuItem>
        ))}
        {footer}
      </>
    )}
    >
      {(trigger) => (
        <button
          {...trigger}
          className={s.trigger}
          aria-label={`${name}: ${shown}`}
          title={`${name}: ${shown}`}
        >
          <Icon name={icon} className={s.triggerIcon} />
          <span className={s.triggerVal}>{shown}</span>
          <Icon name="caretSmall" className={s.triggerCaret} />
        </button>
      )}
    </Dropdown>
  );
}

/** Спутники стоимости одним тихим селектом: на полосе — глиф, слово «Слои» и
 *  число включённых, внутри — четыре <Switch> с подписями и пояснением у
 *  неактивного.
 *
 *  КОГДА:  полоса сравнения. Четыре галочки канона (`satellites.md`) остаются
 *          четырьмя галочками — свернулось только их МЕСТО на полосе.
 *  НЕ ДЛЯ: предикатов среза (см. <CompareFilters> — там режут ДАННЫЕ) и
 *          порогов (см. <CompareSettings>).
 *
 *  UX:     СВЁРНУТЫ РАДИ ОДНОЙ СТРОКИ ПОЛОСЫ (правка владельца 25.08.2026):
 *          развёрнутым рядом четыре чипа занимали 443px из 927 и переносили
 *          полосу. Число включённых стоит НА ТРИГГЕРЕ — состояние с полосы не
 *          ушло, ушёл только его размер. «ДИНАМИКА» ВИДНА И НЕАКТИВНА В
 *          ПЕРВОМ РАУНДЕ (`satellites.md` §2): контрол, которого на одном
 *          тендере нет, а на другом есть, заставляет искать его глазами
 *          каждый раз; неактивный с причиной честнее.
 *  A11Y:   каждый переключатель — настоящий <Switch> со своим aria-label;
 *          клавиатура меню и Escape достаются от <Dropdown>. */
function SatelliteSelect({ view, hasPrevRound, onPatch }: {
  view: CompareView;
  hasPrevRound: boolean;
  onPatch: (patch: Partial<Omit<CompareView, 'preset'>>) => void;
}) {
  const control = useDropdownSlot('compare-satellites');
  const on = SATELLITES.filter((id) => SATELLITE_STATE[id](view));

  return (
    <Dropdown {...control} menuAlign="left" closeOnSelect={false} menu={(
      <div className={s.satMenu}>
        {SATELLITES.map((id) => {
          const checked = SATELLITE_STATE[id](view);
          const locked = id === 'dynamics' && !hasPrevRound;
          return (
            <label
              key={id}
              className={cx(s.satRow, locked && s.isLocked)}
              title={locked
                ? 'Изменение к прошлому раунду считается от собственного прошлого КП подрядчика. Идёт первый раунд — базы нет.'
                : undefined}
            >
              <span className={s.satLabel}>{SATELLITE_LABEL[id]}</span>
              <Switch
                checked={checked}
                disabled={locked}
                onChange={(next) => onPatch(SATELLITE_PATCH[id](next))}
                aria-label={SATELLITE_LABEL[id]}
              />
            </label>
          );
        })}
      </div>
    )}
    >
      {(trigger) => (
        <button
          {...trigger}
          className={s.trigger}
          aria-label={on.length
            ? `Слои ячейки, включено: ${on.map((id) => SATELLITE_LABEL[id]).join(', ')}`
            : 'Слои ячейки, ни одного не включено'}
          title={on.length
            ? `Слои ячейки: ${on.map((id) => SATELLITE_LABEL[id]).join(' · ')}`
            : 'Слои ячейки: отклонение, динамика, ставка, потенциал'}
        >
          <Icon name="layers" className={s.triggerIcon} />
          <span className={s.triggerVal}>Слои</span>
          {on.length ? <span className={s.satCount}>{on.length}</span> : null}
          <Icon name="caretSmall" className={s.triggerCaret} />
        </button>
      )}
    </Dropdown>
  );
}

/** Шкала «сколько запаса сидит в лучшей цене» под пунктами меню показателя.
 *
 *  КОГДА:  рядом с выбором «Стоимость | Потенциал», когда есть хоть одно КП.
 *  НЕ ДЛЯ: точных чтений — точные числа живут в таблице и в строке итога;
 *          шкала отвечает на один вопрос «есть ли вообще за чем идти».
 *
 *  UX:     дорожка = лучшая цена, заливка = доля потенциала в ней. Проценты
 *          подписаны словами — цвет и длина не единственные носители. Потенциал
 *          больше цены — заливка упирается в полный размер: арифметика честная,
 *          шкала не обязана уезжать за край.
 * A11Y:   обычный поток, читается как текст «Запас торга · N %». */
function MetricRatio({ totals }: { totals: MetricTotals }) {
  if (!totals.best && !totals.potential) return null;
  const share = totals.best
    ? Math.min(100, Math.round((totals.potential / totals.best) * 100))
    : 100;
  return (
    <div className={s.ratio}>
      <div className={s.ratioTrack} aria-hidden="true">
        <div className={s.ratioFill} style={{ width: `${share}%` }} />
      </div>
      <span className={s.ratioCap}>Запас торга · {share}&nbsp;% от лучшей цены</span>
    </div>
  );
}
