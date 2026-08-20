import { IconButton } from '@/shared/ui/IconButton';
import { SidebarSearch } from './SidebarSearch';
import s from './SidebarHeader.module.css';

/**
 * Группа контролов шапки панели, выезжающая по наведению: настройки, поиск,
 * сворачивание.
 *
 * КОГДА:  действия над самой панелью (не над её содержимым), которые нужны
 *         редко и не должны занимать внимание постоянно.
 * НЕ ДЛЯ: главного действия панели — «+⌄» намеренно живёт ВНЕ группы и видна
 *         всегда: создание это то, ради чего сюда приходят, прятать его под
 *         наведение нельзя.
 *
 * UX:     группа появляется целиком, одним блоком, а не по кнопке — иначе
 *         движение читается как мигание. Триггер — наведение ИЛИ фокус внутри
 *         всей панели. Второе обязательно: без него группа уезжала бы вправо
 *         ровно в тот момент, когда пользователь печатает в поиске, а курсор
 *         уже ушёл с панели.
 *         Порядок слева направо: редкое → частое. «Свернуть» крайняя справа,
 *         ближе всего к границе панели, которой она управляет.
 * A11Y:   каждая кнопка с подписью; скрытая группа остаётся в таб-порядке —
 *         фокус её проявляет, так что клавиатурой всё доступно.
 *
 * @example
 * <SidebarActions onCollapse={() => setSidebarOpen(false)} />
 */
export function SidebarActions({ onCollapse }: { onCollapse: () => void }) {
  return (
    <div className={s.sidebarFinalActions} data-test="sidebar-header__title-actions">
      <IconButton variant="panel" icon="ellipsis" label="Настройки" />
      <SidebarSearch />
      <IconButton
        variant="panel"
        icon="closeLeft"
        label="Close sidebar"
        title="Свернуть"
        onClick={onCollapse}
      />
    </div>
  );
}
