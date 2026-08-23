import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { cx } from '@/shared/lib/cx';
import { useWorkspaceStore } from '@/entities/workspace';
import { Topbar } from '@/widgets/topbar';
import { Rail } from '@/widgets/rail';
import { Sidebar } from '@/widgets/sidebar';
import s from './Workspace.module.css';

/** Каркас приложения: топбар сверху, ниже ряд «рейл + карточка body».
 *  Страница приходит через <Outlet/> и занимает <main> — единственный узел,
 *  который меняется целиком при переключении раздела. */
export function Workspace() {
  const aiPanelOpen = useWorkspaceStore((st) => st.aiPanelOpen);
  const sidebarOpen = useWorkspaceStore((st) => st.sidebarOpen);

  /* Пауза хореографии нужна только когда панель открывается ИЗ-ПОД сайдбара:
     иначе такт «сайдбар схлопывается» пуст, и колонка зря ждёт. Значение
     сайдбара берётся из ПРОШЛОЙ закоммиченной отрисовки — поэтому реф
     обновляется В КОНЦЕ эффекта, уже после решения о паузе.
     Переменная ставится на КОРЕНЬ документа, а не на слот: её читает и бирка
     «Анализ ИИ» (AiTrigger) — свой старт езды со швом она синхронизирует с
     той же паузой. */
  const sidebarWasOpen = useRef(true);
  useEffect(() => {
    const root = document.documentElement;
    if (aiPanelOpen && !sidebarWasOpen.current) {
      root.style.setProperty('--ai-seq-delay', '0s');
    } else {
      root.style.removeProperty('--ai-seq-delay');
    }
    sidebarWasOpen.current = sidebarOpen;
    return () => {
      root.style.removeProperty('--ai-seq-delay');
    };
  }, [aiPanelOpen, sidebarOpen]);

  return (
    <div className={s.app}>
      <Topbar />
      <div className={s.workspace}>
        <Rail />
        <div className={s.body}>
          {/* Модификатор нужен ТОЛЬКО узкому экрану (см. @media в модуле):
              там сайдбар всплывает над содержимым и в закрытом состоянии
              уезжает за левый край целиком. На широком экране класс висит
              без последствий — правило под ним живёт внутри медиазапроса, а
              колонкой сайдбар по-прежнему распоряжается сам. */}
          <div className={cx(s.bodyWrapper, !sidebarOpen && s.bodyWrapperSidebarAway)}>
            <Sidebar />
            <main className={s.main}>
              <Outlet />
            </main>
            {/* ── Слот панели «Анализ ИИ» ─────────────────────────────────
                Третья колонка ряда, сосед <main> и сайдбара: main сжимается
                флексом сам (§4.10), его правая граница уезжает налево без
                всяких правил «если открыто». Смонтирован ВСЕГДА — закрытие
                гасит колонку классом (та же механика, что у .sidebar-final),
                а не размонтированием: содержимое странице отдаёт портал,
                и история чата переживает открытие/закрытие.
                id — стабильный адрес портала для страниц с панелью
                (TenderPage ищет его getElementById, приём AI_DOCK_ID). */}
            {/* Не <aside>: ориентиром служит сама панель (role="complementary"
                с именем внутри портала), обёртка слета — просто геометрия. */}
            <div
              className={cx(s.aiPanel, !aiPanelOpen && s.aiPanelClosed)}
              aria-hidden={!aiPanelOpen || undefined}
            >
              <div id="ai-panel-slot" className={s.aiPanelContent} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
