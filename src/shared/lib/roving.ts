import type { KeyboardEvent } from 'react';

/**
 * Клавиатура таблиста по APG: стрелки ходят по вкладкам, Home/End — на края.
 *
 * КОГДА:  на элементе стоит role="tablist", а внутри role="tab". Роль
 *         ОБЕЩАЕТ эту клавиатуру: объявив её и не дав стрелок, интерфейс
 *         врёт скринридеру — тот сообщает «вкладка 1 из 7», а стрелки не
 *         делают ничего.
 * НЕ ДЛЯ: списков и меню (там своя навигация — см. <Dropdown>) и одиночных
 *         кнопок: роющий tabindex нужен группе, а не элементу.
 *
 * Живёт в shared/lib, а не в <Tabs>, потому что таблистов в проекте ДВА:
 * <Tabs> (вкладки внутри окна/панели) и <SecondaryHeader> (полоса вкладок
 * экрана). Один держал клавиатуру, второй объявлял те же роли без неё —
 * копия правил разъехалась бы на первой же правке, поэтому правило одно.
 *
 * АКТИВАЦИЯ СЛЕДУЕТ ЗА ФОКУСОМ: вкладка включается в момент прихода фокуса,
 * отдельный Enter — лишний жест (APG допускает оба варианта; выбран этот,
 * потому что панели здесь дешёвые и мгновенные).
 *
 * Парная обязанность вызывающего — роющий tabindex: активной вкладке 0,
 * остальным −1. Без него Tab обходит все вкладки поштучно, и группа
 * перестаёт быть одной остановкой в порядке обхода.
 */
export function rovingTabsKeyDown(
  e: KeyboardEvent<HTMLElement>,
  list: HTMLElement | null,
  current: string,
  onChange: (id: string) => void,
): void {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const tabs = [...(list?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])];
  if (!tabs.length) return;

  const i = tabs.indexOf(document.activeElement as HTMLButtonElement);
  const next = e.key === 'ArrowRight' ? tabs[(i + 1) % tabs.length]
    : e.key === 'ArrowLeft' ? tabs[(i - 1 + tabs.length) % tabs.length]
      : e.key === 'Home' ? tabs[0]
        : tabs[tabs.length - 1];

  next?.focus();
  const id = next?.dataset.id;
  if (id && id !== current) onChange(id);
}
