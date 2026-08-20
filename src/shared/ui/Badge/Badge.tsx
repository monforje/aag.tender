import type { ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import { Icon, type IconName } from '@/shared/ui/Icon';
import s from './Badge.module.css';

/** Смысловой тон: «идёт», «завершено», «отменено», «ничего особенного».
 *  Один тип на всё приложение — им же типизируются доменные таблицы статусов
 *  (например STATUS в entities/tender), поэтому домен не заводит своих
 *  строковых литералов и не может разъехаться с палитрой. */
export type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

/** Тон → класс. Таблицей, а не шаблонной строкой s[`badge--${tone}`]:
 *  localsConvention:'camelCaseOnly' отдаёт классы ТОЛЬКО в camelCase, и
 *  собранный из кебаба ключ молча вернул бы undefined. */
const TONE = {
  info: s.badgeInfo, success: s.badgeSuccess, warning: s.badgeWarning,
  danger: s.badgeDanger, neutral: s.badgeNeutral,
} as const;

/**
 * Капсула состояния: тихая заливка тона, глиф и подпись.
 *
 * КОГДА:  значение поля, у которого есть СМЫСЛОВОЙ цвет — статус, стадия,
 *         результат проверки. Ячейка таблицы, шапка карточки, строка списка.
 * НЕ ДЛЯ: количества (см. <Counter>), действия (см. <Button>) и выбора
 *         значения (см. <MenuCheckItem> — там тот же тон, но кликабельный).
 *
 * UX:     цвет НЕ единственный канал: рядом обязателен глиф, иначе состояние
 *         неразличимо при дальтонизме и в чёрно-белой печати. Один статус —
 *         один тон и один глиф во всех местах сразу, поэтому и тон, и иконку
 *         компонент получает пропами из доменной таблицы, а не выбирает сам.
 *         Заливка в покое, реакции на курсор нет: это подпись, а не контрол.
 * A11Y:   обычный текст в потоке — скринридер читает подпись; глиф
 *         aria-hidden, потому что дублирует её.
 *
 * @example
 * <Badge tone="success" icon="checkCircle">Закрыт</Badge>
 */
export function Badge({ tone, icon, className, children }: {
  tone: Tone;
  icon?: IconName;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cx(s.badge, TONE[tone], className)}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </span>
  );
}
