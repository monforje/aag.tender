import { createContext, useContext, type ReactNode } from 'react';
import { useDropdownGroup } from './Dropdown';

interface GroupApi {
  openId: string | null;
  toggle: (id: string) => void;
  close: () => void;
}

const DropdownGroupContext = createContext<GroupApi | null>(null);

/**
 * Взаимоисключающие дропдауны: в группе открыт максимум один.
 *
 * КОГДА:  два и более дропдауна в одной полосе — топбар, тулбар, шапка панели.
 * НЕ ДЛЯ: одиночного дропдауна: он и без группы работает (см. useDropdownSlot).
 *
 * UX:     открытие второго меню закрывает первое — иначе на экране повисают
 *         две панели и непонятно, какая из них «текущая». Escape и клик мимо
 *         закрывают то, что открыто; слушатель на документе один на группу,
 *         а не по одному на каждый дропдаун.
 * A11Y:   каждый триггер сам сообщает aria-expanded (это делает Dropdown).
 *
 * @example
 * <DropdownGroup><WorkspaceSwitcher /><NotificationsBell /><UserMenu /></DropdownGroup>
 */
export function DropdownGroup({ children }: { children: ReactNode }) {
  const group = useDropdownGroup();
  return <DropdownGroupContext.Provider value={group}>{children}</DropdownGroupContext.Provider>;
}

/**
 * Пропсы для <Dropdown> по идентификатору слота.
 *
 * Внутри группы состояние общее, вне группы — собственное, поэтому компонент
 * с дропдауном (колокольчик, меню пользователя) работает и сам по себе.
 * Отсюда и «лишний» вызов useDropdownGroup(): хук нельзя звать условно, а в
 * групповом режиме его состояние просто остаётся пустым и слушателей не ставит.
 */
export function useDropdownSlot(id: string) {
  const group = useContext(DropdownGroupContext);
  const standalone = useDropdownGroup();
  const api = group ?? standalone;

  return {
    open: api.openId === id,
    onToggle: () => api.toggle(id),
    onClose: api.close,
  };
}
