import type { InputHTMLAttributes } from 'react';
import { cx } from '@/shared/lib/cx';
import { useFieldControl } from '@/shared/ui/Field';
import s from './NumberInput.module.css';

export interface NumberInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'value' | 'onChange' | 'type'> {
  value: number;
  /** Отдаётся ЧИСЛО, а не событие: у поля со степпером два источника ввода —
   *  клавиатура и кнопки, и потребителю не должно быть важно, какой сработал.
   *  Зажимать значение к границам — задача вызывающего (у порогов сравнения
   *  это `clampThresholds`): поле знает про min/max ровно столько, чтобы
   *  погасить кнопку, а не столько, чтобы решать за домен. */
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Шаг кнопок и стрелок клавиатуры. По умолчанию 1. */
  step?: number;
  /** Единица ВНУТРИ контрола, сразу за числом: «%», «×», «шт». Там, а не в
   *  подписи: «15» и «15 %» — разные утверждения, и читаются они вместе с
   *  числом, а не через полстроки. Тоном тише самого значения — единица
   *  постоянна, меняется число. */
  unit?: string;
}

/**
 * Числовое поле со своими кнопками «−» и «+».
 *
 * КОГДА:  число, которое подкручивают, а не набирают: пороги, проценты,
 *         коэффициенты, количества. Обёртка та же, что у обычного поля:
 *         <Field label="…"><NumberInput … /></Field>.
 * НЕ ДЛЯ: чисел, которые НАБИРАЮТ целиком и никогда не правят на единицу —
 *         ИНН, номер счёта, телефон: там нужен <Input> с
 *         inputMode="numeric", а шаг и стрелки только мешают. Не для текста
 *         (см. <Input>), не для значения, которое правят прямо в сводке
 *         (см. <InlineInput>), и не для счётчика-бейджа (см. <Counter>).
 *
 * UX:     НАТИВНЫЕ СТРЕЛКИ СНЯТЫ и заменены своими. У браузерного спиннера
 *         ширина порядка 8px, показывается он только по наведению и выглядит
 *         в каждом движке по-своему; на таче его нет вовсе. Свои кнопки —
 *         24px по ширине при высоте поля 32px, то есть проходят порог
 *         WCAG 2.2 SC 2.5.8 (Target Size, минимум 24×24), ради которого всё
 *         и затевалось.
 *         СТОЯТ ПО БОКАМ, а не столбиком: две половинки по 16px повторили бы
 *         ошибку нативного контрола, только крупнее. Значение между ними —
 *         по центру: с кнопкой слева прижатое вправо число читается криво.
 *         Единица (`unit`) стоит ВНУТРИ контрола сразу за числом — «15» и
 *         «15 %» это разные утверждения, и читать их надо вместе.
 *         НА ГРАНИЦЕ ДИАПАЗОНА КНОПКА ГАСНЕТ. Кнопка, которая нажимается и
 *         ничего не делает, врёт о состоянии; погашенная сразу говорит, что
 *         дальше некуда.
 *         Удержания с автоповтором нет намеренно: диапазоны здесь в десятки
 *         единиц, доехать кликами реально, а таймер повтора — лишний источник
 *         расхождения значения с тем, что видит глаз.
 * A11Y:   type="number" сохранён — от него бесплатно приходят ↑/↓ с
 *         клавиатуры, шаг, границы и цифровая клавиатура на мобильном.
 *         Кнопки несут aria-label и УБРАНЫ ИЗ ТАБУЛЯЦИИ (tabIndex={-1}):
 *         они дублируют стрелки, уже работающие в самом поле, и без этого на
 *         каждое поле формы приходилось бы по три остановки Tab вместо одной.
 *         Связки (id, aria-describedby, aria-invalid) приходят из <Field>
 *         через контекст — ровно как у <Input>.
 *
 * @example
 * <Field label="Разброс «высокий», %" hint="Строка получает тег и фильтр.">
 *   <NumberInput value={t.spreadHigh} min={1} max={100}
 *                onChange={(v) => patch({ spreadHigh: v })} />
 * </Field>
 */
export function NumberInput({
  value, onChange, min, max, step = 1, unit,
  id: idProp, className, disabled,
  'aria-invalid': ariaInvalid, 'aria-describedby': describedByProp,
  ...rest
}: NumberInputProps) {
  const field = useFieldControl();
  const invalid = ariaInvalid ?? field.invalid;

  const atMin = min !== undefined && value <= min;
  const atMax = max !== undefined && value >= max;

  /* Шаг считается от ТЕКУЩЕГО значения и зажимается к границам здесь же:
     иначе поле с шагом 0.5 и потолком 10 отдало бы наружу 10.5, и вернуть
     его в диапазон пришлось бы каждому потребителю по-своему. */
  const bump = (direction: 1 | -1) => {
    const next = value + direction * step;
    const clamped = Math.min(max ?? next, Math.max(min ?? next, next));
    /* Плавающая точка: 3 + 0.5 даёт 3.5, но 0.1 + 0.2 — 0.30000000000000004.
       Округляем до разрядности шага, иначе в поле появится хвост из нулей. */
    const decimals = (String(step).split('.')[1] ?? '').length;
    onChange(Number(clamped.toFixed(decimals)));
  };

  return (
    <div className={cx(s.field, invalid === true && s.isInvalid, disabled && s.isDisabled, className)}>
      <button
        type="button"
        className={s.step}
        tabIndex={-1}
        disabled={disabled || atMin}
        aria-label="Уменьшить"
        onClick={() => bump(-1)}
      >
        {/* Типографский минус U+2212, а не дефис: он одной ширины и одной
            высоты с плюсом, и пара кнопок не выглядит косой. Плоских «плюс» и
            «минус» в Solar нет — только обведённые, а они внутри рамки поля
            читались бы отдельными бейджами. */}
        <span aria-hidden="true">−</span>
      </button>
      <input
        {...rest}
        type="number"
        inputMode="numeric"
        id={idProp ?? field.id}
        className={s.control}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedByProp ?? field.describedBy}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {/* Единица — не часть значения: aria-hidden, иначе скринридер прочтёт
          «15 процент» вторым узлом после самого поля. Смысл величины несёт
          подпись поля. */}
      {unit ? <span className={s.unit} aria-hidden="true">{unit}</span> : null}
      <button
        type="button"
        className={s.step}
        tabIndex={-1}
        disabled={disabled || atMax}
        aria-label="Увеличить"
        onClick={() => bump(1)}
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
