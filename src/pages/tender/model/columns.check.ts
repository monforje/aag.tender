/** Самопроверка расчётчика ширин колонок сравнения. Седьмое тихое место:
 *  алгоритм не падает — он молча отдаёт колонкам невозможную раскладку, и
 *  на живом экране это видно только лишним скроллом или щелью у края.
 *  Здесь фиксируются свойства распределения (фиксированная ширина КП,
 *  сходимость суммы, монотонность, порог панорамы) и живые сценарии
 *  («док открыли», «пять подрядчиков на ноутбуке»).
 *  Запуск: bun src/pages/tender/model/columns.check.ts
 *  Фреймворка нет намеренно — то же соглашение, что у comparison.check.ts. */
import { strict as assert } from 'node:assert';
import { BID_FIXED, NUM_FIXED, TITLE_CHARS, computeColumnLayout, titleLimit } from './columns';
import { clipTitle } from './compareFormat';

const layoutOf = (available: number, n: number, wideTitle = false) =>
  computeColumnLayout({
    available, wideTitle, bids: Array.from({ length: n }, (_, i) => ({ id: `c${i}` })),
  });

const sum = (l: ReturnType<typeof computeColumnLayout>) =>
  l.num + l.qty + l.unit + l.spread + l.title
  + Object.values(l.bids).reduce((a, b) => a + b, 0);

const bidWidths = (l: ReturnType<typeof computeColumnLayout>) => Object.values(l.bids);

// ── влезает: все колонки КП ровно BID_FIXED, излишек у названия ────────────
{
  const l = layoutOf(1600, 3);
  assert.equal(l.pan, false);
  assert.deepEqual(bidWidths(l), [BID_FIXED, BID_FIXED, BID_FIXED],
    'колонки подрядчиков фиксированы и равны');
  assert.deepEqual([l.qty, l.unit, l.spread], [106, 100, 96], 'левый блок на базах');
  assert.equal(l.num, NUM_FIXED, 'колонка «№» — константа');
  assert.equal(l.title, 1600 - NUM_FIXED - 302 - 3 * BID_FIXED, 'весь излишек у названия');
}

// ── тесно: левый блок сжимается первым, ширины КП не трогаются ─────────────
{
  /* Между «полы левого блока + № + название + 3×BID_FIXED» и «базы левого
     блока + то же»: место есть, но не на базы. Границы считаются, а не
     вписаны числом — иначе первая же правка BID_FIXED или NUM_FIXED
     превращала бы проверку в неверную молча. */
  const floorW = NUM_FIXED + 102 + 92 + 90 + 280 + 3 * BID_FIXED;
  const baseW = NUM_FIXED + 106 + 100 + 96 + 280 + 3 * BID_FIXED;
  const l = layoutOf(Math.floor((floorW + baseW) / 2), 3);
  assert.equal(l.pan, false);
  assert.ok(l.qty < 106 && l.unit < 100 && l.spread < 96, 'левый блок сжат');
  assert.deepEqual(bidWidths(l), [BID_FIXED, BID_FIXED, BID_FIXED]);
  assert.ok(l.title >= 280, `название не ниже минимума: ${l.title}`);
}

// ── порог панорамы: ниже полов левого блока + фикс. ширин места нет ────────
{
  const threshold = NUM_FIXED + 102 + 92 + 90 + 280 + 5 * BID_FIXED;
  const fits = layoutOf(threshold, 5);
  assert.equal(fits.pan, false, 'ровно на половах ещё влезает');
  const pan = layoutOf(threshold - 1, 5);
  assert.equal(pan.pan, true);
  assert.deepEqual([pan.qty, pan.unit, pan.spread], [102, 92, 90], 'левые на минимумах');
  assert.equal(pan.title, 280, 'названию — его минимум');
  assert.ok(sum(pan) > threshold - 1, 'сумма перерастает ленту — панорамирует она');
}

// ── сходимость: вне панорамы сумма колонок ровно в доступной ширине ────────
for (const available of [900, 1000, 1152, 1280, 1440, 1600, 1920]) {
  for (const n of [1, 2, 3, 5, 6]) {
    const l = layoutOf(available, n);
    if (!l.pan) {
      assert.equal(sum(l), available, `${available}px / ${n} КП`);
      assert.ok(l.title >= 280, `минимум названия: ${available}px / ${n} КП`);
      assert.ok(bidWidths(l).every((w) => w === BID_FIXED));
    }
  }
}

// ── монотонность: расширение окна никогда не сужает колонку ────────────────
let prev = layoutOf(640, 6);
for (let available = 690; available <= 2200; available += 10) {
  const l = layoutOf(available, 6);
  assert.ok(l.qty >= prev.qty && l.unit >= prev.unit && l.spread >= prev.spread,
    `левый блок: ${prev.qty}/${prev.unit}/${prev.spread} → ${l.qty}/${l.unit}/${l.spread} @${available}`);
  for (const [i, w] of bidWidths(l).entries()) {
    assert.ok(w >= bidWidths(prev)[i],
      `колонка c${i}: ${bidWidths(prev)[i]} → ${w} @${available}`);
  }
  assert.ok(l.title >= prev.title, `название: ${prev.title} → ${l.title} @${available}`);
  prev = l;
}

// ── вырожденные случаи ─────────────────────────────────────────────────────
assert.equal(layoutOf(400, 0).pan, true, 'без места — панорама');
const solo = layoutOf(1600, 1);
assert.equal(solo.pan, false);
assert.deepEqual(bidWidths(solo), [BID_FIXED]);

// ── ЛИМИТ НАЗВАНИЯ В ЗНАКАХ ───────────────────────────────────────────────
// Восьмое тихое место: обрезка не падает, она молча съедает конец названия.
{
  assert.equal(titleLimit(undefined), TITLE_CHARS, 'до замера — потолок');
  assert.equal(titleLimit(10_000), TITLE_CHARS, 'широкая колонка не даёт больше потолка');
  assert.ok(titleLimit(280) < TITLE_CHARS, 'на минимуме колонки лимит ниже потолка');
  assert.ok(titleLimit(280) >= 14, 'ниже 14 знаков название перестаёт называть');

  /* Монотонность — та же причина, что у ширин: сужение колонки не имеет права
     УДЛИНИТЬ название. */
  let prevLimit = titleLimit(180);
  for (let w = 190; w <= 1200; w += 10) {
    const now = titleLimit(w);
    assert.ok(now >= prevLimit, `лимит: ${prevLimit} → ${now} @${w}px`);
    prevLimit = now;
  }

  // Влезает — отдаётся как есть, ни одного лишнего знака.
  assert.equal(clipTitle('Бетон B25 W8 F150', 40, false), 'Бетон B25 W8 F150');
  // Не влезает — ровно limit−2 знака: срезаны три последних, добавлено одно «…».
  const long = 'Крышка на лоток с заземлением осн. 200 L 2000, толщ. 1,2мм';
  const cut = clipTitle(long, 40, false);
  assert.equal(cut.length, 38, `обрезка до limit−2: «${cut}»`);
  assert.ok(cut.endsWith('…'));
  assert.ok(long.startsWith(cut.slice(0, -1)), 'обрезка — начало исходного названия');
  // Ключ отъедает свой резерв — и только у той строки, где он есть.
  assert.ok(clipTitle(long, 40, true).length < cut.length, 'под ключ остаётся место');
  assert.equal(clipTitle('Кабель', 40, true), 'Кабель', 'короткое название резерв не режет');
  // Вырожденный лимит не даёт отрицательного среза.
  assert.ok(clipTitle(long, 2, true).length >= 1);
}

// ── РАЗВЁРНУТЫЕ НАЗВАНИЯ ───────────────────────────────────────────────────
// Девятое тихое место: режим не падает — он молча отдаёт названию обычные
// 280px, и тумблер «работает», ничего не меняя.
{
  const WIDE = 440;
  // Пол названия поднят, ширины КП и полы левого блока не тронуты.
  const pan = layoutOf(900, 6, true);
  assert.equal(pan.pan, true, 'на 900px с шестью КП это панорама');
  assert.equal(pan.title, WIDE, 'в панораме название встаёт на РАЗВЁРНУТЫЙ пол');
  assert.deepEqual([pan.qty, pan.unit, pan.spread], [102, 92, 90],
    'левый блок остаётся на своих полах — режим забирает место у панорамы');
  assert.deepEqual(bidWidths(pan), Array(6).fill(BID_FIXED), 'ширины КП не трогаются');
  assert.equal(layoutOf(900, 6).title, 280, 'без тумблера — обычный пол');

  // Порог панорамы сдвигается ровно на разницу полов (440 − 280).
  const narrow = NUM_FIXED + 102 + 92 + 90 + 280 + 3 * BID_FIXED;
  assert.equal(layoutOf(narrow, 3).pan, false, 'обычный режим на пороге ещё влезает');
  assert.equal(layoutOf(narrow, 3, true).pan, true, 'развёрнутый — уже нет');
  assert.equal(layoutOf(narrow + (WIDE - 280), 3, true).pan, false,
    'порог сдвинут ровно на разницу полов');

  // Сходимость и монотонность обязаны держаться и в этом режиме.
  let prevWide = layoutOf(640, 6, true);
  for (let available = 690; available <= 2400; available += 10) {
    const l = layoutOf(available, 6, true);
    if (!l.pan) assert.equal(sum(l), available, `сходимость (развёрнуто) @${available}`);
    assert.ok(l.title >= WIDE, `пол развёрнутого названия @${available}: ${l.title}`);
    assert.ok(l.title >= prevWide.title && l.qty >= prevWide.qty
      && l.unit >= prevWide.unit && l.spread >= prevWide.spread,
    `монотонность (развёрнуто) @${available}`);
    prevWide = l;
  }

  // Развёрнутая колонка НИКОГДА не уже обычной при той же ленте.
  for (const available of [800, 1000, 1200, 1600, 2000]) {
    assert.ok(layoutOf(available, 5, true).title >= layoutOf(available, 5).title,
      `развёрнутое название не уже обычного @${available}`);
  }

  // Лимит знаков: две строки — вдвое, потолок тоже вдвое.
  assert.equal(titleLimit(undefined, 2), TITLE_CHARS * 2, 'до замера — двойной потолок');
  assert.equal(titleLimit(10_000, 2), TITLE_CHARS * 2, 'широкая колонка не даёт больше');
  assert.equal(titleLimit(WIDE, 2), titleLimit(WIDE) * 2, 'две строки — ровно вдвое');
  assert.ok(titleLimit(WIDE, 2) > titleLimit(280), 'режим реально удлиняет название');
  // Одна строка по умолчанию — старое поведение не тронуто.
  assert.equal(titleLimit(280, 1), titleLimit(280));
}

console.log('columns: ok');
