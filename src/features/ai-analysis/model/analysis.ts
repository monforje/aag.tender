/** Разбор тендера — серверная половина ИИ-анализа (06-ai-contract.md §5.1).
 *
 *  РАЗДЕЛЕНИЕ ОТВЕТСТВЕННОСТИ — СМЫСЛ ЭТОГО ФАЙЛА (05 §4.3): отбор, порядок и
 *  ВСЕ числа делает код. Формулировка модели сюда НЕ ПОПАДАЕТ ВОВСЕ: сборка
 *  оставляет слоты `note` пустыми и отдаёт фразы ОТДЕЛЬНЫМ объектом `draft` —
 *  в той же форме, в какой их пришлёт живая модель (06 §5). Кладёт их на
 *  место `applyNarration()` из `narration.ts`, он же проверяет числа и
 *  отбрасывает чужие id. Подключение модели = замена источника `draft` в
 *  `api/analysis.api.ts`; ни структура, ни лимиты, ни числа не сдвигаются.
 *
 *  Порядок секций фиксированный (05 §4): изменения поставщиков → общая картина
 *  раунда → базовый разбор. Первые две появляются ТОЛЬКО с предыдущим раундом;
 *  их отсутствие в первом круге — норма, а не пустая секция. Лимиты: находки
 *  брифа ≤ 4, картина по тендеру ≤ 3, точки торгов ≤ 7, аномалии ≤ 5
 *  (+ хвост «и ещё N»), полнота — без лимита и всегда. У «ещё не подал» модель
 *  молчит (05 §4.1), в полноте модели нет вовсе (§4.3.4) — там note пустая
 *  строка. Над секциями живёт БРИФ «сначала вывод» (verdict/findings/why/
 *  recommendation) — его тексты серверные, как заголовки пунктов; граница
 *  «сервер / модель» не сдвигается.
 *
 *  Отклонения считаются ОТ МЕДИАНЫ строки/поля (эталонной цены в контракте
 *  нет), поэтому все тексты говорят «дороже, чем у большинства», никогда —
 *  «отклонение от эталона» (О3 в AI-ANALYSIS.md). */

import { plural } from '@/shared/lib/plural';
import type { AiResponse } from './narration';
import {
  analyzeComparison, cellMark, decimal, deviationPct, flatten,
  medianOf, money, POTENTIAL_MIN, rankBids, snapshotRound, sumOf,
  type ComparePosition, type CompareThresholds, type Comparison, type Contractor,
  type PresetId, type RowFacts, type TransitionMetricId,
} from '@/entities/comparison';

/* ── контракт вывода ──────────────────────────────────────────────────────── */

export type AnalysisSectionId = 'supplier_changes' | 'round_summary' | 'base_review';
export type AnalysisSubsectionId =
  | 'tender_overview' | 'negotiation_points' | 'anomalies' | 'completeness';

/** Кликабельная сущность внутри текста разбора (05 §6): единственная дорога
 *  «анализ → таблица», отдельных кнопок «Показать в таблице» нет. */
export interface AnalysisRef {
  kind: 'work' | 'contractor';
  id: string;
  label: string;
}

/** Число, вынесенное в текст: страховка правила «факт без evidence не звучит». */
export interface AnalysisEvidence {
  positionId?: string;
  contractorId?: string;
  metric: string;
  value: number;
}

export interface AnalysisTransition {
  preset: PresetId;
  requiredMetrics?: TransitionMetricId[];
  focus?: { positionId?: string; contractorId?: string };
}

export interface AnalysisItem {
  id: string;
  section: AnalysisSectionId;
  subsection?: AnalysisSubsectionId;
  /** Серверная строка: наблюдение с числами. */
  title: string;
  /** Серверные факты второй строкой: топ шагов, «и ещё N», состав пробелов. */
  details?: string[];
  /** Слот модели: одна фраза «почему важно / что делать». СБОРКА ОСТАВЛЯЕТ
   *  ЕГО ПУСТЫМ — фразы приходят отдельным ответом через `applyNarration`
   *  (`narration.ts`). Так видно глазом, где кончается расчёт и начинается
   *  интерпретация, и подмена заготовки живой моделью ничего больше не
   *  трогает. */
  note: string;
  /** Модели здесь места нет вовсе: «ещё не подал» (05 §4.1), полнота и
   *  сопоставимость (§4.3.4), хвост «и ещё N». Текст в такой пункт не
   *  попадёт, даже если модель его пришлёт. */
  mute?: true;
  refs: AnalysisRef[];
  evidence: AnalysisEvidence[];
  transition?: AnalysisTransition;
}

export interface AnalysisSection {
  id: AnalysisSectionId;
  title: string;
  /** Пункты секции («Изменения поставщиков»). */
  items?: AnalysisItem[];
  /** Фиксированный набор показателей круга («Общая картина») — его задаёт
   *  сервер, набор одинаковый от раунда к раунду (05 §4.2). */
  meta?: Array<{ label: string; value: string }>;
  /** Фраза модели об итогах круга. */
  note?: string;
  /** Подсекции базового разбора. */
  subsections?: Array<{ id: AnalysisSubsectionId; title: string; items: AnalysisItem[] }>;
}

/** Род находки брифа — то, каким глазом её читают: вывод, деньги торга,
 *  подозрение или пробел данных. Тон и глиф панели выводятся из него. */
export type AnalysisFindingKind = 'key' | 'saving' | 'anomaly' | 'risk';

/** Верхний блок разбора «сначала вывод»: вердикт → находки → почему → что
 *  делать (решение владельца 23.08.2026 — пользователь обязан понимать результат
 *  до раскрытия секций).
 *
 *  ВСЕ ТЕКСТЫ ЗДЕСЬ СЕРВЕРНЫЕ, как заголовки пунктов: это композиция ЧИСЕЛ,
 *  посчитанных ниже, а не интерпретация модели. Слоты `note` при этом остаются
 *  при своих пунктах — граница «сервер / модель» не сдвигается. Когда выводы
 *  переедут к живой модели, они пойдут через `draft` тем же путём, что и
 *  заметки, — структура брифа не изменится. */
export interface AnalysisBrief {
  /** Вердикт в одно-два предложения: что за тендер передо мной. */
  verdict: string;
  /** ≤ ANALYSIS_LIMITS.findings находок в порядке значимости. */
  findings: Array<{
    kind: AnalysisFindingKind;
    title: string;
    ref?: AnalysisRef;
    transition?: AnalysisTransition;
  }>;
  /** Почему это важно — одна фраза о главном сигнале. */
  why: string;
  /** Конкретное действие и, если оно есть, переход в таблицу. */
  recommendation: {
    text: string;
    transition?: AnalysisTransition;
  };
}

export interface AnalysisResult {
  roundNumber: number;
  createdAt: number;
  /** ≤ 3 пунктов, каждый — якорь к секции (05 §3). */
  summary: Array<{ text: string; section: AnalysisSectionId; subsection?: AnalysisSubsectionId }>;
  /** Верхний блок «сначала вывод» — над секциями. */
  brief: AnalysisBrief;
  sections: AnalysisSection[];
  /** Комментарии разбора к ячейкам таблицы: ключ `${contractorId}:${positionId}`.
   *  До запуска разбора карта пуста — попапы показывают одни числа (Р4). */
  popupNotes: Record<string, string>;
}

/** Лимиты выводов — константой, чтобы check-скрипт сверял структуру против
 *  того же числа, что режет списки. */
export const ANALYSIS_LIMITS = { summary: 3, findings: 4, overview: 3, points: 7, anomalies: 5 } as const;

/** Итог сборки: структура с ПУСТЫМИ слотами модели плюс заготовка фраз в той
 *  же форме, в какой их пришлёт живая модель (06 §5). Разделение — не поза:
 *  проверка `analysis.check.ts` гоняет `result` без единой фразы и ловит
 *  день, когда число утечёт из расчёта в текст. */
export interface AnalysisBuild {
  result: AnalysisResult;
  draft: AiResponse;
}

/* ── помощники ────────────────────────────────────────────────────────────── */

const signed = (v: number): string =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${decimal(Math.abs(v))}`;

const fmtDelta = (d: number): string => `${d < 0 ? '−' : '+'}${money(Math.abs(d))}`;

/** Процент со знаком и типографским минусом — как в таблице сравнения. */
const signedPct = (v: number): string => `${signed(v)} %`;

/** Имя подрядчика по id: незнакомый id даёт сам id, а не undefined. */
const who = (contractors: Contractor[], id: string): string =>
  contractors.find((c) => c.id === id)?.name ?? id;

const cref = (c: Contractor): AnalysisRef => ({ kind: 'contractor', id: c.id, label: c.name });
const wref = (p: ComparePosition): AnalysisRef => ({ kind: 'work', id: p.id, label: p.title });

/* ── сборка разбора ───────────────────────────────────────────────────────── */

/**
 * Строит разбор по снимку КП. `prev` — снимок предыдущего раунда: без него
 * бюджет и объём круга честно читаются «нет данных» вместо выдуманных чисел.
 * `thresholds` — текущие пороги тендера: они каскадируют в сводку и метки
 * (изменение порога не обесценивает данные, но меняет разбор).
 *
 * Один вызов — один результат; диалога здесь нет по решению владельца
 * (05 §1). Возвращает null только когда разбирать решительно нечего.
 *
 * НАРУЖУ УХОДЯТ ДВЕ ВЕЩИ: разбор с ПУСТЫМИ слотами модели и заготовка её
 * фраз отдельным объектом. Соединяет их `applyNarration()` — и он же завтра
 * соединит разбор с настоящим ответом, ничего здесь не тронув.
 */
export function buildAnalysis(
  comparison: Comparison,
  prev: Comparison | undefined,
  thresholds: CompareThresholds,
): AnalysisBuild | null {
  const { groups, contractors } = comparison;
  if (!groups.length || !contractors.length) return null;

  const rounds = comparison.rounds ?? [];
  const roundNumber = snapshotRound(comparison);
  const round = rounds.find((r) => r.number === roundNumber);
  const hasPrev = rounds.some((r) => r.number === roundNumber - 1);

  const positions = flatten(groups);
  const facts = analyzeComparison(groups, contractors, thresholds);
  const bids = rankBids(contractors, positions);
  const byId = new Map(contractors.map((c) => [c.id, c]));
  const invitedIds = round?.invited?.length ? round.invited : contractors.map((c) => c.id);
  const submittedNow = (id: string): boolean => {
    const c = byId.get(id);
    return !!c && (c.submittedInRound ?? 1) >= roundNumber;
  };

  const popupNotes: Record<string, string> = {};
  /** Заготовка ответа модели: собирается ПАРАЛЛЕЛЬНО структуре и адресуется
   *  теми же id. Наружу уходит отдельно от результата — см. AnalysisBuild. */
  const draft: AiResponse['insights'] = [];
  /** Позиции, тронутые хоть одним поставщиком за круг — для счётчика
   *  «Позиций изменено» (05 §4.2). Считается по ВСЕМ шагам диффа, а не только
   *  по показанной верхушке. */
  const touchedPositions = new Set<string>();

  /* ── 1. Изменения каждого поставщика между раундами (05 §4.1) ──────────── */

  const supplierItems: AnalysisItem[] = [];

  /** Дифф одного КП с его же прошлым: база — ЕГО цены прошлого круга. */
  const diffOf = (c: Contractor) => {
    const moves: Array<{ p: ComparePosition; delta: number }> = [];
    let appeared = 0;
    let disappeared = 0;
    for (const p of positions) {
      if (p.removed || !c.prevPrices) continue;
      const was = c.prevPrices[p.id];
      const now = c.prices[p.id];
      if (now !== undefined && was !== undefined) {
        if (now !== was) moves.push({ p, delta: (now - was) * p.qty });
      } else if (now !== undefined) {
        moves.push({ p, delta: now * p.qty });
        appeared += 1;
      } else if (was !== undefined) {
        moves.push({ p, delta: -was * p.qty });
        disappeared += 1;
      }
    }
    moves.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return { moves, appeared, disappeared };
  };

  /** Изменение условий КП за круг. Спека требует называть их ДАЖЕ когда цены
   *  стоят на месте: иначе круг читается как «поставщик не менялся», хотя он
   *  переписал аванс (граничный случай 05 §4.1). Без снимка прошлых условий
   *  строки нет вовсе — выдумывать «условия прежние» не по чему. */
  const conditionsMove = (c: Contractor): string | null => {
    if (!c.prevConditions) return null;
    const was = new Set(c.prevConditions);
    const now = new Set(c.conditions ?? []);
    const added = (c.conditions ?? []).filter((x) => !was.has(x));
    const gone = c.prevConditions.filter((x) => !now.has(x));
    if (!added.length && !gone.length) return null;
    return [
      added.length ? `условия КП: ${added.join(', ')}` : '',
      gone.length ? `снял условия: ${gone.join(', ')}` : '',
    ].filter(Boolean).join('; ');
  };

  if (hasPrev) {
    for (const id of invitedIds) {
      const c = byId.get(id);
      if (!c) continue;
      const inRound = c.submittedInRound ?? 1;

      /* «Ещё не подал» — пункт существует, модель молчит (05 §4.1). */
      if (!submittedNow(id)) {
        supplierItems.push({
          id: `sc:${c.id}`, section: 'supplier_changes',
          title: `${c.name} — ещё не подал КП раунда ${roundNumber}`,
          note: '', mute: true,
          refs: [cref(c)],
          evidence: [{ contractorId: c.id, metric: 'last_submitted_round', value: inRound }],
        });
        continue;
      }

      /* Базы сравнения нет: так и сказано, а не «не менялся». */
      if (inRound !== roundNumber || !c.prevPrices) {
        supplierItems.push({
          id: `sc:${c.id}`, section: 'supplier_changes',
          title: `${c.name} — в прошлом раунде не участвовал`,
          details: ['Сравнивать не с чем: его предложение разбирается только в базовом разделе.'],
          note: '', mute: true,
          refs: [cref(c)], evidence: [],
        });
        continue;
      }

      const { moves, appeared, disappeared } = diffOf(c);
      for (const m of moves) touchedPositions.add(m.p.id);
      const totalNew = sumOf(c, positions);
      const totalOld = positions.reduce(
        (acc, p) => acc + (p.removed ? 0 : (c.prevPrices![p.id] ?? 0)) * p.qty, 0,
      );
      const deltaTotal = totalNew - totalOld;

      const cond = conditionsMove(c);

      /* Ничего не изменил — так и сказано, список пуст (05 §4.1). Если при
         этом переписаны условия, заголовок говорит именно о них: нулевая
         дельта итога иначе выдаёт себя за «поставщик молчал». */
      if (!moves.length) {
        supplierItems.push({
          id: `sc:${c.id}`, section: 'supplier_changes',
          title: cond
            ? `${c.name} — цены прежние, изменились условия КП (${money(totalNew)})`
            : `${c.name} — предложение не изменилось (${money(totalNew)})`,
          details: cond ? [cond] : undefined,
          note: '',
          refs: [cref(c)],
          evidence: [{ contractorId: c.id, metric: 'total', value: totalNew }],
        });
        draft.push({
          id: `sc:${c.id}`,
          reason: cond
            ? 'Цена та же, но условия сделки изменились.'
            : 'Пересматривать его предложение в этом круге нечем.',
          next_action: cond ? 'Пересчитать эффект условий до сравнения итогов.' : undefined,
        });
        continue;
      }

      const pct = totalOld ? (deltaTotal / totalOld) * 100 : 0;
      const top = moves.slice(0, 3);
      const rest = moves.length - top.length;

      const details: string[] = top.map((m) => `${m.p.title} ${fmtDelta(m.delta)}`);
      if (rest > 0) details.push(`и ещё ${rest} ${plural(rest, 'позиция', 'позиции', 'позиций')}`);
      if (appeared > 0) details.push(`закрыл пробелов: ${appeared}`);
      if (disappeared > 0) details.push(`снял позиций: ${disappeared}`);
      if (cond) details.push(cond);

      /* Заготовка слота модели: одна фраза о направлении шага. */
      const note = deltaTotal > 0 && appeared > 0
        ? 'Рост дал состав, а не цены: закрыл прежние пробелы.'
        : deltaTotal > 0
          ? 'Поднял цены после прошлого круга — спросить, что изменилось.'
          : 'Уступил по большинству позиций — торгуйтесь от новой цифры.';
      draft.push({ id: `sc:${c.id}`, reason: note });

      supplierItems.push({
        id: `sc:${c.id}`, section: 'supplier_changes',
        title: `${c.name} — ${deltaTotal < 0 ? 'дешевле' : 'дороже'} на ${money(Math.abs(deltaTotal))}`
          + ` (${signed(pct)} %)`,
        details,
        note: '',
        refs: [cref(c), ...top.map((m) => wref(m.p))],
        evidence: [
          { contractorId: c.id, metric: 'total', value: totalNew },
          { contractorId: c.id, metric: 'round_delta_total', value: deltaTotal },
          ...top.map((m) => ({
            positionId: m.p.id, contractorId: c.id, metric: 'round_delta', value: m.delta,
          })),
        ],
        transition: top.length
          ? { preset: 'overview', requiredMetrics: ['price'], focus: { positionId: top[0].p.id, contractorId: c.id } }
          : undefined,
      });
      if (top[0]) {
        popupNotes[`${c.id}:${top[0].p.id}`] = 'Самый крупный шаг этого поставщика за круг.';
      }
    }
  }

  /* ── 2. Общая картина между раундами (05 §4.2): фиксированный набор ────── */

  const grandTotal = (snapshot: Comparison): number =>
    snapshot.contractors.reduce((acc, c) => acc + sumOf(c, flatten(snapshot.groups)), 0);

  let summarySection: AnalysisSection | undefined;
  if (hasPrev) {
    const totalCur = grandTotal(comparison);
    /* База бюджета: переподавшие считаются по СВОИМ прошлым ценам, молчавшие
       — по текущим (их прошлое КП и есть текущее). */
    const totalPrev = invitedIds.reduce((acc, id) => {
      const c = byId.get(id);
      if (!c) return acc;
      const base = c.prevPrices ?? c.prices;
      return acc + positions.reduce(
        (sum, p) => sum + (p.removed ? 0 : (base[p.id] ?? 0)) * p.qty, 0,
      );
    }, 0);
    const dBudget = totalCur - totalPrev;
    const pctBudget = totalPrev ? (dBudget / totalPrev) * 100 : 0;

    /* «Подали» и «переподали» — РАЗНЫЕ числа (05 §4.2), и до этой правки они
       считались одним: подали — у кого КП этого круга есть вообще, переподали
       — у кого оно НЕ первое, то есть с базой в прошлом раунде. Совпадают они
       только когда новичков в круге нет. */
    const submittedCount = invitedIds.filter(submittedNow).length;
    const resubmitted = invitedIds
      .filter((id) => submittedNow(id) && !!byId.get(id)?.prevPrices).length;
    const changedCount = touchedPositions.size;

    /* Объём работ — только из реального прошлого снимка: выдумывать дельту
       объёмов без данных нельзя (граничный случай 05 §4.2). */
    let volumeValue: string | null = null;
    if (prev) {
      const prevQty = new Map(flatten(prev.groups).map((p) => [p.id, p.qty]));
      const moved = positions.filter((p) => {
        const q = prevQty.get(p.id);
        return q !== undefined && q !== p.qty;
      });
      volumeValue = moved.length ? `${moved.length} поз. изменили объём` : 'не изменился';
    }

    const curLeader = bids[0];
    const prevLeaderId = prev
      ? rankBids(prev.contractors, flatten(prev.groups))[0]?.contractor.id
      : invitedIds
        .map((id) => ({ id, t: positions.reduce((s, p) => {
          const c = byId.get(id)!;
          const base = c.prevPrices ?? c.prices;
          return s + (p.removed ? 0 : (base[p.id] ?? 0)) * p.qty;
        }, 0) }))
        .sort((a, b) => a.t - b.t)[0]?.id;
    const leaderChanged = !!prevLeaderId && prevLeaderId !== curLeader?.contractor.id;

    const meta: NonNullable<AnalysisSection['meta']> = [
      { label: 'Бюджет раунда', value: `${money(totalPrev)} → ${money(totalCur)}` },
      {
        label: 'Изменение',
        value: dBudget === 0 ? 'без изменений'
          : `${fmtDelta(dBudget)} (${signedPct(pctBudget)})`,
      },
      { label: 'Объём работ', value: volumeValue ?? 'нет данных' },
      { label: 'Подали', value: `${submittedCount} из ${invitedIds.length}` },
      { label: 'Переподали', value: String(resubmitted) },
      { label: 'Позиций изменено', value: String(changedCount) },
      {
        label: 'Лидер',
        value: leaderChanged
          ? `был ${who(contractors, String(prevLeaderId))}, стал ${curLeader?.contractor.name ?? '—'}`
          : `${curLeader?.contractor.name ?? '—'} удержал место`,
      },
    ];

    /* Заготовка слота модели: одна-две фразы о том, чем закончился круг. */
    const notes: string[] = [];
    if (leaderChanged) notes.push('Круг сменил лидера.');
    if (submittedCount < invitedIds.length) {
      notes.push('Подали не все — итог может сдвинуться.');
    }
    if (!notes.length) notes.push('Круг прошёл без сюрпризов.');
    draft.push({ id: 'round_summary', reason: notes.join(' ') });

    summarySection = {
      id: 'round_summary',
      title: 'Общая картина раунда',
      meta,
      items: [],
    };
  }

  /* ── 3. Базовый разбор (05 §4.3) ────────────────────────────────────────── */

  const comparable = bids.length >= 2;

  /* Характер поля считается РАЗ и читается дважды: пунктом «Картины» и
     вердиктом брифа — два вида одного числа спорить не имеют права. */
  const totalsSpreadPct = comparable
    ? (bids[bids.length - 1].sum - bids[0].sum) / (bids[0].sum || 1) * 100
    : null;
  const denseField = totalsSpreadPct !== null && totalsSpreadPct < thresholds.spreadNoticeable;

  /* Картина по тендеру: лидер, выбивающийся, характер поля. */
  const overview: AnalysisItem[] = [];
  if (comparable) {
    const leader = bids[0];
    const gap = bids[1].sum - leader.sum;
    overview.push({
      id: 'to:leader', section: 'base_review', subsection: 'tender_overview',
      title: `${leader.contractor.name} — ${money(leader.sum)}, дешевле остальных`,
      details: [`Отрыв от второго места — ${money(gap)}.`],
      note: '',
      refs: [cref(leader.contractor)],
      evidence: [
        { contractorId: leader.contractor.id, metric: 'total', value: leader.sum },
        { contractorId: leader.contractor.id, metric: 'rank', value: 1 },
      ],
      transition: { preset: 'overview', requiredMetrics: ['price'], focus: { contractorId: leader.contractor.id } },
    });
    draft.push({
      id: 'to:leader',
      reason: 'Реальная конкуренция идёт только за первое место.',
      next_action: 'О цене разговаривать с лидером.',
    });

    const totalsMedian = bids.map((b) => b.sum);
    const mid = medianOf(totalsMedian);
    if (mid !== null) {
      /* Выбивающийся ищется среди ОСТАЛЬНЫХ: лидер уже назван первым пунктом,
         и второй раз тем же именем секция не говорит ничего нового. */
      const deviated = bids.slice(1)
        .map((b) => ({ bid: b, dev: deviationPct(b.sum, mid) }))
        .sort((a, b) => Math.abs(b.dev) - Math.abs(a.dev))[0];
      overview.push({
        id: 'to:outlier', section: 'base_review', subsection: 'tender_overview',
        title: `${deviated.bid.contractor.name} — ${signedPct(deviated.dev)} к середине поля`,
        details: [`Итог ${money(deviated.bid.sum)} при середине поля ${money(mid)}.`],
        note: '',
        refs: [cref(deviated.bid.contractor)],
        evidence: [{
          contractorId: deviated.bid.contractor.id,
          metric: 'deviation_from_median_percent', value: deviated.dev,
        }],
        transition: { preset: 'overview', requiredMetrics: ['deviation'], focus: { contractorId: deviated.bid.contractor.id } },
      });
      draft.push({
        id: 'to:outlier',
        reason: 'Итог выбивается из поля.',
        next_action: 'Сверить состав КП до сравнения.',
      });
    }

    const spreadTotals = totalsSpreadPct!;
    overview.push({
      id: 'to:field', section: 'base_review', subsection: 'tender_overview',
      title: `Поле ${denseField ? 'плотное' : 'раздёрнуто'}: итоги расходятся на ${Math.round(spreadTotals)} %`,
      note: '',
      refs: [],
      evidence: [{ metric: 'totals_spread_percent', value: spreadTotals }],
    });
    draft.push({
      id: 'to:field',
      reason: denseField
        ? 'Итоги близко — двигают цену детали состава и условия, а не разница уровней.'
        : 'КП расходятся сильнее, чем позиции внутри.',
      next_action: denseField ? undefined : 'Итоги сравнивать осторожно.',
    });
  }

  /* Держатель максимального заявленного запаса строки — один на строку.
     Читается точками торгов и брифом (находка «экономия»). */
  const potentialHolder = (row: RowFacts): Contractor | undefined => {
    let holder: Contractor | undefined;
    let bestPot = 0;
    for (const c of contractors) {
      const pot = cellMark(c, row.position.id).potential ?? 0;
      if (pot > bestPot) { bestPot = pot; holder = c; }
    }
    return holder;
  };

  /* Точки торгов: пары работа × подрядчик по абсолютному отыгрышу (05 §4.3.2). */
  const tradeRows = facts.rows
    /* Строка с ЕДИНСТВЕННЫМ предложением в точки торгов не идёт: отыгрывать
       нечего, сравнивать не с чем (05 §4.3.2). Заявленный запас у неё быть
       может — и без этого условия она бы прошла. */
    .filter((r) => r.maxPot >= POTENTIAL_MIN && r.bids.length >= 2)
    .sort((a, b) => b.maxPot - a.maxPot)
    .slice(0, ANALYSIS_LIMITS.points);

  const points: AnalysisItem[] = comparable ? tradeRows.map((row) => {
    const holder = potentialHolder(row);
    const share = facts.sumWeight ? Math.round((row.weight / facts.sumWeight) * 100) : 0;
    const spreadPart = row.spread !== null
      ? `, предложения расходятся на ${Math.round(row.spread)} %`
      : '';
    draft.push({
      id: `np:${row.position.id}`,
      reason: holder ? `Запас заявлен у ${holder.name}.` : undefined,
      next_action: 'Спросить снижения до лучшей цены строки.',
      caveat: 'Запас — ориентир, а не обещанная скидка.',
    });
    if (holder) {
      /* Пометка в ячейке — СЕРВЕРНЫЙ факт, а не фраза модели: попап открывают
         в таблице, вне разбора, и там нечем показать, что текст чужой. */
      popupNotes[`${holder.id}:${row.position.id}`] =
        `Точка торгов: заявленный запас ${money(row.maxPot)} по строке.`;
    }
    return {
      id: `np:${row.position.id}`, section: 'base_review', subsection: 'negotiation_points' as const,
      title: `${row.position.title} — ${share} % сметы, запас ${money(row.maxPot)}${spreadPart}`,
      /* Особые условия названы В ПУНКТЕ (05 §4.3.2): позиция с авансом
         попадает в торги наравне с прочими, но торгуются по ней иначе. */
      details: holder?.conditions?.length
        ? [`Условия КП ${holder.name}: ${holder.conditions.join(', ')}.`]
        : undefined,
      note: '',
      refs: [wref(row.position), ...(holder ? [cref(holder)] : [])],
      evidence: [
        { positionId: row.position.id, metric: 'max_potential', value: row.maxPot },
        { positionId: row.position.id, metric: 'weight_percent', value: share },
        ...(row.spread !== null
          ? [{ positionId: row.position.id, metric: 'spread_percent', value: row.spread }]
          : []),
      ],
      transition: {
        preset: 'bidding' as PresetId, requiredMetrics: ['potential'],
        focus: { positionId: row.position.id, contractorId: holder?.id },
      },
    };
  }) : [];

  /* Аномалии: сначала пары с особыми условиями — они опаснее для поспешного
     вывода (05 §4.3.3); дальше — по величине отклонения. Флаг ячейки
     ОБЪЕДИНЁННЫЙ (вердикт данных или формула k), причина берётся из данных:
     у пары, найденной только формулой, слота причины нет — модель говорит
     стандартной фразой «запросить обоснование». */
  const anomalyPairs: Array<{ row: RowFacts; c: Contractor; reason: string; dev: number }> = [];
  for (const row of facts.rows) {
    if (row.position.removed || !row.anomaly || row.median === null) continue;
    for (const c of contractors) {
      const bid = row.bids.find((b) => b.contractorId === c.id);
      if (!bid?.anomaly) continue;
      const price = c.prices[row.position.id];
      if (price === undefined) continue;
      anomalyPairs.push({
        row, c, reason: cellMark(c, row.position.id).anomaly ?? '', dev: deviationPct(price, row.median),
      });
    }
  }
  anomalyPairs.sort((a, b) => (
    Number(!a.c.conditions?.length) - Number(!b.c.conditions?.length)
    || Math.abs(b.dev) - Math.abs(a.dev)
  ));

  /* СЛАБАЯ СТАТИСТИКА. Спека расходится сама с собой: §4.3.3 зовёт слабым
     полем «двоих-троих», а таблица граничных случаев §4 — только двоих
     («три и больше КП — штатный режим»). Взят порог таблицы: он перечислен
     по случаям, а не сказан вскользь, и совпадает с причиной, по которой
     системный k = 3 (см. SYSTEM_THRESHOLDS) — на трёх участниках формула
     уже не вырождается. */
  const lowConfidence = bids.length < 3;

  const anomalyItems: AnalysisItem[] = comparable
    ? anomalyPairs.slice(0, ANALYSIS_LIMITS.anomalies).map(({ row, c, dev }) => ({
      id: `an:${row.position.id}:${c.id}`,
      section: 'base_review' as const, subsection: 'anomalies' as const,
      title: `${row.position.title} · ${c.name} — ${signedPct(dev)} к середине поля`,
      details: [
        `Цена ${money(c.prices[row.position.id]!)}, середина поля ${money(row.median!)}.`,
        /* Условия — СЕРВЕРНЫЙ факт и стоят РАНЬШЕ слова «аномалия»: они могут
           всё объяснять (05 §4.3.3), а факт не должен зависеть от того,
           ответила модель или нет. */
        ...(c.conditions?.length ? [`В КП заявлено: ${c.conditions.join(', ')}.`] : []),
        ...(lowConfidence ? [`Мало данных для уверенности: сопоставимых КП — ${bids.length}.`] : []),
      ],
      note: '',
      refs: [wref(row.position), cref(c)],
      evidence: [
        { positionId: row.position.id, contractorId: c.id, metric: 'price', value: c.prices[row.position.id]! },
        { positionId: row.position.id, contractorId: c.id, metric: 'median', value: row.median! },
        { positionId: row.position.id, contractorId: c.id, metric: 'deviation_from_median_percent', value: dev },
      ],
      transition: {
        preset: 'anomalies' as PresetId, requiredMetrics: ['price', 'deviation'],
        focus: { positionId: row.position.id, contractorId: c.id },
      },
    }))
    : [];
  for (const { row, c } of anomalyPairs.slice(0, ANALYSIS_LIMITS.anomalies)) {
    draft.push({
      id: `an:${row.position.id}:${c.id}`,
      /* Слабое поле — модель НЕ утверждает выброс (05 §4.3.3). */
      reason: c.conditions?.length
        ? 'Отклонение может объясняться заявленными условиями.'
        : lowConfidence
          ? 'Цена выделяется, но поле слишком узкое для уверенного вывода.'
          : 'Цена резко выбивается из поля.',
      next_action: c.conditions?.length
        ? 'Проверить состав работ до выводов.'
        : 'Запросить обоснование до выводов.',
    });
  }
  const anomalyTail = anomalyPairs.length - anomalyItems.length;
  if (anomalyTail > 0) {
    anomalyItems.push({
      id: 'an:tail', section: 'base_review', subsection: 'anomalies',
      title: `и ещё ${anomalyTail} ${plural(anomalyTail, 'аномалия', 'аномалии', 'аномалий')}`,
      details: ['Показаны самые сильные отклонения; остальные — в таблице с фильтром «Аномалии».'],
      note: '', mute: true,
      refs: [], evidence: [],
    });
  }

  /* Полнота и сопоставимость: перечень фактов без лимита, модель не участвует
     (05 §4.3.4) — здесь она дороже всего ошибается.
     СЧИТАЕТСЯ ВСЕГДА, а не только при сопоставимом поле. С единственным КП
     остальные подсекции пусты и скрываются, и полнота — ЕДИНСТВЕННОЕ, что
     показывает разбор (граничный случай 05 §4). Под `comparable` она давала
     ровно обратное: «все КП сопоставимы, пропусков нет» там, где сравнивать
     не с чем вовсе. */
  const completeness: AnalysisItem[] = [];
  /* Σ незакрытых позиций по всем КП — читается брифом (находка «риск»). */
  let holesTotal = 0;
  {
    for (const id of invitedIds) {
      if (!byId.has(id)) continue;
      if (!submittedNow(id)) {
        completeness.push({
          id: `cp:not-submitted:${id}`, section: 'base_review', subsection: 'completeness',
          title: `${who(contractors, id)} — ещё не подавал КП этого раунда`,
          note: '', mute: true,
          refs: [cref(byId.get(id)!)], evidence: [],
        });
      }
    }
    for (const c of contractors) {
      const holes = facts.rows.filter((r) =>
        !r.position.removed
        && c.prices[r.position.id] === undefined
        && cellMark(c, r.position.id).declined !== true);
      if (!holes.length) continue;
      holesTotal += holes.length;
      const names = holes.slice(0, 3).map((r) => r.position.title);
      const rest = holes.length - names.length;
      completeness.push({
        id: `cp:gaps:${c.id}`, section: 'base_review', subsection: 'completeness',
        title: `${c.name} — не закрыто позиций: ${holes.length}`,
        details: [
          ...names,
          ...(rest > 0 ? [`и ещё ${rest} ${plural(rest, 'позиция', 'позиции', 'позиций')}`] : []),
        ],
        note: '', mute: true,
        refs: [cref(c)],
        evidence: [{ contractorId: c.id, metric: 'missing_positions', value: holes.length }],
      });
    }
    for (const row of facts.rows) {
      for (const c of contractors) {
        const mark = cellMark(c, row.position.id);
        if (mark.declined) {
          completeness.push({
            id: `cp:declined:${row.position.id}:${c.id}`,
            section: 'base_review', subsection: 'completeness',
            title: `${c.name} — отказ от позиции «${row.position.title}»`,
            note: '', mute: true, refs: [wref(row.position), cref(c)], evidence: [],
          });
        } else if (c.prices[row.position.id] === 0) {
          completeness.push({
            id: `cp:zero:${row.position.id}:${c.id}`,
            section: 'base_review', subsection: 'completeness',
            title: `${c.name} — ноль по позиции «${row.position.title}»`,
            details: ['Нулевая цена требует проверки до сравнения итогов.'],
            note: '', mute: true, refs: [wref(row.position), cref(c)], evidence: [],
          });
        }
      }
    }
  }
  if (!completeness.length) {
    completeness.push({
      id: 'cp:clean', section: 'base_review', subsection: 'completeness',
      title: 'Все КП сопоставимы, пропусков нет.',
      note: '', mute: true, refs: [], evidence: [],
    });
  }

  /* Медиана списка — та же формула, что у строк: medianOf из comparison. */

  const sections: AnalysisSection[] = [];
  if (hasPrev && supplierItems.length) {
    sections.push({ id: 'supplier_changes', title: 'Изменения поставщиков', items: supplierItems });
  }
  if (summarySection) sections.push(summarySection);
  /* Пустая подсекция СКРЫВАЕТСЯ, «Полнота и сопоставимость» — всегда
     (05 §4.3). Пустой аккордеон читается как «данные не пришли», хотя
     сравнивать просто не с чем. */
  const baseSubsections = [
    { id: 'tender_overview' as const, title: 'Картина по тендеру', items: overview },
    { id: 'negotiation_points' as const, title: 'Точки торгов', items: points },
    { id: 'anomalies' as const, title: 'Аномалии и риски', items: anomalyItems },
    { id: 'completeness' as const, title: 'Полнота и сопоставимость', items: completeness },
  ].filter((sub) => sub.items.length > 0 || sub.id === 'completeness');
  sections.push({ id: 'base_review', title: 'Базовый разбор', subsections: baseSubsections });

  /* ── 4. Бриф «сначала вывод» (решение владельца 23.08.2026) ───────────────
     Порядок находок фиксированный и по значимости: вывод → экономия →
     аномалия → риск. Каждый пункт несёт переход той же природы, что у
     пунктов секций: клик ведёт к сущности в таблице. Аномалии читаются
     только у сопоставимого поля — тот же гейт, что прячет подсекцию:
     при одном КП отклонение от единственной цены не имеет смысла. */
  /* Молчуны считаются только среди ПРИСУТСТВУЮЩИХ в данных КП — тот же
     гейт, что у полноты: срез без чужих подрядчиков не должен рассказывать
     про тех, кого в нём нет. */
  const invitedPresent = invitedIds.filter((id) => byId.has(id));
  const notSubmittedCount = invitedPresent.filter((id) => !submittedNow(id)).length;
  const potTotal = tradeRows.reduce((acc, r) => acc + r.maxPot, 0);
  const leader = bids[0];
  const briefAnomalies = comparable ? anomalyPairs : [];

  const findings: AnalysisBrief['findings'] = [];
  if (comparable && leader && bids[1]) {
    findings.push({
      kind: 'key',
      title: `${leader.contractor.name} — ${money(leader.sum)}, отрыв от второго места ${money(bids[1].sum - leader.sum)}`,
      ref: cref(leader.contractor),
      transition: { preset: 'overview', requiredMetrics: ['price'], focus: { contractorId: leader.contractor.id } },
    });
  }
  if (tradeRows[0]) {
    const row = tradeRows[0];
    findings.push({
      kind: 'saving',
      title: `Точка торгов: «${row.position.title}», запас ${money(row.maxPot)} (${potentialHolder(row)?.name ?? 'запас не привязан к КП'})`,
      ref: wref(row.position),
      transition: {
        preset: 'bidding', requiredMetrics: ['potential'],
        focus: { positionId: row.position.id, contractorId: potentialHolder(row)?.id },
      },
    });
  }
  if (briefAnomalies[0]) {
    const { row, c, dev } = briefAnomalies[0];
    findings.push({
      kind: 'anomaly',
      title: `Аномалия: «${row.position.title}» · ${c.name} — ${signedPct(dev)} к середине поля`,
      transition: {
        preset: 'anomalies', requiredMetrics: ['price', 'deviation'],
        focus: { positionId: row.position.id, contractorId: c.id },
      },
    });
  }
  if (notSubmittedCount > 0) {
    findings.push({
      kind: 'risk',
      title: `Подали не все: ${invitedPresent.length - notSubmittedCount} из ${invitedPresent.length} — итог может сместиться`,
    });
  } else if (holesTotal > 0) {
    findings.push({
      kind: 'risk',
      title: `Пробелы данных: ${holesTotal} ${plural(holesTotal, 'позиция', 'позиции', 'позиций')} не закрыты в поданных КП`,
    });
  }

  const verdict = comparable && leader
    ? [
      `Лидер — ${leader.contractor.name}: ${money(leader.sum)}.`,
      totalsSpreadPct !== null
        ? (denseField ? 'Поле плотное.' : `Итоги расходятся на ${Math.round(totalsSpreadPct)} %.`)
        : '',
      ...(briefAnomalies.length
        ? [`До выбора проверить ${briefAnomalies.length} ${plural(briefAnomalies.length, 'аномалию', 'аномалии', 'аномалий')}.`]
        : []),
    ].filter(Boolean).join(' ')
    : 'Сопоставимое поле ещё не собралось — сравнивать пока не с чем.';

  const why = briefAnomalies.length
    ? 'Аномальные цены искажают ранжир: корректное сравнение возможно только после запроса обоснований.'
    : potTotal > 0 && leader
      ? `Заявленный запас покрывает до ${Math.min(100, Math.round((potTotal / leader.sum) * 100))} % лучшей цены — итог раунда ещё движим торгом.`
      : denseField
        ? 'Отрыв невелик: решают состав КП и условия, а не уровень цен.'
        : 'Поле раздёрнуто — сравнивайте итоги осторожно.';

  const recommendation: AnalysisBrief['recommendation'] =
    tradeRows[0] && comparable
      ? {
        text: `Начать торг со строки «${tradeRows[0].position.title}»: заявленный запас ${money(tradeRows[0].maxPot)}.`,
        transition: {
          preset: 'bidding', requiredMetrics: ['potential'],
          focus: { positionId: tradeRows[0].position.id, contractorId: potentialHolder(tradeRows[0])?.id },
        },
      }
      : briefAnomalies.length
        ? {
          text: 'Запросить обоснования по аномальным ценам до сравнения итогов.',
          transition: { preset: 'anomalies', requiredMetrics: ['price', 'deviation'] },
        }
        : comparable && leader
          ? {
            text: 'Сверить состав лучшего КП со сметой и фиксировать условия сделки.',
            transition: { preset: 'overview', requiredMetrics: ['price'], focus: { contractorId: leader.contractor.id } },
          }
          : { text: 'Дождаться остальных КП: сравнение преждевременно.' };

  const brief: AnalysisBrief = {
    verdict,
    findings: findings.slice(0, ANALYSIS_LIMITS.findings),
    why,
    recommendation,
  };

  /* Сводка ≤ 3 пунктов, каждый — якорь к секции (05 §3). */
  const summary: AnalysisResult['summary'] = [];
  if (bids.length) {
    summary.push({
      text: `Лидер — ${bids[0].contractor.name}: ${money(bids[0].sum)}`,
      section: 'base_review', subsection: 'tender_overview',
    });
  }
  if (points.length) {
    summary.push({
      text: `Точки торгов: ${money(potTotal)} в ${tradeRows.length} ${plural(tradeRows.length, 'позиции', 'позициях', 'позициях')}`,
      section: 'base_review', subsection: 'negotiation_points',
    });
  }
  if (summarySection?.meta) {
    const change = summarySection.meta.find((m) => m.label === 'Изменение')!;
    summary.push({
      text: `Раунд ${roundNumber}: бюджет ${change.value.toLowerCase()}`,
      section: 'round_summary',
    });
  } else if (anomalyPairs.length > 0) {
    summary.push({
      text: `Аномалии: ${anomalyPairs.length} ${plural(anomalyPairs.length, 'пара', 'пары', 'пар')} — проверить до выбора`,
      section: 'base_review', subsection: 'anomalies',
    });
  }

  return {
    result: {
      roundNumber,
      createdAt: Date.now(),
      summary: summary.slice(0, ANALYSIS_LIMITS.summary),
      brief,
      sections,
      popupNotes,
    },
    draft: { insights: draft },
  };
}
