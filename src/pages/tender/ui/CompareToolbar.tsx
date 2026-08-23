import { type ReactElement } from 'react';
import { cx } from '@/shared/lib/cx';
import { toggle } from '@/shared/lib/toggle';
import { Button } from '@/shared/ui/Button';
import {
  Dropdown, DropdownGroup, MenuItem, MenuPanel, useDropdownSlot,
} from '@/shared/ui/Dropdown';
import { Icon } from '@/shared/ui/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import { Segmented } from '@/shared/ui/Segmented';
import { Switch } from '@/shared/ui/Switch';
import {
  METRIC_LABEL, PREDICATES, PRESET_LABEL, ROW_VIEW_LABEL, SATELLITE_LABEL,
  predicateCount,
  type CompareMetricId, type CompareThresholds, type CompareView,
  type PredicateId, type PresetId, type RowFacts, type RowViewId, type SatelliteId,
} from '@/entities/tender';
import { AnomalyGlyph, CoinMark, KeyMark, MedMark, SpreadMark } from './assets';
import { CompareLegend } from './CompareLegend';
import { CompareSettings } from './CompareSettings';
import s from './CompareToolbar.module.css';

const METRICS = Object.keys(METRIC_LABEL) as CompareMetricId[];
const ROW_VIEWS = Object.keys(ROW_VIEW_LABEL) as RowViewId[];
const SATELLITES = Object.keys(SATELLITE_LABEL) as SatelliteId[];

/* Глиф предиката в меню фильтров — ТОТ ЖЕ маркер, что красит ячейки таблицы:
   один смысл — один глиф везде. Посажены на фиксированную колонку 26px,
   поэтому названия пунктов стоят на одной вертикали. */
const PREDICATE_GLYPH: Record<PredicateId, ReactElement> = {
  key: <KeyMark />,
  spread: <SpreadMark />,
  anomaly: <AnomalyGlyph />,
  pot: <CoinMark />,
  med: <MedMark />,
};

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

        {/* Д.2: любое ручное движение поднимает чип. Единственное его действие —
            повторное применение текущего пресета, то есть возврат к базе.
            Чип «Вид изменён анализом» сильнее: он восстанавливает ВЕСЬ вид
            пользователя до перехода и пока он висит, этот — спрятан. */}
        {analysisApplied && onRestoreView ? (
          <button
            type="button"
            className={s.modchip}
            title="Разбор перестроил таблицу — вернуть ваш вид целиком"
            onClick={onRestoreView}
          >
            <Icon name="reply" className={s.modchipIcon} />
            Вид изменён анализом · Вернуть мой вид
          </button>
        ) : modified ? (
          <button
            type="button"
            className={s.modchip}
            title="Состояние ушло от базы пресета — вернуть исходную нарезку"
            onClick={() => onPreset(view.preset)}
          >
            <Icon name="reply" className={s.modchipIcon} />
            Изменён · Сброс
          </button>
        ) : null}

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
            селекта. Мгновенное применение без формы — это <Switch>. */}
        <div className={s.satellites} role="group" aria-label="Спутники стоимости">
          {SATELLITES.map((id) => (
            <label key={id} className={s.satellite}>
              <Switch
                checked={id === 'deviation' ? view.showDeviation : view.showRate}
                onChange={(checked) => onPatch(
                  id === 'deviation' ? { showDeviation: checked } : { showRate: checked },
                )}
                aria-label={`Показывать: ${SATELLITE_LABEL[id]}`}
              />
              {SATELLITE_LABEL[id]}
            </label>
          ))}
        </div>

        {/* Секция 3: пороги тендера — окно по значку ⚙. */}
        {onThresholds ? (
          <CompareSettings
            thresholds={thresholds}
            onChange={onThresholds}
            allRows={allRows}
          />
        ) : null}

        <QuietSelect
          slot="compare-rows"
          icon="list"
          cap="Строки:"
          value={view.rowView}
          options={ROW_VIEWS.map((id) => ({ id, label: ROW_VIEW_LABEL[id] }))}
          onPick={(rowView) => onPatch({ rowView })}
        />

        <span className={s.spacer} />
        <CompareLegend thresholds={thresholds} />
        <FiltersMenu view={view} allRows={allRows} onPatch={onPatch} />
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

/** Предикаты — ОДИН триггер «Фильтры» с каунтером выбранных и поповером
 *  чек-листа. Комбинируются по И; меню не закрывается по клику. */
function FiltersMenu({ view, allRows, onPatch }: {
  view: CompareView;
  allRows: RowFacts[];
  onPatch: (patch: Partial<Omit<CompareView, 'preset'>>) => void;
}) {
  const control = useDropdownSlot('compare-filters');
  const active = view.filters;

  return (
    <Dropdown
      {...control}
      menuAlign="right"
      closeOnSelect={false}
      menu={(
        <MenuPanel
          className={s.panel}
          footer={(
            <>
              <Button
                variant="secondary"
                disabled={!active.length}
                onClick={() => onPatch({ filters: [] })}
              >
                Сбросить всё
              </Button>
              <Button variant="primary" onClick={control.onClose}>Готово</Button>
            </>
          )}
        >
          <div className={s.predicates}>
            {PREDICATES.map((predicate) => {
              const count = predicateCount(predicate.id, allRows);
              return (
                <button
                  key={predicate.id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={active.includes(predicate.id)}
                  className={cx(s.predicate, !count && s.predicateEmpty)}
                  onClick={() => onPatch({ filters: toggle(active, predicate.id) })}
                >
                  <span className={s.predicateGlyph}>{PREDICATE_GLYPH[predicate.id]}</span>
                  <span className={s.predicateLabel}>{predicate.label}</span>
                  <span className={s.predicateCount}>{count}</span>
                  <span className={s.predicateCheck} aria-hidden="true">
                    <Icon name="checkCircle" />
                  </span>
                </button>
              );
            })}
          </div>
        </MenuPanel>
      )}
    >
      {(trigger) => (
        /* Тот же триггер, что у «Фильтров» реестра: глиф 32×32 без подписи,
           счётчик выбранных — значком в углу. Подпись «Фильтры» рядом с
           сегментом и двумя дропдаунами читалась третьей кнопкой в ряд;
           состояние уходит в aria-label и значок ([R1]). */
        <IconButton
          {...trigger}
          variant="topbar"
          icon="filter"
          label={active.length ? `Фильтры · ${active.length}` : 'Фильтры'}
          active={active.length > 0}
          badge={active.length ? <span className={s.btnBadge}>{active.length}</span> : null}
        />
      )}
    </Dropdown>
  );
}
