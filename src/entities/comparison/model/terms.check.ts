/** Самопроверка матрицы условий поставщиков. Ошибка здесь была бы тихой
 *  вдвойне: пропавший вопрос просто не нарисовал бы строку, а перепутанный
 *  порядок ответов подложил бы подрядчику ЧУЖОЙ аванс — числа правдоподобны,
 *  экран не падает. Запуск: bun src/entities/comparison/model/terms.check.ts
 *  Фреймворка нет намеренно — то же соглашение, что у comparison.check.ts. */
import { strict as assert } from 'node:assert';
import { hasTerms, termRows, type SupplierTerm } from '..';

const t = (label: string, value: string,
  kind: SupplierTerm['kind'] = 'value'): SupplierTerm =>
  ({ id: label, label, value, kind });

// ── объединение вопросов: порядок — первое появление по колонкам ───────────
{
  const rows = termRows([
    { terms: [t('Аванс', '40 %'), t('Срок', '4 месяца'), t('Примечание', '…', 'note')] },
    { terms: [t('Аванс', '20 %'), t('Гарантия', '5 лет')] },
  ]);
  assert.deepEqual(rows.map((r) => r.label),
    ['Аванс', 'Срок', 'Примечание', 'Гарантия'],
    'порядок строк: первое появление, колонка №1 задаёт канон');
  assert.deepEqual(rows[0].cells.map((c) => c?.value), ['40 %', '20 %'],
    'ответы выровнены по своим колонкам');
  assert.equal(rows[1].cells[1], undefined, 'нет ответа — undefined, а не чужой');
  assert.equal(rows[2].cells[1], undefined);
  assert.equal(rows[3].cells[0], undefined);
}

// ── вырожденные случаи ─────────────────────────────────────────────────────
assert.deepEqual(termRows([]), [], 'без КП — пустая матрица');
assert.deepEqual(termRows([{}, {}]), [],
  'ни у кого нет terms — ни одной строки');
assert.deepEqual(termRows([{ terms: [] }]), [], 'пустой terms = нет terms');

// ── hasTerms: пустая матрица хуже отсутствующей ────────────────────────────
assert.equal(hasTerms([]), false);
assert.equal(hasTerms([{ }]), false);
assert.equal(hasTerms([{ terms: [] }]), false);
assert.equal(hasTerms([{ }, { terms: [t('Аванс', '30 %')] }]), true,
  'достаточно одного КП с ответами');

// ── дубликат подписи у одного подрядчика схлопывается в одну строку ────────
// (ошибка данных, а не падение экрана; её ловит comparison.check по мокам)
{
  const rows = termRows([{ terms: [t('Аванс', '40 %'), t('Аванс', '10 %')] }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].cells[0]?.value, '40 %', 'берётся первое появление');
}

console.log('terms: ok');
