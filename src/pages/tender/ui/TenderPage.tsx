import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Breadcrumbs } from '@/shared/ui/Breadcrumbs';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import {
  PageHeader, Screen, ScreenPlaceholder, SecondaryHeader, type SecondaryTab,
} from '@/shared/ui/Page';
import { MOCK_COMPARISON, tenderById } from '@/entities/tender';
import { TenderCompare } from './TenderCompare';
import { TenderSummary } from './TenderSummary';

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
 * A11Y:   <PageHeader breadcrumb> снимает свой левый инсет — крошки несут его
 *         сами, чтобы попасть в общую колонку контента (12px). Единственный
 *         <h1> страницы живёт в <TenderSummary>: в шапке экрана заголовка
 *         нет, там крошки.
 *
 * @example
 * <Route path="tenders/registry/:id" element={<TenderPage />} />
 */
export function TenderPage() {
  const { id } = useParams();
  const [tab, setTab] = useState(TABS[0].id);
  const tender = tenderById(id);

  if (!tender) return <Navigate to="/tenders/registry" replace />;

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
      <ScrollArea variant="page">
        <TenderSummary tender={tender} />
        <SecondaryHeader tabs={TABS} activeId={tab} onChange={setTab} variant="canvas" />
        {tab === 'compare' ? (
          /* Данные сравнения приходят СЮДА и уходят в раздел пропами: это
             единственное место, где сегодня стоит фикстура, и то же место,
             где завтра встанет запрос по tender.id. Сам <TenderCompare> о
             происхождении данных не знает — потому и переживёт подмену. */
          <TenderCompare {...MOCK_COMPARISON} />
        ) : (
          <ScreenPlaceholder icon="clipboardList">
            Раздел «{TABS.find((t) => t.id === tab)?.label}» ещё не реализован.
          </ScreenPlaceholder>
        )}
      </ScrollArea>
    </Screen>
  );
}
