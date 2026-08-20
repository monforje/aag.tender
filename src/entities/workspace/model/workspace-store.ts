import { create } from 'zustand';
import type { SectionId } from '@/entities/section';

/** Состояние каркаса. Два вида полей, и их важно не смешивать:
 *
 *  1. ПРОЕКЦИЯ URL — activeId. Источник правды здесь маршрут; стор его только
 *     отражает, чтобы рейл и дерево читали состояние синхронно. Писать в него
 *     можно ровно из одного места — syncFromRoute() в app/providers/router.tsx.
 *     Навигация всегда идёт через navigate(), а не через прямую запись в стор:
 *     иначе появятся два писателя и URL с деревом разъедутся.
 *
 *  2. СОБСТВЕННОЕ состояние — sidebarOpen. В URL его нет и быть не должно: это
 *     положение мебели, а не адрес страницы.
 *
 *  selectSection() — намеренное исключение из правила «проекция URL»: клик по
 *  рейлу раскрывает сайдбар и показывает дерево раздела, не меняя страницу.
 *  Разделам без собственной страницы (Контрагенты, Справочники…) адрес не
 *  нужен — они живут только в сторе. */
interface WorkspaceState {
  activeId: SectionId;
  sidebarOpen: boolean;

  syncFromRoute: (route: { activeId: SectionId }) => void;
  setSidebarOpen: (open: boolean) => void;
  /** Выбор раздела кликом по рейлу: раскрыть сайдбар, не трогая адрес. */
  selectSection: (id: SectionId) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeId: 'home',
  sidebarOpen: true,

  syncFromRoute: ({ activeId }) =>
    set((prev) => (prev.activeId === activeId ? prev : { activeId })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  selectSection: (activeId) => set({ activeId }),
}));