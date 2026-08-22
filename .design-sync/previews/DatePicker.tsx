import { useState } from 'react';
import { DatePicker, Grid, Stack, Text } from 'clickup-shell';
/** Одна дата: кнопка на поверхности .inline-edit, формат всегда ДД.ММ.ГГГГ. */
export const InSummary = () => {
  const [start, setStart] = useState('2026-06-02');
  const [end, setEnd] = useState('2026-07-15');
  return (
    <Stack gap={3} style={{ width: 420 }}>
      <Text size="sm" tone="tertiary" leading="normal">
        В покое кнопка выглядит текстом — та же поверхность, что у InlineInput.
      </Text>
      <Grid gap={4} columns={2}>
        <Stack gap={1}><Text size="sm" tone="secondary">Начало сбора</Text>
          <DatePicker label="Начало сбора" value={start} onChange={setStart} /></Stack>
        <Stack gap={1}><Text size="sm" tone="secondary">Срок сбора КП</Text>
          <DatePicker label="Срок сбора КП" value={end} onChange={setEnd} /></Stack>
      </Grid>
    </Stack>
  );
};
/** Пустое значение объясняется плейсхолдером. */
export const Empty = () => (
  <Stack gap={1} style={{ width: 220 }}>
    <Text size="sm" tone="secondary">Дата подписания</Text>
    <DatePicker label="Дата подписания" value="" onChange={() => {}} placeholder="Не назначена" />
  </Stack>
);
