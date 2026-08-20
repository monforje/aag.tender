import type { CSSProperties } from 'react';
import { cx } from '@/shared/lib/cx';
import s from './Avatar.module.css';

/** Роль аватара. Определяет размер, форму, кегль и цвет — см. комментарий
 *  в Avatar.module.css о том, почему это вариант, а не набор осей. */
export type AvatarVariant = 'workspace' | 'user' | 'tree';

/** Поверхность под аватаром: её цветом обводится точка статуса. */
export type AvatarSurface = 'main' | 'sidebar';

interface AvatarProps {
  /** Инициал. Одна-две буквы — больше не влезет и начнёт обрезаться. */
  children: string;
  variant: AvatarVariant;
  /** Показать точку «в сети». Только для человека: у workspace статуса нет. */
  online?: boolean;
  /** На какой поверхности лежит аватар — от этого зависит обводка точки.
   *  По умолчанию белая (топбар, меню, карточки). */
  surface?: AvatarSurface;
  className?: string;
}

const SURFACE_COLOR: Record<AvatarSurface, string> = {
  main: 'var(--cu-background-main)',
  sidebar: 'var(--cu-global-sidebar-background)',
};

/**
 * Круглый (или скруглённый) инициал: воркспейс, пользователь, участник в дереве.
 *
 * КОГДА:  везде, где человек или пространство представлены буквой.
 * НЕ ДЛЯ: иконок действий (см. Icon) и счётчиков (см. Counter).
 *
 * UX:     точка статуса значит РОВНО «человек сейчас в сети». Если та же буква
 *         означает что-то другое — например «назначено мне» в строке
 *         «Assigned to me», — точки быть не должно: одинаковая форма с разным
 *         смыслом читается как одно и то же состояние. Обводка точки всегда
 *         равна фону поверхности (проп surface), иначе точка выглядит наклейкой
 *         поверх аватара, а не вырезом в нём.
 * A11Y:   декоративен — имя человека всегда должно быть рядом текстом.
 *         Если аватар остаётся единственным носителем имени, оберните его
 *         подписью, а не пытайтесь озвучить букву.
 *
 * @example
 * <Avatar variant="user" online>D</Avatar>
 * <Avatar variant="tree" surface="sidebar" online>D</Avatar>
 * <Avatar variant="workspace">M</Avatar>
 */
export function Avatar({ children, variant, online, surface = 'main', className }: AvatarProps) {
  const variantClass = {
    workspace: s.avatarWorkspace,
    user: s.avatarUser,
    tree: s.avatarTree,
  }[variant];

  return (
    <span
      className={cx(s.avatar, variantClass, className)}
      style={online ? ({ '--av-surface': SURFACE_COLOR[surface] } as CSSProperties) : undefined}
    >
      {children}
      {online ? <span className={s.avatarStatus} aria-hidden="true" /> : null}
    </span>
  );
}
