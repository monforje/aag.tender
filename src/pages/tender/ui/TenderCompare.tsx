import {
  useCallback, useEffect, useMemo, useRef, useState,
  type CSSProperties,
} from 'react';
import { cx } from '@/shared/lib/cx';
import { Button } from '@/shared/ui/Button';
import { useCellPopup, type CellPopupData } from '@/shared/ui/CellPopup';
import { Icon } from '@/shared/ui/Icon';
import { ScreenPlaceholder } from '@/shared/ui/Page';
import { Popover } from '@/shared/ui/Popover';
import { Table, tableCell } from '@/shared/ui/Table';
import { Tooltip } from '@/shared/ui/Tooltip';
import { plural } from '@/shared/lib/plural';
import {
  analyzeComparison, cellMark, decimal, moneyCompact, filterRows, flatten, isModifiedView, isWaiting, METRIC_LABEL, metricTotals, pendingCorrection, rankBids, ROW_VIEW_LABEL, withVersion, type Bid, type CompareThresholds, type CompareView, type Comparison, type PositionGroup, type PresetId, type RowFacts,
} from '@/entities/comparison';
import {
  choose, columnMarks, positionPassport, resolveTone, type MarkKind,
} from '../model/compareFormat';
import { computeColumnLayout, titleLimit } from '../model/columns';
import { useBandMaxHeight } from '../model/useBandMaxHeight';
import { useBandWidth } from '../model/useBandWidth';
import { useCellComments } from '../model/useCellComments';
import { useTableDock } from '../model/useTableDock';
import { CompareToolbar } from './CompareToolbar';
import { CellCard } from './CellCard';
import { ColumnPainter } from './ColumnPainter';
import { CommentThread } from './CommentThread';
import { CompareRow } from './CompareRow';
import { ContractorCard } from './ContractorCard';
import { CorrectionPanel } from './CorrectionPanel';
import { CutLine, TailRow } from './CutLine';
import { DossierModal, type SupplierStats } from './DossierModal';
import { GhostColumn } from './GhostColumn';
import { TermsBand } from './TermsBand';
import { ShownRow, TotalRow } from './TotalRow';
import type { CellAction } from './BidCell';
import s from './TenderCompare.module.css';

/** Ширина на <col> инлайном; undefined — кадр до первого замера. */
const pxStyle = (w?: number): { width: string } | undefined =>
  w == null ? undefined : { width: `${w}px` };

/** Псевдо-id колонки-призрака «Пригласить» (§5.7). Она участвует в РАСЧЁТЕ
 *  ШИРИН на общих правах: без своего <col> ячейка забирала «остаток», а
 *  остатка при `width` таблицы, равной сумме колонок, нет вовсе — колонка
 *  выходила нулевой ширины и складывалась в невидимую полоску (замер
 *  25.08.2026: 0px при 212 у соседей). Приглашение — такая же колонка, просто
 *  без чисел (решение владельца 25.08.2026). */
const INVITE_COL = '__invite';

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
  tenderId, error, onRetry, sliceTime,
  onPickVersion, onInvite, onDecideCorrection,
  roundNumber,
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
  /** Номер тендера — адрес переписки, выгрузки и ссылки на срез. */
  tenderId: string;
  /** ОШИБКА РАСЧЁТА НЕ ОЧИЩАЕТ ТАБЛИЦУ (§5.9, `table.md` §6): приходит сюда
   *  причиной, а последний подтверждённый срез остаётся на экране приглушённым
   *  и прокручиваемым. Пустой экран вместо данных — худшее, что можно сделать
   *  с человеком, который уже что-то на них решил. */
  error?: string | null;
  onRetry?: () => void;
  /** Время последнего успешного среза — подпись под приглушённой таблицей. */
  sliceTime?: string;
  /** Выбор версии КП в шапке колонки (§5.5). Не задан — версий у данных нет,
   *  и триггер в карточке не рисуется. */
  onPickVersion?: (contractorId: string, versionId: string) => void;
  /** Приглашение нового участника (§5.7). Не задано — прав нет, и колонки-
   *  призрака в конце ленты тоже. */
  onInvite?: () => void;
  /** Решение по корректировке объёма (§2.7). Не задано — прав на решение
   *  нет, и панель открывается только на чтение. Возвращает запись: `false` —
   *  решение не сохранено (нечего решать или запрос не дошёл), панель в этом
   *  случае остаётся открытой. */
  onDecideCorrection?: (
    contractorId: string, positionId: string,
    decision: 'accepted' | 'declined', note?: string,
  ) => Promise<boolean> | boolean;
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
  /* ВЫБРАННАЯ ВЕРСИЯ КП ПОДМЕНЯЕТ РАСЦЕНКИ ОДИН РАЗ — НА ВХОДЕ В РАСЧЁТ (§5.5).
     Сделай это позже, у каждого читателя, — и половина экрана считала бы по
     старшей версии, а половина по выбранной. Снимок при этом остаётся честным
     архивом всех версий: подменяется вид, а не данные. */
  const snapshot = useMemo(() => contractors.map(withVersion), [contractors]);

  /* ★ МЕНЯЕТ И ИЗБРАННОСТЬ, И ПОРЯДОК КОЛОНОК (§5.4, `contractor.md` §2, §5):
     это ЕДИНСТВЕННЫЙ механизм приоритизации колонок — без него важный
     подрядчик может стоять последним на панораме из двенадцати. Между собой
     избранные держат свой ранжир: звезда поднимает группу, а не
     перетасовывает её. Сортировка стабильна (`Array.prototype.sort` в ES2019
     и новее), поэтому равные по звезде сохраняют порядок ранжира. */
  const bids = useMemo(() => {
    const ranked = rankBids(snapshot, positions);
    const star = (id: string) => (starred.includes(id) ? 0 : 1);
    return [...ranked].sort((a, b) => star(a.contractor.id) - star(b.contractor.id));
  }, [snapshot, positions, starred]);

  const facts = useMemo(
    () => analyzeComparison(groups, snapshot, thresholds),
    [groups, snapshot, thresholds],
  );
  const totals = useMemo(() => metricTotals(facts.rows, bids), [facts, bids]);
  /* Сводка пометок по колонкам — содержимое язычков карточек. Один проход по
     всем строкам на каждую колонку, поэтому мемоизировано ПО ДАННЫМ: поводов
     перерисоваться у шапки полно (звезда, перекраска, ширина ленты), и ни
     один из них этих чисел не меняет. */
  const marksOf = useMemo(
    () => new Map(snapshot.map((c) => [c.id, columnMarks(facts.rows, c)])),
    [facts, snapshot],
  );

  /* Имя подрядчика по id — стабильный колбэк: уходит в КАЖДУЮ строку (края
     диапазона поимённо, разбор потенциала), и массив вместо него отменял бы
     memo при любой перекраске колонки. */
  const nameOf = useCallback(
    (id: string) => contractors.find((c) => c.id === id)?.name ?? id,
    [contractors],
  );

  /* Видимый срез считается ЗДЕСЬ, до всего остального: его читают и рендер, и
     переход к пометке (тот обязан отличить «скрыта фильтром» от «свёрнута
     секция», а для этого — знать состав видимого раньше, чем строится
     разметка). */
  const visible = useMemo(() => filterRows(facts.rows, view.filters), [facts, view.filters]);
  const visibleIds = useMemo(() => new Set(visible.map((r) => r.position.id)), [visible]);

  const modified = isModifiedView(view);

  /* Свёрнутость карточек ОДНА на все: колонки сравнивают, а не разглядывают
      по одной. Разделы сворачиваются ПООДИНОЧКЕ. Цвет колонки — CSS-строка,
      отсутствие ключа значит «по ранжиру». */
  const [collapsed, setCollapsed] = useState(false);
  /* РАСКРЫТЫЕ ЧИСЛА КАРТОЧЕК — ТОЖЕ ОДНО СОСТОЯНИЕ НА ВСЕ КОЛОНКИ (решение
     владельца 25.08.2026). Раскрытость жила у каждой карточки собственным
     <details>, и это была ошибка того же рода, что и раздельная свёрнутость:
     блок отвечает «мин. цен N из M», то есть число, которое ЧИТАЮТ РЯДОМ с
     соседним, — а раскрытое поодиночке оно сравнивается с пустотой. Заодно
     ушла разъезжающаяся высота: раскрывается вся шапка целиком. */
  const [factsOpen, setFactsOpen] = useState(false);
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
  /* РАЗВЁРНУТЫЕ НАЗВАНИЯ — тумблер того же рода и там же (решение владельца
     24.08.2026, третья волна): читается это состояние, а не считается, и
     переживать смену пресета оно обязано ровно так же. */
  const [wideTitle, setWideTitle] = useState(false);
  /* СТРОКИ «ПОКАЗАНО» (§1.1) — тумблер того же рода и там же (решение
      владельца 25.08.2026): под фильтром строки появляются сами, а гасить их
      можно из окна параметров. Ось вида им не место по общим причинам
      семейства: чип «Изменён» на сводку среза подниматься не должен, пресеты
      строки не трогают — это эргономика чтения, а не нарезка данных.
      ДЕФОЛТ ВКЛЮЧЁН: строки — часть канона фильтра («сколько стоят именно
      эти позиции» рядом с полным итогом), выключатель существует для тех,
      кому хватает счётчика скрытых над лентой. */
  const [shownRows, setShownRows] = useState(true);
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const [tint, setTint] = useState<Record<string, string>>({});
  const [dossier, setDossier] = useState<Bid | null>(null);
  /* ХВОСТ ЗА ЛИНИЕЙ ОТСЕЧКИ (§1.3) — эргономика чтения, там же, где `folded`
     и `collapsed`: переживает смену пресета, не переживает уход со страницы. */
  const [tailOpen, setTailOpen] = useState(false);
  /* Панели ячейки: карточка (§2.1), тред (§2.4), решение (§2.7). Каждая
     помнит СВОЙ адрес и свой якорь — панели не мешают друг другу и не
     закрываются взаимно. */
  const [cell, setCell] = useState<
    { action: CellAction; contractorId: string; positionId: string; at: DOMRect } | null
  >(null);
  const [deciding, setDeciding] = useState(false);
  /* «Цель скрыта фильтром» (§4.5) — источник обязан сказать это словами и
     дать выход; молчаливый промах читается поломкой. */
  const [filterMiss, setFilterMiss] = useState<string | null>(null);
  /* Список корректировок колонки (§5.3): один — сразу переход, несколько —
     мини-список. Держит и КП, и якорь: панель падает от нажатого чипа. */
  const [corrList, setCorrList] = useState<{ bid: Bid; at: DOMRect } | null>(null);
  /* Палитра — вторая панель: состояние хранит КП вместе с прямоугольником
     нажатой кнопки. Механика обеих панелей — в <DossierModal> и <ColumnPainter>. */
  const [paint, setPaint] = useState<{ bid: Bid; at: DOMRect } | null>(null);

  /* ── ПЕРЕХОД К ПОМЕТКЕ КОЛОНКИ (разбор 23.08.2026 §7; подсветка ВСЕХ ячеек
     пометки — решение владельца 25.08.2026) ─────────────────────────────────
     Клик по строке перечня в уголке колонки — НАВИГАЦИЯ, а не раскрытие:
     ни списка, ни поповера, экран подсвечивает ОБВОДКОЙ все ячейки колонки
     с этой пометкой и прокручивает к первой из них. Одна обводка вместо
     одной ячейки: смысл клика «покажи, ГДЕ они», и семь рамок на семь ячеек
     отвечают на него за один взгляд, без обхода. Повторный клик ведёт к
     следующей подсвеченной по кругу — длинный столбец всё равно читают
     по частям, и обход остаётся одной точкой.

     РАБОТАЕТ ЭТО ДЛЯ ВСЕХ ПЯТИ ПОМЕТОК, а не для одних корректировок
     (24.08.2026, решение владельца). Механика у обхода была ровно одна и
     раньше — упиралась она только в разметку: цели помечались `data-corr`,
     то есть в DOM существовал ОДИН вид пометки из пяти. Теперь <BidCell>
     ставит `data-cell` и `data-marks`, и обход отличается только именем
     пометки в селекторе.

     ОЧЕРЁДНОСТЬ БЕРЁТСЯ ИЗ DOM, а не из данных, и это единственный честный
     источник: «первая» означает «первая в ТЕКУЩЕМ порядке строк» — том, что
     человек видит сейчас, — а его задают вид строк, свёрнутые разделы и
     фильтры сразу. Модель этого порядка не знает вовсе, зато DOM ЕСТЬ этот
     порядок: сверху вниз для колонки. */
  const [markFlash, setMarkFlash] = useState<ReadonlySet<string> | null>(null);
  /* Курсор обхода — реф, а не состояние: он двигает прокрутку, но не разметку,
     и лишний проход по всем мемоизированным строкам ему не нужен. */
  const markCursor = useRef<string | null>(null);
  const markTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(markTimer.current), []);

  /* ── ПОВТОР ЗАХОДА ПОСЛЕ РАСКРЫТИЯ СЕКЦИИ ────────────────────────────────
     Цель в свёрнутой секции не существует в DOM вовсе, поэтому переход идёт
     в два шага: раскрыть — и зайти снова. Второй шаг обязан случиться ПОСЛЕ
     того, как строки реально отрисованы.

     ЭФФЕКТ, А НЕ requestAnimationFrame. Двойной rAF выглядел достаточным и
     не работал: коммит 780 ячеек (65 строк × 12 колонок) не укладывается в
     два кадра, повтор находил ту же пустоту, и симптом получался ровно тот,
     ради устранения которого раскрытие и заведено, — секция раскрылась,
     обводка не пришла. Эффект по `folded` привязан к КОММИТУ, а не к
     времени, и потому не зависит ни от размера сметы, ни от нагрузки. */
  const pendingJump = useRef<(() => void) | null>(null);
  useEffect(() => {
    const job = pendingJump.current;
    if (!job) return;
    pendingJump.current = null;
    job();
  }, [folded]);

  const goToMark = useCallback((kind: MarkKind, contractorId: string) => {
    const root = dockRef.current;
    if (!root) return;
    const cells = [...root.querySelectorAll<HTMLElement>(`[data-marks~="${kind}"]`)]
      .filter((el) => (el.dataset.cell ?? '').startsWith(`${contractorId}:`));
    /* ── КОНТРАКТ ПЕРЕХОДА, ДВЕ НЕДОСТАЮЩИЕ ПОЛОВИНЫ (§4.5,
       `interactions.md` §3) ────────────────────────────────────────────────
       Прокрутка и обводка работали и раньше; молча промахивался переход в
       двух случаях, и оба читались как поломка — «кликнул, ничего не
       произошло».

       ПЕРВЫЙ: цель в СВЁРНУТОЙ секции. Её строки не существуют в DOM вовсе,
       и querySelector честно не находил ничего. Секция раскрывается ДО
       прокрутки — иначе scrollIntoView целится в элемент, которого ещё нет.
       Прокрутка при этом уходит в следующий кадр: раскрытие меняет высоту
       ленты, и мерить её в том же кадре бессмысленно.

       ВТОРОЙ: цель СКРЫТА ФИЛЬТРОМ. Здесь молчать нельзя тем более —
       пользователь сам поставил фильтр и мог про него забыть. Источник
       говорит словами и даёт выход «Показать все». */
    if (!cells.length) {
      const target = facts.rows.find((r) => hasMark(kind, r, contractorId));
      if (!target) return;
      const hiddenByFilter = !visibleIds.has(target.position.id);
      if (hiddenByFilter) {
        setFilterMiss(target.position.title);
        return;
      }
      /* Не фильтр — значит свёрнутая секция: раскрываем и повторяем заход. */
      const group = groups.find((g) => g.positions.some((x) => x.id === target.position.id));
      if (!group || !folded[group.id]) return;
      setFolded((all) => ({ ...all, [group.id]: false }));
      pendingJump.current = () => goToMarkRef.current?.(kind, contractorId);
      return;
    }
    setFilterMiss(null);
    const keys = cells.map((el) => el.dataset.cell ?? '');
    /* Подсветка — ВСЕ такие ячейки колонки сразу, тем же каналом, что и любой
       другой переход (обводка `flashCells`). */
    setMarkFlash(new Set(keys));
    /* Прокрутка — от текущего курсора к следующей по кругу; впервые — к
       первой. Тупика не возникает: пустая пометка в перечень не попадает,
       а решённая корректировка гаснет и там. */
    const at = keys.indexOf(markCursor.current ?? '');
    const idx = at < 0 ? 0 : (at + 1) % keys.length;
    cells[idx].scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    markCursor.current = keys[idx];
    window.clearTimeout(markTimer.current);
    markTimer.current = window.setTimeout(() => {
      setMarkFlash(null);
      markCursor.current = null;
    }, 5300);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dockRef объявлен ниже, реф стабилен
  }, [facts, groups, folded, visibleIds]);

  /* Повторный заход после раскрытия секции — через реф: колбэк вызывает сам
     себя из rAF, а сослаться на себя по имени в собственном теле замыкания
     нельзя, не поймав вчерашнюю версию. */
  const goToMarkRef = useRef<typeof goToMark>(goToMark);
  goToMarkRef.current = goToMark;

  /* Переход к ОДНОЙ названной ячейке — из мини-списка корректировок (§5.3).
     Контракт тот же, что у обхода пометок: раскрыть секцию, прокрутить,
     обвести; скрытая фильтром цель не молчит. Отдельная функция, а не флаг
     у goToMark: там адрес — «пометка в колонке», здесь — конкретная пара. */
  const goToPosition = useCallback((contractorId: string, positionId: string) => {
    const key = `${contractorId}:${positionId}`;
    const root = dockRef.current;
    const el = root?.querySelector<HTMLElement>(`[data-cell="${key}"]`);
    if (!el) {
      if (!visibleIds.has(positionId)) {
        setFilterMiss(facts.byId.get(positionId)?.position.title ?? positionId);
        return;
      }
      const group = groups.find((g) => g.positions.some((x) => x.id === positionId));
      if (!group || !folded[group.id]) return;
      setFolded((all) => ({ ...all, [group.id]: false }));
      pendingJump.current = () => goToPositionRef.current?.(contractorId, positionId);
      return;
    }
    setFilterMiss(null);
    setMarkFlash(new Set([key]));
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    window.clearTimeout(markTimer.current);
    markTimer.current = window.setTimeout(() => setMarkFlash(null), 5300);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dockRef объявлен ниже, реф стабилен
  }, [facts, groups, folded, visibleIds]);
  const goToPositionRef = useRef<typeof goToPosition>(goToPosition);
  goToPositionRef.current = goToPosition;

  /* Подсветка перехода к пометке живёт в ТОМ ЖЕ множестве, что и обводка
     «анализ → таблица»: два канала для одного «смотри сюда» дали бы две
     разные рамки на соседних ячейках. */
  const flashAll = useMemo(() => {
    if (!markFlash?.size) return flashCells;
    const all = new Set(flashCells ?? []);
    for (const key of markFlash) all.add(key);
    return all;
  }, [flashCells, markFlash]);

  const paintValue = (bid: Bid) => tint[bid.contractor.id] ?? resolveTone(bid.tone);
  const colorOf = (bid: Bid) => choose(tint, bid, rankTint);

  /* Один попап на таблицу обслуживает все пометки. При смене нарезки строки
     пересобираются — держать подсказку не за что. Зависимости — сами оси:
     объект хука пересоздаётся каждым рендером, и эффект по нему гасил бы
     попап на любом постороннем движении (звезда, перекраска колонки). */
  const popup = useCellPopup();
  useEffect(() => { popup.close(true); },
    [view.mainMetric, view.showDeviation, view.showRate, view.rowView, view.filters]);

  /* ПЕРЕПИСКА ПО ЯЧЕЙКАМ живёт у таблицы, а не у страницы: тред рисует она,
     отправляет она, а страница панели не видит вовсе (разбор — в JSDoc хука). */
  const comments = useCellComments(tenderId);

  /* ОДИН КОЛБЭК НА ТРИ ДЕЙСТВИЯ ЯЧЕЙКИ. Стабилен без зависимостей: внутри
     только setState — а значит memo пятисот <CompareRow> его переживает.
     Прямоугольник снимается ЗДЕСЬ, в момент клика: панель падает от живой
     цели, а не от координат, посчитанных когда-то раньше. */
  const onCellAction = useCallback((
    action: CellAction, contractorId: string, positionId: string, at: HTMLElement,
  ) => {
    setCell({ action, contractorId, positionId, at: at.getBoundingClientRect() });
    /* Открытая панель и висящая подсказка — два объяснения одной ячейки
       разом; подсказка уступает. */
    popup.close(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- popup пересоздаётся каждый рендер, close читает рефы
  }, []);

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
  const layoutBids = useMemo(
    () => (onInvite ? [...contractors, { id: INVITE_COL }] : contractors),
    [contractors, onInvite],
  );
  const layout = useMemo(
    () => (bandWidth == null
      ? null
      : computeColumnLayout({
        available: bandWidth, bids: layoutBids, wideTitle, potential: view.showPotential,
      })),
    [bandWidth, layoutBids, wideTitle, view.showPotential],
  );
  /* Левый блок целиком — «Позиция» + «Количество» + «Единица» + «Разброс».
      Нужен только сумме ширины таблицы: шапка секции берёт то же число из
      colSpan своей ячейки, без чисел в разметке. */
  const leadWidth = layout == null ? null
    : layout.num + layout.title + layout.qty + layout.unit + layout.spread
      + (layout.potential ?? 0);
  /* Ширина таблицы = сумма колонок ровно до пикселя: с ней исполняются
      ширины <col> при layout="fixed" (max-content их теряет). Инлайном на
      самой таблице — смена ширины валидирует её РАСКЛАДКУ, но не стиль
      всех ячеек, каких дала бы наследуемая переменная на обёртке. */
  const tableWidth = useMemo(() => (leadWidth == null || layout == null ? undefined
    : leadWidth + Object.values(layout.bids).reduce((acc, w) => acc + w, 0)),
  [layout, leadWidth]);
  /* Закреплять имеет смысл ТОЛЬКО в панораме: в двух других режимах columns.ts
     раскладывает колонки ровно в ширину ленты, горизонтального хода нет вовсе,
     и закреплённая колонка ничем не отличалась бы от обычной. `pan` — это и
     есть «сумма полов больше доступного места», единственный режим с
     прокруткой. */
  /* ПОТОЛОК НАЗВАНИЯ В ЗНАКАХ. Целое число, и это условие работы memo у
     <CompareRow>: ширина ленты дрожит каждый кадр анимации панели и ухода
     сайдбара, а лимит меняется раз в несколько десятков пикселей. */
  const limit = titleLimit(layout?.title, wideTitle ? 2 : 1);

  /* ЧИСЛО КОЛОНОК СЧИТАЕТСЯ ОДИН РАЗ И ЧИТАЕТСЯ ВЕЗДЕ. Раньше по разметке
     были рассыпаны литералы 4 и 3 — colSpan шапки секции, добор пустых
     ячеек в итоге, ширина пустого результата. С условным столбцом
     «Потенциал» и колонкой-призраком любое забытое число уводит всю строку
     на клетку вбок, причём МОЛЧА: таблица остаётся валидной, просто кривой. */
  const leadCols = 5 + (view.showPotential ? 1 : 0);
  const tailCols = bids.length + (onInvite ? 1 : 0);
  const allCols = leadCols + tailCols;

  /* Строки, прошедшие ВСЕ предикаты; секции собирают свои из них же.
     Для ПОДЫТОГОВ узла нужен полный набор его позиций: фильтр прячет строки,
     но суммы не двигает. */
  const byIdOf = (p: { id: string }): RowFacts | undefined => facts.byId.get(p.id);
  const rowsOfGroup = (group: PositionGroup): RowFacts[] =>
    group.positions.map(byIdOf).filter((r): r is RowFacts => !!r && visibleIds.has(r.position.id));
  const allRowsOfGroup = (group: PositionGroup): RowFacts[] =>
    group.positions.map(byIdOf).filter((r): r is RowFacts => !!r);

  /* ── ВКЛАД ПОЗИЦИИ (§4.2) ────────────────────────────────────────────────
     Номер строки, её место по весу и топ-3 среза — три величины, которые
     читает КАЖДАЯ строка и не может посчитать сама: они про весь набор.
     Мемоизированы по данным и уходят вниз стабильными ссылками, иначе memo
     строки не переживёт ни одного движения родителя.

     НОМЕР — В ПОРЯДКЕ СМЕТЫ, а не текущей сортировки: «строка 47» обязана
     означать одно и то же в любом виде, иначе ссылаться на неё словами
     нельзя. МЕСТО — по весу, потому что вопрос у полосы именно про вес. */
  const numberOf = useMemo(
    () => new Map(facts.rows.map((r, i) => [r.position.id, i + 1])),
    [facts],
  );
  const placeOf = useMemo(() => {
    const sorted = [...facts.rows].sort((a, b) => b.weight - a.weight);
    return new Map(sorted.map((r, i) => [r.position.id, i + 1]));
  }, [facts]);
  const topRows = useMemo(() => [...facts.rows]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((r) => ({
      title: r.position.title,
      share: facts.sumWeight ? (r.weight / facts.sumWeight) * 100 : 0,
      weight: r.weight,
    })), [facts]);

  /* ── ПАСПОРТ ПОЗИЦИИ (§4.1) ──────────────────────────────────────────────
     Сборка живёт в `model/compareFormat.ts` рядом со сводкой ячейки и сводками
     знаков: это ДАННЫЕ, а не разметка, и именно её первой заменит настоящий
     ответ сервера. Здесь остаётся только стабильный колбэк — он уходит пропом
     в каждую из пятисот мемоизированных строк. */
  const passportFor = useCallback((positionId: string): CellPopupData => {
    const row = facts.byId.get(positionId);
    /* Строки нет — паспорту нечего описывать. Пустая панель честнее выдуманной:
       такое бывает ровно между сменой данных и перерисовкой. */
    if (!row) return { title: 'Позиция', fields: [] };
    return positionPassport({ row, groups, bids });
  }, [facts, groups, bids]);

  /* ── СОДЕРЖИМОЕ ПАНЕЛЕЙ ЯЧЕЙКИ ─────────────────────────────────────────
     Собирается ДО раннего возврата (пустой ответ ниже), потому что после
     него собирать было бы негде, а до хуков — нельзя. Каждая панель падает
     от своего якоря и закрывается одинаково: `setCell(null)`. */
  const openRow = cell ? facts.byId.get(cell.positionId) : undefined;
  const openContractor = cell
    ? snapshot.find((c) => c.id === cell.contractorId)
    : undefined;
  const openCorrection = openRow && openContractor
    ? pendingCorrection(cellMark(openContractor, cell!.positionId))
    : undefined;

  const closeCell = () => setCell(null);

  /* ПЕРСОНАЛЬНЫЙ СРЕЗ КОЛОНКИ (§5.2). Считается ПО ТРЕБОВАНИЮ — только когда
     досье открыто: пять списков на каждого из двенадцати подрядчиков на
     каждом рендере стоили бы дороже всего остального экрана, а смотрят их
     по одному и редко. */
  const statsOf = (contractorId: string): SupplierStats => {
    const c = snapshot.find((x) => x.id === contractorId);
    const pick = (test: (r: RowFacts) => boolean, hint?: (r: RowFacts) => string) =>
      facts.rows.filter((r) => !r.position.removed && test(r)).map((r) => ({
        positionId: r.position.id,
        title: r.position.title,
        ...(hint ? { hint: hint(r) } : {}),
      }));
    const potRows = facts.rows.filter((r) => !r.position.removed
      && r.pots.some((p) => p.contractorId === contractorId));
    const potSum = potRows.reduce(
      (acc, r) => acc + (r.pots.find((p) => p.contractorId === contractorId)?.value ?? 0), 0,
    );
    return {
      groups: [
        {
          id: 'anomaly',
          label: 'Аномальные цены',
          items: pick((r) => r.bids.some((b) => b.contractorId === contractorId && b.anomaly)),
        },
        {
          id: 'min',
          label: 'Минимальные цены',
          items: pick((r) => r.bestIds.includes(contractorId)),
        },
        {
          id: 'correction',
          label: 'Корректировки на рассмотрении',
          items: pick((r) => r.corrections.includes(contractorId), () => 'иной объём'),
        },
        {
          id: 'pot',
          label: 'Общий потенциал',
          display: potSum ? `+${moneyCompact(potSum)}` : '—',
          items: potRows.map((r) => ({
            positionId: r.position.id,
            title: r.position.title,
            hint: `+${moneyCompact(r.pots.find((p) => p.contractorId === contractorId)!.value)}`,
          })),
        },
        {
          id: 'missing',
          label: 'Позиции без цены',
          items: c ? pick((r) => c.prices[r.position.id] === undefined
            && cellMark(c, r.position.id).declined !== true
            && !isWaiting(c, r.position.id)) : [],
        },
        {
          id: 'declined',
          label: 'Отказы',
          items: c ? pick((r) => cellMark(c, r.position.id).declined === true) : [],
        },
      ],
    };
  };

  const cellPanels = !cell || !openRow || !openContractor ? null : (
    <>
      {cell.action === 'card' ? (
        <CellCard
          at={cell.at}
          row={openRow}
          contractor={openContractor}
          contractors={snapshot}
          roundNumber={roundNumber ?? 1}
          /* Прошлая расценка ЕГО ЖЕ КП — она уже приходит в контракте
             подрядчика (`prevPrices`), и заводить ради неё проп значило бы
             провезти через страницу то, что и так лежит в данных. */
          prevPrice={openContractor.prevPrices?.[cell.positionId]}
          onClose={closeCell}
          onOpenSupplier={() => {
            const bid = bids.find((b) => b.contractor.id === cell.contractorId);
            closeCell();
            if (bid) setDossier(bid);
          }}
        />
      ) : null}

      {cell.action === 'thread' ? (
        /* Промис отправки отдаётся треду ЦЕЛИКОМ: он держит композер
           занятым и возвращает черновик, если запись не уехала. Сбои наружу
           не выходят — их погашает сам хук. */
        <CommentThread
          at={cell.at}
          title={openRow.position.title}
          subtitle={openContractor.name}
          comments={comments.threadOf(cell.contractorId, cell.positionId)}
          author={comments.author}
          onClose={closeCell}
          onSend={(text, parentId) =>
            comments.send(cell.contractorId, cell.positionId, text, parentId)}
          onSeen={(ids) => void comments.markSeen(cell.contractorId, cell.positionId, ids)}
        />
      ) : null}

      {cell.action === 'correction' && openCorrection ? (
        <CorrectionPanel
          at={cell.at}
          position={openRow.position}
          contractor={openContractor}
          correction={openCorrection}
          busy={deciding}
          /* «Ещё N участникам» — те, кто ДЕЙСТВИТЕЛЬНО назвал цену по этой
             строке, кроме самого автора корректировки: переспрашивать того,
             кто позицию пропустил или от неё отказался, не о чем. */
          others={openRow.bids.filter((b) => b.contractorId !== cell.contractorId).length}
          onDecide={async (decision, note) => {
            if (!onDecideCorrection) return;
            setDeciding(true);
            /* Панель закрывается ТОЛЬКО записанным решением: `false` (нечего
               решать или сеть не ответила) оставляет её открытой — busy снят,
               кнопки живы, решение можно повторить. Броска здесь не бывает:
               мутация сбои не пробрасывает. */
            const ok = await onDecideCorrection(cell.contractorId, cell.positionId, decision, note);
            setDeciding(false);
            if (ok) closeCell();
          }}
          onClose={closeCell}
        />
      ) : null}
    </>
  );

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
          wideTitle={wideTitle}
          onWideTitle={setWideTitle}
          shownRows={shownRows}
          onShownRows={setShownRows}
          analysisApplied={analysisApplied}
          onRestoreView={onRestoreView}
          onPreset={onPreset}
          onPatch={onPatch}
          visible={visible.length}
          total={facts.rows.length}
          hasPrevRound={snapshot.some((c) => c.prevPrices !== undefined)}
        />
      </div>

      {/* ── ОШИБКА РАСЧЁТА НАД ЛЕНТОЙ (§5.9, `table.md` §6) ─────────────────
          Причина и повтор — полосой, а НЕ вместо таблицы: последний
          подтверждённый срез остаётся на экране, приглушённый и
          прокручиваемый. Человек, который уже что-то на этих числах решил,
          не должен получить пустой экран вместо них.
          ТЕКСТ КРАСНЫЙ, а не бордовый (правка владельца 25.08.2026): наш
          danger — розово-малиновый, он значит «худшее место в ранжире», то
          есть оценку, и на слове «не удался» читается оттенком бренда, а не
          сбоем. Иконка по центру высоты строки — flex, без margin-top. */}
      {error ? (
        <div className={s.errStrip} role="alert">
          <Icon name="dangerTriangle" className={s.errIcon} />
          <span>{error}</span>
          {onRetry ? (
            <Button variant="secondary" className={s.errRetry} onClick={onRetry}>
              Повторить
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* ЦЕЛЬ ПЕРЕХОДА СКРЫТА ФИЛЬТРОМ (§4.5): источник говорит словами и
          даёт выход. Молчаливый промах читается поломкой. */}
      {filterMiss ? (
        <div className={s.missStrip} role="status">
          <Icon name="questionCircle" className={s.errIcon} />
          <span>Позиция «{filterMiss}» скрыта активным фильтром</span>
          <Button
            variant="secondary"
            className={s.errRetry}
            onClick={() => { onPatch({ filters: [] }); setFilterMiss(null); }}
          >
            Показать все
          </Button>
        </div>
      ) : null}

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
        {/* Развёрнутые названия — модификатор ОБЁРТКИ, а не проп каждой
            строки: перенос включается одной CSS-переменной, наследуемой вниз,
            и memo пятисот <CompareRow> от этого не ломается — им меняется
            только целое число лимита. */}
        {/* --sticky-col-1 — МОСТ ЧЕРЕЗ ГРАНИЦУ МОДУЛЯ: <Table> закрепляет пару
            «№ + Позиция», а ширину первой колонки знает только расчётчик
            (model/columns.ts). Переменная наследуется по DOM и хэшированию не
            подлежит; селектором сюда не дотянуться — классы обоих модулей
            хэшируются порознь. */}
        <div
          className={cx(s.density, wideTitle && s.densityWide, error && s.stale)}
          style={{ '--sticky-col-1': `${layout?.num ?? 0}px` } as CSSProperties}
        >
        <Table
          stickyHead
          stickyCol={pinned ? 2 : undefined}
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
            {/* ЛИНЕЙКА У «№» ЕСТЬ (правка владельца 25.08.2026, §10). Сутки
                её здесь не было по доводу «номер и название — один блок»,
                и довод оказался неверным на практике: без границы номер
                читался ПРЕФИКСОМ названия, то есть частью текста строки, а
                не отдельной величиной со своим заголовком. Закреплению пары
                линейка не мешает — `stickyCol={2}` возит обе ячейки вместе,
                а граница между ними такая же, как между всеми колонками
                левого блока. */}
            <col className={s.colRule} style={pxStyle(layout?.num)} />
            <col className={s.colRule} style={pxStyle(layout?.title)} />
            <col className={s.colRule} style={pxStyle(layout?.qty)} />
            <col className={s.colRule} style={pxStyle(layout?.unit)} />
            <col className={s.colRule} style={pxStyle(layout?.spread)} />
            {/* УСЛОВНЫЙ СТОЛБЕЦ «ПОТЕНЦИАЛ» (§1.6) — пятым, сразу за
                «Разбросом»: обе колонки описывают СТРОКУ, а не предложение, и
                разрывать их колонкой КП нельзя. Ширина приходит из того же
                расчёта, что и у соседей. */}
            {view.showPotential
              ? <col className={s.colRule} style={pxStyle(layout?.potential)} />
              : null}
            {bids.map((bid, i) => {
              const col = colorOf(bid);
              return (
                <col
                  key={bid.contractor.id}
                  className={cx(
                    col && s.colTint,
                    (onInvite || i < bids.length - 1) && s.colRule,
                  )}
                  style={{
                    ...pxStyle(layout?.bids[bid.contractor.id]),
                    ...(col ? { '--col': col } : {}),
                  } as CSSProperties}
                />
              );
            })}
            {/* Колонка-призрак — со СВОЕЙ шириной, наравне с колонками КП
                (§5.7): «пригласить» это такое же место в ленте, просто пока
                без чисел. */}
            {onInvite ? <col style={pxStyle(layout?.bids[INVITE_COL])} /> : null}
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
              {/* §7 (правка владельца 25.08.2026, вечер): номер позиции —
                  СВОЯ КОЛОНКА, а не строка в углу якоря. Углом он поднимал
                  каждую строку таблицы на 13px и ни с чем не выравнивался;
                  колонкой он стоит по центру своей строки, как объём и
                  единица, а левые края названий совпадают по построению — их
                  задаёт край колонки, а не длина числа. */}
              <th scope="col" className={cx(s.numHead, s.headRule)}>№</th>
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
              <th
                scope="col"
                className={cx(tableCell.numeric, s.headRule, !view.showPotential && s.headShade)}
              >Разброс</th>
              {/* ПОЯВЛЕНИЕ КОЛОНКИ ПОДЧЁРКНУТО (§1.6): шапка вспыхивает
                  инфо-тоном, ячейки въезжают слева каскадом. Снятие галочки
                  мгновенное — вход подтверждаем, обратный ход ничего не
                  добавляет (каталог состояний). Стрелка ↓ стоит при активной
                  сортировке по этому столбцу. */}
              {view.showPotential ? (
                <th
                  scope="col"
                  className={cx(tableCell.numeric, s.headRule, s.thNew, s.headShade)}
                >
                  Потенциал
                  {view.rowView === 'potential' ? (
                    <span className={s.sortArrow} aria-hidden="true">↓</span>
                  ) : null}
                </th>
              ) : null}
            {bids.map((bid, i) => (
              <th
                scope="col"
                key={bid.contractor.id}
                className={cx(
                  tableCell.card,
                  i < bids.length - 1 && s.headRule,
                  (onInvite || i < bids.length - 1) && s.headShade,
                  flashCols?.has(bid.contractor.id) && s.colFlash,
                )}
              >
                <ContractorCard
                  bid={bid}
                  total={positions.length}
                  col={colorOf(bid)}
                  starred={starred.includes(bid.contractor.id)}
                  marks={marksOf.get(bid.contractor.id)!}
                  onStar={() => onToggleStar(bid.contractor.id)}
                  onPaint={(at) => setPaint({ bid, at })}
                  onOpen={() => setDossier(bid)}
                  onGoToMark={(kind) => goToMark(kind, bid.contractor.id)}
                  collapsed={collapsed}
                  onFold={() => setCollapsed((on) => !on)}
                  factsOpen={factsOpen}
                  onFacts={() => setFactsOpen((on) => !on)}
                  onPickVersion={(versionId) => onPickVersion?.(bid.contractor.id, versionId)}
                  onGoToCorrections={(at) => setCorrList({ bid, at })}
                />
              </th>
            ))}
            {/* КОЛОНКА-ДЕЙСТВИЕ В КОНЦЕ ЛЕНТЫ (§5.7): вход в приглашение не
                дальше правого торца данных. Своей ширины у неё нет — <col>
                для неё не заводится, ячейка берёт остаток. */}
            {onInvite ? (
              <th className={cx(tableCell.card, s.ghostHead)}>
                <GhostColumn onInvite={onInvite} collapsed={collapsed} />
              </th>
            ) : null}
            </tr>
          </thead>

          {visible.length === 0 ? (
            /* Пустой результат обязан быть выходом, а не тупиком. */
            <tbody>
              <tr>
                <td colSpan={allCols} className={tableCell.empty}>
                  Ни одна позиция не проходит фильтры
                  <Button variant="secondary" onClick={() => onPatch({ filters: [] })}>
                    Сбросить фильтры
                  </Button>
                </td>
              </tr>
            </tbody>
          ) : view.rowView === 'sections' ? (
             /* По секциям: заголовок, видимые строки, «Показано» и подытог.
                УЗЕЛ НЕ ИСЧЕЗАЕТ, ДАЖЕ ЕСЛИ ФИЛЬТР СКРЫЛ ВСЁ ЕГО СОДЕРЖИМОЕ
                (§1.2, `rows.md` §3). Прежний ранний `return null` был прямым
                противоречием канону, а не недоделкой: специалист переставал
                понимать, весь ли состав ФКП он видит, а свёрнутый им раньше
                раздел молча пропадал и так же молча возвращался. Теперь
                остаётся и заголовок, и полный подытог, а «Показано: 0
                позиций» с прочерком говорит, почему строк нет. */
             groups.map((group) => {
               const rows = rowsOfGroup(group);
               /* Полный состав узла — независимо от фильтров: он нужен и
                  подытогу ниже, и счёту в шапке секции. */
               const allRows = allRowsOfGroup(group);
               const count = allRows.length;
               const open = !folded[group.id];
               return (
                 <tbody key={group.id}>
                   {/* Шапка секции — РЯД ОТДЕЛЬНЫХ ЯЧЕЕК, а не одна на всю
                       таблицу: заголовок занимает колонку «Позиция» и только её,
                       счёт позиций стоит в своих колонках «Объём» и «Ед.»,
                       хвост за «Разбросом» несёт одну заливку ряда.
                       НЕПРЕРЫВНОСТЬ ПОЛОСЫ от разделения ячеек не страдает:
                       заливку даёт правило .group-row на КАЖДУЮ ячейку ряда.
                       tableCell.fullRow здесь НЕ СТАВИТСЯ намеренно: он гасит
                       липкость колонки-якоря, а ячейка секции вторая в своём
                       ряду — и обязана слушаться булавки ровно как якорь.
                       Своего механизма у заголовка нет (разбор —
                       .section-toggle в модуле стилей).
                       СЧЁТ — ПОЛНЫЙ СОСТАВ УЗЛА, фильтром не пересчитывается:
                       так же считает подытог («фильтр прячет строки, но суммы
                       не двигает»), а видимое срезом называет строка
                       «Показано». scope="rowgroup": заголовок для СТРОК под ним. */}
                   <tr className={s.groupRow}>
                     {/* Пустая ячейка под «№» — ОБЯЗАТЕЛЬНА, а не «для
                         красоты»: при закреплённой паре липнут первая и
                         ВТОРАЯ ячейки строки, и заголовок раздела обязан
                         оказаться именно вторым. Слей его с номером одним
                         colSpan — у кромки застыл бы хвост ряда. */}
                     <td className={s.groupNum} />
                      <th
                        scope="rowgroup"
                        className={cx(tableCell.card, s.groupHead)}
                      >
                         {/* Кнопка занимает свою ячейку целиком — ячейку
                             колонки «Позиция». Название прижато влево, на общую
                             линию с названиями позиций под ним; длиннее своего
                             места режется многоточием, полное всплывает
                             <Tooltip>'ом.
                             СТРЕЛКА — У ПРАВОГО КРАЯ КОЛОНКИ «ПОЗИЦИЯ»: --fold-at
                             несёт ширину якоря из model/columns.ts — то же
                             число, что стоит на <col>, и глиф встаёт на границу
                             «Позиция | Объём» при любой плотности. Зона клика от
                             этого не меняется — вся кнопка. До первого замера
                             кадр живёт без переменной — как и <col> без ширин. */}
                        <button
                          type="button"
                          className={s.sectionToggle}
                          aria-expanded={open}
                          aria-label={`${group.title}: ${open ? 'свернуть' : 'развернуть'} секцию`}
                          onClick={() => setFolded((all) => ({ ...all, [group.id]: open }))}
                          style={
                            layout
                              ? ({ '--fold-at': `${layout.title}px` } as CSSProperties)
                              : undefined
                          }
                        >
                         <Tooltip text={group.title}>
                           <span className={s.sectionTitle}>{group.title}</span>
                         </Tooltip>
                         <span className={cx(s.fold, !open && s.isOn)}>
                           <Icon name="chevronDown" />
                         </span>
                       </button>
                      </th>
                      {/* СЧЁТ ПОЗИЦИЙ УЗЛА — в своих колонках, как у всякой
                          строки данных: число в «Объёме», слово — в «Ед.»
                          (склоняется plural'ом: 1 позиция, 2 позиции,
                          5 позиций). КЛАССЫ СВОИ, без tableCell.numeric/muted:
                          их выравнивание (0,2,1) не перебить из этого модуля,
                          а счёт стоит по ЦЕНТРУ ячейки (см. .group-count).
                          Тон — метаданные узла, а не значение строки. */}
                      <td className={s.groupCount}>{count}</td>
                      <td className={s.groupUnit}>
                        {plural(count, 'позиция', 'позиции', 'позиций')}
                      </td>
                      {/* Хвост ряда: заливку секции держит правило .group-row td,
                          содержимого у него нет. Разброс (+ условный
                          «Потенциал») и все колонки КП. */}
                      <td colSpan={leadCols - 4 + tailCols} />
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
                      maxWeight={facts.maxWeight}
                      bind={popup.bind}
                      focused={focusRowId === row.position.id}
                      noteFor={noteFor}
                      flashCells={flashAll}
                      index={numberOf.get(row.position.id) ?? 0}
                      place={placeOf.get(row.position.id) ?? 0}
                      totalRows={facts.rows.length}
                      topRows={topRows}
                      keyCut={facts.keyCut}
                      nameOf={nameOf}
                      commentsFor={comments.commentsFor}
                      onAction={onCellAction}
                      passportFor={passportFor}
                    />
                  )) : null}

                  {/* «ПОКАЗАНО» УЗЛА (§1.1) — ПОДЧИНЁННОЙ строкой внутри
                      секции и только под фильтром. Порядок фиксирован:
                      сначала видимый срез, ниже полный подытог. Свёрнутая
                      секция её не показывает: там и строк-то не видно, а
                      подытог ради которого и сворачивают — остаётся.
                      Тумблер параметров гасит обе строки разом: ярусов у
                      одной настройки не выключают поодиночке. */}
                  {shownRows && view.filters.length && open ? (
                    <ShownRow
                      node
                      rows={rows}
                      bids={bids}
                      metric={view.mainMetric}
                      lead={leadCols - 2}
                    />
                  ) : null}

                  <TotalRow
                    rows={allRows}
                    bids={bids}
                    metric={view.mainMetric}
                    lead={leadCols - 2}
                  />
                </tbody>
              );
            })
          ) : (
            /* Плоский список по одному числу: заголовки разделов и подытоги в
                таком порядке смысла не имеют (§3.1 аудита). Раздел, откуда
                пришла строка, при этом не теряется — его несут крошки в
                самой строке (§1.4). */
            <tbody>
              {(() => {
                const { head, tail, cut } = flatOrder(visible, view.rowView, facts, thresholds);
                const rowOf = (row: RowFacts, dim?: boolean) => (
                  <CompareRow
                    key={row.position.id}
                    row={row}
                    view={view}
                    titleLimit={limit}
                    thresholds={thresholds}
                    bids={bids}
                    sumWeight={facts.sumWeight}
                    maxWeight={facts.maxWeight}
                    bind={popup.bind}
                    focused={focusRowId === row.position.id}
                    noteFor={noteFor}
                    flashCells={flashAll}
                    index={numberOf.get(row.position.id) ?? 0}
                    place={placeOf.get(row.position.id) ?? 0}
                    totalRows={facts.rows.length}
                    topRows={topRows}
                    keyCut={facts.keyCut}
                    dim={dim}
                    nameOf={nameOf}
                    commentsFor={comments.commentsFor}
                    onAction={onCellAction}
                    passportFor={passportFor}
                  />
                );
                return (
                  <>
                    {head.map((row) => rowOf(row))}
                    {/* ЛИНИЯ ОТСЕЧКИ И ХВОСТ (§1.3). Появляются только когда
                        хвост есть: набор, целиком уместившийся выше порога,
                        линией не размечают — там нечего отсекать. */}
                    {cut && tail.length ? (
                      <>
                        <CutLine
                          label={cut.label}
                          rows={head.length}
                          share={cut.share}
                          span={allCols}
                        />
                        <TailRow
                          open={tailOpen}
                          count={tail.length}
                          share={cut.tailShare}
                          reason={cut.reason}
                          span={allCols}
                          onToggle={() => setTailOpen((on) => !on)}
                        />
                        {tailOpen ? tail.map((row) => rowOf(row, true)) : null}
                      </>
                    ) : (
                      tail.map((row) => rowOf(row))
                    )}
                  </>
                );
              })()}
            </tbody>
          )}

          {/* Полный итог КП — единственное число: фильтром и свёрткой не
              пересчитывается (§3 модели), потому складывается из всех позиций.
              Обёртка в tbody обязательна: голый tr на уровне таблицы браузер
              пере-вешивает в собственный tbody, и React честно ругается. */}
          <tbody>
            {/* ГЛОБАЛЬНОЕ «ПОКАЗАНО» — над полным итогом и только под
                фильтром (§1.1). Пара строк отвечает на два разных вопроса:
                «сколько стоят именно эти позиции» и «сколько стоит всё».
                Кто не знает, что итог остался полным, примет его за сумму
                видимого и «поймает систему на ошибке». Выключатель общий
                с узловой строкой — окно параметров. */}
            {shownRows && view.filters.length ? (
              <ShownRow
                rows={visible}
                bids={bids}
                metric={view.mainMetric}
                lead={leadCols - 2}
              />
            ) : null}
            <TotalRow grand rows={facts.rows} bids={bids} metric={view.mainMetric} lead={leadCols - 2} />
          </tbody>

          {/* Условия поставщиков — матрица ответов формы КП вне цен, выровненная
              по тем же колонкам. Тендеров без `terms` она не касается вовсе. */}
          <TermsBand bids={bids} bind={popup.bind} lead={leadCols - 2} span={allCols} />
        </Table>
        </div>
      </div>

      {/* Время последнего подтверждённого среза — подпись под лентой, а не в
          caption: caption читают скринридеры, а это сообщение адресовано
          глазам того, кто смотрит на приглушённые числа. */}
      {error && sliceTime ? (
        <p className={s.sliceTime}>последний подтверждённый срез · {sliceTime}</p>
      ) : null}

      {/* Один попап на таблицу: содержимое подставляется, элемент не меняется. */}
      {popup.view}

      {/* ── ПАНЕЛИ ЯЧЕЙКИ ────────────────────────────────────────────────────
          Три разные двери из одной ячейки, и каждая помнит свой адрес.
          Рендерятся ОДНОЙ веткой на всю таблицу, а не в самой ячейке: панель
          обязана пережить перерисовку строки, а 780 незаполненных <dialog>
          в DOM стоили бы дороже всего экрана.

          ЦЕНА ОТКРЫТИЯ ЛЮБОЙ ПАНЕЛИ — ПОЛНЫЙ ПЕРЕСЧЁТ СТИЛЯ ДОКУМЕНТА, и это
          измеренный потолок, а не недоделка. <Popover> открывается через
          `showModal()`; платформа делает остальную страницу inert, то есть
          трогает КАЖДЫЙ узел, а узлов здесь 780 ячеек с пометками. Замер
          (profile-compare, 20 открытий треда, --cpu 4): пересчёт стиля 8,8 с
          за прогон, p95 кадра 333 мс. Схлопывание четырёх `:has()`-правил
          ячейки в одно (`.sgn`) сняло с этого числа ~9 %; остальное держит
          сам размер документа.
          ponytail: потолок — размер таблицы в DOM; понадобится больше —
          виртуализация тела таблицы, а не правки панелей. */}
      {cellPanels}

      {/* МИНИ-СПИСОК КОРРЕКТИРОВОК КОЛОНКИ (§5.3, `contractor.md` §2).
          Одна корректировка ведёт сразу к ячейке — там выбирать не из чего;
          несколько открывают список: цикл вслепую не отвечает на вопрос
          «сколько шагов и куда», а список даёт обзор проблемы ДО первого
          прыжка. Строка ведёт к своей ячейке тем же контрактом перехода,
          что и всё остальное (§4.5). */}
      <Popover
        anchor={corrList?.at ?? null}
        onClose={() => setCorrList(null)}
        label={corrList ? `Корректировки: ${corrList.bid.contractor.name}` : ''}
        className={s.corrMenu}
      >
        {corrList ? (
          <>
            <p className={s.corrMenuTitle}>
              Корректировки {corrList.bid.contractor.name} ·{' '}
              {facts.rows.filter((r) => r.corrections.includes(corrList.bid.contractor.id)).length}
              {' '}на рассмотрении
            </p>
            {facts.rows
              .filter((r) => r.corrections.includes(corrList.bid.contractor.id))
              .map((r) => (
                <button
                  key={r.position.id}
                  type="button"
                  className={s.corrMenuItem}
                  onClick={() => {
                    setCorrList(null);
                    goToPosition(corrList.bid.contractor.id, r.position.id);
                  }}
                >
                  <span className={s.corrMenuName}>{r.position.title}</span>
                  <span className={s.corrMenuKind}>иной объём</span>
                  <span className={s.corrMenuArrow} aria-hidden="true">→</span>
                </button>
              ))}
          </>
        ) : null}
      </Popover>

      {/* Досье подрядчика + его персональный срез (§5.2). */}
      <DossierModal
        bid={dossier}
        total={positions.length}
        onClose={() => setDossier(null)}
        stats={dossier ? statsOf(dossier.contractor.id) : undefined}
        onGoToCell={(positionId) => dossier && goToPosition(dossier.contractor.id, positionId)}
      />

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

/** Есть ли у пары «строка × подрядчик» названная пометка — ТА ЖЕ проверка,
 *  что ставит `data-marks` в <BidCell>. Нужна ровно в одном месте: когда
 *  ячейки в DOM нет и надо понять, ПОЧЕМУ её нет — свёрнута секция или скрыта
 *  фильтром. Дублировать предикаты нельзя, поэтому читается то же, из чего
 *  их считает модель. */
function hasMark(kind: MarkKind, row: RowFacts, contractorId: string): boolean {
  switch (kind) {
    case 'min': return row.bestIds.includes(contractorId);
    case 'anomaly': return row.bids.some((b) => b.contractorId === contractorId && b.anomaly);
    case 'correction': return row.corrections.includes(contractorId);
    case 'missing':
    case 'declined': return !row.bids.some((b) => b.contractorId === contractorId);
  }
}

/* ═══════════════════ ПОРЯДОК ПЛОСКОГО СПИСКА (§1.3, §1.5) ═══════════════════
   Три сортировки — три РАЗНЫХ ответа на вопрос «где проходит граница», и
   собирает их одна функция, потому что рендер обязан получить готовую тройку
   «голова · хвост · подпись линии», а не выбирать её тремя ветками по месту.

   ПО ВЕСУ — граница по порогу ключевых: тот же набор, что даёт фильтр
   «Ключевые» и превью состава в окне параметров. Новых порогов не заводится.
   ПО РАЗБРОСУ — граница по порогу высокого; строки БЕЗ рассчитанного разброса
   уходят в хвост ОТДЕЛЬНОЙ группой с причиной (`sorting.md` §5): отсутствие
   разброса это не «разброс 0 %», и класть их в общий хвост значило бы
   утверждать, что цены сошлись.
   ПО ПОТЕНЦИАЛУ — линии нет вовсе: канон её для этой сортировки не заводит,
   а рисовать границу «просто чтобы была» значило бы придумать порог. */
function flatOrder(
  rows: RowFacts[],
  rowView: CompareView['rowView'],
  facts: { keyCut: { rows: number; share: number }; sumWeight: number },
  thresholds: CompareThresholds,
): {
  head: RowFacts[];
  tail: RowFacts[];
  cut: { label: string; share: number; tailShare?: number; reason?: string } | null;
} {
  const shareOf = (list: RowFacts[]) => (facts.sumWeight
    ? (list.reduce((acc, r) => acc + r.weight, 0) / facts.sumWeight) * 100
    : 0);

  if (rowView === 'potential') {
    return { head: [...rows].sort((a, b) => b.maxPot - a.maxPot), tail: [], cut: null };
  }

  if (rowView === 'spread') {
    const sorted = [...rows].sort((a, b) => (b.spread ?? -1) - (a.spread ?? -1));
    /* Хвост здесь СОБИРАЕТСЯ ПО ОТСУТСТВИЮ ЗНАЧЕНИЯ, а не по порогу: у этих
       строк разброса нет, и место им — за границей любой шкалы. */
    const head = sorted.filter((r) => r.spread !== null);
    const tail = sorted.filter((r) => r.spread === null);
    const high = head.filter((r) => r.spreadTag === 'high');
    if (!tail.length) {
      /* Разброс есть у всех — граница остаётся одна, по порогу высокого. */
      return high.length && high.length < head.length
        ? {
          head: high,
          tail: head.slice(high.length),
          cut: {
            label: `высокий разброс · от ${decimal(thresholds.spreadHigh)} %`,
            share: shareOf(high),
            tailShare: shareOf(head.slice(high.length)),
          },
        }
        : { head, tail: [], cut: null };
    }
    return {
      head,
      tail,
      cut: {
        label: `высокий разброс · от ${decimal(thresholds.spreadHigh)} %`,
        share: shareOf(high),
        reason: `без разброса · ${tail.length} ${plural(tail.length, 'позиция', 'позиции', 'позиций')} · сравнивать не с чем`,
      },
    };
  }

  const sorted = [...rows].sort((a, b) => b.weight - a.weight);
  /* Ключевые СЧИТАЮТСЯ ПО ВСЕМУ СРЕЗУ (`keyDerived` ставит analyzeComparison),
     а показываются по видимому: под фильтром линия отсекает то, что от набора
     осталось, — иначе она обещала бы строки, которых на экране нет. */
  const head = sorted.filter((r) => r.keyDerived || r.position.key === true);
  const tail = sorted.filter((r) => !(r.keyDerived || r.position.key === true));
  if (!head.length || !tail.length) return { head: sorted, tail: [], cut: null };
  return {
    head,
    tail,
    cut: {
      label: 'линия ключевых',
      /* ФАКТИЧЕСКИЙ охват набора, а не порог: набор собирается ДО первого
         пересечения порога и почти всегда чуть больше него. */
      share: shareOf(head),
      tailShare: shareOf(tail),
    },
  };
}
