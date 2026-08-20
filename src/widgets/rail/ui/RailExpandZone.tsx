import { cx } from '@/shared/lib/cx';
import { IconButton } from '@/shared/ui/IconButton';
import s from './Rail.module.css';

/**
 * Верхняя зона рейла: кнопка разворота панели и разделитель под ней.
 *
 * КОГДА:  часть рейла, появляющаяся только при свёрнутой панели.
 * НЕ ДЛЯ: постоянных действий — те должны быть видны всегда, иначе
 *         пользователь не узнает об их существовании.
 *
 * UX:     зона не прячется через display:none, а схлопывается по высоте
 *         (max-height + opacity) — так пункты рейла плавно подъезжают вверх
 *         вместо рывка. Свёрнутая зона теряет и pointer-events, и попадание в
 *         таб-порядок (tabIndex=-1 у кнопки): невидимая, но фокусируемая
 *         кнопка — классическая ловушка для клавиатуры.
 *         Разделитель отделяет «управление панелью» от «разделов»: это разные
 *         по смыслу группы, и без черты они читаются одним списком.
 * A11Y:   кнопка сообщает aria-expanded — она управляет соседней панелью.
 *
 * @example
 * <RailExpandZone hidden={sidebarOpen} onExpand={() => setSidebarOpen(true)} />
 */
export function RailExpandZone({ hidden, onExpand }: { hidden: boolean; onExpand: () => void }) {
  return (
    <div className={cx(s.railExpandZone, hidden && s.railExpandZoneHidden)}>
      <IconButton
        variant="rail"
        icon="closeRight"
        label="Развернуть боковую панель"
        className={s.railExpandBtn}
        aria-expanded={hidden}
        tabIndex={hidden ? -1 : 0}
        onClick={onExpand}
      />
      <div className={s.railDivider} aria-hidden="true" />
    </div>
  );
}
