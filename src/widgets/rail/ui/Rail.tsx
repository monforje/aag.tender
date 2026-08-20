import { useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { NAV_TOP, type SectionId } from '@/entities/section';
import { useWorkspaceStore } from '@/entities/workspace';
import { Flyout, useFlyout } from '@/features/flyout';
import { RailExpandZone } from './RailExpandZone';
import { RailItem } from './RailItem';
import s from './Rail.module.css';

/**
 * Иконный док разделов — постоянный левый край приложения.
 *
 * КОГДА:  один раз на приложение, внутри каркаса рабочей области.
 * НЕ ДЛЯ: навигации внутри раздела — это дерево сайдбара.
 *
 * UX:     док никогда не сворачивается и не скроллится: это единственная
 *         точка, из которой доступны все разделы, и она обязана быть на месте
 *         всегда. Тёмная карточка на светлом холсте отделяет «где я в
 *         приложении» от «что я делаю» — поэтому у него своя палитра
 *         состояний (белые подсветки, рецепт 3), не совпадающая с остальным UI.
 * A11Y:   ссылки внутри дают обычную клавиатурную навигацию; превью по фокусу
 *         открывается той же логикой, что и по наведению.
 *
 * УСТРОЙСТВО: слот 64px владеет и карточкой 52px, и превью-панелью. Это ОДИН
 * компонент, а не два: у них общая система координат — panel лежит
 * position:fixed внутри слота, а слот объявлен container-type:size ради
 * единицы cqh, которой панель меряет свою высоту.
 *
 * @example
 * <Rail />
 */
export function Rail() {
  const slotRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const activeId = useWorkspaceStore((st) => st.activeId);
  const sidebarOpen = useWorkspaceStore((st) => st.sidebarOpen);
  const setSidebarOpen = useWorkspaceStore((st) => st.setSidebarOpen);
  const selectSection = useWorkspaceStore((st) => st.selectSection);

  const preview = useFlyout({ slotRef, activeId, sidebarOpen });

  /** Клик по разделу: раскрыть сайдбар и показать дерево раздела — без
   *  навигации. У разделов без своей страницы нет адреса, и страница
   *  остаётся прежней (в оригинале ClickUp рейл тоже менял только панель). */
  const openSection = (id: SectionId) => {
    selectSection(id);
    setSidebarOpen(true);
    preview.close();
  };

  /** Клик по пункту внутри превью: переход на тот же адрес, что и в дереве
   *  сайдбара, и закрытие панели — она показала, куда ведёт пункт, и свою
   *  роль выполнила. Сайдбар при этом не трогаем: состояние раскрытия — это
   *  позиция мебели, а не следствие навигации. */
  const goFromFlyout = (path: string) => {
    navigate(path);
    preview.close();
  };

  return (
    <div className={s.railSlot} ref={slotRef}>
      <div className={s.rail}>
        <RailExpandZone hidden={sidebarOpen} onExpand={() => setSidebarOpen(true)} />

        <div className={s.railBody}>
          {NAV_TOP.map((item) => (
            <RailItem
              key={item.id}
              item={item}
              active={activeId === item.id}
              flyoutOpen={preview.openId === item.id}
              arrowTop={preview.arrowTop}
              onEnter={preview.enter}
              onLeave={preview.leave}
              onFocus={preview.focus}
              onBlur={preview.scheduleClose}
              onSelect={openSection}
            />
          ))}
        </div>
      </div>

      <Flyout
        openId={preview.openId}
        noAnimation={preview.noAnimation}
        activePath={pathname}
        onNavigate={goFromFlyout}
        onMouseEnter={preview.cancelClose}
        onMouseLeave={preview.scheduleClose}
      />
    </div>
  );
}