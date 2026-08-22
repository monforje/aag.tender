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
 *  ПОМЕТКИ (§4.6 аудита) ПРИХОДЯТ ГОТОВЫМИ В ДАННЫХ — макет их рисует, не
 *  вычисляет. Исключений ровно два, и оба считаются ЗДЕСЬ, в одном проходе
 *  `analyzeComparison()`, чтобы таблица, фильтры, счётчики и попап читали
 *  одни и те же числа:
 *  - «минимум» присуждается лучшей НЕаномальной цене, и только когда есть
 *    ЧТО сравнивать (≥2 расценки): единственное КП — отсутствие конкуренции,
 *    а не победа; аномально дешёвое выбывает из соревнования за минимум,
 *    но остаётся в расчёте разброса;
 *  - метка разброса выводится из вычисленного процента порогом, а не приходит
 *    рядом с ним: один смысл — один порог, иначе число спорит с подписью. */

import type { Tone } from '@/shared/ui/Badge';
import type { IconName } from '@/shared/ui/Icon';

/** Пороги формул. Числами-константами, а не магией по месту: фильтр, бейдж
 *  ячейки и красная цифра обязаны делить ОДИН порог (правило [R4] аудита),
 *  и разъехаться им неоткуда.
 *
 *  Ярусы разброса — ПРОДУКТОВЫЕ значения из канона `metrics.md` §7:
 *  до 15 % обычный, 15–40 % заметный, от 40 % высокий (решение владельца,
 *  22.08.2026). Аномалия в продукте считается формулой «k × медиана отклонений»,
 *  k = 2; здесь она приходит готовой пометкой в данных, формула не дублируется.
 *
 *  Два порога ниже в metrics.md НЕ определены — это демо-устройства нашего
 *  экрана, а не продуктовые константы; менять их без повода нельзя, но и
 *  ссылаться на них как на канон тоже. */
export const SPREAD_HIGH = 40;
export const SPREAD_NOTICEABLE = 15;
/** Допуск отклонения от медианы строки, ±% — симметричный: «дешевле на 8 %»
 *  такой же повод спросить, как «дороже» (несимметричный порог демо — дефект). */
export const DEV_TOLERANCE = 5;
/** «Есть потенциал» с порогом, ₽ по строке: без него предикат пропускает все
 *  строки подряд и фильтр — no-op (§4.4). */
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
  /** Ключевая позиция — ручная пометка закупщика или правило «топ по весу»;
   *  решению о строке, двигающей итог, грош цена без ответственного за него. */
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
   *  подрядчику без причины, поэтому попап показывает её первым блоком. */
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

/** Рубли без копеек: в сравнении КП значащие разряды — миллионы, и копейки
 *  только удлиняют колонку. */
export const money = (value: number): string => MONEY.format(value);
/** Число с запятой и без хвоста нулей — объёмы (86,5 т) и проценты (7,9 %). */
export const decimal = (value: number): string => DECIMAL.format(value);

/* ═══════════════════ ПРОИЗВОДНЫЕ ЧИСЛА СТРОКИ ═══════════════════
   Один проход по строке — всё производное считается здесь и только здесь:
   таблица, фильтры, счётчики и попап читают одни и те же числа. */

export interface RowFacts {
  position: ComparePosition;
  /** Закрытые расценки в порядке колонок — ВКЛЮЧАЯ аномальные: разброс
   *  считается по всем ценам, минимум ищет обходной путь мимо них. */
  bids: Array<{ contractorId: string; price: number }>;
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

export function analyzeComparison(groups: PositionGroup[], contractors: Contractor[]): ComparisonFacts {
  const byContractor = new Map(contractors.map((c) => [c.id, c]));
  const rows: RowFacts[] = groups.flatMap((group) => group.positions.map((position) => {
    const closed = contractors
      .filter((c) => c.prices[position.id] !== undefined)
      .map((c) => ({ contractorId: c.id, price: c.prices[position.id] }));

    const prices = closed.map((b) => b.price);
    const min = Math.min(...prices);
    const spread = prices.length > 1 ? ((Math.max(...prices) - min) / min) * 100 : null;

    /* Минимум — лучшая НЕаномальная цена при живой конкуренции (§4.6). */
    const fair = closed.filter((b) => !hasAnomaly(cellMark(byContractor.get(b.contractorId)!, position.id)));
    const bestId = fair.length && prices.length > 1
      ? fair.reduce((best, b) => (b.price < best.price ? b : best)).contractorId
      : null;

    return {
      position,
      bids: closed,
      median: medianOf(prices),
      spread,
      spreadTag: spread === null ? null
        : spread >= SPREAD_HIGH ? 'high'
          : spread >= SPREAD_NOTICEABLE ? 'noticeable' : 'none',
      bestId,
      anomaly: closed.some((b) => hasAnomaly(cellMark(byContractor.get(b.contractorId)!, position.id))),
      declined: contractors.some((c) => cellMark(c, position.id).declined === true),
      missing: !position.removed
        && contractors.some((c) => c.prices[position.id] === undefined && cellMark(c, position.id).declined !== true),
      maxPot: Math.max(0, ...contractors.map(
        (c) => (cellMark(c, position.id).potential ?? 0) * position.qty,
      )),
      weight: position.removed || !prices.length ? 0 : Math.max(...prices) * position.qty,
    };
  }));

  const sumWeight = rows.reduce((acc, r) => acc + r.weight, 0);
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
    case 'key': return facts.position.key === true;
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

/* ═══════════════════ СОСТОЯНИЕ ЭКРАНА И ПРЕСЕТЫ ═══════════════════ */

export type CompareMetricId = 'price' | 'deviation' | 'potential';
export type RowViewId = 'sections' | 'weight' | 'potential';

export interface CompareView {
  preset: PresetId;
  mainMetric: CompareMetricId;
  extraMetrics: CompareMetricId[];
  rowView: RowViewId;
  filters: PredicateId[];
}

export type PresetId = 'overview' | 'bidding' | 'anomalies';

/** Пресет — не фильтр, а сохранённая комбинация ЧЕТЫРЁХ осей состояния:
 *  показатель ячейки, подстрочники, вид строк, активные предикаты. Один клик —
 *  ответ на один вопрос: что вообще предложили → где можно отжать → где врут.
 *  Присваивает оси ЦЕЛИКОМ и своей логики не имеет. */
export const PRESETS: Record<PresetId, Omit<CompareView, 'preset'>> = {
  overview: { mainMetric: 'price', extraMetrics: [], rowView: 'sections', filters: [] },
  bidding: { mainMetric: 'potential', extraMetrics: ['price'], rowView: 'potential', filters: ['pot'] },
  anomalies: { mainMetric: 'deviation', extraMetrics: ['price'], rowView: 'weight', filters: ['anomaly'] },
};

export const PRESET_LABEL: Record<PresetId, string> = {
  overview: 'Обзор',
  bidding: 'Торги',
  anomalies: 'Аномалии',
};

export const METRIC_LABEL: Record<CompareMetricId, string> = {
  price: 'Цена', deviation: 'Отклонение', potential: 'Потенциал',
};

export const ROW_VIEW_LABEL: Record<RowViewId, string> = {
  sections: 'По разделам', weight: 'По весу', potential: 'По потенциалу',
};

/** Показатели ячейки: главный крупно, остальные подстрочником, максимум три. */
export const shownMetrics = (view: CompareView): CompareMetricId[] =>
  [...new Set([view.mainMetric, ...view.extraMetrics])].slice(0, 3);

/** Переход «анализ → таблица» (06-ai-contract.md §5, §7): пресет задаёт
 *  главный показатель, вид строк и фильтр; required_metrics лишь ДОБАВЛЯЕТ
 *  показатели, нужные выводу. Merge-семантика: набор пользователя объединяется
 *  с набором пресета и обязательными, при лимите трёх вытесняются самые старые
 *  вторичные подписи — новый главный и обязательные сохраняются. */
export function applyTransition(
  view: CompareView,
  transition?: { preset: PresetId; requiredMetrics?: CompareMetricId[] },
): CompareView {
  if (!transition) return view;
  const base = PRESETS[transition.preset];
  const extra = [...new Set([...base.extraMetrics, ...(transition.requiredMetrics ?? [])])]
    .filter((m) => m !== base.mainMetric)
    .slice(0, 2);
  return {
    preset: transition.preset,
    mainMetric: base.mainMetric,
    extraMetrics: extra,
    rowView: base.rowView,
    filters: [...base.filters],
  };
}

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((x) => b.includes(x));

/** Ушли ли от базы пресета хоть по одной из четырёх осей. Молча терять это
 *  нельзя: пользователь обязан видеть, что смотрит не на «Обзор», а на свою
 *  собственную нарезку. */
export const isModifiedView = (view: CompareView): boolean => {
  const base = PRESETS[view.preset];
  return view.mainMetric !== base.mainMetric
    || view.rowView !== base.rowView
    || !sameSet(view.filters, base.filters)
    || !sameSet(view.extraMetrics, base.extraMetrics);
};
