import type { KeyboardEvent } from 'react';
import { Icon } from '@/shared/ui/Icon';
import s from './SidebarHeader.module.css';

/**
 * Поиск по дереву панели: в покое кнопка 28×28, по фокусу — поле на всю
 * доступную ширину шапки.
 *
 * КОГДА:  фильтрация того, что уже на экране: длинный список, дерево, таблица.
 * НЕ ДЛЯ: глобального поиска по всему пространству — ему нужна модалка с
 *         местом под выдачу (см. shared/ui/SearchTrigger).
 *
 * UX:     поле не занимает место, пока им не пользуются: в шапке 256px три
 *         контрола и заголовок, фиксированная строка ввода вытеснила бы их.
 *         При фокусе заголовок схлопывается в ноль, а поле забирает всю
 *         ширину — правило живёт в SidebarHeader.module.css, потому что
 *         сцепляет три элемента сразу.
 *         Escape очищает и снимает фокус — выход из режима поиска одной
 *         клавишей, не трогая мышь. Enter не сабмитит: список фильтруется по
 *         мере ввода, отправлять нечего.
 * A11Y:   <label> оборачивает иконку и поле, поэтому клик по иконке ставит
 *         фокус в поле; отдельный aria-label дублирует placeholder для тех,
 *         кто не видит подсказку.
 *
 * СЕЙЧАС ЭТО ЗАГЛУШКА: ввод не трогает дерево — как и в эталоне.
 *
 * @example
 * <SidebarSearch />
 */
export function SidebarSearch() {
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.preventDefault();
    if (e.key === 'Escape') {
      e.currentTarget.value = '';
      e.currentTarget.blur();
    }
  };

  return (
    <label className={s.sidebarSearch} title="Search sidebar">
      <Icon name="search" />
      <input
        className={s.sidebarSearchInput}
        type="text"
        placeholder="Search sidebar..."
        autoComplete="off"
        aria-label="Поиск по сайдбару"
        onKeyDown={onKeyDown}
      />
    </label>
  );
}
