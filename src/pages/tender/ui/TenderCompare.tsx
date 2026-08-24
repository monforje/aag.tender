import {
  useEffect, useMemo, useState,
  type CSSProperties,
} from 'react';
import { cx } from '@/shared/lib/cx';
import { Button } from '@/shared/ui/Button';
import { useCellPopup } from '@/shared/ui/CellPopup';
import { Icon } from '@/shared/ui/Icon';
import { ScreenPlaceholder } from '@/shared/ui/Page';
import { Table, tableCell } from '@/shared/ui/Table';
import { Tooltip } from '@/shared/ui/Tooltip';
import {
  analyzeComparison, filterRows, flatten, isModifiedView, METRIC_LABEL, metricTotals, rankBids, ROW_VIEW_LABEL, type Bid, type CompareThresholds, type CompareView, type Comparison, type PositionGroup, type PresetId, type RowFacts,
} from '@/entities/comparison';
import { choose, resolveTone } from '../model/compareFormat';
import { computeColumnLayout, titleLimit } from '../model/columns';
import { useBandMaxHeight } from '../model/useBandMaxHeight';
import { useBandWidth } from '../model/useBandWidth';
import { useTableDock } from '../model/useTableDock';
import { CompareToolbar } from './CompareToolbar';
import { ColumnPainter } from './ColumnPainter';
import { CompareRow } from './CompareRow';
import { ContractorCard } from './ContractorCard';
import { DossierModal } from './DossierModal';
import { TermsBand } from './TermsBand';
import { TotalRow } from './TotalRow';
import s from './TenderCompare.module.css';

/** Ширина на <col> инлайном; undefined — кадр до первого замера. */
const pxStyle = (w?: number): { width: string } | undefined =>
  w == null ? undefined : { width: `${w}px` };

/**
 * Сравнение коммерческих предложений: позиции сметы строками, подрядчики —
 * колонками с карточкой в шапке; над таблицей — полоса пресетов, показателя,
 * вида строк и предикатов (Д.1 аудита сравнения КП).
 *
 * КОГДА:  раздел «Сравнение» карточки тендера.
 * НЕ ДЛЯ: реестра тендеров (см. TenderRegistryPage) и списка самих КП
 *         (раздел «КП» — это документы, а не сопоставление цифр).
 *
 * ДАННЫЕ: приходят ПРОПАМИ — смета секциями и КП подрядчиков (тип
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
 *         ЦВЕТ КОЛОНКИ — ПОДСКАЗКА, А НЕ ВЕРДИКТ: в покое колонки белые,
 *         подкраска по ранжиру включается тумблером в окне параметров, а
 *         поверх неё колонку перекрашивают рукой через <ColumnPainter>;
 *         смысловые тона пометок при этом рукой не трогаются никогда.
 *         СКРОЛЛ ЖИВЁТ В БЛОКЕ (.band), а не на странице: горизонталь нужна
 *         шести колонкам подрядчиков, но панорамировать весь экран ради неё
 *         нельзя — уезжала бы сводка с вкладками, а док «Анализ ИИ» справа
 *         переставал бы совпадать с содержимым. Потолок высоты блока ставит
 *         useBandMaxHeight, липкая шапка и автосайдбар — useTableDock.
 *         ШИРИНЫ: колонки подрядчиков ФИКСИРОВАНЫ одной константой
 *         (model/columns.ts, BID_FIXED — решение владельца 24.08.2026,
 *         отменившее «пол по полному имени»); длинное имя обрезается
 *         карточкой с всплытием полного названия, теснота жмёт левый блок
 *         и название, дно — панорама. НАЗВАНИЕ ПОЗИЦИИ режется по ЗНАКАМ
 *         (`titleLimit()` там же), а не CSS-многоточием: лимит — целое число
 *         и меняется в разы реже ширины, поэтому колонка названий перестала
 *         пересчитываться каждый кадр.
 *         ШАПКА И САЙДБАР: шапка таблицы прилипает к верхней кромке блока
 *         нативным sticky (<Table stickyHead>) — без JS в прокрутке; движение
 *         скролла ленты вниз прячет сайдбар в рейл. Механика — в хуке
 *         useTableDock, здесь остаётся только точка замера.
 * A11Y:   каждая пометка — кнопка со своим именем; активной цели ставится
 *         aria-describedby на попап. Счётчики над таблицей считаются по всему
 *         датасету и продублированы текстом в caption. Снятая строка остаётся
 *         в DOM — это история сметы. Ширины колонок — контракт <colgroup>
 *         при layout="fixed", содержимое на них не влияет; блок ленты
 *         фокусируем (role="region"), чтобы прокручивать с клавиатуры.
 *
 * @example
 * <TenderCompare {...comparison} view={view} onPreset={applyPreset}
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
      МЕМОИЗИРОВАНЫ ПО ДАННЫМ, а не по рендеру: пересчёт трогает медианы,
      разбросы, аномалии и веса по всем ячейкам сразу, а поводов перерисоваться
      у экрана полно и без смены данных — открытие панели «Анализ ИИ» двигает
      ширину ленты КАЖДЫЙ кадр анимации, за ним resize окна, звезда, перекраска
      колонки, попап. Замер (puppeteer, 428 строк × 6 КП): скрипт на открытие
      панели 208 → 30 мс, на прокрутку окна 396 → 26 мс. Ссылочная
      стабильность `bids` — ещё и условие memo у <CompareRow>. */
  const positions = useMemo(() => flatten(groups), [groups]);
  const bids = useMemo(() => rankBids(contractors, positions), [contractors, positions]);
  const facts = useMemo(
    () => analyzeComparison(groups, contractors, thresholds),
    [groups, contractors, thresholds],
  );
  const totals = useMemo(() => metricTotals(facts.rows, bids), [facts, bids]);

  const modified = isModifiedView(view);

  /* Свёрнутость карточек ОДНА на все: колонки сравнивают, а не разглядывают
      по одной. Разделы сворачиваются ПООДИНОЧКЕ. Цвет колонки — CSS-строка,
      отсутствие ключа значит «по ранжиру». */
  const [collapsed, setCollapsed] = useState(false);
  /* ЗАКРЕПЛЕНИЕ КОЛОНКИ-ЯКОРЯ — ВЫКЛЮЧЕНО ПО УМОЛЧАНИЮ (решение владельца
     23.08.2026) и живёт ЗДЕСЬ, а не в CompareView, хотя выглядит как ещё одна
     ось вида. Причины две, и обе про поведение соседних контролов.
     Первая: `isModifiedView` поднял бы чип «Изменён · Сброс» на закрепление —
     а оно не уводит от базы пресета, срез данных остаётся тем же.
     Вторая: пресет присваивает оси ЦЕЛИКОМ, и переключение «Обзор → Торги»
     сбрасывало бы закрепление ровно в тот момент, когда таблица становится
     шире и якорь нужнее всего.
     Это эргономика ЧТЕНИЯ — того же рода, что `folded` и `collapsed` рядом:
     переживает смену пресета, не переживает уход со страницы. */
  const [pinned, setPinned] = useState(false);
  /* ПОДКРАСКА ПО РАНЖИРУ — ТУМБЛЕР, а не константа (решение владельца
     24.08.2026, вторая волна): дефолт сняли, но сам режим оказался нужен, и
     живёт он там же, где `pinned` и `collapsed`, — это эргономика ЧТЕНИЯ.
     В `CompareView` ему не место по тем же двум причинам: чип «Изменён»
     поднялся бы на раскраску, а смена пресета её сбрасывала бы. */
  const [rankTint, setRankTint] = useState(false);
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const [tint, setTint] = useState<Record<string, string>>({});
  const [dossier, setDossier] = useState<Bid | null>(null);
  /* Палитра — вторая панель: состояние хранит КП вместе с прямоугольником
     нажатой кнопки. Механика обеих панелей — в <DossierModal> и <ColumnPainter>. */
  const [paint, setPaint] = useState<{ bid: Bid; at: DOMRect } | null>(null);

  const paintValue = (bid: Bid) => tint[bid.contractor.id] ?? resolveTone(bid.tone);
  const colorOf = (bid: Bid) => choose(tint, bid, rankTint);

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

  /* Потолок высоты блока: остаток экрана под вводными полосами. Страница
     доскролливает сводку с вкладками и останавливается — дальше едет
     только содержимое ленты (механика — в JSDoc хука). */
  const active = groups.length > 0 && contractors.length > 0;
  const bandMaxH = useBandMaxHeight(dockRef, active);
  const bandWidth = useBandWidth(dockRef, active);

  /* ШИРИНА КОЛОНКИ КП ФИКСИРОВАНА (model/columns.ts, BID_FIXED): замерщик
      полных имён и его хромы ушли вместе с решением «пол по имени» — имя
      длиннее константы обрезает <ContractorCard>, полное название всплывает
      по наведению. Расчёт — чистая функция от видимой ширины блока; null —
      кадр до первого замера ширины. */
  const layout = useMemo(
    () => (bandWidth == null
      ? null
      : computeColumnLayout({ available: bandWidth, bids: contractors })),
    [bandWidth, contractors],
  );
  /* Ширина таблицы = сумма колонок ровно до пикселя: с ней исполняются
      ширины <col> при layout="fixed" (max-content их теряет). Инлайном на
      самой таблице — смена ширины валидирует её РАСКЛАДКУ, но не стиль
      всех ячеек, каких дала бы наследуемая переменная на обёртке. */
  const tableWidth = useMemo(() => (layout == null ? undefined
    : layout.qty + layout.unit + layout.spread + layout.title
      + Object.values(layout.bids).reduce((acc, w) => acc + w, 0)),
  [layout]);
  /* Закреплять имеет смысл ТОЛЬКО в панораме: в двух других режимах columns.ts
     раскладывает колонки ровно в ширину ленты, горизонтального хода нет вовсе,
     и закреплённая колонка ничем не отличалась бы от обычной. `pan` — это и
     есть «сумма полов больше доступного места», единственный режим с
     прокруткой. */
  /* ПОТОЛОК НАЗВАНИЯ В ЗНАКАХ. Целое число, и это условие работы memo у
     <CompareRow>: ширина ленты дрожит каждый кадр анимации панели и ухода
     сайдбара, а лимит меняется раз в несколько десятков пикселей. */
  const limit = titleLimit(layout?.title);

  /* Строки, прошедшие ВСЕ предикаты; секции собирают свои из них же.
     Для ПОДЫТОГОВ узла нужен полный набор его позиций: фильтр прячет строки,
     но суммы не двигает. */
  const visible = useMemo(() => filterRows(facts.rows, view.filters), [facts, view.filters]);
  const visibleIds = useMemo(() => new Set(visible.map((r) => r.position.id)), [visible]);
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
          totals={totals}
          modified={modified}
          rankTint={rankTint}
          onRankTint={setRankTint}
          analysisApplied={analysisApplied}
          onRestoreView={onRestoreView}
          onPreset={onPreset}
          onPatch={onPatch}
        />
      </div>

      {/* Точка замера порога сайдбара и СКРОЛЛБЛОК ленты: обе прокрутки —
          здесь, не на странице (разбор — в .module.css и JSDoc). Потолок
          высоты ставит useBandMaxHeight инлайном. Клик по таблице снимает
          подсветку строки из «Анализа»: пользователь уже смотрит сам, чужая
          метка больше не нужна.
          БЛОК — КОНТЕЙНЕР ПЛОТНОСТИ (.band): по его фактической ширине
          лестница в .module.css ступенями ужесточает контракт колонок,
          паддинги и зум ленты — от любой причины сжатия (панель «Анализ
          ИИ», узкое окно), а не только от одной конкретной.
          tabIndex + region: прокручиваемый блок доступен с клавиатуры —
          стрелки панорамируют его, когда фокус стоит на рамке. */}
      <div
        ref={dockRef}
        className={s.band}
        style={{ '--band-max-h': bandMaxH != null ? `${bandMaxH}px` : undefined } as CSSProperties}
        role="region"
        aria-label={`Сравнение КП: ${contractors.length} подрядчиков`}
        tabIndex={0}
        onClick={() => { if (focusRowId) onFocusClear(); }}
      >
        <div className={s.density}>
        <Table
          stickyHead
          stickyCol={pinned}
          layout="fixed"
          width={tableWidth}
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
              ДЕФОЛТНОЙ ПОДКРАСКИ ПО РАНЖИРУ НЕТ (решение владельца 24.08.2026):
              в покое колонка белая. --col приходит либо от ручной палитры,
              либо от тумблера «Раскрасить по ранжированию» в окне параметров;
              ручной цвет старше — перекрашенная колонка тумблером не
              перебивается. ШИРИНЫ ставит расчётчик
              (model/columns.ts) инлайном: до первого замера кадр живёт без них,
              дальше ширина есть у каждого <col>. */}
          <colgroup className={s.cols}>
            <col className={s.colRule} style={pxStyle(layout?.title)} />
            <col className={s.colRule} style={pxStyle(layout?.qty)} />
            <col className={s.colRule} style={pxStyle(layout?.unit)} />
            <col className={s.colRule} style={pxStyle(layout?.spread)} />
            {bids.map((bid, i) => {
              const col = colorOf(bid);
              return (
                <col
                  key={bid.contractor.id}
                  className={cx(col && s.colTint, i < bids.length - 1 && s.colRule)}
                  style={{
                    ...pxStyle(layout?.bids[bid.contractor.id]),
                    ...(col ? { '--col': col } : {}),
                  } as CSSProperties}
                />
              );
            })}
          </colgroup>
          <thead>
            <tr>
              {/* Кнопка закрепления живёт В ШАПКЕ САМОЙ КОЛОНКИ, а не в полосе
                  контролов: полоса уже отказала седьмому контролу (см.
                  CompareToolbar), а «закрепить» относится к ОДНОЙ конкретной
                  колонке — у её заголовка оно и объясняет себя без подписи.
                  ПОКАЗЫВАЕТСЯ ВСЕГДА (решение владельца 24.08.2026, вторая
                  волна). Прежний гейт «только когда лента шире видимой
                  области» звучал разумно, но означал контрол, которого на
                  одном тендере нет, а на другом есть: наличие кнопки зависело
                  от числа КП и ширины окна — то есть от ДАННЫХ. Закрепление
                  при влезающей таблице ничего не меняет и ничего не ломает,
                  а предсказуемое место контрола дороже экономии на одном
                  глифе. */}
              <th scope="col" className={s.headRule}>
                Позиция
                <button
                  type="button"
                  className={cx(s.pin, pinned && s.pinOn)}
                  aria-pressed={pinned}
                  title={pinned
                    ? 'Открепить колонку — она снова будет уезжать при прокрутке'
                    : 'Закрепить колонку — останется на месте при прокрутке вправо'}
                  onClick={() => setPinned((on) => !on)}
                >
                  <Icon name={pinned ? 'pinFilled' : 'pin'} />
                  <span className="visually-hidden">
                    {pinned ? 'Открепить колонку «Позиция»' : 'Закрепить колонку «Позиция»'}
                  </span>
                </button>
              </th>
              <th scope="col" className={cx(tableCell.numeric, s.headRule)}>Количество</th>
              <th scope="col" className={s.headRule}>Единица</th>
              <th scope="col" className={cx(tableCell.numeric, s.headRule)}>Разброс</th>
            {bids.map((bid, i) => (
              <th
                scope="col"
                key={bid.contractor.id}
                className={cx(
                  tableCell.card,
                  i < bids.length - 1 && s.headRule,
                  flashCols?.has(bid.contractor.id) && s.colFlash,
                )}
              >
                <ContractorCard
                  bid={bid}
                  total={positions.length}
                  col={colorOf(bid)}
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
             /* По секциям: заголовок, строки, подытог — и все три только из
                видимых строк. Секция, не прошедшая фильтр, исчезает целиком:
                пустой блок читался бы как сбой. */
             groups.map((group) => {
               const rows = rowsOfGroup(group);
               if (!rows.length) return null;
               const open = !folded[group.id];
               return (
                 <tbody key={group.id}>
                   {/* Шапка секции — ОДНА ячейка на всю ширину таблицы
                       (tableCell.fullRow гасит липкость sticky-col): строки
                       внутри колонок на ней не рисуются, счётчика позиций
                       больше нет (решение владельца 24.08.2026), это строка-
                       заголовок блока, а не ряд значений. scope="rowgroup":
                       заголовок для СТРОК под ним. */}
                   <tr className={s.groupRow}>
                     <th
                       scope="rowgroup"
                       colSpan={4 + bids.length}
                       className={cx(tableCell.card, tableCell.fullRow, s.groupHead)}
                     >
                       {/* Кнопка-полоса ЛИПНЕТ К ЛЕВОЙ КРОМКЕ видимой области и
                           стоит её шириной (100cqw — контейнер объявлен на
                           обёртке таблицы): заголовок центрируется
                           относительно того, что видит глаз сейчас, а не всей
                           прокрученной таблицы. Стрелка слева, справа — её
                           призрак той же ширины: иначе центр названия съезжал
                           бы на полстрелки. */}
                       <button
                         type="button"
                         className={s.sectionToggle}
                         aria-expanded={open}
                         aria-label={`${group.title}: ${open ? 'свернуть' : 'развернуть'} секцию`}
                         onClick={() => setFolded((all) => ({ ...all, [group.id]: open }))}
                       >
                         <span className={cx(s.fold, !open && s.isOn)}>
                           <Icon name="chevronDown" />
                         </span>
                         <Tooltip text={group.title}>
                           <span className={s.sectionTitle}>{group.title}</span>
                         </Tooltip>
                         <span className={s.sectionSpacer} aria-hidden="true" />
                       </button>
                     </th>
                   </tr>

                  {/* Итог остаётся и у свёрнутого раздела: ради него и сворачивают.
                      Строки въезжают каскадом по индексу — раскрытие подтверждается
                      появлением содержимого, а не мгновенной подменой (высоту строк
                      <table> честно не анимировать, решение 23.08.2026). */}
                  {open ? rows.map((row, i) => (
                    <CompareRow
                      key={row.position.id}
                      row={row}
                      enterIndex={i}
                      view={view}
                      titleLimit={limit}
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
                    titleLimit={limit}
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

          {/* Условия поставщиков — матрица ответов формы КП вне цен, выровненная
              по тем же колонкам. Тендеров без `terms` она не касается вовсе. */}
          <TermsBand bids={bids} bind={popup.bind} />
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
