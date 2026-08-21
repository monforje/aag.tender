import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { cx } from '@/shared/lib/cx';
import { Icon } from '@/shared/ui/Icon';
import { FORMATS, format, parse, toCss, type ColorFormat, type Hsva } from './color';
import s from './ColorPicker.module.css';

/** Пипетка есть только в Chromium. Проверяется наличие, а не браузер:
 *  «спросить у платформы» переживает следующую версию Safari, а список
 *  браузеров — нет. */
type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };
const EyeDropperApi = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Выбор произвольного цвета: площадка насыщенности, оттенок, прозрачность,
 * пипетка и поле ввода в трёх форматах.
 *
 * КОГДА:  цвет выбирает ЧЕЛОВЕК и значения у него нет — пометка колонки,
 *         подсветка, обложка. Геометрия снята с shadcn/ui color-picker
 *         (площадка, две полосы, ряд полей), палитра и токены — наши.
 * НЕ ДЛЯ: цвета, у которого есть СМЫСЛ: статус, стадия, результат проверки.
 *         Там пять тонов `--cu-tone-*` и <Badge> — свободный цветовой круг
 *         превращает значение в украшение и разъезжается между экранами.
 *         Не для выбора одного из нескольких заданных цветов: это список
 *         (см. <MenuCheckItem> с круглым значком тона).
 *
 * UX:     ВНУТРИ HSV, А НЕ RGB. Оси площадки — это ровно S и V, а оттенок
 *         обязан пережить уход в чёрный угол: в RGB чёрный это (0,0,0), и,
 *         вернувшись из угла, ползунок оттенка прыгнул бы на красный.
 *         Оттенок и прозрачность — НАТИВНЫЕ <input type="range">: стрелки,
 *         Home/End, PageUp/PageDown и повтор при удержании достаются от
 *         платформы, а собственная полоса на div'ах не умеет ничего из
 *         этого, пока не напишешь всё руками.
 *         Ввод разбирается САМИМ CSS (см. color.ts): понятны hex, rgb, hsl и
 *         имена цветов, а недопустимое просто не принимается — поле не
 *         дёргается и не ругается, значение остаётся прежним.
 *         Прозрачность живёт в своём поле и в hex НЕ входит: два органа
 *         управления одним числом всегда расходятся.
 *
 * A11Y:   площадка — фокусируемая цель со стрелками (шаг 2%, с Shift 10%) и
 *         подписью-значением в aria-valuetext: без неё она немой прямоугольник.
 *         Пипетка показывается, только если платформа её умеет, — кнопка,
 *         которая ничего не делает, хуже её отсутствия.
 *
 * @example
 * <ColorPicker value={color} onChange={setColor} />
 */
export function ColorPicker({
  value, onChange, className,
}: {
  /** Любая строка, понятная CSS: `#6366F1`, `rgb(99 102 241)`, `tomato`. */
  value: string;
  /** Отдаётся всегда как `rgba(...)` — её принимает и `color-mix`, и фон. */
  onChange: (color: string) => void;
  className?: string;
}) {
  const [hsva, setHsva] = useState<Hsva>(() => parse(value) ?? { h: 0, s: 0, v: 0, a: 1 });
  const [fmt, setFmt] = useState<ColorFormat>('hex');
  /* Черновик поля: пока в нём набирают, значение НЕ пересчитывается на каждый
     символ — иначе «#63» посреди набора уедет в чёрный и утащит за собой
     площадку. null — «не редактируют, показывай вычисленное». */
  const [draft, setDraft] = useState<string | null>(null);
  /* Последнее, что мы сами отдали наружу. Нужно, чтобы отличить приход нового
     value ИЗВНЕ от эха собственного onChange: без этого каждый свой же вызов
     возвращался бы обратно и терял оттенок на сером и на чёрном. */
  const emitted = useRef<string | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value === emitted.current) return;
    const next = parse(value);
    if (next) setHsva(next);
  }, [value]);

  const push = (next: Hsva) => {
    setHsva(next);
    emitted.current = toCss(next);
    onChange(emitted.current);
  };

  const track = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    push({
      ...hsva,
      s: clamp01((e.clientX - rect.left) / rect.width),
      v: 1 - clamp01((e.clientY - rect.top) / rect.height),
    });
  };

  const commit = (text: string) => {
    setDraft(null);
    const next = parse(text);
    /* Прозрачность из поля цвета не берётся: у неё своё. */
    if (next) push({ ...next, a: hsva.a });
  };

  const pure = `hsl(${hsva.h}, 100%, 50%)`;
  const css = toCss(hsva);

  return (
    <div className={cx(s.picker, className)} style={{ '--picked': css, '--pure': pure } as CSSProperties}>
      {/* Площадка насыщенности и яркости. Два градиента поверх чистого
          оттенка: белый по горизонтали, чёрный по вертикали — так устроен
          срез HSV при фиксированном H, и никакого рисования по канве для
          этого не нужно. */}
      <div
        ref={areaRef}
        className={s.area}
        role="slider"
        tabIndex={0}
        aria-label="Насыщенность и яркость"
        aria-valuetext={`${Math.round(hsva.s * 100)}% насыщенности, ${Math.round(hsva.v * 100)}% яркости`}
        aria-valuenow={Math.round(hsva.v * 100)}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); track(e); }}
        onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) track(e); }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.1 : 0.02;
          const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
          const dy = e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0;
          if (!dx && !dy) return;
          e.preventDefault();
          push({ ...hsva, s: clamp01(hsva.s + dx), v: clamp01(hsva.v + dy) });
        }}
      >
        <span
          className={s.areaHandle}
          style={{ left: `${hsva.s * 100}%`, top: `${(1 - hsva.v) * 100}%` }}
        />
      </div>

      {/* Оттенок и прозрачность — нативные range: клавиатура, повтор при
          удержании и перетаскивание уже написаны браузером. */}
      <input
        type="range" className={cx(s.slider, s.sliderHue)}
        min={0} max={360} step={1} value={Math.round(hsva.h)}
        aria-label="Оттенок"
        onChange={(e) => push({ ...hsva, h: Number(e.target.value) })}
      />
      <input
        type="range" className={cx(s.slider, s.sliderAlpha)}
        min={0} max={100} step={1} value={Math.round(hsva.a * 100)}
        aria-label="Непрозрачность"
        onChange={(e) => push({ ...hsva, a: Number(e.target.value) / 100 })}
      />

      <div className={s.row}>
        {EyeDropperApi ? (
          <button
            type="button" className={s.eyedrop}
            aria-label="Взять цвет с экрана" title="Взять цвет с экрана"
            onClick={() => {
              /* Отказ — это нажатый Escape, а не сбой: ловим и молчим. */
              new EyeDropperApi().open()
                .then(({ sRGBHex }) => { const next = parse(sRGBHex); if (next) push({ ...next, a: hsva.a }); })
                .catch(() => {});
            }}
          >
            <Icon name="pipette" />
          </button>
        ) : null}

        <select
          className={s.format}
          value={fmt}
          aria-label="Формат записи цвета"
          onChange={(e) => setFmt(e.target.value as ColorFormat)}
        >
          {FORMATS.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
        </select>

        <input
          className={s.field}
          value={draft ?? format(hsva, fmt)}
          aria-label="Значение цвета"
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(e.currentTarget.value); } }}
        />

        <input
          className={cx(s.field, s.fieldAlpha)}
          value={`${Math.round(hsva.a * 100)}%`}
          aria-label="Непрозрачность, проценты"
          onChange={(e) => {
            const n = Number(e.target.value.replace(/\D/g, ''));
            if (!Number.isNaN(n)) push({ ...hsva, a: clamp01(n / 100) });
          }}
        />
      </div>
    </div>
  );
}
