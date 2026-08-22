import type { ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import s from './text.module.css';

/**
 * Клавиатурная клавиша или сочетание («Ctrl K», «Esc»).
 *
 * КОГДА:  хоткей рядом с пунктом меню, кнопкой или подсказкой поиска.
 * НЕ ДЛЯ: обычного текста и кода (это <Text>), а также перечня всех хоткеев
 *         приложения — тот живёт в справке, не в интерфейсе.
 *
 * UX:     намеренно тихий текст БЕЗ рамки-кейкапа: в эталоне хоткей —
 *         подсказка правее действия, и рамка сделала бы из него второй
 *         контрол. Сочетания пишутся так же, как их показывает ОС:
 *         «Ctrl K» с пробелом, без плюсиков.
 * A11Y:   aria-hidden внутри компонента: скринридер читает действие
 *         («Поиск, кнопка»), а не его шорткат.
 *
 * @example
 * <SearchTrigger … /> — уже рисует <Kbd>Ctrl K</Kbd> сама.
 */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span aria-hidden="true" className={cx(s.kbd, className)}>
      {children}
    </span>
  );
}

/** Звёздочка обязательности. Видимый канал; семантику несёт required контрола. */
export function RequiredMark() {
  return (
    <span aria-hidden="true" className={s.requiredMark}>
      *
    </span>
  );
}

/** Разделитель метаданных «·». Пунктуация для глаз, скринридер молчит. */
export function Dot({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cx(s.dot, className)}>
      ·
    </span>
  );
}

/** Одна строка с многоточием; полный текст — в title для наведения. */
export function TruncatedText({ children, title, className }: {
  children: ReactNode;
  /** Полный текст. Не задан — берётся строковое содержимое детей. */
  title?: string;
  className?: string;
}) {
  return (
    /* title ставится всегда, а не по факту обрезки: замер переполнения
       здесь стоил бы слушателей ради редкого случая. */
    <span className={cx(s.truncate, className)} title={title ?? toText(children)}>
      {children}
    </span>
  );
}

function toText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(toText).join('');
  if (typeof node === 'object' && 'props' in node) return toText((node as { props: { children?: ReactNode } }).props.children);
  return '';
}
