import { useId } from 'react';
import s from './SparkGlyph.module.css';

/* Четырёхлучевая искра, viewBox 0 0 16 16, центр C=(8,8). Геометрия
   посчитана, не снята с глаза: острия на радиусе R=7 — (8,1), (15,8),
   (8,15), (1,8); контрольные точки кубик-кривых сидят на середине полуребра,
   смещённые наружу от оси на k = 0.05·R ≈ 0.35 — это даёт вогнутое пламя
   без «подушки» на гранях. Путь симметричен поворотом на 90°. */
const SPARK = 'M8 1C8.34 5.06 10.94 7.66 15 8C10.94 8.34 8.34 10.94 8 15'
  + 'C7.66 10.94 5.06 8.34 1 8C5.06 7.66 7.66 5.06 8 1Z';

/* Грани призмы: из центра в противоположные доли (точки талии на диагоналях,
   радиус 2.05 → смещение 1.45 по каждой оси). Декор и только. */
const FACETS = 'M8 8L9.45 6.55M8 8L6.55 9.45';

export type AiMarkState = 'idle' | 'processing' | 'success' | 'warning' | 'muted';

/** Скорости вращения по состояниям. Покой и «думает» совпадают с темпом
 *  shimmer язычка (4.2s / 0.9s) — два живых места ИИ дышат синхронно. */
const SPIN_BY_STATE: Partial<Record<AiMarkState, string>> = {
  idle: '6s',
  processing: '0.9s',
};

/**
 * Единый знак ИИ-ассистента и всё его семейство: спектральная искра с
 * вращающимся градиентом (--cu-ai-*), её плоская версия для мелких кеглей и
 * состояния processing / success / warning / muted.
 *
 * КОГДА:  любая точка присутствия ассистента — язычок панели, шапка режима,
 *         аватар ответа, пометка-искра у слота модели, декоративная линия.
 * НЕ ДЛЯ: обычных иконок (см. Icon) — этот знак означает принадлежность к
 *         недетерминированному поведению, а не действие; и для мест, где
 *         нужен ДРУГОЙ смысл (галочка успеха действия — checkCircle).
 *
 * UX:     ВРАЩЕНИЕ — признак жизни: скорость задаёт владелец переменной
 *         --ai-spin-duration либо проп state («processing» ускоряет сам).
 *         СОСТОЯНИЯ РЕЗУЛЬТАТА (success/warning/muted) СТОЯТ НА МЕСТЕ и
 *         перекрашиваются токенами тона — спектр оставлен покою и работе.
 *         FLAT — версия для ≤16px: градиентный мазок в кегле заметки грязнит
 *         и перестаёт читаться, там остаётся один силуэт цветом --cu-ai-b.
 * A11Y:   aria-hidden — смысл несёт текст вокруг; useId изолирует id
 *         градиента и клипа между экземплярами.
 *
 * @example
 * <SparkGlyph size={15} />                          // шапка панели
 * <SparkGlyph size={11} flat />                     // искра у слота модели
 * <SparkGlyph size={14} state="processing" />       // разбор считается
 */
export function SparkGlyph({ size = 18, className, state = 'idle', flat }: {
  size?: number;
  className?: string;
  state?: AiMarkState;
  /** Плоский силуэт: без градиента и вращения — для мелких кеглей и статичных
   *  поверхностей. Цвет — классом от состояния (см. module.css). */
  flat?: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const gradientId = `ai-g-${uid}`;
  const clipId = `ai-c-${uid}`;

  /* Статичные варианты: результат или плоский режим — заливка одним тоном,
     механика градиента не рендерится вовсе. */
  const solid = flat || state === 'success' || state === 'warning' || state === 'muted';
  const solidCls = flat && (state === 'idle' || state === 'processing')
    ? s.solidMark                       // flat в рабочем состоянии — фирменный тон
    : state === 'success' ? s.solidSuccess
      : state === 'warning' ? s.solidWarning
        : state === 'muted' ? s.solidMuted
          : s.solidMark;

  if (solid) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        aria-hidden="true"
        focusable="false"
        className={className}
      >
        <path d={SPARK} className={solidCls} />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={state === 'processing' ? { '--ai-spin-duration': SPIN_BY_STATE.processing } as React.CSSProperties : undefined}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className={s.stopA} />
          <stop offset="0.5" className={s.stopB} />
          <stop offset="1" className={s.stopC} />
        </linearGradient>
        <clipPath id={clipId}>
          <path d={SPARK} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {/* Полотно больше viewBox: диагональ кадра ~22.6, половина стороны
            20 покрывает поворот целиком — на углах мазок не кончается. */}
        <rect className={s.sheen} x="-12" y="-12" width="40" height="40" fill={`url(#${gradientId})`} />
      </g>
      <path d={FACETS} fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
