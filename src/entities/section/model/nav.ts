import type { NavItem, SectionId } from './types';

/** Пункты рейла (§4.4). Иконки — Solar; docs/funnel/target/planet (четыре
 *  прежних иконки рейла, которых нет в @solar-icons) остались в
 *  shared/ui/Icon как неиспользуемые. */
export const NAV_TOP: NavItem[] = [
  { id: 'home', label: 'Обзор', icon: 'home', counter: 6 },
  { id: 'tenders', label: 'Тендеры', icon: 'documentText' },
  { id: 'more', label: 'Контрагенты', icon: 'person' },
  { id: 'opcii', label: 'Справочники', icon: 'book2' },
  { id: 'admin', label: 'Администрирование', icon: 'settings' },
];

export function labelFor(id: SectionId): string {
  return NAV_TOP.find((item) => item.id === id)?.label ?? id;
}

/** Путь раздела. Home — корень, остальные — свой сегмент. */
export function pathFor(id: SectionId): string {
  return id === 'home' ? '/' : `/${id}`;
}
