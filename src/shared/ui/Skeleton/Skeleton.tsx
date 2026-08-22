import type { CSSProperties } from 'react';
import { cx } from '@/shared/lib/cx';
import s from './Skeleton.module.css';

export interface SkeletonProps {
  /** Ширина блока: число (px), строка CSS ('100%', '12ch') или не задана —
   *  тогда блок растягивается контейнером. */
  width?: number | string;
  height?: number | string;
  radius?: number;
  className?: string;
}

/**
 * Заглушка «грузится»: серый блок волной на месте будущего содержимого.
 *
 * КОГДА:  данные в пути, но каркас экрана уже известен: строки таблицы,
 *         карточка, плитки. Собирайте из скелетов КОНТУР реального
 *         содержимого — по нему видно, что именно появится.
 * НЕ ДЛЯ: пустого результата («ничего не найдено» — см. <EmptyState>),
 *         ошибки (см. <ErrorState>) и фоновых процессов без места на экране
 *         (см. <Spinner>).
 *
 * UX:     волна вместо пульсации: движение горизонтальное, как чтение,
 *         и не мигает. Скелет НЕ оборачивается в role="status" сам: один
 *         анонс «загрузка» на область должен ставить тот, кто знает её
 *         границы, а не каждый блок.
 * A11Y:   aria-hidden — блок ничего не сообщает; текст для скринридера
 *         ставится снаружи, рядом со скелетом.
 *
 * @example
 * <Stack gap={2} aria-busy="true">
 *   <VisuallyHidden>Загружается…</VisuallyHidden>
 *   <Skeleton height={28} />
 *   <Skeleton height={14} width="70%" />
 * </Stack>
 */
export function Skeleton({ width, height = 14, radius = 4, className }: SkeletonProps) {
  const style: CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: `${radius}px`,
  };
  return <div aria-hidden="true" className={cx(s.skeleton, className)} style={style} />;
}
