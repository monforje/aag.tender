import { useEffect, useRef } from 'react';
import type { ChangeEvent, InputHTMLAttributes, ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import s from './Checkbox.module.css';

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> {
  /** Подпись справа. Кликом по ней тоже переключают — это часть контрола,
   *  а не соседний текст. */
  children?: ReactNode;
  /** Прочерк «выбрана часть детей». Не третье значение: клик переводит
   *  его в checked, как у нативного инпута. */
  indeterminate?: boolean;
}

/**
 * Чекбокс: нативный input под собственной коробкой.
 *
 * КОГДА:  независимая отметка «да/нет» в фильтрах и формах; строка мультивыбора
 *         вне меню (внутри меню — <MenuCheckItem>).
 * НЕ ДЛЯ: взаимоисключающего выбора (см. <Radio>), включения РЕЖИМА, который
 *         применяется сразу (см. <Switch> — чекбокс обещает отправку формы),
 *         и выбора одного значения из списка значений (см. <Select>).
 *
 * UX:     indeterminate рисует прочерк и НЕ является третьим значением:
 *         клик переводит его в checked — так ведёт себя и нативный инпут.
 *         Ховер — заливка ступени .06; у отмеченной коробки фон темнеет тем
 *         же приёмом, что у primary-кнопки.
 * A11Y:   инпут настоящий: Space переключает, скринридер читает состояние
 *         сам. Коробка aria-hidden — её вид рисует состояние, которое уже
 *         объявлено инпутом. Кольцо фокуса получает коробка.
 *
 * @example
 * <Checkbox checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)}>
 *   Только открытые
 * </Checkbox>
 */
export function Checkbox({ children, className, style, indeterminate, ...rest }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  /* indeterminate не существует как атрибут — только свойство DOM, поэтому
     он не кладётся в {...rest} на инпут. */
  useEffect(() => {
    if (ref.current && indeterminate !== undefined) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    /* label обёрткой, а не htmlFor: подпись кликабельна целиком. */
    <label className={cx(s.label, className)} style={style}>
      <input ref={ref} type="checkbox" className={s.input} {...rest} />
      <span className={s.box} aria-hidden="true" />
      {children !== undefined && <span className={s.text}>{children}</span>}
    </label>
  );
}

export function isCheckboxChecked(e: ChangeEvent<HTMLInputElement>): boolean {
  return e.target.checked;
}
