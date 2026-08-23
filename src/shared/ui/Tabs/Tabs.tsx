import { useRef } from 'react';
import type { ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import { rovingTabsKeyDown } from '@/shared/lib/roving';
import s from './Tabs.module.css';

export interface TabItem {
  id: string;
  label: ReactNode;
  /** id панели, которую открывает вкладка, если она есть на экране:
   *  связка aria-controls даёт скринридеру дорогу к содержимому. */
  panelId?: string;
}

export interface TabsProps {
  items: ReadonlyArray<TabItem>;
  value: string;
  onChange: (id: string) => void;
  /** Имя таблиста обязательно: набор вкладок без имени для скринридера —
   *  просто ряд одинаковых кнопок. */
  'aria-label': string;
  className?: string;
}

/**
 * Вкладки с полной клавиатурой: переключение панелей внутри поверхности.
 *
 * КОГДА:  вкладки НЕ в полосе шапки страницы: секции карточки в боковике,
 *         режимы внутри окна или дровера.
 * НЕ ДЛЯ: таблиста-среза данных в шапке экрана (см. <SecondaryHeader> и
 *         <PageHeader withSecondary> — там своя геометрия полосы) и
 *         взаимоисключающих РЕЖИМОВ без панелей (см. <Segmented>).
 *
 * UX:     активная вкладка кодируется цветом текста и нижней полоской —
 *         теми же двумя каналами, что у SecondaryHeader: второй подсветки
 *         нет, одно состояние — один язык. Активация следует за фокусом:
 *         вкладок немного, и промежуточные проскакивать не жалко.
 * A11Y:   roving tabindex по APG: в табуляции участвует только активная
 *         вкладка, стрелки/Home/End ходят по списку. Панель, если задан
 *         panelId, получает связку aria-controls.
 *
 * @example
 * <Tabs aria-label="Разделы карточки" items={sections} value={section}
 *       onChange={setSection} />
 */
export function Tabs({ items, value, onChange, className, 'aria-label': ariaLabel }: TabsProps) {
  const listRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cx(s.tablist, className)}
      onKeyDown={(e) => rovingTabsKeyDown(e, listRef.current, value, onChange)}
    >
      {items.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            data-id={tab.id}
            aria-selected={active}
            aria-controls={tab.panelId}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cx(s.tab, active && s.isActive)}
          >
            <span className={s.tabContent}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
