import { cx } from '@/shared/lib/cx';
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
 * A11Y:   role="tablist" на списке, role="tab"/aria-selected на кнопках.
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
  return (
    <div className={cx(s.mainSecondaryHeader, variant === 'canvas' && s.mainSecondaryHeaderCanvas)}>
      <div className={s.tablist} role="tablist">
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
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
