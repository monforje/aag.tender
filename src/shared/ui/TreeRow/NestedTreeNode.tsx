import type { IconName } from '@/shared/ui/Icon';
import { TreeBranch, TreeRow, TreeToggle, type TreeRowData } from './TreeRow';

export interface NestedParent {
  id: string;
  title: string;
  icon?: IconName;
}

export type NestedChild = TreeRowData & { id: string };

export interface NestedTreeNodeProps {
  parent: NestedParent;
  children: NestedChild[];
  /** Раскрыт ли список детей. Состояние ОТДЕЛЬНОЕ от активного экрана. */
  expanded: boolean;
  /** id того, что открыто сейчас: либо родитель, либо один из детей.
   *  null — ничего не активно: ни одна строка узла не подсвечена, при
   *  сворачивании уходят все дети (пришпиливать нечего). */
  activeId: string | null;
  /** Уровень родителя в дереве. Дети получают level + 1 — отступ считает CSS. */
  level?: number;
  /** Без обработчиков узел рендерится витриной: те же строки, но без кликов. */
  onSelect?: (id: string) => void;
  onToggle?: () => void;
}

/**
 * Какие дети видны при текущем состоянии — единственный источник правды.
 *
 * Раскрыто — все. Свёрнуто — остаётся ТЕКУЩИЙ ребёнок, если открыт его экран.
 * Почему не «спрятать всех»: сворачивание убирает СПИСОК ВЫБОРА, но не должно
 * прятать то, ГДЕ пользователь сейчас находится, — иначе открытый экран
 * перестаёт быть представлен в дереве вообще и подсветка текущего пункта
 * просто исчезает. Если активен сам родитель, прятать нечего — уходят все.
 *
 * Отсюда важное следствие для любого кода вокруг: набор видимых детей НЕ
 * выводится из одного флага. Это функция от ПАРЫ (раскрыто?, что активно).
 *
 * activeId null — «ничего не активно»: при сворачивании пришпиливать нечего,
 * уходят все.
 */
export function visibleNestedChildren(
  children: NestedChild[], expanded: boolean, activeId: string | null,
): NestedChild[] {
  return children.filter((child) => expanded || child.id === activeId);
}

/**
 * Вложенный узел дерева: кликабельный родитель, дети под ним и направляющая
 * линия между ними.
 *
 * КОГДА:  у пункта есть 2+ дочерних ЭКРАНА и сам родитель ведёт на свой экран.
 *         Оба условия обязательны.
 * НЕ ДЛЯ: заголовка группы — если родителю некуда вести, берите GroupTitle:
 *         у него нет ни роли treeitem, ни своего экрана. И не для «ещё одного
 *         похожего пункта» — для этого достаточно обычного TreeRow.
 *
 * UX:     раскрытие и выбор экрана — РАЗНЫЕ состояния: свернуть список можно и
 *         когда внутри уже выбран дочерний экран, и наоборот. При сворачивании
 *         текущий ребёнок остаётся видимым (см. visibleNestedChildren).
 *         Стрелка раскрытия подменяет иконку родителя в той же ячейке, а не
 *         появляется рядом: строка не должна дёргаться при наведении. Пока
 *         курсор на стрелке, фон строки гасится — одна подсветка на один жест.
 *         Появление детей НЕ анимируется: раскрытие узла это навигационный
 *         жест, строки обязаны оказаться на месте сразу, чтобы курсор шёл к
 *         нужной без ожидания. Анимируется только поворот самой стрелки.
 * A11Y:   родитель — treeitem с aria-expanded, дети — treeitem уровнем ниже.
 *         Оговорка: при свёрнутом узле с пришпиленным ребёнком
 *         aria-expanded="false" сосуществует с видимой дочерней строкой. Это
 *         осознанный компромисс: атрибут описывает состояние ДИСКЛОУЖЕРА, а
 *         оставшаяся строка — индикатор текущего положения, а не раскрытый
 *         список. Точного атрибута для «список свёрнут, но текущий пункт
 *         продублирован» в ARIA нет.
 *
 * @example
 * <NestedTreeNode
 *   parent={{ id: 'overview', title: 'My Tasks', icon: 'myTasks' }}
 *   children={[{ id: 'assigned', title: 'Assigned to me', avatar: 'D' }]}
 *   expanded={expanded} activeId={screen}
 *   onSelect={navigateTo} onToggle={toggle}
 * />
 */
export function NestedTreeNode({
  parent, children, expanded, activeId, level = 2, onSelect, onToggle,
}: NestedTreeNodeProps) {
  const visible = visibleNestedChildren(children, expanded, activeId);

  return (
    <TreeBranch>
      <TreeRow
        icon={parent.icon}
        title={parent.title}
        level={level}
        active={activeId === parent.id}
        expanded={expanded}
        onClick={onSelect && (() => onSelect(parent.id))}
        toggle={<TreeToggle expanded={expanded} label={parent.title} onClick={onToggle} />}
      />
      {visible.map(({ id, ...row }) => (
        <TreeRow
          key={id}
          {...row}
          level={level + 1}
          active={activeId === id}
          onClick={onSelect && (() => onSelect(id))}
        />
      ))}
    </TreeBranch>
  );
}
