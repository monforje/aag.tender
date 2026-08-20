import { useLocation, useNavigate } from 'react-router-dom';
import { cx } from '@/shared/lib/cx';
import { ScrollArea, useScrolled } from '@/shared/ui/ScrollArea';
import { Tree } from '@/shared/ui/Tree';
import { contentFor, labelFor } from '@/entities/section';
import { useWorkspaceStore } from '@/entities/workspace';
import { SidebarFooter } from './SidebarFooter';
import { SidebarHeader } from './SidebarHeader';
import s from './Sidebar.module.css';

/**
 * Панель раздела: дерево того, что есть внутри текущего пункта рейла.
 *
 * КОГДА:  один раз на приложение, рядом с рейлом.
 * НЕ ДЛЯ: содержимого страницы — панель показывает СТРУКТУРУ, а не данные.
 *
 * УСТРОЙСТВО — три части, и деление не случайное:
 *   шапка   — не двигается, липкая, показывает «где я» и действия над панелью;
 *   дерево  — единственное, что прокручивается;
 *   подвал  — не двигается, держит настройку самой панели.
 * Ровно из-за этого деления скролл заперт в середине: заголовок раздела и
 * «Customize Sidebar» обязаны быть доступны в любой момент, не листая список.
 *
 * UX:     сворачивание — это flex-basis в ноль плюс opacity, а не display:none:
 *         панель уезжает плавно, а <main> сам забирает освободившуюся ширину
 *         механикой флекса, без единой строчки JS на этот счёт.
 *         Свёрнутая панель теряет pointer-events, чтобы невидимые строки не
 *         ловили клики.
 * A11Y:   <aside> как ориентир; дерево внутри держит роли treeitem и aria-level.
 *
 * @example
 * <Sidebar />
 */
export function Sidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeId = useWorkspaceStore((st) => st.activeId);
  const sidebarOpen = useWorkspaceStore((st) => st.sidebarOpen);
  const setSidebarOpen = useWorkspaceStore((st) => st.setSidebarOpen);

  const { scrolled, onScroll } = useScrolled();

  return (
    <aside className={cx(s.sidebarFinal, !sidebarOpen && s.sidebarFinalClosed)}>
      <SidebarHeader
        title={labelFor(activeId)}
        scrolled={scrolled}
        onCollapse={() => setSidebarOpen(false)}
      />

      <ScrollArea variant="panel" onScroll={onScroll}>
        <Tree
          items={contentFor(activeId)}
          activePath={pathname}
          onNavigate={navigate}
        />
      </ScrollArea>

      <SidebarFooter />
    </aside>
  );
}