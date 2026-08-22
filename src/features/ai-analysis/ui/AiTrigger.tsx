import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { cx } from '@/shared/lib/cx';
import { SparkGlyph } from './assets/SparkGlyph';
import s from './AiTrigger.module.css';

/* Стабильные id связки «триггер ↔ панель»: оба рендерит страница тендера,
   встретиться им суждено только здесь. Тот же приём, что TITLE_ID у сводки. */
export const AI_TRIGGER_ID = 'ai-analysis-trigger';

/**
 * Кнопка «Анализ ИИ» — она же язычок панели: ОДИН элемент, который живёт во
 * всех состояниях анализа и морфируется вместе с ним.
 *
 * КОГДА:  приклеена вплотную под нижней линией main header'а страницы
 *         (.main-header, полоса крошек), у правого края экрана. Закрытый
 *         анализ — горизонтальная бирка «искра + подпись»; открытый — та же
 *         бирка, вытянутая в вертикальный язычок поверх правого края панели:
 *         ширина и высота меняются МЕСТАМИ одной парой длительности/кривой
 *         (внутренний блок при этом физически повёрнут на 90°, поэтому
 *         подпись честно читается столбиком и занимает бывшую длину).
 *         Клик всегда переключает состояние: раскрыть ⇄ закрыть.
 * НЕ ДЛЯ: прочих действий с ИИ — спектр означает «недетерминированное
 *         поведение», и разменивать его на бытовые кнопки нельзя; поверхностей
 *         меню/фильтров (см. IconButton).
 *
 * UX:     панель ВЫТЯГИВАЕТСЯ из-под кнопки: слайд колонки стартует от того же
 *         правого края, где висит бирка. Морф начинается после полной остановки
 *         панели (задержку держит CSS через --morph-delay). Глиф искры
 *         превращается в «‹‹»; на язычке он переливается спектром при
 *         наведении — приглашение закрыть. Темп шиммера — язык состояния
 *         машины: покой ~4s, наведение быстрее, thinking — быстрое мерцание
 *         вместо спиннера, сбой — спектр обесцвечен.
 * A11Y:   имя кнопки — видимая подпись; она остаётся в DOM и в язычке
 *         (повёрнутая), поэтому Label in Name не теряется ни в одном
 *         состоянии. aria-expanded и aria-controls обязательны. Фокус при
 *         ЗАКРЫТИИ панели возвращается сюда САМИМ компонентом с
 *         preventScroll: закрытие не прокручивает страницу.
 *         prefers-reduced-motion: движение выключено явно — статичный кадр,
 *         цветовая принадлежность к ИИ осталась.
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
   *  бирка складывается до иконки: колейка подписи схлопывается. Имя кнопки
   *  для скринридера не теряется: подпись остаётся в DOM. */
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
     а не у страницы: эффект сработает уже после ререндера.
     preventScroll: закрытие чата не должно прокручивать страницу. */
  const wasOpen = useRef(false);

  useEffect(() => {
    if (wasOpen.current && !open) localRef.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  /* Длина бирки — константа морфа: высота язычка обязана равняться прошлой
     ширине, а она зависит от шрифта. Источник правды — ВНУТРЕННИЙ блок:
     у рамки поточных детей нет (body абсолют), её собственная ширина — это
     сама переменная, и мерить её значило бы зациклиться (однажды пойманный
     мусор — ноль — блокировался бы навсегда). Меряется РОВНО ОДИН РАЗ на
     монте и повторно после готовности шрифтов; защита снизу отсекает мусор
     до того, как он попадёт в переменную и в геометрию морфа. */
  const [len, setLen] = useState<number | null>(null);
  const bodyRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => {
      const w = Math.ceil(el.getBoundingClientRect().width);
      if (w > 40) setLen(w);
    };
    measure();
    document.fonts?.ready.then(measure);
  }, []);

  /* Дожим — третья фаза хореографии. Таймер ставит класс чуть РАНЬШЕ полной
     остановки морфа (такт .2 + слайд .28 + морф .28 = 760ms; берём 620ms,
     чтобы хвост морфа и старт сжатия перекрылись и движение не имело мёртвой
     стыковки «остановился — поехал»). Состояние, а не CSS-задержки: ширина
     меняется только честными переходами, hover раскрывает мгновенно.
     prefers-reduced-motion: дожим немедленный, без ожидания. */
  const [slim, setSlim] = useState(false);
  useEffect(() => {
    if (!open) {
      setSlim(false);
      return;
    }
    const reduced = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setSlim(true);
      return;
    }
    const t = window.setTimeout(() => setSlim(true), 620);
    return () => window.clearTimeout(t);
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
      style={len ? ({ '--trigger-len': `${len}px` } as CSSProperties) : undefined}
      className={cx(
        s.trigger,
        open && s.isOpen,
        slim && s.isSlim,
        thinking && s.isThinking,
        failed && s.isFailed,
        compact && s.isCompact,
        className,
      )}
      aria-expanded={open}
      aria-controls={controlsId}
      onClick={onToggle}
    >
      {/* Внутренний блок ПОСТОЯННОГО размера: рамка вокруг него твинится
          (свап ширины и высоты), а сам он поворачивается на 90° — подпись
          ложится столбиком, искра остаётся фирменным знаком в обоих
          состояниях. */}
      <span ref={bodyRef} className={s.body}>
        <span className={s.glyph} aria-hidden="true">
          <SparkGlyph size={16} />
        </span>
        {/* Колейка подписи (рецепт 10 каталога): внешняя — анимируемая сетка
            1fr → 0fr, внутренняя прячет текст под overflow. */}
        <span className={s.labelCol}>
          <span className={s.label}>{label}</span>
        </span>
      </span>
    </button>
  );
}
