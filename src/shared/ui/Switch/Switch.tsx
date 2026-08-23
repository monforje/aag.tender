import { cx } from '@/shared/lib/cx';
import s from './Switch.module.css';

export interface SwitchProps {
  checked: boolean;
  /** Управляемое переключение: компонент не держит состояние сам. */
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Имя контрола для скринридера. Обязателен: внутри свитча НЕТ текста,
   *  и без подписи это безымянная полоска. */
  'aria-label': string;
  className?: string;
}

/**
 * Выключатель режима, который применяется СРАЗУ.
 *
 * КОГДА:  настройка вида или поведения без формы: «показывать архив»,
 *         «уведомлять о КП». Состояние меняется в момент щелчка.
 * НЕ ДЛЯ: отметок, которые вступят в силу по кнопке «Готово» (см.
 *         <Checkbox> — форма ждёт отправки), и выбора одного из нескольких
 *         режимов (см. <Segmented> — свитч знает только два состояния).
 *
 * UX:     движение бегунка быстрое (.12s): свитч щёлкают часто, и длинная
 *         анимация превращает его в ожидание. Ховер — сильная ступень:
 *         у трека уже есть заливка в покое, слабая на ней не читается.
 * A11Y:   role="switch" + aria-checked объявляют состояние; подпись
 *         ОБЯЗАТЕЛЬНА пропом aria-label, потому что рисунка внутри нет.
 *         Enter и Space жмут кнопку сами.
 *
 * @example
 * <Switch checked={showArchive} onChange={setShowArchive}
 *         aria-label="Показывать архивные тендеры" />
 */
export function Switch({
  checked, onChange, disabled, className, 'aria-label': ariaLabel,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      /* Подпись ОБЯЗАНА доехать до DOM. Проп был объявлен обязательным в
         SwitchProps и потерян в деструктуризации: TypeScript такую потерю не
         видит — объявленный и не использованный проп для него норма, — и
         свитч уезжал в интерфейс безымянным, объявляясь «переключатель,
         выключено». */
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(s.switch, checked && s.isChecked, className)}
    >
      <span className={s.thumb} />
    </button>
  );
}
