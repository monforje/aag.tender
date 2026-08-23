import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Navigate, useParams } from 'react-router-dom';
import { Breadcrumbs } from '@/shared/ui/Breadcrumbs';
import { ErrorState } from '@/shared/ui/ErrorState';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import { Skeleton } from '@/shared/ui/Skeleton';
import {
  PageHeader, Screen, ScreenPlaceholder, SecondaryHeader, type SecondaryTab,
} from '@/shared/ui/Page';
import { fetchTender } from '@/entities/tender';
import { useWorkspaceStore } from '@/entities/workspace';
import { AI_DOCK_ID, AiTrigger, AnalysisDock } from '@/features/ai-analysis';
import { useAsync } from '@/shared/lib/useAsync';
import { useComparisonData } from '../model/useComparisonData';
import { useCompareScreen } from '../model/useCompareScreen';
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

  /* Тендер и его сравнение — два разных запроса: шапка карточки живёт без
     сравнения (вкладок семь, сравнение — одна), и ждать одно ради другого
     незачем. */
  const tenderQuery = useAsync(() => fetchTender(id), [id]);
  const tender = tenderQuery.data;
  const data = useComparisonData(id ?? '');

  /* Срез сравнения, ★ и переход из разбора — общий слой таблицы и дока. */
  const screen = useCompareScreen();

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

  /* Проверки стоят ПОСЛЕ всех хуков: ранний возврат выше менял бы их число
     между рендерами. */
  if (tenderQuery.loading) {
    return (
      <Screen>
        <PageHeader breadcrumb><Skeleton width={220} /></PageHeader>
        <ScrollArea variant="page" className={s.scroll}>
          <div className={s.loading}>
            <Skeleton height={22} width="40%" />
            <Skeleton height={14} width="65%" />
            <Skeleton height={38} radius={6} />
          </div>
        </ScrollArea>
      </Screen>
    );
  }
  /* Неизвестный номер уводит в реестр — это опечатка или мёртвая ссылка, а не
     пустая карточка. СБОЙ ЗАПРОСА — другое дело: тендер, может, и есть,
     поэтому здесь предложение повторить, а не молчаливый увод. */
  if (tenderQuery.error) {
    return (
      <Screen>
        <PageHeader breadcrumb>
          <Breadcrumbs links={[{ title: 'Реестр тендеров', to: '/tenders/registry' }]} current={id ?? ''} />
        </PageHeader>
        <ErrorState
          title="Тендер не загрузился"
          description="Данные карточки не пришли. Реестр при этом работает."
          onRetry={tenderQuery.reload}
        />
      </Screen>
    );
  }
  if (!tender) return <Navigate to="/tenders/registry" replace />;

  /* Закрытие только гасит панель: сайдбар стор не возвращает (контракт
     «открыл анализ — сайдбар закрылся»). Фокус на бейдж возвращает САМ
     триггер (preventScroll), поэтому закрытие не прокручивает страницу. */
  const closeAi = () => useWorkspaceStore.getState().closeAiPanel();

  /* Сравнение и его состояния — одним блоком: раздел «Сравнение» и панель
     разбора читают ОДИН снимок, и расходиться им нельзя. */
  const compare = data.loading ? (
    <div className={s.loading}>
      <Skeleton height={38} radius={6} />
      <Skeleton height={200} radius={6} />
    </div>
  ) : data.error ? (
    <ErrorState
      title="Сравнение не загрузилось"
      description="Остальные разделы карточки работают."
      onRetry={data.reload}
    />
  ) : !data.comparison ? (
    <ScreenPlaceholder icon="billList">
      По этому тендеру сравнения ещё нет.
    </ScreenPlaceholder>
  ) : (
    /* Данные уходят в раздел ПРОПАМИ: <TenderCompare> о происхождении не
       знает — потому и переживёт подмену мока запросом. */
    <TenderCompare
      {...data.comparison}
      view={screen.view}
      onPreset={screen.selectPreset}
      onPatch={screen.patchView}
      thresholds={screen.thresholds}
      onThresholds={screen.setThresholds}
      starred={screen.starred}
      onToggleStar={screen.toggleStar}
      focusRowId={screen.focusRowId}
      onFocusClear={screen.clearFocus}
      noteFor={screen.noteFor}
      flashCells={screen.flash?.cells}
      flashCols={screen.flash?.cols}
      analysisApplied={screen.analysisApplied}
      onRestoreView={screen.restoreView}
      /* Липкая шапка встала на линию — бирка «Анализ ИИ» складывается
         до иконки (см. compact у <AiTrigger> ниже). */
      onHeadStuckChange={setHeadStuck}
    />
  );

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
        {tab === 'compare' ? compare
          : tab === 'rounds' && data.comparison ? (
            <RoundsPanel comparison={data.comparison} onSimulateSubmission={data.submitNext} />
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
          размонтируется, открытость гасят классы слота.
          БЕЗ ДАННЫХ ПАНЕЛИ НЕЧЕГО РАЗБИРАТЬ — до их прихода она не монтируется
          вовсе: пустой разбор пришлось бы объяснять отдельным состоянием. */}
      {slotNode && data.comparison ? createPortal(
        <AnalysisDock
          open={aiOpen}
          onClose={closeAi}
          comparison={data.comparison}
          prevComparison={data.prevComparison}
          thresholds={screen.thresholds}
          onTransition={screen.applyAnalysis}
          onResultChange={screen.setAnalysisResult}
        />,
        slotNode,
      ) : null}
    </Screen>
  );
}
