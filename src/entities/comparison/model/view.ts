/** Состояние экрана сравнения: оси модели ячейки, пресеты и переход из
 *  разбора. Данных не касается вовсе — это описание СРЕЗА, а не его
 *  содержимого, поэтому живёт отдельно от контракта и счёта.
 *
 *  МОДЕЛЬ ЯЧЕЙКИ И КОНТРОЛОВ — источника 22.08.2026 (`ct-workspace-model.md`):
 *  основной показатель ровно один (селект), отклонение и ставка — СПУТНИКИ
 *  стоимости, а не равноправные показатели. Стоимость присутствует в ячейке
 *  всегда; состав строк ячейки кодирует `cellLines()`, пресеты и переход из
 *  анализа выражаются через те же оси. «Набора показателей с меткой главного»
 *  больше нет. */

import type { PredicateId } from './filters';

/** Основные показатели ячейки — закрытое перечисление по правилу
 *  размерности (источник §1): основным может быть только то, что суммируется
 *  в подытог. Отклонение — характеристика стоимости (%), ставка — производная
 *  (₽/ед.), обе живут спутниками, а не здесь. */
export type CompareMetricId = 'cost' | 'potential';

/** Спутники стоимости — галочки панели таблицы. Описывают стоимость, поэтому
 *  НЕ зависят от селекта основного: она в ячейке есть всегда. */
export type SatelliteId = 'deviation' | 'rate';

export const SATELLITE_LABEL: Record<SatelliteId, string> = {
  deviation: 'Отклонение',
  rate: 'Ставка',
};

export type RowViewId = 'sections' | 'weight' | 'potential';

export interface CompareView {
  preset: PresetId;
  mainMetric: CompareMetricId;
  showDeviation: boolean;
  showRate: boolean;
  rowView: RowViewId;
  filters: PredicateId[];
}

export type PresetId = 'overview' | 'bidding' | 'anomalies';

/** Пресет — не фильтр, а сохранённая комбинация ВСЕХ осей модели: основной
 *  показатель, спутники, вид строк, активные предикаты. Один клик — ответ на
 *  один вопрос: что вообще предложили → где можно отжать → где врут.
 *  Присваивает оси ЦЕЛИКОМ и своей логики не имеет: всё, что пресет делает,
 *  повторяется руками теми же контролами (источник §2).
 *
 *  «Аномалии»: основной «Отклонение» упразднён вместе с моделью наборов —
 *  режим собирается из стоимости с галочкой отклонения и фильтров разброса и
 *  аномалий; порядок строк отдаётся весу, потому что риск смотрят сверху вниз
 *  по влиянию на итог. */
export const PRESETS: Record<PresetId, Omit<CompareView, 'preset'>> = {
  overview: { mainMetric: 'cost', showDeviation: false, showRate: false, rowView: 'sections', filters: [] },
  bidding: { mainMetric: 'potential', showDeviation: false, showRate: false, rowView: 'potential', filters: ['pot'] },
  anomalies: { mainMetric: 'cost', showDeviation: true, showRate: false, rowView: 'weight', filters: ['spread', 'anomaly'] },
};

export const PRESET_LABEL: Record<PresetId, string> = {
  overview: 'Обзор',
  bidding: 'Торги',
  anomalies: 'Аномалии',
};

export const METRIC_LABEL: Record<CompareMetricId, string> = {
  cost: 'Стоимость', potential: 'Потенциал',
};

export const ROW_VIEW_LABEL: Record<RowViewId, string> = {
  /* Термин владельца (24.08.2026): группы сметы — «секции». */
  sections: 'По секциям', weight: 'По весу', potential: 'По потенциалу',
};

/** Строка ячейки в терминах модели: главное число, база-стоимость или
 *  справочная ставка. */
export type CellLine =
  | { kind: 'main'; metric: CompareMetricId }
  | { kind: 'base' }
  | { kind: 'rate' };

/** Состав строк ячейки — единственное место, знающее правила источника §1:
 *
 *  1. основной показатель — ровно одна первая строка;
 *  2. стоимость присутствует всегда: если основной не она — второй строкой
 *     как база (константа режима, а не опция);
 *  3. отклонение липнет к стоимости суффиксом на той строке, где она стоит;
 *  4. ставка — последней строкой, по галочке;
 *  5. порядок ФИКСИРОВАН и не зависит от того, в какой последовательности
 *     что включали: соседние колонки обязаны сравниваться построчно;
 *  6. подписей словами нет — различают порядок строк и порядок величин.
 *
 *  Рендер читает план, а не придумывает состав сам: так правило №5 нельзя
 *  нарушить локальной правкой ячейки. */
export function cellLines(view: CompareView): { lines: CellLine[]; deviationOn: 'main' | 'base' | null } {
  const lines: CellLine[] = [{ kind: 'main', metric: view.mainMetric }];
  const deviationOn = view.showDeviation
    ? view.mainMetric === 'cost' ? 'main' : 'base'
    : null;
  if (view.mainMetric !== 'cost') lines.push({ kind: 'base' });
  if (view.showRate) lines.push({ kind: 'rate' });
  return { lines, deviationOn };
}

/** Словарь показателей протокола ИИ (06-ai-contract.md §5): контракт старше
 *  новой модели ячейки и говорит прежними именами. Отображение на оси — в
 *  `applyTransition`; до переноса протокола в канон семантика наша. */
export type TransitionMetricId = 'cost' | 'price' | 'deviation' | 'potential';

/** Переход «анализ → таблица» (06-ai-contract.md §5, §7): пресет задаёт все
 *  оси целиком; required_metrics лишь ДОБАВЛЯЕТ то, что нужно для прочтения
 *  вывода. Отображение старого словаря контракта на новые оси:
 *  - `price` / `cost` — no-op: стоимость в ячейке есть всегда (§1, правило 2);
 *  - `deviation` — включает галочку отклонения;
 *  - `potential` — ставит потенциал ОСНОВНЫМ: в новой модели он виден только
 *    так, отдельного спутника у него нет. */
export function applyTransition(
  view: CompareView,
  transition?: { preset: PresetId; requiredMetrics?: TransitionMetricId[] },
): CompareView {
  if (!transition) return view;
  const base = PRESETS[transition.preset];
  const next: CompareView = {
    preset: transition.preset,
    mainMetric: base.mainMetric,
    showDeviation: base.showDeviation,
    showRate: base.showRate,
    rowView: base.rowView,
    filters: [...base.filters],
  };
  for (const metric of transition.requiredMetrics ?? []) {
    if (metric === 'deviation') next.showDeviation = true;
    if (metric === 'potential') next.mainMetric = 'potential';
  }
  return next;
}

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((x) => b.includes(x));

/** Ушли ли от базы пресета хоть по одной из осей. Молча терять это нельзя:
 *  пользователь обязан видеть, что смотрит не на «Обзор», а на свою
 *  собственную нарезку. */
export const isModifiedView = (view: CompareView): boolean => {
  const base = PRESETS[view.preset];
  return view.mainMetric !== base.mainMetric
    || view.showDeviation !== base.showDeviation
    || view.showRate !== base.showRate
    || view.rowView !== base.rowView
    || !sameSet(view.filters, base.filters);
};
