import { useCallback, useEffect, useLayoutEffect, useRef, type KeyboardEvent } from 'react';
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
 * UX:     ОДИН КАНАЛ ОТМЕЧЕННОСТИ — заливка. У неотмеченных опций её нет
 *         вовсе; вес шрифта и рамки состояние не кодируют. Носитель заливки —
 *         пилюля-индикатор: при переключении она ЕДЕТ к выбранной опции и на
 *         ходу перекрашивается в тон её режима (деньги — success, риск —
 *         danger), так что движение само показывает, откуда и куда перелито
 *         выделение (решение владельца 23.08.2026). Иконка называет режим до
 *         чтения подписи; у каждого глифа своя короткая микроанимация входа
 *         (второй канал, проигрывается один раз на hover или отметку).
 *         Нажатие — микросжатие под пальцем. Выбор следует за фокусом:
 *         стрелки не только двигают подсветку, но и применяют режим.
 * A11Y:   role="radiogroup"/"radio" + aria-checked — паттерн ARIA APG;
 *         roving tabindex (в списке табуляции одна кнопка), стрелки зациклены,
 *         Home/End ведут к краям ([R2]). Тон дублируется подписью — цвет не
 *         единственный носитель смысла. Пилюля aria-hidden: отмеченность
 *         объявляет сама опция.
 *
 * @example
 * <Segmented label="Пресет" value={preset} onChange={applyPreset}
 *            options={[{ id: 'bidding', label: 'Торги', tone: 'success', icon: 'graphUp' }, …]} />
 */
export function Segmented<T extends string>({
  label, value, onChange, options, className,
}: SegmentedProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLSpanElement | null>(null);
  const activeIndex = options.findIndex((o) => o.id === value);

  /* Пилюля ставится замером кнопки синхронно с разметкой кадра: на
     монтировании перехода нет — индикатор не «приезжает из левого края».
     Координата считается между rect-ами: не зависит от паддингов трека. */
  const placeThumb = useCallback(() => {
    const track = trackRef.current;
    const thumb = thumbRef.current;
    const option = activeIndex >= 0 ? refs.current[activeIndex] : null;
    if (!track || !thumb || !option) return;
    thumb.style.width = `${option.offsetWidth}px`;
    thumb.style.transform =
      `translateX(${option.getBoundingClientRect().left - track.getBoundingClientRect().left}px)`;
  }, [activeIndex]);

  useLayoutEffect(placeThumb, [placeThumb]);

  /* Ширины опций живут на тексте: подмена шрифта и перенос полосы меняют их
     после монтирования. Наблюдатель переставляет пилюлю, transition сам
     доезжает — рывка нет. */
  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(placeThumb);
    ro.observe(track);
    return () => ro.disconnect();
  }, [placeThumb]);

  /* Стрелки по APG radio: выбор следует за фокусом, обход зациклен. */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = activeIndex;
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
    <div
      ref={trackRef}
      role="radiogroup"
      aria-label={label}
      className={cx(s.segmented, className)}
      onKeyDown={onKeyDown}
    >
      {/* Носитель заливки: один на трек, геометрией равен отмеченной кнопке.
          Стоит ПЕРВЫМ — красится под кнопками, не перехватывая события
          (pointer-events у абсолютного слоя под z-index:1 и так закрыты). */}
      <span ref={thumbRef} aria-hidden="true" className={s.thumb} data-tone={options[activeIndex]?.tone} />
      {options.map((option, i) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={option.id === value}
          tabIndex={option.id === value ? 0 : -1}
          ref={(el) => { refs.current[i] = el; }}
          data-tone={option.tone}
          data-icon={option.icon}
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
