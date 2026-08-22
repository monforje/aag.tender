import { ChipButton, PageActions, PageHeader, PageTitle, Screen } from 'clickup-shell';
/** Правый слот шапки: главное действие экрана «таблеткой» 28px. */
export const WithChip = () => (
  <Screen>
    <PageHeader>
      <PageTitle>Реестр тендеров</PageTitle>
      <PageActions><ChipButton>Создать тендер</ChipButton></PageActions>
    </PageHeader>
  </Screen>
);
