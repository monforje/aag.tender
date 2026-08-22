import { cx } from '@/shared/lib/cx';
import type { Tone } from '@/shared/ui/Badge';
import s from './Progress.module.css';

export interface ProgressProps {
  /** Готовность 0–100. Без значения полоса становится неопределённой:
     процесс идёт, но процента нет. */
  value?: number;
  tone?: Extract<Tone, 'info' | 'success' | 'warning' | 'danger'>;
  /** Имя процесса для скринридера, когда рядом нет видимой подписи:
     «Загружено 40%» без имени — анонс ни о чём. */
  'aria-label': string;
  className?: string;
}

/**
 * Полоса прогресса.
 *
 * КОГДА:  процесс с измеримым ходом: загрузка файла, обработка пачки КП,
 *         заполненность обязательных полей.
 * НЕ ДЛЯ: процессов без процента на постоянке (см. <Spinner>) и загрузки
 *         контура экрана (см. <Skeleton>).
 *
 * UX:     неопределённый режим включается отсутствием value — потребителю
 *         не нужно выдумывать фейковые проценты. Ширина меняется плавно,
 *         но медленной ступенью: полоса — фон процесса.
 * A11Y:   роль progressbar со шкалой; при indeterminate aria-valuenow
 *         опускается — «идёт без процентов» честный анонс.
 *
 * @example
 * <Progress aria-label="Обработка предложений" value={64} />
 */
export function Progress({ value, tone = 'info', className, 'aria-label': ariaLabel }: ProgressProps) {
  const clamped = value === undefined ? undefined : Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cx(s.progress, className)}
    >
      <div
        className={cx(s.fill, clamped === undefined && s.fillIndeterminate)}
        style={{
          width: clamped === undefined ? undefined : `${clamped}%`,
          ...(tone !== 'info' && { '--progress-color': `var(--cu-tone-${tone})` }),
        }}
      />
    </div>
  );
}
