import { Icon } from '@/shared/ui/Icon';
import { Avatar } from '@/shared/ui/Avatar';
import { Dropdown, useDropdownSlot, MenuItem } from '@/shared/ui/Dropdown';
import s from './WorkspaceSwitcher.module.css';

interface WorkspaceSwitcherProps {
  /** Имя текущего пространства. Длинное обрезается многоточием. */
  name: string;
  /** Инициал для аватара. */
  initial: string;
}

/**
 * Переключатель рабочего пространства — крайний левый элемент топбара.
 *
 * КОГДА:  приложение работает более чем с одним пространством и пользователь
 *         должен постоянно видеть, в каком он сейчас.
 * НЕ ДЛЯ: выбора внутри пространства (проект, папка) — это навигация, ей место
 *         в дереве сайдбара, а не в глобальной шапке.
 *
 * UX:     единственный контрол топбара с заливкой в покое. Так и задумано:
 *         остальные кнопки — действия, а этот показывает СОСТОЯНИЕ («вы
 *         здесь»), и заливка отделяет состояние от действий. Из-за неё же
 *         hover идёт ступенью выше обычной: поверх собственного фона слабая
 *         заливка не читается.
 *         Аватар — скруглённый квадрат, а не круг: круг в этом интерфейсе
 *         значит «человек», квадрат — «пространство».
 * A11Y:   кнопка получает aria-haspopup и aria-expanded от <Dropdown>.
 *
 * @example
 * <WorkspaceSwitcher name="M. Tertishniy Personal" initial="M" />
 */
export function WorkspaceSwitcher({ name, initial }: WorkspaceSwitcherProps) {
  const slot = useDropdownSlot('workspace');

  return (
    <Dropdown
      {...slot}
      menuAlign="left"
      menu={<MenuItem>Список воркспейсов (заглушка)</MenuItem>}
    >
      {(trigger) => (
        <button {...trigger} className={s.wsToggle}>
          <Avatar variant="workspace">{initial}</Avatar>
          <span className={s.wsToggleName}>{name}</span>
          <Icon name="caretSmall" className={s.wsToggleCaret} />
        </button>
      )}
    </Dropdown>
  );
}
