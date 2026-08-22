import { createContext, useContext, useId, type ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import { RequiredMark } from '@/shared/ui/Micro';
import s from './Field.module.css';

/** Что поле сообщает контролу внутри себя. Контрол (Input, Textarea, Select)
 *  читает это через useFieldControl() и берёт себе, только если у него НЕТ
 *  собственных id/aria-атрибутов: явное значение потребителя всегда сильнее. */
export interface FieldControl {
  id?: string;
  describedBy?: string;
  invalid?: boolean;
}

const FieldContext = createContext<FieldControl>({});

export function useFieldControl(): FieldControl {
  return useContext(FieldContext);
}

/**
 * Поле формы = подпись + контрол + подсказка или ошибка.
 *
 * КОГДА:  любой ввод в форме или панели: обёртка вокруг <Input>,
 *         <Textarea>, <Select>.
 * НЕ ДЛЯ: чекбоксов, радио и свитчей (у них подпись СПРАВА и кликается сама,
 *         см. <Checkbox>), значений, которые правят на месте в сводке
 *         (см. <InlineInput>), поиска (см. <SearchInput>).
 *
 * UX:     ошибка заменяет подсказку, а не становится рядом: два серых текста
 *         под полем не читаются, а «подсказка + ошибка» спорят за один взгляд.
 *         Звёздочка обязательности — визуальный канал; само требование несёт
 *         нативный required на контроле.
 * A11Y:   связки ставятся автоматически: label htmlFor → контрол получает id,
 *         подсказка/ошибка → aria-describedby, ошибка → aria-invalid.
 *         Контролу достаточно лежать ВНУТРИ поля без единого пропа связки.
 *
 * @example
 * <Field label="Срок подачи КП" hint="По местному времени заказчика" error={err}>
 *   <Input required />
 * </Field>
 */
export function Field({ label, hint, error, required, className, children }: {
  label: string;
  /** Подсказка под контролом. Игнорируется, когда есть error. */
  hint?: ReactNode;
  /** Ошибка: перекрашивает кольцо контрола и заменяет собой подсказку. */
  error?: ReactNode;
  /** Звёздочка у подписи. Семантику обязательности несёт required самого
   *  контрола — здесь только видимый канал. */
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  const describedBy = error || hint ? helpId : undefined;

  return (
    <div className={cx(s.field, className)}>
      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- связка
          идёт через контекст: контрол внутри получит этот же id. */}
      <label className={s.label} htmlFor={id}>
        {label}
        {required && <RequiredMark />}
      </label>
      <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) || undefined }}>
        {children}
      </FieldContext.Provider>
      {error
        ? <p id={describedBy} className={cx(s.help, s.isError)}>{error}</p>
        : hint
          ? <p id={describedBy} className={s.help}>{hint}</p>
          : null}
    </div>
  );
}

/* id от useId() содержит двоеточия — в CSS-селекторах они недопустимы, но
   htmlFor/aria-describedby читают атрибут напрямую, так что связке это
   безразлично. Стили по этому id никто не пишет намеренно. */
