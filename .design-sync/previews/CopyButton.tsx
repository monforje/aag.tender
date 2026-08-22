import { CopyButton, Inline, NumericText, Stack, Text } from 'clickup-shell';
/** Копия значения в буфер: галочка на полторы секунды вместо тоста. */
export const NextToValue = () => (
  <Stack gap={3}>
    <Inline gap={2} align="center">
      <Text size="sm" tone="secondary" style={{ width: 60 }}>ИНН</Text>
      <NumericText>7728168971</NumericText>
      <CopyButton value="7728168971" label="Скопировать ИНН" />
    </Inline>
    <Inline gap={2} align="center">
      <Text size="sm" tone="secondary" style={{ width: 60 }}>Номер</Text>
      <Text>T-2026-014</Text>
      <CopyButton value="T-2026-014" label="Скопировать номер тендера" />
    </Inline>
  </Stack>
);
