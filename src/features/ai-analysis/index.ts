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

   Правила отбора (`insights.ts`) наружу не идут: за них отвечает панель, и
   вопрос «а что здесь важного» задают ей, а не импортом. */
export {
  ANALYSIS_LIMITS, buildAnalysis,
  type AnalysisEvidence, type AnalysisItem, type AnalysisRef,
  type AnalysisResult, type AnalysisSection, type AnalysisSectionId,
  type AnalysisSubsectionId, type AnalysisTransition,
} from './model/analysis';
