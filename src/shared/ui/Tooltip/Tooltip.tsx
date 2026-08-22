import {
  useEffect, useId, useRef, useState,
  cloneElement, isValidElement, type ReactElement, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import s from './Tooltip.module.css';

/** Пауза перед показом. 350 мс — тот же порог NN/g, что у <CellPopup>:
 *  короче — тултипы вспыхивают при проходе курсора по строке, длиннее —
 *  кажется, что подсказки нет вовсе. */
const SHOW_DELAY = 350;
/** Зазор от триггера и минимальный отступ от края экрана. */
const GAP = 8;
const EDGE = 8;

export interface TooltipProps {
  /** Текст подсказки. Ровно текст: разметка и интерактив внутри тултипа
   *  недоступны — он исчезает вместе с курсором. */
  text: string;
  children: ReactNode;
}

/**
 * Подсказка по наведению и фокусу.
 *
 * КОГДА:  короткое объяснение контрола или пометки, которое НЕ нужно для
 *         выполнения задачи: расшифровка сокращения, «почему кнопка гаснет».
 * НЕ ДЛЯ: обязательной информации (подпись поля — см. <Field>), панелей с
 *         содержимым (см. <Popover>), объяснения ячеек таблицы по ховеру
 *         (см. <CellPopup> — там мост курсора и один попап на экран) и
 *         длинных текстов (перенесите их в документацию).
 *
 * UX:     показывается с задержкой и только на hover:hover-устройствах —
 *         на тач-экранах наведения нет, и прятать за ним информацию нельзя.
 *         Ставится над триггером, а не под ним: снизу чаще стоит контент,
 *         который подсказка закроет. Прячется мгновенно и при прокрутке:
 *         она привязана к месту, а место уехало.
 * A11Y:   роль tooltip + aria-describedby на ребёнке (клонированием — ребёнок
 *         обязан принимать эти пропсы; нативные элементы принимают). Фокус
 *         с клавиатуры показывает ту же подсказку; Escape её гасит.
 *
 * @example
 * <Tooltip text="Сумма без НДС">
 *   <span tabIndex={0}>12 400 000 ₽</span>
 * </Tooltip>
 */
export function Tooltip({ text, children }: TooltipProps) {
  const [at, setAt] = useState<{ x: number; top: number; above: boolean } | null>(null);
  const rootRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<number>(undefined);
  const id = useId();

  /* aria-describedby ставится клонированием и только на время показа:
     существующий описатель ребёнка сохраняется, новый дописывается рядом. */
  let child = children;
  if (isValidElement(children)) {
    const el = children as ReactElement<{ 'aria-describedby'?: string }>;
    const prev = el.props['aria-describedby'];
    child = cloneElement(el, {
      'aria-describedby': at ? [prev, id].filter(Boolean).join(' ') : prev,
    });
  }

  const show = () => {
    if (!window.matchMedia('(hover: hover)').matches) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const target = rootRef.current?.firstElementChild;
      if (!target) return;
      const r = target.getBoundingClientRect();
      setAt({
        x: Math.min(Math.max(EDGE, r.left + r.width / 2), window.innerWidth - EDGE),
        top: r.top >= 48 ? r.top : r.bottom,
        above: r.top >= 48,
      });
    }, SHOW_DELAY);
  };

  const hide = () => {
    window.clearTimeout(timer.current);
    setAt(null);
  };

  /* Уехал контент — уехала подсказка: скролл ловится на capture в любом
     прокручиваемом предке и гасит её немедленно. */
  useEffect(() => {
    if (!at) return;
    const off = () => setAt(null);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAt(null); };
    document.addEventListener('scroll', off, true);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('scroll', off, true);
      document.removeEventListener('keydown', esc);
    };
  }, [at]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <>
      {/* Обёртка display:contents: не создаёт коробки в раскладке, но события
          детей всплывают через неё, а firstElementChild даёт прямоугольник
          триггера для позиционирования. */}
      <span ref={rootRef} className={s.root}
        onMouseEnter={show} onMouseLeave={hide}
        onFocus={show} onBlur={hide}
      >
        {child}
      </span>
      {at && createPortal(
        <div
          role="tooltip"
          id={id}
          className={s.bubble}
          style={{
            left: at.x,
            top: at.above ? undefined : at.top + GAP,
            bottom: at.above ? `calc(100dvh - ${at.top - GAP}px)` : undefined,
            transform: at.above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
          }}
        >
          {text}
        </div>,
        document.body,
      )}
    </>
  );
}
