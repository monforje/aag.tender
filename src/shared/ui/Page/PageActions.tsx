import type { ReactNode } from 'react';
import s from './Page.module.css';

/**
 * Группа действий в правой части шапки страницы.
 *
 * КОГДА:  рядом с <PageTitle>, когда у экрана есть действия.
 * НЕ ДЛЯ: действий над отдельной карточкой или строкой — те живут в своём
 *         контейнере, а не в шапке экрана.
 *
 * UX:     порядок слева направо — от редкого к частому, главное действие
 *         последнее (ближе к краю и к курсору). Все кнопки одной высоты 28px:
 *         разнокалиберные контролы в одной полосе читаются как сбой вёрстки.
 *         Основное действие — <ChipButton> (тёмная заливка), второстепенные —
 *         <IconButton variant="page">.
 * A11Y:   каждая кнопка внутри обязана иметь подпись (label у IconButton).
 *
 * @example
 * <PageActions>
 *   <ChipButton>Manage cards</ChipButton>
 *   <IconButton variant="page" icon="settings" label="Настройки" />
 * </PageActions>
 */
export function PageActions({ children }: { children: ReactNode }) {
  return <div className={s.mainHeaderActions}>{children}</div>;
}
