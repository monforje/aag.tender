import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Navigate, useParams } from 'react-router-dom';
import { Breadcrumbs } from '@/shared/ui/Breadcrumbs';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import {
  PageHeader, Screen, ScreenPlaceholder, SecondaryHeader, type SecondaryTab,
} from '@/shared/ui/Page';
import {
  applyTransition, MOCK_ROUND1, MOCK_ROUND2_FULL,
  MOCK_ROUND2_PARTIAL, PRESETS, SYSTEM_THRESHOLDS, tenderById,
  type AnalysisResult, type AnalysisTransition, type CompareThresholds,
  type CompareView, type PresetId,
} from '@/entities/tender';
import { useWorkspaceStore } from '@/entities/workspace';
import { AI_DOCK_ID, AiTrigger, AnalysisDock } from '@/features/ai-analysis';
import { RoundsPanel } from './RoundsPanel';
import { TenderCompare } from './TenderCompare';
import { TenderSummary } from './TenderSummary';
import s from './TenderPage.module.css';

/* Разделы карточки. Порядок — по ходу работы с тендером: сначала сравнивают
   поданное, потом отвечают на вопросы, потом смотрят сами КП; «Активность» —
   последняя, это журнал, а не рабочий экран. Вкладка — состояние страницы, не
   маршрута: адрес указывает на тендер, а не на его вкладку. */
const TABS: SecondaryTab[] = [
  { id: 'compare', label: 'Сравнение' },
  { id: 'questions', label: 'Уточнения' },
  { id: 'bids', label: 'КП' },
  { id: 'overview', label: 'Обзор' },
  { id: 'rounds', label: 'Раунды' },
  { id: 'documents', label: 'Документы' },
  { id: 'activity', label: 'Активность' },
];

/* ── ДЕМО-фикстуры раундов ──────────────────────────────────────────────────
   Три снимка одной истории (сцены 4 → 6 → 7). В проде здесь стоит запрос по
   tender.id и раунду; подмена — замена этой таблицы, экран о происхождении
   данных не знает. Ревизия растёт на каждой подаче — по ней панель понимает,
   что сохранённый разбор устарел (05 §8.2). */
const DATASETS = {
  r1: MOCK_ROUND1,
  r2Partial: MOCK_ROUND2_PARTIAL,
  r2Full: MOCK_ROUND2_FULL,
} as const;

type DatasetId = keyof typeof DATASETS;

const NEXT_DATASET: Partial<Record<DatasetId, DatasetId>> = {
  r1: 'r2Partial',
  r2Partial: 'r2Full',
};

/** Причина изменения данных — текст плашки устаревания (05 §8.2 называет её). */
const CHANGE_NOTE: Record<DatasetId, string> = {
  r1: 'Исходный сбор КП',
  r2Partial: 'ИнженерГрупп прислал КП второго круга',
  r2Full: 'СтройМонтаж прислал новое КП',
};

/**
 * Карточка тендера — экран за строкой реестра.
 *
 * КОГДА:  маршрут /tenders/registry/:id.
 * НЕ ДЛЯ: самого реестра (см. TenderRegistryPage) — других страниц раздела
 *         Тендеры сейчас нет.
 *
 * UX:     это третий уровень (раздел → реестр → тендер), поэтому в шапке
 *         крошки, а не просто заголовок: без пути назад экран становится
 *         тупиком — в дереве сайдбара карточки тендера нет и не будет, там
 *         только реестр. Крошки рабочие: «Реестр тендеров» ведёт на список,
 *         номер тендера — текущий сегмент и не ссылка. В крошке стоит ТОЛЬКО
 *         номер: она отвечает на вопрос «где я», а не «что это», и название
 *         тендера в ней распирало полосу, повторяя заголовок ниже.
 *         Первым блоком идёт <TenderSummary> — сводка, по которой тендер
 *         опознают; под ней вкладки разделов карточки. Сводка стоит НАД
 *         вкладками и в них не входит: она отвечает на вопрос «что открыто»
 *         и нужна в любом разделе, а вкладка переключает только то, что под
 *         ней. Вкладки — <SecondaryHeader variant="canvas">, тот же таблист,
 *         что в реестре, а не его копия: здесь он на холсте и крупнее, потому
 *         что переключает разделы экрана, а не срез списка.
 *         Сделан пока один раздел — «Сравнение» (<TenderCompare>); у
 *         остальных заглушка говорит это прямо, называя выбранный раздел:
 *         пустая вкладка молча — хуже.
 *         Неизвестный номер уводит обратно в реестр, а не показывает пустую
 *         карточку: адрес с чужим id — это опечатка или мёртвая ссылка.
 *         Чат «Анализ ИИ» живёт на каркасе, а не в потоке страницы: бирка-
 *         триггер приклеена под нижней линией .main-header (полосы крошек),
 *         панель выезжает из-под неё справа ровно по этой полосе — линия её
 *         шапки и шапки страницы одна; после раскрытия бирка морфируется в
 *         вертикальный язычок на краю панели (он же закрывает), а внутри
 *         панели остаётся и крестик «Скрыть».
 *
 *         СОСТОЯНИЕ СРАВНЕНИЯ И ЧАТА «АНАЛИЗ ИИ» ЖИВЁТ ЗДЕСЬ, на странице:
 *         им делятся два потребителя — таблица (пресеты, ★) и док (ответы
 *         про пару читают ★, действие в ответе ведёт к строке). Ниже
 *         компонентов такое общее состояние не поднять без событий вверх;
 *         выше — не нужно. URL это состояние не ловит намеренно: мебель
 *         страницы, как вкладки и фильтры реестра. История чата переживает
 *         переключение вкладок (док смонтирован всегда) и умирает с уходом
 *         на другой тендер — осознанный долг уровня «фильтры не сохраняются».
 *
 * A11Y:   <PageHeader breadcrumb> снимает свой левый инсет — крошки несут его
 *         сами, чтобы попасть в общую колонку контента (12px). Единственный
 *         <h1> страницы живёт в <TenderSummary>: в шапке экрана заголовка
 *         нет, там крошки. Закрытие дока возвращает фокус на бейдж сам
 *         триггер (preventScroll) — страница при этом не прокручивается.
 *
 * @example
 * <Route path="tenders/registry/:id" element={<TenderPage />} />
 */
export function TenderPage() {
  const { id } = useParams();
  const [tab, setTab] = useState(TABS[0].id);
  const tender = tenderById(id);

  /* Срез сравнения, ★ и подсветка — общий слой таблицы и дока. */
  const [view, setView] = useState<CompareView>({ preset: 'overview', ...PRESETS.overview });
  /* Пороги аналитики — НАСТРОЙКИ ТЕНДЕРА (не константы кода): системный старт,
     правятся в окне `⚙` на полосе сравнения. Живут рядом со срезом — URL их
     не ловит по той же причине, что и фильтры реестра. */
  const [thresholds, setThresholds] = useState<CompareThresholds>(SYSTEM_THRESHOLDS);
  const [starred, setStarred] = useState<string[]>([]);
  const [focusRowId, setFocusRowId] = useState<string | null>(null);
  /* Открытость панели — состояние КАРКАСА (колонка рядом с main), не страницы:
     колонку рисует Workspace, а связку с сайдбаром держит сам стор
     (openAiPanel закрывает его навсегда). Уход со страницы гасит флаг
     cleanup'ом ниже, иначе реестр получил бы пустую раскрытую колонку. */
  const aiOpen = useWorkspaceStore((st) => st.aiPanelOpen);
  useEffect(() => () => useWorkspaceStore.getState().closeAiPanel(), []);

  /* Узел слота каркаса для портала: aside монтируется вместе с приложением,
     но на первом кадре страницы его ещё можно не найти в document — ждём
     эффектом и рендерим содержимое, как только слот появился. */
  const [slotNode, setSlotNode] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSlotNode(document.getElementById('ai-panel-slot'));
  }, []);
  /* Липкая шапка сравнения стоит на верхней линии (прочитано из
     <TenderCompare>) — в этот момент она делит полосу с биркой «Анализ ИИ»,
     и та складывается до иконки. */
  const [headStuck, setHeadStuck] = useState(false);

  /* ── данные раундов и ревизия ── */
  const [datasetId, setDatasetId] = useState<DatasetId>('r1');
  const dataset = DATASETS[datasetId];
  const prevDataset = datasetId === 'r1' ? undefined : DATASETS.r1;

  /* ── переход «анализ → таблица» (05 §7) ──
     До первого применения запоминается ПОЛНЫЙ пользовательский вид; возврат —
     по явному чипу «Вернуть мой вид». Подсветка ячеек живёт ~5 секунд и
     гаснет сама; вид при этом не откатывается. */
  const savedView = useRef<CompareView | null>(null);
  const [analysisApplied, setAnalysisApplied] = useState(false);
  /* Комментарии последнего разбора — для попапов ячеек (слой 6): до запуска
     их нет, попапы показывают одни числа. */
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [flash, setFlash] = useState<{
    cells: Set<string>;
    cols: Set<string>;
    rowId: string | null;
  } | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  const handleTransition = (transition: AnalysisTransition) => {
    if (!analysisApplied) savedView.current = view;
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
    flashTimer.current = window.setTimeout(() => setFlash(null), 5300);
  };

  const restoreView = () => {
    if (savedView.current) setView(savedView.current);
    savedView.current = null;
    setAnalysisApplied(false);
    setFlash(null);
  };

  /* Ручное движение по осям возвращает управление пользователю: чип анализа
     уступает место обычному состоянию вида. Сам вид не трогается. */
  const handleManualPreset = (preset: PresetId) => {
    setAnalysisApplied(false);
    applyPreset(preset);
  };
  const handleManualPatch = (patch: Partial<Omit<CompareView, 'preset'>>) => {
    setAnalysisApplied(false);
    patchView(patch);
  };

  /* ДЕМО: подача КП следующим молчащим контрагентом — данные меняются,
     сохранённый разбор становится устаревшим с названной причиной. */
  const simulateSubmission = () => {
    const next = NEXT_DATASET[datasetId];
    if (!next) return;
    setDatasetId(next);
  };

  if (!tender) return <Navigate to="/tenders/registry" replace />;

  const applyPreset = (preset: PresetId) => setView({ preset, ...PRESETS[preset] });
  const patchView = (patch: Partial<Omit<CompareView, 'preset'>>) =>
    setView((prev) => ({ ...prev, ...patch }));
  const toggleStar = (contractorId: string) =>
    setStarred((list) => (
      list.includes(contractorId)
        ? list.filter((x) => x !== contractorId)
        : [...list, contractorId]
    ));
  /* Закрытие только гасит панель: сайдбар стор не возвращает (контракт
     «открыл анализ — сайдбар закрылся»). Фокус на бейдж возвращает САМ
     триггер (preventScroll), поэтому закрытие не прокручивает страницу. */
  const closeAi = () => useWorkspaceStore.getState().closeAiPanel();

  return (
    <Screen>
      <PageHeader breadcrumb>
        {/* Только НОМЕР. Крошка — адрес, а не заголовок: длинное название
            распирало полосу и повторяло то, что и так стоит на экране ниже. */}
        <Breadcrumbs
          links={[{ title: 'Реестр тендеров', to: '/tenders/registry' }]}
          current={tender.id}
        />
      </PageHeader>
      {/* Горизонталь страницы и нулевой паддинг сверху: липкой шапке
          сравнения нужен скроллблок СТРАНИЦЫ без прокручиваемых посредников
          и без своей полосы над линией (см. .module.css). */}
      <ScrollArea variant="page" className={s.scroll}>
        <TenderSummary tender={tender} />
        <SecondaryHeader tabs={TABS} activeId={tab} onChange={setTab} variant="canvas" />
        {tab === 'compare' ? (
          /* Данные сравнения приходят СЮДА и уходят в раздел пропами: это
             единственное место, где сегодня стоит фикстура, и то же место,
             где завтра встанет запрос по tender.id. Сам <TenderCompare> о
             происхождении данных не знает — потому и переживёт подмену. */
          <TenderCompare
            {...dataset}
            view={view}
            onPreset={handleManualPreset}
            onPatch={handleManualPatch}
            thresholds={thresholds}
            onThresholds={setThresholds}
            starred={starred}
            onToggleStar={toggleStar}
            focusRowId={focusRowId ?? flash?.rowId ?? null}
            onFocusClear={() => setFocusRowId(null)}
            noteFor={(contractorId, positionId) => analysisResult?.popupNotes[`${contractorId}:${positionId}`]}
            flashCells={flash?.cells}
            flashCols={flash?.cols}
            analysisApplied={analysisApplied}
            onRestoreView={restoreView}
            /* Липкая шапка встала на линию — бирка «Анализ ИИ» складывается
               до иконки (см. compact у <AiTrigger> ниже). */
            onHeadStuckChange={setHeadStuck}
          />
        ) : tab === 'rounds' ? (
          <RoundsPanel comparison={dataset} onSimulateSubmission={simulateSubmission} />
        ) : (
          <ScreenPlaceholder icon="clipboardList">
            Раздел «{TABS.find((t) => t.id === tab)?.label}» ещё не реализован.
          </ScreenPlaceholder>
        )}
      </ScrollArea>

      {/* Триггер — вне портала и вне ScrollArea: fixed-бирка на каркасе.
          Координаты и оба состояния якоря (у правого края карточки / на стыке
          с панелью) компонент держит сам — см. AiTrigger.module.css; страница
          больше не знает, где он висит. Панель выезжает из-под неё; после
          полной остановки колонки бирка морфирует в вертикальный язычок, а
          когда липкая шапка таблицы встаёт на её линию — складывается до
          иконки (compact, только в закрытом состоянии). */}
      <AiTrigger
        open={aiOpen}
        compact={headStuck && !aiOpen}
        controlsId={AI_DOCK_ID}
        onToggle={() => (aiOpen
          ? useWorkspaceStore.getState().closeAiPanel()
          : useWorkspaceStore.getState().openAiPanel())}
      />
      {/* Панель живёт в слоте каркаса (Workspace → #ai-panel-slot) третьей
          колонкой ряда: main сжимается флексом сам, история чата и сохранённые
          разборы раундов переживают открытие/закрытие — панель не
          размонтируется, открытость гасят классы слота. */}
      {slotNode ? createPortal(
        <AnalysisDock
          open={aiOpen}
          onClose={closeAi}
          comparison={dataset}
          prevComparison={prevDataset}
          thresholds={thresholds}
          rev={datasetId}
          revNote={CHANGE_NOTE[datasetId]}
          onTransition={handleTransition}
          onResultChange={setAnalysisResult}
        />,
        slotNode,
      ) : null}
    </Screen>
  );
}
