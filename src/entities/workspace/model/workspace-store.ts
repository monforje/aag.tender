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
 *  2. СОБСТВЕННОЕ состояние — sidebarOpen, aiPanelOpen. В URL их нет и быть
 *     не должно: это положение мебели, а не адрес страницы.
 *
 *  selectSection() — намеренное исключение из правила «проекция URL»: клик по
 *  рейлу раскрывает сайдбар и показывает дерево раздела, не меняя страницу.
 *  Разделам без собственной страницы (Контрагенты, Справочники…) адрес не
 *  нужен — они живут только в сторе.
 *
 *  Сайдбар и панель «Анализ ИИ» связаны ОДНОСТОРОННЕ, и связь живёт здесь,
 *  в действии, а не у потребителей: ОТКРЫТИЕ панели закрывает сайдбар
 *  НАВСЕГДА (панель съедает ширину, ради которой его и прячут) — закрытие
 *  панели сайдбар НЕ возвращает. Вернуть дерево можно только явным жестом:
 *  клик по рейлу (он заодно закрывает панель). Поэтому панель открывают и
 *  закрывают только через openAiPanel()/closeAiPanel() — прямая запись
 *  `aiPanelOpen` в set() разорвала бы связку. */
interface WorkspaceState {
  activeId: SectionId;
  sidebarOpen: boolean;
  /** Открыта колонка «Анализ ИИ». */
  aiPanelOpen: boolean;

  syncFromRoute: (route: { activeId: SectionId }) => void;
  setSidebarOpen: (open: boolean) => void;
  /** Единственная дверь панели: открыть = попутно закрыть сайдбар,
   *  закрыть = ничего больше не трогать (сайдбар остаётся как есть). */
  openAiPanel: () => void;
  closeAiPanel: () => void;
  /** Выбор раздела кликом по рейлу: раскрыть сайдбар, не трогая адрес. */
  selectSection: (id: SectionId) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeId: 'home',
  sidebarOpen: true,
  aiPanelOpen: false,

  syncFromRoute: ({ activeId }) =>
    set((prev) => (prev.activeId === activeId ? prev : { activeId })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  openAiPanel: () => set({ aiPanelOpen: true, sidebarOpen: false }),
  closeAiPanel: () => set({ aiPanelOpen: false }),
  selectSection: (activeId) => set({ activeId }),
}));