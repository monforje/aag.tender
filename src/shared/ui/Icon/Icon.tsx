import { cx } from '@/shared/lib/cx';
import { ICONS, type IconName } from './icon-map';
import s from './Icon.module.css';

export type { IconName };

interface IconProps {
  name: IconName;
  /** Класс из модуля родителя — им задают --icon-size и цвет, как раньше
   *  делал второй класс на <span class="icon ws-toggle__caret">. */
  className?: string;
}

/** Замена <span class="icon"><svg><use href="#i-…"/></svg></span> из §3.
 *  Обёртка сохранена намеренно: на ней держится вся размерная механика. */
export function Icon({ name, className }: IconProps) {
  const Glyph = ICONS[name];
  return (
    <span className={cx(s.icon, className)} aria-hidden="true">
      <Glyph />
    </span>
  );
}
