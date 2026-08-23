import { useEffect, useRef, useState } from 'react';
import { snapshotRound, type Comparison, type CompareThresholds } from '@/entities/comparison';
import { requestAnalysis } from '../api/analysis.api';
import type { AnalysisResult } from './analysis';

/** Сохранённый разбор круга вместе с тем, ПО ЧЕМУ он построен: ревизия данных
 *  и снимок порогов. Сравнение этих двух с текущими и есть «устарел» —
 *  каждое даёт СВОЮ степень (05 §8.2), поэтому хранятся оба. */
interface Run {
  result: AnalysisResult;
  rev: string;
  thresholds: CompareThresholds;
}

/** Степени устаревания по 05 §8.2. Различать их обязательно: «пороги
 *  изменились» ничего не говорит о данных — числа те же, иначе расставлены
 *  метки; «ревизия ушла вперёд» означает, что разбор описывает другие КП. */
export type Staleness =
  | { level: 'partial'; reason: string }
  | { level: 'stale'; reason: string }
  | null;

const THRESHOLD_LABEL: Record<keyof CompareThresholds, string> = {
  spreadNoticeable: 'заметный разброс',
  spreadHigh: 'высокий разброс',
  anomalyK: 'коэффициент аномалии',
  keyShare: 'доля ключевых работ',
};

/** Чем именно разошлись пороги — плашка обязана НАЗЫВАТЬ причину, а не
 *  сообщать факт («старые и текущие пороги», 05 §8.2). */
const thresholdDiff = (was: CompareThresholds, now: CompareThresholds): string | null => {
  const moved = (Object.keys(THRESHOLD_LABEL) as Array<keyof CompareThresholds>)
    .filter((k) => was[k] !== now[k])
    .map((k) => `${THRESHOLD_LABEL[k]} ${was[k]} → ${now[k]}`);
  return moved.length ? `Изменены пороги: ${moved.join(', ')}` : null;
};

/**
 * Запуски разбора по раундам: что уже посчитано, что считается сейчас, что
 * устарело.
 *
 * КОГДА:  панель «Анализ ИИ» — единственный потребитель. Отдельным модулем,
 *         потому что здесь три связанных правила (§8 контракта), и в теле
 *         компонента они тонули между разметкой секций.
 * НЕ ДЛЯ: самого текста разбора (`api/analysis.api.ts` — там его источник) и
 *         не для состояния таблицы (`useCompareScreen` на странице).
 *
 * UX:     РЕЗУЛЬТАТ ХРАНИТСЯ ПО НОМЕРУ РАУНДА: перезапуск заменяет разбор
 *         СВОЕГО круга и никогда — чужого (05 §8.1). Сохранённый разбор
 *         прошлого раунда — снимок завершённого события, он не устаревает и
 *         не пересчитывается: плашка живёт только у текущего круга.
 *         ЗАПУСК ВОЗМОЖЕН ТОЛЬКО ПО ДАННЫМ РАУНДА, КОТОРЫЙ СЕЙЧАС НА ЭКРАНЕ:
 *         панель не пересчитывает прошлое и не угадывает будущее.
 *         ВЫБОР РАУНДА ЕДЕТ ЗА ДАННЫМИ ТОЛЬКО ВПЕРЁД: начался новый круг —
 *         панель показывает его, потому что прежний выбор стал прошлым. Новая
 *         подача ВНУТРИ круга выбор не трогает: на неё отвечает плашка, а не
 *         подмена экрана под руками.
 *         СБОЙ РАЗБОРА НЕ ТРОГАЕТ ТАБЛИЦУ — считает отдельно и падает
 *         отдельно; наружу уходит null, и попапы ячеек возвращаются к числам.
 */
export function useAnalysisRuns({ tenderId, comparison, prevComparison, thresholds, onResultChange }: {
  tenderId: string;
  comparison: Comparison;
  prevComparison?: Comparison | null;
  thresholds: CompareThresholds;
  onResultChange?: (result: AnalysisResult | null) => void;
}) {
  const [runs, setRuns] = useState<Record<number, Run>>({});
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState(false);
  const dataRound = snapshotRound(comparison);
  const [roundNo, setRoundNo] = useState(dataRound);

  /* Круг данных ушёл вперёд — панель едет за ним. Без этого второй раунд был
     недостижим: выбор оставался на первом и объяснял, что «разбора этого
     раунда нет», хотя новый круг уже шёл. */
  const seenRound = useRef(dataRound);
  useEffect(() => {
    if (dataRound > seenRound.current) {
      seenRound.current = dataRound;
      setRoundNo(dataRound);
    }
  }, [dataRound]);

  /* Живость запуска: медленный ответ по прошлому раунду не имеет права лечь
     поверх нового. Тот же флаг, что и в useAsync, и по той же причине. */
  const runId = useRef(0);
  useEffect(() => () => { runId.current += 1; }, []);

  /* Ревизия — ПОЛЕ ОТВЕТА, а не проп страницы: о подаче КП знает только
     источник данных, и разбор устаревает именно относительно него. */
  const rev = comparison.revision ?? '';
  const rounds = comparison.rounds ?? [];
  const round = rounds.find((r) => r.number === roundNo);
  const entry = runs[roundNo];
  const isDataRound = roundNo === dataRound;

  /* Снимок завершённого круга не устаревает: он описывает то, что уже
     случилось, и пересчитывать его нечем (05 §8.2). */
  const staleness: Staleness = !entry || round?.status === 'closed' ? null
    : entry.rev !== rev
      ? { level: 'stale', reason: comparison.revisionNote ?? 'Данные тендера изменились' }
      : (() => {
        const moved = thresholdDiff(entry.thresholds, thresholds);
        return moved ? { level: 'partial' as const, reason: moved } : null;
      })();

  /* База секций сравнения кругов — только НЕПОСРЕДСТВЕННО предыдущий раунд:
     разбор отвечает на «что изменилось с прошлого раза», а не «с любого». */
  const prev = prevComparison && snapshotRound(prevComparison) === roundNo - 1
    ? prevComparison
    : undefined;

  const run = async () => {
    if (running || !comparison.contractors.length) return;
    const id = (runId.current += 1);
    setFailed(false);
    setRunning(true);
    try {
      const result = await requestAnalysis({
        tenderId, round: roundNo, comparison, prevComparison: prev, thresholds,
      });
      if (id !== runId.current) return;
      if (!result) {
        setFailed(true);
        onResultChange?.(null);
      } else {
        setRuns((all) => ({ ...all, [roundNo]: { result, rev, thresholds } }));
        onResultChange?.(result);
      }
    } catch {
      if (id !== runId.current) return;
      setFailed(true);
      onResultChange?.(null);
    } finally {
      if (id === runId.current) setRunning(false);
    }
  };

  return {
    runs, entry, running, failed, run,
    roundNo, setRoundNo, rounds, round, isDataRound, staleness,
  };
}
