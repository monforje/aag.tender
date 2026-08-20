import type { ReactNode } from 'react';
import s from './Page.module.css';

/**
 * Экран страницы: колонка «неподвижная шапка + прокручиваемое тело» внутри <main>.
 *
 * КОГДА:  корневой элемент любой страницы. Внутри — <PageHeader> и <ScrollArea>.
 * НЕ ДЛЯ: секций внутри страницы; это именно корень экрана.
 *
 * UX:     занимает всю высоту <main> и не даёт контенту растянуть каркас —
 *         прокручивается только тело. Раньше экраны лежали в DOM соседями и
 *         переключались классом .is-open; теперь экран это маршрут, и в DOM
 *         всегда ровно один.
 * A11Y:   нейтральная обёртка; заголовок страницы даёт <PageTitle>.
 *
 * @example
 * <Screen>
 *   <PageHeader><PageTitle>My Tasks</PageTitle></PageHeader>
 *   <ScrollArea variant="page">…</ScrollArea>
 * </Screen>
 */
export function Screen({ children }: { children: ReactNode }) {
  return <div className={s.screen}>{children}</div>;
}
