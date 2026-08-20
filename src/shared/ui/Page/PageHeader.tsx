import type { ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import s from './Page.module.css';

/**
 * Шапка страницы: полоса 44px с названием слева и действиями справа.
 *
 * КОГДА:  первый ребёнок <Screen>. Внутри — <PageTitle> + <PageActions>, либо
 *         <Breadcrumbs> с флагом breadcrumb.
 * НЕ ДЛЯ: шапки панели сайдбара (у неё свой размер, липкость и hover-reveal).
 *
 * UX:     шапка БЕЛАЯ, а тело под ней серое — не украшение, а правило
 *         поверхностей: полоса с названием и действиями это информационная
 *         поверхность, всё под ней — холст. Флаг breadcrumb обнуляет
 *         padding-inline, потому что крошки несут собственный левый инсет
 *         12px; если сложить оба, крошки уедут вправо относительно всех
 *         остальных заголовков в main (единый отступ контента — 12px).
 *         Флаг withSecondary снимает нижнюю границу — она нужна, когда сразу
 *         под шапкой идёт <SecondaryHeader>: границу рисует ровно один сосед,
 *         иначе на стыке получится задвоенная линия.
 * A11Y:   обычный контейнер; заголовок озвучивает <PageTitle>.
 *
 * @example
 * <PageHeader breadcrumb><Breadcrumbs links={…} current="Assigned to me" /></PageHeader>
 */
export function PageHeader({ breadcrumb, withSecondary, children }: {
  breadcrumb?: boolean;
  withSecondary?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cx(s.mainHeader, breadcrumb && s.mainHeaderBreadcrumb, withSecondary && s.mainHeaderWithSecondary)}>
      {children}
    </div>
  );
}
