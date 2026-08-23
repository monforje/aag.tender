import {
  Dropdown, DropdownGroup, MenuItem, useDropdownSlot,
} from '@/shared/ui/Dropdown';
import { Icon } from '@/shared/ui/Icon';
import { Segmented } from '@/shared/ui/Segmented';
import { Switch } from '@/shared/ui/Switch';
import {
  METRIC_LABEL, PRESET_LABEL, ROW_VIEW_LABEL, SATELLITE_LABEL,
  type CompareMetricId, type CompareThresholds, type CompareView,
  type PresetId, type RowFacts, type RowViewId, type SatelliteId,
} from '@/entities/comparison';
import { CompareLegend } from './CompareLegend';
import { CompareSettings } from './CompareSettings';
import s from './CompareToolbar.module.css';

const METRICS = Object.keys(METRIC_LABEL) as CompareMetricId[];
const ROW_VIEWS = Object.keys(ROW_VIEW_LABEL) as RowViewId[];
const SATELLITES = Object.keys(SATELLITE_LABEL) as SatelliteId[];

interface ToolbarProps {
  view: CompareView;
  /** Пороги тендера — их читают счётчики фильтров и легенда, меняет окно настроек. */
  thresholds: CompareThresholds;
  onThresholds?: (thresholds: CompareThresholds) => void;
  /** Все строки среза БЕЗ фильтров: счётчик пункта показывает, сколько строк
   *  пропустит ЭТОТ предикат на всех данных (§4 аудита). */
  allRows: RowFacts[];
  modified: boolean;
  /** Вид перестроен переходом «анализ → таблица»: чип с ВОЗВРАТОМ полного
   *  пользовательского вида (05 §7). Старый «Изменён · Сброс» при этом молчит:
   *  два чипа про один уход от базы — забор. */
  analysisApplied?: boolean;
  onRestoreView?: () => void;
  onPreset: (preset: PresetId) => void;
  /** Ручное движение по одной из осей состояния — пресет не сбрасывается,
   *  но поднимает флаг «изменён». */
  onPatch: (patch: Partial<Omit<CompareView, 'preset'>>) => void;
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
  view, thresholds, onThresholds, allRows, modified, analysisApplied, onRestoreView, onPreset, onPatch,
}: ToolbarProps) {
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
            формулировка режима из модели (§5): её дублирует caption таблицы. */}
        <QuietSelect
          slot="compare-metric"
          cap="Показано:"
          value={view.mainMetric}
          options={METRICS.map((id) => ({ id, label: METRIC_LABEL[id] }))}
          onPick={(mainMetric) => onPatch({ mainMetric })}
        />

        {/* Секция 2: спутники стоимости — постоянно видимы и независимы от
            селекта. Мгновенное применение без формы — это <Switch>.
            Обёртка — span с охранённым кликом, а НЕ <label>: кнопка не является
            labelable-элементом, и лейбл молча не делегировал бы ей щелчок по
            тексту. Охрана по цели события исключает двойной тоггл, когда попали
            в сам свитч. */}
        <div className={s.satellites} role="group" aria-label="Спутники стоимости">
          {SATELLITES.map((id) => {
            const checked = id === 'deviation' ? view.showDeviation : view.showRate;
            const flip = () => onPatch(
              id === 'deviation' ? { showDeviation: !checked } : { showRate: !checked },
            );
            return (
              <span
                key={id}
                className={s.satellite}
                onClick={(e) => { if (e.target === e.currentTarget) flip(); }}
              >
                <Switch
                  checked={checked}
                  onChange={flip}
                  aria-label={`Показывать: ${SATELLITE_LABEL[id]}`}
                />
                {SATELLITE_LABEL[id]}
              </span>
            );
          })}
        </div>

        <QuietSelect
          slot="compare-rows"
          icon="list"
          cap="Строки:"
          value={view.rowView}
          options={ROW_VIEWS.map((id) => ({ id, label: ROW_VIEW_LABEL[id] }))}
          onPick={(rowView) => onPatch({ rowView })}
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
            состоянию» (вид пользователя до разбора). */}
        {analysisApplied && onRestoreView ? (
          <button
            type="button"
            className={s.modchip}
            title="Разбор перестроил таблицу — вернуть ваш вид целиком"
            onClick={onRestoreView}
          >
            <Icon name="history" className={s.modchipIcon} />
            Вид изменён анализом · Вернуть мой вид
          </button>
        ) : modified ? (
          <button
            type="button"
            className={s.modchip}
            title="Состояние ушло от базы пресета — вернуть исходную нарезку"
            onClick={() => onPreset(view.preset)}
          >
            <Icon name="restart" className={s.modchipIcon} />
            Изменён · Сброс
          </button>
        ) : null}

        <CompareLegend thresholds={thresholds} />
        {/* Шестерня стоит ПОСЛЕДНЕЙ, на месте прежней кнопки «Фильтры»: по
            регламенту настройки живут у правого края, а фильтры теперь её
            вкладка — отдельной кнопки у них больше нет. Седьмой контрол в
            полосе не читался, а по смыслу предикаты — та же настройка
            взгляда на таблицу, что и пороги. */}
        {onThresholds ? (
          <CompareSettings
            thresholds={thresholds}
            onChange={onThresholds}
            allRows={allRows}
            filters={view.filters}
            onFilters={(filters) => onPatch({ filters })}
          />
        ) : null}
        </div>
      </div>
    </DropdownGroup>
  );
}

/** Тихий триггер одиночного выбора: подпись secondary, значение medium,
 *  шеврон. Одиночный выбор закрывает меню — выбрал и ушёл. */
function QuietSelect<T extends string>({ slot, cap, icon, value, options, onPick }: {
  slot: string;
  cap: string;
  icon?: 'list';
  value: T;
  options: ReadonlyArray<{ id: T; label: string }>;
  onPick: (value: T) => void;
}) {
  const control = useDropdownSlot(slot);
  const current = options.find((o) => o.id === value);

  return (
    <Dropdown {...control} menuAlign="left" menu={(
      <>
        {options.map((option) => (
          <MenuItem
            key={option.id}
            checked={option.id === value}
            onSelect={() => onPick(option.id)}
          >
            {option.label}
          </MenuItem>
        ))}
      </>
    )}
    >
      {(trigger) => (
        <button {...trigger} className={s.trigger}>
          {icon ? <Icon name={icon} className={s.triggerIcon} /> : null}
          <span className={s.triggerCap}>{cap}</span>
          <span className={s.triggerVal}>{current?.label}</span>
          <Icon name="caretSmall" className={s.triggerCaret} />
        </button>
      )}
    </Dropdown>
  );
}
