import { useRef, type CSSProperties } from 'react';
import { cx } from '@/shared/lib/cx';
import { Counter } from '@/shared/ui/Counter';
import { Icon } from '@/shared/ui/Icon';
import { pathFor, type NavItem, type SectionId } from '@/entities/section';
import s from './RailItem.module.css';

export interface RailItemProps {
  item: NavItem;
  /** Раздел открыт в сайдбаре. */
  active: boolean;
  /** Для этого пункта сейчас показывается превью-панель. */
  flyoutOpen: boolean;
  /** Вертикальная позиция «носика» превью, посчитанная от слота рейла. */
  arrowTop: number;
  onEnter: (id: SectionId, trigger: HTMLElement) => void;
  onLeave: () => void;
  onFocus: (id: SectionId, trigger: HTMLElement) => void;
  onBlur: () => void;
  onSelect: (id: SectionId) => void;
}

/**
 * Пункт иконного дока: глиф, счётчик и превью по наведению.
 *
 * КОГДА:  раздел верхнего уровня — то, что переключает ВСЁ содержимое слева.
 * НЕ ДЛЯ: действий (создать, свернуть) — им место в отдельной зоне рейла;
 *         и не для страниц внутри раздела: те живут в дереве сайдбара.
 *
 * UX:     подписи под иконками нет намеренно: название раздела уже стоит в
 *         шапке панели, и вторая копия рядом — шум. Имя раздела доступно по
 *         наведению (превью) и скринридеру (aria-label).
 *         В покое иконка приглушена до .62 и проявляется по наведению — на
 *         тёмной карточке полная яркость всех пунктов сразу превратила бы док
 *         в пёстрый забор. Активный пункт держит яркость постоянно и несёт
 *         заливку с тенью.
 *         Справа от пункта живёт невидимый мостик 12px: курсор идёт к панели
 *         по диагонали и не должен по дороге «выпасть» из зоны наведения.
 *         «Носик» превью выезжает отдельной анимацией — панель как будто
 *         вытянула за собой язычок.
 * A11Y:   это ссылка (href раздела), а не кнопка: работает средний клик и
 *         «открыть в новой вкладке». Клик перехватывается для навигации через
 *         роутер. aria-label — единственное имя пункта: видимой подписи нет.
 *
 * @example
 * <RailItem item={navItem} active flyoutOpen={false} arrowTop={0} … />
 */
export function RailItem({
  item, active, flyoutOpen, arrowTop, onEnter, onLeave, onFocus, onBlur, onSelect,
}: RailItemProps) {
  const innerRef = useRef<HTMLSpanElement>(null);

  return (
    <div className={s.navSwitch}>
      <div className={s.navSwitchContainer}>
        <div
          className={cx(s.navItem, flyoutOpen && s.isFlyoutOpen)}
          onMouseEnter={() => innerRef.current && onEnter(item.id, innerRef.current)}
          onMouseLeave={onLeave}
        >
          <a
            className={cx(s.navItemLink, active && s.isActive)}
            href={pathFor(item.id)}
            aria-label={item.label}
            onFocus={() => innerRef.current && onFocus(item.id, innerRef.current)}
            onBlur={onBlur}
            onClick={(e) => { e.preventDefault(); onSelect(item.id); }}
          >
            <span
              ref={innerRef}
              className={cx(s.navItemInner, active && s.isActive, flyoutOpen && s.isFlyoutOpen)}
              // Позиция «носика» превью: ::before читает её из этой переменной.
              // Раньше значение инъектировалось в <style> из JS.
              style={flyoutOpen ? ({ '--arrow-top': `${arrowTop}px` } as CSSProperties) : undefined}
            >
              <Icon name={item.icon} className={s.navItemIcon} />
              {item.counter ? <Counter className={s.navItemCounter}>{item.counter}</Counter> : null}
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}
