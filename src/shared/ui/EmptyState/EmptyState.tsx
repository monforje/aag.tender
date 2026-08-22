import type { ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import { Icon, type IconName } from '@/shared/ui/Icon';
import s from './EmptyState.module.css';

export interface EmptyStateProps {
  /** Глиф состояния. Один на состояние во всех местах — берите из той же
   *  таблицы, где живёт тон (правило «одно состояние — один глиф»). */
  icon?: IconName;
  title: string;
  description?: ReactNode;
  /** Одно главное действие выхода из состояния. Кнопок-«забора» здесь быть
   *  не должно: пустое место предлагает путь, а не меню. */
  action?: ReactNode;
  tone?: 'neutral' | 'danger';
  className?: string;
}

/**
 * Пустое состояние: честный ответ «здесь ничего нет» и путь дальше.
 *
 * КОГДА:  выборка не нашла записей, список ещё не наполнялся, раздел ждёт
 *         данных. Внутри таблиц, карточек, вкладок.
 * НЕ ДЛЯ: экрана целиком без обвязки (см. <ScreenPlaceholder> — каркасный
 *         вариант проще), загрузки (см. <Skeleton>) и ошибки (см.
 *         <ErrorState> — та же форма, но тон danger и «Повторить»).
 *
 * UX:     заглушка обязана отвечать на ТРИ вопроса молча: что здесь должно
 *         быть, почему сейчас пусто, что сделать. Заголовок + описание +
 *         одно действие закрывают все три; больше действий здесь шум.
 * A11Y:   обычный поток текста; иконка aria-hidden внутри <Icon>.
 *
 * @example
 * {rows.length === 0 && (
 *   <EmptyState
 *     icon="documentText"
 *     title="Тендеров по фильтру нет"
 *     description="Попробуйте ослабить условия или сбросить период."
 *     action={<Button variant="secondary" onClick={reset}>Сбросить фильтры</Button>}
 *   />
 * )}
 */
export function EmptyState({ icon, title, description, action, tone = 'neutral', className }: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cx(s.emptyState, tone === 'danger' && s.isDanger, className)}
    >
      {icon && <span className={s.emptyIcon}><Icon name={icon} /></span>}
      <p className={s.emptyTitle}>{title}</p>
      {description && <p className={s.emptyDescription}>{description}</p>}
      {action && <div className={s.emptyAction}>{action}</div>}
    </div>
  );
}
