/** Форма слова при числе: plural(1, 'позиция', 'позиции', 'позиций').
 *
 *  Правило склонения не пишется руками (и тем более не `n === 1 ? одна :
 *  много` — на 21 и 112 это видно сразу): его знает Intl.PluralRules, стандарт
 *  платформы. Отсюда же берёт формы `daysWord` в lib/date — она была первой, и
 *  копировать её таблицу во второй счётчик уже не пришлось.
 *
 *  Нужно ровно там, где число ПЕРЕМЕННОЕ: подписей вида «3 предложения»,
 *  написанных под тройку из фикстуры, API не переживёт. */
const RU_PLURAL = new Intl.PluralRules('ru-RU');

export function plural(n: number, one: string, few: string, many: string): string {
  /* Record, а не литерал: у Intl шесть категорий (zero, two, other…), русскому
     из них нужны три, и на остальных ответ — «many». */
  const forms: Record<string, string> = { one, few, many };
  return forms[RU_PLURAL.select(Math.abs(n))] ?? many;
}
