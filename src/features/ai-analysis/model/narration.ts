/** ПОЛОВИНА МОДЕЛИ В РАЗБОРЕ: слот `note` и правила, по которым чужой текст в
 *  него попадает.
 *
 *  ЗАЧЕМ ОТДЕЛЬНЫМ ФАЙЛОМ. `analysis.ts` — половина СЕРВЕРА: отбор, порядок и
 *  все числа. Она завтра уедет на бэкенд целиком. Сюда приходит ответ модели
 *  (06-ai-contract.md §5) и здесь же стоит контроль, который сервер обязан
 *  сделать до показа (§6). Пока живой модели нет, на тот же вход подаётся
 *  заготовка `draft`, собранная `buildAnalysis()` — В ТОЙ ЖЕ ФОРМЕ, в какой
 *  придёт ответ. Поэтому «подключить ИИ» — это заменить источник `AiResponse`
 *  в `api/analysis.api.ts` и больше ничего: ни структура, ни числа, ни лимиты
 *  не сдвинутся, потому что их производит не модель.
 *
 *  ТРИ ПРАВИЛА, И НИ ОДНО НЕ УКРАШЕНИЕ — каждое ловит то, чем врёт языковая
 *  модель, и врёт правдоподобно:
 *
 *  1. ЧУЖОЙ ID НЕ ИСПОЛНЯЕТСЯ. Модель говорит только о пунктах, которые ей
 *     дали. Выдуманный `id` молча отбрасывается, а не заводит пункт (§6).
 *  2. ГДЕ МОДЕЛИ НЕТ МЕСТА — ЕГО НЕТ И У ОТВЕТА. «Полнота и сопоставимость»,
 *     «ещё не подал», хвост «и ещё N» помечены `mute`, и текст в них не
 *     попадёт, даже если модель его прислала (05 §4.1, §4.3.4). Ошибка модели
 *     в полноте дороже всех прочих: она меняет доверие ко всему разбору.
 *  3. ЧИСЛО В ТЕКСТЕ ОБЯЗАНО БЫТЬ ПОДТВЕРЖДЕНО. Любое число фразы обязано
 *     сойтись с `evidence[]` своего пункта или уже стоять в серверных строках
 *     этого же пункта. Не сошлось — фраза не показывается целиком (§6:
 *     «несогласованное число пользователю не показывается»). Это единственное
 *     правило, которое нельзя проверить глазом на демо: выдуманный процент
 *     выглядит ровно как настоящий.
 *
 *  Лимит длины — оттуда же (§6, «длина текста»): слот модели один-две фразы,
 *  простыня ломает вёрстку пункта и подменяет собой сами факты. */

import type { AnalysisItem, AnalysisResult, AnalysisSection } from './analysis';

/** Один вывод модели по 06 §5 — ровно те поля, что заполняют слот `note`.
 *  Имена полей контрактные (snake_case): это форма ЧУЖОГО ответа, а не наша
 *  внутренняя структура, и переименование здесь означало бы адаптер. */
export interface AiInsight {
  /** id пункта серверного разбора. Всё, чего нет в разборе, отбрасывается. */
  id: string;
  /** Почему это важно. */
  reason?: string;
  /** Что с этим делать. */
  next_action?: string;
  /** Оговорка («ориентир, а не обещанная скидка»). */
  caveat?: string;
}

/** Ответ модели. `insights[]` адресуется по id — и пунктам, и секциям целиком
 *  («Общая картина раунда» комментируется одной фразой на секцию), поэтому
 *  отдельного поля под секции нет: пространства id не пересекаются. */
export interface AiResponse {
  insights?: AiInsight[];
}

/** Потолок слота модели, символов. */
export const NOTE_MAX = 240;

/** Числа фразы против чисел пункта. Сравнение ПО НОРМАЛИЗОВАННОЙ ЗАПИСИ, а не
 *  по значению: «875 000», «875000» и «875 000 ₽» — одно число, а «874 000» —
 *  другое, и именно такую подмену модель делает чаще всего. Округление
 *  учитывается: сервер печатает `−3,9 %` от `-3.94`. */
const numbersOf = (text: string): string[] =>
  (text.match(/\d[\d  \s]*(?:[.,]\d+)?/g) ?? [])
    .map((n) => n.replace(/[  \s]/g, '').replace(',', '.'))
    .map((n) => n.replace(/\.0+$/, ''));

const confirmed = (item: AnalysisItem): Set<string> => {
  const ok = new Set<string>();
  /* Серверные строки пункта: число, уже напечатанное фактом, модель вправе
     повторить — оно пришло из расчёта, а не из неё. */
  for (const n of numbersOf([item.title, ...(item.details ?? [])].join(' '))) ok.add(n);
  for (const e of item.evidence) {
    const v = Math.abs(e.value);
    ok.add(String(v));
    ok.add(String(Math.round(v)));
    ok.add(String(Math.round(v * 10) / 10));
    ok.add(String(Math.round(v * 100) / 100));
  }
  return ok;
};

/** Фраза, годная к показу: в пределах лимита и без единого неподтверждённого
 *  числа. `null` — фразы не будет вовсе (пункт останется одними фактами). */
export function vetNote(note: string, item: AnalysisItem): string | null {
  const text = note.trim();
  if (!text) return null;
  if (item.mute) return null;
  const ok = confirmed(item);
  for (const n of numbersOf(text)) if (!ok.has(n)) return null;
  return text.length > NOTE_MAX ? `${text.slice(0, NOTE_MAX - 1).trimEnd()}…` : text;
}

/** Фраза модели из её собственных полей: «почему важно» → «что делать» →
 *  оговорка. Порядок задан 05 §5 и не переставляется. */
const phraseOf = (insight: AiInsight): string =>
  [insight.reason, insight.next_action, insight.caveat]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');

/**
 * Кладёт ответ модели в готовый разбор. Новый объект, вход не мутируется:
 * серверная половина обязана оставаться воспроизводимой без модели — на ней
 * стоит проверка `analysis.check.ts`.
 *
 * Секции комментируются по своему id, пункты — по id пункта. Всё, что не
 * прошло `vetNote`, оставляет пункт с одними фактами: частичный ответ не
 * выдаётся за полный (05 §9), но и не отменяет посчитанное.
 */
export function applyNarration(result: AnalysisResult, response: AiResponse): AnalysisResult {
  const said = new Map<string, string>();
  for (const insight of response.insights ?? []) {
    if (!insight?.id) continue;
    const phrase = phraseOf(insight);
    if (phrase) said.set(insight.id, phrase);
  }

  const narrate = (item: AnalysisItem): AnalysisItem => {
    const note = said.has(item.id) ? vetNote(said.get(item.id)!, item) : null;
    return { ...item, note: note ?? '' };
  };

  const sections: AnalysisSection[] = result.sections.map((section) => ({
    ...section,
    /* Фраза о секции целиком числами не подтверждается ничем, кроме её же
       набора показателей: он серверный и печатается рядом. Поэтому здесь
       достаточно лимита длины. */
    note: said.has(section.id)
      ? said.get(section.id)!.slice(0, NOTE_MAX)
      : undefined,
    items: section.items?.map(narrate),
    subsections: section.subsections?.map((sub) => ({ ...sub, items: sub.items.map(narrate) })),
  }));

  return { ...result, sections };
}
