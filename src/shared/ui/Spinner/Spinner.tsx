import { cx } from '@/shared/lib/cx';
import { VisuallyHidden } from '@/shared/ui/VisuallyHidden';
import s from './Spinner.module.css';

export interface SpinnerProps {
  size?: 'sm' | 'md';
  /** Текст для скринридера. По умолчанию «Загрузка»; если процесс имеет
   *  имя («Отправка КП»), назовите его — анонс становится понятнее. */
  label?: string;
  className?: string;
}

/**
 * Индикатор процесса без места на экране.
 *
 * КОГДА:  короткое ожидание внутри контрола: кнопка отправляет форму,
 *         ячейка догружает число. Цвет наследуется — положите рядом с тем
 *         текстом, чей процесс крутится.
 * НЕ ДЛЯ: загрузки области с известным контуром содержимого (см.
 *         <Skeleton>), прогресса с процентами (см. <Progress>) и пустого
 *         состояния (см. <EmptyState>).
 *
 * UX:     вращение без ускорений и затуханий: это фон процесса, а не реакция
 *         на жест. Двух размеров достаточно: sm — внутри строки текста и
 *         кнопок, md — самостоятельный элемент.
 * A11Y:   role="status" объявляет появление; подпись скрыта визуально.
 *
 * @example
 * <Button variant="primary" disabled={sending}>
 *   {sending && <Spinner size="sm" label="Отправка" />} Отправить
 * </Button>
 */
export function Spinner({ size = 'md', label = 'Загрузка', className }: SpinnerProps) {
  return (
    /* aria-hidden на картинке: смысл несёт скрытый текст, а не кольцо. */
    <span className={cx(s.spinner, size === 'sm' ? s.isSm : s.isMd, className)}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {/* Разомкнутая окружность: разрыв виден даже на статичном кадре,
            поэтому процесс читается и при reduced-motion. */}
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray="42 15" />
      </svg>
      <VisuallyHidden>{label}</VisuallyHidden>
    </span>
  );
}
