import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cx } from '@/shared/lib/cx';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Stack } from '@/shared/ui/Layout';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Table, tableCell } from '@/shared/ui/Table';
import {
  PageHeader, PageTitle, Screen, SecondaryHeader, type SecondaryTab,
} from '@/shared/ui/Page';
import {
  applyFilters, EMPTY_FILTERS, fetchTenders, STATUS, tenderPath, type Filters,
} from '@/entities/tender';
import { useAsync } from '@/shared/lib/useAsync';
import { RegistryFilters } from './RegistryFilters';

type RegistryTab = 'active' | 'closed' | 'drafts';

const TABS: SecondaryTab[] = [
  { id: 'active', label: 'Активные' },
  { id: 'closed', label: 'Закрытые' },
  { id: 'drafts', label: 'Черновики' },
];

/**
 * Страница «Реестр тендеров»: вкладки среза и таблица тендеров.
 *
 * КОГДА:  пункт «Реестр тендеров» в дереве раздела Тендеры ведёт сюда.
 * НЕ ДЛЯ: остальных пунктов дерева Тендеры — они пока декоративные.
 *
 * UX:     шапка та же, что у прочих экранов со срезами: второй, опциональный
 *         слот <SecondaryHeader> под <PageHeader withSecondary>. Вкладка —
 *         состояние страницы, не маршрута: это срез одного и того же реестра,
 *         а не отдельный экран, и адрес от него не меняется.
 *         Страница — ЧИСТАЯ КОМПОЗИЦИЯ: собственных стилей у неё нет, всё
 *         рисуют общие примитивы (<Table>, <Badge>, <Button>), а доменное
 *         знание живёт в entities/tender. Раньше здесь лежал свой
 *         .module.css с геометрией таблицы и цветами статусов — их вынесли,
 *         как только стало ясно, что это не свойства реестра.
 *         Полоса фильтров стоит НАД прокруткой (см. RegistryFilters): она
 *         оснастка экрана, а не его содержимое, и её меню не должны резаться
 *         границей скролла. Фильтрация честная — таблица показывает то, что
 *         осталось, а пустой результат объясняет себя и даёт сброс.
 * A11Y:   таблист — role="tablist"/"tab"/aria-selected (см. <SecondaryHeader>);
 *         таблица настоящая, с <th scope="col">, поэтому скринридер объявляет
 *         заголовок колонки при переходе по ячейкам.
 *
 * @example
 * <Route path="tenders/registry" element={<TenderRegistryPage />} />
 */
export function TenderRegistryPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<RegistryTab>('active');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const { data, loading, error, reload } = useAsync(() => fetchTenders(), []);
  /* Отбор идёт по ПРИШЕДШИМ строкам: пока их нет — фильтровать нечего, и это
     не «ничего не найдено», а «ещё не приехало». Разные экраны. */
  const all = data ?? [];
  const rows = applyFilters(all, filters);

  return (
    <Screen>
      <PageHeader withSecondary>
        <PageTitle>Реестр тендеров</PageTitle>
      </PageHeader>
      <SecondaryHeader tabs={TABS} activeId={tab} onChange={(id) => setTab(id as RegistryTab)} />
      <RegistryFilters value={filters} onChange={setFilters} rows={all} />
      <ScrollArea variant="page">
        {loading ? (
          /* Полосы стоят на месте будущих строк таблицы — загрузка не должна
             читаться как прыжок раскладки. */
          <Stack gap={2}>
            {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height={36} radius={6} />)}
          </Stack>
        ) : error ? (
          <ErrorState
            title="Реестр не загрузился"
            description="Список тендеров не пришёл. Фильтры и поиск при этом настроены."
            onRetry={reload}
          />
        ) : (
        <Table
          caption={rows.length === all.length
            ? `Всего тендеров: ${all.length}`
            : `Показано ${rows.length} из ${all.length}`}
        >
          <thead>
            <tr>
              <th scope="col">№</th>
              <th scope="col">Название</th>
              <th scope="col">Портфель / проект</th>
              <th scope="col">Вид работ</th>
              <th scope="col">Статус</th>
              <th scope="col">Ответственный</th>
              <th scope="col" className={tableCell.numeric}>Начало</th>
              <th scope="col" className={tableCell.numeric}>Окончание</th>
              <th scope="col" className={tableCell.numeric}>Создан</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              // Кликабельна вся строка, но настоящая ссылка — на номере:
              // она даёт клавиатуру, среднюю кнопку и «открыть в новой
              // вкладке», чего onClick не умеет. Клик по самой ссылке
              // отсеиваем, иначе переход случился бы дважды.
              <tr
                key={row.id}
                className={tableCell.rowLink}
                onClick={(e) => {
                  if (!(e.target as HTMLElement).closest('a')) navigate(tenderPath(row.id));
                }}
              >
                <td className={tableCell.mono}>
                  <Link className={tableCell.link} to={tenderPath(row.id)}>{row.id}</Link>
                </td>
                <td className={tableCell.strong}>{row.title}</td>
                <td>
                  {row.portfolio}
                  <span className={tableCell.sub}>{row.project}</span>
                </td>
                <td>{row.kind}</td>
                <td>
                  <Badge tone={STATUS[row.status].tone} icon={STATUS[row.status].icon}>
                    {STATUS[row.status].label}
                  </Badge>
                </td>
                <td>{row.owner}</td>
                <td className={tableCell.numeric}>{row.start}</td>
                <td className={tableCell.numeric}>{row.end}</td>
                <td className={cx(tableCell.numeric, tableCell.muted)}>{row.created}</td>
              </tr>
            ))}
            {/* Пустой результат — не пустой экран: говорим, ПОЧЕМУ пусто, и
                даём выход одним кликом, а не заставляем снимать фильтры по
                одному (правило «No results» из ux-guidelines). */}
            {rows.length === 0 ? (
              <tr>
                <td className={tableCell.empty} colSpan={9}>
                  Под фильтры не подошёл ни один тендер.
                  <Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
                    Сбросить фильтры
                  </Button>
                </td>
              </tr>
            ) : null}
          </tbody>
        </Table>
        )}
      </ScrollArea>
    </Screen>
  );
}
