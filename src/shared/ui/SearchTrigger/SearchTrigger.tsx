import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import { Icon } from '@/shared/ui/Icon';
import s from './SearchTrigger.module.css';

interface SearchTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Что искать — подсказка в покое. */
  placeholder?: string;
  /** Хоткей, открывающий тот же поиск. Показывается тише плейсхолдера. */
  hotkey?: string;
  /** Вторичное действие внутри той же капсулы (например «AI Chats»).
   *  Именно ВНУТРИ: это одна зона клика с двумя подсказками намерения. */
  secondary?: ReactNode;
}

/**
 * Поиск в шапке: белая капсула, которая открывает модальное окно поиска.
 *
 * КОГДА:  поиск по большому пространству — задачи, документы, люди. Выдача
 *         таким запросам нужна на весь экран.
 * НЕ ДЛЯ: фильтрации списка на месте: там нужен настоящий <input>, который
 *         сужает то, что уже на экране (см. поиск в шапке сайдбара).
 *
 * UX:     это КНОПКА, а не поле ввода — и форма об этом говорит раньше текста.
 *         Топбар весь на радиусе 6px, поэтому единственный полностью круглый
 *         элемент в ряду читается как «нажми, чтобы открыть», а не как строка
 *         ввода. Причина не стилистическая: в 260-пиксельной полоске негде
 *         показать выдачу, поэтому ввод живёт в модалке.
 *         Вторичное действие в покое молчит (серый текст без своего фона) и
 *         чуть темнеет вместе с наведением на всю капсулу — иначе поиск
 *         зрительно раскалывается на две кнопки.
 *         Hover — кольцо, а не заливка: белую поверхность заливать нечем
 *         (рецепт 4 в каталоге состояний).
 * A11Y:   кнопка с текстом внутри; при открытии модалки фокус переносится в
 *         поле ввода — это ответственность вызывающей стороны.
 *
 * @example
 * <SearchTrigger placeholder="Search" hotkey="Ctrl K"
 *   secondary={<><Icon name="ai" className={s.searchAiIcon} />AI Chats</>} />
 */
export function SearchTrigger({
  placeholder = 'Search', hotkey, secondary, className, ...rest
}: SearchTriggerProps) {
  return (
    <button type="button" className={cx(s.search, className)} {...rest}>
      <Icon name="search" className={s.searchIcon} />
      <span className={s.searchPlaceholder}>{placeholder}</span>
      {hotkey ? <span className={s.searchKbd}>{hotkey}</span> : null}
      {secondary ? <span className={s.searchAi}>{secondary}</span> : null}
    </button>
  );
}

/** Класс для иконки внутри вторичного действия — чтобы вызывающая сторона не
 *  лезла в модуль компонента за размером глифа. */
export const searchSecondaryIconClass = s.searchAiIcon;
