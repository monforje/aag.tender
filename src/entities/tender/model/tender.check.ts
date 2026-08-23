/** Самопроверка режимов срока сбора КП. Второе место в проекте, где ошибка
 *  была бы тихой: подсказка «осталось N дней» не падает — она просто говорит
 *  неправду, и на живых данных мимо порогов в неделю и месяц не пройдёшь.
 *  Запуск: bun src/entities/tender/model/tender.check.ts
 *  Фреймворка нет намеренно — то же соглашение, что у date.check.ts. */
import { strict as assert } from 'node:assert';
import { bidsDue, type DueMode, type TenderRow } from './tender';
import { ROWS } from '../api/tenders.mock';

const OPEN = ROWS.find((row) => row.status === 'open') as TenderRow;
const TODAY = '2026-08-20';
const mode = (end: string): DueMode => bidsDue({ ...OPEN, end }, TODAY).mode;
const hint = (end: string): string => bidsDue({ ...OPEN, end }, TODAY).hint;

// Пороги. Проверяются ПАРАМИ по обе стороны границы — ошибка на единицу здесь
// самая вероятная и самая незаметная.
assert.equal(mode('15.07.2026'), 'overdue');
assert.equal(mode('19.08.2026'), 'overdue', 'вчера — уже истёк');
assert.equal(mode('20.08.2026'), 'urgent', 'сегодня — ещё можно успеть');
assert.equal(mode('27.08.2026'), 'urgent', 'ровно неделя — уже срочно');
assert.equal(mode('28.08.2026'), 'soon');
assert.equal(mode('19.09.2026'), 'soon', 'ровно месяц — ещё в поле зрения');
assert.equal(mode('20.09.2026'), 'calm');

// Расшифровка — целая фраза с верным числом и склонением.
assert.equal(hint('15.07.2026'), 'Срок истёк 36 дней назад. Приём коммерческих предложений закрыт.');
assert.equal(hint('20.08.2026'), 'Сегодня последний день приёма коммерческих предложений.');
assert.equal(hint('21.08.2026'), 'Осталось 1 день. Приём коммерческих предложений скоро закроется.');
assert.equal(hint('30.09.2026'), 'Осталось 41 день до конца приёма коммерческих предложений.');

// Отсчёт только у открытого. Но подсказка есть у всех: молчание при наведении
// в трёх статусах из четырёх читалось бы как поломка, а не как «нечего сказать».
for (const status of ['closed', 'cancelled', 'draft'] as const) {
  const due = bidsDue({ ...OPEN, status }, TODAY);
  assert.equal(due.mode, 'idle', status);
  assert.ok(due.hint.length > 0, `${status}: подсказка обязана быть`);
}
assert.equal(bidsDue({ ...OPEN, status: 'closed' }, TODAY).hint,
  'Тендер закрыт — приём коммерческих предложений завершён.');
assert.match(bidsDue({ ...OPEN, status: 'draft' }, TODAY).hint, /^Черновик не опубликован/);

console.log('tender: ok');
