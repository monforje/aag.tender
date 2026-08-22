import type { ReactNode } from 'react';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Button } from '@/shared/ui/Button';
import s from './ErrorState.module.css';

export interface ErrorStateProps {
  title?: string;
  description?: ReactNode;
  /** Единственный выход из ошибки — попытка ещё раз. Без пропа остаётся
   *  только текст: действие без механизма хуже его отсутствия. */
  onRetry?: () => void;
  className?: string;
}

/**
 * Ошибка загрузки области: тон danger и один выход — «Повторить».
 *
 * КОГДА:  запрос не удался, данные не пришли. Внутри таблиц, панелей,
 *         карточек — там же, где живёт <EmptyState>.
 * НЕ ДЛЯ: «нет доступа» (это запрет, а не сбой — текст без кнопки),
 *         невалидной формы (см. <Field error>) и пустого результата
 *         (см. <EmptyState>).
 *
 * UX:     форма та же, что у пустого состояния, но тон danger: пусто — это
 *         норма, ошибка — событие. Кнопка одна и глагольная; «Повторить»
 *         вместо «Ок», потому что у пользователя ровно одно намерение.
 * A11Y:   роль alert приходит от <EmptyState> role="status" + тон: появление
 *         области объявляется скринридеру само.
 *
 * @example
 * <ErrorState
 *   description="Не удалось получить сравнение КП."
 *   onRetry={refetch}
 * />
 */
export function ErrorState({ title = 'Не загрузилось', description, onRetry, className }: ErrorStateProps) {
  return (
    <EmptyState
      icon="closeCircle"
      tone="danger"
      title={title}
      description={description}
      action={onRetry && (
        <Button variant="secondary" onClick={onRetry} className={s.retry}>
          Повторить
        </Button>
      )}
      className={className}
    />
  );
}
