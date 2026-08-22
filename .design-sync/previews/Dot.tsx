import { Dot, Inline, Stack, Text } from 'clickup-shell';
/** Разделитель метаданных: только внутри Inline gap={1}. */
export const Metadata = () => (
  <Stack gap={2}>
    <Inline gap={1} align="baseline">
      <Text size="sm" tone="secondary">Иванов И. И.</Text><Dot />
      <Text size="sm" tone="secondary">14.06.2026</Text><Dot />
      <Text size="sm" tone="secondary">изменено 2 часа назад</Text>
    </Inline>
    <Inline gap={1} align="baseline">
      <Text size="sm" tone="secondary">Жилой комплекс «Северный»</Text><Dot />
      <Text size="sm" tone="secondary">Корпус 2</Text>
    </Inline>
  </Stack>
);
