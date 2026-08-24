/** Самопроверка сравнения КП. Импорт — через публичную точку слайса ('..'):
 *  проверка описывает КОНТРАКТ наружу, а не устройство сегментов, и переезд
 *  функции из calc.ts в filters.ts её ронять не должен.
 *
 *  Третье место в проекте, где ошибка была бы
 *  тихой: ранжир не падает — он молча объявляет победителем не того. Дешёвое
 *  неполное КП обязано уходить ВНИЗ, а не наверх, и глазами на живых данных
 *  эту перестановку не поймать: суммы правдоподобны в любом порядке.
 *  Запуск: bun src/entities/comparison/model/comparison.check.ts
 *  Фреймворка нет намеренно — то же соглашение, что у registry.check.ts. */
import { strict as assert } from 'node:assert';
import {
  analyzeComparison, bidStatus, cellLines, cellMark, clampThresholds, decimal,
  deviationPct, filterRows, flatten, groupSum, hasAnomaly, isModifiedView, medianOf, money,
  moneyCompact, pendingCorrection, predicateCount, predicatePasses, PRESETS, rankBids, spread, sumOf,
  SYSTEM_THRESHOLDS, termRows, hasTerms,
  type CellLine, type ComparePosition, type CompareThresholds, type CompareView,
  type Contractor, type PositionGroup,
} from '..';
import { MOCK_AXP, MOCK_COMPARISON } from '../api/comparison.mock';

// Живая фикстура — ровно так же, как её берёт экран: разделы из ответа,
// плоский список выводится из них.
const { groups: GROUPS, contractors: CONTRACTORS } = MOCK_COMPARISON;
const POSITIONS = flatten(GROUPS);

// ── стенд: две позиции по 10 единиц, чтобы суммы считались в уме ───────────
const P: ComparePosition[] = [
  { id: 'a', title: 'A', qty: 10, unit: 'шт' },
  { id: 'b', title: 'B', qty: 10, unit: 'шт' },
];
const who = (id: string, prices: Record<string, number>, fill = 100): Contractor => ({
  id, name: id, status: 'complete', fill, inn: '0', contact: '—',
  submitted: '01.01.2026', prices,
});

// ГЛАВНОЕ ПРАВИЛО: полнота КП важнее суммы. «Полупустой» подал вдвое дешевле
// всех, но закрыл смету наполовину — и обязан оказаться последним.
const ranked = rankBids([
  who('полупустой', { a: 10 }, 50),
  who('дорогой', { a: 100, b: 100 }),
  who('дешёвый', { a: 90, b: 100 }),
], P);
assert.deepEqual(ranked.map((b) => b.contractor.id), ['дешёвый', 'дорогой', 'полупустой']);
assert.deepEqual(ranked.map((b) => b.tone), ['success', 'warning', 'danger']);
assert.deepEqual(ranked.map((b) => b.rank), [1, 2, 3]);
assert.equal(ranked[0].sum, 1900);
assert.equal(ranked[2].percent, 50, 'заполненность приходит полем, а не из числа строк');
assert.equal(ranked[2].filled, 1, 'закрытых позиций всё равно считаем — для скринридера');
assert.equal(ranked[0].rankLabel, 'Лучшее предложение');

// Двое — значит «лучший» и «худший», янтарной середины нет.
assert.deepEqual(
  rankBids([who('x', { a: 1, b: 1 }), who('y', { a: 2, b: 2 })], P).map((b) => b.tone),
  ['success', 'danger'],
);

// Отсутствие цены — это не ноль: позиция не считается ни закрытой, ни
// бесплатной, иначе сумма занижалась бы молча.
assert.equal(sumOf(who('z', { a: 5 }), P), 50);

// ── разброс ───────────────────────────────────────────────────────────────
// Считается от минимума: «на сколько дороже самого дешёвого».
assert.equal(spread(P[0], [who('x', { a: 100 }), who('y', { a: 150 })]), 50);
// Одна расценка — сравнивать не с чем. null, а не 0: ноль означал бы, что все
// предложили одинаково.
assert.equal(spread(P[0], [who('x', { a: 100 })]), null);
assert.equal(spread(P[0], [who('x', { b: 100 }), who('y', { b: 1 })]), null);

// ── смета: разделы и плоский список ───────────────────────────────────────
// POSITIONS выводится из GROUPS, а не пишется вторым списком. Проверка на то,
// что вывод не подменили руками и id позиций уникальны: дубль id молча слил бы
// две строки сметы в одну расценку.
assert.equal(POSITIONS.length, GROUPS.reduce((n, g) => n + g.positions.length, 0));
assert.equal(new Set(POSITIONS.map((p) => p.id)).size, POSITIONS.length, 'id позиций уникальны');
assert.deepEqual(GROUPS.map((g) => g.positions.length), [5, 5, 4]);

// Итоги разделов складываются в итог по КП — иначе строка «Итого · Материалы»
// и сумма на карточке говорили бы разное, а проверить это глазами нельзя.
for (const contractor of CONTRACTORS) {
  const byGroups = GROUPS.reduce((acc, g) => acc + groupSum(g, contractor), 0);
  assert.equal(byGroups, sumOf(contractor, POSITIONS), contractor.name);
}

// ── живая фикстура ────────────────────────────────────────────────────────
// Суммы заданы заказчиком, а на экране они ВЫВОДЯТСЯ из расценок. Эти шесть
// равенств — единственное, что удержит фикстуру от расхождения с ними: правка
// любой расценки без правки соседней уронит проверку здесь, а не на экране.
/* Расценки сдвинуты так, чтобы при продуктовых порогах ярусов (metrics.md §7:
   заметный ≥ 15 %, высокий ≥ 40 %) в фикстуре жили все три яруса живьём, а
   формула аномалии при системном k = 3 находила пары из списка ниже. Новички
   (ss/pk/ds) стоят внутри вилок первых троих — ярусы разброса не двигали;
   единственный новый экстремум — выброс ds по швам (g2). */
const REFERENCE: Record<string, number> = {
  'АО «МетСнаб»': 11_978_180,
  'ООО «ИнженерГрупп»': 12_398_410,
  'ООО «СтройМонтаж»': 12_217_220,
  'АО «СпецСтройМонтажКомплект»': 12_345_970,
  'ООО «ПриволжскПромТехКомплект»': 12_019_420,
  'ООО «СибирьМонолитДомостройИнжиниринг»': 12_205_120,
};
for (const contractor of CONTRACTORS) {
  assert.equal(sumOf(contractor, POSITIONS), REFERENCE[contractor.name], contractor.name);
}
assert.deepEqual(CONTRACTORS.map((c) => c.fill), [100, 95, 88, 96, 72, 90]);

// Экран показывает шесть колонок, и каждая должна попадать в свой цвет: без
// этого зелёная/янтарная/красная шкала на странице не проверяется ничем.
const live = rankBids(CONTRACTORS, POSITIONS);
assert.deepEqual(live.map((b) => b.contractor.name),
  [
    'АО «МетСнаб»',
    'ООО «ПриволжскПромТехКомплект»',
    'ООО «СибирьМонолитДомостройИнжиниринг»',
    'ООО «СтройМонтаж»',
    'АО «СпецСтройМонтажКомплект»',
    'ООО «ИнженерГрупп»',
  ]);
assert.deepEqual(live.map((b) => b.tone),
  ['success', 'warning', 'warning', 'warning', 'warning', 'danger']);
// Полное КП стоит впереди независимо от суммы; единственное здесь и есть
// лидером — у остальных дыры означают деньги, которых в сравнении ещё нет.
assert.equal(live[0].percent, 100, 'первое место — у единственного полного КП');
assert.ok(live.slice(1).every((b) => b.percent < 100));
// Неполные между собой — по сумме, без перескоков.
for (let i = 2; i < live.length - 1; i++) {
  assert.ok(live[i].sum < live[i + 1].sum, `${live[i].contractor.id} < ${live[i + 1].contractor.id}`);
}
// Правило «неполное вниз» здесь не проверяется: в фикстуре полное КП и так
// самое дешёвое. Оно доказано выше, на стенде, где дешевле всех именно
// полупустой, — специально ради этого случая стенд и заведён.

// Разброс есть у каждой позиции, где расценок хотя бы две: одинаковых цен в
// фикстуре нет, и нулевой разброс означал бы опечатку в данных.
assert.deepEqual(
  POSITIONS.map((p) => { const g = spread(p, CONTRACTORS); return g === null || g > 0; }),
  POSITIONS.map(() => true),
);

// ── статус КП: незнакомый id с сервера ────────────────────────────────────
// Словарь статусов живёт на сервере и пополняется без нас. Новый id обязан
// дать нейтральную капсулу с самим id, а не уронить экран на undefined.label.
assert.equal(bidStatus('complete').label, 'Получено');
assert.equal(bidStatus('withdrawn').label, 'withdrawn');
assert.equal(bidStatus('withdrawn').tone, 'neutral');

// ── пустой ответ ──────────────────────────────────────────────────────────
// Тендер открыт, КП ещё не подано: расчёт обязан вернуть пустой список, а не
// упасть на Math.min от пустого массива.
assert.deepEqual(rankBids([], POSITIONS), []);
assert.equal(spread(P[0], []), null);
assert.equal(flatten([]).length, 0);

// Формат — часть данных: неразрывные пробелы и запятая приходят из Intl, но
// валюта и число знаков заданы нами, и подмена локали видна сразу.
assert.match(money(11840000), /^11.840.000\s?₽$/u);
assert.match(moneyCompact(164000), /^164\s?тыс\.?\s?₽$/u, 'формат примеров модели ячейки');
assert.equal(decimal(86.5), '86,5');
assert.equal(decimal(7.857), '7,9');

// Пороги зажимаются окном настроек: заметный не выше высокого, k и доли — в
// границах смысла. Незажатое значение тихо каскадировало бы во все метки.
const clamped = clampThresholds({
  spreadNoticeable: 50, spreadHigh: 40, anomalyK: 0, keyShare: 300,
});
assert.deepEqual(clamped, { spreadNoticeable: 40, spreadHigh: 40, anomalyK: 1, keyShare: 100 });

/* ═══════════ производные числа строки (анализ) ═══════════
   Четвёртое тихое место: минимум, метка разброса и медиана не падают — они
   молча советуют брать подозрительную цифру. Проверяются на живой фикстуре,
   где каждый ярус присутствует нарочно (норма R7). */
const FACTS = analyzeComparison(GROUPS, CONTRACTORS, SYSTEM_THRESHOLDS);
const factOf = (id: string) => {
  const f = FACTS.byId.get(id);
  assert.ok(f, `нет анализа у ${id}`);
  return f;
};
const contractor = (id: string) => CONTRACTORS.find((c) => c.id === id)!;

// Медиана по всем закрытым расценкам, включая аномальные.
assert.equal(medianOf([3, 1, 2]), 2);
assert.equal(medianOf([10, 20]), 15);
assert.equal(medianOf([]), null);
assert.deepEqual(
  factOf('m1').bids.map((b) => b.price),
  [5110, 5250, 5182, 5190, 5230, 5140],
);
assert.equal(factOf('m1').median, 5186);

// ГЛАВНОЕ ПРАВИЛО МИНИМУМА: лучшая НЕаномальная цена. Самая дешёвая расценка
// арматуры помечена аномалией — «мин» обязан уйти тому, у кого дешевле всех
// из честных: на шестерых это СибирьМонолитДомостройИнжиниринг (43 500).
const m2 = factOf('m2');
assert.ok(m2.anomaly, 'аномалия арматуры размечена в фикстуре');
assert.notEqual(m2.bestId, 'ms', 'аномально дешёвая цена выбывает из соревнования за минимум');
assert.equal(m2.bestId, 'ds');

// …и остаётся в разбросе: аномалия не вычищается из процента строки.
assert.ok(Math.abs(m2.spread! - 16.24) < 0.01, `разброс арматуры ${m2.spread}`);
assert.equal(m2.spreadTag, 'noticeable');

/* ── аномальность ячейки: внешний вердикт ИЛИ формула k ────────────────────
   При системном k = 3 на шестерых пар три: арматура МетСнаба (внешний
   вердикт; формула в этой строке молчит — поле широкое, отклонение больше не
   отрывается от медианы отклонений), вязка каркасов СтройМонтажа и швы
   СибирьМонолитДомостройИнжиниринга (формула) — обе в строках высокого разброса, где
   выброс и должен жить. */
const flaggedCells = (rowId: string): string[] =>
  factOf(rowId).bids.filter((b) => b.anomaly).map((b) => b.contractorId);
assert.deepEqual(flaggedCells('m2'), ['ms'], 'минимум арматуры держит внешний вердикт');
assert.deepEqual(flaggedCells('w3'), ['sm'], 'выброс в высокоразбросной строке находится формулой');
assert.deepEqual(flaggedCells('g2'), ['ds']);
assert.deepEqual(
  FACTS.rows.filter((r) => r.anomaly).map((r) => r.position.id).sort(),
  ['g2', 'm2', 'w3'],
  'аномалий три — больше фикстура не содержит',
);
// Флаг один, источники разные: у пары из данных есть причина, у формульной —
// нет (попап даст стандартную фразу, причина — поле внешнего вердикта).
assert.ok(typeof cellMark(contractor('ms'), 'm2').anomaly === 'string');
assert.ok(cellMark(contractor('sm'), 'w3').anomaly === undefined);

/* Стенды формулы (metrics.md §9):
   — равномерный ряд: при k = 3 тишина, при канонном k = 2 горят ОБА края —
     вырождение формулы на трёх участниках, ради которого системный старт
     поднят до трёх;
   — выброс 130 против пары 100/105: найден и при k = 3;
   — нулевая медиана цен и меньше трёх расценок: формула молчит. */
const STAND_ROWS: PositionGroup[] = [{
  id: 's', title: 'S',
  positions: [{ id: 'x', title: 'X', qty: 1, unit: 'шт' }],
}];
const standFlags = (
  prices: number[],
  t: CompareThresholds = SYSTEM_THRESHOLDS,
): string[] =>
  analyzeComparison(
    STAND_ROWS,
    prices.map((x, i) => who(`c${i}`, { x })),
    t,
  ).rows[0].bids.filter((b) => b.anomaly).map((b) => b.contractorId);

/* Ряд с точными долями отклонений (.5/.0/.5): проверка на «ровно пороге» не
   должна зависеть от хвостов float, поэтому не 10/11/12. */
const UNIFORM = [50, 100, 150];
assert.deepEqual(standFlags(UNIFORM, { ...SYSTEM_THRESHOLDS, anomalyK: 3 }), [],
  'равномерный ряд при k = 3 тих');
assert.deepEqual(standFlags(UNIFORM, { ...SYSTEM_THRESHOLDS, anomalyK: 2 }).sort(),
  ['c0', 'c2'], 'при канонном k = 2 мечены оба края — вырождение на трёх участниках');
assert.deepEqual(standFlags([100, 105, 130]), ['c2'], 'явный выброс найден при k = 3');
assert.deepEqual(standFlags([0, 0, 10]), [], 'нулевая медиана — формула не определяется');
assert.deepEqual(standFlags([5, 9]), [], 'меньше трёх расценок — формула молчит');

// Метка выводится из процента порогом, а не приходит полем: ярусы —
// продуктовые (metrics.md §7): noticeable ≥ 15, high ≥ 40. На фикстуре есть
// ВСЕ три яруса живьём, включая тихий.
assert.deepEqual(factOf('w4').spreadTag, null, 'одна расценка — сравнивать не с чем');
assert.equal(factOf('m4').spreadTag, null, 'у плёнки тоже одна расценка');
assert.equal(factOf('m1').spreadTag, 'none', '2,7 % — тихо');
assert.equal(factOf('m2').spreadTag, 'noticeable');
assert.equal(factOf('m5').spreadTag, 'none');
assert.deepEqual(
  FACTS.rows.filter((r) => r.spreadTag === 'high').map((r) => r.position.id),
  ['w3', 'g2'],
);

/* ── ключевые: ручная пометка ИЛИ правило «топ по весу» ────────────────────
   Производные ключевые — минимальный набор самых тяжёлых строк до накопительной
   доли 80 % (строка отсечки включается). На фикстуре это m1 → m2 → w1 → w3 →
   g1: ручные три попадают в правило сами, а w3 и g1 добавляются к ним. */
const derivedKeys = FACTS.rows.filter((r) => r.keyDerived).map((r) => r.position.id);
assert.deepEqual(derivedKeys.sort(), ['g1', 'm1', 'm2', 'w1', 'w3']);
assert.ok(!factOf('g4').keyDerived, 'снятая строка веса не имеет и в набор не попадает');
assert.equal(predicatePasses('key', factOf('w3')), true,
  'фильтр «Ключевые» видит производные, не только ручные');

// Отклонение от медианы: знак имеет значение, допуск симметричный.
assert.ok(Math.abs(deviationPct(49585, 45869) - 8.1) < 0.05);
assert.ok(deviationPct(42067, 45869) < -7, 'аномально дешёвая цена уходит вниз с минусом');

// Вес строки = максимум × объём; снятая строка веса не имеет вовсе.
assert.ok(factOf('m2').weight > factOf('m1').weight, 'арматура — самый тяжёлый ряд фикстуры');
assert.deepEqual(FACTS.rows.filter((r) => r.weight === 0).map((r) => r.position.id), ['g4']);
assert.ok(FACTS.sumWeight > 0);

// Отказ и пробел — разные состояния и разные счётчики.
assert.equal(factOf('g1').declined, true, 'СтройМонтаж отказался от гидроизоляции');
assert.equal(factOf('g1').missing, false, 'отказ — не пробел данных');
assert.deepEqual(FACTS.rows.filter((r) => r.missing).map((r) => r.position.id), ['m4', 'w4']);
assert.deepEqual(FACTS.rows.filter((r) => r.declined).map((r) => r.position.id), ['g1']);

// Потенциал хранится за единицу, в строку выходит умножением на общий объём.
assert.equal(cellMark(contractor('ms'), 'm1').potential, 150);
assert.equal(factOf('m1').maxPot, 150 * 420);

/* ═══════════ предикаты фильтров ═══════════ */
const ALL = FACTS.rows;
// Комбинируются по И; пустой набор показывает всё.
assert.deepEqual(filterRows(ALL, []).length, ALL.length);
assert.deepEqual(
  filterRows(ALL, ['key', 'spread']).map((r) => r.position.id),
  filterRows(ALL, ['spread']).filter((r) => predicatePasses('key', r)).map((r) => r.position.id),
);
// Счётчики считаются по всем данным до применения фильтра — иначе число на
// невыбранном пункте бесполезно. Значения согласованы с разметкой фикстуры:
// ключевых пять (ручные m1/m2/w1 плюс производные w3/g1 по доле 80 %), высоких
// (≥40 %) две, аномальных строк три (данные + формула k = 3), с потенциалом
// пять, дороже медианы на >5 % — восемь (шестёрка добавила w2).
const counted = (['key', 'spread', 'anomaly', 'pot', 'med'] as const).map((id) => [
  id, predicateCount(id, ALL),
]);
assert.deepEqual(Object.fromEntries(counted), { key: 5, spread: 2, anomaly: 3, pot: 5, med: 8 });

/* ═══════════ модель ячейки: оси, состав строк, пресеты ═══════════ */
const view: CompareView = {
  preset: 'overview', mainMetric: 'cost',
  showDeviation: false, showRate: false,
  rowView: 'sections', filters: [],
};
assert.equal(isModifiedView(view), false, 'база пресета не считается изменённой');
// Любое ручное движение по любой из осей поднимает флаг…
assert.equal(isModifiedView({ ...view, filters: ['pot'] }), true);
assert.equal(isModifiedView({ ...view, mainMetric: 'potential' }), true);
assert.equal(isModifiedView({ ...view, rowView: 'weight' }), true);
assert.equal(isModifiedView({ ...view, showDeviation: true }), true);
assert.equal(isModifiedView({ ...view, showRate: true }), true);

/* Состав строк ячейки — правила источника §1, закодированные в cellLines():
 * основной первой строкой; стоимость присутствует ВСЕГДА (второй строкой
 * как база); отклонение липнет к строке стоимости суффиксом; ставка последней;
 * порядок фиксирован. */
const planOf = (v: CompareView) => cellLines(v);
assert.deepEqual(
  planOf(view),
  { lines: [{ kind: 'main', metric: 'cost' }], deviationOn: null },
  'основной «Стоимость» без спутников — одна строка',
);
const potentialView: CompareView = {
  ...view, preset: 'bidding', mainMetric: 'potential',
  showDeviation: true, showRate: true,
};
const potentialPlan = planOf(potentialView);
assert.deepEqual(potentialPlan.lines.map((l: CellLine) => l.kind), ['main', 'base', 'rate'],
  'фиксированный порядок: основной → база-стоимость → ставка');
assert.equal(potentialPlan.deviationOn, 'base', 'отклонение липнет к стоимости, где бы та ни стояла');
const costFullPlan = planOf({ ...view, showDeviation: true, showRate: true });
assert.deepEqual(costFullPlan.lines.map((l: CellLine) => l.kind), ['main', 'rate'],
  'основной «Стоимость» — база не дублируется, ставка последней');
assert.equal(costFullPlan.deviationOn, 'main');

/* Пресеты выражаются теми же осями и повторяются руками; «Аномалии» после
   упразднения отклонения-основного собирается из стоимости с галочкой и
   фильтров разброса и аномалий. */
assert.deepEqual(PRESETS.anomalies, {
  mainMetric: 'cost', showDeviation: true, showRate: false,
  rowView: 'weight', filters: ['spread', 'anomaly'],
});
assert.equal(isModifiedView({ ...PRESETS.overview, preset: 'overview' }), false);

/* ═══════════════════ ТЕНДЕР «АХП В МКД-1, МКД-3» (MOCK_AXP) ═══════════════
   Данные перенесены из ФКП руками — а значит, их можно перенести криво:
   потерять позицию, поставить чужую цену, отдать «Отказу» стоимость. Всё это
   молча: экран не падает, он показывает неправду. */

// ── состав сметы: id уникальны, объёмы положительные, расценки файла на месте
const AXP_POSITIONS = flatten(MOCK_AXP.groups);
{
  const ids = AXP_POSITIONS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'id позиций уникальны во всей смете');
  assert.equal(AXP_POSITIONS.length, 65, '31 (МКД-1) + 34 (МКД-3) — как в файле');
  for (const p of AXP_POSITIONS) {
    assert.ok(p.qty > 0 && Number.isFinite(p.qty), `${p.id}: объём положительный`);
    assert.ok(p.unit.length > 0, `${p.id}: единица не пустая`);
    assert.ok(p.title.length > 0, `${p.id}: название не пустое`);
  }
  assert.equal(MOCK_AXP.groups.map((g) => g.id).join('+'), 'axp-mkd1+axp-mkd3',
    'две секции — МКД-1 и МКД-3');
}

// ── участник №1: цена файла есть у КАЖДОЙ позиции, итог положительный ──────
const STM = MOCK_AXP.contractors.find((c) => c.id === 'stm');
assert.ok(STM, 'участник №1 с ценами файла на месте');
for (const p of AXP_POSITIONS) {
  const price: number | undefined = STM.prices[p.id];
  assert.ok(price !== undefined && price > 0, `${p.id}: у №1 есть цена файла`);
}

// ── вилки вымышленных КП: детерминированная вилка не должна уехать ─────────
// У каждого подрядчика свой УРОВЕНЬ цен относительно файла; вокруг него
// материалы гуляют ±8 %, работы ±7 %. Границы в ассерте чуть шире вилки:
// правка seed не должна ронять проверку, а уезд самой вилки — обязана.
const LEVEL: Record<string, number> = {
  pes: 1.04, mvp: 1.03, sso: 1.05, rek: 0.97,
  ekm: 1.07, nlt: 0.98, vgs: 1.10, lsp: 1.01, usm: 0.96,
};
const stmPrices = STM.prices;
for (const c of MOCK_AXP.contractors) {
  if (c.id === 'stm') continue;
  const lvl: number | undefined = LEVEL[c.id];
  assert.ok(lvl !== undefined, `${c.id}: уровень цен известен`);
  const level: number = lvl;
  for (const p of AXP_POSITIONS) {
    const base: number = stmPrices[p.id];
    const price: number | undefined = c.prices[p.id];
    if (price === undefined) continue; // честный пробел данных
    // Внешний вердикт (аномалия) — осознанное отклонение ОТ вилки, ей не меряется.
    if (hasAnomaly(cellMark(c, p.id))) continue;
    const room: number = base >= 50000 ? 0.08 : 0.09;
    const [min, max]: [number, number] = [level - room, level + room];
    assert.ok(price >= min * base && price <= max * base,
      `${c.id}/${p.id}: ${price} вне вилки [${min * base}; ${max * base}] от ${base}`);
  }
}

/* ГАРАНТИЯ РАНЖИРА — не удача хэша, а условие на уровни: у кого КП ПОЛНОЕ,
   уровень обязан быть выше единицы (иначе он обгонит колонку файла), у
   остальных он свободен — `rankBids` и так ставит неполное предложение ниже
   любого полного. Проверка стоит рядом с самой таблицей уровней, чтобы правка
   одного не разошлась с другим. */
for (const [id, level] of Object.entries(LEVEL)) {
  const c = MOCK_AXP.contractors.find((x) => x.id === id);
  assert.ok(c, `${id}: подрядчик на месте`);
  if (c.fill >= 100) {
    assert.ok(level > 1, `${id}: полное КП с уровнем ${level} обгонит цены файла`);
  }
}

/* Две колонки, совпадающие построчно, читаются поломкой таблицы, а не
   совпадением: до правки вилки 24.08.2026 таких пар было две (pes↔ekm 55
   позиций из 65, mvp↔rek 49). Глазами это не ловится — числа правдоподобны.
   Считаются только ЗАМЕТНЫЕ позиции (расценка от 300 ₽): на клемме за 115 ₽
   разница уровней в 2 % — это два рубля, и совпадение после округления там
   естественно, а не подозрительно. */
{
  const cs = MOCK_AXP.contractors;
  const notable = AXP_POSITIONS.filter((p) => STM.prices[p.id] >= 300);
  for (let i = 0; i < cs.length; i++) {
    for (let j = i + 1; j < cs.length; j++) {
      const same = notable.filter((p) => cs[i].prices[p.id] !== undefined
        && cs[i].prices[p.id] === cs[j].prices[p.id]).length;
      assert.ok(same <= 2,
        `${cs[i].id} ↔ ${cs[j].id}: одинаковых расценок ${same} из ${notable.length}`);
    }
  }
}

// ── дыры и отказы: ключа нет ровно там, где заявлено ───────────────────────
const byId = (id: string): Contractor => {
  const c = MOCK_AXP.contractors.find((x) => x.id === id);
  assert.ok(c, `${id}: подрядчик на месте`);
  return c;
};
for (const id of ['a05', 'a22', 'b14', 'b25']) {
  assert.equal(byId('mvp').prices[id], undefined, `mvp/${id}: пробел данных`);
}
for (const id of ['a09', 'b06']) {
  assert.equal(byId('rek').prices[id], undefined, `rek/${id}: пробел данных`);
}
for (const id of ['a28', 'b31']) {
  assert.equal(byId('sso').prices[id], undefined,
    `sso/${id}: у отказа НЕТ цены — иначе отказ участвует в сумме и ранжире`);
  const mark = cellMark(byId('sso'), id);
  assert.equal(mark.declined, true, `sso/${id}: отказ помечен решением`);
}

// ── аномалия: внешний вердикт с причиной, цена ниже всех в строке ──────────
{
  const sso = byId('sso');
  const anomalyMark = cellMark(sso, 'a12');
  assert.equal(hasAnomaly(anomalyMark), true, 'a12: внешний вердикт стоит');
  assert.ok(anomalyMark.anomaly && anomalyMark.anomaly.length > 30,
    'причина обязательна — строку нечем объяснить подрядчику');
  const others = MOCK_AXP.contractors
    .filter((c) => c.id !== 'sso')
    .map((c) => c.prices.a12)
    .filter((v) => v !== undefined);
  assert.ok(others.every((v) => v! > sso.prices.a12),
    'аномальная цена ниже всех остальных в строке');
}

// ── ранжир: участник №1 (цены файла) — лидер по сумме ──────────────────────
{
  const bids = rankBids(MOCK_AXP.contractors, AXP_POSITIONS);
  assert.equal(bids.find((b) => b.rank === 1)?.contractor.id, 'stm',
    'минимальный итог — у колонки из файла');
  // Отказ и пробелы НЕ выводят КП из ранжира и не считают нулём.
  const ssoSum = bids.find((b) => b.contractor.id === 'sso')?.sum ?? 0;
  assert.ok(ssoSum > 0, 'КП с отказом остаётся в сравнении');
}

// ── условия формы: подписи — ключи, виды ответов валидны ───────────────────
{
  const KINDS = new Set(['bool', 'value', 'note']);
  const stmLabels = (STM.terms ?? []).map((x) => x.label);
  assert.ok(stmLabels.length >= 9, 'у №1 заполнена вся форма (9 вопросов)');
  assert.equal(new Set(stmLabels).size, stmLabels.length, 'подписи-ключи без дублей');
  for (const c of MOCK_AXP.contractors) {
    for (const term of c.terms ?? []) {
      assert.ok(KINDS.has(term.kind), `${c.id}/${term.id}: вид ответа известен`);
      assert.ok(term.value.length > 0, `${c.id}/${term.id}: ответ не пустой`);
      if (term.kind === 'bool') {
        assert.match(term.value, /^(да|нет)$/iu, `${c.id}/${term.id}: bool — да/нет`);
      }
    }
  }
  // Матрица собирается и выравнивается по колонкам (model/terms.ts).
  const rows = termRows(MOCK_AXP.contractors);
  assert.equal(rows.length, 9, 'объединение вопросов — 9 строк матрицы');
  const avans = rows.find((r) => r.label === 'Авансирование');
  assert.deepEqual(avans?.cells.map((c) => c?.value),
    ['40 %', '20 %', '30 %', '40 %', '50 %', '35 %', '25 %', '0 %', '45 %', '30 %'],
    'ответы стоят под своими колонками, порядок — как в форме №1');
  assert.equal(hasTerms(MOCK_AXP.contractors), true);
  // У демо-шестёрки условия тоже заполнены — матрица живёт на обоих тендерах.
  assert.equal(hasTerms(MOCK_COMPARISON.contractors), true);
}

/* ═══════════════ КОРРЕКТИРОВКА ОБЪЁМА И ЗНАК ⚠ ═══════════════
   Десятое тихое место. Знак «требуется твоё решение» не падает — он молча
   горит там, где решение уже принято, или молча гаснет там, где не принято, и
   на живом экране обе ошибки выглядят одинаково правдоподобно. Держится всё
   на одном условии (`pendingCorrection`), и его же складывают ДВА счётчика:
   строка и шапка колонки. Разойдясь, они дадут «3» в шапке при двух знаках в
   строках — и это никто не заметит. */
{
  // Гейт состояния: знак существует РОВНО в «на рассмотрении».
  assert.equal(pendingCorrection({}), undefined, 'нет корректировки — нет знака');
  assert.equal(pendingCorrection({ correction: { qty: 5, status: 'accepted' } }), undefined,
    'принятая корректировка знака не даёт');
  assert.equal(pendingCorrection({ correction: { qty: 5, status: 'declined' } }), undefined,
    'отклонённая — тоже');
  assert.equal(pendingCorrection({ correction: { qty: 5, status: 'pending' } })?.qty, 5,
    'на рассмотрении — знак есть, и объём поставщика при нём');

  const facts = analyzeComparison(MOCK_AXP.groups, MOCK_AXP.contractors, SYSTEM_THRESHOLDS);
  const rowOf = (id: string) => {
    const row = facts.byId.get(id);
    assert.ok(row, `${id}: строка на месте`);
    return row;
  };

  // Ось СТРОКИ: список — в порядке колонок, и по нему же идёт переход.
  assert.deepEqual(rowOf('a06').corrections, ['pes', 'mvp'],
    'две корректировки строки — в порядке колонок (клик ведёт слева направо)');
  assert.deepEqual(rowOf('b17').corrections, ['pes'], 'одна — голый знак без цифры');
  assert.deepEqual(rowOf('a23').corrections, ['rek']);
  assert.deepEqual(rowOf('b05').corrections, [],
    'решённые корректировки (принята + отклонена) знака строке не дают');

  // Ось КОЛОНКИ: тот же счёт, свёрнутый по подрядчику.
  assert.equal(facts.correctionsBy.get('pes'), 2, 'у pes две — в шапке встанет цифра');
  assert.equal(facts.correctionsBy.get('mvp'), 1);
  assert.equal(facts.correctionsBy.get('rek'), 1, 'принятая b05 в счёт не идёт');
  assert.equal(facts.correctionsBy.get('ekm'), undefined, 'только отклонённая — знака нет');
  assert.equal(facts.correctionsBy.get('stm'), undefined);

  /* ДВЕ ОСИ СКЛАДЫВАЮТ ОДНО МНОЖЕСТВО. Это и есть то, ради чего проверка:
     счётчик шапки обязан быть свёрткой списков строк, а не вторым обходом. */
  const fromRows = new Map<string, number>();
  for (const row of facts.rows) {
    for (const id of row.corrections) fromRows.set(id, (fromRows.get(id) ?? 0) + 1);
  }
  assert.deepEqual([...facts.correctionsBy].sort(), [...fromRows].sort(),
    'счётчик колонки = свёртка знаков строк');

  /* Корректировка при ОТСУТСТВУЮЩЕЙ цене не считается: переход вёл бы к
     ячейке, где знака нет вовсе (там прочерк или отказ). */
  const ghost = analyzeComparison(
    [{ id: 'g', title: 'G', positions: [{ id: 'p1', title: 'P', qty: 10, unit: 'шт' }] }],
    [
      { id: 'x', name: 'X', status: 'partial', fill: 0, inn: '1', contact: '-', submitted: '01.01.2026',
        prices: {}, marks: { p1: { correction: { qty: 12, status: 'pending' } } } },
    ],
    SYSTEM_THRESHOLDS,
  );
  assert.deepEqual(ghost.rows[0].corrections, [],
    'корректировка без цены не считается — знака в ячейке всё равно не будет');

  // Снятая позиция решения не требует: её нет в смете.
  const dropped = analyzeComparison(
    [{ id: 'g', title: 'G', positions: [{ id: 'p1', title: 'P', qty: 10, unit: 'шт', removed: true }] }],
    [
      { id: 'x', name: 'X', status: 'partial', fill: 100, inn: '1', contact: '-', submitted: '01.01.2026',
        prices: { p1: 100 }, marks: { p1: { correction: { qty: 12, status: 'pending' } } } },
    ],
    SYSTEM_THRESHOLDS,
  );
  assert.deepEqual(dropped.rows[0].corrections, [], 'по снятой строке решать нечего');
}

console.log('comparison: ok');
