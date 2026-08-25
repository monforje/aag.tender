import { useCallback, useRef, useState } from 'react';
import {
  decideCorrection, fetchComparison, selectBidVersion, simulateNextSubmission,
  snapshotRound, type Comparison,
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

  /* ВРЕМЯ ПОСЛЕДНЕГО ПОДТВЕРЖДЁННОГО СРЕЗА (§5.9). Пишется при КАЖДОМ
     успешном ответе и переживает следующую неудачу — в этом весь смысл:
     когда расчёт упал, приглушённая таблица обязана назвать, НА КОГДА эти
     числа верны. Реф, а не состояние: подпись рисуется вместе с ошибкой, и
     лишнего рендера ради неё не нужно. */
  const sliceTime = useRef<string | undefined>(undefined);
  if (state.data?.comparison && !state.error) {
    sliceTime.current = new Date().toLocaleString('ru-RU', {
      hour: '2-digit', minute: '2-digit',
    });
  }

  /* Обе мутации ПЕРЕЧИТЫВАЮТ снимок тем же путём, что и первая загрузка:
      api отдаёт НОВЫЙ объект (см. `replaceContractor`), и мемоизации таблицы
      честно пересчитываются. Своего оптимистичного состояния здесь нет —
      решение по корректировке двигает медианы, ранжир и счётчики шапки, и
      подделать это на клиенте значило бы завести второй расчёт.

      ОБЕ ВОЗВРАЩАЮТ УСПЕХ И НЕ БРОСАЮТ. Мок ответить ошибкой не может, сеть —
      может, и панель решения обязана узнать об отказе фактом («ничего не
      изменилось, можно повторить»), а не зависшим `busy`: перечитывать
      снимок после неудачи нечего. `false` здесь значит «не записано» —
      и «нечего решать», и «запрос не дошёл»; экрану достаточно одного
      ответа, потому что выглядит он одинаково. */
  const reloadRef = useRef(state.reload);
  reloadRef.current = state.reload;

  const decide = useCallback(async (
    contractorId: string, positionId: string,
    decision: 'accepted' | 'declined', note?: string,
  ): Promise<boolean> => {
    try {
      const ok = await decideCorrection({ tenderId, contractorId, positionId, decision, note });
      if (ok) reloadRef.current();
      return ok;
    } catch (error) {
      console.error('decideCorrection:', error);
      return false;
    }
  }, [tenderId]);

  const pickVersion = useCallback(async (contractorId: string, versionId: string): Promise<boolean> => {
    try {
      const ok = await selectBidVersion({ tenderId, contractorId, versionId });
      if (ok) reloadRef.current();
      return ok;
    } catch (error) {
      console.error('selectBidVersion:', error);
      return false;
    }
  }, [tenderId]);

  return {
    comparison: state.data?.comparison ?? null,
    prevComparison: state.data?.prev ?? null,
    loading: state.loading,
    error: state.error,
    reload: state.reload,
    sliceTime: sliceTime.current,
    decideCorrection: decide,
    pickVersion,
    /** ДЕМО: следующий молчащий подрядчик подаёт КП. Перечитывать нечего,
     *  когда подавать больше некому — лента об этом и сообщает. Тендер назван
     *  явно: у статических снимков ленты подач нет, и кнопка гаснет сразу.
     *  Свой сбой метод гасит: кнопка демо-подачи не стоит того, чтобы ронять
     *  страницу, — данные просто остаются прежними, ленту можно попросить
     *  снова. */
    submitNext: async () => {
      try {
        if (await simulateNextSubmission(tenderId)) setSubmissions((n) => n + 1);
      } catch (error) {
        console.error('simulateNextSubmission:', error);
      }
    },
  };
}
