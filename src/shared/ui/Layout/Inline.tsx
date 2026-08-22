import type { HTMLAttributes } from 'react';
import { cx } from '@/shared/lib/cx';
import { gapStyle, type GapIndex } from './scale';
import s from './Layout.module.css';

export interface InlineProps extends HTMLAttributes<HTMLDivElement> {
  /** Зазор между элементами ряда в ступенях шкалы. Обязателен намеренно. */
  gap: GapIndex;
  /** Переносить ли ряд на новую строку, когда места не хватает. По умолчанию
   *  да: полосы контролов и чипы живут в потоке и обязаны не ломаться. */
  wrap?: boolean;
  align?: 'start' | 'center' | 'end' | 'baseline';
}

/**
 * Горизонтальная раскладка: ряд с единым зазором.
 *
 * КОГДА:  полоса контролов («поиск · период · фильтры»), строка бейджей,
 *         метаданные «автор · дата». Всё, что раньше собиралось на flex
 *         по месту.
 * НЕ ДЛЯ: вертикальной группы (см. <Stack>), сетки равных ячеек (см. <Grid>)
 *         и навигационных вкладок — у тех свои компоненты с клавиатурой.
 *
 * UX:     перенос включён по умолчанию, потому что ряд, вылезший за край,
 *         хуже ряда, перенесённого целиком: зазор сохраняется и на новой
 *         строке, раскладка не рассыпается на «почти помещается».
 * A11Y:   нейтральный <div>; визуальный порядок совпадает с DOM.
 *
 * @example
 * <Inline gap={2}>
 *   <SearchInput variant="capsule" … />
 *   <IconButton variant="topbar" icon="calendar" … />
 * </Inline>
 */
export function Inline({ gap: g, wrap = true, align = 'center', className, style, children, ...rest }: InlineProps) {
  return (
    <div
      className={cx(s.inline, wrap && s.inlineWrap, className)}
      style={{ ...gapStyle('--inline-gap', g), alignItems: align, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
