import { NumericText, Stack, Text } from 'clickup-shell';
/** Табличные цифры: разряды выстраиваются в столбик, суммы сравнимы глазом. */
export const Column = () => (
  <Stack gap={1} style={{ textAlign: 'right', width: 180 }}>
    <NumericText>412 800</NumericText>
    <NumericText>1 264 000</NumericText>
    <NumericText>2 018 400</NumericText>
    <NumericText>98 100</NumericText>
  </Stack>
);
/** Рядом с обычным текстом разница в выравнивании разрядов видна сразу. */
export const VsProportional = () => (
  <Stack gap={3}>
    <Stack gap={1} style={{ textAlign: 'right', width: 180 }}>
      <Text size="sm" tone="secondary">Обычные цифры</Text>
      <Text>1 111 111</Text><Text>2 000 000</Text><Text>1 264 000</Text>
    </Stack>
    <Stack gap={1} style={{ textAlign: 'right', width: 180 }}>
      <Text size="sm" tone="secondary">NumericText</Text>
      <NumericText>1 111 111</NumericText><NumericText>2 000 000</NumericText><NumericText>1 264 000</NumericText>
    </Stack>
  </Stack>
);
