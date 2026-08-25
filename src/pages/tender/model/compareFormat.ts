import {
  anomalyRatio, cellMark, decimal, deviationPct, isWaiting, money,
  pendingCorrection, sectionPathOf, spreadPoints,
  type Bid, type ComparePosition, type CompareThresholds, type Contractor,
  type PositionGroup, type RowFacts,
} from '@/entities/comparison';
import { plural } from '@/shared/lib/plural';
import type { Tone } from '@/shared/ui/Badge';
import type { CellPopupData } from '@/shared/ui/CellPopup';

/** Формат и цвет сравнения КП: тон → CSS-токен и обратно, подписи процентов,
 *  действующий цвет колонки.
 *
 *  Живёт в model/, а не в компонентах: одни и те же значения читают <col>
 *  таблицы, карточка подрядчика и ячейки с попапами. Единый источник не даёт
 *  колонке и её шапке разъехаться в цвете, а процентам — в формате.
 *
 *  ВЫЧИСЛЕННОЕ ЗНАЧЕНИЕ ЦВЕТА читает DOM (`getComputedStyle`): вызывать можно
 *  только на клиенте — у приложения SSR нет. */

/** Тон → имя токена. Таблицей, а не `--cu-tone-${tone}`: собранное из строки
 *  имя не проверяется ничем, и опечатка дала бы колонку без цвета без единой
 *  ошибки в консоли. */
const TONE_TOKEN: Record<Tone, string> = {
  info: '--cu-tone-info',
  success: '--cu-tone-success',
  warning: '--cu-tone-warning',
  danger: '--cu-tone-danger',
  neutral: '--cu-tone-neutral',
};

/** Тон как цвет для CSS — ссылкой на токен: перекрасят тему, перекрасятся и
 *  колонки. */
export const toneColor = (tone: Tone) => `var(${TONE_TOKEN[tone]})`;

/** Он же ВЫЧИСЛЕННЫМ значением. Пикеру нужен цвет, а не ссылка: `var(...)`
 *  для него — просто нераспознанная строка, и окно открылось бы на чёрном. */
export const resolveTone = (tone: Tone) =>
  getComputedStyle(document.documentElement).getPropertyValue(TONE_TOKEN[tone]).trim();

/** Процент со знаком и типографским минусом: направление отклонения читается
 *  знаком, а не догадкой. */
export const pctSigned = (v: number): string =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${decimal(Math.abs(v))} %`;

/** Действующий цвет колонки. Ручная палитра (<ColumnPainter>) старше всего:
 *  человек перекрасил — так и останется. Дефолтной подкраски по ранжиру в
 *  покое НЕТ (решение владельца 24.08.2026), она включается тумблером
 *  «Раскрасить по ранжированию» в окне параметров — тогда некрашеная колонка
 *  берёт тон своего места. Выключено и не крашено — `undefined`, и потребители
 *  просто не ставят `--col`. */
export const choose = (
  tint: Record<string, string>, bid: Bid, byRank = false,
): string | undefined =>
  tint[bid.contractor.id] ?? (byRank ? toneColor(bid.tone) : undefined);

/** Сколько знаков названия съедает ключевая пометка: глиф 28px плюс отступ
 *  6px ≈ пять знаков. Резерв обязателен — иначе ключ выталкивается за край
 *  ячейки ровно у тех строк, где он и нужен. */
const KEY_RESERVE = 5;

/** Название позиции под лимит знаков (`titleLimit()` в model/columns.ts):
 *  влезает — как есть; не влезает — срезаем последние три знака лимита и
 *  ставим многоточие, полное название всплывает <Tooltip>'ом. */
export function clipTitle(title: string, limit: number, hasKey: boolean): string {
  const max = Math.max(4, hasKey ? limit - KEY_RESERVE : limit);
  if (title.length <= max) return title;
  return `${title.slice(0, max - 3).trimEnd()}…`;
}

/** Вид пометки ячейки. Пять значений — те же пять предикатов, что решают, ЧТО
 *  нарисует <BidCell>; они же уезжают в атрибут `data-marks` каждой ячейки и
 *  оттуда обслуживают переход «строка перечня → первая такая ячейка колонки».
 *  Union, а не строки по месту: опечатка в имени пометки дала бы молча пустой
 *  обход — кнопка есть, число при ней есть, а идти некуда. */
export type MarkKind = 'min' | 'anomaly' | 'correction' | 'missing' | 'declined';

/** Сводка пометок ОДНОЙ колонки: сколько в ней минимумов, аномалий,
 *  нерассмотренных корректировок, пробелов данных и отказов.
 *
 *  ЖИВЁТ РЯДОМ С ФОРМАТОМ, А НЕ В ENTITIES, потому что это не новая величина,
 *  а ПЕРЕСКАЗ уже посчитанного: все пять предикатов дословно те же, что решают,
 *  ЧТО нарисует <BidCell> в ячейке. Разъедься они — в панели колонки
 *  окажется одно число, а на экране другое, и заметить это будет нечем.
 *
 *  Считается по ВСЕМУ срезу, как caption и счётчики фильтров: панель
 *  отвечает на «что вообще есть в этой колонке», а не «что видно сейчас». */
export type ColumnMarks = Record<MarkKind, number> & {
  /** Есть ли хоть что-то: пустая панель говорит словами, а не пустотой. */
  any: boolean;
};

export function columnMarks(rows: RowFacts[], contractor: Contractor): ColumnMarks {
  let min = 0; let anomaly = 0; let correction = 0; let missing = 0; let declined = 0;
  for (const row of rows) {
    const { position } = row;
    if (position.removed) continue;
    const mark = cellMark(contractor, position.id);
    if (mark.declined) { declined += 1; continue; }
    if (contractor.prices[position.id] === undefined) { missing += 1; continue; }
    if (row.bestIds.includes(contractor.id)) min += 1;
    if (row.bids.find((b) => b.contractorId === contractor.id)?.anomaly) anomaly += 1;
    if (row.corrections.includes(contractor.id)) correction += 1;
  }
  return {
    min, anomaly, correction, missing, declined,
    any: min + anomaly + correction + missing + declined > 0,
  };
}

/* ═══════════════════ СВОДКА ЯЧЕЙКИ (§2.2) ═══════════════════ */

/** Что рисует ячейка. Одно перечисление на два места: по нему <BidCell>
 *  выбирает ветку рендера, и по нему же собирается сводка — иначе попап
 *  однажды объяснил бы состояние, которого в ячейке нет. */
export type CellState = 'value' | 'declined' | 'waiting' | 'missing' | 'removed';

export function cellStateOf(contractor: Contractor, positionId: string, removed?: boolean): CellState {
  if (removed) return 'removed';
  if (cellMark(contractor, positionId).declined) return 'declined';
  if (contractor.prices[positionId] !== undefined) return 'value';
  return isWaiting(contractor, positionId) ? 'waiting' : 'missing';
}

/** Подпись состояния и её тон. Слова живут ЗДЕСЬ, а не в ячейке: в ячейке
 *  слов нет вовсе (правило владельца 25.08.2026), они появляются только в
 *  сводке и в карточке. */
const STATE_LINE: Record<Exclude<CellState, 'value'>, { text: string; tone: Tone }> = {
  declined: { text: 'Отказ от позиции', tone: 'neutral' },
  waiting: { text: 'Ждём ответ поставщика', tone: 'info' },
  missing: { text: 'Цена не подана', tone: 'neutral' },
  removed: { text: 'Позиция снята из сметы', tone: 'neutral' },
};

/**
 * СВОДКА ТЕЛА ЯЧЕЙКИ — накопительная, в ФИКСИРОВАННОМ порядке (`cell.md` §3):
 * состояние → корректировка → аномалия → тело → подвал «есть комментарий».
 *
 * Порядок фиксирован не ради красоты: соседние ячейки читают ВЕДЯ КУРСОР по
 * строке, и если у одной «аномалия» стоит второй строкой, а у другой —
 * четвёртой, сравнение превращается в перечитывание. Собирается одной
 * функцией по той же причине, по которой `cellLines()` собирает состав строк:
 * так порядок нельзя нарушить локальной правкой одной ветки.
 *
 * ПОДВАЛ НАЗЫВАЕТ ФАКТ КОММЕНТАРИЯ, А НЕ ЦИТИРУЕТ ЕГО. Текст поставщика бывает
 * на два экрана (§2.4), и в подсказке по наведению ему места нет — она обязана
 * закрываться движением курсора, а не читаться.
 */
export function cellSummary(input: {
  row: RowFacts;
  contractor: Contractor;
  state: CellState;
  thresholds: CompareThresholds;
  /** Комментарий разбора ИИ к этой ячейке — приходит после запуска (Р4). */
  note?: string;
  /** Сколько записей в треде и есть ли непросмотренные (§2.4). */
  comments?: { total: number; unread: boolean };
}): CellPopupData {
  const { row, contractor, state, thresholds, note, comments } = input;
  const { position } = row;
  const mark = cellMark(contractor, position.id);
  const price = contractor.prices[position.id];
  const correction = pendingCorrection(mark);
  const anomaly = row.bids.find((b) => b.contractorId === contractor.id)?.anomaly ?? false;

  const fields: CellPopupData['fields'] = [];

  /* 1. СОСТОЯНИЕ — первой строкой и только когда оно не «обычное значение».
        У нормальной ячейки строки состояния нет вовсе: «всё в порядке» это
        не сообщение, а отсутствие сообщений. */
  if (state !== 'value') {
    fields.push({ label: 'Состояние', value: STATE_LINE[state].text });
  }
  /* 2. КОРРЕКТИРОВКА — вторая: она о том, можно ли верить самому числу. */
  if (correction) {
    fields.push({
      label: 'Поставщик считает',
      value: `${decimal(correction.qty)} ${position.unit} вместо ${decimal(position.qty)}`,
    });
  }
  /* 3. АНОМАЛИЯ — третья: уточнение к числу, которому уже можно или нельзя
        верить по двум строкам выше. */
  if (anomaly) fields.push({ label: 'Проверка', value: 'Аномальная цена' });

  /* ТЕЛО — только там, где есть число. У отказа и пробела складывать нечего,
     и «Стоимость —» строкой было бы шумом при уже названном состоянии. */
  if (state === 'value' && price !== undefined) {
    const sum = price * position.qty;
    const dev = row.median !== null ? deviationPct(price, row.median) : null;
    fields.push({ label: 'Стоимость', value: money(sum) });
    fields.push({ label: 'Объём', value: `${decimal(position.qty)} ${position.unit}` });
    fields.push({ label: 'Ставка', value: `${money(price)}/${position.unit}` });
    fields.push({ label: 'К медиане', value: dev === null ? '—' : pctSigned(dev) });
    if (mark.potential) {
      fields.push({
        label: 'Запас торга', value: `+${money(mark.potential * position.qty)}`, tone: true,
      });
    }
    if (row.bestIds.includes(contractor.id)) {
      fields.push({
        label: 'Край строки',
        value: row.bestIds.length > 1 ? 'Совместный минимум' : 'Минимальная стоимость',
      });
    } else if (row.maxIds.includes(contractor.id)) {
      fields.push({
        label: 'Край строки',
        value: row.maxIds.length > 1 ? 'Совместный максимум' : 'Верхняя граница строки',
      });
    }
  }

  return {
    /* Тон сводки — САМОЕ ГРОМКОЕ из состояний ячейки, а не тон первой строки:
       аномалия поверх ожидания это всё-таки аномалия. */
    tone: anomaly ? 'warning'
      : correction ? 'warning'
        : state !== 'value' ? STATE_LINE[state].tone : 'neutral',
    title: contractor.name,
    fields,
    meter: row.spread === null ? undefined : {
      label: 'Разброс строки',
      value: `${decimal(row.spread)} %`,
      fraction: Math.min(row.spread / thresholds.spreadHigh, 1),
    },
    ...(note ? { note } : anomaly && mark.anomaly ? { note: mark.anomaly } : {}),
    ...(comments?.total ? {
      fact: comments.unread
        ? `Есть непросмотренные комментарии (${comments.total}) — откройте маркер справа`
        : `Есть комментарий (${comments.total}) — откройте маркер справа`,
    } : {}),
  };
}

/* ═══════════════════ СВОДКИ ЗНАКОВ (§8 правок 25.08.2026, вечер) ═══════════

   ЗНАК ОБЯЗАН ОБЪЯСНЯТЬ СЕБЯ ПОД КУРСОРОМ. Слова из ячейки убраны (правило
   владельца), и это правильно — но вместе со словами исчезло и объяснение:
   на штриховку аномалии человек наводился и не получал ровно ничего, потому
   что цель сводки — ЦЕНА, а штриховка лежит на кромке, вне её. Легенда
   отвечает «что означает знак вообще», сводка знака — «что он означает
   ЗДЕСЬ», и второй ответ нельзя заменить первым.

   ЗДЕСЬ, А НЕ В КОМПОНЕНТЕ: ровно по той же причине, что и `cellSummary` —
   формулировки экрана живут одним файлом, иначе легенда, сводка ячейки и
   сводка знака расходятся в терминах, и один и тот же значок называется в
   трёх местах по-разному. */

/** Знаки ячейки, у которых есть собственная цель наведения.
 *
 *  МОНЕТА ВХОДИТ СЮДА С 25.08.2026 (правка владельца, §9). До этого её
 *  держали вне списка доводом «стоит внутри тела ячейки и отберёт попап у
 *  цены»; довод оказался слабее факта: запас торга — единственная величина
 *  ячейки, которая НЕ следует из её чисел, и знак, объясняющий себя молчанием,
 *  не объясняет ничего. Отбирать попап у цены она может ровно там, где курсор
 *  стоит НА НЕЙ — то есть там, где спрашивают именно про неё; правило
 *  «наведение на знак гасит подсветку тела» распространено и на монету, чтобы
 *  до клика было видно, какая цель активна. */
export type SignKind = 'min' | 'anomaly' | 'correction' | 'coin';

export function signSummary(kind: SignKind, input: {
  row: RowFacts;
  contractor: Contractor;
}): CellPopupData {
  const { row, contractor } = input;
  const { position } = row;
  const price = contractor.prices[position.id];
  const mark = cellMark(contractor, position.id);

  if (kind === 'min') {
    const shared = row.bestIds.length > 1;
    return {
      tone: 'success',
      title: shared ? 'Совместный минимум' : 'Минимальная стоимость',
      fields: [
        { label: 'Здесь', value: price === undefined ? '—' : money(price * position.qty) },
        { label: 'Медиана строки', value: row.median === null ? '—' : money(row.median * position.qty) },
        ...(shared ? [{
          label: 'Столько же у',
          value: `ещё ${row.bestIds.length - 1}`,
        }] : []),
      ],
      note: 'Лучшая цена строки среди предложений без аномалий. Штамп стоит на одной и той же ячейке при любом режиме показа.',
    };
  }

  if (kind === 'anomaly') {
    const dev = price !== undefined && row.median !== null
      ? deviationPct(price, row.median) : null;
    return {
      tone: 'warning',
      title: 'Аномальная цена',
      fields: [
        { label: 'Здесь', value: price === undefined ? '—' : money(price * position.qty) },
        { label: 'К медиане', value: dev === null ? '—' : pctSigned(dev) },
      ],
      note: mark.anomaly
        ?? 'Цена выбивается из ряда по этой позиции и требует обоснования состава. Штриховка и риска на кромке — два канала одного и того же признака.',
    };
  }

  if (kind === 'coin') {
    /* ЗАПАС ТОРГА — ЗАЯВЛЕННАЯ ВЕЛИЧИНА, а не выведенная из цен: поставщик
       сам назвал, сколько готов отдать. Поэтому в сводке она стоит рядом с
       текущей ценой и с ценой ПОСЛЕ уступки — иначе «+18 400 ₽» не с чем
       сопоставить, а решают именно по второй цифре. */
    const pot = mark.potential;
    const now = price === undefined ? null : price * position.qty;
    const gain = pot === undefined ? null : pot * position.qty;
    return {
      tone: 'info',
      title: 'Запас торга',
      fields: [
        { label: 'Сейчас', value: now === null ? '—' : money(now) },
        { label: 'Готов уступить', value: gain === null ? '—' : `+${money(gain)}`, tone: true },
        {
          label: 'Станет',
          value: now === null || gain === null ? '—' : money(now - gain),
        },
      ],
      note: 'Величина заявлена самим поставщиком и в итог КП не входит: итог считается по действующей цене.',
    };
  }

  const correction = pendingCorrection(mark);
  return {
    tone: 'warning',
    title: 'Иной объём у поставщика',
    fields: [
      { label: 'Смета', value: `${decimal(position.qty)} ${position.unit}` },
      {
        label: 'Поставщик считает',
        value: correction ? `${decimal(correction.qty)} ${position.unit}` : '—',
      },
    ],
    note: correction?.note
      ?? 'Стоимость посчитана за собственный объём поставщика. Пока корректировка не рассмотрена, число несопоставимо с соседями по строке.',
    fact: 'Клик открывает панель решения',
  };
}

/** Сводка КЛЮЧЕВОЙ ПОМЕТКИ позиции — знак живёт в колонке-якоре, а не в
 *  ячейке КП, поэтому и данные у него строковые: почему строка попала в
 *  ключевые и сколько она весит. */
export function keySummary(row: RowFacts, share: number): CellPopupData {
  return {
    tone: 'info',
    title: 'Ключевая позиция',
    fields: [
      { label: 'Доля в тендере', value: `${decimal(share)} %` },
      { label: 'Стоимость', value: money(row.weight) },
      {
        label: 'Откуда пометка',
        value: row.position.key === true ? 'поставлена вручную' : 'топ по весу',
      },
    ],
    note: 'Ключевые позиции решают итог: на них смотрят первыми и по ним торгуются.',
  };
}

/* ═══════════════════ РАЗБОР РАЗБРОСА (§3 правок 25.08.2026) ═══════════════

   Ячейка «Разброс» отдаёт разбор строки: края диапазона поимённо и со
   ставками, сопоставимость, аномалии с коэффициентом k и полоску
   распределения. Собирается ЗДЕСЬ, а не в <SpreadCell>, по общему правилу
   файла: числа считает модель, слова живут одним словарём, компонент рисует
   готовое. До переезда шесть величин (min, max, кто на краях, сопоставимые,
   ставки) считались прямо в разметке — то есть в самом горячем месте экрана
   и без единой возможности их проверить. */
export function spreadSummary(input: {
  row: RowFacts;
  thresholds: CompareThresholds;
  /** Имя подрядчика по id: края диапазона и аномалии называются поимённо. */
  nameOf: (contractorId: string) => string;
}): CellPopupData {
  const { row, thresholds, nameOf } = input;
  const { position, spread, spreadTag } = row;
  const word = spreadTag === 'high' ? 'высокий'
    : spreadTag === 'noticeable' ? 'заметный' : 'низкий';

  const prices = row.bids.map((b) => b.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const minAt = row.bids.find((b) => b.price === min)!;
  const maxAt = row.bids.find((b) => b.price === max)!;
  const fair = row.bids.filter((b) => !b.anomaly);

  /* СТОИМОСТЬ И СТАВКА ОДНОЙ СТРОКОЙ. Края диапазона сравнивают по деньгам,
     но объём у корректировок бывает свой, и «1 692 000 ₽» без «705 ₽/м²»
     не отвечает, дешевле ли предложение на самом деле. */
  const pair = (price: number) => (
    /* Объём 1 — ставка РАВНА стоимости, и печатать «109 367 ₽ · 109 367 ₽/компл.»
       значит занимать полстроки повтором. Такие позиции в смете обычны:
       комплект, узел, щит. */
    position.qty === 1
      ? money(price)
      : `${money(price * position.qty)} · ${money(price)}/${position.unit}`
  );
  const points = spreadPoints(row);

  return {
    tone: spreadTag === 'high' ? 'danger' : spreadTag === 'noticeable' ? 'warning' : 'success',
    title: `Разброс ${decimal(spread ?? 0)} % — ${word}`,
    width: 420,
    fields: [
      { label: 'MIN', value: `${pair(min)} · ${nameOf(minAt.contractorId)}` },
      { label: 'медиана', value: row.median === null ? '—' : pair(row.median) },
      { label: 'MAX', value: `${pair(max)} · ${nameOf(maxAt.contractorId)}` },
      {
        label: 'сопоставимо',
        value: `${fair.length} ${plural(fair.length, 'цена', 'цены', 'цен')} из ${row.bids.length}`,
      },
      /* АНОМАЛИИ — ПОИМЁННО И С КОЭФФИЦИЕНТОМ. Строка «сопоставимо 5 из 6»
         называет ЧИСЛО выброшенных, но не отвечает, кто и насколько выбился, —
         а именно это решает, спорить с ценой или принять её. Формулировка
         выводится из знака, а не написана заранее. */
      ...row.bids.filter((b) => b.anomaly).map((b) => {
        const k = anomalyRatio(b.price, row.median);
        return {
          span: true as const,
          label: '',
          value: k === null
            ? `аномалия: ${nameOf(b.contractorId)}`
            : `аномалия: ${nameOf(b.contractorId)} ${k >= 1 ? 'выше' : 'ниже'} медианы в k = ${decimal(k >= 1 ? k : 1 / k)} раза`,
        };
      }),
    ],
    /* Меньше двух сопоставимых цен — полоски нет вовсе: одна точка показывает
       не форму ряда, а его отсутствие. */
    strip: points.length >= 2 ? {
      min: 'MIN',
      max: 'MAX',
      points: points.map((p) => ({ at: p.at, n: p.n, title: p.ids.map(nameOf).join(', ') })),
    } : undefined,
    note: spreadTag === 'high'
      ? `Цены КП расходятся на ${decimal(thresholds.spreadHigh)} % и больше — сверяйте состав объёма, прежде чем сравнивать итоги.`
      : undefined,
  };
}

/* ═══════════════════ ПАСПОРТ ПОЗИЦИИ (§4.1, вёрстка §2) ═══════════════════

   Наведение на название раскрывает то, чего нет в строке. Пять блоков в
   фиксированном порядке, и порядок этот — порядок вопросов, которые задают:

     идентификация  — полное имя, путь ФКП, единица и шаблонный объём;
     медиана        — база, от которой считаются вклад и отклонения;
     участие        — сколько цен подано из скольких, сколько сопоставимо,
                      и ПОИМЁННО те, кто отказался, пропустил или молчит;
     условия        — условия КП, названные по этой позиции, со счётом;
     корректировки  — кто ждёт решения по иному объёму.

   Первые три есть всегда, последние два — только когда есть. Пустой блок не
   рисуется вовсе: «условий нет» это не сообщение.

   ИМЯ И ПУТЬ УХОДЯТ В ШАПКУ панели (`title`/`sub`), а не в поля таблицы:
   полем «ФКП» вставало в колонку ЗНАЧЕНИЙ, то есть в один столбик с деньгами,
   которыми путь не является.

   ВСЁ ВЫВОДИТСЯ ИЗ ДАННЫХ, ни одна строка не написана заранее (правило
   владельца о non-AI фичах): участие считается по КП, условия — по их
   `conditions`, корректировки — по `pendingCorrection`.

   ЖИВЁТ ЗДЕСЬ, А НЕ В <TenderCompare>: это сборка ДАННЫХ, а не разметки, и
   именно её первой заменит настоящий ответ сервера. Экран остаётся с одним
   `useCallback` вместо восьмидесяти строк счёта. */
export function positionPassport(input: {
  row: RowFacts;
  /** Смета секциями — из неё выводится путь ФКП позиции. */
  groups: PositionGroup[];
  /** Колонки в порядке ленты: участие считается по КП, идущим В СЧЁТ. */
  bids: Bid[];
}): CellPopupData {
  const { row, groups, bids } = input;
  const position: ComparePosition = row.position;
  const positionId = position.id;

  const path = sectionPathOf(position, groups);
  const declined: string[] = [];
  const skipped: string[] = [];
  const waiting: string[] = [];
  const pending: string[] = [];
  /* УСЛОВИЯ СО СЧЁТОМ КП. Считаются по тем предложениям, где цена по ЭТОЙ
     позиции названа: условие подрядчика, не закрывшего строку, к её цене
     отношения не имеет и в счёт идти не должно. Ключ — сам текст условия:
     формулировку задаёт источник, и словаря у нас нет. */
  const conditions = new Map<string, number>();
  let counted = 0;
  for (const bid of bids) {
    const c = bid.contractor;
    if (!bid.counts) continue;
    counted += 1;
    const mark = cellMark(c, positionId);
    if (mark.declined) declined.push(c.name);
    else if (c.prices[positionId] === undefined) {
      (isWaiting(c, positionId) ? waiting : skipped).push(c.name);
    } else {
      for (const cond of c.conditions ?? []) {
        conditions.set(cond, (conditions.get(cond) ?? 0) + 1);
      }
    }
    if (pendingCorrection(mark)) pending.push(c.name);
  }
  const fair = row.bids.filter((b) => !b.anomaly).length;

  return {
    title: position.title,
    /* Подзаголовок отвечает на «что это»: путь ФКП и мера. Обе величины
       именующие, а не сравниваемые — в колонке значений им места нет. */
    sub: [
      path.length ? `ФКП: ${path.join(' › ')}` : null,
      `единица ${position.unit} · шаблонный объём ${decimal(position.qty)}`,
    ].filter(Boolean).join('\n'),
    width: 400,
    fields: [
      {
        label: 'медианная стоимость',
        value: row.median === null ? '—' : money(row.median * position.qty),
      },
      {
        label: 'цен подано',
        value: `${row.bids.length} из ${counted} · сопоставимо ${fair}`,
      },
      /* ПОИМЁННО — строками во всю ширину: у них нет подписи, и пустая колонка
         слева резала бы фразе место ни за чем. */
      ...declined.map((name) => ({ span: true as const, label: '', value: `${name} — отказ от позиции` })),
      ...skipped.map((name) => ({ span: true as const, label: '', value: `${name} — позиция пропущена` })),
      ...waiting.map((name) => ({ span: true as const, label: '', value: `${name} — ждём ответ` })),
      /* «КП» не склоняется — plural дал бы три одинаковые формы; счёт даёт
         число. */
      ...[...conditions].map(([cond, n]) => ({ label: 'условия', value: `${cond} · ${n} КП` })),
      ...(pending.length
        ? [{ label: 'на рассмотрении', value: `иной объём — ${pending.join(', ')}` }]
        : []),
    ],
    note: position.key || row.keyDerived
      ? 'Ключевая позиция — входит в верхнюю долю стоимости тендера.'
      : undefined,
  };
}
