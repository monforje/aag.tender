/** ДВЕРЬ К КОММЕНТАРИЯМ ЯЧЕЕК. Отдельным файлом от `comparison.api.ts`, а не
 *  полем в снимке сравнения: это другой ресурс с другим временем жизни —
 *  цены подаются раундами, а переписка идёт непрерывно, и тянуть весь тред
 *  каждый раз, когда перечитываются цены, незачем.
 *
 *  ПРОСМОТРЕННОСТЬ ПИШЕТСЯ, а не считается: «отметить всё просмотренным» —
 *  запрос, и его результат видит только этот пользователь. */

import type { CellComment, CommentMap } from '../model/comments';
import { commentKey } from '../model/comments';
import { MOCK_AXP_COMMENTS } from './comparison.mock';

/* Живое состояние переписки. Заменяется целиком по той же причине, что и
   снимок сравнения: экран мемоизирует по ссылке, и правка внутри объекта для
   него не событие. */
let threads: CommentMap = MOCK_AXP_COMMENTS;
let nextId = 100;

/** Вся переписка по тендеру одним ответом. Карта, а не запрос на каждую
 *  ячейку: маркер комментария рисуется у КАЖДОЙ ячейки с историей, то есть
 *  знать про неё нужно ещё до первого клика — 650 запросов вместо одного
 *  экран бы не пережил. */
export async function fetchComments(_tenderId: string): Promise<CommentMap> {
  return threads;
}

/** Новая запись или ответ. `parentId` отличает второе от первого — своего
 *  метода у ответа нет, иначе ответ на ответ потребовал бы третьего. */
export async function postComment(input: {
  tenderId: string;
  contractorId: string;
  positionId: string;
  text: string;
  parentId?: string;
  /** Кто пишет. Пропом, а не константой модуля: сессию знает приложение. */
  author: string;
}): Promise<CellComment | null> {
  const text = input.text.trim();
  /* Пустой текст — не запрос: кнопка отправки при нём неактивна, но защита
     стоит и здесь. Enter в пустом поле не имеет права создавать запись. */
  if (!text) return null;

  const key = commentKey(input.contractorId, input.positionId);
  nextId += 1;
  const comment: CellComment = {
    id: `c${nextId}`,
    author: input.author,
    /* Время словами — работа источника: у него есть часовой пояс. Мок даёт
       ту же форму, что придёт с сервера. */
    at: 'только что',
    text,
    ...(input.parentId ? { parentId: input.parentId } : {}),
  };
  threads = { ...threads, [key]: [...(threads[key] ?? []), comment] };
  return comment;
}

/** «Отметить всё просмотренным» по одному треду. Флаг снимается со ВСЕХ
 *  записей разом: маркер ячейки различает два состояния, а не считает —
 *  счётчика у него нет (решение владельца 25.08.2026). */
export async function markThreadSeen(input: {
  tenderId: string;
  contractorId: string;
  positionId: string;
}): Promise<void> {
  const key = commentKey(input.contractorId, input.positionId);
  const list = threads[key];
  if (!list?.some((c) => c.unread)) return;
  threads = {
    ...threads,
    [key]: list.map(({ unread: _unread, ...rest }) => rest),
  };
}
