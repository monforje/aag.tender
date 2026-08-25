/** Самопроверка разбора тендера (ИИ-анализ). Шестое тихое место: разбор не
 *  падает — он молча советует не то и называет не те числа, а на живых данных
 *  текст всегда правдоподобен. Здесь фиксируются лимиты секций, их порядок,
 *  граничные случаи раундов («ещё не подал», рост из-за состава, изменение
 *  условий без цен), merge-семантика перехода в таблицу и — отдельным блоком —
 *  ГРАНИЦА С МОДЕЛЬЮ: сборка обязана возвращать структуру без единой фразы, а
 *  чужой текст обязан пройти проверку id, `mute` и чисел.
 *  Запуск: bun src/features/ai-analysis/model/analysis.check.ts */
import { strict as assert } from 'node:assert';
import { applyTransition, SYSTEM_THRESHOLDS, money, type CompareView, type Comparison } from '@/entities/comparison';
/* Снимки берутся ЧЕРЕЗ ДВЕРЬ слайса, а не импортом фикстуры: проверка ходит
   за данными тем же путём, что экран, — и ловит расхождение между лентой
   подач и тем, что отдаёт запрос по номеру раунда. */
import { fetchComparison, simulateNextSubmission } from '@/entities/comparison';
import {
  ANALYSIS_LIMITS, buildAnalysis,
  type AnalysisItem, type AnalysisResult,
} from './analysis';
import { applyNarration, NOTE_MAX, type AiResponse } from './narration';

const T = SYSTEM_THRESHOLDS;

/** Разбор целиком: сборка + заготовка модели на месте — то, что видит панель. */
const analyze = (cur: Comparison, prev?: Comparison): AnalysisResult => {
  const built = buildAnalysis(cur, prev, T)!;
  return applyNarration(built.result, built.draft);
};

const everyItem = (result: AnalysisResult): AnalysisItem[] => result.sections.flatMap((sec) => [
  ...(sec.items ?? []),
  ...(sec.subsections ?? []).flatMap((sub) => sub.items),
]);

const TENDER = 'T-2026-014';
const R1 = (await fetchComparison({ tenderId: TENDER }))!;
await simulateNextSubmission();
const R2_PARTIAL = (await fetchComparison({ tenderId: TENDER }))!;
await simulateNextSubmission();
const R2_FULL = (await fetchComparison({ tenderId: TENDER }))!;
/* Прошлый круг остаётся доступен по номеру и после двух подач. */
assert.equal((await fetchComparison({ tenderId: TENDER, round: 1 }))!.revision, 'r1');

/* ── граница «сервер / модель» ────────────────────────────────────────────────
   Смысл разделения: числа и отбор живут БЕЗ модели, и день, когда фраза
   протечёт обратно в сборку, обязан быть виден отсюда, а не с демо. */

const rawBuild = buildAnalysis(R2_FULL, R1, T)!;
for (const item of everyItem(rawBuild.result)) {
  assert.equal(item.note, '', `сборка не пишет фраз: ${item.id}`);
}
for (const section of rawBuild.result.sections) {
  assert.equal(section.note, undefined, `сборка не пишет фраз о секции: ${section.id}`);
}
assert.ok(rawBuild.draft.insights!.length > 0, 'заготовка модели не пуста');
/* Тексты брифа — серверная композиция чисел (как заголовки пунктов), поэтому
   в сырой сборке они ЕСТЬ. Если бриф переедет к живой модели, этот инвариант
   переписывается вместе с границей — молча он меняться не имеет права. */
assert.ok(rawBuild.result.brief.verdict.length > 0, 'вердикт брифа собирается без модели');

/* ── раунд 1: только базовый разбор ──────────────────────────────────────── */

const r1 = analyze(R1);
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

/* Аномалии ≤ 5: при системном k = 3 их три — швы ДорСтройИнжиниринга и вязка
   СтройМонтажа (формула, обе в строках высокого разброса) и арматура
   МетСнаба (внешний вердикт); порядок по величине отклонения, у каждой есть
   слот модели. */
const anomalies = subOf('anomalies');
assert.ok(anomalies.length <= ANALYSIS_LIMITS.anomalies);
assert.equal(anomalies.length, 3);
assert.match(anomalies[0].title, /швов.*СибирьМонолитДомостройИнжиниринг/u);
assert.match(anomalies[1].title, /Вязка.*СтройМонтаж/u);
assert.match(anomalies[2].title, /Арматура.*МетСнаб/u);
for (const item of anomalies) assert.ok(item.note.length > 0, 'у аномалии есть слот модели');
/* Шестеро — штатный режим: оговорки о слабой статистике нет. */
for (const item of anomalies) {
  assert.ok(!item.details?.some((d) => d.includes('Мало данных')), 'на шести КП поле не считается слабым');
}

/* Полнота всегда, без лимита, без модели (05 §4.3.4): у ig/sm дыры, у sm отказ. */
const completeness = subOf('completeness');
assert.ok(completeness.length > 0);
for (const item of completeness) {
  assert.equal(item.note, '', 'модель в полноте молчит');
  assert.equal(item.mute, true, 'полнота закрыта для модели флагом, а не пустой строкой');
}
assert.ok(completeness.some((i) => i.title.includes('отказ')));

/* Сводка ≤ 3 якорей. */
assert.ok(r1.summary.length > 0 && r1.summary.length <= ANALYSIS_LIMITS.summary);

/* ── бриф «сначала вывод» (решение владельца 23.08.2026) ──────────────────────
   Вердикт называет лидера; находки идут фиксированным порядком значимости
   (вывод → экономия → аномалия → риск) и не длиннее лимита; у находок-действий
   есть переходы к сущностям таблицы. Числа в текстах обязаны совпадать с
   числами пунктов секций — иначе бриф спорит со своим же разбором. */
assert.match(r1.brief.verdict, /Лидер — .*МетСнаб/u);
assert.ok(r1.brief.verdict.includes(money(r1.sections[0].subsections![0].items[0]
  .evidence.find((e) => e.metric === 'total')!.value)),
'сумма лидера в вердикте = сумме из «Картины по тендеру»');
const kinds = r1.brief.findings.map((f) => f.kind);
assert.deepEqual(kinds, ['key', 'saving', 'anomaly', 'risk'],
  'порядок находок: вывод → экономия → аномалия → риск');
assert.ok(r1.brief.findings.length <= ANALYSIS_LIMITS.findings);
assert.equal(r1.brief.findings[0].transition?.focus?.contractorId,
  r1.sections[0].subsections![0].items[0].refs[0].id,
  'переход находки-лидера ведёт к тому же КП, что пункт разбора');
assert.equal(r1.brief.findings[1].transition?.focus?.positionId, points[0].refs[0].id,
  'экономия брифа — та же строка, что первая точка торгов');
assert.equal(r1.brief.findings[2].transition?.focus?.positionId,
  subOf('anomalies')[0].transition?.focus?.positionId,
  'аномалия брифа — сильнейшая пара разбора');
assert.match(r1.brief.why, /Аномальные цены|запас|Отрыв/u);
assert.match(r1.brief.recommendation.text, /Начать торг/u);
assert.equal(r1.brief.recommendation.transition?.focus?.positionId, 'w3');

/* ── одно КП: сравнивать не с чем, остаётся только полнота (05 §4) ───────── */

const ONE_BID: Comparison = {
  ...R1,
  contractors: [R1.contractors.find((c) => c.id === 'sm')!],
};
const solo = analyze(ONE_BID);
/* Одно КП: бриф честно говорит «сравнивать не с чем». Единственная возможная
   находка — риск по пробелам данных (полнота при одном КП показывается
   всегда), ни вывода, ни экономики здесь взять неоткуда. */
assert.match(solo.brief.verdict, /не с чем/u);
assert.deepEqual(solo.brief.findings.map((f) => f.kind), ['risk']);
assert.match(solo.brief.recommendation.text, /Дождаться/u);
const soloSubs = solo.sections[0].subsections!;
assert.deepEqual(soloSubs.map((x) => x.id), ['completeness'],
  'пустые подсекции скрываются, полнота показывается всегда');
assert.ok(
  soloSubs[0].items.some((i) => i.title.includes('не закрыто позиций')),
  'полнота считается и при одном КП — иначе разбор врёт «пропусков нет»',
);

/* ── раунд 2, частичная подача ───────────────────────────────────────────── */

const p2 = analyze(R2_PARTIAL, R1);
assert.equal(p2.roundNumber, 2);
assert.deepEqual(
  p2.sections.map((s) => s.id),
  ['supplier_changes', 'round_summary', 'base_review'],
  'порядок: изменения → картина круга → базовый разбор',
);
assert.equal(p2.sections.length, 3, 'главных секций ровно три');

/* «Ещё не подал» существует как пункт, модель в нём молчит (05 §4.1).
   Шестеро приглашены, переподал один — пунктов молчания пять. */
const scItems = p2.sections[0].items!;
assert.equal(scItems.length, 6);
const notSubmitted = scItems.filter((i) => i.title.includes('ещё не подал'));
assert.equal(notSubmitted.length, 5, 'переподал только ИнженерГрупп');
for (const item of notSubmitted) {
  assert.equal(item.note, '');
  assert.equal(item.mute, true);
}

/* ИнженерГрупп уступил: −479 030 ₽ (−3,9 %); топ шагов по деньгам, хвост. */
const ig = scItems.find((i) => i.id === 'sc:ig')!;
assert.match(ig.title, /ИнженерГрупп» — дешевле на 479\s030\s₽ \(−3,9\s?%\)/u);
assert.match(ig.details![0], /^Арматура А500С Ø12 −160\s000\s₽$/u, 'топ-1 шаг — по абсолютной величине');
assert.ok(ig.details!.some((d) => d.startsWith('и ещё 7 ')));
/* Условия КП названы наравне с ценами (05 §4.1). */
assert.ok(ig.details!.some((d) => d === 'условия КП: Предоплата 20 %'));
assert.ok(scItems.some((i) => i.refs.some((r) => r.kind === 'work')), 'шаги кликабельны');

/* Комментарий разбора доходит до ячейки топ-шага — и это СЕРВЕРНЫЙ факт. */
assert.match(p2.popupNotes['ig:m2'], /крупный шаг/u);

/* Фиксированный набор показателей круга. */
const meta = Object.fromEntries(p2.sections[1].meta!.map((m) => [m.label, m.value]));
assert.equal(meta['Подали'], '1 из 6');
assert.equal(meta['Переподали'], '1');
assert.equal(meta['Позиций изменено'], '10');
assert.match(meta['Лидер'], /удержал/);
assert.match(meta['Изменение'], /479\s030/u);
assert.equal(meta['Объём работ'], 'не изменился');

/* Без прошлого снимка объём честно читается «нет данных». */
const metaNoRef = Object.fromEntries(
  analyze(R2_PARTIAL).sections[1].meta!.map((m) => [m.label, m.value]),
);
assert.equal(metaNoRef['Объём работ'], 'нет данных');

/* ── цены прежние, изменились только условия (граничный случай 05 §4.1) ──── */

const SILENT_MOVE: Comparison = {
  ...R2_PARTIAL,
  contractors: R2_PARTIAL.contractors.map((c) => (c.id === 'ig' ? {
    ...c,
    prevPrices: c.prices,                       // ни одной тронутой расценки
    prevConditions: [],
    conditions: ['Аванс 40 %'],
  } : c)),
};
const quiet = analyze(SILENT_MOVE, R1).sections[0].items!.find((i) => i.id === 'sc:ig')!;
assert.match(quiet.title, /цены прежние, изменились условия КП/u,
  'нулевая дельта не имеет права читаться как «поставщик молчал»');
assert.ok(quiet.details!.some((d) => d.includes('Аванс 40 %')));

/* ── раунд 2, полнее: СтройМонтаж переподал ──────────────────────────────── */

const f2 = analyze(R2_FULL, R1);
const fItems = f2.sections[0].items!;
const sm = fItems.find((i) => i.id === 'sc:sm')!;

/* Итог вырос из-за закрытых пробелов (плёнка + гидроизоляция), а не из-за цен:
   модель обязана назвать состав причиной роста (граничный случай 05 §4.2). */
assert.match(sm.title, /СтройМонтаж» — дороже на 734\s230\s₽/u);
assert.match(sm.note, /Рост дал состав/u);
assert.match(sm.details![0], /^Гидроизоляция обмазочная, 2 слоя \+996\s960\s₽$/u);
assert.ok(sm.details!.includes('закрыл пробелов: 2'));
assert.ok(sm.details!.some((d) => d.startsWith('и ещё 8 ')));
/* МетСнаб всё ещё молчит даже в полном снимке. */
assert.ok(fItems.some((i) => i.id === 'sc:ms' && i.title.includes('ещё не подал')));

const metaFull = Object.fromEntries(f2.sections[1].meta!.map((m) => [m.label, m.value]));
assert.equal(metaFull['Подали'], '2 из 6');
assert.equal(metaFull['Переподали'], '2');
assert.equal(metaFull['Позиций изменено'], '11', 'объединение позиций обоих поставщиков');
assert.match(metaFull['Изменение'], /255\s200/u);
/* Фраза об итоге круга приходит от модели и садится НА СЕКЦИЮ. */
assert.match(f2.sections[1].note!, /Подали не все/u);

/* ── чужой текст в слоте модели (06 §6) ─────────────────────────────────────
   Три отказа, каждый ловит свой способ соврать правдоподобно. */

const target = points[0];
const withNote = (response: AiResponse) =>
  applyNarration(r1, response).sections[0].subsections!
    .find((x) => x.id === 'negotiation_points')!.items
    .find((i) => i.id === target.id)!.note;

/* 1. Выдуманный id не заводит пункт и ничего не портит. */
const ghost = applyNarration(r1, { insights: [{ id: 'np:НЕТ-ТАКОЙ', reason: 'Ложь.' }] });
assert.ok(!everyItem(ghost).some((i) => i.note.includes('Ложь')));
assert.equal(everyItem(ghost).length, everyItem(r1).length, 'чужой id не добавляет пунктов');

/* 2. Число, которого нет ни в evidence, ни в серверных строках, отменяет
      фразу целиком: «несогласованное число пользователю не показывается». */
assert.equal(withNote({ insights: [{ id: target.id, reason: 'Отыграем 999 999 ₽.' }] }), '',
  'выдуманное число снимает фразу');
const realPot = target.evidence.find((e) => e.metric === 'max_potential')!.value;
assert.equal(
  withNote({ insights: [{ id: target.id, reason: `Запас ${realPot} ₽.` }] }),
  `Запас ${realPot} ₽.`,
  'подтверждённое evidence число проходит',
);

/* 3. Где модели места нет, текст не появляется даже присланный. */
const muted = completeness.find((i) => i.mute)!;
const forced = applyNarration(r1, { insights: [{ id: muted.id, reason: 'Я тут не молчу.' }] });
assert.ok(!everyItem(forced).some((i) => i.note.includes('не молчу')), 'mute сильнее ответа модели');

/* Длина слота режется, а не ломает пункт. */
const long = withNote({ insights: [{ id: target.id, reason: 'ы'.repeat(NOTE_MAX * 2) }] });
assert.ok(long.length <= NOTE_MAX && long.endsWith('…'));

/* ── переход в таблицу: семантика required_metrics на осях модели ───────────
   Контракт (06 §5) говорит прежним словарём показателей; отображение на новые
   оси живёт в applyTransition, пока протокол не перенесён в канон:
   `price`/`cost` — no-op (стоимость в ячейке есть всегда), `deviation`
   включает галочку спутника, `potential` ставит потенциал основным. */
const view: CompareView = {
  preset: 'overview', mainMetric: 'cost',
  showDeviation: false, showRate: false,
  showDynamics: false, showPotential: false,
  rowView: 'sections', filters: [],
};
const moved = applyTransition(view, { preset: 'bidding', requiredMetrics: ['potential'] });
/* Состав «Торгов» приведён к канону 25.08.2026 (§3.2): отклонение включено —
   сценарий торга без процентов заставлял включать их руками каждый раз, —
   а сортировка по потенциалу тянет за собой его столбец (`sorting.md` §4). */
assert.deepEqual(moved, {
  preset: 'bidding', mainMetric: 'potential',
  showDeviation: true, showRate: false,
  showDynamics: false, showPotential: true,
  rowView: 'potential', filters: ['pot'],
}, 'пресет задаёт все оси целиком');

const merged = applyTransition(view, { preset: 'anomalies', requiredMetrics: ['deviation', 'potential'] });
assert.deepEqual(merged.mainMetric, 'potential',
  'обязательный «потенциал» сильнее оси пресета: виден он только основным');
assert.equal(merged.showDeviation, true, 'отклонение включается галочкой');
/* Фильтры и порядок строк берутся у ПРЕСЕТА целиком — required_metrics их не
   касается. Состав «Аномалий» после правки канона: один фильтр и порядок по
   разбросу (наверху расходящиеся, а не самые дорогие). */
assert.deepEqual(merged.filters, ['anomaly']);
assert.deepEqual(merged.rowView, 'spread');

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
