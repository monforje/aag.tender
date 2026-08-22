import { Delta, Inline, Stack, Text } from 'clickup-shell';
/** Стрелка + число. Тон подключает ДОМЕН: «плюс = хорошо» верно не всегда. */
export const WithMeaning = () => (
  <Stack gap={3}>
    <Inline gap={2} align="baseline">
      <Text size="sm" tone="secondary" style={{ width: 160 }}>КП дешевле медианы</Text>
      <Delta value={-6} tone="success" format={(v) => `${v}%`} />
    </Inline>
    <Inline gap={2} align="baseline">
      <Text size="sm" tone="secondary" style={{ width: 160 }}>Перерасход бюджета</Text>
      <Delta value={12} tone="danger" format={(v) => `+${v}%`} />
    </Inline>
    <Inline gap={2} align="baseline">
      <Text size="sm" tone="secondary" style={{ width: 160 }}>Без изменений</Text>
      <Delta value={0} format={() => '0%'} />
    </Inline>
  </Stack>
);
/** Без тона — только направление, цвет не назначен. */
export const Neutral = () => (
  <Inline gap={4} align="baseline">
    <Delta value={24} /><Delta value={-3} /><Delta value={0} />
  </Inline>
);
