import type { HTMLAttributes } from 'react';
import { cx } from '@/shared/lib/cx';
import { gapStyle, type GapIndex } from './scale';
import s from './Layout.module.css';

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  /** Горизонтальный зазор в ступенях шкалы. Обязателен намеренно. */
  gap: GapIndex;
  /** Отдельный межстрочный зазор; когда не задан, работает общий gap —
   *  для плиток одинаковых карточек этого достаточно. */
  rowGap?: GapIndex;
  /** Ровно N равных колонок. Взаимоисключаем с minColumnWidth. */
  columns?: number;
  /** Минимальная ширина колонки в px: сетка сама решает, сколько колонок
     влезло (auto-fill). Для карточек, чьё читабельное дно известно
     заранее, это надёжнее ручного числа колонок. */
  minColumnWidth?: number;
}

/**
 * Сетка равных ячеек.
 *
 * КОГДА:  плитки одинаковой природы — карточки объектов, поля сводки 2×2,
 *         галерея вложений.
 * НЕ ДЛЯ: колонок разной ширины под содержимое (это флекс, см. <Inline>) и
 *         таблиц данных (см. <Table> — там сравнивают строки, а не плитки).
 *
 * UX:     minmax(0, 1fr), а не просто 1fr: без нулевого минимума длинное
 *         слово внутри ячейки распирает колонку и ломает всё ряды соседей.
 * A11Y:   нейтральный <div>. Порядок чтения grid — слева направо построчно,
 *         как и ожидается; если порядок чтения важнее визуального порядка,
 *         кладите детей в нужном порядке DOM, а не order'ом.
 *
 * @example
 * <Grid gap={3} columns={2}>
 *   <Field label="Заказчик" htmlFor="client">{…}</Field>
 *   <Field label="Объект" htmlFor="site">{…}</Field>
 * </Grid>
 */
export function Grid({ gap: g, rowGap, columns, minColumnWidth, className, style, children, ...rest }: GridProps) {
  const track = minColumnWidth !== undefined
    ? `repeat(auto-fill, minmax(${minColumnWidth}px, 1fr))`
    : `repeat(${columns ?? 1}, minmax(0, 1fr))`;
  return (
    <div
      className={cx(s.grid, rowGap !== undefined && s.gridRows, className)}
      style={{
        ...gapStyle('--grid-gap', g),
        ...(rowGap !== undefined && gapStyle('--grid-row-gap', rowGap)),
        gridTemplateColumns: track,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
