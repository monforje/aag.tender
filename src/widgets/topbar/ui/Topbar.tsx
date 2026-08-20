import { Icon } from '@/shared/ui/Icon';
import { Dropdown, DropdownGroup, useDropdownSlot, MenuItem } from '@/shared/ui/Dropdown';
import { IconButton } from '@/shared/ui/IconButton';
import { SearchTrigger, searchSecondaryIconClass } from '@/shared/ui/SearchTrigger';
import { NotificationsBell } from './NotificationsBell';
import { UserMenu } from './UserMenu';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import s from './Topbar.module.css';

/**
 * Глобальная шапка приложения: три слота — слева «где я», по центру поиск,
 * справа «про меня».
 *
 * КОГДА:  один раз на приложение, в самом верху каркаса.
 * НЕ ДЛЯ: шапок страниц и панелей — у них свои компоненты (PageHeader,
 *         SidebarHeader) с другой высотой и другими правилами.
 *
 * UX:     раскладка держит смысл, а не только порядок. Слева — состояние
 *         («в каком пространстве работаю»), по центру — единственное действие
 *         над всем сразу (поиск), справа — личное (уведомления, аккаунт).
 *         Именно поэтому центр отдан поиску: он один относится ко всему
 *         приложению, а не к текущему экрану.
 *         Все дропдауны в одной группе: открытие второго закрывает первый.
 * A11Y:   <header> как ориентир; каждая кнопка внутри имеет подпись.
 *
 * СОСТАВ (сверху вниз по коду): WorkspaceSwitcher, IconButton «Календарь»,
 * SearchTrigger, NotificationsBell, UserMenu. Топбар сам не знает ни про Rail,
 * ни про Sidebar, ни про Main — только про свои данные.
 *
 * @example
 * <Topbar />
 */
export function Topbar() {
  return (
    <header className={s.topbar}>
      <DropdownGroup>
        <div className={s.topbarRow}>

          <div className={s.topbarLeft}>
            <WorkspaceSwitcher name="M. Tertishniy Personal" initial="M" />
            <IconButton variant="topbar" icon="calendarSm" label="Календарь" />
          </div>

          <div className={s.topbarCenter}>
            <TopbarSearch />
          </div>

          <div className={s.topbarRight}>
            <NotificationsBell count={6} />
            <UserMenu initial="D" online />
          </div>

        </div>
      </DropdownGroup>
    </header>
  );
}

/** Поиск + его модалка-заглушка. Обёртка .search-dd задаёт РЕАЛЬНУЮ ширину,
 *  от которой капсула считает свои проценты: без неё поиск схлопывался по
 *  контенту, сколько ни увеличивай max-width (ПРАВКА 7.2). */
function TopbarSearch() {
  const slot = useDropdownSlot('search');

  return (
    <Dropdown {...slot} className={s.searchDd} menu={<MenuItem>Поиск (заглушка)</MenuItem>}>
      {(trigger) => (
        <SearchTrigger
          {...trigger}
          placeholder="Search"
          hotkey="Ctrl K"
          secondary={<><Icon name="ai" className={searchSecondaryIconClass} />AI Chats</>}
        />
      )}
    </Dropdown>
  );
}
