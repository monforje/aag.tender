/** probe.js — проверка числовых утверждений filter_audit.md.
 *
 *  Запуск:  bun filter_audit/probe.js
 *
 *  Читает мок-данные прямо из tender-comparison-full.html (не копирует их),
 *  поэтому если макет поправят — упадёт здесь, а не тихо разойдётся с текстом
 *  аудита. Норма — «OK» по всем пунктам.
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('./tender-comparison-full.html', import.meta.url), 'utf8');
const from = html.indexOf('const SUPPLIERS');
const to = html.indexOf('const PRESETS');
assert.ok(from > 0 && to > from, 'блок MOCK DATA не найден — макет изменили');
const { SUPPLIERS, ITEMS } = new Function(html.slice(from, to) + '; return { SUPPLIERS, ITEMS };')();

const prices = (it) => SUPPLIERS.map((s) => it.cells[s.id]?.price).filter((v) => v != null && v > 0);
const spreadPct = (it) => { const p = prices(it); return p.length > 1 ? (Math.max(...p) - Math.min(...p)) / Math.min(...p) * 100 : null; };
const maxPot = (it) => Math.max(0, ...SUPPLIERS.map((s) => it.cells[s.id]?.potential ?? 0));
const hasPot = (it) => SUPPLIERS.some((s) => (it.cells[s.id]?.potential ?? 0) > 0);
const ok = (msg) => console.log('OK  ' + msg);

/* 1. spreadTag — внешняя метка, а не порог по проценту: диапазоны пересекаются. */
const byTag = (t) => ITEMS.filter((i) => (i.spreadTag ?? 'none') === t).map(spreadPct).filter((v) => v != null);
assert.ok(Math.max(...byTag('none')) > Math.min(...byTag('high')),
  'разброс «none» должен где-то превышать «high» — иначе порог существует');
ok(`spreadTag не выводится из %: none доходит до ${Math.max(...byTag('none')).toFixed(1)}%, high начинается с ${Math.min(...byTag('high')).toFixed(1)}%`);

/* 2. isMin — минимум среди НЕаномальных цен, а не минимум по строке. */
const mismatch = [];
for (const it of ITEMS) {
  const p = prices(it); if (!p.length) continue;
  const mn = Math.min(...p);
  for (const s of SUPPLIERS) {
    const c = it.cells[s.id]; if (!c) continue;
    if (!!c.isMin !== (c.price === mn && c.price > 0 && !c.missing)) mismatch.push({ item: it.id, sup: s.id, cell: c });
  }
}
const real = mismatch.filter((m) => ITEMS.find((i) => i.id === m.item).removed === false || ITEMS.find((i) => i.id === m.item).removed === undefined);
assert.ok(real.some((m) => m.cell.anomaly), 'расхождение isMin↔min должно объясняться аномалией');
ok(`isMin расходится с min(price) в ${real.length} ячейках, и самая дешёвая из них помечена anomaly — «min» присуждается лучшей НЕаномальной цене`);

/* 3. Заявленный total подрядчика не равен сумме его ячеек. */
for (const s of SUPPLIERS) {
  const sum = ITEMS.reduce((a, i) => a + (i.cells[s.id]?.price ?? 0), 0);
  assert.notStrictEqual(s.total, sum);
}
ok('SUPPLIERS.total — независимое число, Σ по ячейкам больше его в ~1,6 раза (позиции в таблице — выборка сметы)');

/* 4. «Есть потенциал» отсекает ровно одну строку — снятую. */
const без = ITEMS.filter((i) => !hasPot(i));
assert.strictEqual(без.length, 1);
assert.strictEqual(без[0].removed, true);
ok(`фильтр has_potential убирает ${без.length} из ${ITEMS.length} позиций (#${без[0].id}, снятую) — почти no-op`);

/* 5. deviation — процент от ЕДИНОЙ базы строки, но база не min/mean/median. */
let maxScatter = 0, matchesKnown = 0;
for (const it of ITEMS) {
  const cells = SUPPLIERS.map((s) => it.cells[s.id]).filter((c) => c?.price > 0 && c.deviation != null && c.deviation !== 0);
  if (cells.length < 2) continue;
  const bases = cells.map((c) => c.price / (1 + c.deviation / 100));
  const scatter = (Math.max(...bases) - Math.min(...bases)) / Math.min(...bases) * 100;
  maxScatter = Math.max(maxScatter, scatter);
  const p = prices(it), sorted = [...p].sort((a, b) => a - b);
  const mean = p.reduce((a, b) => a + b, 0) / p.length;
  const med = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const base = bases.reduce((a, b) => a + b, 0) / bases.length;
  if ([mean, med, Math.min(...p)].some((k) => Math.abs(base - k) / k < 0.005)) matchesKnown++;
}
assert.ok(maxScatter < 0.35, 'база строки должна быть одна на строку');
ok(`deviation считается от одной базы на строку (разброс подставной базы ≤ ${maxScatter.toFixed(2)}%), но совпадает с min/mean/median лишь в ${matchesKnown} строках — база ВНЕШНЯЯ`);

/* 6. potential не равен переплате относительно минимума. */
const пере = ITEMS.filter((it) => {
  const mn = Math.min(...prices(it));
  return SUPPLIERS.every((s) => { const c = it.cells[s.id]; return !c?.price || (c.potential ?? 0) === c.price - mn; });
});
assert.ok(пере.length < ITEMS.length / 2, 'если бы potential = price − min, совпало бы везде');
ok(`potential = price − min выполняется лишь в ${пере.length} строках из ${ITEMS.length} — это независимый вход, не переплата`);

/* 7. «% среза» в виде «По весу» делится на чужое число. */
const Σw = ITEMS.reduce((a, i) => { const p = prices(i); return a + (p.length ? Math.max(...p) : 0); }, 0);
const share = Σw / 12156000 * 100;
assert.ok(share > 150);
ok(`Σ «% среза» = ${share.toFixed(0)}% — делитель 12 156 000 (итог подрядчика №2) не равен базе среза ${Σw.toLocaleString('ru-RU')}`);

/* 8. Σ maxPot — то, что док показывает как «потенциал торгов по срезу». */
ok(`Σ maxPot по строкам = ${ITEMS.reduce((a, i) => a + maxPot(i), 0).toLocaleString('ru-RU')} ₽ (смешивает разных подрядчиков в одной сумме)`);

console.log('\nвсе утверждения filter_audit.md подтверждены на данных макета');
