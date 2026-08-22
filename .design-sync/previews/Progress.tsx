import { Progress, Stack, Text } from 'clickup-shell';

/** Измеримый ход: значение 0–100 и тон под смысл. */
export const Measured = () => (
  <Stack gap={4} style={{ width: 320 }}>
    <Stack gap={1}>
      <Text size="sm" tone="secondary">Заполнено КП: 38 из 42 позиций</Text>
      <Progress value={90} aria-label="Заполнение КП" />
    </Stack>
    <Stack gap={1}>
      <Text size="sm" tone="secondary">Согласование пройдено</Text>
      <Progress value={100} tone="success" aria-label="Согласование" />
    </Stack>
    <Stack gap={1}>
      <Text size="sm" tone="secondary">Срок сбора КП — осталось 2 дня из 14</Text>
      <Progress value={14} tone="warning" aria-label="Срок сбора" />
    </Stack>
  </Stack>
);

/** Без value — неопределённый режим: процентов нет, ход есть. */
export const Indeterminate = () => (
  <Stack gap={1} style={{ width: 320 }}>
    <Text size="sm" tone="secondary">Импортируем смету…</Text>
    <Progress aria-label="Импорт сметы" />
  </Stack>
);
