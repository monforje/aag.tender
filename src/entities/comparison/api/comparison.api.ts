/** ЕДИНСТВЕННАЯ ДВЕРЬ К ДАННЫМ СРАВНЕНИЯ. Экран не знает, откуда они: сегодня
 *  из `comparison.mock.ts`, завтра из ответа сервера — и подмена стоит ровно
 *  этого файла, потому что за его пределами фикстуры не упоминаются нигде.
 *
 *  ФУНКЦИИ АСИНХРОННЫ УЖЕ СЕЙЧАС, хотя мок отвечает мгновенно. Это не
 *  украшение: синхронное чтение фикстуры разошлось бы с сетью в тот день,
 *  когда её подключат, — у экрана не оказалось бы ни состояния загрузки, ни
 *  места под ошибку, и «подключить API» превратилось бы в переделку страницы
 *  вместо замены тела двух функций.
 *
 *  ЗАПРОС ИМЕНУЕТ ТЕНДЕР И РАУНД — то же, что уйдёт в путь запроса
 *  (`/tenders/{tenderId}/comparison?round=N`). Сегодня тендер игнорируется:
 *  демо-смета в приложении одна, и карточка ЛЮБОГО тендера показывает её же. */

import type { Comparison, CorrectionStatus } from '../model/contract';
import { MOCK_AXP, MOCK_ROUND1, MOCK_ROUND2_FULL, MOCK_ROUND2_PARTIAL } from './comparison.mock';

export interface ComparisonQuery {
  tenderId: string;
  /** Номер раунда; не задан — снимок текущего круга. */
  round?: number;
}

/** Демо-сцена раундов живёт у одного тендера; остальным отвечает статический
 *  снимок (пока данные есть только у двух). */
const DEMO_TENDER_ID = 'T-2026-014';

/* ── ДЕМО-СЦЕНАРИЙ ──────────────────────────────────────────────────────────
   Три снимка одной истории торгов (сцены 4 → 6 → 7). Курсор — состояние
   ленты подач: с настоящим эндпоинтом его роль играет сама база, и вся эта
   секция исчезает вместе с моком.
   ponytail: курсор один на приложение, по тендерам не разделён — до реального
   эндпоинта делить нечего (демо-тендер один). */
const TIMELINE = [MOCK_ROUND1, MOCK_ROUND2_PARTIAL, MOCK_ROUND2_FULL] as const;
let cursor = 0;

/* ── СНИМОК, КОТОРЫЙ МЕНЯЮТ ─────────────────────────────────────────────────
   Решение по корректировке и выбор версии КП — ЗАПИСЬ: после них ответ
   сервера другой. С настоящим эндпоинтом это делает база; здесь роль базы
   играет переменная, и держится она РЯДОМ С ЧТЕНИЕМ, а не у мутаций: два
   модуля, пишущих в одно состояние, разошлись бы на первой же правке.

   СНИМОК ЗАМЕНЯЕТСЯ ЦЕЛИКОМ, а не правится на месте. Мутация того же объекта
   не поменяла бы ни одной ссылки, и экран остался бы со старыми числами
   молча: `analyzeComparison` мемоизирован ПО ССЫЛКАМ `groups`/`contractors`,
   и правка поля внутри для него не событие. Новый объект — единственное, что
   эти мемо видят. */
let axp: Comparison = MOCK_AXP;

/** Снимок сравнения. Раунд не назван — текущий; назван прошлый — снимок того
 *  круга, если он в истории есть (база секций «Изменения поставщика»).
 *  Неизвестный раунд — `null`, а не пустое сравнение: «данных нет» и «все
 *  отказались» это разные экраны.
 *
 *  ПОИСК ИДЁТ ОТ КУРСОРА НАЗАД, а не с начала ленты: у одного круга в истории
 *  несколько подач (второй раунд — сначала одно новое КП, потом два), и
 *  «раунд 2» означает его состояние НА СЕЙЧАС, а не первую из них. */
export async function fetchComparison(query: ComparisonQuery): Promise<Comparison | null> {
  if (query.tenderId !== DEMO_TENDER_ID) {
    /* Раундов у статических тендеров нет: «раунд N» мимо текущего — данных
       нет, и это не пустое сравнение, а другой экран. */
    return query.round === undefined ? axp : null;
  }
  const seen = TIMELINE.slice(0, cursor + 1);
  if (query.round === undefined) return seen[seen.length - 1];
  return [...seen].reverse().find((snapshot) => snapshot.roundNumber === query.round) ?? null;
}

/** ДЕМО: следующий молчащий подрядчик подаёт КП. Данные меняются, ревизия
 *  ответа растёт — на этом живёт плашка устаревания сохранённого разбора
 *  (05 §8.2). В проде подача приходит от подрядчика, а не отсюда; кнопка,
 *  которая это дёргает, — часть демо-раздела «Раунды».
 *
 *  Возвращает `false`, когда подавать больше некому: кнопка обязана погаснуть,
 *  а не делать вид, что сработала. У статических тендеров (вне демо-сцены)
 *  ленты подач нет вовсе — `false` сразу. */
export async function simulateNextSubmission(tenderId?: string): Promise<boolean> {
  if (tenderId !== undefined && tenderId !== DEMO_TENDER_ID) return false;
  if (cursor >= TIMELINE.length - 1) return false;
  cursor += 1;
  return true;
}

/* ═══════════════════ ЗАПИСЬ: РЕШЕНИЯ И ВЕРСИИ ═══════════════════
   Обе операции меняют ОТВЕТ, а не показ, и потому живут здесь, а не в
   состоянии экрана: решение по корректировке видит коллега, выбранная версия
   уезжает в выгрузку. Ревизия растёт на каждой — по ней панель разбора
   понимает, что сохранённый результат устарел (05 §8.2). */

/** Ревизия следующего снимка. Строкой с номером, как приходит от сервера. */
const bumped = (current?: string): string => {
  const n = Number(/(\d+)$/.exec(current ?? '')?.[1] ?? 0) + 1;
  return `axp-r${n + 1}`;
};

/** Пересобрать снимок с заменённым подрядчиком: остальные девять уезжают ТЕМИ
 *  ЖЕ ссылками, меняется только массив и один элемент. Так `analyzeComparison`
 *  честно пересчитывается, а всё, что мемоизировано по самим подрядчикам
 *  (условия, досье), переживает правку. */
const replaceContractor = (
  snapshot: Comparison, contractorId: string,
  patch: (c: Comparison['contractors'][number]) => Comparison['contractors'][number],
  note: string,
): Comparison => ({
  ...snapshot,
  contractors: snapshot.contractors.map((c) => (c.id === contractorId ? patch(c) : c)),
  revision: bumped(snapshot.revision),
  revisionNote: note,
});

/** РЕШЕНИЕ ПО КОРРЕКТИРОВКЕ ОБЪЁМА (`correction.md` §3–§4). Знак ⚠ существует
 *  ровно в статусе `pending` — значит принять или отклонить это ОДНО действие:
 *  сменить статус. Гашение знака в ячейке, в шапке колонки и в строке
 *  происходит само, потому что все трое читают `pendingCorrection()`.
 *
 *  Комментарий решения обязателен при отклонении — проверяет вызывающий
 *  (форма панели); здесь он просто сохраняется рядом с обоснованием
 *  поставщика, чтобы история ячейки осталась полной.
 *
 *  Возвращает `false`, когда решать нечего: корректировки нет или она уже
 *  рассмотрена. Панель обязана это показать, а не сделать вид, что сработала. */
export async function decideCorrection(input: {
  tenderId: string;
  contractorId: string;
  positionId: string;
  decision: Extract<CorrectionStatus, 'accepted' | 'declined'>;
  /** Комментарий решения. Обязателен при отклонении (`correction.md` §3). */
  note?: string;
}): Promise<boolean> {
  const { contractorId, positionId, decision, note } = input;
  const target = axp.contractors.find((c) => c.id === contractorId);
  const mark = target?.marks?.[positionId];
  if (!mark?.correction || mark.correction.status !== 'pending') return false;

  axp = replaceContractor(axp, contractorId, (c) => ({
    ...c,
    marks: {
      ...c.marks,
      [positionId]: {
        ...mark,
        correction: {
          ...mark.correction!,
          status: decision,
          /* Обоснование поставщика и комментарий решения — РАЗНЫЕ тексты, и
             затирать первый вторым нельзя: история ячейки должна остаться
             читаемой обеим сторонам. */
          ...(note ? { decisionNote: note } : {}),
        },
      },
    },
  }), decision === 'accepted' ? 'корректировка объёма принята' : 'корректировка объёма отклонена');
  return true;
}

/** ВЫБОР ВЕРСИИ КП (`contractor.md` §2). Меняется поле `versionId`, а расценки
 *  подменяет `withVersion()` на входе в расчёт — снимок остаётся честным
 *  архивом всех версий, а не переписывается выбранной.
 *
 *  Версия без разобранного файла не выбирается: `false`, и меню обязано
 *  показать её неактивной, а не молча ничего не сделать. */
export async function selectBidVersion(input: {
  tenderId: string;
  contractorId: string;
  versionId: string;
}): Promise<boolean> {
  const { contractorId, versionId } = input;
  const target = axp.contractors.find((c) => c.id === contractorId);
  const version = target?.versions?.find((v) => v.id === versionId);
  if (!target || !version) return false;
  const isLatest = target.versions![0].id === versionId;
  if (!isLatest && !version.prices) return false;

  axp = replaceContractor(axp, contractorId, (c) => ({ ...c, versionId }),
    `${target.name}: показана версия ${version.label}`);
  return true;
}
