import type { ReactNode, RefObject } from 'react';
import { cx } from '@/shared/lib/cx';
import { Icon } from '@/shared/ui/Icon';
import s from './SearchInput.module.css';

interface SearchInputProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** Подпись обязательна: визуальной у поля нет, а в полосе фильтров она
   *  съела бы место, ради которого поиск и растянут во всю ширину. */
  label: string;
  /** capsule — в полосе контролов, field — внутри панели. См. .module.css. */
  variant: 'capsule' | 'field';
  /** Фокус при открытии панели ставит вызывающая сторона: она знает, КОГДА
   *  панель открылась, а поле — нет. */
  inputRef?: RefObject<HTMLInputElement | null>;
  /** Второе действие в правой части поля («Снять 3»). Не очистка запроса —
   *  та встроена и живёт левее. */
  action?: ReactNode;
  className?: string;
}

/**
 * Поле поиска, которое сужает уже показанный список.
 *
 * КОГДА:  список, который не листают, а набирают — значения фильтра, строки
 *         таблицы, пункты панели. Выдача — сам список рядом.
 * НЕ ДЛЯ: поиска по всему пространству приложения: тому нужен экран под
 *         выдачу, и он открывается модалкой (см. <SearchTrigger> — это
 *         КНОПКА в форме капсулы, а не поле).
 *
 * UX:     фильтрация на каждый символ, без кнопки «Найти»: подтверждать
 *         нечего, результат виден сразу. Крестик показывается только когда
 *         есть что стирать. Фокус подсвечивается кольцом, а не заливкой —
 *         белую поверхность заливать нечем (рецепт 4 в каталоге состояний).
 * A11Y:   label уходит в aria-label поля; у крестика своя подпись, иначе он
 *         читается как безымянная кнопка.
 *
 * @example
 * <SearchInput variant="capsule" label="Поиск тендеров"
 *   value={q} onChange={setQ} placeholder="Поиск по номеру и названию" />
 */
export function SearchInput({
  value, onChange, placeholder, label, variant, inputRef, action, className,
}: SearchInputProps) {
  return (
    <div className={cx(s.search, variant === 'capsule' ? s.searchCapsule : s.searchField, className)}>
      <Icon name="search" className={s.searchIcon} />
      <input
        ref={inputRef}
        className={s.searchInput}
        type="text"
        value={value}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
      />
      {value ? (
        <button type="button" className={s.searchClear} aria-label="Очистить поиск" onClick={() => onChange('')}>
          <Icon name="closeCircle" />
        </button>
      ) : null}
      {action}
    </div>
  );
}
