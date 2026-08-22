import type { ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import { Icon, type IconName } from '@/shared/ui/Icon';
import { CloseButton } from '@/shared/ui/Micro';
import type { Tone } from '@/shared/ui/Badge';
import s from './Alert.module.css';

/** Глиф по умолчанию: один тон — один глиф во всём приложении. */
const DEFAULT_ICON = {
  info: 'bell',
  success: 'checkCircle',
  warning: 'flag',
  danger: 'closeCircle',
  neutral: undefined,
} as const satisfies Record<Tone, IconName | undefined>;

const TONE_CLASS = {
  info: s.alertInfo,
  success: s.alertSuccess,
  warning: s.alertWarning,
  danger: s.alertDanger,
  neutral: s.alertNeutral,
} as const;

export interface AlertProps {
  tone?: Tone;
  /** Свой глиф поверх тонального по умолчанию. Тон при этом НЕ меняется:
   *  цвет и знак — независимые каналы (правило бейджа). */
  icon?: IconName;
  title?: string;
  /** Крестик появляется только вместе с обработчиком: алерт без выхода
     не рисует мёртвую кнопку. */
  onClose?: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * Алерт — сообщение, живущее В ПОТОКЕ страницы.
 *
 * КОГДА:  результат операции («КП получено»), предупреждение над формой,
 *         пояснение состояния раздела. Ставится над содержимым, к которому
 *         относится, и остаётся, пока актуально.
 * НЕ ДЛЯ: мгновенных подтверждений без места в потоке (см. <Toast>), ошибок
 *         загрузки области (см. <ErrorState>), подписи статуса-значения
 *         (см. <Badge>).
 *
 * UX:     пара «тихая подложка + ink того же тона» взята у бейджа: сообщение
 *         видно сразу, но не орёт. Заголовок держится весом, а не кеглем:
 *         тон уже покрасил сообщение, вторая крупная строка сделала бы из
 *         него плакат. Крестик гасит алерт НАВСЕГДА для этой сессии — это
 *         решение пользователя.
 * A11Y:   роль задаёт контекст размещения; внутри панелей ставьте
 *         role="alert" снаружи, когда сообщение появляется асинхронно.
 *         Крестик — настоящая кнопка с aria-label «Закрыть».
 *
 * @example
 * <Alert tone="warning" title="Срок подачи КП истекает завтра">
 *   Проверьте, что все поставщики получили приглашение.
 * </Alert>
 */
export function Alert({ tone = 'info', icon, title, onClose, children, className }: AlertProps) {
  const glyph = icon ?? DEFAULT_ICON[tone];
  return (
    <div role="alert" className={cx(s.alert, TONE_CLASS[tone], className)}>
      {glyph && <Icon name={glyph} className={s.alertIcon} />}
      <div className={s.alertBody}>
        {title && <div className={s.alertTitle}>{title}</div>}
        {children}
      </div>
      {onClose && <CloseButton variant="inherit" onClick={onClose} />}
    </div>
  );
}
