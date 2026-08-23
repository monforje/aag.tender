/** Правила блока «Анализ»: сценарии и карточки, выводимые из тех же чисел,
 *  что живёт в таблице сравнения.
 *
 *  ЗДЕСЬ ТОЛЬКО ВЫВОД — НИ ОДНОЙ ЦИФРЫ-КОНСТАНТЫ. Карточка прототипов была
 *  захардкоженной цитатой; здесь каждое утверждение вычисляется
 *  `analyzeComparison()` из данных, поэтому таблица и анализ спорить друг с
 *  другом не могут в принципе: правка расценки меняет и колонку, и текст
 *  карточки одним движением. Пороги — настройки тендера, передаются явным
 *  аргументом: фильтр, карточка и таблица делят одни значения ([R4]).
 *
 *  Тон карточки отвечает на вопрос «что с этим делать», а не «как новость»:
 *  факт — neutral, торг — warning, риск — danger. Это те же семантические
 *  тона проекта, а не новая палитра «ИИ» — спектральная окраска глифа к
 *  смыслу карточек отношения не имеет. */

import type { Tone } from '@/shared/ui/Badge';
import { plural } from '@/shared/lib/plural';
import {
  analyzeComparison, cellMark, money, POTENTIAL_MIN,
  rankBids, sumOf,
  type CompareThresholds, type Contractor, type PositionGroup, type PresetId, type RowFacts,
} from './comparison';

/** Сценарий — вопрос, на который блок отвечает набором карточек. Два из пяти
 *  заодно переключают пресет таблицы (см. scenarioPreset): анализ синхронизирован
 *  со срезом данных. Связь ОДНОСТОРОННЯЯ: ручное движение пресета сценарий
 *  не трогает — сценарий вопрос, пресет настройка бинокля. */
export type ScenarioId = 'important' | 'bidding' | 'compare' | 'anomalies' | 'selection';

export const SCENARIOS: ReadonlyArray<{ id: ScenarioId; label: string }> = [
  { id: 'important', label: 'Что важно' },
  { id: 'bidding', label: 'Точки торгов' },
  { id: 'compare', label: 'Сравнить подрядчиков' },
  { id: 'anomalies', label: 'Риски и аномалии' },
  { id: 'selection', label: 'Выбранное ★' },
];

/** Сценарий → пресет таблицы. null — сценарий работает поверх любого среза. */
export const scenarioPreset = (id: ScenarioId): PresetId | null =>
  id === 'bidding' ? 'bidding' : id === 'anomalies' ? 'anomalies' : null;

export interface Insight {
  /** Стабильный внутри рендера ключ: сценарий и порядковый номер правила. */
  id: string;
  scenario: ScenarioId;
  /** Тип находки: факт — про данные, торг — про деньги, риск — про дыры. */
  kind: 'fact' | 'trade' | 'risk';
  tone: Tone;
  tagLabel: string;
  title: string;
  text: string;
  /** Позиция сметы для подсветки по клику; у сводных карточек null. */
  rowId: string | null;
}

const KIND_META: Record<Insight['kind'], { tagLabel: string; tone: Tone }> = {
  fact: { tagLabel: 'факт', tone: 'neutral' },
  trade: { tagLabel: 'торг', tone: 'warning' },
  risk: { tagLabel: 'риск', tone: 'danger' },
};

const insight = (
  scenario: ScenarioId, n: number, kind: Insight['kind'],
  title: string, text: string, rowId: string | null = null,
): Insight => ({
  id: `${scenario}:${n}`,
  scenario,
  kind,
  ...KIND_META[kind],
  title,
  text,
  rowId,
});

/** Имя подрядчика по id — для текстов карточек. Незнакомый id даёт сам id:
 *  карточка с «undefined» хуже карточки с голым идентификатором. */
const who = (contractors: Contractor[], id: string): string =>
  contractors.find((c) => c.id === id)?.name ?? id;

/** Все карточки всех сценариев одним проходом. Сценариев пять, позиций в
 *  срезе десятки — считать лениво или мемоизировать тут нечего.
 *  Пороги — текущие настройки тендера: метки разброса и аномалий каскадируют
 *  в карточки так же, как в таблицу. */
export function deriveInsights(
  groups: PositionGroup[],
  contractors: Contractor[],
  starred: string[],
  thresholds: CompareThresholds,
): Insight[] {
  if (!groups.length || !contractors.length) return [];

  const facts = analyzeComparison(groups, contractors, thresholds);
  const bids = rankBids(contractors, facts.rows.map((r) => r.position));
  const out: Insight[] = [];

  /* ── Что важно ──────────────────────────────────────────────────────────── */

  // Вес: где в срезе деньги. Одна строка может двигать итог сильнее остальных
  // десяти, и без этой карточки порог торга ищется вслепую.
  const heavy = [...facts.rows]
    .filter((r) => r.weight > 0)
    .sort((a, b) => b.weight - a.weight);
  if (heavy.length && facts.sumWeight > 0) {
    const top = heavy[0];
    const share = (top.weight / facts.sumWeight) * 100;
    const next = heavy[1] ? ` Рядом — «${heavy[1].position.title}».` : '';
    out.push(insight('important', 0, 'fact',
      `«${top.position.title}» — ${share.toFixed(0)} % среза`,
      `Самая тяжёлая строка сметы: цена здесь двигает итог сильнее остальных.${next} Торги по ней дают максимальный эффект.`,
      top.position.id,
    ));
  }

  // Неполное КП в ранжире: итог такого предложения заведомо занижен — по
  // позициям без расценки ещё предстоит платить кому-то. Карточка называет
  // первое место ранжира, где сравнивать рано, и ведёт к его первой дыре.
  // Знаменатель — ТОЛЬКО живые строки: у снятой позиции расценок не бывает
  // ни у кого, считать её дырой — обвинять всех подряд.
  const live = facts.rows.filter((r) => !r.position.removed);
  const shaky = bids.find((bid) => bid.filled < live.length);
  if (shaky) {
    const holes = live.filter((r) => shaky.contractor.prices[r.position.id] === undefined);
    out.push(insight('important', 1, 'risk',
      `«${holes[0].position.title}» не закрыт у ${who(contractors, shaky.contractor.id)}`,
      `КП заполнено на ${shaky.percent} % — его итог занижен на объём без расценок (${holes.length} ${plural(holes.length, 'позиция', 'позиции', 'позиций')}, включая отказы). Запросить цены до финального выбора.`,
      holes[0].position.id,
    ));
  }

  /* ── Точки торгов ───────────────────────────────────────────────────────── */

  // Заявленный запас торга над порогом: вход в переговоры, отсортированный
  // по деньгам. Потенциал приходит готовым пометкой КП — здесь он ранжируется.
  const tradeRows = facts.rows
    .filter((r) => r.maxPot >= POTENTIAL_MIN)
    .sort((a, b) => b.maxPot - a.maxPot);
  tradeRows.slice(0, 2).forEach((row, i) => {
    const holders = contractors
      .filter((c) => {
        const mark = cellMark(c, row.position.id);
        return typeof mark.potential === 'number' && mark.potential > 0;
      })
      .map((c) => who(contractors, c.id));
    out.push(insight('bidding', i, 'trade',
      `Запас торга ${money(row.maxPot)} — «${row.position.title}»`,
      `Заявлен ${holders.length ? `у ${holders.join(', ')}` : 'в срезе'}. Спросить о снижении до уровня лучшей цены строки.`,
      row.position.id,
    ));
  });

  /* ── Риски и аномалии ───────────────────────────────────────────────────── */

  // Аномальные расценки: каждая — отдельная карточка. Причина приходит из
  // CellMark, когда внешний вердикт есть; у пары, найденной только формулой k,
   // причина не существует — карточка говорит стандартной фразой.
  facts.rows.forEach((row: RowFacts) => {
    if (row.position.removed || !row.anomaly) return;
    contractors.forEach((c) => {
      const bid = row.bids.find((b) => b.contractorId === c.id);
      if (!bid?.anomaly) return;
      const reason = cellMark(c, row.position.id).anomaly;
      out.push(insight('anomalies', out.length, 'risk',
        `Аномалия: «${row.position.title}» у ${who(contractors, c.id)}`,
        reason ?? 'Отклонение выбивается из разброса остальных — запросить обоснование.',
        row.position.id,
      ));
    });
  });

  // Высокий разброс: цены расходятся настолько, что сравнивать итоги можно
  // только сверив состав объёма. Один сводной карточкой, клик ведёт к первой.
  const wide = facts.rows.filter((r) => r.spreadTag === 'high');
  if (wide.length) {
    out.push(insight('anomalies', out.length, 'risk',
      `Высокий разброс: ${wide.length} ${plural(wide.length, 'позиция', 'позиции', 'позиций')}`,
      `Цены расходятся на ${Math.round(Number(wide[0].spread))} % и больше: ${wide.map((r) => `«${r.position.title}»`).join(', ')}. Сверить состав объёма, прежде чем сравнивать итоги.`,
      wide[0].position.id,
    ));
  }

  /* ── Сравнить подрядчиков / Выбранное ★ ─────────────────────────────────── */

  // Разложение разницы пары. Общая для двух сценариев функция: вклад позиции —
  // разница сумм по закрытым ОБЕИМ сторонам расценкам; пробел одной стороны —
  // отдельное предупреждение, а не мнимая экономия нулём.
  const [a, b] = starred
    .map((id) => contractors.find((c) => c.id === id))
    .filter((c): c is Contractor => !!c);
  if (a && b) {
    const sumA = sumOf(a, facts.rows.map((r) => r.position));
    const sumB = sumOf(b, facts.rows.map((r) => r.position));
    const delta = sumB - sumA;
    // delta < 0 — вторая ★ дешевле; иначе первая. Ноль — совпадение итогов,
    // и «кто впереди» тогда не выбирается вовсе.
    const ahead = delta < 0 ? b : a;

    const parts: Array<{ row: RowFacts; delta: number }> = [];
    let holes = 0;
    facts.rows.forEach((row) => {
      const pa = a.prices[row.position.id];
      const pb = b.prices[row.position.id];
      if (pa !== undefined && pb !== undefined) {
        parts.push({ row, delta: (pb - pa) * row.position.qty });
      } else if (!row.position.removed) {
        holes += 1;
      }
    });
    parts.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
    const lead = parts.slice(0, 2)
      .map((p) => `«${p.row.position.title}» (${p.delta < 0 ? '−' : '+'}${money(Math.abs(p.delta))})`)
      .join(' и ');

    const diffText = delta === 0
      ? `Итоги пары совпадают (${money(sumA)})`
      : `${who(contractors, ahead.id)} дешевле на ${money(Math.abs(delta))}`;
    const shared = {
      diff: diffText,
      contrib: lead ? `. Основной вклад — ${lead}` : '',
      holes: holes ? `. Не пересекаются по ${holes} ${plural(holes, 'позиции', 'позициям', 'позициям')}` : '',
    };

    out.push(insight('compare', 0, 'fact',
      `${a.name} против ${b.name}: ${delta < 0 ? '−' : '+'}${money(Math.abs(delta))}`,
      `${shared.diff}${shared.contrib}${shared.holes}.`,
      parts[0]?.row.position.id ?? null,
    ));

    const rankOf = (id: string) => bids.find((bid) => bid.contractor.id === id)?.rank ?? '—';
    const tail = `${shared.contrib}${shared.holes}`;
    out.push(insight('selection', 0, 'fact',
      `Пара ★: ${a.name} + ${b.name}`,
      `${rankOf(a.id)}-е и ${rankOf(b.id)}-е места по итогу (${money(sumA)} и ${money(sumB)})${tail || '.'}`,
      parts[0]?.row.position.id ?? null,
    ));
  }

  return out;
}
