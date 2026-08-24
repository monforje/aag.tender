import { useState } from 'react';
import {
  fetchComparison, simulateNextSubmission, snapshotRound,
  type Comparison,
} from '@/entities/comparison';
import { useAsync } from '@/shared/lib/useAsync';

/**
 * Данные сравнения по тендеру: текущий снимок и предыдущий круг под ним.
 *
 * КОГДА:  карточка тендера — единственное место, где сравнение просят у
 *         сервера. Разделы получают его пропами и о происхождении данных не
 *         знают: потому и переживут подмену мока запросом.
 * НЕ ДЛЯ: состояния экрана (см. useCompareScreen) — здесь только данные.
 *
 * UX:     ПРОШЛЫЙ КРУГ ГРУЗИТСЯ ВТОРЫМ ЗАПРОСОМ и только когда он есть:
 *         секции «Изменения поставщика» и «Общая картина» существуют ровно
 *         потому, что появилось с чем сравнивать (05 §4), и в первом раунде
 *         их отсутствие — норма, а не пустая секция. Ждать его отдельно
 *         незачем — он приезжает вместе с текущим одним промисом, иначе
 *         таблица успела бы отрисоваться и дёрнуться во второй раз.
 *
 *         ДЕМО-ПОДАЧА («Раунды» → «Смоделировать подачу») перечитывает
 *         данные тем же путём, что и первая загрузка: ревизия ответа растёт,
 *         и сохранённый разбор помечается устаревшим (05 §8.2).
 */
export function useComparisonData(tenderId: string) {
  /* Локальный счётчик подач — повод перечитать, а не источник данных.
     Настоящую ленту держит сервер (сегодня — модуль api). */
  const [submissions, setSubmissions] = useState(0);

  const state = useAsync(async (): Promise<{
    comparison: Comparison | null;
    prev: Comparison | null;
  }> => {
    const comparison = await fetchComparison({ tenderId });
    if (!comparison) return { comparison: null, prev: null };
    const round = snapshotRound(comparison);
    const prev = round > 1
      ? await fetchComparison({ tenderId, round: round - 1 })
      : null;
    return { comparison, prev };
  }, [tenderId, submissions]);

  return {
    comparison: state.data?.comparison ?? null,
    prevComparison: state.data?.prev ?? null,
    loading: state.loading,
    error: state.error,
    reload: state.reload,
    /** ДЕМО: следующий молчащий подрядчик подаёт КП. Перечитывать нечего,
     *  когда подавать больше некому — лента об этом и сообщает. Тендер назван
     *  явно: у статических снимков ленты подач нет, и кнопка гаснет сразу. */
    submitNext: async () => {
      if (await simulateNextSubmission(tenderId)) setSubmissions((n) => n + 1);
    },
  };
}
