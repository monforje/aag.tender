import { PageHeader, PageTitle, Screen, SecondaryHeader } from 'clickup-shell';
/** Полоса шапки страницы: заголовок на линии колонки контента. */
export const Simple = () => (
  <Screen><PageHeader><PageTitle>Реестр тендеров</PageTitle></PageHeader></Screen>
);
/** withSecondary снимает нижнюю границу — её берёт на себя таблист под шапкой. */
export const WithTabs = () => (
  <Screen>
    <PageHeader withSecondary><PageTitle>Реестр тендеров</PageTitle></PageHeader>
    <SecondaryHeader
      tabs={[{ id: 'a', label: 'Активные' }, { id: 'c', label: 'Закрытые' }, { id: 'd', label: 'Черновики' }]}
      activeId="a"
      onChange={() => {}}
    />
  </Screen>
);
