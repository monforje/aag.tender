/* Публичный API фичи «Анализ». Внутрь слайса не заходить — всё, чем фича
   делится, перечислено здесь. */
export { AnalysisDock } from './ui/AnalysisDock';
export { AiDock, AI_DOCK_ID } from './ui/AiDock';
export { AiTrigger, AI_TRIGGER_ID } from './ui/AiTrigger';

/* Контракт разбора. Живёт в ФИЧЕ, а не в entities, и это переезд, а не
   исходное место: правила «что сказать о числах» читает только эта панель,
   тогда как сами числа (`@/entities/comparison`) читают ещё таблица, карточки
   и фильтры. Домену незачем знать про формулировки — а вот странице нужны
   ДВА типа: результат разбора она держит ради комментариев к ячейкам, переход
   «анализ → таблица» — ради среза. Оба идут отсюда.

   Правила отбора (`analysis.ts`), проверка чужого текста (`narration.ts`) и
   дверь к разбору (`api/analysis.api.ts`) наружу НЕ идут: вопрос «а что здесь
   важного» задают панели, а не импортом. Подключение живой модели — правка
   тела ОДНОЙ функции внутри слайса, и снаружи её не должно быть видно. */
export {
  ANALYSIS_LIMITS, buildAnalysis,
  type AnalysisEvidence, type AnalysisItem, type AnalysisRef,
  type AnalysisResult, type AnalysisSection, type AnalysisSectionId,
  type AnalysisSubsectionId, type AnalysisTransition,
} from './model/analysis';
