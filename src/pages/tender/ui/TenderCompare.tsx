import {
  useEffect, useRef, useState,
  type ComponentPropsWithoutRef, type CSSProperties, type ReactNode,
} from 'react';
import { cx } from '@/shared/lib/cx';
import { Badge, type Tone } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { useCellPopup, type CellPopupData } from '@/shared/ui/CellPopup';
import { Icon } from '@/shared/ui/Icon';
import { ColorPicker } from '@/shared/ui/ColorPicker';
import { Modal, modalPart } from '@/shared/ui/Modal';
import { ScreenPlaceholder } from '@/shared/ui/Page';
import { Popover } from '@/shared/ui/Popover';
import { Table, tableCell } from '@/shared/ui/Table';
import { VisuallyHidden } from '@/shared/ui/VisuallyHidden';
import { plural } from '@/shared/lib/plural';
import {
  analyzeComparison, bidStatus, cellMark, decimal, DEV_TOLERANCE, deviationPct,
  filterRows, flatten, hasAnomaly, isModifiedView, METRIC_LABEL,
  money, rankBids, ROW_VIEW_LABEL, shownMetrics,
  type Bid, type CompareView, type Comparison, type Contractor,
  type PositionGroup, type PresetId, type RowFacts,
} from '@/entities/tender';
import { useWorkspaceStore } from '@/entities/workspace';
import { CompareToolbar } from './CompareToolbar';
import { CoinMark, KeyMark, MedMark, SpreadMark, TagMark } from './assets';
import s from './TenderCompare.module.css';

/** Обработчики цели подсказки — общий тип для всех брелоков ячеек. */
type PopupBind = (data: CellPopupData) => ComponentPropsWithoutRef<'button'>;

/** Тон → имя токена. Таблицей, а не `--cu-tone-${tone}`: собранное из строки
 *  имя не проверяется ничем, и опечатка дала бы колонку без цвета без единой
 *  ошибки в консоли. */
const TONE_TOKEN: Record<Tone, string> = {
  info: '--cu-tone-info',
  success: '--cu-tone-success',
  warning: '--cu-tone-warning',
  danger: '--cu-tone-danger',
  neutral: '--cu-tone-neutral',
};

/** Тон как цвет для CSS — ссылкой на токен: перекрасят тему, перекрасятся и
 *  колонки. */
const toneColor = (tone: Tone) => `var(${TONE_TOKEN[tone]})`;

/** Он же ВЫЧИСЛЕННЫМ значением. Пикеру нужен цвет, а не ссылка: `var(...)`
 *  для него — просто нераспознанная строка, и окно открылось бы на чёрном. */
const resolveTone = (tone: Tone) =>
  getComputedStyle(document.documentElement).getPropertyValue(TONE_TOKEN[tone]).trim();

/** Процент со знаком и типографским минусом: направление отклонения читается
 *  знаком, а не догадкой. */
const pctSigned = (v: number): string =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${decimal(Math.abs(v))} %`;

/** Заливка микрошкалы разброса — тон её яруса ([R8]: никаких мёртвых классов,
   три яруса — три правила). */
const SPREAD_TONE = {
  none: s.spreadNone,
  noticeable: s.spreadNoticeable,
  high: s.spreadHigh,
} as const;

/* Ближайший прокручиваемый предок — область страницы (.scroll-area--page).
 * Ищется по computed overflow-y, а не по классу CSS-модуля: имя хэшируется,
 * и селектор через границу модулей не собрался бы (см. CLAUDE.md, «Стили»). */
function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
}

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
 *         Comparison), пометки анализа — готовыми полями КП (`marks`).
 *         Всё производное считается `analyzeComparison()` одним проходом:
 *         таблица, фильтры, счётчики и попап читают одни и те же числа.
 *         Фильтрация происходит ДО подытогов — итоги складываются из видимых
 *         строк, иначе они врут (правило «dc», §0 аудита).
 *
 * UX:     ПРЕСЕТ присваивает четыре оси состояния целиком; любое ручное
 *         движение поднимает чип «Изменён · Сброс» — молча терять уход от базы
 *         нельзя. ПОМЕТКИ ТИХИЕ В ПОКОЕ: мазок маркера под лучшей ценой,
 *         штриховка аномалии, пунктир пробела данных, микрошкала разброса
 *         отвечают на вопрос «куда смотреть»; «почему так» объясняет один
 *         попап на всю таблицу по наведению или фокусу. Минимум присуждается
 *         лучшей НЕаномальной цене при живой конкуренции и гаснет вне режима
 *         «Цена»: на колонке процентов он означал бы другое.
 *         ОТКАЗ И ПРОБЕЛ — РАЗНЫЕ СОСТОЯНИЯ: отказ капсулой нейтрального тона
 *         (решение подрядчика), отсутствие цены — тире с пунктиром (дыра в КП).
 *         ЦВЕТ КОЛОНКИ — ПОДСКАЗКА, А НЕ ВЕРДИКТ: базово его ставит ранжир,
 *         перекрашивается рукой через <ColorPicker>; смысловые тона пометок
 *         при этом рукой не трогаются никогда.
 *         ШАПКА И САЙДБАР: шапка таблицы прилипает под шапкой экрана
 *         нативным sticky (<Table stickyHead>) — без JS в прокрутке, оттого
 *         плавно и с обратной отмоткой без сюрпризов. Пока она на линии,
 *         каждое движение скролла вниз прячет сайдбар в рейл — даже если
 *         его перед этим раскрыли руками; вверх панель никто не догоняет.
 *         История решения (почему не JS-док) — у блока «липкая шапка» ниже
 *         и в Части XII DESIGN-NOTES.md.
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
  starred, onToggleStar,
  focusRowId, onFocusClear,
}: Comparison & {
  /* Состояние среза ПОДНЯТО на страницу: им делятся таблица и панель «Анализ»
     (сценарий просит пресет, карточка ведёт к строке). Компонент остаётся
     чистым отображением: пришло состояние — отрисовало. */
  view: CompareView;
  onPreset: (preset: PresetId) => void;
  onPatch: (patch: Partial<Omit<CompareView, 'preset'>>) => void;
  /** Избранные ★ читаются и пишутся наружу по той же причине. */
  starred: string[];
  onToggleStar: (contractorId: string) => void;
  /** Строка, подсвеченная по карточке «Анализа»; клик по таблице снимает. */
  focusRowId: string | null;
  onFocusClear: () => void;
}) {
  /* Плоский список позиций и ранжир ВЫВОДЯТСЯ из пришедшего, а не приходят
      полями: два перечня одних и тех же строк разъехались бы на первой правке.
      Пересчёт — тринадцать позиций на три КП, мемоизировать тут нечего. */
  const positions = flatten(groups);
  const bids = rankBids(contractors, positions);
  const facts = analyzeComparison(groups, contractors);

  const modified = isModifiedView(view);

  /* Свёрнутость карточек ОДНА на все: колонки сравнивают, а не разглядывают
      по одной. Разделы сворачиваются ПООДИНОЧКЕ. Цвет колонки — CSS-строка,
      отсутствие ключа значит «по ранжиру». */
  const [collapsed, setCollapsed] = useState(false);
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const [tint, setTint] = useState<Record<string, string>>({});
  const [dossier, setDossier] = useState<Bid | null>(null);
  /* Палитра — вторая панель: состояние хранит КП вместе с прямоугольником
     нажатой кнопки. Механика обеих панелей — в <Modal> и <Popover>. */
  const [paint, setPaint] = useState<{ bid: Bid; at: DOMRect } | null>(null);

  const paintValue = (bid: Bid) => tint[bid.contractor.id] ?? resolveTone(bid.tone);

  /* Один попап на таблицу обслуживает все пометки. При смене нарезки строки
     пересобираются — держать подсказку не за что. Зависимости — сами оси:
     объект хука пересоздаётся каждым рендером, и эффект по нему гасил бы
     попап на любом постороннем движении (звезда, перекраска колонки). */
  const popup = useCellPopup();
  useEffect(() => { popup.close(true); },
    [view.mainMetric, view.rowView, view.extraMetrics, view.filters]);

  /* ── липкая шапка + автосайдбар ───────────────────────────────────────────
     Липкость шапки — нативный position:sticky (<Table stickyHead>): её
     прибирает к скроллу страницы сам движок, и в цикле прокрутки нет ни
     строчки JS. Отсюда два свойства, за которые эта версия отвечает:
     приклейка плавна кадр в кадр (никаких переключений геометрии) и скролл
     вверх работает всегда, с первого тика — браузеру нечего «отменять».

     JS остался только на сайдбар, и правило у него одно: движение ВНИЗ,
     пока шапка стоит на линии (или уже приклеена), прячет панель в рейл —
     КАЖДЫЙ раз. Памяти о прошлых прятаниях нет намеренно: панель могли
     раскрыть руками между делом (клик по рейлу) — «сработал один раз»
     оставлял бы её висеть над данными до конца сеанса. Вверх действует
     обратное: руку никто не догоняет, панель остаётся как есть.

     Порог читается с DOM, а не из арифметики высот: всё над таблицей меняет
     высоту вместе с шириной <main>, считать его вручную значило бы гоняться
     за раскладкой. Скроллы внутри самой таблицы и горизонтальное
     панорамирование порогом не управляют — интересует только вертикальная
     прокрутка страницы. */
  const dockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = dockRef.current;
    const scroller = findScrollParent(el);
    if (!el || !scroller) return;

    let lastTop = scroller.scrollTop;

    const evaluate = () => {
      const top = scroller.scrollTop;
      const down = top > lastTop;
      lastTop = top;

      /* «Шапка на линии» верно и для давно приклеенной: sticky держит её у
         верхнего края области всю прокрутку таблицы. */
      const atLine =
        el.getBoundingClientRect().top <= scroller.getBoundingClientRect().top;

      if (!down || !atLine) return;
      const store = useWorkspaceStore.getState();
      if (store.sidebarOpen) store.setSidebarOpen(false);
    };

    const onScroll = (e: Event) => {
      if (e.target instanceof Node && el.contains(e.target)) return;
      evaluate();
    };
    const ro = new ResizeObserver(evaluate);
    ro.observe(scroller);
    scroller.addEventListener('scroll', onScroll);
    evaluate();

    return () => {
      ro.disconnect();
      scroller.removeEventListener('scroll', onScroll);
    };
  }, []);

  /* Строка, подсвеченная из «Анализа»: доскроллить до неё. Ищется по
     data-атрибуту (не по хэшированному классу), smooth уместен — движение
     показывает, ГДЕ оказалась строка относительно прочитанного.
     Строки может не быть в DOM: фильтры её спрятали или раздел свёрнут —
     тогда просто тишина, карточка уже отдала свой текст. */
  useEffect(() => {
    if (!focusRowId) return;
    const el = dockRef.current?.querySelector<HTMLElement>(
      `[data-row-id="${CSS.escape(focusRowId)}"]`,
    );
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusRowId]);

  /* Строки, прошедшие ВСЕ предикаты; разделы собирают свои из них же. */
  const visible = filterRows(facts.rows, view.filters);
  const visibleIds = new Set(visible.map((r) => r.position.id));
  const rowsOfGroup = (group: PositionGroup): RowFacts[] =>
    group.positions
      .map((p) => facts.byId.get(p.id))
      .filter((r): r is RowFacts => !!r && visibleIds.has(r.position.id));

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
          allRows={facts.rows}
          modified={modified}
          onPreset={onPreset}
          onPatch={onPatch}
        />
      </div>

      {/* Точка замера порога сайдбара: верх этого блока = верх ленты. Сама
          липкость шапки живёт в <Table stickyHead> и CSS, не здесь. Клик по
          таблице снимает подсветку строки из «Анализа»: пользователь уже
          смотрит сам, чужая метка больше не нужна. */}
      <div
        ref={dockRef}
        onClick={() => { if (focusRowId) onFocusClear(); }}
      >
        <Table
          stickyHead
          layout="fixed"
          caption={[
            `Показано ${visible.length} из ${facts.rows.length} позиций`,
            `показатель «${METRIC_LABEL[view.mainMetric]}»`,
            ROW_VIEW_LABEL[view.rowView].toLowerCase(),
            view.filters.length
              ? `фильтров: ${view.filters.length} (применены до подытогов)`
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
                <th scope="col" key={bid.contractor.id} className={tableCell.card}>
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
                      bids={bids}
                      sumWeight={facts.sumWeight}
                      bind={popup.bind}
                      focused={focusRowId === row.position.id}
                    />
                  )) : null}

                  <TotalRow label="Итого" rows={rows} bids={bids} />
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
                    bids={bids}
                    sumWeight={facts.sumWeight}
                    bind={popup.bind}
                    focused={focusRowId === row.position.id}
                  />
                ))}
            </tbody>
          )}

          {/* Итог по срезу — всегда из видимых строк, тем же счётом, что и
              подытоги: два итогоа на одном экране спорить не имеют права. */}
          {visible.length ? <TotalRow label="Итого по срезу" rows={visible} bids={bids} /> : null}
        </Table>
      </div>

      {/* Один попап на таблицу: содержимое подставляется, элемент не меняется. */}
      {popup.view}

      {/* Досье. Содержимое рисуется, только когда окно открыто. */}
      <Modal open={dossier !== null} onClose={() => setDossier(null)}>
        {dossier ? (
          <Dossier bid={dossier} total={positions.length} onClose={() => setDossier(null)} />
        ) : null}
      </Modal>

      {/* Палитра колонки — выпадашка из кнопки на карточке. */}
      <Popover anchor={paint?.at ?? null} onClose={() => setPaint(null)} label="Цвет колонки">
        {paint ? (
          <Painter
            value={paintValue(paint.bid)}
            onPick={(color) => setTint((all) => ({ ...all, [paint.bid.contractor.id]: color }))}
            onReset={() => setTint(({ [paint.bid.contractor.id]: _, ...rest }) => rest)}
          />
        ) : null}
      </Popover>
    </>
  );
}

/* ── строка позиции ────────────────────────────────────────────────────────── */

/** Строка позиции: имя (+ключ, снятие), объём (+корректировка), единица,
 *  разброс и ячейки КП с пометками. focused — подсветка «текущей строки»
 *  из панели «Анализа» (рецепт 2 каталога): тот же канал, что и у прочих
 *  текущих состояний, — фон ступенью выше hover, без цвета и жирности. */
function CompareRow({ row, view, bids, sumWeight, bind, focused }: {
  row: RowFacts;
  view: CompareView;
  bids: Bid[];
  sumWeight: number;
  bind: PopupBind;
  focused: boolean;
}) {
  const { position } = row;
  const removed = position.removed === true;
  const share = sumWeight ? (row.weight / sumWeight) * 100 : 0;

  return (
    <tr
      data-row-id={position.id}
      className={cx(removed && s.rowRemoved, focused && s.rowFocused)}
    >
      {/* Колонка-якорь: title обязателен — ширина задана контрактом, длинное
          название уходит в многоточие, и прочитать его целиком должно чем. */}
      <td className={tableCell.strong} title={position.title}>
        {removed ? <s>{position.title}</s> : position.title}

        {/* Ключ — в ПРАВОЙ части имени: левый край всех строк остаётся единым.
            Без title: нативная подсказка спорила бы с попапом, который объясняет
            ту же пометку подробнее; имя для скринридера — aria-label. */}
        {!removed && position.key ? (
          <button
            type="button"
            className={s.keyMark}
            aria-label="Ключевая позиция"
            {...bind({
              tone: 'warning',
              title: 'Ключевая позиция',
              fields: [{ label: 'Вес строки', value: money(row.weight) }],
              note: 'Наибольший вес в смете среза: цена здесь двигает итог сильнее остальных строк.',
            })}
          >
            <KeyMark />
          </button>
        ) : null}

        {removed ? <span className={s.chip}>снята</span> : null}
        {removed ? <span className={tableCell.sub}>позиция снята из сметы</span> : null}

        {/* Доля веса живёт там, где по ней и отсортировано, — иначе шум. Шкала
            общая для всех строк (Σ веса = 100 %), иначе бары несравнимы. */}
        {view.rowView === 'weight' && !removed ? (
          <span className={tableCell.sub}>
            <span className={s.share} aria-hidden="true"><i style={{ width: `${share}%` }} /></span>
            {decimal(share)} % веса среза
          </span>
        ) : null}
      </td>

      {/* Корректировка объёма — парой значений: старое зачёркнуто третичным,
          новое рядом. Молчаливая подмена врала бы истории сметы. */}
      <td className={tableCell.numeric}>
        {removed ? (
          <span className={s.dash}>—</span>
        ) : position.qtyOrig ? (
          <span title="Объём скорректирован после публикации сметы">
            <s>{decimal(position.qtyOrig)}</s> → {decimal(position.qty)}
          </span>
        ) : (
          decimal(position.qty)
        )}
      </td>
      <td className={tableCell.muted}>{removed ? '—' : position.unit}</td>

      <SpreadCell row={row} bind={bind} />

      {bids.map((bid) => (
        <BidCell
          key={bid.contractor.id}
          row={row}
          contractor={bid.contractor}
          view={view}
          bind={bind}
        />
      ))}
    </tr>
  );
}

/* ── колонка «Разброс» ─────────────────────────────────────────────────────── */

function SpreadCell({ row, bind }: { row: RowFacts; bind: PopupBind }) {
  const { position, spread, spreadTag } = row;

  /* Меньше двух расценок — прочерк, а не ноль: ноль означал бы согласие. У
     единственного КП подпись говорит, почему числа нет. */
  if (position.removed || spread === null || spreadTag === null) {
    return (
      <td className={cx(tableCell.numeric, tableCell.muted)}>
        <span className={s.dash}>—</span>
        {!position.removed && row.bids.length === 1 ? (
          <span className={tableCell.sub}>одно КП</span>
        ) : null}
      </td>
    );
  }

  /* Метка выведена из процента порогом (high ≥ 15, noticeable ≥ 7); маркер
     ставится только на «высоком» — тот же порог, что у фильтра ([R4]). */
  const hot = spreadTag === 'high'
    ? (
      <button
        type="button"
        className={s.spreadMark}
        aria-label="Высокий разброс"
        {...bind({
          tone: 'danger',
          title: 'Высокий разброс',
          fields: [{ label: 'Разброс строки', value: `${decimal(spread)} %`, tone: true }],
          note: 'Цены КП расходятся на 15 % и больше — сверяйте состав объёма, прежде чем сравнивать итоги.',
        })}
      >
        <SpreadMark />
      </button>
    )
    : null;

  return (
    <td className={cx(tableCell.numeric, SPREAD_TONE[spreadTag])}>
      {decimal(spread)} %
      {hot}
      {/* Микрошкала ОБЩАЯ для всех строк (25 % = вся длина) — сравнивать бары
          между строками можно только на одной шкале. */}
      <span className={s.spreadBar} aria-hidden="true">
        <i style={{ width: `${Math.min((spread / 25) * 100, 100)}%` }} />
      </span>
    </td>
  );
}

/* ── ячейка КП ─────────────────────────────────────────────────────────────── */

function BidCell({ row, contractor, view, bind }: {
  row: RowFacts;
  contractor: Contractor;
  view: CompareView;
  bind: PopupBind;
}) {
  const { position } = row;

  /* Снятая строка схлопывается во всех КП: история, а не мусор. */
  if (position.removed) {
    return (
      <td className={cx(tableCell.numeric, tableCell.roomy)}>
        <span className={s.dash}>—</span>
      </td>
    );
  }

  const mark = cellMark(contractor, position.id);
  const price = contractor.prices[position.id];

  /* Отказ — решение подрядчика: нейтральная капсула. Не тревога и не пробел:
     красить решение в danger — врать о его природе. */
  if (mark.declined) {
    return (
      <td className={cx(tableCell.numeric, tableCell.roomy)}>
        <span className={s.chip}>
          <Icon name="closeCircle" className={s.chipIcon} />
          Отказ
        </span>
      </td>
    );
  }

  /* Пробел данных: пунктирная рамка внутри ячейки («место было, содержимого
     нет») и тире. Отсутствие ключа — не ноль. */
  if (price === undefined) {
    return (
      <td className={cx(tableCell.numeric, tableCell.roomy, s.cellMissing)}>
        <span className={s.dash}>—</span>
        <span className={tableCell.sub}>нет цены</span>
      </td>
    );
  }

  const qty = position.qty;
  const sum = price * qty;
  const anomaly = hasAnomaly(mark);
  const median = row.median;
  const dev = median !== null ? deviationPct(price, median) : null;

  const metrics = shownMetrics(view);
  const mainMetric = metrics[0];
  const extras = metrics.slice(1);

  /* Минимум живёт ТОЛЬКО в режиме «Цена» и только у лучшей неаномальной цены
     при живой конкуренции (§2, §4.6 аудита). */
  const isMin = mainMetric === 'price' && row.bestId === contractor.id;

  /* Главное число ячейки — по выбранному показателю. */
  let head: ReactNode;
  if (mainMetric === 'price') {
    head = money(sum);
  } else if (mainMetric === 'potential') {
    head = mark.potential ? `+${money(mark.potential * qty)}` : '—';
  } else {
    head = dev === null ? '—' : (
      <span className={cx(Math.abs(dev) > DEV_TOLERANCE && s.devHot)}>
        {pctSigned(dev)}
      </span>
    );
  }

  /* Подстрочники: удельная цена всегда, за ней дополнительные показатели
     пресета (максимум три показателя на ячейку). */
  const subs = [
    <span key="unit" className={tableCell.sub}>{money(price)}/{position.unit}</span>,
    ...extras.map((m) => (
      <span key={m} className={tableCell.sub}>
        {m === 'price'
          ? money(sum)
          : m === 'potential'
            ? (mark.potential ? `+${money(mark.potential * qty)}` : 'без запаса')
            : `${dev === null ? '—' : pctSigned(dev)} к медиане`}
      </span>
    )),
  ];

  /* Попапы пометок получают payload готовым — ничего не считают сами. */
  const spreadFraction = row.spread === null ? 0 : Math.min(row.spread / 25, 1);
  const minData: CellPopupData | null = isMin ? {
    tone: 'success',
    title: 'Минимальное значение',
    fields: [
      {
        label: 'Значение',
        value: (
          <>
            {money(sum)}
            <span className={s.popupUnit}>{money(price)}/{position.unit}</span>
          </>
        ),
      },
      ...(mark.potential
        ? [{ label: 'Запас торга', value: `+${money(mark.potential * qty)}`, tone: true }]
        : []),
      { label: 'К медиане строки', value: dev === null ? '—' : pctSigned(dev) },
    ],
    meter: row.spread === null
      ? undefined
      : { label: 'Разброс строки', value: `${decimal(row.spread)} %`, fraction: spreadFraction },
    note: 'Лучшая цена среди НЕаномальных предложений строки.',
  } : null;

  const coinData: CellPopupData | null = mark.potential ? {
    tone: 'info',
    title: 'Заявленный запас торга',
    fields: [{ label: 'Запас торга', value: `+${money(mark.potential * qty)}`, tone: true }],
    note: 'Сумма, которую подрядчик сам обозначил как возможную к скидке: вход в торг, а не вывод.',
  } : null;

  const medShown = mainMetric === 'price'
    && !isMin && !anomaly
    && dev !== null && dev > DEV_TOLERANCE;

  const anomalyData: CellPopupData = {
    tone: 'warning',
    title: 'Аномальная цена',
    fields: [
      { label: 'Значение', value: money(sum) },
      { label: 'К медиане строки', value: dev === null ? '—' : pctSigned(dev) },
    ],
    meter: row.spread === null
      ? undefined
      : { label: 'Разброс строки', value: `${decimal(row.spread)} %`, fraction: spreadFraction },
    note: mark.anomaly ?? '',
  };

  /* Главное значение и все его устройства живут одной строкой; резерв справа
     держит .stack — общий всем ячейкам колонки, поэтому выравнивание не едет. */
  const body = (
    <span className={s.stack}>
      <span className={s.priceLine}>
        {mainMetric === 'price' ? (
          <>
            <span className={cx(s.price, isMin && s.priceMin)}>
              {head}
              {/* Триггер попапа — САМА бирка, а не ячейка: раскачка и
                  объяснение появляются, только когда курсор на ценнике. */}
              {isMin && minData ? (
                <button
                  type="button"
                  className={s.tag}
                  aria-label="Минимальное значение"
                  {...bind(minData)}
                >
                  <TagMark />
                </button>
              ) : null}
              {/* Монета — у ОСНОВАНИЯ цены слева: справа-снизу уже висит «МИН». */}
              {coinData ? (
                <button
                  type="button"
                  className={s.coin}
                  aria-label="Заявленный запас торга"
                  {...bind(coinData)}
                >
                  <CoinMark />
                </button>
              ) : null}
            </span>
            {/* Леденец «дороже медианы» — только когда смысл не занят ценником
                или штриховкой: второй глиф про то же был бы шумом. */}
            {medShown ? (
              <button
                type="button"
                className={s.medMark}
                aria-label="Заметно дороже медианы"
                {...bind({
                  tone: 'neutral',
                  title: 'Заметно дороже медианы',
                  fields: [
                    { label: 'Значение', value: money(sum) },
                    { label: 'К медиане строки', value: dev === null ? '—' : pctSigned(dev) },
                  ],
                  note: 'Цена выше медианы строки больше чем на 5 % — тот же порог, что красит отклонение.',
                })}
              >
                <MedMark />
              </button>
            ) : null}
          </>
        ) : head}
      </span>
      {subs}
    </span>
  );

  if (!anomaly) {
    return <td className={cx(tableCell.numeric, tableCell.roomy)}>{body}</td>;
  }

  /* Аномалия: штриховка и рейка на ЯЧЕЙКЕ, триггер попапа — на содержимом:
     фокусная цель обязана быть интерактивным элементом, а не ячейкой. */
  return (
    <td className={cx(tableCell.numeric, tableCell.roomy, s.cellAnomaly)}>
      <button
        type="button"
        className={s.anomalyTrigger}
        aria-label={`Аномальная цена: ${money(sum)}`}
        {...bind(anomalyData)}
      >
        {body}
      </button>
    </td>
  );
}

/* ── итоги ─────────────────────────────────────────────────────────────────── */

/** Строка итога: и подытог раздела, и итог по срезу — один счёт из переданных
 *  строк, то есть видимых. Визуальная фильтрация с неизменным итогом — это
 *  враньё в подытоге (§0 аудита). */
function TotalRow({ label, rows, bids }: { label: string; rows: RowFacts[]; bids: Bid[] }) {
  return (
    <tr className={s.totalRow}>
      {/* Просто «Итого»: раздел назван строкой выше — повторять его имя значит
          заставить прочитать его дважды. */}
      <td colSpan={4} className={s.totalLabel}>{label}</td>
      {bids.map((bid) => {
        const sum = rows.reduce(
          (acc, r) => acc + (bid.contractor.prices[r.position.id] ?? 0) * r.position.qty,
          0,
        );
        return (
          <td key={bid.contractor.id} className={cx(tableCell.numeric, tableCell.roomy, s.totalValue)}>
            {sum ? money(sum) : '—'}
          </td>
        );
      })}
    </tr>
  );
}

/** Действующий цвет колонки: рука важнее ранжира. */
function choose(tint: Record<string, string>, bid: Bid): string {
  return tint[bid.contractor.id] ?? toneColor(bid.tone);
}

/* ── карточка подрядчика = шапка колонки ───────────────────────────────────── */

/** Карточка подрядчика — она же шапка колонки. Локальная: за её пределами
 *  такой блок ничего не значит, а вынести в shared можно будет, когда
 *  появится второй экран со сравнением по колонкам. */
function ContractorCard({
  bid, total, col, starred, collapsed, onStar, onPaint, onOpen, onFold,
}: {
  bid: Bid;
  /** Сколько всего позиций в смете — знаменатель подписи «расценки есть у N
   *  из M». Пропом, а не из модуля: длина сметы приходит с данными. */
  total: number;
  /** Готовая CSS-строка цвета: карточка не знает, ранжир его дал или рука. */
  col: string;
  starred: boolean;
  collapsed: boolean;
  onStar: () => void;
  /** Отдаёт прямоугольник нажатой кнопки: от него падает выпадашка. */
  onPaint: (from: DOMRect) => void;
  onOpen: () => void;
  onFold: () => void;
}) {
  const { contractor, filled, percent, sum, rankLabel } = bid;
  const status = bidStatus(contractor.status);

  return (
    // Целиком карточка НЕ кликается: в ней четыре собственных контрола, и
    // «клик мимо них» открывал модалку всякий раз, когда рука промахивалась.
    // Досье открывают две явные цели — имя и стрелка напротив статуса.
    <div className={s.card} style={{ '--col': col } as CSSProperties}>
      <header className={s.cardHead}>
        <button
          type="button"
          className={cx(s.star, starred && s.isOn)}
          aria-pressed={starred}
          aria-label={`${contractor.name}: ${starred ? 'убрать из избранного' : 'в избранное'}`}
          title={starred ? 'В избранном' : 'Добавить в избранное'}
          onClick={onStar}
        >
          <Icon name={starred ? 'starFilled' : 'star'} />
        </button>

        {/* Просто текст. Кнопкой имя было, пока карточка кликалась целиком —
            теперь явная цель одна: стрелка досье. */}
        <p className={s.cardName}>{contractor.name}</p>

        {/* Место в ранжире осталось ТОЛЬКО текстом для скринридера: порядок
            колонок и их цвет говорят то же самое, но заливка в 7% для
            скринридера не существует вовсе. */}
        <VisuallyHidden>{rankLabel}</VisuallyHidden>

        <button
          type="button"
          className={cx(s.fold, collapsed && s.isOn)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Развернуть карточки подрядчиков' : 'Свернуть карточки подрядчиков'}
          title={collapsed ? 'Развернуть все' : 'Свернуть все'}
          onClick={onFold}
        >
          <Icon name="chevronDown" />
        </button>
      </header>

      {collapsed ? null : (
      <div className={s.cardBody}>
        {/* Полнота КП и его итог одной строкой — два числа, по которым колонки
            и сравнивают. Числом, а не полосой: на 220px разница между 88% и
            92% на шкале неразличима, а решают именно они. */}
        <div className={s.figures}>
          <p
            className={s.fill}
            title={`Расценки есть у ${filled} позиций из ${total}`}
          >
            <span className={s.percent}>{percent}%</span>
            <span className={s.fillLabel}>заполнено</span>
          </p>
          <p className={s.sum}>{money(sum)}</p>
        </div>

        {/* Статус слева, действия справа. */}
        <div className={s.meta}>
          <Badge className={s.cardStatus} tone={status.tone} icon={status.icon}>
            {status.label}
          </Badge>

          <button
            type="button"
            className={cx(s.cardAct, s.cardActPaint)}
            aria-label={`Цвет колонки «${contractor.name}»`}
            title="Цвет колонки"
            onClick={(e) => onPaint(e.currentTarget.getBoundingClientRect())}
          >
            <Icon name="palette" />
          </button>

          {/* Диагональ, а не шеврон: уход в отдельное окно, а не раскрытие на
              месте. */}
          <button
            type="button"
            className={cx(s.cardAct, s.cardActSpin)}
            aria-label={`Досье подрядчика «${contractor.name}»`}
            title="Открыть досье"
            onClick={onOpen}
          >
            <Icon name="arrowRightUp" />
          </button>
        </div>
      </div>
      )}
    </div>
  );
}

/** Содержимое выпадашки палитры: пикер и возврат под расчёт. Своего состояния
 *  нет — цвет уезжает наверх на каждое движение, и колонка перекрашивается
 *  живьём. Ни заголовка, ни «Готово»: чью колонку красим, видно по самой
 *  колонке, а закрывают кликом мимо или Escape, как любое меню. */
function Painter({
  value, onPick, onReset,
}: {
  value: string;
  onPick: (color: string) => void;
  onReset: () => void;
}) {
  return (
    <>
      <ColorPicker value={value} onChange={onPick} />
      <footer className={s.popFoot}>
        <button type="button" className={s.popReset} onClick={onReset}>По ранжиру</button>
      </footer>
    </>
  );
}

/** Досье подрядчика — пока заглушка: реквизиты, итог по КП и честная фраза о
 *  том, что раздел ещё не сделан. Окно с пустотой внутри хуже отсутствия
 *  окна, поэтому здесь стоит то, что УЖЕ известно из сравнения. */
function Dossier({ bid, total, onClose }: { bid: Bid; total: number; onClose: () => void }) {
  const { contractor, percent, filled, sum, rankLabel } = bid;
  const status = bidStatus(contractor.status);

  return (
    <>
      <header className={modalPart.head}>
        <h2 className={modalPart.title}>{contractor.name}</h2>
        <Badge tone={status.tone} icon={status.icon}>{status.label}</Badge>
      </header>

      <dl className={s.facts}>
        <Fact label="ИНН">{contractor.inn}</Fact>
        <Fact label="Контактное лицо">{contractor.contact}</Fact>
        <Fact label="КП поступило">{contractor.submitted}</Fact>
        <Fact label="Заполнено">
          {percent}% — {filled} из {total} {plural(total, 'позиции', 'позиций', 'позиций')}
        </Fact>
        <Fact label="Итог по КП">{money(sum)}</Fact>
        <Fact label="Место в сравнении">{rankLabel}</Fact>
      </dl>

      {/* <ScreenPlaceholder> сюда не берётся намеренно: у него min-height 320px —
          он рассчитан на пустой ЭКРАН и в окне на 520px выглядел бы дырой. */}
      <p className={s.note}>
        <Icon name="billList" className={s.noteIcon} />
        Карточка подрядчика — история договоров, допуски и рейтинг — ещё не реализована.
      </p>

      <footer className={modalPart.foot}>
        {/* autoFocus, чтобы showModal() не оставлял фокус на самом <dialog>. */}
        <Button variant="primary" autoFocus onClick={onClose}>Закрыть</Button>
      </footer>
    </>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={s.fact}>
      <dt className={s.factLabel}>{label}</dt>
      <dd className={s.factValue}>{children}</dd>
    </div>
  );
}
