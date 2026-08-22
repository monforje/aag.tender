export {
  ROWS, STATUS, STATUS_IDS, FACETS, EMPTY_FILTERS,
  activeCount, applyFilters, bidsDue, panelCount, tenderById, tenderPath,
  type BidsDue, type DueMode, type Filters, type StatusId, type TenderRow,
} from './model/registry';
export {
  analyzeComparison, BID_STATUS, bidStatus, cellMark,
  DEV_TOLERANCE, decimal, deviationPct, filterRows, flatten, groupSum,
  hasAnomaly, isModifiedView, METRIC_LABEL, medianOf, money,
  POTENTIAL_MIN, PREDICATES, predicateCount, predicatePasses,
  PRESETS, PRESET_LABEL, rankBids, ROW_VIEW_LABEL, shownMetrics,
  SPREAD_HIGH, SPREAD_NOTICEABLE, spread, sumOf,
  type Bid, type BidStatusId, type CellMark, type CompareMetricId,
  type Comparison, type ComparisonFacts, type ComparePosition, type CompareView,
  type Contractor, type PredicateId, type PositionGroup, type PresetId,
  type RowFacts, type RowViewId,
} from './model/comparison';
/* Демо-данные — отдельным импортом и с отдельным именем: подменить их ответом
   API значит убрать ровно эту строку и то место, где её берут. */
export { MOCK_COMPARISON } from './model/comparison.mock';
/* Правила «Анализа»: сценарии и карточки выводятся из тех же чисел сравнения.
   Отдельным модулем, но за той же публичной точкой — потребителю фичи всё
   равно, в каком файле живёт формула. */
export {
  SCENARIOS, deriveInsights, scenarioPreset,
  type Insight, type ScenarioId,
} from './model/insights';
