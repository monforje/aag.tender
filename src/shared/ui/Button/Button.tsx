import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import s from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Роль кнопки, а не её размер: primary — главное действие панели (ровно
   *  одно), secondary — все остальные. */
  variant: 'primary' | 'secondary';
  /** «Здесь что-то выбрано»: заливка в покое. Только ВИЗУАЛЬНОЕ состояние —
   *  если кнопка настоящий тоггл, передайте aria-pressed сами; у триггера
   *  меню его ставить нельзя, там уже есть aria-expanded. */
  on?: boolean;
  children: ReactNode;
}

/**
 * Кнопка с текстом: главное действие панели или рядовой контрол полосы.
 *
 * КОГДА:  любое действие с подписью на панельной шкале 32px — контрол полосы
 *         фильтров, триггер меню, «Очистить», «Готово».
 * НЕ ДЛЯ: действия без текста (см. <IconButton> — там вариант кодирует
 *         поверхность); главного действия в ШАПКЕ СТРАНИЦЫ (см. <ChipButton>,
 *         28px из эталона); пункта меню (см. <MenuItem>).
 *
 * UX:     primary единственная с заливкой в покое, поэтому у неё и ховер
 *         особый — осветление самого фона, а не альфа поверх. secondary берёт
 *         ступень .06 из каталога состояний (компактный контрол); с флагом
 *         on у неё появляется собственная заливка, и ховер шагает на .09.
 *         Отключённая кнопка гаснет, но не исчезает.
 * A11Y:   подпись внутри и есть имя кнопки — aria-label не нужен и вреден.
 *         Иконка внутри рисуется <Icon> и уже aria-hidden.
 *
 * @example
 * <Button variant="primary" onClick={close}>Готово</Button>
 * <Button variant="secondary" on={picked.length > 0} {...trigger}>Статус</Button>
 */
export function Button({ variant, on, className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(s.btn, variant === 'primary' ? s.btnPrimary : s.btnSecondary, on && s.isOn, className)}
      {...rest}
    >
      {children}
    </button>
  );
}
