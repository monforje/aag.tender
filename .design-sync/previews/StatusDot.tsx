import { Inline, Stack, StatusDot, Text } from 'clickup-shell';
/** Точка — ВТОРИЧНЫЙ сигнал: подпись рядом обязательна. */
export const InRows = () => (
  <Stack gap={2}>
    <Inline gap={2} align="center"><StatusDot tone="info" /><Text size="sm">Сбор КП идёт</Text></Inline>
    <Inline gap={2} align="center"><StatusDot tone="success" /><Text size="sm">Закрыт</Text></Inline>
    <Inline gap={2} align="center"><StatusDot tone="warning" /><Text size="sm">Срок продлён</Text></Inline>
    <Inline gap={2} align="center"><StatusDot tone="danger" /><Text size="sm">Отменён</Text></Inline>
    <Inline gap={2} align="center"><StatusDot tone="neutral" /><Text size="sm">Черновик</Text></Inline>
  </Stack>
);
