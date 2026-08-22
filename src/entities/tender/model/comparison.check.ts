/** Самопроверка сравнения КП. Третье место в проекте, где ошибка была бы
 *  тихой: ранжир не падает — он молча объявляет победителем не того. Дешёвое
 *  неполное КП обязано уходить ВНИЗ, а не наверх, и глазами на живых данных
 *  эту перестановку не поймать: суммы правдоподобны в любом порядке.
 *  Запуск: bun src/entities/tender/model/comparison.check.ts
 *  Фреймворка нет намеренно — то же соглашение, что у registry.check.ts. */
import { strict as assert } from 'node:assert';
import {
  analyzeComparison, bidStatus, cellMark, decimal, deviationPct, filterRows,
  flatten, groupSum, isModifiedView, medianOf, money, predicateCount,
  predicatePasses, rankBids, shownMetrics, spread, sumOf,
  type ComparePosition, type CompareView, type Contractor,
} from './comparison';
import { MOCK_COMPARISON } from './comparison.mock';

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
// Суммы заданы заказчиком, а на экране они ВЫВОДЯТСЯ из расценок. Эти три
// равенства — единственное, что удержит фикстуру от расхождения с ними: правка
// любой расценки без правки соседней уронит проверку здесь, а не на экране.
const REFERENCE: Record<string, number> = {
  'АО «МетСнаб»': 11_840_000,
  /* Расценки на добавку (m5) сдвинуты к 41 ₽/кг, чтобы в фикстуре жил и
     ТИХИЙ ярус разброса (<7 %): правка согласована этими же равенствами. */
  'ООО «ИнженерГрупп»': 12_147_600,
  'ООО «СтройМонтаж»': 11_975_800,
};
for (const contractor of CONTRACTORS) {
  assert.equal(sumOf(contractor, POSITIONS), REFERENCE[contractor.name], contractor.name);
}
assert.deepEqual(CONTRACTORS.map((c) => c.fill), [100, 95, 88]);

// Экран показывает три колонки, и все три должны попадать в свой цвет: без
// этого зелёная/янтарная/красная шкала на странице не проверяется ничем.
const live = rankBids(CONTRACTORS, POSITIONS);
assert.deepEqual(live.map((b) => b.contractor.name),
  ['АО «МетСнаб»', 'ООО «СтройМонтаж»', 'ООО «ИнженерГрупп»']);
assert.deepEqual(live.map((b) => b.tone), ['success', 'warning', 'danger']);
assert.equal(live[0].percent, 100, 'первое место — у единственного полного КП');
assert.ok(live[1].percent < 100 && live[2].percent < 100);
assert.ok(live[1].sum < live[2].sum, 'два неполных между собой — по сумме');
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
assert.equal(bidStatus('complete').label, 'КП получено');
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
assert.equal(decimal(86.5), '86,5');
assert.equal(decimal(7.857), '7,9');

/* ═══════════ производные числа строки (анализ) ═══════════
   Четвёртое тихое место: минимум, метка разброса и медиана не падают — они
   молча советуют брать подозрительную цифру. Проверяются на живой фикстуре,
   где каждый ярус присутствует нарочно (норма R7). */
const FACTS = analyzeComparison(GROUPS, CONTRACTORS);
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
assert.deepEqual(factOf('m1').bids.map((b) => b.price), [4755, 5166, 5182]);
assert.equal(factOf('m1').median, 5166);

// ГЛАВНОЕ ПРАВИЛО МИНИМУМА: лучшая НЕаномальная цена. Самая дешёвая расценка
// арматуры помечена аномалией — «мин» обязан уйти второму по дешевизне, иначе
// экран советует брать подозрительную цифру.
const m2 = factOf('m2');
assert.ok(m2.anomaly, 'аномалия арматуры размечена в фикстуре');
assert.notEqual(m2.bestId, 'ms', 'аномально дешёвая цена выбывает из соревнования за минимум');
assert.equal(m2.bestId, 'ig');

// …и остаётся в разбросе: аномалия не вычищается из процента строки.
assert.ok(Math.abs(m2.spread! - 17.87) < 0.01, `разброс арматуры ${m2.spread}`);
assert.equal(m2.spreadTag, 'high');

// Метка выводится из процента порогом, а не приходит полем: ярусы high ≥ 15,
// noticeable ≥ 7. На фикстуре есть ВСЕ три яруса живьём, включая тихий.
assert.deepEqual(factOf('w4').spreadTag, null, 'одна расценка — сравнивать не с чем');
assert.equal(factOf('m4').spreadTag, null, 'у плёнки тоже одна расценка');
assert.equal(factOf('m1').spreadTag, 'noticeable');
assert.equal(factOf('m5').spreadTag, 'none');
assert.deepEqual(
  FACTS.rows.filter((r) => r.spreadTag === 'high').map((r) => r.position.id),
  ['m2', 'm3', 'w3', 'g2'],
);

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
// ключевых три, высоких разбросов четыре, аномальных строк одна, с потенциалом
// пять (порог отсекает копеечные запасы), дороже медианы на >5 % — шесть.
const counted = (['key', 'spread', 'anomaly', 'pot', 'med'] as const).map((id) => [
  id, predicateCount(id, ALL),
]);
assert.deepEqual(Object.fromEntries(counted), { key: 3, spread: 4, anomaly: 1, pot: 5, med: 6 });

/* ═══════════ пресеты: четыре оси и флаг «изменён» ═══════════ */
const view: CompareView = {
  preset: 'overview', mainMetric: 'price', extraMetrics: [], rowView: 'sections', filters: [],
};
assert.deepEqual(shownMetrics(view), ['price']);
assert.equal(isModifiedView(view), false, 'база пресета не считается изменённой');
// Любое ручное движение по любой из четырёх осей поднимает флаг…
assert.equal(isModifiedView({ ...view, filters: ['pot'] }), true);
assert.equal(isModifiedView({ ...view, mainMetric: 'deviation' }), true);
assert.equal(isModifiedView({ ...view, rowView: 'weight' }), true);
assert.equal(isModifiedView({ ...view, extraMetrics: ['price'] }), true);

console.log('comparison: ok');
