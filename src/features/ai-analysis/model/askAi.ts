/** ДЕМО-ответчик «Анализа»: маршрутизирует вопрос по ключевым словам к правилам
 *  deriveInsights() и собирает разговорный ответ в мини-разметке чата
 *  (абзацы, списки «- », **жирный** — рендерит <RichText>).
 *
 *  Живёт в фиче, а не в entities: entities отвечает на вопрос «что в данных»,
 *  этот модуль — «что на это отвечают». Правила и пороги ОДНИ на таблицу и
 *  ответы: askAi ничего не считает сам, только читает готовые карточки, поэтому
 *  анализ спорить с таблицей не может в принципе. Завтра вместо этой функции
 *  встанет запрос к модели — контракт AiAnswer уже разговорный.
 */

import {
  deriveInsights,
  type Contractor,
  type Insight,
  type PositionGroup,
} from '@/entities/tender';
import { plural } from '@/shared/lib/plural';

export interface AskContext {
  groups: PositionGroup[];
  contractors: Contractor[];
  /** Отмеченные ★ подрядчики (id) — источник ответов про пару. */
  starred: string[];
}

export interface AiAnswer {
  text: string;
  /** Позиция сметы для тихого действия «Показать строку в таблице»;
   *  null — у ответа нет конкретной строки. */
  rowId: string | null;
}

/* Маршрутизация — в порядке из ТЗ: риски → торг → пара ★ → пробелы, иначе
   сводка. Первое совпадение выигрывает, поэтому «дешевле» в вопросе про торги
   не уводит от пары: сравнение проверяется раньше запасов только когда в
   вопросе есть явное «сравн/против/★». */
export function askAi(question: string, ctx: AskContext): AiAnswer {
  const insights = deriveInsights(ctx.groups, ctx.contractors, ctx.starred);
  const q = question.toLowerCase();

  if (/риск|аномали|подозрител/.test(q)) return risks(insights);
  if (/торг|потенциал|скидк|запас/.test(q)) return trade(insights);
  if (/сравн|против|пару|\bпар\b|звезд|★/.test(q)) return pairReply(ctx, insights);
  if (/не закрыт|неполн|нет цены|пробел|дыр|отказ/.test(q)) return gaps(insights);
  return overview(ctx.contractors.length, insights);
}

/* ── Риски и аномалии ──────────────────────────────────────────────────────── */

function risks(list: Insight[]): AiAnswer {
  const found = list.filter((i) => i.scenario === 'anomalies');
  if (!found.length) {
    return {
      text: 'По срезу чисто: аномальных расценок нет, разброс цен в пределах допуска.',
      rowId: null,
    };
  }
  const items = found.map((i) => `- **${i.title}** — ${i.text}`).join('\n');
  return {
    text: `Вот что стоит проверить до выбора — ${found.length} ${plural(found.length, 'находка', 'находки', 'находок')}:\n\n${items}\n\nОбоснование по помеченным ценам лучше запросить до финального решения.`,
    rowId: found.find((i) => i.rowId)?.rowId ?? null,
  };
}

/* ── Запасы торга ──────────────────────────────────────────────────────────── */

function trade(list: Insight[]): AiAnswer {
  const found = list.filter((i) => i.scenario === 'bidding');
  if (!found.length) {
    return {
      text: 'Заявленного запаса торга над порогом в срезе нет: потенциал либо не заявлен, либо меньше порога фильтра «Есть потенциал». Торговаться здесь можно только «в целом» — за счёт итога.',
      rowId: null,
    };
  }
  const items = found.map((i) => `- **${i.title}** — ${i.text}`).join('\n');
  return {
    text: `Торг есть куда вести. Самый большой заявленный запас — на ${found.length} ${plural(found.length, 'позиции', 'позициях', 'позициях')}:\n\n${items}`,
    rowId: found[0].rowId,
  };
}

/* ── Пара ★ ────────────────────────────────────────────────────────────────── */

function pairReply(ctx: AskContext, list: Insight[]): AiAnswer {
  const chosen = ctx.starred
    .map((id) => ctx.contractors.find((c) => c.id === id))
    .filter((c): c is Contractor => !!c);

  if (chosen.length === 1) {
    return {
      text: `Отмечен только «${chosen[0].name}». Для разложения разницы нужна вторая ★ в шапке таблицы — тогда покажу, кто дешевле и за счёт каких позиций.`,
      rowId: null,
    };
  }
  if (!chosen.length) {
    return {
      text: 'Пара пока не собрана: поставьте ★ двум колонкам в шапке сравнения — разложу разницу итога по позициям и покажу места обоих в ранжире.',
      rowId: null,
    };
  }

  const cmp = list.find((i) => i.scenario === 'compare');
  const sel = list.find((i) => i.scenario === 'selection');
  if (!cmp || !sel) {
    return { text: 'Не удалось собрать разложение пары на текущем срезе.', rowId: null };
  }
  return { text: `**${cmp.title}**\n\n${sel.text}`, rowId: cmp.rowId };
}

/* ── Неполные КП ───────────────────────────────────────────────────────────── */

function gaps(list: Insight[]): AiAnswer {
  const gap = list.find((i) => i.id === 'important:1');
  if (!gap) {
    return {
      text: 'Пробелов в КП нет: смета закрыта расценками у всех подрядчиков, сравнивать итоги можно напрямую.',
      rowId: null,
    };
  }
  return {
    text: `Есть неполное КП — его итог заведомо занижен.\n\n- **${gap.title}** — ${gap.text}`,
    rowId: gap.rowId,
  };
}

/* ── Сводка (маршрут по умолчанию) ─────────────────────────────────────────── */

function overview(bidCount: number, list: Insight[]): AiAnswer {
  const heavy = list.find((i) => i.id === 'important:0');
  const anomalies = list.filter((i) => i.title.startsWith('Аномалия')).length;
  const wideSpreads = list.reduce(
    (n, i) => n + (i.title.startsWith('Высокий разброс') ? Number(i.title.match(/\d+/)?.[0] ?? 0) : 0),
    0,
  );
  const trades = list.filter((i) => i.scenario === 'bidding').length;

  const facts: string[] = [];
  if (heavy) facts.push(`- **${heavy.title}** — ${heavy.text}`);
  if (trades) facts.push(`- Заявленный запас торга есть на **${trades}** ${plural(trades, 'позиции', 'позициях', 'позициях')}.`);
  if (anomalies) facts.push(`- **Аномальных расценок: ${anomalies}** — запросить обоснование.`);
  if (wideSpreads) facts.push(`- Высокий разброс цен на **${wideSpreads}** ${plural(wideSpreads, 'позиции', 'позициях', 'позициях')} — сверить состав объёма.`);

  const tail = !facts.length
    ? '\n\nСрез пуст или данных мало — задайте вопрос конкретнее.'
    : `\n\nКоротко по остальному: ${anomalies + wideSpreads ? 'есть что проверить перед выбором' : 'критичных замечаний нет'}${trades ? ', но и торговаться есть за что' : ''}. Спросите про риски, торг или отмеченных ★ — разложу подробнее.`;

  return {
    text: `В срезе ${bidCount} ${plural(bidCount, 'предложение', 'предложения', 'предложений')}. Двигают итог:\n\n${facts.join('\n')}${tail}`,
    rowId: heavy?.rowId ?? null,
  };
}
