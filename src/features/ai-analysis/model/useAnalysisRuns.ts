import { useEffect, useRef, useState } from 'react';
import { snapshotRound, type Comparison, type CompareThresholds } from '@/entities/comparison';
import { reducedMotion } from '@/shared/lib/reducedMotion';
import { buildAnalysis, type AnalysisResult } from './analysis';

/** ДЕМО-задержка вместо ответа модели, мс. Уедет вместе с запросом к ней;
 *  при выключенном движении — короче, ждать нечего. */
const DEMO_DELAY = { normal: 800, reduced: 300 };

/**
 * Запуски разбора по раундам: что уже посчитано, что считается сейчас, что
 * устарело.
 *
 * КОГДА:  панель «Анализ ИИ» — единственный потребитель. Отдельным модулем,
 *         потому что здесь три связанных правила (§8 контракта), и в теле
 *         компонента они тонули между разметкой секций.
 * НЕ ДЛЯ: самого текста разбора (`analysis.ts` — там правила отбора) и не для
 *         состояния таблицы (`useCompareScreen` на странице).
 *
 * UX:     РЕЗУЛЬТАТ ХРАНИТСЯ ПО НОМЕРУ РАУНДА: перезапуск заменяет разбор
 *         СВОЕГО круга и никогда — чужого (05 §8.1). Сохранённый разбор
 *         прошлого раунда — снимок завершённого события, он не устаревает и
 *         не пересчитывается: плашка устаревания живёт только у текущего
 *         круга и только когда ревизия ответа ушла вперёд (05 §8.2).
 *         ЗАПУСК ВОЗМОЖЕН ТОЛЬКО ПО ДАННЫМ РАУНДА, КОТОРЫЙ СЕЙЧАС НА ЭКРАНЕ:
 *         панель не пересчитывает прошлое и не угадывает будущее.
 *         СБОЙ РАЗБОРА НЕ ТРОГАЕТ ТАБЛИЦУ — считает отдельно и падает
 *         отдельно; наружу уходит null, и попапы ячеек возвращаются к числам.
 */
export function useAnalysisRuns({ comparison, prevComparison, thresholds, onResultChange }: {
  comparison: Comparison;
  prevComparison?: Comparison | null;
  thresholds: CompareThresholds;
  onResultChange?: (result: AnalysisResult | null) => void;
}) {
  /* Сохранённые разборы ПО РАУНДАМ вместе с ревизией данных, на которой они
     построены: сравнение этой ревизии с текущей и есть «устарел». */
  const [runs, setRuns] = useState<Record<number, { result: AnalysisResult; rev: string }>>({});
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState(false);
  const [roundNo, setRoundNo] = useState(() => snapshotRound(comparison));

  const runTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(runTimer.current), []);

  /* Ревизия — ПОЛЕ ОТВЕТА, а не проп страницы: о подаче КП знает только
     источник данных, и разбор устаревает именно относительно него. */
  const rev = comparison.revision ?? '';
  const rounds = comparison.rounds ?? [];
  const round = rounds.find((r) => r.number === roundNo);
  const entry = runs[roundNo];
  const isDataRound = roundNo === snapshotRound(comparison);

  const staleReason = entry && entry.rev !== rev && round?.status !== 'closed'
    ? comparison.revisionNote ?? 'Данные тендера изменились'
    : null;

  /* База секций сравнения кругов — только НЕПОСРЕДСТВЕННО предыдущий раунд:
     разбор отвечает на «что изменилось с прошлого раза», а не «с любого». */
  const prev = prevComparison && snapshotRound(prevComparison) === roundNo - 1
    ? prevComparison
    : undefined;

  const run = () => {
    if (running || !comparison.contractors.length) return;
    setFailed(false);
    setRunning(true);
    runTimer.current = window.setTimeout(() => {
      try {
        const result = buildAnalysis(comparison, prev, thresholds);
        if (!result) {
          setFailed(true);
          onResultChange?.(null);
        } else {
          setRuns((all) => ({ ...all, [roundNo]: { result, rev } }));
          onResultChange?.(result);
        }
      } catch {
        setFailed(true);
        onResultChange?.(null);
      }
      setRunning(false);
    }, reducedMotion() ? DEMO_DELAY.reduced : DEMO_DELAY.normal);
  };

  return { runs, entry, running, failed, run, roundNo, setRoundNo, rounds, round, isDataRound, staleReason };
}
