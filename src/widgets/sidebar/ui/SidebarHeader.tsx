import { cx } from '@/shared/lib/cx';
import { Icon } from '@/shared/ui/Icon';
import { VisuallyHidden } from '@/shared/ui/VisuallyHidden';
import { SidebarActions } from './SidebarActions';
import s from './SidebarHeader.module.css';

interface SidebarHeaderProps {
  /** Название текущего раздела — оно же заголовок дерева под ним. */
  title: string;
  /** Список под шапкой уже прокручен: включает тень. Приходит из useScrolled()
   *  той области, которая реально скроллится. */
  scrolled?: boolean;
  onCollapse: () => void;
}

/**
 * Липкая шапка панели: заголовок раздела, скрытая группа контролов и
 * постоянная кнопка создания.
 *
 * КОГДА:  верх любой панели со списком, который может прокручиваться.
 * НЕ ДЛЯ: шапки страницы (см. PageHeader) — там другая высота, другой фон и
 *         нет hover-reveal.
 *
 * UX:     шапка sticky и до прокрутки НЕ имеет тени: пока список не уехал под
 *         неё, тень висела бы бессмысленной полосой. Тень появляется ровно в
 *         момент, когда шапка становится слоем над содержимым (см. useScrolled).
 *         «+⌄» — белая капсула с тенью на сером фоне: та же семантика, что у
 *         поиска в топбаре, «белая поверхность = здесь действие». Она статична,
 *         остальные контролы выезжают по наведению (см. SidebarActions).
 * A11Y:   у кнопки создания видимая подпись скрыта визуально, но есть для
 *         скринридера — иконки «+» и каретки недостаточно, чтобы понять, что
 *         именно создаётся.
 *
 * @example
 * <SidebarHeader title="Закуп" scrolled={scrolled} onCollapse={collapse} />
 */
export function SidebarHeader({ title, scrolled, onCollapse }: SidebarHeaderProps) {
  return (
    <div className={cx(s.sidebarFinalHeader, scrolled && s.sidebarFinalHeaderScrolled)}>
      <div className={s.sidebarFinalHeaderInner}>
        <span className={s.sidebarFinalTitle}>{title}</span>

        <SidebarActions onCollapse={onCollapse} />

        <button
          className={s.sidebarAdd}
          type="button"
          data-test="sidebar-header__create-items"
          title="Create"
          aria-label="Create"
        >
          <Icon name="add" className={s.sidebarAddIcon} />
          <Icon name="chevronDown" className={s.sidebarAddIcon} />
          <VisuallyHidden>Create</VisuallyHidden>
        </button>
      </div>
    </div>
  );
}
