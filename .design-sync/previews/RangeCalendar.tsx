import { useState } from 'react';
import { RangeCalendar, Stack, Text } from 'clickup-shell';
/** Период: два независимых месяца и поля ДД.ММ.ГГГГ — мышью или набором. */
export const Period = () => {
  const [range, setRange] = useState({ from: '2026-06-08', to: '2026-07-21' });
  return (
    <Stack gap={2}>
      <Text size="sm" tone="secondary">Период сбора предложений</Text>
      <RangeCalendar from={range.from} to={range.to} onChange={(from, to) => setRange({ from, to })} />
    </Stack>
  );
};
