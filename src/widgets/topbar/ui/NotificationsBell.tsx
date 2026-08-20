import { Counter } from '@/shared/ui/Counter';
import { Dropdown, useDropdownSlot, MenuItem } from '@/shared/ui/Dropdown';
import { IconButton } from '@/shared/ui/IconButton';
import s from './NotificationsBell.module.css';

/**
 * Колокольчик уведомлений со счётчиком непрочитанного.
 *
 * КОГДА:  входящие события, которые ждут внимания и накапливаются.
 * НЕ ДЛЯ: количества сущностей на экране («4 списка») — это не уведомление,
 *         там нужен тихий счётчик (<Counter muted>), а не розовый.
 *
 * UX:     счётчик цветной и вынесен за пределы иконки, потому что должен
 *         замечаться боковым зрением; при нуле он не показывается вовсе —
 *         «0 непрочитанных» это отсутствие события, а не событие.
 *         Обводка счётчика цветом фона топбара вырезает его из иконки, чтобы
 *         цифра не сливалась с глифом.
 * A11Y:   у кнопки подпись «Уведомления»; само число дублируется скрытым
 *         текстом на стороне вызова, если нужно озвучить количество.
 *
 * @example
 * <NotificationsBell count={6} />
 */
export function NotificationsBell({ count }: { count: number }) {
  const slot = useDropdownSlot('notifications');

  return (
    <Dropdown
      {...slot}
      menu={<MenuItem>{count} новых уведомлений (заглушка)</MenuItem>}
    >
      {(trigger) => (
        <IconButton
          {...trigger}
          variant="topbar"
          icon="bell"
          label="Уведомления"
          iconSize={18}
          badge={count > 0 ? <Counter className={s.topbarNotifCounter}>{count}</Counter> : undefined}
        />
      )}
    </Dropdown>
  );
}
