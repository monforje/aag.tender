import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import s from './Page.module.css';

/**
 * Основное действие экрана: тёмная кнопка-«таблетка» с текстом.
 *
 * КОГДА:  ровно одно действие на экране — то, ради которого сюда пришли
 *         («Manage cards»). Тёмная заливка это заявка на главную роль.
 * НЕ ДЛЯ: второстепенных действий: две тёмные кнопки рядом отменяют смысл
 *         обеих. Для остальных — <IconButton variant="page">. И не для панелей
 *         и меню: там панельная шкала 32px — <Button variant="primary">.
 *         Разделены намеренно: 28px здесь — число из эталона, слить их значит
 *         сдвинуть пиксели шапки страницы.
 *
 * UX:     единственный контрол в приложении с заливкой в покое, поэтому у него
 *         и hover особый — не альфа-заливка поверх, а осветление самого фона
 *         (32,32,32 → 58,58,58): по чёрному «таблетка» просто не читается.
 * A11Y:   текст внутри и есть подпись; отдельный aria-label не нужен и вреден.
 *
 * @example
 * <ChipButton onClick={openManager}>Manage cards</ChipButton>
 */
export function ChipButton({
  children, className, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button type="button" className={cx(s.chipBtn, className)} {...rest}>
      {children}
    </button>
  );
}
