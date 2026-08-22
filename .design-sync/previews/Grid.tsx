import { Card, Grid, Stack, Text } from 'clickup-shell';
/** Плитки одинаковой природы: сетка равных ячеек. */
export const Fields = () => (
  <Grid gap={4} columns={2} style={{ width: 460 }}>
    {[['Заказчик', 'ООО «Северный-Девелопмент»'], ['Ответственный', 'Иванов Иван Иванович'],
      ['Срок сбора КП', '15.07.2026'], ['Вид работ', 'Строительство и СМР']].map(([k, v]) => (
      <Stack key={k} gap={1}><Text size="sm" tone="secondary">{k}</Text><Text weight="medium">{v}</Text></Stack>
    ))}
  </Grid>
);
/** minColumnWidth — колонок столько, сколько влезло. */
export const Auto = () => (
  <Grid gap={3} minColumnWidth={140} style={{ width: 460 }}>
    {['Кровля', 'Фасад', 'Сети', 'Инженерия', 'Проект'].map((t) => (
      <Card key={t} padding={3}><Text size="sm">{t}</Text></Card>
    ))}
  </Grid>
);
/** Разный зазор по осям: rowGap отдельно от gap. */
export const RowGap = () => (
  <Grid gap={2} rowGap={5} columns={3} style={{ width: 460 }}>
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <Card key={i} padding={2}><Text size="sm">Ячейка {i}</Text></Card>
    ))}
  </Grid>
);
