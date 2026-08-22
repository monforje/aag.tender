import { useEffect, useRef } from 'react';
import { cx } from '@/shared/lib/cx';
import { SparkGlyph } from './assets/SparkGlyph';
import s from './AiTrigger.module.css';

/* Стабильные id связки «триггер ↔ панель»: оба рендерит страница тендера,
   встретиться им суждено только здесь. Тот же приём, что TITLE_ID у сводки. */
export const AI_TRIGGER_ID = 'ai-analysis-trigger';

/**
 * Кнопка «Анализ ИИ»: белая прямоугольная бирка с подписью, спектральным
 * шиммером и прямым скосом «\» слева снизу — триггер чат-панели анализа.
 *
 * КОГДА:  приклеена вплотную под нижней линией main header'а страницы
 *         (.main-header, полоса крошек), у правого края экрана — там, откуда
 *         выезжает сам анализ. Координаты якоря задаёт страница классом (см.
 *         .aiTrigger в TenderPage.module.css); пока панель открыта, бирка
 *         спрятана (.isOpen) — её место на линии занято чатом.
 * НЕ ДЛЯ: прочих действий с ИИ — спектр означает «недетерминированное
 *         поведение», и разменивать его на бытовые кнопки нельзя; поверхностей
 *         меню/фильтров (см. IconButton).
 *
 * UX:     подпись видна всегда — глиф-искра без слова не опознавался. Темп
 *         шиммера — язык состояния машины: покой ~4s, наведение быстрее,
 *         открытая панель — бирка спрятана, thinking — быстрое мерцание вместо
 *         спиннера, сбой — спектр обесцвечен. Скруглений нет: скос прямой.
 *         Вне экрана анимация ставится на паузу (IntersectionObserver +
 *         visibilitychange): зацикленный кадр не должен жечь GPU впустую.
 * A11Y:   имя кнопки — видимая подпись (Label in Name), aria-label не нужен;
 *         aria-expanded и aria-controls обязательны. Фокус при ЗАКРЫТИИ
 *         панели возвращается сюда САМИМ компонентом с preventScroll:
 *         закрытие не должно прокручивать страницу. prefers-reduced-motion:
 *         отдельная ветка модуля оставляет статичный градиентный кадр —
 *         движение выключено, цветовая принадлежность к ИИ осталась.
 *
 * @example
 * <AiTrigger open={open} thinking={thinking} controlsId={AI_DOCK_ID}
 *            onToggle={onToggle} />
 */
export function AiTrigger({
  open, thinking, failed, compact, controlsId, onToggle, className, label = 'Анализ ИИ',
}: {
  open: boolean;
  /** Запрос к модели в полёте — шиммер ускоряется. */
  thinking?: boolean;
  /** Ответ не получен — спектр обесцвечен до повторной попытки. */
  failed?: boolean;
  /** Под подписью нет места (липкая шапка таблицы встала на ту же линию) —
   *  бирка складывается до иконки: колейка подписи схлопывается, текст
   *  уезжает вправо и тает. Имя кнопки для скринридера не теряется:
   *  подпись остаётся в DOM. */
  compact?: boolean;
  /** id панели для aria-controls. */
  controlsId: string;
  onToggle: () => void;
  /** Класс от хозяина места: страница ставит бейдж фиксированным якорем
   *  под линией main header'а (см. .aiTrigger в TenderPage.module.css). */
  className?: string;
  /** Видимая подпись; она же — имя кнопки для скринридера. */
  label?: string;
}) {
  const localRef = useRef<HTMLButtonElement>(null);
  /* Панель была открыта и закрылась — фокус возвращается на бейдж. Здесь,
     а не у страницы: страница в момент вызова ещё рендерит открытую панель
     (скрытый бейдж нефокусируем), а эффект сработает уже после ререндера.
     preventScroll: закрытие чата не должно прокручивать страницу (бирка
     фиксирована на каркасе, но страховка остаётся за ним). */
  const wasOpen = useRef(false);

  useEffect(() => {
    if (wasOpen.current && !open) localRef.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

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
      ref={localRef}
      type="button"
      className={cx(
        s.trigger,
        open && s.isOpen,
        thinking && s.isThinking,
        failed && s.isFailed,
        compact && s.isCompact,
        className,
      )}
      aria-expanded={open}
      aria-controls={controlsId}
      onClick={onToggle}
    >
      <SparkGlyph size={16} />
      {/* Колейка подписи (рецепт 10 каталога): внешняя — анимируемая сетка
          1fr → 0fr, внутренняя прячет текст под overflow. Внутренняя несёт
          шиммер, внешняя — только ширину: у схлопывания и у раскрытия одна
          механика, что у капсулы статуса в сводке. */}
      <span className={s.labelCol}>
        <span className={s.label}>{label}</span>
      </span>
    </button>
  );
}
