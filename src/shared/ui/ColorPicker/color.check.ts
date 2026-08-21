/* Самопроверка цветовой арифметики: `bun src/shared/ui/ColorPicker/color.check.ts`.
   Нужна потому, что ошибка здесь НЕ ПАДАЕТ, а молча врёт — круг преобразований
   съезжает на градус-другой, и выбранный цвет перестаёт совпадать с показанным
   в поле. Глазами такое ловится через неделю, ассертом — сразу. */
import { format, hsvToRgb, rgbToHsv, toCss, type Hsva } from './color';

const eq = (a: number, b: number, eps = 0.5) => Math.abs(a - b) < eps;

/* Круг hsv → rgb → hsv возвращает то же самое. Проверяются углы всех шести
   секторов И их стыки (60, 120, 180…): именно там разбор по if-ам теряет
   значение, и именно поэтому в hsvToRgb стоит формула через f(n). */
for (const h of [0, 59, 60, 61, 119, 120, 180, 240, 300, 359]) {
  const src: Hsva = { h, s: 0.8, v: 0.9, a: 1 };
  const back = rgbToHsv(hsvToRgb(src));
  console.assert(eq(back.h, h, 1), `оттенок ${h}° вернулся как ${back.h}`);
  console.assert(eq(back.s, 0.8, 0.01), `насыщенность ${h}° → ${back.s}`);
  console.assert(eq(back.v, 0.9, 0.01), `яркость ${h}° → ${back.v}`);
}

/* Известные цвета. #6366F1 — тот самый индиго со скриншота shadcn. */
console.assert(format({ h: 0, s: 0, v: 0, a: 1 }, 'hex') === '#000000', 'чёрный');
console.assert(format({ h: 0, s: 0, v: 1, a: 1 }, 'hex') === '#FFFFFF', 'белый');
console.assert(format({ h: 0, s: 1, v: 1, a: 1 }, 'hex') === '#FF0000', 'красный');
console.assert(
  format(rgbToHsv({ r: 99, g: 102, b: 241 }), 'hex') === '#6366F1',
  `индиго вернулся как ${format(rgbToHsv({ r: 99, g: 102, b: 241 }), 'hex')}`,
);

/* Серый: насыщенность 0, и оттенок при этом ЛЮБОЙ. Формат hsl обязан
   выдержать деление на ноль в пересчёте s из v — без охраны там NaN. */
console.assert(format({ h: 200, s: 0, v: 0.5, a: 1 }, 'hsl') === '200, 0%, 50%', 'серый в hsl');
console.assert(format({ h: 0, s: 0, v: 0, a: 1 }, 'hsl') === '0, 0%, 0%', 'чёрный в hsl без NaN');

/* Прозрачность доезжает до CSS-строки и не теряется в округлении. */
console.assert(toCss({ h: 0, s: 1, v: 1, a: 0.5 }) === 'rgba(255, 0, 0, 0.5)', 'альфа в rgba');
console.assert(toCss({ h: 0, s: 1, v: 1, a: 1 }) === 'rgba(255, 0, 0, 1)', 'непрозрачный');

console.log('color.check: проверки прошли');
