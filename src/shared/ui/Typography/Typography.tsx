import { createElement, type HTMLAttributes } from 'react';
import { cx } from '@/shared/lib/cx';
import s from './Typography.module.css';

/** Кегль текста: ступень шкалы --cu-text-*, а не пиксели. */
export type TextSize = 'xs' | 'sm' | 'base' | 'md';
/** Приглушение: ступени серой лестницы --cu-content-*. */
export type TextTone = 'inherit' | 'primary' | 'secondary' | 'tertiary' | 'quaternary';

const SIZE = {
  xs: 'var(--cu-text-xs)',
  sm: 'var(--cu-text-sm)',
  base: 'var(--cu-text-base)',
  md: 'var(--cu-text-md)',
} as const;

const TONE = {
  inherit: undefined,
  primary: 'var(--cu-content-primary)',
  secondary: 'var(--cu-content-secondary)',
  tertiary: 'var(--cu-content-tertiary)',
  quaternary: 'var(--cu-content-quaternary)',
} as const;

const LEADING = {
  same: 'var(--cu-leading-same)',
  tight: 'var(--cu-leading-tight)',
  normal: 'var(--cu-leading-normal)',
} as const;

export interface TextProps extends Omit<HTMLAttributes<HTMLElement>, 'color'> {
  /** Кегль по шкале. По умолчанию base — тело интерфейса. */
  size?: TextSize;
  /** Приглушение серой лестницей. По умолчанию наследует цвет родителя:
   *  примитив не должен перекрашивать то, о чём его не просили. */
  tone?: TextTone;
  /** Интерлиньяж: same — строки интерфейса (13/13 эталона), normal —
   *  связный текст из двух строк и больше. */
  leading?: keyof typeof LEADING;
  weight?: 'regular' | 'medium' | 'semibold';
  /** Одна строка с многоточием. Работает только на блочном контейнере —
   *  при as="span" добавьте display самим или берите div. */
  truncate?: boolean;
  /** Во что превратить разметку. span — по умолчанию (строка внутри
   *  чего-то); p — абзац; strong/em/time несут собственную семантику. */
  as?: 'span' | 'p' | 'div' | 'strong' | 'em' | 'time';
}

/**
 * Текст с явными кеглем и тоном — единственный способ выйти за унаследованный
 * вид строки.
 *
 * КОГДА:  подпись под полем (size sm, tone secondary), метаданные в карточке,
 *         любой текст, чей кегль отличается от унаследованного.
 * НЕ ДЛЯ: заголовков (см. <Heading> — там уровни и семантика h1–h3),
 *         кнопок и пунктов меню (те задают шрифт сами) и таблиц (у <Table>
 *         своя геометрия 14/20).
 *
 * UX:     тон НЕ меняет вес: приглушённый текст остаётся той же жирности —
 *         вторая ось одновременно превращает подпись в акцент. Числа,
 *         которые сравнивают глазами (суммы, проценты), выравнивайте
 *         tabular-nums на месте: это свойство данных ячейки, не текста.
 * A11Y:   разметка выбирается пропом as, поэтому p и time остаются
 *         настоящими элементами для скринридера, а не «дивом с текстом».
 *
 * @example
 * <Text size="sm" tone="secondary" leading="normal">
 *   Подача КП до 12.08.2026
 * </Text>
 */
export function Text({
  size = 'base', tone = 'inherit', leading = 'normal', weight,
  truncate, as = 'span', className, style, children, ...rest
}: TextProps) {
  return createElement(as, {
    className: cx(s.text, truncate && s.textTruncate, className),
    style: {
      '--text-size': SIZE[size],
      ...(tone !== 'inherit' && { '--text-color': TONE[tone] }),
      lineHeight: LEADING[leading],
      ...(weight && { fontWeight: `var(--cu-font-weight-${weight})` }),
      ...style,
    } as React.CSSProperties,
    ...rest,
  }, children);
}

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  /** Уровень документа, а не размер: h1 — один на страницу (заголовок
   *  экрана), h2 — разделы внутри неё, h3 — подзаголовки карточек. Размер
   *  следует за уровнем: 2xl / xl / md по шкале. */
  level: 1 | 2 | 3;
  truncate?: boolean;
}

const LEVEL_SIZE = { 1: 'var(--cu-text-2xl)', 2: 'var(--cu-text-xl)', 3: 'var(--cu-text-md)' } as const;

/**
 * Заголовок: уровень семантики, размер прилагается.
 *
 * КОГДА:  заголовок страницы или окна (h1/h2 через <PageTitle> и
 *         modalPart.title уже покрыты — здесь НОВЫЕ поверхности: карточка,
 *         панель, секция длинной формы).
 * НЕ ДЛЯ: заголовка самой страницы (не дублируйте <PageTitle>) и строк,
 *         которые просто выглядят крупно — крупность без уровня сбивает
 *         навигацию скринридера по заголовкам.
 *
 * UX:     вес semibold и цвет primary жёстко: иерархия заголовков держится
 *         на размере и уровне, а не на четвёртой вариации жирности.
 * A11Y:   рендерит честные h1–h3; уровень обязателен, чтобы страница не
 *         получила три h1 от трёх карточек.
 *
 * @example
 * <Card><Heading level={3} truncate>Объект: ЖК Северный</Heading>…</Card>
 */
export function Heading({ level, truncate, className, style, children, ...rest }: HeadingProps) {
  return createElement(`h${level}`, {
    className: cx(s.heading, truncate && s.headingTruncate, className),
    style: { fontSize: LEVEL_SIZE[level], ...style },
    ...rest,
  }, children);
}
