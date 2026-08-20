import { Avatar } from '@/shared/ui/Avatar';
import { Dropdown, useDropdownSlot, MenuItem } from '@/shared/ui/Dropdown';
import { Icon } from '@/shared/ui/Icon';
import s from './UserMenu.module.css';

interface UserMenuProps {
  /** Инициал текущего пользователя. */
  initial: string;
  /** Показывать точку присутствия. */
  online?: boolean;
}

/**
 * Меню текущего пользователя — крайний правый элемент топбара.
 *
 * КОГДА:  профиль, настройки аккаунта, выход. Всегда справа: край, где
 *         пользователь ожидает «про себя», а не «про работу».
 * НЕ ДЛЯ: настроек рабочего пространства — они в переключателе слева.
 *
 * UX:     каретка рядом с аватаром обязательна: без неё аватар читается как
 *         статус, а не как кнопка. Точка присутствия обводится цветом фона
 *         топбара — так она выглядит вырезом в аватаре, а не наклейкой.
 *         Капсула вокруг аватара шире его самого (43px против 24px) — это
 *         зона попадания, она же место для каретки.
 * A11Y:   подпись «Аккаунт» на кнопке; aria-haspopup/aria-expanded от Dropdown.
 *
 * @example
 * <UserMenu initial="D" online />
 */
export function UserMenu({ initial, online }: UserMenuProps) {
  const slot = useDropdownSlot('user');

  return (
    <Dropdown
      {...slot}
      className={s.userMenu}
      menu={
        <>
          <MenuItem>Daniel — Профиль (заглушка)</MenuItem>
          <MenuItem>Настройки (заглушка)</MenuItem>
          <MenuItem>Выйти (заглушка)</MenuItem>
        </>
      }
    >
      {(trigger) => (
        <button {...trigger} className={s.userMenuToggle} aria-label="Аккаунт">
          <Avatar variant="user" online={online}>{initial}</Avatar>
          <Icon name="caretSmall" className={s.userMenuCaret} />
        </button>
      )}
    </Dropdown>
  );
}
