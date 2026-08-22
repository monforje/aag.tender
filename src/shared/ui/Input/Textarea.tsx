import type { TextareaHTMLAttributes } from 'react';
import { cx } from '@/shared/lib/cx';
import { useFieldControl } from '@/shared/ui/Field';
import s from './Input.module.css';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * Многострочный текст — та же поверхность поля, но растущая по вертикали.
 *
 * КОГДА:  ввод длиннее одной строки: обоснование, условие договора, комментарий
 *         к решению. Обёртка <Field><Textarea/></Field>.
 * НЕ ДЛЯ: однострочного ввода (см. <Input> — высота и полоса у них общие,
 *         а «textarea поменьше» ломает и полосу, и клавиатурный жест Enter)
 *         и форматированного текста — богатая разметка это отдельный редактор.
 *
 * UX:     изменение размера разрешено только по вертикали: горизонтальный
 *         ресайз рвёт сетку формы и прячет текст за краем колонки. Высота
 *         задаётся rows вызывающей стороны: примитив не угадывает объём.
 * A11Y:   связки из <Field> — как у <Input>.
 *
 * @example
 * <Field label="Обоснование" hint="Видно всем участникам">
 *   <Textarea name="reason" rows={4} />
 * </Field>
 */
export function Textarea({
  id: idProp, className,
  'aria-invalid': ariaInvalid, 'aria-describedby': describedByProp,
  ...rest
}: TextareaProps) {
  const field = useFieldControl();
  const invalid = ariaInvalid ?? field.invalid;
  return (
    <textarea
      id={idProp ?? field.id}
      aria-invalid={invalid}
      aria-describedby={describedByProp ?? field.describedBy}
      className={cx(s.input, s.textarea, invalid === true && s.isInvalid, className)}
      {...rest}
    />
  );
}
