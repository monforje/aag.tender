/* ПРОВЕРКА КОДЕКА «ВИД ↔ URL» (§3.5). Ошибка здесь ТИХАЯ по самой природе
   задачи: ссылка открывается, экран рисуется, просто вид у коллеги другой —
   и узнать об этом можно только созвоном «а у меня не так». Ни типы, ни
   сборка такого не ловят, поэтому round-trip проверяется числом, а не
   глазами.
       bun src/entities/comparison/model/viewUrl.check.ts                    */

import { strict as assert } from 'node:assert';
import {
  hasViewParams, parseView, PRESETS, serializeView,
  type CompareView, type PresetId,
} from '..';

const base = { showRate: false };
const of = (preset: PresetId, patch: Partial<CompareView> = {}): CompareView =>
  ({ preset, ...PRESETS[preset], ...patch });

/* ── 1. ROUND-TRIP ПО ВСЕМ ОСЯМ ────────────────────────────────────────────
   Главное свойство кодека: что записали, то и прочли. Проверяется на каждом
   пресете и на «полном» виде, где ВСЕ оси уведены от базы — именно такой
   ссылкой и делятся, когда собрали нестандартную нарезку руками. */
const cases: CompareView[] = [
  /* Пустой вид: пресет без единой правки — самая частая ссылка. */
  of('overview'),
  of('bidding'),
  of('anomalies'),
  /* Полный вид: каждая ось уведена от базы пресета. */
  {
    preset: 'overview',
    mainMetric: 'potential',
    showDeviation: true,
    showDynamics: true,
    showPotential: true,
    showRate: false,
    rowView: 'spread',
    filters: ['key', 'anomaly'],
  },
  /* Фильтры СНЯТЫ РУКАМИ на пресете, который их ставит: пустой набор — это
     значимое состояние, а не «как в пресете». Ловится только так. */
  of('anomalies', { filters: [] }),
  /* Оси уведены в СТОРОНУ базы соседнего пресета — проверка, что читается
     именно записанное, а не «похожее». */
  of('bidding', { showDeviation: false, showPotential: false }),
];

for (const view of cases) {
  const back = parseView(serializeView(view), base);
  assert.deepEqual(back, view, `round-trip: ${serializeView(view)}`);
}

/* Ссылка ДЕТЕРМИНИРОВАНА: две одинаковые нарезки дают посимвольно одинаковую
   строку. Иначе «это та же ссылка?» становится вопросом без ответа. */
assert.equal(
  serializeView(of('bidding', { rowView: 'spread', filters: ['key'] })),
  serializeView(of('bidding', { rowView: 'spread', filters: ['key'] })),
);

/* Пресет без правок пишется ОДНИМ ключом: ссылка на «Обзор» не обязана
   тащить шесть осей, а полная запись ломалась бы при первой правке дефолта
   пресета — коллега открыл бы старую нарезку, думая, что смотрит свежую. */
assert.equal(serializeView(of('overview')), 'p=overview');
assert.equal(serializeView(of('anomalies')), 'p=anomalies');

/* ── 2. МУСОР В АДРЕСЕ → ДЕФОЛТ, А НЕ ПУСТОЙ ЭКРАН ─────────────────────────
   Ссылка живёт в почте и в чате: её правят руками, режут переносом строки и
   дописывают чужие utm. Ни один такой случай не имеет права уронить экран. */
const garbage = [
  '',
  '?',
  'p=нетакого',
  'p=overview&m=цена&sort=назад&dev=да&pot=maybe&f=,,,',
  'p=bidding&f=med,zzz,pot,pot',
  '&&&===&&&',
  'utm_source=mail&fbclid=123',
];
for (const q of garbage) {
  const parsed = parseView(q, base);
  assert.ok(PRESETS[parsed.preset], `мусор «${q}» даёт известный пресет`);
  assert.ok(['cost', 'potential'].includes(parsed.mainMetric));
  assert.ok(['sections', 'weight', 'potential', 'spread'].includes(parsed.rowView));
  assert.equal(typeof parsed.showDeviation, 'boolean');
  assert.ok(Array.isArray(parsed.filters));
}

/* Неизвестный пресет — «Обзор», а не первое попавшееся: у экрана обязан быть
   ОДИН дефолт, и он тот же, с которым страница открывается без ссылки. */
assert.deepEqual(parseView('p=нетакого', base), of('overview'));

/* Осей нет вовсе — вид ровно дефолтный. */
assert.deepEqual(parseView('', base), of('overview'));

/* Мусорные значения не «включают» ось: строгий разбор «1»/«0», всё прочее —
   значение из пресета. Мягкий разбор («true», непустая строка) превращал бы
   опечатку в включённую ось молча. */
assert.equal(parseView('p=overview&dev=да', base).showDeviation, PRESETS.overview.showDeviation);
assert.equal(parseView('p=overview&dev=1', base).showDeviation, true);
assert.equal(parseView('p=anomalies&dev=0', base).showDeviation, false);

/* Незнакомый фильтр отбрасывается, дубликаты схлопываются: на полосе живёт
   ОДНО число активных фильтров, и «Фильтры: 2» при одном действующем —
   ложь пользователю. */
assert.deepEqual(parseView('p=overview&f=med,zzz,pot,pot', base).filters, ['pot']);
/* Пустой ключ — это «фильтров нет», а не фильтр-призрак: `''.split(',')`
   даёт `['']`, и без отсева он приезжал бы одной невидимой записью. */
assert.deepEqual(parseView('p=anomalies&f=', base).filters, []);

/* ── 3. СТАВКА В URL НЕ ВХОДИТ (`state.md` §1) ─────────────────────────────
   Это личная привычка чтения, а не срез данных: она живёт между сессиями у
   каждого своя, и навязывать её по ссылке значит менять чужой экран без
   спроса. Проверяется двусторонне: ключа в строке нет, а при разборе
   значение берётся у ПРИНИМАЮЩЕЙ стороны. */
const withRate = of('overview', { showRate: true });
assert.ok(!serializeView(withRate).includes('rate'), 'ставка в адрес не пишется');
assert.equal(parseView(serializeView(withRate), { showRate: false }).showRate, false,
  'у коллеги остаётся ЕГО ставка, а не пришедшая по ссылке');
assert.equal(parseView(serializeView(of('overview')), { showRate: true }).showRate, true);

/* ── 4. ЕСТЬ ЛИ В АДРЕСЕ ВИД ВООБЩЕ ────────────────────────────────────────
   Адрес БЕЗ осей — обычный вход на тендер, и подменять его дефолтом через
   историю браузера незачем; адрес С осями — ссылка коллеги, и вид обязан
   примениться. */
assert.equal(hasViewParams(''), false);
assert.equal(hasViewParams('?utm_source=mail'), false);
assert.equal(hasViewParams('?p=bidding'), true);
assert.equal(hasViewParams('f=key'), true);
/* Ведущий «?» не обязателен: строка приходит и из location.search, и из
   собственного serializeView, а они отличаются ровно им. */
assert.deepEqual(parseView('?p=bidding', base), parseView('p=bidding', base));

console.log('viewUrl: ok');
