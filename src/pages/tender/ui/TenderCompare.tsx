import {
  useEffect, useLayoutEffect, useMemo, useRef, useState,
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
  analyzeComparison, filterRows, flatten, isModifiedView, METRIC_LABEL, metricTotals, rankBids, ROW_VIEW_LABEL, type Bid, type CompareThresholds, type CompareView, type Comparison, type PositionGroup, type PresetId, type RowFacts,
} from '@/entities/comparison';
import { choose, resolveTone } from '../model/compareFormat';
import { computeColumnLayout } from '../model/columns';
import { useBandMaxHeight } from '../model/useBandMaxHeight';
import { useBandWidth } from '../model/useBandWidth';
import { useTableDock } from '../model/useTableDock';
import { CompareToolbar } from './CompareToolbar';
import { ColumnPainter } from './ColumnPainter';
import { CompareRow } from './CompareRow';
import { ContractorCard } from './ContractorCard';
import { DossierModal } from './DossierModal';
import { TotalRow } from './TotalRow';
import s from './TenderCompare.module.css';

/* Хром шапки карточки ВОКРУГ имени: паддинги (12×2), слоты звезды и стрелки
   (--cu-size-6 по 24), гэпы сетки шапки (6×2) и зазор на округление вверх.
   Прибавляется к замеренной ширине текста, образуя пол ширины колонки. */
const NAME_CHROME = 24 * 3 + 6 * 2 + 2;
/* Медаль лидера с её отступом — добавляется только колонке первого места. */
const LEADER_CHROME = 14 + 5;

const sameFloors = (a: Record<string, number>, b: Record<string, number>): boolean => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
};

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
 *         СКРОЛЛ ЖИВЁТ В БЛОКЕ (.band), а не на странице: горизонталь нужна
 *         шести колонкам подрядчиков, но панорамировать весь экран ради неё
 *         нельзя — уезжала бы сводка с вкладками, а док «Анализ ИИ» справа
 *         переставал бы совпадать с содержимым. Потолок высоты блока ставит
 *         useBandMaxHeight, липкая шапка и автосайдбар — useTableDock.
 *         ШИРИНЫ СЧИТАЕТ АЛГОРИТМ (model/columns.ts): пол каждой колонки
 *         подрядчика — её полное имя (замерщик .measure); равная доля в
 *         вилке пол/потолок остаётся базой, длинное имя раздвигает свою
 *         колонку, теснота жмёт левый блок и название, дно — панорама.
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

  /* Потолок высоты блока: остаток экрана под вводными полосами. Страница
     доскролливает сводку с вкладками и останавливается — дальше едет
     только содержимое ленты (механика — в JSDoc хука). */
  const active = groups.length > 0 && contractors.length > 0;
  const bandMaxH = useBandMaxHeight(dockRef, active);
  const bandWidth = useBandWidth(dockRef, active);

  /* ШИРИНА КОЛОНКИ ОТ ПОЛНОГО ИМЕНИ. Имя подрядчика — то, по чему колонку
     опознают, поэтому пол каждой колонки — её собственное имя целиком:
     скрытая копия шапки (ниже, .measure с тем же классом имени) меряет
     тексты, и пол уезжает в расчётчик ширин. Пересчёт — при смене состава
     или имён, смене лидера (медаль добавляет хром) и после догрузки
     шрифтов; равные результаты состояние не двигают, иначе замер зациклил
     бы перерендер. */
  const nameNodes = useRef(new Map<string, HTMLSpanElement>());
  const [nameFloors, setNameFloors] = useState<Record<string, number>>({});
  /* В ключе — и состав имён, и текущий лидер: медаль добавляет колонке
     первого места свой хром, и её переезд обязан пересчитать полы. */
  const leaderId = bids.find((bid) => bid.rank === 1)?.contractor.id;
  const namesKey =
    contractors.map((c) => `${c.id}:${c.name}`).join('|') + '#' + String(leaderId);
  /* Layout-эффект: полы обязаны встать до первой отрисовки, иначе колонки
     на кадр рождаются равными долями и едут у пользователя на глазах.
     document.fonts.ready — асинхронная доводка после подгрузки шрифтов. */
  useLayoutEffect(() => {
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const floors: Record<string, number> = {};
      for (const bid of bids) {
        const node = nameNodes.current.get(bid.contractor.id);
        if (!node) continue;
        floors[bid.contractor.id] =
          Math.ceil(node.offsetWidth) + NAME_CHROME + (bid.rank === 1 ? LEADER_CHROME : 0);
      }
      setNameFloors((prev) => (sameFloors(prev, floors) ? prev : floors));
    };
    measure();
    document.fonts?.ready.then(measure);
    return () => { cancelled = true; };
    // Зависимость — состав имён: сам перечень bids пересоздаётся каждым
    // рендером, и эффект по нему повторялся бы на любом постороннем движении.
  }, [namesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* РАСЧЁТ ШИРИН КОЛОНОК: чистая функция от видимой ширины и полов имён
     (механика и три режима — в model/columns.ts). Пересобирается только
     при смене ширины блока или полов; null — кадр до первого замера. */
  const bidFloors = useMemo(
    () => contractors.map((c) => ({ id: c.id, floor: nameFloors[c.id] ?? 0 })),
    [contractors, nameFloors],
  );
  const layout = useMemo(
    () => (bandWidth == null ? null : computeColumnLayout({ available: bandWidth, bids: bidFloors })),
    [bandWidth, bidFloors],
  );
  /* Закреплять имеет смысл ТОЛЬКО в панораме: в двух других режимах columns.ts
     раскладывает колонки ровно в ширину ленты, горизонтального хода нет вовсе,
     и закреплённая колонка ничем не отличалась бы от обычной. `pan` — это и
     есть «сумма полов больше доступного места», единственный режим с
     прокруткой. */
  const pannable = layout?.pan ?? false;

  /* Строки, прошедшие ВСЕ предикаты; разделы собирают свои из них же.
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
              ШИРИНЫ ставит расчётчик (model/columns.ts) инлайном: до первого
              замера кадр живёт без них, дальше ширина есть у каждого <col>. */}
          <colgroup className={s.cols}>
            <col className={s.colRule} style={pxStyle(layout?.title)} />
            <col className={s.colRule} style={pxStyle(layout?.qty)} />
            <col className={s.colRule} style={pxStyle(layout?.unit)} />
            <col className={s.colRule} style={pxStyle(layout?.spread)} />
            {bids.map((bid, i) => (
              <col
                key={bid.contractor.id}
                className={cx(s.colTint, i < bids.length - 1 && s.colRule)}
                style={{
                  ...pxStyle(layout?.bids[bid.contractor.id]),
                  '--col': choose(tint, bid),
                } as CSSProperties}
              />
            ))}
          </colgroup>
          <thead>
            <tr>
              {/* Кнопка закрепления живёт В ШАПКЕ САМОЙ КОЛОНКИ, а не в полосе
                  контролов: полоса уже отказала седьмому контролу (см.
                  CompareToolbar), а «закрепить» относится к ОДНОЙ конкретной
                  колонке — у её заголовка оно и объясняет себя без подписи.
                  Показывается только когда есть что закреплять: лента шире
                  своей видимой области. Иначе кнопка обещала бы эффект,
                  которого при полностью влезающей таблице не существует. */}
              <th scope="col">
                Позиция
                {pannable ? (
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
                ) : null}
              </th>
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
                    {/* Шапка раздела — <th scope="rowgroup">: заголовок для СТРОК
                        под ним, а не ячейка со значением. Ровно это и говорил
                        комментарий здесь всегда, а стоял `colgroup` — то есть
                        «заголовок для группы КОЛОНОК», чем раздел сметы не
                        является ни в каком приближении. */}
                    <th scope="rowgroup" className={cx(tableCell.card, s.groupHead)}>
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

      {/* Замерщик имён: копии шапок вне таблицы, тем же классом имени и с
          медалью у лидера — ширина снимается ровно та, что встанет в
          колонку. Сиблинг .band: скроллблок обрезал бы измеряемый текст. */}
      <div className={s.measure} aria-hidden="true">
        {bids.map((bid) => (
          <span
            key={bid.contractor.id}
            className={s.cardName}
            ref={(el) => {
              if (el) nameNodes.current.set(bid.contractor.id, el);
              else nameNodes.current.delete(bid.contractor.id);
            }}
          >
            {bid.rank === 1 && (
              <span className={s.leader}><Icon name="skill" /></span>
            )}
            {bid.contractor.name}
          </span>
        ))}
      </div>

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
