/** РАСЧЁТ ШИРИН КОЛОНОК СРАВНЕНИЯ КП — единственное место, где решается,
 *  сколько пикселей достаётся каждой колонке. Чистая функция: одни входы —
 *  одна раскладка, поэтому проверяется `columns.check.ts` без DOM.
 *
 *  ЗАЧЕМ АЛГОРИТМ ВМЕСТО ФОРМУЛ НА CSS. Прежний контракт (`clamp()` на cqw +
 *  ступени плотности) держался на трёх магических числах левого блока и
 *  ступенях, подобранных под три КП; имя подрядчика в него входило только
 *  потолком. Здесь всё наоборот: ширины выводятся из ИЗМЕРЕННОГО содержимого
 *  (пол колонки подрядчика — её полное имя, см. замерщик в TenderCompare) и
 *  фактического доступного места, а не из догадок о том, сколько места
 *  займут другие колонки.
 *
 *  ТРИ РЕЖИМА.
 *  «Влезает» — левые колонки на базовых ширинах, подрядчикам достаётся
 *  РАВНАЯ доля остатка (колонки сравнивают столбиком, равенство — часть
 *  смысла), каждый не ниже своего пола и не выше потолка; название позиции
 *  губкой забирает весь излишек.
 *  «Полы доминируют» — чей-то пол выше равной доли: тогда каждый КП стоит
 *  на своём полу (имена НЕ равны — осознанный выбор владельца,
 *  23.08.2026), а поджимается только левый блок, ровно настолько, чтобы
 *  название удержало минимум.
 *  «Панорама» — сумма полов больше доступного вовсе: все на полах,
 *  лента прокручивается горизонтально внутри блока.
 *
 *  ПОЛ КОЛОНКИ ПОДРЯДЧИКА — ЕЁ ИМЯ ЦЕЛИКОМ (замеренный текст + хром
 *  карточки): название, по которому колонку опознают, не имеет права
 *  обрезаться многоточием. Из-за этого колонки НЕ равны при сильно разных
 *  именах — осознанный выбор владельца (23.08.2026).
 *
 *  МОНОТОННОСТЬ ГАРАНТИРОВАНА: расширение доступной ширины никогда не
 *  сужает колонку — проверяется в columns.check.ts, потому что глазами на
 *  живом экране обратное не поймать (числа правдоподобны в любом порядке).
 */

/* ── конфиг ────────────────────────────────────────────────────────────────
   Все числа системы в одном месте — вместо разбросанных по ступеням CSS
   переменных. База — комфортная ширина; пол — последняя ступень перед тем,
   как содержимое колонки перестаёт читаться. */

const LEAD = {
  /** Количество: «1 234 567» с паддингами. */
  qty: { base: 104, min: 76 },
  /** Единица: «компл.». */
  unit: { base: 88, min: 60 },
  /** Разброс: процент + микрошкала 24px. */
  spread: { base: 96, min: 72 },
} as const;

/** Название позиции: ниже двух слов якорная колонка теряет смысл. */
const TITLE_MIN = 200;

/** Пол колонки подрядчика БЕЗ учёта имени: итог в рублях и капсула статуса
 *  карточки ещё не переносятся. Имя почти всегда поднимает выше. */
const BID_ABS_MIN = 150;

/** Потолок доли подрядчика: шире колонка начинает пустеть. Имя его
 *  преодолевает — пол имени сильнее эстетики равных потолков. */
const BID_MAX = 280;

const LEAD_BASE = LEAD.qty.base + LEAD.unit.base + LEAD.spread.base;
const LEAD_MIN = LEAD.qty.min + LEAD.unit.min + LEAD.spread.min;

export interface ColumnLayoutInput {
  /** Видимая ширина скроллблока ленты, px (clientWidth: вертикальный
   *  скроллбар уже исключён). */
  available: number;
  /** Полы колонок подрядчиков — от полного имени. */
  bids: ReadonlyArray<{ id: string; floor: number }>;
}

export interface ColumnLayout {
  qty: number;
  unit: number;
  spread: number;
  title: number;
  /** Ширины колонок КП по id подрядчика. */
  bids: Record<string, number>;
  /** Сумма полов больше доступного места: все на полах, лента панорамирует. */
  pan: boolean;
}

/** Ширина колонки подрядчика при данной равной доле: пол держит, потолок
 *  останавливает. */
const bidAt = (min: number, share: number): number =>
  Math.max(min, Math.min(share, BID_MAX));

/* ЛЕВЫЙ БЛОК: раздача бюджета от полов по запасу каждой колонки. Целые
   остатки распределяются ДО КОНЦА по фиксированному порядку — сумма трёх
   ширин равна бюджету точно, поэтому название (оно получает всё, что
   осталось после левого блока и долей) растёт монотонно с окном и не
   дрожит на границах округления. */
function allocLeads(total: number): { qty: number; unit: number; spread: number } {
  const cols = [
    { min: LEAD.qty.min, room: LEAD.qty.base - LEAD.qty.min },
    { min: LEAD.unit.min, room: LEAD.unit.base - LEAD.unit.min },
    { min: LEAD.spread.min, room: LEAD.spread.base - LEAD.spread.min },
  ];
  const allRoom = cols.reduce((acc, c) => acc + c.room, 0);
  const extra = Math.max(0, Math.min(total, LEAD_BASE) - LEAD_MIN);
  const extras = cols.map((c) => Math.floor((extra * c.room) / allRoom));
  /* Остаток считается ПО ДОБАВКАМ, а не по полным ширинам: смешать их здесь
     значило бы, что топ-ап не срабатывает никогда, бюджет недирается на
     число усечений, и название дрожит на каждом шаге окна. */
  let rest = extra - extras.reduce((acc, w) => acc + w, 0);
  for (let i = 0; rest > 0 && i < cols.length; i++) {
    const take = Math.min(rest, cols[i].room - extras[i]);
    extras[i] += take;
    rest -= take;
  }
  return {
    qty: cols[0].min + extras[0],
    unit: cols[1].min + extras[1],
    spread: cols[2].min + extras[2],
  };
}

export function computeColumnLayout({
  available, bids,
}: ColumnLayoutInput): ColumnLayout {
  const mins = bids.map(({ id, floor }) => ({ id, min: Math.max(BID_ABS_MIN, floor) }));
  const sumMins = mins.reduce((acc, b) => acc + b.min, 0);
  const n = Math.max(mins.length, 1);

  /* Панорама: свободного места меньше, чем сумма полов. Все встают на полы;
     названию достаётся излишек, если он есть, — мёртвой дыры у правого края
     лента не показывает никогда. */
  if (available < LEAD_MIN + TITLE_MIN + sumMins) {
    const out: Record<string, number> = {};
    for (const { id, min } of mins) out[id] = min;
    return {
      qty: LEAD.qty.min, unit: LEAD.unit.min, spread: LEAD.spread.min,
      title: Math.max(TITLE_MIN, available - LEAD_MIN - sumMins),
      bids: out, pan: true,
    };
  }

  /* Сколько места остаётся названию при данном суммарном левом блоке.
     Строго убывает по leadTotal: больше слева — меньше доля КП справа. */
  const leftoverForTitle = (leadTotal: number): number => {
    const share = (available - leadTotal - TITLE_MIN) / n;
    const sumBids = mins.reduce((acc, b) => acc + bidAt(b.min, share), 0);
    return available - leadTotal - sumBids;
  };

  /* РЕЖИМ «ПОЛЫ ДОМИНИРУЮТ»: хотя минимумы влезают, равная доля не проходит —
     чей-то пол выше доли, и остальные колонки съедают место названия. Тогда
     каждый КП стоит на своём полу, а поджимается только левый блок, ровно
     настолько, чтобы название удержало минимум. */
  if (leftoverForTitle(LEAD_BASE) < TITLE_MIN) {
    const leadBudget = Math.min(LEAD_BASE, available - TITLE_MIN - sumMins);
    const { qty, unit, spread } = allocLeads(leadBudget);
    const out: Record<string, number> = {};
    for (const { id, min } of mins) out[id] = min;
    return {
      qty, unit, spread,
      title: available - qty - unit - spread - sumMins,
      bids: out, pan: false,
    };
  }

  /* Максимальный левый блок, при котором название удерживает свой минимум.
     База комфортнее — начинаем с неё и спускаемся бинарным поиском. */
  let lo = LEAD_MIN;
  let hi = LEAD_BASE;
  for (let i = 0; i < 40 && hi - lo > 0.5; i++) {
    const mid = (lo + hi) / 2;
    if (leftoverForTitle(mid) >= TITLE_MIN) lo = mid; else hi = mid;
  }
  const leadTotal = leftoverForTitle(hi) >= TITLE_MIN ? hi : lo;
  const { qty, unit, spread } = allocLeads(leadTotal);

  /* Доли подрядчиков округляются ВНИЗ: остаток замыкает название. Сумма
     колонок сходится ровно в доступную ширину (иначе у правого края вечная
     щель или лишний скролл), и минимум названия не нарушается никогда. */
  const share = (available - qty - unit - spread - TITLE_MIN) / n;
  const out: Record<string, number> = {};
  let sumBids = 0;
  for (const { id, min } of mins) {
    out[id] = Math.floor(bidAt(min, share));
    sumBids += out[id];
  }
  const title = available - qty - unit - spread - sumBids;

  return { qty, unit, spread, title: Math.max(title, TITLE_MIN), bids: out, pan: false };
}
