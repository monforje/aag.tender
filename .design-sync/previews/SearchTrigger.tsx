import { Stack, SearchTrigger, Text } from 'clickup-shell';
/** Белая капсула топбара: поиск по всему пространству, выдаче нужен экран. */
export const InTopbar = () => (
  <Stack gap={3} style={{ width: 420 }}>
    <SearchTrigger placeholder="Поиск" hotkey="Ctrl K" />
    <Text size="xs" tone="tertiary" leading="normal">
      Сужение уже показанного списка — это SearchInput. Здесь другой смысл:
      кнопка открывает модалку поиска по всему пространству.
    </Text>
  </Stack>
);
