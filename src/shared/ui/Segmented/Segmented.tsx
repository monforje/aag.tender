import { useRef, type KeyboardEvent } from 'react';
import { cx } from '@/shared/lib/cx';
import { Icon, type IconName } from '@/shared/ui/Icon';
import type { Tone } from '@/shared/ui/Badge';
import s from './Segmented.module.css';

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  /** Смысловой тон режима: отмеченная опция ЗАЛИВАЕТСЯ своей тональной
   *  подложкой. Цвет дублирует подпись и иконку, а не заменяет их. */
  tone?: Tone;
  /** Ведущая иконка 14px. Декор: в покое третичным тоном, у отмеченной
   *  наследует цвет текста. */
  icon?: IconName;
}

interface SegmentedProps<T extends string> {
  /** Имя группы для скринридера: видимых подписей у сегмента нет. */
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<SegmentedOption<T>>;
  className?: string;
}

/**
 * Сегмент-контрол режимов: тихий трек, отмеченная опция наливается своим
 * тоном.
 *
 * КОГДА:  ровно несколько (два-четыре) частых и равноправных РЕЖИМА — пресеты
 *         сравнения, переключатель вида. Кнопки оправданы здесь и только здесь.
 * НЕ ДЛЯ: выбора значения из растущего списка (см. <Dropdown> — там пунктов
 *         больше, состав меняется, и ряд кнопок превратился бы в забор);
 *         действий (кнопка выполняет, сегмент СОСТОЯНИЕ выбирает).
 *
 * UX:     ОДИН КАНАЛ ОТМЕЧЕННОСТИ — заливка. Белой капсулы-пилюли нет вовсе:
 *         отмеченная опция наливается тональной подложкой своего режима
 *         (деньги — success, риск — danger), и переключение читается как
 *         перелив заливки со старой кнопки на новую, без физического объекта,
 *         который куда-то едет. Вес шрифта не меняется — второй канал кодировал
 *         бы то же состояние. Иконка — декор: называет режим до чтения
 *         подписи. Нажатие — микросжатие под пальцем. Выбор следует за
 *         фокусом: стрелки не только двигают подсветку, но и применяют режим.
 * A11Y:   role="radiogroup"/"radio" + aria-checked — паттерн ARIA APG;
 *         roving tabindex (в списке табуляции одна кнопка), стрелки зациклены,
 *         Home/End ведут к краям ([R2]). Тон дублируется подписью — цвет не
 *         единственный носитель смысла.
 *
 * @example
 * <Segmented label="Пресет" value={preset} onChange={applyPreset}
 *            options={[{ id: 'bidding', label: 'Торги', tone: 'success', icon: 'graphUp' }, …]} />
 */
export function Segmented<T extends string>({
  label, value, onChange, options, className,
}: SegmentedProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  /* Стрелки по APG radio: выбор следует за фокусом, обход зациклен. */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = options.findIndex((o) => o.id === value);
    const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const next = e.key === 'Home' ? 0
      : e.key === 'End' ? options.length - 1
        : dir !== undefined ? (i + dir + options.length) % options.length : null;
    if (next === null || i < 0) return;
    e.preventDefault();
    const option = options[next];
    if (option.id !== value) onChange(option.id);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className={cx(s.segmented, className)} onKeyDown={onKeyDown}>
      {options.map((option, i) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={option.id === value}
          tabIndex={option.id === value ? 0 : -1}
          ref={(el) => { refs.current[i] = el; }}
          data-tone={option.tone}
          className={cx(s.option, option.id === value && s.isOn)}
          onClick={() => onChange(option.id)}
        >
          {option.icon ? <Icon name={option.icon} className={s.optionIcon} /> : null}
          {option.label}
        </button>
      ))}
    </div>
  );
}
