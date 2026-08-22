import type { InputHTMLAttributes } from 'react';
import { cx } from '@/shared/lib/cx';
import { useFieldControl } from '@/shared/ui/Field';
import s from './Input.module.css';

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>;

/**
 * Поле ввода текста — панельная шкала 32px.
 *
 * КОГДА:  ввод значения в форме или панели: обёртка <Field><Input/></Field>.
 * НЕ ДЛЯ: многострочного текста (см. <Textarea>), поиска, сужающего список
 *         на экране (см. <SearchInput>), выбора из известных значений
 *         (см. <Select>), правки значения прямо в сводке (см. <InlineInput>).
 *
 * UX:     высота и радиус взяты у вторичной кнопки, чтобы полоса «поле +
 *         кнопка» была одной высоты без подгонок. Ховер и фокус показываются
 *         кольцом (рецепт 4): белой поверхности нечем заливаться. Ширина
 *         по умолчанию во всю колонку — форма читается столбцом.
 * A11Y:   связки (id, aria-describedby, aria-invalid) приходят из <Field>
 *         через контекст; standalone-использование тоже валидно — тогда
 *         задайте id/label сами. :focus-visible, а не :focus: клик мышью
 *         в поле — это работа с кареткой, кольцо там не новость.
 *
 * @example
 * <Field label="Наименование закупки" required>
 *   <Input name="title" required placeholder="Поставка материалов" />
 * </Field>
 */
export function Input({
  id: idProp, className,
  'aria-invalid': ariaInvalid, 'aria-describedby': describedByProp,
  ...rest
}: InputProps) {
  const field = useFieldControl();
  const invalid = ariaInvalid ?? field.invalid;
  return (
    <input
      id={idProp ?? field.id}
      aria-invalid={invalid}
      aria-describedby={describedByProp ?? field.describedBy}
      className={cx(s.input, invalid === true && s.isInvalid, className)}
      {...rest}
    />
  );
}
