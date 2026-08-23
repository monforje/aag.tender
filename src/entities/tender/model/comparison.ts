/** Сравнение коммерческих предложений по одному тендеру: позиции сметы слева,
 *  подрядчики колонками справа.
 *
 *  ЗДЕСЬ ТОЛЬКО КОНТРАКТ И СЧЁТ — НИ ОДНОЙ СТРОКИ ДАННЫХ. Смета и КП приходят
 *  снаружи (сегодня из `comparison.mock.ts`, завтра из ответа API) и передаются
 *  в функции явным аргументом. Значений по умолчанию у аргументов НЕТ
 *  намеренно: `rankBids()` без аргументов подставляла бы демо-подрядчиков, и
 *  на живом экране это заметили бы по чужим именам в колонках, а в `spread()`
 *  — вообще никак: проценты правдоподобны любые.
 *
 *  Живёт в entities, а не в слайсе страницы, по той же причине, что и реестр:
 *  цифры на карточке подрядчика (сумма, место) и цифры в теле таблицы (цена
 *  позиции, итог группы, разброс) считаются ИЗ ОДНИХ И ТЕХ ЖЕ строк.
 *  Разъехавшись, они дали бы экран, который спорит сам с собой: карточка
 *  говорит одно, сумма по колонке — другое.
 *
 *  ЦЕНА ХРАНИТСЯ ЗА ЕДИНИЦУ, а не суммой по позиции. Подрядчик подаёт КП
 *  расценками, объём берётся из сметы тендера и у всех одинаков — храня сумму,
 *  мы дали бы возможность записать её несогласованной с объёмом, а разброс по
 *  строке считался бы уже по «своим» объёмам у каждого. Сумма выводится.
 *
 *  ОТСУТСТВИЕ КЛЮЧА — ЭТО «ПОЗИЦИЯ НЕ ЗАКРЫТА», а не ноль. Ноль означал бы
 *  «готовы сделать бесплатно» и попал бы и в сумму, и в разброс.
 *
 *  ПОМЕТКИ ЯЧЕЕК ПРИХОДЯТ ГОТОВЫМИ В ДАННЫХ — макет их рисует, не вычисляет
 *  (§5 аудита): аномальная цена с причиной, потенциал за единицу, отказ.
 *  Производные от порогов состояния считаются ЗДЕСЬ, в одном проходе
 *  `analyzeComparison()`, чтобы таблица, фильтры, счётчики и попап читали
 *  одни и те же числа. Их четыре:
 *  - «минимум» присуждается лучшей НЕаномальной цене, и только когда есть
 *    ЧТО сравнивать (≥2 расценки): единственное КП — отсутствие конкуренции,
 *    а не победа;
 *  - метка разброса выводится из процента порогом, а не приходит рядом с ним;
 *  - аномальность ЯЧЕЙКИ объединяет внешнюю пометку с формулой metrics.md §9
 *    (`dᵢ ≥ k × median(dᵢ остальных)`): коэффициент — настройка тендера,
 *    вердикт данных сильнее формулы, а причина остаётся полем данных;
 *  - «ключевая» — ручная пометка закупщика ИЛИ правило «топ по весу до
 *    накопительной доли keyShare» (metrics.md §8).
 *
 *  МОДЕЛЬ ЯЧЕЙКИ И КОНТРОЛОВ — источника 22.08.2026
 *  (`ct-workspace-model.md`): основной показатель ровно один (селект),
 *  отклонение и ставка — СПУТНИКИ стоимости, а не равноправные показатели.
 *  Стоимость присутствует в ячейке всегда; состав строк ячейки кодирует
 *  `cellLines()`, пресеты и переход из анализа выражаются через те же оси.
 *  «Набора показателей с меткой главного» больше нет. */

import type { Tone } from '@/shared/ui/Badge';
import type { IconName } from '@/shared/ui/Icon';

/** Пороги аналитики — НАСТРОЙКИ ТЕНДЕРА, а не константы кода (решение
 *  владельца 22.08.2026: пороги принадлежат тендеру, личных и организационных
 *  дефолтов нет). У каждого — системное стартовое значение; специалист правит
 *  их в том тендере, где смотрит. Изменение порога каскадирует в метки,
 *  фильтры, сводку и контекст ИИ, но НЕ меняет tender_revision и не
 *  обесценивает данные.
 *
 *  Все функции расчёта принимают пороги явным аргументом — значений по
 *  умолчанию нет по той же причине, что и у прочих аргументов файла. */
export interface CompareThresholds {
  /** Разброс «заметный», % — мягкая отметка строки. */
  spreadNoticeable: number;
  /** Разброс «высокий», % — тег, подсветка, фильтр. */
  spreadHigh: number;
  /** Коэффициент аномалии k: ячейка помечается, если dᵢ ≥ k × median(dᵢ
   *  остальных). Единственный порог-КОЭФФИЦИЕНТ — в окне настроек ему
   *  обязательна подсказка с разбором (metrics.md §9). */
  anomalyK: number;
  /** Доля ключевых работ, % — накопительная доля веса до отсечки. */
  keyShare: number;
}

export const SYSTEM_THRESHOLDS: CompareThresholds = {
  /** Ярусы разброса — продуктовые значения metrics.md §7. */
  spreadNoticeable: 15,
  spreadHigh: 40,
  /** ОТСТУПЛЕНИЕ ОТ КАНОНА, записанное сознательно. В metrics.md §9 старт
   *  k = 2, но при РОВНО ТРЁХ участниках формула вырождается: медиана двух
   *  «остальных» отклонений равна их полусумме, и порог k = 2 превращается
   *  во второе по величине отклонение — худшая ячейка КАЖДОЙ строки получает
   *  пометку всегда, независимо от данных. На полях из трёх КП честный старт —
   *  3: помечается только явно выпадающий (d_max ≥ 1,5 второго). Вопрос о
   *  калибровке на реальных полях — владельцу; см. COMPARE-MODEL-AUDIT.md. */
  anomalyK: 3,
  keyShare: 80,
};

/** Защита окна настроек от бессмыслицы: заметный не выше высокого, k и доли —
 *  в осмысленных границах. Прогонять через неё КАЖДОЕ изменение порога:
 *  незажатое значение тихо каскадировало бы во все метки экрана. */
export const clampThresholds = (t: CompareThresholds): CompareThresholds => {
  const num = (v: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));
  const spreadHigh = num(t.spreadHigh, 1, 100);
  return {
    spreadNoticeable: num(t.spreadNoticeable, 0, spreadHigh),
    spreadHigh,
    anomalyK: num(t.anomalyK, 1, 10),
    keyShare: num(t.keyShare, 1, 100),
  };
};

/** Допуск отклонения от медианы строки для ФИЛЬТРА «Дороже медианы», ±%
 *  симметрично по смыслу, положительно по знаку. Это устройство фильтра, а не
 *  настройка из окна: в перечне порогов модели его нет. */
export const DEV_TOLERANCE = 5;
/** «Есть потенциал» с порогом, ₽ по строке: без него предикат пропускает все
 *  строки подряд и фильтр — no-op (§4.4). Тоже устройство фильтра. */
export const POTENTIAL_MIN = 50_000;

/* ═══════════════════ РАУНДЫ ТОРГОВ ═══════════════════
   Исходный сбор КП — раунд 1, каждый запущенный круг увеличивает номер
   (`demo/tender-round.md`, US-4). У раунда один актуальный анализ; сохранённый
   разбор прошлого раунда — снимок завершённого круга и не устаревает
   (05-ai-analysis.md §8). */

export type RoundStatus = 'current' | 'closed';

export interface ComparisonRound {
  id: string;
  /** Сквозной номер по тендеру, с 1. */
  number: number;
  status: RoundStatus;
  /** Приглашённые подрядчики раунда (id) — и подавшие, и ещё молчащие:
   *  состав раунда определяет, кого ждать с КП. */
  invited: string[];
}

export interface ComparePosition {
  id: string;
  title: string;
  qty: number;
  unit: string;
  /** Ручная пометка закупщика. Правило «топ по весу» добавляет ключевые
   *  поверх ручных (`analyzeComparison`): одно другому не мешает. */
  key?: boolean;
  /** Объём до корректировки сметы: дифф против опубликованного показывают
   *  ОБА значения (`920 → 840`), молчаливая подмена врала бы истории. */
  qtyOrig?: number;
  /** Строка снята из сметы после публикации. Остаются в DOM и в счётчиках —
   *  это часть истории сметы, а не мусор. */
  removed?: boolean;
}

/** Пометка ячейки «позиция × подрядчик». Всё — вход, ни одно поле не
 *  выводится из цен: аномалия — вердикт внешнего анализа, потенциал —
 *  торговая оценка, отказ — решение подрядчика (§5 аудита). */
export interface CellMark {
  /** Причина аномалии — обязательна при ней же: строку невозможно объяснить
   *  подрядчику без причины, поэтому попап показывает её первым блоком.
   *  У ячейки, помеченной ТОЛЬКО формулой (без внешнего вердикта), причины
   *  нет — попап даёт стандартную фразу вместо неё. */
  anomaly?: string;
  /** Заявленный запас торга, ₽ ЗА ЕДИНИЦУ — как и цена: сумма по строке
   *  выводится умножением на общий объём. */
  potential?: number;
  /** Отказ от объёма. Противоположен пробелу данных: отказ — решение,
   *  отсутствие цены — дыра в КП; красить решение в тревогу — врать о нём. */
  declined?: boolean;
  /** Комментарий разбора к этой ячейке («почему важно / что делать»).
   *  Приходить может ТОЛЬКО после запуска анализа (Р4): до него попап
   *  показывает одни числа, словарь пометок живёт в легенде. У «нет цены»
   *  и «Отказа» комментария не бывает вовсе (05 §4.3.4). */
  note?: string;
}

/** Раздел сметы. Плоский список из тринадцати позиций читается как простыня:
 *  разделы дают итог промежуточный («материалы у всех примерно одинаковы, а
 *  расходятся на работах») и дают что свернуть, когда строки уже прочитаны. */
export interface PositionGroup {
  id: string;
  title: string;
  positions: ComparePosition[];
}

/** Состояние КП. Отвечает на вопрос «можно ли по этому предложению принимать
 *  решение», а не «сколько строк заполнено» — заполненность стоит на карточке
 *  отдельно. Пример, ради которого статус вообще нужен полем: КП заполнено
 *  целиком, но к нему есть вопросы, и подписывать его сейчас нельзя. Из
 *  процентов этого не видно.
 *
 *  Подписи — ОДНО слово, сказанное о КП: «(КП) получено / уточняется /
 *  частично». Длинные расшифровки («Заполнено частично») в капсуле шапки
 *  колонки не помещались и читались как предложение; смысл целиком остаётся
 *  доступным по наведению на карточку (процент заполнения рядом).
 *
 *  Цвет — ОБЩИЙ мягкий тон: тот же вид капсулы, что у статусов реестра
 *  («Открыт», «Закрыт», «Отменён»). Плотную заливку сняли после трёх проб за
 *  день (ступень -ink — слишком глухо; полтона к белому — серо; сам цвет тона
 *  с белым текстом — «не наши» цвета; 23.08.2026) — разбор в Части XII
 *  DESIGN-NOTES. */
export type BidStatusId = 'complete' | 'revision' | 'partial';

export interface BidStatusView {
  label: string;
  tone: Tone;
  icon: IconName;
}

export const BID_STATUS: Record<BidStatusId, BidStatusView> = {
  complete: { label: 'Получено', tone: 'success', icon: 'inbox' },
  revision: { label: 'Уточняется', tone: 'warning', icon: 'questionCircle' },
  partial: { label: 'Частично', tone: 'info', icon: 'checklistMin' },
};

/** Статус по id — ФУНКЦИЕЙ, а не обращением к таблице. Граница доверия: id
 *  приходит из ответа сервера, где словарь статусов живёт своей жизнью и
 *  пополняется без нас. Незнакомое значение обязано дать нейтральную капсулу
 *  с самим id — видно, что статус новый, — а не уронить экран на
 *  `undefined.label`. */
export const bidStatus = (id: string): BidStatusView =>
  BID_STATUS[id as BidStatusId] ?? { label: id, tone: 'neutral', icon: 'flag' };

export interface Contractor {
  id: string;
  name: string;
  status: BidStatusId;
  /** Заполненность КП в процентах — доля сметы ПО СТОИМОСТИ, закрытая
   *  расценками. Поле, а не «сколько строк из тринадцати»: смета неоднородна,
   *  и незакрытая плёнка за 80 тысяч и незакрытая гидроизоляция за миллион —
   *  это одна строка и там, и там, но совсем разная дыра в предложении.
   *  Долю по строкам считает `filled` в Bid и показывает только скринридеру. */
  fill: number;
  inn: string;
  contact: string;
  /** Когда КП поступило, ДД.ММ.ГГГГ — как и прочие даты в домене. */
  submitted: string;
  /** Цена за единицу по id позиции. Ключа нет — позиция в КП не закрыта. */
  prices: Record<string, number>;
  /** Пометки анализа по id позиции. Ключа нет — ячейка чистая: ни аномалии,
   *  ни потенциала, ни отказа (отказ живёт здесь, а не отсутствием цены). */
  marks?: Record<string, CellMark>;
  /** Номер раунда, в который подано ЭТО КП. Ключа нет — КП первого раунда:
   *  поле появилось вместе с раундами, старые данные молча считаются первым
   *  кругом. «Ещё не подал» в текущем раунде = номер меньше текущего. */
  submittedInRound?: number;
  /** Условия КП («аванс 30 %») — их анализ обязан назвать РАНЬШЕ слова
   *  «аномалия» (05-ai-analysis.md §4.3.3): условия могут объяснять цену. */
  conditions?: string[];
  /** Расценки этого же подрядчика из предыдущего раунда — база секции
   *  «Изменения поставщика» (05 §4.1): сравнивают его же прошлое КП,
   *  а не чужие предложения. */
  prevPrices?: Record<string, number>;
}

/** Ответ на «дай сравнение по тендеру» — ровно то, чем живёт экран, и ничего
 *  больше. Смета отдельно от КП, а не расценки внутри позиции: подрядчик
 *  вправе позицию не закрыть, и место для этого «нет» есть только в КП. */
export interface Comparison {
  groups: PositionGroup[];
  contractors: Contractor[];
  /** Реестр раундов тендера — для переключателя сохранённых анализов.
   *  Ключа нет — раунды ещё не заводились, панель показывает один круг. */
  rounds?: ComparisonRound[];
  /** Номер раунда, состоянию которого соответствует ЭТОТ снимок КП. Ключа нет
   *  — данные первого раунда. Без него реестр раундов и расценки ответа
   *  разъехались бы: реестр знает про второй круг, а цены в ответе — прошлые. */
  roundNumber?: number;
}

/** Раунд, к которому относится снимок: явное поле, иначе текущий статус
 *  реестра, иначе первый круг. Одна функция, чтобы трое читавших это место
 *  не разошлись. */
export const snapshotRound = (comparison: Comparison): number =>
  comparison.roundNumber
  ?? comparison.rounds?.find((r) => r.status === 'current')?.number
  ?? 1;

/** Есть ли предыдущий раунд у снимка — секции «Изменения поставщика» и
 *  «Общая картина» появляются именно потому, что появилось с чем сравнивать
 *  (05 §4); их отсутствие в первом раунде — норма, а не пустая секция. */
export const hasPreviousRound = (comparison: Comparison): boolean => {
  const n = snapshotRound(comparison);
  return !!comparison.rounds?.some((r) => r.number === n - 1);
};

/** Плоский список позиций — для расчётов, которым разделы безразличны (итог по
 *  КП, сколько позиций закрыто). ВЫВОДИТСЯ из разделов, а не приходит вторым
 *  полем ответа: два перечня одних и тех же позиций разъехались бы на первой
 *  же правке — хоть у нас, хоть на сервере. */
export const flatten = (groups: PositionGroup[]): ComparePosition[] =>
  groups.flatMap((g) => g.positions);

/** Итог по одному подрядчику — всё, что показывает его карточка в шапке. */
export interface Bid {
  contractor: Contractor;
  /** Сколько позиций сметы закрыто расценкой. Не показывается цифрой — уходит
   *  в подпись шкалы для скринридера; на экране заполненность одна, `percent`,
   *  иначе два близких, но разных числа рядом читались бы как ошибка. */
  filled: number;
  /** Заполненность КП, 0…100 — из contractor.fill. */
  percent: number;
  /** Итог по ЗАКРЫТЫМ позициям. У неполного КП он заведомо занижен — поэтому
   *  ранг такого предложения и опущен в конец (см. rankBids). */
  sum: number;
  /** Место по итогу, с 1. */
  rank: number;
  /** Цвет колонки по месту: лучшее — зелёное, худшее — красное, всё между —
   *  янтарное. Тон, а не «зелёный»: цвет один раз назван в токенах. */
  tone: Tone;
  /** Подпись места. Цвет колонки — это wash в несколько процентов, и он не
   *  имеет права быть единственным носителем ранга: подпись читается и в
   *  чёрно-белом, и скринридером. */
  rankLabel: string;
}

/** Итог по позициям — одна функция и для группы, и для всего КП. */
export function sumOf(contractor: Contractor, positions: ComparePosition[]): number {
  return positions.reduce((acc, p) => acc + (contractor.prices[p.id] ?? 0) * p.qty, 0);
}

/** Итог подрядчика по разделу сметы — строка «Итого · Материалы». */
export function groupSum(group: PositionGroup, contractor: Contractor): number {
  return sumOf(contractor, group.positions);
}

/** Итоги по всем подрядчикам, УЖЕ отранжированные.
 *
 *  ПОРЯДОК СОРТИРОВКИ — ДВУХКЛЮЧЕВОЙ, и первый ключ важнее второго:
 *  сначала полнота КП, и только потом сумма. Иначе побеждал бы тот, кто
 *  просто не заполнил часть сметы: его итог меньше не потому, что дешевле,
 *  а потому, что там нечего складывать. Неполное предложение уходит вниз
 *  всегда, каким бы дешёвым ни выглядело.
 *
 *  Ранг — ПОДСКАЗКА, а не вердикт: сроки, гарантии и опыт в цифрах здесь не
 *  участвуют. Ровно поэтому цвет колонки можно перекрасить руками — базовый
 *  расчёт даёт первое приближение, решение остаётся за человеком. */
export function rankBids(contractors: Contractor[], positions: ComparePosition[]): Bid[] {
  const scored = contractors.map((contractor) => ({
    contractor,
    filled: positions.filter((p) => contractor.prices[p.id] !== undefined).length,
    percent: contractor.fill,
    sum: sumOf(contractor, positions),
  }));

  scored.sort((a, b) => (
    Number(a.percent < 100) - Number(b.percent < 100) || a.sum - b.sum
  ));

  const last = scored.length;
  return scored.map((bid, i) => {
    const rank = i + 1;
    return {
      ...bid,
      rank,
      tone: rank === 1 ? 'success' : rank === last ? 'danger' : 'warning',
      rankLabel: rank === 1 ? 'Лучшее предложение' : `${rank}-е место`,
    };
  });
}

/** Разброс цен по позиции — на сколько процентов самое дорогое предложение
 *  дороже самого дешёвого.
 *
 *  Считается от МИНИМУМА, а не от среднего: вопрос, который задают строке, —
 *  «насколько я переплачу, если возьму не самого дешёвого». Меньше двух
 *  расценок — сравнивать не с чем, и это null, а не 0: ноль означал бы
 *  «все предложили одинаково».  */
export function spread(position: ComparePosition, contractors: Contractor[]): number | null {
  const prices = contractors
    .map((c) => c.prices[position.id])
    .filter((p): p is number => p !== undefined);
  if (prices.length < 2) return null;
  const min = Math.min(...prices);
  return ((Math.max(...prices) - min) / min) * 100;
}

const MONEY = new Intl.NumberFormat('ru-RU', {
  style: 'currency', currency: 'RUB', maximumFractionDigits: 0,
});
const DECIMAL = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const COMPACT = new Intl.NumberFormat('ru-RU', {
  style: 'currency', currency: 'RUB',
  notation: 'compact', maximumFractionDigits: 0,
});

/** Рубли без копеек: в сравнении КП значащие разряды — миллионы, и копейки
 *  только удлиняют колонку. */
export const money = (value: number): string => MONEY.format(value);
/** Деньги с сокращением порядков БЕЗ дробных — формат примеров модели ячейки
 *  (`164 тыс. ₽`): главный показатель потенциального режима длинным числом
 *  ломает строку, а точность после первой значащей цифры там ничего не
 *  решает. */
export const moneyCompact = (value: number): string => COMPACT.format(value);
/** Число с запятой и без хвоста нулей — объёмы (86,5 т) и проценты (7,9 %). */
export const decimal = (value: number): string => DECIMAL.format(value);

/* ═══════════════════ ПРОИЗВОДНЫЕ ЧИСЛА СТРОКИ ═══════════════════
   Один проход по строке — всё производное считается здесь и только здесь:
   таблица, фильтры, счётчики и попап читают одни и те же числа. */

export interface RowFacts {
  position: ComparePosition;
  /** Закрытые расценки в порядке колонок — ВКЛЮЧАЯ аномальные: разброс
   *  считается по всем ценам, минимум ищет обходной путь мимо них.
   *  `anomaly` — ОБЪЕДИНЁННЫЙ флаг ячейки: внешний вердикт из `marks`
   *  или результат формулы k (метки разброса и минимума живут отдельными
   *  полями строки, аномальность — свойство ячейки). */
  bids: Array<{ contractorId: string; price: number; anomaly: boolean }>;
  median: number | null;
  /** Разброс от минимума, %; меньше двух расценок — null, не ноль. */
  spread: number | null;
  /** Метка разброса ВЫВЕДЕНА из процента порогом, а не принята полем. */
  spreadTag: 'none' | 'noticeable' | 'high' | null;
  /** Подрядчик с лучшей НЕаномальной ценой; нет конкуренции — null. */
  bestId: string | null;
  /** Есть ли в строке аномальная расценка — подъём ячейковой пометки на
   *  строку для фильтра и счётчика: у строки нет своей аномалии, есть чужие. */
  anomaly: boolean;
  /** Отказ и пробел данных — разные состояния и разные счётчики: отказ это
   *  решение подрядчика, отсутствие расценки — дыра в КП (§4 слой 3). */
  declined: boolean;
  missing: boolean;
  /** Максимум заявленного потенциала по строке, ₽ ПО СТРОКЕ (за единицу ×
   *  общий объём): сортировка «По потенциалу» и фильтр читают его. */
  maxPot: number;
  /** Вес строки — сумма по самому дорогому предложению: «во сколько обойдётся
   *  в худшем случае», оценка риска, а не факта. У снятой строки вес 0. */
  weight: number;
  /** Строка попала в ключевые ПРАВИЛОМ «топ по весу до накопительной доли
   *  keyShare» — независимо от ручной пометки `position.key`. */
  keyDerived: boolean;
}

/** Медиана — по всем закрытым расценкам, включая аномальные: она описывает
 *  строку, а не судит её. */
export const medianOf = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Отклонение цены от медианы строки, % со знаком.
 *
 *  ЗАМЕНА, А НЕ РЕШЕНИЕ: настоящая база отклонения — внешняя эталонная цена
 *  строки (сметная / прошлая закупка), которой в контракте пока нет, и из цен
 *  КП её вывести нельзя — это доказано обратным счётом по демо-датасету
 *  (§2.2 аудита). До появления поля медиана годится показать режим и ни для
 *  чего больше. */
export const deviationPct = (price: number, median: number): number =>
  ((price - median) / median) * 100;

export interface ComparisonFacts {
  rows: RowFacts[];
  byId: Map<string, RowFacts>;
  /** Σ веса среза: база доли веса. Сумма долей даёт ровно 100 % — в отличие
   *  от сломанного «% среза» демо, делившего вес на чужой итог подрядчика. */
  sumWeight: number;
}

/** Пометки ячейки или пусто. Функцией, а не `contractor.marks?.[id]` по месту:
 *  единственное место знает, что пометки могут не прийти вовсе. */
export const cellMark = (contractor: Contractor, positionId: string): CellMark =>
  contractor.marks?.[positionId] ?? {};

export const hasAnomaly = (mark: CellMark): boolean => typeof mark.anomaly === 'string';

/** Формула аномалии metrics.md §9: ячейка помечается, если её отклонение от
 *  медианы превышает k × медиану отклонений ОСТАЛЬНЫХ — выброс ищется
 *  относительно того, как расходятся другие участники этой же строки.
 *  Минимум три расценки; при нулевой медиане и при нулевой медиане отклонений
 *  остальных действуют правила канона. Возвращает флаг НА КАЖДУЮ цену (в
 *  порядке входа). */
function deriveAnomalies(prices: number[], k: number): boolean[] {
  const flags = prices.map(() => false);
  if (prices.length < 3) return flags;
  const median = medianOf(prices);
  if (median === null || median === 0) return flags;
  const devs = prices.map((p) => Math.abs(p / median - 1));
  devs.forEach((d, i) => {
    const others = devs.filter((_, j) => j !== i);
    const medOthers = medianOf(others)!;
    flags[i] = medOthers === 0 ? d > 0 : d >= k * medOthers;
  });
  return flags;
}

export function analyzeComparison(
  groups: PositionGroup[],
  contractors: Contractor[],
  thresholds: CompareThresholds,
): ComparisonFacts {
  const byContractor = new Map(contractors.map((c) => [c.id, c]));
  const rows: RowFacts[] = groups.flatMap((group) => group.positions.map((position) => {
    const closed = contractors
      .filter((c) => c.prices[position.id] !== undefined)
      .map((c) => ({ contractorId: c.id, price: c.prices[position.id] }));

    const prices = closed.map((b) => b.price);
    const min = Math.min(...prices);
    const spreadPct = prices.length > 1 ? ((Math.max(...prices) - min) / min) * 100 : null;

    /* Аномальность ячейки: внешний вердикт ИЛИ формула k. Оба источника
       сходятся в одном флаге — таблица, фильтр и попап не спорят. */
    const derived = deriveAnomalies(prices, thresholds.anomalyK);
    const bids = closed.map((b, i) => ({
      contractorId: b.contractorId,
      price: b.price,
      anomaly: derived[i]
        || hasAnomaly(cellMark(byContractor.get(b.contractorId)!, position.id)),
    }));

    /* Минимум — лучшая НЕаномальная цена при живой конкуренции. */
    const fair = bids.filter((b) => !b.anomaly);
    const bestId = fair.length && prices.length > 1
      ? fair.reduce((best, b) => (b.price < best.price ? b : best)).contractorId
      : null;

    return {
      position,
      bids,
      median: medianOf(prices),
      spread: spreadPct,
      spreadTag: spreadPct === null ? null
        : spreadPct >= thresholds.spreadHigh ? 'high'
          : spreadPct >= thresholds.spreadNoticeable ? 'noticeable' : 'none',
      bestId,
      anomaly: bids.some((b) => b.anomaly),
      declined: contractors.some((c) => cellMark(c, position.id).declined === true),
      missing: !position.removed
        && contractors.some((c) => c.prices[position.id] === undefined && cellMark(c, position.id).declined !== true),
      maxPot: Math.max(0, ...contractors.map(
        (c) => (cellMark(c, position.id).potential ?? 0) * position.qty,
      )),
      weight: position.removed || !prices.length ? 0 : Math.max(...prices) * position.qty,
      keyDerived: false,
    };
  }));

  /* Ключевые по правилу «топ по весу»: минимальное число самых тяжёлых строк,
     чья накопительная доля достигает keyShare; строка отсечки включается
     (metrics.md §8). Снятые и неоценённые строки веса не имеют — в набор не
     попадают. Ручные пометки `position.key` добавляются ПОВЕРХ этого. */
  const sumWeight = rows.reduce((acc, r) => acc + r.weight, 0);
  if (sumWeight > 0) {
    let acc = 0;
    for (const row of [...rows].sort((a, b) => b.weight - a.weight)) {
      if (row.weight <= 0) break;
      acc += row.weight;
      row.keyDerived = true;
      if ((acc / sumWeight) * 100 >= thresholds.keyShare) break;
    }
  }

  return { rows, byId: new Map(rows.map((r) => [r.position.id, r])), sumWeight };
}

/* ═══════════════════ ПРЕДИКАТЫ ФИЛЬТРОВ ═══════════════════ */

export type PredicateId = 'key' | 'spread' | 'anomaly' | 'pot' | 'med';

export const PREDICATES: ReadonlyArray<{ id: PredicateId; label: string }> = [
  { id: 'key', label: 'Ключевые' },
  { id: 'spread', label: 'Высокий разброс' },
  { id: 'anomaly', label: 'Аномалии' },
  { id: 'pot', label: 'Есть потенциал' },
  { id: 'med', label: 'Дороже медианы строки' },
];

/** Пропускает ли строку предикат. Комбинируются по И, порядок не важен,
 *  пустой набор показывает всё. Порог «дороже медианы» ТОТ ЖЕ, что ставит
 *  бейдж ячейки (±DEV_TOLERANCE): один смысл — один порог ([R4]). */
export function predicatePasses(id: PredicateId, facts: RowFacts): boolean {
  switch (id) {
    case 'key': return facts.position.key === true || facts.keyDerived;
    case 'spread': return facts.spreadTag === 'high';
    case 'anomaly': return facts.anomaly;
    case 'pot': return facts.maxPot >= POTENTIAL_MIN;
    case 'med': return facts.median !== null && facts.bids.some(
      (b) => deviationPct(b.price, facts.median!) > DEV_TOLERANCE,
    );
  }
}

/** Строки, проходящие ВСЕ активные предикаты (И). */
export const filterRows = (rows: RowFacts[], filters: PredicateId[]): RowFacts[] =>
  rows.filter((row) => filters.every((id) => predicatePasses(id, row)));

/** Счётчик предиката: сколько строк он пропустит на ВСЕХ данных — число на
 *  невыбранном пункте иначе бесполезно (показывает «после всего остального»). */
export const predicateCount = (id: PredicateId, rows: RowFacts[]): number =>
  rows.filter((row) => predicatePasses(id, row)).length;

/* ═══════════ СОСТОЯНИЕ ЭКРАНА: ОСИ МОДЕЛИ ЯЧЕЙКИ ═══════════ */

/** Основные показатели ячейки — закрытое перечисление по правилу
 *  размерности (источник §1): основным может быть только то, что суммируется
 *  в подытог. Отклонение — характеристика стоимости (%), ставка — производная
 *  (₽/ед.), обе живут спутниками, а не здесь. */
export type CompareMetricId = 'cost' | 'potential';

/** Спутники стоимости — галочки панели таблицы. Описывают стоимость, поэтому
 *  НЕ зависят от селекта основного: она в ячейке есть всегда. */
export type SatelliteId = 'deviation' | 'rate';

export const SATELLITE_LABEL: Record<SatelliteId, string> = {
  deviation: 'Отклонение',
  rate: 'Ставка',
};

export type RowViewId = 'sections' | 'weight' | 'potential';

export interface CompareView {
  preset: PresetId;
  mainMetric: CompareMetricId;
  showDeviation: boolean;
  showRate: boolean;
  rowView: RowViewId;
  filters: PredicateId[];
}

export type PresetId = 'overview' | 'bidding' | 'anomalies';

/** Пресет — не фильтр, а сохранённая комбинация ВСЕХ осей модели: основной
 *  показатель, спутники, вид строк, активные предикаты. Один клик — ответ на
 *  один вопрос: что вообще предложили → где можно отжать → где врут.
 *  Присваивает оси ЦЕЛИКОМ и своей логики не имеет: всё, что пресет делает,
 *  повторяется руками теми же контролами (источник §2).
 *
 *  «Аномалии»: основной «Отклонение» упразднён вместе с моделью наборов —
 *  режим собирается из стоимости с галочкой отклонения и фильтров разброса и
 *  аномалий; порядок строк отдаётся весу, потому что риск смотрят сверху вниз
 *  по влиянию на итог. */
export const PRESETS: Record<PresetId, Omit<CompareView, 'preset'>> = {
  overview: { mainMetric: 'cost', showDeviation: false, showRate: false, rowView: 'sections', filters: [] },
  bidding: { mainMetric: 'potential', showDeviation: false, showRate: false, rowView: 'potential', filters: ['pot'] },
  anomalies: { mainMetric: 'cost', showDeviation: true, showRate: false, rowView: 'weight', filters: ['spread', 'anomaly'] },
};

export const PRESET_LABEL: Record<PresetId, string> = {
  overview: 'Обзор',
  bidding: 'Торги',
  anomalies: 'Аномалии',
};

export const METRIC_LABEL: Record<CompareMetricId, string> = {
  cost: 'Стоимость', potential: 'Потенциал',
};

export const ROW_VIEW_LABEL: Record<RowViewId, string> = {
  sections: 'По разделам', weight: 'По весу', potential: 'По потенциалу',
};

/** Строка ячейки в терминах модели: главное число, база-стоимость или
 *  справочная ставка. */
export type CellLine =
  | { kind: 'main'; metric: CompareMetricId }
  | { kind: 'base' }
  | { kind: 'rate' };

/** Состав строк ячейки — единственное место, знающее правила источника §1:
 *
 *  1. основной показатель — ровно одна первая строка;
 *  2. стоимость присутствует всегда: если основной не она — второй строкой
 *     как база (константа режима, а не опция);
 *  3. отклонение липнет к стоимости суффиксом на той строке, где она стоит;
 *  4. ставка — последней строкой, по галочке;
 *  5. порядок ФИКСИРОВАН и не зависит от того, в какой последовательности
 *     что включали: соседние колонки обязаны сравниваться построчно;
 *  6. подписей словами нет — различают порядок строк и порядок величин.
 *
 *  Рендер читает план, а не придумывает состав сам: так правило №5 нельзя
 *  нарушить локальной правкой ячейки. */
export function cellLines(view: CompareView): { lines: CellLine[]; deviationOn: 'main' | 'base' | null } {
  const lines: CellLine[] = [{ kind: 'main', metric: view.mainMetric }];
  const deviationOn = view.showDeviation
    ? view.mainMetric === 'cost' ? 'main' : 'base'
    : null;
  if (view.mainMetric !== 'cost') lines.push({ kind: 'base' });
  if (view.showRate) lines.push({ kind: 'rate' });
  return { lines, deviationOn };
}

/** Словарь показателей протокола ИИ (06-ai-contract.md §5): контракт старше
 *  новой модели ячейки и говорит прежними именами. Отображение на оси — в
 *  `applyTransition`; до переноса протокола в канон семантика наша. */
export type TransitionMetricId = 'cost' | 'price' | 'deviation' | 'potential';

/** Переход «анализ → таблица» (06-ai-contract.md §5, §7): пресет задаёт все
 *  оси целиком; required_metrics лишь ДОБАВЛЯЕТ то, что нужно для прочтения
 *  вывода. Отображение старого словаря контракта на новые оси:
 *  - `price` / `cost` — no-op: стоимость в ячейке есть всегда (§1, правило 2);
 *  - `deviation` — включает галочку отклонения;
 *  - `potential` — ставит потенциал ОСНОВНЫМ: в новой модели он виден только
 *    так, отдельного спутника у него нет. */
export function applyTransition(
  view: CompareView,
  transition?: { preset: PresetId; requiredMetrics?: TransitionMetricId[] },
): CompareView {
  if (!transition) return view;
  const base = PRESETS[transition.preset];
  const next: CompareView = {
    preset: transition.preset,
    mainMetric: base.mainMetric,
    showDeviation: base.showDeviation,
    showRate: base.showRate,
    rowView: base.rowView,
    filters: [...base.filters],
  };
  for (const metric of transition.requiredMetrics ?? []) {
    if (metric === 'deviation') next.showDeviation = true;
    if (metric === 'potential') next.mainMetric = 'potential';
  }
  return next;
}

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((x) => b.includes(x));

/** Ушли ли от базы пресета хоть по одной из осей. Молча терять это нельзя:
 *  пользователь обязан видеть, что смотрит не на «Обзор», а на свою
 *  собственную нарезку. */
export const isModifiedView = (view: CompareView): boolean => {
  const base = PRESETS[view.preset];
  return view.mainMetric !== base.mainMetric
    || view.showDeviation !== base.showDeviation
    || view.showRate !== base.showRate
    || view.rowView !== base.rowView
    || !sameSet(view.filters, base.filters);
};
