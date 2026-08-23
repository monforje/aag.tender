/** Самопроверка разбора тендера (ИИ-анализ). Шестое тихое место: разбор не
 *  падает — он молча советует не то и называет не те числа, а на живых данных
 *  текст всегда правдоподобен. Здесь фиксируются лимиты секций, их порядок,
 *  граничные случаи раундов («ещё не подал», рост из-за состава) и merge-
 *  семантика перехода в таблицу.
 *  Запуск: bun src/entities/tender/model/analysis.check.ts */
import { strict as assert } from 'node:assert';
import { applyTransition, SYSTEM_THRESHOLDS, type CompareView } from './comparison';
import { MOCK_ROUND1, MOCK_ROUND2_FULL, MOCK_ROUND2_PARTIAL } from './comparison.mock';
import {
  ANALYSIS_LIMITS, buildAnalysis,
  type AnalysisItem,
} from './analysis';

const T = SYSTEM_THRESHOLDS;

/* ── раунд 1: только базовый разбор ──────────────────────────────────────── */

const r1 = buildAnalysis(MOCK_ROUND1, undefined, T)!;
assert.equal(r1.roundNumber, 1);
/* Секции «Изменения» и «Общая картина» в первом круге НЕ показываются вовсе:
   отсутствие — норма, а не пустая секция (05 §4). */
assert.deepEqual(r1.sections.map((s) => s.id), ['base_review']);

const base = r1.sections[0];
assert.deepEqual(
  base.subsections!.map((x) => x.id),
  ['tender_overview', 'negotiation_points', 'anomalies', 'completeness'],
  'порядок подсекций фиксированный',
);

const subOf = (id: string) => base.subsections!.find((x) => x.id === id)!.items;

/* Картина по тендеру: лидер → выбивающийся → характер поля, ≤ 3 пунктов. */
const overview = subOf('tender_overview');
assert.ok(overview.length <= ANALYSIS_LIMITS.overview);
assert.match(overview[0].title, /МетСнаб.*11\s978\s180/);
assert.match(overview[overview.length - 1].title, /Поле плотное/);

/* Точки торгов ≤ 7, по убыванию денег: w3 (90 тыс.) → w1 (75,6 тыс.). */
const points = subOf('negotiation_points');
assert.ok(points.length > 0 && points.length <= ANALYSIS_LIMITS.points);
assert.equal(points[0].refs[0].id, 'w3');
assert.ok(Number(points[0].evidence.find((e) => e.metric === 'max_potential')!.value)
  >= Number(points[1].evidence.find((e) => e.metric === 'max_potential')!.value));

/* Аномалии ≤ 5: при системном k = 3 их три — швы и вязка СтройМонтажа
   (формула) и арматура МетСнаба (данные); порядок по величине отклонения,
   у каждой есть слот модели. */
const anomalies = subOf('anomalies');
assert.ok(anomalies.length <= ANALYSIS_LIMITS.anomalies);
assert.equal(anomalies.length, 3);
assert.match(anomalies[0].title, /швов.*СтройМонтаж/);
assert.match(anomalies[1].title, /Вязка.*СтройМонтаж/);
assert.match(anomalies[2].title, /Арматура.*МетСнаб/);
for (const item of anomalies) assert.ok(item.note.length > 0, 'у аномалии есть слот модели');

/* Полнота всегда, без лимита, без модели (05 §4.3.4): у ig/sm дыры, у sm отказ. */
const completeness = subOf('completeness');
assert.ok(completeness.length > 0);
for (const item of completeness) assert.equal(item.note, '', 'модель в полноте молчит');
assert.ok(completeness.some((i) => i.title.includes('отказ')));

/* Сводка ≤ 3 якорей. */
assert.ok(r1.summary.length > 0 && r1.summary.length <= ANALYSIS_LIMITS.summary);

/* ── раунд 2, частичная подача ───────────────────────────────────────────── */

const p2 = buildAnalysis(MOCK_ROUND2_PARTIAL, MOCK_ROUND1, T)!;
assert.equal(p2.roundNumber, 2);
assert.deepEqual(
  p2.sections.map((s) => s.id),
  ['supplier_changes', 'round_summary', 'base_review'],
  'порядок: изменения → картина круга → базовый разбор',
);

/* «Ещё не подал» существует как пункт, модель в нём молчит (05 §4.1). */
const scItems = p2.sections[0].items!;
assert.equal(scItems.length, 3);
const notSubmitted = scItems.filter((i) => i.title.includes('ещё не подал'));
assert.equal(notSubmitted.length, 2, 'МетСнаб и СтройМонтаж держат старые КП');
for (const item of notSubmitted) assert.equal(item.note, '');

/* ИнженерГрупп уступил: −479 030 ₽ (−3,9 %); топ шагов по деньгам, хвост. */
const ig = scItems.find((i) => i.id === 'sc:ig')!;
assert.match(ig.title, /ИнженерГрупп» — дешевле на 479\s030\s₽ \(−3,9\s?%\)/u);
assert.match(ig.details![0], /^Арматура А500С Ø12 −160\s000\s₽$/u, 'топ-1 шаг — по абсолютной величине');
assert.ok(ig.details!.some((d) => d.startsWith('и ещё 7 ')));
assert.ok(scItems.some((i) => i.refs.some((r) => r.kind === 'work')), 'шаги кликабельны');

/* Комментарий разбора доходит до ячейки топ-шага. */
assert.match(p2.popupNotes['ig:m2'], /крупный шаг/u);

/* Фиксированный набор показателей круга. */
const meta = Object.fromEntries(p2.sections[1].meta!.map((m) => [m.label, m.value]));
assert.equal(meta['Подали'], '1 из 3');
assert.equal(meta['Позиций изменено'], '10');
assert.match(meta['Лидер'], /удержал/);
assert.match(meta['Изменение'], /479\s030/u);
assert.equal(meta['Объём работ'], 'не изменился');

/* Без прошлого снимка объём честно читается «нет данных». */
const p2noref = buildAnalysis(MOCK_ROUND2_PARTIAL, undefined, T)!;
const metaNoRef = Object.fromEntries(
  p2noref.sections[1].meta!.map((m) => [m.label, m.value]),
);
assert.equal(metaNoRef['Объём работ'], 'нет данных');

/* ── раунд 2, полнее: СтройМонтаж переподал ──────────────────────────────── */

const f2 = buildAnalysis(MOCK_ROUND2_FULL, MOCK_ROUND1, T)!;
const fItems = f2.sections[0].items!;
const sm = fItems.find((i) => i.id === 'sc:sm')!;

/* Итог вырос из-за закрытых пробелов (плёнка + гидроизоляция), а не из-за цен:
   модель обязана назвать состав причиной роста (граничный случай 05 §4.2). */
assert.match(sm.title, /СтройМонтаж» — дороже на 746\s830\s₽/u);
assert.match(sm.note, /Рост дал состав/u);
assert.match(sm.details![0], /^Гидроизоляция обмазочная, 2 слоя \+996\s960\s₽$/u);
assert.ok(sm.details!.includes('закрыл пробелов: 2'));
assert.ok(sm.details!.some((d) => d.startsWith('и ещё 8 ')));
/* МетСнаб всё ещё молчит даже в полном снимке. */
assert.ok(fItems.some((i) => i.id === 'sc:ms' && i.title.includes('ещё не подал')));

const metaFull = Object.fromEntries(f2.sections[1].meta!.map((m) => [m.label, m.value]));
assert.equal(metaFull['Подали'], '2 из 3');
assert.equal(metaFull['Позиций изменено'], '11', 'объединение позиций обоих поставщиков');
assert.match(metaFull['Изменение'], /\+267\s800/u);

/* ── переход в таблицу: семантика required_metrics на осях модели ───────────
   Контракт (06 §5) говорит прежним словарём показателей; отображение на новые
   оси живёт в applyTransition, пока протокол не перенесён в канон:
   `price`/`cost` — no-op (стоимость в ячейке есть всегда), `deviation`
   включает галочку спутника, `potential` ставит потенциал основным. */
const view: CompareView = {
  preset: 'overview', mainMetric: 'cost',
  showDeviation: false, showRate: false,
  rowView: 'sections', filters: [],
};
const moved = applyTransition(view, { preset: 'bidding', requiredMetrics: ['potential'] });
assert.deepEqual(moved, {
  preset: 'bidding', mainMetric: 'potential',
  showDeviation: false, showRate: false,
  rowView: 'potential', filters: ['pot'],
}, 'пресет задаёт все оси целиком');

const merged = applyTransition(view, { preset: 'anomalies', requiredMetrics: ['deviation', 'potential'] });
assert.deepEqual(merged.mainMetric, 'potential',
  'обязательный «потенциал» сильнее оси пресета: виден он только основным');
assert.equal(merged.showDeviation, true, 'отклонение включается галочкой');
assert.deepEqual(merged.filters, ['spread', 'anomaly']);
assert.deepEqual(merged.rowView, 'weight');

/* Требование цены ничего не меняет: стоимость присутствует всегда (§1, правило 2). */
const priced = applyTransition(view, { preset: 'anomalies', requiredMetrics: ['price'] });
assert.deepEqual(priced, { ...priced, preset: 'anomalies' });
assert.equal(priced.mainMetric, 'cost');
assert.equal(priced.showDeviation, true);

/* Переход из вывода ведёт к сущности внутри текста, а не к отдельной команде. */
assert.ok(
  [...points, ...anomalies].every((i: AnalysisItem) =>
    !i.transition || i.transition.focus?.positionId !== undefined
    || i.transition.focus?.contractorId !== undefined
    || !i.transition.focus,
  ),
);
assert.equal(points[0].transition?.focus?.positionId, 'w3');

/* ── пустой ответ ────────────────────────────────────────────────────────── */
assert.equal(buildAnalysis({ groups: [], contractors: [] }, undefined, T), null);

console.log('analysis: ok');
