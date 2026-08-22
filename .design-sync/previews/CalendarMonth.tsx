import { useState } from 'react';
import { CalendarMonth, Stack, Text } from 'clickup-shell';
/** Сетка месяца: шапка с листалкой, дни. Смысл дня знает ПОТРЕБИТЕЛЬ. */
export const Month = () => {
  const [month, setMonth] = useState(new Date(2026, 6, 1));
  const [picked, setPicked] = useState('2026-07-15');
  return (
    <Stack gap={2} style={{ width: 300 }}>
      <Text size="sm" tone="secondary">Срок сбора КП</Text>
      <CalendarMonth
        month={month}
        onMonth={setMonth}
        onPick={setPicked}
        dayState={(iso) => (iso === picked ? { selected: true } : undefined)}
      />
    </Stack>
  );
};
/** Период: середина диапазона рисуется на ЯЧЕЙКЕ, кнопка дня остаётся без фона. */
export const Range = () => {
  const [month, setMonth] = useState(new Date(2026, 6, 1));
  const from = '2026-07-08';
  const to = '2026-07-21';
  return (
    <div style={{ width: 300 }}>
      <CalendarMonth
        month={month}
        onMonth={setMonth}
        onPick={() => {}}
        dayState={(iso) => {
          if (iso === from || iso === to) return { selected: true };
          if (iso > from && iso < to) return { plain: true };
          return undefined;
        }}
      />
    </div>
  );
};
