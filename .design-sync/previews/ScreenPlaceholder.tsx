import { PageHeader, PageTitle, Screen, ScreenPlaceholder } from 'clickup-shell';
/** Экран целиком ещё не сделан — честная заглушка, а не пустой холст. */
export const NotBuilt = () => (
  <Screen>
    <PageHeader><PageTitle>Справочники</PageTitle></PageHeader>
    <ScreenPlaceholder icon="book2">Раздел появится вместе со следующим релизом.</ScreenPlaceholder>
  </Screen>
);
/** Другой раздел — тот же приём, свой глиф. */
export const Admin = () => (
  <Screen>
    <PageHeader><PageTitle>Администрирование</PageTitle></PageHeader>
    <ScreenPlaceholder icon="settings">Права и роли настраиваются пока на стороне бэкенда.</ScreenPlaceholder>
  </Screen>
);
