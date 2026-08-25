import { useCallback, useMemo, useState } from 'react';
import {
  commentKey, fetchComments, hasUnread, markThreadSeen, postComment,
  type CommentMap,
} from '@/entities/comparison';
import { useAsync } from '@/shared/lib/useAsync';

/** Кто пишет комментарии. До появления сессии — константа ОДНА на приложение;
 *  с настоящим API имя приезжает из профиля, и меняется ровно эта строка. */
const ME = 'Закупки';

/**
 * Переписка по ячейкам таблицы: карта тредов, отправка и просмотренность.
 *
 * КОГДА:  таблица сравнения — маркер комментария рисуется у КАЖДОЙ ячейки с
 *         историей, значит знать про неё нужно ещё до первого клика.
 * НЕ ДЛЯ: данных самого сравнения (см. useComparisonData) — это другой ресурс
 *         с другим временем жизни: цены подаются раундами, переписка идёт
 *         непрерывно.
 *
 * ЖИВЁТ У ТАБЛИЦЫ, А НЕ У СТРАНИЦЫ, в отличие от снимка сравнения. Проверка
 * та же — «кто это читает»: тред рисует таблица, отправку делает таблица,
 * страница панель треда не видит и о ней не знает. Подняв его на страницу,
 * пришлось бы протащить через неё четыре пропа ради панели, которую она
 * никогда не рендерит.
 *
 * ОТПРАВКА ОБНОВЛЯЕТ КАРТУ ЛОКАЛЬНО, а не перечитывает весь ресурс: тред
 * открыт в этот самый момент, и полная перезагрузка мигнула бы им. Ответ
 * сервера при этом — источник истины: в карту кладётся то, что вернулось, а
 * не то, что отправили.
 */
export function useCellComments(tenderId: string) {
  const state = useAsync(() => fetchComments(tenderId), [tenderId]);
  /* Локальные правки поверх ответа. Отдельным состоянием, а не мутацией
     `state.data`: useAsync владеет своим значением, и писать в него снаружи
     значило бы завести второго хозяина. */
  const [patch, setPatch] = useState<CommentMap>({});

  const map = useMemo<CommentMap>(
    () => ({ ...(state.data ?? {}), ...patch }),
    [state.data, patch],
  );

  /* Стабильный колбэк: уходит пропом в КАЖДУЮ строку таблицы, и пересоздание
     на рендере отменяло бы memo у <CompareRow> — строки перерисовывались бы
     от любого чужого движения. Зависимость — сама карта: маркер читается в
     момент ОТРИСОВКИ ячейки, и через реф он остался бы вчерашним. */
  const commentsFor = useCallback((contractorId: string, positionId: string) => {
    const list = map[commentKey(contractorId, positionId)];
    return list?.length ? { total: list.length, unread: hasUnread(list) } : undefined;
  }, [map]);

  const threadOf = useCallback(
    (contractorId: string, positionId: string) => map[commentKey(contractorId, positionId)] ?? [],
    [map],
  );

  const send = useCallback(async (
    contractorId: string, positionId: string, text: string, parentId?: string,
  ) => {
    const comment = await postComment({ tenderId, contractorId, positionId, text, parentId, author: ME });
    if (!comment) return;
    const key = commentKey(contractorId, positionId);
    setPatch((prev) => ({ ...prev, [key]: [...(map[key] ?? []), comment] }));
  }, [tenderId, map]);

  const markSeen = useCallback(async (contractorId: string, positionId: string) => {
    await markThreadSeen({ tenderId, contractorId, positionId });
    const key = commentKey(contractorId, positionId);
    setPatch((prev) => ({
      ...prev,
      [key]: (map[key] ?? []).map(({ unread: _unread, ...rest }) => rest),
    }));
  }, [tenderId, map]);

  return { commentsFor, threadOf, send, markSeen, author: ME };
}
