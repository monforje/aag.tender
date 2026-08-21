/* Цветовая арифметика пикера. Отдельным файлом от компонента: это чистые
   функции без React, и проверяются они запуском (см. color.check.ts), а не
   глазами по интерфейсу — ошибка в округлении не падает, а молча смещает
   оттенок на пару градусов при каждом круге преобразований. */

/** Внутреннее представление пикера. HSV, а не RGB: у площадки насыщенности
 *  оси — это ровно S и V, а оттенок обязан ПЕРЕЖИВАТЬ уход в чёрное и в
 *  белое. В RGB чёрный — это (0,0,0), и вернувшись из угла, ползунок оттенка
 *  прыгнул бы на красный. */
export type Hsva = { h: number; s: number; v: number; a: number };

/** Формат, в котором показывается и вводится значение. */
export type ColorFormat = 'hex' | 'rgb' | 'hsl';
export const FORMATS: ColorFormat[] = ['hex', 'rgb', 'hsl'];

type Rgb = { r: number; g: number; b: number };

const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));
const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0');

export function hsvToRgb({ h, s, v }: Hsva): Rgb {
  /* Каноническая формула через f(n): она короче разбора шести секторов по
     if-ам и не имеет их любимой ошибки — потери одного значения на стыке
     секторов (h ровно 60, 120, 180…). */
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return { r: f(5) * 255, g: f(3) * 255, b: f(1) * 255 };
}

export function rgbToHsv({ r, g, b }: Rgb, a = 1): Hsva {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max, a };
}

/** Строка для CSS. Всегда rgba(): она понятна и в `color-mix`, и в фоне, и
 *  не требует от потребителя знать про восьмизначный hex. */
export function toCss(hsva: Hsva): string {
  const { r, g, b } = hsvToRgb(hsva);
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${+hsva.a.toFixed(3)})`;
}

/** Значение для текстового поля в выбранном формате. Прозрачность в подпись
 *  не входит: у неё своё поле, и дублировать её в hex значило бы дать два
 *  органа управления одним числом. */
export function format(hsva: Hsva, fmt: ColorFormat): string {
  const { r, g, b } = hsvToRgb(hsva);
  if (fmt === 'hex') return `#${hex2(r)}${hex2(g)}${hex2(b)}`.toUpperCase();
  if (fmt === 'rgb') return `${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`;
  const l = hsva.v * (1 - hsva.s / 2);
  const sl = l === 0 || l === 1 ? 0 : (hsva.v - l) / Math.min(l, 1 - l);
  return `${Math.round(hsva.h)}, ${Math.round(sl * 100)}%, ${Math.round(l * 100)}%`;
}

/** Разбор ЛЮБОЙ строки, которую понимает CSS, — самим CSS. Своего разбора
 *  здесь нет намеренно: регулярка на hex/rgb/hsl/имена цветов — это сто строк
 *  и вечный источник «а почему `rebeccapurple` не работает». Браузер
 *  нормализует присвоенное в `rgb(...)`, а недопустимое просто не принимает,
 *  оставляя свойство пустым, — и это же служит проверкой ввода. */
export function parse(text: string): Hsva | null {
  const raw = text.trim();
  if (!raw) return null;
  /* Голые числа из наших же полей: «99, 102, 241» — валидный ввод для
     формата rgb, но не валидный CSS. Дописываем обёртку, если её нет. */
  const guess = /^[\d.\s,%-]+$/.test(raw)
    ? (raw.includes('%') ? `hsl(${raw})` : `rgb(${raw})`)
    : (/^[0-9a-f]{3,8}$/i.test(raw) ? `#${raw}` : raw);

  const probe = document.createElement('div');
  probe.style.color = guess;
  if (!probe.style.color) return null;

  const m = probe.style.color.match(/[\d.]+/g);
  if (!m || m.length < 3) return null;
  const [r, g, b, a] = m.map(Number);
  return rgbToHsv({ r, g, b }, a === undefined ? 1 : clamp(a));
}
