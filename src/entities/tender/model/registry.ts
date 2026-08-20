/** Данные и фильтрация реестра тендеров. Вынесено из компонента страницы,
 *  потому что этим пользуются двое — таблица и панель фильтров над ней:
 *  списки значений в выпадающих меню собираются ИЗ ЭТИХ ЖЕ строк, а не
 *  дублируются руками. Так в меню не может появиться пункт, который ничего
 *  не найдёт, и не может пропасть значение, которое в данных есть. */

import { daysUntil, daysWord, dmyToIso } from '@/shared/lib/date';
import type { Tone } from '@/shared/ui/Badge';
import type { Facet } from '@/shared/ui/FacetFilter';
import type { IconName } from '@/shared/ui/Icon';

export type StatusId = 'open' | 'closed' | 'cancelled' | 'draft';

/** Тон и глиф статуса — один источник на все места сразу: капсула в таблице
 *  (<Badge>) и строка в фильтре (<MenuCheckItem>) обязаны совпадать и по
 *  цвету, и по значку, иначе связь «я отфильтровал по зелёному» рвётся. Тип
 *  Tone берётся из <Badge>, чтобы домен не заводил своей палитры. */
export const STATUS: Record<StatusId, { label: string; tone: Tone; icon: IconName }> = {
  open: { label: 'Открыт', tone: 'info', icon: 'activity' },
  closed: { label: 'Закрыт', tone: 'success', icon: 'checkCircle' },
  cancelled: { label: 'Отменён', tone: 'danger', icon: 'closeCircle' },
  draft: { label: 'Черновик', tone: 'neutral', icon: 'documentText' },
};

export const STATUS_IDS = Object.keys(STATUS) as StatusId[];

export interface TenderRow {
  id: string;
  title: string;
  /** Портфель и путь проекта внутри него: вторая строка — уточнение к первой. */
  portfolio: string;
  project: string;
  kind: string;
  status: StatusId;
  owner: string;
  start: string;
  end: string;
  created: string;
}

export const ROWS: TenderRow[] = [
  {
    id: 'T-2026-009', title: 'Устройство кровли',
    portfolio: 'Жилой комплекс «Северный»', project: 'Корпус 2',
    kind: 'Строительство и СМР', status: 'closed',
    owner: 'Иванов Иван Иванович',
    start: '01.03.2026', end: '10.04.2026', created: '20.08.2026',
  },
  {
    id: 'T-2026-002', title: 'Демонтажные работы',
    portfolio: 'Жилой комплекс «Северный»', project: 'Корпус 2',
    kind: 'Строительство и СМР', status: 'closed',
    owner: 'Иванов Иван Иванович',
    start: '10.01.2026', end: '01.02.2026', created: '20.08.2026',
  },
  {
    id: 'T-2026-014', title: 'Устройство монолитного фундамента',
    portfolio: 'Жилой комплекс «Северный»', project: 'Корпус 1',
    kind: 'Строительство и СМР', status: 'open',
    owner: 'Иванов Иван Иванович',
    start: '01.06.2026', end: '15.07.2026', created: '20.08.2026',
  },
  {
    id: 'T-2026-031', title: 'Монтаж ОВиК',
    portfolio: 'Коммерческая недвижимость', project: 'ТЦ «Горизонт» / Инженерные системы',
    kind: 'Инженерные системы', status: 'cancelled',
    owner: 'Кузнецова Ольга Павловна',
    start: '01.05.2026', end: '01.06.2026', created: '20.08.2026',
  },
  /* Три строки ниже держат экран честным. Без них в фикстуре не было НИ ОДНОГО
     тендера, идущего сегодня (последний заканчивался в июле), и любое окно
     «последние N дней» отдавало пустую таблицу — фильтр выглядел сломанным,
     хотя работал верно. Заодно появляется статус «Черновик», которого в данных
     не было вовсе, и третьи по счёту вид работ и ответственный — иначе окно
     фильтров нечем показать. */
  {
    id: 'T-2026-042', title: 'Устройство фасадов',
    portfolio: 'Жилой комплекс «Северный»', project: 'Корпус 1',
    kind: 'Строительство и СМР', status: 'open',
    owner: 'Соколов Артём Викторович',
    start: '01.07.2026', end: '30.09.2026', created: '25.06.2026',
  },
  {
    id: 'T-2026-038', title: 'Поставка лифтового оборудования',
    portfolio: 'Коммерческая недвижимость', project: 'ТЦ «Горизонт» / Вертикальный транспорт',
    kind: 'Поставка оборудования', status: 'closed',
    owner: 'Кузнецова Ольга Павловна',
    start: '15.06.2026', end: '10.08.2026', created: '02.06.2026',
  },
  {
    id: 'T-2026-047', title: 'Благоустройство территории',
    portfolio: 'Жилой комплекс «Северный»', project: 'Корпус 2',
    kind: 'Строительство и СМР', status: 'draft',
    owner: 'Соколов Артём Викторович',
    start: '01.09.2026', end: '15.10.2026', created: '18.08.2026',
  },
];

/** Адрес карточки тендера. Одна функция на всё приложение: строку собирают и
 *  таблица (клик по строке), и роутер, и крошки — разъехавшись, они дали бы
 *  ссылку в никуда. */
export function tenderPath(id: string): string {
  return `/tenders/registry/${id}`;
}

export function tenderById(id: string | undefined): TenderRow | undefined {
  return ROWS.find((row) => row.id === id);
}

/** Режим срока сбора КП. Пять состояний, потому что расшифровка у них разная;
 *  ВИДОВ у даты при этом три — см. TenderSummary.module.css. Цвет отвечает на
 *  один вопрос: «нужно ли действовать сейчас?», а не «какой сегодня день»,
 *  поэтому «истёк» и «осталось три дня» выглядят одинаково тревожно и
 *  различаются подсказкой. */
export type DueMode = 'overdue' | 'urgent' | 'soon' | 'calm' | 'idle';

export interface BidsDue {
  mode: DueMode;
  /** Расшифровка целой фразой — уходит в подсказку по наведению и в текст для
   *  скринридера. Не «36 дней», а «что это значит»: сама дата на экране уже
   *  есть, объяснения нет. */
  hint: string;
}

/** С какого запаса срок сбора КП перестаёт быть «когда-нибудь» и становится
 *  «скоро». Неделя — потому что КП готовят рабочими днями. */
const URGENT_DAYS = 7;
/** Месяц — горизонт, на который смотрят: дальше него дата перестаёт что-либо
 *  значить сегодня и гасится совсем. */
const SOON_DAYS = 30;

/** Режим и расшифровка срока сбора КП.
 *
 *  Три решения, каждое стоило бы ошибки:
 *
 *  СЧИТАЕТСЯ ОТ row.end. Отдельного поля «срок сбора КП» в данных нет: в
 *  реестре эта же дата стоит в колонке «Окончание». Заводить второе поле с
 *  тем же смыслом хуже, чем назвать одно по-разному в двух местах, — две даты
 *  разъедутся, одна нет.
 *
 *  ОТСЧЁТ ИДЁТ ТОЛЬКО У ОТКРЫТОГО ТЕНДЕРА. У закрытого и отменённого срок
 *  сбора прошёл по определению, и тревожное «истёк 36 дней назад» на закрытом
 *  тендере — сигнал о том, что уже никого не касается; у черновика причина
 *  обратная: он не опубликован, отсчитывать не от чего. Но подсказка есть и у
 *  них — иначе наведение на дату отвечало бы молчанием в трёх статусах из
 *  четырёх, и это читалось бы как поломка, а не как «нечего сказать».
 *
 *  ПОДСКАЗКА — ЦЕЛАЯ ФРАЗА, а не «36 дней». Число без слов пришлось бы
 *  расшифровывать самому: 36 дней до срока или после него? */
export function bidsDue(row: TenderRow, today?: string): BidsDue {
  if (row.status !== 'open') {
    return {
      mode: 'idle',
      hint: row.status === 'draft'
        ? 'Черновик не опубликован — отсчёт до срока сбора КП ещё не начат.'
        : `Тендер ${STATUS[row.status].label.toLowerCase()} — приём коммерческих предложений завершён.`,
    };
  }

  const left = daysUntil(dmyToIso(row.end), today);
  if (left < 0) {
    return {
      mode: 'overdue',
      hint: `Срок истёк ${-left} ${daysWord(left)} назад. Приём коммерческих предложений закрыт.`,
    };
  }
  if (left === 0) {
    return { mode: 'urgent', hint: 'Сегодня последний день приёма коммерческих предложений.' };
  }

  const rest = `Осталось ${left} ${daysWord(left)}`;
  if (left <= URGENT_DAYS) {
    return { mode: 'urgent', hint: `${rest}. Приём коммерческих предложений скоро закроется.` };
  }
  return {
    mode: left <= SOON_DAYS ? 'soon' : 'calm',
    hint: `${rest} до конца приёма коммерческих предложений.`,
  };
}

export interface Filters {
  /** Четыре списка из окна «Фильтры» — мультивыбор: в реестре нормально
   *  смотреть два портфеля сразу, а одиночный выбор заставлял бы открывать
   *  меню столько раз, сколько значений нужно сравнить. */
  portfolio: string[];
  project: string[];
  kind: string[];
  owner: string[];
  statuses: StatusId[];
  /** Границы периода в формате <input type="date"> (ГГГГ-ММ-ДД), не ДД.ММ.ГГГГ. */
  from: string;
  to: string;
  q: string;
}

/** Ключи, которые живут в окне «Фильтры». Одним списком, чтобы окно, счётчик
 *  и сброс не разъехались: добавили колонку — правится одно место. */
const PANEL_KEYS = ['portfolio', 'project', 'kind', 'owner'] as const;
type PanelKey = (typeof PANEL_KEYS)[number];

const PANEL_TITLE: Record<PanelKey, string> = {
  portfolio: 'Портфель', project: 'Проект', kind: 'Вид работ', owner: 'Ответственный',
};

export const EMPTY_FILTERS: Filters = {
  portfolio: [], project: [], kind: [], owner: [], statuses: [], from: '', to: '', q: '',
};

/** Критерии окна «Фильтры» для универсального <FacetFilter>: значения
 *  выводятся ИЗ СТРОК, а не пишутся руками, поэтому в меню не может появиться
 *  пункт, который ничего не найдёт, и не может пропасть значение, которое в
 *  данных есть. */
export const FACETS: Facet[] = PANEL_KEYS.map((key) => ({
  key,
  title: PANEL_TITLE[key],
  options: [...new Set(ROWS.map((row) => row[key]))],
}));

/** Сколько групп окна «Фильтры» задействовано — цифра на кнопке. */
export function panelCount(f: Filters): number {
  return PANEL_KEYS.filter((key) => f[key].length > 0).length;
}

/** Сколько фильтров активно всего — цифра у «Сбросить всё». Период считается
 *  одним фильтром, даже если заполнены обе границы. */
export function activeCount(f: Filters): number {
  return panelCount(f)
    + (f.statuses.length ? 1 : 0)
    + (f.from || f.to ? 1 : 0)
    + (f.q.trim() ? 1 : 0);
}

/** Пересечение всех условий: пустой список фильтром не является.
 *
 *  ПЕРИОД ОТБИРАЕТ ПО ПЕРЕСЕЧЕНИЮ, а не по вложенности. Раньше условие было
 *  «начало ≥ от И окончание ≤ до», то есть тендер обязан был уложиться в окно
 *  ЦЕЛИКОМ. На данных, где тендер идёт месяцами, окно «последние 30 дней» не
 *  вмещало ни одного — и пустая таблица читалась как ограничение фильтра, хотя
 *  никакого ограничения нет. Спрашивают всегда «что шло в этот период», а это
 *  пересечение отрезков: тендер попадает в выборку, если он закончился не
 *  раньше начала окна и начался не позже его конца. */
export function applyFilters(rows: TenderRow[], f: Filters): TenderRow[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter((row) => (
    (!f.portfolio.length || f.portfolio.includes(row.portfolio))
    && (!f.project.length || f.project.includes(row.project))
    && (!f.kind.length || f.kind.includes(row.kind))
    && (!f.owner.length || f.owner.includes(row.owner))
    && (!f.statuses.length || f.statuses.includes(row.status))
    && (!f.from || dmyToIso(row.end) >= f.from)
    && (!f.to || dmyToIso(row.start) <= f.to)
    && (!q || `${row.id} ${row.title}`.toLowerCase().includes(q))
  ));
}
