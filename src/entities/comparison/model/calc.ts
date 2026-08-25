/** СЧЁТ сравнения: итоги по КП, ранжир, разброс и производные числа строки.
 *  Формы данных — в `contract.ts`, пороги — в `thresholds.ts`; здесь только
 *  арифметика над ними, и вся она чистая (одни аргументы на входе — одно
 *  число на выходе), поэтому проверяется `comparison.check.ts` без DOM.
 *
 *  ПРОИЗВОДНОЕ СЧИТАЕТСЯ ОДНИМ ПРОХОДОМ `analyzeComparison()` и только здесь:
 *  таблица, фильтры, счётчики и попап читают одни и те же числа. */

import type { Tone } from '@/shared/ui/Badge';
import { POTENTIAL_MIN, type CompareThresholds } from './thresholds';
import {
  bidStage, cellMark, countsInAnalysis, hasAnomaly, isWaiting, pendingCorrection,
  type BidStage, type ComparePosition, type Contractor, type PositionGroup,
} from './contract';
/* ТОЛЬКО ТИП, и потому цикла нет: `view.ts` читает предикаты, предикаты
   читают этот файл. `import type` стирается компилятором — в рантайме ребра
   графа не появляется. Держать `CompareMetricId` здесь копией было бы хуже:
   селект показателя и формула его значения обязаны знать одно перечисление. */
import type { CompareMetricId } from './view';

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
  /** Стадия участника — поднята из подрядчика, чтобы шапка колонки и ячейки
   *  не спрашивали её у двух разных источников. */
  stage: BidStage;
  /** Идёт ли колонка В СЧЁТ. Приглашённый и закрытый доступ — нет: у первого
   *  цен нет вовсе, второй показывается справочно (`contractor.md` §4).
   *  Ранг у таких колонок 0 — «места нет», а не «последнее место». */
  counts: boolean;
  /** Δ к ЛИДЕРУ в деньгах и процентах — числа шапки (`contractor.md` §2).
   *  У самого лидера `null`: «+0 %» на первом месте читалось бы отставанием
   *  от кого-то ещё. У колонки вне счёта тоже `null` — сравнивать её итог с
   *  лидером значило бы поставить её в тот же ряд.
   *
   *  У НЕПОЛНОГО КП ТОЖЕ `null`, и это не пропуск. Итог неполного
   *  предложения заведомо занижен — в нём нечего складывать по незакрытым
   *  позициям, — и «−6,5 % к лидеру» читалось бы СКИДКОЙ там, где на деле
   *  не хватает 7 % сметы. Ровно поэтому `rankBids` и опускает такие КП в
   *  конец: сравнивать их итоги с полными нельзя, и показывать разницу
   *  числом — тем более. Шапка вместо Δ говорит про неполноту прямо. */
  deltaToLeader: { money: number; pct: number } | null;
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
    stage: bidStage(contractor),
    counts: countsInAnalysis(contractor),
  }));

  /* КОЛОНКИ ВНЕ СЧЁТА УХОДЯТ В ХВОСТ И МЕСТА НЕ ЗАНИМАЮТ (`contractor.md`
     §4). Приглашённый с нулевой суммой иначе оказался бы «лучшим
     предложением» — сортировка по сумме честно поставила бы ноль первым, и
     медаль уехала бы тому, кто вообще ничего не подал. */
  scored.sort((a, b) => (
    Number(!a.counts) - Number(!b.counts)
    || Number(a.percent < 100) - Number(b.percent < 100)
    || a.sum - b.sum
  ));

  const counted = scored.filter((b) => b.counts);
  const last = counted.length;
  const leaderSum = counted[0]?.sum ?? 0;

  return scored.map((bid, i) => {
    if (!bid.counts) {
      return {
        ...bid,
        rank: 0,
        tone: 'neutral' as Tone,
        rankLabel: bid.stage === 'invited' ? 'Приглашён, КП не подано'
          : bid.stage === 'draft' ? 'Черновик, не подан'
            : 'Доступ закрыт — в расчёте не участвует',
        deltaToLeader: null,
      };
    }
    const rank = i + 1;
    return {
      ...bid,
      rank,
      tone: (rank === 1 ? 'success' : rank === last ? 'danger' : 'warning') as Tone,
      rankLabel: rank === 1 ? 'Лучшее предложение' : `${rank}-е место`,
      /* Δ считается от ЛИДЕРА, а не от соседа по ранжиру: вопрос шапки —
         «насколько дороже лучшего», и цепочка «каждый к предыдущему» на него
         не отвечает. Нулевой итог лидера (ни одной цены во всём тендере)
         процента не даёт — деление на ноль вернуло бы Infinity молча. */
      deltaToLeader: rank === 1 || leaderSum === 0 || bid.percent < 100 ? null : {
        money: bid.sum - leaderSum,
        pct: ((bid.sum - leaderSum) / leaderSum) * 100,
      },
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

/* ═══════════════════ ПРОИЗВОДНЫЕ ЧИСЛА СТРОКИ ═══════════════════ */

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
  /** Подрядчики с лучшей НЕаномальной ценой. МАССИВ, а не одно имя: равные
   *  значения дают СОВМЕСТНЫЙ минимум, и штамп «мин» обязан стоять у обеих
   *  ячеек (`cell.md` §2). Одним полем это было невыразимо — приходилось
   *  выбирать одного из равных, и выбирал его порядок колонок.
   *  Пусто — конкуренции нет (меньше двух цен) либо все цены аномальны. */
  bestIds: string[];
  /** Подрядчики с ВЕРХНЕЙ границей строки — тем же правилом совместности.
   *  Максимум слабее минимума и бейджа не получает: он рисуется тихой
   *  засечкой над числом (§2.5, правило «слов в ячейках нет»). Аномальные
   *  цены сюда НЕ попадают по той же причине, что и в минимум: верхняя
   *  граница торга — это самое дорогое ЧЕСТНОЕ предложение, а выброс уже
   *  помечен своим знаком. */
  maxIds: string[];
  /** Есть ли в строке аномальная расценка — подъём ячейковой пометки на
   *  строку для фильтра и счётчика: у строки нет своей аномалии, есть чужие. */
  anomaly: boolean;
  /** Отказ и пробел данных — разные состояния и разные счётчики: отказ это
   *  решение подрядчика, отсутствие расценки — дыра в КП (§4 слой 3). */
  declined: boolean;
  missing: boolean;
  /** Ждём ответ хотя бы от одного (§2.8). Отдельно от `missing`: пробел
   *  требует запроса, ожидание — терпения, и в счётчике полноты это разные
   *  числа. */
  waiting: boolean;
  /** Максимум заявленного потенциала по строке, ₽ ПО СТРОКЕ (за единицу ×
   *  общий объём): сортировка «По потенциалу», фильтр и СТОЛБЕЦ «Потенциал»
   *  (§1.6) читают его. */
  maxPot: number;
  /** Заявленный запас каждого, ₽ по строке, СВЕРХУ ВНИЗ. Разбор столбца
   *  «Потенциал» («за счёт кого собран») читает готовый список, а не
   *  пересобирает его из подрядчиков на каждом наведении: строк 65, колонок
   *  десяток, и попап обязан открываться, а не считать.
   *  Пусто — запаса не заявил никто. */
  pots: Array<{ contractorId: string; value: number }>;
  /** Вес строки — сумма по самому дорогому предложению: «во сколько обойдётся
   *  в худшем случае», оценка риска, а не факта. У снятой строки вес 0. */
  weight: number;
  /** Строка попала в ключевые ПРАВИЛОМ «топ по весу до накопительной доли
   *  keyShare» — независимо от ручной пометки `position.key`. */
  keyDerived: boolean;
  /** Подрядчики, приславшие по этой работе НЕРАССМОТРЕННУЮ корректировку
   *  объёма, в порядке колонок. Знак ⚠ в строке — это `length`, а цифра при
   *  нём — она же, но только от двух (разбор 23.08.2026 §5, §6). Список, а не
   *  число: клик по знаку ведёт к ПЕРВОЙ такой ячейке слева направо, и «кто
   *  именно» нужно знать. */
  corrections: string[];
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
  /** Вес САМОЙ ТЯЖЁЛОЙ строки — база нормировки полосы вклада (§4.2,
   *  `position.md` §2). Канон нормирует по ЛИДЕРУ, а не по сотне: на 137
   *  позициях доли редко выходят за 20 %, и деление на 100 % прятало бы
   *  разницу между 12,4 % и 18,7 % в двух почти одинаковых огрызках полосы.
   *  Ноль — весов нет вовсе (ни одной цены), полосы не рисуются. */
  maxWeight: number;
  /** ЛИНИЯ ОТСЕЧКИ КЛЮЧЕВЫХ (§1.3): сколько строк вошло в набор и какую долю
   *  стоимости они на самом деле набрали. Считается ЗДЕСЬ, потому что здесь
   *  же набор и собирается — второй проход по отсортированным весам в
   *  компоненте дал бы подпись, которая расходится с самой линией на
   *  граничных данных. */
  keyCut: { rows: number; share: number };
  /** Сколько НЕРАССМОТРЕННЫХ корректировок объёма у каждого подрядчика —
   *  знак ⚠ в шапке его колонки. Считается ОДНИМ проходом здесь, а не в
   *  карточке: ось строки и ось колонки обязаны складывать одно и то же
   *  множество ячеек, иначе «3» в шапке и три знака в строках разойдутся.
   *  Ключа нет — корректировок у подрядчика не осталось, и знака в шапке
   *  тоже (не ноль: нуля на экране быть не должно вовсе). */
  correctionsBy: Map<string, number>;
}

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
  /* СЧИТАЕМ ТОЛЬКО ПО УЧАСТНИКАМ (`contractor.md` §4). Приглашённый без цен
     и колонка с закрытым доступом стоят в таблице, но в арифметику не входят
     ни одним числом: иначе замок обвалил бы медиану строки, а приглашённый
     добавил бы пустую цену в разброс. Фильтр стоит ОДИН раз здесь, а не у
     каждой из шести формул ниже. */
  const counted = contractors.filter(countsInAnalysis);
  const rows: RowFacts[] = groups.flatMap((group) => group.positions.map((position) => {
    const closed = counted
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

    /* Минимум и максимум — КРАЯ ЧЕСТНОГО диапазона при живой конкуренции.
       Аномальные цены не претендуют ни на тот, ни на другой: выброс уже
       помечен своим знаком, и делать его «лучшей ценой» или «верхней
       границей торга» значило бы дважды сказать о нём разное.

       РАВНЫЕ ЗНАЧЕНИЯ — СОВМЕСТНЫЕ (`cell.md` §2): собираем ВСЕХ, кто стоит
       на краю, а не первого встречного. Сравнение по строгому `<` выбирало
       из двух одинаковых цен ту, что левее, — и штамп «мин» переезжал между
       колонками при перестановке звёздочкой, хотя данные не менялись. */
    const fair = bids.filter((b) => !b.anomaly);
    const edge = (pick: (a: number, b: number) => number): string[] => {
      if (!fair.length || prices.length < 2) return [];
      /* Редьюсер оборачивается стрелкой НАМЕРЕННО: `reduce(Math.min)` отдал бы
         в Math.min ещё индекс и сам массив — четыре аргумента вместо двух, и
         результат становится NaN. Ловится это только тестом: экран при таком
         NaN просто перестаёт ставить штампы, ничего не ломая на вид. */
      const target = fair.map((b) => b.price).reduce((a, b) => pick(a, b));
      return fair.filter((b) => b.price === target).map((b) => b.contractorId);
    };

    const pots = counted
      .map((c) => ({
        contractorId: c.id,
        value: (cellMark(c, position.id).potential ?? 0) * position.qty,
      }))
      .filter((p) => p.value > 0)
      .sort((a, b) => b.value - a.value);

    return {
      position,
      bids,
      median: medianOf(prices),
      spread: spreadPct,
      spreadTag: spreadPct === null ? null
        : spreadPct >= thresholds.spreadHigh ? 'high'
          : spreadPct >= thresholds.spreadNoticeable ? 'noticeable' : 'none',
      bestIds: edge(Math.min),
      maxIds: edge(Math.max),
      anomaly: bids.some((b) => b.anomaly),
      declined: counted.some((c) => cellMark(c, position.id).declined === true),
      /* Пробел — ТОЛЬКО там, где не ждут ответа и не отказались: три разных
         состояния и три разных действия (§2.8). */
      missing: !position.removed
        && counted.some((c) => c.prices[position.id] === undefined
          && cellMark(c, position.id).declined !== true
          && !isWaiting(c, position.id)),
      waiting: !position.removed && counted.some((c) => isWaiting(c, position.id)),
      maxPot: pots[0]?.value ?? 0,
      pots,
      weight: position.removed || !prices.length ? 0 : Math.max(...prices) * position.qty,
      keyDerived: false,
      /* Порядок — как у колонок, потому что клик по знаку строки ведёт к
         первой ячейке СЛЕВА НАПРАВО. Снятая строка корректировок не берёт:
         решать по позиции, которой в смете больше нет, нечего. */
      corrections: position.removed ? [] : counted
        /* Корректировка живёт при ЦЕНЕ: поставщик говорит «эта сумма — за
           другой объём». Без цены (пробел, отказ) говорить не о чем, и
           считать такую ячейку значило бы обещать переход к знаку, которого
           на экране нет. */
        .filter((c) => c.prices[position.id] !== undefined
          && pendingCorrection(cellMark(c, position.id)) !== undefined)
        .map((c) => c.id),
    };
  }));

  /* Ключевые по правилу «топ по весу»: минимальное число самых тяжёлых строк,
     чья накопительная доля достигает keyShare; строка отсечки включается
     (metrics.md §8). Снятые и неоценённые строки веса не имеют — в набор не
     попадают. Ручные пометки `position.key` добавляются ПОВЕРХ этого. */
  const sumWeight = rows.reduce((acc, r) => acc + r.weight, 0);
  let keyCut = { rows: 0, share: 0 };
  let maxWeight = 0;
  if (sumWeight > 0) {
    let acc = 0;
    let count = 0;
    for (const row of [...rows].sort((a, b) => b.weight - a.weight)) {
      if (row.weight <= 0) break;
      if (!count) maxWeight = row.weight;
      acc += row.weight;
      count += 1;
      row.keyDerived = true;
      if ((acc / sumWeight) * 100 >= thresholds.keyShare) break;
    }
    /* ФАКТИЧЕСКИЙ охват, а не порог: подпись линии говорит «3 позиции · 95 %
       стоимости», и 95 здесь — то, что набралось, а не то, что просили. Набор
       собирается ДО первого пересечения порога, поэтому он почти всегда чуть
       больше — соврать округлением до порога значило бы обещать 80 % там,
       где лежит 95. */
    keyCut = { rows: count, share: (acc / sumWeight) * 100 };
  }

  /* Счётчик шапки — свёртка тех же списков, а не второй обход данных. */
  const correctionsBy = new Map<string, number>();
  for (const row of rows) {
    for (const id of row.corrections) {
      correctionsBy.set(id, (correctionsBy.get(id) ?? 0) + 1);
    }
  }

  return {
    rows,
    byId: new Map(rows.map((r) => [r.position.id, r])),
    sumWeight, maxWeight, keyCut, correctionsBy,
  };
}

/** ЗНАЧЕНИЕ ПАРЫ «работа × подрядчик» В ДЕНЬГАХ выбранного режима: стоимость —
 *  расценка × общий объём, потенциал — заявленный запас за единицу × объём.
 *
 *  ЖИВЁТ ЗДЕСЬ, А НЕ В КОМПОНЕНТЕ ИТОГА, потому что читателей стало трое:
 *  строка «Итого» (`TotalRow`), строка «Показано» видимого среза (§1.1) и
 *  «Итого секция». Пока читатель был один, приватная функция рядом с ним была
 *  честной; трое, складывающих одно и то же по трём формулам, — способ
 *  получить экран, который спорит сам с собой. */
export function cellValue(
  contractor: Contractor, row: RowFacts, metric: CompareMetricId,
): number {
  if (metric === 'potential') {
    return (cellMark(contractor, row.position.id).potential ?? 0) * row.position.qty;
  }
  return (contractor.prices[row.position.id] ?? 0) * row.position.qty;
}

/** Сумма показателя по НАБОРУ строк для одной колонки — общая формула строк
 *  «Итого», «Итого секция» и «Показано». Разница между ними ровно одна: какой
 *  набор строк передали. */
export const sumRows = (
  contractor: Contractor, rows: readonly RowFacts[], metric: CompareMetricId,
): number => rows.reduce((acc, r) => acc + cellValue(contractor, r, metric), 0);

/* ═══════════════════ ИТОГИ УРОВНЯ ТЕНДЕРА ═══════════════════ */

export interface MetricTotals {
  /** Итог ЛУЧШЕГО КП по закрытым позициям — «текущая стоимость» тендера.
   *  Ни одного предложения — null: тире, а не ноль (ноль означал бы согласие). */
  best: number | null;
  /** Σ заявленного запаса по строкам торга — «потенциал стоимости». */
  potential: number;
}

/** Пара «стоимость → потенциал» одним проходом. Читатели — меню основного
 *  показателя и его шкала соотношения.
 *
 *  ФОРМУЛА ПОТЕНЦИАЛА ТА ЖЕ, что у точек торгов разбора (`analysis.ts`):
 *  строки с запасом от POTENTIAL_MIN и живой конкуренцией (две закрытые
 *  расценки). Две реализации одной величины разъехались бы при первой правке
 *  порога, поэтому отбор живёт здесь, а не у каждого читателя свой. */
export function metricTotals(rows: RowFacts[], bids: Bid[]): MetricTotals {
  return {
    best: bids[0]?.sum ?? null,
    potential: rows.reduce(
      (acc, r) => acc + (r.maxPot >= POTENTIAL_MIN && r.bids.length >= 2 ? r.maxPot : 0),
      0,
    ),
  };
}

/* ═══════════════════ ФОРМА РЯДА ЦЕН (§3 правок владельца 25.08.2026) ═══════

   Полоска распределения в разборе разброса показывает ФОРМУ ряда: сбились ли
   предложения в кучу и стоит ли кто-то особняком. Считается ЗДЕСЬ, а не в
   разметке, по той же причине, что и всё производное: точка на полоске — это
   нормированная цена, то есть число, а числа экрана живут в модели и
   проверяются `comparison.check.ts`. Глазами неверную нормировку не поймать
   вовсе — точки правдоподобны в любом положении. */

/** Точка полоски: доля 0…1 внутри собственных MIN–MAX ряда и сколько цен в
 *  неё схлопнулось. `ids` — чьи именно: подпись точки называет их поимённо. */
export interface SpreadPoint {
  at: number;
  n: number;
  ids: string[];
}

/** Насколько близко должны стоять две цены, чтобы слиться в один маркер
 *  количества. 4 % ДЛИНЫ полоски, а не денег: полоска нормирована, и порог
 *  обязан быть в тех же единицах, иначе на узком ряду сливалось бы всё, а на
 *  широком — ничего. Число — из геометрии: точка 8px на треке ~200px это ровно
 *  4 %, то есть порог «точки соприкоснулись». */
const CLUSTER = 0.04;

/**
 * Точки полоски распределения по СОПОСТАВИМЫМ ценам строки.
 *
 * Аномальные не участвуют: полоска отвечает на вопрос «как разошлись честные
 * предложения», и выброс, растянув шкалу вдвое, сплющил бы весь остальной ряд
 * в одну кляксу у левого края — то есть спрятал бы ровно то, ради чего её и
 * смотрят. Сам выброс при этом назван отдельной строкой разбора.
 *
 * Пропуски и отказов точек не создают — цены нет вовсе (§3).
 *
 * Меньше двух сопоставимых цен — пустой массив: полоска из одной точки
 * показывает не форму ряда, а его отсутствие.
 */
export function spreadPoints(row: RowFacts): SpreadPoint[] {
  const fair = row.bids.filter((b) => !b.anomaly);
  if (fair.length < 2) return [];
  const prices = fair.map((b) => b.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min;
  const sorted = [...fair].sort((a, b) => a.price - b.price);

  const out: SpreadPoint[] = [];
  for (const bid of sorted) {
    /* Все цены равны — span 0: ряд сошёлся, и вся стопка стоит по центру.
       Делить на ноль здесь не «граничный случай», а штатный тендер, где
       подрядчики сговорились или переписали одну смету. */
    const at = span === 0 ? 0.5 : (bid.price - min) / span;
    const last = out[out.length - 1];
    if (last && at - last.at <= CLUSTER) {
      /* Слияние: маркер встаёт в ЦЕНТР схлопнутой группы, а не на первую из
         цен — иначе цифра «3» показывала бы место самой дешёвой из трёх. */
      last.at = (last.at * last.n + at) / (last.n + 1);
      last.n += 1;
      last.ids.push(bid.contractorId);
      continue;
    }
    out.push({ at, n: 1, ids: [bid.contractorId] });
  }
  return out;
}

/** Во сколько раз цена расходится с медианой строки — коэффициент k разбора
 *  аномалий. Медианы нет или она нулевая — null: «в ноль раз» это не ответ. */
export const anomalyRatio = (price: number, median: number | null): number | null =>
  median === null || median === 0 ? null : price / median;

/** Изменение цены к СОБСТВЕННОМУ прошлому КП подрядчика, % со знаком —
 *  спутник «Динамика» (§3.1).
 *
 *  База — цена того же подрядчика прошлого круга, а не чужие предложения:
 *  вопрос спутника «подвинулся ли ОН», и сравнение с соседями по строке
 *  отвечало бы на вопрос отклонения второй раз.
 *
 *  `null` в трёх случаях, и все три — «сравнивать не с чем», а не «не
 *  менялось»: прошлой цены нет вовсе (первый круг или позиция не была
 *  закрыта), она нулевая (делить не на что), текущей нет. Ноль здесь имеет
 *  собственный смысл — «подал ту же цену», — и подменять им отсутствие базы
 *  нельзя. */
export const dynamicsPct = (
  price: number | undefined, prev: number | undefined,
): number | null => (
  price === undefined || prev === undefined || prev === 0
    ? null
    : ((price - prev) / prev) * 100
);
