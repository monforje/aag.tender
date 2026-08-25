/** РАБОЧИЙ КОНТЕКСТ СРАВНЕНИЯ ↔ URL (`state.md` §1, реестр §3.5).
 *
 *  Зачем вообще: «передать коллеге разрешённую ссылку на тот же срез» —
 *  заявленная цель продукта. Без сериализации совместная работа над срезом
 *  невозможна в принципе: человек описывает словами, что включить, а второй
 *  собирает это руками и получает похожий, но другой экран.
 *
 *  ПИШЕТСЯ ТОЛЬКО ОТЛИЧИЕ ОТ ПРЕСЕТА. Пресет присваивает оси целиком, значит
 *  он и есть база; «Обзор» без правок даёт `?p=overview` и всё. Полная запись
 *  всех шести осей дала бы ссылку, которая ломается при первой же правке
 *  дефолта пресета: коллега открыл бы старую нарезку, думая, что смотрит
 *  свежий «Обзор».
 *
 *  СТАВКА ЗА ЕДИНИЦУ В URL НЕ ВХОДИТ — сознательно (`state.md` §1). Это личная
 *  привычка чтения, а не срез данных: она живёт между сессиями у КАЖДОГО
 *  своя, и навязывать её по ссылке значит менять чужой экран без спроса.
 *
 *  МУСОР В АДРЕСЕ НЕ РОНЯЕТ ЭКРАН. Ссылка живёт в почте и в чате, её правят
 *  руками и режут переносом строки; неизвестный пресет, чужой фильтр и
 *  `dev=да` обязаны дать дефолт, а не пустую страницу. */

import { sanitizeFilters, type PredicateId } from './filters';
import {
  PRESETS, type CompareMetricId, type CompareView, type PresetId, type RowViewId,
} from './view';

/* Ключи короткие и стабильные: они попадают в чужую переписку, и переименовать
   их потом уже нельзя — старые ссылки перестанут воспроизводить вид молча. */
const KEY = {
  preset: 'p', metric: 'm', deviation: 'dev', dynamics: 'dyn',
  potential: 'pot', sort: 'sort', filters: 'f',
} as const;

const PRESET_IDS = Object.keys(PRESETS) as PresetId[];
const METRIC_IDS: CompareMetricId[] = ['cost', 'potential'];
const SORT_IDS: RowViewId[] = ['sections', 'weight', 'potential', 'spread'];

const oneOf = <T extends string>(raw: string | null, allowed: T[]): T | null =>
  (raw !== null && (allowed as string[]).includes(raw) ? raw as T : null);

/** Флаг из адреса. Строго «1»/«0» — всё прочее ЗНАЧЕНИЕМ НЕ СЧИТАЕТСЯ и
 *  возвращает null, то есть «бери из пресета». Мягкий разбор («true», «да»,
 *  непустая строка) молча превращал бы опечатку в включённую ось. */
const flag = (raw: string | null): boolean | null =>
  (raw === '1' ? true : raw === '0' ? false : null);

/** Вид → строка запроса БЕЗ ведущего «?». Порядок ключей фиксирован: две
 *  одинаковые нарезки обязаны давать посимвольно одинаковую ссылку, иначе
 *  «это та же ссылка?» становится вопросом без ответа. */
export function serializeView(view: CompareView): string {
  const base = PRESETS[view.preset];
  const out = new URLSearchParams();
  out.set(KEY.preset, view.preset);
  if (view.mainMetric !== base.mainMetric) out.set(KEY.metric, view.mainMetric);
  if (view.showDeviation !== base.showDeviation) out.set(KEY.deviation, view.showDeviation ? '1' : '0');
  if (view.showDynamics !== base.showDynamics) out.set(KEY.dynamics, view.showDynamics ? '1' : '0');
  if (view.showPotential !== base.showPotential) out.set(KEY.potential, view.showPotential ? '1' : '0');
  if (view.rowView !== base.rowView) out.set(KEY.sort, view.rowView);
  if (!sameFilters(view.filters, base.filters)) {
    /* Пустой набор — ЗНАЧИМОЕ состояние («фильтры сняты руками»), и записать
       его нужно явно: отсутствие ключа означает «как в пресете», а у
       «Аномалий» это один активный фильтр, а не ноль. */
    out.set(KEY.filters, view.filters.join(','));
  }
  return out.toString();
}

/** Строка запроса → вид. `showRate` берётся из `base`: в адресе его нет и не
 *  будет, а вернуть неполный вид нельзя — потребитель ждёт `CompareView`
 *  целиком. */
export function parseView(search: string, base: { showRate: boolean }): CompareView {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const preset = oneOf(q.get(KEY.preset), PRESET_IDS) ?? 'overview';
  const defaults = PRESETS[preset];

  const rawFilters = q.get(KEY.filters);
  const filters: PredicateId[] = rawFilters === null
    ? [...defaults.filters]
    /* `''.split(',')` даёт `['']`, а не пусто — отсюда фильтр по длине:
       без него пустой ключ приезжал бы одним фильтром-призраком, который
       не проходит sanitize и оставляет «Фильтры: 0» на полосе. */
    : sanitizeFilters(rawFilters.split(',').filter(Boolean));

  return {
    preset,
    mainMetric: oneOf(q.get(KEY.metric), METRIC_IDS) ?? defaults.mainMetric,
    showDeviation: flag(q.get(KEY.deviation)) ?? defaults.showDeviation,
    showDynamics: flag(q.get(KEY.dynamics)) ?? defaults.showDynamics,
    showPotential: flag(q.get(KEY.potential)) ?? defaults.showPotential,
    showRate: base.showRate,
    rowView: oneOf(q.get(KEY.sort), SORT_IDS) ?? defaults.rowView,
    filters,
  };
}

/** Есть ли в адресе хоть одна ось сравнения. Нужен странице: адрес БЕЗ них —
 *  это обычный вход на тендер, и подменять его дефолтом «Обзора» через
 *  историю браузера не нужно; адрес С ними — ссылка коллеги, и её вид
 *  обязан примениться. */
export const hasViewParams = (search: string): boolean => {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return Object.values(KEY).some((k) => q.has(k));
};

const sameFilters = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((x) => b.includes(x));
