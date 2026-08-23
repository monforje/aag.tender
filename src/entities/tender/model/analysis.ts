/** Разбор тендера — серверная половина ИИ-анализа (06-ai-contract.md §5.1).
 *
 *  РАЗДЕЛЕНИЕ ОТВЕТСТВЕННОСТИ — СМЫСЛ ЭТОГО ФАЙЛА (05 §4.3): отбор, порядок и
 *  ВСЕ числа делает код; формулировка модели занимает отдельный слот `note`
 *  («почему важно / что делать») и сегодня заполнена заготовками. Завтра слот
 *  подставит ответ модели — структура, лимиты и числа не изменятся ни на
 *  символ. Числовой факт в тексте допустим, только если тот же показатель
 *  лежит в `evidence[]` вывода.
 *
 *  Порядок секций фиксированный (05 §4): изменения поставщиков → общая картина
 *  раунда → базовый разбор. Первые две появляются ТОЛЬКО с предыдущим раундом;
 *  их отсутствие в первом круге — норма, а не пустая секция. Лимиты: картина
 *  по тендеру ≤ 3, точки торгов ≤ 7, аномалии ≤ 5 (+ хвост «и ещё N»),
 *  полнота — без лимита и всегда. У «ещё не подал» модель молчит (05 §4.1),
 *  в полноте модели нет вовсе (§4.3.4) — там note пустая строка.
 *
 *  Отклонения считаются ОТ МЕДИАНЫ строки/поля (эталонной цены в контракте
 *  нет), поэтому все тексты говорят «дороже, чем у большинства», никогда —
 *  «отклонение от эталона» (О3 в AI-ANALYSIS.md). */

import { plural } from '@/shared/lib/plural';
import {
  analyzeComparison, cellMark, decimal, deviationPct, flatten,
  medianOf, money, POTENTIAL_MIN, rankBids, snapshotRound, sumOf,
  type ComparePosition, type CompareThresholds, type Comparison, type Contractor,
  type PresetId, type RowFacts, type TransitionMetricId,
} from './comparison';

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
  /** Слот модели: одна фраза «почему важно / что делать». '' — модели здесь
   *  нет места (ещё не подал, полнота). */
  note: string;
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

export interface AnalysisResult {
  roundNumber: number;
  createdAt: number;
  /** ≤ 3 пунктов, каждый — якорь к секции (05 §3). */
  summary: Array<{ text: string; section: AnalysisSectionId; subsection?: AnalysisSubsectionId }>;
  sections: AnalysisSection[];
  /** Комментарии разбора к ячейкам таблицы: ключ `${contractorId}:${positionId}`.
   *  До запуска разбора карта пуста — попапы показывают одни числа (Р4). */
  popupNotes: Record<string, string>;
}

/** Лимиты выводов — константой, чтобы check-скрипт сверял структуру против
 *  того же числа, что режет списки. */
export const ANALYSIS_LIMITS = { summary: 3, overview: 3, points: 7, anomalies: 5 } as const;

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
 */
export function buildAnalysis(
  comparison: Comparison,
  prev: Comparison | undefined,
  thresholds: CompareThresholds,
): AnalysisResult | null {
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
          note: '',
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
          note: '',
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

      /* Ничего не изменил — так и сказано, список пуст (05 §4.1). */
      if (!moves.length) {
        supplierItems.push({
          id: `sc:${c.id}`, section: 'supplier_changes',
          title: `${c.name} — предложение не изменилось (${money(totalNew)})`,
          note: 'Пересматривать его предложение в этом круге нечем.',
          refs: [cref(c)],
          evidence: [{ contractorId: c.id, metric: 'total', value: totalNew }],
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

      /* Слот модели: одна фраза о направлении шага. */
      const note = deltaTotal > 0 && appeared > 0
        ? 'Рост дал состав, а не цены: закрыл прежние пробелы.'
        : deltaTotal > 0
          ? 'Поднял цены после прошлого круга — спросить, что изменилось.'
          : 'Уступил по большинству позиций — торгуйтесь от новой цифры.';

      supplierItems.push({
        id: `sc:${c.id}`, section: 'supplier_changes',
        title: `${c.name} — ${deltaTotal < 0 ? 'дешевле' : 'дороже'} на ${money(Math.abs(deltaTotal))}`
          + ` (${signed(pct)} %)`,
        details,
        note,
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

    const resubmitted = invitedIds.filter(submittedNow).length;
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
      { label: 'Подали', value: `${resubmitted} из ${invitedIds.length}` },
      { label: 'Переподали', value: String(resubmitted) },
      { label: 'Позиций изменено', value: String(changedCount) },
      {
        label: 'Лидер',
        value: leaderChanged
          ? `был ${who(contractors, String(prevLeaderId))}, стал ${curLeader?.contractor.name ?? '—'}`
          : `${curLeader?.contractor.name ?? '—'} удержал место`,
      },
    ];

    /* Слот модели: одна-две фразы о том, чем закончился круг (05 §4.2). */
    const notes: string[] = [];
    if (leaderChanged) notes.push('Круг сменил лидера.');
    if (resubmitted < invitedIds.length) {
      notes.push('Подали не все — итог может сдвинуться.');
    }
    if (!notes.length) notes.push('Круг прошёл без сюрпризов.');

    summarySection = {
      id: 'round_summary',
      title: 'Общая картина раунда',
      meta,
      note: notes.join(' '),
      items: [],
    };
  }

  /* ── 3. Базовый разбор (05 §4.3) ────────────────────────────────────────── */

  const comparable = bids.length >= 2;

  /* Картина по тендеру: лидер, выбивающийся, характер поля. */
  const overview: AnalysisItem[] = [];
  if (comparable) {
    const leader = bids[0];
    const gap = bids[1].sum - leader.sum;
    overview.push({
      id: 'to:leader', section: 'base_review', subsection: 'tender_overview',
      title: `${leader.contractor.name} — ${money(leader.sum)}, дешевле остальных`,
      details: [`Отрыв от второго места — ${money(gap)}.`],
      note: 'Реальная конкуренция идёт только за первое место — разговаривать о цене стоит с лидером.',
      refs: [cref(leader.contractor)],
      evidence: [
        { contractorId: leader.contractor.id, metric: 'total', value: leader.sum },
        { contractorId: leader.contractor.id, metric: 'rank', value: 1 },
      ],
      transition: { preset: 'overview', requiredMetrics: ['price'], focus: { contractorId: leader.contractor.id } },
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
        note: 'Итог выбивается из поля — сверить состав КП до сравнения.',
        refs: [cref(deviated.bid.contractor)],
        evidence: [{
          contractorId: deviated.bid.contractor.id,
          metric: 'deviation_from_median_percent', value: deviated.dev,
        }],
        transition: { preset: 'overview', requiredMetrics: ['deviation'], focus: { contractorId: deviated.bid.contractor.id } },
      });
    }

    const spreadTotals = (bids[bids.length - 1].sum - bids[0].sum) / (bids[0].sum || 1) * 100;
    const dense = spreadTotals < thresholds.spreadNoticeable;
    overview.push({
      id: 'to:field', section: 'base_review', subsection: 'tender_overview',
      title: `Поле ${dense ? 'плотное' : 'раздёрнуто'}: итоги расходятся на ${Math.round(spreadTotals)} %`,
      note: dense
        ? 'Итоги близко — двигают цену детали состава и условия, а не разница уровней.'
        : 'КП расходятся сильнее, чем позиции внутри, — итоги сравнивать осторожно.',
      refs: [],
      evidence: [{ metric: 'totals_spread_percent', value: spreadTotals }],
    });
  }

  /* Точки торгов: пары работа × подрядчик по абсолютному отыгрышу (05 §4.3.2). */
  const tradeRows = facts.rows
    .filter((r) => r.maxPot >= POTENTIAL_MIN)
    .sort((a, b) => b.maxPot - a.maxPot)
    .slice(0, ANALYSIS_LIMITS.points);

  const points: AnalysisItem[] = comparable ? tradeRows.map((row) => {
    let holder: Contractor | undefined;
    let bestPot = 0;
    for (const c of contractors) {
      const pot = cellMark(c, row.position.id).potential ?? 0;
      if (pot > bestPot) { bestPot = pot; holder = c; }
    }
    const share = facts.sumWeight ? Math.round((row.weight / facts.sumWeight) * 100) : 0;
    const spreadPart = row.spread !== null
      ? `, предложения расходятся на ${Math.round(row.spread)} %`
      : '';
    const note = holder
      ? `Запас заявлен у ${holder.name}: спросить снижения до лучшей цены строки — ориентир, не обещание.`
      : 'Спросить снижения до лучшей цены строки — ориентир, не обещание.';
    return {
      id: `np:${row.position.id}`, section: 'base_review', subsection: 'negotiation_points' as const,
      title: `${row.position.title} — ${share} % сметы, запас ${money(row.maxPot)}${spreadPart}`,
      note,
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
  for (const item of points) {
    const ref = item.refs.find((r) => r.kind === 'contractor');
    const posRef = item.refs.find((r) => r.kind === 'work');
    if (ref && posRef) popupNotes[`${ref.id}:${posRef.id}`] = item.note;
  }

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

  const anomalyItems: AnalysisItem[] = comparable
    ? anomalyPairs.slice(0, ANALYSIS_LIMITS.anomalies).map(({ row, c, dev }) => ({
      id: `an:${row.position.id}:${c.id}`,
      section: 'base_review' as const, subsection: 'anomalies' as const,
      title: `${row.position.title} · ${c.name} — ${signedPct(dev)} к середине поля`,
      details: [`Цена ${money(c.prices[row.position.id]!)}, середина поля ${money(row.median!)}.`],
      /* Условия называются РАНЬШЕ слова «аномалия»: они могут всё объяснять. */
      note: c.conditions?.length
        ? `В КП заявлено: ${c.conditions.join(', ')}. Проверить состав работ до выводов.`
        : 'Цена резко выбивается — запросить обоснование до выводов.',
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
  const anomalyTail = anomalyPairs.length - anomalyItems.length;
  if (anomalyTail > 0) {
    anomalyItems.push({
      id: 'an:tail', section: 'base_review', subsection: 'anomalies',
      title: `и ещё ${anomalyTail} ${plural(anomalyTail, 'аномалия', 'аномалии', 'аномалий')}`,
      details: ['Показаны самые сильные отклонения; остальные — в таблице с фильтром «Аномалии».'],
      note: '',
      refs: [], evidence: [],
    });
  }

  /* Полнота и сопоставимость: перечень фактов без лимита, модель не участвует
     (05 §4.3.4) — здесь она дороже всего ошибается. */
  const completeness: AnalysisItem[] = [];
  if (comparable) {
    for (const id of invitedIds) {
      if (!byId.has(id)) continue;
      if (!submittedNow(id)) {
        completeness.push({
          id: `cp:not-submitted:${id}`, section: 'base_review', subsection: 'completeness',
          title: `${who(contractors, id)} — ещё не подавал КП этого раунда`,
          note: '',
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
      const names = holes.slice(0, 3).map((r) => r.position.title);
      const rest = holes.length - names.length;
      completeness.push({
        id: `cp:gaps:${c.id}`, section: 'base_review', subsection: 'completeness',
        title: `${c.name} — не закрыто позиций: ${holes.length}`,
        details: [
          ...names,
          ...(rest > 0 ? [`и ещё ${rest} ${plural(rest, 'позиция', 'позиции', 'позиций')}`] : []),
        ],
        note: '',
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
            note: '', refs: [wref(row.position), cref(c)], evidence: [],
          });
        } else if (c.prices[row.position.id] === 0) {
          completeness.push({
            id: `cp:zero:${row.position.id}:${c.id}`,
            section: 'base_review', subsection: 'completeness',
            title: `${c.name} — ноль по позиции «${row.position.title}»`,
            details: ['Нулевая цена требует проверки до сравнения итогов.'],
            note: '', refs: [wref(row.position), cref(c)], evidence: [],
          });
        }
      }
    }
  }
  if (!completeness.length) {
    completeness.push({
      id: 'cp:clean', section: 'base_review', subsection: 'completeness',
      title: 'Все КП сопоставимы, пропусков нет.',
      note: '', refs: [], evidence: [],
    });
  }

  /* Медиана списка — та же формула, что у строк: medianOf из comparison. */

  const sections: AnalysisSection[] = [];
  if (hasPrev && supplierItems.length) {
    sections.push({ id: 'supplier_changes', title: 'Изменения поставщиков', items: supplierItems });
  }
  if (summarySection) sections.push(summarySection);
  const baseSubsections = [
    { id: 'tender_overview' as const, title: 'Картина по тендеру', items: overview },
    { id: 'negotiation_points' as const, title: 'Точки торгов', items: points },
    { id: 'anomalies' as const, title: 'Аномалии и риски', items: anomalyItems },
    { id: 'completeness' as const, title: 'Полнота и сопоставимость', items: completeness },
  ];
  sections.push({ id: 'base_review', title: 'Базовый разбор', subsections: baseSubsections });

  /* Сводка ≤ 3 пунктов, каждый — якорь к секции (05 §3). */
  const summary: AnalysisResult['summary'] = [];
  if (bids.length) {
    summary.push({
      text: `Лидер — ${bids[0].contractor.name}: ${money(bids[0].sum)}`,
      section: 'base_review', subsection: 'tender_overview',
    });
  }
  if (points.length) {
    const potTotal = tradeRows.reduce((acc, r) => acc + r.maxPot, 0);
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
    roundNumber,
    createdAt: Date.now(),
    summary: summary.slice(0, ANALYSIS_LIMITS.summary),
    sections,
    popupNotes,
  };
}
