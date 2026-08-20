/** Сравнение коммерческих предложений по одному тендеру: позиции сметы слева,
 *  подрядчики колонками справа.
 *
 *  Живёт в entities, а не в слайсе страницы, по той же причине, что и реестр:
 *  цифры на карточке подрядчика (сумма, место) и цифры в теле таблицы (цена
 *  позиции, итог группы, разброс) считаются ИЗ ОДНИХ И ТЕХ ЖЕ строк.
 *  Разъехавшись, они дали бы экран, который спорит сам с собой: карточка
 *  говорит одно, сумма по колонке — другое.
 *
 *  ЦЕНА ХРАНИТСЯ ЗА ЕДИНИЦУ, а не суммой по позиции. Подрядчик подаёт КП
 *  расценками, объём берётся из сметы тендера и у всех одинаков — храня сумму,
 *  мы дали бы возможность записать её несогласованной с объёмом, а разброс по
 *  строке считался бы уже по «своим» объёмам у каждого. Сумма выводится.
 *
 *  ОТСУТСТВИЕ КЛЮЧА — ЭТО «ПОЗИЦИЯ НЕ ЗАКРЫТА», а не ноль. Ноль означал бы
 *  «готовы сделать бесплатно» и попал бы и в сумму, и в разброс. */

import type { Tone } from '@/shared/ui/Badge';
import type { IconName } from '@/shared/ui/Icon';

export interface ComparePosition {
  id: string;
  title: string;
  qty: number;
  unit: string;
}

/** Раздел сметы. Плоский список из тринадцати позиций читается как простыня:
 *  разделы дают итог промежуточный («материалы у всех примерно одинаковы, а
 *  расходятся на работах») и дают что свернуть, когда строки уже прочитаны. */
export interface PositionGroup {
  id: string;
  title: string;
  positions: ComparePosition[];
}

/** Смета тендера T-2026-014 «Устройство монолитного фундамента». */
export const GROUPS: PositionGroup[] = [
  {
    id: 'materials',
    title: 'Материалы',
    positions: [
      { id: 'm1', title: 'Бетон B25 W8 F150', qty: 420, unit: 'м³' },
      { id: 'm2', title: 'Арматура А500С Ø12', qty: 100, unit: 'т' },
      { id: 'm3', title: 'Щебень фр. 20–40', qty: 180, unit: 'м³' },
      { id: 'm4', title: 'Плёнка полиэтиленовая 200 мкм', qty: 840, unit: 'м²' },
      { id: 'm5', title: 'Добавка пластифицирующая', qty: 2100, unit: 'кг' },
    ],
  },
  {
    id: 'works',
    title: 'Работы',
    positions: [
      { id: 'w1', title: 'Устройство опалубки стен и плит', qty: 3150, unit: 'м²' },
      { id: 'w2', title: 'Укладка и уплотнение бетона', qty: 420, unit: 'м³' },
      { id: 'w3', title: 'Вязка арматурных каркасов', qty: 100, unit: 'т' },
      { id: 'w4', title: 'Устройство бетонной подготовки', qty: 940, unit: 'м²' },
      { id: 'w5', title: 'Геодезическое сопровождение', qty: 1, unit: 'компл.' },
    ],
  },
  {
    id: 'waterproofing',
    title: 'Гидроизоляция и швы',
    positions: [
      { id: 'g1', title: 'Гидроизоляция обмазочная, 2 слоя', qty: 2480, unit: 'м²' },
      { id: 'g2', title: 'Устройство деформационных швов', qty: 310, unit: 'м' },
      { id: 'g3', title: 'Герметизация примыканий', qty: 190, unit: 'м' },
    ],
  },
];

/** Плоский список — для расчётов, которым разделы безразличны (итог по КП,
 *  сколько позиций закрыто). Выводится из GROUPS, а не пишется вторым списком:
 *  два перечня одних и тех же позиций разъехались бы на первой же правке. */
export const POSITIONS: ComparePosition[] = GROUPS.flatMap((g) => g.positions);

/** Состояние КП. Отвечает на вопрос «можно ли по этому предложению принимать
 *  решение», а не «сколько строк заполнено» — заполненность стоит на карточке
 *  отдельно. Пример, ради которого статус вообще нужен полем: КП заполнено
 *  целиком, но к нему есть вопросы, и подписывать его сейчас нельзя. Из
 *  процентов этого не видно. */
export type BidStatusId = 'complete' | 'revision' | 'partial';

export const BID_STATUS: Record<BidStatusId, { label: string; tone: Tone; icon: IconName }> = {
  complete: { label: 'КП получено', tone: 'success', icon: 'checkCircle' },
  revision: { label: 'На уточнении', tone: 'warning', icon: 'clock' },
  partial: { label: 'Заполнено частично', tone: 'info', icon: 'activity' },
};

export interface Contractor {
  id: string;
  name: string;
  status: BidStatusId;
  /** Заполненность КП в процентах — доля сметы ПО СТОИМОСТИ, закрытая
   *  расценками. Поле, а не «сколько строк из тринадцати»: смета неоднородна,
   *  и незакрытая плёнка за 80 тысяч и незакрытая гидроизоляция за миллион —
   *  это одна строка и там, и там, но совсем разная дыра в предложении.
   *  Долю по строкам считает `filled` в Bid и показывает только скринридеру. */
  fill: number;
  inn: string;
  contact: string;
  /** Когда КП поступило, ДД.ММ.ГГГГ — как и прочие даты в домене. */
  submitted: string;
  /** Цена за единицу по id позиции. Ключа нет — позиция в КП не закрыта. */
  prices: Record<string, number>;
}

export const CONTRACTORS: Contractor[] = [
  {
    id: 'ms', name: 'АО «МетСнаб»', status: 'complete', fill: 100,
    inn: '7743013901', contact: 'Ковалёв Денис Сергеевич', submitted: '04.08.2026',
    prices: {
      m1: 4755, m2: 42067, m3: 1646, m4: 96, m5: 41,
      w1: 585, w2: 1143, w3: 7773, w4: 439, w5: 216070,
      g1: 348, g2: 1326, g3: 896,
    },
  },
  {
    id: 'ig', name: 'ООО «ИнженерГрупп»', status: 'revision', fill: 95,
    inn: '5024118820', contact: 'Наумова Елена Игоревна', submitted: '07.08.2026',
    prices: {
      m1: 5166, m2: 45869, m3: 1690, m5: 46,
      w1: 599, w2: 1265, w3: 7918, w5: 240580,
      g1: 381, g2: 1342, g3: 985,
    },
  },
  {
    id: 'sm', name: 'ООО «СтройМонтаж»', status: 'partial', fill: 88,
    inn: '7714452103', contact: 'Гареев Тимур Ринатович', submitted: '11.08.2026',
    prices: {
      m1: 5182, m2: 49585, m3: 1910, m5: 45,
      w1: 671, w2: 1209, w3: 9043, w5: 220940,
      g2: 1544, g3: 955,
    },
  },
];

/** Итог по одному подрядчику — всё, что показывает его карточка в шапке. */
export interface Bid {
  contractor: Contractor;
  /** Сколько позиций сметы закрыто расценкой. Не показывается цифрой — уходит
   *  в подпись шкалы для скринридера; на экране заполненность одна, `percent`,
   *  иначе два близких, но разных числа рядом читались бы как ошибка. */
  filled: number;
  /** Заполненность КП, 0…100 — из contractor.fill. */
  percent: number;
  /** Итог по ЗАКРЫТЫМ позициям. У неполного КП он заведомо занижен — поэтому
   *  ранг такого предложения и опущен в конец (см. rankBids). */
  sum: number;
  /** Место по итогу, с 1. */
  rank: number;
  /** Цвет колонки по месту: лучшее — зелёное, худшее — красное, всё между —
   *  янтарное. Тон, а не «зелёный»: цвет один раз назван в токенах. */
  tone: Tone;
  /** Подпись места. Цвет колонки — это wash в несколько процентов, и он не
   *  имеет права быть единственным носителем ранга: подпись читается и в
   *  чёрно-белом, и скринридером. */
  rankLabel: string;
}

/** Итог по позициям — одна функция и для группы, и для всего КП. */
export function sumOf(contractor: Contractor, positions: ComparePosition[]): number {
  return positions.reduce((acc, p) => acc + (contractor.prices[p.id] ?? 0) * p.qty, 0);
}

/** Итог подрядчика по разделу сметы — строка «Итого · Материалы». */
export function groupSum(group: PositionGroup, contractor: Contractor): number {
  return sumOf(contractor, group.positions);
}

/** Итоги по всем подрядчикам, УЖЕ отранжированные.
 *
 *  ПОРЯДОК СОРТИРОВКИ — ДВУХКЛЮЧЕВОЙ, и первый ключ важнее второго:
 *  сначала полнота КП, и только потом сумма. Иначе побеждал бы тот, кто
 *  просто не заполнил часть сметы: его итог меньше не потому, что дешевле,
 *  а потому, что там нечего складывать. Неполное предложение уходит вниз
 *  всегда, каким бы дешёвым ни выглядело.
 *
 *  Ранг — ПОДСКАЗКА, а не вердикт: сроки, гарантии и опыт в цифрах здесь не
 *  участвуют. Ровно поэтому цвет колонки можно перекрасить руками — базовый
 *  расчёт даёт первое приближение, решение остаётся за человеком. */
export function rankBids(
  contractors: Contractor[] = CONTRACTORS,
  positions: ComparePosition[] = POSITIONS,
): Bid[] {
  const scored = contractors.map((contractor) => ({
    contractor,
    filled: positions.filter((p) => contractor.prices[p.id] !== undefined).length,
    percent: contractor.fill,
    sum: sumOf(contractor, positions),
  }));

  scored.sort((a, b) => (
    Number(a.percent < 100) - Number(b.percent < 100) || a.sum - b.sum
  ));

  const last = scored.length;
  return scored.map((bid, i) => {
    const rank = i + 1;
    return {
      ...bid,
      rank,
      tone: rank === 1 ? 'success' : rank === last ? 'danger' : 'warning',
      rankLabel: rank === 1 ? 'Лучшее предложение' : `${rank}-е место`,
    };
  });
}

/** Разброс цен по позиции — на сколько процентов самое дорогое предложение
 *  дороже самого дешёвого.
 *
 *  Считается от МИНИМУМА, а не от среднего: вопрос, который задают строке, —
 *  «насколько я переплачу, если возьму не самого дешёвого». Меньше двух
 *  расценок — сравнивать не с чем, и это null, а не 0: ноль означал бы
 *  «все предложили одинаково».  */
export function spread(position: ComparePosition, contractors: Contractor[] = CONTRACTORS): number | null {
  const prices = contractors
    .map((c) => c.prices[position.id])
    .filter((p): p is number => p !== undefined);
  if (prices.length < 2) return null;
  const min = Math.min(...prices);
  return ((Math.max(...prices) - min) / min) * 100;
}

const MONEY = new Intl.NumberFormat('ru-RU', {
  style: 'currency', currency: 'RUB', maximumFractionDigits: 0,
});
const DECIMAL = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

/** Рубли без копеек: в сравнении КП значащие разряды — миллионы, и копейки
 *  только удлиняют колонку. */
export const money = (value: number): string => MONEY.format(value);
/** Число с запятой и без хвоста нулей — объёмы (86,5 т) и проценты (7,9 %). */
export const decimal = (value: number): string => DECIMAL.format(value);
