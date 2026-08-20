import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import s from './Breadcrumbs.module.css';

export interface Crumb {
  title: string;
  to: string;
}

interface BreadcrumbsProps {
  /** Все сегменты, кроме последнего: кликабельны, ведут на свой уровень. */
  links: Crumb[];
  /** Последний сегмент — текущий экран, не ссылка. */
  current: string;
}

export function Breadcrumbs({ links, current }: BreadcrumbsProps) {
  return (
    <div className={s.titleContainer}>
      {links.map((crumb) => (
        // Разделитель « / » — отдельный текстовый узел (анонимный flex-элемент),
        // а не часть ссылки: только так вокруг него с обеих сторон встаёт
        // gap:6px контейнера, как в эталоне. Обёртка вокруг пары «ссылка+слеш»
        // сломала бы этот отступ.
        <Fragment key={crumb.to}>
          <Link className={s.button} to={crumb.to}>{crumb.title}</Link>
          {' / '}
        </Fragment>
      ))}
      <span className={s.title}>{current}</span>
    </div>
  );
}
