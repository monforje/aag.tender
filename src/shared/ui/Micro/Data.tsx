import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import type { Tone } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import s from './data.module.css';

const TONE_CLASS = {
  info: s.statusDotInfo,
  success: s.statusDotSuccess,
  warning: s.statusDotWarning,
  danger: s.statusDotDanger,
  neutral: s.statusDotNeutral,
} as const;

/**
 * Точка состояния: цвет тона, ноль подписи.
 *
 * КОГДА:  компактный индикатор рядом с именем или строкой списка («● в
 *         работе»), когда капсула <Badge> не влезает по плотности.
 * НЕ ДЛЯ: статуса-ЗНАЧЕНИЯ (см. <Badge> — там тон + глиф + подпись одним
 *         словом) и точек-счётчиков уведомлений (см. <Counter>).
 *
 * UX:     точка — ТОЛЬКО цвет. По правилу бейджа один статус кодируется
 *         несколькими каналами, поэтому рядом с точкой обязана стоять
 *         текстовая подпись; сама по себе точка годится для вторичного,
 *         дублирующего сигнала.
 * A11Y:   aria-hidden: смысл несёт подпись рядом, а не кружок.
 *
 * @example
 * <Inline gap={1}><StatusDot tone="success" /><Text size="sm">Активен</Text></Inline>
 */
export function StatusDot({ tone, className }: { tone: Tone; className?: string }) {
  return <span aria-hidden="true" className={cx(s.statusDot, TONE_CLASS[tone], className)} />;
}

export interface DeltaProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Числовая разница: знак даёт направление стрелки. */
  value: number;
  /** Как показать число (по умолчанию — локальная строка). */
  format?: (value: number) => string;
  /** Цвет смысла. Обязателен НЕЯВНО нарочно: «плюс = зелёный» верно не для
   *  всех величин (перерасход бюджета зелёным быть не должен), поэтому
   *  семантику называет домен, а не микро-компонент. */
  tone?: Tone;
}

/** Стрелка направления — глиф «вверх», повёрнутый для отрицательных.
 *  Тон → класс таблицей литералов: camelCaseOnly не знает кебаб-ключей. */
const DIR_CLASS = {
  positive: s.isPositive,
  negative: s.isNegative,
  neutral: s.isNeutral,
} as const;

export function Delta({ value, format, tone, className, ...rest }: DeltaProps) {
  const dir = value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral';
  const text = format ? format(value) : String(value);
  const colored = tone && dir !== 'neutral';
  return (
    <span
      className={cx(s.delta, DIR_CLASS[dir], className)}
      style={colored ? { color: `var(--cu-tone-${tone}-ink)` } : undefined}
      {...rest}
    >
      <Icon name="arrowUp" className={s.deltaIcon} />
      <span className={s.numeric}>{text}</span>
    </span>
  );
}

/** Цифры, которые сравнивают глазами: табличная выравнивка разрядов. */
export function NumericText({ children, className, ...rest }: HTMLAttributes<HTMLSpanElement> & { children: ReactNode }) {
  return (
    <span className={cx(s.numeric, className)} {...rest}>
      {children}
    </span>
  );
}

export interface AvatarGroupProps {
  children: ReactNode;
  /** Сколько показывать; хвост сворачивается в тихий счётчик «+N». */
  max?: number;
  /** Цвет кольца под группой — фон поверхности, НА которой лежит группа:
   *  на сером холсте белый обод будет светиться. */
  surfaceColor?: string;
  className?: string;
}

/**
 * Группа аватаров с перекрытием и хвостом переполнения.
 *
 * КОГДА:  участники тендера, ответственные, исполнители — список ЛИЦ рядом
 *         с чем-то.
 * НЕ ДЛЯ: одного человека (это голый <Avatar>) и списков с ролями и
 *         подписями — там строки списка, а не кучка кружков.
 *
 * UX:     перекрытие в 8px и кольцо цвета поверхности отделяют участников
 *         друг от друга; хвост «+N» тихий (--cu-fill-subtle), потому что это
 *         счётчик, а не шестой участник. Первый ребёнок лежит снизу стопки.
 * A11Y:   <Avatar> декоративен, поэтому имена участников обязаны стоять рядом
 *         текстом; «+N» дополнен скрытой подписью «и ещё N».
 *
 * @example
 * <Inline gap={2}><Text size="sm">Исполнители</Text>
 *   <AvatarGroup max={4}>
 *     {members.map((m) => <Avatar key={m.id} variant="user">{m.name[0]}</Avatar>)}
 *   </AvatarGroup>
 * </Inline>
 */
export function AvatarGroup({ children, max = 4, surfaceColor, className }: AvatarGroupProps) {
  const items = Array.isArray(children) ? children : [children];
  const shown = items.slice(0, max);
  const hidden = items.length - shown.length;

  return (
    <span
      className={cx(s.avatarGroup, className)}
      style={surfaceColor ? ({ '--avatar-group-bg': surfaceColor } as React.CSSProperties) : undefined}
    >
      {shown.map((child, i) => (
        <span key={i} className={s.avatarRing}>{child}</span>
      ))}
      {hidden > 0 && (
        /* Подпись для скринридера — единственный текст группы, который не виден глазу. */
        <span className={cx(s.avatarMore, s.avatarRing)}>
          +{hidden}
          <span className="visually-hidden">{`и ещё ${hidden}`}</span>
        </span>
      )}
    </span>
  );
}
