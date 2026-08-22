export {
  ROWS, STATUS, STATUS_IDS, FACETS, EMPTY_FILTERS,
  activeCount, applyFilters, bidsDue, panelCount, tenderById, tenderPath,
  type BidsDue, type DueMode, type Filters, type StatusId, type TenderRow,
} from './model/registry';
export {
  analyzeComparison, applyTransition, BID_STATUS, bidStatus, cellMark,
  DEV_TOLERANCE, decimal, deviationPct, filterRows, flatten, groupSum,
  hasAnomaly, hasPreviousRound, isModifiedView, METRIC_LABEL, medianOf, money,
  POTENTIAL_MIN, PREDICATES, predicateCount, predicatePasses,
  PRESETS, PRESET_LABEL, rankBids, ROW_VIEW_LABEL, shownMetrics,
  snapshotRound, SPREAD_HIGH, SPREAD_NOTICEABLE, spread, sumOf,
  type Bid, type BidStatusId, type CellMark, type CompareMetricId,
  type Comparison, type ComparisonFacts, type ComparePosition, type CompareView,
  type Contractor, type PredicateId, type PositionGroup, type PresetId,
  type RowFacts, type RowViewId, type RoundStatus, type ComparisonRound,
} from './model/comparison';
/* Демо-данные — отдельным импортом и с отдельным именем: подменить их ответом
   API значит убрать ровно эту строку и то место, где её берут. */
export {
  MOCK_COMPARISON, MOCK_ROUND1, MOCK_ROUND2_FULL, MOCK_ROUND2_PARTIAL,
} from './model/comparison.mock';
/* Правила «Анализа»: сценарии и карточки выводятся из тех же чисел сравнения.
   Отдельным модулем, но за той же публичной точкой — потребителю фичи всё
   равно, в каком файле живёт формула. */
export {
  SCENARIOS, deriveInsights, scenarioPreset,
  type Insight, type ScenarioId,
} from './model/insights';
/* Разбор тендера (ИИ-анализ): серверная половина контракта 06 §5.1 — отбор,
   числа и переходы; слот модели заполнен заготовками до подключения модели. */
export {
  ANALYSIS_LIMITS, buildAnalysis,
  type AnalysisEvidence, type AnalysisItem, type AnalysisRef,
  type AnalysisResult, type AnalysisSection, type AnalysisSectionId,
  type AnalysisSubsectionId, type AnalysisTransition,
} from './model/analysis';
