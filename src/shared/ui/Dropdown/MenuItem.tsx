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
  /** Одиночный выбор внутри меню: пункт становится menuitemradio, и выбранный
   *  отмечается галочкой. Состояние ведёт родитель — сам пункт только рисует. */
  checked?: boolean;
  /** Без обработчика пункт остаётся витриной (курсор не обещает действия). */
  onSelect?: () => void;
}

/**
 * Пункт выпадающего меню: действие или одиночный выбор.
 *
 * КОГДА:  строка внутри <Dropdown menu={…}> — действие, переход или заглушка;
 *         с пропом checked — радиопункт («Показатель: Цена»).
 * НЕ ДЛЯ: мультивыбора (см. <MenuCheckItem> — там чекбоксы и меню не
 *         закрывается); строк дерева в сайдбаре (см. TreeRow).
 *
 * UX:     hover — заливка-«таблетка» слабой ступени: пункт меню это крупная
 *         поверхность (рецепт 1 в каталоге состояний). Отключённый пункт
 *         приглушается, но не исчезает — пользователь должен видеть, что
 *         действие существует. Пункт без onSelect не меняет курсор: обещание
 *         клика без клика хуже отсутствия обещания.
 * A11Y:   роль menuitem / menuitemradio по наличию checked. Пункт — <button>:
 *         Enter и Space жмут его без дополнительной клавиатурной обвязки,
 *         tabIndex=-1 — roving tabindex ведёт <Dropdown>.
 *
 * @example
 * <MenuItem icon="settings" hint="⌘," onSelect={openSettings}>Настройки</MenuItem>
 * <MenuItem checked={metric === 'price'} onSelect={pick}>Цена</MenuItem>
 */
export function MenuItem({ children, icon, hint, disabled, checked, onSelect }: MenuItemProps) {
  return (
    <button
      type="button"
      className={cx(s.ddItem, onSelect && s.ddItemInteractive, disabled && s.ddItemDisabled)}
      role={checked === undefined ? 'menuitem' : 'menuitemradio'}
      aria-checked={checked === undefined ? undefined : checked}
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onSelect}
    >
      {icon ? <Icon name={icon} /> : null}
      {children}
      {hint ? <span className={s.ddItemHint}>{hint}</span> : null}
      {/* Галочка выбора — последним слотом; слот живёт всегда (иначе пункты
          прыгали бы при выборе), видна только у отмеченного. */}
      {checked !== undefined ? (
        <span className={s.ddItemCheck} aria-hidden="true">
          <Icon name="checkCircle" />
        </span>
      ) : null}
    </button>
  );
}
