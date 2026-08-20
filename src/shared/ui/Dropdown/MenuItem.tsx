import type { ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import { Icon, type IconName } from '@/shared/ui/Icon';
import s from './MenuItem.module.css';

interface MenuItemProps {
  children: ReactNode;
  /** Ведущая иконка. Если её нет ни у одного пункта меню — не добавляйте
   *  и здесь: колонка глифов в половину заполненного меню выглядит сбоем. */
  icon?: IconName;
  /** Правая приписка: хоткей, количество. Не действие. */
  hint?: ReactNode;
  disabled?: boolean;
  /** Без обработчика пункт остаётся витриной (курсор не обещает действия). */
  onSelect?: () => void;
}

/**
 * Пункт выпадающего меню.
 *
 * КОГДА:  строка внутри <Dropdown menu={…}> — действие, переход или заглушка.
 * НЕ ДЛЯ: строк дерева в сайдбаре (см. TreeRow) и кнопок в шапке (см. IconButton).
 *
 * UX:     hover — заливка-«таблетка» слабой ступени: пункт меню это крупная
 *         поверхность (рецепт 1 в каталоге состояний). Отключённый пункт
 *         приглушается, но не исчезает — пользователь должен видеть, что
 *         действие существует. Пункт без onSelect не меняет курсор: обещание
 *         клика без клика хуже отсутствия обещания.
 * A11Y:   role="menuitem" внутри role="menu" у контейнера. tabIndex=-1 —
 *         заготовка под roving tabindex: стрелочная навигация появится вместе
 *         с общей клавиатурной задачей, сейчас меню закрывается по Escape.
 *
 * @example
 * <MenuItem icon="settings" hint="⌘,"onSelect={openSettings}>Настройки</MenuItem>
 */
export function MenuItem({ children, icon, hint, disabled, onSelect }: MenuItemProps) {
  return (
    <div
      className={cx(s.ddItem, onSelect && s.ddItemInteractive, disabled && s.ddItemDisabled)}
      role="menuitem"
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onSelect}
    >
      {icon ? <Icon name={icon} /> : null}
      {children}
      {hint ? <span className={s.ddItemHint}>{hint}</span> : null}
    </div>
  );
}
