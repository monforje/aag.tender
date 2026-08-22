import { Divider, Inline, Stack, Text } from 'clickup-shell';

/** Горизонтальная — граница между секциями страницы. */
export const Horizontal = () => (
  <Stack gap={3} style={{ width: 360 }}>
    <Text weight="semibold">Сводка тендера</Text>
    <Divider />
    <Text size="sm" tone="secondary">Заказчик, ответственный, сроки</Text>
    <Divider />
    <Text size="sm" tone="secondary">Позиции сметы</Text>
  </Stack>
);

/** Вертикальная — разделитель внутри полосы контролов. */
export const Vertical = () => (
  <Inline gap={3} align="center" style={{ height: 32 }}>
    <Text size="sm">Сумма</Text>
    <Divider orientation="vertical" />
    <Text size="sm">Цена за единицу</Text>
    <Divider orientation="vertical" />
    <Text size="sm">Отклонение</Text>
  </Inline>
);
