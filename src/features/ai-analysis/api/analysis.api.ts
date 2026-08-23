/** ЕДИНСТВЕННАЯ ДВЕРЬ К РАЗБОРУ. Панель не знает, кто его сделал: сегодня —
 *  код в браузере, завтра — эндпоинт, за которым стоит модель. Подмена стоит
 *  ровно этого файла, потому что за его пределами ни `buildAnalysis`, ни
 *  `applyNarration` не упоминаются нигде.
 *
 *  ФУНКЦИЯ АСИНХРОННА УЖЕ СЕЙЧАС по той же причине, что и `comparison.api.ts`:
 *  синхронный разбор разошёлся бы с сетью в тот день, когда её подключат, — у
 *  панели не оказалось бы ни ожидания, ни места под ошибку.
 *
 *  ── ЧТО ИМЕННО МЕНЯЕТСЯ В ДЕНЬ ПОДКЛЮЧЕНИЯ ─────────────────────────────────
 *  Тело `requestAnalysis()`, и больше ничего:
 *
 *      const res = await fetch(`/tenders/${tenderId}/analysis`, {
 *        method: 'POST',
 *        body: JSON.stringify({ analysis_request: requestOf(query) }),
 *      });
 *      const { result, ai } = await res.json();
 *      return applyNarration(result, ai);
 *
 *  Половины разъезжаются по разные стороны сети ровно по своей границе:
 *  - `buildAnalysis()` (отбор, порядок, ВСЕ числа) уезжает на сервер целиком;
 *  - `applyNarration()` (чужой текст в слот `note`) остаётся здесь как
 *    последняя проверка перед показом, даже если сервер проверил своё (06 §6):
 *    отбросить неподтверждённое число дешевле, чем показать его.
 *
 *  Промежуточный шаг тоже возможен и ничего не ломает: снимок и заготовку
 *  строит клиент, а `AiResponse` приходит от модели — подменяется одна строка
 *  `narration`.
 *
 *  ЧЕГО ЗДЕСЬ НЕТ НАМЕРЕННО. Ключей модели, имени провайдера и промптов: КП —
 *  данные ограниченного контура, и запрос к модели уходит с сервера в
 *  утверждённом профиле обработки (06 §10). Клиент просит РАЗБОР, а не
 *  генерацию. */

import { hasPreviousRound, type Comparison, type CompareThresholds } from '@/entities/comparison';
import { reducedMotion } from '@/shared/lib/reducedMotion';
import { buildAnalysis, type AnalysisResult, type AnalysisSectionId } from '../model/analysis';
import { applyNarration, type AiResponse } from '../model/narration';

/** ДЕМО-задержка вместо ответа модели, мс. Уедет вместе с запросом к ней;
 *  при выключенном движении — короче, ждать нечего. */
const DEMO_DELAY = { normal: 800, reduced: 300 };

export interface AnalysisQuery {
  tenderId: string;
  /** Круг, по которому строится разбор. Хранится результат тоже по нему
   *  (05 §8.1): перезапуск заменяет разбор СВОЕГО раунда и никогда чужого. */
  round: number;
  /** Снимок КП. С эндпоинтом уйдёт: сервер берёт данные у себя, и в запросе
   *  останутся `tenderId`, `round` и пороги. Сегодня считает клиент, поэтому
   *  снимок передаётся явным аргументом — как и везде в этом коде. */
  comparison: Comparison;
  /** Снимок предыдущего круга — база двух первых секций. */
  prevComparison?: Comparison;
  /** Пороги тендера. Идут в запросе снимком: разбор строится ПО НИМ, и
   *  сохранённый результат устаревает частично именно относительно них
   *  (05 §8.2). */
  thresholds: CompareThresholds;
}

/** Состав секций запроса (06 §3, `analysis_request.sections`). Определяется
 *  ДАННЫМИ, а не выбором пользователя: без предыдущего круга у изменений нет
 *  базы, и просить их не у чего. */
export const sectionsFor = (comparison: Comparison): AnalysisSectionId[] =>
  hasPreviousRound(comparison)
    ? ['supplier_changes', 'round_summary', 'base_review']
    : ['base_review'];

/** Тело `analysis_request` по 06 §3 — то, что уйдёт в запрос как есть.
 *  Отдельной функцией, чтобы состав запроса было видно одним взглядом и
 *  чтобы его можно было проверить без сети. */
export const requestOf = (query: AnalysisQuery) => ({
  trigger: 'manual_run' as const,
  tender_id: query.tenderId,
  round_id: query.round,
  previous_round_id: query.prevComparison ? query.round - 1 : null,
  sections: sectionsFor(query.comparison),
  thresholds: query.thresholds,
  requested_at: new Date().toISOString(),
});

/**
 * Разбор тендера: один запуск — один результат (05 §1).
 *
 * `null` — разбирать нечего (ни сметы, ни КП); панель обязана назвать причину,
 * а не показывать пустой разбор. Исключение — сбой: он летит наверх, и панель
 * показывает «Анализ не выполнен» с повтором, не трогая таблицу (05 §9).
 */
export async function requestAnalysis(query: AnalysisQuery): Promise<AnalysisResult | null> {
  const built = buildAnalysis(query.comparison, query.prevComparison, query.thresholds);
  if (!built) return null;

  /* ЗДЕСЬ ЖИВЁТ МОДЕЛЬ. Сегодня в слот подставляется заготовка той же формы,
     что придёт ответом (06 §5) — она проходит те же проверки и те же лимиты,
     поэтому подмена не меняет ни одной строки ниже. */
  const narration: AiResponse = built.draft;

  await new Promise((done) => {
    window.setTimeout(done, reducedMotion() ? DEMO_DELAY.reduced : DEMO_DELAY.normal);
  });

  return applyNarration(built.result, narration);
}
