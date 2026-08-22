import { ChipButton, Inline, Stack, Text } from 'clickup-shell';
/** Тёмная «таблетка» 28px — только для шапки СТРАНИЦЫ. */
export const Chip = () => (
  <Stack gap={3}>
    <Inline gap={2} align="center">
      <ChipButton>Создать тендер</ChipButton>
      <Text size="sm" tone="secondary">28px — число из эталона</Text>
    </Inline>
    <Text size="xs" tone="tertiary" leading="normal" style={{ maxWidth: 380 }}>
      На панельной шкале (32px) главное действие — это Button variant=&quot;primary&quot;.
      Слить их нельзя, не сдвинув пиксели: см. «Что осталось нерешённым».
    </Text>
  </Stack>
);
