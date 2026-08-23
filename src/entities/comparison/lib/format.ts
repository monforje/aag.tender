/** Деньги и числа сравнения одним форматом на весь экран: таблица, карточка
 *  подрядчика, попап и панель разбора обязаны писать одну и ту же сумму
 *  одинаково — иначе два вида одного числа рядом читаются как расхождение.
 *
 *  Сегмент lib, а не model: формат не знает ни одного правила предметной
 *  области, ему всё равно, цена это или потенциал. */

const MONEY = new Intl.NumberFormat('ru-RU', {
  style: 'currency', currency: 'RUB', maximumFractionDigits: 0,
});
const DECIMAL = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const COMPACT = new Intl.NumberFormat('ru-RU', {
  style: 'currency', currency: 'RUB',
  notation: 'compact', maximumFractionDigits: 0,
});

/** Рубли без копеек: в сравнении КП значащие разряды — миллионы, и копейки
 *  только удлиняют колонку. */
export const money = (value: number): string => MONEY.format(value);
/** Деньги с сокращением порядков БЕЗ дробных — формат примеров модели ячейки
 *  (`164 тыс. ₽`): главный показатель потенциального режима длинным числом
 *  ломает строку, а точность после первой значащей цифры там ничего не
 *  решает. */
export const moneyCompact = (value: number): string => COMPACT.format(value);
/** Число с запятой и без хвоста нулей — объёмы (86,5 т) и проценты (7,9 %). */
export const decimal = (value: number): string => DECIMAL.format(value);
