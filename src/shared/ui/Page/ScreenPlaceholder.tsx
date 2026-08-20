import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/shared/ui/Icon';
import s from './Page.module.css';

/**
 * Центрированная заглушка вместо содержимого экрана.
 *
 * КОГДА:  экран существует и доступен, но его содержимое ещё не сделано или
 *         сейчас пусто. Заглушка ЧЕСТНО об этом говорит.
 * НЕ ДЛЯ: ошибок и запретов — «нет доступа» и «не загрузилось» это другие
 *         состояния с другими действиями; молчаливая заглушка их маскирует.
 *
 * UX:     пустой блок читается как «сломалось», подписанный — как «так и
 *         задумано». Поэтому иконка + одна фраза, без кнопок: предлагать
 *         действие, которого нет, хуже, чем не предлагать ничего.
 * A11Y:   обычный текст в потоке, читается скринридером как есть.
 *
 * @example
 * <ScreenPlaceholder icon="assigned">Экран «Assigned to me» — заглушка контента</ScreenPlaceholder>
 */
export function ScreenPlaceholder({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <div className={s.screenPlaceholder}>
      <Icon name={icon} className={s.screenPlaceholderIcon} />
      <span>{children}</span>
    </div>
  );
}
