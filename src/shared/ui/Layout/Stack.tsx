import type { HTMLAttributes } from 'react';
import { cx } from '@/shared/lib/cx';
import { gapStyle, type GapIndex } from './scale';
import s from './Layout.module.css';

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  /** Вертикальный зазор в ступенях шкалы (1 = 4px … 9 = 36px). Обязателен
   *  намеренно: расстояние между блоками — решение макета, а не деталь по
   *  умолчанию, которую потом никто не помнит. */
  gap: GapIndex;
  /** Выравнивание по поперечной оси. По умолчанию stretch — колонка, чьи
   *  дети во всю ширину, это норма экрана; центр — осознанный выбор. */
  align?: 'start' | 'center' | 'end' | 'stretch';
}

/**
 * Вертикальная раскладка: колонка с единым зазором.
 *
 * КОГДА:  любая группа «сверху вниз» — поля формы, строки сводки, секции
 *         карточки. Один зазор на всю группу вместо трёх margin у детей.
 * НЕ ДЛЯ: горизонтального ряда (см. <Inline>), сетки равных ячеек
 *         (см. <Grid>) и потока текста — абзацам нужен свой ритм, а не флекс.
 *
 * UX:     один источник зазора означает, что дети не таскают собственные
 *         margin и группа сжимается/растягивается целиком без дыр по краям.
 *         Последний ребёнок прижат к следующей секции тем же зазором, что и
 *         все, — вертикальный ритм страницы остаётся ровным.
 * A11Y:   нейтральный <div> без ролей; порядок чтения совпадает с порядком
 *         детей, как и ожидает скринридер.
 *
 * @example
 * <Stack gap={3}>
 *   <Heading level={2}>Условия</Heading>
 *   <Field label="Срок подачи КП" htmlFor="due">{…}</Field>
 * </Stack>
 */
export function Stack({ gap: g, align = 'stretch', className, style, children, ...rest }: StackProps) {
  return (
    <div
      className={cx(s.stack, className)}
      style={{ ...gapStyle('--stack-gap', g), alignItems: align, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
