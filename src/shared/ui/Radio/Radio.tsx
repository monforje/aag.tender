import { createContext, useContext, useId } from 'react';
import type { ChangeEvent, InputHTMLAttributes, ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import { gapStyle, type GapIndex } from '@/shared/ui/Layout';
import s from './Radio.module.css';

interface RadioContextValue {
  name: string;
  value: string | undefined;
  onPick: (value: string) => void;
}

const RadioContext = createContext<RadioContextValue | null>(null);

export interface RadioProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'name'> {
  /** Значение варианта. Внутри группы — уникально; типизирует его сама
   *  <RadioGroup> через свой onChange. */
  value: string;
  children?: ReactNode;
}

/**
 * Радио-пункт. Живёт только внутри <RadioGroup>.
 *
 * КОГДА:  взаимоисключающий выбор из двух-четырёх вариантов, которые ВСЕГДА
 *         видны на экране: способ оплаты, режим показа.
 * НЕ ДЛЯ: независимых отметок (см. <Checkbox>), длинных списков (см.
 *         <Select> — пять и больше вариантов уже список) и включения режима
 *         мгновенным действием (см. <Switch>; для пары взаимоисключающих
 *         режимов есть ещё <Segmented>).
 *
 * UX:     клик по подписи выбирает так же, как по кругу. Отменить выбор
 *         нельзя (так устроены радио везде) — «ни один» это отдельный
 *         вариант в списке, а не повторный клик.
 * A11Y:   нативный input: стрелки ходят по группе сами, name приходит из
 *         группы через контекст.
 *
 * @example
 * <RadioGroup label="Вид сравнения" value={kind} onChange={setKind}>
 *   <Radio value="price">По цене</Radio>
 *   <Radio value="volume">По объёму</Radio>
 * </RadioGroup>
 */
export function Radio({ children, className, style, ...rest }: RadioProps) {
  const group = useContext(RadioContext);
  if (!group) {
    throw new Error('<Radio> обязан лежать внутри <RadioGroup>: без группы у него нет ни name, ни поведения выбора.');
  }
  return (
    <label className={cx(s.label, className)} style={style}>
      <input
        {...rest}
        type="radio"
        name={group.name}
        checked={group.value === rest.value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => { if (e.target.checked) group.onPick(rest.value); }}
        className={s.input}
      />
      <span className={s.dot} aria-hidden="true" />
      {children !== undefined && <span className={s.text}>{children}</span>}
    </label>
  );
}

export interface RadioGroupProps {
  /** Подпись группы целиком для скринридера (радио внутри неё теряют свои
   *  имена из контекста группы — групповое имя заменяет их). */
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  /** Вертикальный зазор между пунктами в ступенях шкалы (1 = 4px). */
  gap?: GapIndex;
  className?: string;
  children: ReactNode;
}

/**
 * Группа радио: имя, значение и вертикальный ритм.
 *
 * КОГДА:  обёртка над двумя-четырьмя <Radio>.
 * НЕ ДЛЯ: чекбоксов — они не группа, у каждого своё состояние.
 *
 * UX:     столбик с равным зазором; горизонтальный ряд радио ломается о
 *         локализацию первым же длинным вариантом.
 * A11Y:   role="radiogroup" + aria-label; name генерируется здесь и
 *         раздаётся контекстом, поэтому две группы на странице не спорят.
 *
 * @example — см. <Radio>.
 */
export function RadioGroup({ label, value, onChange, gap: g = 2, className, children }: RadioGroupProps) {
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(s.group, className)}
      style={gapStyle('--group-gap', g)}
    >
      <RadioContext.Provider value={{ name, value, onPick: onChange }}>
        {children}
      </RadioContext.Provider>
    </div>
  );
}
