import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import { Icon, type IconName } from '@/shared/ui/Icon';
import s from './IconButton.module.css';

/** Поверхность, на которой живёт кнопка. Задаёт размер, радиус, тон и ступень
 *  hover — см. комментарий в IconButton.module.css о том, почему это вариант,
 *  а не набор чисел. */
export type IconButtonVariant = 'topbar' | 'panel' | 'page' | 'rail';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName;
  /** Название действия. Уходит в aria-label и в title. Обязателен: кнопка
   *  без подписи для скринридера — просто безымянный квадрат. */
  label: string;
  variant: IconButtonVariant;
  /** Переопределение размера глифа. Нужно там, где поверхность одна, а вес
   *  разный: колокольчик уведомлений 18px против календаря 16px в том же топбаре. */
  iconSize?: number;
  /** Значок поверх кнопки — обычно <Counter>. Позиционируется своим классом
   *  от вызывающей стороны: у каждого места свой угол и своя обводка. */
  badge?: ReactNode;
  /** Подпись рядом с иконкой. Поддерживает только вариант page. */
  children?: ReactNode;
  /** «Здесь что-то включено» — заливка в покое: у кнопки без подписи это
   *  единственный способ сказать, что она сейчас на что-то влияет. Только
   *  ВИЗУАЛЬНОЕ состояние: aria-pressed компонент не ставит, потому что чаще
   *  всего это триггер меню, у которого уже есть aria-expanded. Смысл
   *  состояния передавайте подписью — label={`Фильтры · ${count}`}. */
  active?: boolean;
}

/**
 * Кнопка-иконка: квадрат с глифом по центру и заливкой по наведению.
 *
 * КОГДА:  любое действие без текста — «свернуть», «настройки», «уведомления»,
 *         «календарь». Пять таких кнопок в приложении, все на этом компоненте.
 * НЕ ДЛЯ: тоггла раскрытия дерева — он позиционируется абсолютно и подменяет
 *         собой иконку строки (см. TreeToggle, §4.8-a п.7); кнопок с заливкой
 *         в покое (см. ChipButton); белых капсул (см. SearchTrigger).
 *
 * UX:     hover — заливка-«таблетка» и текст темнеет до primary; подчёркивания
 *         и сдвига не бывает (каталог состояний, рецепт 1). На тёмном рейле
 *         вместо заливки чёрным — белая с низкой альфой (рецепт 3).
 *         Фокус с клавиатуры показывается кольцом --cu-focus-ring.
 * A11Y:   label обязателен и идёт в aria-label; сама иконка aria-hidden.
 *         Если кнопка что-то раскрывает — передайте aria-expanded через пропсы.
 *
 * @example
 * <IconButton variant="topbar" icon="bell" label="Уведомления" iconSize={18}
 *             badge={<Counter className={s.notifCounter}>6</Counter>} />
 */
export function IconButton({
  icon, label, variant, iconSize, badge, children, active, className, style, ...rest
}: IconButtonProps) {
  const variantClass = {
    topbar: s.iconButtonTopbar,
    panel: s.iconButtonPanel,
    page: s.iconButtonPage,
    rail: s.iconButtonRail,
  }[variant];

  return (
    <button
      type="button"
      className={cx(s.iconButton, variantClass, active && s.isActive, className)}
      aria-label={label}
      title={rest.title ?? label}
      style={iconSize ? ({ '--ib-icon-size': `${iconSize}px`, ...style } as CSSProperties) : style}
      {...rest}
    >
      <Icon name={icon} />
      {children}
      {badge}
    </button>
  );
}
