import type { IconName } from '@/shared/ui/Icon';

/** Разделы рейла. Значения совпадают с сегментами URL. */
export type SectionId = 'home' | 'tenders' | 'more' | 'opcii' | 'admin';

export interface NavItem {
  id: SectionId;
  label: string;
  icon: IconName;
  counter?: number;
}