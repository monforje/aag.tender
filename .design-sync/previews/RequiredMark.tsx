import { Field, Input, RequiredMark, Stack, Text } from 'clickup-shell';
/** Звёздочка обязательности живёт ВНУТРИ Field — сама по себе не ставится. */
export const InField = () => (
  <Stack gap={4} style={{ width: 340 }}>
    <Field label="Название тендера" required><Input defaultValue="Устройство кровли" /></Field>
    <Field label="Комментарий"><Input placeholder="Необязательно" /></Field>
  </Stack>
);
/** Сам глиф: aria-hidden, смысл несёт слово «обязательно» рядом. */
export const Glyph = () => (
  <Text size="sm" tone="secondary">Обязательное поле помечается так: <RequiredMark /></Text>
);
