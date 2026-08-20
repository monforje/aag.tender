import type { ReactNode } from 'react';

/**
 * Текст только для скринридеров: видимо скрыт, но остаётся в дереве
 * доступности и в потоке фокуса.
 *
 * КОГДА:  подпись у контрола, который визуально обходится иконкой, но чей
 *         смысл шире короткого aria-label («Create» у кнопки «+⌄»,
 *         «Number of unseen notifications» у счётчика).
 * НЕ ДЛЯ: скрытия контента, который просто не нужен — для этого не рендерьте
 *         его вовсе. И не для отключённых состояний: скринридер прочитает
 *         скрытое как обычный текст.
 *
 * UX:     не занимает места и не влияет на раскладку — ширина/высота 1px,
 *         вырезано clip-path. Класс глобальный (.visually-hidden в
 *         app/styles/global.css), потому что это утилита уровня документа,
 *         а не стиль компонента.
 * A11Y:   ради этого всё и затевается; не оборачивайте сюда важный видимый текст.
 *
 * @example
 * <button aria-label="Create"><Icon name="add" /><VisuallyHidden>Create</VisuallyHidden></button>
 */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="visually-hidden">{children}</span>;
}
