import { useCallback, useEffect, useState } from 'react';

/** Одно асинхронное чтение и три его состояния. Всё, что нужно экрану, чтобы
 *  переживать сеть: данные, «ещё едет», «не доехало» и повтор.
 *
 *  КОГДА:  экран показывает то, что пришло из `api/`-сегмента слайса.
 *  НЕ ДЛЯ: мутаций (у них своя кнопка, свой disabled и свой ответ на «не
 *          получилось» — общего состояния тут нет); не для кеша между
 *          экранами: этот хук перечитывает всё заново при каждом монтировании.
 *          Понадобится кеш и дедупликация запросов — это TanStack Query, а не
 *          дописывание сюда.
 *
 *  ГОНКА ОТВЕТОВ ЗАКРЫТА ФЛАГОМ. Без него быстрый второй запрос (сменили
 *  тендер, нажали «Повторить») мог бы прийти РАНЬШЕ медленного первого, и
 *  экран показал бы старые данные поверх новых — молча и невоспроизводимо.
 *  Ответ, чей эффект уже убран, выбрасывается.
 *
 *  ЗАВИСИМОСТИ ПЕРЕДАЮТСЯ ЯВНО (`deps`), а не выводятся из `load`: стрелка
 *  пересоздаётся каждым рендером, и хук с ней в зависимостях запрашивал бы
 *  данные бесконечно.
 *
 *  ponytail: перезапрос — счётчик, без отмены самого запроса (AbortController
 *  появится вместе с `fetch`, отменять `Promise.resolve` нечего).
 *
 * @example
 * const { data, loading, error, reload } = useAsync(
 *   () => fetchTenders(), [],
 * );
 */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): {
  /** `null` — ещё не пришло ИЛИ не доехало: различать по `loading`/`error`. */
  data: T | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
} {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: Error | null }>(
    { data: null, loading: true, error: null },
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    load().then(
      (data) => { if (live) setState({ data, loading: false, error: null }); },
      (error: unknown) => {
        if (!live) return;
        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      },
    );
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  return { ...state, reload: useCallback(() => setAttempt((n) => n + 1), []) };
}
