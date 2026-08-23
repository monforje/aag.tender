/** Самопроверка правил «Анализа». Пятое тихое место: карточка не падает —
 *  она молча советует не то, и глазами на живых данных подмену правила не
 *  поймать: текст всегда правдоподобен. Здесь фиксируется, КАКОЙ вывод обязан
 *  делать каждое правило на фикстуре, где каждый случай присутствует нарочно.
 *  Запуск: bun src/entities/tender/model/insights.check.ts
 *  Фреймворка нет намеренно — то же соглашение, что у comparison.check.ts. */
import { strict as assert } from 'node:assert';
import { POTENTIAL_MIN, SYSTEM_THRESHOLDS } from './comparison';
import { MOCK_COMPARISON } from './comparison.mock';
import { deriveInsights, scenarioPreset, SCENARIOS } from './insights';

const { groups: GROUPS, contractors: CONTRACTORS } = MOCK_COMPARISON;

/* Сценарий → пресет: связь односторонняя, у остальных сценариев её нет. */
assert.equal(scenarioPreset('bidding'), 'bidding');
assert.equal(scenarioPreset('anomalies'), 'anomalies');
assert.equal(scenarioPreset('important'), null);
assert.equal(scenarioPreset('compare'), null);
assert.equal(scenarioPreset('selection'), null);
assert.equal(SCENARIOS.length, 5);

const byScenario = (scenario: string) =>
  deriveInsights(GROUPS, CONTRACTORS, [], SYSTEM_THRESHOLDS)
    .filter((i) => i.scenario === scenario);

/* ── Что важно ────────────────────────────────────────────────────────────── */

// Вес: самая тяжёлая строка фикстуры — арматура (49 585 ₽ × 100 т). Если
// правило промахнулось мимо неё, долю среза читает карточка о чужой строке.
const important = byScenario('important');
const weightCard = important.find((i) => i.id === 'important:0');
assert.ok(weightCard, 'карточка веса существует');
assert.equal(weightCard.rowId, 'm2');
assert.match(weightCard.title, /Арматура/);
assert.ok(weightCard.title.includes('% среза'));

// Неполное КП в ранжире: первое неполное место — СтройМонтаж (2-е по итогу,
// 88 % заполнения). Его дыры: m4, w4 (нет цены) и g1 (отказ). Итог такого
// предложения занижен, и правило обязано назвать это до выбора.
const gapCard = important.find((i) => i.id === 'important:1');
assert.ok(gapCard, 'карточка пробела существует');
assert.equal(gapCard.rowId, 'm4');
assert.match(gapCard.title, /не закрыт у ООО «СтройМонтаж»/);
assert.match(gapCard.text, /занижен/);

/* ── Точки торгов ─────────────────────────────────────────────────────────── */

// Потенциал над порогом (50 тыс.), по убыванию денег. На фикстуре верхушка:
// w3 (900×100 = 90 тыс.) и w1 (24×3150 = 75,6 тыс.). Порядок перепутать —
// советовать торг вслепую.
const bidding = byScenario('bidding');
assert.deepEqual(bidding.map((i) => i.rowId), ['w3', 'w1']);
for (const card of bidding) {
  assert.equal(card.kind, 'trade');
  assert.equal(card.tone, 'warning');
}
assert.ok(bidding[0].title.includes('90'), `в title сумма w3: ${bidding[0].title}`);

/* ── Риски и аномалии ─────────────────────────────────────────────────────── */

// Аномалий три при системном k = 3 (данные + формула), но карточка с
// ВНЕШНЕЙ причиной одна — арматура у МетСнаба; формульные пары говорят
// стандартной фразой. Причина приходит из CellMark и обязана попасть в текст.
const anomalies = byScenario('anomalies');
const anomalyCard = anomalies.find((i) => i.title.includes('Аномалия'));
assert.ok(anomalyCard, 'карточка аномалии существует');
assert.equal(anomalyCard.rowId, 'm2');
assert.match(anomalyCard.text, /доставку|сортамент/);
assert.deepEqual(
  anomalies.filter((i) => i.title.startsWith('Аномалия')).map((i) => i.rowId).sort(),
  ['g2', 'm2', 'w3'],
  'формульные пары w3/g2 тоже становятся карточками',
);

// Высоких разбросов две при продуктовых порогах (w3/g2 ≥ 40 %) — сводная
// карточка считает их той же константой порога, что и фильтр таблицы.
const spreadCard = anomalies.find((i) => i.title.startsWith('Высокий разброс'));
assert.ok(spreadCard, 'карточка разброса существует');
assert.match(spreadCard!.title, /2 позиции/);
assert.equal(spreadCard!.rowId, 'w3');

/* ── Пара ★: сравнение и выборка ──────────────────────────────────────────── */

// Без пары карточек этих сценариев нет вовсе — приглашение рисует интерфейс,
// модель не сочиняет сравнение из одного подрядчика.
assert.deepEqual(byScenario('compare'), []);
assert.deepEqual(byScenario('selection'), []);

const pair = deriveInsights(GROUPS, CONTRACTORS, ['ms', 'ig'], SYSTEM_THRESHOLDS);
const compareCard = pair.find((i) => i.scenario === 'compare')!;
assert.ok(compareCard, 'карточка пары существует');
// Знак — направление от первой ★ ко второй: ИнженерГрупп ДОРОЖЕ МетСнаба на
// 420 230 ₽ (разница итогов из REFERENCE comparison.check), поэтому «+» и
// «МетСнаб дешевле». Правка расценки без правки здесь уронит тест.
assert.match(compareCard.title, /\+420.230/);
assert.equal(compareCard.tone, 'neutral');
// Вклад позиции — разница закрытых ОБЕИМЬ сторонами расценок × объём.
// Крупнейший вклад пары ms/ig — арматура m2: (45 869 − 42 067) × 100 =
// 380 200 ₽. Аномальная цена МетСнаба в разложении УЧАСТВУЕТ: она заявлена
// в КП; её сомнительность — отдельная карточка сценария «Риски», а не дыра.
assert.equal(compareCard.rowId, 'm2');
assert.match(compareCard.text, /«МетСнаб» дешевле/);
assert.match(compareCard.text, /Основной вклад — «Арматура/);

const selectionCard = pair.find((i) => i.scenario === 'selection')!;
assert.match(selectionCard.title, /Пара ★/);
// ИнженерГрупп — 3-е место: среди неполных КП СтройМонтаж дешевле.
assert.match(selectionCard.text, /1-е и 3-е места/);
assert.doesNotMatch(selectionCard.text, /\.\./);

/* ── пустой ответ: ни сметы, ни КП ────────────────────────────────────────── */
assert.deepEqual(deriveInsights([], CONTRACTORS, [], SYSTEM_THRESHOLDS), []);
assert.deepEqual(deriveInsights(GROUPS, [], [], SYSTEM_THRESHOLDS), []);

// Порог POTENTIAL_MIN не изменился молча: фильтр таблицы и карточки торга
// делят одну константу, разъехаться им неоткуда — пока она тут проверена.
assert.equal(POTENTIAL_MIN, 50_000);

console.log('insights: ok');
