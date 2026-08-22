import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import { gapStyle, type GapIndex } from '@/shared/ui/Layout';
import s from './Card.module.css';

/** Части карточки — классами, по той же причине, что modalPart у <Modal>:
 *  заголовок редко бывает голой строкой, а проп ReactNode всё равно пришлось
 *  бы оборачивать в чужой контейнер. */
export const cardPart = {
  head: s.cardHead,
  title: s.cardTitle,
  foot: s.cardFoot,
} as const;

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Поля в ступенях шкалы (4 = 16px — норма карточки). */
  padding?: GapIndex;
  children?: ReactNode;
}

/**
 * Карточка: белая поверхность с хэйрлайн-краем.
 *
 * КОГДА:  сгруппированный блок на сером холсте страницы: сводка тендера,
 *         панель настроек, плитка объекта.
 * НЕ ДЛЯ: модальных окон (см. <Modal>), выпадающих панелей (см. <Popover> —
 *         у тех ступень тени выше) и просто «обвести содержимое» — рамка
 *         без группировки шумит сильнее пустоты.
 *
 * UX:     край рисуется первым слоем тени (--cu-elevation-border-1), а не
 *         border'ом — белое на белом с настоящей рамкой даёт двойной край
 *         (§0.2(b)). Подъёма выше нет намеренно: карточка лежит НА странице,
 *         а не над ней.
 * A11Y:   нейтральный <div>; имя секции при необходимости — <Heading>
 *         внутри cardPart.head.
 *
 * @example
 * <Card padding={4}>
 *   <header className={cardPart.head}>
 *     <h3 className={cardPart.title}>Условия</h3>
 *     <Badge tone="info" icon="clock">Идёт сбор КП</Badge>
 *   </header>
 *   …
 *   <footer className={cardPart.foot}>…</footer>
 * </Card>
 */
export function Card({ padding = 4, className, style, children, ...rest }: CardProps) {
  return (
    <div className={cx(s.card, className)} style={{ ...gapStyle('--card-pad', padding), ...style }} {...rest}>
      {children}
    </div>
  );
}
