/** Самопроверка разбора дат: единственное место в shared/lib, где ошибка
 *  тихая — неверная дата не падает, а превращается в соседнюю и молча меняет
 *  выборку. Запуск: bun src/shared/lib/date.check.ts
 *  Фреймворка нет намеренно: одна функция — один assert-скрипт. */
import { strict as assert } from 'node:assert';
import {
  daysUntil, daysWord, dmyToIso, isoLocal, isoToDmy, parseDmy, shortDate, startOfMonth,
} from './date';

assert.equal(parseDmy('01.03.2026'), '2026-03-01');
assert.equal(parseDmy('1.3.2026'), '2026-03-01', 'однозначный день и месяц — тоже дата');
assert.equal(parseDmy('29.02.2024'), '2024-02-29', 'високосный год');

// Ради этих строк проверка и существует: формат верный, даты не существует.
assert.equal(parseDmy('31.02.2026'), null, '31 февраля Date молча сделает 3 марта');
assert.equal(parseDmy('29.02.2026'), null, '2026 не високосный');
assert.equal(parseDmy('32.01.2026'), null);
assert.equal(parseDmy('01.13.2026'), null);
assert.equal(parseDmy(''), null);
assert.equal(parseDmy('01.03.26'), null, 'двузначный год неоднозначен — не угадываем');

assert.equal(isoToDmy('2026-03-01'), '01.03.2026');
assert.equal(dmyToIso('01.03.2026'), '2026-03-01');
assert.equal(shortDate('2026-03-01'), '01.03.26');

// isoLocal обязан брать МЕСТНУЮ дату: toISOString() в плюсовых поясах отдаёт
// вчерашний день для всего, что раньше полудня.
assert.equal(isoLocal(new Date(2026, 2, 1, 3, 0)), '2026-03-01');
assert.equal(isoLocal(startOfMonth('2026-03-17')), '2026-03-01');

// daysUntil: подпись «осталось N дней» на карточке тендера считается отсюда,
// и ошибка тут тоже тихая — счётчик просто покажет не то число.
assert.equal(daysUntil('2026-08-20', '2026-08-20'), 0, 'сегодня — это ноль, а не единица');
assert.equal(daysUntil('2026-09-30', '2026-08-20'), 41);
assert.equal(daysUntil('2026-07-15', '2026-08-20'), -36, 'прошедший срок — отрицательный');
assert.equal(daysUntil('2026-03-01', '2026-02-28'), 1, '2026 не високосный: 28 февраля → 1 марта');
assert.equal(daysUntil('2024-03-01', '2024-02-28'), 2, '2024 високосный: между ними 29-е');
// Переход на летнее время (в поясах, где он есть) — сутки длиной 23 часа.
assert.equal(daysUntil('2026-03-30', '2026-03-29'), 1, 'сутки со сдвигом часов — всё равно один день');

assert.equal(daysWord(1), 'день');
assert.equal(daysWord(2), 'дня');
assert.equal(daysWord(5), 'дней');
assert.equal(daysWord(11), 'дней', '11 — не «один», хотя кончается на единицу');
assert.equal(daysWord(21), 'день');
assert.equal(daysWord(41), 'день');
assert.equal(daysWord(-36), 'дней', 'знак на склонение не влияет');

console.log('date: ok');
