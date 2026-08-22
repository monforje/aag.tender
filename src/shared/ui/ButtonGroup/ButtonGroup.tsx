import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import { gapStyle, type GapIndex } from '@/shared/ui/Layout';
import s from './ButtonGroup.module.css';

type Common = Omit<HTMLAttributes<HTMLDivElement>, never> & { children?: ReactNode };

/**
 * Ряд связанных кнопок: либо со слепленными краями, либо с зазором шкалы.
 *
 * КОГДА:  два-три действия одной природы рядом — «Сравнить · Экспорт»,
 *         пара «‹ ›» в пагинации, «Отмена / Сохранить» в подвале панели.
 * НЕ ДЛЯ: взаимоисключающих режимов (см. <Segmented> — там одна отмеченная
 *         опция наливается тоном) и действий разного веса: главное действие
 *         рядом с рядовыми в слепленном ряду теряется.
 *
 * UX:     joined=true — это ОДИН составной контрол: у крайних кнопок
 *         остаётся скругление, внутренние прямые, а нахлёст в 1px не даёт
 *         рамкам задвоиться. Кнопка под курсором поднимается над соседями
 *         (z-index), чтобы её ховер читался целиком, а не обрезанной
 *         полоской.
 * A11Y:   роль group объявлена контейнером; кнопки остаются отдельными
 *         целями табуляции в порядке DOM — группа ничего не «съедает».
 *
 * @example
 * <ButtonGroup joined>
 *   <Button variant="secondary">Сравнить</Button>
 *   <Button variant="secondary">Экспорт</Button>
 * </ButtonGroup>
 */
export function ButtonGroup(props: ({ joined: true } | ({ joined?: false; gap: GapIndex })) & Common) {
  const { className, children } = props;

  if ('joined' in props && props.joined === true) {
    return (
      <div role="group" className={cx(s.group, s.joined, className)}>{children}</div>
    );
  }
  return (
    <div
      role="group"
      className={cx(s.group, className)}
      style={gapStyle('--inline-gap', (props as { gap: GapIndex }).gap)}
    >
      {children}
    </div>
  );
}

/* Зазор неслепленной группы кладётся в ту же переменную --inline-gap, что у
   <Inline>: обе полосы живут по одной шкале, и правило «ряд контролов — это
   Inline» остаётся верным, даже когда ряд собран через ButtonGroup. */
