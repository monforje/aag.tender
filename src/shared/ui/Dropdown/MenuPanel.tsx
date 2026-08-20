import type { ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import s from './MenuPanel.module.css';

/**
 * Панель в выпадающем меню: содержимое плюс подвал с действиями.
 *
 * КОГДА:  меню сложнее списка пунктов — мультивыбор, календарь, окно
 *         фильтров: то, из чего выходят кнопкой «Готово», а не выбором пункта.
 *         Ставится в <Dropdown menu={…} closeOnSelect={false}>.
 * НЕ ДЛЯ: обычного меню-списка: там пункты <MenuItem>, и выбор сам закрывает
 *         меню — подвал ему не нужен.
 *
 * UX:     подвал прижат ко дну и отделён линией от края до края — он дно
 *         панели, а не блок внутри неё. Порядок действий в нём: слева
 *         «Очистить» (secondary, гаснет, когда чистить нечего), справа
 *         «Готово» (primary) — главное действие ближе к краю и к курсору.
 *         Размеры панели задаёт вызывающая сторона своим классом: ширина —
 *         свойство содержимого (210px список статусов против 560px окна
 *         фильтров), а не панели.
 * A11Y:   контейнер нейтральный; роль меню уже объявлена на .dd__menu, роли
 *         пунктов — на самих пунктах.
 *
 * @example
 * <MenuPanel className={s.panelNarrow} footer={<>
 *   <Button variant="secondary" onClick={clear}>Очистить</Button>
 *   <Button variant="primary" onClick={close}>Готово</Button>
 * </>}>
 *   {options.map(…)}
 * </MenuPanel>
 */
export function MenuPanel({ className, footer, children }: {
  className?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={cx(s.panel, className)}>
      {children}
      {footer ? <div className={s.panelFoot}>{footer}</div> : null}
    </div>
  );
}
