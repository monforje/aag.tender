import { cx } from '@/shared/lib/cx';
import { Icon } from '@/shared/ui/Icon';
import s from './Pagination.module.css';

export interface PaginationProps {
  /** Текущая страница, с единицы. */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/** Окно страниц: первая и последняя всегда, вокруг текущей — по одной,
 *  между ними многоточие. Функция чистая: её легко покрыть тестом, когда
 *  появятся данные, которые реально листают. */
function pageWindow(page: number, pageCount: number): Array<number | 'ellipsis-left' | 'ellipsis-right'> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const out: Array<number | 'ellipsis-left' | 'ellipsis-right'> = [1];
  const lo = Math.max(2, page - 1);
  const hi = Math.min(pageCount - 1, page + 1);
  if (lo > 2) out.push('ellipsis-left');
  for (let p = lo; p <= hi; p++) out.push(p);
  if (hi < pageCount - 1) out.push('ellipsis-right');
  out.push(pageCount);
  return out;
}

/**
 * Постраничная навигация под таблицей или списком.
 *
 * КОГДА:  длинный список разбит на страницы НА СЕРВЕРЕ или осознанно
 *         человеком: «Страница 3 из 40».
 * НЕ ДЛЯ: бесконечной прокрутки (там пагинации нет), фильтров (см.
 *         <FacetFilter>) и переключения панелей (см. <Tabs>).
 *
 * UX:     края окна (первая/последняя страница) видны всегда — «сколько
 *         всего» важнее экономии кнопок. Многоточие НЕ кнопка: прыжок на
 *         произвольную страницу в этом объёме данных не нужен, а мёртвый
 *         контрол соблазнял бы зря. Крайние стрелки гаснут вместо
 *         исчезновения: место не дёргается.
 * A11Y:   <nav> с aria-label; текущая страница объявлена aria-current="page"
 *         — скринридер читает её как «текущая».
 *
 * @example
 * {pageCount > 1 && (
 *   <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
 * )}
 */
export function Pagination({ page, pageCount, onPageChange, className }: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label="Страницы" className={cx(s.pagination, className)}>
      <button
        type="button"
        className={s.navBtn}
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Предыдущая страница"
      >
        <Icon name="caretSmall" className={s.navPrev} />
      </button>

      {pageWindow(page, pageCount).map((item) =>
        typeof item === 'number' ? (
          <button
            key={item}
            type="button"
            className={cx(s.page, item === page && s.isCurrent)}
            aria-current={item === page ? 'page' : undefined}
            onClick={() => item !== page && onPageChange(item)}
          >
            {item}
          </button>
        ) : (
          /* Ключ от позиции: двух правых многоточий быть не может, а вот
             левое и правое существуют одновременно. */
          <span key={item} className={s.ellipsis} aria-hidden="true">…</span>
        ),
      )}

      <button
        type="button"
        className={s.navBtn}
        disabled={page === pageCount}
        onClick={() => onPageChange(page + 1)}
        aria-label="Следующая страница"
      >
        <Icon name="caretSmall" className={s.navNext} />
      </button>
    </nav>
  );
}

/* caretSmall повёрнут CSS-модификаторами navPrev/navNext: отдельные глифы
   стрелок в спрайте эталона живут только для рейла, и второй источник
   стрелок заводить незачем. */
