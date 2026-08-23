/** Самопроверка расчётчика ширин колонок сравнения. Седьмое тихое место:
 *  алгоритм не падает — он молча отдаёт колонкам невозможную раскладку, и
 *  на живом экране это видно только лишним скроллом или щелью у края.
 *  Здесь фиксируются свойства распределения (полы, равность долей,
 *  сходимость суммы, монотонность) и живые сценарии («док открыли»,
 *  «шесть длинных имён»).
 *  Запуск: bun src/pages/tender/model/columns.check.ts
 *  Фреймворка нет намеренно — то же соглашение, что у comparison.check.ts. */
import { strict as assert } from 'node:assert';
import { computeColumnLayout } from './columns';

const layoutOf = (available: number, floors: number[]) =>
  computeColumnLayout({ available, bids: floors.map((floor, i) => ({ id: `c${i}`, floor })) });

const sum = (l: ReturnType<typeof computeColumnLayout>) =>
  l.qty + l.unit + l.spread + l.title + Object.values(l.bids).reduce((a, b) => a + b, 0);

// ── влезает: равная доля упирается в потолок, название забирает излишек ───
{
  const l = layoutOf(1457, [180, 180, 180]);
  assert.equal(l.pan, false);
  const bidWidths = Object.values(l.bids);
  assert.deepEqual(bidWidths, [280, 280, 280], 'доля выше потолка — все на потолке');
  assert.equal(l.title, 1457 - 288 - 840, 'излишек целиком у названия');
}

// ── влезает впритык: доля между полом и потолком, колонки равны ───────────
{
  const l = layoutOf(1300, [180, 180, 180]);
  assert.equal(l.pan, false);
  const w = Object.values(l.bids);
  assert.ok(w.every((x) => x === w[0]), 'равная доля — колонки одинаковы');
  assert.ok(w[0] > 180 && w[0] < 280, `доля внутри вилки: ${w[0]}`);
  assert.ok(l.qty === 104 && l.unit === 88 && l.spread === 96, 'левый блок на базах');
}

// ── тесно: левый блок сжимается, пока название не упрётся в минимум ────────
{
  const l = layoutOf(1200, [250, 250, 250]);
  assert.equal(l.pan, false);
  assert.ok(l.qty < 104 && l.unit < 88 && l.spread < 96, 'левый блок сжат');
  assert.deepEqual(Object.values(l.bids), [250, 250, 250], 'полы имён держатся');
  assert.ok(l.title >= 200, `название не ниже минимума: ${l.title}`);
}

// ── длинное имя: своя колонка шире соседних, левые поджимаются ─────────────
{
  const l = layoutOf(1300, [170, 170, 420]);
  assert.equal(l.pan, false);
  assert.deepEqual(Object.values(l.bids), [170, 170, 420], 'каждый на своём полу');
  assert.ok(l.title >= 200, `название удержало минимум: ${l.title}`);
  assert.deepEqual([l.qty, l.unit, l.spread], [104, 88, 96],
    'минимумам хватило места — левый блок остался на базах');
}

// ── полы доминируют: левый блок жертвует шириной первым ────────────────────
{
  const l = layoutOf(1200, [250, 250, 250]);
  assert.equal(l.pan, false);
  assert.deepEqual(Object.values(l.bids), [250, 250, 250]);
  assert.ok(l.qty < 104 && l.unit < 88 && l.spread < 96, 'левый блок сжат');
  assert.ok(l.title >= 200, `название не ниже минимума: ${l.title}`);
}

// ── глубокая панорама: сумма полов больше доступного вовсе ────────────────
{
  const l = layoutOf(700, [260, 260, 260, 260, 260, 260]);
  assert.equal(l.pan, true);
  assert.deepEqual(Object.values(l.bids), [260, 260, 260, 260, 260, 260]);
  assert.equal(sum(l) > 700, true, 'сумма полов перерастает ленту — панорамирует она');
}

// ── сходимость: вне панорамы сумма колонок ровно в доступной ширине ────────
for (const available of [900, 1000, 1152, 1280, 1440, 1600, 1920]) {
  for (const floors of [[150], [180, 220], [200, 200, 200], [190, 210, 430, 180]]) {
    const l = layoutOf(available, floors);
    if (!l.pan) {
      assert.equal(sum(l), available, `${available}px / [${floors}]`);
      assert.ok(l.title >= 200, `минимум названия: ${available}px / [${floors}]`);
    }
  }
}

// ── монотонность: расширение окна никогда не сужает колонку ────────────────
const FLOORS = [230, 195, 205, 420, 185, 240];
let prev = layoutOf(640, FLOORS);
for (let available = 690; available <= 2200; available += 10) {
  const l = layoutOf(available, FLOORS);
  assert.ok(l.qty >= prev.qty && l.unit >= prev.unit && l.spread >= prev.spread,
    `левый блок: ${prev.qty}/${prev.unit}/${prev.spread} → ${l.qty}/${l.unit}/${l.spread} @${available}`);
  for (const [i, w] of Object.values(l.bids).entries()) {
    assert.ok(w >= Object.values(prev.bids)[i],
      `колонка c${i}: ${Object.values(prev.bids)[i]} → ${w} @${available}`);
  }
  assert.ok(l.title >= prev.title, `название: ${prev.title} → ${l.title} @${available}`);
  prev = l;
}

// ── вырожденные случаи ─────────────────────────────────────────────────────
assert.deepEqual(layoutOf(400, []).pan, true, 'без КП и места — панорама');
const solo = layoutOf(1600, []);
assert.equal(solo.pan, false);

console.log('columns: ok');
