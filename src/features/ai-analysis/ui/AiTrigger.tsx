import { useEffect, useRef, type Ref } from 'react';
import { cx } from '@/shared/lib/cx';
import { SparkGlyph } from './assets/SparkGlyph';
import s from './AiTrigger.module.css';

/**
 * Кнопка-искра: триггер панели «Анализ», единственное переливающееся пятно
 * интерфейса.
 *
 * КОГДА:  в строке названия тендера (правый край) — там, где открывается сам
 *         анализ этого тендера.
 * НЕ ДЛЯ: прочих действий с ИИ — глиф означает «недетерминированное
 *         поведение», и разменивать его на бытовые кнопки нельзя; поверхностей
 *         меню/фильтров (см. IconButton).
 *
 * UX:     темп переливания — язык состояния машины: покой 6s, наведение 3s,
 *         открытая панель — стоп-кадр, thinking — 0.9s (быстрое мерцание
 *         вместо спиннера), сбой — спектр обесцвечен. Поверхность по каталогу:
 *         наведение — таблетка, открыто — текущее состояние ступенью выше.
 *         Вне экрана анимация ставится на паузу (IntersectionObserver +
 *         visibilitychange): зацикленный кадр не должен жечь GPU впустую.
 * A11Y:   aria-expanded и aria-controls обязательны; имя действия — в
 *         aria-label, глиф скрыт от скринридера.
 *
 * @example
 * <AiTrigger open={open} controlsId={AI_DOCK_ID} onToggle={onToggle} />
 */
export function AiTrigger({
  open, thinking, failed, controlsId, onToggle, className, label = 'ИИ-анализ тендера', buttonRef,
}: {
  open: boolean;
  /** Запрос к модели в полёте — ускоряет переливание. */
  thinking?: boolean;
  /** Ответ не получен — спектр обесцвечен до повторной попытки. */
  failed?: boolean;
  /** id панели для aria-controls. */
  controlsId: string;
  onToggle: () => void;
  className?: string;
  label?: string;
  /** Хозяин состояния держит ссылку, чтобы вернуть фокус при закрытии панели. */
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  const localRef = useRef<HTMLButtonElement>(null);

  /* Пауза зацикленной анимации вне экрана. Атрибут, а не класс-состояние:
     признак чисто технический, компоненту состояния он не добавляет. */
  useEffect(() => {
    const el = localRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => {
      el.toggleAttribute('data-offscreen', !entry.isIntersecting);
    });
    io.observe(el);
    const onVisibility = () => {
      if (document.hidden) el.setAttribute('data-offscreen', '');
      else el.removeAttribute('data-offscreen');
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <button
      ref={(node) => {
        localRef.current = node;
        if (typeof buttonRef === 'function') buttonRef(node);
        else if (buttonRef && typeof buttonRef === 'object') buttonRef.current = node;
      }}
      type="button"
      className={cx(s.trigger, open && s.isOpen, thinking && s.isThinking, failed && s.isFailed, className)}
      aria-label={label}
      aria-expanded={open}
      aria-controls={controlsId}
      title={label}
      onClick={onToggle}
    >
      <SparkGlyph />
    </button>
  );
}
