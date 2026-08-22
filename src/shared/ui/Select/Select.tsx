import { useState } from 'react';
import { cx } from '@/shared/lib/cx';
import { Dropdown, MenuItem, MenuPanel } from '@/shared/ui/Dropdown';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { useFieldControl } from '@/shared/ui/Field';
import s from './Select.module.css';

export interface SelectOption<T> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<T> {
  /** Значения НЕ обязаны быть строками (id тендера, enum), но каждое должно
   *  иметь человеческую подпись — она же имя пункта для скринридера. */
  options: ReadonlyArray<SelectOption<T>>;
  value: T | null;
  onChange: (value: T) => void;
  /** Наличие пропа включает «Очистить» в подвале меню. */
  onClear?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Ширина меню — свойство содержимого (список отделов шире списка дат),
   *  поэтому задаётся снаружи, а не в примитиве. */
  menuClassName?: string;
}

/**
 * Выбор одного значения из списка.
 *
 * КОГДА:  поле формы или контрол полосы, где значение выбирают, а не вводят:
 *         статус, ответственный, шаблон.
 * НЕ ДЛЯ: многих значений сразу (см. <Dropdown closeOnSelect={false}> +
 *         <MenuCheckItem> — мультивыбор сериями), поля с непредсказуемыми
 *         значениями (см. <Input>), выбора внутри прокручиваемой ячейки
 *         таблицы (меню не выйдет за overflow-контейнер; там нужен
 *         <Popover>).
 *
 * UX:     нативный <select> НЕ используется сознательно: раскрытый список
 *         рисует ОС и внутри своей панели выглядит чужим телом, а <option>
 *         не стилизуется (та же причина, по которой dropdown-раскладка убрана
 *         из шапки календаря). Триггер повторяет поверхность поля: в форме
 *         селект читается полем. Меню закрывается выбором — одиночный выбор
 *         это один жест.
 * A11Y:   клавиатура досталась от <Dropdown>: ArrowDown открывает с фокусом
 *         в списке, стрелки/Home/End ходят по пунктам, Enter выбирает,
 *         Escape возвращает фокус на триггер. Роли menu/menuitemradio —
 *         грамматика меню этого проекта; отдельной listbox-обвязки нет
 *         намеренно, чтобы не завести вторую клавиатурную механику. Имя
 *         контролу даёт <Field>; вне поля задайте подпись сами.
 *
 * @example
 * <Field label="Ответственный">
 *   <Select
 *     options={users.map((u) => ({ value: u.id, label: u.name }))}
 *     value={ownerId}
 *     onChange={setOwnerId}
 *     onClear={() => setOwnerId(null)}
 *     placeholder="Не назначен"
 *   />
 * </Field>
 */
export function Select<T>({
  options, value, onChange, onClear, placeholder = '—', disabled,
  className, menuClassName,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const field = useFieldControl();
  const selected = options.find((o) => o.value === value);

  function renderOption(opt: SelectOption<T>) {
    return (
      <MenuItem
        key={String(opt.value)}
        checked={opt.value === value}
        disabled={opt.disabled}
        onSelect={() => onChange(opt.value)}
      >
        {opt.label}
      </MenuItem>
    );
  }

  /* Подвал с «Очистить» появляется только у очищаемого селекта; «Готово»
     рядом с ним нет, потому что выбор пункта и так закрывает меню. */
  const menu = onClear ? (
    <MenuPanel className={menuClassName} footer={
      <Button variant="secondary" onClick={onClear}>Очистить</Button>
    }>
      {options.map(renderOption)}
    </MenuPanel>
  ) : (
    <div className={menuClassName}>{options.map(renderOption)}</div>
  );

  return (
    <Dropdown
      open={open}
      onToggle={() => setOpen((v) => !v)}
      onClose={() => setOpen(false)}
      menu={menu}
      className={className}
    >
      {(trigger) => (
        <button
          {...trigger}
          disabled={disabled}
          id={field.id}
          aria-invalid={field.invalid}
          className={cx(s.trigger, field.invalid && s.isInvalid)}
        >
          <span className={cx(s.triggerValue, !selected && s.triggerPlaceholder)}>
            {selected ? selected.label : placeholder}
          </span>
          <Icon name="caretSmall" className={s.caret} />
        </button>
      )}
    </Dropdown>
  );
}
