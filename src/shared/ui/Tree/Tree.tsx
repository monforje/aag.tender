import { GroupTitle, TreeRow } from '@/shared/ui/TreeRow';
import { isRowLike } from './tree-nodes';
import type { TreeItem } from './tree-nodes';

export interface TreeProps {
  /** Данные дерева — единственный источник строк. */
  items: TreeItem[];
  /** Текущий путь — для подсветки активного пункта kind: 'link'. */
  activePath?: string;
  /** Без onNavigate пункты kind: 'link' декоративны — та же логика, что у
   *  витрины-превью: те же строки, но без кликов. */
  onNavigate?: (path: string) => void;
}

/**
 * Универсальное дерево строк: разворачивает данные в строки по таксономии
 * видов (см. model/tree-nodes.ts — там таблица «какой вид когда брать»).
 *
 * КОГДА:  любой список, где строки одного из видов таксономии и нужен
 *         кликабельный пункт со своим маршрутом (kind: 'link').
 * НЕ ДЛЯ: вложенных узлов с детьми и тогглом — это NestedTreeNode
 *         (в shared/ui/TreeRow), у него свои состояния раскрытия; и не для
 *         произвольных списков — здесь именно ДЕРЕВО с ролями treeitem,
 *         уровнями и подсветкой активного маршрута.
 *
 * UX:     один и тот же компонент обслуживает и панель, и превью — разница
 *         только в наличии обработчиков. Так превью гарантированно совпадает
 *         с тем, что покажет панель: рассинхрон между ними невозможен по
 *         построению, а не по дисциплине.
 *
 * @example
 * <Tree items={contentFor('home')} activePath={pathname} onNavigate={navigate} />
 */
export function Tree({ items, activePath, onNavigate }: TreeProps) {
  return (
    <>
      {items.map((item, i) => {
        // Индекс как ключ допустим: список статический, порядок не меняется,
        // элементы не переставляются и не удаляются.
        if (item.kind === 'group') return <GroupTitle key={i}>{item.title}</GroupTitle>;
        if (item.kind === 'link') {
          const { kind, path, ...row } = item;
          void kind;
          return (
            <TreeRow
              key={i}
              {...row}
              // Не строгое равенство: у пункта могут быть вложенные экраны
              // (реестр → карточка тендера), и на них родительская строка
              // обязана оставаться подсвеченной — иначе на карточке дерево
              // показывает, что мы «нигде».
              active={activePath === path || Boolean(activePath?.startsWith(`${path}/`))}
              onClick={onNavigate ? () => onNavigate(path) : undefined}
            />
          );
        }
        if (isRowLike(item)) {
          const { kind, ...row } = item;
          void kind;  // вид строки сегодня не влияет на рендер — см. tree-nodes.ts
          return <TreeRow key={i} {...row} />;
        }
        return null;
      })}
    </>
  );
}