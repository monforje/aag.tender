import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  applyTransition, hasViewParams, parseView, PRESETS, serializeView, SYSTEM_THRESHOLDS,
  type CompareThresholds, type CompareView, type PresetId,
} from '@/entities/comparison';
import type { AnalysisResult, AnalysisTransition } from '@/features/ai-analysis';

/** Как долго держится обводка перехода «анализ → таблица», мс. Чуть больше
 *  пяти секунд из 05 §7: подсветке нужно время дожить до конца доскролла. */
const FLASH_MS = 5300;

/** Обводка перехода: ячейки парой «подрядчик × позиция», колонки — когда
 *  назван только подрядчик, и строка, к которой доскроллит таблица. */
export interface CompareFlash {
  cells: Set<string>;
  cols: Set<string>;
  rowId: string | null;
}

/**
 * Состояние экрана сравнения: срез, пороги, ★ и переход из разбора.
 *
 * КОГДА:  карточка тендера — им делятся ДВОЕ, таблица и панель «Анализ ИИ»
 *         (сценарий просит пресет, карточка ведёт к строке). Ниже компонентов
 *         такое общее состояние не поднять без событий вверх; выше — не нужно.
 * НЕ ДЛЯ: данных сравнения (см. useComparisonData) — здесь только то, КАК на
 *         них смотрят; и не для состояния каркаса (открытость панели живёт в
 *         сторе, это колонка рядом с main, а не мебель страницы).
 *
 * UX:     ПЕРЕХОД ИЗ РАЗБОРА ЗАПОМИНАЕТ ПОЛНЫЙ ПОЛЬЗОВАТЕЛЬСКИЙ ВИД — один
 *         раз, до ПЕРВОГО применения: серия кликов по словам-сущностям не
 *         должна затирать точку возврата собственным промежуточным видом.
 *         Возврат — по явному чипу «Вернуть мой вид», а не по таймеру:
 *         подсветка гаснет сама через ~5 с, вид при этом не откатывается.
 *         РУЧНОЕ ДВИЖЕНИЕ ПО ЛЮБОЙ ОСИ возвращает управление пользователю —
 *         чип анализа уступает место обычному «Изменён · Сброс». Сам вид при
 *         этом не трогается: человек уже смотрит туда, куда хотел.
 *
 *         РАБОЧИЙ КОНТЕКСТ ЖИВЁТ В URL (§3.5, `state.md` §1) — с 25.08.2026.
 *         «Передать коллеге разрешённую ссылку на тот же срез» это заявленная
 *         цель продукта, и без сериализации совместная работа над срезом
 *         невозможна: один описывает словами, что включить, второй собирает
 *         это руками и получает похожий, но другой экран.
 *         ПИШЕТСЯ ТОЛЬКО ОТЛИЧИЕ ОТ ПРЕСЕТА (кодек — `viewUrl.ts`), и запись
 *         идёт `replace`, а не `push`: каждое движение галочки — не шаг
 *         истории, иначе кнопка «Назад» превращалась бы в машину отмены
 *         кликов вместо возврата на реестр.
 *         СТАВКА В URL НЕ ВХОДИТ: личная привычка чтения, а не срез данных —
 *         навязывать её по ссылке значит менять чужой экран без спроса.
 *         Пороги аналитики тоже не входят: они принадлежат ТЕНДЕРУ и придут к
 *         коллеге сами, вместе с данными.
 *
 * @example
 * const screen = useCompareScreen();
 * <TenderCompare view={screen.view} onPreset={screen.selectPreset} … />
 */
export function useCompareScreen() {
  const [params, setParams] = useSearchParams();
  /* Ставка читается ИЗ ВИДА, а не из адреса, и на первом кадре её ещё нет —
     дефолт пресета. Отдельного состояния под неё не нужно: она такая же ось
     `CompareView`, просто не сериализуемая. */
  const [view, setView] = useState<CompareView>(() => (
    hasViewParams(params.toString())
      ? parseView(params.toString(), { showRate: PRESETS.overview.showRate })
      : { preset: 'overview', ...PRESETS.overview }
  ));

  /* ВИД → АДРЕС. Одно место записи, как и у `activeId` раздела: второй
     писатель развёл бы адрес с экраном молча. Сравнение со строкой перед
     записью обязательно — без него setParams на каждом рендере крутил бы
     роутер в петле. */
  useEffect(() => {
    const next = serializeView(view);
    if (next === params.toString()) return;
    setParams(new URLSearchParams(next), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setParams стабилен, params читается для сравнения
  }, [view]);
  /* Пороги аналитики — НАСТРОЙКИ ТЕНДЕРА (не константы кода): системный старт,
     правятся в окне `⚙` на полосе сравнения. Живут рядом со срезом — URL их
     не ловит по той же причине, что и фильтры реестра. */
  const [thresholds, setThresholds] = useState<CompareThresholds>(SYSTEM_THRESHOLDS);
  const [starred, setStarred] = useState<string[]>([]);
  const [focusRowId, setFocusRowId] = useState<string | null>(null);

  /* Комментарии последнего разбора — для попапов ячеек (слой 6): до запуска
     их нет, попапы показывают одни числа. */
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisApplied, setAnalysisApplied] = useState(false);
  const savedView = useRef<CompareView | null>(null);

  const [flash, setFlash] = useState<CompareFlash | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  const selectPreset = (preset: PresetId) => {
    setAnalysisApplied(false);
    setView({ preset, ...PRESETS[preset] });
  };

  const patchView = (patch: Partial<Omit<CompareView, 'preset'>>) => {
    setAnalysisApplied(false);
    setView((prev) => ({ ...prev, ...patch }));
  };

  const toggleStar = (contractorId: string) =>
    setStarred((list) => (
      list.includes(contractorId)
        ? list.filter((x) => x !== contractorId)
        : [...list, contractorId]
    ));

  /* Свежие значения перехода — через ref: колбэк обязан быть СТАБИЛЬНЫМ,
     иначе memo-пункты панели «Анализ ИИ» перерисовывались бы на каждом
     движении страницы (звезда, порог, фокус), ничего не изменив в себе. */
  const viewRef = useRef(view);
  viewRef.current = view;
  const appliedRef = useRef(analysisApplied);
  appliedRef.current = analysisApplied;

  const applyAnalysis = useCallback((transition: AnalysisTransition) => {
    if (!appliedRef.current) savedView.current = viewRef.current;
    setAnalysisApplied(true);
    setView((current) => applyTransition(current, transition));

    const focus = transition.focus ?? {};
    const cells = new Set<string>();
    const cols = new Set<string>();
    if (focus.positionId && focus.contractorId) {
      cells.add(`${focus.contractorId}:${focus.positionId}`);
    } else if (focus.contractorId) {
      cols.add(focus.contractorId);
    }
    setFlash({ cells, cols, rowId: focus.positionId ?? null });
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), FLASH_MS);
  }, []);

  /* Колбэк уходит пропом в КАЖДУЮ строку таблицы, и пересоздание на рендере
     отменяло бы memo у <CompareRow>: строки перерисовывались бы от любого
     чужого движения (ширина ленты, звезда, фокус).
     Зависимость — САМ РАЗБОР, а не пустой список и не реф. Через реф колбэк
     был бы стабилен ВСЕГДА, и в этом ловушка: комментарий читается в момент
     ОТРИСОВКИ ячейки, а не в момент попапа, так что после прихода разбора
     memo-строки остались бы со старым (пустым) комментарием до первого
     постороннего повода перерисоваться. Разбор приходит раз в сеанс —
     стабильности это не мешает. */
  const noteFor = useCallback(
    (contractorId: string, positionId: string): string | undefined =>
      analysisResult?.popupNotes[`${contractorId}:${positionId}`],
    [analysisResult],
  );

  const restoreView = () => {
    if (savedView.current) setView(savedView.current);
    savedView.current = null;
    setAnalysisApplied(false);
    setFlash(null);
  };

  return {
    view, selectPreset, patchView,
    thresholds, setThresholds,
    starred, toggleStar,
    /* Подсветка строки: своя (клик по карточке) или пришедшая с переходом. */
    focusRowId: focusRowId ?? flash?.rowId ?? null,
    clearFocus: () => setFocusRowId(null),
    flash,
    analysisApplied, applyAnalysis, restoreView,
    analysisResult, setAnalysisResult,
    /** Комментарий разбора к ячейке или ничего — до запуска пусто у всех. */
    noteFor,
  };
}
