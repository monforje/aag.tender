import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Breadcrumbs } from '@/shared/ui/Breadcrumbs';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import {
  PageHeader, Screen, ScreenPlaceholder, SecondaryHeader, type SecondaryTab,
} from '@/shared/ui/Page';
import {
  MOCK_COMPARISON, PRESETS, tenderById,
  type CompareView, type PresetId,
} from '@/entities/tender';
import { AiDock, AI_DOCK_ID, AiTrigger } from '@/features/ai-analysis';
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
 *         панель выезжает справа ровно по этой полосе — линия её шапки и
 *         шапки страницы одна; пока чат открыт, бирка спрятана, а закрыть
 *         его можно крестиком «Скрыть» в шапке панели.
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

  /* Срез сравнения, ★ и подсвеченная строка — общий слой таблицы и дока.
     aiThinking — «генерирует», прочитанное из дока наружу: триггер ускоряет
     шиммер, пока чат отвечает. */
  const [view, setView] = useState<CompareView>({ preset: 'overview', ...PRESETS.overview });
  const [starred, setStarred] = useState<string[]>([]);
  const [focusRowId, setFocusRowId] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  /* Липкая шапка сравнения стоит на верхней линии (прочитано из
     <TenderCompare>) — в этот момент она делит полосу с биркой «Анализ ИИ»,
     и та складывается до иконки. */
  const [headStuck, setHeadStuck] = useState(false);

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
  /* Закрытие только гасит панель: фокус на бейдж возвращает САМ триггер
     (preventScroll), поэтому закрытие не прокручивает страницу. */
  const closeAi = () => setAiOpen(false);

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
            {...MOCK_COMPARISON}
            view={view}
            onPreset={applyPreset}
            onPatch={patchView}
            starred={starred}
            onToggleStar={toggleStar}
            focusRowId={focusRowId}
            onFocusClear={() => setFocusRowId(null)}
            /* Липкая шапка встала на линию — бирка «Анализ ИИ» складывается
               до иконки (см. compact у <AiTrigger> ниже). */
            onHeadStuckChange={setHeadStuck}
          />
        ) : (
          <ScreenPlaceholder icon="clipboardList">
            Раздел «{TABS.find((t) => t.id === tab)?.label}» ещё не реализован.
          </ScreenPlaceholder>
        )}
      </ScrollArea>

      {/* Триггер и док — вне <ScrollArea>: оба fixed, отсчёт ведут от каркаса,
          прокрутка страницы на них не влияют. Бирка «Анализ ИИ» приклеена под
          нижней линией .main-header (координаты — .aiTrigger в .module.css):
          пока чат открыт — спрятана, а когда липкая шапка таблицы встаёт на
          ту же линию — складывается до иконки (compact). Сам док смонтирован
          всегда — история чата живёт, пока живёт страница тендера. */}
      <AiTrigger
        open={aiOpen}
        thinking={aiThinking}
        compact={headStuck && !aiOpen}
        controlsId={AI_DOCK_ID}
        onToggle={() => setAiOpen((v) => !v)}
        className={s.aiTrigger}
      />
      <AiDock
        open={aiOpen}
        onClose={closeAi}
        comparison={MOCK_COMPARISON}
        starred={starred}
        onFocusRow={setFocusRowId}
        onThinkingChange={setAiThinking}
      />
    </Screen>
  );
}
