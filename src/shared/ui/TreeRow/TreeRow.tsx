import type { MouseEventHandler, ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import { Icon, type IconName } from '@/shared/ui/Icon';
import { Avatar } from '@/shared/ui/Avatar';
import { Counter } from '@/shared/ui/Counter';
import s from './TreeRow.module.css';

export interface TreeRowData {
  icon?: IconName;
  /** Буква-аватар вместо иконки (Direct Messages, «Assigned to me»). */
  avatar?: string;
  /** Точка «сейчас в сети». Только там, где буква означает живого человека:
   *  у «Assigned to me» та же буква значит «назначено мне» — точки нет. */
  online?: boolean;
  title: string;
  /** Приписка серым после заголовка («— You», «- #M. Tertishniy Personal»). */
  sub?: string;
  count?: number;
  countMuted?: boolean;
}

interface TreeRowProps extends TreeRowData {
  active?: boolean;
  /** Есть обработчик — строка кликабельна и рендерится <button>.
   *  Без него это <div>: декоративная витрина, как в эталоне. */
  onClick?: MouseEventHandler<HTMLElement>;
  /** Уровень вложенности: отступ считает CSS по aria-level (§4.8-a п.1–2). */
  level?: number;
  /** Узел с детьми: показывает тоггл вместо иконки по hover. */
  toggle?: ReactNode;
  expanded?: boolean;
  className?: string;
}

/** §4.8 — .tree-node > .row. Один компонент на все строки дерева: плоские,
 *  вложенные и родительские различаются только атрибутами и наличием тоггла
 *  (§4.8-a: отдельного компонента «вложенная строка» нет и не нужно). */
export function TreeRow({
  icon, avatar, online, title, sub, count, countMuted,
  active, onClick, level, toggle, expanded, className,
}: TreeRowProps) {
  // Ведущий глиф — ровно один и всегда в одной колонке: либо иконка, либо
  // аватар. Что бы в ней ни лежало, ширина колонки одинаковая (§4.8-a п.3),
  // иначе два соседних пункта расходятся по x.
  const glyph = avatar
    ? <Avatar variant="tree" surface="sidebar" online={online} className={s.rowAvatar}>{avatar}</Avatar>
    : icon ? <Icon name={icon} className={s.rowIcon} /> : null;

  const body = (
    <>
      {glyph}
      <span className={s.rowTitle}>
        {title}
        {sub ? <> <span className={s.rowSub}>{sub}</span></> : null}
      </span>
      {count != null ? <Counter muted={countMuted}>{count}</Counter> : null}
    </>
  );

  return (
    <div
      className={cx(s.treeNode, Boolean(toggle) && s.hasChildren, className)}
      {...(level ? { role: 'treeitem', 'aria-level': level } : {})}
      {...(toggle ? { 'aria-expanded': expanded } : {})}
    >
      {onClick ? (
        <button type="button" className={cx(s.row, s.rowInteractive, active && s.isActive)} onClick={onClick}>
          {body}
        </button>
      ) : (
        <div className={cx(s.row, active && s.isActive)}>{body}</div>
      )}
      {toggle}
    </div>
  );
}

/** Кнопка раскрытия. Сосед .row, а не потомок: <button> в <button> невалиден,
 *  и сиблинги дают обеим кнопкам нативную клавиатурную активацию (§4.8-a п.7).
 *
 *  Без onClick рендерится <span>: в превью-флайауте узел выглядит так же
 *  (та же разметка, та же подмена глифа по hover), но кнопки, которая ничего
 *  не делает, там не появляется. */
export function TreeToggle({ expanded, label, onClick }: {
  expanded: boolean; label: string; onClick?: () => void;
}) {
  const glyph = <Icon name="altArrowDownBold" className={s.rowToggleIcon} />;
  if (!onClick) return <span className={s.rowToggle} aria-hidden="true">{glyph}</span>;
  return (
    <button
      type="button"
      className={s.rowToggle}
      aria-label={`${expanded ? 'Свернуть' : 'Развернуть'} ${label}`}
      onClick={onClick}
    >
      {glyph}
    </button>
  );
}

/** Обёртка «родитель + дети»: несёт направляющую линию и колонку глифа.
 *  Есть всегда, даже когда детей не осталось (§4.8-a п.6). */
export function TreeBranch({ children }: { children: ReactNode }) {
  return <div className={s.treeBranch}>{children}</div>;
}

export function GroupTitle({ children }: { children: ReactNode }) {
  return <div className={s.groupTitle}>{children}</div>;
}
