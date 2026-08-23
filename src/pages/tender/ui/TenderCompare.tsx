import {
  useEffect, useState,
  type CSSProperties,
} from 'react';
import { cx } from '@/shared/lib/cx';
import { Button } from '@/shared/ui/Button';
import { useCellPopup } from '@/shared/ui/CellPopup';
import { Icon } from '@/shared/ui/Icon';
import { ScreenPlaceholder } from '@/shared/ui/Page';
import { Table, tableCell } from '@/shared/ui/Table';
import { plural } from '@/shared/lib/plural';
import {
  analyzeComparison, filterRows, flatten, isModifiedView, METRIC_LABEL,
  rankBids, ROW_VIEW_LABEL,
  type Bid, type Comparison, type CompareThresholds, type CompareView,
  type PositionGroup, type PresetId, type RowFacts,
} from '@/entities/tender';
import { choose, resolveTone } from '../model/compareFormat';
import { useTableDock } from '../model/useTableDock';
import { CompareToolbar } from './CompareToolbar';
import { ColumnPainter } from './ColumnPainter';
import { CompareRow } from './CompareRow';
import { ContractorCard } from './ContractorCard';
import { DossierModal } from './DossierModal';
import { TotalRow } from './TotalRow';
import s from './TenderCompare.module.css';

/**
 * Сравнение коммерческих предложений: позиции сметы строками, подрядчики —
 * колонками с карточкой в шапке; над таблицей — полоса пресетов, показателя,
 * вида строк и предикатов (Д.1 аудита сравнения КП).
 *
 * КОГДА:  раздел «Сравнение» карточки тендера.
 * НЕ ДЛЯ: реестра тендеров (см. TenderRegistryPage) и списка самих КП
 *         (раздел «КП» — это документы, а не сопоставление цифр).
 *
 * ДАННЫЕ: приходят ПРОПАМИ — смета разделами и КП подрядчиков (тип
 *         Comparison), пометки анализа — готовыми полями КП (`marks`),
 *         пороги аналитики — настройками тендера. Всё производное считается
 *         `analyzeComparison()` одним проходом: таблица, фильтры, счётчики и
 *         попап читают одни и те же числа. Фильтр меняет состав видимых
 *         строк, но НЕ подытоги: одно число на итог, второе «по фильтру» из
 *         модели вынесено (решение владельца 22.08.2026).
 *
 * UX:     ПРЕСЕТ присваивает четыре оси состояния целиком; любое ручное
 *         движение поднимает чип «Изменён · Сброс» — молча терять уход от базы
 *         нельзя. ПОМЕТКИ ТИХИЕ В ПОКОЕ: мазок маркера под лучшей ценой,
 *         штриховка аномалии, пунктир пробела данных, микрошкала разброса
 *         отвечают на вопрос «куда смотреть»; «почему так» объясняет один
 *         попап на всю таблицу по наведению или фокусу. Минимум присуждается
 *         лучшей НЕаномальной цене при живой конкуренции и гаснет вне режима
 *         «Цена»: на колонке процентов он означал бы другое.
 *         ОТКАЗ И ПРОБЕЛ — РАЗНЫЕ СОСТОЯНИЯ (см. <BidCell>).
 *         ЦВЕТ КОЛОНКИ — ПОДСКАЗКА, А НЕ ВЕРДИКТ: базово его ставит ранжир,
 *         перекрашивается рукой через <ColumnPainter>; смысловые тона пометок
 *         при этом рукой не трогаются никогда.
 *         ШАПКА И САЙДБАР: шапка таблицы прилипает под шапкой экрана
 *         нативным sticky (<Table stickyHead>) — без JS в прокрутке; движение
 *         скролла вниз прячет сайдбар в рейл. Вся механика — в хуке
 *         useTableDock, здесь остаётся только точка замера.
 *         История решения (почему не JS-док) — у блока «липкая шапка» в
 *         model/useTableDock.ts и в Части XII DESIGN-NOTES.md.
 * A11Y:   каждая пометка — кнопка со своим именем; активной цели ставится
 *         aria-describedby на попап. Счётчики над таблицей считаются по всему
 *         датасету и продублированы текстом в caption. Снятая строка остаётся
 *         в DOM — это история сметы. Ширины колонок — контракт <colgroup>
 *         при layout="fixed", содержимое на них не влияет.
 *
 * @example
 * <TenderCompare {...MOCK_COMPARISON} view={view} onPreset={applyPreset}
 *                onPatch={patchView} starred={starred} onToggleStar={toggleStar}
 *                focusRowId={focusRowId} onFocusClear={() => setFocusRowId(null)} />
 */
export function TenderCompare({
  groups, contractors,
  view, onPreset, onPatch,
  thresholds, onThresholds,
  starred, onToggleStar,
  focusRowId, onFocusClear,
  onHeadStuckChange,
  noteFor, flashCells, flashCols,
  analysisApplied, onRestoreView,
}: Comparison & {
  /* Состояние среза ПОДНЯТО на страницу: им делятся таблица и панель «Анализ»
     (сценарий просит пресет, карточка ведёт к строке). Компонент остаётся
     чистым отображением: пришло состояние — отрисовало. */
  view: CompareView;
  onPreset: (preset: PresetId) => void;
  onPatch: (patch: Partial<Omit<CompareView, 'preset'>>) => void;
  /** Пороги аналитики — настройки ТЕНДЕРА (не константы и не личный профиль):
      каскадируют в метки ячеек, фильтры, легенду и сводку. */
  thresholds: CompareThresholds;
  /** Правка порогов из окна настроек; зажим делает вызывающий (clampThresholds). */
  onThresholds?: (thresholds: CompareThresholds) => void;
  /** Избранные ★ подрядчики читаются и пишутся наружу по той же причине. */
  starred: string[];
  onToggleStar: (contractorId: string) => void;
  /** Строка, подсвеченная по карточке «Анализа»; клик по таблице снимает. */
  focusRowId: string | null;
  onFocusClear: () => void;
  /** Липкая шапка встала на верхнюю линию области страницы (и стоит на ней)
      — наружу бейджу «Анализ ИИ»: в этот момент он висит прямо над шапкой
      таблицы и складывается до иконки. */
  onHeadStuckChange?: (stuck: boolean) => void;
  /** Комментарии разбора к ячейкам (`${contractorId}:${positionId}`):
      пусто до запуска анализа — попапы показывают одни числа (Р4). */
  noteFor?: (contractorId: string, positionId: string) => string | undefined;
  /** Обводка перехода «анализ → таблица» (05 §7): ключи ячеек тех же пар
      и id колонок при фокусе только на подрядчике. Живут ~5 секунд. */
  flashCells?: ReadonlySet<string>;
  flashCols?: ReadonlySet<string>;
  /** Вид перестроен разбором: чип «Вернуть мой вид» вместо обычного сброса. */
  analysisApplied?: boolean;
  onRestoreView?: () => void;
}) {
  /* Плоский список позиций и ранжир ВЫВОДЯТСЯ из пришедшего, а не приходят
      полями: два перечня одних и тех же строк разъехались бы на первой правке.
      Пересчёт — тринадцать позиций на три КП, мемоизировать тут нечего. */
  const positions = flatten(groups);
  const bids = rankBids(contractors, positions);
  const facts = analyzeComparison(groups, contractors, thresholds);

  const modified = isModifiedView(view);

  /* Свёрнутость карточек ОДНА на все: колонки сравнивают, а не разглядывают
      по одной. Разделы сворачиваются ПООДИНОЧКЕ. Цвет колонки — CSS-строка,
      отсутствие ключа значит «по ранжиру». */
  const [collapsed, setCollapsed] = useState(false);
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const [tint, setTint] = useState<Record<string, string>>({});
  const [dossier, setDossier] = useState<Bid | null>(null);
  /* Палитра — вторая панель: состояние хранит КП вместе с прямоугольником
     нажатой кнопки. Механика обеих панелей — в <DossierModal> и <ColumnPainter>. */
  const [paint, setPaint] = useState<{ bid: Bid; at: DOMRect } | null>(null);

  const paintValue = (bid: Bid) => tint[bid.contractor.id] ?? resolveTone(bid.tone);

  /* Один попап на таблицу обслуживает все пометки. При смене нарезки строки
     пересобираются — держать подсказку не за что. Зависимости — сами оси:
     объект хука пересоздаётся каждым рендером, и эффект по нему гасил бы
     попап на любом постороннем движении (звезда, перекраска колонки). */
  const popup = useCellPopup();
  useEffect(() => { popup.close(true); },
    [view.mainMetric, view.showDeviation, view.showRate, view.rowView, view.filters]);

  /* Липкая шапка + автосайдбар + доскролл к строке из «Анализа». Правило
     автосайдбара и история решения — в JSDoc хука. */
  const { dockRef } = useTableDock({ focusRowId, onHeadStuckChange });

  /* Строки, прошедшие ВСЕ предикаты; разделы собирают свои из них же.
     Для ПОДЫТОГОВ узла нужен полный набор его позиций: фильтр прячет строки,
     но суммы не двигает. */
  const visible = filterRows(facts.rows, view.filters);
  const visibleIds = new Set(visible.map((r) => r.position.id));
  const byIdOf = (p: { id: string }): RowFacts | undefined => facts.byId.get(p.id);
  const rowsOfGroup = (group: PositionGroup): RowFacts[] =>
    group.positions.map(byIdOf).filter((r): r is RowFacts => !!r && visibleIds.has(r.position.id));
  const allRowsOfGroup = (group: PositionGroup): RowFacts[] =>
    group.positions.map(byIdOf).filter((r): r is RowFacts => !!r);

  /* Пустой ответ — штатное состояние, а не сбой. Проверка стоит после хуков:
     до них ранний возврат менял бы их число между рендерами. */
  if (!groups.length || !contractors.length) {
    return (
      <ScreenPlaceholder icon="billList">
        {!groups.length
          ? 'В тендере ещё нет сметы — сравнивать нечего.'
          : 'Ни одного КП пока не подано.'}
      </ScreenPlaceholder>
    );
  }

  /* Счётчики пометок живут в поповере фильтров (predicateCount) и в caption;
     отдельной строки над таблицей у них нет. */

  return (
    <>
      {/* Воздух между табами раздела и полосой сравнения: полоса читается
          началом нового блока, а не хвостом шапки. */}
      <div className={s.headGap}>
        <CompareToolbar
          view={view}
          thresholds={thresholds}
          onThresholds={onThresholds}
          allRows={facts.rows}
          modified={modified}
          analysisApplied={analysisApplied}
          onRestoreView={onRestoreView}
          onPreset={onPreset}
          onPatch={onPatch}
        />
      </div>

      {/* Точка замера порога сайдбара: верх этого блока = верх ленты. Сама
          липкость шапки живёт в <Table stickyHead> и CSS, не здесь. Клик по
          таблице снимает подсветку строки из «Анализа»: пользователь уже
          смотрит сам, чужая метка больше не нужна.
          БЛОК — КОНТЕЙНЕР ПЛОТНОСТИ (.band): по его фактической ширине
          лестница в .module.css ступенями ужесточает контракт колонок,
          паддинги и зум ленты — от любой причины сжатия (панель «Анализ
          ИИ», узкое окно), а не только от одной конкретной. */}
      <div
        ref={dockRef}
        className={s.band}
        onClick={() => { if (focusRowId) onFocusClear(); }}
      >
        <div className={s.density}>
        <Table
          stickyHead
          layout="fixed"
          caption={[
            `Показано ${visible.length} из ${facts.rows.length} позиций`,
            `основной показатель «${METRIC_LABEL[view.mainMetric]}»`,
            ROW_VIEW_LABEL[view.rowView].toLowerCase(),
            view.filters.length
              ? `фильтров: ${view.filters.length}`
              : 'без фильтров',
          ].join(' · ')}
        >
          {/* Цвет колонки — на <col>, а не на каждой ячейке: фон колонки рисуется
              НИЖЕ фона строки, поэтому ховер продолжает читаться поверх заливки.
              ШИРИНА исполняется только при layout="fixed" (контракт .cols). */}
          <colgroup className={s.cols} style={{ '--bids': bids.length } as CSSProperties}>
            <col className={cx(s.colTitle, s.colRule)} />
            <col className={cx(s.colQty, s.colRule)} />
            <col className={cx(s.colUnit, s.colRule)} />
            <col className={cx(s.colSpread, s.colRule)} />
            {bids.map((bid, i) => (
              <col
                key={bid.contractor.id}
                className={cx(s.colBid, s.colTint, i < bids.length - 1 && s.colRule)}
                style={{ '--col': choose(tint, bid) } as CSSProperties}
              />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Позиция</th>
              <th scope="col" className={tableCell.numeric}>Количество</th>
              <th scope="col">Единица</th>
              <th scope="col" className={tableCell.numeric}>Разброс</th>
            {bids.map((bid) => (
              <th
                scope="col"
                key={bid.contractor.id}
                className={cx(tableCell.card, flashCols?.has(bid.contractor.id) && s.colFlash)}
              >
                <ContractorCard
                  bid={bid}
                  total={positions.length}
                  col={choose(tint, bid)}
                  starred={starred.includes(bid.contractor.id)}
                  onStar={() => onToggleStar(bid.contractor.id)}
                  onPaint={(at) => setPaint({ bid, at })}
                  onOpen={() => setDossier(bid)}
                  collapsed={collapsed}
                  onFold={() => setCollapsed((on) => !on)}
                />
              </th>
            ))}
            </tr>
          </thead>

          {visible.length === 0 ? (
            /* Пустой результат обязан быть выходом, а не тупиком. */
            <tbody>
              <tr>
                <td colSpan={4 + bids.length} className={tableCell.empty}>
                  Ни одна позиция не проходит фильтры
                  <Button variant="secondary" onClick={() => onPatch({ filters: [] })}>
                    Сбросить фильтры
                  </Button>
                </td>
              </tr>
            </tbody>
          ) : view.rowView === 'sections' ? (
            /* По разделам: заголовок, строки, подытог — и все три только из
               видимых строк. Раздел, не прошедший фильтр, исчезает целиком:
               пустой блок читался бы как сбой. */
            groups.map((group) => {
              const rows = rowsOfGroup(group);
              if (!rows.length) return null;
              const open = !folded[group.id];
              return (
                <tbody key={group.id}>
                  <tr className={s.groupRow}>
                    {/* Шапка раздела — <th scope="colgroup">: заголовок для строк
                        под ним, а не ячейка со значением. */}
                    <th scope="colgroup" className={cx(tableCell.card, s.groupHead)}>
                      <button
                        type="button"
                        className={s.groupToggle}
                        aria-expanded={open}
                        aria-label={`${group.title}: ${open ? 'свернуть' : 'развернуть'} раздел`}
                        onClick={() => setFolded((all) => ({ ...all, [group.id]: open }))}
                      >
                        <span className={s.groupTitle}>{group.title}</span>
                        <span className={cx(s.fold, !open && s.isOn)}>
                          <Icon name="chevronDown" />
                        </span>
                      </button>
                    </th>
                    {/* Размер раздела стоит в колонках объёма, но НЕ выглядит
                        объёмом: капитель 11px третичным тоном. */}
                    <td className={cx(tableCell.numeric, s.groupMeta)}>{group.positions.length}</td>
                    <td className={s.groupMeta}>
                      {plural(group.positions.length, 'позиция', 'позиции', 'позиций')}
                    </td>
                    <td />
                    {bids.map((bid) => <td key={bid.contractor.id} />)}
                  </tr>

                  {/* Итог остаётся и у свёрнутого раздела: ради него и сворачивают. */}
                  {open ? rows.map((row) => (
                    <CompareRow
                      key={row.position.id}
                      row={row}
                      view={view}
                      thresholds={thresholds}
                      bids={bids}
                      sumWeight={facts.sumWeight}
                      bind={popup.bind}
                      focused={focusRowId === row.position.id}
                      noteFor={noteFor}
                      flashCells={flashCells}
                    />
                  )) : null}

                  <TotalRow label="Итого" rows={allRowsOfGroup(group)} bids={bids} metric={view.mainMetric} />
                </tbody>
              );
            })
          ) : (
            /* Плоский список по одному числу: заголовки разделов и подытоги в
                таком порядке смысла не имеют (§3.1 аудита). */
            <tbody>
              {[...visible]
                .sort((a, b) => b[view.rowView === 'weight' ? 'weight' : 'maxPot']
                              - a[view.rowView === 'weight' ? 'weight' : 'maxPot'])
                .map((row) => (
                  <CompareRow
                    key={row.position.id}
                    row={row}
                    view={view}
                    thresholds={thresholds}
                    bids={bids}
                    sumWeight={facts.sumWeight}
                    bind={popup.bind}
                    focused={focusRowId === row.position.id}
                    noteFor={noteFor}
                    flashCells={flashCells}
                  />
                ))}
            </tbody>
          )}

          {/* Полный итог КП — единственное число: фильтром и свёрткой не
              пересчитывается (§3 модели), потому складывается из всех позиций.
              Обёртка в tbody обязательна: голый tr на уровне таблицы браузер
              пере-вешивает в собственный tbody, и React честно ругается. */}
          <tbody>
            <TotalRow label="Итого" rows={facts.rows} bids={bids} metric={view.mainMetric} />
          </tbody>
        </Table>
        </div>
      </div>

      {/* Один попап на таблицу: содержимое подставляется, элемент не меняется. */}
      {popup.view}

      {/* Досье подрядчика. */}
      <DossierModal bid={dossier} total={positions.length} onClose={() => setDossier(null)} />

      {/* Палитра колонки — выпадашка из кнопки на карточке. */}
      <ColumnPainter
        anchor={paint?.at ?? null}
        value={paint ? paintValue(paint.bid) : undefined}
        onPick={(color) => paint && setTint(
          (all) => ({ ...all, [paint.bid.contractor.id]: color }),
        )}
        onReset={() => paint && setTint(
          ({ [paint.bid.contractor.id]: _, ...rest }) => rest,
        )}
        onClose={() => setPaint(null)}
      />
    </>
  );
}
