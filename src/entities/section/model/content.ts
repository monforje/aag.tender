import type { SectionId } from './types';
import type { TreeItem } from '@/shared/ui/Tree';

/** Дерево раздела «Обзор» (id: home). Это уже не reference-шаблон, а рабочая
 *  структура продукта — buildHomeContent() эталона здесь ни при чём.
 *  Пункты декоративные (kind: 'row'): у приложения есть только один реальный
 *  экран — реестр тендеров в разделе «Тендеры», остальные пункты показывают
 *  направление, но не ведут на страницы. */
const HOME: TreeItem[] = [
  { kind: 'row', icon: 'clipboardList', title: 'Заявки', count: 1 },
  { kind: 'row', icon: 'billList', title: 'Предложения' },
  { kind: 'row', icon: 'scanner', title: 'Распознавание' },
  { kind: 'row', icon: 'letter', title: 'Входящие письма' },
  { kind: 'group', title: 'Ценообразование' },
  { kind: 'row', icon: 'graphUp', title: 'Цены по рынку' },
  { kind: 'row', icon: 'scale', title: 'Сравнение цен' },
];

/** Дерево раздела «Тендеры» (id: tenders). Маршруты вложены в /tenders/*:
 *  sectionFromPath() в router.tsx читает раздел из ПЕРВОГО сегмента, и
 *  плоский путь вроде /templates подсветил бы в рейле «Обзор».
 *  Кликабелен только Реестр тендеров — единственный реальный экран; остальные
 *  пункты декоративные. */
const TENDERS: TreeItem[] = [
  { kind: 'row', icon: 'layers', title: 'Портфели и объекты' },
  { kind: 'link', path: '/tenders/registry', icon: 'clipboardList', title: 'Реестр тендеров' },
  { kind: 'row', icon: 'inbox', title: 'Входящие КП' },
  { kind: 'row', icon: 'docs', title: 'Шаблоны' },
];

const MORE: TreeItem[] = [
  { kind: 'group', title: 'Разделы' },
  { kind: 'row', icon: 'list', title: 'Docs' },
  { kind: 'row', icon: 'activity', title: 'Dashboards' },
  { kind: 'row', icon: 'layers', title: 'Whiteboards' },
];

/** Раздел без своего содержимого получает ту же заглушку, что и в эталоне. */
const FALLBACK: TreeItem[] = [
  { kind: 'group', title: 'Раздел' },
  { kind: 'row', title: 'Содержимое (заглушка)' },
];

const CONTENT: Partial<Record<SectionId, TreeItem[]>> = {
  home: HOME,
  tenders: TENDERS,
  more: MORE,
};

export function contentFor(id: SectionId): TreeItem[] {
  return CONTENT[id] ?? FALLBACK;
}