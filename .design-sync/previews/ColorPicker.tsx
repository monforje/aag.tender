import { useState } from 'react';
import { ColorPicker, Stack, Text } from 'clickup-shell';
/** Цвет БЕЗ смысла: пометка колонки подрядчика, подсветка строки. */
export const Pick = () => {
  const [color, setColor] = useState('#1D6EDC');
  return (
    <Stack gap={2} style={{ width: 280 }}>
      <Text size="sm" tone="secondary">Цвет колонки подрядчика</Text>
      <ColorPicker value={color} onChange={setColor} />
      <Text size="xs" tone="tertiary" leading="normal">
        Для цвета СО СМЫСЛОМ (статус, стадия) — Badge и токены --cu-tone-*.
      </Text>
    </Stack>
  );
};
