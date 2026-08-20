import { cx } from '@/shared/lib/cx';
import type { Tone } from '@/shared/ui/Badge';
import { Icon, type IconName } from '@/shared/ui/Icon';
import s from './MenuCheckItem.module.css';

/** Тон → класс. Таблицей, а не шаблонной строкой: классы модуля доступны
 *  ТОЛЬКО в camelCase (localsConvention), собранный из кебаба ключ молча
 *  вернул бы undefined. */
const TONE = {
  info: s.optInfo, success: s.optSuccess, warning: s.optWarning,
  danger: s.optDanger, neutral: s.optNeutral,
} as const;

/**
 * Строка мультивыбора в меню: отметка, подпись, необязательный тон.
 *
 * КОГДА:  меню, где выбирают НЕСКОЛЬКО значений подряд — фильтр, набор
 *         колонок, список получателей.
 * НЕ ДЛЯ: обычного пункта меню, который выполняет действие и закрывает меню
 *         (см. <MenuItem>); одиночного выбора из двух-трёх вариантов (там
 *         радиогруппа, а не чекбоксы).
 *
 * UX:     меню с такими пунктами НЕ закрывается по клику — значения выбирают
 *         сериями; за это отвечает <Dropdown closeOnSelect={false}>, иначе
 *         после первой же отметки панель схлопнется. Отметка слева, чтобы
 *         состояние читалось столбиком. С тоном квадрат-галочка заменяется
 *         круглым значком: у цветного значения уже есть цвет и глиф, галочка
 *         рядом кодировала бы то же самое второй раз.
 * A11Y:   role="menuitemcheckbox" + aria-checked — именно та роль, которая
 *         сообщает скринридеру, что меню останется открытым.
 *
 * @example
 * <MenuCheckItem checked={on} onToggle={flip} tone="danger" icon="closeCircle">Отменён</MenuCheckItem>
 */
export function MenuCheckItem({ checked, onToggle, tone, icon, children }: {
  checked: boolean;
  onToggle: () => void;
  /** Смысловой цвет значения — тот же, что у <Badge> в таблице. */
  tone?: Tone;
  /** Глиф внутри круглого значка. Без тона не имеет смысла: значок цветной. */
  icon?: IconName;
  children: string;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      className={cx(s.opt, tone && TONE[tone], checked && s.isOn)}
      onClick={onToggle}
    >
      {icon
        ? <span className={s.optGlyph} aria-hidden="true"><Icon name={icon} /></span>
        : <span className={s.optBox} aria-hidden="true" />}
      <span className={s.optLabel}>{children}</span>
    </button>
  );
}
