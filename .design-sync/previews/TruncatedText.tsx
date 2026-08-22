import { Stack, Text, TruncatedText } from 'clickup-shell';
/** Одна строка с многоточием, полный текст в title. */
export const InNarrowCell = () => (
  <Stack gap={3}>
    <Text size="sm" tone="secondary">Колонка 240px</Text>
    <div style={{ width: 240, border: '1px dashed rgba(0,0,0,.16)', padding: 8 }}>
      <TruncatedText>Реконструкция кровли административного корпуса на Профсоюзной, 132к4</TruncatedText>
    </div>
    <div style={{ width: 240, border: '1px dashed rgba(0,0,0,.16)', padding: 8 }}>
      <TruncatedText>Короткое название влезает</TruncatedText>
    </div>
  </Stack>
);
