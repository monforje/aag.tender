import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { cx } from '@/shared/lib/cx';
import { Icon } from '@/shared/ui/Icon';
import s from './Link.module.css';

interface CommonProps {
  children: ReactNode;
  className?: string;
  /** Стрелка «откроется вовне». Только для href-версии; выключайте, когда
   *  ссылка и так живёт в контексте «внешнее» (колонка источников). */
  externalIcon?: boolean;
}

type LinkProps =
  | ({ /** Внутренний маршрут: рендерится <RouterLink>, полной перезагрузки нет. */
      to: string } & CommonProps)
  | ({ /** Внешний адрес: обычный <a> с target="_blank" и безопасным rel. */
      href: string } & CommonProps);

/**
 * Ссылка — навигация, оформленная текстом, а не кнопкой.
 *
 * КОГДА:  переход куда-то, что не меняет данные: документация, источник,
 *         карточка контрагента из текста сводки. Внутренние маршруты — по
 *         пропу to, внешние — по href (target и rel ставятся сами).
 * НЕ ДЛЯ: действия (см. <Button> — «Скачать» это действие, а не ссылка) и
 *         навигации по разделам приложения (см. <Tree> и <Breadcrumbs> —
 *         там своя подсветка текущего места).
 *
 * UX:     ховер — заливка-«таблетка» слабой ступени, НИКОГДА подчёркивание:
 *         «это ссылка» и «это кликабельно» в этом интерфейсе говорят одним
 *         языком (§0.2(f)). Подчёркивание постоянным не делается тоже:
 *         плотный текст с линиями читается как помарки.
 * A11Y:   имя ссылки — её текст; стрелка наружу aria-hidden. Смысл «откроется
 *         в новой вкладке» скринридер получает от target сам.
 *
 * @example
 * <Link to="/tenders/registry">Все тендеры</Link>
 * <Link href="https://zakupki.gov.ru" externalIcon>Закупки.РФ</Link>
 */
export function Link(props: LinkProps) {
  const { className, children } = props;
  const cls = cx(s.link, className);

  if ('to' in props) {
    return <RouterLink to={props.to} className={cls}>{children}</RouterLink>;
  }
  const icon = props.externalIcon === false ? null : (
    <Icon name="arrowRightUp" className={s.linkIcon} />
  );
  return (
    /* rel="noreferrer" заодно закрывает window.opener у открытой вкладки. */
    <a href={props.href} target="_blank" rel="noreferrer" className={cls}>
      {children}
      {icon}
    </a>
  );
}
