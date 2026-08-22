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

/**
 * Спектральный глиф «Анализа»: искра, под клип-путём которой крутится
 * градиентный мазок (--cu-ai-*).
 *
 * КОГДА:  внутри <AiTrigger> — единственный потребитель; выносить отсюда
 *         можно будет при появлении второго места с тем же смыслом.
 * НЕ ДЛЯ: обычных иконок (см. Icon) — этот глиф означает принадлежность к
 *         недетерминированному поведению, а не действие.
 *
 * UX:     скорость вращения задаёт владелец переменной --ai-spin-duration
 *         (покой 6s / наведение 3s / «думает» 0.9s), пауза — --ai-spin-play;
 *         при открытой панели и вне экрана глиф стоит на месте.
 * A11Y:   aria-hidden — смысл несёт кнопка вокруг; useId для id градиента и
 *         клипа, чтобы два экземпляра на странице не делили url(#…).
 */
export function SparkGlyph({ size = 18, className }: {
  size?: number;
  className?: string;
}) {
  /* useId даёт строку с двоеточиями — в url(#…) они законны, но дешёвая
     нормализация снимает вопрос совместимости вовсе. */
  const uid = useId().replace(/:/g, '');
  const gradientId = `ai-g-${uid}`;
  const clipId = `ai-c-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      className={className}
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
