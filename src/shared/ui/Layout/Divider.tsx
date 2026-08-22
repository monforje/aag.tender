import { cx } from '@/shared/lib/cx';
import s from './Layout.module.css';

/**
 * Разделитель: единственная горизонтальная или вертикальная линия.
 *
 * КОГДА:  отделить секции внутри одной поверхности (сводка от таблицы,
 *         шапка карточки от тела) или поставить стенку между соседями ряда.
 * НЕ ДЛЯ: рамок вокруг содержимого (это поверхность, см. <Card>) и зазоров
 *         между блоками — пустое место разделяет мягче линии, линия
 *         утверждает «здесь кончилось одно и началось другое».
 *
 * UX:     линия одна на всё приложение и берётся из токена границы, а не
 *         рисуется серым по месту: когда шкала изменится, разделители
 *         изменятся вместе со всеми рамками. Толщина ровно 1px без
 *         обводок-«полужиров»: разделитель — пунктуация, а не акцент.
 * A11Y:   роль separator объявлена явно у <div>; для скринридера это
 *         ориентир «конец секции» (у <hr> семантика та же из коробки).
 *
 * @example
 * <Stack gap={3}>
 *   <TenderSummary />
 *   <Divider />
 *   <CompareTable />
 * </Stack>
 */
export function Divider({ orientation = 'horizontal', className }: {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cx(s.divider, orientation === 'vertical' ? s.dividerV : s.dividerH, className)}
    />
  );
}
