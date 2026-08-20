import type { ReactNode, UIEvent } from 'react';
import { cx } from '@/shared/lib/cx';
import s from './ScrollArea.module.css';

interface ScrollAreaProps {
  children: ReactNode;
  /** Где живёт область — от этого зависят только отступы, не механика.
   *  page: контент страницы в <main>. panel: список в сайдбаре. */
  variant?: 'page' | 'panel';
  onScroll?: (e: UIEvent<HTMLDivElement>) => void;
  className?: string;
}

/**
 * Единственная прокручиваемая область своего экрана.
 *
 * КОГДА:  контент, который может перерасти вьюпорт: список в панели, тело
 *         страницы. Ставится ВНУТРИ колонки, у которой есть неподвижная часть
 *         (шапка, футер) — тогда каркас остаётся на месте, а едет только это.
 * НЕ ДЛЯ: обёртки вокруг контента, который сам растягивается: ей нужен flex:1
 *         БЕЗ overflow и БЕЗ min-height, иначе появятся два скролла подряд
 *         (см. .main-cards-section на странице My Tasks).
 *
 * UX:     скролл заперт здесь и не уходит на страницу — <body> держит
 *         overflow:hidden, поэтому Topbar/Rail/Sidebar никогда не уезжают.
 *         Если сверху липкая шапка, добавьте useScrolled(): тень должна
 *         появляться в момент, когда под шапку реально что-то заехало.
 * A11Y:   прокручиваемый div получает фокус с клавиатуры браузером
 *         автоматически, отдельной роли не требуется.
 *
 * @example
 * <ScrollArea variant="page"><Greeting /><CardGrid /></ScrollArea>
 */
export function ScrollArea({ children, variant = 'page', onScroll, className }: ScrollAreaProps) {
  return (
    <div
      className={cx(s.scrollArea, variant === 'page' ? s.scrollAreaPage : s.scrollAreaPanel, className)}
      onScroll={onScroll}
    >
      {children}
    </div>
  );
}
