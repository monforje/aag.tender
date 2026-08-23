import { useRef } from 'react';
import { cx } from '@/shared/lib/cx';
import { rovingTabsKeyDown } from '@/shared/lib/roving';
import s from './Page.module.css';

export interface SecondaryTab {
  id: string;
  label: string;
}

/**
 * Второй, опциональный слот шапки страницы: таблист-фильтр среза данных
 * (§4.10 эталона references/replies.html — Unread/Read у Replies).
 *
 * КОГДА:  сразу под <PageHeader withSecondary>, когда контент экрана делится
 *         на непересекающиеся вкладки. Вариант canvas — тот же таблист в ТЕЛЕ
 *         страницы, на сером холсте <main> (вкладки карточки тендера под
 *         сводкой): без фона, выше и крупнее, потому что там он не служебный
 *         фильтр среза в шапке, а главный переключатель экрана.
 * НЕ ДЛЯ: разделов приложения (те — рейл) и вложенных экранов (те — дерево +
 *         <Breadcrumbs>): таблист живёт строго внутри одной страницы и не
 *         меняет URL.
 *
 * UX:     активная вкладка — это цвет текста + нижняя полоска, второй
 *         подсветки не добавляется (одно состояние — один канал). Ховер —
 *         только у неактивной: у активной уже есть сильный индикатор.
 *         Вариант — это ПОВЕРХНОСТЬ, а не набор чисел: снаружи ни высота, ни
 *         кегль не задаются, иначе второй такой таблист приедет со своими
 *         значениями и разъедется с этим.
 * A11Y:   role="tablist" на списке, role="tab"/aria-selected на кнопках плюс
 *         клавиатура APG: роющий tabindex (активной 0, прочим −1) и стрелки
 *         с Home/End через общий rovingTabsKeyDown. Правило делится с
 *         <Tabs> — второй таблист проекта; раньше клавиатура была только
 *         там, а здесь те же роли стояли без неё, и семь вкладок карточки
 *         тендера обходились Tab'ом поштучно при молчащих стрелках.
 *
 * @example
 * <PageHeader withSecondary><PageTitle>Replies</PageTitle></PageHeader>
 * <SecondaryHeader
 *   tabs={[{ id: 'unread', label: 'Unread' }, { id: 'read', label: 'Read' }]}
 *   activeId={tab} onChange={setTab}
 * />
 */
export function SecondaryHeader({ tabs, activeId, onChange, variant = 'header' }: {
  tabs: SecondaryTab[];
  activeId: string;
  onChange: (id: string) => void;
  /** header — второй слот шапки экрана; canvas — полоса в теле страницы. */
  variant?: 'header' | 'canvas';
}) {
  const listRef = useRef<HTMLDivElement>(null);

  return (
    <div className={cx(s.mainSecondaryHeader, variant === 'canvas' && s.mainSecondaryHeaderCanvas)}>
      <div
        ref={listRef}
        className={s.tablist}
        role="tablist"
        onKeyDown={(e) => rovingTabsKeyDown(e, listRef.current, activeId, onChange)}
      >
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              data-id={tab.id}
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              className={cx(s.tab, active && s.isActive)}
              onClick={() => onChange(tab.id)}
            >
              <span className={s.tabContent}><span className={s.tabLabel}>{tab.label}</span></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
